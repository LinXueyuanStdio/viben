/**
 * Container Service Integration Tests
 *
 * Tests real SSE message streaming and session store persistence
 * using mock executors that yield pre-defined SSE message sequences.
 * Uses temporary directories for session storage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ContainerService } from "./container";
import { EventService } from "./events";
import { SessionStoreService } from "./session-store";
import type { Executor, SSEMessage, ChatOptions, ExecutorCapability } from "../executors/ops/types";
import { createTempDir, type TempDirContext } from "../test/helpers/temp-dir";

/**
 * Wait for background stream processing to complete.
 */
async function waitForStreamProcessing(ms = 100): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Create a mock executor that yields the given SSE messages from chatStreaming.
 * Optionally adds a delay between messages to simulate real streaming.
 */
function createStreamingExecutor(
  messages: SSEMessage[],
  delayMs = 0
): Executor {
  const chatStreamingMock = vi.fn(async function* (_options: ChatOptions): AsyncGenerator<SSEMessage> {
    for (const msg of messages) {
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
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
 * Create a failing executor whose chatStreaming throws after yielding some messages.
 */
function createFailingStreamingExecutor(
  messagesBeforeFailure: SSEMessage[] = [],
  error: Error = new Error("Stream crashed")
): Executor {
  const chatStreamingMock = vi.fn(async function* (_options: ChatOptions): AsyncGenerator<SSEMessage> {
    for (const msg of messagesBeforeFailure) {
      yield msg;
    }
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

// =============================================================================
// Integration Tests - SSE Message Streaming with Real Session Store
// =============================================================================

describe("ContainerService integration: SSE streaming with session store", () => {
  let service: ContainerService;
  let eventService: EventService;
  let tempDir: TempDirContext;

  beforeEach(async () => {
    eventService = new EventService();
    tempDir = await createTempDir("container-test-");
    // Use real SessionStoreService with temp directory
    const sessionStore = new SessionStoreService(tempDir.root);
    service = new ContainerService(eventService, sessionStore);
  });

  afterEach(async () => {
    service.killAllRunningProcesses();
    await tempDir.cleanup();
  });

  it("should stream text messages and emit session_message events", async () => {
    const sessionId = "integration-test-text";
    const executor = createStreamingExecutor([
      { type: "text", content: "Hello from agent" } as SSEMessage,
      { type: "text", content: "More content" } as SSEMessage,
    ]);

    const listener = vi.fn();
    eventService.subscribe(listener);

    await service.spawnAgent(
      sessionId,
      executor,
      "test-agent",
      "test_executor",
      tempDir.root,
      "test prompt",
      {}
    );

    await waitForStreamProcessing();

    // Verify agent_spawned event was emitted
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent_spawned",
        data: { agent_id: "test_executor", session_id: sessionId },
      })
    );

    // Verify session_message events for text content
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

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session_message",
        data: expect.objectContaining({
          session_id: sessionId,
          content: "More content",
          role: "assistant",
        }),
      })
    );

    // Verify agent_completed event was emitted
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent_completed",
        data: expect.objectContaining({
          session_id: sessionId,
          success: true,
        }),
      })
    );

    // Verify final process status
    expect(service.getProcess(sessionId)?.status).toBe("completed");
  });

  it("should stream tool_use and tool_result messages", async () => {
    const sessionId = "integration-test-tools";
    const executor = createStreamingExecutor([
      { type: "text", content: "Let me check that file" } as SSEMessage,
      {
        type: "tool_use",
        id: "tool-1",
        name: "read_file",
        input: { path: "/test.txt" },
      } as SSEMessage,
      {
        type: "tool_result",
        tool_use_id: "tool-1",
        output: "File contents here",
        is_error: false,
      } as SSEMessage,
      { type: "text", content: "The file contains the expected data" } as SSEMessage,
    ]);

    const listener = vi.fn();
    eventService.subscribe(listener);

    await service.spawnAgent(
      sessionId,
      executor,
      "test-agent",
      "test_executor",
      tempDir.root,
      "Read the test file",
      {}
    );

    await waitForStreamProcessing();

    // Verify text message
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session_message",
        data: expect.objectContaining({
          content: "Let me check that file",
        }),
      })
    );

    // Verify tool_use execution log
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "execution_log",
        data: expect.objectContaining({
          session_id: sessionId,
          log_type: "tool_use",
        }),
      })
    );

    // Verify tool_result execution log
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "execution_log",
        data: expect.objectContaining({
          session_id: sessionId,
          log_type: "tool_result",
        }),
      })
    );

    // Verify second text message
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session_message",
        data: expect.objectContaining({
          content: "The file contains the expected data",
        }),
      })
    );

    expect(service.getProcess(sessionId)?.status).toBe("completed");
  });

  it("should handle stream failure and mark process as failed", async () => {
    const sessionId = "integration-test-fail";
    const executor = createFailingStreamingExecutor(
      [{ type: "text", content: "Starting..." } as SSEMessage],
      new Error("Connection lost")
    );

    const listener = vi.fn();
    eventService.subscribe(listener);

    await service.spawnAgent(
      sessionId,
      executor,
      "test-agent",
      "test_executor",
      tempDir.root,
      "test prompt",
      {}
    );

    await waitForStreamProcessing();

    // Verify process status is failed
    expect(service.getProcess(sessionId)?.status).toBe("failed");

    // Verify agent_completed with success=false was emitted
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

  it("should handle multi-message streaming with delay", async () => {
    const sessionId = "integration-test-delayed";
    const messages: SSEMessage[] = [
      { type: "text", content: "Message 1" } as SSEMessage,
      { type: "text", content: "Message 2" } as SSEMessage,
      { type: "text", content: "Message 3" } as SSEMessage,
    ];
    const executor = createStreamingExecutor(messages, 10); // 10ms delay between messages

    const listener = vi.fn();
    eventService.subscribe(listener);

    await service.spawnAgent(
      sessionId,
      executor,
      "test-agent",
      "test_executor",
      tempDir.root,
      "test prompt",
      {}
    );

    // Wait longer for delayed messages
    await waitForStreamProcessing(200);

    // Verify all messages were captured
    const sessionMessages = listener.mock.calls
      .filter((call) => call[0].type === "session_message")
      .map((call) => call[0].data.content);

    expect(sessionMessages).toContain("Message 1");
    expect(sessionMessages).toContain("Message 2");
    expect(sessionMessages).toContain("Message 3");

    expect(service.getProcess(sessionId)?.status).toBe("completed");
  });

  it("should track multiple concurrent processes", async () => {
    // Use blocking executors that wait for signals
    let resolve1: () => void;
    let resolve2: () => void;
    const blocker1 = new Promise<void>((r) => { resolve1 = r; });
    const blocker2 = new Promise<void>((r) => { resolve2 = r; });

    const executor1 = createStreamingExecutor([]);
    (executor1.chatStreaming as ReturnType<typeof vi.fn>).mockImplementation(
      async function* () {
        yield { type: "text", content: "Agent 1 working" } as SSEMessage;
        await blocker1;
        yield { type: "text", content: "Agent 1 done" } as SSEMessage;
      }
    );

    const executor2 = createStreamingExecutor([]);
    (executor2.chatStreaming as ReturnType<typeof vi.fn>).mockImplementation(
      async function* () {
        yield { type: "text", content: "Agent 2 working" } as SSEMessage;
        await blocker2;
        yield { type: "text", content: "Agent 2 done" } as SSEMessage;
      }
    );

    await service.spawnAgent(
      "session-1",
      executor1,
      "agent-1",
      "test_executor",
      tempDir.root,
      "prompt 1",
      {}
    );

    await service.spawnAgent(
      "session-2",
      executor2,
      "agent-2",
      "test_executor",
      tempDir.root,
      "prompt 2",
      {}
    );

    // Allow initial yields to process
    await waitForStreamProcessing(50);

    // Both processes should be running (blocked on promises)
    expect(service.runningProcesses()).toHaveLength(2);

    // Unblock both
    resolve1!();
    resolve2!();

    await waitForStreamProcessing(100);

    // Both should be completed now
    expect(service.runningProcesses()).toHaveLength(0);
    expect(service.getProcess("session-1")?.status).toBe("completed");
    expect(service.getProcess("session-2")?.status).toBe("completed");
  });

  it("should handle assistant message with mixed content types", async () => {
    const sessionId = "integration-test-assistant";
    const assistantMsg: SSEMessage = {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "I will run a command" },
          { type: "tool_use", id: "tool-1", name: "bash", input: { command: "echo hello" } },
        ],
      },
    };

    const executor = createStreamingExecutor([assistantMsg]);

    const listener = vi.fn();
    eventService.subscribe(listener);

    await service.spawnAgent(
      sessionId,
      executor,
      "test-agent",
      "test_executor",
      tempDir.root,
      "run a command",
      {}
    );

    await waitForStreamProcessing();

    // Verify text part of assistant message
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session_message",
        data: expect.objectContaining({
          session_id: sessionId,
          content: "I will run a command",
        }),
      })
    );

    // Verify tool_use part of assistant message
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "execution_log",
        data: expect.objectContaining({
          session_id: sessionId,
          log_type: "tool_use",
        }),
      })
    );

    expect(service.getProcess(sessionId)?.status).toBe("completed");
  });

  it("should handle result message type", async () => {
    const sessionId = "integration-test-result";
    const executor = createStreamingExecutor([
      { type: "text", content: "Working on it..." } as SSEMessage,
      { type: "result", result: "Task completed successfully" } as SSEMessage,
    ]);

    const listener = vi.fn();
    eventService.subscribe(listener);

    await service.spawnAgent(
      sessionId,
      executor,
      "test-agent",
      "test_executor",
      tempDir.root,
      "complete the task",
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

    expect(service.getProcess(sessionId)?.status).toBe("completed");
  });

  it("should handle error message type", async () => {
    const sessionId = "integration-test-error";
    const executor = createStreamingExecutor([
      { type: "error", message: "Something went wrong" } as SSEMessage,
    ]);

    const listener = vi.fn();
    eventService.subscribe(listener);

    await service.spawnAgent(
      sessionId,
      executor,
      "test-agent",
      "test_executor",
      tempDir.root,
      "test prompt",
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

  it("should handle empty stream (no messages)", async () => {
    const sessionId = "integration-test-empty";
    const executor = createStreamingExecutor([]);

    const listener = vi.fn();
    eventService.subscribe(listener);

    await service.spawnAgent(
      sessionId,
      executor,
      "test-agent",
      "test_executor",
      tempDir.root,
      "test prompt",
      {}
    );

    await waitForStreamProcessing();

    // Should still complete successfully
    expect(service.getProcess(sessionId)?.status).toBe("completed");

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
});
