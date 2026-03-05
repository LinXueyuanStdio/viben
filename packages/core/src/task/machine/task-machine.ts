/**
 * XState Task State Machine
 *
 * Implements the task lifecycle using XState v5.
 * State flow follows Auto-Claude pattern:
 * backlog -> queue -> in_progress (planning/coding/qa_review/qa_fixing) -> human_review -> done/pr_created
 */

import {
  createMachine,
  createActor,
  type AnyMachineSnapshot,
  getInitialSnapshot,
  transition,
} from "xstate";
import type { TaskStatus, ReviewReason, ExecutionPhase } from "../../services/task-service";
import { guards } from "./guards";
import { actions } from "./actions";

// =============================================================================
// Types
// =============================================================================

/**
 * XState state value type
 * Can be a simple string (top-level state) or nested object (for in_progress substates)
 */
export type XStateValue = string | { in_progress: ExecutionPhase };

/**
 * Task machine context - data that persists across state transitions
 */
export interface TaskMachineContext {
  /** Task ID */
  taskId: string;
  /** Reason for entering human_review state */
  reviewReason?: ReviewReason;
  /** Current subtask index (0-based) */
  currentSubtaskIndex: number;
  /** Whether plan requires human review before coding */
  requiresPlanReview: boolean;
}

/**
 * Task machine events
 */
export type TaskMachineEvent =
  | { type: "QUEUE" }
  | { type: "START" }
  | { type: "DEQUEUE" }
  | { type: "PLANNING_COMPLETE" }
  | { type: "PLANNING_FAILED" }
  | { type: "SUBTASK_COMPLETE" }
  | { type: "ALL_SUBTASKS_DONE" }
  | { type: "CODING_FAILED" }
  | { type: "QA_PASSED" }
  | { type: "QA_FAILED" }
  | { type: "QA_FIXING_COMPLETE" }
  | { type: "QA_FIXING_FAILED" }
  | { type: "USER_STOPPED" }
  | { type: "APPROVED" }
  | { type: "REJECTED" }
  | { type: "CREATE_PR" }
  | { type: "RETRY" }
  | { type: "ABANDON" };

// =============================================================================
// State Machine Definition
// =============================================================================

/**
 * Create the task state machine
 *
 * Uses XState v5 createMachine API with:
 * - Nested states for in_progress phase
 * - Guards for conditional transitions
 * - Actions for context updates
 */
export const taskMachine = createMachine(
  {
    id: "task",
    initial: "backlog",
    context: {
      taskId: "",
      reviewReason: undefined,
      currentSubtaskIndex: 0,
      requiresPlanReview: false,
    } as TaskMachineContext,

    states: {
      // ==========================================================================
      // Backlog - Tasks waiting to be started
      // ==========================================================================
      backlog: {
        on: {
          QUEUE: { target: "queue" },
          START: { target: "in_progress" },
        },
      },

      // ==========================================================================
      // Queue - Tasks queued for execution
      // ==========================================================================
      queue: {
        on: {
          START: { target: "in_progress" },
          DEQUEUE: { target: "backlog" },
        },
      },

      // ==========================================================================
      // In Progress - Task is being executed
      // ==========================================================================
      in_progress: {
        initial: "planning",

        states: {
          // Planning phase - generating implementation plan
          planning: {
            on: {
              PLANNING_COMPLETE: [
                {
                  target: "coding",
                  guard: "noPlanReviewRequired",
                },
                {
                  target: "#task.human_review",
                  actions: ["setReviewReason_planReview"],
                },
              ],
              PLANNING_FAILED: { target: "#task.error" },
            },
          },

          // Coding phase - implementing subtasks
          coding: {
            on: {
              SUBTASK_COMPLETE: {
                target: "coding",
                actions: ["markSubtaskDone"],
                reenter: true,
              },
              ALL_SUBTASKS_DONE: { target: "qa_review" },
              CODING_FAILED: { target: "#task.error" },
            },
          },

          // QA Review phase - AI reviewing the work
          qa_review: {
            on: {
              QA_PASSED: {
                target: "#task.human_review",
                actions: ["setReviewReason_completed"],
              },
              QA_FAILED: { target: "qa_fixing" },
            },
          },

          // QA Fixing phase - fixing issues found by QA
          qa_fixing: {
            on: {
              QA_FIXING_COMPLETE: { target: "qa_review" },
              QA_FIXING_FAILED: { target: "#task.error" },
            },
          },
        },

        // Events that can occur in any in_progress substate
        on: {
          USER_STOPPED: [
            {
              target: "backlog",
              guard: "noProgress",
            },
            {
              target: "human_review",
              actions: ["setReviewReason_stopped"],
            },
          ],
        },
      },

      // ==========================================================================
      // Human Review - Waiting for human approval
      // ==========================================================================
      human_review: {
        on: {
          APPROVED: { target: "done" },
          REJECTED: { target: "in_progress.coding" },
          CREATE_PR: { target: "pr_created" },
        },
      },

      // ==========================================================================
      // Done - Task completed
      // ==========================================================================
      done: {
        type: "final",
      },

      // ==========================================================================
      // PR Created - Pull request created
      // ==========================================================================
      pr_created: {
        type: "final",
      },

      // ==========================================================================
      // Error - Task encountered an error
      // ==========================================================================
      error: {
        on: {
          RETRY: { target: "in_progress" },
          ABANDON: { target: "backlog" },
        },
      },
    },
  },
  {
    guards,
    actions,
  }
);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract XState value from a state snapshot
 */
