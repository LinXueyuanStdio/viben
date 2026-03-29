/**
 * XState Guards for Task State Machine
 *
 * Guards are conditions that determine which transition to take
 * when multiple transitions are possible for the same event.
 *
 * Note: Some guards (like allDependenciesMet) require external data that
 * cannot be passed through XState context. These are implemented as standalone
 * functions in scheduler.ts and called at the service/API layer before
 * triggering state transitions.
 *
 * @see packages/core/src/gateway/queue/scheduler.ts for dependency checking
 */

import type { TaskMachineContext, XStateValue } from "./task-machine";

/**
 * Check if plan review is not required
 * Used when PLAN_COMPLETE event is received
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
 * Helper to check if paused from a specific state
 * Checks both legacy pausedFromState and new paused_snapshot.from_state
 */
function isPausedFrom(context: TaskMachineContext, targetState: string | XStateValue): boolean {
  // Check new paused_snapshot first
  const fromState = context.paused_snapshot?.from_state ?? context.pausedFromState;
  if (!fromState) return false;

  // Simple string comparison for top-level states
  if (typeof fromState === "string" && typeof targetState === "string") {
    return fromState === targetState;
  }

  // Object comparison for nested states (in_progress substates)
  if (typeof fromState === "object" && typeof targetState === "object") {
    return JSON.stringify(fromState) === JSON.stringify(targetState);
  }

  return false;
}

/**
 * Check if paused from queue state
 */
export function pausedFromQueue({ context }: { context: TaskMachineContext }): boolean {
  return isPausedFrom(context, "queue");
}

/**
 * Check if paused from in_progress.plan state
 */
export function pausedFromPlan({ context }: { context: TaskMachineContext }): boolean {
  return isPausedFrom(context, { in_progress: "plan" });
}

/**
 * Check if paused from in_progress.implement state
 */
export function pausedFromImplement({ context }: { context: TaskMachineContext }): boolean {
  return isPausedFrom(context, { in_progress: "implement" });
}

/**
 * Check if paused from in_progress.check state
 */
export function pausedFromCheck({ context }: { context: TaskMachineContext }): boolean {
  return isPausedFrom(context, { in_progress: "check" });
}

/**
 * Check if paused from in_progress.fix state
 */
export function pausedFromFix({ context }: { context: TaskMachineContext }): boolean {
  return isPausedFrom(context, { in_progress: "fix" });
}

/**
 * All guards exported as a single object for XState machine configuration
 */
export const guards = {
  noPlanReviewRequired,
  noProgress,
  pausedFromQueue,
  pausedFromPlan,
  pausedFromImplement,
  pausedFromCheck,
  pausedFromFix,
};

// =============================================================================
// Re-export dependency checking functions from scheduler
// These are used at the API/service layer before triggering state transitions
// =============================================================================

export {
  allDependenciesMet,
  detectCyclicDependency,
  validateDependencies,
} from "../../gateway/queue/scheduler";
