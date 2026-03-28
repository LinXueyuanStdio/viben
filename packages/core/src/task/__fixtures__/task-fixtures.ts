/**
 * Test Fixtures for Task Module
 *
 * Provides factory functions to create mock tasks and contexts
 * for testing the task state machine and event store.
 */

import type {
  UnifiedTask,
  TaskStatus,
  TaskEvent,
  XStateValue,
} from "../ops/types";
import type { TaskMachineContext, PausedSnapshot } from "../machine/task-machine";

// =============================================================================
// Default Values
// =============================================================================

const DEFAULT_TASK_ID = "test-task-001";
const DEFAULT_TASK_NAME = "test-task";
const DEFAULT_TASK_TITLE = "Test Task";
const DEFAULT_CREATED_AT = "2026-01-15T10:00:00.000Z";

// =============================================================================
// TaskMachineContext Fixtures
// =============================================================================

/**
 * Create a mock TaskMachineContext for testing guards and actions
 */
export function createMockContext(
  overrides?: Partial<TaskMachineContext>
): TaskMachineContext {
  return {
    taskId: DEFAULT_TASK_ID,
    currentSubtaskIndex: 0,
    requiresPlanReview: false,
    pausedFromState: undefined,
    paused_snapshot: undefined,
    reviewReason: undefined,
    ...overrides,
  };
}

/**
 * Create a paused context with snapshot information
 *
 * @param fromState - The state the task was paused from
 * @param subtaskIndexOrOverrides - Either a subtask index (number) or context overrides
 */
export function createPausedContext(
  fromState: XStateValue,
  subtaskIndexOrOverrides?: number | Partial<TaskMachineContext>
): TaskMachineContext {
  // Handle both number and object overrides
  const subtaskIndex = typeof subtaskIndexOrOverrides === "number"
    ? subtaskIndexOrOverrides
    : subtaskIndexOrOverrides?.currentSubtaskIndex ?? 0;
  const overrides = typeof subtaskIndexOrOverrides === "object"
    ? subtaskIndexOrOverrides
    : { currentSubtaskIndex: subtaskIndex };

  const snapshot: PausedSnapshot = {
    from_state: fromState,
    subtask_index: subtaskIndex,
    paused_at: DEFAULT_CREATED_AT,
  };

  return createMockContext({
    currentSubtaskIndex: subtaskIndex,
    pausedFromState: fromState,
    paused_snapshot: snapshot,
    ...overrides,
  });
}

// =============================================================================
// UnifiedTask Fixtures
// =============================================================================

/**
 * Create a mock UnifiedTask for testing event store
 */
export function createMockTask(
  overrides?: Partial<UnifiedTask>
): UnifiedTask {
  return {
    id: DEFAULT_TASK_ID,
    name: DEFAULT_TASK_NAME,
    title: DEFAULT_TASK_TITLE,
    status: "backlog",
    priority: "medium",
    created_at: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

/**
 * Create a task in a specific state with appropriate xstate_state
 */
export function createTaskInState(
  status: TaskStatus,
  overrides?: Partial<UnifiedTask> & {
    xstate_state?: XStateValue;
    event_history?: TaskEvent[];
  }
): UnifiedTask {
  const task = createMockTask({
    status,
    ...overrides,
  });

  // Set xstate_state based on status if not provided
  if (!overrides?.xstate_state) {
    task.xstate_state = statusToXStateValue(status);
  } else {
    task.xstate_state = overrides.xstate_state;
  }

  return task;
}

/**
 * Convert TaskStatus to XStateValue
 */
function statusToXStateValue(status: TaskStatus): XStateValue {
  switch (status) {
    case "in_progress":
      return { in_progress: "plan" };
    default:
      return status;
  }
}

// =============================================================================
// TaskEvent Fixtures
// =============================================================================

/**
 * Create a mock TaskEvent
 */
export function createMockEvent(
  overrides?: Partial<TaskEvent>
): TaskEvent {
  return {
    event_id: `evt_${Date.now()}`,
    sequence: 1,
    type: "QUEUE",
    timestamp: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

/**
 * Create a sequence of events for testing
 */
export function createEventSequence(
  types: TaskEvent["type"][],
  startSequence = 1
): TaskEvent[] {
  return types.map((type, index) => ({
    event_id: `evt_${startSequence + index}`,
    sequence: startSequence + index,
    type,
    timestamp: new Date(
      new Date(DEFAULT_CREATED_AT).getTime() + index * 60000
    ).toISOString(),
  }));
}

// =============================================================================
// Pre-defined Task States
// =============================================================================

/**
 * Task in backlog state (initial)
 */
export const TASK_BACKLOG = createTaskInState("backlog");

/**
 * Task in queue state
 */
export const TASK_QUEUED = createTaskInState("queue", {
  last_event: createMockEvent({ type: "QUEUE", sequence: 1 }),
});

/**
 * Task in plan phase
 */
export const TASK_PLAN = createTaskInState("in_progress", {
  xstate_state: { in_progress: "plan" },
  last_event: createMockEvent({ type: "START", sequence: 2 }),
});

/**
 * Task in implement phase
 */
export const TASK_IMPLEMENT = createTaskInState("in_progress", {
  xstate_state: { in_progress: "implement" },
  last_event: createMockEvent({ type: "PLAN_COMPLETE", sequence: 3 }),
});

/**
 * Task in check phase
 */
export const TASK_CHECK = createTaskInState("in_progress", {
  xstate_state: { in_progress: "check" },
  last_event: createMockEvent({ type: "ALL_SUBTASKS_DONE", sequence: 4 }),
});

/**
 * Task in review state
 */
export const TASK_REVIEW = createTaskInState("review", {
  review_reason: "completed",
  last_event: createMockEvent({ type: "CHECK_PASSED", sequence: 5 }),
});

/**
 * Completed task
 */
export const TASK_COMPLETED = createTaskInState("completed", {
  last_event: createMockEvent({ type: "APPROVED", sequence: 6 }),
  completed_at: DEFAULT_CREATED_AT,
});

/**
 * Failed task
 */
export const TASK_FAILED = createTaskInState("failed", {
  last_event: createMockEvent({ type: "PLAN_FAILED", sequence: 3 }),
});

/**
 * Paused task (from queue)
 */
export const TASK_PAUSED_FROM_QUEUE = createTaskInState("paused", {
  last_event: createMockEvent({ type: "PAUSE", sequence: 2 }),
  machine_context: {
    current_subtask_index: 0,
    requires_plan_review: false,
    paused_snapshot: {
      from_state: "queue",
      subtask_index: 0,
      paused_at: DEFAULT_CREATED_AT,
    },
  },
});

/**
 * Paused task (from implement)
 */
export const TASK_PAUSED_FROM_IMPLEMENT = createTaskInState("paused", {
  last_event: createMockEvent({ type: "PAUSE", sequence: 4 }),
  machine_context: {
    current_subtask_index: 2,
    requires_plan_review: false,
    paused_snapshot: {
      from_state: { in_progress: "implement" },
      subtask_index: 2,
      paused_at: DEFAULT_CREATED_AT,
    },
  },
});
