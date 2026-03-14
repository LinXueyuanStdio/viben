/**
 * Queue Promoter
 *
 * Periodically checks the pending queue and spawns detached processes
 * when slots are available (running < max_concurrency).
 *
 * Detached processes:
 * - Survive Gateway restarts
 * - Log output to ~/.viben/queue/logs/{id}.log
 * - Status tracked in ~/.viben/queue/running/{id}.json
 */

import { spawn } from "node:child_process";
import { openSync, writeSync, closeSync } from "node:fs";
import { EventEmitter } from "node:events";
import {
  readPendingQueue,
  writePendingQueue,
  readRunningQueue,
  writeRunningItem,
  readConfig,
  createLogFile,
} from "./persistence";
import type { QueueItem, RunningItem } from "../ops/types";

/**
 * Promoter event types
 */
export interface PromoterEvents {
  "item:promoted": (item: RunningItem) => void;
  "item:spawn-error": (item: QueueItem, error: Error) => void;
  error: (error: Error) => void;
}

/**
 * Promoter class
 *
 * Manages the transition of items from pending to running state
 * by spawning detached processes.
 */
export class Promoter extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  constructor() {
    super();
  }

  /**
   * Start the promoter loop
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
    }, config.promoter_interval_ms);
  }

  /**
   * Stop the promoter loop
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
  }

  /**
   * Check for pending items and promote if slots available
   */
  private tick(): void {
    try {
      const config = readConfig();
      const running = readRunningQueue();
      const availableSlots = config.max_concurrency - running.length;

      if (availableSlots <= 0) {
        return;
      }

      const pending = readPendingQueue();
      if (pending.length === 0) {
        return;
      }

      // Promote up to availableSlots items
      const toPromote = pending.slice(0, availableSlots);
      const remaining = pending.slice(availableSlots);

      for (const item of toPromote) {
        try {
          const runningItem = this.spawnProcess(item);
          this.emit("item:promoted", runningItem);
        } catch (e) {
          const error = e instanceof Error ? e : new Error(String(e));
          this.emit("item:spawn-error", item, error);
          // Put back in pending queue if spawn failed
          remaining.unshift(item);
        }
      }

      // Update pending queue
      writePendingQueue(remaining);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.emit("error", error);
    }
  }

  /**
   * Spawn a detached process for a queue item
   */
  private spawnProcess(item: QueueItem): RunningItem {
    // Create log file
    const logFile = createLogFile(item.id);

    // Open log file for writing
    const out = openSync(logFile, "a");
    const err = openSync(logFile, "a");

    // Write header to log
    const header = `[${new Date().toISOString()}] Starting command: ${item.command}\n`;
    writeSync(out, header);

    // Spawn detached process
    // Use shell to handle complex commands
    const child = spawn(item.command, {
      cwd: item.cwd,
      shell: true,
      detached: true,
      stdio: ["ignore", out, err],
      env: {
        ...process.env,
        VIBEN_QUEUE_ITEM_ID: item.id,
      },
    });

    // Unref so parent can exit independently
    child.unref();

    // Close the file descriptors in the parent
    closeSync(out);
    closeSync(err);

    // Create running item
    const runningItem: RunningItem = {
      ...item,
      pid: child.pid!,
      started_at: Date.now(),
      log_file: logFile,
    };

    // Write to running queue
    writeRunningItem(runningItem);

    return runningItem;
  }

  /**
   * Manually promote a single item (for testing)
   */
  promoteOne(): RunningItem | null {
    const pending = readPendingQueue();
    if (pending.length === 0) {
      return null;
    }

    const config = readConfig();
    const running = readRunningQueue();

    if (running.length >= config.max_concurrency) {
      return null;
    }

    const item = pending[0];
    const remaining = pending.slice(1);

    try {
      const runningItem = this.spawnProcess(item);
      writePendingQueue(remaining);
      this.emit("item:promoted", runningItem);
      return runningItem;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.emit("item:spawn-error", item, error);
      return null;
    }
  }
}
