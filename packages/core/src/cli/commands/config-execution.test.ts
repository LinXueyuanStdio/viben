/**
 * Config Command Execution Tests
 *
 * Tests that actually execute config commands and verify real YAML file operations.
 * Uses real file system operations with temporary directories.
 *
 * This complements config.test.ts which tests with mocked gitConfigManager.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerConfigCommand } from "./config";
import {
  createWorkspaceTempDir,
  type TempDirContext,
} from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";

// =============================================================================
// Test Setup
// =============================================================================

// Mock only workspaceManager to use our temp directory
// All other file operations are real
vi.mock("../../workspace", () => ({
  workspaceManager: {
    getCurrentWorkspacePath: vi.fn(),
  },
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

// Mock spawn to avoid actually opening editors
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const mockProcess = {
      on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
        if (event === "close") {
          setTimeout(() => callback(0), 0);
        }
        return mockProcess;
      }),
    };
    return mockProcess;
  }),
}));

import { workspaceManager } from "../../workspace";

// Store original process.exit and mock it
const originalExit = process.exit;
let exitCode: number | undefined;

// =============================================================================
// Test Context Helper
// =============================================================================

interface ExecutionTestContext {
  tempDir: TempDirContext & { vibenDir: string; tasksDir: string };
  program: Command;
  console: ConsoleSpy;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => Promise<void>;
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createWorkspaceTempDir();

  // Mock workspaceManager to return our temp directory
  vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(tempDir.root);

  // Mock process.exit to capture exit code instead of actually exiting
  exitCode = undefined;
  process.exit = vi.fn((code?: string | number | null | undefined) => {
    exitCode = typeof code === "number" ? code : 0;
    throw new Error(`process.exit unexpectedly called with "${code}"`);
  }) as never;

  const program = new Command();
  program.option("--json", "Output JSON format");
  program.option("--verbose", "Verbose output");
  program.option("--quiet", "Quiet mode");
  program.option("--global", "Use global config instead of workspace");

  // Prevent commander from calling process.exit
  program.exitOverride();

  registerConfigCommand(program);

  const consoleSpy = createConsoleSpy();

  return {
    tempDir,
    program,
    console: consoleSpy,

    async run(args: string[]) {
      try {
        await program.parseAsync(["node", "test", ...args]);
      } catch (error) {
        // Commander throws on exitOverride, but we can ignore it
        // Also ignore process.exit mock errors
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

    async cleanup() {
      consoleSpy.cleanup();
      await tempDir.cleanup();
      vi.clearAllMocks();
      // Restore process.exit
      process.exit = originalExit;
    },
  };
}

// =============================================================================
// Execution Tests
// =============================================================================

describe("config command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // config get execution
  // ===========================================================================

  describe("config get", () => {
    it("should read value from workspace config", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `settings:
  editor: vim
  theme: dark
`
      );

      await ctx.run(["config", "get", "settings.editor"]);

      expect(ctx.console.hasLog("vim")).toBe(true);
    });

    it("should read nested value from workspace config", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `deep:
  nested:
    value: secret
`
      );

      await ctx.run(["config", "get", "deep.nested.value"]);

      expect(ctx.console.hasLog("secret")).toBe(true);
    });

    it("should return undefined for non-existent key", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `settings:
  editor: vim
`
      );

      await ctx.run(["config", "get", "nonexistent.key"]);

      // No output for undefined (git config behavior)
      expect(ctx.console.logs.length).toBe(0);
    });

    it("should return undefined for empty config file", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "get", "any.key"]);

      expect(ctx.console.logs.length).toBe(0);
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `settings:
  editor: nvim
`
      );

      const result = (await ctx.runJson(["config", "get", "settings.editor"])) as {
        success: boolean;
        data: { key: string; value: string };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.key).toBe("settings.editor");
      expect(result?.data?.value).toBe("nvim");
    });

    it("should read array values", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `servers:
  - server1
  - server2
  - server3
`
      );

      await ctx.run(["config", "get", "servers[0]"]);

      expect(ctx.console.hasLog("server1")).toBe(true);
    });

    it("should read boolean values", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `feature:
  enabled: true
`
      );

      await ctx.run(["config", "get", "feature.enabled"]);

      expect(ctx.console.hasLog("true")).toBe(true);
    });

    it("should read number values", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `settings:
  timeout: 30
`
      );

      await ctx.run(["config", "get", "settings.timeout"]);

      expect(ctx.console.hasLog("30")).toBe(true);
    });

    it("should format object values as JSON", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `config:
  nested:
    key1: value1
    key2: value2
`
      );

      await ctx.run(["config", "get", "config.nested"]);

      // Object values are formatted as JSON
      const output = ctx.console.logs.join(" ");
      expect(output).toContain("key1");
      expect(output).toContain("value1");
    });
  });

  // ===========================================================================
  // config set execution
  // ===========================================================================

  describe("config set", () => {
    it("should write value to workspace config", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "settings: {}");

      await ctx.run(["config", "set", "settings.editor", "nvim"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("editor: nvim");
    });

    it("should create nested keys", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "set", "deep.nested.key", "value"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("deep:");
      expect(content).toContain("nested:");
      expect(content).toContain("key: value");
    });

    it("should create config file if it does not exist", async () => {
      // Ensure config file does not exist
      const exists = await ctx.tempDir.exists(".viben/config.yaml");
      if (exists) {
        // Skip file write - just ensure we start fresh
      }

      await ctx.run(["config", "set", "new.setting", "value"]);

      const fileExists = await ctx.tempDir.exists(".viben/config.yaml");
      expect(fileExists).toBe(true);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("new:");
      expect(content).toContain("setting: value");
    });

    it("should preserve existing values when setting new key", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `settings:
  existing: keep-me
`
      );

      await ctx.run(["config", "set", "settings.new", "added"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("existing: keep-me");
      expect(content).toContain("new: added");
    });

    it("should overwrite existing value", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `settings:
  editor: old-value
`
      );

      await ctx.run(["config", "set", "settings.editor", "new-value"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("editor: new-value");
      expect(content).not.toContain("old-value");
    });

    it("should parse boolean values", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "set", "feature.enabled", "true"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("enabled: true");
    });

    it("should parse numeric values", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "set", "settings.timeout", "60"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("timeout: 60");
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      const result = (await ctx.runJson([
        "config",
        "set",
        "test.key",
        "test-value",
      ])) as {
        success: boolean;
        data: { key: string; value: string; scope: string };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.key).toBe("test.key");
      expect(result?.data?.value).toBe("test-value");
      expect(result?.data?.scope).toBe("workspace");
    });

    it("should handle JSON array values", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "set", "items", '["a","b","c"]']);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      // YAML serializes arrays
      expect(content).toContain("items:");
    });

    it("should handle JSON object values", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "set", "config", '{"key":"value"}']);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("config:");
      expect(content).toContain("key: value");
    });
  });

  // ===========================================================================
  // config list execution
  // ===========================================================================

  describe("config list", () => {
    it("should list all config values", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `key1: value1
key2: value2
`
      );

      await ctx.run(["config", "list"]);

      expect(ctx.console.hasLog("key1")).toBe(true);
      expect(ctx.console.hasLog("key2")).toBe(true);
      expect(ctx.console.hasLog("value1")).toBe(true);
      expect(ctx.console.hasLog("value2")).toBe(true);
    });

    it("should list nested config values with dot notation", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `settings:
  editor: vim
  theme: dark
`
      );

      await ctx.run(["config", "list"]);

      expect(ctx.console.hasLog("settings.editor")).toBe(true);
      expect(ctx.console.hasLog("settings.theme")).toBe(true);
    });

    it("should show empty message when no config", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "list"]);

      expect(ctx.console.hasLog("No configuration values")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `test:
  key: value
`
      );

      const result = (await ctx.runJson(["config", "list"])) as {
        success: boolean;
        data: { items: Array<{ key: string; value: string }> };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.items).toBeDefined();
      expect(result?.data?.items.length).toBeGreaterThan(0);
    });

    it("should list array values with index notation", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `servers:
  - server1
  - server2
`
      );

      await ctx.run(["config", "list"]);

      expect(ctx.console.hasLog("servers[0]")).toBe(true);
      expect(ctx.console.hasLog("servers[1]")).toBe(true);
    });
  });

  // ===========================================================================
  // config unset execution
  // ===========================================================================

  describe("config unset", () => {
    it("should remove a config key", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `settings:
  editor: vim
  theme: dark
`
      );

      await ctx.run(["config", "unset", "settings.editor"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).not.toContain("editor:");
      expect(content).toContain("theme: dark");
    });

    it("should return error for non-existent key", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `settings:
  editor: vim
`
      );

      await ctx.run(["config", "unset", "nonexistent.key"]);

      expect(exitCode).toBe(1);
    });

    it("should remove nested key", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `deep:
  nested:
    key: value
    other: keep
`
      );

      await ctx.run(["config", "unset", "deep.nested.key"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).not.toContain("key: value");
      expect(content).toContain("other: keep");
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `settings:
  editor: vim
`
      );

      const result = (await ctx.runJson([
        "config",
        "unset",
        "settings.editor",
      ])) as {
        success: boolean;
        data: { key: string; deleted: boolean };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.key).toBe("settings.editor");
      expect(result?.data?.deleted).toBe(true);
    });

    it("should return error JSON for non-existent key with --json flag", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `settings:
  existing: value
`
      );

      const result = (await ctx.runJson([
        "config",
        "unset",
        "nonexistent.key",
      ])) as {
        success: boolean;
        error: { code: string; message?: string };
      };

      expect(result?.success).toBe(false);
      expect(result?.error).toBeDefined();
      // The error can be KEY_NOT_FOUND or UNKNOWN_ERROR depending on execution path
      expect(["KEY_NOT_FOUND", "UNKNOWN_ERROR"]).toContain(result?.error?.code);
    });
  });

  // ===========================================================================
  // config edit execution (limited testing - editor is mocked)
  // ===========================================================================

  describe("config edit", () => {
    it("should show config path being edited", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "edit"]);

      // Should show the config path being opened
      expect(ctx.console.hasLog(".viben/config.yaml")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      const result = (await ctx.runJson(["config", "edit"])) as {
        success: boolean;
        data: { configPath: string; editor: string };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.configPath).toContain(".viben/config.yaml");
      expect(result?.data?.editor).toBeDefined();
    });
  });

  // ===========================================================================
  // Edge cases and complex scenarios
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle special characters in values", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "set", "path.value", "/usr/local/bin"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("/usr/local/bin");
    });

    it("should handle values with spaces", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "set", "description", "hello world"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("description: hello world");
    });

    it("should handle empty string values", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "set", "empty.key", ""]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("key:");
    });

    it("should handle null string value", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "set", "null.key", "null"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("key: null");
    });

    it("should handle float values", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "set", "version", "1.5"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("version: 1.5");
    });

    it("should handle negative numbers in config file", async () => {
      // Note: negative numbers like "-10" are interpreted as CLI flags by commander
      // So we test reading negative numbers from existing config instead
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `settings:
  offset: -10
`
      );

      await ctx.run(["config", "get", "settings.offset"]);

      expect(ctx.console.hasLog("-10")).toBe(true);
    });

    it("should handle round-trip set then get", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "set", "test.value", "my-test-value"]);
      ctx.console.reset();

      await ctx.run(["config", "get", "test.value"]);

      expect(ctx.console.hasLog("my-test-value")).toBe(true);
    });

    it("should handle multiple set operations", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "set", "first", "1"]);
      await ctx.run(["config", "set", "second", "2"]);
      await ctx.run(["config", "set", "third", "3"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("first: 1");
      expect(content).toContain("second: 2");
      expect(content).toContain("third: 3");
    });

    it("should handle set then unset then get", async () => {
      await ctx.tempDir.writeFile(".viben/config.yaml", "");

      await ctx.run(["config", "set", "temp.key", "temp-value"]);
      await ctx.run(["config", "unset", "temp.key"]);
      ctx.console.reset();

      await ctx.run(["config", "get", "temp.key"]);

      // Should have no output for undefined
      expect(ctx.console.logs.length).toBe(0);
    });
  });
});
