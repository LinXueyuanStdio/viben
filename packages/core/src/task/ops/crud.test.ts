/**
 * Task CRUD Operations Tests
 *
 * Tests for:
 * - listTasks: List tasks with optional filters (--mine, --status)
 * - createTask: Create new task with various options
 * - viewTask: View task details
 * - deleteTask: Delete a task
 * - finishTask: Finish/complete a task
 * - archiveTask: Archive a completed task
 * - listArchivedTasks: List archived tasks
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import {
  listTasks,
  createTask,
  viewTask,
  deleteTask,
  finishTask,
  archiveTask,
  listArchivedTasks,
} from "./crud";

// Mock node:fs
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  rmSync: vi.fn(),
}));

// Mock node:child_process
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// Mock viben-workspace functions
vi.mock("../../cli/lib/viben-workspace", () => ({
  getActiveTasks: vi.fn(),
  getDeveloper: vi.fn(),
  resolveTaskDirectory: vi.fn(),
  readTaskJson: vi.fn(),
  writeTaskJson: vi.fn(),
  getTasksDir: vi.fn(),
  findTaskByName: vi.fn(),
  archiveTask: vi.fn(),
  getArchivedTasks: vi.fn(),
  runGitCommand: vi.fn(),
  getTodayDate: vi.fn(),
  getDatePrefix: vi.fn(),
  getYearMonth: vi.fn(),
  slugify: vi.fn(),
  FILE_TASK_JSON: "task.json",
}));

// Get mocked functions
import * as fs from "node:fs";
import * as childProcess from "node:child_process";
import * as vibenWorkspace from "../../cli/lib/viben-workspace";

describe("crud operations", () => {
  const mockRepoRoot = "/mock/repo";

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    vi.mocked(vibenWorkspace.getTasksDir).mockReturnValue(
      join(mockRepoRoot, ".viben/tasks")
    );
    vi.mocked(vibenWorkspace.getTodayDate).mockReturnValue("2024-03-15");
    vi.mocked(vibenWorkspace.getDatePrefix).mockReturnValue("03-15");
    vi.mocked(vibenWorkspace.getYearMonth).mockReturnValue("2024-03");
    vi.mocked(vibenWorkspace.runGitCommand).mockReturnValue({
      stdout: "main",
      stderr: "",
      exitCode: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("listTasks", () => {
    it("should return all active tasks when no filters applied", () => {
      const mockTasks = [
        { dir: "03-15-task-1", status: "backlog", assignee: "dev1", priority: "P1" },
        { dir: "03-15-task-2", status: "queue", assignee: "dev2", priority: "P2" },
      ];
      vi.mocked(vibenWorkspace.getActiveTasks).mockReturnValue(mockTasks);
      vi.mocked(vibenWorkspace.getDeveloper).mockReturnValue("dev1");

      const result = listTasks(mockRepoRoot);

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks).toEqual(mockTasks);
    });

    it("should filter tasks by --mine option", () => {
      const mockTasks = [
        { dir: "03-15-task-1", status: "backlog", assignee: "dev1", priority: "P1" },
        { dir: "03-15-task-2", status: "queue", assignee: "dev2", priority: "P2" },
      ];
      vi.mocked(vibenWorkspace.getActiveTasks).mockReturnValue(mockTasks);
      vi.mocked(vibenWorkspace.getDeveloper).mockReturnValue("dev1");

      const result = listTasks(mockRepoRoot, { mine: true });

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]?.assignee).toBe("dev1");
    });

    it("should return error when --mine is used without developer set", () => {
      vi.mocked(vibenWorkspace.getActiveTasks).mockReturnValue([]);
      vi.mocked(vibenWorkspace.getDeveloper).mockReturnValue(null);

      const result = listTasks(mockRepoRoot, { mine: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain("No developer set");
    });

    it("should filter tasks by --status option", () => {
      const mockTasks = [
        { dir: "03-15-task-1", status: "backlog", assignee: "dev1", priority: "P1" },
        { dir: "03-15-task-2", status: "queue", assignee: "dev2", priority: "P2" },
        { dir: "03-15-task-3", status: "queue", assignee: "dev1", priority: "P3" },
      ];
      vi.mocked(vibenWorkspace.getActiveTasks).mockReturnValue(mockTasks);
      vi.mocked(vibenWorkspace.getDeveloper).mockReturnValue("dev1");

      const result = listTasks(mockRepoRoot, { status: "queue" });

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every((t) => t.status === "queue")).toBe(true);
    });

    it("should combine --mine and --status filters", () => {
      const mockTasks = [
        { dir: "03-15-task-1", status: "backlog", assignee: "dev1", priority: "P1" },
        { dir: "03-15-task-2", status: "queue", assignee: "dev2", priority: "P2" },
        { dir: "03-15-task-3", status: "queue", assignee: "dev1", priority: "P3" },
      ];
      vi.mocked(vibenWorkspace.getActiveTasks).mockReturnValue(mockTasks);
      vi.mocked(vibenWorkspace.getDeveloper).mockReturnValue("dev1");

      const result = listTasks(mockRepoRoot, { mine: true, status: "queue" });

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]?.assignee).toBe("dev1");
      expect(result.tasks[0]?.status).toBe("queue");
    });

    it("should return empty array when no tasks match filters", () => {
      vi.mocked(vibenWorkspace.getActiveTasks).mockReturnValue([]);
      vi.mocked(vibenWorkspace.getDeveloper).mockReturnValue("dev1");

      const result = listTasks(mockRepoRoot, { status: "completed" });

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(0);
    });
  });

  describe("createTask", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(vibenWorkspace.getDeveloper).mockReturnValue("test-dev");
      vi.mocked(vibenWorkspace.slugify).mockImplementation((s) =>
        s.toLowerCase().replace(/\s+/g, "-")
      );
    });

    it("should create a task with required fields", () => {
      const result = createTask(mockRepoRoot, "Test Task");

      expect(result.success).toBe(true);
      expect(result.dirName).toBe("03-15-test-task");
      expect(result.status).toBe("backlog");
      expect(result.contextInitialized).toBeDefined();
      expect(vi.mocked(vibenWorkspace.writeTaskJson)).toHaveBeenCalled();
    });

    it("should create task with custom slug", () => {
      vi.mocked(vibenWorkspace.slugify).mockReturnValue("custom-slug");

      const result = createTask(mockRepoRoot, "Test Task", { slug: "custom-slug" });

      expect(result.success).toBe(true);
      expect(result.dirName).toBe("03-15-custom-slug");
    });

    it("should create task with custom assignee", () => {
      const result = createTask(mockRepoRoot, "Test Task", { assignee: "other-dev" });

      expect(result.success).toBe(true);
      const writeCall = vi.mocked(vibenWorkspace.writeTaskJson).mock.calls[0];
      expect(writeCall?.[1]).toMatchObject({ assignee: "other-dev" });
    });

    it("should create task with custom priority", () => {
      const result = createTask(mockRepoRoot, "Test Task", { priority: "P0" });

      expect(result.success).toBe(true);
      const writeCall = vi.mocked(vibenWorkspace.writeTaskJson).mock.calls[0];
      expect(writeCall?.[1]).toMatchObject({ priority: "P0" });
    });

    it("should create task with custom branch", () => {
      const result = createTask(mockRepoRoot, "Test Task", { branch: "fix/bug-123" });

      expect(result.success).toBe(true);
      const writeCall = vi.mocked(vibenWorkspace.writeTaskJson).mock.calls[0];
      expect(writeCall?.[1]).toMatchObject({ branch: "fix/bug-123" });
    });

    it("should set status to queue when --start is provided", () => {
      const result = createTask(mockRepoRoot, "Test Task", { start: true });

      expect(result.success).toBe(true);
      expect(result.status).toBe("queue");
      const writeCall = vi.mocked(vibenWorkspace.writeTaskJson).mock.calls[0];
      expect(writeCall?.[1]).toMatchObject({ status: "queue" });
      expect((writeCall?.[1] as Record<string, unknown>).queuedAt).toBeDefined();
    });

    it("should fail when no developer is set and no assignee provided", () => {
      vi.mocked(vibenWorkspace.getDeveloper).mockReturnValue(null);

      const result = createTask(mockRepoRoot, "Test Task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No developer set");
    });

    it("should fail when slug cannot be generated", () => {
      vi.mocked(vibenWorkspace.slugify).mockReturnValue("");

      const result = createTask(mockRepoRoot, "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not generate slug");
    });

    it("should use assignee when developer is not set", () => {
      vi.mocked(vibenWorkspace.getDeveloper).mockReturnValue(null);

      const result = createTask(mockRepoRoot, "Test Task", { assignee: "explicit-dev" });

      expect(result.success).toBe(true);
      const writeCall = vi.mocked(vibenWorkspace.writeTaskJson).mock.calls[0];
      expect(writeCall?.[1]).toMatchObject({
        assignee: "explicit-dev",
        creator: "explicit-dev",
      });
    });

    it("should use current git branch as base_branch", () => {
      vi.mocked(vibenWorkspace.runGitCommand).mockReturnValue({
        stdout: "develop\n",
        stderr: "",
        exitCode: 0,
      });

      const result = createTask(mockRepoRoot, "Test Task");

      expect(result.success).toBe(true);
      const writeCall = vi.mocked(vibenWorkspace.writeTaskJson).mock.calls[0];
      expect(writeCall?.[1]).toMatchObject({ base_branch: "develop" });
    });

    it("should default to main when git branch is empty", () => {
      vi.mocked(vibenWorkspace.runGitCommand).mockReturnValue({
        stdout: "",
        stderr: "",
        exitCode: 0,
      });

      const result = createTask(mockRepoRoot, "Test Task");

      expect(result.success).toBe(true);
      const writeCall = vi.mocked(vibenWorkspace.writeTaskJson).mock.calls[0];
      expect(writeCall?.[1]).toMatchObject({ base_branch: "main" });
    });

    it("should set description when provided", () => {
      const result = createTask(mockRepoRoot, "Test Task", {
        description: "This is a test description",
      });

      expect(result.success).toBe(true);
      const writeCall = vi.mocked(vibenWorkspace.writeTaskJson).mock.calls[0];
      expect(writeCall?.[1]).toMatchObject({
        description: "This is a test description",
      });
    });

    it("should set executor and model when provided", () => {
      const result = createTask(mockRepoRoot, "Test Task", {
        executor: "CURSOR",
        model: "claude-3-opus",
      });

      expect(result.success).toBe(true);
      const writeCall = vi.mocked(vibenWorkspace.writeTaskJson).mock.calls[0];
      expect(writeCall?.[1]).toMatchObject({
        executor: "CURSOR",
        model: "claude-3-opus",
      });
    });
  });

  describe("viewTask", () => {
    it("should return task details when task exists", () => {
      const mockTask = {
        id: "test-task",
        name: "test-task",
        title: "Test Task",
        status: "backlog",
        priority: "P2",
      };
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(
        join(mockRepoRoot, ".viben/tasks/03-15-test-task")
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(vibenWorkspace.readTaskJson).mockReturnValue(mockTask);

      const result = viewTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.task).toEqual(mockTask);
    });

    it("should return error when task directory not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = viewTask(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should return error when task.json cannot be read", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(
        join(mockRepoRoot, ".viben/tasks/03-15-test-task")
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(vibenWorkspace.readTaskJson).mockReturnValue(null);

      const result = viewTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("deleteTask", () => {
    it("should delete task when it exists", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(
        join(mockRepoRoot, ".viben/tasks/03-15-test-task")
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = deleteTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.deleted).toBe("test-task");
      expect(vi.mocked(childProcess.execSync)).toHaveBeenCalledWith(
        expect.stringContaining("rm -rf"),
        expect.any(Object)
      );
    });

    it("should return error when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = deleteTask(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("finishTask", () => {
    it("should finish task when it exists", () => {
      const taskDir = join(mockRepoRoot, ".viben/tasks/03-15-test-task");
      vi.mocked(vibenWorkspace.findTaskByName).mockReturnValue(taskDir);
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = finishTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.cleared).toBe(taskDir);
    });

    it("should return error when task not found", () => {
      vi.mocked(vibenWorkspace.findTaskByName).mockReturnValue(null);

      const result = finishTask(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("archiveTask", () => {
    it("should archive task when it exists", () => {
      const taskDir = join(mockRepoRoot, ".viben/tasks/03-15-test-task");
      vi.mocked(vibenWorkspace.findTaskByName).mockReturnValue(taskDir);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(vibenWorkspace.readTaskJson).mockReturnValue({
        status: "completed",
      });
      vi.mocked(vibenWorkspace.archiveTask).mockReturnValue(
        join(mockRepoRoot, ".viben/tasks/archive/2024-03/03-15-test-task")
      );

      const result = archiveTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.archived).toBe("03-15-test-task");
      expect(result.destination).toContain("archive/2024-03/");
    });

    it("should return error when task not found", () => {
      vi.mocked(vibenWorkspace.findTaskByName).mockReturnValue(null);

      const result = archiveTask(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should return error when archive operation fails", () => {
      const taskDir = join(mockRepoRoot, ".viben/tasks/03-15-test-task");
      vi.mocked(vibenWorkspace.findTaskByName).mockReturnValue(taskDir);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(vibenWorkspace.readTaskJson).mockReturnValue({
        status: "completed",
      });
      vi.mocked(vibenWorkspace.archiveTask).mockReturnValue(null);

      const result = archiveTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to move task to archive");
    });

    it("should update task status to completed before archiving", () => {
      const taskDir = join(mockRepoRoot, ".viben/tasks/03-15-test-task");
      vi.mocked(vibenWorkspace.findTaskByName).mockReturnValue(taskDir);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(vibenWorkspace.readTaskJson).mockReturnValue({
        status: "in_progress",
      });
      vi.mocked(vibenWorkspace.archiveTask).mockReturnValue(
        join(mockRepoRoot, ".viben/tasks/archive/2024-03/03-15-test-task")
      );

      const result = archiveTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(vi.mocked(vibenWorkspace.writeTaskJson)).toHaveBeenCalledWith(
        taskDir,
        expect.objectContaining({
          status: "completed",
          completedAt: "2024-03-15",
        })
      );
    });
  });

  describe("listArchivedTasks", () => {
    it("should return archived tasks grouped by month", () => {
      const archivedMap = new Map([
        ["2024-03", ["03-15-task-1", "03-10-task-2"]],
        ["2024-02", ["02-20-task-3"]],
      ]);
      vi.mocked(vibenWorkspace.getArchivedTasks).mockReturnValue(archivedMap);

      const result = listArchivedTasks(mockRepoRoot);

      expect(result.success).toBe(true);
      expect(result.archived.get("2024-03")).toEqual(["03-15-task-1", "03-10-task-2"]);
      expect(result.archived.get("2024-02")).toEqual(["02-20-task-3"]);
    });

    it("should filter by month when specified", () => {
      const archivedMap = new Map([["2024-03", ["03-15-task-1"]]]);
      vi.mocked(vibenWorkspace.getArchivedTasks).mockReturnValue(archivedMap);

      const result = listArchivedTasks(mockRepoRoot, "2024-03");

      expect(result.success).toBe(true);
      expect(vi.mocked(vibenWorkspace.getArchivedTasks)).toHaveBeenCalledWith(
        mockRepoRoot,
        "2024-03"
      );
    });

    it("should return empty map when no archived tasks", () => {
      vi.mocked(vibenWorkspace.getArchivedTasks).mockReturnValue(new Map());

      const result = listArchivedTasks(mockRepoRoot);

      expect(result.success).toBe(true);
      expect(result.archived.size).toBe(0);
    });
  });
});
