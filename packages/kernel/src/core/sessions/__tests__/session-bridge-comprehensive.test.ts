import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionBridge } from "../session-bridge.js";
import { Session } from "../session.js";
import type { AgentInstance } from "../../agents/agent-instance.js";
import type { IChannelAdapter } from "../../channel.js";
import type { MessageTransformer } from "../../message-transformer.js";
import type { NotificationManager } from "../../../plugins/notifications/notification.js";
import type { SessionManager } from "../session-manager.js";
import type { EventBus } from "../../event-bus.js";
import type { FileService } from "../../../plugins/file-service/file-service.js";
import type { AgentEvent, PermissionRequest } from "../../types.js";
import { TypedEmitter } from "../../utils/typed-emitter.js";

function createMockAgentInstance(): AgentInstance {
  const emitter = new TypedEmitter<{
    agent_event: (event: AgentEvent) => void;
  }>();
  return Object.assign(emitter, {
    sessionId: "agent-session-1",
    prompt: vi.fn().mockResolvedValue(undefined),
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
    createSessionThread: vi.fn().mockResolvedValue("thread-1"),
    deleteSessionThread: vi.fn().mockResolvedValue(undefined),
    archiveSessionTopic: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  } as unknown as IChannelAdapter;
}

function createMockDeps(overrides: Record<string, unknown> = {}) {
  return {
    messageTransformer: {
      transform: vi
        .fn()
        .mockReturnValue({ type: "text", text: "transformed" }),
    } as unknown as MessageTransformer,
    notificationManager: {
      notify: vi.fn().mockResolvedValue(undefined),
      notifyAll: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationManager,
    sessionManager: {
      patchRecord: vi.fn().mockResolvedValue(undefined),
      getSessionRecord: vi.fn().mockReturnValue(undefined),
    } as unknown as SessionManager,
    eventBus: {
      emit: vi.fn(),
    } as unknown as EventBus,
    ...overrides,
  };
}

function createSession(agentInstance?: AgentInstance): Session {
  return new Session({
    channelId: "test-channel",
    agentName: "test-agent",
    workingDirectory: "/tmp/test",
    agentInstance: agentInstance ?? createMockAgentInstance(),
  });
}

describe("SessionBridge — Idempotent Connect/Disconnect", () => {
  it("double connect does not wire listeners twice", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);

    bridge.connect();
    bridge.connect(); // second call should be no-op

    // Emit one event
    agent.emit("agent_event", { type: "text", content: "hello" });

    // Should only have been sent once, not twice
    expect(adapter.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("double disconnect does not throw", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);

    bridge.connect();
    bridge.disconnect();
    expect(() => bridge.disconnect()).not.toThrow();
  });

  it("disconnect without connect does not throw", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);

    expect(() => bridge.disconnect()).not.toThrow();
  });
});

describe("SessionBridge — image_content & audio_content", () => {
  it("saves and sends image_content as attachment", async () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();

    const mockFileService = {
      saveFile: vi.fn().mockResolvedValue({
        type: "image",
        filePath: "/saved/img.png",
        fileName: "agent-image.png",
        mimeType: "image/png",
        size: 1024,
      }),
      extensionFromMime: vi.fn().mockReturnValue(".png"),
    };

    const deps = createMockDeps({ fileService: mockFileService as unknown as FileService });
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    const base64Data = Buffer.from("fake-png").toString("base64");
    agent.emit("agent_event", {
      type: "image_content",
      data: base64Data,
      mimeType: "image/png",
    });

    // Wait for async saveFile to complete
    await vi.waitFor(() => {
      expect(mockFileService.saveFile).toHaveBeenCalledWith(
        session.id,
        "agent-image.png",
        expect.any(Buffer),
        "image/png",
      );
    });

    await vi.waitFor(() => {
      expect(adapter.sendMessage).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({
          type: "attachment",
          attachment: expect.objectContaining({ type: "image" }),
        }),
      );
    });
  });

  it("saves and sends audio_content as attachment", async () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();

    const mockFileService = {
      saveFile: vi.fn().mockResolvedValue({
        type: "audio",
        filePath: "/saved/audio.mp3",
        fileName: "agent-audio.mp3",
        mimeType: "audio/mpeg",
        size: 2048,
      }),
      extensionFromMime: vi.fn().mockReturnValue(".mp3"),
    };

    const deps = createMockDeps({ fileService: mockFileService as unknown as FileService });
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    const base64Data = Buffer.from("fake-audio").toString("base64");
    agent.emit("agent_event", {
      type: "audio_content",
      data: base64Data,
      mimeType: "audio/mpeg",
    });

    await vi.waitFor(() => {
      expect(mockFileService.saveFile).toHaveBeenCalledWith(
        session.id,
        "agent-audio.mp3",
        expect.any(Buffer),
        "audio/mpeg",
      );
    });

    await vi.waitFor(() => {
      expect(adapter.sendMessage).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({
          type: "attachment",
          attachment: expect.objectContaining({ type: "audio" }),
        }),
      );
    });
  });

  it("does not crash when fileService is undefined", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps(); // no fileService
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    // Should silently ignore
    expect(() => {
      agent.emit("agent_event", {
        type: "image_content",
        data: "abc",
        mimeType: "image/png",
      });
    }).not.toThrow();
  });
});