export function getStateValue(snapshot: AnyMachineSnapshot): XStateValue {
  const value = snapshot.value;
  if (typeof value === "string") {
    return value;
  }
  // Handle nested state (in_progress with substate)
  if (typeof value === "object" && value !== null) {
    return value as XStateValue;
  }
  return "backlog";
}

/**
 * Convert XState state value to TaskStatus
 *
 * Maps the XState state machine value to the existing TaskStatus type.
 * Substates qa_review and qa_fixing map to ai_review.
 *
 * @param value - XState state value
 * @returns Corresponding TaskStatus
 */
export function xstateToTaskStatus(value: XStateValue): TaskStatus {
  if (typeof value === "string") {
    // Direct mapping for top-level states
    return value as TaskStatus;
  }

  // Handle nested in_progress states
  if (typeof value === "object" && "in_progress" in value) {
    const phase = value.in_progress;
    // qa_review and qa_fixing map to ai_review status
    if (phase === "qa_review" || phase === "qa_fixing") {
      return "ai_review";
    }
    // planning and coding remain as in_progress
    return "in_progress";
  }

  // Default fallback
  return "backlog";
}

/**
 * Get ExecutionPhase from XState value
 *
 * @param value - XState state value
 * @returns ExecutionPhase or undefined if not in progress
 */
export function xstateToExecutionPhase(value: XStateValue): ExecutionPhase | undefined {
  if (typeof value === "object" && "in_progress" in value) {
    return value.in_progress;
  }
  return undefined;
}

/**
 * Navigation paths to reach each state from initial state
 * Maps state names to the sequence of events needed to reach them
 */
const STATE_NAVIGATION_PATHS: Record<string, TaskMachineEvent[]> = {
  backlog: [],
  queue: [{ type: "QUEUE" }],
  error: [{ type: "QUEUE" }, { type: "START" }, { type: "PLANNING_FAILED" }],
  human_review: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLANNING_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "QA_PASSED" },
  ],
  done: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLANNING_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "QA_PASSED" },
    { type: "APPROVED" },
  ],
  pr_created: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLANNING_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "QA_PASSED" },
    { type: "CREATE_PR" },
  ],
};

/**
 * Navigation paths for in_progress substates
 */
const IN_PROGRESS_NAVIGATION_PATHS: Record<string, TaskMachineEvent[]> = {
  planning: [{ type: "QUEUE" }, { type: "START" }],
  coding: [{ type: "QUEUE" }, { type: "START" }, { type: "PLANNING_COMPLETE" }],
  qa_review: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLANNING_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
  ],
  qa_fixing: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLANNING_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "QA_FAILED" },
  ],
  // "complete" phase doesn't have a corresponding state machine state
  // It's only used as a logical marker
  complete: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLANNING_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "QA_PASSED" },
  ],
};

/**
 * Resolve a state value to a snapshot by navigating from initial state
 *
 * This function creates a snapshot at the target state by replaying
 * the necessary events from the initial state. This is the correct way
 * to compute transitions from an arbitrary state in XState v5.
 *
 * @param stateValue - The state value to resolve
 * @param context - Optional context overrides
 * @returns A snapshot at the target state
 */
export function resolveStateSnapshot(
  stateValue: XStateValue,
  context?: Partial<TaskMachineContext>
): AnyMachineSnapshot {
  // Get initial snapshot
  const initialSnapshot = getInitialSnapshot(taskMachine, context);

  // Determine the navigation path
  let events: TaskMachineEvent[] = [];

  if (typeof stateValue === "string") {
    events = STATE_NAVIGATION_PATHS[stateValue] ?? [];
  } else if (typeof stateValue === "object" && "in_progress" in stateValue) {
    const phase = stateValue.in_progress;
    events = IN_PROGRESS_NAVIGATION_PATHS[phase] ?? [];
  }

  // Navigate to the target state by replaying events
  let currentSnapshot: AnyMachineSnapshot = initialSnapshot;
  for (const event of events) {
    const [nextSnapshot] = transition(taskMachine, currentSnapshot, event);
    currentSnapshot = nextSnapshot;
  }

  return currentSnapshot;
}

/**
 * Create a task actor from initial state
 *
 * @param initialState - Initial XState value (default: "backlog")
 * @param context - Optional context overrides
 * @returns XState actor
 */
export function createTaskActor(
  initialState: XStateValue = "backlog",
  context?: Partial<TaskMachineContext>
) {
  // Resolve the state to a proper snapshot
  const snapshot = resolveStateSnapshot(initialState, context);

  const actor = createActor(taskMachine, {
    snapshot,
  });

  return actor;
}

/**
 * Get the next state given current state and event
 *
 * Uses XState v5's pure transition() function to compute state transitions
 * without creating an actor. This correctly handles the current state.
 *
 * @param currentState - Current XState value
 * @param event - Event to send
 * @param context - Current context
 * @returns New state value and whether the transition was valid
 */
export function getNextState(
  currentState: XStateValue,
  event: TaskMachineEvent,
  context?: Partial<TaskMachineContext>
): { value: XStateValue; changed: boolean } {
  try {
    // Resolve the current state to a proper snapshot
    const currentSnapshot = resolveStateSnapshot(currentState, context);

    // Use XState v5's transition function to compute the next state
    const [nextSnapshot] = transition(taskMachine, currentSnapshot, event);

    // Get state values for comparison
    const currentValue = getStateValue(currentSnapshot);
    const nextValue = getStateValue(nextSnapshot);

    // Check if state actually changed
    const changed = JSON.stringify(currentValue) !== JSON.stringify(nextValue);

    return {
      value: nextValue,
      changed,
    };
  } catch {
    // If transition fails, return unchanged
    return {
      value: currentState,
      changed: false,
    };
  }
}
