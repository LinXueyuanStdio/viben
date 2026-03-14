/**
 * Command Queue
 *
 * Main queue manager that coordinates the promoter and monitor.
 * This class is used by the Gateway to manage the queue lifecycle.
 *
 * Features:
 * - Detached process execution (survives Gateway restarts)
 * - File-based persistence
 * - Event emission for monitoring
 * - Recovery from restart
 */

import { EventEmitter } from "node:events";
import { Promoter } from "./promoter";
import { Monitor } from "./monitor";
import {
  readRunningQueue,
  readConfig,
  updateConfig,
  ensureDirectories,
} from "./persistence";
import { status } from "../ops/status";
import { enqueue, type EnqueueOptions } from "../ops/enqueue";
import { cancel } from "../ops/cancel";
import { list, type ListOptions } from "../ops/list";
import { inspect } from "../ops/inspect";
import { logs, type LogsOptions } from "../ops/logs";
import { getConfig, updateConfig as updateConfigOp } from "../ops/config";
import { clean, type CleanOptions } from "../ops/clean";
import { retry, type RetryOptions } from "../ops/retry";
import type {
  QueueConfig,
  StatusResult,
  EnqueueResult,
  CancelResult,
  RetryResult,
  ListResult,
  InspectResult,
  LogsResult,
  ConfigResult,
  CleanResult,
  QueueItem,
  RunningItem,
  CompletedItem,
} from "../ops/types";

/**
 * CommandQueue event types
 */
export interface CommandQueueEvents {
  "item:enqueued": (item: QueueItem) => void;
  "item:started": (item: RunningItem) => void;
  "item:completed": (item: CompletedItem) => void;
  "item:failed": (item: CompletedItem) => void;
  "item:cancelled": (id: string) => void;
  "item:retried": (item: QueueItem) => void;
  "queue:changed": () => void;
  error: (error: Error) => void;
}

/**
 * CommandQueue class
 *
 * Main entry point for queue management.
 */
export class CommandQueue extends EventEmitter {
  private promoter: Promoter;
  private monitor: Monitor;
  private started = false;

  constructor() {
    super();

    // Ensure directories exist
    ensureDirectories();

    // Create promoter and monitor
    this.promoter = new Promoter();
    this.monitor = new Monitor();

    // Wire up events
    this.promoter.on("item:promoted", (item) => {
      this.emit("item:started", item);
      this.emit("queue:changed");
    });

    this.promoter.on("item:spawn-error", (_item, error) => {
      this.emit("error", error);
    });

    this.promoter.on("error", (error) => {
      this.emit("error", error);
    });

    this.monitor.on("item:completed", (item) => {
      this.emit("item:completed", item);
      this.emit("queue:changed");
    });

    this.monitor.on("item:failed", (item) => {
      this.emit("item:failed", item);
      this.emit("queue:changed");
    });

    this.monitor.on("item:retried", (item) => {
      this.emit("item:retried", item);
      this.emit("queue:changed");
    });

    this.monitor.on("error", (error) => {
      this.emit("error", error);
    });
  }

  /**
   * Start the queue (promoter and monitor)
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;

    // Recover from any previous state
    await this.recoverFromRestart();

    // Start promoter and monitor
    this.promoter.start();
    this.monitor.start();
  }

  /**
   * Stop the queue (graceful shutdown)
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    this.promoter.stop();
    this.monitor.stop();
    this.started = false;

    // Note: Running processes continue to run (they're detached)
    // They will be recovered on next start
  }

  /**
   * Recover from Gateway restart
   *
   * Checks if any "running" items have processes that are actually dead.
   * This can happen if the Gateway crashed while processes were running.
   */
  async recoverFromRestart(): Promise<{ recovered: number }> {
    const running = readRunningQueue();
    let recovered = 0;

    for (const item of running) {
      // Check if process is actually running
      const isRunning = this.isProcessAlive(item.pid);

      if (!isRunning) {
        // Process is dead, force complete as failed
        this.monitor.forceComplete(item.id, 1);
        recovered++;
      }
    }

    if (recovered > 0) {
      this.emit("queue:changed");
    }

    return { recovered };
  }

  /**
   * Check if a process is alive
   */
  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Operations (delegate to ops layer)
  // ==========================================================================

  /**
   * Enqueue a new command
   */
  enqueue(options: EnqueueOptions): EnqueueResult {
    const result = enqueue(options);
    if (result.success) {
      // Get the item we just created
      const inspectResult = inspect({ id: result.id! });
      if (inspectResult.success && inspectResult.item) {
        this.emit("item:enqueued", inspectResult.item as QueueItem);
      }
      this.emit("queue:changed");
    }
    return result;
  }

  /**
   * Cancel a queued or running item
   */
  cancel(id: string, force = false): CancelResult {
    const result = cancel({ id, force });
    if (result.success) {
      this.emit("item:cancelled", id);
      this.emit("queue:changed");
    }
    return result;
  }

  /**
   * Retry a failed item
   */
  retry(options: RetryOptions): RetryResult {
    const result = retry(options);
    if (result.success) {
      this.emit("queue:changed");
    }
    return result;
  }

  /**
   * Get queue status
   */
  getStatus(): StatusResult {
    return status();
  }

  /**
   * List queue items
   */
  list(options?: ListOptions): ListResult {
    return list(options);
  }

  /**
   * Inspect a specific item
   */
  inspect(id: string): InspectResult {
    return inspect({ id });
  }

  /**
   * Get logs for an item
   */
  getLogs(options: LogsOptions): LogsResult {
    return logs(options);
  }

  /**
   * Get queue configuration
   */
  getConfig(): ConfigResult {
    return getConfig();
  }

  /**
   * Update queue configuration
   */
  updateConfig(updates: Partial<QueueConfig>): ConfigResult {
    const result = updateConfigOp(updates);
    if (result.success) {
      // Restart promoter/monitor with new intervals if changed
      if (updates.promoter_interval_ms || updates.monitor_interval_ms) {
        if (this.started) {
          this.promoter.stop();
          this.monitor.stop();
          this.promoter.start();
          this.monitor.start();
        }
      }
    }
    return result;
  }

  /**
   * Clean old items and logs
   */
  clean(options?: CleanOptions): CleanResult {
    const result = clean(options);
    if (result.success && result.cleaned > 0) {
      this.emit("queue:changed");
    }
    return result;
  }

  /**
   * Check if queue is running
   */
  isRunning(): boolean {
    return this.started;
  }
}
