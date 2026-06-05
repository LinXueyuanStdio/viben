import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { VibenCore } from '../../core/core.js';
import type { ConnectionManager } from './connection-manager.js';
import type { EventBuffer } from './event-buffer.js';
import type { CommandRegistry } from '../../core/command-registry.js';
import { NotFoundError, BadRequestError, ServiceUnavailableError } from '../api-server/middleware/error-handler.js';
import { requireScopes } from '../api-server/middleware/auth.js';
import { resolveAttachments } from '../api-server/routes/attachment-utils.js';
import {
  SessionIdParamSchema,
  PromptBodySchema,
  PermissionResponseBodySchema,
} from '../api-server/schemas/sessions.js';
import { ExecuteCommandBodySchema } from '../api-server/schemas/commands.js';
import { serializeConnected, serializeError } from './event-serializer.js';

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new BadRequestError('INVALID_PARAM', 'Invalid URL parameter encoding');
  }
}

/** Dependencies injected into the SSE route handlers. */
export interface SSERouteDeps {
  core: VibenCore;
  connectionManager: ConnectionManager;
  eventBuffer: EventBuffer;
  commandRegistry?: CommandRegistry;
}

/**
 * Registers all SSE adapter routes on the given Fastify sub-app.
 *
 * Routes are mounted under `/api/v1/sse` by the plugin's `setup()` hook.
 * All routes require authentication (scopes enforced per-route).
 */
