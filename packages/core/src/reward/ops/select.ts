/**
 * PPO-based Reward Selection
 *
 * Aggregates rewards from multiple tasks and selects the best one
 * using PPO (Proximal Policy Optimization) metrics.
 *
 * Based on docs/plans/2026-03-17-filerl-commands-design.md
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveTaskDirectory,
  readTaskJson,
} from "../../cli/lib/viben-workspace";
import {
  type SelectOptions,
  type SelectResult,
  type TaskCandidate,
  type RewardResult,
  SELECT_DEFAULTS,
} from "./types";

// =============================================================================
// PPO Calculation
// =============================================================================

/**
 * Calculate KL penalty for a task
 *
 * Formula: KL = λ × (diff_lines / max_diff)
 *
 * @param diffLines - Number of lines changed
 * @param klCoef - KL penalty coefficient λ
 * @param maxDiff - Maximum diff lines for normalization
 */
function calculateKlPenalty(
  diffLines: number,
  klCoef: number,
  maxDiff: number
): number {
  // Clamp diff_lines to max_diff to avoid excessive penalties
  const clampedDiff = Math.min(diffLines, maxDiff);
  return klCoef * (clampedDiff / maxDiff);
}

/**
 * Calculate PPO metrics for a list of tasks
 *
 * Steps:
 * 1. Load reward data from each task.json
 * 2. Calculate KL penalty and adjusted reward for each
 * 3. Calculate baseline (mean of adjusted rewards)
 * 4. Calculate advantage and PPO score for each
 *
 * @param taskRewards - Array of { task, reward, diffLines }
 * @param options - PPO calculation options
 */
function calculatePpoMetrics(
  taskRewards: Array<{ task: string; reward: number; diffLines: number }>,
  options: Required<SelectOptions>
): TaskCandidate[] {
  const { klCoef, maxDiff } = options;

  // Step 1: Calculate KL penalty and adjusted reward
  const candidates: TaskCandidate[] = taskRewards.map(
    ({ task, reward, diffLines }) => {
      const klPenalty = calculateKlPenalty(diffLines, klCoef, maxDiff);
      const adjustedReward = reward - klPenalty;

      return {
        task,
        reward,
        diffLines,
        klPenalty,
        adjustedReward,
        advantage: 0, // Will be calculated after baseline
        ppoScore: 0, // Will be calculated after baseline
      };
    }
  );

  // Step 2: Calculate baseline (mean of adjusted rewards)
  const baseline =
    candidates.reduce((sum, c) => sum + c.adjustedReward, 0) / candidates.length;

  // Step 3: Calculate advantage and PPO score
  for (const candidate of candidates) {
    candidate.advantage = candidate.adjustedReward - baseline;
    // Simplified PPO score (ρ = 1)
    candidate.ppoScore = candidate.advantage;
  }

  return candidates;
}

// =============================================================================
// Task Reward Loading
// =============================================================================

/**
 * Load reward data from FileRL reward.json
 *
 * @param filerlDir - FileRL directory path
 * @param iteration - Current iteration number
 * @param taskName - Task name (used as reward directory name)
 * @returns Reward data or null if not found/invalid
 */
