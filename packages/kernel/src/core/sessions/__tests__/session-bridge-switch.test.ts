import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionBridge } from "../session-bridge.js";
import { Session } from "../session.js";
import type { AgentInstance } from "../../agents/agent-instance.js";
import type { IChannelAdapter } from "../../channel.js";
import type { MessageTransformer } from "../../message-transformer.js";
import type { NotificationManager } from "../../../plugins/notifications/notification.js";
import type { SessionManager } from "../session-manager.js";
import type { AgentEvent } from "../../types.js";
import { TypedEmitter } from "../../utils/typed-emitter.js";

function createMockAgentInstance(id = "agent-session-1"): AgentInstance {
  const emitter = new TypedEmitter<{ agent_event: (event: AgentEvent) => void }>();
  return Object.assign(emitter, {
    sessionId: id,
    agentName: "test-agent",
    prompt: vi.fn().mockResolvedValue({}),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
    debugTracer: undefined,
  }) as unknown as AgentInstance;
}

function createMockAdapter(): IChannelAdapter {
  return {
    name: "test",
    capabilities: {
      streaming: false,
      richFormatting: false,
      threads: false,
      reactions: false,
      fileUpload: false,
      voice: false,
    },
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendPermissionRequest: vi.fn().mockResolvedValue(undefined),
    sendNotification: vi.fn().mockResolvedValue(undefined),
    sendSkillCommands: vi.fn().mockResolvedValue(undefined),
    cleanupSkillCommands: vi.fn().mockResolvedValue(undefined),
    renameSessionThread: vi.fn().mockResolvedValue(undefined),
    createSessionThread: vi.fn().mockResolvedValue("thread-1"),
    deleteSessionThread: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  } as unknown as IChannelAdapter;
}

