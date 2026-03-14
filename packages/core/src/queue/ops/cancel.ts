/**
 * Cancel operation
 *
 * Cancels a queued or running task
 */

import type { CancelResult } from "./types";
import {
  readPendingQueue,
  writePendingQueue,
  readRunningQueue,
  writeRunningQueue,
  appendCompletedItem,
} from "../core/persistence";

/**
 * Cancel options
 */
export interface CancelOptions {
  /** Queue item ID to cancel */
  id: string;
  /** Force kill running process (SIGKILL vs SIGTERM) */
  force?: boolean;
}

/**
 * Cancel a queued or running task
 *
 * For pending tasks: removes from queue
 * For running tasks: sends SIGTERM (or SIGKILL with force)
 *
 * @param options - Cancel options
 * @returns CancelResult
 */
export function cancel(options: CancelOptions): CancelResult {
  try {
    const { id, force = false } = options;

    if (!id || id.trim().length === 0) {
      return { success: false, error: "Item ID is required" };
    }

    // First, try to remove from pending queue
    const pending = readPendingQueue();
    const pendingIndex = pending.findIndex((item) => item.id === id);

    if (pendingIndex !== -1) {
      // Remove from pending
      pending.splice(pendingIndex, 1);
      writePendingQueue(pending);
      return { success: true, cancelled: id };
    }

    // Next, try to cancel running task
    const running = readRunningQueue();
    const runningIndex = running.findIndex((item) => item.id === id);

    if (runningIndex !== -1) {
      const item = running[runningIndex];

      // Try to kill the process
      try {
        const signal = force ? "SIGKILL" : "SIGTERM";
        process.kill(item.pid, signal);
      } catch (e) {
        // Process might already be dead
      }

      // Remove from running queue
      running.splice(runningIndex, 1);
      writeRunningQueue(running);

      // Add to completed with cancelled status
      appendCompletedItem({
        ...item,
        completed_at: Date.now(),
        exit_code: -1, // Signal cancellation
      });

      return { success: true, cancelled: id };
    }

    return { success: false, error: `Item not found: ${id}` };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}

/**
 * Cancel all pending tasks
 *
 * @returns CancelResult with count of cancelled items
 */
export function cancelAllPending(): CancelResult & { count?: number } {
  try {
    const pending = readPendingQueue();
    const count = pending.length;

    // Clear pending queue
    writePendingQueue([]);

    return {
      success: true,
      cancelled: `${count} item(s)`,
      count,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}
