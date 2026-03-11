/**
 * Task CRUD operations
 *
 * Create, Read, Update, Delete operations for tasks
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

import {
  getActiveTasks,
  getDeveloper,
  getCurrentTask,
  resolveTaskDirectory,
  readTaskJson,
  writeTaskJson,
  getTasksDir,
  findTaskByName,
  archiveTask as archiveTaskToDir,
  getArchivedTasks,
  clearCurrentTask,
  runGitCommand,
  getTodayDate,
  getDatePrefix,
  getYearMonth,
  slugify,
  FILE_TASK_JSON,
} from "../../cli/lib/viben-workspace";

import type { Platform } from "../../cli/lib/swarm";

// =============================================================================
// Constants
// =============================================================================

/** Mapping from CLI executor IDs to platform names */
const EXECUTOR_TO_PLATFORM: Record<string, Platform> = {
  CLAUDE_CODE: "claude",
  CURSOR: "cursor",
  GEMINI: "gemini",
  OPENCODE: "opencode",
  IFLOW: "iflow",
  CODEX: "codex",
  KILO: "kilo",
  KIRO: "kiro",
  ANTIGRAVITY: "antigravity",
};

import type { TaskJson } from "./types";

// =============================================================================
// Result Types
// =============================================================================

export interface ListTasksResult {
  success: boolean;
  tasks: Array<{
    dir: string;
    status: string;
    assignee: string;
    priority: string;
  }>;
  currentTask: string | null;
  error?: string;
}

export interface CreateTaskOptions {
  slug?: string;
  assignee?: string;
  priority?: string;
  description?: string;
  agent?: string;
  executor?: string;
  model?: string;
  start?: boolean;
  worktree?: boolean;
}

export interface CreateTaskResult {
  success: boolean;
  taskDir?: string;
  dirName?: string;
  status?: string;
  error?: string;
}

export interface ViewTaskResult {
  success: boolean;
  task?: TaskJson;
  error?: string;
}

export interface DeleteTaskResult {
  success: boolean;
  deleted?: string;
  error?: string;
}

export interface FinishTaskResult {
  success: boolean;
  cleared?: string;
  message?: string;
}

export interface ArchiveTaskResult {
  success: boolean;
  archived?: string;
  destination?: string;
  error?: string;
}

export interface ListArchiveResult {
  success: boolean;
  archived: Map<string, string[]>;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Ensure tasks directory exists
 */
function ensureTasksDir(repoRoot: string): string {
  const tasksDir = getTasksDir(repoRoot);
  const archiveDir = join(tasksDir, "archive");

  if (!existsSync(tasksDir)) {
    mkdirSync(tasksDir, { recursive: true });
  }

  if (!existsSync(archiveDir)) {
    mkdirSync(archiveDir, { recursive: true });
  }

  return tasksDir;
}

// =============================================================================
// List Tasks
// =============================================================================

export interface ListTasksOptions {
  mine?: boolean;
  status?: string;
}

/**
 * List tasks with optional filtering
 */
export function listTasks(
  repoRoot: string,
  options: ListTasksOptions = {}
): ListTasksResult {
  const { mine, status } = options;

  const developer = getDeveloper(repoRoot);
  const currentTask = getCurrentTask(repoRoot);

  // Check filters
  if (mine && !developer) {
    return {
      success: false,
      tasks: [],
      currentTask: null,
      error: "No developer set. Run init-developer first or remove --mine flag",
    };
  }

  // Get all active tasks
  let tasks = getActiveTasks(repoRoot);

  // Apply --mine filter
  if (mine && developer) {
    tasks = tasks.filter((t) => t.assignee === developer);
  }

  // Apply --status filter
  if (status) {
    tasks = tasks.filter((t) => t.status === status);
  }

  return {
    success: true,
    tasks,
    currentTask,
  };
}

// =============================================================================
// Create Task
// =============================================================================

/**
 * Create a new task
 */
export function createTask(
  repoRoot: string,
  title: string,
  options: CreateTaskOptions = {}
): CreateTaskResult {
  // Get developer for assignee and creator
  const developer = getDeveloper(repoRoot);
  const assignee = options.assignee || developer;

  if (!assignee) {
    return {
      success: false,
      error: "No developer set. Run init-developer first or use --assignee",
    };
  }

  const creator = developer || assignee;

  // Generate slug if not provided
  const taskSlug = options.slug || slugify(title);
  if (!taskSlug) {
    return {
      success: false,
      error: "Could not generate slug from title. Use --slug to specify manually",
    };
  }

  // Create task directory
  const tasksDir = ensureTasksDir(repoRoot);
  const datePrefix = getDatePrefix();
  const dirName = `${datePrefix}-${taskSlug}`;
  const taskDir = join(tasksDir, dirName);

  const alreadyExists = existsSync(taskDir);
  if (!alreadyExists) {
    mkdirSync(taskDir, { recursive: true });
  }

  // Get current branch as base_branch (PR target)
  const { stdout: branchOut } = runGitCommand(
    ["branch", "--show-current"],
    repoRoot
  );
  const currentBranch = branchOut.trim() || "main";

  const today = getTodayDate();

  // Determine executor/platform
  const executor = options.executor?.toUpperCase() || "CLAUDE_CODE";
  const _platform: Platform = EXECUTOR_TO_PLATFORM[executor] || "claude";

  const taskData: TaskJson = {
    id: taskSlug,
    name: taskSlug,
    title: title,
    description: options.description || "",
    status: "backlog",
    dev_type: undefined,
    scope: undefined,
    priority: options.priority || "P2",
    creator: creator,
    assignee: assignee,
    createdAt: today,
    completedAt: undefined,
    branch: undefined,
    base_branch: currentBranch,
    worktree_path: undefined,
    current_phase: 0,
    next_action: [
      { phase: 1, action: "implement" },
      { phase: 2, action: "check" },
      { phase: 3, action: "finish" },
      { phase: 4, action: "create-pr" },
    ],
    commit: undefined,
    pr_url: undefined,
    subtasks: [],
    relatedFiles: [],
    notes: "",
    agent: options.agent,
    executor: executor,
    model: options.model,
    autoStart: options.start || false,
    worktree: options.worktree || false,
  };

  // If --start is provided, set status to queue directly
  if (options.start) {
    taskData.status = "queue";
    taskData.queuedAt = new Date().toISOString();
  }

  writeTaskJson(taskDir, taskData as unknown as Record<string, unknown>);

  return {
    success: true,
    taskDir,
    dirName,
    status: taskData.status,
  };
}

// =============================================================================
// View Task
// =============================================================================

/**
 * Get task details
 */
export function viewTask(repoRoot: string, taskName: string): ViewTaskResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return {
      success: false,
      error: `Task not found: ${taskName}`,
    };
  }

  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return {
      success: false,
      error: `Task not found: ${taskName}`,
    };
  }

  return {
    success: true,
    task: taskData as unknown as TaskJson,
  };
}