function createMockDeps() {
  return {
    messageTransformer: {
      transform: vi.fn().mockReturnValue({ type: "text", text: "transformed" }),
    } as unknown as MessageTransformer,
    notificationManager: {
      notify: vi.fn().mockResolvedValue(undefined),
      notifyAll: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationManager,
    sessionManager: {
      patchRecord: vi.fn().mockResolvedValue(undefined),
      updateSessionStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as SessionManager,
  };
}

function createSession(agentInstance: AgentInstance): Session {
  return new Session({
    channelId: "test-channel",
    agentName: "test-agent",
    workingDirectory: "/tmp/test",
    agentInstance,
  });
}

describe("SessionBridge disconnect/reconnect (agent switch)", () => {
  let oldAgent: AgentInstance;
  let newAgent: AgentInstance;
  let session: Session;
  let adapter: IChannelAdapter;
  let deps: ReturnType<typeof createMockDeps>;
  let bridge: SessionBridge;

  beforeEach(() => {
    oldAgent = createMockAgentInstance("agent-old");
    newAgent = createMockAgentInstance("agent-new");
    session = createSession(oldAgent);
    adapter = createMockAdapter();
    deps = createMockDeps();
    bridge = new SessionBridge(session, adapter, deps);
  });

  it("after connect(), old agent forwards events to adapter", () => {
    bridge.connect();

    const event: AgentEvent = { type: "text", content: "from old agent" };
    oldAgent.emit("agent_event", event);

    expect(deps.messageTransformer.transform).toHaveBeenCalledWith(
      event,
      expect.objectContaining({ id: session.id }),
    );
    expect(adapter.sendMessage).toHaveBeenCalledWith(
      session.id,
      { type: "text", text: "transformed" },
    );
  });

  it("after disconnect(), old agent no longer forwards events", () => {
    bridge.connect();
    bridge.disconnect();

    const event: AgentEvent = { type: "text", content: "from old agent after disconnect" };
    oldAgent.emit("agent_event", event);

    expect(adapter.sendMessage).not.toHaveBeenCalled();
  });

  it("after disconnect(), old agent events are no longer forwarded (listener removed)", () => {
    bridge.connect();

    // Verify connected: event from old agent is forwarded
    oldAgent.emit("agent_event", { type: "text", content: "before disconnect" });
    expect(adapter.sendMessage).toHaveBeenCalledTimes(1);

    vi.mocked(adapter.sendMessage).mockClear();
    bridge.disconnect();

    // After disconnect: event from old agent must NOT be forwarded
    oldAgent.emit("agent_event", { type: "text", content: "after disconnect" });
    expect(adapter.sendMessage).not.toHaveBeenCalled();
  });

  it("after swapping agent and reconnecting, new agent forwards events", () => {
    bridge.connect();
    bridge.disconnect();

    // Swap to new agent
    session.agentInstance = newAgent;

    bridge.connect();

    const event: AgentEvent = { type: "text", content: "from new agent" };
    newAgent.emit("agent_event", event);

    expect(deps.messageTransformer.transform).toHaveBeenCalledWith(
      event,
      expect.objectContaining({ id: session.id }),
    );
    expect(adapter.sendMessage).toHaveBeenCalledWith(
      session.id,
      { type: "text", text: "transformed" },
    );
  });

  it("after reconnecting to new agent, old agent no longer forwards events", () => {
    bridge.connect();
    bridge.disconnect();

    session.agentInstance = newAgent;
    bridge.connect();

    vi.mocked(adapter.sendMessage).mockClear();

    // Old agent events should NOT be routed
    oldAgent.emit("agent_event", { type: "text", content: "stale old event" });
    expect(adapter.sendMessage).not.toHaveBeenCalled();

    // New agent events SHOULD be routed
    newAgent.emit("agent_event", { type: "text", content: "live new event" });
    expect(adapter.sendMessage).toHaveBeenCalledOnce();
  });

  it("reconnect re-wires permissions on new agent", async () => {
    bridge.connect();
    bridge.disconnect();

    session.agentInstance = newAgent;
    bridge.connect();

    const request = {
      id: "req-2",
      description: "Allow action?",
      options: [{ id: "allow", label: "Allow", isAllow: true }],
    };

    // The new agent's onPermissionRequest should be wired by reconnect
    const resultPromise = (newAgent as any).onPermissionRequest(request);

    expect(adapter.sendPermissionRequest).toHaveBeenCalledWith(session.id, request);
    expect(session.permissionGate.isPending).toBe(true);

    session.permissionGate.resolve("allow");
    const result = await resultPromise;
    expect(result).toBe("allow");
  });

  it("full sequence: connect old → disconnect → swap → connect new → verify routing", () => {
    // Step 1: connect to old agent, verify it works
    bridge.connect();
    oldAgent.emit("agent_event", { type: "text", content: "msg1" });
    expect(adapter.sendMessage).toHaveBeenCalledTimes(1);

    // Step 2: disconnect
    bridge.disconnect();
    vi.mocked(adapter.sendMessage).mockClear();

    // Verify disconnected
    oldAgent.emit("agent_event", { type: "text", content: "msg2" });
    expect(adapter.sendMessage).not.toHaveBeenCalled();

    // Step 3: swap to new agent and reconnect
    session.agentInstance = newAgent;
    bridge.connect();

    // Step 4: new agent routes; old agent does not
    newAgent.emit("agent_event", { type: "text", content: "msg3" });
    expect(adapter.sendMessage).toHaveBeenCalledTimes(1);

    vi.mocked(adapter.sendMessage).mockClear();
    oldAgent.emit("agent_event", { type: "text", content: "msg4" });
    expect(adapter.sendMessage).not.toHaveBeenCalled();
  });

  it("double connect() after reconnect is a no-op (idempotent)", () => {
    bridge.connect();
    bridge.disconnect();

    session.agentInstance = newAgent;
    bridge.connect();
    bridge.connect(); // duplicate — should be ignored

    vi.mocked(adapter.sendMessage).mockClear();
    newAgent.emit("agent_event", { type: "text", content: "once" });

    // Event should be routed exactly once, not twice
    expect(adapter.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("double disconnect() is safe (idempotent)", () => {
    bridge.connect();
    bridge.disconnect();

    // Second disconnect should not throw
    expect(() => bridge.disconnect()).not.toThrow();
  });
});
