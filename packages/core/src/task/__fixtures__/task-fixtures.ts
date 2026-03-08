/**
 * Test Fixtures for Task State Machine Tests
 *
 * Provides factory functions for creating mock tasks, contexts, and snapshots.
 */

import type { UnifiedTask, TaskStatus, ReviewReason, ExecutionPhase } from "../../services/task-service";
import type { TaskMachineContext, XStateValue, PausedSnapshot } from "../machine/task-machine";

// =============================================================================
// Mock Task Factory
// =============================================================================

/**
 * Default task values for testing
 */
const DEFAULT_TASK: UnifiedTask = {
  id: "task_test_001",
  name: "test-task",
  title: "Test Task",
  description: "A test task for unit testing",
  status: "backlog",
  priority: "P2",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/**
 * Create a mock task with optional overrides
 */
export function createMockTask(overrides?: Partial<UnifiedTask>): UnifiedTask {
  return {
    ...DEFAULT_TASK,
    ...overrides,
    id: overrides?.id ?? `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
}

/**
 * Create a mock task in a specific state
 */
export function createTaskInState(
  status: TaskStatus,
  overrides?: Partial<UnifiedTask>
): UnifiedTask {
  const baseOverrides: Partial<UnifiedTask> = { status };

  // Set xstateState based on status
  switch (status) {
    case "backlog":
      baseOverrides.xstateState = "backlog";
      break;
    case "queue":
      baseOverrides.xstateState = "queue";
      baseOverrides.queuedAt = new Date().toISOString();
      break;
    case "in_progress":
      baseOverrides.xstateState = { in_progress: "planning" };
      break;
    case "paused":
      baseOverrides.xstateState = "paused";
      break;
    case "human_review":
      baseOverrides.xstateState = "human_review";
      break;
    case "completed":
      baseOverrides.xstateState = "completed";
      baseOverrides.completedAt = new Date().toISOString();
      break;
    case "failed":
      baseOverrides.xstateState = "failed";
      break;
    case "cancelled":
      baseOverrides.xstateState = "cancelled";
      baseOverrides.completedAt = new Date().toISOString();
      break;
  }

  return createMockTask({ ...baseOverrides, ...overrides });
}

// =============================================================================
// Mock Context Factory
// =============================================================================

/**
 * Default context values for testing
 */
const DEFAULT_CONTEXT: TaskMachineContext = {
  taskId: "task_test_001",
  reviewReason: undefined,
  currentSubtaskIndex: 0,
  requiresPlanReview: false,
  pausedFromState: undefined,
  paused_snapshot: undefined,
};

/**
 * Create a mock task machine context with optional overrides
 */
export function createMockContext(
  overrides?: Partial<TaskMachineContext>
): TaskMachineContext {
  return {
    ...DEFAULT_CONTEXT,
    ...overrides,
  };
}

/**
 * Create a context with progress (subtask index > 0)
 */
export function createContextWithProgress(
  subtaskIndex: number,
  overrides?: Partial<TaskMachineContext>
): TaskMachineContext {
  return createMockContext({
    currentSubtaskIndex: subtaskIndex,
    ...overrides,
  });
}

// =============================================================================
// Mock Paused Snapshot Factory
// =============================================================================

/**
 * Create a mock paused snapshot
 */
export function createMockPausedSnapshot(
  fromState: XStateValue,
  subtaskIndex = 0,
  overrides?: Partial<PausedSnapshot>
): PausedSnapshot {
  return {
    from_state: fromState,
    subtask_index: subtaskIndex,
    paused_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a context with paused snapshot (for RESUME testing)
 */
export function createPausedContext(
  fromState: XStateValue,
  subtaskIndex = 0,
  overrides?: Partial<TaskMachineContext>
): TaskMachineContext {
  return createMockContext({
    pausedFromState: fromState,
    paused_snapshot: createMockPausedSnapshot(fromState, subtaskIndex),
    currentSubtaskIndex: subtaskIndex,
    ...overrides,
  });
}

// =============================================================================
// Predefined Task States
// =============================================================================

/**
 * Predefined tasks in each state for quick testing
 */
export const TASK_STATES: Record<TaskStatus, UnifiedTask> = {
  backlog: createTaskInState("backlog"),
  queue: createTaskInState("queue"),
  in_progress: createTaskInState("in_progress"),
  paused: createTaskInState("paused", {
    machine_context: {
      current_subtask_index: 1,
      requires_plan_review: false,
      paused_snapshot: {
        from_state: { in_progress: "coding" },
        subtask_index: 1,
        paused_at: new Date().toISOString(),
      },
    },
  }),
  human_review: createTaskInState("human_review", { reviewReason: "completed" }),
  completed: createTaskInState("completed"),
  failed: createTaskInState("failed"),
  cancelled: createTaskInState("cancelled"),
};

// =============================================================================
// XState Value Helpers
// =============================================================================

/**
 * In-progress substate values for testing
 */
export const IN_PROGRESS_STATES: Record<ExecutionPhase, XStateValue> = {
  planning: { in_progress: "planning" },
  coding: { in_progress: "coding" },
  qa_review: { in_progress: "qa_review" },
  qa_fixing: { in_progress: "qa_fixing" },
  complete: { in_progress: "complete" } as XStateValue, // Note: not a real XState state
};

/**
 * All valid top-level states
 */
export const TOP_LEVEL_STATES: XStateValue[] = [
  "backlog",
  "queue",
  "paused",
  "human_review",
  "completed",
  "failed",
  "cancelled",
];

// =============================================================================
// Event Helpers
// =============================================================================

/**
 * Create a mock task event
 */
export function createMockEvent(
  type: string,
  sequence: number,
  overrides?: Partial<{
    eventId: string;
    timestamp: string;
    payload: Record<string, unknown>;
  }>
): {
  eventId: string;
  sequence: number;
  type: string;
  timestamp: string;
  payload?: Record<string, unknown>;
} {
  return {
    eventId: overrides?.eventId ?? `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sequence,
    type,
    timestamp: overrides?.timestamp ?? new Date().toISOString(),
    payload: overrides?.payload,
  };
}

// =============================================================================
// Review Reason Constants
// =============================================================================

export const REVIEW_REASONS: ReviewReason[] = [
  "completed",
  "errors",
  "qa_rejected",
  "plan_review",
  "stopped",
];
