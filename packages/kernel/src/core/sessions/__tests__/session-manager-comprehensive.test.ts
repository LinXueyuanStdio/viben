import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionManager } from "../session-manager.js";
import { Session } from "../session.js";
import { TypedEmitter } from "../../utils/typed-emitter.js";
import type { AgentEvent, SessionRecord } from "../../types.js";
import type { SessionStore } from "../session-store.js";

function mockAgentInstance() {
  const emitter = new TypedEmitter<{
    agent_event: (event: AgentEvent) => void;
  }>();
  return Object.assign(emitter, {
    sessionId: "agent-sess-1",
    prompt: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
  }) as any;
}

function createSession(overrides: Record<string, unknown> = {}): Session {
  const session = new Session({
    channelId: "telegram",
    agentName: "claude",
    workingDirectory: "/workspace",
    agentInstance: mockAgentInstance(),
    ...overrides,
  });
  return session;
}

function createMockStore(): SessionStore {
  const records = new Map<string, SessionRecord>();
  return {
    save: vi.fn(async (record: SessionRecord) => {
      records.set(record.sessionId, { ...record });
    }),
    get: vi.fn((id: string) => records.get(id)),
    findByPlatform: vi.fn((channelId: string, predicate: (p: any) => boolean) => {
      for (const r of records.values()) {
        if (r.channelId === channelId && predicate(r.platform)) return r;
      }
      return undefined;
    }),
    findByAgentSessionId: vi.fn((id: string) => {
      for (const r of records.values()) {
        if (r.agentSessionId === id || r.originalAgentSessionId === id) return r;
      }
      return undefined;
    }),
    list: vi.fn((channelId?: string) => {
      const all = [...records.values()];
      return channelId ? all.filter((r) => r.channelId === channelId) : all;
    }),
    remove: vi.fn(async (id: string) => {
      records.delete(id);
    }),
    flush: vi.fn(),
  };
}

