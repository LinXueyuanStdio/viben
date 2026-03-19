/**
 * Task CRUD Operations Tests
 *
 * Tests for REAL file system operations:
 * - listTasks: List tasks with optional filters (--mine, --status)
 * - createTask: Create new task with various options
 * - viewTask: View task details
 * - deleteTask: Delete a task
 * - finishTask: Finish/complete a task
 * - archiveTask: Archive a completed task
 * - listArchivedTasks: List archived tasks
 *
 * Only external commands (gh, git) are mocked. File operations are real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listTasks,
  createTask,
  viewTask,
  deleteTask,
  finishTask,
  archiveTask,
  listArchivedTasks,
} from "./crud";
import {
  createWorkspaceTempDir,
  createTaskDir,
  type TempDirContext,
} from "../../test/helpers/temp-dir";

// Mock node:child_process for git commands
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// Only mock specific viben-workspace functions that depend on global state
vi.mock("../../cli/lib/viben-workspace", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../cli/lib/viben-workspace")>();
  return {
    ...original,
    // Mock date functions for deterministic tests
    getTodayDate: vi.fn().mockReturnValue("2024-03-15"),
    getDatePrefix: vi.fn().mockReturnValue("03-15"),
    getYearMonth: vi.fn().mockReturnValue("2024-03"),
    // Mock git commands
    runGitCommand: vi.fn().mockReturnValue({
      stdout: "main",
      stderr: "",
      code: 0,
    }),
  };
});

import { execSync } from "node:child_process";
import * as vibenWorkspace from "../../cli/lib/viben-workspace";

// Helper to get current year-month for archive tests
function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

describe("crud operations", () => {
  let tempDir: TempDirContext & { vibenDir: string; tasksDir: string };

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  describe("listTasks", () => {
    it("should return all active tasks when no filters applied", async () => {
      // Create .developer file for "dev1"
      await tempDir.writeFile(".viben/.developer", "name=dev1\n");

      await createTaskDir(tempDir, "03-15-task-1", {
        title: "Task 1",
        status: "backlog",
        assignee: "dev1",
        priority: "high",
      });
      await createTaskDir(tempDir, "03-15-task-2", {
        title: "Task 2",
        status: "queue",
        assignee: "dev2",
        priority: "medium",
      });

      const result = listTasks(tempDir.root);

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.map((t) => t.dir).sort()).toEqual([
        "03-15-task-1",
        "03-15-task-2",
      ]);
    });

    it("should filter tasks by --mine option", async () => {
      await tempDir.writeFile(".viben/.developer", "name=dev1\n");

      await createTaskDir(tempDir, "03-15-task-1", {
        title: "Task 1",
        status: "backlog",
        assignee: "dev1",
        priority: "high",
      });
      await createTaskDir(tempDir, "03-15-task-2", {
        title: "Task 2",
        status: "queue",
        assignee: "dev2",
        priority: "medium",
      });

      const result = listTasks(tempDir.root, { mine: true });

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]?.assignee).toBe("dev1");
    });

    it("should return error when --mine is used without developer set", async () => {
      // No .developer file created

      const result = listTasks(tempDir.root, { mine: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain("No developer set");
    });

    it("should filter tasks by --status option", async () => {
      await tempDir.writeFile(".viben/.developer", "name=dev1\n");

      await createTaskDir(tempDir, "03-15-task-1", {
        title: "Task 1",
        status: "backlog",
        assignee: "dev1",
        priority: "high",
      });
      await createTaskDir(tempDir, "03-15-task-2", {
        title: "Task 2",
        status: "queue",
        assignee: "dev2",
        priority: "medium",
      });
      await createTaskDir(tempDir, "03-15-task-3", {
        title: "Task 3",
        status: "queue",
        assignee: "dev1",
        priority: "low",
      });

      const result = listTasks(tempDir.root, { status: "queue" });

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every((t) => t.status === "queue")).toBe(true);
    });

    it("should combine --mine and --status filters", async () => {
      await tempDir.writeFile(".viben/.developer", "name=dev1\n");

      await createTaskDir(tempDir, "03-15-task-1", {
        title: "Task 1",
        status: "backlog",
        assignee: "dev1",
        priority: "high",
      });
      await createTaskDir(tempDir, "03-15-task-2", {
        title: "Task 2",
        status: "queue",
        assignee: "dev2",
        priority: "medium",
      });
      await createTaskDir(tempDir, "03-15-task-3", {
        title: "Task 3",
        status: "queue",
        assignee: "dev1",
        priority: "low",
      });

      const result = listTasks(tempDir.root, { mine: true, status: "queue" });

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]?.assignee).toBe("dev1");
      expect(result.tasks[0]?.status).toBe("queue");
    });

    it("should return empty array when no tasks exist", async () => {
      await tempDir.writeFile(".viben/.developer", "name=dev1\n");

      const result = listTasks(tempDir.root, { status: "completed" });

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(0);
    });

    it("should exclude archive directory from task list", async () => {
      await tempDir.writeFile(".viben/.developer", "name=dev1\n");

      await createTaskDir(tempDir, "03-15-task-1", { status: "backlog" });
      // Create archive directory with a task inside
      await tempDir.mkdir(".viben/tasks/archive/2024-03");
      await tempDir.writeJson(".viben/tasks/archive/2024-03/archived-task/task.json", {
        id: "archived-task",
        name: "archived-task",
        status: "completed",
      });

      const result = listTasks(tempDir.root);

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]?.dir).toBe("03-15-task-1");
    });
  });

  describe("createTask", () => {
    beforeEach(async () => {
      await tempDir.writeFile(".viben/.developer", "name=test-dev\n");
    });

    it("should create a task with required fields", async () => {
      const result = createTask(tempDir.root, "Test Task");

      expect(result.success).toBe(true);
      expect(result.dirName).toBe("03-15-test-task");
      expect(result.status).toBe("backlog");
      expect(result.contextInitialized).toBeDefined();

      // Verify actual file was created
      const taskJson = await tempDir.readJson<{
        id: string;
        title: string;
        status: string;
        assignee: string;
        creator: string;
        createdAt: string;
      }>(".viben/tasks/03-15-test-task/task.json");

      expect(taskJson.id).toBe("test-task");
      expect(taskJson.title).toBe("Test Task");
      expect(taskJson.status).toBe("backlog");
      expect(taskJson.assignee).toBe("test-dev");
      expect(taskJson.creator).toBe("test-dev");
      expect(taskJson.createdAt).toBeDefined();
    });

    it("should create task with custom slug", async () => {
      const result = createTask(tempDir.root, "Test Task", { slug: "custom-slug" });

      expect(result.success).toBe(true);
      expect(result.dirName).toBe("03-15-custom-slug");

      // Verify directory exists
      expect(await tempDir.exists(".viben/tasks/03-15-custom-slug")).toBe(true);
    });

    it("should create task with custom assignee", async () => {
      const result = createTask(tempDir.root, "Test Task", { assignee: "other-dev" });

      expect(result.success).toBe(true);

      const taskJson = await tempDir.readJson<{ assignee: string }>(
        ".viben/tasks/03-15-test-task/task.json"
      );
      expect(taskJson.assignee).toBe("other-dev");
    });

    it("should create task with custom priority", async () => {
      const result = createTask(tempDir.root, "Test Task", { priority: "urgent" });

      expect(result.success).toBe(true);

      const taskJson = await tempDir.readJson<{ priority: string }>(
        ".viben/tasks/03-15-test-task/task.json"
      );
      expect(taskJson.priority).toBe("urgent");
    });

    it("should create task with custom branch", async () => {
      const result = createTask(tempDir.root, "Test Task", { branch: "fix/bug-123" });

      expect(result.success).toBe(true);

      const taskJson = await tempDir.readJson<{ branch: string }>(
        ".viben/tasks/03-15-test-task/task.json"
      );
      expect(taskJson.branch).toBe("fix/bug-123");
    });

    it("should set autoStart to true when --start is provided", async () => {
      const result = createTask(tempDir.root, "Test Task", { start: true });

      expect(result.success).toBe(true);
      expect(result.status).toBe("backlog");

      const taskJson = await tempDir.readJson<{ autoStart: boolean; status: string }>(
        ".viben/tasks/03-15-test-task/task.json"
      );
      expect(taskJson.autoStart).toBe(true);
      expect(taskJson.status).toBe("backlog");
    });

    it("should fail when no developer is set and no assignee provided", async () => {
      // Remove .developer file
      await tempDir.cleanup();
      tempDir = await createWorkspaceTempDir();

      const result = createTask(tempDir.root, "Test Task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No developer set");
    });

    it("should fail when slug cannot be generated", async () => {
      const result = createTask(tempDir.root, "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not generate slug");
    });

    it("should use assignee when developer is not set", async () => {
      // Remove .developer file
      await tempDir.cleanup();
      tempDir = await createWorkspaceTempDir();

      const result = createTask(tempDir.root, "Test Task", { assignee: "explicit-dev" });

      expect(result.success).toBe(true);

      const taskJson = await tempDir.readJson<{ assignee: string; creator: string }>(
        ".viben/tasks/03-15-test-task/task.json"
      );
      expect(taskJson.assignee).toBe("explicit-dev");
      expect(taskJson.creator).toBe("explicit-dev");
    });

    it("should use current git branch as base_branch", async () => {
      vi.mocked(vibenWorkspace.runGitCommand).mockReturnValue({
        stdout: "develop\n",
        stderr: "",
        code: 0,
      });

      const result = createTask(tempDir.root, "Test Task");

      expect(result.success).toBe(true);

      const taskJson = await tempDir.readJson<{ base_branch: string }>(
        ".viben/tasks/03-15-test-task/task.json"
      );
      expect(taskJson.base_branch).toBe("develop");
    });

    it("should default to main when git branch is empty", async () => {
      vi.mocked(vibenWorkspace.runGitCommand).mockReturnValue({
        stdout: "",
        stderr: "",
        code: 0,
      });

      const result = createTask(tempDir.root, "Test Task");

      expect(result.success).toBe(true);

      const taskJson = await tempDir.readJson<{ base_branch: string }>(
        ".viben/tasks/03-15-test-task/task.json"
      );
      expect(taskJson.base_branch).toBe("main");
    });

    it("should set description when provided", async () => {
      const result = createTask(tempDir.root, "Test Task", {
        description: "This is a test description",
      });

      expect(result.success).toBe(true);

      const taskJson = await tempDir.readJson<{ description: string }>(
        ".viben/tasks/03-15-test-task/task.json"
      );
      expect(taskJson.description).toBe("This is a test description");
    });

    it("should set executor and model when provided", async () => {
      const result = createTask(tempDir.root, "Test Task", {
        executor: "CURSOR",
        model: "claude-3-opus",
      });

      expect(result.success).toBe(true);

      const taskJson = await tempDir.readJson<{ executor: string; model: string }>(
        ".viben/tasks/03-15-test-task/task.json"
      );
      expect(taskJson.executor).toBe("CURSOR");
      expect(taskJson.model).toBe("claude-3-opus");
    });

    it("should initialize context files", async () => {
      const result = createTask(tempDir.root, "Test Task");

      expect(result.success).toBe(true);
      expect(result.contextInitialized).toBe(true);

      // Verify context files were created
      expect(await tempDir.exists(".viben/tasks/03-15-test-task/implement.jsonl")).toBe(true);
      expect(await tempDir.exists(".viben/tasks/03-15-test-task/check.jsonl")).toBe(true);
      expect(await tempDir.exists(".viben/tasks/03-15-test-task/fix.jsonl")).toBe(true);
    });

    it("should set reward_config when computeReward is true", async () => {
      const result = createTask(tempDir.root, "Test Task", {
        computeReward: true,
      });

      expect(result.success).toBe(true);

      const taskJson = await tempDir.readJson<{
        compute_reward: boolean;
        reward_config: { types: string[]; weights: number[] };
      }>(".viben/tasks/03-15-test-task/task.json");
      expect(taskJson.compute_reward).toBe(true);
      expect(taskJson.reward_config).toBeDefined();
      expect(taskJson.reward_config.types).toEqual([
        "test_coverage",
        "code_quality",
        "agent_review",
      ]);
    });
  });

  describe("viewTask", () => {
    it("should return task details when task exists", async () => {
      await createTaskDir(tempDir, "03-15-test-task", {
        id: "test-task",
        name: "test-task",
        title: "Test Task",
        status: "backlog",
        priority: "medium",
      });

      const result = viewTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.task?.title).toBe("Test Task");
      expect(result.task?.status).toBe("backlog");
      expect(result.dirName).toBe("03-15-test-task");
    });

    it("should return file info for existing files", async () => {
      await createTaskDir(tempDir, "03-15-test-task", {
        id: "test-task",
        status: "in_progress",
      });
      await tempDir.writeFile(".viben/tasks/03-15-test-task/prd.md", "# Test PRD");

      const result = viewTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.files?.prd.exists).toBe(true);
      expect(result.files?.prd.size).toBeGreaterThan(0);
    });

    it("should return worktree info when worktree is enabled", async () => {
      await createTaskDir(tempDir, "03-15-test-task", {
        id: "test-task",
        status: "in_progress",
        worktree: true,
        worktree_path: "/tmp/nonexistent-worktree",
      });

      const result = viewTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.worktree?.enabled).toBe(true);
      expect(result.worktree?.path).toBe("/tmp/nonexistent-worktree");
      expect(result.worktree?.exists).toBe(false);
    });

    it("should calculate timing info when task has timestamps", async () => {
      const createdAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      await createTaskDir(tempDir, "03-15-test-task", {
        id: "test-task",
        status: "in_progress",
        createdAt,
      });

      const result = viewTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.timing?.totalDuration).toBeGreaterThan(0);
      expect(result.timing?.totalDurationStr).toBeDefined();
    });

    it("should return error when task directory not found", async () => {
      const result = viewTask(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should return error when task.json cannot be read", async () => {
      // Create task directory without task.json
      await tempDir.mkdir(".viben/tasks/03-15-broken-task");

      const result = viewTask(tempDir.root, "broken-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should support exact match for task name", async () => {
      await createTaskDir(tempDir, "03-15-test-task", {
        id: "test-task",
        title: "Test Task",
      });

      const result = viewTask(tempDir.root, "03-15-test-task");

      expect(result.success).toBe(true);
      expect(result.task?.title).toBe("Test Task");
    });

    it("should support suffix match for task name", async () => {
      await createTaskDir(tempDir, "03-15-my-feature", {
        id: "my-feature",
        title: "My Feature",
      });

      const result = viewTask(tempDir.root, "my-feature");

      expect(result.success).toBe(true);
      expect(result.task?.title).toBe("My Feature");
    });
  });

  describe("deleteTask", () => {
    it("should delete task when it exists", async () => {
      // Mock execSync to actually perform the rm command using fs
      const fs = await import("node:fs");
      vi.mocked(execSync).mockImplementation((cmd) => {
        // Parse the rm -rf command and delete using fs
        if (typeof cmd === "string" && cmd.startsWith('rm -rf "')) {
          const pathMatch = cmd.match(/^rm -rf "(.+)"$/);
          if (pathMatch?.[1]) {
            fs.rmSync(pathMatch[1], { recursive: true, force: true });
          }
        }
        return Buffer.from("");
      });

      await createTaskDir(tempDir, "03-15-test-task", { status: "backlog" });

      // Verify task exists before deletion
      expect(await tempDir.exists(".viben/tasks/03-15-test-task")).toBe(true);

      const result = deleteTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.deleted).toBe("test-task");
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(
        expect.stringContaining("rm -rf"),
        expect.any(Object)
      );

      // Verify task directory was actually deleted
      expect(await tempDir.exists(".viben/tasks/03-15-test-task")).toBe(false);
    });

    it("should return error when task not found", async () => {
      const result = deleteTask(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("finishTask", () => {
    it("should finish task when it exists", async () => {
      await createTaskDir(tempDir, "03-15-test-task", { status: "in_progress" });

      const result = finishTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.cleared).toContain("03-15-test-task");
    });

    it("should return error when task not found", async () => {
      const result = finishTask(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("archiveTask", () => {
    it("should archive task when it exists", async () => {
      await createTaskDir(tempDir, "03-15-test-task", { status: "completed" });
      const yearMonth = getCurrentYearMonth();

      const result = archiveTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.archived).toBe("03-15-test-task");
      // The destination uses mocked getYearMonth in crud.ts, but archiveTaskToDir uses real one
      expect(result.destination).toContain("archive/");

      // Verify task was moved to archive (using real yearMonth)
      expect(await tempDir.exists(".viben/tasks/03-15-test-task")).toBe(false);
      expect(await tempDir.exists(`.viben/tasks/archive/${yearMonth}/03-15-test-task`)).toBe(true);
    });

    it("should return error when task not found", async () => {
      const result = archiveTask(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should update task status to completed before archiving", async () => {
      await createTaskDir(tempDir, "03-15-test-task", { status: "in_progress" });
      const yearMonth = getCurrentYearMonth();

      const result = archiveTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);

      // Verify archived task has completed status (archiveTaskToDir uses real getTodayDate)
      const archivedTask = await tempDir.readJson<{
        status: string;
        completedAt: string;
      }>(`.viben/tasks/archive/${yearMonth}/03-15-test-task/task.json`);
      expect(archivedTask.status).toBe("completed");
      expect(archivedTask.completedAt).toBeDefined();
    });

    it("should create archive directory structure if not exists", async () => {
      await createTaskDir(tempDir, "03-15-test-task", { status: "completed" });
      const yearMonth = getCurrentYearMonth();

      // Ensure archive directory doesn't exist
      expect(await tempDir.exists(`.viben/tasks/archive/${yearMonth}`)).toBe(false);

      const result = archiveTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(await tempDir.exists(`.viben/tasks/archive/${yearMonth}/03-15-test-task`)).toBe(true);
    });
  });

  describe("listArchivedTasks", () => {
    it("should return archived tasks grouped by month", async () => {
      await tempDir.mkdir(".viben/tasks/archive/2024-03");
      await tempDir.mkdir(".viben/tasks/archive/2024-03/03-15-task-1");
      await tempDir.mkdir(".viben/tasks/archive/2024-03/03-10-task-2");
      await tempDir.mkdir(".viben/tasks/archive/2024-02");
      await tempDir.mkdir(".viben/tasks/archive/2024-02/02-20-task-3");

      const result = listArchivedTasks(tempDir.root);

      expect(result.success).toBe(true);
      expect(result.archived.get("2024-03")).toHaveLength(2);
      expect(result.archived.get("2024-02")).toHaveLength(1);
    });

    it("should filter by month when specified", async () => {
      await tempDir.mkdir(".viben/tasks/archive/2024-03");
      await tempDir.mkdir(".viben/tasks/archive/2024-03/03-15-task-1");
      await tempDir.mkdir(".viben/tasks/archive/2024-02");
      await tempDir.mkdir(".viben/tasks/archive/2024-02/02-20-task-2");

      const result = listArchivedTasks(tempDir.root, "2024-03");

      expect(result.success).toBe(true);
      expect(result.archived.size).toBe(1);
      expect(result.archived.get("2024-03")).toEqual(["03-15-task-1"]);
    });

    it("should return empty map when no archived tasks", async () => {
      const result = listArchivedTasks(tempDir.root);

      expect(result.success).toBe(true);
      expect(result.archived.size).toBe(0);
    });

    it("should sort tasks within each month", async () => {
      await tempDir.mkdir(".viben/tasks/archive/2024-03");
      await tempDir.mkdir(".viben/tasks/archive/2024-03/03-15-task-b");
      await tempDir.mkdir(".viben/tasks/archive/2024-03/03-10-task-a");
      await tempDir.mkdir(".viben/tasks/archive/2024-03/03-20-task-c");

      const result = listArchivedTasks(tempDir.root);

      expect(result.success).toBe(true);
      const marchTasks = result.archived.get("2024-03");
      expect(marchTasks).toEqual([
        "03-10-task-a",
        "03-15-task-b",
        "03-20-task-c",
      ]);
    });
  });
});
