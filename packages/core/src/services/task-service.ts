/**
 * Unified Task Service
 *
 * Provides a unified task storage system using workspace-based directories.
 * All tasks are stored in: .viben/tasks/<date>-<slug>/task.json
 *
 * This replaces the old session-store task methods and CLI task JSON operations.
 */
import { join, basename } from "node:path";
import { mkdir, readFile, writeFile, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";

// =============================================================================
// Types
// =============================================================================

/**
 * Task status - unified state machine (inspired by Auto-Claude)
 *
 * State flow: backlog → queue → in_progress → ai_review → human_review → done/pr_created
 */
export type TaskStatus =
  | "backlog" // Planning/waiting (maps from CLI "planning", Gateway "todo")
  | "queue" // Queued for execution
  | "in_progress" // Currently executing (planning or coding)
  | "ai_review" // AI automatic review (qa_review/qa_fixing)
  | "human_review" // Needs human review
  | "done" // Completed
  | "pr_created" // PR created
  | "error"; // Error state

/**
 * Reason for entering human_review state
 */
export type ReviewReason =
  | "completed" // All subtasks done, QA passed, waiting final approval
  | "errors" // Errors during execution
  | "qa_rejected" // QA found issues
  | "plan_review" // Plan complete, awaiting approval before coding
  | "stopped"; // User manually stopped

/**
 * Subtask status
 */
export type SubtaskStatus = "pending" | "in_progress" | "completed" | "failed";

/**
 * Unified Task interface - combines CLI and Gateway task schemas
 */
export interface UnifiedTask {
  // === Core Identity ===
  /** Unique task ID */
  id: string;
  /** URL-safe slug (used in directory name) */
  name: string;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description?: string;

  // === Status Tracking (Auto-Claude state machine) ===
  /** Primary status */
  status: TaskStatus;
  /** Reason for entering human_review */
  reviewReason?: ReviewReason;
  /** Current phase number (CLI phase system) */
  current_phase?: number;
  /** Next actions by phase */
  next_action?: Array<{ phase: number; action: string }>;

  // === Organization/Classification ===
  /** Priority level */
  priority: string; // P0, P1, P2, P3
  /** Development type */
  dev_type?: string; // backend, frontend, fullstack, test, docs
  /** Task scope */
  scope?: string;

  // === People ===
  /** Task creator */
  creator?: string;
  /** Task assignee */
  assignee?: string;

  // === Git Integration ===
  /** Feature branch name */
  branch?: string;
  /** Base branch for PR */
  base_branch?: string;
  /** Git worktree path */
  worktree_path?: string;
  /** Commit hash */
  commit?: string;
  /** PR URL */
  pr_url?: string;

  // === Context (CLI) ===
  /** Subtask names */
  subtasks?: string[];
  /** Related file paths */
  relatedFiles?: string[];
  /** Free-form notes */
  notes?: string;

  // === Agent/Session Integration (Gateway) ===
  /** Associated agent ID */
  agent?: string;
  /** Session ID */
  sessionId?: string;
  /** Task index within session */
  taskIndex?: number;
  /** User prompt */
  prompt?: string;

  // === Execution Tracking (Gateway) ===
  /** API cost in USD */
  cost?: number;
  /** Execution duration in ms */
  duration?: number;
  /** Whether task is favorited */
  favorite?: boolean;
  /** Has in-progress attempt (kanban display) */
  hasInProgressAttempt?: boolean;
  /** Last attempt failed (kanban display) */
  lastAttemptFailed?: boolean;
  /** Executor name */
  executor?: string;

  // === Workspace ===
  /** Workspace path (absolute) */
  workspacePath?: string;

  // === Timestamps ===
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt?: string;
  /** Completion timestamp */
  completedAt?: string;
}

/**
 * Legacy CLI TaskStatus for compatibility
 */
type LegacyCLIStatus = "planning" | "in_progress" | "completed";

/**
 * Legacy Gateway TaskStatus for compatibility
 */
type LegacyGatewayStatus =
  | "todo"
  | "running"
  | "inprogress"
  | "completed"
  | "done"
  | "error"
  | "inreview"
  | "stopped"
  | "cancelled";

// =============================================================================
// Status Mapping Functions
// =============================================================================

/**
 * Map CLI status to unified TaskStatus
 */
export function mapCLIStatus(status: LegacyCLIStatus | string): TaskStatus {
  switch (status) {
    case "planning":
      return "backlog";
    case "in_progress":
      return "in_progress";
    case "completed":
      return "done";
    default:
      return "backlog";
  }
}

/**
 * Map Gateway status to unified TaskStatus
 */
export function mapGatewayStatus(status: LegacyGatewayStatus | string): TaskStatus {
  switch (status) {
    case "todo":
      return "backlog";
    case "running":
    case "inprogress":
      return "in_progress";
    case "completed":
    case "done":
      return "done";
    case "error":
      return "error";
    case "inreview":
      return "human_review";
    case "stopped":
    case "cancelled":
      return "human_review"; // With reviewReason: "stopped"
    default:
      return "backlog";
  }
}

/**
 * Map unified TaskStatus to legacy CLI status
 */
export function toCliStatus(status: TaskStatus): string {
  switch (status) {
    case "backlog":
    case "queue":
      return "planning";
    case "in_progress":
    case "ai_review":
    case "human_review":
      return "in_progress";
    case "done":
    case "pr_created":
      return "completed";
    case "error":
      return "in_progress"; // Keep as in_progress for CLI
    default:
      return "planning";
  }
}

/**
 * Map unified TaskStatus to Kanban-compatible status (for Gateway API)
 */
export function toKanbanStatus(
  status: TaskStatus
): "todo" | "inprogress" | "inreview" | "done" | "cancelled" {
  switch (status) {
    case "backlog":
    case "queue":
      return "todo";
    case "in_progress":
    case "ai_review":
      return "inprogress";
    case "human_review":
      return "inreview";
    case "done":
    case "pr_created":
      return "done";
    case "error":
      return "inreview";
    default:
      return "todo";
  }
}

// =============================================================================
// Constants
// =============================================================================

const DIR_VIBEN = ".viben";
const DIR_TASKS = "tasks";
const FILE_TASK_JSON = "task.json";

// =============================================================================
// Task Service
// =============================================================================

/**
 * Unified Task Service
 *
 * All tasks are stored in workspace directories:
 * <workspace>/.viben/tasks/<date>-<slug>/task.json
 */
export class TaskService {
  // ==========================================================================
  // Path Helpers
  // ==========================================================================

  /**
   * Get the tasks directory for a workspace
   */
  private tasksDir(workspacePath: string): string {
    return join(workspacePath, DIR_VIBEN, DIR_TASKS);
  }

  /**
   * Get the task.json path for a task directory
   */
  private taskJsonPath(taskDir: string): string {
    return join(taskDir, FILE_TASK_JSON);
  }

  /**
   * Generate a date prefix for task directories (MM-DD format)
   */
  private getDatePrefix(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${month}-${day}`;
  }

  /**
   * Generate a URL-safe slug from a string
   */
  private slugify(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /**
   * Generate a unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // ==========================================================================
  // Core CRUD Operations
  // ==========================================================================

  /**
   * Get a task from a task directory
   *
   * @param taskDir - Absolute path to task directory
   * @returns Task data or null if not found
   */
  async getTask(taskDir: string): Promise<UnifiedTask | null> {
    const jsonPath = this.taskJsonPath(taskDir);

    if (!existsSync(jsonPath)) {
      return null;
    }

    try {
      const content = await readFile(jsonPath, "utf-8");
      const data = JSON.parse(content) as UnifiedTask;

      // Normalize legacy status values
      if (data.status) {
        const normalizedStatus = this.normalizeStatus(data.status as string);
        if (normalizedStatus !== data.status) {
          data.status = normalizedStatus;
        }
      }

      return data;
    } catch {
      return null;
    }
  }

  /**
   * Create a new task in a workspace
   *
   * @param workspacePath - Absolute path to workspace
   * @param task - Partial task data (id, name, title are required or generated)
   * @returns Object with taskDir and task data
   */
  async createTask(
    workspacePath: string,
    task: Partial<UnifiedTask>
  ): Promise<{ taskDir: string; task: UnifiedTask }> {
    const tasksDir = this.tasksDir(workspacePath);

    // Ensure tasks directory exists
    await mkdir(tasksDir, { recursive: true });

    // Generate slug from title or use provided name
    const slug = task.name || (task.title ? this.slugify(task.title) : this.generateTaskId());
    const datePrefix = this.getDatePrefix();
    const dirName = `${datePrefix}-${slug}`;
    const taskDir = join(tasksDir, dirName);

    // Create task directory
    await mkdir(taskDir, { recursive: true });

    const now = new Date().toISOString();
    const today = now.split("T")[0];

    // Build full task object
    const fullTask: UnifiedTask = {
      id: task.id || this.generateTaskId(),
      name: slug,
      title: task.title || slug,
      description: task.description,
      status: task.status || "backlog",
      reviewReason: task.reviewReason,
      current_phase: task.current_phase ?? 0,
      next_action: task.next_action ?? [
        { phase: 1, action: "implement" },
        { phase: 2, action: "check" },
        { phase: 3, action: "finish" },
        { phase: 4, action: "create-pr" },
      ],
      priority: task.priority || "P2",
      dev_type: task.dev_type,
      scope: task.scope,
      creator: task.creator,
      assignee: task.assignee,
      branch: task.branch,
      base_branch: task.base_branch,
      worktree_path: task.worktree_path,
      commit: task.commit,
      pr_url: task.pr_url,
      subtasks: task.subtasks ?? [],
      relatedFiles: task.relatedFiles ?? [],
      notes: task.notes ?? "",
      agent: task.agent,
      sessionId: task.sessionId,
      taskIndex: task.taskIndex ?? 0,
      prompt: task.prompt,
      cost: task.cost,
      duration: task.duration,
      favorite: task.favorite,
      hasInProgressAttempt: task.hasInProgressAttempt ?? task.status === "in_progress",
      lastAttemptFailed: task.lastAttemptFailed ?? false,
      executor: task.executor,
      workspacePath,
      createdAt: task.createdAt || today,
      updatedAt: now,
      completedAt: task.completedAt,
    };

    // Write task.json
    const jsonPath = this.taskJsonPath(taskDir);
    await writeFile(jsonPath, JSON.stringify(fullTask, null, 2), "utf-8");

    return { taskDir, task: fullTask };
  }

  /**
   * Update a task
   *
   * @param taskDir - Absolute path to task directory
   * @param updates - Partial task data to update
   * @returns Updated task data
   */
  async updateTask(taskDir: string, updates: Partial<UnifiedTask>): Promise<UnifiedTask> {
    const existing = await this.getTask(taskDir);
    if (!existing) {
      throw new Error(`Task not found: ${taskDir}`);
    }

    const now = new Date().toISOString();

    // Build updated task
    const updated: UnifiedTask = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID from being changed
      name: existing.name, // Prevent name from being changed
      updatedAt: now,
    };

    // Set completedAt if status changed to done/pr_created
    if (
      updates.status &&
      (updates.status === "done" || updates.status === "pr_created") &&
      existing.status !== updates.status
    ) {
      updated.completedAt = now;
    }

    // Update attempt status based on new status
    if (updates.status !== undefined) {
      updated.hasInProgressAttempt = updates.status === "in_progress" || updates.status === "ai_review";
      updated.lastAttemptFailed = updates.status === "error" || updates.status === "human_review";
    }

    // Write updated task.json
    const jsonPath = this.taskJsonPath(taskDir);
    await writeFile(jsonPath, JSON.stringify(updated, null, 2), "utf-8");

    return updated;
  }

  /**
   * Delete a task
   *
   * @param taskDir - Absolute path to task directory
   * @returns True if deleted
   */
  async deleteTask(taskDir: string): Promise<boolean> {
    if (!existsSync(taskDir)) {
      return false;
    }

    try {
      await rm(taskDir, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all tasks in a workspace
   *
   * @param workspacePath - Absolute path to workspace
   * @returns Array of tasks
   */
  async listTasks(workspacePath: string): Promise<UnifiedTask[]> {
    const tasksDir = this.tasksDir(workspacePath);

    if (!existsSync(tasksDir)) {
      return [];
    }

    const tasks: UnifiedTask[] = [];

    try {
      const entries = await readdir(tasksDir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip archive directory and non-directories
        if (!entry.isDirectory() || entry.name === "archive") {
          continue;
        }

        const taskDir = join(tasksDir, entry.name);
        const task = await this.getTask(taskDir);
        if (task) {
          // Ensure workspacePath is set
          task.workspacePath = task.workspacePath || workspacePath;
          tasks.push(task);
        }
      }
    } catch {
      // Ignore errors
    }

    // Sort by createdAt descending
    tasks.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return tasks;
  }

  /**
   * Find a task by name in a workspace
   *
   * Supports:
   * - Exact match: "01-31-my-task"
   * - Suffix match: "my-task" matches "01-31-my-task"
   *
   * @param workspacePath - Absolute path to workspace
   * @param name - Task name to find
   * @returns Absolute path to task directory, or null if not found
   */
  async findTaskByName(workspacePath: string, name: string): Promise<string | null> {
    const tasksDir = this.tasksDir(workspacePath);

    if (!name || !existsSync(tasksDir)) {
      return null;
    }

    // Try exact match first
    const exactPath = join(tasksDir, name);
    if (existsSync(exactPath)) {
      try {
        const stats = await stat(exactPath);
        if (stats.isDirectory()) {
          return exactPath;
        }
      } catch {
        // Ignore
      }
    }

    // Try suffix match
    try {
      const entries = await readdir(tasksDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.endsWith(`-${name}`)) {
          return join(tasksDir, entry.name);
        }
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Find a task by ID in a workspace
   *
   * @param workspacePath - Absolute path to workspace
   * @param id - Task ID to find
   * @returns Task directory path or null
   */
  async findTaskById(workspacePath: string, id: string): Promise<string | null> {
    const tasks = await this.listTasks(workspacePath);
    for (const task of tasks) {
      if (task.id === id) {
        // Reconstruct task directory from workspacePath and name
        const tasksDir = this.tasksDir(workspacePath);
        // Need to find the actual directory name
        try {
          const entries = await readdir(tasksDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const taskDir = join(tasksDir, entry.name);
              const t = await this.getTask(taskDir);
              if (t && t.id === id) {
                return taskDir;
              }
            }
          }
        } catch {
          // Ignore
        }
      }
    }
    return null;
  }

  // ==========================================================================
  // Status Helpers
  // ==========================================================================

  /**
   * Check if a status is a settled state (no automatic transitions)
   */
  isSettledState(status: TaskStatus): boolean {
    return ["backlog", "human_review", "error", "pr_created", "done"].includes(status);
  }

  /**
   * Check if a status is an active state (task is being worked on)
   */
  isActiveState(status: TaskStatus): boolean {
    return ["queue", "in_progress", "ai_review"].includes(status);
  }

  /**
   * Check if a task is completed
   */
  isCompleted(task: UnifiedTask): boolean {
    if (task.status === "done" || task.status === "pr_created") {
      return true;
    }
    if (task.status === "human_review" && task.reviewReason === "completed") {
      return true;
    }
    return false;
  }

  /**
   * Normalize a legacy status value to the unified TaskStatus
   */
  normalizeStatus(status: string): TaskStatus {
    // First try as CLI status
    if (["planning", "in_progress", "completed"].includes(status)) {
      return mapCLIStatus(status as LegacyCLIStatus);
    }
    // Then try as Gateway status
    const gatewayStatuses = [
      "todo",
      "running",
      "inprogress",
      "completed",
      "done",
      "error",
      "inreview",
      "stopped",
      "cancelled",
    ];
    if (gatewayStatuses.includes(status)) {
      return mapGatewayStatus(status as LegacyGatewayStatus);
    }
    // Already a unified status
    if (
      [
        "backlog",
        "queue",
        "in_progress",
        "ai_review",
        "human_review",
        "done",
        "pr_created",
        "error",
      ].includes(status)
    ) {
      return status as TaskStatus;
    }
    // Default
    return "backlog";
  }

  // ==========================================================================
  // Compatibility Methods
  // ==========================================================================

  /**
   * Get the directory name from a task directory path
   */
  getTaskDirName(taskDir: string): string {
    return basename(taskDir);
  }

  /**
   * Get the tasks directory path for a workspace
   */
  getTasksDir(workspacePath: string): string {
    return this.tasksDir(workspacePath);
  }
}

/**
 * Singleton task service instance
 */
export const taskService = new TaskService();
