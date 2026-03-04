/**
 * Background Task Manager
 *
 * Manages background agent tasks with observer pattern for real-time updates.
 * Allows tasks to continue executing when users navigate away from the chat page.
 */

/**
 * Background task state
 */
export interface BackgroundTask {
  /** Task unique ID */
  taskId: string;
  /** Agent session ID (used for stopping) */
  sessionId: string;
  /** User prompt (for display) */
  prompt: string;
  /** Task status */
  status: "pending" | "running" | "completed" | "error" | "cancelled";
  /** Start time */
  startedAt: Date;
  /** Completion time */
  completedAt?: Date;
  /** Error message */
  errorMessage?: string;
  /** API cost */
  cost?: number;
  /** Execution duration (ms) */
  duration?: number;
  /** Workspace path (for filtering by workspace) */
  workspacePath?: string;
  /** Agent path (for workspace-level agents) */
  agentPath?: string;
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
    sessionId: string;
    prompt: string;
    workspacePath?: string;
    agentPath?: string;
    agentName?: string;
  }): BackgroundTask {
    const abortController = new AbortController();
    this.abortControllers.set(task.taskId, abortController);

    const fullTask: BackgroundTask = {
      ...task,
      status: "running",
      startedAt: new Date(),
    };

    this.tasks.set(task.taskId, fullTask);
    this.notifyListeners();

    console.log(`[BackgroundTasks] Added task: ${task.taskId} (workspace: ${task.workspacePath || 'global'})`);
    return fullTask;
  }

  /**
   * Get tasks by workspace path
   */
  getTasksByWorkspace(workspacePath: string): BackgroundTask[] {
    const normalizedPath = workspacePath.replace(/\/+$/, "");
    return Array.from(this.tasks.values()).filter((t) => {
      if (!t.workspacePath) return false;
      return t.workspacePath.replace(/\/+$/, "") === normalizedPath;
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

    Object.assign(task, update);

    if (update.status !== "running") {
      task.completedAt = new Date();
    }

    this.notifyListeners();
    console.log(`[BackgroundTasks] Updated task ${taskId}: ${update.status}`);
  }

  /**
   * Update task session ID (called when session is created after task)
   */
  updateSessionId(taskId: string, sessionId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.sessionId = sessionId;
    this.notifyListeners();
  }

  /**
   * Stop a task
   */
  stopTask(taskId: string): boolean {
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      console.log(`[BackgroundTasks] Aborted task: ${taskId}`);
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
    for (const [id, task] of this.tasks) {
      if (
        task.status !== "running" &&
        task.completedAt &&
        now - task.completedAt.getTime() > maxAgeMs
      ) {
        this.tasks.delete(id);
        this.abortControllers.delete(id);
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
        console.error("[BackgroundTasks] Listener error:", error);
      }
    }
  }
}

// Singleton export
export const backgroundTaskManager = new BackgroundTaskManager();
