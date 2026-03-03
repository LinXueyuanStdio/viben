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
export type ExecutionPhase = "planning" | "coding" | "qa_review" | "qa_fixing" | "complete";

/**
 * Execution progress tracking
 */
export interface ExecutionProgress {
  phase: ExecutionPhase;
  phaseProgress?: number; // 0-100
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
  "ai_review",
  "human_review",
  "done",
  "pr_created",
  "error",
];

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
   * Normalize a status value to the unified TaskStatus
   * Only accepts unified status values, defaults to "backlog" for invalid values
   */
  normalizeStatus(status: string): TaskStatus {
    if (isValidTaskStatus(status)) {
      return status;
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
  // Task Specs Data (PRD, Logs, Files)
  // ==========================================================================

  /**
   * Get task specs data from the task directory
   *
   * Reads:
   * - spec.md (PRD content)
   * - implementation_plan.json (subtasks)
   * - logs/ directory (execution logs)
   * - files.json (modified files)
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
      files: [],
    };

    // 1. Read PRD content (spec.md)
    const specPath = join(taskDir, "spec.md");
    if (existsSync(specPath)) {
      try {
        result.prdContent = await readFile(specPath, "utf-8");
        result.prdPath = specPath;
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
        const standardPhases = ["planning", "coding", "validation"];

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

    // 4. Read modified files (files.json)
    const filesJsonPath = join(taskDir, "files.json");
    if (existsSync(filesJsonPath)) {
      try {
        const filesContent = await readFile(filesJsonPath, "utf-8");
        const filesData = JSON.parse(filesContent) as {
          files?: Array<{ path: string; name?: string; type?: string }>;
        };
        if (filesData.files && Array.isArray(filesData.files)) {
          result.files = filesData.files.map((f) => {
            const name = f.name || f.path.split("/").pop() || f.path;
            const extension = name.includes(".") ? name.split(".").pop() : undefined;
            return {
              path: f.path,
              name,
              type: (f.type as "file" | "directory") || "file",
              extension,
            };
          });
        }
      } catch {
        // Ignore parse errors
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
 * A log phase (planning, coding, validation)
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
 * Task file entry
 */
export interface TaskFileEntry {
  path: string;
  name: string;
  type: "file" | "directory";
  extension?: string;
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

/**
 * Task specs data returned by getTaskSpecsData
 */
export interface TaskSpecsData {
  prdContent: string | null;
  prdPath: string | null;
  subtasks: ImplementationPlanSubtask[];
  logs: TaskLogs | null;
  files: TaskFileEntry[];
}

/**
 * Singleton task service instance
 */
export const taskService = new TaskService();
