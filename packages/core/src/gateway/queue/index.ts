/**
 * Task Queue Manager
 *
 * Core queue implementation for Gateway task scheduling.
 * Provides:
 * - FIFO task queue with configurable concurrency
 * - File-based persistence (YAML)
 * - Automatic retry on failure
 * - Event emission for real-time updates
 */

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type {
  QueueTask,
  QueueStatus,
  QueueConfig,
  QueueStateFile,
  EnqueueRequest,
  EnqueueResponse,
  AgentRunPayload,
  TaskStatus,
  QueueTaskSummary,
} from "./types";
import { DEFAULT_QUEUE_CONFIG } from "./types";
import { QueuePersistence, getQueuePersistence } from "./persistence";
import { QueueWorker, shouldRetry, type WorkerResult } from "./worker";
import type { EventService } from "../../services/events";

/**
 * Generate a unique task ID using crypto randomUUID
 */
function generateTaskId(): string {
  return `task_${randomUUID()}`;
}

/**
 * TaskQueueManager - Core queue management class
 *
 * Events emitted:
 * - task:queued - Task added to queue
 * - task:started - Task started executing
 * - task:progress - Task progress update (SSE message)
 * - task:completed - Task completed successfully
 * - task:failed - Task failed (after all retries)
 * - task:cancelled - Task was cancelled
 * - queue:changed - Queue state changed
 * - queue:restored - Queue restored from disk
 */
export class TaskQueueManager extends EventEmitter {
  /** Pending tasks queue (FIFO) */
  private queue: QueueTask[] = [];

  /** Currently running tasks */
  private running: Map<string, QueueTask> = new Map();

  /** All tasks by ID (for lookup) */
  private tasks: Map<string, QueueTask> = new Map();

  /** Configuration */
  private config: QueueConfig;

  /** Persistence layer */
  private persistence: QueuePersistence;

  /** Worker for task execution */
  private worker: QueueWorker;

  /** Event service for broadcasting */
  private events: EventService;

  /** Whether the queue is accepting new tasks */
  private accepting = true;

  /** Whether the queue has been started */
  private started = false;

  constructor(events: EventService, config?: Partial<QueueConfig>) {
    super();
    this.events = events;
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
    this.persistence = getQueuePersistence(this.config.persist_debounce_ms);
    this.worker = new QueueWorker();

    // Listen to worker events
    this.worker.on("progress", (taskId: string, message: unknown) => {
      this.emit("task:progress", { id: taskId, progress: message });
      this.events.broadcast({
        type: "queue_task_progress",
        data: { task_id: taskId, progress: message },
      });
    });
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Start the queue manager
   *
   * Loads persisted state and begins processing.
   */
  async start(): Promise<void> {
    if (this.started) return;

    console.log("[TaskQueue] Starting queue manager...");

    // Load persisted state
    await this.restore();

    this.started = true;
    this.accepting = true;

    // Start processing any pending tasks
    this.tryDequeue();

    console.log("[TaskQueue] Queue manager started");
  }

  /**
   * Enqueue a new task
   *
   * @param request - Task parameters
   * @returns Enqueue response with task ID and position
   */
  async enqueue(request: EnqueueRequest): Promise<EnqueueResponse> {
    if (!this.accepting) {
      throw new Error("Queue is not accepting new tasks");
    }

    const taskId = generateTaskId();
    const now = Date.now();

    const payload: AgentRunPayload = {
      agent_id: request.agent_id,
      session_id: request.session_id,
      input: request.input,
      cwd: request.cwd,
      agent_path: request.agent_path,
      resume_session: request.resume_session,
      attachments: request.attachments,
    };

    const task: QueueTask = {
      id: taskId,
      type: "agent-run",
      payload,
      status: "pending",
      retry_count: 0,
      max_retries: request.max_retries ?? this.config.default_max_retries,
      created_at: now,
    };

    // Add to queue
    this.queue.push(task);
    this.tasks.set(taskId, task);

    // Persist immediately to prevent data loss on crash
    await this.persistTask(task, true);
    await this.persistState(true);

    // Emit events
    this.emit("task:queued", { task });
    this.events.broadcast({
      type: "queue_task_queued",
      data: { task: this.taskToSummary(task) },
    });
    this.emitQueueChanged();

    console.log(`[TaskQueue] Task ${taskId} enqueued (position: ${this.queue.length})`);

    // Try to start executing
    this.tryDequeue();

    return {
      task_id: taskId,
      position: this.queue.length,
      status: "pending",
    };
  }

  /**
   * Cancel a task
   *
   * @param taskId - The task ID to cancel
   * @returns True if task was cancelled
   */
  async cancel(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === "pending") {
      // Remove from queue
      const index = this.queue.findIndex((t) => t.id === taskId);
      if (index !== -1) {
        this.queue.splice(index, 1);
      }
      task.status = "failed";
      task.error = "Cancelled by user";
      task.completed_at = Date.now();
    } else if (task.status === "running") {
      // Cancel running task
      this.worker.cancel(taskId);
      this.running.delete(taskId);
      task.status = "failed";
      task.error = "Cancelled by user";
      task.completed_at = Date.now();
    } else {
      // Already completed/failed
      return false;
    }

    // Persist and emit
    await this.persistTask(task);
    await this.persistState();

    this.emit("task:cancelled", { task });
    this.events.broadcast({
      type: "queue_task_cancelled",
      data: { task: this.taskToSummary(task) },
    });
    this.emitQueueChanged();

    console.log(`[TaskQueue] Task ${taskId} cancelled`);
    return true;
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): QueueTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks, optionally filtered by status
   */
  getTasks(status?: TaskStatus): QueueTask[] {
    const allTasks = Array.from(this.tasks.values());
    if (status) {
      return allTasks.filter((t) => t.status === status);
    }
    return allTasks;
  }

