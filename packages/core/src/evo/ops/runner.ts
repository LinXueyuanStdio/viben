/**
 * Evo Runner
 *
 * Orchestrates the Evo loop execution.
 * This module coordinates idea generation, task creation, and reward selection for the Evo system.
 *
 * The Evo loop consists of the following phases:
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
  EvoConfig,
  EvoState,
  IterationPhase,
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
  getEvoDir,
  updateIterationPhase,
  getCurrentPhase,
} from "./state";

// Import ops from other modules
import { createTask, viewTask, archiveTask } from "../../task/ops/crud";
import { enqueueTask, approveTask, cancelTask } from "../../task/ops/lifecycle";
import { startTask } from "../../task/phase/start";
import { selectBestTask } from "../../reward/ops/select";
import { computeReward } from "../../reward/ops/crud";
import { generateIdeas, promoteIdeaDirect, dismissIdea, listIdeas, getAllIdeasFromSession } from "../../idea/ops";
import type { IdeaGenerateOptions, Idea } from "../../idea/ops";
import { readRegistry, cleanupDeadAgents } from "../../cli/lib/swarm/registry";
import { isProcessRunning } from "../../cli/lib/swarm/status";
import { cleanupWorktree } from "../../cli/lib/swarm/cleanup";

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
const DEBUG_PREFIX = "[Evo]";

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
// Evo Runner
// =============================================================================

/**
 * Initialize a new Evo run
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
        error: `Evo run "${config.name}" is already active. Use --force to restart or stop it first.`,
      };
    }
  }

  // Create initial state
  const resolvedPath = resolve(repoRoot, targetPath);
  const state = createInitialState(config.name, resolvedPath);
  writeState(repoRoot, state);

  debug("Initialized", { name: config.name });
  return { success: true, state, message: `Initialized Evo run: ${config.name}` };
}

/**
 * Run a single iteration of the Evo loop
 *
 * This is the main entry point for running Evo. It:
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
    return { success: false, error: `Evo run not found: ${name}` };
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

  if (state.current_iteration >= config.convergence.max_iterations) {
    return {
      success: true,
      state,
      message: `Run "${name}" reached max iterations (${config.convergence.max_iterations}). Best reward: ${state.best_reward.toFixed(3)}`,
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
 * @param name - Evo run name
 * @param ideaIds - Array of idea IDs to promote to tasks
 */
