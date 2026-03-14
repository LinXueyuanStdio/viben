/**
 * Enqueue operation
 *
 * Adds a command to the pending queue
 */

import { nanoid } from "nanoid";
import type { EnqueueResult, QueueItem } from "./types";
import { readPendingQueue, writePendingQueue, getQueueDir, ensureDirectories } from "../core/persistence";

/**
 * Enqueue options
 */
export interface EnqueueOptions {
  /** Command to execute */
  command: string;
  /** Working directory */
  cwd: string;
  /** Optional metadata (task_dir, session_id, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Enqueue a command to the pending queue
 *
 * @param options - Enqueue options
 * @returns EnqueueResult with item ID and position
 */
export function enqueue(options: EnqueueOptions): EnqueueResult {
  try {
    const { command, cwd, metadata } = options;

    // Validate inputs
    if (!command || command.trim().length === 0) {
      return { success: false, error: "Command is required" };
    }

    if (!cwd || cwd.trim().length === 0) {
      return { success: false, error: "Working directory (cwd) is required" };
    }

    // Ensure queue directories exist
    ensureDirectories();

    // Generate unique ID
    const id = `q_${nanoid(12)}`;

    // Create queue item
    const item: QueueItem = {
      id,
      command: command.trim(),
      cwd: cwd.trim(),
      created_at: Date.now(),
      metadata,
    };

    // Read current pending queue
    const pending = readPendingQueue();

    // Append new item
    pending.push(item);

    // Write back
    writePendingQueue(pending);

    return {
      success: true,
      id,
      position: pending.length,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}

/**
 * Enqueue multiple commands in a batch
 *
 * @param items - Array of enqueue options
 * @returns Array of EnqueueResult
 */
export function enqueueBatch(items: EnqueueOptions[]): EnqueueResult[] {
  return items.map((item) => enqueue(item));
}