  /**
   * Get queue status
   */
  getStatus(): QueueStatus {
    const pendingTasks = this.queue.map((task, index) => ({
      ...this.taskToSummary(task),
      position: index + 1,
    }));

    const runningTasks = Array.from(this.running.values()).map((task) =>
      this.taskToSummary(task)
    );

    return {
      pending_count: this.queue.length,
      running_count: this.running.size,
      max_concurrency: this.config.max_concurrency,
      tasks: [...pendingTasks, ...runningTasks],
    };
  }

  /**
   * Update queue configuration
   */
  async updateConfig(config: Partial<QueueConfig>): Promise<QueueConfig> {
    this.config = { ...this.config, ...config };
    await this.persistence.saveConfig(this.config);

    // If concurrency increased, try to dequeue more tasks
    if (config.max_concurrency) {
      this.tryDequeue();
    }

    return this.config;
  }

  /**
   * Get current configuration
   */
  getConfig(): QueueConfig {
    return { ...this.config };
  }

  /**
   * Graceful shutdown
   *
   * Stops accepting new tasks and waits for running tasks to complete.
   */
  async shutdown(): Promise<void> {
    console.log("[TaskQueue] Shutting down...");

    // Stop accepting new tasks
    this.accepting = false;

    // Wait for running tasks (with timeout)
    const completed = await this.worker.waitForAll(this.config.shutdown_timeout_ms);

    if (!completed) {
      console.warn("[TaskQueue] Shutdown timeout, force cancelling remaining tasks");
      this.worker.cancelAll();

      // Mark running tasks as failed
      for (const [taskId, task] of this.running) {
        task.status = "failed";
        task.error = "Shutdown timeout";
        task.completed_at = Date.now();
        await this.persistTask(task);
      }
    }

    // Final persist
    await this.persistState(true);
    await this.persistence.flush();

    this.started = false;
    console.log("[TaskQueue] Shutdown complete");
  }

  // ==========================================================================
  // Internal Methods
  // ==========================================================================

  /**
   * Try to dequeue and execute pending tasks
   */
  private tryDequeue(): void {
    // Check if we have capacity
    while (
      this.running.size < this.config.max_concurrency &&
      this.queue.length > 0
    ) {
      const task = this.queue.shift();
      if (!task) break;

      // Execute task
      this.executeTask(task);
    }
  }

