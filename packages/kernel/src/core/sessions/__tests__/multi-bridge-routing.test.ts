import { describe, it, expect, vi } from "vitest";
import { SessionBridge } from "../session-bridge.js";
import { Session } from "../session.js";
import { TypedEmitter } from "../../utils/typed-emitter.js";
import type { AgentEvent } from "../../types.js";

function mockAgentInstance() {
  const emitter = new TypedEmitter<{ agent_event: (event: AgentEvent) => void }>();
  return Object.assign(emitter, {
    sessionId: "agent-sess-1",
    prompt: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: undefined as any,
    debugTracer: null,
    agentCapabilities: undefined,
    initialSessionResponse: undefined,
    promptCapabilities: undefined,
    addAllowedPath: vi.fn(),
  }) as any;
}

function mockAdapter(name: string) {
  return {
    name,
    capabilities: {
      streaming: false, richFormatting: false, threads: false,
      reactions: false, fileUpload: false, voice: false,
    },
    start: vi.fn(),
    stop: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendPermissionRequest: vi.fn().mockResolvedValue(undefined),
    sendNotification: vi.fn(),
    createSessionThread: vi.fn().mockResolvedValue("thread-1"),
    renameSessionThread: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function mockBridgeDeps() {
  return {
    messageTransformer: {
      transform: vi.fn((event: any) => ({ type: "text" as const, text: event.content ?? event.message ?? "" })),
    },
    notificationManager: { notify: vi.fn(), notifyAll: vi.fn() },
    sessionManager: { patchRecord: vi.fn(), getSessionRecord: vi.fn().mockReturnValue(null) },
    eventBus: { emit: vi.fn() },
  } as any;
}

function makeSession(channelId = "telegram") {
  const agent = mockAgentInstance();
  const session = new Session({
    channelId,
    agentName: "test-agent",
    workingDirectory: "/tmp",
    agentInstance: agent,
  });
  return { session, agent };
}

describe("Multi-Bridge Routing — shouldForward()", () => {
  it("forwards turn events to target adapter (sourceAdapterId)", async () => {
    const { session, agent } = makeSession("telegram");
    const telegramAdapter = mockAdapter("telegram");
    const sseAdapter = mockAdapter("sse");
    const deps = mockBridgeDeps();

    const telegramBridge = new SessionBridge(session, telegramAdapter, deps, "telegram");
    const sseBridge = new SessionBridge(session, sseAdapter, deps, "sse");
    telegramBridge.connect();
    sseBridge.connect();

    session.activeTurnContext = { turnId: "t1", sourceAdapterId: "telegram" };

    agent.emit("agent_event", { type: "text", content: "hello" });

    await vi.waitFor(() => {
      expect(telegramAdapter.sendMessage).toHaveBeenCalled();
    });
    expect(sseAdapter.sendMessage).not.toHaveBeenCalled();

    telegramBridge.disconnect();
    sseBridge.disconnect();
  });

  it("broadcasts system events to all bridges", async () => {
    const { session, agent } = makeSession("telegram");
    const telegramAdapter = mockAdapter("telegram");
    const sseAdapter = mockAdapter("sse");
    const deps = mockBridgeDeps();

    const telegramBridge = new SessionBridge(session, telegramAdapter, deps, "telegram");
    const sseBridge = new SessionBridge(session, sseAdapter, deps, "sse");
    telegramBridge.connect();
    sseBridge.connect();

    session.activeTurnContext = { turnId: "t1", sourceAdapterId: "telegram" };

    agent.emit("agent_event", { type: "system_message", message: "info" });

    await vi.waitFor(() => {
      expect(telegramAdapter.sendMessage).toHaveBeenCalled();
      expect(sseAdapter.sendMessage).toHaveBeenCalled();
    });

    telegramBridge.disconnect();
    sseBridge.disconnect();
  });

  it("routes to explicit responseAdapterId (cross-adapter)", async () => {
    const { session, agent } = makeSession("telegram");
    const telegramAdapter = mockAdapter("telegram");
    const discordAdapter = mockAdapter("discord");
    const deps = mockBridgeDeps();

    const telegramBridge = new SessionBridge(session, telegramAdapter, deps, "telegram");
    const discordBridge = new SessionBridge(session, discordAdapter, deps, "discord");
    telegramBridge.connect();
    discordBridge.connect();

    session.activeTurnContext = { turnId: "t1", sourceAdapterId: "system", responseAdapterId: "discord" };

    agent.emit("agent_event", { type: "text", content: "result" });

    await vi.waitFor(() => {
      expect(discordAdapter.sendMessage).toHaveBeenCalled();
    });
    expect(telegramAdapter.sendMessage).not.toHaveBeenCalled();

    telegramBridge.disconnect();
    discordBridge.disconnect();
  });

  it("suppresses all turn events for silent prompts (responseAdapterId=null)", async () => {
    const { session, agent } = makeSession("telegram");
    const telegramAdapter = mockAdapter("telegram");
    const deps = mockBridgeDeps();

    const telegramBridge = new SessionBridge(session, telegramAdapter, deps, "telegram");
    telegramBridge.connect();

    session.activeTurnContext = { turnId: "t1", sourceAdapterId: "system", responseAdapterId: null };

    agent.emit("agent_event", { type: "text", content: "auto-name" });

    await new Promise(r => setTimeout(r, 20));
    expect(telegramAdapter.sendMessage).not.toHaveBeenCalled();

    telegramBridge.disconnect();
  });

  it("broadcasts system events even during silent prompts", async () => {
    const { session, agent } = makeSession("telegram");
    const telegramAdapter = mockAdapter("telegram");
    const deps = mockBridgeDeps();

    const telegramBridge = new SessionBridge(session, telegramAdapter, deps, "telegram");
    telegramBridge.connect();

    session.activeTurnContext = { turnId: "t1", sourceAdapterId: "system", responseAdapterId: null };

    agent.emit("agent_event", { type: "system_message", message: "status" });

    await vi.waitFor(() => {
      expect(telegramAdapter.sendMessage).toHaveBeenCalled();
    });

    telegramBridge.disconnect();
  });

  it("forwards all events when no active turn context (backward compat)", async () => {
    const { session, agent } = makeSession("telegram");
    const telegramAdapter = mockAdapter("telegram");
    const deps = mockBridgeDeps();

    const telegramBridge = new SessionBridge(session, telegramAdapter, deps, "telegram");
    telegramBridge.connect();

    session.activeTurnContext = null;

    agent.emit("agent_event", { type: "text", content: "hi" });

    await vi.waitFor(() => {
      expect(telegramAdapter.sendMessage).toHaveBeenCalled();
    });

    telegramBridge.disconnect();
  });
});
