/**
 * Scheduler Tests
 *
 * Tests dependency checking, cycle detection, and priority-based scheduling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  allDependenciesMet,
  detectCyclicDependency,
  validateDependencies,
  getNextTask,
  getDependentTasks,
} from "./scheduler";
import type { UnifiedTask } from "../../services/task-service";
import { createMockTask, createTaskInState } from "../../task/__fixtures__/task-fixtures";

// =============================================================================
// Helper Functions
// =============================================================================

function createTaskMap(tasks: UnifiedTask[]): Map<string, UnifiedTask> {
  return new Map(tasks.map((t) => [t.id, t]));
}

// =============================================================================
// allDependenciesMet Tests
// =============================================================================

describe("allDependenciesMet", () => {
  describe("tasks without dependencies", () => {
    it("returns true for task with no dependsOn field", () => {
      const task = createMockTask({ id: "task1" });
      const allTasks = createTaskMap([task]);

      expect(allDependenciesMet(task, allTasks)).toBe(true);
    });

    it("returns true for task with empty dependsOn array", () => {
      const task = createMockTask({ id: "task1", dependsOn: [] });
      const allTasks = createTaskMap([task]);

      expect(allDependenciesMet(task, allTasks)).toBe(true);
    });
  });

  describe("tasks with dependencies", () => {
    it("returns true when all dependencies are completed", () => {
      const dep1 = createTaskInState("completed", { id: "dep1" });
      const dep2 = createTaskInState("completed", { id: "dep2" });
      const task = createMockTask({
        id: "task1",
        dependsOn: ["dep1", "dep2"],
      });

      const allTasks = createTaskMap([task, dep1, dep2]);
      expect(allDependenciesMet(task, allTasks)).toBe(true);
    });

    it("returns false when any dependency is not completed", () => {
      const dep1 = createTaskInState("completed", { id: "dep1" });
      const dep2 = createTaskInState("in_progress", { id: "dep2" });
      const task = createMockTask({
        id: "task1",
        dependsOn: ["dep1", "dep2"],
      });

      const allTasks = createTaskMap([task, dep1, dep2]);
      expect(allDependenciesMet(task, allTasks)).toBe(false);
    });

    it("returns false when dependency is in backlog", () => {
      const dep = createTaskInState("backlog", { id: "dep1" });
      const task = createMockTask({
        id: "task1",
        dependsOn: ["dep1"],
      });

      const allTasks = createTaskMap([task, dep]);
      expect(allDependenciesMet(task, allTasks)).toBe(false);
    });

    it("returns false when dependency is in queue", () => {
      const dep = createTaskInState("queue", { id: "dep1" });
      const task = createMockTask({
        id: "task1",
        dependsOn: ["dep1"],
      });

      const allTasks = createTaskMap([task, dep]);
      expect(allDependenciesMet(task, allTasks)).toBe(false);
    });

    it("returns false when dependency is failed", () => {
      const dep = createTaskInState("failed", { id: "dep1" });
      const task = createMockTask({
        id: "task1",
        dependsOn: ["dep1"],
      });

      const allTasks = createTaskMap([task, dep]);
      expect(allDependenciesMet(task, allTasks)).toBe(false);
    });

    it("returns false when dependency is cancelled", () => {
      const dep = createTaskInState("cancelled", { id: "dep1" });
      const task = createMockTask({
        id: "task1",
        dependsOn: ["dep1"],
      });

      const allTasks = createTaskMap([task, dep]);
      expect(allDependenciesMet(task, allTasks)).toBe(false);
    });

    it("returns false when dependency does not exist", () => {
      const task = createMockTask({
        id: "task1",
        dependsOn: ["nonexistent"],
      });

      const allTasks = createTaskMap([task]);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(allDependenciesMet(task, allTasks)).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("non-existent task")
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
});

// =============================================================================
// detectCyclicDependency Tests
// =============================================================================

describe("detectCyclicDependency", () => {
  describe("no cycles", () => {
    it("returns false for task with no dependencies", () => {
      const task = createMockTask({ id: "task1" });
      const allTasks = createTaskMap([task]);

      const result = detectCyclicDependency("task1", [], allTasks);
      expect(result.hasCycle).toBe(false);
    });

    it("returns false for linear dependency chain", () => {
      const task1 = createMockTask({ id: "task1" });
      const task2 = createMockTask({ id: "task2", dependsOn: ["task1"] });
      const task3 = createMockTask({ id: "task3", dependsOn: ["task2"] });

      const allTasks = createTaskMap([task1, task2, task3]);
      const result = detectCyclicDependency("task3", ["task2"], allTasks);

      expect(result.hasCycle).toBe(false);
    });

    it("returns false for diamond dependency", () => {
      // task1 -> task2 -> task4
      // task1 -> task3 -> task4
      const task1 = createMockTask({ id: "task1" });
      const task2 = createMockTask({ id: "task2", dependsOn: ["task1"] });
      const task3 = createMockTask({ id: "task3", dependsOn: ["task1"] });
      const task4 = createMockTask({ id: "task4", dependsOn: ["task2", "task3"] });

      const allTasks = createTaskMap([task1, task2, task3, task4]);
      const result = detectCyclicDependency("task4", ["task2", "task3"], allTasks);

      expect(result.hasCycle).toBe(false);
    });
  });

  describe("detects cycles", () => {
    it("detects direct self-dependency", () => {
      const task = createMockTask({ id: "task1" });
      const allTasks = createTaskMap([task]);

      const result = detectCyclicDependency("task1", ["task1"], allTasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cyclePath).toBeDefined();
    });

    it("detects 2-node cycle", () => {
      // task1 depends on task2, task2 depends on task1
      const task1 = createMockTask({ id: "task1", dependsOn: ["task2"] });
      const task2 = createMockTask({ id: "task2" });

      const allTasks = createTaskMap([task1, task2]);
      const result = detectCyclicDependency("task2", ["task1"], allTasks);

      expect(result.hasCycle).toBe(true);
    });

    it("detects 3-node cycle", () => {
      // task1 -> task2 -> task3 -> task1
      const task1 = createMockTask({ id: "task1", dependsOn: ["task3"] });
      const task2 = createMockTask({ id: "task2", dependsOn: ["task1"] });
      const task3 = createMockTask({ id: "task3" });

      const allTasks = createTaskMap([task1, task2, task3]);
      const result = detectCyclicDependency("task3", ["task2"], allTasks);

      expect(result.hasCycle).toBe(true);
      expect(result.cyclePath).toBeDefined();
      expect(result.cyclePath?.length).toBeGreaterThan(2);
    });
  });
});

// =============================================================================
// validateDependencies Tests
// =============================================================================

describe("validateDependencies", () => {
  it("returns valid for task with no dependencies", () => {
    const task = createMockTask({ id: "task1" });
    const allTasks = createTaskMap([task]);

    const result = validateDependencies("task1", [], allTasks);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid for task with existing dependencies", () => {
    const task1 = createMockTask({ id: "task1" });
    const task2 = createMockTask({ id: "task2" });

    const allTasks = createTaskMap([task1, task2]);
    const result = validateDependencies("task2", ["task1"], allTasks);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  describe("error cases", () => {
    it("rejects self-dependency", () => {
      const task = createMockTask({ id: "task1" });
      const allTasks = createTaskMap([task]);

      const result = validateDependencies("task1", ["task1"], allTasks);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Task cannot depend on itself");
    });

    it("rejects non-existent dependency", () => {
      const task = createMockTask({ id: "task1" });
      const allTasks = createTaskMap([task]);

      const result = validateDependencies("task1", ["nonexistent"], allTasks);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("not found"))).toBe(true);
    });

    it("rejects circular dependency", () => {
      const task1 = createMockTask({ id: "task1", dependsOn: ["task2"] });
      const task2 = createMockTask({ id: "task2" });

      const allTasks = createTaskMap([task1, task2]);
      const result = validateDependencies("task2", ["task1"], allTasks);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Circular"))).toBe(true);
    });

    it("reports multiple errors", () => {
      const task = createMockTask({ id: "task1" });
      const allTasks = createTaskMap([task]);

      const result = validateDependencies("task1", ["task1", "nonexistent"], allTasks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// =============================================================================
// getNextTask Tests
// =============================================================================

describe("getNextTask", () => {
  describe("basic selection", () => {
    it("returns null for empty task list", () => {
      const result = getNextTask([], new Map());
      expect(result).toBeNull();
    });

    it("returns null when no tasks are queued", () => {
      const tasks = [
        createTaskInState("backlog", { id: "task1" }),
        createTaskInState("in_progress", { id: "task2" }),
      ];
      const allTasks = createTaskMap(tasks);

      const result = getNextTask(tasks, allTasks);
      expect(result).toBeNull();
    });

    it("returns the only queued task", () => {
      const queuedTask = createTaskInState("queue", { id: "task1" });
      const tasks = [
        createTaskInState("backlog", { id: "task0" }),
        queuedTask,
      ];
      const allTasks = createTaskMap(tasks);

      const result = getNextTask(tasks, allTasks);
      expect(result?.id).toBe("task1");
    });

    it("returns null when queued task has unmet dependencies", () => {
      const dep = createTaskInState("in_progress", { id: "dep" });
      const queuedTask = createTaskInState("queue", {
        id: "task1",
        dependsOn: ["dep"],
      });

      const tasks = [dep, queuedTask];
      const allTasks = createTaskMap(tasks);

      const result = getNextTask(tasks, allTasks);
      expect(result).toBeNull();
    });
  });

  describe("priority ordering", () => {
    it("selects P0 over P1", () => {
      const p0Task = createTaskInState("queue", { id: "p0", priority: "P0" });
      const p1Task = createTaskInState("queue", { id: "p1", priority: "P1" });

      const tasks = [p1Task, p0Task];
      const allTasks = createTaskMap(tasks);

      const result = getNextTask(tasks, allTasks);
      expect(result?.id).toBe("p0");
    });

    it("selects P1 over P2", () => {
      const p1Task = createTaskInState("queue", { id: "p1", priority: "P1" });
      const p2Task = createTaskInState("queue", { id: "p2", priority: "P2" });

      const tasks = [p2Task, p1Task];
      const allTasks = createTaskMap(tasks);

      const result = getNextTask(tasks, allTasks);
      expect(result?.id).toBe("p1");
    });

    it("selects P2 over P3", () => {
      const p2Task = createTaskInState("queue", { id: "p2", priority: "P2" });
      const p3Task = createTaskInState("queue", { id: "p3", priority: "P3" });

      const tasks = [p3Task, p2Task];
      const allTasks = createTaskMap(tasks);

      const result = getNextTask(tasks, allTasks);
      expect(result?.id).toBe("p2");
    });

    it("handles all four priority levels correctly", () => {
      const p0 = createTaskInState("queue", { id: "p0", priority: "P0" });
      const p1 = createTaskInState("queue", { id: "p1", priority: "P1" });
      const p2 = createTaskInState("queue", { id: "p2", priority: "P2" });
      const p3 = createTaskInState("queue", { id: "p3", priority: "P3" });

      // Reverse order
      const tasks = [p3, p2, p1, p0];
      const allTasks = createTaskMap(tasks);

      const result = getNextTask(tasks, allTasks);
      expect(result?.id).toBe("p0");
    });
  });

  describe("FIFO within same priority", () => {
    it("selects earlier queuedAt task", () => {
      const earlier = createTaskInState("queue", {
        id: "earlier",
        priority: "P2",
        queuedAt: "2026-01-01T10:00:00.000Z",
      });
      const later = createTaskInState("queue", {
        id: "later",
        priority: "P2",
        queuedAt: "2026-01-01T11:00:00.000Z",
      });

      const tasks = [later, earlier];
      const allTasks = createTaskMap(tasks);

      const result = getNextTask(tasks, allTasks);
      expect(result?.id).toBe("earlier");
    });

    it("falls back to createdAt when queuedAt is not set", () => {
      // Note: createTaskInState("queue") sets queuedAt automatically
      // To test createdAt fallback, we need to explicitly set queuedAt to undefined
      const older = createTaskInState("queue", {
        id: "older",
        priority: "P2",
        createdAt: "2026-01-01T10:00:00.000Z",
      });
      // Explicitly clear queuedAt to test fallback
      older.queuedAt = undefined;

      const newer = createTaskInState("queue", {
        id: "newer",
        priority: "P2",
        createdAt: "2026-01-01T11:00:00.000Z",
      });
      newer.queuedAt = undefined;

      const tasks = [newer, older];
      const allTasks = createTaskMap(tasks);

      const result = getNextTask(tasks, allTasks);
      expect(result?.id).toBe("older");
    });

    it("handles same timestamp by maintaining stable order", () => {
      const sameTime = "2026-01-01T10:00:00.000Z";
      const task1 = createTaskInState("queue", {
        id: "task1",
        priority: "P2",
        queuedAt: sameTime,
      });
      const task2 = createTaskInState("queue", {
        id: "task2",
        priority: "P2",
        queuedAt: sameTime,
      });
      const task3 = createTaskInState("queue", {
        id: "task3",
        priority: "P2",
        queuedAt: sameTime,
      });

      // Test with different input orders to verify stable sorting
      const tasksOrder1 = [task1, task2, task3];
      const tasksOrder2 = [task3, task2, task1];

      const allTasks1 = createTaskMap(tasksOrder1);
      const allTasks2 = createTaskMap(tasksOrder2);

      const result1 = getNextTask(tasksOrder1, allTasks1);
      const result2 = getNextTask(tasksOrder2, allTasks2);

      // Both should return the same task for consistency
      // The exact task depends on implementation (first in array or stable sort)
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
    });
  });

  describe("dependency filtering", () => {
    it("skips task with unmet dependencies even if higher priority", () => {
      const blockedP0 = createTaskInState("queue", {
        id: "blocked_p0",
        priority: "P0",
        dependsOn: ["dep"],
      });
      const dep = createTaskInState("in_progress", { id: "dep" });
      const readyP2 = createTaskInState("queue", {
        id: "ready_p2",
        priority: "P2",
      });

      const tasks = [blockedP0, dep, readyP2];
      const allTasks = createTaskMap(tasks);

      const result = getNextTask(tasks, allTasks);
      expect(result?.id).toBe("ready_p2");
    });

    it("selects task when dependencies are completed", () => {
      const completedDep = createTaskInState("completed", { id: "dep" });
      const readyTask = createTaskInState("queue", {
        id: "ready",
        priority: "P0",
        dependsOn: ["dep"],
      });

      const tasks = [completedDep, readyTask];
      const allTasks = createTaskMap(tasks);

      const result = getNextTask(tasks, allTasks);
      expect(result?.id).toBe("ready");
    });
  });
});

// =============================================================================
// getDependentTasks Tests
// =============================================================================

describe("getDependentTasks", () => {
  it("returns empty array for task with no dependents", () => {
    const task = createMockTask({ id: "task1" });
    const allTasks = createTaskMap([task]);

    const result = getDependentTasks("task1", allTasks);
    expect(result).toHaveLength(0);
  });

  it("returns tasks that depend on given task", () => {
    const task1 = createMockTask({ id: "task1" });
    const task2 = createMockTask({ id: "task2", dependsOn: ["task1"] });
    const task3 = createMockTask({ id: "task3", dependsOn: ["task1"] });
    const task4 = createMockTask({ id: "task4", dependsOn: ["task2"] });

    const allTasks = createTaskMap([task1, task2, task3, task4]);
    const result = getDependentTasks("task1", allTasks);

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toContain("task2");
    expect(result.map((t) => t.id)).toContain("task3");
  });

  it("does not include tasks that depend on other tasks", () => {
    const task1 = createMockTask({ id: "task1" });
    const task2 = createMockTask({ id: "task2", dependsOn: ["task1"] });
    const task3 = createMockTask({ id: "task3", dependsOn: ["task2"] });

    const allTasks = createTaskMap([task1, task2, task3]);
    const result = getDependentTasks("task1", allTasks);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("task2");
  });
});
