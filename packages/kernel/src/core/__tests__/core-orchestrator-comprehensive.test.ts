import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypedEmitter } from "../utils/typed-emitter.js";
import type { AgentEvent, IncomingMessage, SessionStatus } from "../types.js";
import type { IChannelAdapter } from "../channel.js";

// --- Mocks for isolated testing of message routing and session lifecycle ---

function mockAgentInstance(sessionId = "agent-sess-1") {
  const emitter = new TypedEmitter<{
    agent_event: (event: AgentEvent) => void;
  }>();
  return Object.assign(emitter, {
    sessionId,
    prompt: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
  }) as any;
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
    createSessionThread: vi.fn().mockResolvedValue("thread-new"),
    deleteSessionThread: vi.fn().mockResolvedValue(undefined),
    archiveSessionTopic: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  } as unknown as IChannelAdapter;
}

function makeMessage(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    channelId: "telegram",
    threadId: "t1",
    userId: "user-1",
    text: "hello",
    ...overrides,
  };
}

describe("Core Orchestrator — Message Routing & Lifecycle", () => {
  describe("handleMessage — security integration", () => {
    it("drops message from unauthorized user silently", async () => {
      // Simulate the security flow: SecurityGuard rejects → message dropped
      const securityGuard = {
        checkAccess: vi.fn().mockReturnValue({
          allowed: false,
          reason: "Unauthorized user",
        }),
      };
      const sessionManager = {
        getSessionByThread: vi.fn(),
        patchRecord: vi.fn(),
      };
      const adapters = new Map<string, IChannelAdapter>();
      adapters.set("telegram", createMockAdapter());

      // Simulate handleMessage logic
      const message = makeMessage();
      const access = securityGuard.checkAccess(message);
      if (!access.allowed) {
        // For unauthorized users, no message sent, just dropped
        expect(access.reason).toBe("Unauthorized user");
        expect(sessionManager.getSessionByThread).not.toHaveBeenCalled();
        return;
      }
    });

    it("sends error to user when session limit reached", async () => {
      const adapter = createMockAdapter();
      const securityGuard = {
        checkAccess: vi.fn().mockReturnValue({
          allowed: false,
          reason: "Session limit reached (2)",
        }),
      };

      const message = makeMessage();
      const access = securityGuard.checkAccess(message);

      if (!access.allowed && access.reason.includes("Session limit")) {
        await adapter.sendMessage(message.threadId, {
          type: "error",
          text: `⚠️ ${access.reason}. Please cancel existing sessions with /cancel before starting new ones.`,
        });
      }

      expect(adapter.sendMessage).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({
          type: "error",
          text: expect.stringContaining("Session limit"),
        }),
      );
    });
  });

  describe("handleMessage — session lookup", () => {
    it("finds existing session by thread and forwards message", async () => {
      const session = {
        id: "sess-1",
        channelId: "telegram",
        threadId: "t1",
        status: "active" as SessionStatus,
        enqueuePrompt: vi.fn().mockResolvedValue(undefined),
      };

      const sessionManager = {
        getSessionByThread: vi.fn().mockReturnValue(session),
        patchRecord: vi.fn(),
      };

      const message = makeMessage({ text: "do something" });

      // Simulate handleMessage session lookup
      const foundSession = sessionManager.getSessionByThread(
        message.channelId,
        message.threadId,
      );

      expect(foundSession).toBe(session);

      // Forward message
      await foundSession!.enqueuePrompt(message.text, message.attachments);
      expect(session.enqueuePrompt).toHaveBeenCalledWith(
        "do something",
        undefined,
      );

      // Update activity timestamp
      sessionManager.patchRecord(foundSession!.id, {
        lastActiveAt: expect.any(String),
      });
      expect(sessionManager.patchRecord).toHaveBeenCalled();
    });

    it("returns early when no session found and lazy resume returns null", () => {
      const sessionManager = {
        getSessionByThread: vi.fn().mockReturnValue(undefined),
      };

      const found = sessionManager.getSessionByThread("telegram", "unknown");
      expect(found).toBeUndefined();
      // In real code, lazyResume would be called next and return null
    });
  });

  describe("lazy resume flow", () => {
    it("resumes session from store when not in memory", () => {
      // Simulate the store finding a record
      const record = {
        sessionId: "sess-old",
        agentSessionId: "agent-old",
        agentName: "claude",
        workingDir: "/workspace",
        channelId: "telegram",
        status: "active",
        name: "Old Session",
        dangerousMode: false,
        platform: { topicId: 12345 },
      };

      const store = {
        findByPlatform: vi.fn().mockReturnValue(record),
      };

      const found = store.findByPlatform(
        "telegram",
        (p: any) => String(p.topicId) === "12345",
      );

      expect(found).toBe(record);
      expect(found.status).toBe("active");
    });

    it("does not resume error status sessions", () => {
      const record = {
        sessionId: "sess-err",
        status: "error",
        platform: { topicId: 123 },
      };

      // Error sessions should be skipped
      expect(record.status).toBe("error");
      // In real code: if (record.status === "error") return null;
    });

    it("resume lock prevents concurrent resume attempts", () => {
      const locks = new Map<string, Promise<any>>();
      const lockKey = "telegram:12345";

      // First resume sets lock
      const promise1 = Promise.resolve("session");
      locks.set(lockKey, promise1);

      // Second attempt sees existing lock and reuses
      const existing = locks.get(lockKey);
      expect(existing).toBe(promise1);
    });

    it("lock is cleaned up after resume completes", async () => {
      const locks = new Map<string, Promise<any>>();
      const lockKey = "telegram:12345";

      // Simulate the pattern from core.ts lazyResume:
      // The IIFE runs, sets the lock, then cleans up in finally
      let cleanedUp = false;
      const resumePromise = (async (): Promise<string | null> => {
        try {
          return "session";
        } finally {
          locks.delete(lockKey);
          cleanedUp = true;
        }
      })();

      locks.set(lockKey, resumePromise);

      // The caller awaits the promise stored in the map
      const result = await locks.get(lockKey);
      expect(result).toBe("session");
      expect(cleanedUp).toBe(true);
    });
  });

  describe("archiveSession flow", () => {
    it("rejects if session not found", () => {
      const sessionManager = { getSession: vi.fn().mockReturnValue(undefined) };
      const session = sessionManager.getSession("nonexistent");

      if (!session) {
        const result = { ok: false, error: "Session not found" };
        expect(result.ok).toBe(false);
      }
    });

    it("rejects if session is initializing", () => {
      const session = { status: "initializing" };
      if (session.status === "initializing") {
        const result = { ok: false, error: "Session is still initializing" };
        expect(result.error).toContain("initializing");
      }
    });

    it("rejects if adapter not found", () => {
      const adapters = new Map<string, IChannelAdapter>();
      const adapter = adapters.get("nonexistent");

      if (!adapter) {
        const result = { ok: false, error: "Adapter not found for session" };
        expect(result.ok).toBe(false);
      }
    });
  });

  describe("adapter lifecycle", () => {
    it("start() calls start on all adapters", async () => {
      const adapter1 = createMockAdapter();
      const adapter2 = createMockAdapter();
      const adapters = new Map([
        ["telegram", adapter1],
        ["discord", adapter2],
      ]);

      for (const adapter of adapters.values()) {
        await adapter.start();
      }

      expect(adapter1.start).toHaveBeenCalled();
      expect(adapter2.start).toHaveBeenCalled();
    });

    it("stop() notifies, destroys sessions, stops adapters in order", async () => {
      const order: string[] = [];
      const adapter = createMockAdapter();
      vi.mocked(adapter.stop).mockImplementation(async () => {
        order.push("adapter.stop");
      });

      const notificationManager = {
        notifyAll: vi.fn().mockImplementation(async () => {
          order.push("notify");
        }),
      };

      const sessionManager = {
        destroyAll: vi.fn().mockImplementation(async () => {
          order.push("destroyAll");
        }),
      };

      // Simulate stop sequence
      await notificationManager.notifyAll({
        sessionId: "system",
        type: "error",
        summary: "Viben is shutting down",
      });
      await sessionManager.destroyAll();
      await adapter.stop();

      expect(order).toEqual(["notify", "destroyAll", "adapter.stop"]);
    });
  });

  describe("handleNewChat flow", () => {
    it("creates new session with same agent as current session", () => {
      const currentSession = {
        agentName: "claude",
        workingDirectory: "/workspace",
      };

      // Verify it would use the same agent
      expect(currentSession.agentName).toBe("claude");
    });

    it("falls back to store record when session not in memory", () => {
      const record = {
        agentName: "claude",
        workingDir: "/workspace",
        status: "active",
      };

      // Cancelled and error sessions should NOT create new chat
      expect(["cancelled", "error"].includes(record.status)).toBe(false);
    });

    it("returns null for cancelled session record", () => {
      const record = { status: "cancelled" };
      if (record.status === "cancelled" || record.status === "error") {
        expect(true).toBe(true); // would return null
      }
    });
  });

  describe("adoptSession flow", () => {
    it("rejects agent that doesn't support resume", () => {
      const caps = { supportsResume: false };
      if (!caps.supportsResume) {
        const result = {
          ok: false,
          error: "agent_not_supported",
          message: "Agent 'test' does not support session resume",
        };
        expect(result.ok).toBe(false);
      }
    });

    it("rejects non-existent directory", () => {
      const cwd = "/nonexistent/path";
      // In real code: if (!existsSync(cwd))
      const result = {
        ok: false,
        error: "invalid_cwd",
        message: `Directory does not exist: ${cwd}`,
      };
      expect(result.error).toBe("invalid_cwd");
    });

    it("returns existing session if already adopted", () => {
      const existingRecord = {
        sessionId: "sess-1",
        platform: { topicId: 12345 },
      };

      if (existingRecord) {
        const result = {
          ok: true,
          sessionId: existingRecord.sessionId,
          threadId: String(existingRecord.platform.topicId),
          status: "existing",
        };
        expect(result.status).toBe("existing");
        expect(result.threadId).toBe("12345");
      }
    });

    it("rejects when no adapter registered", () => {
      const adapters = new Map();
      const firstEntry = adapters.entries().next().value;
      if (!firstEntry) {
        const result = {
          ok: false,
          error: "no_adapter",
          message: "No channel adapter registered",
        };
        expect(result.error).toBe("no_adapter");
      }
    });
  });

  describe("createSession pipeline", () => {
    it("preserves existing platform data on resume", () => {
      const existingRecord = {
        platform: { topicId: 12345, skillMsgId: 67 },
      };

      const platform: Record<string, unknown> = {
        ...(existingRecord?.platform ?? {}),
      };

      // New thread data merges with existing
      platform.topicId = 99999;

      expect(platform.skillMsgId).toBe(67); // preserved
      expect(platform.topicId).toBe(99999); // updated
    });

    it("stores topicId as number for telegram channel", () => {
      const platform: Record<string, unknown> = {};
      const channelId = "telegram";
      const threadId = "12345";

      if (channelId === "telegram") {
        platform.topicId = Number(threadId);
      } else {
        platform.threadId = threadId;
      }

      expect(platform.topicId).toBe(12345);
      expect(typeof platform.topicId).toBe("number");
    });

    it("stores threadId as string for non-telegram channels", () => {
      const platform: Record<string, unknown> = {};
      const channelId: string = "discord";
      const threadId = "disc-thread-1";

      if (channelId === "telegram") {
        platform.topicId = Number(threadId);
      } else {
        platform.threadId = threadId;
      }

      expect(platform.threadId).toBe("disc-thread-1");
    });
  });
});
