/**
 * Inspect operation
 *
 * Get detailed information about a specific queue item
 */

import type { InspectResult, QueueItemStatus } from "./types";
import {
  readPendingQueue,
  readRunningQueue,
  readCompletedItems,
} from "../core/persistence";

/**
 * Inspect options
 */
export interface InspectOptions {
  /** Queue item ID */
  id: string;
}

/**
 * Inspect a specific queue item
 *
 * @param options - Inspect options
 * @returns InspectResult with item details
 */
export function inspect(options: InspectOptions): InspectResult {
  try {
    const { id } = options;

    if (!id || id.trim().length === 0) {
      return { success: false, error: "Item ID is required" };
    }

    // Check pending queue
    const pending = readPendingQueue();
    const pendingItem = pending.find((item) => item.id === id);
    if (pendingItem) {
      return {
        success: true,
        item: pendingItem,
        status: "pending" as QueueItemStatus,
      };
    }

    // Check running queue
    const running = readRunningQueue();
    const runningItem = running.find((item) => item.id === id);
    if (runningItem) {
      return {
        success: true,
        item: runningItem,
        status: "running" as QueueItemStatus,
      };
    }

    // Check completed items
    const completed = readCompletedItems();
    const completedItem = completed.find((item) => item.id === id);
    if (completedItem) {
      let status: QueueItemStatus;
      if (completedItem.exit_code === 0) {
        status = "completed";
      } else if (completedItem.exit_code === -1) {
        status = "cancelled";
      } else {
        status = "failed";
      }
      return {
        success: true,
        item: completedItem,
        status,
      };
    }

    return { success: false, error: `Item not found: ${id}` };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}

/**
 * Check if an item exists in the queue
 *
 * @param id - Queue item ID
 * @returns True if item exists
 */
export function exists(id: string): boolean {
  const result = inspect({ id });
  return result.success;
}

/**
 * Get item status
 *
 * @param id - Queue item ID
 * @returns Item status or null if not found
 */
export function getItemStatus(id: string): QueueItemStatus | null {
  const result = inspect({ id });
  return result.success ? (result.status || null) : null;
}
