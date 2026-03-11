/**
 * Test Helpers for Task State Machine
 *
 * Provides utilities for testing state machine transitions
 * with common event sequences and validation helpers.
 */

import {
  getNextState,
  type TaskMachineEvent,
  type XStateValue,
  type TaskMachineContext,
} from "../machine/task-machine";
import type { ExecutionPhase } from "../../services/task-service";

// =============================================================================
// Types
// =============================================================================

export interface StateTransitionResult {
  value: XStateValue;
  changed: boolean;
}

// =============================================================================
// Event Sequences
// =============================================================================

/**
 * Common event sequences for testing complete flows
 */
export const EVENT_SEQUENCES = {
  /**
   * Happy path: backlog -> completed
   */
  HAPPY_PATH: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "CHECK_PASSED" },
    { type: "APPROVED" },
  ] as TaskMachineEvent[],

  /**
   * To completed state (alias for HAPPY_PATH)
   */
  toCompleted: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "CHECK_PASSED" },
    { type: "APPROVED" },
  ] as TaskMachineEvent[],

  /**
   * To check state
   */
  toCheck: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
  ] as TaskMachineEvent[],

  /**
   * To human review state (via CHECK_PASSED)
   */
  toHumanReview: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "CHECK_PASSED" },
  ] as TaskMachineEvent[],

  /**
   * To failed state (via PLAN_FAILED)
   */
  toFailed: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_FAILED" },
  ] as TaskMachineEvent[],

  /**
   * Plan failure path
   */
  PLAN_FAILURE: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_FAILED" },
  ] as TaskMachineEvent[],

  /**
   * Implement failure path
   */
  IMPLEMENT_FAILURE: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "IMPLEMENT_FAILED" },
  ] as TaskMachineEvent[],

  /**
   * Check rejection and fix path
   */
  CHECK_FIX_CYCLE: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "CHECK_FAILED" },
    { type: "FIX_COMPLETE" },
    { type: "CHECK_PASSED" },
    { type: "APPROVED" },
  ] as TaskMachineEvent[],

  /**
   * Pause and resume from queue
   */
  PAUSE_RESUME_QUEUE: [
    { type: "QUEUE" },
    { type: "PAUSE" },
    { type: "RESUME" },
    { type: "START" },
  ] as TaskMachineEvent[],

  /**
   * Pause and resume from implement
   */
  PAUSE_RESUME_IMPLEMENT: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "PAUSE" },
    { type: "RESUME" },
  ] as TaskMachineEvent[],

  /**
   * User stops with progress -> human review
   */
  USER_STOP_WITH_PROGRESS: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "SUBTASK_COMPLETE" },
    { type: "USER_STOPPED" },
  ] as TaskMachineEvent[],

  /**
   * User stops without progress -> backlog
   */
  USER_STOP_NO_PROGRESS: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "USER_STOPPED" },
  ] as TaskMachineEvent[],

  /**
   * Cancel from backlog
   */
  CANCEL_FROM_BACKLOG: [{ type: "CANCEL" }] as TaskMachineEvent[],

  /**
   * Retry after failure
   */
  RETRY_AFTER_FAILURE: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_FAILED" },
    { type: "RETRY" },
    { type: "START" },
  ] as TaskMachineEvent[],
};

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Apply a sequence of events and return the final state
 *
 * @param initialState - Starting state
 * @param events - Array of events to apply
 * @param initialContext - Optional initial context
 * @returns Final state value
 */
export function applyEventSequence(
  initialState: XStateValue,
  events: TaskMachineEvent[],
  initialContext?: Partial<TaskMachineContext>
): XStateValue {
  let currentState = initialState;

  for (const event of events) {
    const result = getNextState(currentState, event, initialContext);
    currentState = result.value;
  }

  return currentState;
}

/**
 * Apply a sequence of events and return detailed results
 *
 * @param initialState - Starting state
 * @param events - Array of events to apply
 * @param initialContext - Optional initial context
 * @returns Final state value and whether all transitions were successful
 */
export function applyEventSequenceDetailed(
  initialState: XStateValue,
  events: TaskMachineEvent[],
  initialContext?: Partial<TaskMachineContext>
): { finalState: XStateValue; allSuccessful: boolean; states: XStateValue[] } {
  let currentState = initialState;
  const states: XStateValue[] = [currentState];
  let allSuccessful = true;

  for (const event of events) {
    const result = getNextState(currentState, event, initialContext);
    if (!result.changed) {
      allSuccessful = false;
    }
    currentState = result.value;
    states.push(currentState);
  }

  return {
    finalState: currentState,
    allSuccessful,
    states,
  };
}

/**
 * Test that an event sequence reaches the expected final state
 *
 * @param events - Array of events to apply
 * @param expectedFinalState - Expected final state
 * @param initialState - Starting state (default: "backlog")
 * @returns true if final state matches expected
 */
export function testEventSequence(
  events: TaskMachineEvent[],
  expectedFinalState: XStateValue,
  initialState: XStateValue = "backlog"
): boolean {
  const finalState = applyEventSequence(initialState, events);
  return JSON.stringify(finalState) === JSON.stringify(expectedFinalState);
}

/**
 * Get all states that a sequence passes through
 *
 * @param events - Array of events to apply
 * @param initialState - Starting state (default: "backlog")
 * @returns Array of all state values traversed
 */
export function getStateTrace(
  events: TaskMachineEvent[],
  initialState: XStateValue = "backlog"
): XStateValue[] {
  return applyEventSequenceDetailed(initialState, events).states;
}

/**
 * Test that a transition is valid
 *
 * @param fromState - Current state
 * @param event - Event to apply
 * @param expectedState - Expected resulting state
 * @returns true if transition produces expected state
 */
export function testTransition(
  fromState: XStateValue,
  event: TaskMachineEvent,
  expectedState: XStateValue
): boolean {
  const result = getNextState(fromState, event);
  return (
    result.changed && JSON.stringify(result.value) === JSON.stringify(expectedState)
  );
}

/**
 * Test that a transition is invalid (state doesn't change)
 *
 * @param fromState - Current state
 * @param event - Event to apply
 * @returns true if transition is invalid (state unchanged)
 */
export function testInvalidTransition(
  fromState: XStateValue,
  event: TaskMachineEvent
): boolean {
  const result = getNextState(fromState, event);
  return !result.changed;
}

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
 * Check if state is a nested in_progress state
 */
export function isInProgressState(state: XStateValue): state is { in_progress: ExecutionPhase } {
  return typeof state === "object" && "in_progress" in state;
}

/**
 * Get the in_progress substate if applicable
 */
export function getInProgressPhase(state: XStateValue): string | null {
  if (isInProgressState(state)) {
    return state.in_progress;
  }
  return null;
}