describe("SessionBridge — system_message routing", () => {
  it("routes system_message to adapter.sendMessage via transformer", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    agent.emit("agent_event", {
      type: "system_message",
      message: "STT result",
    });

    expect(deps.messageTransformer.transform).toHaveBeenCalledWith(
      expect.objectContaining({ type: "system_message", message: "STT result" }),
    );
    expect(adapter.sendMessage).toHaveBeenCalled();
  });
});

describe("SessionBridge — EventBus integration", () => {
  it("emits agent:event to eventBus for every agent event", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    agent.emit("agent_event", { type: "text", content: "hi" });

    expect((deps.eventBus as any).emit).toHaveBeenCalledWith("agent:event", {
      sessionId: session.id,
      turnId: expect.any(String),
      event: { type: "text", content: "hi" },
    });
  });

  it("emits session:updated on status change", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    session.activate();

    expect((deps.eventBus as any).emit).toHaveBeenCalledWith(
      "session:updated",
      expect.objectContaining({
        sessionId: session.id,
        status: "active",
      }),
    );
  });

  it("emits session:updated on named event", async () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();
    session.activate();

    session.emit("named", "Test Name");

    await vi.waitFor(() => {
      expect((deps.eventBus as any).emit).toHaveBeenCalledWith(
        "session:updated",
        expect.objectContaining({
          sessionId: session.id,
          name: "Test Name",
        }),
      );
    });
  });

  it("emits permission:request to eventBus", async () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    const request: PermissionRequest = {
      id: "perm-1",
      description: "Allow file write?",
      options: [{ id: "yes", label: "Allow", isAllow: true }],
    };

    const promise = agent.onPermissionRequest(request);
    session.permissionGate.resolve("yes");
    await promise;

    expect((deps.eventBus as any).emit).toHaveBeenCalledWith(
      "permission:request",
      expect.objectContaining({
        sessionId: session.id,
        permission: request,
      }),
    );
  });

  it("works without eventBus (optional dependency)", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    delete (deps as any).eventBus;
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    // Should not throw
    expect(() => {
      agent.emit("agent_event", { type: "text", content: "hi" });
      session.activate();
    }).not.toThrow();
  });
});

describe("SessionBridge — Permission Auto-Approve", () => {
  let agent: AgentInstance;
  let session: Session;
  let adapter: IChannelAdapter;
  let deps: ReturnType<typeof createMockDeps>;
  let bridge: SessionBridge;

  beforeEach(() => {
    agent = createMockAgentInstance();
    session = createSession(agent);
    adapter = createMockAdapter();
    deps = createMockDeps();
    bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();
  });

  it("does NOT auto-approve permission with 'viben' in description when bypass mode is off", async () => {
    const promise = agent.onPermissionRequest({
      id: "p1",
      description: "Run Viben install command",
      options: [
        { id: "allow", label: "Allow", isAllow: true },
        { id: "deny", label: "Deny", isAllow: false },
      ],
    });

    // Should forward to adapter's permission handler, not auto-approve
    expect(adapter.sendPermissionRequest).toHaveBeenCalled();
    session.permissionGate.resolve("allow");
    const result = await promise;
    expect(result).toBe("allow");
  });

  it("auto-approves when clientOverrides.bypassPermissions is true", async () => {
    session.clientOverrides = { bypassPermissions: true };

    const result = await agent.onPermissionRequest({
      id: "p2",
      description: "Delete all files",
      options: [
        { id: "allow", label: "Allow", isAllow: true },
        { id: "deny", label: "Deny", isAllow: false },
      ],
    });

    expect(result).toBe("allow");
    expect(adapter.sendPermissionRequest).not.toHaveBeenCalled();
  });

  it("does not auto-approve with bypass if no isAllow option", async () => {
    session.clientOverrides = { bypassPermissions: true };

    const promise = agent.onPermissionRequest({
      id: "p3",
      description: "Choose an option",
      options: [
        { id: "opt1", label: "Option A", isAllow: false },
        { id: "opt2", label: "Option B", isAllow: false },
      ],
    });

    // Should fall through to UI
    expect(adapter.sendPermissionRequest).toHaveBeenCalled();
    session.permissionGate.resolve("opt1");
    const result = await promise;
    expect(result).toBe("opt1");
  });

  it("does not auto-approve 'openapi' (similar but different)", async () => {
    const promise = agent.onPermissionRequest({
      id: "p4",
      description: "Run openapi spec generator",
      options: [{ id: "allow", label: "Allow", isAllow: true }],
    });

    // Should send to UI, not auto-approve
    expect(adapter.sendPermissionRequest).toHaveBeenCalled();
    session.permissionGate.resolve("allow");
    await promise;
  });

  it("sets permissionGate pending BEFORE sending UI to adapter", async () => {
    const callOrder: string[] = [];

    // Track when permissionGate becomes pending
    const originalSetPending = session.permissionGate.setPending.bind(session.permissionGate);
    vi.spyOn(session.permissionGate, "setPending").mockImplementation((req) => {
      callOrder.push("setPending");
      return originalSetPending(req);
    });

    vi.mocked(adapter.sendPermissionRequest).mockImplementation(async () => {
      callOrder.push("sendUI");
    });

    const request: PermissionRequest = {
      id: "p5",
      description: "Write file?",
      options: [{ id: "allow", label: "Allow", isAllow: true }],
    };

    const promise = agent.onPermissionRequest(request);
    session.permissionGate.resolve("allow");
    await promise;

    expect(callOrder.indexOf("setPending")).toBeLessThan(
      callOrder.indexOf("sendUI"),
    );
  });
});

