/**
 * FileRL Runner
 *
 * Orchestrates the FileRL loop execution.
 * This module coordinates idea generation, task creation, and reward selection.
 *
 * The FileRL loop consists of the following phases:
 * 1. Generate Ideas - AI analyzes codebase and generates improvement ideas
 * 2. Promote Ideas - Top ideas are promoted to tasks
 * 3. Execute Tasks - Tasks run in parallel worktrees
 * 4. Compute Rewards - Each task's changes are evaluated
 * 5. Select Best - PPO algorithm selects the best task
 * 6. Merge Winner - Winning PR is merged, losers are cleaned up
 * 7. Iterate - Process repeats until convergence
 */

import { resolve, join } from "node:path";
import { readFileSync } from "node:fs";

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
  getFileRlDir,
} from "./state";

// Import ops from other modules
import { createTask, viewTask, archiveTask } from "../../task/ops/crud";
import { enqueueTask, approveTask, cancelTask } from "../../task/ops/lifecycle";
import { startTask } from "../../task/phase/start";
import { selectBestTask } from "../../reward/ops/select";
import { computeReward } from "../../reward/ops/crud";
import { generateIdeas, promoteIdeaDirect, dismissIdea, listIdeas } from "../../idea/ops";
import type { IdeaGenerateOptions, Idea } from "../../idea/ops";

// =============================================================================
// Constants
// =============================================================================

/** Default polling interval for task completion (ms) */
const DEFAULT_POLL_INTERVAL = 30000; // 30 seconds

/** Maximum time to wait for tasks to complete (ms) */
const DEFAULT_MAX_WAIT_TIME = 3600000; // 1 hour

// =============================================================================
// Debug Logging
// =============================================================================

/** Debug log prefix */
const DEBUG_PREFIX = "[FileRL]";

/**
 * Create a debug logger with timestamp
 */
