/**
 * Container Service Integration Tests
 *
 * Tests real process spawning and output streaming without mocking.
 * Uses temporary directories for session storage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spawn } from "node:child_process";
import { ContainerService } from "./container";
import { EventService } from "./events";
import { SessionStoreService } from "./session-store";
import type { StandardCodingAgentExecutor, SpawnedChild, ExecutionEnv, ExecutorExitResult } from "../executors/types";
import type { ExecutorType } from "../types";
import { createTempDir, type TempDirContext } from "../test/helpers/temp-dir";

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

// =============================================================================
// Integration Tests - Real Process Spawning
// =============================================================================

describe("ContainerService integration: real process spawning", () => {
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

  /**
   * Create a real executor that spawns actual processes
   */
  function createRealExecutor(command: string, args: string[]): StandardCodingAgentExecutor {
    return {
      type: "CLAUDE_CODE" as ExecutorType, // Use a valid ExecutorType for testing
      spawn: async (_workdir: string, _prompt: string, _env: ExecutionEnv): Promise<SpawnedChild> => {
        const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });

        const exitPromise = new Promise<ExecutorExitResult>((resolve, reject) => {
          child.on("exit", (code) => {
            if (code === 0) {
              resolve("success");
            } else {
              reject(new Error(`Process exited with code ${code}`));
            }
          });
          child.on("error", (err) => reject(err));
        });

        return {
          child,
          exitPromise,
          cancel: () => {
            child.kill("SIGTERM");
          },
        };
      },
      spawnFollowUp: async () => {
        throw new Error("Not implemented");
      },
      defaultMcpConfigPath: () => null,
      getAvailabilityInfo: () => ({ status: "INSTALLATION_FOUND" }),
      capabilities: () => [],
    };
  }

  it("should spawn and capture output from echo command", async () => {
    const sessionId = "integration-test-echo";
    const executor = createRealExecutor("echo", ["hello world"]);
    const env = createMockEnv();

    const listener = vi.fn();
    eventService.subscribe(listener);

    const { child, exitPromise } = await service.spawnAgent(
      sessionId,
      executor,
      "test-agent",
      "test_executor",
      tempDir.root,
      "test prompt",
      env
    );

    // Verify process was spawned
    expect(child.pid).toBeDefined();
    expect(service.getProcess(sessionId)?.status).toBe("running");

    // Wait for process to complete
    await exitPromise;

    // Verify agent_spawned event was emitted
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent_spawned",
        data: { agent_id: "test_executor", session_id: sessionId },
      })
    );

    // Verify execution_log was emitted (echo outputs plain text, not JSON)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "execution_log",
        data: expect.objectContaining({
          session_id: sessionId,
          log_type: "output",
          content: "hello world",
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
  });

  it("should capture JSON output from process", async () => {
    const sessionId = "integration-test-json";
    // Use echo to output a JSON line
    const jsonOutput = JSON.stringify({ type: "text", content: "Hello from JSON" });
    const executor = createRealExecutor("echo", [jsonOutput]);
    const env = createMockEnv();

    const listener = vi.fn();
    eventService.subscribe(listener);

    const { exitPromise } = await service.spawnAgent(
      sessionId,
      executor,
      "test-agent",
      "test_executor",
      tempDir.root,
      "test prompt",
      env
    );

    await exitPromise;

    // Verify session_message was emitted for JSON text output
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session_message",
        data: expect.objectContaining({
          session_id: sessionId,
          content: "Hello from JSON",
          role: "assistant",
        }),
      })
    );
  });

  it("should handle process that exits with non-zero code", async () => {
    const sessionId = "integration-test-fail";
    // Use false command which always exits with code 1
    const executor = createRealExecutor("false", []);
    const env = createMockEnv();

    const listener = vi.fn();
    eventService.subscribe(listener);

    const { exitPromise } = await service.spawnAgent(
      sessionId,
      executor,
      "test-agent",
      "test_executor",
      tempDir.root,
      "test prompt",
      env
    );

    // Wait for process to complete (will reject)
    await exitPromise?.catch(() => {});

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

  it("should handle multi-line output", async () => {
    const sessionId = "integration-test-multiline";
    // Use printf to output multiple lines
    const executor = createRealExecutor("printf", ["line1\\nline2\\nline3"]);
    const env = createMockEnv();

    const listener = vi.fn();
    eventService.subscribe(listener);

    const { exitPromise } = await service.spawnAgent(
      sessionId,
      executor,
      "test-agent",
      "test_executor",
      tempDir.root,
      "test prompt",
      env
    );

    await exitPromise;

    // Verify all lines were captured as execution logs
    const executionLogs = listener.mock.calls
      .filter((call) => call[0].type === "execution_log")
      .map((call) => call[0].data.content);

    expect(executionLogs).toContain("line1");
    expect(executionLogs).toContain("line2");
    expect(executionLogs).toContain("line3");
  });

  it("should track multiple concurrent processes", async () => {
    const executor1 = createRealExecutor("sleep", ["0.1"]);
    const executor2 = createRealExecutor("sleep", ["0.1"]);
    const env = createMockEnv();

    const { exitPromise: exit1 } = await service.spawnAgent(
      "session-1",
      executor1,
      "agent-1",
      "test_executor",
      tempDir.root,
      "prompt 1",
      env
    );

    const { exitPromise: exit2 } = await service.spawnAgent(
      "session-2",
      executor2,
      "agent-2",
      "test_executor",
      tempDir.root,
      "prompt 2",
      env
    );

    // Both processes should be running
    expect(service.runningProcesses()).toHaveLength(2);

    // Wait for both to complete
    await Promise.all([exit1, exit2]);

    // Both should be completed now
    expect(service.runningProcesses()).toHaveLength(0);
    expect(service.getProcess("session-1")?.status).toBe("completed");
    expect(service.getProcess("session-2")?.status).toBe("completed");
  });
});