describe("SessionBridge — Auto-Disconnect on Terminal States", () => {
  it("auto-disconnects after finished via microtask", async () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    session.activate();
    session.finish("done");

    // Wait for microtask
    await Promise.resolve();
    await Promise.resolve();

    vi.mocked(adapter.sendMessage).mockClear();
    session.emit("agent_event", { type: "text", content: "after finish" });
    expect(adapter.sendMessage).not.toHaveBeenCalled();
  });

  it("stays connected after cancelled (session can resume)", async () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    session.activate();
    session.markCancelled();

    await Promise.resolve();
    await Promise.resolve();

    vi.mocked(adapter.sendMessage).mockClear();
    session.emit("agent_event", { type: "text", content: "after cancel" });
    // Bridge stays connected so events still reach adapter
    expect(adapter.sendMessage).toHaveBeenCalled();
  });

  it("does NOT auto-disconnect on error (recoverable)", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    session.fail("oops");

    vi.mocked(adapter.sendMessage).mockClear();
    vi.mocked(deps.messageTransformer.transform).mockReturnValue({
      type: "text",
      text: "after error",
    });

    // Events should still be routed (bridge not disconnected)
    session.emit("agent_event", { type: "text", content: "recovery" });
    expect(adapter.sendMessage).toHaveBeenCalled();
  });

  it("resets onPermissionRequest to no-op after disconnect", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();
    bridge.disconnect();

    // onPermissionRequest should now return empty string
    const result = agent.onPermissionRequest({
      id: "p",
      description: "test",
      options: [],
    });
    expect(result).resolves.toBe("");
  });
});

describe("SessionBridge — Notification on session_end and error", () => {
  it("sends completed notification with session name on session_end", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    session.name = "My Project";
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();
    session.activate();

    agent.emit("agent_event", { type: "session_end", reason: "done" });

    expect(deps.notificationManager.notify).toHaveBeenCalledWith(
      session.channelId,
      expect.objectContaining({
        type: "completed",
        sessionName: "My Project",
      }),
    );
  });

  it("sends error notification with error message", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();
    session.activate();

    agent.emit("agent_event", { type: "error", message: "Agent crashed" });

    expect(deps.notificationManager.notify).toHaveBeenCalledWith(
      session.channelId,
      expect.objectContaining({
        type: "error",
        summary: "Agent crashed",
      }),
    );
  });

  it("calls cleanupSkillCommands on session_end", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();
    session.activate();

    agent.emit("agent_event", { type: "session_end", reason: "done" });

    expect(adapter.cleanupSkillCommands).toHaveBeenCalledWith(session.id);
  });

  it("calls cleanupSkillCommands on error", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();
    session.activate();

    agent.emit("agent_event", { type: "error", message: "crash" });

    expect(adapter.cleanupSkillCommands).toHaveBeenCalledWith(session.id);
  });
});

describe("SessionBridge — tool_call and tool_update routing", () => {
  it("routes tool_call with full metadata", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    const toolCall: AgentEvent = {
      type: "tool_call",
      id: "tc-1",
      name: "Read",
      kind: "file",
      status: "running",
      content: "file contents",
    };
    agent.emit("agent_event", toolCall);

    expect(deps.messageTransformer.transform).toHaveBeenCalledWith(
      toolCall,
      expect.objectContaining({ id: session.id, workingDirectory: "/tmp/test" }),
    );
    expect(adapter.sendMessage).toHaveBeenCalled();
  });

  it("routes tool_update to adapter", () => {
    const agent = createMockAgentInstance();
    const session = createSession(agent);
    const adapter = createMockAdapter();
    const deps = createMockDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    agent.emit("agent_event", {
      type: "tool_update",
      id: "tc-1",
      status: "completed",
    });

    expect(adapter.sendMessage).toHaveBeenCalled();
  });
});
