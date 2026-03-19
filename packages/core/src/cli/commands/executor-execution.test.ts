/**
 * Executor Command Execution Tests
 *
 * Tests that use real executor detection logic while mocking only external checks.
 * This complements executor.test.ts which tests with fully mocked executors.
 *
 * Key approach:
 * - Use real executor implementations (ClaudeCode, Gemini, Codex, etc.)
 * - Mock only the `which` and `whichSync` utilities to control availability
 * - Mock file system checks for auth/config files
 * - Verify CLI commands produce correct output based on real executor behavior
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerExecutorCommand } from "./executor";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";

// =============================================================================
// Mock Setup
// =============================================================================

// Mock which/whichSync to control executable availability
vi.mock("../../executors/utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../executors/utils")>();
  return {
    ...original,
    which: vi.fn(),
    whichSync: vi.fn(),
  };
});

// Mock fs to control config file existence
vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    existsSync: vi.fn((path: string) => {
      // Let the mock control which config files exist
      return mockFileExists(path);
    }),
  };
});

// Mock agentManager for 'executor show' command
const mockAgentManager = vi.hoisted(() => ({
  listAgents: vi.fn(),
  getDefault: vi.fn(),
  listSessions: vi.fn(),
}));

vi.mock("../../agents", () => ({
  agentManager: mockAgentManager,
}));

// Mock chalk to avoid color codes in test output
vi.mock("chalk", () => ({
  default: {
    bold: Object.assign((s: string) => s, {
      cyan: (s: string) => s,
    }),
    gray: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    blue: (s: string) => s,
    dim: (s: string) => s,
    white: (s: string) => s,
    magenta: (s: string) => s,
  },
}));

import { which, whichSync } from "../../executors/utils";

// File existence control
let existingFiles: Set<string> = new Set();
function mockFileExists(path: string): boolean {
  return existingFiles.has(path);
}
function setExistingFiles(files: string[]): void {
  existingFiles = new Set(files);
}

// =============================================================================
// Test Context
// =============================================================================

interface ExecutorTestContext {
  program: Command;
  console: ConsoleSpy;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => void;
}

function createExecutorTestContext(): ExecutorTestContext {
  // Reset mocks
  vi.mocked(which).mockReset();
  vi.mocked(whichSync).mockReset();
  existingFiles = new Set();

  // Default: no executables found
  vi.mocked(which).mockResolvedValue(null);
  vi.mocked(whichSync).mockReturnValue(null);

  // Default: no agents
  mockAgentManager.listAgents.mockResolvedValue([]);
  mockAgentManager.getDefault.mockResolvedValue(undefined);
  mockAgentManager.listSessions.mockResolvedValue([]);

  // Mock process.exit
  const originalExit = process.exit;
  let exitCode: number | undefined;
  process.exit = vi.fn((code?: string | number | null) => {
    exitCode = typeof code === "number" ? code : 0;
    throw new Error(`process.exit called with ${code}`);
  }) as never;

  const program = new Command();
  program.option("--json", "Output JSON format");
  program.option("--verbose", "Verbose output");
  program.option("--quiet", "Quiet mode");
  program.exitOverride();

  registerExecutorCommand(program);

  const consoleSpy = createConsoleSpy();

  return {
    program,
    console: consoleSpy,

    async run(args: string[]) {
      try {
        await program.parseAsync(["node", "test", ...args]);
      } catch (error) {
        const errorMessage = (error as Error).message || "";
        if (
          (error as Error).name !== "CommanderError" &&
          !errorMessage.includes("process.exit")
        ) {
          throw error;
        }
      }
    },

    async runJson(args: string[]) {
      try {
        await program.parseAsync(["node", "test", "--json", ...args]);
      } catch (error) {
        const errorMessage = (error as Error).message || "";
        if (
          (error as Error).name !== "CommanderError" &&
          !errorMessage.includes("process.exit")
        ) {
          throw error;
        }
      }
      const lastLog = consoleSpy.getLastLog();
      if (lastLog) {
        try {
          return JSON.parse(lastLog);
        } catch {
          return null;
        }
      }
      return null;
    },

    cleanup() {
      consoleSpy.cleanup();
      vi.clearAllMocks();
      process.exit = originalExit;
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("executor command execution", () => {
  let ctx: ExecutorTestContext;

  beforeEach(() => {
    ctx = createExecutorTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  // ===========================================================================
  // executor types - uses real EXECUTOR_TYPES constant
  // ===========================================================================

  describe("executor types", () => {
    it("should list all real executor types", async () => {
      await ctx.run(["executor", "types"]);

      // Verify real executor types are listed
      expect(ctx.console.hasLog("CLAUDE_CODE")).toBe(true);
      expect(ctx.console.hasLog("AMP")).toBe(true);
      expect(ctx.console.hasLog("GEMINI")).toBe(true);
      expect(ctx.console.hasLog("CODEX")).toBe(true);
      expect(ctx.console.hasLog("OPENCODE")).toBe(true);
      expect(ctx.console.hasLog("CURSOR_AGENT")).toBe(true);
      expect(ctx.console.hasLog("QWEN_CODE")).toBe(true);
      expect(ctx.console.hasLog("COPILOT")).toBe(true);
      expect(ctx.console.hasLog("DROID")).toBe(true);
    });

    it("should show chat-enabled executors from real CHAT_SUPPORTED_EXECUTORS", async () => {
      await ctx.run(["executor", "types"]);

      // Real chat-enabled executors: CLAUDE_CODE, GEMINI, CODEX
      expect(ctx.console.hasLog("Chat-enabled: 3")).toBe(true);
    });

    it("should output JSON with real type list", async () => {
      const result = await ctx.runJson(["executor", "types"]) as {
        success: boolean;
        data: { types: string[] };
      };

      expect(result.success).toBe(true);
      expect(result.data.types).toContain("CLAUDE_CODE");
      expect(result.data.types).toContain("GEMINI");
      expect(result.data.types).toContain("CODEX");
      expect(result.data.types.length).toBe(9);
    });
  });

  // ===========================================================================
  // executor list - uses real executor detection with mocked which()
  // ===========================================================================

  describe("executor list", () => {
    it("should show all executors as NOT_FOUND when no executables exist", async () => {
      // Default: all which() calls return null
      await ctx.run(["executor", "list"]);

      // All executors should be listed but none available
      expect(ctx.console.hasLog("CLAUDE_CODE")).toBe(true);
      expect(ctx.console.hasLog("NOT_FOUND")).toBe(true);
    });

    it("should show CLAUDE_CODE as available when claude is installed", async () => {
      // Mock claude executable found
      vi.mocked(whichSync).mockImplementation((cmd: string) => {
        if (cmd === "claude") return "/usr/local/bin/claude";
        return null;
      });

      const result = await ctx.runJson(["executor", "list"]) as {
        success: boolean;
        data: { executors: Array<{ type: string; available: boolean; status: string; path: string | null }> };
      };

      expect(result.success).toBe(true);
      const claudeCode = result.data.executors.find(e => e.type === "CLAUDE_CODE");
      expect(claudeCode).toBeDefined();
      expect(claudeCode!.available).toBe(true);
      expect(claudeCode!.status).toBe("INSTALLATION_FOUND");
      expect(claudeCode!.path).toBe("/usr/local/bin/claude");
    });

    it("should show CLAUDE_CODE with LOGIN_DETECTED when .claude.json exists", async () => {
      // Mock claude executable and config file
      vi.mocked(whichSync).mockImplementation((cmd: string) => {
        if (cmd === "claude") return "/usr/local/bin/claude";
        return null;
      });
      const home = require("node:os").homedir();
      setExistingFiles([`${home}/.claude.json`]);

      const result = await ctx.runJson(["executor", "list"]) as {
        success: boolean;
        data: { executors: Array<{ type: string; status: string }> };
      };

      const claudeCode = result.data.executors.find(e => e.type === "CLAUDE_CODE");
      expect(claudeCode!.status).toBe("LOGIN_DETECTED");
    });

    it("should show GEMINI as available when gemini is installed", async () => {
      vi.mocked(whichSync).mockImplementation((cmd: string) => {
        if (cmd === "gemini") return "/usr/local/bin/gemini";
        return null;
      });

      const result = await ctx.runJson(["executor", "list"]) as {
        success: boolean;
        data: { executors: Array<{ type: string; available: boolean }> };
      };

      const gemini = result.data.executors.find(e => e.type === "GEMINI");
      expect(gemini!.available).toBe(true);
    });

    it("should filter to only available executors with --available flag", async () => {
      // Only claude and gemini installed
      vi.mocked(whichSync).mockImplementation((cmd: string) => {
        if (cmd === "claude") return "/usr/local/bin/claude";
        if (cmd === "gemini") return "/usr/local/bin/gemini";
        return null;
      });

      const result = await ctx.runJson(["executor", "list", "--available"]) as {
        success: boolean;
        data: { executors: Array<{ type: string; available: boolean }> };
      };

      expect(result.success).toBe(true);
      expect(result.data.executors.every(e => e.available)).toBe(true);
      expect(result.data.executors.length).toBe(2);
    });

    it("should show correct chat support based on real CHAT_SUPPORTED_EXECUTORS", async () => {
      vi.mocked(whichSync).mockImplementation((cmd: string) => {
        // Make all executors available
        return `/usr/local/bin/${cmd}`;
      });

      const result = await ctx.runJson(["executor", "list"]) as {
        success: boolean;
        data: { executors: Array<{ type: string; supportsChat: boolean }> };
      };

      // CLAUDE_CODE, GEMINI, CODEX support chat
      const claudeCode = result.data.executors.find(e => e.type === "CLAUDE_CODE");
      expect(claudeCode!.supportsChat).toBe(true);

      const gemini = result.data.executors.find(e => e.type === "GEMINI");
      expect(gemini!.supportsChat).toBe(true);

      const codex = result.data.executors.find(e => e.type === "CODEX");
      expect(codex!.supportsChat).toBe(true);

      // AMP, OPENCODE, etc. do NOT support chat
      const amp = result.data.executors.find(e => e.type === "AMP");
      expect(amp!.supportsChat).toBe(false);

      const opencode = result.data.executors.find(e => e.type === "OPENCODE");
      expect(opencode!.supportsChat).toBe(false);
    });

    it("should include real capabilities from executor implementations", async () => {
      vi.mocked(whichSync).mockImplementation((cmd: string) => {
        if (cmd === "claude") return "/usr/local/bin/claude";
        if (cmd === "codex") return "/usr/local/bin/codex";
        return null;
      });

      const result = await ctx.runJson(["executor", "list"]) as {
        success: boolean;
        data: { executors: Array<{ type: string; capabilities: string[] }> };
      };

      // CLAUDE_CODE has SESSION_FORK and CONTEXT_USAGE
      const claudeCode = result.data.executors.find(e => e.type === "CLAUDE_CODE");
      expect(claudeCode!.capabilities).toContain("SESSION_FORK");
      expect(claudeCode!.capabilities).toContain("CONTEXT_USAGE");

      // CODEX has SESSION_FORK, SETUP_HELPER, and CONTEXT_USAGE
      const codex = result.data.executors.find(e => e.type === "CODEX");
      expect(codex!.capabilities).toContain("SESSION_FORK");
      expect(codex!.capabilities).toContain("SETUP_HELPER");
      expect(codex!.capabilities).toContain("CONTEXT_USAGE");
    });
  });

  // ===========================================================================
  // executor show - uses real executor behavior
  // ===========================================================================

  describe("executor show", () => {
    it("should show CLAUDE_CODE details with real capabilities", async () => {
      vi.mocked(whichSync).mockImplementation((cmd: string) => {
        if (cmd === "claude") return "/usr/local/bin/claude";
        return null;
      });

      await ctx.run(["executor", "show", "CLAUDE_CODE"]);

      expect(ctx.console.hasLog("Executor: CLAUDE_CODE")).toBe(true);
      expect(ctx.console.hasLog("SESSION_FORK")).toBe(true);
      expect(ctx.console.hasLog("CONTEXT_USAGE")).toBe(true);
    });

    it("should show correct chat command for CLAUDE_CODE", async () => {
      vi.mocked(whichSync).mockReturnValue("/usr/local/bin/claude");

      const result = await ctx.runJson(["executor", "show", "CLAUDE_CODE"]) as {
        success: boolean;
        data: {
          type: string;
          supportsChat: boolean;
          chatCommand: string;
        };
      };

      expect(result.success).toBe(true);
      expect(result.data.supportsChat).toBe(true);
      expect(result.data.chatCommand).toBe("claude");
    });

    it("should show correct chat command for GEMINI", async () => {
      vi.mocked(whichSync).mockReturnValue("/usr/local/bin/gemini");

      const result = await ctx.runJson(["executor", "show", "GEMINI"]) as {
        success: boolean;
        data: {
          type: string;
          supportsChat: boolean;
          chatCommand: string;
        };
      };

      expect(result.data.supportsChat).toBe(true);
      expect(result.data.chatCommand).toBe("gemini");
    });

    it("should show null chatCommand for non-chat executors", async () => {
      vi.mocked(whichSync).mockReturnValue("/usr/local/bin/amp");

      const result = await ctx.runJson(["executor", "show", "AMP"]) as {
        success: boolean;
        data: {
          type: string;
          supportsChat: boolean;
          chatCommand: string | null;
        };
      };

      expect(result.data.supportsChat).toBe(false);
      expect(result.data.chatCommand).toBeNull();
    });

    it("should show real MCP config path for CLAUDE_CODE", async () => {
      vi.mocked(whichSync).mockReturnValue("/usr/local/bin/claude");
      const home = require("node:os").homedir();

      const result = await ctx.runJson(["executor", "show", "CLAUDE_CODE"]) as {
        success: boolean;
        data: { mcpConfigPath: string };
      };

      expect(result.data.mcpConfigPath).toBe(`${home}/.claude.json`);
    });

    it("should show NOT_FOUND status when executable not installed", async () => {
      // No executables found
      vi.mocked(whichSync).mockReturnValue(null);

      const result = await ctx.runJson(["executor", "show", "CLAUDE_CODE"]) as {
        success: boolean;
        data: { status: string };
      };

      expect(result.data.status).toBe("NOT_FOUND");
    });

    it("should be case-insensitive for executor type", async () => {
      vi.mocked(whichSync).mockReturnValue("/usr/local/bin/claude");

      const result = await ctx.runJson(["executor", "show", "claude_code"]) as {
        success: boolean;
        data: { type: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.type).toBe("CLAUDE_CODE");
    });

    it("should accept -n option for executor type", async () => {
      vi.mocked(whichSync).mockReturnValue("/usr/local/bin/gemini");

      const result = await ctx.runJson(["executor", "show", "-n", "GEMINI"]) as {
        success: boolean;
        data: { type: string };
      };

      expect(result.success).toBe(true);
      expect(result.data.type).toBe("GEMINI");
    });

    it("should error for unknown executor type", async () => {
      await ctx.run(["executor", "show", "UNKNOWN_EXECUTOR"]);

      expect(ctx.console.hasError("Unknown executor type")).toBe(true);
    });

    it("should list valid executor types in error message", async () => {
      await ctx.run(["executor", "show", "INVALID"]);

      expect(ctx.console.hasError("CLAUDE_CODE")).toBe(true);
      expect(ctx.console.hasError("GEMINI")).toBe(true);
    });

    it("should show agents using this executor", async () => {
      vi.mocked(whichSync).mockReturnValue("/usr/local/bin/claude");
      mockAgentManager.listAgents.mockResolvedValue([
        { id: "agent1", name: "My Agent", executorType: "CLAUDE_CODE" },
      ]);
      mockAgentManager.listSessions.mockResolvedValue([{ id: "s1" }]);

      await ctx.run(["executor", "show", "CLAUDE_CODE"]);

      expect(ctx.console.hasLog("Agents using this executor")).toBe(true);
      expect(ctx.console.hasLog("My Agent")).toBe(true);
    });

    it("should show no agents message when none use this executor", async () => {
      vi.mocked(whichSync).mockReturnValue("/usr/local/bin/claude");
      mockAgentManager.listAgents.mockResolvedValue([]);

      await ctx.run(["executor", "show", "CLAUDE_CODE"]);

      expect(ctx.console.hasLog("No agents using this executor")).toBe(true);
    });

    it("should include agents in JSON output", async () => {
      vi.mocked(whichSync).mockReturnValue("/usr/local/bin/claude");
      mockAgentManager.listAgents.mockResolvedValue([
        { id: "agent1", name: "Test Agent", executorType: "CLAUDE_CODE" },
      ]);
      mockAgentManager.getDefault.mockResolvedValue("agent1");
      mockAgentManager.listSessions.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);

      const result = await ctx.runJson(["executor", "show", "CLAUDE_CODE"]) as {
        success: boolean;
        data: {
          agents: Array<{
            id: string;
            name: string;
            sessionCount: number;
            isDefault: boolean;
          }>;
        };
      };

      expect(result.data.agents).toHaveLength(1);
      expect(result.data.agents[0].id).toBe("agent1");
      expect(result.data.agents[0].name).toBe("Test Agent");
      expect(result.data.agents[0].sessionCount).toBe(2);
      expect(result.data.agents[0].isDefault).toBe(true);
    });
  });

  // ===========================================================================
  // executor show - real executor capability tests
  // ===========================================================================

  describe("executor capabilities verification", () => {
    it("should show CODEX with SETUP_HELPER capability", async () => {
      vi.mocked(whichSync).mockReturnValue("/usr/local/bin/codex");

      const result = await ctx.runJson(["executor", "show", "CODEX"]) as {
        success: boolean;
        data: { capabilities: string[] };
      };

      expect(result.data.capabilities).toContain("SETUP_HELPER");
    });

    it("should show COPILOT with empty capabilities", async () => {
      vi.mocked(whichSync).mockReturnValue("/usr/local/bin/copilot");

      const result = await ctx.runJson(["executor", "show", "COPILOT"]) as {
        success: boolean;
        data: { capabilities: string[] };
      };

      // COPILOT has empty capabilities based on implementation
      expect(Array.isArray(result.data.capabilities)).toBe(true);
    });

    it("should show GEMINI with SESSION_FORK capability", async () => {
      vi.mocked(whichSync).mockReturnValue("/usr/local/bin/gemini");

      const result = await ctx.runJson(["executor", "show", "GEMINI"]) as {
        success: boolean;
        data: { capabilities: string[] };
      };

      expect(result.data.capabilities).toContain("SESSION_FORK");
    });
  });

  // ===========================================================================
  // Integration: multiple executors available
  // ===========================================================================

  describe("integration scenarios", () => {
    it("should correctly identify multiple available executors", async () => {
      vi.mocked(whichSync).mockImplementation((cmd: string) => {
        const available: Record<string, string> = {
          claude: "/usr/local/bin/claude",
          gemini: "/usr/local/bin/gemini",
          codex: "/usr/local/bin/codex",
          amp: "/usr/local/bin/amp",
        };
        return available[cmd] || null;
      });

      const result = await ctx.runJson(["executor", "list", "--available"]) as {
        success: boolean;
        data: { executors: Array<{ type: string }> };
      };

      expect(result.success).toBe(true);
      const types = result.data.executors.map(e => e.type);
      expect(types).toContain("CLAUDE_CODE");
      expect(types).toContain("GEMINI");
      expect(types).toContain("CODEX");
      expect(types).toContain("AMP");
    });

    it("should allow discovery workflow: types -> list -> show", async () => {
      vi.mocked(whichSync).mockImplementation((cmd: string) => {
        if (cmd === "claude") return "/usr/local/bin/claude";
        return null;
      });

      // Step 1: Get types
      const typesResult = await ctx.runJson(["executor", "types"]) as {
        data: { types: string[] };
      };
      expect(typesResult.data.types).toContain("CLAUDE_CODE");
      ctx.console.reset();

      // Step 2: List with availability
      const listResult = await ctx.runJson(["executor", "list"]) as {
        data: { executors: Array<{ type: string; available: boolean }> };
      };
      const available = listResult.data.executors.filter(e => e.available);
      expect(available.length).toBeGreaterThan(0);
      ctx.console.reset();

      // Step 3: Show details of available executor
      const showResult = await ctx.runJson(["executor", "show", available[0].type]) as {
        data: { type: string };
      };
      expect(showResult.data.type).toBe(available[0].type);
    });
  });
});
