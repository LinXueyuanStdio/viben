/**
 * PPO-based Reward Selection
 *
 * Aggregates rewards from multiple tasks and selects the best one
 * using PPO (Proximal Policy Optimization) metrics.
 *
 * Based on docs/plans/2026-03-17-filerl-commands-design.md
 */
import { existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
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
 * Calculate PPO metrics for a list of tasks
 *
 * Steps:
 * 1. Calculate d, changeWeight, klPenalty, adjustedReward for each task
 * 2. Calculate baseline (mean of adjusted rewards)
 * 3. Calculate relativeScore and finalScore for each task
 *
 * Formula:
 * - d = min(1, diffLines / maxDiff)
 * - changeWeight = exp(-β × d)
 * - klPenalty = λ × d
 * - adjustedReward = R - klPenalty
 * - relativeScore = adjustedReward - baseline
 * - finalScore = min(w × S, clip(w, 1-ε, 1+ε) × S)
 *
 * @param taskRewards - Array of { task, reward, diffLines, ideaId }
 * @param options - PPO calculation options
 */
function calculatePpoMetrics(
  taskRewards: Array<{ task: string; reward: number; diffLines: number; ideaId?: string }>,
  options: {
    klCoef: number;
    changeSensitivity: number;
    clipRange: number;
    maxDiff: number;
  }
): TaskCandidate[] {
  const { klCoef, changeSensitivity, clipRange, maxDiff } = options;

  // Step 1: Calculate d, changeWeight, klPenalty, adjustedReward
  const candidates: TaskCandidate[] = taskRewards.map(
    ({ task, reward, diffLines, ideaId }) => {
      const d = Math.min(1, diffLines / maxDiff);
      const changeWeight = Math.exp(-changeSensitivity * d);
      const klPenalty = klCoef * d;
      const adjustedReward = reward - klPenalty;

      return {
        task,
        ideaId,
        reward,
        diffLines,
        d,
        changeWeight,
        klPenalty,
        adjustedReward,
        relativeScore: 0,
        finalScore: 0,
      };
    }
  );

  // Step 2: Calculate baseline (mean of adjusted rewards)
  const baseline =
    candidates.reduce((sum, c) => sum + c.adjustedReward, 0) / candidates.length;

  // Step 3: Calculate relativeScore and finalScore
  for (const c of candidates) {
    c.relativeScore = c.adjustedReward - baseline;

    // L = min(w × S, clip(w, 1-ε, 1+ε) × S)
    const clippedWeight = Math.max(
      1 - clipRange,
      Math.min(1 + clipRange, c.changeWeight)
    );
    c.finalScore = Math.min(
      c.changeWeight * c.relativeScore,
      clippedWeight * c.relativeScore
    );
  }

  return candidates;
}

// =============================================================================
// Task Reward Loading
// =============================================================================

/**
 * Load reward data from FileRL reward.json
 *
 * Directory structure: iter{N}/{ideaId}/{taskName}/reward.json
 *
 * @param filerlDir - FileRL directory path
 * @param iteration - Current iteration number
 * @param ideaId - Idea ID (optional, for grouping)
 * @param taskName - Task name (used as reward directory name)
 * @returns Reward data or null if not found/invalid
 */
function loadFileRlIterReward(
  filerlDir: string,
  iteration: number,
  taskName: string,
  ideaId?: string
): { reward: number; diffLines: number } | null {
  // Build path: iter{N}/{ideaId}/{taskName}/reward.json or iter{N}/{taskName}/reward.json
  const rewardJsonPath = ideaId
    ? join(filerlDir, `iter${iteration}`, ideaId, taskName, "reward.json")
    : join(filerlDir, `iter${iteration}`, taskName, "reward.json");

  try {
    const content = readFileSync(rewardJsonPath, "utf-8");
    const rewardData = JSON.parse(content) as { total_score?: number; diff_lines?: number };

    if (typeof rewardData.total_score !== "number") {
      return null;
    }

    return {
      reward: rewardData.total_score,
      diffLines: typeof rewardData.diff_lines === "number" ? rewardData.diff_lines : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Load reward data from a task's reward.json file (standalone mode)
 *
 * Standard format: { total_score: number (0-1), diff_lines?: number, ... }
 *
 * Note: Rewards are NO LONGER stored in task.json.
 * For FileRL, use loadFileRlIterReward() which reads from iter{N}/{idea}/{task}/reward.json
 *
 * @param taskDir - Absolute path to task directory
 * @returns Reward data or null if not found/invalid
 */
function loadTaskReward(
  taskDir: string
): { reward: number; diffLines: number } | null {
  // Try reading reward.json directly in task directory (standalone mode)
  const rewardJsonPath = join(taskDir, "reward.json");
  try {
    const content = readFileSync(rewardJsonPath, "utf-8");
    const rewardData = JSON.parse(content) as { total_score?: number; diff_lines?: number };

    if (typeof rewardData.total_score !== "number") {
      return null;
    }

    return {
      reward: rewardData.total_score,
      diffLines: typeof rewardData.diff_lines === "number" ? rewardData.diff_lines : 0,
    };
  } catch {
    return null;
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Select the best task from a list using PPO metrics
 *
 * Algorithm:
 * 1. Load reward data from each task.json
 * 2. Calculate PPO metrics (d, changeWeight, klPenalty, adjustedReward, relativeScore, finalScore)
 * 3. Two-stage selection (if taskIdeaMap provided):
 *    - Stage 1: Select best rollout per idea by finalScore
 *    - Stage 2: Select global best from idea winners above threshold
 * 4. Single-stage selection (fallback): Select best by finalScore above threshold
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
    changeSensitivity: options.changeSensitivity ?? SELECT_DEFAULTS.changeSensitivity,
    clipRange: options.clipRange ?? SELECT_DEFAULTS.clipRange,
    maxDiff: options.maxDiff ?? SELECT_DEFAULTS.maxDiff,
    taskIdeaMap: options.taskIdeaMap,
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

  // FileRL mode: read rewards from iter{N}/{ideaId}/{taskName}/reward.json
  const isFileRlMode = !!opts.filerlDir && opts.iteration !== undefined;

  // Load reward data from each task
  const taskRewards: Array<{ task: string; reward: number; diffLines: number; ideaId?: string }> =
    [];
  const errors: string[] = [];

  for (const taskDirName of taskNames) {
    const taskDir = resolveTaskDirectory(taskDirName, repoRoot);
    if (!taskDir || !existsSync(taskDir)) {
      errors.push(`Task not found: ${taskDirName}`);
      continue;
    }

    let rewardData: { reward: number; diffLines: number } | null = null;

    // Get ideaId from taskIdeaMap
    const ideaId = opts.taskIdeaMap?.[taskDirName];

    if (isFileRlMode) {
      // FileRL mode: use task directory basename as reward directory name
      // (not task.json name/id, which might be the idea ID)
      const rewardDirName = basename(taskDir);

      // Read from iter{N}/{ideaId}/{taskName}/reward.json
      rewardData = loadFileRlIterReward(opts.filerlDir!, opts.iteration!, rewardDirName, ideaId);
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
      ideaId,
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

  // Two-stage selection
  let selected: string | null = null;

  if (opts.taskIdeaMap && Object.keys(opts.taskIdeaMap).length > 0) {
    // Stage 1: Best rollout per idea
    const ideaGroups = new Map<string, TaskCandidate[]>();
    for (const c of candidates) {
      const ideaId = c.ideaId || opts.taskIdeaMap[c.task] || c.task;
      if (!ideaGroups.has(ideaId)) {
        ideaGroups.set(ideaId, []);
      }
      ideaGroups.get(ideaId)!.push(c);
    }

    const bestPerIdea: TaskCandidate[] = [];
    for (const [ideaId, group] of ideaGroups) {
      const best = group.reduce((a, b) => (a.finalScore > b.finalScore ? a : b));
      bestPerIdea.push(best);
    }

    // Stage 2: Global best from idea winners (above threshold)
    const qualified = bestPerIdea.filter((c) => c.adjustedReward >= opts.threshold);
    if (qualified.length > 0) {
      const winner = qualified.reduce((a, b) =>
        a.finalScore > b.finalScore ? a : b
      );
      selected = winner.task;
    }
  } else {
    // Single-stage selection (no idea grouping)
    candidates.sort((a, b) => b.finalScore - a.finalScore);
    const qualified = candidates.filter((c) => c.adjustedReward >= opts.threshold);
    selected = qualified.length > 0 ? qualified[0].task : null;
  }

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
