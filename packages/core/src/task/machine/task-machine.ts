/**
 * XState Task State Machine
 *
 * Implements the task lifecycle using XState v5.
 * State flow follows Auto-Claude pattern:
 * backlog -> queue -> in_progress (plan/implement/check/fix) -> review -> completed
 *
 * Terminal states: completed, failed, cancelled
 */

import {
  createMachine,
  type AnyMachineSnapshot,
  getInitialSnapshot,
  transition,
} from "xstate";
import type { TaskStatus, ReviewReason, ExecutionPhase } from "../ops/types";
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
 * Pause snapshot - saved when task is paused for complete restoration on RESUME
 */
export interface PausedSnapshot {
  /** State value before pausing */
  from_state: XStateValue;
  /** Current subtask index at pause time */
  subtask_index: number;
  /** Optional execution context for the executor */
  execution_context?: Record<string, unknown>;
  /** ISO timestamp when paused */
  paused_at: string;
}

/**
 * Task machine context - data that persists across state transitions
 */
export interface TaskMachineContext {
  /** Task ID */
  taskId: string;
  /** Reason for entering review state */
  reviewReason?: ReviewReason;
  /** Current subtask index (0-based) */
  currentSubtaskIndex: number;
  /** Whether plan requires review before implement */
  requiresPlanReview: boolean;
  /**
   * @deprecated Use paused_snapshot instead for complete restoration
   * Kept for backward compatibility during transition
   */
  pausedFromState?: XStateValue;
  /** Complete snapshot saved when task is paused */
  paused_snapshot?: PausedSnapshot;
}

/**
 * Task machine events
 */
