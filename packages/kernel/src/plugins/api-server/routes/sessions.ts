import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from './types.js';
import { AuthError, BadRequestError, NotFoundError, ServiceUnavailableError } from '../middleware/error-handler.js';
import { requireScopes } from '../middleware/auth.js';
import { resolveAttachments } from './attachment-utils.js';
import {
  SessionIdParamSchema,
  ConfigIdParamSchema,
  CreateSessionBodySchema,
  AdoptSessionBodySchema,
  PromptBodySchema,
  PermissionResponseBodySchema,
  DangerousModeBodySchema,
  UpdateSessionBodySchema,
  SetConfigOptionBodySchema,
  SetClientOverridesBodySchema,
} from '../schemas/sessions.js';


/**
 * Session management routes under `/api/v1/sessions`.
 *
 * Covers the full session lifecycle:
 * - CRUD: list, get, create (POST /), adopt (from existing agent), delete (cancel)
 * - Messaging: prompt (POST /:id/prompt), permission resolution (POST /:id/permission)
 * - Mutation: patch agent/voice/dangerousMode, archive, attach/detach adapter
 * - Config: read/write per-session config options and client overrides
 * - History: retrieve full conversation history via context manager
 *
 * `sessions:dangerous` scope is required for bypass-permissions routes because it is
 * not included in the default `operator` role — it must be explicitly granted.
 */
