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
import { taskLock } from "../utils/async-lock";

// =============================================================================
// Types
// =============================================================================

/**
 * Task status - unified state machine (inspired by Auto-Claude)
 *
 * State flow: backlog → queue → in_progress → human_review → completed
 *
 * Note: ai_review was removed - use executionPhase (check/fix) instead
 * Note: paused allows tasks to be paused and resumed later
 * Note: pr_created was removed - PR creation is tracked via pr_url field
 *
 * Terminal states: completed, failed, cancelled
 */
export type TaskStatus =
  | "backlog" // 待办 - Tasks waiting to be started
  | "queue" // Queued for execution
  | "in_progress" // Currently executing (plan or implement)
  | "paused" // Task paused, can be resumed later
  | "human_review" // Needs human review
  | "completed" // Successfully completed
  | "failed" // Execution failed
  | "cancelled" // Cancelled by user
  | "archived"; // Archived for reference

/**
 * Legacy status names for backward compatibility
 */
export type LegacyTaskStatus = "done" | "error" | "pr_created";

/**
 * Reason for entering human_review state
 */
export type ReviewReason =
  | "completed" // All subtasks done, QA passed, waiting final approval
  | "errors" // Errors during execution
  | "qa_rejected" // QA found issues
  | "plan_review" // Plan complete, awaiting approval before implement
  | "stopped"; // User manually stopped

/**
 * Subtask status
 */
export type SubtaskStatus = "pending" | "in_progress" | "completed" | "failed";

/**
 * Structured subtask information
 */
export interface SubtaskInfo {
  id: string;
  name: string;
  title?: string;
  status: SubtaskStatus;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Execution phase for running tasks
 */
export type ExecutionPhase = "plan" | "implement" | "check" | "fix" | "complete";

/**
 * Execution progress tracking
 */
export interface ExecutionProgress {
  phase: ExecutionPhase;
  phaseProgress?: number; // 0-100
}

// =============================================================================
// XState State Machine Types (Task State Machine System)
// =============================================================================

/**
 * XState state value type
 * Can be a simple string (top-level state) or nested object (for in_progress substates)
 */
export type XStateValue = string | { in_progress: ExecutionPhase };

/**
 * Task event type for state machine transitions
 * This is a looser version for JSON storage - the task module has a stricter version
 */
export type TaskEventType =
  | "QUEUE" | "START" | "DEQUEUE"
  | "PLAN_COMPLETE" | "PLAN_FAILED"
  | "SUBTASK_COMPLETE" | "ALL_SUBTASKS_DONE" | "IMPLEMENT_FAILED"
  | "CHECK_PASSED" | "CHECK_FAILED" | "FIX_COMPLETE" | "FIX_FAILED"
  | "USER_STOPPED" | "APPROVED" | "REJECTED"
  | "PAUSE" | "RESUME"
  | "RETRY" | "ABANDON"
  | "CANCEL" // Cancel task
  | "ARCHIVE"; // Archive task

/**
 * Task event for state machine transitions
 */
export interface TaskEvent {
  /** Unique event identifier (UUID) */
  eventId: string;
  /** Monotonically increasing sequence number for ordering */
  sequence: number;
  /** Event type - determines the state transition */
  type: TaskEventType;
  /** ISO timestamp when event was created */
  timestamp: string;
  /** Optional payload data for the event */
  payload?: Record<string, unknown>;
}

// =============================================================================
// Extended Metadata Types (Task State Machine System)
// =============================================================================

/**
 * Task source information
 */
export interface TaskSource {
  type: "manual" | "github_issue" | "linear" | "ideation";
  ref?: string;
  importedAt?: string;
}

/**
 * Task classification for prioritization
 */
export interface TaskClassification {
  category: "feature" | "bugfix" | "refactor" | "docs";
  complexity: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  priority: "P0" | "P1" | "P2" | "P3";
}

/**
 * Agent configuration for task execution
 */
export interface AgentConfig {
  model?: string;
  thinkingLevel?: "low" | "medium" | "high";
  maxRetries?: number;
}

/**
 * Git configuration for task
 */
export interface GitConfig {
  baseBranch?: string;
  branchPrefix?: string;
  useWorktree?: boolean;
}

/**
 * Extended metadata for task state machine
 */
export interface TaskMetadata {
  source?: TaskSource;
  classification?: TaskClassification;
  agentConfig?: AgentConfig;
  gitConfig?: GitConfig;
}

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
  /** Subtask names (legacy string array) */
  subtasks?: string[];
  /** Structured subtask details */
  subtaskDetails?: SubtaskInfo[];
  /** Execution progress tracking */
  executionProgress?: ExecutionProgress;
  /** Related file paths */
  relatedFiles?: string[];
  /** Free-form notes */
  notes?: string;

