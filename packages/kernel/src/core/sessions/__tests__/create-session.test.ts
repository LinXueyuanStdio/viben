import { describe, it, expect, vi, beforeEach } from "vitest";
import { Session } from "../session.js";
import { EventBus } from "../../event-bus.js";
import type { AgentInstance } from "../../agents/agent-instance.js";
import type { IChannelAdapter } from "../../channel.js";
import { TypedEmitter } from "../../utils/typed-emitter.js";
import type { AgentEvent } from "../../types.js";

function createMockAgentInstance(sessionId = "agent-session-1"): AgentInstance {
  const emitter = new TypedEmitter<{ agent_event: (event: AgentEvent) => void }>();
  return Object.assign(emitter, {
    sessionId,
    agentName: "test-agent",
    prompt: vi.fn().mockResolvedValue({}),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
  }) as unknown as AgentInstance;
}

function createMockAdapter(): IChannelAdapter {
  return {
    name: 'test',
    capabilities: { streaming: false, richFormatting: false, threads: false, reactions: false, fileUpload: false, voice: false },
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendPermissionRequest: vi.fn().mockResolvedValue(undefined),
    sendNotification: vi.fn().mockResolvedValue(undefined),
    sendSkillCommands: vi.fn().mockResolvedValue(undefined),
    cleanupSkillCommands: vi.fn().mockResolvedValue(undefined),
    renameSessionThread: vi.fn().mockResolvedValue(undefined),
    createSessionThread: vi.fn().mockResolvedValue("thread-123"),
    deleteSessionThread: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  } as unknown as IChannelAdapter;
}

// Test createSession by constructing a minimal VibenCore with mocked dependencies
import { VibenCore } from "../../core.js";
import { SessionFactory } from "../session-factory.js";
import { ServiceRegistry } from "../../plugin/service-registry.js";
import { MiddlewareChain } from "../../plugin/middleware-chain.js";
import { LifecycleManager } from "../../plugin/lifecycle-manager.js";

function createMockCore(): VibenCore {
  const mockAgent = createMockAgentInstance();

  // Create core with a minimal mock ConfigManager
  const core = Object.create(VibenCore.prototype) as VibenCore;

  // Set up ServiceRegistry so lazy getters work
  const serviceRegistry = new ServiceRegistry();
  (core as any).lifecycleManager = new LifecycleManager({
    serviceRegistry,
    middlewareChain: new MiddlewareChain(),
  });

  // Register mock services in ServiceRegistry (lazy getters resolve from here)
  serviceRegistry.register("notifications", {
    notify: vi.fn().mockResolvedValue(undefined),
    notifyAll: vi.fn().mockResolvedValue(undefined),
  }, "@viben/notifications");
  serviceRegistry.register("file-service", {
    downloadFile: vi.fn().mockResolvedValue(undefined),
  }, "@viben/file-service");

  // Set up minimal internal state
  core.adapters = new Map();
  (core as any).bridges = new Map();
  core.agentManager = {
    spawn: vi.fn().mockResolvedValue(mockAgent),
    resume: vi.fn().mockResolvedValue(mockAgent),
    getAgent: vi
      .fn()
      .mockReturnValue({ name: "claude", command: "claude", args: [] }),
    getAvailableAgents: vi.fn().mockReturnValue([]),
  } as any;
  core.sessionManager = {
    registerSession: vi.fn(),
    getSession: vi.fn(),
    patchRecord: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn().mockReturnValue([]),
  } as any;
  core.messageTransformer = {
    transform: vi.fn().mockReturnValue({ type: "text", text: "transformed" }),
  } as any;
  core.eventBus = new EventBus();
  core.sessionFactory = new SessionFactory(
    core.agentManager,
    core.sessionManager,
    {} as any,
    core.eventBus,
  );

  return core;
}

describe("VibenCore.createSession", () => {
  let core: VibenCore;
  let adapter: IChannelAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    core = createMockCore();
    adapter = createMockAdapter();
    core.registerAdapter("telegram", adapter);
  });

  it("creates a new session with spawn", async () => {
    const session = await core.createSession({
      channelId: "telegram",
      agentName: "claude",
      workingDirectory: "/tmp/test",
    });

    expect(session).toBeInstanceOf(Session);
    expect(session.channelId).toBe("telegram");
    expect(session.agentName).toBe("claude");
    expect(core.agentManager.spawn).toHaveBeenCalledWith("claude", "/tmp/test", []);
  });

  it("resumes agent when resumeAgentSessionId is provided", async () => {
    const session = await core.createSession({
      channelId: "telegram",
      agentName: "claude",
      workingDirectory: "/tmp/test",
      resumeAgentSessionId: "old-session-id",
    });

    expect(core.agentManager.resume).toHaveBeenCalledWith(
      "claude",
      "/tmp/test",
      "old-session-id",
      [],
    );
    expect(session.agentSessionId).toBe("agent-session-1");
  });

  it("reuses session ID when existingSessionId is provided", async () => {
    const session = await core.createSession({
      channelId: "telegram",
      agentName: "claude",
      workingDirectory: "/tmp/test",
      existingSessionId: "my-session-id",
    });

    expect(session.id).toBe("my-session-id");
  });

  it("creates thread when createThread is true", async () => {
    const session = await core.createSession({
      channelId: "telegram",
      agentName: "claude",
      workingDirectory: "/tmp/test",
      createThread: true,
      initialName: "Adopted session",
    });

    // Thread is created BEFORE the session is spawned, so sessionId is "" at call time.
    expect(adapter.createSessionThread).toHaveBeenCalledWith(
      "",
      "Adopted session",
    );
    expect(session.threadId).toBe("thread-123");
  });

  it("registers session in SessionManager", async () => {
    const session = await core.createSession({
      channelId: "telegram",
      agentName: "claude",
      workingDirectory: "/tmp/test",
    });

    expect(core.sessionManager.registerSession).toHaveBeenCalledWith(session);
  });

  it("connects SessionBridge — events route to adapter", async () => {
    const session = await core.createSession({
      channelId: "telegram",
      agentName: "claude",
      workingDirectory: "/tmp/test",
    });

    // Bridge wired agent_event emitter → triggers sendMessage
    const textEvent = { type: "text" as const, content: "hello" };
    session.agentInstance.emit('agent_event', textEvent);

    // sendMessage is called asynchronously via middleware chain
    await vi.waitFor(() => {
      expect(adapter.sendMessage).toHaveBeenCalled();
    });
  });

  it("session starts in initializing status", async () => {
    const session = await core.createSession({
      channelId: "telegram",
      agentName: "claude",
      workingDirectory: "/tmp/test",
    });

    expect(session.status).toBe("initializing");
  });

  it("throws when spawn fails", async () => {
    vi.mocked(core.agentManager.spawn).mockRejectedValueOnce(
      new Error("spawn failed"),
    );

    await expect(
      core.createSession({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/tmp/test",
      }),
    ).rejects.toThrow("spawn failed");
  });

  it("persists initial record", async () => {
    const session = await core.createSession({
      channelId: "telegram",
      agentName: "claude",
      workingDirectory: "/tmp/test",
    });

    expect(core.sessionManager.patchRecord).toHaveBeenCalledWith(
      session.id,
      expect.objectContaining({
        sessionId: session.id,
        agentName: "claude",
        workingDir: "/tmp/test",
        channelId: "telegram",
      }),
      { immediate: true },
    );
  });
});
