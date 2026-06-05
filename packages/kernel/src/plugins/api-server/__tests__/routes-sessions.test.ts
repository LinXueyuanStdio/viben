import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { sessionRoutes } from '../routes/sessions.js';
import { globalErrorHandler } from '../middleware/error-handler.js';
import type { RouteDeps } from '../routes/types.js';

function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    agentName: 'claude',
    status: 'active',
    name: 'Test Session',
    workingDirectory: '/tmp/test',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    clientOverrides: { bypassPermissions: false },
    queueDepth: 0,
    promptRunning: false,
    threadId: 'thread-1',
    channelId: 'api',
    agentSessionId: 'agent-sess-1',
    configOptions: [],
    agentCapabilities: undefined,
    agentInstance: {
      onPermissionRequest: null,
    },
    permissionGate: {
      isPending: false,
      requestId: null,
      resolve: vi.fn(),
    },
    enqueuePrompt: vi.fn().mockResolvedValue(undefined),
    abortPrompt: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockDeps(overrides: Partial<RouteDeps> = {}): RouteDeps {
  const mockSession = createMockSession();

  const sessionManager = {
    listSessions: vi.fn().mockReturnValue([mockSession]),
    listAllSessions: vi.fn().mockReturnValue([
      {
        id: 'sess-1',
        agent: 'claude',
        status: 'active',
        name: 'Test Session',
        workspace: '/tmp/test',
        channelId: 'api',
        createdAt: '2026-01-01T00:00:00Z',
        lastActiveAt: '2026-01-01T00:00:00Z',
        dangerousMode: false,
        queueDepth: 0,
        promptRunning: false,
        configOptions: undefined,
        capabilities: null,
        isLive: true,
      },
    ]),
    getSession: vi.fn().mockReturnValue(mockSession),
    getSessionRecord: vi.fn().mockReturnValue({ lastActiveAt: '2026-01-01T00:00:00Z' }),
    cancelSession: vi.fn().mockResolvedValue(undefined),
    patchRecord: vi.fn().mockResolvedValue(undefined),
  };

  return {
    core: {
      sessionManager,
      configManager: {
        get: vi.fn().mockReturnValue({
          defaultAgent: 'claude',
          security: { maxConcurrentSessions: 5 },
        }),
        resolveWorkspace: vi.fn().mockReturnValue('/tmp/test'),
      },
      agentCatalog: {
        resolve: vi.fn().mockReturnValue({ workingDirectory: '/tmp/test' }),
      },
      adapters: new Map(),
      createSession: vi.fn().mockResolvedValue(mockSession),
      adoptSession: vi.fn().mockResolvedValue({ ok: true, sessionId: 'sess-1' }),
      archiveSession: vi.fn().mockResolvedValue({ ok: true }),
      // Delegates to sessionManager.getSession so tests can control both via one mock
      getOrResumeSessionById: vi.fn().mockImplementation((id: string) =>
        Promise.resolve(sessionManager.getSession(id))
      ),
      agentManager: {
        getAvailableAgents: vi.fn().mockReturnValue([]),
      },
      eventBus: { emit: vi.fn() },
      handleMessageInSession: vi.fn().mockResolvedValue({ turnId: 'test-turn', queueDepth: 0 }),
    } as any,
    topicManager: undefined,
    startedAt: Date.now(),
    getVersion: () => '1.0.0',
    ...overrides,
  };
}

