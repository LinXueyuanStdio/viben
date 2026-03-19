/**
 * User Command Execution Tests
 *
 * Tests that actually execute user commands and verify real file operations.
 * Uses real file system operations with temporary directories.
 *
 * This complements user.test.ts which tests with mocked fs operations.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerUserCommand } from "./user";
import {
  createWorkspaceTempDir,
  type TempDirContext,
} from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";

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
  tempDir: TempDirContext & { vibenDir: string; tasksDir: string };
  program: Command;
  console: ConsoleSpy;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => Promise<void>;
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createWorkspaceTempDir();

  // Mock process.cwd to return our temp directory
  process.cwd = () => tempDir.root;

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

  registerUserCommand(program);

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

describe("user command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // user init execution
  // ===========================================================================

  describe("user init", () => {
    it("should create .developer file", async () => {
      await ctx.run(["user", "init", "testuser"]);

      expect(await ctx.tempDir.exists(".viben/.developer")).toBe(true);
      const content = await ctx.tempDir.readFile(".viben/.developer");
      expect(content).toContain("name=testuser");
    });

    it("should create .developer file with initialized_at timestamp", async () => {
      await ctx.run(["user", "init", "testuser"]);

      const content = await ctx.tempDir.readFile(".viben/.developer");
      expect(content).toContain("name=testuser");
      expect(content).toContain("initialized_at=");
    });

    it("should create workspace directory structure", async () => {
      await ctx.run(["user", "init", "testuser"]);

      expect(await ctx.tempDir.exists(".viben/workspace/testuser")).toBe(true);
    });

    it("should create journal file", async () => {
      await ctx.run(["user", "init", "testuser"]);

      expect(await ctx.tempDir.exists(".viben/workspace/testuser/journal-1.md")).toBe(true);
      const content = await ctx.tempDir.readFile(".viben/workspace/testuser/journal-1.md");
      expect(content).toContain("# Journal - testuser");
    });

    it("should create index.md file", async () => {
      await ctx.run(["user", "init", "testuser"]);

      expect(await ctx.tempDir.exists(".viben/workspace/testuser/index.md")).toBe(true);
      const content = await ctx.tempDir.readFile(".viben/workspace/testuser/index.md");
      expect(content).toContain("# Workspace Index - testuser");
    });

    it("should show success message", async () => {
      await ctx.run(["user", "init", "john"]);

      expect(ctx.console.hasLog("Developer initialized: john")).toBe(true);
    });

    it("should show already initialized message if developer exists", async () => {
      // Pre-create developer file
      await ctx.tempDir.writeFile(".viben/.developer", "name=existing-user\n");

      await ctx.run(["user", "init", "newuser"]);

      expect(ctx.console.hasLog("Developer already initialized: existing-user")).toBe(true);
    });

    it("should not overwrite existing developer file", async () => {
      // Pre-create developer file
      await ctx.tempDir.writeFile(".viben/.developer", "name=existing-user\n");

      await ctx.run(["user", "init", "newuser"]);

      // Should still be existing-user
      const content = await ctx.tempDir.readFile(".viben/.developer");
      expect(content).toContain("name=existing-user");
      expect(content).not.toContain("name=newuser");
    });

    it("should return JSON output with --json flag", async () => {
      const result = (await ctx.runJson(["user", "init", "jsonuser"])) as {
        success: boolean;
        data: { user: string; files: string[] };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.user).toBe("jsonuser");
      expect(result?.data?.files).toBeDefined();
      expect(result?.data?.files.length).toBeGreaterThan(0);
    });

    it("should return JSON output for already initialized user", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=existing\n");

      const result = (await ctx.runJson(["user", "init", "newuser"])) as {
        success: boolean;
        data: { user: string; alreadyInitialized: boolean };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.user).toBe("existing");
      expect(result?.data?.alreadyInitialized).toBe(true);
    });

    it("should handle user names with hyphens", async () => {
      await ctx.run(["user", "init", "claude-agent"]);

      expect(await ctx.tempDir.exists(".viben/.developer")).toBe(true);
      const content = await ctx.tempDir.readFile(".viben/.developer");
      expect(content).toContain("name=claude-agent");
      expect(await ctx.tempDir.exists(".viben/workspace/claude-agent")).toBe(true);
    });

    it("should handle user names with underscores", async () => {
      await ctx.run(["user", "init", "test_user"]);

      expect(await ctx.tempDir.exists(".viben/.developer")).toBe(true);
      const content = await ctx.tempDir.readFile(".viben/.developer");
      expect(content).toContain("name=test_user");
    });
  });

  // ===========================================================================
  // user get execution
  // ===========================================================================

  describe("user get", () => {
    it("should display current user name", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=john\nemail=john@example.com\n");

      await ctx.run(["user", "get"]);

      expect(ctx.console.hasLog("john")).toBe(true);
    });

    it("should return only the user name", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=simple-user\n");

      await ctx.run(["user", "get"]);

      // Should output exactly the user name
      expect(ctx.console.logs).toContain("simple-user");
    });

    it("should error when developer not initialized", async () => {
      // No .developer file exists

      await ctx.run(["user", "get"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("Developer not initialized")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=jsonget\n");

      const result = (await ctx.runJson(["user", "get"])) as {
        success: boolean;
        data: { user: string };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.user).toBe("jsonget");
    });

    it("should return null user in JSON mode when not initialized", async () => {
      // No .developer file

      const result = (await ctx.runJson(["user", "get"])) as {
        success: boolean;
        data: { user: string | null };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.user).toBeNull();
    });

    it("should handle developer file with extra fields", async () => {
      await ctx.tempDir.writeFile(
        ".viben/.developer",
        "name=multifield\nemail=test@test.com\ninitialized_at=2024-01-01\n"
      );

      await ctx.run(["user", "get"]);

      expect(ctx.console.logs).toContain("multifield");
    });
  });

  // ===========================================================================
  // user status execution
  // ===========================================================================

  describe("user status", () => {
    it("should show user status when initialized", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=statususer\n");
      await ctx.tempDir.mkdir(".viben/workspace/statususer");

      await ctx.run(["user", "status"]);

      expect(ctx.console.hasLog("User Status")).toBe(true);
      expect(ctx.console.hasLog("statususer")).toBe(true);
    });

    it("should show workspace path when workspace exists", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=wsuser\n");
      await ctx.tempDir.mkdir(".viben/workspace/wsuser");

      await ctx.run(["user", "status"]);

      expect(ctx.console.hasLog(".viben/workspace/wsuser")).toBe(true);
    });

    it("should show not found message when workspace does not exist", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=noworkspace\n");
      // Don't create workspace directory

      await ctx.run(["user", "status"]);

      expect(ctx.console.hasLog("not found")).toBe(true);
    });

    it("should show not initialized message when no developer", async () => {
      // No .developer file

      await ctx.run(["user", "status"]);

      expect(ctx.console.hasLog("Developer not initialized")).toBe(true);
    });

    it("should show initialization instructions when not initialized", async () => {
      // No .developer file

      await ctx.run(["user", "status"]);

      expect(ctx.console.hasLog("viben user init")).toBe(true);
    });

    it("should return JSON output with --json flag when initialized", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=jsonstatus\n");
      await ctx.tempDir.mkdir(".viben/workspace/jsonstatus");

      const result = (await ctx.runJson(["user", "status"])) as {
        success: boolean;
        data: {
          initialized: boolean;
          user: string;
          workspace: string | null;
          repoRoot: string;
        };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.initialized).toBe(true);
      expect(result?.data?.user).toBe("jsonstatus");
      expect(result?.data?.workspace).not.toBeNull();
      expect(result?.data?.repoRoot).toBeDefined();
    });

    it("should return JSON output with --json flag when not initialized", async () => {
      // No .developer file

      const result = (await ctx.runJson(["user", "status"])) as {
        success: boolean;
        data: { initialized: boolean };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.initialized).toBe(false);
    });
  });

  // ===========================================================================
  // Integration tests - combined operations
  // ===========================================================================

  describe("integration", () => {
    it("should init then get user", async () => {
      // Initialize user
      await ctx.run(["user", "init", "integration-user"]);
      ctx.console.reset();

      // Get user
      await ctx.run(["user", "get"]);

      expect(ctx.console.logs).toContain("integration-user");
    });

    it("should init then show status", async () => {
      // Initialize user
      await ctx.run(["user", "init", "status-test"]);
      ctx.console.reset();

      // Show status
      await ctx.run(["user", "status"]);

      expect(ctx.console.hasLog("User Status")).toBe(true);
      expect(ctx.console.hasLog("status-test")).toBe(true);
      expect(ctx.console.hasLog(".viben/workspace/status-test")).toBe(true);
    });

    it("should show correct status for user initialized without workspace", async () => {
      // Create developer file without workspace
      await ctx.tempDir.writeFile(".viben/.developer", "name=manual-user\n");

      await ctx.run(["user", "status"]);

      expect(ctx.console.hasLog("manual-user")).toBe(true);
      expect(ctx.console.hasLog("not found")).toBe(true);
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty developer file", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "");

      await ctx.run(["user", "get"]);

      // Should error because no name field
      expect(exitCode).toBe(1);
    });

    it("should handle developer file without name field", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "email=test@test.com\n");

      await ctx.run(["user", "get"]);

      // Should error because no name field
      expect(exitCode).toBe(1);
    });

    it("should handle developer file with empty name", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=\n");

      await ctx.run(["user", "get"]);

      // Should error because name is empty
      expect(exitCode).toBe(1);
    });

    it("should handle whitespace in developer file", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=  spaced-user  \n");

      await ctx.run(["user", "get"]);

      // Should trim the whitespace
      expect(ctx.console.logs).toContain("spaced-user");
    });

    it("should preserve existing workspace files on re-init attempt", async () => {
      // Initialize first
      await ctx.run(["user", "init", "first-user"]);

      // Write a custom file to workspace
      await ctx.tempDir.writeFile(".viben/workspace/first-user/custom.md", "# Custom File");

      // Attempt re-init (should not overwrite)
      ctx.console.reset();
      await ctx.run(["user", "init", "second-user"]);

      // Original user should be preserved
      const content = await ctx.tempDir.readFile(".viben/.developer");
      expect(content).toContain("name=first-user");

      // Custom file should still exist
      expect(await ctx.tempDir.exists(".viben/workspace/first-user/custom.md")).toBe(true);
    });
  });
});
