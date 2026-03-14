/**
 * Status operation
 *
 * Returns queue status summary
 */

import type { StatusResult } from "./types";
import {
  readPendingQueue,
  readRunningQueue,
  readCompletedItems,
  readQueueConfig,
} from "../core/persistence";

/**
 * Status options
 */
export interface StatusOptions {
  /** Include item details (default: false) */
  include_items?: boolean;
}

/**
 * Get queue status summary
 *
 * @param options - Status options
 * @returns StatusResult with counts and optionally item details
 */
export function status(options?: StatusOptions): StatusResult {
  try {
    const { include_items = false } = options || {};

    const pending = readPendingQueue();
    const running = readRunningQueue();
    const completed = readCompletedItems();
    const config = readQueueConfig();

    const result: StatusResult = {
      success: true,
      pending: pending.length,
      running: running.length,
      completed: completed.length,
      max_concurrency: config.max_concurrency,
    };

    if (include_items) {
      result.items = {
        pending,
        running,
      };
    }

    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      pending: 0,
      running: 0,
      completed: 0,
      max_concurrency: 0,
      error,
    };
  }
}

/**
 * Check if the queue has capacity for new tasks
 *
 * @returns True if running < max_concurrency
 */
export function hasCapacity(): boolean {
  try {
    const running = readRunningQueue();
    const config = readQueueConfig();
    return running.length < config.max_concurrency;
  } catch {
    return false;
  }
}

/**
 * Get running count
 *
 * @returns Number of currently running tasks
 */
export function getRunningCount(): number {
  try {
    const running = readRunningQueue();
    return running.length;
  } catch {
    return 0;
  }
}

/**
 * Get pending count
 *
 * @returns Number of pending tasks
 */
export function getPendingCount(): number {
  try {
    const pending = readPendingQueue();
    return pending.length;
  } catch {
    return 0;
  }
}
