/**
 * Task CRUD operations
 *
 * Create, Read, Update, Delete operations for tasks
 */

import { existsSync, mkdirSync, statSync, readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";

import {
  getActiveTasks,
  getDeveloper,
  resolveTaskDirectory,
  readTaskJson,
  writeTaskJson,
  getTasksDir,
  findTaskByName,
  archiveTask as archiveTaskToDir,
  getArchivedTasks,
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

import type { TaskJson, IssuePriority } from "./types";
import { DEFAULT_PRIORITY } from "./types";
import { initContext } from "./context-files";

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
  error?: string;
}

export interface CreateTaskOptions {
  slug?: string;
  assignee?: string;
  priority?: string;
  description?: string;
  branch?: string; // custom branch name
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
  contextInitialized?: boolean;
  error?: string;
}

/**
 * File info for task view
 */
export interface TaskFileInfo {
  exists: boolean;
  size?: number;
  modifiedAt?: string;
}

/**
 * Worktree info for task view
 */
export interface TaskWorktreeInfo {
  /** Whether worktree mode is enabled for this task */
  enabled: boolean;
  /** Worktree path (from task.json or detected) */
  path?: string;
  /** Whether the worktree directory exists */
  exists?: boolean;
  /** Current branch in worktree */
  branch?: string;
  /** Whether worktree has uncommitted changes */
  isDirty?: boolean;
  /** Number of uncommitted files */
  uncommittedFiles?: number;
}

/**
 * Extended task view result with file and runtime info
 */
export interface ViewTaskResult {
  success: boolean;
  task?: TaskJson;
  /** Task directory absolute path */
  taskDir?: string;
  /** Task directory name */
  dirName?: string;
  /** Files in task directory */
  files?: {
    prd: TaskFileInfo;
    implementJsonl: TaskFileInfo;
    checkJsonl: TaskFileInfo;
    fixJsonl: TaskFileInfo;
    startLog: TaskFileInfo;
    planLog: TaskFileInfo;
    workLog: TaskFileInfo;
    implementLog: TaskFileInfo;
    reviewLog: TaskFileInfo;
  };
  /** Worktree info */
  worktree?: TaskWorktreeInfo;
  /** Runtime info if task is running */
  runtime?: {
    isRunning: boolean;
    pid?: number;
    sessionId?: string;
    platform?: string;
  };
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
  error?: string;
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

  // Check filters
  if (mine && !developer) {
    return {
      success: false,
      tasks: [],
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

  // Determine branch (scope is no longer needed - title is used directly)
  const branch = options.branch || `feature/${taskSlug}`;

  const taskData: TaskJson = {
    id: taskSlug,
    name: taskSlug,
    title: title,
    description: options.description || "",
    status: "backlog",
    priority: (options.priority || DEFAULT_PRIORITY) as IssuePriority,
    creator: creator,
    assignee: assignee,
    createdAt: today,
    completedAt: undefined,
    branch: branch,
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

  // Initialize empty context files (to be populated by research agent)
  const contextResult = initContext(repoRoot, dirName);
  const contextInitialized = contextResult.success;

  return {
    success: true,
    taskDir,
    dirName,
    status: taskData.status,
    contextInitialized,
  };
}

// =============================================================================
// View Task
// =============================================================================

/**
 * Get file info helper
 */
function getFileInfo(filePath: string): TaskFileInfo {
  if (!existsSync(filePath)) {
    return { exists: false };
  }
  try {
    const stats = statSync(filePath);
    return {
      exists: true,
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    };
  } catch {
    return { exists: false };
  }
}

/**
 * Get task details with extended information
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

  const dirName = basename(taskDir);

  // Gather file info
  const files = {
    prd: getFileInfo(join(taskDir, "prd.md")),
    implementJsonl: getFileInfo(join(taskDir, "implement.jsonl")),
    checkJsonl: getFileInfo(join(taskDir, "check.jsonl")),
    fixJsonl: getFileInfo(join(taskDir, "fix.jsonl")),
    startLog: getFileInfo(join(taskDir, "start.log.jsonl")),
    planLog: getFileInfo(join(taskDir, "plan.log.jsonl")),
    workLog: getFileInfo(join(taskDir, "work.log.jsonl")),
    implementLog: getFileInfo(join(taskDir, "implement.log.jsonl")),
    reviewLog: getFileInfo(join(taskDir, "review.log.jsonl")),
  };

  // Try to get runtime info from session-id.txt
  let runtime: ViewTaskResult["runtime"] = { isRunning: false };
  const sessionIdPath = join(taskDir, "session-id.txt");
  if (existsSync(sessionIdPath)) {
    try {
      const sessionId = readFileSync(sessionIdPath, "utf-8").trim();
      if (sessionId) {
        runtime.sessionId = sessionId;
      }
    } catch {
      // Ignore
    }
  }

  // Check if task has a session_id in task.json
  if (taskData.session_id) {
    runtime.sessionId = taskData.session_id as string;
  }

  // Gather worktree info
  const worktree: TaskWorktreeInfo = {
    enabled: taskData.worktree === true,
  };

  // Check worktree_path from task.json
  if (taskData.worktree_path) {
    worktree.path = taskData.worktree_path as string;
    worktree.exists = existsSync(worktree.path);

    // If worktree exists, get git status
    if (worktree.exists) {
      try {
        // Get current branch
        const branchResult = execSync("git branch --show-current", {
          cwd: worktree.path,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        worktree.branch = branchResult || undefined;

        // Check for uncommitted changes
        const statusResult = execSync("git status --porcelain", {
          cwd: worktree.path,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        const lines = statusResult ? statusResult.split("\n") : [];
        worktree.uncommittedFiles = lines.length;
        worktree.isDirty = lines.length > 0;
      } catch {
        // Git commands failed, worktree might not be a valid git repo
      }
    }
  }

  return {
    success: true,
    task: taskData as unknown as TaskJson,
    taskDir,
    dirName,
    files,
    worktree,
    runtime,
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
 * Finish a task - mark as completed
 */
export function finishTask(repoRoot: string, taskName: string): FinishTaskResult {
  const tasksDir = getTasksDir(repoRoot);

  // Find task directory
  const taskDir = findTaskByName(taskName, tasksDir);
  if (!taskDir || !existsSync(taskDir)) {
    return {
      success: false,
      error: `Task not found: ${taskName}`,
    };
  }

  return {
    success: true,
    cleared: taskDir,
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
