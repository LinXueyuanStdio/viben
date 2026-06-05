import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionBridge } from "../session-bridge.js";
import { Session } from "../session.js";
import type { AgentInstance } from "../../agents/agent-instance.js";
import type { IChannelAdapter } from "../../channel.js";
import type { MessageTransformer } from "../../message-transformer.js";
import type { NotificationManager } from "../../../plugins/notifications/notification.js";
import type { SessionManager } from "../session-manager.js";
import type { AgentEvent, PermissionRequest, ConfigOption } from "../../types.js";
import { TypedEmitter } from "../../utils/typed-emitter.js";

function createMockAgentInstance(): AgentInstance {
  const emitter = new TypedEmitter<{ agent_event: (event: AgentEvent) => void }>();
  return Object.assign(emitter, {
    sessionId: "agent-session-1",
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

function createSession(agentInstance?: AgentInstance): Session {
  return new Session({
    channelId: "test-channel",
    agentName: "test-agent",
    workingDirectory: "/tmp/test",
    agentInstance: agentInstance ?? createMockAgentInstance(),
  });
}

function makePermissionRequest(description: string): PermissionRequest {
  return {
    id: "req-1",
    description,
    options: [
      { id: "allow-1", label: "Allow", isAllow: true },
      { id: "deny-1", label: "Deny", isAllow: false },
    ],
  };
}

function makePermissionRequestNoAllow(description: string): PermissionRequest {
  return {
    id: "req-1",
    description,
    options: [
      { id: "deny-1", label: "Deny", isAllow: false },
    ],
  };
}

describe("SessionBridge auto-approve", () => {
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

  it("does NOT auto-approve requests with 'viben' in the description when bypass is OFF", async () => {
    const request = makePermissionRequest("Run viben install plugin");

    const resultPromise = agent.onPermissionRequest(request);

    // Should be forwarded to adapter, not auto-approved
    expect(adapter.sendPermissionRequest).toHaveBeenCalled();

    session.permissionGate.resolve("deny-1");
    const result = await resultPromise;
    expect(result).toBe("deny-1");
  });

  it("does NOT auto-approve requests with 'Viben' (case-insensitive) in description when bypass is OFF", async () => {
    const request = makePermissionRequest("Run Viben config command");

    const resultPromise = agent.onPermissionRequest(request);

    // Should be forwarded to adapter, not auto-approved
    expect(adapter.sendPermissionRequest).toHaveBeenCalled();

    session.permissionGate.resolve("deny-1");
    const result = await resultPromise;
    expect(result).toBe("deny-1");
  });

  // --- Client-side bypass via clientOverrides ---

  it("auto-approves when clientOverrides.bypassPermissions is true", async () => {
    session.clientOverrides = { bypassPermissions: true };
    const request = makePermissionRequest("Execute rm -rf /important");

    const result = await agent.onPermissionRequest(request);

    expect(result).toBe("allow-1");
    expect(adapter.sendPermissionRequest).not.toHaveBeenCalled();
  });

  // --- Agent-side bypass via configOptions with bypass keyword ---

  it("auto-approves when agent mode config currentValue matches bypass keyword", async () => {
    session.setInitialConfigOptions([
      {
        id: "mode",
        name: "Mode",
        category: "mode",
        type: "select",
        currentValue: "bypassPermissions",
        options: [{ value: "bypassPermissions", name: "Bypass" }],
      },
    ]);
    const request = makePermissionRequest("Delete important file");

    const result = await agent.onPermissionRequest(request);

    expect(result).toBe("allow-1");
    expect(adapter.sendPermissionRequest).not.toHaveBeenCalled();
  });

  it("auto-approves when agent mode config currentValue contains 'dangerous'", async () => {
    session.setInitialConfigOptions([
      {
        id: "mode",
        name: "Mode",
        category: "mode",
        type: "select",
        currentValue: "dangerous_mode",
        options: [{ value: "dangerous_mode", name: "Dangerous" }],
      },
    ]);
    const request = makePermissionRequest("Execute something risky");

    const result = await agent.onPermissionRequest(request);

    expect(result).toBe("allow-1");
    expect(adapter.sendPermissionRequest).not.toHaveBeenCalled();
  });

  // --- No bypass scenarios ---

  it("does NOT auto-approve when mode is 'code' (not a bypass keyword)", async () => {
    session.setInitialConfigOptions([
      {
        id: "mode",
        name: "Mode",
        category: "mode",
        type: "select",
        currentValue: "code",
        options: [{ value: "code", name: "Code" }],
      },
    ]);
    const request = makePermissionRequest("Delete file");

    const resultPromise = agent.onPermissionRequest(request);

    expect(adapter.sendPermissionRequest).toHaveBeenCalled();

    session.permissionGate.resolve("deny-1");
    const result = await resultPromise;
    expect(result).toBe("deny-1");
  });

  it("does NOT auto-approve when clientOverrides is empty and no bypass mode", async () => {
    session.clientOverrides = {};
    session.setInitialConfigOptions([]);
    const request = makePermissionRequest("Delete file");

    const resultPromise = agent.onPermissionRequest(request);

    expect(adapter.sendPermissionRequest).toHaveBeenCalled();

    session.permissionGate.resolve("deny-1");
    const result = await resultPromise;
    expect(result).toBe("deny-1");
  });

  // --- Either bypass source triggers auto-approve ---

  it("auto-approves when EITHER agent bypass OR client bypass is true", async () => {
    // Both are set
    session.clientOverrides = { bypassPermissions: true };
    session.setInitialConfigOptions([
      {
        id: "mode",
        name: "Mode",
        category: "mode",
        type: "select",
        currentValue: "auto_accept",
        options: [{ value: "auto_accept", name: "Auto Accept" }],
      },
    ]);
    const request = makePermissionRequest("Delete something");

    const result = await agent.onPermissionRequest(request);

    expect(result).toBe("allow-1");
    expect(adapter.sendPermissionRequest).not.toHaveBeenCalled();
  });

  // --- Edge case: no isAllow option even with bypass enabled ---

  it("does not auto-approve if no isAllow option even with bypass enabled", async () => {
    session.clientOverrides = { bypassPermissions: true };
    const request = makePermissionRequestNoAllow("Something dangerous");

    const resultPromise = agent.onPermissionRequest(request);

    // Should fall through to normal UI flow since there's no allow option
    expect(adapter.sendPermissionRequest).toHaveBeenCalled();

    session.permissionGate.resolve("deny-1");
    const result = await resultPromise;
    expect(result).toBe("deny-1");
  });

  // --- Existing tests ---

  it("forwards normal requests to the adapter", async () => {
    const request = makePermissionRequest("Delete file foo.txt");

    // The promise will hang until resolved via permissionGate, so trigger it
    const resultPromise = agent.onPermissionRequest(request);

    expect(adapter.sendPermissionRequest).toHaveBeenCalledWith(
      session.id,
      request,
    );
    expect(session.permissionGate.isPending).toBe(true);

    // Resolve to complete the test
    session.permissionGate.resolve("deny-1");
    const result = await resultPromise;
    expect(result).toBe("deny-1");
  });

  it("does not auto-approve normal requests even with similar descriptions", async () => {
    const request = makePermissionRequest("Run npm install");

    const resultPromise = agent.onPermissionRequest(request);

    expect(adapter.sendPermissionRequest).toHaveBeenCalled();

    session.permissionGate.resolve("allow-1");
    await resultPromise;
  });

  // --- Bypass keyword coverage ---

  it("recognizes bypass keywords (auto-approve) in mode values", async () => {
    const bypassKeywords = ["bypass", "dangerous", "auto_accept"];

    for (const kw of bypassKeywords) {
      const agent = createMockAgentInstance();
      const session = createSession(agent);
      const adapter = createMockAdapter();
      const deps = createMockDeps();
      const bridge = new SessionBridge(session, adapter, deps);
      bridge.connect();

      session.setInitialConfigOptions([
        {
          id: "mode",
          name: "Mode",
          category: "mode",
          type: "select",
          currentValue: kw,
          options: [{ value: kw, name: kw }],
        },
      ]);

      const request = makePermissionRequest("Some action");
      const result = await agent.onPermissionRequest(request);
      expect(result).toBe("allow-1");
    }
  });

  it("does NOT auto-approve for deny-type keywords (dontask, skip)", async () => {
    const denyKeywords = ["skip", "dontask", "dont_ask"];

    for (const kw of denyKeywords) {
      const agent = createMockAgentInstance();
      const session = createSession(agent);
      const adapter = createMockAdapter();
      const deps = createMockDeps();
      const bridge = new SessionBridge(session, adapter, deps);
      bridge.connect();

      session.setInitialConfigOptions([
        {
          id: "mode",
          name: "Mode",
          category: "mode",
          type: "select",
          currentValue: kw,
          options: [{ value: kw, name: kw }],
        },
      ]);

      const request = makePermissionRequest("Some action");
      // Start request (don't await — it waits for resolution)
      const resultPromise = agent.onPermissionRequest(request);
      // Should NOT auto-approve — should prompt user via adapter
      expect(adapter.sendPermissionRequest).toHaveBeenCalled();
      session.permissionGate.resolve("allow-1");
      const result = await resultPromise;
      expect(result).toBe("allow-1");
    }
  });
});
