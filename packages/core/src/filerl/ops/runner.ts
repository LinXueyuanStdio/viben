/**
 * FileRL Runner
 *
 * Orchestrates the FileRL loop execution.
 * This module coordinates idea generation, task creation, and reward selection.
 */

import { resolve } from "node:path";

import type {
  FileRlConfig,
  FileRlState,
  RunResult,
  StopResult,
} from "./types";

import { parseTarget, validateConfig } from "./parser";
import {
  readState,
  writeState,
  createInitialState,
  startIteration,
  completeIteration,
  checkConvergence,
  markConverged,
  stopRun,
  runExists,
  isRunActive,
} from "./state";

// Import ops from other modules
import { createTask } from "../../task/ops/crud";
import { enqueueTask } from "../../task/ops/lifecycle";
import { selectBestTask } from "../../reward/ops/select";

// =============================================================================
// FileRL Runner
// =============================================================================

/**
 * Initialize a new FileRL run
 *
 * This creates the initial state but does not start execution.
 * Use `runIteration` to actually execute iterations.
 */
export function initRun(
  repoRoot: string,
  targetPath: string,
  options?: { force?: boolean }
): RunResult {
  // Parse target file
  const parseResult = parseTarget(targetPath, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return {
      success: false,
      error: parseResult.error || "Failed to parse target file",
    };
  }

  const config = parseResult.config;

  // Validate configuration
  const validation = validateConfig(config);
  if (!validation.valid) {
    return {
      success: false,
      error: `Invalid configuration:\n${validation.errors.join("\n")}`,
    };
  }

  // Check if run already exists
  if (runExists(repoRoot, config.name) && !options?.force) {
    const existingState = readState(repoRoot, config.name);
    if (existingState?.active) {
      return {
        success: false,
        error: `FileRL run "${config.name}" is already active. Use --force to restart or stop it first.`,
      };
    }
  }

  // Create initial state
  const resolvedPath = resolve(repoRoot, targetPath);
  const state = createInitialState(config.name, resolvedPath);
  writeState(repoRoot, state);

  return {
    success: true,
    state,
    message: `Initialized FileRL run: ${config.name}`,
  };
}

/**
 * Run a single iteration of the FileRL loop
 *
 * This is the main entry point for running FileRL. It:
 * 1. Generates ideas (if needed)
 * 2. Creates tasks from top ideas
 * 3. Starts tasks in parallel worktrees
 * 4. Waits for completion and computes rewards
 * 5. Selects the best task using PPO
 * 6. Merges the winner and cleans up
 *
 * Note: This function is designed to be called by an agent.
 * The actual work is done by spawning subagents for each phase.
 */
export function runIteration(
  repoRoot: string,
  name: string
): RunResult {
  // Load state
  const state = readState(repoRoot, name);
  if (!state) {
    return {
      success: false,
      error: `FileRL run not found: ${name}`,
    };
  }

  // Parse config from target file
  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return {
      success: false,
      error: parseResult.error || "Failed to parse target file",
    };
  }

  const config = parseResult.config;

  // Check if already converged or max iterations reached
  if (state.converged) {
    return {
      success: true,
      state,
      message: `Run "${name}" has converged after ${state.completed_iterations} iterations. Best reward: ${state.best_reward.toFixed(3)}`,
    };
  }

  if (state.current_iteration >= config.ppo.max_iterations) {
    return {
      success: true,
      state,
      message: `Run "${name}" reached max iterations (${config.ppo.max_iterations}). Best reward: ${state.best_reward.toFixed(3)}`,
    };
  }

  // Start new iteration
  const iteration = startIteration(state);
  writeState(repoRoot, state);

  // The actual work is delegated to subagents via the work-phase pipeline
  // This function just sets up the iteration state
  return {
    success: true,
    state,
    message: `Started iteration ${iteration.iteration} for "${name}"`,
  };
}

/**
 * Create tasks from ideas for the current iteration
 *
 * @param repoRoot - Repository root path
 * @param name - FileRL run name
 * @param ideaIds - Array of idea IDs to promote to tasks
 */