export type TaskMachineEvent =
  | { type: "QUEUE" }
  | { type: "START" }
  | { type: "DEQUEUE" }
  | { type: "PLAN_COMPLETE" }
  | { type: "PLAN_FAILED" }
  | { type: "SUBTASK_COMPLETE" }
  | { type: "ALL_SUBTASKS_DONE" }
  | { type: "IMPLEMENT_FAILED" }
  | { type: "CHECK_PASSED" }
  | { type: "CHECK_FAILED" }
  | { type: "FIX_COMPLETE" }
  | { type: "FIX_FAILED" }
  | { type: "USER_STOPPED" }
  | { type: "APPROVED" }
  | { type: "REJECTED" }
  | { type: "CANCEL" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "RETRY" }
  | { type: "ABANDON" }
  | { type: "ARCHIVE" };

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
      pausedFromState: undefined,
      paused_snapshot: undefined,
    } as TaskMachineContext,

    states: {
      // ==========================================================================
      // Backlog - Tasks waiting to be started
      // ==========================================================================
      backlog: {
        on: {
          QUEUE: {
            target: "queue",
            actions: ["setQueuedAt"],
          },
          CANCEL: { target: "cancelled" },
        },
      },

      // ==========================================================================
      // Queue - Tasks queued for execution
      // ==========================================================================
      queue: {
        on: {
          START: { target: "in_progress" },
          DEQUEUE: { target: "backlog" },
          PAUSE: {
            target: "paused",
            actions: ["savePausedSnapshot_queue"],
          },
          CANCEL: { target: "cancelled" },
        },
      },

      // ==========================================================================
      // In Progress - Task is being executed
      // ==========================================================================
      in_progress: {
        initial: "plan",

        states: {
          // Plan phase - generating implementation plan
          plan: {
            on: {
              PLAN_COMPLETE: [
                {
                  target: "implement",
                  guard: "noPlanReviewRequired",
                },
                {
                  target: "#task.review",
                  actions: ["setReviewReason_planReview"],
                },
              ],
              PLAN_FAILED: { target: "#task.failed" },
              PAUSE: {
                target: "#task.paused",
                actions: ["savePausedSnapshot_plan"],
              },
            },
          },

          // Implement phase - implementing subtasks
          implement: {
            on: {
              SUBTASK_COMPLETE: {
                target: "implement",
                actions: ["markSubtaskDone"],
                reenter: true,
              },
              ALL_SUBTASKS_DONE: { target: "check" },
              IMPLEMENT_FAILED: { target: "#task.failed" },
              PAUSE: {
                target: "#task.paused",
                actions: ["savePausedSnapshot_implement"],
              },
            },
          },

          // Check phase - AI reviewing the work
          check: {
            on: {
              CHECK_PASSED: {
                target: "#task.review",
                actions: ["setReviewReason_completed"],
              },
              CHECK_FAILED: { target: "fix" },
              PAUSE: {
                target: "#task.paused",
                actions: ["savePausedSnapshot_check"],
              },
            },
          },

          // Fix phase - fixing issues found by check
          fix: {
            on: {
              FIX_COMPLETE: { target: "check" },
              FIX_FAILED: { target: "#task.failed" },
              PAUSE: {
                target: "#task.paused",
                actions: ["savePausedSnapshot_fix"],
              },
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
              target: "review",
              actions: ["setReviewReason_stopped"],
            },
          ],
        },
      },

      // ==========================================================================
      // Paused - Task is paused, waiting to be resumed
      // ==========================================================================
      paused: {
        on: {
          RESUME: [
            // Resume to queue if paused from queue
            {
              target: "queue",
              guard: "pausedFromQueue",
              actions: ["restoreFromSnapshot"],
            },
            // Resume to in_progress.plan if paused from plan
            {
              target: "in_progress.plan",
              guard: "pausedFromPlan",
              actions: ["restoreFromSnapshot"],
            },
            // Resume to in_progress.implement if paused from implement
            {
              target: "in_progress.implement",
              guard: "pausedFromImplement",
              actions: ["restoreFromSnapshot"],
            },
            // Resume to in_progress.check if paused from check
            {
              target: "in_progress.check",
              guard: "pausedFromCheck",
              actions: ["restoreFromSnapshot"],
            },
            // Resume to in_progress.fix if paused from fix
            {
              target: "in_progress.fix",
              guard: "pausedFromFix",
              actions: ["restoreFromSnapshot"],
            },
            // Default: resume to queue (fallback)
            {
              target: "queue",
              actions: ["restoreFromSnapshot"],
            },
          ],
          ABANDON: { target: "backlog", actions: ["clearPausedSnapshot"] },
          CANCEL: { target: "cancelled", actions: ["clearPausedSnapshot"] },
        },
      },

      // ==========================================================================
      // Review - Waiting for approval
      // ==========================================================================
      review: {
        on: {
          APPROVED: { target: "completed" },
          REJECTED: { target: "backlog" },
          CANCEL: { target: "cancelled" },
        },
      },

      // ==========================================================================
      // Completed - Task successfully completed
      // ==========================================================================
      completed: {
        on: {
          ARCHIVE: { target: "archived" },
        },
      },

      // ==========================================================================
      // Failed - Task execution failed
      // ==========================================================================
      failed: {
        on: {
          RETRY: { target: "queue" },
          ABANDON: { target: "backlog" },
          ARCHIVE: { target: "archived" },
        },
      },

      // ==========================================================================
      // Cancelled - Task was cancelled by user
      // ==========================================================================
      cancelled: {
        on: {
          ARCHIVE: { target: "archived" },
        },
      },

      // ==========================================================================
      // Archived - Task archived for reference
      // ==========================================================================
      archived: {
        type: "final",
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
 * All in_progress substates (plan, implement, check, fix) map to in_progress.
 * The specific phase is captured in executionProgress.phase separately.
 *
 * Note: Use executionPhase to determine check/fix phase
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
    // All in_progress substates (plan, implement, check, fix) map to in_progress
    // The specific phase is captured in executionProgress.phase
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
  paused: [{ type: "QUEUE" }, { type: "PAUSE" }],
  failed: [{ type: "QUEUE" }, { type: "START" }, { type: "PLAN_FAILED" }],
  review: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "CHECK_PASSED" },
  ],
  completed: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "CHECK_PASSED" },
    { type: "APPROVED" },
  ],
  cancelled: [{ type: "CANCEL" }],
  // Legacy mappings for backward compatibility
  done: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "CHECK_PASSED" },
    { type: "APPROVED" },
  ],
  error: [{ type: "QUEUE" }, { type: "START" }, { type: "PLAN_FAILED" }],
  pr_created: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "CHECK_PASSED" },
    { type: "APPROVED" },
  ],
};

/**
 * Navigation paths for in_progress substates
 */
const IN_PROGRESS_NAVIGATION_PATHS: Record<string, TaskMachineEvent[]> = {
  plan: [{ type: "QUEUE" }, { type: "START" }],
  implement: [{ type: "QUEUE" }, { type: "START" }, { type: "PLAN_COMPLETE" }],
  check: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
  ],
  fix: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "CHECK_FAILED" },
  ],
  // "complete" phase doesn't have a corresponding state machine state
  // It's only used as a logical marker
  complete: [
    { type: "QUEUE" },
    { type: "START" },
    { type: "PLAN_COMPLETE" },
    { type: "ALL_SUBTASKS_DONE" },
    { type: "CHECK_PASSED" },
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
