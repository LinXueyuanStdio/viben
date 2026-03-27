/**
 * FileRL Types
 *
 * Type definitions for the FileRL module.
 * FileRL treats codebase as "model parameters" and uses PPO algorithm
 * to iteratively optimize code quality.
 *
 * Based on docs/plans/2026-03-17-filerl-commands-design.md
 */

import type { RewardConfig } from "../../reward/ops/types";

// Re-export DEFAULT_REWARD_CONFIG from reward module
export { DEFAULT_REWARD_CONFIG } from "../../reward/ops/types";

// =============================================================================
// FileRL Target Configuration (YAML Header)
// =============================================================================

/**
 * PPO algorithm configuration
 */
export interface PpoConfig {
  /** KL penalty coefficient λ (default: 0.05) */
  kl_coef: number;

  /** Change sensitivity β for weight calculation (default: 2.0) */
  change_sensitivity: number;

  /** Clip range ε for weight clipping (default: 0.2) */
  clip_range: number;

  /** Quality threshold τ - minimum adjusted reward (default: 0.6) */
  quality_threshold: number;

  /** Maximum diff lines for normalization (default: 500) */
  max_diff: number;
}

/**
 * Idea generation configuration
 */
export interface IdeaConfig {
  /** Whether to auto-generate ideas when pool is empty (default: false) */
  auto_generate: boolean;

  /** Idea types to generate */
  types: string[];

  /** Maximum ideas per type (default: 5) */
  max_ideas: number;

  /** Number of ideas to process per iteration - batch size B (default: 3) */
  batch_size: number;

  /** Filter by effort level */
  effort_filter?: string[];

  /** Custom session directory for ideas (default: .viben/ideas/<name>) */
  session_dir?: string;
}

/**
 * Rollout configuration
 */
export interface RolloutConfig {
  /** Number of rollouts per idea (default: 1) */
  n: number;

  /** Use git worktree for isolation (default: true) */
  worktree: boolean;
}

/**
 * Convergence configuration
 */
export interface ConvergenceConfig {
  /** Convergence threshold δ (default: 0.01) */
  threshold: number;

  /** Maximum iterations before stopping (default: 50) */
  max_iterations: number;

  /** Consecutive no-merge iterations before early stop (default: 5) */
  no_merge_limit: number;
}

/**
 * Task execution configuration
 */
export interface TaskConfig {
  /** Executor type (default: CLAUDE_CODE) */
  executor: string;

  /** Model to use for task execution */
  model?: string;
}

/**
 * Complete FileRL target configuration
 *
 * This is parsed from the YAML header of the target markdown file.
 */
export interface FileRlConfig {
  /** Target name/identifier */
  name: string;

  /** Human-readable description */
  description?: string;

  /** PPO algorithm configuration */
  ppo: PpoConfig;

  /** Rollout configuration */
  rollout: RolloutConfig;

  /** Convergence configuration */
  convergence: ConvergenceConfig;

  /** Reward configuration for evaluation */
  reward: RewardConfig;

  /** Idea generation configuration */
  idea: IdeaConfig;

  /** Task execution configuration */
  task: TaskConfig;

  /** Whether the FileRL loop is enabled */
  enabled: boolean;

  /** Created timestamp */
  created_at?: string;

  /** Last updated timestamp */
  updated_at?: string;
}

/**
 * Default PPO configuration
 */
export const DEFAULT_PPO_CONFIG: PpoConfig = {
  kl_coef: 0.05,
  change_sensitivity: 2.0,
  clip_range: 0.2,
  quality_threshold: 0.6,
  max_diff: 500,
};

/**
 * Default idea configuration
 */
export const DEFAULT_IDEA_CONFIG: IdeaConfig = {
  auto_generate: false,
  types: ["code_improvements"],
  max_ideas: 5,
  batch_size: 3,
};

/**
 * Default rollout configuration
 */
