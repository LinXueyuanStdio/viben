import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { sseRoutes, type SSERouteDeps } from '../routes.js';
import { ConnectionManager } from '../connection-manager.js';
import { EventBuffer } from '../event-buffer.js';
import { globalErrorHandler } from '../../api-server/middleware/error-handler.js';

function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    agentName: 'test-agent',
    status: 'active',
    name: 'Test Session',
    workingDirectory: '/tmp',
    createdAt: new Date(),
    clientOverrides: {},
    queueDepth: 0,
    promptRunning: false,
    threadId: 'sess-1',
    channelId: 'sse',
    agentSessionId: 'agent-sess-1',
    enqueuePrompt: vi.fn().mockResolvedValue(undefined),
    abortPrompt: vi.fn().mockResolvedValue(undefined),
    permissionGate: {
      isPending: false,
      requestId: undefined,
      resolve: vi.fn(),
    },
    ...overrides,
  };
}

function createMockCore(session: ReturnType<typeof createMockSession> | null = null) {
  return {
    sessionManager: {
      getSession: vi.fn().mockReturnValue(session),
      cancelSession: vi.fn().mockResolvedValue(undefined),
    },
    adapters: new Map(),
    configManager: { get: vi.fn().mockReturnValue({ security: { maxConcurrentSessions: 10 } }) },
    // Simulates the middleware chain by delegating directly to session.enqueuePrompt so
    // existing assertions on enqueuePrompt remain valid in unit tests.
    handleMessageInSession: vi.fn().mockImplementation(async (sess: any, msg: any, _meta: any, opts: any) => {
      await sess.enqueuePrompt(msg.text, msg.attachments, {
        sourceAdapterId: msg.channelId,
        ...(opts?.responseAdapterId !== undefined && { responseAdapterId: opts.responseAdapterId }),
      });
      return { turnId: 'test-turn', queueDepth: 0 };
    }),
  } as any;
}

describe('SSE Routes', () => {
  let app: FastifyInstance;
  let deps: SSERouteDeps;
  let session: ReturnType<typeof createMockSession>;

  beforeEach(async () => {
    session = createMockSession();
    const core = createMockCore(session);
    const connectionManager = new ConnectionManager();
    const eventBuffer = new EventBuffer();

    deps = {
      core,
      connectionManager,
      eventBuffer,
      commandRegistry: undefined,
    };

    app = Fastify();
    app.setErrorHandler(globalErrorHandler);

    // Attach a wildcard auth context to every request so requireScopes passes in tests
    app.addHook('onRequest', async (request) => {
      (request as any).auth = { tokenId: 'test-token', role: 'admin', scopes: ['*'] };
    });

    await app.register(async (instance) => {
      await sseRoutes(instance, deps);
    });
    await app.ready();
  });

  describe('POST /sessions/:sessionId/prompt', () => {
    it('sends prompt to session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/sess-1/prompt',
        payload: { prompt: 'Hello world' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.ok).toBe(true);
      expect(body.sessionId).toBe('sess-1');
      // sourceAdapterId='api' is the identity namespace; responseAdapterId='sse' routes back to the SSE adapter
      expect(session.enqueuePrompt).toHaveBeenCalledWith('Hello world', undefined, expect.objectContaining({ sourceAdapterId: 'api', responseAdapterId: 'sse' }));
    });

    it('returns 404 for non-existent session', async () => {
      deps.core.sessionManager.getSession.mockReturnValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/sessions/unknown/prompt',
        payload: { prompt: 'Hello' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 400 for cancelled session', async () => {
      session.status = 'cancelled';

      const response = await app.inject({
        method: 'POST',
        url: '/sessions/sess-1/prompt',
        payload: { prompt: 'Hello' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /sessions/:sessionId/cancel', () => {
    it('cancels the session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/sess-1/cancel',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().ok).toBe(true);
      expect(session.abortPrompt).toHaveBeenCalledOnce();
    });

    it('returns 404 for non-existent session', async () => {
      deps.core.sessionManager.getSession.mockReturnValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/sessions/unknown/cancel',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /sessions/:sessionId/permission', () => {
    it('resolves pending permission', async () => {
      session.permissionGate.isPending = true;
      session.permissionGate.requestId = 'perm-1';

      const response = await app.inject({
        method: 'POST',
        url: '/sessions/sess-1/permission',
        payload: { permissionId: 'perm-1', optionId: 'allow' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().ok).toBe(true);
      expect(session.permissionGate.resolve).toHaveBeenCalledWith('allow');
    });

    it('returns 400 when no matching permission request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/sess-1/permission',
        payload: { permissionId: 'perm-wrong', optionId: 'allow' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('aborts current turn and enqueues feedback when feedback provided', async () => {
      session.permissionGate.isPending = true;
      session.permissionGate.requestId = 'perm-1';

      const response = await app.inject({
        method: 'POST',
        url: '/sessions/sess-1/permission',
        payload: { permissionId: 'perm-1', optionId: 'deny', feedback: 'Please use a different approach' },
      });

      expect(response.statusCode).toBe(200);
      expect(session.permissionGate.resolve).toHaveBeenCalledWith('deny');
      expect(session.abortPrompt).toHaveBeenCalled();
      expect(session.enqueuePrompt).toHaveBeenCalledWith(
        'Please use a different approach',
        undefined,
        { sourceAdapterId: 'sse' },
      );
      // abort must complete before enqueue (sequential, not concurrent)
      const abortOrder = (session.abortPrompt as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
      const enqueueOrder = (session.enqueuePrompt as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
      expect(abortOrder).toBeLessThan(enqueueOrder);
    });

    it('does not abort or enqueue when no feedback provided', async () => {
      session.permissionGate.isPending = true;
      session.permissionGate.requestId = 'perm-1';

      const response = await app.inject({
        method: 'POST',
        url: '/sessions/sess-1/permission',
        payload: { permissionId: 'perm-1', optionId: 'allow' },
      });

      expect(response.statusCode).toBe(200);
      expect(session.abortPrompt).not.toHaveBeenCalled();
      expect(session.enqueuePrompt).not.toHaveBeenCalled();
    });
  });

  describe('GET /connections', () => {
    it('returns empty connections list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/connections',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.connections).toEqual([]);
      expect(body.total).toBe(0);
    });
  });

  describe('POST /sessions/:sessionId/command', () => {
    it('returns 501 when command registry not available', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/sess-1/command',
        payload: { command: '/help' },
      });

      expect(response.statusCode).toBe(501);
    });
  });
});
