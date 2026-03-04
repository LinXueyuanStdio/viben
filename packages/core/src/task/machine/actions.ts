/**
 * XState Actions for Task State Machine
 *
 * Actions are side effects that occur during state transitions.
 * They can update the context or perform external operations.
 */

import type { ReviewReason } from "../../services/task-service";
import type { TaskMachineContext } from "./task-machine";

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

/**
 * All actions exported as a single object for XState machine configuration
 */
export const actions = {
  markSubtaskDone,
  setReviewReason_planReview,
  setReviewReason_stopped,
  setReviewReason_completed,
  setReviewReason_qaRejected,
};
