/**
 * XState Actions for Task State Machine
 *
 * Actions are side effects that occur during state transitions.
 * They can update the context or perform external operations.
 */

import type { ReviewReason } from "../../services/task-service";
import type { TaskMachineContext, PausedSnapshot, XStateValue } from "./task-machine";

/**
 * Extended context type that includes queuedAt for the setQueuedAt action
 */
interface TaskMachineContextWithQueuedAt extends TaskMachineContext {
  queuedAt?: string;
}

/**
 * Mark current subtask as done and move to next
 */
export function markSubtaskDone({ context }: { context: TaskMachineContext }): Partial<TaskMachineContext> {
  return {
    currentSubtaskIndex: context.currentSubtaskIndex + 1,
  };
}

/**
 * Set review reason to plan_review
 */
export function setReviewReason_planReview(): Partial<TaskMachineContext> {
  return {
    reviewReason: "plan_review" as ReviewReason,
  };
}

/**
 * Set review reason to stopped
 */
export function setReviewReason_stopped(): Partial<TaskMachineContext> {
  return {
    reviewReason: "stopped" as ReviewReason,
  };
}

/**
 * Set review reason to completed
 */
export function setReviewReason_completed(): Partial<TaskMachineContext> {
  return {
    reviewReason: "completed" as ReviewReason,
  };
}

/**
 * Set review reason to qa_rejected
 */
export function setReviewReason_qaRejected(): Partial<TaskMachineContext> {
  return {
    reviewReason: "qa_rejected" as ReviewReason,
  };
}

// =============================================================================
// Pause Snapshot Actions (New)
// =============================================================================

/**
 * Helper to create a pause snapshot
 */
function createPausedSnapshot(
  from_state: XStateValue,
  subtask_index: number
): PausedSnapshot {
  return {
    from_state,
    subtask_index,
    paused_at: new Date().toISOString(),
  };
}

/**
 * Save pause snapshot: queue
 */
export function savePausedSnapshot_queue({ context }: { context: TaskMachineContext }): Partial<TaskMachineContext> {
  return {
    pausedFromState: "queue", // Keep for backward compatibility
    paused_snapshot: createPausedSnapshot("queue", context.currentSubtaskIndex),
  };
}

/**
 * Save pause snapshot: in_progress.planning
 */
export function savePausedSnapshot_planning({ context }: { context: TaskMachineContext }): Partial<TaskMachineContext> {
  const from_state: XStateValue = { in_progress: "planning" };
  return {
    pausedFromState: from_state, // Keep for backward compatibility
    paused_snapshot: createPausedSnapshot(from_state, context.currentSubtaskIndex),
  };
}

/**
 * Save pause snapshot: in_progress.coding
 */
export function savePausedSnapshot_coding({ context }: { context: TaskMachineContext }): Partial<TaskMachineContext> {
  const from_state: XStateValue = { in_progress: "coding" };
  return {
    pausedFromState: from_state, // Keep for backward compatibility
    paused_snapshot: createPausedSnapshot(from_state, context.currentSubtaskIndex),
  };
}

/**
 * Save pause snapshot: in_progress.qa_review
 */
export function savePausedSnapshot_qaReview({ context }: { context: TaskMachineContext }): Partial<TaskMachineContext> {
  const from_state: XStateValue = { in_progress: "qa_review" };
  return {
    pausedFromState: from_state, // Keep for backward compatibility
    paused_snapshot: createPausedSnapshot(from_state, context.currentSubtaskIndex),
  };
}

/**
 * Save pause snapshot: in_progress.qa_fixing
 */
export function savePausedSnapshot_qaFixing({ context }: { context: TaskMachineContext }): Partial<TaskMachineContext> {
  const from_state: XStateValue = { in_progress: "qa_fixing" };
  return {
    pausedFromState: from_state, // Keep for backward compatibility
    paused_snapshot: createPausedSnapshot(from_state, context.currentSubtaskIndex),
  };
}

/**
 * Restore context from pause snapshot when resuming
 * Restores subtask index and clears the snapshot
 */
export function restoreFromSnapshot({ context }: { context: TaskMachineContext }): Partial<TaskMachineContext> {
  const result: Partial<TaskMachineContext> = {
    pausedFromState: undefined,
    paused_snapshot: undefined,
  };

  // Restore subtask index from snapshot if available
  if (context.paused_snapshot) {
    result.currentSubtaskIndex = context.paused_snapshot.subtask_index;
  }

  return result;
}

/**
 * Clear pause snapshot without restoring (for ABANDON/CANCEL)
 */
export function clearPausedSnapshot(): Partial<TaskMachineContext> {
  return {
    pausedFromState: undefined,
    paused_snapshot: undefined,
  };
}

// =============================================================================
// Legacy Actions (Deprecated - kept for backward compatibility)
// =============================================================================

/**
 * @deprecated Use savePausedSnapshot_queue instead
 */
export function savePausedState_queue(): Partial<TaskMachineContext> {
  return {
    pausedFromState: "queue",
  };
}

/**
 * @deprecated Use savePausedSnapshot_planning instead
 */
export function savePausedState_planning(): Partial<TaskMachineContext> {
  return {
    pausedFromState: { in_progress: "planning" },
  };
}

/**
 * @deprecated Use savePausedSnapshot_coding instead
 */
export function savePausedState_coding(): Partial<TaskMachineContext> {
  return {
    pausedFromState: { in_progress: "coding" },
  };
}

/**
 * @deprecated Use savePausedSnapshot_qaReview instead
 */
export function savePausedState_qaReview(): Partial<TaskMachineContext> {
  return {
    pausedFromState: { in_progress: "qa_review" },
  };
}

/**
 * @deprecated Use savePausedSnapshot_qaFixing instead
 */
export function savePausedState_qaFixing(): Partial<TaskMachineContext> {
  return {
    pausedFromState: { in_progress: "qa_fixing" },
  };
}

/**
 * @deprecated Use clearPausedSnapshot instead
 */
export function clearPausedState(): Partial<TaskMachineContext> {
  return {
    pausedFromState: undefined,
  };
}

/**
 * Set the queuedAt timestamp when task is queued
 * Used for FIFO ordering within same priority level
 *
 * Note: This action returns a partial context that signals the need to set queuedAt.
 * The actual timestamp is set by the event store when applying the event,
 * as XState actions don't have access to the current time in a pure way.
 *
 * @see .trellis/spec/modules/task-system.md - 调度信息
 */
export function setQueuedAt(): Partial<TaskMachineContextWithQueuedAt> {
  // Return a marker that indicates queuedAt should be set
  // The actual timestamp is handled by the event store/task service
  return {
    queuedAt: new Date().toISOString(),
  };
}

/**
 * All actions exported as a single object for XState machine configuration
 */
export const actions = {
  markSubtaskDone,
  setReviewReason_planReview,
  setReviewReason_stopped,
  setReviewReason_completed,
  setReviewReason_qaRejected,
  // New snapshot-based actions
  savePausedSnapshot_queue,
  savePausedSnapshot_planning,
  savePausedSnapshot_coding,
  savePausedSnapshot_qaReview,
  savePausedSnapshot_qaFixing,
  restoreFromSnapshot,
  clearPausedSnapshot,
  // Legacy actions (kept for backward compatibility)
  savePausedState_queue,
  savePausedState_planning,
  savePausedState_coding,
  savePausedState_qaReview,
  savePausedState_qaFixing,
  clearPausedState,
  setQueuedAt,
};
