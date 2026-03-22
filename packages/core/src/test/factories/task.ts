/**
 * Task test factories
 */
import type {
  TaskJson,
  TaskStatus,
  IssuePriority,
} from "../../task/ops/types";

/**
 * Create a mock task with sensible defaults
 */
export function createMockTask(overrides: Partial<TaskJson> = {}): TaskJson {
  const now = new Date().toISOString();
  return {
    id: "test-task",
    name: "test-task",
    title: "Test Task",
    status: "backlog",
    priority: "medium",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create multiple mock tasks
 */
export function createMockTasks(
  count: number,
  overrides?: (index: number) => Partial<TaskJson>
): TaskJson[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTask({
      id: `task-${i + 1}`,
      name: `task-${i + 1}`,
      title: `Task ${i + 1}`,
      ...overrides?.(i),
    })
  );
}

/**
 * Create a task in a specific status
 */
export function createTaskInStatus(
  status: TaskStatus,
  overrides: Partial<TaskJson> = {}
): TaskJson {
  return createMockTask({ status, ...overrides });
}

/**
 * Create a task with phase information
 * Phase numbers: 0 = plan, 1 = implement, 2 = check, 3 = fix, 4 = complete
 */
export function createTaskWithPhase(
  phase: number,
  overrides: Partial<TaskJson> = {}
): TaskJson {
  return createMockTask({
    status: "in_progress",
    current_phase: phase,
    ...overrides,
  });
}

/**
 * All valid task statuses for iteration
 */
export const ALL_TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "queue",
  "in_progress",
  "paused",
  "review",
  "completed",
  "failed",
  "cancelled",
  "archived",
];

/**
 * All valid task priorities for iteration
 */
export const ALL_TASK_PRIORITIES: IssuePriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];
