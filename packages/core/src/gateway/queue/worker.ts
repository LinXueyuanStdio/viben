/**
 * Queue Worker
 *
 * Executes agent tasks from the queue using SdkChatProxy.
 * Handles process monitoring and retry logic.
 */

import { EventEmitter } from "node:events";
import { SdkChatProxy } from "../../executors/chat/sdk-proxy";
import type { QueueTask, AgentRunPayload } from "./types";
import type { SSEMessage } from "../../executors/chat/sdk-proxy";
import { logger as globalLogger } from "../../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "queue-worker" });

/**
 * Worker execution result
 */
export interface WorkerResult {
  /** Whether execution was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Exit code if process-based */
  exit_code?: number;
}

/**
 * Worker events
 */
export interface WorkerEvents {
  /** Progress update */
  progress: (taskId: string, message: SSEMessage) => void;
  /** Task completed */
  completed: (taskId: string, result: WorkerResult) => void;
  /** Task failed */
  failed: (taskId: string, error: string) => void;
}

/**
 * Queue worker - executes agent tasks
 */
export class QueueWorker extends EventEmitter {
  private abortControllers = new Map<string, AbortController>();
  private activeExecutions = new Map<string, Promise<WorkerResult>>();

  /**
   * Execute a task
   *
   * @param task - The task to execute
   * @returns Promise that resolves when task completes
   */
  async execute(task: QueueTask): Promise<WorkerResult> {
    const startTime = Date.now();
    const abortController = new AbortController();
    this.abortControllers.set(task.id, abortController);

    const executionPromise = this.runTask(task, startTime, abortController.signal);
    this.activeExecutions.set(task.id, executionPromise);

    try {
      const result = await executionPromise;
      return result;
    } finally {
      this.abortControllers.delete(task.id);
      this.activeExecutions.delete(task.id);
    }
  }

  /**
   * Internal task execution
   */
  private async runTask(
    task: QueueTask,
    startTime: number,
    abortSignal: AbortSignal
  ): Promise<WorkerResult> {
    const proxy = new SdkChatProxy();
    const payload = task.payload;

    try {
      // Execute agent using SDK proxy with streaming
      const stream = proxy.executeStreaming({
        prompt: payload.input,
        cwd: payload.cwd || process.cwd(),
        sessionId: payload.session_id,
        resume: payload.resume_session,
        dangerouslySkipPermissions: true,
      });

      let hasError = false;
      let errorMessage: string | undefined;

      // Stream messages and emit progress events
      for await (const message of stream) {
        // Check for abort
        if (abortSignal.aborted) {
          return {
            success: false,
            error: "Task cancelled",
            duration: Date.now() - startTime,
          };
        }

        // Emit progress event
        this.emit("progress", task.id, message);

        // Track errors
        if (message.type === "error") {
          hasError = true;
          errorMessage = message.message;
        }

        // Track result
        if (message.type === "result") {
          if (message.subtype === "error") {
            hasError = true;
          }
        }
      }

      const duration = Date.now() - startTime;

      if (hasError) {
        return {
          success: false,
          error: errorMessage || "Task execution failed",
          duration,
        };
      }

      return {
        success: true,
        duration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const duration = Date.now() - startTime;

      // Categorize errors
      let finalError = errorMessage;
      if (errorMessage.includes("exited with code")) {
        // Extract exit code
        const match = errorMessage.match(/exited with code (\d+)/);
        const exitCode = match ? parseInt(match[1], 10) : 1;

        return {
          success: false,
          error: `Agent process exited with code ${exitCode}`,
          duration,
          exit_code: exitCode,
        };
      }

      return {
        success: false,
        error: finalError,
        duration,
      };
    }
  }

  /**
   * Cancel a running task
   *
   * @param taskId - The task ID to cancel
   * @returns True if task was cancelled, false if not found
   */
  cancel(taskId: string): boolean {
    const controller = this.abortControllers.get(taskId);
    if (!controller) return false;

    controller.abort();
    log.info({ taskId }, "Cancelled task");
    return true;
  }

  /**
   * Check if a task is currently executing
   */
  isExecuting(taskId: string): boolean {
    return this.activeExecutions.has(taskId);
  }

  /**
   * Get the number of active executions
   */
  getActiveCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Wait for all active executions to complete
   *
   * @param timeoutMs - Maximum time to wait in milliseconds
   * @returns True if all completed, false if timed out
   */
  async waitForAll(timeoutMs: number): Promise<boolean> {
    if (this.activeExecutions.size === 0) return true;

    const executions = Array.from(this.activeExecutions.values());
    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), timeoutMs)
    );

    const result = await Promise.race([
      Promise.allSettled(executions).then(() => "done" as const),
      timeout,
    ]);

    return result === "done";
  }

  /**
   * Cancel all running tasks
   */
  cancelAll(): void {
    for (const [taskId, controller] of this.abortControllers) {
      controller.abort();
      log.info({ taskId }, "Force cancelled task");
    }
    this.abortControllers.clear();
  }
}

/**
 * Determine if an error should trigger a retry
 *
 * @param error - The error message
 * @param exitCode - The exit code if available
 * @returns True if task should be retried
 */
export function shouldRetry(error?: string, exitCode?: number): boolean {
  // Process exit codes that indicate retriable errors
  if (exitCode !== undefined) {
    // 0 = success, don't retry
    if (exitCode === 0) return false;

    // 137 = SIGKILL (OOM or force kill) - retry
    // 143 = SIGTERM (graceful shutdown) - retry
    if (exitCode === 137 || exitCode === 143) return true;

    // General errors (1) - retry
    if (exitCode === 1) return true;

    // Other non-zero exit codes - retry
    return true;
  }

  // Error message patterns
  if (error) {
    // Rate limit - retry
    if (error.includes("rate limit") || error.includes("429")) return true;

    // Network errors - retry
    if (
      error.includes("ETIMEDOUT") ||
      error.includes("ECONNREFUSED") ||
      error.includes("ENOTFOUND") ||
      error.includes("network")
    ) {
      return true;
    }

    // Timeout - retry
    if (error.includes("timeout")) return true;

    // Process errors - retry
    if (error.includes("exited with code")) return true;

    // Authentication errors - don't retry (needs user intervention)
    if (
      error.includes("API key") ||
      error.includes("authentication") ||
      error.includes("401")
    ) {
      return false;
    }

    // Not found errors - don't retry
    if (error.includes("not found") || error.includes("ENOENT")) {
      return false;
    }
  }

  // Default: retry on unknown errors
  return true;
}
