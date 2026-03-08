/**
 * Test Helpers for Task State Machine Tests
 *
 * Provides utility functions for state machine testing.
 */

import { getNextState, type TaskMachineEvent, type XStateValue } from "../machine/task-machine";
import type { TaskMachineContext } from "../machine/task-machine";

// =============================================================================
// State Transition Helpers
// =============================================================================

/**
 * Apply a sequence of events to a state and return the final state
 */
export function applyEventSequence(
  initialState: XStateValue,
  events: TaskMachineEvent[],
  context?: Partial<TaskMachineContext>
): XStateValue {
  let currentState = initialState;

  for (const event of events) {
    const result = getNextState(currentState, event, context);
    if (result.changed) {
      currentState = result.value;
    }
  }

  return currentState;
}

/**
 * Test that a valid transition occurs
 */
export function expectValidTransition(
  fromState: XStateValue,
  event: TaskMachineEvent,
  toState: XStateValue,
  context?: Partial<TaskMachineContext>
): { success: boolean; actual: XStateValue } {
  const result = getNextState(fromState, event, context);

  const expectedStr = JSON.stringify(toState);
  const actualStr = JSON.stringify(result.value);

  return {
    success: result.changed && expectedStr === actualStr,
    actual: result.value,
  };
}

/**
 * Test that an invalid transition does not change state
 */
export function expectInvalidTransition(
  state: XStateValue,
  event: TaskMachineEvent,
  context?: Partial<TaskMachineContext>
): { unchanged: boolean; actual: XStateValue } {
  const result = getNextState(state, event, context);

  return {
    unchanged: !result.changed,
    actual: result.value,
  };
}

// =============================================================================
// Event Sequence Builders
// =============================================================================

type EventType = TaskMachineEvent["type"];

/**
 * Create an array of events from event types
 */
export function createEventSequence(types: EventType[]): TaskMachineEvent[] {
  return types.map((type) => ({ type }));
}

/**
 * Standard event sequences to reach specific states
 */
export const EVENT_SEQUENCES = {
  /** backlog -> queue */
  toQueue: createEventSequence(["QUEUE"]),

  /** backlog -> in_progress.planning */
  toPlanning: createEventSequence(["QUEUE", "START"]),

  /** backlog -> in_progress.coding */
  toCoding: createEventSequence(["QUEUE", "START", "PLANNING_COMPLETE"]),

  /** backlog -> in_progress.qa_review */
  toQaReview: createEventSequence([
    "QUEUE",
    "START",
    "PLANNING_COMPLETE",
    "ALL_SUBTASKS_DONE",
  ]),

  /** backlog -> in_progress.qa_fixing */
  toQaFixing: createEventSequence([
    "QUEUE",
    "START",
    "PLANNING_COMPLETE",
    "ALL_SUBTASKS_DONE",
    "QA_FAILED",
  ]),

  /** backlog -> human_review (via qa_passed) */
  toHumanReview: createEventSequence([
    "QUEUE",
    "START",
    "PLANNING_COMPLETE",
    "ALL_SUBTASKS_DONE",
    "QA_PASSED",
  ]),

  /** backlog -> completed */
  toCompleted: createEventSequence([
    "QUEUE",
    "START",
    "PLANNING_COMPLETE",
    "ALL_SUBTASKS_DONE",
    "QA_PASSED",
    "APPROVED",
  ]),

  /** backlog -> failed */
  toFailed: createEventSequence(["QUEUE", "START", "PLANNING_FAILED"]),

  /** backlog -> cancelled */
  toCancelled: createEventSequence(["CANCEL"]),

  /** backlog -> paused (from queue) */
  toPausedFromQueue: createEventSequence(["QUEUE", "PAUSE"]),

  /** backlog -> paused (from planning) */
  toPausedFromPlanning: createEventSequence(["QUEUE", "START", "PAUSE"]),

  /** backlog -> paused (from coding) */
  toPausedFromCoding: createEventSequence([
    "QUEUE",
    "START",
    "PLANNING_COMPLETE",
    "PAUSE",
  ]),
} as const;

// =============================================================================
// State Comparison Helpers
// =============================================================================

/**
 * Compare two XState values for equality
 */
export function statesEqual(a: XStateValue, b: XStateValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Check if state is in_progress with a specific phase
 */
export function isInProgressPhase(state: XStateValue, phase: string): boolean {
  if (typeof state !== "object") return false;
  if (!("in_progress" in state)) return false;
  return state.in_progress === phase;
}

/**
 * Get the phase from an in_progress state
 */
export function getPhase(state: XStateValue): string | null {
  if (typeof state !== "object") return null;
  if (!("in_progress" in state)) return null;
  return state.in_progress;
}

// =============================================================================
// Assertion Helpers (for use with vitest)
// =============================================================================

/**
 * Format state for error messages
 */
export function formatState(state: XStateValue): string {
  if (typeof state === "string") return state;
  return JSON.stringify(state);
}

/**
 * Create a descriptive test name for a transition
 */
export function transitionName(
  from: XStateValue,
  event: string,
  to: XStateValue
): string {
  return `${formatState(from)} + ${event} -> ${formatState(to)}`;
}

// =============================================================================
// Context Helpers
// =============================================================================

/**
 * Create context for testing pause/resume from a specific state
 */
export function createPauseContext(fromState: XStateValue): Partial<TaskMachineContext> {
  return {
    pausedFromState: fromState,
    paused_snapshot: {
      from_state: fromState,
      subtask_index: 0,
      paused_at: new Date().toISOString(),
    },
  };
}

/**
 * Create context with requiresPlanReview flag
 */
export function createPlanReviewContext(required: boolean): Partial<TaskMachineContext> {
  return {
    requiresPlanReview: required,
  };
}

/**
 * Create context with subtask progress
 */
export function createProgressContext(index: number): Partial<TaskMachineContext> {
  return {
    currentSubtaskIndex: index,
  };
}
