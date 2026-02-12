/**
 * Container Service Tests
 *
 * Tests for process management in ContainerService.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { ContainerService, type ProcessState } from "./container";
import { EventService } from "./events";
import { SessionStoreService } from "./session-store";
import type { StandardCodingAgentExecutor, SpawnedChild, ExecutionEnv } from "../executors/types";

/**
 * Create a mock child process
 */
function createMockChildProcess(): ChildProcess {
  const emitter = new EventEmitter();
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();

  const child = Object.assign(emitter, {
    pid: 12345,
    stdout,
    stderr,
    stdin: null,
    stdio: [null, stdout, stderr, null, null] as const,
    connected: true,
    exitCode: null,
    signalCode: null,
    killed: false,
    spawnargs: [],
    spawnfile: "",
    kill: vi.fn(() => true),
    send: vi.fn(),
    disconnect: vi.fn(),
    unref: vi.fn(),
    ref: vi.fn(),
    [Symbol.dispose]: vi.fn(),
  }) as unknown as ChildProcess;

  return child;
}

/**
 * Create a mock executor
 */
function createMockExecutor(mockChild: ChildProcess): StandardCodingAgentExecutor {
  return {
    type: "CLAUDE_CODE",
    spawn: vi.fn().mockResolvedValue({
      child: mockChild,
      exitPromise: Promise.resolve("success"),
      cancel: vi.fn(),
    } as SpawnedChild),
    spawnFollowUp: vi.fn().mockResolvedValue({
      child: mockChild,
      exitPromise: Promise.resolve("success"),
      cancel: vi.fn(),
    } as SpawnedChild),
    defaultMcpConfigPath: vi.fn().mockReturnValue(null),
    getAvailabilityInfo: vi.fn().mockReturnValue({ available: true }),
    capabilities: vi.fn().mockReturnValue([]),
  };
}

/**
 * Create a mock execution environment
 */
function createMockEnv(): ExecutionEnv {
  return {
    vars: {},
    repoContext: {
      workspaceRoot: "/workspace",
      repoNames: [],
    },
    commitReminder: false,
    commitReminderPrompt: "",
  };
}