function loadFileRlReward(
  filerlDir: string,
  iteration: number,
  taskName: string
): { reward: number; diffLines: number } | null {
  const rewardJsonPath = join(filerlDir, `iter${iteration}`, taskName, "reward.json");

  try {
    const content = readFileSync(rewardJsonPath, "utf-8");
    const rewardData = JSON.parse(content) as { total?: number; diffLines?: number };

    if (typeof rewardData.total !== "number") {
      return null;
    }

    return {
      reward: rewardData.total,
      diffLines: typeof rewardData.diffLines === "number" ? rewardData.diffLines : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Load reward data from a task's task.json (standalone mode)
 *
 * @param taskDir - Absolute path to task directory
 * @returns Reward data or null if not found/invalid
 */
function loadTaskReward(
  taskDir: string
): { reward: number; diffLines: number } | null {
  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return null;
  }

  // Check for reward field
  const rewardData = taskData.reward as RewardResult | undefined;
  if (!rewardData) {
    return null;
  }

  // Validate required fields
  if (typeof rewardData.total !== "number") {
    return null;
  }

  // diff_lines might be stored as diffLines (camelCase) or diff_lines (snake_case)
  // Use type assertion to access potential snake_case property
  const rewardDataAny = rewardData as unknown as Record<string, unknown>;
  const diffLines =
    typeof rewardData.diffLines === "number"
      ? rewardData.diffLines
      : typeof rewardDataAny.diff_lines === "number"
        ? rewardDataAny.diff_lines
        : 0;

  return {
    reward: rewardData.total,
    diffLines,
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Select the best task from a list using PPO metrics
 *
 * Algorithm:
 * 1. Load reward data from each task.json
 * 2. Calculate PPO metrics (KL penalty, adjusted reward, advantage)
 * 3. Filter candidates by threshold
 * 4. Select the one with highest PPO score
 *
 * @param repoRoot - Repository root path
 * @param taskNames - Array of task names to compare
 * @param options - PPO selection options
 */
export function selectBestTask(
  repoRoot: string,
  taskNames: string[],
  options: SelectOptions = {}
): SelectResult {
  // Merge options with defaults (exclude filerlDir and iteration from defaults)
  const opts = {
    threshold: options.threshold ?? SELECT_DEFAULTS.threshold,
    klCoef: options.klCoef ?? SELECT_DEFAULTS.klCoef,
    maxDiff: options.maxDiff ?? SELECT_DEFAULTS.maxDiff,
    filerlDir: options.filerlDir,
    iteration: options.iteration,
  };

  // Validate input
  if (taskNames.length === 0) {
    return {
      success: false,
      error: "No tasks provided for selection",
    };
  }

  // FileRL mode: read rewards from iter{N}/{taskName}/reward.json
  const isFileRlMode = !!opts.filerlDir && opts.iteration !== undefined;

  // Load reward data from each task
  const taskRewards: Array<{ task: string; reward: number; diffLines: number }> =
    [];
  const errors: string[] = [];

  for (const taskDirName of taskNames) {
    const taskDir = resolveTaskDirectory(taskDirName, repoRoot);
    if (!taskDir || !existsSync(taskDir)) {
      errors.push(`Task not found: ${taskDirName}`);
      continue;
    }

    let rewardData: { reward: number; diffLines: number } | null = null;

    if (isFileRlMode) {
      // FileRL mode: get task name from task.json for reward directory
      const taskData = readTaskJson(taskDir) as { name?: string; id?: string } | null;
      const rewardDirName = taskData?.name || taskData?.id || taskDirName;

      rewardData = loadFileRlReward(opts.filerlDir!, opts.iteration!, rewardDirName);
    }

    // Fallback to task.json reward if FileRL reward not found
    if (!rewardData) {
      rewardData = loadTaskReward(taskDir);
    }

    if (!rewardData) {
      errors.push(`No reward data in task: ${taskDirName}`);
      continue;
    }

    taskRewards.push({
      task: taskDirName,
      ...rewardData,
    });
  }

  // Check if we have any valid tasks
  if (taskRewards.length === 0) {
    return {
      success: false,
      error: `No tasks with reward data found. Errors: ${errors.join("; ")}`,
    };
  }

  // Calculate PPO metrics
  const candidates = calculatePpoMetrics(taskRewards, opts);

  // Calculate baseline for output
  const baseline =
    candidates.reduce((sum, c) => sum + c.adjustedReward, 0) / candidates.length;

  // Sort by PPO score (descending)
  candidates.sort((a, b) => b.ppoScore - a.ppoScore);

  // Find candidates above threshold
  const aboveThreshold = candidates.filter(
    (c) => c.adjustedReward >= opts.threshold
  );

  // Select best (highest PPO score above threshold)
  const selected =
    aboveThreshold.length > 0 ? aboveThreshold[0].task : null;

  // Rejected = all except selected
  const rejected = candidates
    .filter((c) => c.task !== selected)
    .map((c) => c.task);

  return {
    success: true,
    baseline,
    threshold: opts.threshold,
    candidates,
    selected,
    rejected,
  };
}
