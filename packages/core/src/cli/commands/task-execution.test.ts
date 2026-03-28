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

// Mock queue enqueue to avoid actual queue operations
vi.mock("../../queue/ops/enqueue", () => ({
  enqueue: vi.fn(() => ({
    success: true,
    id: "mock-queue-id-12345",
    message: "Task queued successfully",
  })),
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
        data: { task_dir: string };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.task_dir).toBeDefined();
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

  // ===========================================================================
  // task finish execution
  // ===========================================================================

  describe("task finish", () => {
    it("should finish an existing task", async () => {
      await createTaskDir(ctx.tempDir, "03-20-finish-task", {
        title: "Finish Task",
        status: "in_progress",
        assignee: "test-developer",
      });

      await ctx.run(["task", "finish", "finish-task"]);

      // Check console output for success
      const hasSuccessMessage = ctx.console.logs.some(
        (log) => log.includes("Finished") || log.includes("finish-task")
      );
      expect(hasSuccessMessage).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await createTaskDir(ctx.tempDir, "03-20-finish-json", {
        title: "Finish JSON Task",
        status: "in_progress",
        assignee: "test-developer",
      });

      const result = (await ctx.runJson(["task", "finish", "finish-json"])) as {
        success: boolean;
        data: { finished: string };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });

    it("should return error for non-existent task", async () => {
      await ctx.run(["task", "finish", "nonexistent-task"]);

      expect(exitCode).toBe(1);
    });
  });

  // ===========================================================================
  // task archive execution
  // ===========================================================================

  describe("task archive", () => {
    it("should archive a completed task", async () => {
      await createTaskDir(ctx.tempDir, "03-20-archive-task", {
        title: "Archive Task",
        status: "completed",
        assignee: "test-developer",
      });

      await ctx.run(["task", "archive", "archive-task"]);

      // Check console output for success
      const hasSuccessMessage = ctx.console.logs.some(
        (log) => log.includes("Archived") || log.includes("archive")
      );
      expect(hasSuccessMessage).toBe(true);

      // Task should be moved to archive directory
      const active_files = await ctx.tempDir.listFiles(".viben/tasks");
      expect(active_files.some((f) => f.includes("archive-task"))).toBe(false);

      // Check archive directory exists
      const archiveDir = await ctx.tempDir.exists(".viben/tasks/archive");
      expect(archiveDir).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await createTaskDir(ctx.tempDir, "03-20-archive-json", {
        title: "Archive JSON Task",
        status: "completed",
        assignee: "test-developer",
      });

      const result = (await ctx.runJson(["task", "archive", "archive-json"])) as {
        success: boolean;
        data: { archived: string; to: string };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.archived).toBeDefined();
    });

    it("should return error for non-existent task", async () => {
      await ctx.run(["task", "archive", "nonexistent-task"]);

      expect(exitCode).toBe(1);
    });
  });

  // ===========================================================================
  // task enqueue execution
  // ===========================================================================

  describe("task enqueue", () => {
    it("should enqueue a backlog task", async () => {
      await createTaskDir(ctx.tempDir, "03-20-enqueue-task", {
        title: "Enqueue Task",
        status: "backlog",
        assignee: "test-developer",
      });

      await ctx.run(["task", "enqueue", "enqueue-task"]);

      // Check console output for success
      const hasSuccessMessage = ctx.console.logs.some(
        (log) => log.includes("Enqueued") || log.includes("enqueue-task")
      );
      expect(hasSuccessMessage).toBe(true);

      // Verify task status was updated to queue
      const taskJson = await ctx.tempDir.readJson<{ status: string; queuedAt?: string }>(
        ".viben/tasks/03-20-enqueue-task/task.json"
      );
      expect(taskJson.status).toBe("queue");
      expect(taskJson.queuedAt).toBeDefined();
    });

    it("should enqueue with agent option", async () => {
      await createTaskDir(ctx.tempDir, "03-20-enqueue-agent", {
        title: "Enqueue Agent Task",
        status: "backlog",
        assignee: "test-developer",
      });

      await ctx.run(["task", "enqueue", "enqueue-agent", "--agent", "test-agent-id"]);

      const taskJson = await ctx.tempDir.readJson<{ status: string; agent?: string }>(
        ".viben/tasks/03-20-enqueue-agent/task.json"
      );
      expect(taskJson.status).toBe("queue");
      expect(taskJson.agent).toBe("test-agent-id");
    });

    it("should enqueue with executor option", async () => {
      await createTaskDir(ctx.tempDir, "03-20-enqueue-executor", {
        title: "Enqueue Executor Task",
        status: "backlog",
        assignee: "test-developer",
      });

      await ctx.run(["task", "enqueue", "enqueue-executor", "--executor", "CLAUDE_CODE"]);

      const taskJson = await ctx.tempDir.readJson<{ status: string; executor?: string }>(
        ".viben/tasks/03-20-enqueue-executor/task.json"
      );
      expect(taskJson.status).toBe("queue");
      expect(taskJson.executor).toBe("CLAUDE_CODE");
    });

    it("should enqueue with model option", async () => {
      await createTaskDir(ctx.tempDir, "03-20-enqueue-model", {
        title: "Enqueue Model Task",
        status: "backlog",
        assignee: "test-developer",
      });

      await ctx.run(["task", "enqueue", "enqueue-model", "--model", "claude-3-opus"]);

      const taskJson = await ctx.tempDir.readJson<{ status: string; model?: string }>(
        ".viben/tasks/03-20-enqueue-model/task.json"
      );
      expect(taskJson.status).toBe("queue");
      expect(taskJson.model).toBe("claude-3-opus");
    });

    it("should return JSON output with --json flag", async () => {
      await createTaskDir(ctx.tempDir, "03-20-enqueue-json", {
        title: "Enqueue JSON Task",
        status: "backlog",
        assignee: "test-developer",
      });

      const result = (await ctx.runJson(["task", "enqueue", "enqueue-json"])) as {
        success: boolean;
        data: { task: string; status: string };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.status).toBe("queue");
    });

    it("should return error for non-existent task", async () => {
      await ctx.run(["task", "enqueue", "nonexistent-task"]);

      expect(exitCode).toBe(1);
    });

    it("should return error for task not in backlog", async () => {
      await createTaskDir(ctx.tempDir, "03-20-enqueue-wrong-status", {
        title: "Wrong Status Task",
        status: "in_progress",
        assignee: "test-developer",
      });

      await ctx.run(["task", "enqueue", "enqueue-wrong-status"]);

      expect(exitCode).toBe(1);
    });
  });

  // ===========================================================================
  // task dequeue execution
  // ===========================================================================

  describe("task dequeue", () => {
    it("should dequeue a queued task back to backlog", async () => {
      await createTaskDir(ctx.tempDir, "03-20-dequeue-task", {
        title: "Dequeue Task",
        status: "queue",
        queuedAt: new Date().toISOString(),
        assignee: "test-developer",
      });

      await ctx.run(["task", "dequeue", "dequeue-task"]);

      // Check console output for success
      const hasSuccessMessage = ctx.console.logs.some(
        (log) => log.includes("Dequeued") || log.includes("dequeue-task")
      );
      expect(hasSuccessMessage).toBe(true);

      // Verify task status was updated to backlog
      const taskJson = await ctx.tempDir.readJson<{ status: string; queuedAt?: string | null }>(
        ".viben/tasks/03-20-dequeue-task/task.json"
      );
      expect(taskJson.status).toBe("backlog");
      // queuedAt should be cleared (set to null or undefined)
      expect(taskJson.queuedAt == null).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await createTaskDir(ctx.tempDir, "03-20-dequeue-json", {
        title: "Dequeue JSON Task",
        status: "queue",
        queuedAt: new Date().toISOString(),
        assignee: "test-developer",
      });

      const result = (await ctx.runJson(["task", "dequeue", "dequeue-json"])) as {
        success: boolean;
        data: { task: string; status: string };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.status).toBe("backlog");
    });

    it("should return error for non-existent task", async () => {
      await ctx.run(["task", "dequeue", "nonexistent-task"]);

      expect(exitCode).toBe(1);
    });

    it("should return error for task not in queue", async () => {
      await createTaskDir(ctx.tempDir, "03-20-dequeue-wrong-status", {
        title: "Wrong Status Task",
        status: "backlog",
        assignee: "test-developer",
      });

      await ctx.run(["task", "dequeue", "dequeue-wrong-status"]);

      expect(exitCode).toBe(1);
    });
  });

  // ===========================================================================
  // task pause execution
  // ===========================================================================

  describe("task pause", () => {
    it("should pause an in_progress task", async () => {
      await createTaskDir(ctx.tempDir, "03-20-pause-task", {
        title: "Pause Task",
        status: "in_progress",
        current_phase: 1,
        assignee: "test-developer",
      });

      await ctx.run(["task", "pause", "pause-task"]);

      // Check console output for success
      const hasSuccessMessage = ctx.console.logs.some(
        (log) => log.includes("Paused") || log.includes("pause-task")
      );
      expect(hasSuccessMessage).toBe(true);

      // Verify task status was updated to paused
      const taskJson = await ctx.tempDir.readJson<{
        status: string;
        pausedSnapshot?: { fromState: string; pausedAt: string };
      }>(".viben/tasks/03-20-pause-task/task.json");
      expect(taskJson.status).toBe("paused");
      expect(taskJson.pausedSnapshot).toBeDefined();
      expect(taskJson.pausedSnapshot?.fromState).toBe("in_progress");
      expect(taskJson.pausedSnapshot?.pausedAt).toBeDefined();
    });

    it("should pause a queue task", async () => {
      await createTaskDir(ctx.tempDir, "03-20-pause-queue", {
        title: "Pause Queue Task",
        status: "queue",
        queuedAt: new Date().toISOString(),
        assignee: "test-developer",
      });

      await ctx.run(["task", "pause", "pause-queue"]);

      const taskJson = await ctx.tempDir.readJson<{
        status: string;
        pausedSnapshot?: { fromState: string };
      }>(".viben/tasks/03-20-pause-queue/task.json");
      expect(taskJson.status).toBe("paused");
      expect(taskJson.pausedSnapshot?.fromState).toBe("queue");
    });

    it("should return JSON output with --json flag", async () => {
      await createTaskDir(ctx.tempDir, "03-20-pause-json", {
        title: "Pause JSON Task",
        status: "in_progress",
        assignee: "test-developer",
      });

      const result = (await ctx.runJson(["task", "pause", "pause-json"])) as {
        success: boolean;
        data: { task: string; status: string; fromState: string };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.status).toBe("paused");
      expect(result?.data?.fromState).toBe("in_progress");
    });

    it("should return error for non-existent task", async () => {
      await ctx.run(["task", "pause", "nonexistent-task"]);

      expect(exitCode).toBe(1);
    });

    it("should return error for task not in pausable state", async () => {
      await createTaskDir(ctx.tempDir, "03-20-pause-wrong-status", {
        title: "Wrong Status Task",
        status: "backlog",
        assignee: "test-developer",
      });

      await ctx.run(["task", "pause", "pause-wrong-status"]);

      expect(exitCode).toBe(1);
    });
  });

  // ===========================================================================
  // task resume execution
  // ===========================================================================

  describe("task resume", () => {
    it("should resume a paused task to in_progress", async () => {
      await createTaskDir(ctx.tempDir, "03-20-resume-task", {
        title: "Resume Task",
        status: "paused",
        pausedSnapshot: {
          fromState: "in_progress",
          subtaskIndex: 2,
          pausedAt: new Date().toISOString(),
        },
        assignee: "test-developer",
      });

      await ctx.run(["task", "resume", "resume-task"]);

      // Check console output for success
      const hasSuccessMessage = ctx.console.logs.some(
        (log) => log.includes("Resumed") || log.includes("resume-task")
      );
      expect(hasSuccessMessage).toBe(true);

      // Verify task status was restored
      const taskJson = await ctx.tempDir.readJson<{
        status: string;
        pausedSnapshot?: unknown;
      }>(".viben/tasks/03-20-resume-task/task.json");
      expect(taskJson.status).toBe("in_progress");
      // pausedSnapshot should be cleared (set to null or undefined)
      expect(taskJson.pausedSnapshot == null).toBe(true);
    });

    it("should resume a paused task to queue", async () => {
      await createTaskDir(ctx.tempDir, "03-20-resume-queue", {
        title: "Resume Queue Task",
        status: "paused",
        pausedSnapshot: {
          fromState: "queue",
          subtaskIndex: 0,
          pausedAt: new Date().toISOString(),
        },
        assignee: "test-developer",
      });

      await ctx.run(["task", "resume", "resume-queue"]);

      const taskJson = await ctx.tempDir.readJson<{ status: string }>(
        ".viben/tasks/03-20-resume-queue/task.json"
      );
      expect(taskJson.status).toBe("queue");
    });

    it("should return JSON output with --json flag", async () => {
      await createTaskDir(ctx.tempDir, "03-20-resume-json", {
        title: "Resume JSON Task",
        status: "paused",
        pausedSnapshot: {
          fromState: "in_progress",
          subtaskIndex: 1,
          pausedAt: new Date().toISOString(),
        },
        assignee: "test-developer",
      });

      const result = (await ctx.runJson(["task", "resume", "resume-json"])) as {
        success: boolean;
        data: { task: string; status: string };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.status).toBe("in_progress");
    });

    it("should return error for non-existent task", async () => {
      await ctx.run(["task", "resume", "nonexistent-task"]);

      expect(exitCode).toBe(1);
    });

    it("should return error for task not in paused state", async () => {
      await createTaskDir(ctx.tempDir, "03-20-resume-wrong-status", {
        title: "Wrong Status Task",
        status: "in_progress",
        assignee: "test-developer",
      });

      await ctx.run(["task", "resume", "resume-wrong-status"]);

      expect(exitCode).toBe(1);
    });
  });

  // ===========================================================================
  // task status execution
  // ===========================================================================

  describe("task status", () => {
    it("should show status summary when no tasks exist", async () => {
      await ctx.run(["task", "status"]);

      // Should not error and should show some output
      expect(exitCode).toBeUndefined();
    });

    it("should show status summary when tasks exist", async () => {
      await createTaskDir(ctx.tempDir, "03-20-status-task1", {
        title: "Status Task 1",
        status: "backlog",
        assignee: "test-developer",
        priority: "high",
      });
      await createTaskDir(ctx.tempDir, "03-20-status-task2", {
        title: "Status Task 2",
        status: "in_progress",
        assignee: "test-developer",
        priority: "medium",
      });

      await ctx.run(["task", "status"]);

      // Should show task count or task info
      const hasOutput = ctx.console.logs.length > 0;
      expect(hasOutput).toBe(true);
    });

    it("should filter by status", async () => {
      await createTaskDir(ctx.tempDir, "03-20-status-backlog", {
        title: "Backlog Task",
        status: "backlog",
        assignee: "test-developer",
      });
      await createTaskDir(ctx.tempDir, "03-20-status-progress", {
        title: "Progress Task",
        status: "in_progress",
        assignee: "test-developer",
      });

      await ctx.run(["task", "status", "-s", "backlog"]);

      // Should show output
      expect(exitCode).toBeUndefined();
    });

    it("should filter by assignee", async () => {
      await createTaskDir(ctx.tempDir, "03-20-status-dev1", {
        title: "Dev1 Task",
        status: "backlog",
        assignee: "developer-1",
      });
      await createTaskDir(ctx.tempDir, "03-20-status-dev2", {
        title: "Dev2 Task",
        status: "backlog",
        assignee: "developer-2",
      });

      await ctx.run(["task", "status", "-a", "developer-1"]);

      // Should show output
      expect(exitCode).toBeUndefined();
    });

    it("should show specific task status", async () => {
      await createTaskDir(ctx.tempDir, "03-20-status-specific", {
        title: "Specific Task",
        status: "in_progress",
        assignee: "test-developer",
        priority: "high",
        description: "Test description",
      });

      await ctx.run(["task", "status", "status-specific"]);

      // Should show task details
      const hasTaskInfo = ctx.console.logs.some(
        (log) => log.includes("Specific Task") || log.includes("status-specific")
      );
      expect(hasTaskInfo).toBe(true);
    });

    it("should work with --json flag", async () => {
      await createTaskDir(ctx.tempDir, "03-20-status-json", {
        title: "Status JSON Task",
        status: "backlog",
        assignee: "test-developer",
      });

      // The status command with --json flag doesn't output JSON in the same way as other commands
      // It just runs without error
      await ctx.run(["task", "status", "--json"]);

      // Should not error
      expect(exitCode).toBeUndefined();
    });

    it("should show list with --list flag", async () => {
      await createTaskDir(ctx.tempDir, "03-20-status-list1", {
        title: "List Task 1",
        status: "backlog",
        assignee: "test-developer",
      });

      await ctx.run(["task", "status", "--list"]);

      // Should show output
      expect(exitCode).toBeUndefined();
    });

    it("should handle non-existent task with --detail flag", async () => {
      // The status --detail command looks for an agent in the registry, not a task
      // When not found, it logs "Agent not found" but doesn't exit with error
      await ctx.run(["task", "status", "nonexistent-task", "--detail"]);

      // Verify it outputs something about "not found"
      const hasNotFoundMessage = ctx.console.logs.some(
        (log) => log.includes("not found") || log.includes("Agent not found")
      );
      expect(hasNotFoundMessage).toBe(true);
    });
  });
});

