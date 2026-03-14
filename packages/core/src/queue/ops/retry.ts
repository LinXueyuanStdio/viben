/**
 * Retry operation
 *
 * Re-queues a failed or completed task
 */

import { nanoid } from "nanoid";
import type { RetryResult } from "./types";
import {
  readPendingQueue,
  writePendingQueue,
  readCompletedItems,
} from "../core/persistence";

/**
 * Retry options
 */
export interface RetryOptions {
  /** Original queue item ID to retry */
  id: string;
  /** Reset retry count (default: false, increments count) */
  reset_count?: boolean;
}

/**
 * Retry a failed or completed task
 *
 * Creates a new queue item based on the original task's command and cwd
 *
 * @param options - Retry options
 * @returns RetryResult with new item ID
 */
export function retry(options: RetryOptions): RetryResult {
  try {
    const { id, reset_count = false } = options;

    if (!id || id.trim().length === 0) {
      return { success: false, error: "Item ID is required" };
    }

    // Find in completed items
    const completed = readCompletedItems();
    const original = completed.find((item) => item.id === id);

    if (!original) {
      return { success: false, error: `Completed item not found: ${id}` };
    }

    // Create new queue item
    const newId = `q_${nanoid(12)}`;
    const retryCount = reset_count ? 1 : ((original.metadata?.retry_count as number) || 0) + 1;
    const maxRetries = (original.metadata?.max_retries as number) || 3;

    // Check retry limit
    if (!reset_count && retryCount > maxRetries) {
      return {
        success: false,
        error: `Max retry limit reached (${maxRetries}). Use --reset-count to override.`,
      };
    }

    // Read current pending queue
    const pending = readPendingQueue();

    // Append new item
    pending.push({
      id: newId,
      command: original.command,
      cwd: original.cwd,
      created_at: Date.now(),
      metadata: {
        ...original.metadata,
        retry_count: retryCount,
        original_id: id,
      },
    });

    // Write back
    writePendingQueue(pending);

    return {
      success: true,
      id: newId,
      position: pending.length,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}

/**
 * Retry all failed tasks
 *
 * @param options - Additional options (reset_count)
 * @returns Array of RetryResult
 */
export function retryAllFailed(options?: { reset_count?: boolean }): RetryResult[] {
  const completed = readCompletedItems();
  const failed = completed.filter((item) => item.exit_code !== 0);

  return failed.map((item) =>
    retry({
      id: item.id,
      reset_count: options?.reset_count,
    })
  );
}
