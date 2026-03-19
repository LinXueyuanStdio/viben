/**
 * Init Command Execution Tests
 *
 * Tests that actually execute init commands and verify behavior.
 * Uses real file system operations with temporary directories.
 *
 * This complements init.test.ts which tests command registration and mock behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerInitCommand } from "./init";
import {
  createTempDir,
  type TempDirContext,
} from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";
import { parse } from "yaml";

// =============================================================================
// Test Setup
// =============================================================================

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

// Store original process.exit and mock it
const originalExit = process.exit;
let exitCode: number | undefined;

// Store original process.cwd
const originalCwd = process.cwd;

// =============================================================================
// Test Context Helper
// =============================================================================

interface ExecutionTestContext {
  tempDir: TempDirContext;
  program: Command;
  console: ConsoleSpy;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => Promise<void>;
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createTempDir("init-test-");

  // Mock process.cwd to return temp directory
  process.cwd = vi.fn(() => tempDir.root);

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

  // Prevent commander from calling process.exit
  program.exitOverride();

  registerInitCommand(program);

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
      // Restore process.exit and process.cwd
      process.exit = originalExit;
      process.cwd = originalCwd;
    },
  };
}

// =============================================================================
// Execution Tests
// =============================================================================

describe("init command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // init (basic)
  // ===========================================================================

  describe("init", () => {
    it("should create .viben directory structure", async () => {
      await ctx.run(["init"]);

      expect(await ctx.tempDir.exists(".viben")).toBe(true);
      expect(await ctx.tempDir.exists(".viben/config.yaml")).toBe(true);
      expect(await ctx.tempDir.exists(".viben/agents")).toBe(true);
    });

    it("should create default agent config", async () => {
      await ctx.run(["init"]);

      expect(await ctx.tempDir.exists(".viben/agents/main.yaml")).toBe(true);
      const content = await ctx.tempDir.readFile(".viben/agents/main.yaml");
      expect(content).toContain("id: main");
      expect(content).toContain("name: Main Agent");
    });

    it("should create workspace config with correct structure", async () => {
      await ctx.run(["init"]);

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      const config = parse(content) as Record<string, unknown>;

      expect(config.version).toBe(1);
      expect(config.settings).toBeDefined();
      expect(config.createdAt).toBeDefined();
      expect(config.updatedAt).toBeDefined();
    });

    it("should not overwrite existing workspace", async () => {
      // First initialization
      await ctx.run(["init"]);

      // Clear console for second run
      ctx.console.reset();

      // Second initialization should fail
      await ctx.run(["init"]);

      // Should have called process.exit with non-zero code
      expect(exitCode).toBe(1);

      // Should show error message about existing workspace
      const hasError = ctx.console.hasError("already exists");
      expect(hasError).toBe(true);
    });

    it("should display success message", async () => {
      await ctx.run(["init"]);

      const hasSuccess = ctx.console.hasLog("Workspace initialized successfully");
      expect(hasSuccess).toBe(true);
    });

    it("should display created files", async () => {
      await ctx.run(["init"]);

      const hasConfigFile = ctx.console.hasLog(".viben/config.yaml");
      expect(hasConfigFile).toBe(true);
    });

    it("should display next steps", async () => {
      await ctx.run(["init"]);

      expect(ctx.console.hasLog("Next steps")).toBe(true);
      expect(ctx.console.hasLog("viben config list")).toBe(true);
      expect(ctx.console.hasLog("viben agent list")).toBe(true);
    });
  });

  // ===========================================================================
  // init --force
  // ===========================================================================

  describe("init --force", () => {
    it("should allow --force to reinitialize", async () => {
      // First initialization
      await ctx.run(["init"]);

      // Modify the config file
      await ctx.tempDir.writeFile(".viben/config.yaml", "existing: true");

      // Force re-initialization
      await ctx.run(["init", "--force"]);

      // Should succeed (no exit code)
      expect(exitCode).toBeUndefined();

      // Config should be overwritten
      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).not.toContain("existing: true");
      expect(content).toContain("version: 1");
    });

    it("should recreate agent config with --force", async () => {
      // First initialization
      await ctx.run(["init"]);

      // Modify the agent config
      await ctx.tempDir.writeFile(".viben/agents/main.yaml", "modified: true");

      // Force re-initialization
      await ctx.run(["init", "--force"]);

      // Agent config should be overwritten
      const content = await ctx.tempDir.readFile(".viben/agents/main.yaml");
      expect(content).not.toContain("modified: true");
      expect(content).toContain("id: main");
    });
  });

  // ===========================================================================
  // init --from <template>
  // ===========================================================================

  describe("init --from <template>", () => {
    it("should fail with template option (deprecated)", async () => {
      await ctx.run(["init", "--from", "minimal"]);

      // Should have called process.exit with non-zero code
      expect(exitCode).toBe(1);

      // Should show error about deprecated templates
      const hasError = ctx.console.hasError("deprecated");
      expect(hasError).toBe(true);
    });
  });

  // ===========================================================================
  // init --json
  // ===========================================================================

  describe("init --json", () => {
    it("should return JSON output on success", async () => {
      const result = (await ctx.runJson(["init"])) as {
        success: boolean;
        data: {
          success: boolean;
          path: string;
          files: string[];
        };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.success).toBe(true);
      expect(result?.data?.path).toContain(".viben");
      expect(result?.data?.files).toContain("config.yaml");
    });

    it("should return JSON error on failure", async () => {
      // First initialization
      await ctx.run(["init"]);

      // Clear console for second run
      ctx.console.reset();

      // Second initialization should fail
      const result = (await ctx.runJson(["init"])) as {
        success: boolean;
        error: {
          code: string;
          message: string;
        };
      };

      expect(result?.success).toBe(false);
      expect(result?.error?.code).toBe("ALREADY_EXISTS");
    });
  });

  // ===========================================================================
  // nested workspace check
  // ===========================================================================

  describe("nested workspace check", () => {
    it("should not allow initialization inside existing workspace", async () => {
      // First initialization in temp dir
      await ctx.run(["init"]);

      // Create a subdirectory and try to init there
      await ctx.tempDir.mkdir("subdir");

      // Change cwd to subdirectory
      const subdir = ctx.tempDir.resolve("subdir");
      process.cwd = vi.fn(() => subdir);

      // Clear console and exit code
      ctx.console.reset();
      exitCode = undefined;

      // Try to initialize in subdirectory
      await ctx.run(["init"]);

      // Should have called process.exit with non-zero code
      expect(exitCode).toBe(1);

      // Should show error about nested workspace
      const hasError = ctx.console.hasError("Nested workspaces are not supported");
      expect(hasError).toBe(true);
    });
  });
});
