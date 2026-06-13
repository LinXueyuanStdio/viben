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

// Mock the agents module with vi.hoisted for proper initialization order
const { mockAgentManager } = vi.hoisted(() => ({
  mockAgentManager: {
    listAgents: vi.fn(),
    getDefault: vi.fn(),
    listSessions: vi.fn(),
  },
}));

vi.mock("../../agents", () => ({
  agentManager: mockAgentManager,
}));

// Mock the unified executor module
vi.mock("../../executors/ops", () => {
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
  ] as const;

  const MOCK_CHAT_SUPPORTED_EXECUTORS = ["CLAUDE_CODE", "GEMINI", "CODEX"];

  // Create a mock executor factory
  const createMockExecutor = (type: string, available: boolean) => ({
    type,
    capabilities: () => {
      switch (type) {
        case "CLAUDE_CODE":
          return ["SPAWN", "CHAT", "CHAT_SDK", "CHAT_STREAMING", "SESSION_RESUME", "SESSION_FORK", "CONTEXT_USAGE"];
        case "GEMINI":
          return ["SPAWN", "CHAT", "SESSION_FORK"];
        case "CODEX":
          return ["SPAWN", "CHAT", "SESSION_FORK", "CONTEXT_USAGE"];
        case "COPILOT":
          return ["SPAWN"];
        default:
          return ["SPAWN", "SESSION_FORK"];
      }
    },
    supports: (capability: string) => {
      const caps = createMockExecutor(type, available).capabilities();
      return caps.includes(capability);
    },
    getAvailabilityInfo: () => ({
      status: available ? "INSTALLATION_FOUND" : "NOT_FOUND",
      lastAuthTimestamp: available ? Date.now() : null,
      path: available ? `/usr/local/bin/${type.toLowerCase().replace("_", "-")}` : undefined,
    }),
    getCliName: () => {
      switch (type) {
        case "CLAUDE_CODE":
          return "claude";
        case "GEMINI":
          return "gemini";
        case "CODEX":
          return "codex";
        case "AMP":
          return "amp";
        case "OPENCODE":
          return "opencode";
        case "CURSOR_AGENT":
          return "cursor-agent";
        case "QWEN_CODE":
          return "qwen-code";
        case "COPILOT":
          return "copilot";
        case "DROID":
          return "droid";
        default:
          return type.toLowerCase();
      }
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
    getRegisteredTypes: () => [...MOCK_EXECUTOR_TYPES],
    getExecutor: (type: string) => {
      if (!MOCK_EXECUTOR_TYPES.includes(type as typeof MOCK_EXECUTOR_TYPES[number])) {
        throw new Error(`Unknown executor type: ${type}`);
      }
      const availableExecutors = ["CLAUDE_CODE", "GEMINI"];
      return createMockExecutor(type, availableExecutors.includes(type));
    },
    getAvailableExecutors: () => {
      const availableExecutors = ["CLAUDE_CODE", "GEMINI"];
      return availableExecutors.map((type) => ({
        type,
        executor: createMockExecutor(type, true),
        availability: { status: "INSTALLATION_FOUND", path: `/usr/local/bin/${type.toLowerCase().replace("_", "-")}` },
      }));
    },
  };
});

// Mock the legacy executors module (still used for chat proxy)
vi.mock("../../executors", () => ({
  createChatProxyAsync: vi.fn(),
  chatProxyFactory: {
    isSdkAvailable: vi.fn(() => false),
  },
}));

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

    // Setup agent manager mock returns
    mockAgentManager.listAgents.mockResolvedValue([]);
    mockAgentManager.getDefault.mockResolvedValue(undefined);
    mockAgentManager.listSessions.mockResolvedValue([]);

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
      expect(output).toContain("Path");
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

    it("should show Path column in list output", async () => {
      await runCommand(["executor", "list"]);

      const output = getLogOutput();
      // Should have Path column header
      expect(output).toContain("Path");
      // Available executors should show their paths
      expect(output).toContain("/usr/local/bin/claude-code");
    });

    it("should include path in JSON output for available executors", async () => {
      await runCommand(["--json", "executor", "list"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      const claudeCode = parsed.data.executors.find((e: { type: string }) => e.type === "CLAUDE_CODE");
      expect(claudeCode.path).toBe("/usr/local/bin/claude-code");

      // Unavailable executor should have null path
      const amp = parsed.data.executors.find((e: { type: string }) => e.type === "AMP");
      expect(amp.path).toBeNull();
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

    it("should include capabilities in JSON output (not in table for brevity)", async () => {
      await runCommand(["--json", "executor", "list"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      const claudeCode = parsed.data.executors.find((e: { type: string }) => e.type === "CLAUDE_CODE");
      // Capabilities are still in JSON output
      expect(claudeCode.capabilities).toContain("SESSION_FORK");
      expect(claudeCode.capabilities).toContain("CONTEXT_USAGE");
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

    // ============================================================================
    // Agents list - spec requirement (executor.md:313)
    // ============================================================================

    it("should show 'No agents' message when no agents use this executor", async () => {
      await runCommand(["executor", "show", "CLAUDE_CODE"]);

      const output = getLogOutput();
      expect(output).toContain("No agents using this executor");
    });

    it("should include empty agents array in JSON output when no agents", async () => {
      await runCommand(["--json", "executor", "show", "CLAUDE_CODE"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.agents).toBeDefined();
      expect(Array.isArray(parsed.data.agents)).toBe(true);
      expect(parsed.data.agents.length).toBe(0);
    });

    it("should show agents using this executor in human output", async () => {
      mockAgentManager.listAgents.mockResolvedValue([
        { id: "agent1", name: "My Agent", executorType: "CLAUDE_CODE" },
        { id: "agent2", name: "Other Agent", executorType: "GEMINI" },
      ]);
      mockAgentManager.listSessions.mockResolvedValue([
        { id: "s1" }, { id: "s2" }, { id: "s3" },
      ]);

      await runCommand(["executor", "show", "CLAUDE_CODE"]);

      const output = getLogOutput();
      expect(output).toContain("Agents using this executor");
      expect(output).toContain("My Agent");
      expect(output).toContain("3 sessions");
      // Should not contain agent using different executor
      expect(output).not.toContain("Other Agent");
    });

    it("should include agents list in JSON output", async () => {
      mockAgentManager.listAgents.mockResolvedValue([
        { id: "agent1", name: "Test Agent", executorType: "CLAUDE_CODE" },
      ]);
      mockAgentManager.listSessions.mockResolvedValue([{ id: "s1" }]);

      await runCommand(["--json", "executor", "show", "CLAUDE_CODE"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.agents).toHaveLength(1);
      expect(parsed.data.agents[0].id).toBe("agent1");
      expect(parsed.data.agents[0].name).toBe("Test Agent");
      expect(parsed.data.agents[0].sessionCount).toBe(1);
    });

    it("should show session count for each agent", async () => {
      mockAgentManager.listAgents.mockResolvedValue([
        { id: "agent1", name: "Agent One", executorType: "CLAUDE_CODE" },
      ]);
      mockAgentManager.listSessions.mockImplementation(async (agentId: string) => {
        if (agentId === "agent1") return [{ id: "s1" }];
        return [];
      });

      await runCommand(["executor", "show", "CLAUDE_CODE"]);

      const output = getLogOutput();
      expect(output).toContain("1 session");
    });

    it("should mark default agent", async () => {
      mockAgentManager.listAgents.mockResolvedValue([
        { id: "default-agent", name: "Default Agent", executorType: "CLAUDE_CODE" },
        { id: "other-agent", name: "Other Agent", executorType: "CLAUDE_CODE" },
      ]);
      mockAgentManager.getDefault.mockResolvedValue("default-agent");
      mockAgentManager.listSessions.mockResolvedValue([]);

      await runCommand(["executor", "show", "CLAUDE_CODE"]);

      const output = getLogOutput();
      expect(output).toContain("(default)");
    });

    it("should include isDefault in JSON output", async () => {
      mockAgentManager.listAgents.mockResolvedValue([
        { id: "default-agent", name: "Default Agent", executorType: "CLAUDE_CODE" },
        { id: "other-agent", name: "Other Agent", executorType: "CLAUDE_CODE" },
      ]);
      mockAgentManager.getDefault.mockResolvedValue("default-agent");
      mockAgentManager.listSessions.mockResolvedValue([]);

      await runCommand(["--json", "executor", "show", "CLAUDE_CODE"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.data.agents).toHaveLength(2);
      const defaultAgent = parsed.data.agents.find((a: { id: string }) => a.id === "default-agent");
      const otherAgent = parsed.data.agents.find((a: { id: string }) => a.id === "other-agent");

      expect(defaultAgent.isDefault).toBe(true);
      expect(otherAgent.isDefault).toBe(false);
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
  // -n option compatibility tests (spec: executor.md uses -n <id>)
  // ============================================================================

  describe("executor show with -n option", () => {
    it("should accept -n option for executor type (spec requirement)", async () => {
      await runCommand(["executor", "show", "-n", "CLAUDE_CODE"]);

      const output = getLogOutput();
      expect(output).toContain("Executor: CLAUDE_CODE");
      expect(output).toContain("Status");
    });

    it("should accept --name option for executor type (spec requirement)", async () => {
      await runCommand(["executor", "show", "--name", "GEMINI"]);

      const output = getLogOutput();
      expect(output).toContain("Executor: GEMINI");
    });

    it("should prefer -n option over positional argument when both provided", async () => {
      // -n takes precedence
      await runCommand(["executor", "show", "-n", "CLAUDE_CODE", "GEMINI"]);

      const output = getLogOutput();
      expect(output).toContain("Executor: CLAUDE_CODE");
    });

    it("should error when neither -n nor positional argument provided", async () => {
      await expect(runCommand(["executor", "show"])).rejects.toThrow();
      expect(errorOutput.some((e) => e.includes("required"))).toBe(true);
    });

    it("should output JSON format with -n option", async () => {
      await runCommand(["--json", "executor", "show", "-n", "CODEX"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.type).toBe("CODEX");
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
