/**
 * Tests for PPO-based reward selection
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { selectBestTask } from "./select";

describe("selectBestTask", () => {
  let testDir: string;
  let vibenDir: string;
  let tasksDir: string;

  beforeEach(() => {
    // Create temporary test directory structure
    testDir = join(tmpdir(), `viben-test-${Date.now()}`);
    vibenDir = join(testDir, ".viben");
    tasksDir = join(vibenDir, "tasks");
    mkdirSync(tasksDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    rmSync(testDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a test task with reward data
   */
  function createTestTask(
    name: string,
    reward: number,
    diffLines: number
  ): string {
    const taskDir = join(tasksDir, `03-17-${name}`);
    mkdirSync(taskDir, { recursive: true });

    const taskJson = {
      id: name,
      name: name,
      title: `Test task ${name}`,
      status: "in_progress",
      reward: {
        scores: {
          test_coverage: { score: reward, reasoning: "Test" },
        },
        total: reward,
        diffLines: diffLines,
        computedAt: new Date().toISOString(),
      },
    };

    writeFileSync(join(taskDir, "task.json"), JSON.stringify(taskJson, null, 2));
    return name;
  }

  it("should select the task with highest PPO score above threshold", () => {
    // Create tasks with different rewards and diff sizes
    // Task A: high reward (0.858), medium diff (120) -> should win
    // Task B: medium reward (0.721), high diff (450) -> KL penalty hurts
    // Task C: low reward (0.634), small diff (80) -> below threshold after baseline
    createTestTask("task-a", 0.858, 120);
    createTestTask("task-b", 0.721, 450);
    createTestTask("task-c", 0.634, 80);

    const result = selectBestTask(
      testDir,
      ["task-a", "task-b", "task-c"],
      { threshold: 0.6, klCoef: 0.05, maxDiff: 500 }
    );

    expect(result.success).toBe(true);
    expect(result.selected).toBe("task-a");
    expect(result.rejected).toContain("task-b");
    expect(result.rejected).toContain("task-c");
    expect(result.candidates?.length).toBe(3);

    // Verify PPO calculations
    const taskA = result.candidates?.find((c) => c.task === "task-a");
    expect(taskA).toBeDefined();
    expect(taskA?.reward).toBe(0.858);
    expect(taskA?.diffLines).toBe(120);
    // KL = 0.05 * (120/500) = 0.012
    expect(taskA?.klPenalty).toBeCloseTo(0.012, 3);
    // Adjusted = 0.858 - 0.012 = 0.846
    expect(taskA?.adjustedReward).toBeCloseTo(0.846, 3);
  });

  it("should return null if no task is above threshold", () => {
    createTestTask("task-low", 0.3, 100);

    const result = selectBestTask(testDir, ["task-low"], { threshold: 0.6 });

    expect(result.success).toBe(true);
    expect(result.selected).toBeNull();
  });

  it("should handle tasks without reward data", () => {
    // Create a task without reward data
    const taskDir = join(tasksDir, "03-17-no-reward");
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(
      join(taskDir, "task.json"),
      JSON.stringify({ id: "no-reward", name: "no-reward", title: "No reward" })
    );

    const result = selectBestTask(testDir, ["no-reward"]);

    expect(result.success).toBe(false);
    expect(result.error).toContain("No tasks with reward data found");
  });

  it("should handle non-existent tasks", () => {
    const result = selectBestTask(testDir, ["nonexistent-task"]);

    expect(result.success).toBe(false);
    expect(result.error).toContain("No tasks with reward data found");
  });

  it("should apply KL penalty correctly for large diffs", () => {
    createTestTask("small-diff", 0.8, 100);
    createTestTask("large-diff", 0.85, 500);

    const result = selectBestTask(testDir, ["small-diff", "large-diff"], {
      threshold: 0.5,
      klCoef: 0.1, // Higher KL coefficient
      maxDiff: 500,
    });

    expect(result.success).toBe(true);

    const smallDiff = result.candidates?.find((c) => c.task === "small-diff");
    const largeDiff = result.candidates?.find((c) => c.task === "large-diff");

    // small-diff: KL = 0.1 * (100/500) = 0.02, adjusted = 0.8 - 0.02 = 0.78
    expect(smallDiff?.klPenalty).toBeCloseTo(0.02, 3);
    expect(smallDiff?.adjustedReward).toBeCloseTo(0.78, 3);

    // large-diff: KL = 0.1 * (500/500) = 0.1, adjusted = 0.85 - 0.1 = 0.75
    expect(largeDiff?.klPenalty).toBeCloseTo(0.1, 3);
    expect(largeDiff?.adjustedReward).toBeCloseTo(0.75, 3);

    // small-diff should win due to lower KL penalty
    expect(result.selected).toBe("small-diff");
  });

  it("should calculate baseline correctly", () => {
    createTestTask("task-1", 0.8, 100);
    createTestTask("task-2", 0.6, 100);

    const result = selectBestTask(testDir, ["task-1", "task-2"], {
      klCoef: 0.05,
      maxDiff: 500,
    });

    expect(result.success).toBe(true);

    // Both have same diff, so same KL penalty = 0.05 * (100/500) = 0.01
    // Adjusted rewards: 0.79 and 0.59
    // Baseline = (0.79 + 0.59) / 2 = 0.69
    expect(result.baseline).toBeCloseTo(0.69, 2);
  });

  it("should sort candidates by PPO score descending", () => {
    createTestTask("best", 0.9, 50);
    createTestTask("middle", 0.7, 50);
    createTestTask("worst", 0.5, 50);

    const result = selectBestTask(testDir, ["worst", "best", "middle"]);

    expect(result.success).toBe(true);
    expect(result.candidates?.[0].task).toBe("best");
    expect(result.candidates?.[1].task).toBe("middle");
    expect(result.candidates?.[2].task).toBe("worst");
  });

  it("should handle empty task list", () => {
    const result = selectBestTask(testDir, []);

    expect(result.success).toBe(false);
    expect(result.error).toBe("No tasks provided for selection");
  });

  it("should use default options when not provided", () => {
    createTestTask("task", 0.8, 100);

    const result = selectBestTask(testDir, ["task"]);

    expect(result.success).toBe(true);
    expect(result.threshold).toBe(0.6); // Default threshold
  });
});
