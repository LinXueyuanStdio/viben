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
  /** KL penalty coefficient (default: 0.05) */
  kl_coef: number;

  /** Minimum adjusted reward threshold (default: 0.6) */
  threshold: number;

  /** Maximum diff lines for KL normalization (default: 500) */
  max_diff: number;

  /** Number of parallel variations to generate (default: 3) */
  parallel_count: number;

  /** Maximum iterations before stopping (default: 10) */
  max_iterations: number;

  /** Convergence threshold for early stopping (default: 0.01) */
  convergence_threshold: number;
}

/**
 * Idea generation configuration
 */
export interface IdeaConfig {
  /** Idea types to generate */
  types: string[];

  /** Maximum ideas per type (default: 5) */
  max_ideas: number;

  /** Filter by effort level */
  effort_filter?: string[];

  /** Auto-promote top N ideas to tasks (default: 3) */
  auto_promote_count: number;
}

/**
 * Task execution configuration
 */
export interface TaskConfig {
  /** Use git worktree for isolation (default: true) */
  worktree: boolean;

  /** Executor type (default: CLAUDE_CODE) */
  executor: string;

  /** Model to use for task execution */
  model?: string;

  /** Auto-start tasks after creation (default: true) */
  auto_start: boolean;
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
  threshold: 0.6,
  max_diff: 500,
  parallel_count: 3,
  max_iterations: 10,
  convergence_threshold: 0.01,
};

/**
 * Default idea configuration
 */
export const DEFAULT_IDEA_CONFIG: IdeaConfig = {
  types: ["code_improvements"],
  max_ideas: 5,
  auto_promote_count: 3,
};

/**
 * Default task configuration
 */
export const DEFAULT_TASK_CONFIG: TaskConfig = {
  worktree: true,
  executor: "CLAUDE_CODE",
  auto_start: true,
};


// =============================================================================
// FileRL Iteration State
// =============================================================================

/**
 * State of a single FileRL iteration
 */
export interface IterationState {
  /** Iteration number (1-based) */
  iteration: number;

  /** Ideas generated in this iteration */
  ideas: string[];

  /** Tasks created from ideas */
  tasks: string[];

  /** Task rewards (task name -> reward score) */
  rewards: Record<string, number>;

  /** Selected task (winner) */
  selected_task?: string;

  /** Rejected tasks */
  rejected_tasks: string[];

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