export async function sseRoutes(app: FastifyInstance, deps: SSERouteDeps): Promise<void> {
  // GET /sessions/:sessionId/stream — SSE event stream
  app.get<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId/stream',
    { preHandler: requireScopes('sessions:read') },
    async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeParam(rawId);

      const session = deps.core.sessionManager.getSession(sessionId);
      if (!session) {
        throw new NotFoundError('SESSION_NOT_FOUND', `Session "${sessionId}" not found`);
      }

      // Determine tokenId from auth context
      const tokenId = (request as any).auth?.tokenId ?? 'anonymous';

      // Check connection limits before hijacking the response, so we can still send HTTP errors
      let connection;
      try {
        // Temporarily probe limits by attempting to add — we need to check before hijack
        // Perform limit checks: add will throw if limits are exceeded
        connection = deps.connectionManager.addConnection(sessionId, tokenId, reply.raw);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Connection limit reached';
        return reply.status(429).send({ error: message });
      }

      // Set up SSE response headers (hijack after successful connection registration)
      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        // Disable buffering in Nginx/Cloudflare so events arrive without delay
        'X-Accel-Buffering': 'no',
      });

      // Send connected event
      raw.write(serializeConnected(connection.id, sessionId));

      // Replay missed events from buffer using Last-Event-ID header.
      // Null result means the referenced event ID has been evicted — notify the client.
      const lastEventId = request.headers['last-event-id'] as string | undefined;
      if (lastEventId) {
        const missed = deps.eventBuffer.getSince(sessionId, lastEventId);
        if (missed === null) {
          // Event ID not found in buffer — notify client
          raw.write(serializeError('replay_error', 'EVENTS_EXPIRED', {
            message: 'Some events may have been missed — buffer no longer contains the requested event ID.',
          }));
        } else {
          for (const event of missed) {
            raw.write(event.data as string);
          }
        }
      }

      // Keep-alive until client disconnects (handled by ConnectionManager's close listener)
    },
  );

  // POST /sessions/:sessionId/prompt — send a prompt (with optional file attachments) to a session.
  // bodyLimit is raised to 110 MB to accommodate up to 10 attachments × ~10 MB base64 each plus prompt overhead.
  app.post<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId/prompt',
    { preHandler: requireScopes('sessions:prompt'), bodyLimit: 115_000_000 },
    async (request, reply) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeParam(rawId);

      const session = deps.core.sessionManager.getSession(sessionId);
      if (!session) {
        throw new NotFoundError('SESSION_NOT_FOUND', `Session "${sessionId}" not found`);
      }

      if (session.status === 'cancelled' || session.status === 'finished' || session.status === 'error') {
        return reply.status(400).send({ error: `Session is ${session.status}` });
      }

      const body = PromptBodySchema.parse(request.body);

      // Decode base64 attachments and persist via FileService when provided
      let attachments;
      if (body.attachments?.length) {
        let fileService;
        try {
          fileService = deps.core.fileService;
        } catch {
          throw new ServiceUnavailableError(
            'FILE_SERVICE_UNAVAILABLE',
            'File attachments are not supported: file-service plugin is not loaded',
          );
        }
        attachments = await resolveAttachments(fileService, sessionId, body.attachments);
      }

      const userId = (request as any).auth?.tokenId ?? 'api';
      const { turnId, queueDepth } = await deps.core.handleMessageInSession(
        session,
        { channelId: 'api', userId, text: body.prompt, attachments },
        { channelUser: { channelId: 'api', userId } },
        // Route response back to the SSE adapter; 'api' is the identity namespace,
        // not an adapter name, so responseAdapterId must be explicit.
        { responseAdapterId: 'sse' },
      );

      return { ok: true, sessionId, queueDepth, turnId };
    },
  );

  // POST /sessions/:sessionId/permission — resolve a pending permission request
  app.post<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId/permission',
    { preHandler: requireScopes('sessions:permission') },
    async (request, reply) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeParam(rawId);

      const session = deps.core.sessionManager.getSession(sessionId);
      if (!session) {
        throw new NotFoundError('SESSION_NOT_FOUND', `Session "${sessionId}" not found`);
      }

      const body = PermissionResponseBodySchema.parse(request.body);

      if (!session.permissionGate.isPending || session.permissionGate.requestId !== body.permissionId) {
        return reply.status(400).send({ error: 'No matching pending permission request' });
      }

      session.permissionGate.resolve(body.optionId);

      if (body.feedback) {
        // Abort current turn so the agent doesn't respond about the refusal,
        // then queue feedback as next prompt.
        await session.abortPrompt().catch((err: unknown) => {
          request.log.warn({ err }, 'Failed to abort prompt before feedback enqueue');
        });
        await session.enqueuePrompt(body.feedback, undefined, { sourceAdapterId: 'sse' });
      }

      return { ok: true };
    },
  );

  // POST /sessions/:sessionId/cancel — cancel a session
  app.post<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId/cancel',
    { preHandler: requireScopes('sessions:write') },
    async (request) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeParam(rawId);

      const session = deps.core.sessionManager.getSession(sessionId);
      if (!session) {
        throw new NotFoundError('SESSION_NOT_FOUND', `Session "${sessionId}" not found`);
      }

      await session.abortPrompt();
      return { ok: true, sessionId };
    },
  );

  // POST /sessions/:sessionId/command — execute a command in session context
  app.post<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId/command',
    { preHandler: requireScopes('commands:execute') },
    async (request, reply) => {
      if (!deps.commandRegistry) {
        return reply.status(501).send({ error: 'Command registry not available' });
      }

      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeParam(rawId);

      const session = deps.core.sessionManager.getSession(sessionId);
      if (!session) {
        throw new NotFoundError('SESSION_NOT_FOUND', `Session "${sessionId}" not found`);
      }

      const body = ExecuteCommandBodySchema.parse(request.body);
      // Normalize command strings: ensure they start with `/` for CommandRegistry lookup
      const commandString = body.command.startsWith('/') ? body.command : `/${body.command}`;

      const result = await deps.commandRegistry.execute(commandString, {
        raw: '',
        sessionId,
        channelId: 'api',
        userId: (request as any).auth?.tokenId ?? 'api',
        reply: async () => {},
      });

      return { result };
    },
  );

  // GET /connections — list active SSE connections (admin info)
  app.get('/connections', { preHandler: requireScopes('system:admin') }, async () => {
    const connections = deps.connectionManager.listConnections();
    return {
      connections: connections.map((c) => ({
        id: c.id,
        sessionId: c.sessionId,
        connectedAt: c.connectedAt.toISOString(),
      })),
      total: connections.length,
    };
  });

}