  // === Agent/Session Integration (Gateway) ===
  /** Associated agent ID */
  agent?: string;
  /** Session ID */
  sessionId?: string;
  /** Model ID for task execution */
  model?: string;
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

  // === XState State Machine (Task State Machine System) ===
  /** XState state machine current state */
  xstateState?: XStateValue;
  /** Last event that was applied (kept for quick access to latest state) */
  lastEvent?: TaskEvent;
  /**
   * @deprecated Event history is now stored in events.jsonl file.
   * Use TaskEventStore.getEventHistory() to read events.
   * This field is kept for backward compatibility during migration.
   */
  eventHistory?: TaskEvent[];
  /** Extended metadata for classification and configuration */
  metadata?: TaskMetadata;

  // === Task Relationships (Task Dependency System) ===
  /** Task IDs this task depends on - task can only start when all dependencies are completed */
  dependsOn?: string[];
  /** Parent task ID (used for task splitting) */
  parentTaskId?: string;
  /** Child task IDs (reverse reference for task splitting) */
  childTaskIds?: string[];

  // === Scheduling Information ===
  /** Queue entry timestamp (ISO string) - used for FIFO sorting within same priority */
  queuedAt?: string;
  /** Auto-start agent when enqueued */
  autoStart?: boolean;
  /** Run agent in a git worktree (isolated branch) */
  worktree?: boolean;

  // === Template Support ===
  /** Whether this task is a template for creating other tasks */
  is_template?: boolean;

  // === State Machine Context Persistence ===
  /**
   * Persisted state machine context for pause/resume across restarts.
   * Contains currentSubtaskIndex, paused_snapshot, etc.
   */
  machine_context?: {
    /** Current subtask index (0-based) */
    current_subtask_index: number;
    /** Whether plan requires human review before implement */
    requires_plan_review: boolean;
    /** Complete snapshot saved when task is paused */
    paused_snapshot?: {
      from_state: string | { in_progress: string };
      subtask_index: number;
      execution_context?: Record<string, unknown>;
      paused_at: string;
    };
  };
}

// =============================================================================
// Status Constants
// =============================================================================

/**
 * All valid unified task statuses
 */
export const VALID_TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "queue",
  "in_progress",
  "paused",
  "human_review",
  "completed",
  "failed",
  "cancelled",
  "archived",
];

/**
 * Legacy status mapping for backward compatibility
 */
export const LEGACY_STATUS_MAP: Record<LegacyTaskStatus, TaskStatus> = {
  done: "completed",
  error: "failed",
  pr_created: "completed",
};

/**
 * Check if a status is valid
 */
