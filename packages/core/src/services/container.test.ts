/**
 * Container Service Tests
 *
 * Tests for process management in ContainerService using the unified Executor API.
 * For integration tests with real processes, see container.integration.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ContainerService, type ProcessState } from "./container";
import { EventService } from "./events";
import { SessionStoreService } from "./session-store";
import type { Executor, SSEMessage, ChatOptions, ExecutorCapability } from "../executors/ops/types";

/**
 * Create a mock executor that yields the given SSE messages from chatStreaming.
 * The async generator resolves immediately (synchronously-ish) so background
 * consumption finishes quickly.
 */
function createMockExecutor(messages: SSEMessage[] = []): Executor {
  const chatStreamingFn = vi.fn(function* (_options: ChatOptions) {
    // We need an async generator, but vi.fn wraps sync generators fine.
    // Use the async wrapper below instead.
  });

  // Build a proper async generator mock
  const chatStreamingMock = vi.fn(async function* (_options: ChatOptions): AsyncGenerator<SSEMessage> {
    for (const msg of messages) {
      yield msg;
    }
  });

  return {
    type: "CLAUDE_CODE",
    getAvailabilityInfo: vi.fn().mockReturnValue({ status: "INSTALLATION_FOUND" }),
    capabilities: vi.fn().mockReturnValue(["CHAT_STREAMING"] as ExecutorCapability[]),
    supports: vi.fn().mockReturnValue(true),
    defaultMcpConfigPath: vi.fn().mockReturnValue(null),
    getConfigDirName: vi.fn().mockReturnValue(".claude"),
    getConfigDir: vi.fn().mockReturnValue("/tmp/.claude"),
    getAgentConfigPath: vi.fn().mockReturnValue("/tmp/.claude/agent.yaml"),
    getCommandsPath: vi.fn().mockReturnValue("/tmp/.claude/commands"),
    getVibenCommandPath: vi.fn().mockReturnValue("commands/viben"),
    getCliName: vi.fn().mockReturnValue("claude"),
    buildRunCommand: vi.fn().mockReturnValue(["claude", "run"]),
    buildResumeCommand: vi.fn().mockReturnValue(["claude", "resume"]),
    getResumeCommandStr: vi.fn().mockReturnValue("claude resume session-id"),
    getNonInteractiveEnv: vi.fn().mockReturnValue({}),
    extractSessionIdFromLog: vi.fn().mockReturnValue(null),
    spawn: vi.fn().mockResolvedValue({ success: true }),
    chat: vi.fn().mockResolvedValue({ success: true }),
    chatStreaming: chatStreamingMock,
    resume: vi.fn().mockResolvedValue({ success: true }),
    supportsSessionIdOnCreate: vi.fn().mockReturnValue(false),
    supportsCLIAgents: vi.fn().mockReturnValue(true),
  } as unknown as Executor;
}

/**
 * Create a mock executor whose chatStreaming throws an error.
 */
function createFailingExecutor(error: Error = new Error("Stream failed")): Executor {
  const chatStreamingMock = vi.fn(async function* (_options: ChatOptions): AsyncGenerator<SSEMessage> {
    throw error;
  });

  return {
    type: "CLAUDE_CODE",
    getAvailabilityInfo: vi.fn().mockReturnValue({ status: "INSTALLATION_FOUND" }),
    capabilities: vi.fn().mockReturnValue(["CHAT_STREAMING"] as ExecutorCapability[]),
    supports: vi.fn().mockReturnValue(true),
    defaultMcpConfigPath: vi.fn().mockReturnValue(null),
    getConfigDirName: vi.fn().mockReturnValue(".claude"),
    getConfigDir: vi.fn().mockReturnValue("/tmp/.claude"),
    getAgentConfigPath: vi.fn().mockReturnValue("/tmp/.claude/agent.yaml"),
    getCommandsPath: vi.fn().mockReturnValue("/tmp/.claude/commands"),
    getVibenCommandPath: vi.fn().mockReturnValue("commands/viben"),
    getCliName: vi.fn().mockReturnValue("claude"),
    buildRunCommand: vi.fn().mockReturnValue(["claude", "run"]),
    buildResumeCommand: vi.fn().mockReturnValue(["claude", "resume"]),
    getResumeCommandStr: vi.fn().mockReturnValue("claude resume session-id"),
    getNonInteractiveEnv: vi.fn().mockReturnValue({}),
    extractSessionIdFromLog: vi.fn().mockReturnValue(null),
    spawn: vi.fn().mockResolvedValue({ success: true }),
    chat: vi.fn().mockResolvedValue({ success: true }),
    chatStreaming: chatStreamingMock,
    resume: vi.fn().mockResolvedValue({ success: true }),
    supportsSessionIdOnCreate: vi.fn().mockReturnValue(false),
    supportsCLIAgents: vi.fn().mockReturnValue(true),
  } as unknown as Executor;
}