describe("ContainerService", () => {
  let service: ContainerService;
  let eventService: EventService;
  let sessionStore: SessionStoreService;
  let mockChild: ChildProcess;
  let mockExecutor: StandardCodingAgentExecutor;

  beforeEach(() => {
    eventService = new EventService();
    sessionStore = {
      appendMessage: vi.fn().mockResolvedValue(undefined),
      appendUIMessage: vi.fn().mockResolvedValue(undefined),
      appendAgentMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as SessionStoreService;

    service = new ContainerService(eventService, sessionStore);
    mockChild = createMockChildProcess();
    mockExecutor = createMockExecutor(mockChild);
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
    it("should spawn a new agent process", async () => {
      const sessionId = "session-123";
      const agentId = "my-agent";
      const agentType = "claude_code";
      const workdir = "/workspace";
      const prompt = "Hello, agent!";
      const env = createMockEnv();

      const result = await service.spawnAgent(
        sessionId,
        mockExecutor,
        agentId,
        agentType,
        workdir,
        prompt,
        env
      );

      expect(result.child).toBe(mockChild);
      expect(mockExecutor.spawn).toHaveBeenCalledWith(workdir, prompt, env);
    });

    it("should track the spawned process", async () => {
      const sessionId = "session-123";
      const env = createMockEnv();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      const state = service.getProcess(sessionId);
      expect(state).toBeDefined();
      expect(state?.sessionId).toBe(sessionId);
      expect(state?.agentType).toBe("claude_code");
      expect(state?.workdir).toBe("/workspace");
      expect(state?.pid).toBe(12345);
      expect(state?.status).toBe("running");
    });

    it("should emit agent_spawned event", async () => {
      const listener = vi.fn();
      eventService.subscribe(listener);

      const sessionId = "session-123";
      const env = createMockEnv();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent_spawned",
          data: { agentId: "claude_code", sessionId: "session-123" },
        })
      );
    });

    it("should save user message to session store", async () => {
      const sessionId = "session-123";
      const prompt = "Hello, agent!";
      const env = createMockEnv();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        prompt,
        env
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
      const env = createMockEnv();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        prompt,
        env
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
  });

  describe("getProcess", () => {
    it("should return process state by session ID", async () => {
      const sessionId = "session-456";
      const env = createMockEnv();

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Test prompt",
        env
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
      const env = createMockEnv();

      // Spawn multiple processes
      await service.spawnAgent(
        "session-1",
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace1",
        "Prompt 1",
        env
      );

      await service.spawnAgent(
        "session-2",
        mockExecutor,
        "agent-2",
        "gemini",
        "/workspace2",
        "Prompt 2",
        env
      );

      const running = service.runningProcesses();
      expect(running).toHaveLength(2);
      expect(running.map((p) => p.sessionId)).toContain("session-1");
      expect(running.map((p) => p.sessionId)).toContain("session-2");
    });

    it("should not include completed processes", async () => {
      const env = createMockEnv();

      await service.spawnAgent(
        "session-1",
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        env
      );

      // Mark as completed
      service.markCompleted("session-1", true);

      const running = service.runningProcesses();
      expect(running).toHaveLength(0);
    });

    it("should not include cancelled processes", async () => {
      const env = createMockEnv();

      await service.spawnAgent(
        "session-1",
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        env
      );

      // Mark as cancelled
      service.markCancelled("session-1");

      const running = service.runningProcesses();
      expect(running).toHaveLength(0);
    });
  });

  describe("markCompleted", () => {
    it("should mark process as completed with success", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        env
      );

      service.markCompleted(sessionId, true);

      const state = service.getProcess(sessionId);
      expect(state?.status).toBe("completed");
    });

    it("should mark process as failed when success is false", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        env
      );

      service.markCompleted(sessionId, false);

      const state = service.getProcess(sessionId);
      expect(state?.status).toBe("failed");
    });

    it("should emit agent_completed event", async () => {
      const listener = vi.fn();
      eventService.subscribe(listener);

      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        env
      );

      // Clear previous events
      listener.mockClear();

      service.markCompleted(sessionId, true);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent_completed",
          data: { agentId: "claude_code", sessionId, success: true },
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
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        env
      );

      service.markCancelled(sessionId);

      const state = service.getProcess(sessionId);
      expect(state?.status).toBe("cancelled");
    });

    it("should emit agent_completed event with success=false", async () => {
      const listener = vi.fn();
      eventService.subscribe(listener);

      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        env
      );

      // Clear previous events
      listener.mockClear();

      service.markCancelled(sessionId);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent_completed",
          data: { agentId: "claude_code", sessionId, success: false },
        })
      );
    });
  });

  describe("process status tracking", () => {
    it("should track status transitions from running to completed", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        env
      );

      expect(service.getProcess(sessionId)?.status).toBe("running");

      service.markCompleted(sessionId, true);
      expect(service.getProcess(sessionId)?.status).toBe("completed");
    });

    it("should track status transitions from running to failed", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        env
      );

      expect(service.getProcess(sessionId)?.status).toBe("running");

      service.markCompleted(sessionId, false);
      expect(service.getProcess(sessionId)?.status).toBe("failed");
    });

    it("should track status transitions from running to cancelled", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        env
      );

      expect(service.getProcess(sessionId)?.status).toBe("running");

      service.markCancelled(sessionId);
      expect(service.getProcess(sessionId)?.status).toBe("cancelled");
    });
  });

  describe("killAllRunningProcesses", () => {
    it("should mark all running processes as cancelled", async () => {
      const env = createMockEnv();

      await service.spawnAgent(
        "session-1",
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace1",
        "Prompt 1",
        env
      );

      await service.spawnAgent(
        "session-2",
        mockExecutor,
        "agent-2",
        "gemini",
        "/workspace2",
        "Prompt 2",
        env
      );

      service.killAllRunningProcesses();

      expect(service.getProcess("session-1")?.status).toBe("cancelled");
      expect(service.getProcess("session-2")?.status).toBe("cancelled");
      expect(service.runningProcesses()).toHaveLength(0);
    });

    it("should not affect already completed processes", async () => {
      const env = createMockEnv();

      await service.spawnAgent(
        "session-1",
        mockExecutor,
        "agent-1",
        "claude_code",
        "/workspace",
        "Prompt",
        env
      );

      // Mark as completed first
      service.markCompleted("session-1", true);

      service.killAllRunningProcesses();

      // Should still be completed, not cancelled
      expect(service.getProcess("session-1")?.status).toBe("completed");
    });
  });

  describe("spawnFollowUp", () => {
    it("should spawn a follow-up session", async () => {
      const sessionId = "new-session";
      const existingSessionId = "existing-session";
      const env = createMockEnv();

      const result = await service.spawnFollowUp(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Follow-up prompt",
        existingSessionId,
        env
      );

      expect(result.child).toBe(mockChild);
      expect(mockExecutor.spawnFollowUp).toHaveBeenCalledWith(
        "/workspace",
        "Follow-up prompt",
        existingSessionId,
        undefined,
        env
      );
    });

    it("should track the follow-up process", async () => {
      const sessionId = "new-session";
      const env = createMockEnv();

      await service.spawnFollowUp(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Follow-up prompt",
        "existing-session",
        env
      );

      const state = service.getProcess(sessionId);
      expect(state).toBeDefined();
      expect(state?.sessionId).toBe(sessionId);
      expect(state?.status).toBe("running");
    });

    it("should emit agent_spawned event for follow-up", async () => {
      const listener = vi.fn();
      eventService.subscribe(listener);

      const sessionId = "new-session";
      const env = createMockEnv();

      await service.spawnFollowUp(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Follow-up",
        "existing",
        env
      );

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent_spawned",
          data: { agentId: "claude_code", sessionId },
        })
      );
    });
  });

  describe("stdout streaming and JSON parsing", () => {
    it("should process JSON output from stdout", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      const listener = vi.fn();
      eventService.subscribe(listener);

      // Simulate JSON output from the process
      const jsonLine = JSON.stringify({ type: "text", content: "Hello from agent" });
      mockChild.stdout!.emit("data", Buffer.from(jsonLine + "\n"));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "session_message",
          data: expect.objectContaining({
            sessionId,
            content: "Hello from agent",
            role: "assistant",
          }),
        })
      );
    });

    it("should handle non-JSON output as plain log", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      const listener = vi.fn();
      eventService.subscribe(listener);

      // Simulate non-JSON output
      mockChild.stdout!.emit("data", Buffer.from("Plain text output\n"));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "execution_log",
          data: expect.objectContaining({
            sessionId,
            logType: "output",
            content: "Plain text output",
          }),
        })
      );
    });

    it("should handle buffered partial JSON lines", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      const listener = vi.fn();
      eventService.subscribe(listener);

      // Send partial line first
      const fullJson = JSON.stringify({ type: "text", content: "Split message" });
      const part1 = fullJson.slice(0, 10);
      const part2 = fullJson.slice(10) + "\n";

      mockChild.stdout!.emit("data", Buffer.from(part1));
      mockChild.stdout!.emit("data", Buffer.from(part2));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "session_message",
          data: expect.objectContaining({
            content: "Split message",
          }),
        })
      );
    });

    it("should process remaining buffer on stdout end", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      const listener = vi.fn();
      eventService.subscribe(listener);

      // Send line without trailing newline
      const jsonLine = JSON.stringify({ type: "text", content: "Final message" });
      mockChild.stdout!.emit("data", Buffer.from(jsonLine));
      mockChild.stdout!.emit("end");

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "session_message",
          data: expect.objectContaining({
            content: "Final message",
          }),
        })
      );
    });

    it("should handle tool_use message type", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      const listener = vi.fn();
      eventService.subscribe(listener);

      const toolUse = {
        type: "tool_use",
        id: "tool-123",
        name: "read_file",
        input: { path: "/test.txt" },
      };
      mockChild.stdout!.emit("data", Buffer.from(JSON.stringify(toolUse) + "\n"));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "execution_log",
          data: expect.objectContaining({
            sessionId,
            logType: "tool_use",
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

    it("should handle tool_result message type", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      const listener = vi.fn();
      eventService.subscribe(listener);

      const toolResult = {
        type: "tool_result",
        tool_use_id: "tool-123",
        content: "File content here",
        is_error: false,
      };
      mockChild.stdout!.emit("data", Buffer.from(JSON.stringify(toolResult) + "\n"));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "execution_log",
          data: expect.objectContaining({
            sessionId,
            logType: "tool_result",
          }),
        })
      );
    });

    it("should handle result message type", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      const listener = vi.fn();
      eventService.subscribe(listener);

      const result = {
        type: "result",
        result: "Task completed successfully",
      };
      mockChild.stdout!.emit("data", Buffer.from(JSON.stringify(result) + "\n"));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "session_message",
          data: expect.objectContaining({
            content: "Task completed successfully",
          }),
        })
      );
    });

    it("should handle error message type", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      const listener = vi.fn();
      eventService.subscribe(listener);

      const error = {
        type: "error",
        message: "Something went wrong",
      };
      mockChild.stdout!.emit("data", Buffer.from(JSON.stringify(error) + "\n"));

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
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      const listener = vi.fn();
      eventService.subscribe(listener);

      const assistantMsg = {
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "Here is my response" },
            { type: "tool_use", id: "tool-1", name: "bash", input: { command: "ls" } },
          ],
        },
      };
      mockChild.stdout!.emit("data", Buffer.from(JSON.stringify(assistantMsg) + "\n"));

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
            logType: "tool_use",
          }),
        })
      );
    });
  });

  describe("process exit handling", () => {
    it("should mark process as completed on successful exit", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      // Simulate process exit with code 0
      mockChild.emit("exit", 0);

      const state = service.getProcess(sessionId);
      expect(state?.status).toBe("completed");
    });

    it("should mark process as failed on non-zero exit", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      // Simulate process exit with code 1
      mockChild.emit("exit", 1);

      const state = service.getProcess(sessionId);
      expect(state?.status).toBe("failed");
    });

    it("should emit agent_completed event on exit", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      const listener = vi.fn();
      eventService.subscribe(listener);

      mockChild.emit("exit", 0);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent_completed",
          data: expect.objectContaining({
            sessionId,
            success: true,
          }),
        })
      );
    });
  });

  describe("no stdout handling", () => {
    it("should handle child process without stdout", async () => {
      const childWithoutStdout = createMockChildProcess();
      (childWithoutStdout as unknown as { stdout: null }).stdout = null;

      const executorWithNoStdout = createMockExecutor(childWithoutStdout);

      const listener = vi.fn();
      eventService.subscribe(listener);

      const env = createMockEnv();
      await service.spawnAgent(
        "session-123",
        executorWithNoStdout,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      // Should emit agent_completed immediately when no stdout
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent_completed",
          data: expect.objectContaining({
            sessionId: "session-123",
            success: true,
          }),
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
      const env = createMockEnv();

      // Should not throw
      const result = await serviceWithFailingStore.spawnAgent(
        "session-123",
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      expect(result.child).toBe(mockChild);
    });
  });

  describe("agent message storage", () => {
    it("should save raw agent messages to session store", async () => {
      const env = createMockEnv();
      const sessionId = "session-123";

      await service.spawnAgent(
        sessionId,
        mockExecutor,
        "my-agent",
        "claude_code",
        "/workspace",
        "Hello",
        env
      );

      const jsonOutput = { type: "text", content: "Agent response" };
      mockChild.stdout!.emit("data", Buffer.from(JSON.stringify(jsonOutput) + "\n"));

      expect(sessionStore.appendAgentMessage).toHaveBeenCalledWith(
        "my-agent",
        sessionId,
        expect.objectContaining({
          raw: jsonOutput,
          source: "claude_code",
        })
      );
    });
  });
});
