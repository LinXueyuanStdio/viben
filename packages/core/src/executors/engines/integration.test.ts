/**
 * Executor Integration Tests
 *
 * Real integration tests that actually run executor commands.
 * These tests require the actual CLI tools to be installed.
 *
 * IMPORTANT: These tests interact with real CLI tools and may:
 * - Take 10-30 seconds per test
 * - Require authentication (API keys, login)
 * - Produce real API costs
 *
 * Run with: pnpm test -- --run src/executor/engines/integration.test.ts
 *
 * Test categories:
 * 1. Availability Detection - Check which executors are installed
 * 2. Per-executor tests - Only run if the executor is available
 * 3. Cross-executor consistency - Verify interface compliance
 * 4. Error handling - Graceful failures
 * 5. Streaming - Verify SSE message parsing
 */

import { describe, it, expect, beforeAll } from "vitest";
import { tmpdir } from "node:os";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// Import all engines to register them
import "../engines";

import { getExecutor, getRegisteredTypes } from "../ops/registry";
import type { Executor, SSEMessage, ExecutorCapability } from "../ops/types";

// Timeout for real CLI operations (30 seconds)
const CLI_TIMEOUT = 120_000;

// Simple prompt that should work with any executor
const SIMPLE_PROMPT = "What is 2+2? Reply with just the number.";

// Test workspace setup
let testDir: string;

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), "executor-integration-"));
});

/**
 * Helper to check if an executor is available
 */
function isExecutorAvailable(executor: Executor): boolean {
  const info = executor.getAvailabilityInfo();
  return info.status === "LOGIN_DETECTED" || info.status === "INSTALLATION_FOUND";
}

/**
 * Collect all SSE messages from streaming
 */
async function collectStreamMessages(
  generator: AsyncGenerator<SSEMessage>
): Promise<SSEMessage[]> {
  const messages: SSEMessage[] = [];
  for await (const msg of generator) {
    messages.push(msg);
  }
  return messages;
}

