/**
 * Task Command Execution Tests
 *
 * Tests that actually execute task commands and verify behavior.
 * Uses real file system operations with temporary directories.
 *
 * This complements task.test.ts which tests command registration.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerTaskCommand } from "./task";
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
    // Mock getDeveloper to return a test developer
    getDeveloper: vi.fn(() => "test-developer"),
  };
});

// Mock git commands to avoid actual git operations, but allow rm commands
vi.mock("node:child_process", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:child_process")>();
  const actualExecSync = original.execSync;
  return {
    ...original,
    execSync: vi.fn((cmd: string, options?: Record<string, unknown>) => {
      // Allow rm commands to actually execute for delete functionality
      if (cmd.includes("rm -rf")) {
        return actualExecSync(cmd, options);
      }
      // Mock git commands
      if (cmd.includes("git branch --show-current")) {
        return "main";
      }
      if (cmd.includes("git rev-parse --show-toplevel")) {
        return "/mock/repo";
      }
      return "";
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

  registerTaskCommand(program);

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

describe("task command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // task list execution
  // ===========================================================================

  describe("task list", () => {
    it("should show message when no tasks exist", async () => {
      await ctx.run(["task", "list"]);

      // Check that console output indicates no tasks
      const hasNoTasksMessage = ctx.console.logs.some(
        (log) => log.includes("no active tasks") || log.includes("Total: 0")
      );
      expect(hasNoTasksMessage).toBe(true);
    });

    it("should list tasks when they exist", async () => {
      // Create actual task files
      await createTaskDir(ctx.tempDir, "03-20-first-task", {
        title: "First Task",
        status: "backlog",
        assignee: "test-developer",
        priority: "high",
      });
      await createTaskDir(ctx.tempDir, "03-20-second-task", {
        title: "Second Task",
        status: "queue",
        assignee: "test-developer",
        priority: "medium",
      });

      await ctx.run(["task", "list"]);

      // Check that tasks are listed
      const hasTasks = ctx.console.logs.some(
        (log) => log.includes("first-task") || log.includes("second-task")
      );
      expect(hasTasks).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await createTaskDir(ctx.tempDir, "03-20-json-task", {
        title: "JSON Task",
        status: "backlog",
        assignee: "test-developer",
      });

      const result = (await ctx.runJson(["task", "list"])) as {
        success: boolean;
        data: { tasks: Array<{ dir: string }> };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.tasks).toBeDefined();
    });

    it("should filter tasks by --status option", async () => {
      await createTaskDir(ctx.tempDir, "03-20-backlog-task", {
        title: "Backlog Task",
        status: "backlog",
        assignee: "test-developer",
      });
      await createTaskDir(ctx.tempDir, "03-20-queue-task", {
        title: "Queue Task",
        status: "queue",
        assignee: "test-developer",
      });

      const result = (await ctx.runJson(["task", "list", "-s", "queue"])) as {
        success: boolean;
        data: { tasks: Array<{ status: string }> };
      };

      expect(result?.success).toBe(true);
      const tasks = result?.data?.tasks || [];
      expect(tasks.every((t) => t.status === "queue")).toBe(true);
    });
  });

  // ===========================================================================
  // task create execution
  // ===========================================================================

  describe("task create", () => {
    it("should create task with title", async () => {
      await ctx.run(["task", "create", "New Feature Task"]);

      // Verify task directory was created
      const files = await ctx.tempDir.listFiles(".viben/tasks");
      const taskDirs = files.filter((f) => f.includes("new-feature-task"));
      expect(taskDirs.length).toBeGreaterThan(0);

      // Verify task.json was created with correct content
      const taskJsonPath = `.viben/tasks/${taskDirs[0]}/task.json`;
      const taskJson = await ctx.tempDir.readJson<{ title: string; status: string }>(taskJsonPath);
      expect(taskJson.title).toBe("New Feature Task");
      expect(taskJson.status).toBe("backlog");
    });

    it("should create task with custom slug", async () => {
      await ctx.run(["task", "create", "My Task", "-s", "custom-slug"]);

      const files = await ctx.tempDir.listFiles(".viben/tasks");
      const taskDirs = files.filter((f) => f.includes("custom-slug"));
      expect(taskDirs.length).toBeGreaterThan(0);
    });

    it("should create task with priority", async () => {
      await ctx.run(["task", "create", "Urgent Task", "-p", "urgent"]);

      const files = await ctx.tempDir.listFiles(".viben/tasks");
      const taskDirs = files.filter((f) => f.includes("urgent-task"));

      if (taskDirs[0]) {
        const taskJson = await ctx.tempDir.readJson<{ priority: string }>(
          `.viben/tasks/${taskDirs[0]}/task.json`
        );
        expect(taskJson.priority).toBe("urgent");
      }
    });

    it("should return JSON output with --json flag", async () => {
      const result = (await ctx.runJson(["task", "create", "JSON Create Test"])) as {
        success: boolean;
        data: { taskDir: string };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.taskDir).toBeDefined();
    });

    it("should create task with description", async () => {
      await ctx.run(["task", "create", "Desc Task", "-d", "This is a description"]);

      const files = await ctx.tempDir.listFiles(".viben/tasks");
      const taskDirs = files.filter((f) => f.includes("desc-task"));

      if (taskDirs[0]) {
        const taskJson = await ctx.tempDir.readJson<{ description: string }>(
          `.viben/tasks/${taskDirs[0]}/task.json`
        );
        expect(taskJson.description).toBe("This is a description");
      }
    });

    it("should create task with custom branch", async () => {
      await ctx.run(["task", "create", "Branch Task", "-b", "fix/bug-123"]);

      const files = await ctx.tempDir.listFiles(".viben/tasks");
      const taskDirs = files.filter((f) => f.includes("branch-task"));

      if (taskDirs[0]) {
        const taskJson = await ctx.tempDir.readJson<{ branch: string }>(
          `.viben/tasks/${taskDirs[0]}/task.json`
        );
        expect(taskJson.branch).toBe("fix/bug-123");
      }
    });
  });

  // ===========================================================================
  // task view execution
  // ===========================================================================

  describe("task view", () => {
    it("should show task details", async () => {
      await createTaskDir(ctx.tempDir, "03-20-view-task", {
        title: "View Task",
        status: "in_progress",
        description: "Task description",
        priority: "high",
        assignee: "test-developer",
      });

      await ctx.run(["task", "view", "view-task"]);

      // Check that task details are displayed
      const hasTitle = ctx.console.logs.some((log) => log.includes("View Task"));
      expect(hasTitle).toBe(true);
    });

    it("should return error for non-existent task", async () => {
      await ctx.run(["task", "view", "nonexistent-task"]);

      // Should have called process.exit with non-zero code
      expect(exitCode).toBe(1);
    });

    it("should return JSON output with --json flag", async () => {
      await createTaskDir(ctx.tempDir, "03-20-json-view", {
        title: "JSON View Task",
        status: "backlog",
        assignee: "test-developer",
      });

      const result = (await ctx.runJson(["task", "view", "json-view"])) as {
        success: boolean;
        data: { task: { title: string } };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.task?.title).toBe("JSON View Task");
    });
  });

  // ===========================================================================
  // task delete execution
  // ===========================================================================

  describe("task delete", () => {
    it("should delete existing task with --force flag", async () => {
      await createTaskDir(ctx.tempDir, "03-20-delete-task", {
        title: "Delete Task",
        status: "backlog",
        assignee: "test-developer",
      });

      // Verify task exists before delete
      let files = await ctx.tempDir.listFiles(".viben/tasks");
      expect(files.some((f) => f.includes("delete-task"))).toBe(true);

      await ctx.run(["task", "delete", "delete-task", "-f"]);

      // Verify task was deleted
      files = await ctx.tempDir.listFiles(".viben/tasks");
      expect(files.some((f) => f.includes("delete-task"))).toBe(false);
    });

    it("should show warning without --force flag", async () => {
      await createTaskDir(ctx.tempDir, "03-20-warn-task", {
        title: "Warn Task",
        status: "backlog",
        assignee: "test-developer",
      });

      await ctx.run(["task", "delete", "warn-task"]);

      // Task should still exist (warning shown, not deleted)
      const files = await ctx.tempDir.listFiles(".viben/tasks");
      expect(files.some((f) => f.includes("warn-task"))).toBe(true);

      // Should show warning message
      const hasWarning = ctx.console.logs.some((log) =>
        log.includes("Warning") || log.includes("permanently delete")
      );
      expect(hasWarning).toBe(true);
    });

    it("should return error for non-existent task", async () => {
      await ctx.run(["task", "delete", "nonexistent", "-f"]);

      // Should have called process.exit with non-zero code
      expect(exitCode).toBe(1);
    });
  });

  // ===========================================================================
  // task set-branch execution (config command that can modify task)
  // ===========================================================================

  describe("task set-branch", () => {
    it("should set task branch", async () => {
      await createTaskDir(ctx.tempDir, "03-20-branch-task", {
        title: "Branch Task",
        status: "backlog",
        branch: "feature/old-branch",
        assignee: "test-developer",
      });

      await ctx.run(["task", "set-branch", "branch-task", "--branch", "feature/new-branch"]);

      // Verify branch was updated
      const taskJson = await ctx.tempDir.readJson<{ branch: string }>(
        ".viben/tasks/03-20-branch-task/task.json"
      );
      expect(taskJson.branch).toBe("feature/new-branch");
    });

    it("should return error for non-existent task", async () => {
      await ctx.run(["task", "set-branch", "nonexistent", "--branch", "feature/test"]);

      // Should have called process.exit with non-zero code
      expect(exitCode).toBe(1);
    });
  });

  // ===========================================================================
  // task set-base execution
  // ===========================================================================

  describe("task set-base", () => {
    it("should set task base branch", async () => {
      await createTaskDir(ctx.tempDir, "03-20-base-task", {
        title: "Base Task",
        status: "backlog",
        base_branch: "main",
        assignee: "test-developer",
      });

      await ctx.run(["task", "set-base", "base-task", "--branch", "develop"]);

      // Verify base_branch was updated
      const taskJson = await ctx.tempDir.readJson<{ base_branch: string }>(
        ".viben/tasks/03-20-base-task/task.json"
      );
      expect(taskJson.base_branch).toBe("develop");
    });
  });
});

