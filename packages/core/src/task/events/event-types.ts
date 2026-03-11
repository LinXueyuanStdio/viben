/**
 * Task Event Types
 *
 * All event types that can be sent to the task state machine.
 * These events drive state transitions in the XState machine.
 */

/**
 * Event types for task state machine transitions
 */
export type TaskEventType =
  // Queue management events
  | "QUEUE" // Move task from backlog to queue
  | "START" // Start task execution
  | "DEQUEUE" // Move task back to backlog

  // Plan phase events
  | "PLAN_COMPLETE" // Planning done, may need review
  | "PLAN_FAILED" // Planning failed

  // Implement phase events
  | "SUBTASK_COMPLETE" // A subtask completed
  | "ALL_SUBTASKS_DONE" // All subtasks completed, move to check
  | "IMPLEMENT_FAILED" // Implementation failed

  // Check phase events
  | "CHECK_PASSED" // Check review passed
  | "CHECK_FAILED" // Check found issues
  | "FIX_COMPLETE" // Fix attempt done
  | "FIX_FAILED" // Fix failed

  // User interaction events
  | "USER_STOPPED" // User manually stopped the task
  | "APPROVED" // Human approved the work
  | "REJECTED" // Human rejected, back to implement
  | "CANCEL" // Cancel task (terminal state)

  // Pause/Resume events
  | "PAUSE" // Pause task, preserves current progress
  | "RESUME" // Resume from paused state

  // Recovery events
  | "RETRY" // Retry from failed state
  | "ABANDON" // Abandon task, back to backlog

  // Archive event
  | "ARCHIVE"; // Archive task (terminal state)

/**
 * All valid event types as an array (for validation)
 */
export const VALID_EVENT_TYPES: TaskEventType[] = [
  "QUEUE",
  "START",
  "DEQUEUE",
  "PLAN_COMPLETE",
  "PLAN_FAILED",
  "SUBTASK_COMPLETE",
  "ALL_SUBTASKS_DONE",
  "IMPLEMENT_FAILED",
  "CHECK_PASSED",
  "CHECK_FAILED",
  "FIX_COMPLETE",
  "FIX_FAILED",
  "USER_STOPPED",
  "APPROVED",
  "REJECTED",
  "CANCEL",
  "PAUSE",
  "RESUME",
  "RETRY",
  "ABANDON",
  "ARCHIVE",
];

/**
 * Check if a string is a valid event type
 */
export function isValidEventType(type: string): type is TaskEventType {
  return VALID_EVENT_TYPES.includes(type as TaskEventType);
}
