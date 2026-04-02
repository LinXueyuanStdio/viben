/**
 * Evo State Management
 *
 * Manages the persistent state of Evo runs.
 * State is stored in .viben/evo/<name>/state.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type {
  EvoState,
  IterationState,
  IterationPhase,
  ListRunsResult,
  StatusResult,
} from "./types";

// =============================================================================
// Constants
// =============================================================================

/** Evo state directory relative to .viben */
const EVO_DIR = "evo";

/** State file name */
const STATE_FILE = "state.json";

// =============================================================================
// Path Utilities
// =============================================================================

/**
 * Get the Evo directory for a run
 */
export function getEvoDir(repoRoot: string, name: string): string {
  return join(repoRoot, ".viben", EVO_DIR, name);
}

/**
 * Get the state file path for a run
 */
export function getStatePath(repoRoot: string, name: string): string {
  return join(getEvoDir(repoRoot, name), STATE_FILE);
}

/**
 * Ensure the Evo directory exists
 */
export function ensureEvoDir(repoRoot: string, name: string): string {
  const dir = getEvoDir(repoRoot, name);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// =============================================================================
// State Operations
// =============================================================================

/**
 * Create initial state for a new Evo run
 */
export function createInitialState(name: string, targetPath: string): EvoState {
  const now = new Date().toISOString();

  return {
    name,
    target_path: targetPath,
    current_iteration: 0,
    completed_iterations: 0,
    iterations: [],
    best_reward: 0,
    best_task: undefined,
    no_merge_count: 0,
    converged: false,
    active: false,
    started_at: now,
    updated_at: now,
  };
}

/**
 * Create a new iteration state
 */
export function createIterationState(iteration: number): IterationState {
  return {
    iteration,
    phase: "init",
    ideas: [],
    tasks: [],
    task_idea_map: {},
    rewards: {},
    selected_task: undefined,
    rejected_tasks: [],
    merge_error: undefined,
    completed: false,
    started_at: new Date().toISOString(),
    completed_at: undefined,
  };
}

/**
 * Read Evo state from disk
 */
export function readState(repoRoot: string, name: string): EvoState | null {
  const statePath = getStatePath(repoRoot, name);

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = readFileSync(statePath, "utf-8");
    return JSON.parse(content) as EvoState;
  } catch {
    return null;
  }
}

/**
 * Write Evo state to disk
 */
export function writeState(repoRoot: string, state: EvoState): void {
  ensureEvoDir(repoRoot, state.name);
  const statePath = getStatePath(repoRoot, state.name);

  state.updated_at = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Update state with new iteration
 */
export function startIteration(state: EvoState): IterationState {
  const newIteration = state.current_iteration + 1;
  const iterationState = createIterationState(newIteration);

  state.current_iteration = newIteration;
  state.iterations.push(iterationState);
  state.active = true;

  return iterationState;
}

/**
 * Update the phase of the current iteration
 */
export function updateIterationPhase(
  state: EvoState,
  phase: IterationPhase
): void {
  const currentIter = state.iterations[state.iterations.length - 1];
  if (!currentIter) {
    return;
  }
  currentIter.phase = phase;
  state.updated_at = new Date().toISOString();
}

/**
 * Get the current iteration's phase
 */
export function getCurrentPhase(state: EvoState): IterationPhase | null {
  const currentIter = state.iterations[state.iterations.length - 1];
  if (!currentIter) {
    return null;
  }
  // Handle legacy state without phase field
  return currentIter.phase || "init";
}

/**
 * Complete the current iteration
 */
export function completeIteration(
  state: EvoState,
  selectedTask: string | undefined,
  rejectedTasks: string[],
  rewards: Record<string, number>,
  mergeError?: string
): void {
  const currentIter = state.iterations[state.iterations.length - 1];
  if (!currentIter) {
    return;
  }

  currentIter.selected_task = selectedTask;
  currentIter.rejected_tasks = rejectedTasks;
  currentIter.rewards = rewards;
  currentIter.merge_error = mergeError;
  currentIter.completed = true;
  currentIter.phase = "completed";
  currentIter.completed_at = new Date().toISOString();

  state.completed_iterations++;

  // Update no_merge_count
  if (selectedTask && !mergeError) {
    state.no_merge_count = 0;

    // Update best reward tracking
    const reward = rewards[selectedTask];
    if (reward !== undefined && reward > state.best_reward) {
      state.best_reward = reward;
      state.best_task = selectedTask;
    }
  } else {
    state.no_merge_count++;
  }
}

/**
 * Check if the run has converged
 *
 * Convergence criteria:
 * - No-merge limit reached
 * - At least 2 completed iterations and reward improvement < threshold
 */
export function checkConvergence(
  state: EvoState,
  convergenceThreshold: number,
  noMergeLimit: number
): boolean {
  // Check no-merge limit
  if (state.no_merge_count >= noMergeLimit) {
    return true;
  }

  // Check reward convergence (need at least 2 iterations)
  if (state.completed_iterations < 2) {
    return false;
  }

  const lastTwo = state.iterations.slice(-2);
  if (lastTwo.length < 2) {
    return false;
  }

  const [prev, current] = lastTwo;

  // Get best rewards from each iteration
  const prevBest = Math.max(...Object.values(prev.rewards), 0);
  const currentBest = Math.max(...Object.values(current.rewards), 0);

  // Check if improvement is below threshold
  const improvement = currentBest - prevBest;
  return improvement < convergenceThreshold;
}

/**
 * Mark the run as converged
 */
export function markConverged(state: EvoState): void {
  state.converged = true;
  state.active = false;
}

/**
 * Stop an active run
 */
export function stopRun(state: EvoState): void {
  state.active = false;

  // Mark current iteration as incomplete if not finished
  const currentIter = state.iterations[state.iterations.length - 1];
  if (currentIter && !currentIter.completed) {
    currentIter.completed_at = new Date().toISOString();
  }
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * List all Evo runs
 */
export function listRuns(repoRoot: string): ListRunsResult {
  const evoBaseDir = join(repoRoot, ".viben", EVO_DIR);

  if (!existsSync(evoBaseDir)) {
    return { success: true, runs: [] };
  }

  try {
    const dirs = readdirSync(evoBaseDir, { withFileTypes: true });
    const runs: ListRunsResult["runs"] = [];

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;

      const state = readState(repoRoot, dir.name);
      if (state) {
        runs.push({
          name: state.name,
          target_path: state.target_path,
          current_iteration: state.current_iteration,
          best_reward: state.best_reward,
          active: state.active,
          converged: state.converged,
        });
      }
    }

    // Sort by updated_at descending (most recent first)
    runs.sort((a, b) => {
      const stateA = readState(repoRoot, a.name);
      const stateB = readState(repoRoot, b.name);
      if (!stateA || !stateB) return 0;
      return stateB.updated_at.localeCompare(stateA.updated_at);
    });

    return { success: true, runs };
  } catch (error) {
    return {
      success: false,
      runs: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get status of a specific run
 */
export function getStatus(repoRoot: string, name: string): StatusResult {
  const state = readState(repoRoot, name);

  if (!state) {
    return {
      success: false,
      error: `Evo run not found: ${name}`,
    };
  }

  return {
    success: true,
    state,
  };
}

/**
 * Check if a run exists
 */
export function runExists(repoRoot: string, name: string): boolean {
  const statePath = getStatePath(repoRoot, name);
  return existsSync(statePath);
}

/**
 * Check if a run is active
 */
export function isRunActive(repoRoot: string, name: string): boolean {
  const state = readState(repoRoot, name);
  return state?.active ?? false;
}