// =============================================================================
// Delete Task
// =============================================================================

/**
 * Delete a task
 */
export function deleteTask(repoRoot: string, taskName: string): DeleteTaskResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);

  if (!taskDir || !existsSync(taskDir)) {
    return {
      success: false,
      error: `Task not found: ${taskName}`,
    };
  }

  // Use rm -rf to delete the directory
  execSync(`rm -rf "${taskDir}"`, { cwd: repoRoot });

  return {
    success: true,
    deleted: taskName,
  };
}

// =============================================================================
// Finish Task
// =============================================================================

/**
 * Clear current task
 */
export function finishTask(repoRoot: string): FinishTaskResult {
  const currentTask = getCurrentTask(repoRoot);

  if (!currentTask) {
    return {
      success: true,
      message: "No current task set",
    };
  }

  clearCurrentTask(repoRoot);

  return {
    success: true,
    cleared: currentTask,
  };
}

// =============================================================================
// Archive Task
// =============================================================================

/**
 * Archive a completed task
 */
export function archiveTask(repoRoot: string, taskName: string): ArchiveTaskResult {
  const tasksDir = getTasksDir(repoRoot);

  // Find task directory
  const taskDir = findTaskByName(taskName, tasksDir);
  if (!taskDir || !existsSync(taskDir)) {
    return {
      success: false,
      error: `Task not found: ${taskName}`,
    };
  }

  const dirName = taskDir.split("/").pop() || "";
  const taskJsonPath = join(taskDir, FILE_TASK_JSON);

  // Update status before archiving
  const today = getTodayDate();
  if (existsSync(taskJsonPath)) {
    const taskData = readTaskJson(taskDir);
    if (taskData) {
      taskData.status = "completed";
      taskData.completedAt = today;
      writeTaskJson(taskDir, taskData);
    }
  }

  // Clear if it's the current task
  const currentTask = getCurrentTask(repoRoot);
  if (currentTask && currentTask.includes(dirName)) {
    clearCurrentTask(repoRoot);
  }

  // Archive the task
  const archiveDest = archiveTaskToDir(taskDir, repoRoot);
  if (archiveDest) {
    const yearMonth = getYearMonth();
    return {
      success: true,
      archived: dirName,
      destination: `archive/${yearMonth}/`,
    };
  } else {
    return {
      success: false,
      error: "Failed to move task to archive",
    };
  }
}

// =============================================================================
// List Archived Tasks
// =============================================================================

/**
 * List archived tasks
 */
export function listArchivedTasks(
  repoRoot: string,
  month?: string
): ListArchiveResult {
  const archived = getArchivedTasks(repoRoot, month);

  return {
    success: true,
    archived,
  };
}