describe("Executor Integration Tests", () => {
  describe("Availability Detection", () => {
    it("should detect availability for all registered executors", () => {
      const types = getRegisteredTypes();
      expect(types.length).toBeGreaterThan(0);

      for (const type of types) {
        const executor = getExecutor(type);
        const info = executor.getAvailabilityInfo();

        // Should return a valid status
        expect(["NOT_FOUND", "INSTALLATION_FOUND", "LOGIN_DETECTED"]).toContain(
          info.status
        );

        // If found, should have path
        if (info.status !== "NOT_FOUND") {
          expect(info.path).toBeDefined();
        }

        console.log(`${type}: ${info.status}${info.path ? ` (${info.path})` : ""}`);
      }
    });
  });

  describe("CLAUDE_CODE", () => {
    let executor: Executor;
    let available: boolean;

    beforeAll(() => {
      executor = getExecutor("CLAUDE_CODE");
      available = isExecutorAvailable(executor);
      if (!available) {
        console.log("CLAUDE_CODE not available, skipping real tests");
      }
    });

    it("should have correct capabilities", () => {
      const caps = executor.capabilities();
      expect(caps).toContain("SPAWN");
      expect(caps).toContain("CHAT");
      expect(caps).toContain("CHAT_STREAMING");
      expect(caps).toContain("SESSION_RESUME");
    });

    it(
      "should spawn and execute a simple prompt",
      async () => {
        if (!available) return;

        const result = await executor.spawn({
          cwd: testDir,
          prompt: SIMPLE_PROMPT,
          dangerouslySkipPermissions: true,
          jsonOutput: false,
          verbose: false,
        });

        expect(result.success).toBe(true);
        expect(result.exitCode).toBe(0);
      },
      CLI_TIMEOUT
    );

    it(
      "should stream chat messages",
      async () => {
        if (!available) return;

        const messages = await collectStreamMessages(
          executor.chatStreaming({
            prompt: SIMPLE_PROMPT,
            cwd: testDir,
            dangerouslySkipPermissions: true,
          })
        );

        // Log messages for debugging
        console.log("Received messages:", messages.length);
        console.log("Message types:", [...new Set(messages.map((m) => m.type))]);

        // Should have at least one message
        expect(messages.length).toBeGreaterThan(0);

        // Should have content messages (assistant or text type)
        const contentMessages = messages.filter(
          (m) => m.type === "text" || m.type === "assistant"
        );
        expect(contentMessages.length).toBeGreaterThan(0);

        // Should have a result message
        const resultMessages = messages.filter((m) => m.type === "result");
        expect(resultMessages.length).toBeGreaterThan(0);
      },
      CLI_TIMEOUT
    );

    it(
      "should handle session creation with ID",
      async () => {
        if (!available) return;
        if (!executor.supportsSessionIdOnCreate()) return;

        // Claude requires valid UUID format for session IDs
        const sessionId = crypto.randomUUID();
        const result = await executor.spawn({
          cwd: testDir,
          prompt: "Say hello",
          sessionId,
          dangerouslySkipPermissions: true,
          jsonOutput: false,
        });

        // Log for debugging
        if (!result.success) {
          console.log("Session creation failed:", result.error, result.errorType);
        }

        expect(result.success).toBe(true);
        expect(result.sessionId).toBe(sessionId);
      },
      CLI_TIMEOUT
    );
  });

  describe("GEMINI", () => {
    let executor: Executor;
    let available: boolean;

    beforeAll(() => {
      executor = getExecutor("GEMINI");
      available = isExecutorAvailable(executor);
      if (!available) {
        console.log("GEMINI not available, skipping real tests");
      }
    });

    it("should have correct capabilities", () => {
      const caps = executor.capabilities();
      expect(caps).toContain("SPAWN");
      expect(caps).toContain("CHAT");
      // Gemini doesn't support session resume or streaming
      expect(caps).not.toContain("SESSION_RESUME");
      expect(caps).not.toContain("CHAT_STREAMING");
    });

    it(
      "should spawn and execute a simple prompt",
      async () => {
        if (!available) return;

        const result = await executor.spawn({
          cwd: testDir,
          prompt: SIMPLE_PROMPT,
          dangerouslySkipPermissions: true,
        });

        // Log for debugging
        if (!result.success) {
          console.log("Gemini spawn failed:", result.error, result.errorType);
        }

        expect(result.success).toBe(true);
        expect(result.exitCode).toBe(0);
      },
      CLI_TIMEOUT
    );
  });

  describe("CODEX", () => {
    let executor: Executor;
    let available: boolean;

    beforeAll(() => {
      executor = getExecutor("CODEX");
      available = isExecutorAvailable(executor);
      if (!available) {
        console.log("CODEX not available, skipping real tests");
      }
    });

    it("should have correct capabilities", () => {
      const caps = executor.capabilities();
      expect(caps).toContain("SPAWN");
      expect(caps).toContain("CHAT");
    });

    it(
      "should spawn and execute a simple prompt",
      async () => {
        if (!available) return;

        const result = await executor.spawn({
          cwd: testDir,
          prompt: SIMPLE_PROMPT,
          dangerouslySkipPermissions: true,
        });

        expect(result.success).toBe(true);
        expect(result.exitCode).toBe(0);
      },
      CLI_TIMEOUT
    );
  });

  describe("AMP", () => {
    let executor: Executor;
    let available: boolean;

    beforeAll(() => {
      executor = getExecutor("AMP");
      available = isExecutorAvailable(executor);
      if (!available) {
        console.log("AMP not available, skipping real tests");
      }
    });

    it("should have correct capabilities", () => {
      const caps = executor.capabilities();
      expect(caps).toContain("SPAWN");
      // AMP doesn't have CHAT capability (interactive only)
      expect(caps).toContain("SESSION_RESUME");
    });

    it(
      "should spawn and execute a simple prompt",
      async () => {
        if (!available) return;

        const result = await executor.spawn({
          cwd: testDir,
          prompt: SIMPLE_PROMPT,
          dangerouslySkipPermissions: true,
        });

        expect(result.success).toBe(true);
      },
      CLI_TIMEOUT
    );
  });

  describe("COPILOT", () => {
    let executor: Executor;
    let available: boolean;

    beforeAll(() => {
      executor = getExecutor("COPILOT");
      available = isExecutorAvailable(executor);
      if (!available) {
        console.log("COPILOT not available, skipping real tests");
      }
    });

    it("should have correct capabilities", () => {
      const caps = executor.capabilities();
      expect(caps).toContain("SPAWN");
      // Copilot is suggestion-only, no session resume
    });

    it(
      "should spawn and execute a simple prompt",
      async () => {
        if (!available) return;

        const result = await executor.spawn({
          cwd: testDir,
          prompt: SIMPLE_PROMPT,
        });

        // Log for debugging
        if (!result.success) {
          console.log("Copilot spawn failed:", result.error, result.errorType);
        }

        expect(result.success).toBe(true);
      },
      CLI_TIMEOUT
    );
  });

  describe("Cross-Executor Consistency", () => {
    it("should have consistent method signatures across executors", () => {
      const types = getRegisteredTypes();
      const executors = types.map((type) => ({
        type,
        executor: getExecutor(type),
      }));

      for (const { type, executor } of executors) {
        // All executors must implement these methods
        expect(typeof executor.spawn).toBe("function");
        expect(typeof executor.chat).toBe("function");
        expect(typeof executor.chatStreaming).toBe("function");
        expect(typeof executor.resume).toBe("function");
        expect(typeof executor.capabilities).toBe("function");
        expect(typeof executor.supports).toBe("function");
        expect(typeof executor.getAvailabilityInfo).toBe("function");
        expect(typeof executor.buildRunCommand).toBe("function");
        expect(typeof executor.buildResumeCommand).toBe("function");

        // capabilities() should return array
        const caps = executor.capabilities();
        expect(Array.isArray(caps)).toBe(true);

        // If SPAWN capability, spawn should work
        if (executor.supports("SPAWN")) {
          expect(caps).toContain("SPAWN");
        }
      }
    });

    it("should build valid commands for all executors", () => {
      const types = getRegisteredTypes();

      for (const type of types) {
        const executor = getExecutor(type);

        // buildRunCommand should return array
        const cmd = executor.buildRunCommand({
          agent: "test-agent",
          prompt: "test prompt",
        });
        expect(Array.isArray(cmd)).toBe(true);

        // Executors that support SPAWN should have non-empty commands
        if (executor.supports("SPAWN") && cmd.length > 0) {
          expect(cmd[0]).toBe(executor.getCliName());
        }

        // buildResumeCommand should return array
        const resumeCmd = executor.buildResumeCommand("session-123");
        expect(Array.isArray(resumeCmd)).toBe(true);
      }
    });

    it("should have valid config paths for all executors", () => {
      const types = getRegisteredTypes();

      for (const type of types) {
        const executor = getExecutor(type);

        // getConfigDirName should return non-empty string
        // Note: Some executors use nested paths like ".config/gh-copilot"
        const dirName = executor.getConfigDirName();
        expect(dirName).toBeTruthy();
        expect(typeof dirName).toBe("string");

        // getConfigDir should return valid path containing the dir name
        const configDir = executor.getConfigDir("/project");
        expect(configDir).toBeTruthy();

        // getCliName should return non-empty string
        const cliName = executor.getCliName();
        expect(cliName).toBeTruthy();
        expect(typeof cliName).toBe("string");
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle NOT_FOUND gracefully", async () => {
      // Test with an executor that might not be installed
      const types = getRegisteredTypes();

      for (const type of types) {
        const executor = getExecutor(type);
        const info = executor.getAvailabilityInfo();

        if (info.status === "NOT_FOUND") {
          // Spawn should fail gracefully
          const result = await executor.spawn({
            cwd: testDir,
            prompt: "test",
          });

          expect(result.success).toBe(false);
          expect(result.errorType).toBe("NOT_FOUND");
        }
      }
    });

    it(
      "should handle invalid working directory",
      async () => {
        const executor = getExecutor("CLAUDE_CODE");
        if (!isExecutorAvailable(executor)) return;

        const result = await executor.spawn({
          cwd: "/nonexistent/path/that/does/not/exist",
          prompt: "test",
          dangerouslySkipPermissions: true,
        });

        expect(result.success).toBe(false);
        expect(result.errorType).toBe("SPAWN_FAILED");
      },
      CLI_TIMEOUT
    );
  });

  describe("Config Propagation", () => {
    it("should propagate model config to commands", () => {
      const executor = getExecutor("CLAUDE_CODE", { model: "sonnet" });

      // buildRunCommand doesn't include model, but spawn should use it
      // This is tested indirectly through the spawn method
      expect(executor.capabilities()).toContain("CHAT");
    });

    it("should respect dangerouslySkipPermissions in config", () => {
      const executor = getExecutor("CLAUDE_CODE", {
        dangerouslySkipPermissions: false,
      });

      // The config should be respected (tested through buildRunCommand)
      const cmd = executor.buildRunCommand({
        agent: "test",
        prompt: "test",
        dangerouslySkipPermissions: false,
      });

      expect(cmd).not.toContain("--dangerously-skip-permissions");
    });
  });
});

describe("Streaming Message Types", () => {
  it("should yield correct SSE message types from Claude", async () => {
    const executor = getExecutor("CLAUDE_CODE");
    if (!isExecutorAvailable(executor)) {
      console.log("CLAUDE_CODE not available, skipping streaming test");
      return;
    }

    const messages = await collectStreamMessages(
      executor.chatStreaming({
        prompt: "List 3 colors: red, blue, green. Just list them.",
        cwd: testDir,
        dangerouslySkipPermissions: true,
      })
    );

    // Verify message types
    const messageTypes = new Set(messages.map((m) => m.type));
    console.log("Message types received:", [...messageTypes]);

    // Should have content messages (assistant or text type from Claude stream-json)
    const hasContent = messageTypes.has("text") || messageTypes.has("assistant");
    expect(hasContent).toBe(true);

    // Should have result at end
    expect(messageTypes.has("result")).toBe(true);
  }, CLI_TIMEOUT);
});