export function isValidTaskStatus(status: string): status is TaskStatus {
  return VALID_TASK_STATUSES.includes(status as TaskStatus);
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
   * This method is protected by an async lock to prevent race conditions
   * when multiple concurrent requests try to update the same task.
   * The lock ensures that read-modify-write operations are atomic.
   *
   * @param taskDir - Absolute path to task directory
   * @param updates - Partial task data to update
   * @returns Updated task data
   */
  async updateTask(taskDir: string, updates: Partial<UnifiedTask>): Promise<UnifiedTask> {
    // Use lock to prevent concurrent modifications to the same task
    // This ensures the read-modify-write sequence is atomic
    return taskLock.withLock(taskDir, async () => {
      return this.updateTaskUnsafe(taskDir, updates);
    });
  }

  /**
   * Internal method to update task without locking
   * Should only be called from within a lock context
   */
  private async updateTaskUnsafe(taskDir: string, updates: Partial<UnifiedTask>): Promise<UnifiedTask> {
    const existing = await this.getTask(taskDir);
    if (!existing) {
      throw new Error(`Task not found: ${taskDir}`);
    }

    // Configuration locking: agent/sessionId/executor/model cannot be changed after task is queued
    // See: .trellis/spec/modules/task-system.md "配置锁定规则"
    if (existing.status !== "backlog") {
      const lockedFields = ["agent", "sessionId", "executor", "model"] as const;
      for (const field of lockedFields) {
        if (updates[field] !== undefined && updates[field] !== existing[field]) {
          throw new Error(
            `Cannot modify '${field}' after task is queued. ` +
            `Task status is '${existing.status}', locked fields can only be changed in 'backlog' status.`
          );
        }
      }
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

    // Set completedAt if status changed to a terminal state (completed, failed, cancelled)
    if (
      updates.status &&
      (updates.status === "completed" || updates.status === "failed" || updates.status === "cancelled") &&
      existing.status !== updates.status
    ) {
      updated.completedAt = now;
    }

    // Update attempt status based on new status
    if (updates.status !== undefined) {
      updated.hasInProgressAttempt = updates.status === "in_progress";

      // Fix: Only mark lastAttemptFailed=true for actual failures
      // human_review with reviewReason "completed" is NOT a failure
      if (updates.status === "failed") {
        updated.lastAttemptFailed = true;
      } else if (updates.status === "human_review") {
        // Determine if this is a failure based on reviewReason
        // Failure reasons: qa_rejected, errors, stopped
        // Success reasons: completed, plan_review (awaiting approval, not a failure)
        const failureReasons: ReviewReason[] = ["qa_rejected", "errors", "stopped"];
        const currentReviewReason = updates.reviewReason ?? existing.reviewReason;
        updated.lastAttemptFailed = currentReviewReason
          ? failureReasons.includes(currentReviewReason)
          : false;
      } else {
        updated.lastAttemptFailed = false;
      }
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
   * @param options - Options for listing tasks
   * @param options.includeArchived - Include tasks from archive directory (default: true)
   * @returns Array of tasks
   */
  async listTasks(
    workspacePath: string,
    options: { includeArchived?: boolean } = {}
  ): Promise<UnifiedTask[]> {
    const { includeArchived = true } = options;
    const tasksDir = this.tasksDir(workspacePath);

    if (!existsSync(tasksDir)) {
      return [];
    }

    const tasks: UnifiedTask[] = [];

    try {
      const entries = await readdir(tasksDir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip non-directories
        if (!entry.isDirectory()) {
          continue;
        }

        // Handle archive directory separately
        if (entry.name === "archive") {
          if (includeArchived) {
            const archivedTasks = await this.listArchivedTasks(workspacePath);
            tasks.push(...archivedTasks);
          }
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
   * List archived tasks from .viben/tasks/archive/
   *
   * Archive structure: archive/{year-month}/{task-dir}/task.json
   * e.g., archive/2026-01/01-15-my-task/task.json
   *
   * @param workspacePath - Absolute path to workspace
   * @returns Array of archived tasks
   */
  async listArchivedTasks(workspacePath: string): Promise<UnifiedTask[]> {
    const archiveDir = join(this.tasksDir(workspacePath), "archive");

    if (!existsSync(archiveDir)) {
      return [];
    }

    const tasks: UnifiedTask[] = [];

    try {
      // List year-month directories (e.g., 2026-01, 2026-02)
      const monthDirs = await readdir(archiveDir, { withFileTypes: true });

      for (const monthDir of monthDirs) {
        if (!monthDir.isDirectory()) {
          continue;
        }

        const monthPath = join(archiveDir, monthDir.name);

        // List task directories within each month
        const taskDirs = await readdir(monthPath, { withFileTypes: true });

        for (const taskEntry of taskDirs) {
          if (!taskEntry.isDirectory()) {
            continue;
          }

          const taskDir = join(monthPath, taskEntry.name);
          const task = await this.getTask(taskDir);
          if (task) {
            // Ensure workspacePath is set and status is archived
            task.workspacePath = task.workspacePath || workspacePath;
            // Mark as archived if not already
            if (task.status !== "archived") {
              task.status = "archived";
            }
            tasks.push(task);
          }
        }
      }
    } catch {
      // Ignore errors
    }

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
   * Searches both active tasks and archived tasks.
   *
   * @param workspacePath - Absolute path to workspace
   * @param id - Task ID to find
   * @returns Task directory path or null
   */
  async findTaskById(workspacePath: string, id: string): Promise<string | null> {
    const tasksDir = this.tasksDir(workspacePath);

    if (!existsSync(tasksDir)) {
      return null;
    }

    // Search active tasks first
    try {
      const entries = await readdir(tasksDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === "archive") {
          continue;
        }
        const taskDir = join(tasksDir, entry.name);
        const task = await this.getTask(taskDir);
        if (task && task.id === id) {
          return taskDir;
        }
      }
    } catch {
      // Ignore
    }

    // Search archived tasks
    const archiveDir = join(tasksDir, "archive");
    if (existsSync(archiveDir)) {
      try {
        const monthDirs = await readdir(archiveDir, { withFileTypes: true });
        for (const monthDir of monthDirs) {
          if (!monthDir.isDirectory()) {
            continue;
          }
          const monthPath = join(archiveDir, monthDir.name);
          const taskDirs = await readdir(monthPath, { withFileTypes: true });
          for (const taskEntry of taskDirs) {
            if (!taskEntry.isDirectory()) {
              continue;
            }
            const taskDir = join(monthPath, taskEntry.name);
            const task = await this.getTask(taskDir);
            if (task && task.id === id) {
              return taskDir;
            }
          }
        }
      } catch {
        // Ignore
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
    return ["backlog", "paused", "human_review", "completed", "failed", "cancelled", "archived"].includes(status);
  }

  /**
   * Check if a status is an active state (task is being worked on)
   */
  isActiveState(status: TaskStatus): boolean {
    return ["queue", "in_progress", "paused"].includes(status);
  }

  /**
   * Check if a task is completed
   */
  isCompleted(task: UnifiedTask): boolean {
    if (task.status === "completed") {
      return true;
    }
    if (task.status === "human_review" && task.reviewReason === "completed") {
      return true;
    }
    return false;
  }

  /**
   * Normalize a status value to the unified TaskStatus
   * Handles legacy status names (done, error, pr_created) for backward compatibility
   */
  normalizeStatus(status: string): TaskStatus {
    // Check if it's already a valid status
    if (isValidTaskStatus(status)) {
      return status;
    }

    // Check for legacy status names
    if (status in LEGACY_STATUS_MAP) {
      return LEGACY_STATUS_MAP[status as LegacyTaskStatus];
    }

    // Default for invalid status
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

  // ==========================================================================
  // Task Specs Data (PRD, Logs, Task Dir)
  // ==========================================================================

  /**
   * Get task specs data from the task directory
   *
   * Reads:
   * - prd.md (PRD content)
   * - implementation_plan.json (subtasks)
   * - logs/ directory (execution logs)
   * - Returns task_dir path for file browsing
   *
   * @param taskDir - Absolute path to task directory
   * @returns TaskSpecsData object
   */
  async getTaskSpecsData(taskDir: string): Promise<TaskSpecsData> {
    const result: TaskSpecsData = {
      prdContent: null,
      prdPath: null,
      subtasks: [],
      logs: null,
      taskDir, // Return task directory path for file browsing
    };

    // 1. Read PRD content (prd.md)
    const prdPath = join(taskDir, "prd.md");
    if (existsSync(prdPath)) {
      try {
        result.prdContent = await readFile(prdPath, "utf-8");
        result.prdPath = prdPath;
      } catch {
        // Ignore read errors
      }
    }

    // 2. Read implementation plan (implementation_plan.json)
    const planPath = join(taskDir, "implementation_plan.json");
    if (existsSync(planPath)) {
      try {
        const planContent = await readFile(planPath, "utf-8");
        const plan = JSON.parse(planContent) as ImplementationPlanFile;
        result.subtasks = plan.subtasks || [];
      } catch {
        // Ignore parse errors
      }
    }

    // 3. Read logs from logs/ directory
    const logsDir = join(taskDir, "logs");
    if (existsSync(logsDir)) {
      try {
        const logEntries = await readdir(logsDir, { withFileTypes: true });
        const phases: TaskLogPhase[] = [];

        // Standard phase files
        const standardPhases = ["plan", "implement", "check"];

        for (const entry of logEntries) {
          if (entry.isFile() && entry.name.endsWith(".log")) {
            const phaseName = entry.name.replace(".log", "");
            const logPath = join(logsDir, entry.name);

            try {
              const logContent = await readFile(logPath, "utf-8");
              const entries = this.parseLogContent(logContent, phaseName);

              // Determine phase status
              let status: TaskLogPhase["status"] = "pending";
              if (entries.length > 0) {
                const hasError = entries.some((e) => e.type === "error");
                const hasSuccess = entries.some((e) => e.type === "success");
                if (hasError) status = "failed";
                else if (hasSuccess) status = "complete";
                else status = "running";
              }

              phases.push({
                id: phaseName,
                name: phaseName.charAt(0).toUpperCase() + phaseName.slice(1),
                status,
                entries,
                order: standardPhases.indexOf(phaseName),
              });
            } catch {
              // Ignore unreadable files
            }
          }
        }

        // Sort by order (standard phases first)
        phases.sort((a, b) => {
          const orderA = a.order !== undefined && a.order >= 0 ? a.order : 999;
          const orderB = b.order !== undefined && b.order >= 0 ? b.order : 999;
          return orderA - orderB;
        });

        if (phases.length > 0) {
          result.logs = { phases };
        }
      } catch {
        // Ignore errors
      }
    }

    return result;
  }

  /**
   * Parse log file content into structured log entries
   */
  private parseLogContent(content: string, phaseId: string): TaskLogEntry[] {
    const entries: TaskLogEntry[] = [];
    const lines = content.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      // Try to parse structured format: [timestamp] [level] message
      const match = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/);

      if (match) {
        const [, timestamp, level, message] = match;
        entries.push({
          id: `${phaseId}-${entries.length}`,
          type: this.mapLogLevel(level),
          message,
          timestamp: timestamp || new Date().toISOString(),
        });
      } else {
        // Fallback: plain text
        entries.push({
          id: `${phaseId}-${entries.length}`,
          type: "text",
          message: line,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return entries;
  }

  /**
   * Map log level string to entry type
   */
  private mapLogLevel(level: string): TaskLogEntryType {
    const normalized = level.toLowerCase().trim();
    switch (normalized) {
      case "error":
      case "err":
        return "error";
      case "warn":
      case "warning":
        return "warning";
      case "success":
      case "ok":
        return "success";
      case "info":
        return "info";
      case "tool_start":
      case "start":
        return "tool_start";
      case "tool_end":
      case "end":
        return "tool_end";
      default:
        return "text";
    }
  }
}

// =============================================================================
// Task Specs Types
// =============================================================================

/**
 * Log entry type
 */
export type TaskLogEntryType =
  | "text"
  | "error"
  | "warning"
  | "success"
  | "info"
  | "tool_start"
  | "tool_end";

/**
 * A single log entry
 */
export interface TaskLogEntry {
  id: string;
  type: TaskLogEntryType;
  message: string;
  timestamp: string;
  details?: string;
}

/**
 * Log phase status
 */
export type TaskLogPhaseStatus = "pending" | "running" | "complete" | "failed";

/**
 * A log phase (plan, implement, check)
 */
export interface TaskLogPhase {
  id: string;
  name: string;
  status: TaskLogPhaseStatus;
  entries: TaskLogEntry[];
  order?: number;
}

/**
 * Task logs structure
 */
export interface TaskLogs {
  phases: TaskLogPhase[];
}

/**
 * Implementation plan subtask (from file)
 */
export interface ImplementationPlanSubtask {
  id: string;
  title: string;
  description?: string;
  status: SubtaskStatus;
  files?: string[];
  order?: number;
}

/**
 * Implementation plan file structure
 */
export interface ImplementationPlanFile {
  version?: string;
  task_id?: string;
  subtasks: ImplementationPlanSubtask[];
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// Implementation Plan V2 Types (Extended for Task State Machine)
// =============================================================================

/**
 * Extended subtask with verification support
 */
export interface ImplementationPlanSubtaskV2 extends ImplementationPlanSubtask {
  /** Verification configuration for the subtask */
  verification?: {
    /** Type of verification to run */
    type: "command" | "browser";
    /** Command to run for verification (if type is 'command') */
    run?: string;
    /** Browser scenario for verification (if type is 'browser') */
    scenario?: string;
  };
}

/**
 * Phase definition for structured implementation plans
 */
export interface ImplementationPhase {
  /** Phase ID (sequential number) */
  id: number;
  /** Human-readable phase name */
  name: string;
  /** Phase type for categorization */
  type: "plan" | "implement" | "check";
  /** Subtasks within this phase */
  subtasks: ImplementationPlanSubtaskV2[];
}

/**
 * Progress tracking for implementation plans
 */
export interface ImplementationProgress {
  /** Number of completed subtasks */
  completedSubtasks: number;
  /** Total number of subtasks */
  totalSubtasks: number;
  /** Completion percentage (0-100) */
  percentage: number;
}

/**
 * Extended implementation plan with phases and verification support
 *
 * This V2 format supports:
 * - Structured phases (plan, implement, check)
 * - Subtask-level verification
 * - Progress tracking
 */
export interface ImplementationPlanFileV2 extends ImplementationPlanFile {
  /** Structured phases (optional, for advanced workflows) */
  phases?: ImplementationPhase[];
  /** Current active phase index */
  currentPhase?: number;
  /** Computed progress (can be derived from subtasks) */
  progress?: ImplementationProgress;
}

/**
 * Task specs data returned by getTaskSpecsData
 */
export interface TaskSpecsData {
  prdContent: string | null;
  prdPath: string | null;
  subtasks: ImplementationPlanSubtask[];
  logs: TaskLogs | null;
  taskDir: string; // Task directory path for file browsing
}

/**
 * Singleton task service instance
 */
export const taskService = new TaskService();