function createDebugLogger(phase: string) {
  return (message: string, data?: unknown) => {
    const timestamp = new Date().toISOString();
    const prefix = `${DEBUG_PREFIX} [${timestamp}] [${phase}]`;
    if (data !== undefined) {
      console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`${prefix} ${message}`);
    }
  };
}

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
  const debug = createDebugLogger("initRun");

  // Parse target file
  const parseResult = parseTarget(targetPath, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, error: parseResult.error || "Failed to parse target file" };
  }

  const config = parseResult.config;
  debug("Config loaded", { name: config.name, ideaTypes: config.idea.types });

  // Validate configuration
  const validation = validateConfig(config);
  if (!validation.valid) {
    return { success: false, error: `Invalid configuration:\n${validation.errors.join("\n")}` };
  }

  // Check if run already exists
  const exists = runExists(repoRoot, config.name);
  if (exists && !options?.force) {
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

  debug("Initialized", { name: config.name });
  return { success: true, state, message: `Initialized FileRL run: ${config.name}` };
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
  const state = readState(repoRoot, name);
  if (!state) {
    return { success: false, error: `FileRL run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, error: parseResult.error || "Failed to parse target file" };
  }

  const config = parseResult.config;

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

  // Check if current iteration is incomplete - if so, resume it instead of starting new one
  const currentIter = state.iterations[state.iterations.length - 1];
  if (currentIter && !currentIter.completed) {
    // Resume existing incomplete iteration
    state.active = true;
    writeState(repoRoot, state);
    return { success: true, state, message: `Resumed iteration ${currentIter.iteration} for "${name}"` };
  }

  // Start a new iteration only if no incomplete iteration exists
  const iteration = startIteration(state);
  writeState(repoRoot, state);

  return { success: true, state, message: `Started iteration ${iteration.iteration} for "${name}"` };
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
    return { success: false, error: `FileRL run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, error: parseResult.error || "Failed to parse target file" };
  }

  const config = parseResult.config;
  const currentIter = state.iterations[state.iterations.length - 1];

  if (!currentIter) {
    return { success: false, error: "No active iteration found" };
  }

  currentIter.ideas = ideaIds;
  const taskNames: string[] = [];
  const errors: string[] = [];

  // Get FileRL directory for reward config and output
  const filerlDir = getFileRlDir(repoRoot, name);

  for (const ideaId of ideaIds) {
    const result = createTask(repoRoot, `FileRL iteration ${state.current_iteration} - ${ideaId}`, {
      slug: `filerl-${name}-i${state.current_iteration}-${ideaId}`,
      worktree: config.task.worktree,
      executor: config.task.executor,
      model: config.task.model,
      computeReward: true,
      filerlDir,
    });

    if (result.success && result.dirName) {
      taskNames.push(result.dirName);
      if (config.task.auto_start) {
        enqueueTask(repoRoot, result.dirName, {});
      }
    } else {
      errors.push(`Failed to create task for idea ${ideaId}: ${result.error}`);
    }
  }

  currentIter.tasks = taskNames;
  writeState(repoRoot, state);

  if (errors.length > 0) {
    return { success: false, state, error: errors.join("\n") };
  }

  return { success: true, state, message: `Created ${taskNames.length} tasks for iteration ${state.current_iteration}` };
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
  const debug = createDebugLogger("selectBestInternal");

  const state = readState(repoRoot, name);
  if (!state) {
    return { success: false, error: `FileRL run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, error: parseResult.error || "Failed to parse target file" };
  }

  const config = parseResult.config;
  const currentIter = state.iterations[state.iterations.length - 1];

  if (!currentIter) {
    return { success: false, error: "No active iteration found" };
  }

  const taskNames = Object.keys(taskRewards);
  const selectResult = selectBestTask(repoRoot, taskNames, {
    threshold: config.ppo.threshold,
    klCoef: config.ppo.kl_coef,
    maxDiff: config.ppo.max_diff,
  });

  if (!selectResult.success) {
    return { success: false, error: selectResult.error || "Failed to select best task" };
  }

  completeIteration(
    state,
    selectResult.selected || undefined,
    selectResult.rejected || [],
    taskRewards
  );

  if (checkConvergence(state, config.ppo.convergence_threshold)) {
    markConverged(state);
  }

  writeState(repoRoot, state);

  const message = selectResult.selected
    ? `Selected task: ${selectResult.selected} (reward: ${taskRewards[selectResult.selected]?.toFixed(3)})`
    : "No task selected (none above threshold)";

  debug("Result", { selected: selectResult.selected, converged: state.converged });
  return { success: true, state, message };
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

// =============================================================================
// Orchestration Functions
// =============================================================================

/**
 * Result type for orchestration operations
 */
export interface OrchestrationResult {
  success: boolean;
  phase?: string;
  data?: unknown;
  error?: string;
}

/**
 * Phase 1: Generate Ideas
 *
 * Uses the idea generation ops to create new improvement ideas
 * based on the FileRL configuration.
 *
 * @param repoRoot - Repository root path
 * @param name - FileRL run name
 * @param onProgress - Optional progress callback
 */
export async function orchestrateGenerateIdeas(
  repoRoot: string,
  name: string,
  onProgress?: (message: string) => void
): Promise<OrchestrationResult> {
  const debug = createDebugLogger("orchestrateGenerateIdeas");
  debug(">>> ENTER", { repoRoot, name });

  // Load state and config
  const state = readState(repoRoot, name);
  if (!state) {
    debug("<<< EXIT (state not found)");
    return { success: false, phase: "generate_ideas", error: `FileRL run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    debug("<<< EXIT (parse failed)", { error: parseResult.error });
    return { success: false, phase: "generate_ideas", error: parseResult.error || "Failed to parse target file" };
  }

  const config = parseResult.config;
  debug("Idea config", { types: config.idea.types, maxIdeas: config.idea.max_ideas });
  onProgress?.(`Generating ideas for types: ${config.idea.types.join(", ")}`);

  // Generate ideas using idea ops
  const generateOptions: IdeaGenerateOptions = {
    types: config.idea.types,
    maxIdeas: config.idea.max_ideas,
  };

  const result = await generateIdeas(repoRoot, generateOptions, onProgress);
  debug("generateIdeas result", {
    success: result.success,
    ideaCount: result.ideas.length,
    sessionId: result.sessionId,
    sessionDir: result.sessionDir,
  });

  if (!result.success || result.ideas.length === 0) {
    debug("<<< EXIT (no ideas generated)", { errors: result.errors });
    return {
      success: false,
      phase: "generate_ideas",
      error: result.errors?.join("; ") || "No ideas generated",
    };
  }

  debug("Ideas generated", result.ideas.map(i => ({ id: i.id, effort: i.estimatedEffort })));

  debug("<<< EXIT (success)", { ideaCount: result.ideas.length, sessionDir: result.sessionDir });
  return {
    success: true,
    phase: "generate_ideas",
    data: {
      sessionId: result.sessionId,
      sessionDir: result.sessionDir,
      ideas: result.ideas,
      byType: result.byType,
    },
  };
}

/**
 * Phase 2: Promote Top Ideas to Tasks
 *
 * Selects the top N ideas (based on effort and priority) and
 * promotes them to tasks for execution.
 *
 * @param repoRoot - Repository root path
 * @param name - FileRL run name
 * @param ideas - Ideas to select from (from Phase 1)
 * @param onProgress - Optional progress callback
 */
export function orchestratePromoteIdeas(
  repoRoot: string,
  name: string,
  ideas: Idea[],
  onProgress?: (message: string) => void
): OrchestrationResult {
  const debug = createDebugLogger("promoteIdeas");

  const state = readState(repoRoot, name);
  if (!state) {
    return { success: false, phase: "promote_ideas", error: `FileRL run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, phase: "promote_ideas", error: parseResult.error || "Failed to parse target file" };
  }

  const config = parseResult.config;
  const currentIter = state.iterations[state.iterations.length - 1];

  if (!currentIter) {
    return { success: false, phase: "promote_ideas", error: "No active iteration found" };
  }

  // Filter ideas by effort if configured
  let filteredIdeas = ideas;
  if (config.idea.effort_filter && config.idea.effort_filter.length > 0) {
    filteredIdeas = ideas.filter(idea =>
      config.idea.effort_filter!.includes(idea.estimatedEffort)
    );
  }

  // Sort by priority (trivial > small > medium > large > complex for quick wins)
  const effortOrder: Record<string, number> = {
    trivial: 1,
    small: 2,
    medium: 3,
    large: 4,
    complex: 5,
  };
  filteredIdeas.sort((a, b) =>
    (effortOrder[a.estimatedEffort] || 3) - (effortOrder[b.estimatedEffort] || 3)
  );

  // Take top N ideas
  const topIdeas = filteredIdeas.slice(0, config.idea.auto_promote_count);
  debug("Selected ideas", topIdeas.map(i => ({ id: i.id, effort: i.estimatedEffort })));
  onProgress?.(`Selected top ${topIdeas.length} ideas for promotion`);

  // Store idea IDs in iteration state
  currentIter.ideas = topIdeas.map(idea => idea.id);

  // Promote each idea to a task (using promoteIdeaDirect to avoid disk lookup issues)
  const taskNames: string[] = [];
  const errors: string[] = [];

  for (const idea of topIdeas) {
    onProgress?.(`Promoting idea: ${idea.title}`);

    // Get FileRL directory for reward config and output
    const filerlDir = getFileRlDir(repoRoot, name);

    const promoteOptions = {
      slug: `filerl-${name}-i${state.current_iteration}-${idea.id.slice(0, 8)}`,
      worktree: config.task.worktree,
      executor: config.task.executor,
      model: config.task.model,
      start: config.task.auto_start,
      computeReward: true,
      filerlDir,
    };

    // Use promoteIdeaDirect since we already have the Idea object in memory
    const result = promoteIdeaDirect(repoRoot, idea, promoteOptions);
    if (result.success && result.dirName) {
      taskNames.push(result.dirName);
      debug(`Promoted ${idea.id} -> ${result.dirName}`);
    } else {
      debug(`Failed to promote ${idea.id}`, { error: result.error });
      errors.push(`Failed to promote idea ${idea.id}: ${result.error}`);
    }
  }

  // Store tasks in iteration state
  currentIter.tasks = taskNames;
  writeState(repoRoot, state);

  if (taskNames.length === 0) {
    return { success: false, phase: "promote_ideas", error: errors.join("; ") || "No tasks created" };
  }

  return {
    success: true,
    phase: "promote_ideas",
    data: { tasks: taskNames, errors: errors.length > 0 ? errors : undefined },
  };
}

/**
 * Start tasks by spawning agent executors
 *
 * This actually launches the task execution using the configured executor.
 *
 * @param repoRoot - Repository root path
 * @param taskNames - Task names to start
 * @param onProgress - Optional progress callback
 */
export async function orchestrateStartTasks(
  repoRoot: string,
  taskNames: string[],
  onProgress?: (message: string) => void
): Promise<OrchestrationResult> {
  const debug = createDebugLogger("startTasks");
  const started: string[] = [];
  const errors: string[] = [];

  for (const taskName of taskNames) {
    onProgress?.(`Starting task: ${taskName}`);

    const result = await startTask(repoRoot, taskName, {
      detach: true,
      verbose: false,
    });

    if (result.success) {
      started.push(taskName);
      debug(`Started ${taskName}`, { sessionId: result.sessionId });
    } else {
      debug(`Failed to start ${taskName}`, { error: result.error });
      errors.push(`Failed to start task ${taskName}: ${result.error}`);
    }
  }

  if (started.length === 0) {
    return { success: false, phase: "start_tasks", error: errors.join("; ") || "No tasks started" };
  }

  return {
    success: true,
    phase: "start_tasks",
    data: { started, errors: errors.length > 0 ? errors : undefined },
  };
}

/**
 * Phase 3: Check Task Completion Status
 *
 * Polls task status to determine if all tasks have completed.
 * Returns the status of each task.
 *
 * @param repoRoot - Repository root path
 * @param taskNames - Task names to check
 */
export function orchestrateCheckTasksStatus(
  repoRoot: string,
  taskNames: string[]
): OrchestrationResult {
  const debug = createDebugLogger("checkTasksStatus");

  const statuses: Record<string, { status: string; hasReward: boolean; prUrl?: string }> = {};
  let allCompleted = true;
  let anyFailed = false;

  for (const taskName of taskNames) {
    const result = viewTask(repoRoot, taskName);

    if (!result.success || !result.task) {
      statuses[taskName] = { status: "not_found", hasReward: false };
      anyFailed = true;
      continue;
    }

    const status = result.task.status;
    const hasReward = !!(result.task as unknown as { reward?: unknown }).reward;
    const prUrl = (result.task as unknown as { pr_url?: string }).pr_url;

    statuses[taskName] = { status, hasReward, prUrl };

    if (status !== "completed" && status !== "review" && status !== "failed" && status !== "cancelled") {
      allCompleted = false;
    }
    if (status === "failed" || status === "cancelled") {
      anyFailed = true;
    }
  }

  const completedCount = Object.values(statuses).filter(s =>
    s.status === "completed" || s.status === "review"
  ).length;

  debug("Status", { allCompleted, completedCount, total: taskNames.length });
  return {
    success: true,
    phase: "check_status",
    data: { statuses, allCompleted, anyFailed, completedCount, totalCount: taskNames.length },
  };
}

/**
 * Phase 4: Compute Rewards for Completed Tasks
 *
 * Triggers reward computation for tasks that have completed
 * but don't have reward data yet.
 *
 * @param repoRoot - Repository root path
 * @param name - FileRL run name (for locating reward.json)
 * @param taskNames - Task names to compute rewards for
 * @param currentIteration - Current iteration number
 * @param onProgress - Optional progress callback
 */
export function orchestrateComputeRewards(
  repoRoot: string,
  name: string,
  taskNames: string[],
  currentIteration: number,
  onProgress?: (message: string) => void
): OrchestrationResult {
  const debug = createDebugLogger("computeRewards");
  const results: Record<string, { success: boolean; error?: string }> = {};
  const filerlDir = getFileRlDir(repoRoot, name);

  for (const taskName of taskNames) {
    const viewResult = viewTask(repoRoot, taskName);
    if (!viewResult.success || !viewResult.task) {
      results[taskName] = { success: false, error: "Task not found" };
      continue;
    }

    // Check if reward already exists - first check FileRL reward.json, then task.json
    let hasReward = false;

    // Check FileRL reward.json
    const iterDir = join(filerlDir, `iter${currentIteration}`);
    const rewardJsonPath = join(iterDir, taskName, "reward.json");
    try {
      const rewardContent = readFileSync(rewardJsonPath, "utf-8");
      const rewardData = JSON.parse(rewardContent) as { total?: number };
      if (typeof rewardData.total === "number") {
        hasReward = true;
      }
    } catch {
      // reward.json not found, check task.json
      hasReward = !!(viewResult.task as unknown as { reward?: unknown }).reward;
    }

    if (hasReward) {
      results[taskName] = { success: true };
      continue;
    }

    onProgress?.(`Computing reward for task: ${taskName}`);
    const rewardResult = computeReward(repoRoot, taskName, { verbose: false });
    results[taskName] = rewardResult.success
      ? { success: true }
      : { success: false, error: rewardResult.error };
  }

  const successCount = Object.values(results).filter(r => r.success).length;
  debug("Results", { successCount, total: taskNames.length });

  return {
    success: successCount > 0,
    phase: "compute_rewards",
    data: { results, successCount, totalCount: taskNames.length },
  };
}

/**
 * Phase 5: Select Best Task and Complete Iteration
 *
 * Uses PPO algorithm to select the best task based on rewards.
 * Updates the FileRL state with the selection.
 *
 * @param repoRoot - Repository root path
 * @param name - FileRL run name
 * @param onProgress - Optional progress callback
 */
export function orchestrateSelectBest(
  repoRoot: string,
  name: string,
  onProgress?: (message: string) => void
): OrchestrationResult {
  const debug = createDebugLogger("selectBest");

  const state = readState(repoRoot, name);
  if (!state) {
    return { success: false, phase: "select_best", error: `FileRL run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, phase: "select_best", error: parseResult.error || "Failed to parse target file" };
  }

  const currentIter = state.iterations[state.iterations.length - 1];
  if (!currentIter) {
    return { success: false, phase: "select_best", error: "No active iteration found" };
  }

  // Gather rewards from tasks
  // In FileRL mode, rewards are stored in .viben/filerl/{name}/iter{N}/{task}/reward.json
  // Also try task.json as fallback
  const taskRewards: Record<string, number> = {};
  const filerlDir = getFileRlDir(repoRoot, name);

  for (const taskName of currentIter.tasks) {
    // First try to read from FileRL reward.json
    const iterDir = join(filerlDir, `iter${state.current_iteration}`);
    const rewardJsonPath = join(iterDir, taskName, "reward.json");

    try {
      const rewardContent = readFileSync(rewardJsonPath, "utf-8");
      const rewardData = JSON.parse(rewardContent) as { total?: number };
      if (typeof rewardData.total === "number") {
        taskRewards[taskName] = rewardData.total;
        onProgress?.(`Task ${taskName}: reward = ${rewardData.total.toFixed(3)}`);
        continue;
      }
    } catch {
      // reward.json not found, try task.json fallback
    }

    // Fallback: try to read from task.json
    const viewResult = viewTask(repoRoot, taskName);
    if (!viewResult.success || !viewResult.task) {
      onProgress?.(`Warning: Task ${taskName} not found`);
      continue;
    }

    const rewardData = (viewResult.task as unknown as { reward?: { total?: number } }).reward;
    if (rewardData && typeof rewardData.total === "number") {
      taskRewards[taskName] = rewardData.total;
      onProgress?.(`Task ${taskName}: reward = ${rewardData.total.toFixed(3)}`);
    }
  }

  if (Object.keys(taskRewards).length === 0) {
    return { success: false, phase: "select_best", error: "No tasks with reward data found" };
  }

  const result = selectBest(repoRoot, name, taskRewards);
  if (!result.success) {
    return { success: false, phase: "select_best", error: result.error };
  }

  const selected = result.state?.iterations[result.state.iterations.length - 1]?.selected_task;
  const rejected = result.state?.iterations[result.state.iterations.length - 1]?.rejected_tasks;

  debug("Selection", { selected, rejected, converged: result.state?.converged });
  return {
    success: true,
    phase: "select_best",
    data: { selected, rejected, rewards: taskRewards, converged: result.state?.converged },
  };
}

/**
 * Phase 6: Approve Winner and Cleanup Losers
 *
 * Merges the winning task's PR and cleans up the rejected tasks.
 *
 * @param repoRoot - Repository root path
 * @param name - FileRL run name
 * @param selectedTask - The winning task name
 * @param rejectedTasks - Array of rejected task names
 * @param onProgress - Optional progress callback
 */
export function orchestrateMergeAndCleanup(
  repoRoot: string,
  name: string,
  selectedTask: string | undefined,
  rejectedTasks: string[],
  onProgress?: (message: string) => void
): OrchestrationResult {
  const debug = createDebugLogger("mergeAndCleanup");

  const results: {
    merged?: { success: boolean; error?: string };
    cleanedUp: Array<{ task: string; success: boolean; error?: string }>;
  } = { cleanedUp: [] };

  // Approve and merge the winning task
  if (selectedTask) {
    onProgress?.(`Approving winning task: ${selectedTask}`);
    const approveResult = approveTask(repoRoot, selectedTask, {
      cleanupIfMerged: true,
      pullIfMerged: true,
    });

    results.merged = { success: approveResult.success, error: approveResult.error };
    if (approveResult.success) {
      onProgress?.(`Merged PR for task: ${selectedTask}`);
    } else {
      onProgress?.(`Warning: Failed to merge PR: ${approveResult.error}`);
    }
  }

  // Cleanup rejected tasks
  for (const taskName of rejectedTasks) {
    cancelTask(repoRoot, taskName, {
      reason: `Rejected in FileRL iteration for run "${name}"`,
      force: true,
    });

    const archiveResult = archiveTask(repoRoot, taskName);
    results.cleanedUp.push({
      task: taskName,
      success: archiveResult.success,
      error: archiveResult.error,
    });
  }

  debug("Complete", { merged: results.merged?.success, cleanedUp: results.cleanedUp.length });
  return { success: true, phase: "merge_and_cleanup", data: results };
}

/**
 * Wait for all tasks to complete with polling
 *
 * @param repoRoot - Repository root path
 * @param taskNames - Task names to wait for
 * @param options - Wait options
 * @param onProgress - Optional progress callback
 */
export async function waitForTasksCompletion(
  repoRoot: string,
  taskNames: string[],
  options: {
    pollInterval?: number;
    maxWaitTime?: number;
  } = {},
  onProgress?: (message: string) => void
): Promise<OrchestrationResult> {
  const debug = createDebugLogger("waitForTasks");
  const pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;
  const maxWaitTime = options.maxWaitTime || DEFAULT_MAX_WAIT_TIME;
  const startTime = Date.now();

  while (true) {
    const statusResult = orchestrateCheckTasksStatus(repoRoot, taskNames);
    const statusData = statusResult.data as {
      allCompleted: boolean;
      completedCount: number;
      totalCount: number;
      statuses: Record<string, { status: string }>;
    };

    onProgress?.(`Task status: ${statusData.completedCount}/${statusData.totalCount} completed`);

    if (statusData.allCompleted) {
      debug("All tasks completed");
      return { success: true, phase: "wait_complete", data: statusData };
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= maxWaitTime) {
      debug("Timeout", { elapsed: Math.round(elapsed / 60000) });
      return {
        success: false,
        phase: "wait_timeout",
        error: `Timeout after ${Math.round(elapsed / 60000)} minutes`,
        data: statusData,
      };
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}

/**
 * Dismiss all ideas that were generated but not promoted
 *
 * @param repoRoot - Repository root path
 * @param ideas - Ideas to dismiss
 * @param onProgress - Optional progress callback
 */
function dismissFilteredIdeas(
  repoRoot: string,
  ideas: Idea[],
  onProgress?: (message: string) => void
): void {
  let dismissedCount = 0;
  for (const idea of ideas) {
    if (idea.status === "draft") {
      dismissIdea(repoRoot, idea.id);
      dismissedCount++;
    }
  }
  if (dismissedCount > 0) {
    onProgress?.(`Dismissed ${dismissedCount} ideas`);
  }
}

/**
 * Run a complete FileRL iteration (single iteration, no loop)
 *
 * This handles one iteration including waiting for task completion.
 *
 * @param repoRoot - Repository root path
 * @param name - FileRL run name
 * @param onProgress - Optional progress callback
 */
export async function orchestrateFullIteration(
  repoRoot: string,
  name: string,
  onProgress?: (message: string) => void
): Promise<OrchestrationResult> {
  const debug = createDebugLogger("fullIteration");

  // Initialize iteration state
  const initResult = runIteration(repoRoot, name);
  if (!initResult.success) {
    return { success: false, phase: "init", error: initResult.error };
  }

  if (initResult.state?.converged) {
    return { success: true, phase: "converged", data: { converged: true } };
  }

  const iterNum = initResult.state?.current_iteration || 1;
  debug(`Starting iteration ${iterNum}`);

  // Load config
  let state = readState(repoRoot, name);
  if (!state) {
    return { success: false, phase: "init", error: `FileRL run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, phase: "init", error: parseResult.error || "Failed to parse target file" };
  }

  const config = parseResult.config;

  // Check current iteration state for resume handling
  const currentIter = state.iterations[state.iterations.length - 1];
  let tasks: string[] = [];

  // Resume logic: check what phase we should start from
  // Track if we should skip waiting for tasks (already completed)
  let skipWaitForTasks = false;

  if (currentIter && currentIter.tasks.length > 0) {
    // Already have tasks - check their status
    tasks = currentIter.tasks;
    onProgress?.(`[${iterNum}] Resuming - found ${tasks.length} existing tasks`);
    debug("Resuming with existing tasks", { tasks });

    // Check if tasks are already running or need to be started
    const statusResult = orchestrateCheckTasksStatus(repoRoot, tasks);
    const statusData = statusResult.data as {
      statuses: Record<string, { status: string }>;
      allCompleted: boolean;
      completedCount: number;
    };

    // If all tasks are already completed, skip directly to reward computation
    if (statusData.allCompleted) {
      onProgress?.(`[${iterNum}] All ${tasks.length} tasks already completed, skipping to reward computation`);
      debug("All tasks completed, skipping wait phase", { completedCount: statusData.completedCount });
      skipWaitForTasks = true;
    } else {
      // Find tasks that haven't started yet (status is backlog or queue)
      const notStarted = tasks.filter(t => {
        const s = statusData.statuses[t]?.status;
        return s === "backlog" || s === "queue";
      });

      if (notStarted.length > 0) {
        onProgress?.(`[${iterNum}] Starting ${notStarted.length} unstarted tasks`);
        await orchestrateStartTasks(repoRoot, notStarted, onProgress);
      }
    }
  } else if (currentIter && currentIter.ideas.length > 0) {
    // Have ideas but no tasks - load ideas from disk and promote
    onProgress?.(`[${iterNum}] Resuming - found ${currentIter.ideas.length} existing ideas`);
    debug("Resuming with existing ideas", { ideaIds: currentIter.ideas });

    // Load existing ideas from disk
    const ideaResult = listIdeas(repoRoot, { status: "draft" });
    const existingIdeas = ideaResult.ideas.filter(i => currentIter.ideas.includes(i.id));

    if (existingIdeas.length > 0) {
      // Promote existing ideas
      onProgress?.(`[${iterNum}] Phase 2 - Promote Ideas (${existingIdeas.length} existing)`);
      const promoteResult = orchestratePromoteIdeas(repoRoot, name, existingIdeas, onProgress);
      if (!promoteResult.success) {
        return promoteResult;
      }

      tasks = (promoteResult.data as { tasks: string[] }).tasks;
      debug(`Created ${tasks.length} tasks from existing ideas`);

      // Start task execution
      onProgress?.(`[${iterNum}] Phase 2.5 - Starting task executors`);
      const startResult = await orchestrateStartTasks(repoRoot, tasks, onProgress);
      if (!startResult.success) {
        return startResult;
      }
    } else {
      // Ideas not found on disk - fall through to generate new ones
      onProgress?.(`[${iterNum}] Existing ideas not found on disk, generating new ones`);
    }
  }

  // If we don't have tasks yet, check for existing ideas or generate new ones
  if (tasks.length === 0) {
    // First, check if there are already draft ideas on disk
    const existingIdeasResult = listIdeas(repoRoot, { status: "draft" });
    let ideas: Idea[] = [];

    if (existingIdeasResult.ideas.length > 0) {
      // Use existing draft ideas instead of generating new ones
      ideas = existingIdeasResult.ideas;
      onProgress?.(`[${iterNum}] Found ${ideas.length} existing draft ideas, skipping generation`);
      debug("Using existing draft ideas", { count: ideas.length, ids: ideas.map(i => i.id) });
    } else {
      // Phase 1: Generate Ideas
      onProgress?.(`[${iterNum}] Phase 1 - Generate Ideas`);
      const generateResult = await orchestrateGenerateIdeas(repoRoot, name, onProgress);
      if (!generateResult.success) {
        return generateResult;
      }

      const generateData = generateResult.data as { ideas: Idea[]; sessionDir?: string };
      ideas = generateData.ideas;
    }

    // Pre-check if any ideas will pass the filter
    let filteredIdeas = ideas;
    if (config.idea.effort_filter && config.idea.effort_filter.length > 0) {
      filteredIdeas = ideas.filter(idea =>
        config.idea.effort_filter!.includes(idea.estimatedEffort)
      );
    }

    if (filteredIdeas.length === 0) {
      onProgress?.(`All ${ideas.length} ideas filtered out. Requesting regeneration.`);
      dismissFilteredIdeas(repoRoot, ideas, onProgress);
      return {
        success: false,
        phase: "promote_ideas",
        error: "no_ideas_after_filter",
        data: { needsRegeneration: true },
      };
    }

    // Phase 2: Promote Ideas to Tasks
    onProgress?.(`[${iterNum}] Phase 2 - Promote Ideas`);
    const promoteResult = orchestratePromoteIdeas(repoRoot, name, ideas, onProgress);
    if (!promoteResult.success) {
      dismissFilteredIdeas(repoRoot, ideas, onProgress);
      return promoteResult;
    }

    tasks = (promoteResult.data as { tasks: string[] }).tasks;
    debug(`Created ${tasks.length} tasks`);

    // Phase 2.5: Start task execution (spawn agent executors)
    onProgress?.(`[${iterNum}] Phase 2.5 - Starting task executors`);
    const startResult = await orchestrateStartTasks(repoRoot, tasks, onProgress);
    if (!startResult.success) {
      return startResult;
    }
  }

  // Phase 3: Wait for tasks to complete (skip if already completed on resume)
  if (!skipWaitForTasks) {
    onProgress?.(`[${iterNum}] Phase 3 - Waiting for tasks`);
    const waitResult = await waitForTasksCompletion(repoRoot, tasks, {}, onProgress);
    if (!waitResult.success) {
      return waitResult;
    }
  } else {
    onProgress?.(`[${iterNum}] Phase 3 - Skipped (tasks already completed)`);
  }

  // Phase 4: Compute rewards
  onProgress?.(`[${iterNum}] Phase 4 - Computing rewards`);
  orchestrateComputeRewards(repoRoot, name, tasks, iterNum, onProgress);

  // Phase 5: Select best task
  onProgress?.(`[${iterNum}] Phase 5 - Selecting best task`);
  const selectResult = orchestrateSelectBest(repoRoot, name, onProgress);
  if (!selectResult.success) {
    return selectResult;
  }

  const selectData = selectResult.data as {
    selected?: string;
    rejected?: string[];
    converged?: boolean;
  };

  // Phase 6: Merge winner and cleanup losers
  onProgress?.(`[${iterNum}] Phase 6 - Merging and cleanup`);
  const cleanupResult = orchestrateMergeAndCleanup(
    repoRoot,
    name,
    selectData.selected,
    selectData.rejected || [],
    onProgress
  );

  const updatedState = readState(repoRoot, name);
  const converged = updatedState?.converged ?? false;

  debug(`Iteration ${iterNum} complete`, { selected: selectData.selected, converged });
  return {
    success: true,
    phase: "iteration_complete",
    data: {
      iteration: iterNum,
      selected: selectData.selected,
      converged,
      cleanupResult: cleanupResult.data,
    },
  };
}

/**
 * Run the full FileRL loop until convergence or max iterations
 *
 * This is the main entry point for running FileRL automatically.
 * It handles:
 * - Multiple iterations until convergence
 * - Regeneration when all ideas are filtered out
 * - Automatic waiting for task completion
 * - Cleanup of rejected tasks
 *
 * @param repoRoot - Repository root path
 * @param name - FileRL run name
 * @param onProgress - Optional progress callback
 */
export async function runFileRlLoop(
  repoRoot: string,
  name: string,
  onProgress?: (message: string) => void
): Promise<OrchestrationResult> {
  const debug = createDebugLogger("loop");

  const state = readState(repoRoot, name);
  if (!state) {
    return { success: false, phase: "init", error: `FileRL run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, phase: "init", error: parseResult.error || "Failed to parse target file" };
  }

  const config = parseResult.config;
  const maxIterations = config.ppo.max_iterations;
  let regenerationAttempts = 0;
  const maxRegenerationAttempts = 3;

  debug("Starting loop", { maxIterations });

  while (true) {
    const currentState = readState(repoRoot, name);

    // Check termination conditions
    if (currentState && currentState.current_iteration >= maxIterations) {
      onProgress?.(`Reached max iterations (${maxIterations})`);
      return {
        success: true,
        phase: "max_iterations",
        data: {
          iterations: currentState.current_iteration,
          bestReward: currentState.best_reward,
          bestTask: currentState.best_task,
        },
      };
    }

    if (currentState?.converged) {
      onProgress?.(`Converged!`);
      return {
        success: true,
        phase: "converged",
        data: {
          iterations: currentState.completed_iterations,
          bestReward: currentState.best_reward,
          bestTask: currentState.best_task,
        },
      };
    }

    // Run one iteration
    const iterResult = await orchestrateFullIteration(repoRoot, name, onProgress);

    // Handle regeneration case
    if (!iterResult.success && iterResult.error === "no_ideas_after_filter") {
      regenerationAttempts++;
      if (regenerationAttempts >= maxRegenerationAttempts) {
        return {
          success: false,
          phase: "regeneration_failed",
          error: `Failed to generate valid ideas after ${maxRegenerationAttempts} attempts`,
        };
      }
      onProgress?.(`Regeneration attempt ${regenerationAttempts}/${maxRegenerationAttempts}`);
      continue;
    }

    regenerationAttempts = 0;

    if (!iterResult.success) {
      return iterResult;
    }

    const iterData = iterResult.data as { converged?: boolean };
    if (iterData.converged) {
      const finalState = readState(repoRoot, name);
      return {
        success: true,
        phase: "converged",
        data: {
          iterations: finalState?.completed_iterations || 0,
          bestReward: finalState?.best_reward || 0,
          bestTask: finalState?.best_task,
        },
      };
    }
  }
}