export async function sessionRoutes(
  app: FastifyInstance,
  deps: RouteDeps,
): Promise<void> {
  // GET /sessions — list all sessions (live + historical)
  app.get('/', { preHandler: requireScopes('sessions:read') }, async () => {
    const summaries = deps.core.sessionManager.listAllSessions();
    return {
      sessions: summaries.map((s) => ({
        id: s.id,
        agent: s.agent,
        status: s.status,
        name: s.name,
        workspace: s.workspace,
        channelId: s.channelId,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        dangerousMode: s.dangerousMode,
        queueDepth: s.queueDepth,
        promptRunning: s.promptRunning,
        configOptions: s.configOptions,
        capabilities: s.capabilities,
        isLive: s.isLive,
      })),
    };
  });

  // GET /sessions/:sessionId — get session details
  app.get<{ Params: { sessionId: string } }>(
    '/:sessionId',
    { preHandler: requireScopes('sessions:read') },
    async (request) => {
      const { sessionId } = SessionIdParamSchema.parse(request.params);
      const id = decodeURIComponent(sessionId);
      const session = deps.core.sessionManager.getSession(id);

      if (session) {
        return {
          session: {
            id: session.id,
            agent: session.agentName,
            status: session.status,
            name: session.name ?? null,
            workspace: session.workingDirectory,
            createdAt: session.createdAt.toISOString(),
            dangerousMode: session.clientOverrides.bypassPermissions ?? false,
            queueDepth: session.queueDepth,
            promptRunning: session.promptRunning,
            threadId: session.threadId,
            channelId: session.channelId,
            agentSessionId: session.agentSessionId,
            configOptions: session.configOptions?.length ? session.configOptions : undefined,
            capabilities: session.agentCapabilities ?? null,
          },
        };
      }

      // Fallback: serve from persisted record without resuming the agent
      const record = deps.core.sessionManager.getSessionRecord(id);
      if (!record) {
        throw new NotFoundError('SESSION_NOT_FOUND', `Session "${id}" not found`);
      }
      return {
        session: {
          id: record.sessionId,
          agent: record.agentName,
          status: record.status,
          name: record.name ?? null,
          workspace: record.workingDir,
          createdAt: record.createdAt,
          dangerousMode: record.clientOverrides?.bypassPermissions ?? false,
          queueDepth: 0,
          promptRunning: false,
          threadId: null,
          channelId: record.channelId,
          agentSessionId: record.agentSessionId,
          configOptions: record.acpState?.configOptions?.length ? record.acpState.configOptions : undefined,
          capabilities: record.acpState?.agentCapabilities ?? null,
        },
      };
    },
  );

  // POST /sessions — create a new session
  app.post('/', { preHandler: requireScopes('sessions:write') }, async (request, reply) => {
    const body = CreateSessionBodySchema.parse(request.body ?? {});

    // Check max concurrent sessions (default 20; security plugin may override via plugin settings)
    const settingsManager = deps.lifecycleManager?.settingsManager
    const secSettings = settingsManager ? await settingsManager.loadSettings('@viben/security') : {}
    const maxConcurrentSessions = (secSettings.maxConcurrentSessions as number) ?? 20;
    const activeSessions = deps.core.sessionManager
      .listSessions()
      .filter((s) => s.status === 'active' || s.status === 'initializing');
    if (activeSessions.length >= maxConcurrentSessions) {
      return reply.status(429).send({
        error: `Max concurrent sessions (${maxConcurrentSessions}) reached. Cancel a session first.`,
      });
    }

    // Resolve adapter: use explicit channel if provided, otherwise create a headless API session.
    // Omitting channel is intentional — API callers interact via SSE + POST /prompt.
    // Use POST /sessions/:id/attach to wire an adapter thread after creation.
    let adapterId: string | null = null;
    let adapter: InstanceType<any> | null = null;

    if (body.channel) {
      if (!deps.core.adapters.has(body.channel)) {
        const available =
          Array.from(deps.core.adapters.keys()).join(', ') || 'none';
        return reply.status(400).send({
          error: `Adapter '${body.channel}' is not connected. Available: ${available}`,
        });
      }
      adapterId = body.channel;
      adapter = deps.core.adapters.get(body.channel) ?? null;
    }

    const channelId = adapterId ?? 'api';

    const resolvedAgent = body.agent || deps.core.configManager.get().defaultAgent;
    const agentDef = deps.core.agentCatalog.resolve(resolvedAgent);

    let resolvedWorkspace: string;
    try {
      resolvedWorkspace = deps.core.configManager.resolveWorkspace(
        body.workspace || agentDef?.workingDirectory,
      );
    } catch (err) {
      throw new BadRequestError(
        'INVALID_WORKSPACE',
        err instanceof Error ? err.message : 'Invalid workspace path',
      );
    }

    const session = await deps.core.createSession({
      channelId,
      agentName: resolvedAgent,
      workingDirectory: resolvedWorkspace,
      createThread: !!adapter,
    });

    return {
      sessionId: session.id,
      agent: session.agentName,
      status: session.status,
      workspace: session.workingDirectory,
      channelId: session.channelId,
      threadId: session.threadId ?? null,
    };
  });

  // POST /sessions/adopt — adopt an existing agent session
  app.post<{ Body: { agent: string; agentSessionId: string; cwd?: string; channel?: string } }>(
    '/adopt',
    { preHandler: requireScopes('sessions:write') },
    async (request, reply) => {
      const body = AdoptSessionBodySchema.parse(request.body);

      const result = await deps.core.adoptSession(
        body.agent,
        body.agentSessionId,
        body.cwd ?? process.cwd(),
        body.channel,
      );

      if (result.ok) {
        return result;
      } else {
        const status =
          result.error === 'session_limit'
            ? 429
            : result.error === 'agent_not_supported'
              ? 400
              : 500;
        return reply.status(status).send(result);
      }
    },
  );

  // POST /sessions/:sessionId/prompt — send a prompt (with optional file attachments) to a session.
  // bodyLimit is raised to 110 MB to accommodate up to 10 attachments × ~10 MB base64 each plus prompt overhead.
  app.post<{ Params: { sessionId: string } }>(
    '/:sessionId/prompt',
    { preHandler: requireScopes('sessions:prompt'), bodyLimit: 115_000_000 },
    async (request, reply) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const session = await deps.core.getOrResumeSessionById(sessionId);
      if (!session) {
        throw new NotFoundError(
          'SESSION_NOT_FOUND',
          `Session "${sessionId}" not found`,
        );
      }

      if (
        session.status === 'cancelled' ||
        session.status === 'finished' ||
        session.status === 'error'
      ) {
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

      const sourceAdapterId = body.sourceAdapterId ?? 'sse';
      const userId = (request as any).auth?.tokenId ?? 'api';

      // Use 'api' as channelId so auto-register creates identity with source='api',
      // matching POST /identity/setup. Response routing still uses sourceAdapterId ('sse')
      // because 'api' is not an adapter — it's just the identity namespace.
      const result = await deps.core.handleMessageInSession(
        session,
        { channelId: 'api', userId, text: body.prompt, attachments },
        { channelUser: { channelId: 'api', userId } },
        {
          externalTurnId: body.turnId,
          // Preserve null (suppress response) but fall back to sourceAdapterId when
          // responseAdapterId is not specified, since 'api' has no adapter to route to.
          responseAdapterId: body.responseAdapterId !== undefined ? body.responseAdapterId : sourceAdapterId,
        },
      );

      // handleMessageInSession returns undefined when a middleware (e.g. security) blocks
      // the message. Surface this as a 403 so the caller knows it was rejected.
      if (!result) {
        throw new AuthError('MESSAGE_BLOCKED', 'Message was blocked by a middleware plugin.', 403);
      }

      return { ok: true, sessionId, queueDepth: result.queueDepth, turnId: result.turnId };
    },
  );

  // GET /sessions/:sessionId/queue — get pending queue state
  app.get<{ Params: { sessionId: string } }>(
    '/:sessionId/queue',
    { preHandler: requireScopes('sessions:read') },
    async (request) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const session = await deps.core.getOrResumeSessionById(sessionId);
      if (!session) {
        throw new NotFoundError(
          'SESSION_NOT_FOUND',
          `Session "${sessionId}" not found`,
        );
      }
      return {
        pending: session.queueItems,
        processing: session.promptRunning,
        queueDepth: session.queueDepth,
      };
    },
  );

  // POST /sessions/:sessionId/clear-queue — discard all pending (queued) prompts without affecting the running prompt
  app.post<{ Params: { sessionId: string } }>(
    '/:sessionId/clear-queue',
    { preHandler: requireScopes('sessions:write') },
    async (request) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const session = await deps.core.getOrResumeSessionById(sessionId);
      if (!session) {
        throw new NotFoundError('SESSION_NOT_FOUND', `Session "${sessionId}" not found`);
      }
      const dropped = session.queueDepth;
      session.clearQueue();
      return { ok: true, dropped };
    },
  );

  // POST /sessions/:sessionId/flush — cancel in-flight prompt and discard the entire queue
  app.post<{ Params: { sessionId: string } }>(
    '/:sessionId/flush',
    { preHandler: requireScopes('sessions:write') },
    async (request) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const session = await deps.core.getOrResumeSessionById(sessionId);
      if (!session) {
        throw new NotFoundError('SESSION_NOT_FOUND', `Session "${sessionId}" not found`);
      }
      await session.flushAll();
      return { ok: true };
    },
  );

  // POST /sessions/:sessionId/permission — resolve a pending permission request
  app.post<{ Params: { sessionId: string } }>(
    '/:sessionId/permission',
    { preHandler: requireScopes('sessions:permission') },
    async (request, reply) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const session = await deps.core.getOrResumeSessionById(sessionId);
      if (!session) {
        throw new NotFoundError(
          'SESSION_NOT_FOUND',
          `Session "${sessionId}" not found`,
        );
      }

      const body = PermissionResponseBodySchema.parse(request.body);

      if (
        !session.permissionGate.isPending ||
        session.permissionGate.requestId !== body.permissionId
      ) {
        return reply.status(400).send({
          error: 'No matching pending permission request',
        });
      }

      session.permissionGate.resolve(body.optionId);

      if (body.feedback) {
        // Abort current turn so the agent doesn't respond about the refusal,
        // then queue feedback as next prompt.
        await session.abortPrompt().catch((err: unknown) => {
          request.log.warn({ err }, 'Failed to abort prompt before feedback enqueue');
        });
        await session.enqueuePrompt(body.feedback, undefined, { sourceAdapterId: 'api' });
      }

      return { ok: true };
    },
  );

  // PATCH /sessions/:sessionId — update session (agent, voice, bypass permissions)
  app.patch<{ Params: { sessionId: string } }>(
    '/:sessionId',
    { preHandler: requireScopes('sessions:write') },
    async (request) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const session = await deps.core.getOrResumeSessionById(sessionId);
      if (!session) {
        throw new NotFoundError(
          'SESSION_NOT_FOUND',
          `Session "${sessionId}" not found`,
        );
      }

      const body = UpdateSessionBodySchema.parse(request.body);
      const changes: Record<string, unknown> = {};

      if (body.name !== undefined) {
        session.setName(body.name);
        changes.name = body.name;
      }

      if (body.agentName !== undefined) {
        if (session.promptRunning) {
          await session.abortPrompt();
        }
        const result = await deps.core.switchSessionAgent(sessionId, body.agentName);
        changes.agentName = body.agentName;
        changes.resumed = result.resumed;
      }

      if (body.voiceMode !== undefined) {
        session.setVoiceMode(body.voiceMode);
        changes.voiceMode = body.voiceMode;
      }

      if (body.dangerousMode !== undefined) {
        session.clientOverrides.bypassPermissions = body.dangerousMode;
        await deps.core.sessionManager.patchRecord(sessionId, {
          clientOverrides: session.clientOverrides,
        });
        changes.dangerousMode = body.dangerousMode;
      }

      return { ok: true, ...changes };
    },
  );

  // PATCH /sessions/:sessionId/dangerous — toggle bypass permissions
  app.patch<{ Params: { sessionId: string } }>(
    '/:sessionId/dangerous',
    { preHandler: requireScopes('sessions:dangerous') },
    async (request) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const session = await deps.core.getOrResumeSessionById(sessionId);
      if (!session) {
        throw new NotFoundError(
          'SESSION_NOT_FOUND',
          `Session "${sessionId}" not found`,
        );
      }

      const body = DangerousModeBodySchema.parse(request.body);

      session.clientOverrides.bypassPermissions = body.enabled;
      await deps.core.sessionManager.patchRecord(sessionId, {
        clientOverrides: session.clientOverrides,
      });
      return { ok: true, dangerousMode: body.enabled };
    },
  );

  // GET /sessions/:sessionId/config — get all configOptions + clientOverrides
  app.get<{ Params: { sessionId: string } }>(
    '/:sessionId/config',
    { preHandler: requireScopes('sessions:read') },
    async (request) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const session = deps.core.sessionManager.getSession(sessionId);
      if (session) {
        return {
          configOptions: session.configOptions,
          clientOverrides: session.clientOverrides,
        };
      }

      // Fallback: serve cached ACP state from persisted record
      const record = deps.core.sessionManager.getSessionRecord(sessionId);
      if (!record) {
        throw new NotFoundError('SESSION_NOT_FOUND', `Session "${sessionId}" not found`);
      }
      return {
        configOptions: record.acpState?.configOptions,
        clientOverrides: record.clientOverrides ?? {},
      };
    },
  );

  // PUT /sessions/:sessionId/config/:configId — set config option via agent
  app.put<{ Params: { sessionId: string; configId: string } }>(
    '/:sessionId/config/:configId',
    { preHandler: requireScopes('sessions:write') },
    async (request) => {
      const { sessionId: rawId, configId } = ConfigIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const session = await deps.core.getOrResumeSessionById(sessionId);
      if (!session) {
        throw new NotFoundError(
          'SESSION_NOT_FOUND',
          `Session "${sessionId}" not found`,
        );
      }

      const body = SetConfigOptionBodySchema.parse(request.body);

      await session.setConfigOption(configId, { type: 'select', value: body.value });

      await deps.core.sessionManager.patchRecord(sessionId, {
        acpState: session.toAcpStateSnapshot(),
      });

      return {
        configOptions: session.configOptions,
        clientOverrides: session.clientOverrides,
      };
    },
  );

  // GET /sessions/:sessionId/config/overrides — get clientOverrides
  app.get<{ Params: { sessionId: string } }>(
    '/:sessionId/config/overrides',
    { preHandler: requireScopes('sessions:read') },
    async (request) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const session = deps.core.sessionManager.getSession(sessionId);
      if (session) {
        return { clientOverrides: session.clientOverrides };
      }

      // Fallback: serve from persisted record
      const record = deps.core.sessionManager.getSessionRecord(sessionId);
      if (!record) {
        throw new NotFoundError('SESSION_NOT_FOUND', `Session "${sessionId}" not found`);
      }
      return { clientOverrides: record.clientOverrides ?? {} };
    },
  );

  // PUT /sessions/:sessionId/config/overrides — set clientOverrides
  app.put<{ Params: { sessionId: string } }>(
    '/:sessionId/config/overrides',
    { preHandler: requireScopes('sessions:write') },
    async (request) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const session = await deps.core.getOrResumeSessionById(sessionId);
      if (!session) {
        throw new NotFoundError(
          'SESSION_NOT_FOUND',
          `Session "${sessionId}" not found`,
        );
      }

      const body = SetClientOverridesBodySchema.parse(request.body);

      // Merge into existing overrides (don't replace entirely)
      if (body.bypassPermissions !== undefined) {
        session.clientOverrides.bypassPermissions = body.bypassPermissions;
      }

      await deps.core.sessionManager.patchRecord(sessionId, {
        clientOverrides: session.clientOverrides,
      });

      return { clientOverrides: session.clientOverrides };
    },
  );

  // POST /sessions/:sessionId/archive — archive a session
  app.post<{ Params: { sessionId: string } }>(
    '/:sessionId/archive',
    { preHandler: requireScopes('sessions:write') },
    async (request, reply) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const result = await deps.core.archiveSession(sessionId);
      if (result.ok) {
        return result;
      } else {
        return reply.status(400).send(result);
      }
    },
  );

  // POST /sessions/:sessionId/attach — attach an adapter to a session
  app.post<{ Params: { sessionId: string }; Body: { adapterId: string } }>(
    '/:sessionId/attach',
    { preHandler: requireScopes('sessions:write') },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { adapterId } = (request.body ?? {}) as { adapterId?: string };
      if (!adapterId) return reply.code(400).send({ error: 'adapterId is required' });
      try {
        const result = await deps.core.attachAdapter(sessionId, adapterId);
        return { ok: true, threadId: result.threadId };
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    },
  );

  // POST /sessions/:sessionId/detach — detach an adapter from a session
  app.post<{ Params: { sessionId: string }; Body: { adapterId: string } }>(
    '/:sessionId/detach',
    { preHandler: requireScopes('sessions:write') },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { adapterId } = (request.body ?? {}) as { adapterId?: string };
      if (!adapterId) return reply.code(400).send({ error: 'adapterId is required' });
      try {
        await deps.core.detachAdapter(sessionId, adapterId);
        return { ok: true };
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    },
  );

  // GET /sessions/:sessionId/history — get full conversation history
  app.get<{ Params: { sessionId: string } }>(
    '/:sessionId/history',
    { preHandler: requireScopes('sessions:read') },
    async (request, reply) => {
      const { sessionId } = SessionIdParamSchema.parse(request.params);
      // History is stored by sessionId — no need to resume the agent, just verify the session exists
      const isKnown = deps.core.sessionManager.getSession(sessionId)
        ?? deps.core.sessionManager.getSessionRecord(sessionId);
      if (!isKnown) {
        throw new NotFoundError(
          'SESSION_NOT_FOUND',
          `Session "${sessionId}" not found`,
        );
      }
      if (!deps.contextManager) {
        throw new ServiceUnavailableError(
          'HISTORY_UNAVAILABLE',
          'History store not available',
        );
      }
      const history = await deps.contextManager.getHistory(sessionId) ?? null;
      return { history };
    },
  );

  // DELETE /sessions/:sessionId — cancel a session
  app.delete<{ Params: { sessionId: string } }>(
    '/:sessionId',
    { preHandler: requireScopes('sessions:write') },
    async (request) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      // cancelSession handles both live and store-only sessions; just verify it exists first
      const isKnown = deps.core.sessionManager.getSession(sessionId)
        ?? deps.core.sessionManager.getSessionRecord(sessionId);
      if (!isKnown) {
        throw new NotFoundError(
          'SESSION_NOT_FOUND',
          `Session "${sessionId}" not found`,
        );
      }
      await deps.core.sessionManager.cancelSession(sessionId);
      return { ok: true };
    },
  );
}