export function createTasksFromIdeas(
  repoRoot: string,
  name: string,
  ideaIds: string[]
): RunResult {
  const state = readState(repoRoot, name);
  if (!state) {
    return { success: false, error: `Evo run not found: ${name}` };
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

  // Get Evo directory for reward config and output
  const evoDir = getEvoDir(repoRoot, name);

  for (const ideaId of ideaIds) {
    // Use idea id as task name for consistent directory naming
    // This ensures iter{N}/{ideaId}/ structure for rewards
    const result = createTask(repoRoot, `Evo iteration ${state.current_iteration} - ${ideaId}`, {
      slug: ideaId,  // Use idea id directly as slug
      worktree: config.rollout.worktree,
      executor: config.task.executor,
      model: config.task.model,
      computeReward: true,
      evoDir,
    });

    if (result.success && result.dir_name) {
      taskNames.push(result.dir_name);
      // Always auto-start tasks in Evo loop
      enqueueTask(repoRoot, result.dir_name, {});
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
 * @param name - Evo run name
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
    return { success: false, error: `Evo run not found: ${name}` };
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
  const evoDir = getEvoDir(repoRoot, name);
  const selectResult = selectBestTask(repoRoot, taskNames, {
    threshold: config.ppo.quality_threshold,
    klCoef: config.ppo.kl_coef,
    changeSensitivity: config.ppo.change_sensitivity,
    clipRange: config.ppo.clip_range,
    maxDiff: config.ppo.max_diff,
    taskIdeaMap: currentIter.task_idea_map,
    evoDir,
    iteration: state.current_iteration,
  });

  if (!selectResult.success) {
    return { success: false, error: selectResult.error || "Failed to select best task" };
  }

  // Save selection result to state (but don't mark iteration as completed yet)
  // completeIteration will be called after Phase 6 (merge and cleanup)
  currentIter.selected_task = selectResult.selected || undefined;
  currentIter.rejected_tasks = selectResult.rejected || [];
  currentIter.rewards = taskRewards;

  writeState(repoRoot, state);

  const message = selectResult.selected
    ? `Selected task: ${selectResult.selected} (reward: ${taskRewards[selectResult.selected]?.toFixed(3)})`
    : "No task selected (none above threshold)";

  debug("Result", { selected: selectResult.selected, converged: state.converged });
  return { success: true, state, message };
}

/**
 * Stop an active Evo run
 */
export function stop(repoRoot: string, name: string): StopResult {
  const state = readState(repoRoot, name);
  if (!state) {
    return {
      success: false,
      error: `Evo run not found: ${name}`,
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
    message: `Stopped Evo run: ${name}`,
  };
}

/**
 * Resume a paused Evo run
 */
export function resume(repoRoot: string, name: string): RunResult {
  const state = readState(repoRoot, name);
  if (!state) {
    return {
      success: false,
      error: `Evo run not found: ${name}`,
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
    message: `Resumed Evo run: ${name}`,
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
 * based on the Evo configuration.
 *
 * @param repoRoot - Repository root path
 * @param name - Evo run name
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
    return { success: false, phase: "generate_ideas", error: `Evo run not found: ${name}` };
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
    session_id: result.session_id,
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
      session_id: result.session_id,
      sessionDir: result.sessionDir,
      ideas: result.ideas,
      by_type: result.by_type,
    },
  };
}

/**
 * Phase: Fetch Ideas from pool
 *
 * Gets pending ideas from the idea directory for this run.
 * Returns up to batch_size ideas.
 */
export function orchestrateFetchIdeas(
  repoRoot: string,
  name: string,
  onProgress?: (message: string) => void
): OrchestrationResult {
  const debug = createDebugLogger("fetchIdeas");

  const state = readState(repoRoot, name);
  if (!state) {
    return { success: false, phase: "fetch_ideas", error: `Evo run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, phase: "fetch_ideas", error: parseResult.error };
  }

  const config = parseResult.config;

  // Determine ideas directory
  const ideasDir = config.idea.session_dir
    ? resolve(repoRoot, config.idea.session_dir)
    : join(repoRoot, ".viben", "ideas", name);

  // Get all ideas from the session directory
  const allIdeas = getAllIdeasFromSession(ideasDir);

  // Filter for draft ideas only
  const draftIdeas = allIdeas.filter(idea => idea.status === "draft");

  // Take up to batch_size ideas
  const ideas = draftIdeas.slice(0, config.idea.batch_size);

  debug(`Found ${ideas.length} draft ideas (batch_size: ${config.idea.batch_size})`);
  onProgress?.(`Found ${ideas.length} pending ideas`);

  return {
    success: true,
    phase: "fetch_ideas",
    data: {
      ideas,
      ideasDir,
      hasMore: draftIdeas.length > config.idea.batch_size,
      autoGenerate: config.idea.auto_generate,
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
 * @param name - Evo run name
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
    return { success: false, phase: "promote_ideas", error: `Evo run not found: ${name}` };
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
  const topIdeas = filteredIdeas.slice(0, config.idea.batch_size);
  debug("Selected ideas", topIdeas.map(i => ({ id: i.id, effort: i.estimatedEffort })));
  onProgress?.(`Selected top ${topIdeas.length} ideas for promotion`);

  // Store idea IDs in iteration state
  currentIter.ideas = topIdeas.map(idea => idea.id);

  // Promote each idea to a task (using promoteIdeaDirect to avoid disk lookup issues)
  const taskNames: string[] = [];
  const errors: string[] = [];

  for (const idea of topIdeas) {
    onProgress?.(`Promoting idea: ${idea.title}`);

    // Get Evo directory for reward config and output
    const evoDir = getEvoDir(repoRoot, name);

    const promoteOptions = {
      slug: idea.id,  // Use full idea id as slug for consistent naming
      worktree: config.rollout.worktree,
      executor: config.task.executor,
      model: config.task.model,
      start: true,  // Always auto-start tasks in Evo loop
      computeReward: true,
      evoDir,
    };

    // Use promoteIdeaDirect since we already have the Idea object in memory
    const result = promoteIdeaDirect(repoRoot, idea, promoteOptions);
    if (result.success && result.dir_name) {
      taskNames.push(result.dir_name);
      // Track which idea each task came from
      currentIter.task_idea_map[result.dir_name] = idea.id;
      debug(`Promoted ${idea.id} -> ${result.dir_name}`);
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
      debug(`Started ${taskName}`, { session_id: result.session_id });
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

    // Consider completed, review, failed, cancelled as terminal states for Evo purposes
    const isCompleted = status === "completed" || status === "review" || status === "failed" || status === "cancelled";
    if (!isCompleted) {
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
 * @param name - Evo run name (for locating reward.json)
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
  const evoDir = getEvoDir(repoRoot, name);

  for (const taskDirName of taskNames) {
    const viewResult = viewTask(repoRoot, taskDirName);
    if (!viewResult.success || !viewResult.task) {
      results[taskDirName] = { success: false, error: "Task not found" };
      continue;
    }

    // Get the actual task name used for reward output directory
    // Use taskDirName (the task directory name) since that's what the reward system uses
    const rewardDirName = taskDirName;

    // Get ideaId from task.json for correct path
    const ideaId = (viewResult.task as { evo_idea?: string }).evo_idea;

    // Check if reward already exists - first check Evo reward.json, then task.json
    let hasReward = false;

    // Check Evo reward.json at iter{N}/{ideaId}/{taskDirName}/reward.json
    const iterDir = join(evoDir, `iter${currentIteration}`);
    const rewardJsonPath = ideaId
      ? join(iterDir, ideaId, rewardDirName, "reward.json")
      : join(iterDir, rewardDirName, "reward.json");
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
      results[taskDirName] = { success: true };
      continue;
    }

    onProgress?.(`Computing reward for task: ${taskDirName}`);
    const rewardResult = computeReward(repoRoot, taskDirName, { verbose: false });
    results[taskDirName] = rewardResult.success
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
 * Updates the Evo state with the selection.
 *
 * @param repoRoot - Repository root path
 * @param name - Evo run name
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
    return { success: false, phase: "select_best", error: `Evo run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, phase: "select_best", error: parseResult.error || "Failed to parse target file" };
  }

  const config = parseResult.config;
  const currentIter = state.iterations[state.iterations.length - 1];
  if (!currentIter) {
    return { success: false, phase: "select_best", error: "No active iteration found" };
  }

  // Gather rewards from tasks
  // Rewards stored at: iter{N}/{idea}/{task}/reward.json
  // Fallback: task.json reward field
  const taskRewards: Record<string, number> = {};
  const evoDir = getEvoDir(repoRoot, name);

  for (const taskDirName of currentIter.tasks) {
    // First read task.json to get the actual task name used for reward directory
    const viewResult = viewTask(repoRoot, taskDirName);
    if (!viewResult.success || !viewResult.task) {
      onProgress?.(`Warning: Task ${taskDirName} not found`);
      continue;
    }

    // Get the ideaId and use taskDirName for reward directory
    // Use taskDirName (the task directory name) since that's what the reward system uses
    const rewardDirName = taskDirName;
    const ideaId = currentIter.task_idea_map[taskDirName];

    // Try location: iter{N}/{idea}/{task}/reward.json
    const iterDir = join(evoDir, `iter${state.current_iteration}`);
    const rewardJsonPath = ideaId
      ? join(iterDir, ideaId, rewardDirName, "reward.json")
      : join(iterDir, rewardDirName, "reward.json"); // Fallback if no ideaId

    try {
      const rewardContent = readFileSync(rewardJsonPath, "utf-8");
      const rewardData = JSON.parse(rewardContent) as { total_score?: number };
      if (typeof rewardData.total_score === "number") {
        taskRewards[taskDirName] = rewardData.total_score;
        onProgress?.(`Task ${taskDirName}: reward = ${rewardData.total_score.toFixed(3)}`);
      }
    } catch {
      // Reward not found at iter{N}/{idea}/{task}/reward.json
      onProgress?.(`Task ${taskDirName}: no reward.json found`);
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
 * @param name - Evo run name
 * @param selectedTask - The winning task name
 * @param rejectedTasks - Array of rejected task names
 * @param onProgress - Optional progress callback
 */
export async function orchestrateMergeAndCleanup(
  repoRoot: string,
  name: string,
  selectedTask: string | undefined,
  rejectedTasks: string[],
  onProgress?: (message: string) => void
): Promise<OrchestrationResult> {
  const debug = createDebugLogger("mergeAndCleanup");

  const results: {
    merged?: { success: boolean; error?: string };
    cleanedUp: Array<{ task: string; success: boolean; error?: string }>;
    dismissedIdeas: string[];
  } = { cleanedUp: [], dismissedIdeas: [] };

  // Get current iteration to access task_idea_map
  const state = readState(repoRoot, name);
  if (!state) {
    return { success: false, phase: "merge_and_cleanup", error: `Evo run not found: ${name}` };
  }

  const currentIter = state.iterations[state.iterations.length - 1];
  const taskIdeaMap = currentIter?.task_idea_map || {};

  // Track which ideas should be dismissed (loser ideas)
  const loserIdeaIds = new Set<string>();
  const winnerIdeaId = selectedTask ? taskIdeaMap[selectedTask] : undefined;

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
      // Don't dismiss winner idea on merge failure - allow retry
    }
  }

  // Cleanup rejected tasks and collect loser idea IDs
  for (const taskName of rejectedTasks) {
    const ideaId = taskIdeaMap[taskName];
    if (ideaId && ideaId !== winnerIdeaId) {
      loserIdeaIds.add(ideaId);
    }

    cancelTask(repoRoot, taskName, {
      reason: `Rejected in Evo iteration for run "${name}"`,
      force: true,
    });

    // Get task info to find branch for worktree cleanup
    const taskInfo = viewTask(repoRoot, taskName);
    if (taskInfo.success && taskInfo.task?.branch) {
      onProgress?.(`Cleaning up worktree for rejected task: ${taskName}`);
      // cleanupWorktree removes worktree, branch, and archives task
      const cleanupResult = await cleanupWorktree(repoRoot, taskInfo.task.branch, {
        keepBranch: false,
      });
      results.cleanedUp.push({
        task: taskName,
        success: cleanupResult.success,
        error: cleanupResult.error,
      });
    } else {
      // No branch found, just archive the task
      const archiveResult = archiveTask(repoRoot, taskName);
      results.cleanedUp.push({
        task: taskName,
        success: archiveResult.success,
        error: archiveResult.error,
      });
    }
  }

  // Dismiss loser ideas
  for (const ideaId of Array.from(loserIdeaIds)) {
    onProgress?.(`Dismissing loser idea: ${ideaId}`);
    const dismissResult = dismissIdea(repoRoot, ideaId);
    if (dismissResult.success) {
      results.dismissedIdeas.push(ideaId);
    } else {
      debug(`Failed to dismiss idea ${ideaId}`, { error: dismissResult.error });
    }
  }

  debug("Complete", {
    merged: results.merged?.success,
    cleanedUp: results.cleanedUp.length,
    dismissedIdeas: results.dismissedIdeas.length,
  });
  return { success: true, phase: "merge_and_cleanup", data: results };
}

/**
 * Check if any agent process for a task is still running
 *
 * A task may have multiple agents (start-xxx, plan-xxx, implement-xxx, etc.).
 * We consider the task as "healthy" if ANY of its agents is still running.
 *
 * @param repoRoot - Repository root path
 * @param taskName - Task name to check
 * @returns Object with running status and agent info
 */
function checkAgentHealth(
  repoRoot: string,
  taskName: string
): { running: boolean; pid?: number; agentCount: number } {
  // Read registry directly to find ALL agents for this task
  const registry = readRegistry(repoRoot);
  if (!registry) {
    return { running: false, agentCount: 0 };
  }

  // Find all agents whose task_dir contains the task name
  const taskAgents = registry.agents.filter(agent =>
    agent.task_dir.includes(taskName)
  );

  if (taskAgents.length === 0) {
    return { running: false, agentCount: 0 };
  }

  // Check if ANY agent for this task is still running
  for (const agent of taskAgents) {
    if (isProcessRunning(agent.pid)) {
      return { running: true, pid: agent.pid, agentCount: taskAgents.length };
    }
  }

  // All agents are dead - return the most recent one's PID for logging
  const lastAgent = taskAgents[taskAgents.length - 1];
  return {
    running: false,
    pid: lastAgent.pid,
    agentCount: taskAgents.length,
  };
}

/**
 * Wait for all tasks to complete with polling
 *
 * Also monitors agent process health and restarts stuck/dead agents.
 *
 * @param repoRoot - Repository root path
 * @param name - Evo run name (for updating state on failure)
 * @param taskNames - Task names to wait for
 * @param options - Wait options
 * @param onProgress - Optional progress callback
 */
export async function waitForTasksCompletion(
  repoRoot: string,
  name: string,
  taskNames: string[],
  options: {
    pollInterval?: number;
    maxWaitTime?: number;
    maxRestartAttempts?: number;
  } = {},
  onProgress?: (message: string) => void
): Promise<OrchestrationResult> {
  const debug = createDebugLogger("waitForTasks");
  const pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;
  const maxWaitTime = options.maxWaitTime || DEFAULT_MAX_WAIT_TIME;
  const maxRestartAttempts = options.maxRestartAttempts || 3;
  const startTime = Date.now();

  // Track restart attempts per task
  const restartAttempts: Record<string, number> = {};
  const failedTasks: string[] = [];
  for (const taskName of taskNames) {
    restartAttempts[taskName] = 0;
  }

  while (true) {
    const statusResult = orchestrateCheckTasksStatus(repoRoot, taskNames);
    const statusData = statusResult.data as {
      allCompleted: boolean;
      completedCount: number;
      totalCount: number;
      statuses: Record<string, { status: string }>;
    };

    // Check for stuck/dead agents and restart them
    const stuckTasks: string[] = [];
    for (const taskName of taskNames) {
      const taskStatus = statusData.statuses[taskName]?.status;

      // Only check in_progress tasks that haven't permanently failed
      if (taskStatus === "in_progress" && !failedTasks.includes(taskName)) {
        const health = checkAgentHealth(repoRoot, taskName);

        if (!health.running) {
          // Agent process is dead but task is still in_progress
          debug(`Task ${taskName} has dead agent (PID: ${health.pid})`);

          if (restartAttempts[taskName] < maxRestartAttempts) {
            stuckTasks.push(taskName);
            restartAttempts[taskName]++;
            onProgress?.(`Agent for ${taskName} died, restarting (attempt ${restartAttempts[taskName]}/${maxRestartAttempts})`);
          } else if (!failedTasks.includes(taskName)) {
            failedTasks.push(taskName);
            onProgress?.(`Agent for ${taskName} failed after ${maxRestartAttempts} restart attempts`);
          }
        }
      }
    }

    // Restart stuck tasks
    if (stuckTasks.length > 0) {
      debug(`Restarting ${stuckTasks.length} stuck tasks`);
      const restartResult = await orchestrateStartTasks(repoRoot, stuckTasks, onProgress);
      if (!restartResult.success) {
        debug("Failed to restart some tasks", { error: restartResult.error });
      }
    }

    onProgress?.(`Task status: ${statusData.completedCount}/${statusData.totalCount} completed`);

    // Check if all tasks are either completed or permanently failed
    const nonFailedTasks = taskNames.filter(t => !failedTasks.includes(t));
    const nonFailedCompleted = nonFailedTasks.every(t => {
      const status = statusData.statuses[t]?.status;
      return status === "completed" || status === "review" || status === "failed" || status === "cancelled";
    });

    if (statusData.allCompleted || (nonFailedCompleted && failedTasks.length > 0)) {
      debug("All tasks completed or failed", { failedTasks });

      // Clean up dead agents from registry to prevent stale entries
      const cleanupResult = cleanupDeadAgents(repoRoot);
      if (cleanupResult.removedCount > 0) {
        debug(`Cleaned up ${cleanupResult.removedCount} dead agents from registry`, {
          removedIds: cleanupResult.removedIds,
        });
        onProgress?.(`Cleaned up ${cleanupResult.removedCount} stale agent entries`);
      }

      // If some tasks failed permanently, record in state
      if (failedTasks.length > 0) {
        const state = readState(repoRoot, name);
        if (state) {
          const currentIter = state.iterations[state.iterations.length - 1];
          if (currentIter) {
            currentIter.failed_tasks = failedTasks;
            writeState(repoRoot, state);
          }
        }
      }

      return {
        success: true,
        phase: "wait_complete",
        data: { ...statusData, failedTasks },
      };
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= maxWaitTime) {
      debug("Timeout", { elapsed: Math.round(elapsed / 60000), failedTasks });

      // Update state with timeout information
      const state = readState(repoRoot, name);
      if (state) {
        const currentIter = state.iterations[state.iterations.length - 1];
        if (currentIter) {
          currentIter.stop_reason = `Timeout after ${Math.round(elapsed / 60000)} minutes`;
          currentIter.failed_tasks = failedTasks;
        }
        state.stop_reason = `wait_tasks_timeout: ${Math.round(elapsed / 60000)} minutes`;
        state.active = false;
        writeState(repoRoot, state);
      }

      return {
        success: false,
        phase: "wait_timeout",
        error: `Timeout after ${Math.round(elapsed / 60000)} minutes`,
        data: { ...statusData, failedTasks },
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
 * Run a complete Evo iteration (single iteration, no loop)
 *
 * Uses a state machine pattern to track progress through phases.
 * On resume, picks up from the last completed phase.
 *
 * Phases:
 *   init -> generate_ideas -> promote_ideas -> execute_tasks ->
 *   wait_tasks -> compute_rewards -> select_best -> merge_cleanup -> completed
 *
 * @param repoRoot - Repository root path
 * @param name - Evo run name
 * @param onProgress - Optional progress callback
 */
export async function orchestrateFullIteration(
  repoRoot: string,
  name: string,
  onProgress?: (message: string) => void
): Promise<OrchestrationResult> {
  const debug = createDebugLogger("fullIteration");
  const evoDir = getEvoDir(repoRoot, name);

  // Initialize or resume iteration
  const initResult = runIteration(repoRoot, name);
  if (!initResult.success) {
    return { success: false, phase: "init", error: initResult.error };
  }

  if (initResult.state?.converged) {
    return { success: true, phase: "converged", data: { converged: true } };
  }

  // Load state and config
  let state = readState(repoRoot, name);
  if (!state) {
    return { success: false, phase: "init", error: `Evo run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, phase: "init", error: parseResult.error || "Failed to parse target file" };
  }

  const config = parseResult.config;
  const currentIter = state.iterations[state.iterations.length - 1];
  const iterNum = currentIter?.iteration || 1;
  const currentPhase = getCurrentPhase(state) || "init";

  debug(`Iteration ${iterNum}, current phase: ${currentPhase}`);
  onProgress?.(`[${iterNum}] Current phase: ${currentPhase}`);

  // State machine: determine which phases to run based on current phase
  let tasks: string[] = currentIter?.tasks || [];
  let ideas: Idea[] = [];

  // ==========================================================================
  // Phase 1: Generate Ideas (skip if phase > generate_ideas)
  // ==========================================================================
  if (shouldRunPhase(currentPhase, "generate_ideas")) {
    // Check if we already have ideas
    if (currentIter?.ideas.length > 0) {
      onProgress?.(`[${iterNum}] Phase 1 - Skipped (${currentIter.ideas.length} ideas exist)`);
      const ideaResult = listIdeas(repoRoot, { status: "draft" });
      ideas = ideaResult.ideas.filter(i => currentIter.ideas.includes(i.id));
    } else {
      // Check for existing draft ideas on disk
      const existingIdeasResult = listIdeas(repoRoot, { status: "draft" });
      const batchSize = config.idea.batch_size;

      // Only skip generation if we have enough draft ideas (>= batch_size)
      // If we have fewer, we need to generate more to ensure batch_size ideas are available
      if (existingIdeasResult.ideas.length >= batchSize) {
        ideas = existingIdeasResult.ideas;
        onProgress?.(`[${iterNum}] Phase 1 - Found ${ideas.length} existing draft ideas (>= batch_size ${batchSize})`);
      } else {
        if (existingIdeasResult.ideas.length > 0) {
          onProgress?.(`[${iterNum}] Phase 1 - Found ${existingIdeasResult.ideas.length} draft ideas (< batch_size ${batchSize}), generating more`);
        } else {
          onProgress?.(`[${iterNum}] Phase 1 - Generate Ideas`);
        }
        updateIterationPhase(state, "generate_ideas");
        writeState(repoRoot, state);

        const generateResult = await orchestrateGenerateIdeas(repoRoot, name, onProgress);
        if (!generateResult.success) {
          return generateResult;
        }
        const generateData = generateResult.data as { ideas: Idea[]; sessionDir?: string };
        // Combine existing draft ideas with newly generated ones
        const existingDraftIdeas = existingIdeasResult.ideas;
        ideas = [...existingDraftIdeas, ...generateData.ideas];
      }
    }

    // Update state after generating ideas
    state = readState(repoRoot, name);
    if (!state) {
      return { success: false, phase: "generate_ideas", error: "State lost after generating ideas" };
    }
  }

  // ==========================================================================
  // Phase 2: Promote Ideas to Tasks (skip if phase > promote_ideas)
  // ==========================================================================
  if (shouldRunPhase(currentPhase, "promote_ideas") && tasks.length === 0) {
    // Load ideas if not already loaded
    if (ideas.length === 0 && currentIter?.ideas.length > 0) {
      const ideaResult = listIdeas(repoRoot, { status: "draft" });
      ideas = ideaResult.ideas.filter(i => currentIter.ideas.includes(i.id));
    }

    if (ideas.length === 0) {
      onProgress?.(`[${iterNum}] Phase 2 - Skipped (no ideas)`);
    } else {
      // Apply effort filter
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

      onProgress?.(`[${iterNum}] Phase 2 - Promote Ideas`);
      updateIterationPhase(state, "promote_ideas");
      writeState(repoRoot, state);

      const promoteResult = orchestratePromoteIdeas(repoRoot, name, ideas, onProgress);
      if (!promoteResult.success) {
        dismissFilteredIdeas(repoRoot, ideas, onProgress);
        return promoteResult;
      }

      tasks = (promoteResult.data as { tasks: string[] }).tasks;
      debug(`Created ${tasks.length} tasks`);
    }

    state = readState(repoRoot, name);
    if (!state) {
      return { success: false, phase: "promote_ideas", error: "State lost after promoting ideas" };
    }
  }

  // ==========================================================================
  // Phase 2.5: Execute Tasks (skip if phase > execute_tasks)
  // ==========================================================================
  if (shouldRunPhase(currentPhase, "execute_tasks") && tasks.length > 0) {
    const statusResult = orchestrateCheckTasksStatus(repoRoot, tasks);
    const statusData = statusResult.data as {
      statuses: Record<string, { status: string }>;
      allCompleted: boolean;
    };

    // Find tasks that haven't started yet
    const notStarted = tasks.filter(t => {
      const s = statusData.statuses[t]?.status;
      return s === "backlog" || s === "queue";
    });

    if (notStarted.length > 0) {
      onProgress?.(`[${iterNum}] Phase 2.5 - Starting ${notStarted.length} task executors`);
      updateIterationPhase(state, "execute_tasks");
      writeState(repoRoot, state);

      const startResult = await orchestrateStartTasks(repoRoot, notStarted, onProgress);
      if (!startResult.success) {
        return startResult;
      }
    } else {
      onProgress?.(`[${iterNum}] Phase 2.5 - Skipped (all tasks already started)`);
    }

    state = readState(repoRoot, name);
    if (!state) {
      return { success: false, phase: "execute_tasks", error: "State lost after starting tasks" };
    }
  }

  // ==========================================================================
  // Phase 3: Wait for Tasks (skip if phase > wait_tasks)
  // ==========================================================================
  if (shouldRunPhase(currentPhase, "wait_tasks") && tasks.length > 0) {
    const statusResult = orchestrateCheckTasksStatus(repoRoot, tasks);
    const statusData = statusResult.data as { allCompleted: boolean; completedCount: number };

    if (statusData.allCompleted) {
      onProgress?.(`[${iterNum}] Phase 3 - Skipped (all ${tasks.length} tasks completed)`);
    } else {
      onProgress?.(`[${iterNum}] Phase 3 - Waiting for tasks`);
      updateIterationPhase(state, "wait_tasks");
      writeState(repoRoot, state);

      const waitResult = await waitForTasksCompletion(repoRoot, name, tasks, {}, onProgress);
      if (!waitResult.success) {
        return waitResult;
      }
    }

    state = readState(repoRoot, name);
    if (!state) {
      return { success: false, phase: "wait_tasks", error: "State lost after waiting for tasks" };
    }
  }

  // ==========================================================================
  // Phase 4: Compute Rewards (skip if phase > compute_rewards)
  // ==========================================================================
  if (shouldRunPhase(currentPhase, "compute_rewards") && tasks.length > 0) {
    // Check if all rewards already computed
    const allRewardsComputed = checkAllRewardsComputed(repoRoot, evoDir, iterNum, tasks);

    if (allRewardsComputed) {
      onProgress?.(`[${iterNum}] Phase 4 - Skipped (all rewards computed)`);
    } else {
      onProgress?.(`[${iterNum}] Phase 4 - Computing rewards`);
      updateIterationPhase(state, "compute_rewards");
      writeState(repoRoot, state);

      orchestrateComputeRewards(repoRoot, name, tasks, iterNum, onProgress);
    }

    state = readState(repoRoot, name);
    if (!state) {
      return { success: false, phase: "compute_rewards", error: "State lost after computing rewards" };
    }
  }

  // ==========================================================================
  // Phase 5: Select Best Task (skip if phase > select_best)
  // ==========================================================================
  if (shouldRunPhase(currentPhase, "select_best")) {
    // Check if already selected
    const updatedIter = state.iterations[state.iterations.length - 1];
    if (updatedIter?.selected_task) {
      onProgress?.(`[${iterNum}] Phase 5 - Skipped (already selected: ${updatedIter.selected_task})`);
    } else {
      onProgress?.(`[${iterNum}] Phase 5 - Selecting best task`);
      updateIterationPhase(state, "select_best");
      writeState(repoRoot, state);

      const selectResult = orchestrateSelectBest(repoRoot, name, onProgress);
      if (!selectResult.success) {
        return selectResult;
      }
    }

    state = readState(repoRoot, name);
    if (!state) {
      return { success: false, phase: "select_best", error: "State lost after selecting best" };
    }
  }

  // ==========================================================================
  // Phase 6: Merge and Cleanup (skip if phase is already completed)
  // ==========================================================================
  if (shouldRunPhase(currentPhase, "merge_cleanup")) {
    const finalIter = state.iterations[state.iterations.length - 1];
    const selectedTask = finalIter?.selected_task;
    const rejectedTasks = finalIter?.rejected_tasks || [];

    // Check phase instead of completed flag
    const iterPhase = finalIter?.phase || "init";
    if (iterPhase === "completed") {
      onProgress?.(`[${iterNum}] Phase 6 - Skipped (phase already completed)`);
    } else {
      onProgress?.(`[${iterNum}] Phase 6 - Merging and cleanup`);
      updateIterationPhase(state, "merge_cleanup");
      writeState(repoRoot, state);

      const mergeResult = await orchestrateMergeAndCleanup(repoRoot, name, selectedTask, rejectedTasks, onProgress);

      // Now mark the iteration as completed
      state = readState(repoRoot, name);
      if (state) {
        const parseRes = parseTarget(state.target_path, repoRoot);
        const cfg = parseRes.config;
        const iter = state.iterations[state.iterations.length - 1];

        // Extract merge error if merge failed
        const mergeData = mergeResult.data as { merged?: { success: boolean; error?: string } } | undefined;
        const mergeError = mergeData?.merged && !mergeData.merged.success
          ? mergeData.merged.error
          : undefined;

        completeIteration(
          state,
          iter?.selected_task,
          iter?.rejected_tasks || [],
          iter?.rewards || {},
          mergeError
        );

        if (cfg && checkConvergence(state, cfg.convergence.threshold, cfg.convergence.no_merge_limit)) {
          markConverged(state);
        }

        writeState(repoRoot, state);
      }
    }

    state = readState(repoRoot, name);
    if (!state) {
      return { success: false, phase: "merge_cleanup", error: "State lost after merge and cleanup" };
    }
  }

  // ==========================================================================
  // Complete
  // ==========================================================================
  const finalState = readState(repoRoot, name);
  const converged = finalState?.converged ?? false;
  const finalIter = finalState?.iterations[finalState.iterations.length - 1];

  debug(`Iteration ${iterNum} complete`, { selected: finalIter?.selected_task, converged });
  return {
    success: true,
    phase: "iteration_complete",
    data: {
      iteration: iterNum,
      selected: finalIter?.selected_task,
      converged,
    },
  };
}

/**
 * Check if a phase should run based on current phase
 *
 * Phase order: init -> generate_ideas -> promote_ideas -> execute_tasks ->
 *              wait_tasks -> compute_rewards -> select_best -> merge_cleanup -> completed
 */
function shouldRunPhase(currentPhase: string, targetPhase: string): boolean {
  const phaseOrder = [
    "init",
    "generate_ideas",
    "promote_ideas",
    "execute_tasks",
    "wait_tasks",
    "compute_rewards",
    "select_best",
    "merge_cleanup",
    "completed",
  ];

  const currentIndex = phaseOrder.indexOf(currentPhase);
  const targetIndex = phaseOrder.indexOf(targetPhase);

  // Run if current phase is at or before target phase
  return currentIndex <= targetIndex;
}

/**
 * Check if all rewards are computed for tasks in this iteration
 *
 * Note: The reward output directory uses taskData.name (e.g., "evo-ramsey_graph-i1-xxx")
 * while the task directory name may have a date prefix (e.g., "03-20-evo-ramsey_graph-i1-xxx").
 * We need to read task.json to get the actual taskName used for the reward directory.
 */
function checkAllRewardsComputed(
  repoRoot: string,
  evoDir: string,
  iteration: number,
  tasks: string[]
): boolean {
  const iterDir = join(evoDir, `iter${iteration}`);

  for (const taskDirName of tasks) {
    // Use taskDirName directly as that's what the reward system uses for the directory
    const rewardJsonPath = join(iterDir, taskDirName, "reward.json");
    try {
      const content = readFileSync(rewardJsonPath, "utf-8");
      const data = JSON.parse(content) as { total?: number };
      if (typeof data.total !== "number") {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Run the full Evo loop until convergence or max iterations
 *
 * This is the main entry point for running Evo automatically.
 * It handles:
 * - Multiple iterations until convergence
 * - Regeneration when all ideas are filtered out
 * - Automatic waiting for task completion
 * - Cleanup of rejected tasks
 *
 * @param repoRoot - Repository root path
 * @param name - Evo run name
 * @param onProgress - Optional progress callback
 */
export async function runEvoLoop(
  repoRoot: string,
  name: string,
  onProgress?: (message: string) => void
): Promise<OrchestrationResult> {
  const debug = createDebugLogger("loop");

  const state = readState(repoRoot, name);
  if (!state) {
    return { success: false, phase: "init", error: `Evo run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, phase: "init", error: parseResult.error || "Failed to parse target file" };
  }

  const config = parseResult.config;
  const maxIterations = config.convergence.max_iterations;
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
