/**
 * Frontend Background Task Manager
 *
 * Manages tasks running in the background when user switches to another task.
 * Preserves AbortController for each task to enable:
 * - Moving running tasks to background on task switch
 * - Restoring AbortController when returning to a background task
 * - Message polling for background tasks
 *
 * This is a client-side only manager (not synced with Gateway).
 * For Gateway-synced background tasks, use the useBackgroundTasks hook.
 */

export interface LocalBackgroundTask {
  /** Task ID (same as session task ID) */
  taskId: string;
  /** Backend session ID for API calls */
  sessionId: string;
  /** SDK session ID for resume (Claude Agent SDK's internal session ID) */
  sdkSessionId?: string;
  /** Abort controller for cancellation */
  abortController: AbortController;
  /** Whether task is still running */
  isRunning: boolean;
  /** Task started timestamp */
  startedAt: Date;
  /** User prompt (for display) */
  prompt: string;
  /** Agent config path - path to AGENTS.md config file (for workspace-level agents) */
  agentConfigPath?: string;
  /** Workspace path */
  workspacePath?: string;
}

type BackgroundTaskListener = (tasks: LocalBackgroundTask[]) => void;

// Global map of background tasks
const backgroundTasks = new Map<string, LocalBackgroundTask>();

// Listeners for background task status changes
const listeners = new Set<BackgroundTaskListener>();

/**
 * Notify all listeners of task changes
 */
function notifyListeners() {
  const tasks = Array.from(backgroundTasks.values());
  listeners.forEach((listener) => listener(tasks));
}

/**
 * Add a task to background
 */
export function addBackgroundTask(
  task: Omit<LocalBackgroundTask, "startedAt">
): void {
  backgroundTasks.set(task.taskId, {
    ...task,
    startedAt: new Date(),
  });
  console.log("[LocalBackgroundTasks] Added task:", task.taskId);
  notifyListeners();
}

/**
 * Remove a task from background
 */
export function removeBackgroundTask(taskId: string): void {
  backgroundTasks.delete(taskId);
  console.log("[LocalBackgroundTasks] Removed task:", taskId);
  notifyListeners();
}

/**
 * Get a background task by ID
 */
export function getBackgroundTask(taskId: string): LocalBackgroundTask | undefined {
  return backgroundTasks.get(taskId);
}

/**
 * Get all background tasks
 */
export function getAllBackgroundTasks(): LocalBackgroundTask[] {
  return Array.from(backgroundTasks.values());
}

/**
 * Get count of running background tasks
 */
export function getRunningTaskCount(): number {
  return Array.from(backgroundTasks.values()).filter((t) => t.isRunning).length;
}

/**
 * Update task status
 */
export function updateBackgroundTaskStatus(
  taskId: string,
  isRunning: boolean
): void {
  const task = backgroundTasks.get(taskId);
  if (task) {
    task.isRunning = isRunning;
    if (!isRunning) {
      // Task completed, remove from background after a short delay
      setTimeout(() => {
        removeBackgroundTask(taskId);
      }, 1000);
    }
    notifyListeners();
  }
}

/**
 * Check if a task is running in background
 */
export function isTaskRunningInBackground(taskId: string): boolean {
  const task = backgroundTasks.get(taskId);
  return task?.isRunning ?? false;
}

/**
 * Stop a background task
 */
export function stopBackgroundTask(taskId: string): void {
  const task = backgroundTasks.get(taskId);
  if (task) {
    task.abortController.abort();
    task.isRunning = false;
    removeBackgroundTask(taskId);
  }
}

/**
 * Subscribe to background task changes
 * @returns Unsubscribe function
 */
export function subscribeToBackgroundTasks(
  listener: BackgroundTaskListener
): () => void {
  listeners.add(listener);
  // Immediately call with current state
  listener(getAllBackgroundTasks());
  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Clear all background tasks
 */
export function clearAllBackgroundTasks(): void {
  backgroundTasks.forEach((task) => {
    task.abortController.abort();
  });
  backgroundTasks.clear();
  notifyListeners();
}