export const DEFAULT_ROLLOUT_CONFIG: RolloutConfig = {
  n: 1,
  worktree: true,
};

/**
 * Default convergence configuration
 */
export const DEFAULT_CONVERGENCE_CONFIG: ConvergenceConfig = {
  threshold: 0.01,
  max_iterations: 50,
  no_merge_limit: 5,
};

/**
 * Default task configuration
 */
export const DEFAULT_TASK_CONFIG: TaskConfig = {
  executor: "CLAUDE_CODE",
  model: undefined,
};


// =============================================================================
// FileRL Iteration State
// =============================================================================

/**
 * Iteration phase - tracks progress through the FileRL pipeline
 *
 * Flow: init -> generate_ideas -> promote_ideas -> execute_tasks ->
 *       wait_tasks -> compute_rewards -> select_best -> merge_cleanup -> completed
 */
export type IterationPhase =
  | "init"              // Just started, no work done yet
  | "generate_ideas"    // Phase 1: Generating ideas
  | "promote_ideas"     // Phase 2: Promoting ideas to tasks
  | "execute_tasks"     // Phase 2.5: Starting task executors
  | "wait_tasks"        // Phase 3: Waiting for tasks to complete
  | "compute_rewards"   // Phase 4: Computing rewards
  | "select_best"       // Phase 5: Selecting best task
  | "merge_cleanup"     // Phase 6: Merging winner, cleaning up
  | "completed";        // Iteration finished

/**
 * State of a single FileRL iteration
 */
export interface IterationState {
  /** Iteration number (1-based) */
  iteration: number;

  /** Current phase of this iteration */
  phase: IterationPhase;

  /** Ideas generated in this iteration */
  ideas: string[];

  /** Tasks created from ideas */
  tasks: string[];

  /** Mapping from task name to idea name */
  task_idea_map: Record<string, string>;

  /** Task rewards (task name -> reward score) */
  rewards: Record<string, number>;

  /** Selected task (winner) */
  selected_task?: string;

  /** Rejected tasks */
  rejected_tasks: string[];

  /** Merge error if merge failed */
  merge_error?: string;

  /** Whether iteration is complete */
  completed: boolean;

  /** Timestamp when iteration started */
  started_at: string;

  /** Timestamp when iteration completed */
  completed_at?: string;
}

/**
 * FileRL run state (persisted in .viben/filerl/<name>/state.json)
 */
export interface FileRlState {
  /** Target name */
  name: string;

  /** Path to target file */
  target_path: string;

  /** Current iteration number */
  current_iteration: number;

  /** Total completed iterations */
  completed_iterations: number;

  /** Iteration history */
  iterations: IterationState[];

  /** Best reward achieved so far */
  best_reward: number;

  /** Best task name */
  best_task?: string;

  /** Consecutive iterations with no merge */
  no_merge_count: number;

  /** Whether the run is converged */
  converged: boolean;

  /** Whether the run is active */
  active: boolean;

  /** Run started timestamp */
  started_at: string;

  /** Last updated timestamp */
  updated_at: string;
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Result of parsing a FileRL target file
 */
export interface ParseTargetResult {
  success: boolean;
  config?: FileRlConfig;
  body?: string;
  error?: string;
}

/**
 * Result of running FileRL
 */
export interface RunResult {
  success: boolean;
  state?: FileRlState;
  message?: string;
  error?: string;
}

/**
 * Result of listing FileRL runs
 */
export interface ListRunsResult {
  success: boolean;
  runs: Array<{
    name: string;
    target_path: string;
    current_iteration: number;
    best_reward: number;
    active: boolean;
    converged: boolean;
  }>;
  error?: string;
}

/**
 * Result of viewing FileRL status
 */
export interface StatusResult {
  success: boolean;
  state?: FileRlState;
  config?: FileRlConfig;
  error?: string;
}

/**
 * Result of stopping FileRL
 */
export interface StopResult {
  success: boolean;
  message?: string;
  error?: string;
}
