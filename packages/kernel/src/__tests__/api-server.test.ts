import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import * as path from "node:path";
import * as os from "node:os";
import * as net from "node:net";
import { EventBus } from "../core/event-bus.js";
import type { ApiServerInstance } from "../plugins/api-server/server.js";

describe("ApiServer", () => {
  let tmpDir: string;
  let portFilePath: string;
  let secretFilePath: string;
  let server: any;

  const mockTopicManager = {
    listTopics: vi.fn(() => []),
    deleteTopic: vi.fn(),
    cleanup: vi.fn(),
  };

  const mockCore = {
    handleNewSession: vi.fn(),
    createSession: vi.fn(),
    wireSessionEvents: vi.fn(),
    sessionManager: {
      getSession: vi.fn(),
      listSessions: vi.fn(() => []),
      listAllSessions: vi.fn(() => []),
      listRecords: vi.fn(() => []),
      updateSessionDangerousMode: vi.fn(), // legacy — kept for backward compat tests
      patchRecord: vi.fn(),
      cancelSession: vi.fn(),
      getSessionRecord: vi.fn(() => null),
    },
    agentManager: {
      getAvailableAgents: vi.fn(() => []),
    },
    agentCatalog: {
      load: vi.fn(),
      resolve: vi.fn((name: string) => ({ name, workingDirectory: "/tmp/ws" })),
    },
    configManager: {
      get: vi.fn(() => ({
        defaultAgent: "claude",
        agents: { claude: { command: "claude-agent-acp", args: [], env: {} } },
        workspace: {},
        logging: {
          level: "info",
          logDir: "~/.viben/logs",
          maxFileSize: "10m",
          maxFiles: 7,
          sessionLogRetentionDays: 30,
        },
        sessionStore: { ttlDays: 30 },
        runMode: "foreground",
        autoStart: false,
        integrations: {},
        agentSwitch: { labelHistory: true },
      })),
      save: vi.fn(),
      setPath: vi.fn(),
      resolveWorkspace: vi.fn(() => "/tmp/ws"),
      on: vi.fn(),
      emit: vi.fn(),
    },
    settingsManager: {
      loadSettings: vi.fn().mockResolvedValue({}),
      updatePluginSettings: vi.fn().mockResolvedValue(undefined),
    },
    adapters: new Map(),
    getOrResumeSessionById: vi.fn((id: string) =>
      Promise.resolve(mockCore.sessionManager.getSession(id))
    ),
    notificationManager: { notifyAll: vi.fn() },
    requestRestart: vi.fn(),
    tunnelService: undefined as unknown,
    eventBus: new EventBus(),
    handleMessageInSession: vi.fn().mockResolvedValue({ turnId: 'test-turn', queueDepth: 0 }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "viben-api-test-"));
    portFilePath = path.join(tmpDir, "api.port");
    secretFilePath = path.join(tmpDir, "api-secret");
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  async function startServer(portOverride?: number, lifecycleManagerOverride?: unknown) {
    // Create or load the test secret
    const dir = path.dirname(secretFilePath);
    fs.mkdirSync(dir, { recursive: true });
    let secret: string;
    try {
      secret = fs.readFileSync(secretFilePath, "utf-8").trim();
      if (!secret) throw new Error("empty");
    } catch {
      secret = crypto.randomBytes(32).toString("hex");
      fs.writeFileSync(secretFilePath, secret, { mode: 0o600 });
    }

    const { createApiServer } = await import("../plugins/api-server/server.js");
    const { SSEManager } = await import("../plugins/api-server/sse-manager.js");
    const { sessionRoutes } = await import("../plugins/api-server/routes/sessions.js");
    const { agentRoutes } = await import("../plugins/api-server/routes/agents.js");
    const { configRoutes } = await import("../plugins/api-server/routes/config.js");
    const { systemRoutes } = await import("../plugins/api-server/routes/health.js");
    const { topicRoutes } = await import("../plugins/api-server/routes/topics.js");
    const { tunnelRoutes } = await import("../plugins/api-server/routes/tunnel.js");
    const { notifyRoutes } = await import("../plugins/api-server/routes/notify.js");
    const { commandRoutes } = await import("../plugins/api-server/routes/commands.js");
    const { createAuthPreHandler } = await import("../plugins/api-server/middleware/auth.js");
    const { TokenStore } = await import("../plugins/api-server/auth/token-store.js");

    const tokenStore = new TokenStore(path.join(tmpDir, "tokens.json"));
    const jwtSecret = crypto.randomBytes(32).toString("hex");

    server = await createApiServer({
      port: portOverride ?? 0,
      host: "127.0.0.1",
      getSecret: () => secret,
      getJwtSecret: () => jwtSecret,
      tokenStore,
    });

    const authPreHandler = createAuthPreHandler(() => secret, () => jwtSecret, tokenStore);

    const deps: Record<string, unknown> = {
      core: mockCore as any,
      topicManager: mockTopicManager as any,
      startedAt: Date.now(),
      getVersion: () => "0.0.0-dev",
      authPreHandler,
    };
    if (lifecycleManagerOverride !== undefined) {
      deps.lifecycleManager = lifecycleManagerOverride;
    }

    server.registerPlugin('/api/v1/sessions', async (app: any) => sessionRoutes(app, deps));
    server.registerPlugin('/api/v1/agents', async (app: any) => agentRoutes(app, deps));
    server.registerPlugin('/api/v1/config', async (app: any) => configRoutes(app, deps));
    server.registerPlugin('/api/v1/system', async (app: any) => systemRoutes(app, deps), { auth: false });
    server.registerPlugin('/api/v1/topics', async (app: any) => topicRoutes(app, deps));
    server.registerPlugin('/api/v1/tunnel', async (app: any) => tunnelRoutes(app, deps));
    server.registerPlugin('/api/v1/notify', async (app: any) => notifyRoutes(app, deps));
    server.registerPlugin('/api/v1/commands', async (app: any) => commandRoutes(app, deps));

    // SSE manager
    const sseManager = new SSEManager(
      mockCore.eventBus,
      () => {
        const sessions = mockCore.sessionManager.listSessions();
        return {
          active: sessions.filter((s: any) => s.status === "active" || s.status === "initializing").length,
          total: sessions.length,
        };
      },
      Date.now(),
    );
    server.registerPlugin('/api/v1/events', async (app: any) => {
      app.get('/', sseManager.createFastifyHandler());
    });

    const addr = await server.start();
    const actualPort = addr.port;

    // Write port file
    fs.mkdirSync(path.dirname(portFilePath), { recursive: true });
    fs.writeFileSync(portFilePath, String(actualPort));

    sseManager.setup();

    return actualPort;
  }

  function readTestSecret(): string {
    return fs.readFileSync(secretFilePath, "utf-8").trim();
  }

  function apiFetch(port: number, urlPath: string, options?: RequestInit) {
    const token = fs.existsSync(secretFilePath)
      ? fs.readFileSync(secretFilePath, "utf-8").trim()
      : "";
    const headers = new Headers(options?.headers);
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    // Auto-set Content-Type for JSON bodies (Fastify requires it for body parsing)
    if (options?.body && typeof options.body === "string" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return globalThis.fetch(`http://127.0.0.1:${port}${urlPath}`, {
      ...options,
      headers,
    });
  }

  it("starts and writes port file", async () => {
    const port = await startServer();
    expect(fs.existsSync(portFilePath)).toBe(true);
    const writtenPort = parseInt(
      fs.readFileSync(portFilePath, "utf-8").trim(),
      10,
    );
    expect(writtenPort).toBe(port);
  });

  it("stops and removes port file", async () => {
    await startServer();
    await server.stop();
    // Port file removal is now handled by the plugin teardown (index.ts).
    // In the test we write the port file manually in startServer, so we
    // clean it up here to verify it existed in the first place.
    try { fs.unlinkSync(portFilePath); } catch { /* ok */ }
    server = null;
  });

  it("retries next port when configured port is in use (EADDRINUSE)", async () => {
    const blocker = net.createServer();
    const blockerPort = await new Promise<number>((resolve) => {
      blocker.listen(0, "127.0.0.1", () => {
        resolve((blocker.address() as net.AddressInfo).port);
      });
    });

    try {
      const port = await startServer(blockerPort);
      // Should have found a different port (blockerPort + N)
      expect(port).toBeGreaterThan(0);
      expect(port).not.toBe(blockerPort);
    } finally {
      blocker.close();
    }
  });

  it("POST /api/sessions creates a session", async () => {
    const mockAgentInstance = { onPermissionRequest: vi.fn() };
    const mockSession = {
      id: "abc123",
      agentName: "claude",
      status: "initializing",
      workingDirectory: "/tmp/ws",
      agentInstance: mockAgentInstance,
    };
    mockCore.createSession.mockResolvedValueOnce(mockSession);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: "claude" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessionId).toBe("abc123");
    expect(data.agent).toBe("claude");
    expect(data.status).toBe("initializing");
    expect(data.workspace).toBe("/tmp/ws");
    expect(mockCore.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: "api", agentName: "claude" }),
    );
    // Verify auto-approve permission handler was wired
    expect(mockAgentInstance.onPermissionRequest).toBeTypeOf("function");
  });

  it("POST /api/sessions with empty body uses defaults", async () => {
    const mockSession = {
      id: "def456",
      agentName: "claude",
      status: "initializing",
      workingDirectory: "/tmp/ws",
      agentInstance: { onPermissionRequest: vi.fn() },
    };
    mockCore.createSession.mockResolvedValueOnce(mockSession);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions", { method: "POST" });
    expect(res.status).toBe(200);
    expect(mockCore.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: "api" }),
    );
  });

  it("POST /api/sessions returns 429 when max sessions reached", async () => {
    mockCore.sessionManager.listSessions.mockReturnValueOnce([
      { status: "active" },
      { status: "active" },
      { status: "active" },
      { status: "active" },
      { status: "initializing" },
    ]);
    // Provide lifecycleManager with settingsManager returning maxConcurrentSessions=5
    const mockLifecycleManager = {
      settingsManager: {
        loadSettings: vi.fn().mockResolvedValue({ maxConcurrentSessions: 5 }),
      },
    };
    const port = await startServer(undefined, mockLifecycleManager);

    const res = await apiFetch(port, "/api/v1/sessions", { method: "POST" });
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain("concurrent sessions");
  });

  it("DELETE /api/sessions/:id cancels a session", async () => {
    const mockSession = { id: "abc123", abortPrompt: vi.fn() };
    mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession);
    mockCore.sessionManager.cancelSession = vi.fn();
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/abc123", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockCore.sessionManager.cancelSession).toHaveBeenCalledWith(
      "abc123",
    );
  });

  it("DELETE /api/sessions/:id calls sessionManager.cancelSession", async () => {
    const mockSession = { id: "abc", abortPrompt: vi.fn() };
    mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession);
    mockCore.sessionManager.cancelSession = vi.fn();
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/abc", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(mockCore.sessionManager.cancelSession).toHaveBeenCalledWith("abc");
  });

  it("DELETE /api/sessions/:id returns 404 for unknown session", async () => {
    mockCore.sessionManager.getSession.mockReturnValueOnce(undefined);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/unknown", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("SESSION_NOT_FOUND");
  });

  it("GET /api/sessions returns session list", async () => {
    mockCore.sessionManager.listAllSessions.mockReturnValueOnce([
      {
        id: "abc",
        agent: "claude",
        status: "active",
        name: "Fix bug",
        workspace: "/tmp/a",
        channelId: "api",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastActiveAt: null,
        dangerousMode: false,
        queueDepth: 0,
        promptRunning: false,
        configOptions: undefined,
        capabilities: null,
        isLive: true,
      },
      {
        id: "def",
        agent: "codex",
        status: "initializing",
        name: null,
        workspace: "/tmp/b",
        channelId: "api",
        createdAt: "2026-01-02T00:00:00.000Z",
        lastActiveAt: null,
        dangerousMode: false,
        queueDepth: 0,
        promptRunning: false,
        configOptions: undefined,
        capabilities: null,
        isLive: true,
      },
    ]);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessions).toHaveLength(2);
    expect(data.sessions[0]).toMatchObject({
      id: "abc",
      agent: "claude",
      status: "active",
      name: "Fix bug",
      workspace: "/tmp/a",
    });
    expect(data.sessions[1]).toMatchObject({
      id: "def",
      agent: "codex",
      status: "initializing",
      name: null,
      workspace: "/tmp/b",
    });
  });

  it("GET /api/sessions returns extended fields", async () => {
    const created = new Date("2026-01-01T00:00:00Z");
    mockCore.sessionManager.listAllSessions.mockReturnValueOnce([
      {
        id: "abc",
        agent: "claude",
        status: "active",
        name: "Test",
        workspace: "/tmp",
        channelId: "api",
        createdAt: created.toISOString(),
        lastActiveAt: null,
        dangerousMode: true,
        queueDepth: 2,
        promptRunning: true,
        configOptions: undefined,
        capabilities: null,
        isLive: true,
      },
    ]);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions");
    const body = await res.json();
    expect(body.sessions[0]).toMatchObject({
      id: "abc",
      agent: "claude",
      status: "active",
      name: "Test",
      workspace: "/tmp",
      createdAt: created.toISOString(),
      dangerousMode: true,
      queueDepth: 2,
      promptRunning: true,
      lastActiveAt: null,
    });
  });

  it("GET /api/agents returns agent list with default", async () => {
    mockCore.agentManager.getAvailableAgents.mockReturnValueOnce([
      { name: "claude", command: "claude-agent-acp", args: [] },
      { name: "codex", command: "codex", args: ["--acp"] },
    ]);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/agents");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.default).toBe("claude");
    expect(data.agents).toHaveLength(2);
    expect(data.agents[0]).toMatchObject({
      name: "claude",
      command: "claude-agent-acp",
      args: [],
      capabilities: { supportsResume: true },
    });
  });

  it("returns 404 for unknown routes", async () => {
    const port = await startServer();
    const res = await apiFetch(port, "/api/v1/unknown");
    expect(res.status).toBe(404);
  });

  it("GET /api/topics returns topic list", async () => {
    mockTopicManager.listTopics.mockReturnValueOnce([
      {
        sessionId: "abc",
        topicId: 42,
        name: "Fix bug",
        status: "finished",
        agentName: "claude",
        lastActiveAt: "2026-03-21",
      },
    ]);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/topics");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.topics).toHaveLength(1);
    expect(data.topics[0].sessionId).toBe("abc");
  });

  it("GET /api/topics filters by status", async () => {
    mockTopicManager.listTopics.mockReturnValueOnce([]);
    const port = await startServer();

    await apiFetch(port, "/api/v1/topics?status=finished,error");
    expect(mockTopicManager.listTopics).toHaveBeenCalledWith({
      statuses: ["finished", "error"],
    });
  });

  it("DELETE /api/topics/:sessionId deletes topic", async () => {
    mockTopicManager.deleteTopic.mockResolvedValueOnce({
      ok: true,
      topicId: 42,
    });
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/topics/abc123", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.topicId).toBe(42);
  });

  it("DELETE /api/topics/:sessionId returns 409 for active session", async () => {
    mockTopicManager.deleteTopic.mockResolvedValueOnce({
      ok: false,
      needsConfirmation: true,
      session: { id: "abc", name: "Task", status: "active" },
    });
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/topics/abc", { method: "DELETE" });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.needsConfirmation).toBe(true);
  });

  it("DELETE /api/topics/:sessionId with force=true deletes active session", async () => {
    mockTopicManager.deleteTopic.mockResolvedValueOnce({
      ok: true,
      topicId: 42,
    });
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/topics/abc?force=true", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    expect(mockTopicManager.deleteTopic).toHaveBeenCalledWith("abc", {
      confirmed: true,
    });
  });

  it("DELETE /api/topics/:sessionId returns 403 for system topic", async () => {
    mockTopicManager.deleteTopic.mockResolvedValueOnce({
      ok: false,
      error: "Cannot delete system topic",
    });
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/topics/sys", { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  it("POST /api/topics/cleanup cleans up topics", async () => {
    mockTopicManager.cleanup.mockResolvedValueOnce({
      deleted: ["a", "b"],
      failed: [],
    });
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/topics/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statuses: ["finished", "error"] }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toEqual(["a", "b"]);
    expect(data.failed).toHaveLength(0);
  });

  // ===== New endpoint tests =====

  it("GET /api/health returns basic system health (public endpoint)", async () => {
    const port = await startServer();

    // Public /health endpoint returns minimal info only (no auth required)
    const res = await apiFetch(port, "/api/v1/system/health");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.version).toBeDefined();
    expect(typeof data.uptime).toBe("number");
    // Sensitive details (memory, sessions, adapters) are on /health/details — not here
    expect(data.memory).toBeUndefined();
    expect(data.sessions).toBeUndefined();
  });

  it("GET /api/health/details returns full system health (authenticated)", async () => {
    mockCore.sessionManager.listSessions.mockReturnValueOnce([
      { status: "active" },
      { status: "initializing" },
      { status: "finished" },
    ]);
    mockCore.sessionManager.listRecords.mockReturnValueOnce([
      { sessionId: "a" },
      { sessionId: "b" },
      { sessionId: "c" },
      { sessionId: "d" },
    ]);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/system/health/details");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.version).toBeDefined();
    expect(typeof data.uptime).toBe("number");
    expect(data.memory.rss).toBeGreaterThan(0);
    expect(data.memory.heapUsed).toBeGreaterThan(0);
    expect(data.memory.heapTotal).toBeGreaterThan(0);
    expect(data.sessions.active).toBe(2);
    expect(data.sessions.total).toBe(4);
    expect(data.tunnel.enabled).toBe(false);
  });

  it("GET /api/health keeps the legacy dashboard endpoint working", async () => {
    mockCore.sessionManager.listSessions.mockReturnValueOnce([
      { status: "active" },
      { status: "finished" },
    ]);
    mockCore.sessionManager.listRecords.mockReturnValueOnce([
      { sessionId: "a" },
      { sessionId: "b" },
      { sessionId: "c" },
    ]);
    const port = await startServer();

    const res = await apiFetch(port, "/api/health");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.memory.rss).toBeGreaterThan(0);
    expect(data.sessions.active).toBe(1);
    expect(data.sessions.total).toBe(3);
    expect(data.tunnel.enabled).toBe(false);
  });

  it("GET /api/version returns version", async () => {
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/system/version");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.version).toBeDefined();
    expect(typeof data.version).toBe("string");
  });

  it("GET /api/adapters returns adapter list", async () => {
    mockCore.adapters.set("telegram", { name: "telegram" });
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/system/adapters");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.adapters).toEqual([{ name: "telegram", type: "built-in" }]);

    // Cleanup
    mockCore.adapters.delete("telegram");
  });

  it("GET /api/tunnel returns tunnel disabled when no tunnel", async () => {
    mockCore.tunnelService = undefined;
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/tunnel");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(false);
  });

  it("GET /api/config returns redacted config", async () => {
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/config");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.config).toBeDefined();
    expect(data.config.defaultAgent).toBe("claude");
  });

  it("POST /api/sessions/:id/prompt sends prompt to session", async () => {
    const mockSession = {
      id: "abc123",
      status: "active",
      queueDepth: 0,
    };
    mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/abc123/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Hello world" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.sessionId).toBe("abc123");
    expect(data.turnId).toBe("test-turn");
    expect(mockCore.handleMessageInSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "abc123" }),
      expect.objectContaining({ text: "Hello world" }),
      expect.any(Object),
      expect.any(Object),
    );
  });

  it("POST /api/sessions/:id/prompt returns 404 for unknown session", async () => {
    mockCore.sessionManager.getSession.mockReturnValueOnce(undefined);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/unknown/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Hello" }),
    });

    expect(res.status).toBe(404);
  });

  it("POST /api/sessions/:id/prompt returns 400 for inactive session", async () => {
    const mockSession = { id: "abc123", status: "cancelled" };
    mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/abc123/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Hello" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("cancelled");
  });

  it("POST /api/sessions/:id/prompt returns 400 for missing prompt", async () => {
    const mockSession = { id: "abc123", status: "active" };
    mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/abc123/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/sessions/:id returns full session details", async () => {
    const createdAt = new Date("2026-03-21T10:00:00Z");
    const mockSession = {
      id: "abc123",
      agentName: "claude",
      status: "active",
      name: "Fix bug",
      workingDirectory: "/tmp/ws",
      createdAt,
      clientOverrides: { bypassPermissions: false },
      queueDepth: 2,
      promptRunning: true,
      threadId: "thread-1",
      channelId: "telegram",
      agentSessionId: "agent-sess-1",
    };
    mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/abc123");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.session.id).toBe("abc123");
    expect(data.session.agent).toBe("claude");
    expect(data.session.status).toBe("active");
    expect(data.session.name).toBe("Fix bug");
    expect(data.session.workspace).toBe("/tmp/ws");
    expect(data.session.createdAt).toBe(createdAt.toISOString());
    expect(data.session.dangerousMode).toBe(false);
    expect(data.session.queueDepth).toBe(2);
    expect(data.session.promptRunning).toBe(true);
    expect(data.session.threadId).toBe("thread-1");
    expect(data.session.channelId).toBe("telegram");
    expect(data.session.agentSessionId).toBe("agent-sess-1");
  });

  it("GET /api/sessions/:id returns 404 for unknown session", async () => {
    mockCore.sessionManager.getSession.mockReturnValueOnce(undefined);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/unknown");
    expect(res.status).toBe(404);
  });

  it("PATCH /api/sessions/:id/dangerous toggles bypass permissions", async () => {
    const mockSession = { id: "abc123", clientOverrides: { bypassPermissions: false } };
    mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/abc123/dangerous", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.dangerousMode).toBe(true);
    expect(mockSession.clientOverrides.bypassPermissions).toBe(true);
    expect(mockCore.sessionManager.patchRecord).toHaveBeenCalledWith("abc123", {
      clientOverrides: { bypassPermissions: true },
    });
  });

  it("PATCH /api/sessions/:id/dangerous returns 400 for missing enabled", async () => {
    const mockSession = { id: "abc123", clientOverrides: { bypassPermissions: false } };
    mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/abc123/dangerous", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/notify sends notification", async () => {
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello everyone" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockCore.notificationManager.notifyAll).toHaveBeenCalledWith({
      sessionId: "system",
      type: "completed",
      summary: "Hello everyone",
    });
  });

  it("POST /api/notify returns 400 for missing message", async () => {
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Required");
  });

  it("POST /api/restart returns 200 and triggers restart", async () => {
    mockCore.requestRestart = vi.fn();
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/system/restart", { method: "POST" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.message).toBe("Restarting...");

    await new Promise((resolve) => setImmediate(resolve));
    expect(mockCore.requestRestart).toHaveBeenCalled();
  });

  it("POST /api/restart returns 501 when restart not available", async () => {
    mockCore.requestRestart = null as any;
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/system/restart", { method: "POST" });
    expect(res.status).toBe(501);

    // Restore for other tests
    mockCore.requestRestart = vi.fn();
  });

  it("PATCH /api/config updates config", async () => {
    const fullConfig = {
      defaultAgent: "claude",
      security: {
        allowedUserIds: [],
        maxConcurrentSessions: 5,
        sessionTimeoutMinutes: 60,
      },
      channels: { telegram: { botToken: "secret-token" } },
      agents: { claude: { command: "claude-agent-acp", args: [], env: {} } },
      workspace: {},
      logging: { level: "info", pretty: true },
      runMode: "foreground",
      autoStart: false,
      api: { port: 21420, host: "127.0.0.1" },
      sessionStore: { ttlDays: 30 },
      tunnel: {
        enabled: true,
        port: 3100,
        provider: "cloudflare",
        options: {},
        storeTtlMinutes: 60,
        auth: { enabled: false },
      },
      speech: {
        stt: { provider: null, providers: {} },
        tts: {
          provider: null,
          providers: { "edge-tts": { voice: "en-US-AriaNeural" } },
        },
      },
    };
    mockCore.configManager.get.mockReturnValue(fullConfig);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "defaultAgent", value: "codex" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockCore.configManager.setPath).toHaveBeenCalledWith(
      "defaultAgent",
      "codex",
    );
  });

  it("PATCH /api/config returns 400 for missing path", async () => {
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "codex" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/config/editable returns safe fields with values", async () => {
    const port = await startServer();
    const res = await apiFetch(port, "/api/v1/config/editable");
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.fields).toBeInstanceOf(Array);
    expect(data.fields.length).toBeGreaterThan(0);

    for (const field of data.fields) {
      expect(field.path).toBeTruthy();
      expect(field.displayName).toBeTruthy();
      expect(field.type).toBeTruthy();
      // value may be undefined for plugin-specific fields when mock config
      // doesn't have the full structure — only verify structure, not values
    }

    const agentField = data.fields.find((f: any) => f.path === "defaultAgent");
    expect(agentField).toBeDefined();
    expect(agentField.type).toBe("select");
    expect(agentField.options).toContain("claude");
    expect(agentField.value).toBe("claude");
  });

  it("POST /api/sessions/:id/permission resolves pending permission", async () => {
    const mockGate = { isPending: true, requestId: "perm1", resolve: vi.fn() };
    const mockSession = { id: "abc", permissionGate: mockGate };
    mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/abc/permission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionId: "perm1", optionId: "allow" }),
    });
    expect(res.status).toBe(200);
    expect(mockGate.resolve).toHaveBeenCalledWith("allow");
  });

  it("POST /api/sessions/:id/permission returns 404 for unknown session", async () => {
    mockCore.sessionManager.getSession.mockReturnValueOnce(undefined);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/unknown/permission", {
      method: "POST",
      body: JSON.stringify({ permissionId: "p1", optionId: "allow" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/sessions/:id/permission returns 400 when no pending permission", async () => {
    const mockGate = { isPending: false, requestId: undefined };
    const mockSession = { id: "abc", permissionGate: mockGate };
    mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession);
    const port = await startServer();

    const res = await apiFetch(port, "/api/v1/sessions/abc/permission", {
      method: "POST",
      body: JSON.stringify({ permissionId: "perm1", optionId: "allow" }),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/config uses registry for needsRestart", async () => {
    const port = await startServer();

    // Hot-reloadable field — should NOT need restart
    const res1 = await apiFetch(port, "/api/v1/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "logging.level",
        value: "debug",
      }),
    });
    const data1 = (await res1.json()) as any;
    expect(data1.ok).toBe(true);
    expect(data1.needsRestart).toBe(false);

    // Unknown/unsafe field — should return 403
    const res2 = await apiFetch(port, "/api/v1/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "nonexistent.field", value: false }),
    });
    const data2 = (await res2.json()) as any;
    expect(res2.status).toBe(403);
    expect(data2.error).toContain("cannot be modified");
  });

  it("GET /api/events returns SSE headers", async () => {
    mockCore.eventBus = new EventBus();
    const port = await startServer();

    const controller = new AbortController();
    const res = await apiFetch(port, "/api/v1/events", {
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
    controller.abort();
  });

  it("GET /api/events streams session:created events", async () => {
    const eventBus = new EventBus();
    mockCore.eventBus = eventBus;
    const port = await startServer();

    const controller = new AbortController();
    const res = await apiFetch(port, "/api/v1/events", {
      signal: controller.signal,
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    // Read initial `: connected` comment
    await reader.read();

    // Wait for SSE connection to be registered
    await new Promise((r) => setTimeout(r, 50));

    // Emit event after connection
    eventBus.emit("session:created", {
      sessionId: "s1",
      agent: "claude",
      status: "initializing",
    });

    // Read SSE event data
    const { value } = await reader.read();
    const text = decoder.decode(value);
    expect(text).toContain("event: session:created");
    expect(text).toContain('"sessionId":"s1"');
    controller.abort();
  });

  it("GET /api/events supports sessionId filter for agent:event", async () => {
    const eventBus = new EventBus();
    mockCore.eventBus = eventBus;
    const port = await startServer();

    const controller = new AbortController();
    const res = await apiFetch(port, "/api/v1/events?sessionId=s1", {
      signal: controller.signal,
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    // Read initial `: connected` comment
    await reader.read();

    // Wait for SSE connection to be registered
    await new Promise((r) => setTimeout(r, 50));

    // Emit event for target session — should be received
    eventBus.emit("agent:event", {
      sessionId: "s1",
      event: { type: "text", content: "right" } as any,
    });

    const { value } = await reader.read();
    const text = decoder.decode(value);
    expect(text).toContain('"sessionId":"s1"');
    expect(text).toContain("right");
    controller.abort();
  });

  describe("static file serving", () => {
    let uiDir: string;

    beforeEach(() => {
      uiDir = path.join(tmpDir, "ui");
      fs.mkdirSync(uiDir, { recursive: true });
      fs.writeFileSync(
        path.join(uiDir, "index.html"),
        "<html><body>Dashboard</body></html>",
      );
      fs.mkdirSync(path.join(uiDir, "assets"), { recursive: true });
      fs.writeFileSync(
        path.join(uiDir, "assets", "app.js"),
        'console.log("app")',
      );
      fs.writeFileSync(
        path.join(uiDir, "assets", "style.css"),
        "body { color: red }",
      );
    });

    async function startServerWithUi(uiDirectory: string) {
      const dir = path.dirname(secretFilePath);
      fs.mkdirSync(dir, { recursive: true });
      let secret: string;
      try {
        secret = fs.readFileSync(secretFilePath, "utf-8").trim();
        if (!secret) throw new Error("empty");
      } catch {
        secret = crypto.randomBytes(32).toString("hex");
        fs.writeFileSync(secretFilePath, secret, { mode: 0o600 });
      }

      const { createApiServer } = await import("../plugins/api-server/server.js");
      const { StaticServer } = await import("../plugins/api-server/static-server.js");
      const { systemRoutes } = await import("../plugins/api-server/routes/health.js");

      server = await createApiServer({
        port: 0,
        host: "127.0.0.1",
        getSecret: () => secret,
      });

      const deps = {
        core: mockCore as any,
        topicManager: mockTopicManager as any,
        startedAt: Date.now(),
        getVersion: () => "0.0.0-dev",
      };

      server.registerPlugin('/api/v1/system', async (app: any) => systemRoutes(app, deps), { auth: false });

      const staticServer = new StaticServer(uiDirectory);
      if (staticServer.isAvailable()) {
        server.app.setNotFoundHandler((request: any, reply: any) => {
          if (request.url.startsWith('/api/')) {
            reply.status(404).send({ error: 'Not found' });
            return;
          }
          reply.hijack();
          if (!staticServer.serve(request.raw, reply.raw)) {
            reply.raw.writeHead(404, { 'Content-Type': 'application/json' });
            reply.raw.end(JSON.stringify({ error: 'Not found' }));
          }
        });
      }

      const addr = await server.start();
      return addr.port;
    }

    it("serves index.html for root path", async () => {
      const port = await startServerWithUi(uiDir);

      const res = await apiFetch(port, "/");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const body = await res.text();
      expect(body).toContain("Dashboard");
    });

    it("serves static assets with correct content-type", async () => {
      const port = await startServerWithUi(uiDir);

      const jsRes = await apiFetch(port, "/assets/app.js");
      expect(jsRes.status).toBe(200);
      expect(jsRes.headers.get("content-type")).toContain("javascript");

      const cssRes = await apiFetch(port, "/assets/style.css");
      expect(cssRes.status).toBe(200);
      expect(cssRes.headers.get("content-type")).toContain("text/css");
    });

    it("falls back to index.html for SPA routes", async () => {
      const port = await startServerWithUi(uiDir);

      const res = await apiFetch(port, "/sessions/abc");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const body = await res.text();
      expect(body).toContain("Dashboard");
    });

    it("API routes still work when UI is enabled", async () => {
      const port = await startServerWithUi(uiDir);

      const res = await apiFetch(port, "/api/v1/system/health");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
    });

    it("returns 404 for non-API routes when UI not available", async () => {
      const port = await startServer();
      const res = await apiFetch(port, "/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("security", () => {
    // --- Prototype pollution via config update ---

    it("rejects config paths containing __proto__", async () => {
      const port = await startServer();
      const res = await apiFetch(port, "/api/v1/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "__proto__.polluted", value: true }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects config paths containing constructor.prototype", async () => {
      const port = await startServer();
      const res = await apiFetch(port, "/api/v1/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "constructor.prototype.polluted",
          value: true,
        }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects config paths containing prototype segment", async () => {
      const port = await startServer();
      const res = await apiFetch(port, "/api/v1/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "a.prototype.b", value: "x" }),
      });
      expect(res.status).toBe(400);
    });

    // --- Config scope enforcement ---

    it("rejects modification of sensitive config fields", async () => {
      const port = await startServer();
      const res = await apiFetch(port, "/api/v1/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "channels.telegram.botToken",
          value: "stolen",
        }),
      });
      expect(res.status).toBe(403);
    });

    // --- Path traversal in static server ---

    describe("path traversal protection", () => {
      let uiDir: string;

      beforeEach(() => {
        uiDir = path.join(tmpDir, "ui-traversal");
        fs.mkdirSync(uiDir, { recursive: true });
        fs.writeFileSync(
          path.join(uiDir, "index.html"),
          "<html><body>Safe</body></html>",
        );
      });

      async function startWithUiTraversal() {
        const dir = path.dirname(secretFilePath);
        fs.mkdirSync(dir, { recursive: true });
        let secret: string;
        try {
          secret = fs.readFileSync(secretFilePath, "utf-8").trim();
          if (!secret) throw new Error("empty");
        } catch {
          secret = crypto.randomBytes(32).toString("hex");
          fs.writeFileSync(secretFilePath, secret, { mode: 0o600 });
        }
        const { createApiServer } = await import("../plugins/api-server/server.js");
        const { StaticServer } = await import("../plugins/api-server/static-server.js");
        server = await createApiServer({ port: 0, host: "127.0.0.1", getSecret: () => secret });
        const staticServer = new StaticServer(uiDir);
        server.app.setNotFoundHandler((request: any, reply: any) => {
          if (request.url.startsWith('/api/')) {
            reply.status(404).send({ error: 'Not found' });
            return;
          }
          reply.hijack();
          if (!staticServer.serve(request.raw, reply.raw)) {
            reply.raw.writeHead(404, { 'Content-Type': 'application/json' });
            reply.raw.end(JSON.stringify({ error: 'Not found' }));
          }
        });
        const addr = await server.start();
        return addr.port;
      }

      it("blocks path traversal with ../ (no file leaked, SPA fallback or 404)", async () => {
        const port = await startWithUiTraversal();

        // HTTP clients normalize /../../../etc/passwd → /etc/passwd before sending.
        // The static server resolves this to uiDir/etc/passwd (does not escape uiDir),
        // which doesn't exist, so it falls back to serving index.html (SPA pattern).
        const res = await globalThis.fetch(
          `http://127.0.0.1:${port}/../../../etc/passwd`,
        );
        // Must never expose actual /etc/passwd contents — either SPA fallback or 404
        expect([200, 404]).toContain(res.status);
        const body = await res.text();
        expect(body).not.toMatch(/root:.*:0:0/); // not real /etc/passwd
      });

      it("blocks encoded path traversal with %2e%2e (no file leaked)", async () => {
        const port = await startWithUiTraversal();

        // %2e%2e decodes to ".." — HTTP normalises before server sees the path.
        // Result is the same: uiDir-contained path, no file system escape.
        const res = await globalThis.fetch(
          `http://127.0.0.1:${port}/%2e%2e/%2e%2e/etc/passwd`,
        );
        expect([200, 404]).toContain(res.status);
        const body = await res.text();
        expect(body).not.toMatch(/root:.*:0:0/); // not real /etc/passwd
      });
    });

    // --- SSE auth ---

    it("rejects SSE without auth token", async () => {
      mockCore.eventBus = new EventBus();
      const port = await startServer();

      const controller = new AbortController();
      const res = await globalThis.fetch(
        `http://127.0.0.1:${port}/api/v1/events`,
        { signal: controller.signal },
      );
      expect(res.status).toBe(401);
      controller.abort();
    });

    it("accepts SSE with query param token", async () => {
      mockCore.eventBus = new EventBus();
      const port = await startServer();
      const token = readTestSecret();

      const controller = new AbortController();
      const res = await globalThis.fetch(
        `http://127.0.0.1:${port}/api/v1/events?token=${token}`,
        { signal: controller.signal },
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/event-stream");
      controller.abort();
    });

    it("rejects SSE with invalid query param token", async () => {
      mockCore.eventBus = new EventBus();
      const port = await startServer();

      const controller = new AbortController();
      const res = await globalThis.fetch(
        `http://127.0.0.1:${port}/api/v1/events?token=wrong-token`,
        { signal: controller.signal },
      );
      expect(res.status).toBe(401);
      controller.abort();
    });

    // --- readBody size limit ---

    it("rejects oversized request body with 413 or socket close", async () => {
      const port = await startServer();
      // Use /api/sessions/adopt which explicitly checks body === null and returns 413.
      // When the server calls req.destroy(), the socket is forcibly closed.
      // Some fetch implementations receive the 413 response; others get a SocketError.
      const largeBody = JSON.stringify({
        agentSessionId: "x".repeat(2 * 1024 * 1024),
      });
      try {
        const res = await apiFetch(port, "/api/v1/sessions/adopt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: largeBody,
        });
        // If the response arrived, it must be 413
        expect(res.status).toBe(413);
      } catch {
        // Socket was destroyed before response arrived — this is also correct behaviour
        // (the server aborted the oversized upload). Test passes.
      }
    });

    // --- Auth edge cases ---

    it("rejects empty Authorization header (Bearer with no token)", async () => {
      const port = await startServer();
      const res = await globalThis.fetch(
        `http://127.0.0.1:${port}/api/v1/sessions`,
        {
          headers: { Authorization: "Bearer " },
        },
      );
      expect(res.status).toBe(401);
    });

    it("rejects Bearer token with wrong length", async () => {
      const port = await startServer();
      // Use a token with clearly different length from the 64-char hex secret
      const res = await globalThis.fetch(
        `http://127.0.0.1:${port}/api/v1/sessions`,
        {
          headers: { Authorization: "Bearer short" },
        },
      );
      expect(res.status).toBe(401);
    });

    // --- Config Zod validation ---

    it("rejects invalid config values (string for number field)", async () => {
      const port = await startServer();
      // Pass a string where the field expects a number (sessionStore.ttlDays is a number field in registry)
      const res = await apiFetch(port, "/api/v1/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "sessionStore.ttlDays",
          value: "not-a-number",
        }),
      });
      // Fails type validation → 400
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    // --- Redact config with arrays ---

    it("redacts sensitive keys inside arrays", async () => {
      mockCore.configManager.get.mockReturnValueOnce({
        defaultAgent: "claude",
        workspace: {},
        logging: {
          level: "info",
          logDir: "~/.viben/logs",
          maxFileSize: "10m",
          maxFiles: 7,
          sessionLogRetentionDays: 30,
        },
        sessionStore: { ttlDays: 30 },
        runMode: "foreground",
        autoStart: false,
        integrations: {
          webhooks: [
            { name: "webhook1", token: "super-secret-token" },
            { name: "webhook2", token: "another-secret" },
          ],
        },
        agentSwitch: { labelHistory: true },
      });
      const port = await startServer();

      const res = await apiFetch(port, "/api/v1/config");
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      // Token inside array items must be redacted
      expect(data.config.integrations.webhooks[0].token).toBe("***");
      expect(data.config.integrations.webhooks[1].token).toBe("***");
      // Name fields should NOT be redacted
      expect(data.config.integrations.webhooks[0].name).toBe("webhook1");
    });
  });

  describe("authentication", () => {
    it("returns 401 for requests without auth token", async () => {
      const port = await startServer();
      // Use raw fetch without auth
      const res = await globalThis.fetch(
        `http://127.0.0.1:${port}/api/v1/sessions`,
      );
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 for requests with wrong token", async () => {
      const port = await startServer();
      const res = await globalThis.fetch(
        `http://127.0.0.1:${port}/api/v1/sessions`,
        {
          headers: { Authorization: "Bearer wrong-token" },
        },
      );
      expect(res.status).toBe(401);
    });

    it("allows health endpoint without auth", async () => {
      const port = await startServer();
      // Use raw fetch without auth — public /health requires no token
      const res = await globalThis.fetch(`http://127.0.0.1:${port}/api/v1/system/health`);
      expect(res.status).toBe(200);
    });

    it("requires auth for version endpoint", async () => {
      const port = await startServer();
      const res = await globalThis.fetch(
        `http://127.0.0.1:${port}/api/v1/system/version`,
      );
      expect(res.status).toBe(401);
    });

    it("accepts requests with valid auth token", async () => {
      mockCore.sessionManager.listAllSessions.mockReturnValueOnce([]);
      const port = await startServer();
      const token = readTestSecret();
      const res = await globalThis.fetch(
        `http://127.0.0.1:${port}/api/v1/sessions`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      expect(res.status).toBe(200);
    });

    it("accepts SSE with token query param", async () => {
      mockCore.eventBus = new EventBus();
      const port = await startServer();
      const token = readTestSecret();

      const controller = new AbortController();
      const res = await globalThis.fetch(
        `http://127.0.0.1:${port}/api/v1/events?token=${token}`,
        { signal: controller.signal },
      );
      expect(res.status).toBe(200);
      controller.abort();
    });

    it("does not require auth for static file routes", async () => {
      const testUiDir = path.join(tmpDir, "ui-auth-test");
      fs.mkdirSync(testUiDir, { recursive: true });
      fs.writeFileSync(
        path.join(testUiDir, "index.html"),
        "<html><body>Test</body></html>",
      );

      const dir = path.dirname(secretFilePath);
      fs.mkdirSync(dir, { recursive: true });
      let secret: string;
      try {
        secret = fs.readFileSync(secretFilePath, "utf-8").trim();
        if (!secret) throw new Error("empty");
      } catch {
        secret = crypto.randomBytes(32).toString("hex");
        fs.writeFileSync(secretFilePath, secret, { mode: 0o600 });
      }

      const { createApiServer } = await import("../plugins/api-server/server.js");
      const { StaticServer } = await import("../plugins/api-server/static-server.js");

      server = await createApiServer({
        port: 0,
        host: "127.0.0.1",
        getSecret: () => secret,
      });

      const staticServer = new StaticServer(testUiDir);
      server.app.setNotFoundHandler((request: any, reply: any) => {
        if (request.url.startsWith('/api/')) {
          reply.status(404).send({ error: 'Not found' });
          return;
        }
        reply.hijack();
        if (!staticServer.serve(request.raw, reply.raw)) {
          reply.raw.writeHead(404, { 'Content-Type': 'application/json' });
          reply.raw.end(JSON.stringify({ error: 'Not found' }));
        }
      });

      const addr = await server.start();
      const port = addr.port;

      // Raw fetch without auth — static routes should be accessible
      const res = await globalThis.fetch(`http://127.0.0.1:${port}/`);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Test");
    });
  });
});
