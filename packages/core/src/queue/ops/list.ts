/**
 * List operation
 *
 * Lists queue items with filtering
 */

import type { ListResult, QueueItem, RunningItem, CompletedItem, QueueItemStatus } from "./types";
import {
  readPendingQueue,
  readRunningQueue,
  readCompletedItems,
} from "../core/persistence";

/**
 * List options
 */
export interface ListOptions {
  /** Filter by status */
  status?: QueueItemStatus | QueueItemStatus[];
  /** Maximum items to return (default: 50) */
  limit?: number;
  /** Skip first N items (for pagination) */
  offset?: number;
  /** Sort order (default: "created_at_desc") */
  sort?: "created_at_asc" | "created_at_desc";
}

// Internal type for sorting with status
type ItemWithStatus = (QueueItem | RunningItem | CompletedItem) & { _status: QueueItemStatus };

/**
 * List queue items with filtering
 *
 * @param options - List options
 * @returns ListResult with items
 */
export function list(options?: ListOptions): ListResult {
  try {
    const {
      status: statusFilter,
      limit = 50,
      offset = 0,
      sort = "created_at_desc",
    } = options || {};

    // Normalize status filter to array
    const statuses = statusFilter
      ? Array.isArray(statusFilter)
        ? statusFilter
        : [statusFilter]
      : null;

    // Collect all items based on filter
    const allItems: ItemWithStatus[] = [];

    // Add pending items
    if (!statuses || statuses.includes("pending")) {
      const pending = readPendingQueue();
      allItems.push(...pending.map((item) => ({ ...item, _status: "pending" as const })));
    }

    // Add running items
    if (!statuses || statuses.includes("running")) {
      const running = readRunningQueue();
      allItems.push(...running.map((item) => ({ ...item, _status: "running" as const })));
    }

    // Add completed items
    if (!statuses || statuses.includes("completed") || statuses.includes("failed") || statuses.includes("cancelled")) {
      const completed = readCompletedItems();

      for (const item of completed) {
        let itemStatus: QueueItemStatus;
        if (item.exit_code === 0) {
          itemStatus = "completed";
        } else if (item.exit_code === -1) {
          itemStatus = "cancelled";
        } else {
          itemStatus = "failed";
        }

        // Filter by status if specified
        if (!statuses || statuses.includes(itemStatus)) {
          allItems.push({ ...item, _status: itemStatus });
        }
      }
    }

    // Sort items
    allItems.sort((a, b) => {
      const timeA = a.created_at;
      const timeB = b.created_at;
      return sort === "created_at_asc" ? timeA - timeB : timeB - timeA;
    });

    // Apply pagination
    const total = allItems.length;
    const paginated = allItems.slice(offset, offset + limit);

    // Remove internal _status field from output
    const items = paginated.map((item) => {
      const { _status, ...rest } = item;
      return rest;
    });

    return {
      success: true,
      items,
      total,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, items: [], total: 0, error };
  }
}

/**
 * List pending items only
 *
 * @returns ListResult with pending items
 */
export function listPending(): ListResult {
  return list({ status: "pending" });
}

/**
 * List running items only
 *
 * @returns ListResult with running items
 */
export function listRunning(): ListResult {
  return list({ status: "running" });
}

/**
 * List completed items only
 *
 * @returns ListResult with completed items
 */
export function listCompleted(): ListResult {
  return list({ status: "completed" });
}

/**
 * List failed items only
 *
 * @returns ListResult with failed items
 */
export function listFailed(): ListResult {
  return list({ status: "failed" });
}
