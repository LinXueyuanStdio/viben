/**
 * Task Scheduler
 *
 * Implements dependency checking and priority-based task scheduling.
 * This module provides utilities for:
 * - Checking if task dependencies are met
 * - Detecting circular dependencies
 * - Priority-based task selection with FIFO within same priority
 *
 * @see docs/plans/2026-03-08-task-system-improvements-design.md Section 4
 */

import type { UnifiedTask, TaskStatus } from "../../task/service";
import { logger as globalLogger } from "../../telemetry";

/**
 * Module-level logger for queue scheduler
 */
const log = globalLogger.child({ module: "queue-scheduler" });

/**
 * Priority order mapping for scheduling
 * Lower number = higher priority
 * Uses IssuePriority values: urgent, high, medium, low, none
 */
const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

/**
 * Statuses that indicate a task is "completed" for dependency purposes
 */
const COMPLETED_STATUSES: TaskStatus[] = ["completed"];

/**
 * Check if all dependencies of a task are met
 *
 * A dependency is considered met if the dependent task:
 * - Exists in the task map
 * - Has status "completed"
 *
 * @param task - The task to check dependencies for
 * @param allTasks - Map of all tasks by ID
 * @returns True if all dependencies are met (or task has no dependencies)
 */
export function allDependenciesMet(
  task: UnifiedTask,
  allTasks: Map<string, UnifiedTask>
): boolean {
  // No dependencies = all met
  if (!task.dependsOn || task.dependsOn.length === 0) {
    return true;
  }

  return task.dependsOn.every((depId) => {
    const depTask = allTasks.get(depId);
    if (!depTask) {
      // Dependency task not found - treat as not met
      // This prevents starting tasks with invalid dependencies
      log.warn(
        { taskId: task.id, missingDependency: depId },
        "Task has dependency on non-existent task"
      );
      return false;
    }
    return COMPLETED_STATUSES.includes(depTask.status);
  });
}

/**
 * Detect circular dependencies in task relationships
 *
 * Uses depth-first search to detect cycles in the dependency graph.
 *
 * @param taskId - The task ID to start checking from
 * @param dependsOn - The proposed dependencies for this task
 * @param allTasks - Map of all tasks by ID
 * @returns Object with hasCycle flag and optional cycle path
 */
export function detectCyclicDependency(
  taskId: string,
  dependsOn: string[],
  allTasks: Map<string, UnifiedTask>
): { hasCycle: boolean; cyclePath?: string[] } {
  // Build a temporary dependency map including the proposed change
  const dependencyMap = new Map<string, string[]>();

  // Copy existing dependencies
  allTasks.forEach((task, id) => {
    if (task.dependsOn && task.dependsOn.length > 0) {
      dependencyMap.set(id, [...task.dependsOn]);
    }
  });

  // Add/update the proposed dependencies
  dependencyMap.set(taskId, dependsOn);

  // DFS to detect cycle
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(currentId: string): boolean {
    visited.add(currentId);
    recursionStack.add(currentId);
    path.push(currentId);

    const deps = dependencyMap.get(currentId) || [];
    for (const depId of deps) {
      if (!visited.has(depId)) {
        if (dfs(depId)) {
          return true; // Cycle found in subtree
        }
      } else if (recursionStack.has(depId)) {
        // Found a back edge - cycle detected
        path.push(depId); // Complete the cycle path
        return true;
      }
    }

    recursionStack.delete(currentId);
    path.pop();
    return false;
  }

  // Start DFS from the task being modified
  const hasCycle = dfs(taskId);

  if (hasCycle) {
    // Extract the cycle portion of the path
    const cycleStart = path[path.length - 1];
    const cycleStartIndex = path.indexOf(cycleStart);
    const cyclePath = path.slice(cycleStartIndex);
    return { hasCycle: true, cyclePath };
  }

  return { hasCycle: false };
}

/**
 * Get the next task to execute from a list of tasks
 *
 * Selection criteria (in order):
 * 1. Filter tasks with status === 'queue'
 * 2. Filter tasks with all dependencies met
 * 3. Sort by priority (urgent > high > medium > low > none)
 * 4. Within same priority, sort by queuedAt (FIFO)
 *
 * Note: This implements "soft" priority - high priority tasks don't preempt
 * running tasks, they just get scheduled first when capacity is available.
 *
 * @param tasks - Array of all tasks
 * @param allTasksMap - Map of all tasks by ID (for dependency checking)
 * @returns The highest priority ready task, or null if none available
 */
export function getNextTask(
  tasks: UnifiedTask[],
  allTasksMap: Map<string, UnifiedTask>
): UnifiedTask | null {
  // Filter to only queued tasks
  const queuedTasks = tasks.filter((t) => t.status === "queue");

  if (queuedTasks.length === 0) {
    return null;
  }

  // Filter to only tasks with dependencies met
  const readyTasks = queuedTasks.filter((t) =>
    allDependenciesMet(t, allTasksMap)
  );

  if (readyTasks.length === 0) {
    return null;
  }

  // Sort by priority, then by queuedAt (FIFO within same priority)
  const sorted = readyTasks.sort((a, b) => {
    // 1. Priority comparison (lower number = higher priority)
    const priorityA = PRIORITY_ORDER[a.priority] ?? PRIORITY_ORDER.medium;
    const priorityB = PRIORITY_ORDER[b.priority] ?? PRIORITY_ORDER.medium;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // 2. FIFO within same priority - use queuedAt or createdAt
    const timeA = new Date(a.queuedAt ?? a.createdAt).getTime();
    const timeB = new Date(b.queuedAt ?? b.createdAt).getTime();

    return timeA - timeB;
  });

  return sorted[0] ?? null;
}

/**
 * Get all tasks that are blocked by a given task
 *
 * These are tasks that have the given task ID in their dependsOn array.
 *
 * @param taskId - The task ID to find dependents for
 * @param allTasks - Map of all tasks by ID
 * @returns Array of tasks that depend on the given task
 */
export function getDependentTasks(
  taskId: string,
  allTasks: Map<string, UnifiedTask>
): UnifiedTask[] {
  const dependents: UnifiedTask[] = [];

  allTasks.forEach((task) => {
    if (task.dependsOn && task.dependsOn.includes(taskId)) {
      dependents.push(task);
    }
  });

  return dependents;
}

/**
 * Validate dependencies before creating/updating a task
 *
 * @param taskId - The task ID being created/updated
 * @param dependsOn - The proposed dependencies
 * @param allTasks - Map of all tasks by ID
 * @returns Validation result with errors if any
 */
export function validateDependencies(
  taskId: string,
  dependsOn: string[],
  allTasks: Map<string, UnifiedTask>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for self-dependency
  if (dependsOn.includes(taskId)) {
    errors.push("Task cannot depend on itself");
  }

  // Check for non-existent dependencies
  for (const depId of dependsOn) {
    if (!allTasks.has(depId)) {
      errors.push(`Dependency task not found: ${depId}`);
    }
  }

  // Check for circular dependencies
  const cycleResult = detectCyclicDependency(taskId, dependsOn, allTasks);
  if (cycleResult.hasCycle) {
    const cyclePath = cycleResult.cyclePath?.join(" -> ") ?? "unknown";
    errors.push(`Circular dependency detected: ${cyclePath}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
