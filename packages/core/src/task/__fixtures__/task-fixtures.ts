/**
 * Task Test Fixtures
 *
 * Helper functions to create test data for task-related tests.
 */

import type { TaskMachineContext, XStateValue, PausedSnapshot } from "../machine/task-machine";
import type { UnifiedTask, TaskEvent, TaskEventType, TaskStatus } from "../../services/task-service";

// =============================================================================
// Context Fixtures
// =============================================================================

/**
 * Create a mock TaskMachineContext with optional overrides
 */
export function createMockContext(
  overrides?: Partial<TaskMachineContext>
): TaskMachineContext {
  return {
    taskId: "test-task-001",
    currentSubtaskIndex: 0,
    requiresPlanReview: false,
    ...overrides,
  };
}

/**
 * Create a paused context with the specified from state
 *
 * @param fromState - Can be a string for simple states like "queue",
 *                    or an object like { in_progress: "planning" } for nested states
 */
export function createPausedContext(
  fromState: XStateValue | string
): TaskMachineContext {
  const stateValue: XStateValue =
    typeof fromState === "string" ? fromState : fromState;

  const pausedSnapshot: PausedSnapshot = {
    from_state: stateValue,
    subtask_index: 0,
    paused_at: new Date().toISOString(),
  };

  return createMockContext({
    paused_snapshot: pausedSnapshot,
  });
}

// =============================================================================
// Task Fixtures
// =============================================================================

/**
 * Create a mock UnifiedTask with optional overrides
 */
export function createMockTask(
  overrides?: Partial<UnifiedTask>
): UnifiedTask {
  return {
    id: "test-task-001",
    name: "test-task",
    title: "Test Task",
    status: "backlog" as TaskStatus,
    priority: "P2",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a task in a specific state
 */
export function createTaskInState(
  status: TaskStatus,
  overrides?: Partial<UnifiedTask>
): UnifiedTask {
  return createMockTask({
    status,
    ...overrides,
  });
}

// =============================================================================
// Event Fixtures
// =============================================================================

/**
 * Create a mock TaskEvent with optional overrides
 */
export function createMockEvent(
  overrides?: Partial<TaskEvent>
): TaskEvent {
  return {
    eventId: `evt-${Date.now()}`,
    type: "STATUS_CHANGED" as TaskEventType,
    timestamp: new Date().toISOString(),
    sequence: 1,
    ...overrides,
  };
}