describe("SessionManager — Comprehensive Tests", () => {
  describe("registerSession and getSession", () => {
    it("registers and retrieves a session", () => {
      const mgr = new SessionManager();
      const session = createSession();

      mgr.registerSession(session);

      expect(mgr.getSession(session.id)).toBe(session);
    });

    it("returns undefined for unregistered session", () => {
      const mgr = new SessionManager();
      expect(mgr.getSession("nonexistent")).toBeUndefined();
    });

    it("overwrites registration with same id", () => {
      const mgr = new SessionManager();
      const session1 = createSession();
      const id = session1.id;
      mgr.registerSession(session1);

      const session2 = new Session({
        id,
        channelId: "discord",
        agentName: "test",
        workingDirectory: "/other",
        agentInstance: mockAgentInstance(),
      });
      mgr.registerSession(session2);

      expect(mgr.getSession(id)).toBe(session2);
    });
  });

  describe("getSessionByThread", () => {
    it("finds session matching channelId and threadId", () => {
      const mgr = new SessionManager();
      const session = createSession();
      session.threadId = "thread-123";
      mgr.registerSession(session);

      const found = mgr.getSessionByThread("telegram", "thread-123");
      expect(found).toBe(session);
    });

    it("returns undefined when channelId doesn't match", () => {
      const mgr = new SessionManager();
      const session = createSession();
      session.threadId = "thread-123";
      mgr.registerSession(session);

      expect(mgr.getSessionByThread("discord", "thread-123")).toBeUndefined();
    });

    it("returns undefined when threadId doesn't match", () => {
      const mgr = new SessionManager();
      const session = createSession();
      session.threadId = "thread-123";
      mgr.registerSession(session);

      expect(mgr.getSessionByThread("telegram", "other-thread")).toBeUndefined();
    });

    it("finds correct session among multiple", () => {
      const mgr = new SessionManager();

      const s1 = createSession();
      s1.threadId = "t1";
      mgr.registerSession(s1);

      const s2 = new Session({
        channelId: "telegram",
        agentName: "test",
        workingDirectory: "/w",
        agentInstance: mockAgentInstance(),
      });
      s2.threadId = "t2";
      mgr.registerSession(s2);

      expect(mgr.getSessionByThread("telegram", "t2")).toBe(s2);
    });
  });

  describe("getSessionByAgentSessionId", () => {
    it("finds by agentSessionId", () => {
      const mgr = new SessionManager();
      const session = createSession();
      session.agentSessionId = "agent-xyz";
      mgr.registerSession(session);

      expect(mgr.getSessionByAgentSessionId("agent-xyz")).toBe(session);
    });

    it("returns undefined when not found", () => {
      const mgr = new SessionManager();
      expect(mgr.getSessionByAgentSessionId("ghost")).toBeUndefined();
    });
  });

  describe("patchRecord", () => {
    it("merges patch with existing record in store", async () => {
      const store = createMockStore();
      const mgr = new SessionManager(store);

      // Save initial record
      await store.save({
        sessionId: "s1",
        agentSessionId: "a1",
        agentName: "claude",
        workingDir: "/w",
        channelId: "telegram",
        status: "active",
        createdAt: "2024-01-01",
        lastActiveAt: "2024-01-01",
        platform: {},
      });

      await mgr.patchRecord("s1", { name: "Updated Name" });

      expect(store.save).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "s1",
          name: "Updated Name",
          agentName: "claude", // original preserved
        }),
      );
    });

    it("creates new record when patch has sessionId but no existing record", async () => {
      const store = createMockStore();
      const mgr = new SessionManager(store);

      await mgr.patchRecord("new-sess", {
        sessionId: "new-sess",
        agentSessionId: "a1",
        agentName: "claude",
        workingDir: "/w",
        channelId: "telegram",
        status: "initializing",
        createdAt: "2024-01-01",
        lastActiveAt: "2024-01-01",
        platform: {},
      });

      expect(store.save).toHaveBeenCalled();
    });

    it("does nothing when patch has no sessionId and record doesn't exist", async () => {
      const store = createMockStore();
      const mgr = new SessionManager(store);

      await mgr.patchRecord("ghost", { name: "test" });

      // save should not be called because no record and no sessionId
      expect(store.save).not.toHaveBeenCalled();
    });

    it("is a no-op when store is null", async () => {
      const mgr = new SessionManager(null);
      // Should not throw
      await mgr.patchRecord("s1", { name: "test" });
    });
  });

  describe("cancelSession", () => {
    it("aborts prompt and marks cancelled for in-memory session", async () => {
      const store = createMockStore();
      const mgr = new SessionManager(store);

      const session = createSession();
      session.activate();
      mgr.registerSession(session);

      await store.save({
        sessionId: session.id,
        agentSessionId: "a1",
        agentName: "claude",
        workingDir: "/w",
        channelId: "telegram",
        status: "active",
        createdAt: "now",
        lastActiveAt: "now",
        platform: {},
      });

      await mgr.cancelSession(session.id);

      expect(session.status).toBe("cancelled");
      // No active turn context — agent.cancel is not called when cancelling an idle session
      expect(session.agentInstance.cancel).not.toHaveBeenCalled();
    });

    it("updates store record for session not in memory", async () => {
      const store = createMockStore();
      const mgr = new SessionManager(store);

      await store.save({
        sessionId: "orphan",
        agentSessionId: "a1",
        agentName: "claude",
        workingDir: "/w",
        channelId: "telegram",
        status: "active",
        createdAt: "now",
        lastActiveAt: "now",
        platform: {},
      });

      await mgr.cancelSession("orphan");

      // Store should have been updated
      expect(store.save).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: "orphan", status: "cancelled" }),
      );
    });

    it("skips store update if already cancelled", async () => {
      const store = createMockStore();
      const mgr = new SessionManager(store);

      await store.save({
        sessionId: "already-cancelled",
        agentSessionId: "a1",
        agentName: "claude",
        workingDir: "/w",
        channelId: "telegram",
        status: "cancelled",
        createdAt: "now",
        lastActiveAt: "now",
        platform: {},
      });

      vi.mocked(store.save).mockClear();
      await mgr.cancelSession("already-cancelled");

      // save should not be called again since already cancelled
      expect(store.save).not.toHaveBeenCalled();
    });
  });

  describe("listSessions", () => {
    it("lists all in-memory sessions", () => {
      const mgr = new SessionManager();
      mgr.registerSession(createSession());
      mgr.registerSession(
        new Session({
          channelId: "discord",
          agentName: "test",
          workingDirectory: "/w",
          agentInstance: mockAgentInstance(),
        }),
      );

      expect(mgr.listSessions()).toHaveLength(2);
    });

    it("filters by channelId", () => {
      const mgr = new SessionManager();
      mgr.registerSession(createSession()); // telegram
      mgr.registerSession(
        new Session({
          channelId: "discord",
          agentName: "test",
          workingDirectory: "/w",
          agentInstance: mockAgentInstance(),
        }),
      );

      const telegramSessions = mgr.listSessions("telegram");
      expect(telegramSessions).toHaveLength(1);
      expect(telegramSessions[0].channelId).toBe("telegram");
    });
  });

  describe("listRecords", () => {
    it("returns all records from store", async () => {
      const store = createMockStore();
      const mgr = new SessionManager(store);

      await store.save({
        sessionId: "a",
        agentSessionId: "a1",
        agentName: "claude",
        workingDir: "/w",
        channelId: "telegram",
        status: "active",
        createdAt: "now",
        lastActiveAt: "now",
        platform: {},
      });

      expect(mgr.listRecords()).toHaveLength(1);
    });

    it("filters by statuses", async () => {
      const store = createMockStore();
      const mgr = new SessionManager(store);

      await store.save({
        sessionId: "a",
        agentSessionId: "a1",
        agentName: "claude",
        workingDir: "/w",
        channelId: "telegram",
        status: "active",
        createdAt: "now",
        lastActiveAt: "now",
        platform: {},
      });
      await store.save({
        sessionId: "b",
        agentSessionId: "b1",
        agentName: "claude",
        workingDir: "/w",
        channelId: "telegram",
        status: "finished",
        createdAt: "now",
        lastActiveAt: "now",
        platform: {},
      });

      const active = mgr.listRecords({ statuses: ["active"] });
      expect(active).toHaveLength(1);
      expect(active[0].sessionId).toBe("a");
    });

    it("returns empty when store is null", () => {
      const mgr = new SessionManager(null);
      expect(mgr.listRecords()).toEqual([]);
    });
  });

  describe("removeRecord", () => {
    it("removes from store and emits event", async () => {
      const store = createMockStore();
      const mgr = new SessionManager(store);
      const eventBus = { emit: vi.fn() } as any;
      mgr.setEventBus(eventBus);

      await store.save({
        sessionId: "s1",
        agentSessionId: "a1",
        agentName: "claude",
        workingDir: "/w",
        channelId: "telegram",
        status: "finished",
        createdAt: "now",
        lastActiveAt: "now",
        platform: {},
      });

      await mgr.removeRecord("s1");

      expect(store.remove).toHaveBeenCalledWith("s1");
      expect(eventBus.emit).toHaveBeenCalledWith("session:deleted", {
        sessionId: "s1",
      });
    });

    it("is no-op when store is null", async () => {
      const mgr = new SessionManager(null);
      await expect(mgr.removeRecord("s1")).resolves.toBeUndefined();
    });
  });

  describe("destroyAll", () => {
    it("destroys all sessions and clears map", async () => {
      const store = createMockStore();
      const mgr = new SessionManager(store);

      const s1 = createSession();
      const s2 = new Session({
        channelId: "discord",
        agentName: "test",
        workingDirectory: "/w",
        agentInstance: mockAgentInstance(),
      });

      mgr.registerSession(s1);
      mgr.registerSession(s2);

      // Save records to store
      await store.save({
        sessionId: s1.id,
        agentSessionId: "a1",
        agentName: "claude",
        workingDir: "/w",
        channelId: "telegram",
        status: "active",
        createdAt: "now",
        lastActiveAt: "now",
        platform: {},
      });
      await store.save({
        sessionId: s2.id,
        agentSessionId: "a2",
        agentName: "test",
        workingDir: "/w",
        channelId: "discord",
        status: "active",
        createdAt: "now",
        lastActiveAt: "now",
        platform: {},
      });

      await mgr.destroyAll();

      expect(s1.agentInstance.destroy).toHaveBeenCalled();
      expect(s2.agentInstance.destroy).toHaveBeenCalled();
      expect(mgr.listSessions()).toHaveLength(0);

      // Store records should be marked as finished
      expect(store.save).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: s1.id, status: "finished" }),
      );
    });

    it("works with empty session list", async () => {
      const mgr = new SessionManager();
      await expect(mgr.destroyAll()).resolves.toBeUndefined();
    });
  });

  describe("getRecordByThread", () => {
    it("finds by topicId (Telegram)", async () => {
      const store = createMockStore();
      const mgr = new SessionManager(store);

      await store.save({
        sessionId: "s1",
        agentSessionId: "a1",
        agentName: "claude",
        workingDir: "/w",
        channelId: "telegram",
        status: "active",
        createdAt: "now",
        lastActiveAt: "now",
        platform: { topicId: 12345 },
      });

      const record = mgr.getRecordByThread("telegram", "12345");
      expect(record?.sessionId).toBe("s1");
    });

    it("finds by threadId (Discord)", async () => {
      const store = createMockStore();
      const mgr = new SessionManager(store);

      await store.save({
        sessionId: "s1",
        agentSessionId: "a1",
        agentName: "claude",
        workingDir: "/w",
        channelId: "discord",
        status: "active",
        createdAt: "now",
        lastActiveAt: "now",
        platform: { threadId: "disc-thread-1" },
      });

      const record = mgr.getRecordByThread("discord", "disc-thread-1");
      expect(record?.sessionId).toBe("s1");
    });

    it("returns undefined when store is null", () => {
      const mgr = new SessionManager(null);
      expect(mgr.getRecordByThread("telegram", "123")).toBeUndefined();
    });
  });
});
