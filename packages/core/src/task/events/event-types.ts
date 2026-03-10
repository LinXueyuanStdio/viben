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

  // Planning phase events
  | "PLANNING_COMPLETE" // Planning done, may need review
  | "PLANNING_FAILED" // Planning failed

  // Coding phase events
  | "SUBTASK_COMPLETE" // A subtask completed
  | "ALL_SUBTASKS_DONE" // All subtasks completed, move to QA
  | "CODING_FAILED" // Coding failed

  // QA phase events
  | "QA_PASSED" // QA review passed
  | "QA_FAILED" // QA found issues
  | "QA_FIXING_COMPLETE" // QA fix attempt done
  | "QA_FIXING_FAILED" // QA fix failed

  // User interaction events
  | "USER_STOPPED" // User manually stopped the task
  | "APPROVED" // Human approved the work
  | "REJECTED" // Human rejected, back to coding
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
  "PLANNING_COMPLETE",
  "PLANNING_FAILED",
  "SUBTASK_COMPLETE",
  "ALL_SUBTASKS_DONE",
  "CODING_FAILED",
  "QA_PASSED",
  "QA_FAILED",
  "QA_FIXING_COMPLETE",
  "QA_FIXING_FAILED",
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
