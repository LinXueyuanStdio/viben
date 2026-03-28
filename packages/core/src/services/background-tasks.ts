/**
 * Background Task Manager
 *
 * Manages background agent tasks with observer pattern for real-time updates.
 * Allows tasks to continue executing when users navigate away from the chat page.
 */

import { logger as globalLogger } from "../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "background-tasks" });

/**
 * Background task state
 */
export interface BackgroundTask {
  /** Task unique ID */
  taskId: string;
  /** Agent session ID (used for stopping) */
  session_id: string;
  /** User prompt (for display) */
  prompt: string;
  /** Task status */
  status: "pending" | "running" | "completed" | "error" | "cancelled";
  /** Start time */
  started_at: Date;
  /** Completion time */
  completed_at?: Date;
  /** Error message */
  errorMessage?: string;
  /** API cost */
  cost?: number;
  /** Execution duration (ms) */
  duration?: number;
  /** Workspace path (for filtering by workspace) */
  workspace_path?: string;
  /** Agent config path (AGENTS.md) for workspace-level agents */
  agentConfigPath?: string;
  /** Agent name (for display) */
  agentName?: string;
}

type TaskListener = (tasks: BackgroundTask[]) => void;

/**
 * BackgroundTaskManager - Manages background agent tasks
 *
 * Uses observer pattern for real-time updates to subscribers.
 */
export class BackgroundTaskManager {
  private tasks = new Map<string, BackgroundTask>();
  private listeners = new Set<TaskListener>();
  private abortControllers = new Map<string, AbortController>();

  /**
   * Add a new task
   */
  addTask(task: {
    taskId: string;
    session_id: string;
    prompt: string;
    workspace_path?: string;
    agentConfigPath?: string;
    agentName?: string;
  }): BackgroundTask {
    const abortController = new AbortController();
    this.abortControllers.set(task.taskId, abortController);

    const fullTask: BackgroundTask = {
      ...task,
      status: "running",
      started_at: new Date(),
    };

    this.tasks.set(task.taskId, fullTask);
    this.notifyListeners();

    log.info({ taskId: task.taskId, workspacePath: task.workspace_path || "global" }, "Added task");
    return fullTask;
  }

  /**
   * Get tasks by workspace path
   */
  getTasksByWorkspace(workspacePath: string): BackgroundTask[] {
    const normalizedPath = workspacePath.replace(/\/+$/, "");
    return Array.from(this.tasks.values()).filter((task) => {
      if (!task.workspace_path) return false;
      return task.workspace_path.replace(/\/+$/, "") === normalizedPath;
    });
  }

  /**
   * Get running tasks by workspace path
   */
  getRunningTasksByWorkspace(workspacePath: string): BackgroundTask[] {
    return this.getTasksByWorkspace(workspacePath).filter((t) => t.status === "running");
  }

  /**
   * Update task status
   */
  updateStatus(
    taskId: string,
    update: {
      status: BackgroundTask["status"];
      errorMessage?: string;
      cost?: number;
      duration?: number;
    }
  ): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = update.status;
    if (update.errorMessage !== undefined) task.errorMessage = update.errorMessage;
    if (update.cost !== undefined) task.cost = update.cost;
    if (update.duration !== undefined) task.duration = update.duration;

    if (update.status !== "running") {
      task.completed_at = new Date();
    }

    this.notifyListeners();
    log.info({ taskId, status: update.status }, "Updated task status");
  }

  /**
   * Update task session ID (called when session is created after task)
   */
  updateSessionId(taskId: string, session_id: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.session_id = session_id;
    this.notifyListeners();
  }

  /**
   * Stop a task
   */
  stopTask(taskId: string): boolean {
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      log.info({ taskId }, "Aborted task");
    }

    const task = this.tasks.get(taskId);
    if (!task) return false;

    this.updateStatus(taskId, { status: "cancelled" });
    return true;
  }

  /**
   * Get a task
   */
  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get running tasks
   */
  getRunningTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === "running");
  }

  /**
   * Get running task count
   */
  getRunningCount(): number {
    return Array.from(this.tasks.values()).filter(
      (t) => t.status === "running"
    ).length;
  }

  /**
   * Get AbortSignal for a task
   */
  getAbortSignal(taskId: string): AbortSignal | undefined {
    return this.abortControllers.get(taskId)?.signal;
  }

  /**
   * Subscribe to task status changes
   * Returns unsubscribe function
   */
  subscribe(listener: TaskListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.getAllTasks());
    return () => this.listeners.delete(listener);
  }

  /**
   * Cleanup a completed task
   */
  cleanup(taskId: string): void {
    this.tasks.delete(taskId);
    this.abortControllers.delete(taskId);
    this.notifyListeners();
  }

  /**
   * Cleanup completed tasks older than maxAgeMs
   */
  cleanupOldTasks(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    for (const [taskId, task] of this.tasks) {
      if (
        task.status !== "running" &&
        task.completed_at &&
        now - task.completed_at.getTime() > maxAgeMs
      ) {
        this.tasks.delete(taskId);
        this.abortControllers.delete(taskId);
      }
    }
    this.notifyListeners();
  }

  /**
   * Clear all tasks (stops running tasks first)
   */
  clearAll(): void {
    // Stop all running tasks
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.tasks.clear();
    this.abortControllers.clear();
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const tasks = this.getAllTasks();
    for (const listener of this.listeners) {
      try {
        listener(tasks);
      } catch (error) {
        log.error({ err: error }, "Listener error");
      }
    }
  }
}

// Singleton export
export const backgroundTaskManager = new BackgroundTaskManager();
