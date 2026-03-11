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
} from "../../services/task-service";
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
    priority: "P2",
    createdAt: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

/**
 * Create a task in a specific state with appropriate xstateState
 */
export function createTaskInState(
  status: TaskStatus,
  overrides?: Partial<UnifiedTask> & {
    xstateState?: XStateValue;
    eventHistory?: TaskEvent[];
  }
): UnifiedTask {
  const task = createMockTask({
    status,
    ...overrides,
  });

  // Set xstateState based on status if not provided
  if (!overrides?.xstateState) {
    task.xstateState = statusToXStateValue(status);
  } else {
    task.xstateState = overrides.xstateState;
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
    eventId: `evt_${Date.now()}`,
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
    eventId: `evt_${startSequence + index}`,
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
  lastEvent: createMockEvent({ type: "QUEUE", sequence: 1 }),
});

/**
 * Task in plan phase
 */
export const TASK_PLAN = createTaskInState("in_progress", {
  xstateState: { in_progress: "plan" },
  lastEvent: createMockEvent({ type: "START", sequence: 2 }),
});

/**
 * Task in implement phase
 */
export const TASK_IMPLEMENT = createTaskInState("in_progress", {
  xstateState: { in_progress: "implement" },
  lastEvent: createMockEvent({ type: "PLAN_COMPLETE", sequence: 3 }),
});

/**
 * Task in check phase
 */
export const TASK_CHECK = createTaskInState("in_progress", {
  xstateState: { in_progress: "check" },
  lastEvent: createMockEvent({ type: "ALL_SUBTASKS_DONE", sequence: 4 }),
});

/**
 * Task in human review state
 */
export const TASK_HUMAN_REVIEW = createTaskInState("human_review", {
  reviewReason: "completed",
  lastEvent: createMockEvent({ type: "CHECK_PASSED", sequence: 5 }),
});

/**
 * Completed task
 */
export const TASK_COMPLETED = createTaskInState("completed", {
  lastEvent: createMockEvent({ type: "APPROVED", sequence: 6 }),
  completedAt: DEFAULT_CREATED_AT,
});

/**
 * Failed task
 */
export const TASK_FAILED = createTaskInState("failed", {
  lastEvent: createMockEvent({ type: "PLAN_FAILED", sequence: 3 }),
});

/**
 * Paused task (from queue)
 */
export const TASK_PAUSED_FROM_QUEUE = createTaskInState("paused", {
  lastEvent: createMockEvent({ type: "PAUSE", sequence: 2 }),
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
  lastEvent: createMockEvent({ type: "PAUSE", sequence: 4 }),
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