export function createTasksFromIdeas(
  repoRoot: string,
  name: string,
  ideaIds: string[]
): RunResult {
  const state = readState(repoRoot, name);
  if (!state) {
    return {
      success: false,
      error: `FileRL run not found: ${name}`,
    };
  }

  // Parse config
  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return {
      success: false,
      error: parseResult.error || "Failed to parse target file",
    };
  }

  const config = parseResult.config;
  const currentIter = state.iterations[state.iterations.length - 1];

  if (!currentIter) {
    return {
      success: false,
      error: "No active iteration found",
    };
  }

  // Store ideas
  currentIter.ideas = ideaIds;

  // Create tasks for each idea
  const taskNames: string[] = [];
  const errors: string[] = [];

  for (const ideaId of ideaIds) {
    // Create task with FileRL configuration
    const result = createTask(repoRoot, `FileRL iteration ${state.current_iteration} - ${ideaId}`, {
      slug: `filerl-${name}-i${state.current_iteration}-${ideaId}`,
      worktree: config.task.worktree,
      executor: config.task.executor,
      model: config.task.model,
      computeReward: true, // Enable reward computation
    });

    if (result.success && result.dirName) {
      taskNames.push(result.dirName);

      // Enqueue task if auto_start is enabled
      // Note: worktree is already set in task.json via createTask
      if (config.task.auto_start) {
        enqueueTask(repoRoot, result.dirName, {});
      }
    } else {
      errors.push(`Failed to create task for idea ${ideaId}: ${result.error}`);
    }
  }

  // Store tasks in iteration state
  currentIter.tasks = taskNames;
  writeState(repoRoot, state);

  if (errors.length > 0) {
    return {
      success: false,
      state,
      error: errors.join("\n"),
    };
  }

  return {
    success: true,
    state,
    message: `Created ${taskNames.length} tasks for iteration ${state.current_iteration}`,
  };
}

/**
 * Record task rewards and select the best one
 *
 * @param repoRoot - Repository root path
 * @param name - FileRL run name
 * @param rewards - Map of task name to reward score
 */
export function selectBest(
  repoRoot: string,
  name: string,
  taskRewards: Record<string, number>
): RunResult {
  const state = readState(repoRoot, name);
  if (!state) {
    return {
      success: false,
      error: `FileRL run not found: ${name}`,
    };
  }

  // Parse config
  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return {
      success: false,
      error: parseResult.error || "Failed to parse target file",
    };
  }

  const config = parseResult.config;
  const currentIter = state.iterations[state.iterations.length - 1];

  if (!currentIter) {
    return {
      success: false,
      error: "No active iteration found",
    };
  }

  // Use PPO selection
  const taskNames = Object.keys(taskRewards);
  const selectResult = selectBestTask(repoRoot, taskNames, {
    threshold: config.ppo.threshold,
    klCoef: config.ppo.kl_coef,
    maxDiff: config.ppo.max_diff,
  });

  if (!selectResult.success) {
    return {
      success: false,
      error: selectResult.error || "Failed to select best task",
    };
  }

  // Complete iteration
  completeIteration(
    state,
    selectResult.selected || undefined,
    selectResult.rejected || [],
    taskRewards
  );

  // Check for convergence
  if (checkConvergence(state, config.ppo.convergence_threshold)) {
    markConverged(state);
  }

  writeState(repoRoot, state);

  return {
    success: true,
    state,
    message: selectResult.selected
      ? `Selected task: ${selectResult.selected} (reward: ${taskRewards[selectResult.selected]?.toFixed(3)})`
      : "No task selected (none above threshold)",
  };
}

/**
 * Stop an active FileRL run
 */
export function stop(repoRoot: string, name: string): StopResult {
  const state = readState(repoRoot, name);
  if (!state) {
    return {
      success: false,
      error: `FileRL run not found: ${name}`,
    };
  }

  if (!state.active) {
    return {
      success: true,
      message: `Run "${name}" is not active`,
    };
  }

  stopRun(state);
  writeState(repoRoot, state);

  return {
    success: true,
    message: `Stopped FileRL run: ${name}`,
  };
}

/**
 * Resume a paused FileRL run
 */
export function resume(repoRoot: string, name: string): RunResult {
  const state = readState(repoRoot, name);
  if (!state) {
    return {
      success: false,
      error: `FileRL run not found: ${name}`,
    };
  }

  if (state.active) {
    return {
      success: true,
      state,
      message: `Run "${name}" is already active`,
    };
  }

  if (state.converged) {
    return {
      success: false,
      error: `Run "${name}" has converged and cannot be resumed`,
    };
  }

  state.active = true;
  writeState(repoRoot, state);

  return {
    success: true,
    state,
    message: `Resumed FileRL run: ${name}`,
  };
}
