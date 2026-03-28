/**
 * Task Event Interface
 *
 * Re-exports TaskEvent from task-service for use in the task module.
 * Provides helper function to create new events.
 */

import type { TaskEventType } from "./event-types";

// Re-export TaskEvent from types for unified type
export type { TaskEvent } from "../ops/types";

/**
 * Create a new task event
 *
 * @param type - Event type
 * @param sequence - Sequence number
 * @param payload - Optional event payload
 * @returns A new TaskEvent
 */
export function createTaskEvent(
  type: TaskEventType,
  sequence: number,
  payload?: Record<string, unknown>
) {
  return {
    event_id: crypto.randomUUID(),
    sequence,
    type,
    timestamp: new Date().toISOString(),
    payload,
  };
}