describe('session routes', () => {
  let app: FastifyInstance;
  let deps: RouteDeps;

  beforeEach(async () => {
    app = Fastify();
    app.setErrorHandler(globalErrorHandler);
    // Mock auth: decorate request with admin-level auth so scope checks pass
    app.decorateRequest('auth', null, []);
    app.addHook('onRequest', async (request) => {
      request.auth = { type: 'secret', role: 'admin', scopes: ['*'] };
    });
    deps = createMockDeps();
    await app.register(
      async (instance) => {
        await sessionRoutes(instance, deps);
      },
      { prefix: '/api/v1/sessions' },
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/sessions', () => {
    it('returns list of sessions with isLive and lastActiveAt', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/sessions',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessions).toHaveLength(1);
      expect(body.sessions[0].id).toBe('sess-1');
      expect(body.sessions[0].agent).toBe('claude');
      expect(body.sessions[0].status).toBe('active');
      expect(body.sessions[0].isLive).toBe(true);
      expect(body.sessions[0].lastActiveAt).toBe('2026-01-01T00:00:00Z');
      expect(body.sessions[0].channelId).toBe('api');
    });

    it('returns historical (non-live) sessions', async () => {
      (deps.core.sessionManager.listAllSessions as any).mockReturnValue([
        {
          id: 'old-sess',
          agent: 'claude',
          status: 'cancelled',
          name: 'Old Session',
          workspace: '/tmp/old',
          channelId: 'telegram',
          createdAt: '2026-01-01T00:00:00Z',
          lastActiveAt: '2026-01-02T00:00:00Z',
          dangerousMode: false,
          queueDepth: 0,
          promptRunning: false,
          configOptions: undefined,
          capabilities: null,
          isLive: false,
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/sessions',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessions[0].id).toBe('old-sess');
      expect(body.sessions[0].status).toBe('cancelled');
      expect(body.sessions[0].isLive).toBe(false);
      expect(body.sessions[0].lastActiveAt).toBe('2026-01-02T00:00:00Z');
    });
  });

  describe('GET /api/v1/sessions/:sessionId', () => {
    it('returns session details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/sessions/sess-1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.session.id).toBe('sess-1');
      expect(body.session.agent).toBe('claude');
    });

    it('returns 404 for unknown session', async () => {
      (deps.core.sessionManager.getSession as any).mockReturnValue(null);
      (deps.core.sessionManager.getSessionRecord as any).mockReturnValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/sessions/unknown',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/sessions', () => {
    it('creates a new session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions',
        payload: { agent: 'claude' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessionId).toBe('sess-1');
      expect(deps.core.createSession).toHaveBeenCalled();
    });

    it('returns 429 when max sessions reached', async () => {
      // Override lifecycleManager with settingsManager returning maxConcurrentSessions=0
      // so that any active session triggers the limit
      deps.lifecycleManager = {
        settingsManager: {
          loadSettings: vi.fn().mockResolvedValue({ maxConcurrentSessions: 0 }),
        },
      } as any;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions',
        payload: {},
      });

      expect(response.statusCode).toBe(429);
    });

    it('returns 400 for invalid adapter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions',
        payload: { channel: 'nonexistent' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('creates headless API session when no channel is provided, even if adapters are registered', async () => {
      // Simulate a Telegram adapter being registered
      (deps.core.adapters as Map<string, any>).set('telegram', {} as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions',
        payload: { agent: 'claude' },
      });

      expect(response.statusCode).toBe(200);
      expect(deps.core.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'api', createThread: false }),
      );
    });

    it('creates adapter session when explicit channel is provided', async () => {
      const mockAdapter = {} as any;
      (deps.core.adapters as Map<string, any>).set('telegram', mockAdapter);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions',
        payload: { agent: 'claude', channel: 'telegram' },
      });

      expect(response.statusCode).toBe(200);
      expect(deps.core.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'telegram', createThread: true }),
      );
    });
  });

  describe('POST /api/v1/sessions/adopt', () => {
    it('adopts an existing agent session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions/adopt',
        payload: { agent: 'claude', agentSessionId: 'ext-123' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
    });

    it('validates required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions/adopt',
        payload: { agent: '' },
      });

      // Zod validation will reject empty string (min 1)
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/sessions/:sessionId/prompt', () => {
    it('enqueues a prompt', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions/sess-1/prompt',
        payload: { prompt: 'Hello!' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.turnId).toBe('test-turn');
      expect(deps.core.handleMessageInSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sess-1' }),
        expect.objectContaining({ text: 'Hello!' }),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('returns 404 for unknown session', async () => {
      (deps.core.sessionManager.getSession as any).mockReturnValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions/unknown/prompt',
        payload: { prompt: 'Hello!' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 400 for terminated session', async () => {
      (deps.core.sessionManager.getSession as any).mockReturnValue(
        createMockSession({ status: 'cancelled' }),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions/sess-1/prompt',
        payload: { prompt: 'Hello!' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/sessions/:sessionId/permission', () => {
    it('resolves a pending permission', async () => {
      const mockResolve = vi.fn();
      (deps.core.sessionManager.getSession as any).mockReturnValue(
        createMockSession({
          permissionGate: {
            isPending: true,
            requestId: 'perm-1',
            resolve: mockResolve,
          },
        }),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions/sess-1/permission',
        payload: { permissionId: 'perm-1', optionId: 'allow' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockResolve).toHaveBeenCalledWith('allow');
    });

    it('returns 400 when no matching permission', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions/sess-1/permission',
        payload: { permissionId: 'wrong-id', optionId: 'allow' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('aborts current turn and enqueues feedback when feedback provided', async () => {
      const mockAbortPrompt = vi.fn().mockResolvedValue(undefined);
      const mockEnqueuePrompt = vi.fn().mockResolvedValue('turn-1');
      const mockResolve = vi.fn();
      (deps.core.sessionManager.getSession as any).mockReturnValue(
        createMockSession({
          permissionGate: { isPending: true, requestId: 'perm-1', resolve: mockResolve },
          abortPrompt: mockAbortPrompt,
          enqueuePrompt: mockEnqueuePrompt,
        }),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions/sess-1/permission',
        payload: { permissionId: 'perm-1', optionId: 'deny', feedback: 'Please use a different approach' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockResolve).toHaveBeenCalledWith('deny');
      expect(mockAbortPrompt).toHaveBeenCalled();
      expect(mockEnqueuePrompt).toHaveBeenCalledWith(
        'Please use a different approach',
        undefined,
        { sourceAdapterId: 'api' },
      );
      // abort must complete before enqueue (sequential, not concurrent)
      const abortOrder = mockAbortPrompt.mock.invocationCallOrder[0];
      const enqueueOrder = mockEnqueuePrompt.mock.invocationCallOrder[0];
      expect(abortOrder).toBeLessThan(enqueueOrder);
    });

    it('does not abort or enqueue when no feedback provided', async () => {
      const mockAbortPrompt = vi.fn().mockResolvedValue(undefined);
      const mockEnqueuePrompt = vi.fn().mockResolvedValue('turn-1');
      (deps.core.sessionManager.getSession as any).mockReturnValue(
        createMockSession({
          permissionGate: { isPending: true, requestId: 'perm-1', resolve: vi.fn() },
          abortPrompt: mockAbortPrompt,
          enqueuePrompt: mockEnqueuePrompt,
        }),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions/sess-1/permission',
        payload: { permissionId: 'perm-1', optionId: 'allow' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockAbortPrompt).not.toHaveBeenCalled();
      expect(mockEnqueuePrompt).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/v1/sessions/:sessionId/dangerous', () => {
    it('toggles bypass permissions', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/sessions/sess-1/dangerous',
        payload: { enabled: true },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.dangerousMode).toBe(true);
    });
  });

  describe('POST /api/v1/sessions/:sessionId/archive', () => {
    it('archives a session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions/sess-1/archive',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
    });

    it('returns 400 on archive failure', async () => {
      (deps.core.archiveSession as any).mockResolvedValue({
        ok: false,
        error: 'Not supported',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions/sess-1/archive',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/sessions/:sessionId/config', () => {
    it('returns configOptions and clientOverrides', async () => {
      const configOptions = [
        {
          id: 'mode',
          name: 'Mode',
          type: 'select',
          currentValue: 'code',
          options: [{ value: 'code', label: 'Code' }, { value: 'architect', label: 'Architect' }],
        },
      ];
      (deps.core.sessionManager.getSession as any).mockReturnValue(
        createMockSession({
          configOptions,
          clientOverrides: { bypassPermissions: true },
        }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/sessions/sess-1/config',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.configOptions).toEqual(configOptions);
      expect(body.clientOverrides).toEqual({ bypassPermissions: true });
    });

    it('returns 404 for unknown session', async () => {
      (deps.core.sessionManager.getSession as any).mockReturnValue(null);
      (deps.core.sessionManager.getSessionRecord as any).mockReturnValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/sessions/unknown/config',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/sessions/:sessionId/config/:configId', () => {
    it('sets config option and returns full state', async () => {
      const updatedConfigOptions = [
        {
          id: 'mode',
          name: 'Mode',
          type: 'select',
          currentValue: 'architect',
          options: [{ value: 'code', label: 'Code' }, { value: 'architect', label: 'Architect' }],
        },
      ];
      const mockSessionSetConfigOption = vi.fn().mockResolvedValue(undefined);
      const session = createMockSession({
        configOptions: updatedConfigOptions,
        clientOverrides: { bypassPermissions: false },
        setConfigOption: mockSessionSetConfigOption,
        toAcpStateSnapshot: vi.fn().mockReturnValue({ configOptions: updatedConfigOptions }),
      });
      // Make setConfigOption update configOptions on the session
      mockSessionSetConfigOption.mockImplementation(async () => {
        session.configOptions = updatedConfigOptions;
      });
      (deps.core.sessionManager.getSession as any).mockReturnValue(session);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/sessions/sess-1/config/mode',
        payload: { value: 'architect' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.configOptions).toEqual(updatedConfigOptions);
      expect(body.clientOverrides).toEqual({ bypassPermissions: false });
      expect(mockSessionSetConfigOption).toHaveBeenCalledWith('mode', { type: 'select', value: 'architect' });
      expect(deps.core.sessionManager.patchRecord).toHaveBeenCalled();
    });

    it('returns 404 for unknown session', async () => {
      (deps.core.sessionManager.getSession as any).mockReturnValue(null);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/sessions/unknown/config/mode',
        payload: { value: 'code' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/sessions/:sessionId/config/overrides', () => {
    it('returns clientOverrides', async () => {
      (deps.core.sessionManager.getSession as any).mockReturnValue(
        createMockSession({ clientOverrides: { bypassPermissions: true } }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/sessions/sess-1/config/overrides',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.clientOverrides).toEqual({ bypassPermissions: true });
    });

    it('returns 404 for unknown session', async () => {
      (deps.core.sessionManager.getSession as any).mockReturnValue(null);
      (deps.core.sessionManager.getSessionRecord as any).mockReturnValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/sessions/unknown/config/overrides',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/sessions/:sessionId/config/overrides', () => {
    it('sets bypassPermissions and persists', async () => {
      const session = createMockSession({ clientOverrides: { bypassPermissions: false } });
      (deps.core.sessionManager.getSession as any).mockReturnValue(session);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/sessions/sess-1/config/overrides',
        payload: { bypassPermissions: true },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.clientOverrides).toEqual({ bypassPermissions: true });
      expect(session.clientOverrides.bypassPermissions).toBe(true);
      expect(deps.core.sessionManager.patchRecord).toHaveBeenCalledWith('sess-1', {
        clientOverrides: { bypassPermissions: true },
      });
    });

    it('merges overrides instead of replacing entirely', async () => {
      const session = createMockSession({ clientOverrides: { bypassPermissions: true } });
      (deps.core.sessionManager.getSession as any).mockReturnValue(session);

      // Send an empty body (no bypassPermissions key) — should not clear existing value
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/sessions/sess-1/config/overrides',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // bypassPermissions should still be true since we didn't send it
      expect(body.clientOverrides.bypassPermissions).toBe(true);
    });

    it('returns 404 for unknown session', async () => {
      (deps.core.sessionManager.getSession as any).mockReturnValue(null);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/sessions/unknown/config/overrides',
        payload: { bypassPermissions: true },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/sessions/:sessionId', () => {
    it('cancels a session', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/sess-1',
      });

      expect(response.statusCode).toBe(200);
      expect(deps.core.sessionManager.cancelSession).toHaveBeenCalledWith(
        'sess-1',
      );
    });

    it('returns 404 for unknown session', async () => {
      (deps.core.sessionManager.getSession as any).mockReturnValue(null);
      (deps.core.sessionManager.getSessionRecord as any).mockReturnValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/unknown',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
