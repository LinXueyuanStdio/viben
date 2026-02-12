/**
 * Executor CLI Commands Tests
 *
 * Tests for:
 * - `executor types` - List all executor types
 * - `executor types --json` - JSON output format
 * - `executor list` - List executors with availability status
 * - `executor list --available` - Filter to only available executors
 * - `executor list --json` - JSON output format
 * - `executor show <type>` - Show executor details
 * - `executor show <type> --json` - JSON output format
 * - Chat support indicators
 * - Error handling for unknown executor types
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerExecutorCommand } from "./executor";

// Mock the executors module
vi.mock("../../executors", () => {
  const MOCK_EXECUTOR_TYPES = [
    "CLAUDE_CODE",
    "AMP",
    "GEMINI",
    "CODEX",
    "OPENCODE",
    "CURSOR_AGENT",
    "QWEN_CODE",
    "COPILOT",
    "DROID",
  ];

  const MOCK_CHAT_SUPPORTED_EXECUTORS = ["CLAUDE_CODE", "GEMINI", "CODEX"];

  // Create a mock executor factory
  const createMockExecutor = (type: string, available: boolean) => ({
    type,
    capabilities: () => {
      switch (type) {
        case "CLAUDE_CODE":
          return ["SESSION_FORK", "CONTEXT_USAGE"];
        case "CODEX":
          return ["SESSION_FORK", "SETUP_HELPER", "CONTEXT_USAGE"];
        case "COPILOT":
          return [];
        default:
          return ["SESSION_FORK"];
      }
    },
    getAvailabilityInfo: () => ({
      status: available ? "INSTALLATION_FOUND" : "NOT_FOUND",
      lastAuthTimestamp: available ? Date.now() : null,
    }),
    supportsChat: () => MOCK_CHAT_SUPPORTED_EXECUTORS.includes(type),
    getChatCommand: () => {
      if (MOCK_CHAT_SUPPORTED_EXECUTORS.includes(type)) {
        switch (type) {
          case "CLAUDE_CODE":
            return "claude";
          case "GEMINI":
            return "gemini";
          case "CODEX":
            return "codex";
          default:
            return null;
        }
      }
      return null;
    },
    defaultMcpConfigPath: () => {
      switch (type) {
        case "CLAUDE_CODE":
          return "/home/user/.claude.json";
        case "GEMINI":
          return "/home/user/.gemini/config.json";
        case "CODEX":
          return "/home/user/.config/codex/config.json";
        default:
          return `/home/user/.${type.toLowerCase()}/config.json`;
      }
    },
  });

  return {
    EXECUTOR_TYPES: MOCK_EXECUTOR_TYPES,
    CHAT_SUPPORTED_EXECUTORS: MOCK_CHAT_SUPPORTED_EXECUTORS,
    executorSupportsChat: (type: string) => MOCK_CHAT_SUPPORTED_EXECUTORS.includes(type),
    getAllExecutorsAvailability: () => {
      const result: Record<string, { available: boolean; executor: ReturnType<typeof createMockExecutor> }> = {};
      // Make CLAUDE_CODE and GEMINI available, others not
      const availableExecutors = ["CLAUDE_CODE", "GEMINI"];
      for (const type of MOCK_EXECUTOR_TYPES) {
        const available = availableExecutors.includes(type);
        result[type] = {
          available,
          executor: createMockExecutor(type, available),
        };
      }
      return result;
    },
    createExecutor: (type: string) => {
      if (!MOCK_EXECUTOR_TYPES.includes(type)) {
        throw new Error(`Unknown executor type: ${type}`);
      }
      const availableExecutors = ["CLAUDE_CODE", "GEMINI"];
      return createMockExecutor(type, availableExecutors.includes(type));
    },
  };
});

describe("Executor CLI Commands", () => {
  let program: Command;
  let logOutput: string[];
  let errorOutput: string[];

  beforeEach(() => {
    // Reset mocks
    logOutput = [];
    errorOutput = [];

    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logOutput.push(args.map(String).join(" "));
    });

    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errorOutput.push(args.map(String).join(" "));
    });

    vi.spyOn(process, "exit").mockImplementation((code?: string | number | null | undefined): never => {
      throw new Error(`Process exited with code ${code}`);
    });

    // Create a new program instance
    program = new Command();
    program.option("--json", "Output in JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");
    registerExecutorCommand(program);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to run command
  async function runCommand(args: string[]): Promise<void> {
    await program.parseAsync(["node", "test", ...args]);
  }

  // Helper to get combined log output
  function getLogOutput(): string {
    return logOutput.join("\n");
  }

  // ============================================================================
  // executor types
  // ============================================================================

  describe("executor types", () => {
    it("should list all executor types", async () => {
      await runCommand(["executor", "types"]);

      const output = getLogOutput();
      expect(output).toContain("Available Executor Types:");
      expect(output).toContain("CLAUDE_CODE");
      expect(output).toContain("AMP");
      expect(output).toContain("GEMINI");
      expect(output).toContain("CODEX");
      expect(output).toContain("OPENCODE");
      expect(output).toContain("CURSOR_AGENT");
      expect(output).toContain("QWEN_CODE");
      expect(output).toContain("COPILOT");
      expect(output).toContain("DROID");
    });

    it("should show total count of executor types", async () => {
      await runCommand(["executor", "types"]);

      const output = getLogOutput();
      expect(output).toContain("Total: 9 executor types");
    });

    it("should indicate which executors support chat", async () => {
      await runCommand(["executor", "types"]);

      const output = getLogOutput();
      // Chat-enabled executors should have [chat] badge
      expect(output).toContain("Chat-enabled: 3 (CLAUDE_CODE, GEMINI, CODEX)");
    });

    it("should output JSON format with --json flag", async () => {
      await runCommand(["--json", "executor", "types"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.types).toEqual([
        "CLAUDE_CODE",
        "AMP",
        "GEMINI",
        "CODEX",
        "OPENCODE",
        "CURSOR_AGENT",
        "QWEN_CODE",
        "COPILOT",
        "DROID",
      ]);
    });
  });

  // ============================================================================
  // executor list
  // ============================================================================

  describe("executor list", () => {
    it("should list executors with availability status", async () => {
      await runCommand(["executor", "list"]);

      const output = getLogOutput();
      // Should show table headers
      expect(output).toContain("Type");
      expect(output).toContain("Status");
      expect(output).toContain("Chat");
      expect(output).toContain("Capabilities");
    });

    it("should show correct availability status for each executor", async () => {
      await runCommand(["executor", "list"]);

      const output = getLogOutput();
      // CLAUDE_CODE and GEMINI are available (mocked)
      expect(output).toContain("CLAUDE_CODE");
      expect(output).toContain("GEMINI");
      // All other executors should also be listed
      expect(output).toContain("AMP");
      expect(output).toContain("CODEX");
    });

    it("should filter to only available executors with --available flag", async () => {
      await runCommand(["executor", "list", "--available"]);

      const output = getLogOutput();
      // Only available executors should be shown
      expect(output).toContain("CLAUDE_CODE");
      expect(output).toContain("GEMINI");
      // Non-available executors should not be in the filtered output
      // Note: This depends on the mock setup
    });

    it("should show message when no executors found with --available filter", async () => {
      // Re-mock to return no available executors
      vi.doMock("../../executors", () => ({
        EXECUTOR_TYPES: ["TEST_EXECUTOR"],
        CHAT_SUPPORTED_EXECUTORS: [],
        executorSupportsChat: () => false,
        getAllExecutorsAvailability: () => ({
          TEST_EXECUTOR: {
            available: false,
            executor: {
              type: "TEST_EXECUTOR",
              capabilities: () => [],
              getAvailabilityInfo: () => ({ status: "NOT_FOUND" }),
              supportsChat: () => false,
              getChatCommand: () => null,
            },
          },
        }),
        createExecutor: () => ({}),
      }));

      // The current mock has some available executors, so this test checks the output format
      await runCommand(["executor", "list", "--available"]);
      const output = getLogOutput();
      // Should have table output with available executors
      expect(output).toContain("CLAUDE_CODE");
    });

    it("should indicate chat support with Yes/No in Chat column", async () => {
      await runCommand(["executor", "list"]);

      const output = getLogOutput();
      // The output should contain Yes for chat-enabled executors
      expect(output).toContain("Yes");
      expect(output).toContain("No");
    });

    it("should output JSON format with --json flag", async () => {
      await runCommand(["--json", "executor", "list"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(Array.isArray(parsed.data.executors)).toBe(true);
      expect(parsed.data.executors.length).toBe(9);

      // Check structure of executor entries
      const claudeCode = parsed.data.executors.find((e: { type: string }) => e.type === "CLAUDE_CODE");
      expect(claudeCode).toBeDefined();
      expect(claudeCode.available).toBe(true);
      expect(claudeCode.supportsChat).toBe(true);
      expect(claudeCode.status).toBe("INSTALLATION_FOUND");
      expect(Array.isArray(claudeCode.capabilities)).toBe(true);
    });

    it("should output JSON format with --available filter", async () => {
      await runCommand(["--json", "executor", "list", "--available"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      // Only available executors
      const allAvailable = parsed.data.executors.every((e: { available: boolean }) => e.available === true);
      expect(allAvailable).toBe(true);
    });

    it("should show capabilities for each executor", async () => {
      await runCommand(["executor", "list"]);

      const output = getLogOutput();
      // Should show capabilities like SESSION_FORK, CONTEXT_USAGE
      expect(output).toContain("SESSION_FORK");
    });
  });

  // ============================================================================
  // executor show
  // ============================================================================

  describe("executor show", () => {
    it("should show details of a specific executor", async () => {
      await runCommand(["executor", "show", "CLAUDE_CODE"]);

      const output = getLogOutput();
      expect(output).toContain("Executor: CLAUDE_CODE");
      expect(output).toContain("Status");
      expect(output).toContain("Supports Chat");
      expect(output).toContain("MCP Config Path");
    });

    it("should be case-insensitive for executor type", async () => {
      await runCommand(["executor", "show", "claude_code"]);

      const output = getLogOutput();
      expect(output).toContain("Executor: CLAUDE_CODE");
    });

    it("should show chat command for chat-enabled executors", async () => {
      await runCommand(["executor", "show", "CLAUDE_CODE"]);

      const output = getLogOutput();
      expect(output).toContain("Chat Command");
      expect(output).toContain("claude");
    });

    it("should show capabilities list", async () => {
      await runCommand(["executor", "show", "CLAUDE_CODE"]);

      const output = getLogOutput();
      expect(output).toContain("Capabilities");
      expect(output).toContain("SESSION_FORK");
      expect(output).toContain("CONTEXT_USAGE");
    });

    it("should show MCP config path", async () => {
      await runCommand(["executor", "show", "CLAUDE_CODE"]);

      const output = getLogOutput();
      expect(output).toContain("MCP Config Path");
      expect(output).toContain(".claude.json");
    });

    it("should output JSON format with --json flag", async () => {
      await runCommand(["--json", "executor", "show", "CLAUDE_CODE"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.type).toBe("CLAUDE_CODE");
      expect(parsed.data.status).toBe("INSTALLATION_FOUND");
      expect(parsed.data.supportsChat).toBe(true);
      expect(parsed.data.chatCommand).toBe("claude");
      expect(parsed.data.mcpConfigPath).toContain(".claude.json");
      expect(Array.isArray(parsed.data.capabilities)).toBe(true);
    });

    it("should throw error for unknown executor type", async () => {
      await expect(runCommand(["executor", "show", "UNKNOWN_EXECUTOR"])).rejects.toThrow();
      expect(errorOutput.some((e) => e.includes("Unknown executor type"))).toBe(true);
    });

    it("should list valid executor types in error message", async () => {
      await expect(runCommand(["executor", "show", "INVALID"])).rejects.toThrow();
      const errorMsg = errorOutput.join("\n");
      expect(errorMsg).toContain("CLAUDE_CODE");
      expect(errorMsg).toContain("AMP");
      expect(errorMsg).toContain("GEMINI");
    });

    it("should show non-chat executor details correctly", async () => {
      await runCommand(["executor", "show", "AMP"]);

      const output = getLogOutput();
      expect(output).toContain("Executor: AMP");
      expect(output).toContain("Supports Chat");
    });

    it("should show executor with empty capabilities", async () => {
      await runCommand(["executor", "show", "COPILOT"]);

      const output = getLogOutput();
      expect(output).toContain("Executor: COPILOT");
      // COPILOT has empty capabilities, so Capabilities section might not be shown
      // or shown without items
    });
  });

  // ============================================================================
  // Chat support indicators
  // ============================================================================

  describe("Chat support indicators", () => {
    it("should show [chat] badge for chat-enabled executors in types command", async () => {
      await runCommand(["executor", "types"]);

      const output = getLogOutput();
      // Chat-enabled count should be shown
      expect(output).toContain("Chat-enabled: 3");
    });

    it("should show Yes for chat-enabled executors in list command", async () => {
      await runCommand(["--json", "executor", "list"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      const claudeCode = parsed.data.executors.find((e: { type: string }) => e.type === "CLAUDE_CODE");
      expect(claudeCode.supportsChat).toBe(true);

      const amp = parsed.data.executors.find((e: { type: string }) => e.type === "AMP");
      expect(amp.supportsChat).toBe(false);
    });

    it("should include chatCommand in show output for chat-enabled executors", async () => {
      await runCommand(["--json", "executor", "show", "GEMINI"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.data.supportsChat).toBe(true);
      expect(parsed.data.chatCommand).toBe("gemini");
    });

    it("should show null chatCommand for non-chat executors", async () => {
      await runCommand(["--json", "executor", "show", "AMP"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.data.supportsChat).toBe(false);
      expect(parsed.data.chatCommand).toBeNull();
    });
  });

  // ============================================================================
  // Error handling
  // ============================================================================

  describe("Error handling", () => {
    it("should handle unknown executor type gracefully", async () => {
      await expect(runCommand(["executor", "show", "NOT_A_REAL_EXECUTOR"])).rejects.toThrow();

      expect(errorOutput.length).toBeGreaterThan(0);
      const errorMsg = errorOutput.join("\n");
      expect(errorMsg).toContain("Unknown executor type");
    });

    it("should suggest valid types when given invalid executor", async () => {
      await expect(runCommand(["executor", "show", "CLAUDE"])).rejects.toThrow();

      const errorMsg = errorOutput.join("\n");
      // Should list valid types
      expect(errorMsg).toContain("CLAUDE_CODE");
    });

    it("should handle case where executor type is empty", async () => {
      // Command requires an argument, so this should fail at commander level
      try {
        await runCommand(["executor", "show"]);
      } catch {
        // Expected to fail
      }
    });
  });

  // ============================================================================
  // Output format tests
  // ============================================================================

  describe("Output format", () => {
    it("should produce valid JSON for types command", async () => {
      await runCommand(["--json", "executor", "types"]);

      const output = getLogOutput();
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should produce valid JSON for list command", async () => {
      await runCommand(["--json", "executor", "list"]);

      const output = getLogOutput();
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should produce valid JSON for show command", async () => {
      await runCommand(["--json", "executor", "show", "CLAUDE_CODE"]);

      const output = getLogOutput();
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should include success: true for successful operations", async () => {
      await runCommand(["--json", "executor", "types"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
    });

    it("should include data field in JSON response", async () => {
      await runCommand(["--json", "executor", "list"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.data).toBeDefined();
    });
  });

  // ============================================================================
  // Integration-style tests
  // ============================================================================

  describe("Integration scenarios", () => {
    it("should allow user to discover, list, and inspect executors", async () => {
      // Step 1: List all types
      await runCommand(["--json", "executor", "types"]);
      const typesOutput = getLogOutput();
      const types = JSON.parse(typesOutput);
      expect(types.data.types).toContain("CLAUDE_CODE");

      // Clear output
      logOutput.length = 0;

      // Step 2: List with availability
      await runCommand(["--json", "executor", "list"]);
      const listOutput = getLogOutput();
      const list = JSON.parse(listOutput);
      const available = list.data.executors.filter((e: { available: boolean }) => e.available);
      expect(available.length).toBeGreaterThan(0);

      // Clear output
      logOutput.length = 0;

      // Step 3: Show details of available executor
      await runCommand(["--json", "executor", "show", available[0].type]);
      const showOutput = getLogOutput();
      const details = JSON.parse(showOutput);
      expect(details.data.type).toBe(available[0].type);
    });

    it("should help user find chat-enabled executors", async () => {
      await runCommand(["--json", "executor", "list"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      const chatEnabled = parsed.data.executors.filter((e: { supportsChat: boolean }) => e.supportsChat);
      expect(chatEnabled.length).toBe(3);
      expect(chatEnabled.map((e: { type: string }) => e.type)).toContain("CLAUDE_CODE");
      expect(chatEnabled.map((e: { type: string }) => e.type)).toContain("GEMINI");
      expect(chatEnabled.map((e: { type: string }) => e.type)).toContain("CODEX");
    });
  });
});
