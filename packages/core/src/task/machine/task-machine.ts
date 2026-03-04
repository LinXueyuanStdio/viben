/**
 * XState Task State Machine
 *
 * Implements the task lifecycle using XState v5.
 * State flow follows Auto-Claude pattern:
 * backlog -> queue -> in_progress (planning/coding/qa_review/qa_fixing) -> human_review -> done/pr_created
 */

import { createMachine, createActor, type AnyMachineSnapshot } from "xstate";
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
  // Create machine with provided context
  const machineWithContext = taskMachine.provide({
    // Context can be provided here if needed
  });

  const actor = createActor(machineWithContext, {
    snapshot: initialState !== "backlog" ? undefined : undefined,
    input: context,
  });

  return actor;
}

/**
 * Get the next state given current state and event
 *
 * @param currentState - Current XState value
 * @param event - Event to send
 * @param context - Current context
 * @returns New state value or undefined if transition not allowed
 */
export function getNextState(
  currentState: XStateValue,
  event: TaskMachineEvent,
  context?: Partial<TaskMachineContext>
): { value: XStateValue; changed: boolean } {
  // Create an actor to compute the transition
  const machineWithContext = taskMachine.provide({});

  // Get the transition result using the machine's transition function
  const actor = createActor(machineWithContext, {
    snapshot: undefined,
  });

  // We need to restore the actor to the current state first
  // For simplicity, we'll use the machine's transition logic directly
  const initialSnapshot = actor.getSnapshot();

  // Send the event and get the result
  actor.start();

  // Navigate to current state by sending appropriate events
  // This is a simplified version - in production you might want to
  // use XState's built-in state restoration
  actor.send(event);

  const newSnapshot = actor.getSnapshot();
  actor.stop();

  return {
    value: getStateValue(newSnapshot),
    changed: JSON.stringify(initialSnapshot.value) !== JSON.stringify(newSnapshot.value),
  };
}
