import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssistantManager } from "../assistant/assistant-manager.js";
import { AssistantRegistry } from "../assistant/assistant-registry.js";
import type { SessionRecord } from "../types.js";

function makeRecord(sessionId: string, channelId: string): SessionRecord {
  return {
    sessionId,
    agentSessionId: `agent-${sessionId}`,
    agentName: 'claude-code',
    workingDir: '/tmp',
    channelId,
    status: 'finished',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    isAssistant: true,
    platform: {},
  };
}

function mockCore(existingRecord?: SessionRecord) {
  const session = {
    id: existingRecord?.sessionId ?? "assistant-1",
    threadId: "",
    enqueuePrompt: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
  const sessionStore = {
    findAssistant: vi.fn().mockReturnValue(existingRecord ?? undefined),
  };
  return {
    createSession: vi.fn().mockImplementation(async (params) => {
      if (params.threadId) session.threadId = params.threadId;
      if (params.existingSessionId) session.id = params.existingSessionId;
      return session;
    }),
    connectSessionBridge: vi.fn(),
    configManager: {
      get: () => ({ defaultAgent: "claude-code" }),
      resolveWorkspace: () => "/home/user/code",
    },
    sessionStore,
    _session: session,
  };
}

describe("AssistantManager", () => {
  let registry: AssistantRegistry;

  beforeEach(() => {
    registry = new AssistantRegistry();
  });

  describe("getOrSpawn()", () => {
    it("creates new session when no existing record", async () => {
      const core = mockCore();
      const manager = new AssistantManager(core as any, registry);

      const session = await manager.getOrSpawn("telegram", "12345");

      expect(core.createSession).toHaveBeenCalledWith(expect.objectContaining({
        channelId: "telegram",
        isAssistant: true,
        initialName: "Assistant",
        threadId: "12345",
      }));
      expect(session.threadId).toBe("12345");
      expect(manager.get("telegram")).toBe(session);
    });

    it("reuses existing session ID when record found in store", async () => {
      const existing = makeRecord("old-session-id", "telegram");
      const core = mockCore(existing);
      const manager = new AssistantManager(core as any, registry);

      const session = await manager.getOrSpawn("telegram", "12345");

      expect(core.sessionStore.findAssistant).toHaveBeenCalledWith("telegram");
      expect(core.createSession).toHaveBeenCalledWith(expect.objectContaining({
        existingSessionId: "old-session-id",
        isAssistant: true,
        channelId: "telegram",
        threadId: "12345",
      }));
      expect(session.id).toBe("old-session-id");
    });

    it("second call reuses same session ID", async () => {
      const core = mockCore();
      const manager = new AssistantManager(core as any, registry);

      // First call — no existing record
      await manager.getOrSpawn("telegram", "12345");

      // Now the store has the session ID
      core.sessionStore.findAssistant.mockReturnValue(makeRecord("assistant-1", "telegram"));

      // Second call — should reuse
      await manager.getOrSpawn("telegram", "12345");
      expect(core.createSession).toHaveBeenCalledTimes(2);
      const secondCall = core.createSession.mock.calls[1][0];
      expect(secondCall.existingSessionId).toBe("assistant-1");
    });

    it("stores pending system prompt after spawn", async () => {
      const core = mockCore();
      const manager = new AssistantManager(core as any, registry);

      await manager.getOrSpawn("telegram", "12345");
      const prompt = manager.consumePendingSystemPrompt("telegram");
      expect(typeof prompt).toBe("string");
      expect(prompt!.length).toBeGreaterThan(0);
    });
  });

  it("get returns null for unknown channel", () => {
    const core = mockCore();
    const manager = new AssistantManager(core as any, registry);
    expect(manager.get("discord")).toBeNull();
  });

  it("isAssistant returns true for assistant session", async () => {
    const core = mockCore();
    const manager = new AssistantManager(core as any, registry);
    await manager.getOrSpawn("telegram", "12345");
    expect(manager.isAssistant("assistant-1")).toBe(true);
    expect(manager.isAssistant("other-session")).toBe(false);
  });
});