/**
 * Create a blocking executor whose chatStreaming hangs until the returned
 * resolve function is called. Useful for tests that need the process to stay
 * in "running" status.
 */
function createBlockingExecutor(): { executor: Executor; unblock: () => void } {
  let unblock: () => void;
  const blocker = new Promise<void>((r) => { unblock = r; });

  const base = createMockExecutor();
  (base.chatStreaming as ReturnType<typeof vi.fn>).mockImplementation(
    async function* () {
      await blocker;
    }
  );

  return { executor: base, unblock: unblock! };
}

/**
 * Wait for background stream processing to complete.
 * The ContainerService consumes the stream in a background IIFE,
 * so we need to give it a tick to finish.
 */
async function waitForStreamProcessing(): Promise<void> {
  // Multiple ticks to ensure async generator is fully consumed
  await new Promise((r) => setTimeout(r, 50));
}

describe("ContainerService", () => {
  let service: ContainerService;
  let eventService: EventService;
  let sessionStore: SessionStoreService;

  beforeEach(() => {
    eventService = new EventService();
    sessionStore = {
      appendMessage: vi.fn().mockResolvedValue(undefined),
      appendUIMessage: vi.fn().mockResolvedValue(undefined),
      appendAgentMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as SessionStoreService;

    service = new ContainerService(eventService, sessionStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with event service", () => {
      const containerService = new ContainerService(eventService);
      expect(containerService).toBeInstanceOf(ContainerService);
    });

    it("should initialize with custom session store", () => {
      const customStore = {} as SessionStoreService;
      const containerService = new ContainerService(eventService, customStore);
      expect(containerService).toBeInstanceOf(ContainerService);
    });

    it("should have no running processes initially", () => {
      expect(service.runningProcesses()).toEqual([]);
    });
  });

  describe("spawnAgent", () => {
    it("should spawn a new agent process and call chatStreaming", async () => {
      const sessionId = "session-123";
      const agentId = "my-agent";
      const agentType = "claude_code";
      const workdir = "/workspace";
      const prompt = "Hello, agent!";
      const env = {};

      const mockExecutor = createMockExecutor();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        agentId,
        agentType,
        workdir,
        prompt,
        env
      );

      expect(mockExecutor.chatStreaming).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt,
          cwd: workdir,
          env,
          sessionId,
        })
      );
    });

    it("should return void (no SpawnedChild)", async () => {
      const mockExecutor = createMockExecutor();
      const result = await service.spawnAgent(
        "session-123",
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      expect(result).toBeUndefined();
    });

    it("should track the spawned process", async () => {
      const sessionId = "session-123";
      const { executor, unblock } = createBlockingExecutor();

      await service.spawnAgent(
        sessionId,
        executor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      const state = service.getProcess(sessionId);
      expect(state).toBeDefined();
      expect(state?.sessionId).toBe(sessionId);
      expect(state?.agentType).toBe("claude_code");
      expect(state?.workdir).toBe("/workspace");
      expect(state?.status).toBe("running");

      unblock();
      await waitForStreamProcessing();
    });

    it("should emit agent_spawned event", async () => {
      const listener = vi.fn();
      eventService.subscribe(listener);

      const sessionId = "session-123";
      const mockExecutor = createMockExecutor();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent_spawned",
          data: { agent_id: "claude_code", session_id: "session-123" },
        })
      );
    });

    it("should save user message to session store", async () => {
      const sessionId = "session-123";
      const prompt = "Hello, agent!";
      const mockExecutor = createMockExecutor();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        prompt,
        {}
      );

      expect(sessionStore.appendMessage).toHaveBeenCalledWith(
        "my-agent",
        sessionId,
        expect.objectContaining({
          role: "user",
          content: prompt,
        })
      );
    });

    it("should save UI user message to session store", async () => {
      const sessionId = "session-123";
      const prompt = "Hello, agent!";
      const mockExecutor = createMockExecutor();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        prompt,
        {}
      );

      expect(sessionStore.appendUIMessage).toHaveBeenCalledWith(
        "my-agent",
        sessionId,
        expect.objectContaining({
          type: "user",
          content: prompt,
        })
      );
    });

    it("should mark process as completed after stream finishes", async () => {
      const sessionId = "session-123";
      const mockExecutor = createMockExecutor([
        { type: "text", content: "Hello" } as SSEMessage,
      ]);

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      await waitForStreamProcessing();

      const state = service.getProcess(sessionId);
      expect(state?.status).toBe("completed");
    });

    it("should mark process as failed when stream throws", async () => {
      const sessionId = "session-123";
      const failingExecutor = createFailingExecutor(new Error("Stream error"));

      await service.spawnAgent(
        sessionId,
        failingExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      await waitForStreamProcessing();

      const state = service.getProcess(sessionId);
      expect(state?.status).toBe("failed");
    });

    it("should emit agent_completed after stream finishes successfully", async () => {
      const listener = vi.fn();
      eventService.subscribe(listener);

      const sessionId = "session-123";
      const { executor, unblock } = createBlockingExecutor();

      await service.spawnAgent(
        sessionId,
        executor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      // Stream is still blocked, no agent_completed yet
      const completedBefore = listener.mock.calls.filter(
        (call) => call[0].type === "agent_completed"
      );
      expect(completedBefore).toHaveLength(0);

      // Unblock the stream
      unblock();
      await waitForStreamProcessing();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent_completed",
          data: expect.objectContaining({
            session_id: sessionId,
            success: true,
          }),
        })
      );
    });

    it("should emit agent_completed with success=false when stream fails", async () => {
      const listener = vi.fn();
      eventService.subscribe(listener);

      const sessionId = "session-123";
      const failingExecutor = createFailingExecutor();

      await service.spawnAgent(
        sessionId,
        failingExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      await waitForStreamProcessing();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent_completed",
          data: expect.objectContaining({
            session_id: sessionId,
            success: false,
          }),
        })
      );
    });
  });

  describe("getProcess", () => {
    it("should return process state by session ID", async () => {
      const sessionId = "session-456";
      const mockExecutor = createMockExecutor();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Test prompt",
        {}
      );

      const state = service.getProcess(sessionId);
      expect(state).toBeDefined();
      expect(state?.sessionId).toBe(sessionId);
    });

    it("should return undefined for non-existent session", () => {
      const state = service.getProcess("non-existent");
      expect(state).toBeUndefined();
    });
  });

  describe("runningProcesses", () => {
    it("should list all running processes", async () => {
      const mockExecutor1 = createMockExecutor();
      const mockExecutor2 = createMockExecutor();

      // Use executors that yield messages slowly so they stay "running"
      // Actually, the background IIFE may finish before we check. Use a
      // long-running generator for this test.
      let resolve1: () => void;
      let resolve2: () => void;
      const blocker1 = new Promise<void>((r) => { resolve1 = r; });
      const blocker2 = new Promise<void>((r) => { resolve2 = r; });

      const blockingExecutor1 = createMockExecutor();
      (blockingExecutor1.chatStreaming as ReturnType<typeof vi.fn>).mockImplementation(
        async function* () {
          await blocker1;
        }
      );

      const blockingExecutor2 = createMockExecutor();
      (blockingExecutor2.chatStreaming as ReturnType<typeof vi.fn>).mockImplementation(
        async function* () {
          await blocker2;
        }
      );

      await service.spawnAgent(
        "session-1",
        blockingExecutor1,
        "agent-1",
        "claude_code",
        "/workspace1",
        "Prompt 1",
        {}
      );

      await service.spawnAgent(
        "session-2",
        blockingExecutor2,
        "agent-2",
        "gemini",
        "/workspace2",
        "Prompt 2",
        {}
      );

      const running = service.runningProcesses();
      expect(running).toHaveLength(2);
      expect(running.map((p) => p.sessionId)).toContain("session-1");
      expect(running.map((p) => p.sessionId)).toContain("session-2");

      // Cleanup: unblock the generators
      resolve1!();
      resolve2!();
      await waitForStreamProcessing();
    });

    it("should not include completed processes", async () => {
      const mockExecutor = createMockExecutor();

      await service.spawnAgent(
        "session-1",
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        {}
      );

      // Mark as completed
      service.markCompleted("session-1", true);

      const running = service.runningProcesses();
      expect(running).toHaveLength(0);
    });

    it("should not include cancelled processes", async () => {
      const mockExecutor = createMockExecutor();

      await service.spawnAgent(
        "session-1",
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        {}
      );

      // Mark as cancelled
      service.markCancelled("session-1");

      const running = service.runningProcesses();
      expect(running).toHaveLength(0);
    });
  });

  describe("markCompleted", () => {
    it("should mark process as completed with success", async () => {
      const sessionId = "session-123";
      const mockExecutor = createMockExecutor();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        {}
      );

      service.markCompleted(sessionId, true);

      const state = service.getProcess(sessionId);
      expect(state?.status).toBe("completed");
    });

    it("should mark process as failed when success is false", async () => {
      const sessionId = "session-123";
      const mockExecutor = createMockExecutor();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        {}
      );

      service.markCompleted(sessionId, false);

      const state = service.getProcess(sessionId);
      expect(state?.status).toBe("failed");
    });

    it("should emit agent_completed event", async () => {
      const listener = vi.fn();
      eventService.subscribe(listener);

      const sessionId = "session-123";
      const mockExecutor = createMockExecutor();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        {}
      );

      // Clear previous events
      listener.mockClear();

      service.markCompleted(sessionId, true);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent_completed",
          data: { agent_id: "claude_code", session_id: sessionId, success: true },
        })
      );
    });

    it("should do nothing for non-existent session", () => {
      // Should not throw
      service.markCompleted("non-existent", true);
      expect(service.getProcess("non-existent")).toBeUndefined();
    });
  });

  describe("markCancelled", () => {
    it("should mark process as cancelled", async () => {
      const sessionId = "session-123";
      const mockExecutor = createMockExecutor();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        {}
      );

      service.markCancelled(sessionId);

      const state = service.getProcess(sessionId);
      expect(state?.status).toBe("cancelled");
    });

    it("should emit agent_completed event with success=false", async () => {
      const listener = vi.fn();
      eventService.subscribe(listener);

      const sessionId = "session-123";
      const mockExecutor = createMockExecutor();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        {}
      );

      // Clear previous events
      listener.mockClear();

      service.markCancelled(sessionId);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent_completed",
          data: { agent_id: "claude_code", session_id: sessionId, success: false },
        })
      );
    });
  });

  describe("process status tracking", () => {
    it("should track status transitions from running to completed", async () => {
      const sessionId = "session-123";
      const { executor, unblock } = createBlockingExecutor();

      await service.spawnAgent(
        sessionId,
        executor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        {}
      );

      expect(service.getProcess(sessionId)?.status).toBe("running");

      service.markCompleted(sessionId, true);
      expect(service.getProcess(sessionId)?.status).toBe("completed");

      unblock();
      await waitForStreamProcessing();
    });

    it("should track status transitions from running to failed", async () => {
      const sessionId = "session-123";
      const { executor, unblock } = createBlockingExecutor();

      await service.spawnAgent(
        sessionId,
        executor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        {}
      );

      expect(service.getProcess(sessionId)?.status).toBe("running");

      service.markCompleted(sessionId, false);
      expect(service.getProcess(sessionId)?.status).toBe("failed");

      unblock();
      await waitForStreamProcessing();
    });

    it("should track status transitions from running to cancelled", async () => {
      const sessionId = "session-123";
      const { executor, unblock } = createBlockingExecutor();

      await service.spawnAgent(
        sessionId,
        executor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        {}
      );

      expect(service.getProcess(sessionId)?.status).toBe("running");

      service.markCancelled(sessionId);
      expect(service.getProcess(sessionId)?.status).toBe("cancelled");

      unblock();
      await waitForStreamProcessing();
    });
  });

  describe("killAllRunningProcesses", () => {
    it("should mark all running processes as cancelled", async () => {
      let resolve1: () => void;
      let resolve2: () => void;
      const blocker1 = new Promise<void>((r) => { resolve1 = r; });
      const blocker2 = new Promise<void>((r) => { resolve2 = r; });

      const executor1 = createMockExecutor();
      (executor1.chatStreaming as ReturnType<typeof vi.fn>).mockImplementation(
        async function* () { await blocker1; }
      );

      const executor2 = createMockExecutor();
      (executor2.chatStreaming as ReturnType<typeof vi.fn>).mockImplementation(
        async function* () { await blocker2; }
      );

      await service.spawnAgent(
        "session-1",
        executor1,
        "agent-1",
        "claude_code",
        "/workspace1",
        "Prompt 1",
        {}
      );

      await service.spawnAgent(
        "session-2",
        executor2,
        "agent-2",
        "gemini",
        "/workspace2",
        "Prompt 2",
        {}
      );

      service.killAllRunningProcesses();

      expect(service.getProcess("session-1")?.status).toBe("cancelled");
      expect(service.getProcess("session-2")?.status).toBe("cancelled");
      expect(service.runningProcesses()).toHaveLength(0);

      // Cleanup
      resolve1!();
      resolve2!();
      await waitForStreamProcessing();
    });

    it("should not affect already completed processes", async () => {
      const mockExecutor = createMockExecutor();

      await service.spawnAgent(
        "session-1",
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        {}
      );

      // Mark as completed first
      service.markCompleted("session-1", true);

      service.killAllRunningProcesses();

      // Should still be completed, not cancelled
      expect(service.getProcess("session-1")?.status).toBe("completed");
    });
  });

  describe("spawnFollowUp", () => {
    it("should spawn a follow-up session using chatStreaming with resume", async () => {
      const sessionId = "new-session";
      const existingSessionId = "existing-session";
      const mockExecutor = createMockExecutor();

      await service.spawnFollowUp(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Follow-up prompt",
        existingSessionId,
        {}
      );

      expect(mockExecutor.chatStreaming).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Follow-up prompt",
          cwd: "/workspace",
          resume: existingSessionId,
        })
      );
    });

    it("should return void", async () => {
      const mockExecutor = createMockExecutor();
      const result = await service.spawnFollowUp(
        "new-session",
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Follow-up",
        "existing",
        {}
      );

      expect(result).toBeUndefined();
    });

    it("should track the follow-up process", async () => {
      const sessionId = "new-session";
      const { executor, unblock } = createBlockingExecutor();

      await service.spawnFollowUp(
        sessionId,
        executor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Follow-up prompt",
        "existing-session",
        {}
      );

      const state = service.getProcess(sessionId);
      expect(state).toBeDefined();
      expect(state?.sessionId).toBe(sessionId);
      expect(state?.status).toBe("running");

      unblock();
      await waitForStreamProcessing();
    });

    it("should emit agent_spawned event for follow-up", async () => {
      const listener = vi.fn();
      eventService.subscribe(listener);

      const sessionId = "new-session";
      const mockExecutor = createMockExecutor();

      await service.spawnFollowUp(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Follow-up",
        "existing",
        {}
      );

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent_spawned",
          data: { agent_id: "claude_code", session_id: sessionId },
        })
      );
    });
  });

  describe("SSE message processing", () => {
    it("should process text SSE message and emit session_message", async () => {
      const sessionId = "session-123";
      const textMsg: SSEMessage = { type: "text", content: "Hello from agent" };
      const mockExecutor = createMockExecutor([textMsg]);

      const listener = vi.fn();
      eventService.subscribe(listener);

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      await waitForStreamProcessing();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "session_message",
          data: expect.objectContaining({
            session_id: sessionId,
            content: "Hello from agent",
            role: "assistant",
          }),
        })
      );
    });

    it("should handle tool_use SSE message", async () => {
      const sessionId = "session-123";
      const toolUseMsg: SSEMessage = {
        type: "tool_use",
        id: "tool-123",
        name: "read_file",
        input: { path: "/test.txt" },
      };
      const mockExecutor = createMockExecutor([toolUseMsg]);

      const listener = vi.fn();
      eventService.subscribe(listener);

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      await waitForStreamProcessing();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "execution_log",
          data: expect.objectContaining({
            session_id: sessionId,
            log_type: "tool_use",
          }),
        })
      );

      expect(sessionStore.appendUIMessage).toHaveBeenCalledWith(
        "my-agent",
        sessionId,
        expect.objectContaining({
          type: "tool_use",
          toolName: "read_file",
        })
      );
    });

    it("should handle tool_result SSE message", async () => {
      const sessionId = "session-123";
      const toolResultMsg: SSEMessage = {
        type: "tool_result",
        tool_use_id: "tool-123",
        output: "File content here",
        is_error: false,
      };
      const mockExecutor = createMockExecutor([toolResultMsg]);

      const listener = vi.fn();
      eventService.subscribe(listener);

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      await waitForStreamProcessing();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "execution_log",
          data: expect.objectContaining({
            session_id: sessionId,
            log_type: "tool_result",
          }),
        })
      );
    });

    it("should handle result SSE message", async () => {
      const sessionId = "session-123";
      const resultMsg: SSEMessage = {
        type: "result",
        result: "Task completed successfully",
      };
      const mockExecutor = createMockExecutor([resultMsg]);

      const listener = vi.fn();
      eventService.subscribe(listener);

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      await waitForStreamProcessing();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "session_message",
          data: expect.objectContaining({
            content: "Task completed successfully",
          }),
        })
      );
    });

    it("should handle error SSE message", async () => {
      const sessionId = "session-123";
      const errorMsg: SSEMessage = {
        type: "error",
        message: "Something went wrong",
      };
      const mockExecutor = createMockExecutor([errorMsg]);

      const listener = vi.fn();
      eventService.subscribe(listener);

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      await waitForStreamProcessing();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          data: expect.objectContaining({
            message: "Something went wrong",
          }),
        })
      );
    });

    it("should handle assistant message with content array", async () => {
      const sessionId = "session-123";
      const assistantMsg: SSEMessage = {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Here is my response" },
            { type: "tool_use", id: "tool-1", name: "bash", input: { command: "ls" } },
          ],
        },
      };
      const mockExecutor = createMockExecutor([assistantMsg]);

      const listener = vi.fn();
      eventService.subscribe(listener);

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      await waitForStreamProcessing();

      // Should emit session_message for text content
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "session_message",
          data: expect.objectContaining({
            content: "Here is my response",
          }),
        })
      );

      // Should emit execution_log for tool_use
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "execution_log",
          data: expect.objectContaining({
            log_type: "tool_use",
          }),
        })
      );
    });

    it("should handle unknown/default SSE message types as execution logs", async () => {
      const sessionId = "session-123";
      const streamEventMsg = {
        type: "stream_event",
        event: "start",
        data: {},
      } as SSEMessage;
      const mockExecutor = createMockExecutor([streamEventMsg]);

      const listener = vi.fn();
      eventService.subscribe(listener);

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      await waitForStreamProcessing();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "execution_log",
          data: expect.objectContaining({
            session_id: sessionId,
            log_type: "stream_event",
          }),
        })
      );
    });
  });

  describe("agent message storage", () => {
    it("should save raw agent messages to session store", async () => {
      const sessionId = "session-123";
      const textMsg: SSEMessage = { type: "text", content: "Agent response" };
      const mockExecutor = createMockExecutor([textMsg]);

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      await waitForStreamProcessing();

      expect(sessionStore.appendAgentMessage).toHaveBeenCalledWith(
        "my-agent",
        sessionId,
        expect.objectContaining({
          raw: textMsg,
          source: "claude_code",
        })
      );
    });
  });

  describe("session store error handling", () => {
    it("should continue even if session store fails to save user message", async () => {
      const failingStore = {
        appendMessage: vi.fn().mockRejectedValue(new Error("Store error")),
        appendUIMessage: vi.fn().mockRejectedValue(new Error("Store error")),
        appendAgentMessage: vi.fn().mockResolvedValue(undefined),
      } as unknown as SessionStoreService;

      const serviceWithFailingStore = new ContainerService(eventService, failingStore);
      const mockExecutor = createMockExecutor();

      // Should not throw
      await serviceWithFailingStore.spawnAgent(
        "session-123",
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        {}
      );

      // spawnAgent returns void, so just verify it didn't throw
      expect(serviceWithFailingStore.getProcess("session-123")).toBeDefined();
    });
  });
});
