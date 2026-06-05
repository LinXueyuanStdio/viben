import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionFactory } from "../session-factory.js";
import { Session } from "../session.js";
import { TypedEmitter } from "../../utils/typed-emitter.js";
import type { AgentEvent } from "../../types.js";

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

function createMockAgentManager() {
  return {
    spawn: vi.fn().mockResolvedValue(mockAgentInstance()),
    resume: vi.fn().mockResolvedValue(mockAgentInstance("resumed-agent-sess")),
    getAgent: vi.fn().mockReturnValue({ name: "claude", command: "claude" }),
    getAvailableAgents: vi.fn().mockReturnValue([]),
  } as any;
}

function createMockSessionManager() {
  return {
    registerSession: vi.fn(),
    patchRecord: vi.fn(),
  } as any;
}

function createMockSpeechService() {
  return {} as any;
}

function createMockEventBus() {
  return {
    emit: vi.fn(),
  } as any;
}

describe("SessionFactory — Comprehensive Tests", () => {
  let agentManager: ReturnType<typeof createMockAgentManager>;
  let sessionManager: ReturnType<typeof createMockSessionManager>;
  let speechService: any;
  let eventBus: ReturnType<typeof createMockEventBus>;
  let factory: SessionFactory;

  beforeEach(() => {
    agentManager = createMockAgentManager();
    sessionManager = createMockSessionManager();
    speechService = createMockSpeechService();
    eventBus = createMockEventBus();
    factory = new SessionFactory(
      agentManager,
      sessionManager,
      speechService,
      eventBus,
    );
  });

  describe("create()", () => {
    it("spawns agent when no resumeAgentSessionId", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/workspace",
      });

      expect(agentManager.spawn).toHaveBeenCalledWith("claude", "/workspace", []);
      expect(agentManager.resume).not.toHaveBeenCalled();
      expect(session).toBeInstanceOf(Session);
    });

    it("resumes agent when resumeAgentSessionId provided", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/workspace",
        resumeAgentSessionId: "old-agent-sess",
      });

      expect(agentManager.resume).toHaveBeenCalledWith(
        "claude",
        "/workspace",
        "old-agent-sess",
        [],
      );
      expect(agentManager.spawn).not.toHaveBeenCalled();
    });

    it("uses existingSessionId when provided", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/workspace",
        existingSessionId: "my-custom-id",
      });

      expect(session.id).toBe("my-custom-id");
    });

    it("generates new id when no existingSessionId", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/workspace",
      });

      expect(session.id).toBeTruthy();
      expect(session.id.length).toBeGreaterThan(0);
    });

    it("sets initialName when provided", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/workspace",
        initialName: "My Session",
      });

      expect(session.name).toBe("My Session");
    });

    it("does not set name when initialName not provided", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/workspace",
      });

      expect(session.name).toBeUndefined();
    });

    it("registers session in SessionManager", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/workspace",
      });

      expect(sessionManager.registerSession).toHaveBeenCalledWith(session);
    });

    it("emits session:created event", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/workspace",
      });

      expect(eventBus.emit).toHaveBeenCalledWith("session:created", {
        sessionId: session.id,
        agent: "claude",
        status: "initializing",
      });
    });

    it("sets agentSessionId from agentInstance", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/workspace",
      });

      expect(session.agentSessionId).toBe("agent-sess-1");
    });

    it("throws when spawn fails", async () => {
      agentManager.spawn.mockRejectedValue(new Error("spawn failed"));

      await expect(
        factory.create({
          channelId: "telegram",
          agentName: "unknown-agent",
          workingDirectory: "/workspace",
        }),
      ).rejects.toThrow("spawn failed");
    });

    it("falls back to spawn when resume fails (expired session)", async () => {
      const freshAgent = mockAgentInstance("new-sess");
      agentManager.resume.mockRejectedValue(new Error("resume failed"));
      agentManager.spawn.mockResolvedValue(freshAgent);

      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/workspace",
        resumeAgentSessionId: "bad-id",
      });

      expect(session.agentSessionId).toBe("new-sess");
      expect(agentManager.spawn).toHaveBeenCalledWith("claude", "/workspace", []);
    });
  });

  describe("wireSideEffects()", () => {
    describe("usage tracking via event bus", () => {
      it("emits usage:recorded event on usage agent events", async () => {
        const session = await factory.create({
          channelId: "telegram",
          agentName: "claude",
          workingDirectory: "/workspace",
        });

        const mockEventBus = { emit: vi.fn() } as any;
        const notificationManager = { notifyAll: vi.fn() } as any;

        factory.wireSideEffects(session, {
          eventBus: mockEventBus,
          notificationManager,
        });

        session.emit("agent_event", {
          type: "usage",
          tokensUsed: 1000,
          contextSize: 5000,
          cost: { amount: 0.05, currency: "USD" },
        });

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          "usage:recorded",
          expect.objectContaining({
            sessionId: session.id,
            agentName: "claude",
            tokensUsed: 1000,
            contextSize: 5000,
            cost: { amount: 0.05, currency: "USD" },
          }),
        );
      });

      it("ignores non-usage events", async () => {
        const session = await factory.create({
          channelId: "telegram",
          agentName: "claude",
          workingDirectory: "/workspace",
        });

        const mockEventBus = { emit: vi.fn() } as any;
        const notificationManager = { notifyAll: vi.fn() } as any;

        factory.wireSideEffects(session, {
          eventBus: mockEventBus,
          notificationManager,
        });

        session.emit("agent_event", { type: "text", content: "hello" });
        session.emit("agent_event", { type: "thought", content: "thinking" });

        expect(mockEventBus.emit).not.toHaveBeenCalledWith("usage:recorded", expect.anything());
      });
    });

    describe("tunnel cleanup on session end", () => {
      it("stops tunnels when session finishes", async () => {
        const session = await factory.create({
          channelId: "telegram",
          agentName: "claude",
          workingDirectory: "/workspace",
        });

        const mockEventBus = { emit: vi.fn() } as any;
        const tunnelService = {
          stopBySession: vi.fn().mockResolvedValue([
            { port: 3000, label: "dev server" },
          ]),
        } as any;
        const notificationManager = {
          notifyAll: vi.fn().mockResolvedValue(undefined),
        } as any;

        factory.wireSideEffects(session, {
          eventBus: mockEventBus,
          notificationManager,
          tunnelService,
        });

        session.activate();
        session.finish("done");

        // Wait for async
        await new Promise((r) => setTimeout(r, 50));

        expect(tunnelService.stopBySession).toHaveBeenCalledWith(session.id);
        expect(notificationManager.notifyAll).toHaveBeenCalledWith(
          expect.objectContaining({
            summary: expect.stringContaining("port 3000"),
          }),
        );
      });

      it("stops tunnels when session is cancelled", async () => {
        const session = await factory.create({
          channelId: "telegram",
          agentName: "claude",
          workingDirectory: "/workspace",
        });

        const mockEventBus = { emit: vi.fn() } as any;
        const tunnelService = {
          stopBySession: vi.fn().mockResolvedValue([]),
        } as any;
        const notificationManager = { notifyAll: vi.fn() } as any;

        factory.wireSideEffects(session, {
          eventBus: mockEventBus,
          notificationManager,
          tunnelService,
        });

        session.activate();
        session.markCancelled();

        await new Promise((r) => setTimeout(r, 50));

        expect(tunnelService.stopBySession).toHaveBeenCalledWith(session.id);
      });

      it("does not stop tunnels on error (recoverable)", async () => {
        const session = await factory.create({
          channelId: "telegram",
          agentName: "claude",
          workingDirectory: "/workspace",
        });

        const mockEventBus = { emit: vi.fn() } as any;
        const tunnelService = { stopBySession: vi.fn() } as any;
        const notificationManager = { notifyAll: vi.fn() } as any;

        factory.wireSideEffects(session, {
          eventBus: mockEventBus,
          notificationManager,
          tunnelService,
        });

        session.fail("oops");

        await new Promise((r) => setTimeout(r, 50));

        expect(tunnelService.stopBySession).not.toHaveBeenCalled();
      });

      it("handles missing tunnelService gracefully", async () => {
        const session = await factory.create({
          channelId: "telegram",
          agentName: "claude",
          workingDirectory: "/workspace",
        });

        const mockEventBus = { emit: vi.fn() } as any;
        const notificationManager = { notifyAll: vi.fn() } as any;

        factory.wireSideEffects(session, {
          eventBus: mockEventBus,
          notificationManager,
        });

        session.activate();
        // Should not throw
        session.finish("done");
      });
    });
  });

  describe("lazy resume fallback — context injection after expired session", () => {
    function makeRecord(overrides: Record<string, unknown> = {}) {
      return {
        sessionId: "sess-1",
        agentSessionId: "old-agent-sess",
        agentName: "claude",
        workingDir: "/workspace",
        channelId: "telegram",
        status: "active",
        platform: { topicId: 42 },
        platforms: { telegram: { topicId: 42 } },
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        ...overrides,
      };
    }

    function setupLazyResume(record: ReturnType<typeof makeRecord>) {
      const freshAgent = mockAgentInstance("new-agent-sess");
      agentManager.resume = vi.fn().mockRejectedValue(new Error("Session not found"));
      agentManager.spawn = vi.fn().mockResolvedValue(freshAgent);

      const contextService = {
        flushSession: vi.fn().mockResolvedValue(undefined),
        buildContext: vi.fn().mockResolvedValue({ markdown: "# History\n\nSome history" }),
      };
      factory.getContextManager = () => contextService as any;
      factory.configManager = { get: vi.fn().mockReturnValue({ agentSwitch: { labelHistory: true } }) } as any;

      factory.sessionStore = {
        findByPlatform: vi.fn().mockReturnValue(record),
        get: vi.fn(),
      } as any;
      factory.adapters = new Map();
      factory.createFullSession = async (params: any) => {
        return factory.create(params);
      };

      return { freshAgent, contextService };
    }

    it("injects context when resume falls back to fresh spawn after restart", async () => {
      const record = makeRecord();
      const { contextService } = setupLazyResume(record);

      const session = await (factory as any).lazyResume("telegram", "42");

      expect(session).not.toBeNull();
      expect(contextService.buildContext).toHaveBeenCalledWith(
        expect.objectContaining({ type: "session", value: "sess-1" }),
        expect.objectContaining({ noCache: true }),
      );
      // pendingContext is private — verify via setContext was effectively called
      // by checking the session will inject context on next prompt
      expect((session as any).pendingContext).toBe("# History\n\nSome history");
    });

    it("does not inject context when resume succeeds normally", async () => {
      const resumedAgent = mockAgentInstance("old-agent-sess");
      agentManager.resume = vi.fn().mockResolvedValue(resumedAgent);

      const contextService = {
        buildContext: vi.fn().mockResolvedValue({ markdown: "# History" }),
      };
      factory.getContextManager = () => contextService as any;

      factory.sessionStore = {
        findByPlatform: vi.fn().mockReturnValue(makeRecord()),
        get: vi.fn(),
      } as any;
      factory.adapters = new Map();
      factory.createFullSession = async (params: any) => factory.create(params);

      const session = await (factory as any).lazyResume("telegram", "42");

      expect(session).not.toBeNull();
      expect(contextService.buildContext).not.toHaveBeenCalled();
    });
  });
});