  /**
   * Execute a task
   */
  private async executeTask(task: QueueTask): Promise<void> {
    task.status = "running";
    task.started_at = Date.now();
    this.running.set(task.id, task);

    // Persist and emit
    await this.persistTask(task);
    await this.persistState();

    this.emit("task:started", { task });
    this.events.broadcast({
      type: "queue_task_started",
      data: { task: this.taskToSummary(task) },
    });
    this.emitQueueChanged();

    console.log(`[TaskQueue] Task ${task.id} started (running: ${this.running.size})`);

    try {
      const result = await this.worker.execute(task);
      await this.onTaskComplete(task, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.onTaskComplete(task, {
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * Handle task completion
   */
  private async onTaskComplete(
    task: QueueTask,
    result: WorkerResult
  ): Promise<void> {
    this.running.delete(task.id);

    if (result.success) {
      // Success
      task.status = "completed";
      task.completed_at = Date.now();

      await this.persistTask(task);
      await this.persistState();

      this.emit("task:completed", { task });
      this.events.broadcast({
        type: "queue_task_completed",
        data: {
          task: this.taskToSummary(task),
          duration: result.duration,
        },
      });

      console.log(
        `[TaskQueue] Task ${task.id} completed (duration: ${result.duration}ms)`
      );
    } else {
      // Failure - check if we should retry
      const canRetry =
        task.retry_count < task.max_retries &&
        shouldRetry(result.error, result.exit_code);

      if (canRetry) {
        // Retry
        task.status = "retrying";
        task.retry_count++;
        task.error = result.error;

        console.log(
          `[TaskQueue] Task ${task.id} failed, retrying (${task.retry_count}/${task.max_retries}): ${result.error}`
        );

        // Reset for retry and re-queue
        task.status = "pending";
        task.started_at = undefined;
        this.queue.unshift(task); // Add to front for immediate retry

        await this.persistTask(task);
        await this.persistState();

        this.emitQueueChanged();
      } else {
        // Final failure
        task.status = "failed";
        task.error = result.error;
        task.completed_at = Date.now();

        await this.persistTask(task);
        await this.persistState();

        this.emit("task:failed", { task });
        this.events.broadcast({
          type: "queue_task_failed",
          data: {
            task: this.taskToSummary(task),
            error: result.error,
            duration: result.duration,
          },
        });

        console.log(
          `[TaskQueue] Task ${task.id} failed permanently: ${result.error}`
        );
      }
    }

    this.emitQueueChanged();

    // Try to dequeue next task
    this.tryDequeue();
  }

  /**
   * Restore queue state from disk
   */
  private async restore(): Promise<void> {
    try {
      // Load config
      const savedConfig = await this.persistence.loadConfig();
      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
      }

      // Load state
      const state = await this.persistence.loadState();
      if (!state) {
        console.log("[TaskQueue] No persisted state found, starting fresh");
        return;
      }

      // Load all task files
      const allTasks = await this.persistence.loadAllTasks();

      // Restore pending tasks
      for (const taskId of state.task_ids.pending) {
        const task = allTasks.get(taskId);
        if (task) {
          this.queue.push(task);
          this.tasks.set(taskId, task);
        }
      }

      // Handle running tasks (they were interrupted by restart)
      let runningRecovered = 0;
      for (const taskId of state.task_ids.running) {
        const task = allTasks.get(taskId);
        if (task) {
          // Mark as pending for retry
          task.status = "pending";
          task.started_at = undefined;
          task.retry_count++; // Count the interrupted run as a retry

          // Re-queue at front
          this.queue.unshift(task);
          this.tasks.set(taskId, task);
          runningRecovered++;

          await this.persistTask(task);
        }
      }

      // Also load completed/failed tasks for history
      for (const [taskId, task] of allTasks) {
        if (!this.tasks.has(taskId)) {
          this.tasks.set(taskId, task);
        }
      }

      console.log(
        `[TaskQueue] Restored ${this.queue.length} pending tasks, ` +
          `recovered ${runningRecovered} interrupted tasks`
      );

      this.emit("queue:restored", {
        pending_count: this.queue.length,
        running_recovered: runningRecovered,
      });
      this.events.broadcast({
        type: "queue_restored",
        data: {
          pending_count: this.queue.length,
          running_recovered: runningRecovered,
        },
      });
    } catch (error) {
      console.error("[TaskQueue] Failed to restore state:", error);
      // Continue with empty queue
    }
  }

  /**
   * Persist current state to disk
   */
  private async persistState(immediate = false): Promise<void> {
    const state: QueueStateFile = {
      version: 1,
      max_concurrency: this.config.max_concurrency,
      last_updated: Date.now(),
      task_ids: {
        pending: this.queue.map((t) => t.id),
        running: Array.from(this.running.keys()),
      },
    };

    try {
      await this.persistence.saveState(state, immediate);
    } catch (error) {
      console.error("[TaskQueue] Failed to persist state:", error);
      this.events.broadcast({
        type: "error",
        data: {
          message: "Failed to persist queue state",
          code: "PERSIST_ERROR",
        },
      });
    }
  }

  /**
   * Persist a task to disk
   */
  private async persistTask(task: QueueTask, immediate = false): Promise<void> {
    try {
      await this.persistence.saveTask(task, immediate);
    } catch (error) {
      console.error(`[TaskQueue] Failed to persist task ${task.id}:`, error);
    }
  }

  /**
   * Convert task to summary format
   */
  private taskToSummary(task: QueueTask): QueueTaskSummary {
    return {
      id: task.id,
      status: task.status,
      agent_id: task.payload.agent_id,
      created_at: task.created_at,
    };
  }

  /**
   * Emit queue changed event
   */
  private emitQueueChanged(): void {
    const status = this.getStatus();
    this.emit("queue:changed", { status });
    this.events.broadcast({
      type: "queue_status_changed",
      data: status,
    });
  }

  /**
   * Delete a completed/failed task from history
   */
  async deleteTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // Can only delete completed or failed tasks
    if (task.status === "pending" || task.status === "running") {
      return false;
    }

    this.tasks.delete(taskId);
    await this.persistence.deleteTask(taskId);

    return true;
  }

  /**
   * Clear completed and failed tasks from history
   */
  async clearHistory(): Promise<number> {
    let count = 0;
    for (const [taskId, task] of this.tasks) {
      if (task.status === "completed" || task.status === "failed") {
        this.tasks.delete(taskId);
        await this.persistence.deleteTask(taskId);
        count++;
      }
    }
    return count;
  }

  /**
   * Retry a failed task
   *
   * @param taskId - The task ID to retry
   * @param resetCount - If true, reset retry count to 0
   * @returns The task if retry was initiated, null if task not found or not retryable
   */
  async retry(taskId: string, resetCount = false): Promise<QueueTask | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    // Can only retry failed tasks
    if (task.status !== "failed") {
      return null;
    }

    // Reset retry count if requested
    if (resetCount) {
      task.retry_count = 0;
    }

    // Reset task state
    task.status = "pending";
    task.started_at = undefined;
    task.completed_at = undefined;
    task.error = undefined;

    // Add back to queue
    this.queue.push(task);

    // Persist immediately
    await this.persistTask(task, true);
    await this.persistState(true);

    // Emit events
    this.emit("task:queued", { task });
    this.events.broadcast({
      type: "queue_task_queued",
      data: { task: this.taskToSummary(task) },
    });
    this.emitQueueChanged();

    console.log(`[TaskQueue] Task ${taskId} re-queued for retry (position: ${this.queue.length})`);

    // Try to start executing
    this.tryDequeue();

    return task;
  }

  /**
   * Check if a task is currently executing
   *
   * This checks the actual worker process, not just the queue status.
   * Useful for validating if a "running" task's process is still alive.
   *
   * @param taskId - The task ID to check
   * @returns True if the task is actively executing
   */
  isTaskExecuting(taskId: string): boolean {
    return this.worker.isExecuting(taskId);
  }
}

// Re-export types
export type {
  QueueTask,
  QueueStatus,
  QueueConfig,
  EnqueueRequest,
  EnqueueResponse,
  AgentRunPayload,
  TaskStatus,
  QueueTaskSummary,
} from "./types";
export { DEFAULT_QUEUE_CONFIG } from "./types";
