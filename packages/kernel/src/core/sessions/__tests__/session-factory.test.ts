import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionFactory } from "../session-factory.js";
import { Session } from "../session.js";
import { EventBus } from "../../event-bus.js";
import { TypedEmitter } from "../../utils/typed-emitter.js";
import type { AgentInstance } from "../../agents/agent-instance.js";
import type { AgentManager } from "../../agents/agent-manager.js";
import type { SessionManager } from "../session-manager.js";
import type { SpeechService } from "../../../plugins/speech/exports.js";
import type { AgentEvent } from "../../types.js";

function createMockAgentInstance(sessionId = "agent-session-1"): AgentInstance {
  const emitter = new TypedEmitter<{
    agent_event: (event: AgentEvent) => void;
  }>();
  return Object.assign(emitter, {
    sessionId,
    agentName: "test-agent",
    prompt: vi.fn().mockResolvedValue({}),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
  }) as unknown as AgentInstance;
}

function createMockDeps() {
  const mockAgent = createMockAgentInstance();

  const agentManager = {
    spawn: vi.fn().mockResolvedValue(mockAgent),
    resume: vi.fn().mockResolvedValue(mockAgent),
  } as unknown as AgentManager;

  const sessionManager = {
    registerSession: vi.fn(),
  } as unknown as SessionManager;

  const speechService = {} as SpeechService;

  const eventBus = new EventBus();

  return { agentManager, sessionManager, speechService, eventBus, mockAgent };
}

describe("SessionFactory", () => {
  let factory: SessionFactory;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    factory = new SessionFactory(
      deps.agentManager,
      deps.sessionManager,
      deps.speechService,
      deps.eventBus,
    );
  });

  describe("create()", () => {
    it("spawns agent and returns a session", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/tmp/test",
      });

      expect(session).toBeInstanceOf(Session);
      expect(session.channelId).toBe("telegram");
      expect(session.agentName).toBe("claude");
      expect(session.agentSessionId).toBe("agent-session-1");
      expect(deps.agentManager.spawn).toHaveBeenCalledWith(
        "claude",
        "/tmp/test",
        [],
      );
    });

    it("falls back to spawn when resume fails due to expired session", async () => {
      const spawnedAgent = createMockAgentInstance("new-spawn-session");
      deps.agentManager.resume = vi.fn().mockRejectedValue(new Error("Session not found"));
      deps.agentManager.spawn = vi.fn().mockResolvedValue(spawnedAgent);

      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/tmp/test",
        resumeAgentSessionId: "expired-session-id",
      });

      expect(deps.agentManager.resume).toHaveBeenCalledWith("claude", "/tmp/test", "expired-session-id", []);
      expect(deps.agentManager.spawn).toHaveBeenCalledWith("claude", "/tmp/test", []);
      expect(session.agentSessionId).toBe("new-spawn-session");
    });

    it("still throws when spawn also fails after resume failure", async () => {
      deps.agentManager.resume = vi.fn().mockRejectedValue(new Error("Session not found"));
      deps.agentManager.spawn = vi.fn().mockRejectedValue(new Error("Agent not installed"));

      await expect(factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/tmp/test",
        resumeAgentSessionId: "expired-session-id",
      })).rejects.toThrow("Agent not installed");
    });

    it("resumes agent when resumeAgentSessionId is provided", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/tmp/test",
        resumeAgentSessionId: "old-session-id",
      });

      expect(deps.agentManager.resume).toHaveBeenCalledWith(
        "claude",
        "/tmp/test",
        "old-session-id",
        [],
      );
      expect(session.agentSessionId).toBe("agent-session-1");
    });

    it("uses existingSessionId when provided", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/tmp/test",
        existingSessionId: "my-session-id",
      });

      expect(session.id).toBe("my-session-id");
    });

    it("sets initialName when provided", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/tmp/test",
        initialName: "My Session",
      });

      expect(session.name).toBe("My Session");
    });

    it("registers session in SessionManager", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/tmp/test",
      });

      expect(deps.sessionManager.registerSession).toHaveBeenCalledWith(
        session,
      );
    });

    it("emits session:created event on EventBus", async () => {
      const handler = vi.fn();
      deps.eventBus.on("session:created", handler);

      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/tmp/test",
      });

      expect(handler).toHaveBeenCalledWith({
        sessionId: session.id,
        agent: "claude",
        status: "initializing",
      });
    });

    it("throws when spawn fails", async () => {
      vi.mocked(deps.agentManager.spawn).mockRejectedValueOnce(
        new Error("spawn failed"),
      );

      await expect(
        factory.create({
          channelId: "telegram",
          agentName: "claude",
          workingDirectory: "/tmp/test",
        }),
      ).rejects.toThrow("spawn failed");
    });
  });

  describe("wireSideEffects()", () => {
    it("emits usage:recorded event on usage agent_event", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/tmp/test",
      });

      const mockEventBus = { emit: vi.fn() };
      const notificationManager = {
        notifyAll: vi.fn().mockResolvedValue(undefined),
      };

      factory.wireSideEffects(session, {
        eventBus: mockEventBus as any,
        notificationManager: notificationManager as any,
      });

      // Emit a usage event
      session.emit("agent_event", {
        type: "usage",
        tokensUsed: 100,
        contextSize: 500,
        cost: { amount: 0.01, currency: "USD" },
      } as AgentEvent);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "usage:recorded",
        expect.objectContaining({
          sessionId: session.id,
          agentName: "claude",
          tokensUsed: 100,
          contextSize: 500,
          cost: { amount: 0.01, currency: "USD" },
        }),
      );
    });

    it("does not emit usage:recorded for non-usage events", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/tmp/test",
      });

      const mockEventBus = { emit: vi.fn() };
      const notificationManager = {
        notifyAll: vi.fn().mockResolvedValue(undefined),
      };

      factory.wireSideEffects(session, {
        eventBus: mockEventBus as any,
        notificationManager: notificationManager as any,
      });

      session.emit("agent_event", {
        type: "text",
        content: "hello",
      } as AgentEvent);

      expect(mockEventBus.emit).not.toHaveBeenCalledWith("usage:recorded", expect.anything());
    });

    it("cleans up tunnels when session ends", async () => {
      const session = await factory.create({
        channelId: "telegram",
        agentName: "claude",
        workingDirectory: "/tmp/test",
      });

      const mockEventBus = { emit: vi.fn() };
      const tunnelService = {
        stopBySession: vi.fn().mockResolvedValue([
          { port: 3000, label: "dev-server" },
        ]),
      };
      const notificationManager = {
        notifyAll: vi.fn().mockResolvedValue(undefined),
      };

      factory.wireSideEffects(session, {
        eventBus: mockEventBus as any,
        notificationManager: notificationManager as any,
        tunnelService: tunnelService as any,
      });

      // Activate session first so it can transition to finished
      session.activate();
      session.finish("done");

      // Wait for async tunnel cleanup
      await vi.waitFor(() => {
        expect(tunnelService.stopBySession).toHaveBeenCalledWith(session.id);
      });
    });
  });
});
