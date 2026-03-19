/**
 * Context Command Execution Tests
 *
 * Tests that actually execute context commands and verify behavior.
 * Uses real file system operations with temporary directories.
 *
 * This complements context.test.ts which mocks the viben-workspace module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerContextCommand } from "./context";
import {
  createWorkspaceTempDir,
  createTaskDir,
  type TempDirContext,
} from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";

// =============================================================================
// Test Setup
// =============================================================================

// Mock only findVibenRoot to use our temp directory
// All other file operations are real
vi.mock("../lib/viben-workspace", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/viben-workspace")>();
  return {
    ...original,
    findVibenRoot: vi.fn(),
  };
});

// Mock git commands to avoid actual git operations
vi.mock("node:child_process", async () => {
  return {
    execSync: vi.fn((cmd: string, options?: { encoding?: string }) => {
      // When encoding is specified (like "utf-8"), return a string
      const isStringMode = options?.encoding === "utf-8";

      // Mock git commands
      if (cmd.includes("git") && cmd.includes("branch --show-current")) {
        return isStringMode ? "main\n" : Buffer.from("main\n");
      }
      if (cmd.includes("git") && cmd.includes("rev-parse --show-toplevel")) {
        return isStringMode ? "/mock/repo\n" : Buffer.from("/mock/repo\n");
      }
      if (cmd.includes("git") && cmd.includes("status --porcelain")) {
        return isStringMode ? "" : Buffer.from("");
      }
      if (cmd.includes("git") && cmd.includes("log")) {
        const logOutput = "abc1234 First commit\ndef5678 Second commit\n";
        return isStringMode ? logOutput : Buffer.from(logOutput);
      }
      // Default for any other git command
      if (cmd.includes("git")) {
        return isStringMode ? "" : Buffer.from("");
      }
      return isStringMode ? "" : Buffer.from("");
    }),
    spawn: vi.fn(() => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === "close") {
            setTimeout(() => callback(0), 10);
          }
        }),
      };
      return mockChild;
    }),
  };
});

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

import * as vibenWorkspace from "../lib/viben-workspace";

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

  // Mock findVibenRoot to return our temp directory
  vi.mocked(vibenWorkspace.findVibenRoot).mockReturnValue(tempDir.root);

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

  registerContextCommand(program);

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

describe("context command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // Developer info tests
  // ===========================================================================

  describe("developer info", () => {
    it("should show developer info from .developer file", async () => {
      // Create .developer file with developer name (format: name=<developer>)
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");

      await ctx.run(["context"]);

      // Check that developer name is displayed
      expect(ctx.console.hasLog("testuser")).toBe(true);
      expect(ctx.console.hasLog("## DEVELOPER")).toBe(true);
    });

    it("should show error when developer not initialized", async () => {
      // No .developer file exists
      await ctx.run(["context"]);

      // Should show error message about not initialized
      expect(ctx.console.hasLog("ERROR: Not initialized")).toBe(true);
    });

    it("should handle empty .developer file", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "");

      await ctx.run(["context"]);

      // Should show error when developer is empty
      expect(ctx.console.hasLog("ERROR: Not initialized")).toBe(true);
    });
  });

  // ===========================================================================
  // Active tasks tests
  // ===========================================================================

  describe("active tasks", () => {
    it("should show active tasks", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");
      await createTaskDir(ctx.tempDir, "03-20-active-task", {
        title: "Active Task",
        status: "in_progress",
        assignee: "testuser",
        priority: "high",
      });

      await ctx.run(["context"]);

      // Check that task is listed
      expect(ctx.console.hasLog("active-task")).toBe(true);
      expect(ctx.console.hasLog("## ACTIVE TASKS")).toBe(true);
    });

    it("should show message when no tasks exist", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");

      await ctx.run(["context"]);

      // Should show no active tasks message
      expect(ctx.console.hasLog("no active tasks")).toBe(true);
    });

    it("should show multiple tasks", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");
      await createTaskDir(ctx.tempDir, "03-20-first-task", {
        title: "First Task",
        status: "backlog",
        assignee: "testuser",
        priority: "high",
      });
      await createTaskDir(ctx.tempDir, "03-20-second-task", {
        title: "Second Task",
        status: "in_progress",
        assignee: "testuser",
        priority: "medium",
      });

      await ctx.run(["context"]);

      expect(ctx.console.hasLog("first-task")).toBe(true);
      expect(ctx.console.hasLog("second-task")).toBe(true);
      expect(ctx.console.hasLog("Total: 2 active task(s)")).toBe(true);
    });
  });

  // ===========================================================================
  // Latest task tests
  // ===========================================================================

  describe("latest task", () => {
    it("should show latest task details", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");
      await createTaskDir(ctx.tempDir, "03-19-old-task", {
        title: "Old Task",
        status: "backlog",
        assignee: "testuser",
      });
      await createTaskDir(ctx.tempDir, "03-20-latest-task", {
        title: "Latest Task",
        status: "in_progress",
        assignee: "testuser",
      });

      await ctx.run(["context"]);

      // Latest task (by dir name sort) should be shown
      expect(ctx.console.hasLog("## LATEST TASK")).toBe(true);
      expect(ctx.console.hasLog("latest-task")).toBe(true);
    });

    it("should show (none) when no tasks exist", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");

      await ctx.run(["context"]);

      expect(ctx.console.hasLog("## LATEST TASK")).toBe(true);
      expect(ctx.console.hasLog("(none)")).toBe(true);
    });

    it("should indicate when task has prd.md", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");
      await createTaskDir(ctx.tempDir, "03-20-prd-task", {
        title: "PRD Task",
        status: "in_progress",
        assignee: "testuser",
      });
      // Create prd.md file
      await ctx.tempDir.writeFile(".viben/tasks/03-20-prd-task/prd.md", "# Task PRD\n\nTask details here.");

      await ctx.run(["context"]);

      expect(ctx.console.hasLog("prd.md")).toBe(true);
    });
  });

  // ===========================================================================
  // My tasks filter tests
  // ===========================================================================

  describe("my tasks filter", () => {
    it("should show tasks assigned to current developer", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");
      await createTaskDir(ctx.tempDir, "03-20-my-task", {
        title: "My Task",
        status: "in_progress",
        assignee: "testuser",
        priority: "high",
      });
      await createTaskDir(ctx.tempDir, "03-20-other-task", {
        title: "Other Task",
        status: "in_progress",
        assignee: "otheruser",
        priority: "medium",
      });

      await ctx.run(["context"]);

      // MY TASKS section should show only tasks assigned to testuser
      expect(ctx.console.hasLog("## MY TASKS")).toBe(true);
      expect(ctx.console.hasLog("My Task")).toBe(true);
    });

    it("should show message when no tasks assigned to me", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");
      await createTaskDir(ctx.tempDir, "03-20-other-task", {
        title: "Other Task",
        status: "in_progress",
        assignee: "otheruser",
        priority: "high",
      });

      await ctx.run(["context"]);

      expect(ctx.console.hasLog("no tasks assigned to you")).toBe(true);
    });

    it("should filter out completed tasks from my tasks", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");
      await createTaskDir(ctx.tempDir, "03-20-completed-task", {
        title: "Completed Task",
        status: "completed",
        assignee: "testuser",
        priority: "high",
      });

      await ctx.run(["context"]);

      // Completed task should not appear in MY TASKS
      expect(ctx.console.hasLog("no tasks assigned to you")).toBe(true);
    });
  });

  // ===========================================================================
  // Git status tests
  // ===========================================================================

  describe("git status", () => {
    it("should show git branch", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");

      await ctx.run(["context"]);

      expect(ctx.console.hasLog("## GIT STATUS")).toBe(true);
      expect(ctx.console.hasLog("Branch: main")).toBe(true);
    });

    it("should show clean working directory", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");

      await ctx.run(["context"]);

      // Mocked git status returns empty, so should show clean
      expect(ctx.console.hasLog("Working directory: Clean")).toBe(true);
    });

    it("should show recent commits", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");

      await ctx.run(["context"]);

      expect(ctx.console.hasLog("## RECENT COMMITS")).toBe(true);
      // Mocked git log returns commits
      expect(ctx.console.hasLog("abc1234")).toBe(true);
    });
  });

  // ===========================================================================
  // Journal file tests
  // ===========================================================================

  describe("journal file", () => {
    it("should show journal file info when exists", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");
      await ctx.tempDir.mkdir(".viben/workspace/testuser");
      // Create journal file with some content
      const journalContent = Array(100).fill("Log entry line").join("\n");
      await ctx.tempDir.writeFile(".viben/workspace/testuser/journal-1.md", journalContent);

      await ctx.run(["context"]);

      expect(ctx.console.hasLog("## JOURNAL FILE")).toBe(true);
      expect(ctx.console.hasLog("journal-1.md")).toBe(true);
    });

    it("should show message when no journal file exists", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");

      await ctx.run(["context"]);

      expect(ctx.console.hasLog("No journal file found")).toBe(true);
    });

    it("should show warning when journal approaching limit", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");
      await ctx.tempDir.mkdir(".viben/workspace/testuser");
      // Create journal file with 1900+ lines
      const journalContent = Array(1900).fill("Log entry line").join("\n");
      await ctx.tempDir.writeFile(".viben/workspace/testuser/journal-1.md", journalContent);

      await ctx.run(["context"]);

      expect(ctx.console.hasLog("WARNING")).toBe(true);
    });
  });

  // ===========================================================================
  // Paths section tests
  // ===========================================================================

  describe("paths section", () => {
    it("should show workspace paths", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");

      await ctx.run(["context"]);

      expect(ctx.console.hasLog("## PATHS")).toBe(true);
      expect(ctx.console.hasLog("Workspace: .viben/workspace/testuser/")).toBe(true);
      expect(ctx.console.hasLog("Tasks: .viben/tasks/")).toBe(true);
      expect(ctx.console.hasLog("Spec: docs/specs/")).toBe(true);
    });
  });

  // ===========================================================================
  // JSON output tests
  // ===========================================================================

  describe("JSON output (--json flag)", () => {
    it("should output JSON format with developer info", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");

      const result = (await ctx.runJson(["context"])) as {
        success: boolean;
        data: { developer: string };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.developer).toBe("testuser");
    });

    it("should output JSON with git info", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");

      const result = (await ctx.runJson(["context"])) as {
        success: boolean;
        data: {
          git: {
            branch: string;
            isClean: boolean;
            uncommittedChanges: number;
            recentCommits: Array<{ hash: string; message: string }>;
          };
        };
      };

      expect(result?.data?.git).toBeDefined();
      expect(result?.data?.git?.branch).toBe("main");
      expect(result?.data?.git?.isClean).toBe(true);
      expect(result?.data?.git?.uncommittedChanges).toBe(0);
    });

    it("should output JSON with tasks info", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");
      await createTaskDir(ctx.tempDir, "03-20-json-task", {
        title: "JSON Task",
        status: "in_progress",
        assignee: "testuser",
      });

      const result = (await ctx.runJson(["context"])) as {
        success: boolean;
        data: {
          tasks: {
            active: Array<{ dir: string; name: string; status: string }>;
            directory: string;
          };
        };
      };

      expect(result?.data?.tasks).toBeDefined();
      expect(result?.data?.tasks?.directory).toBe(".viben/tasks");
      expect(result?.data?.tasks?.active?.length).toBeGreaterThan(0);
    });

    it("should output JSON with journal info", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");
      await ctx.tempDir.mkdir(".viben/workspace/testuser");
      await ctx.tempDir.writeFile(".viben/workspace/testuser/journal-1.md", "Log entry");

      const result = (await ctx.runJson(["context"])) as {
        success: boolean;
        data: {
          journal: {
            file: string;
            lines: number;
            nearLimit: boolean;
          };
        };
      };

      expect(result?.data?.journal).toBeDefined();
      expect(result?.data?.journal?.file).toContain("journal-1.md");
      expect(result?.data?.journal?.nearLimit).toBe(false);
    });

    it("should return error JSON when not in workspace", async () => {
      // Mock findVibenRoot to return null (not in workspace)
      vi.mocked(vibenWorkspace.findVibenRoot).mockReturnValue(null);

      await ctx.runJson(["context"]);

      // The first JSON output should be the NOT_IN_WORKSPACE error
      // (subsequent outputs may be from the process.exit mock throwing)
      const firstLog = ctx.console.logs[0];
      expect(firstLog).toBeDefined();

      const result = JSON.parse(firstLog) as {
        success: boolean;
        error: { code: string };
      };

      expect(result?.success).toBe(false);
      expect(result?.error?.code).toBe("NOT_IN_WORKSPACE");
    });
  });

  // ===========================================================================
  // Error handling tests
  // ===========================================================================

  describe("error handling", () => {
    it("should show error when not in a Viben workspace", async () => {
      // Mock findVibenRoot to return null (not in workspace)
      vi.mocked(vibenWorkspace.findVibenRoot).mockReturnValue(null);

      await ctx.run(["context"]);

      // Should have shown error and called process.exit(1)
      expect(exitCode).toBe(1);
      expect(ctx.console.hasLog("Not in a Viben workspace")).toBe(true);
    });
  });

  // ===========================================================================
  // Session context header/footer tests
  // ===========================================================================

  describe("session context format", () => {
    it("should output header and footer", async () => {
      await ctx.tempDir.writeFile(".viben/.developer", "name=testuser");

      await ctx.run(["context"]);

      // Check header
      expect(ctx.console.hasLog("========================================")).toBe(true);
      expect(ctx.console.hasLog("SESSION CONTEXT")).toBe(true);
    });
  });
});
