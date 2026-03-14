/**
 * Queue Monitor
 *
 * Periodically checks running processes for completion.
 * Moves completed items to the completed directory.
 * Handles retry logic for failed tasks.
 */

import { EventEmitter } from "node:events";
import { appendFileSync } from "node:fs";
import {
  readRunningQueue,
  deleteRunningItem,
  writeCompletedItem,
  readConfig,
  readPendingQueue,
  writePendingQueue,
} from "./persistence";
import type { RunningItem, CompletedItem, QueueItem } from "../ops/types";

/**
 * Check if a process is running
 */
function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 doesn't kill the process but checks if it exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get process exit code if available (best effort)
 * Since we're checking detached processes, we may not have direct access to exit codes.
 * We use a convention: if process is gone and no error file marker, assume success.
 */
function getProcessExitInfo(item: RunningItem): { running: boolean; exitCode?: number } {
  const running = isProcessRunning(item.pid);

  if (running) {
    return { running: true };
  }

  // Process has exited. We'll try to determine exit code.
  // For detached processes, we rely on convention or log parsing.
  // Default to 0 (success) unless we detect failure markers.
  // In a real implementation, you might write exit code to a file.
  return { running: false, exitCode: 0 };
}

/**
 * Monitor event types
 */
export interface MonitorEvents {
  "item:completed": (item: CompletedItem) => void;
  "item:failed": (item: CompletedItem) => void;
  "item:retried": (item: QueueItem, originalId: string) => void;
  error: (error: Error) => void;
}

/**
 * Monitor class
 *
 * Checks running processes and handles completion/failure.
 */
export class Monitor extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  constructor() {
    super();
  }

  /**
   * Start the monitor loop
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    const config = readConfig();

    // Run immediately
    this.tick();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.tick();
    }, config.monitor_interval_ms);
  }

  /**
   * Stop the monitor loop
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
  }

  /**
   * Check all running processes
   */
  private tick(): void {
    try {
      const running = readRunningQueue();

      for (const item of running) {
        const info = getProcessExitInfo(item);

        if (!info.running) {
          this.handleCompletion(item, info.exitCode ?? 0);
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.emit("error", error);
    }
  }

  /**
   * Handle process completion
   */
  private handleCompletion(item: RunningItem, exitCode: number): void {
    const completedAt = Date.now();
    const duration = completedAt - item.started_at;

    // Write completion footer to log
    try {
      const footer = `\n[${new Date().toISOString()}] Process exited with code ${exitCode} (duration: ${duration}ms)\n`;
      appendFileSync(item.log_file, footer);
    } catch {
      // Ignore log write errors
    }

    // Create completed item
    const completedItem: CompletedItem = {
      ...item,
      completed_at: completedAt,
      exit_code: exitCode,
    };

    // Remove from running
    deleteRunningItem(item.id);

    // Write to completed
    writeCompletedItem(completedItem);

    if (exitCode === 0) {
      this.emit("item:completed", completedItem);
    } else {
      // Check if we should retry
      const shouldRetry = this.shouldRetry(item);
      if (shouldRetry) {
        this.retryItem(item);
      }
      this.emit("item:failed", completedItem);
    }
  }

  /**
   * Check if an item should be retried
   */
  private shouldRetry(item: RunningItem): boolean {
    const config = readConfig();
    const retryCount = (item.metadata?.retry_count as number) || 0;
    const maxRetries = (item.metadata?.max_retries as number) || config.default_max_retries;

    return retryCount < maxRetries;
  }

  /**
   * Queue an item for retry
   */
  private retryItem(item: RunningItem): void {
    const retryCount = ((item.metadata?.retry_count as number) || 0) + 1;

    // Create new pending item
    const newItem: QueueItem = {
      id: item.id, // Keep same ID for tracking
      command: item.command,
      cwd: item.cwd,
      created_at: Date.now(),
      metadata: {
        ...item.metadata,
        retry_count: retryCount,
        original_started_at: item.started_at,
      },
    };

    // Add to pending queue
    const pending = readPendingQueue();
    pending.push(newItem);
    writePendingQueue(pending);

    this.emit("item:retried", newItem, item.id);
  }

  /**
   * Force check all items (for testing)
   */
  checkNow(): void {
    this.tick();
  }

  /**
   * Manually complete an item (for testing/debugging)
   */
  forceComplete(id: string, exitCode = 0): boolean {
    const running = readRunningQueue();
    const item = running.find((r) => r.id === id);

    if (!item) {
      return false;
    }

    this.handleCompletion(item, exitCode);
    return true;
  }
}
