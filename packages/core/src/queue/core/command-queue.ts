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
import { logger as globalLogger } from "../../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "command-queue" });
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
      log.info({ itemId: item.id, pid: item.pid, command: item.command }, "Item started");
      this.emit("item:started", item);
      this.emit("queue:changed");
    });

    this.promoter.on("item:spawn-error", (_item, error) => {
      log.error({ itemId: _item.id, err: error }, "Item spawn failed");
      this.emit("error", error);
    });

    this.promoter.on("error", (error) => {
      log.error({ err: error }, "Promoter error");
      this.emit("error", error);
    });

    this.monitor.on("item:completed", (item) => {
      const duration = item.completed_at - item.started_at;
      log.info({ itemId: item.id, exitCode: item.exit_code, durationMs: duration }, "Item completed");
      this.emit("item:completed", item);
      this.emit("queue:changed");
    });

    this.monitor.on("item:failed", (item) => {
      const duration = item.completed_at - item.started_at;
      log.warn({ itemId: item.id, exitCode: item.exit_code, durationMs: duration }, "Item failed");
      this.emit("item:failed", item);
      this.emit("queue:changed");
    });

    this.monitor.on("item:retried", (item) => {
      const retryCount = item.metadata?.retry_count ?? 0;
      log.info({ itemId: item.id, retryCount }, "Item queued for retry");
      this.emit("item:retried", item);
      this.emit("queue:changed");
    });

    this.monitor.on("error", (error) => {
      log.error({ err: error }, "Monitor error");
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

    log.info("Starting command queue...");
    this.started = true;

    // Recover from any previous state
    const { recovered } = await this.recoverFromRestart();
    if (recovered > 0) {
      log.info({ recovered }, "Recovered dead processes from previous run");
    }

    // Start promoter and monitor
    this.promoter.start();
    this.monitor.start();
    log.info("Command queue started");
  }

  /**
   * Stop the queue (graceful shutdown)
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    log.info("Stopping command queue...");
    this.promoter.stop();
    this.monitor.stop();
    this.started = false;
    log.info("Command queue stopped (running processes will continue)");

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
      log.info({ itemId: result.id, command: options.command, cwd: options.cwd }, "Item enqueued");
      // Get the item we just created
      const inspectResult = inspect({ id: result.id! });
      if (inspectResult.success && inspectResult.item) {
        this.emit("item:enqueued", inspectResult.item as QueueItem);
      }
      this.emit("queue:changed");
    } else {
      log.warn({ command: options.command, error: result.error }, "Failed to enqueue item");
    }
    return result;
  }

  /**
   * Cancel a queued or running item
   */
  cancel(id: string, force = false): CancelResult {
    const result = cancel({ id, force });
    if (result.success) {
      log.info({ itemId: id, force }, "Item cancelled");
      this.emit("item:cancelled", id);
      this.emit("queue:changed");
    } else {
      log.warn({ itemId: id, error: result.error }, "Failed to cancel item");
    }
    return result;
  }

  /**
   * Retry a failed item
   */
  retry(options: RetryOptions): RetryResult {
    const result = retry(options);
    if (result.success) {
      log.info({ itemId: options.id }, "Item retry initiated");
      this.emit("queue:changed");
    } else {
      log.warn({ itemId: options.id, error: result.error }, "Failed to retry item");
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
