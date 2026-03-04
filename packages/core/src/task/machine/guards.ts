/**
 * XState Guards for Task State Machine
 *
 * Guards are conditions that determine which transition to take
 * when multiple transitions are possible for the same event.
 */

import type { TaskMachineContext } from "./task-machine";

/**
 * Check if plan review is not required
 * Used when PLANNING_COMPLETE event is received
 */
export function noPlanReviewRequired({ context }: { context: TaskMachineContext }): boolean {
  return !context.requiresPlanReview;
}

/**
 * Check if task has no progress (can be safely moved to backlog)
 * Used when USER_STOPPED event is received
 */
export function noProgress({ context }: { context: TaskMachineContext }): boolean {
  return context.currentSubtaskIndex === 0;
}

/**
 * All guards exported as a single object for XState machine configuration
 */
export const guards = {
  noPlanReviewRequired,
  noProgress,
};
