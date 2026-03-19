/**
 * Reward Types
 *
 * Type definitions for the reward module.
 * Based on docs/plans/2026-03-17-filerl-commands-design.md
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Built-in reward types that are shipped with viben
 */
export const BUILTIN_REWARD_TYPES = [
  "test_coverage",
  "code_quality",
  "security_scan",
  "diff_penalty",
  "agent_review",
  "benchmark_comparison",
] as const;

/**
 * Type for built-in reward type names
 */
export type BuiltinRewardTypeName = (typeof BUILTIN_REWARD_TYPES)[number];

/**
 * Custom reward types directory (project-local)
 */
export const CUSTOM_REWARD_TYPES_DIR = "docs/reward-types";

// =============================================================================
// Reward Type (Prompt Template)
// =============================================================================

/**
 * Source of a reward type
 */
export type RewardTypeSource = "builtin" | "custom";

/**
 * Represents a reward type (prompt template)
 *
 * Reward types define how PR quality is evaluated. They can be:
 * - Built-in: shipped with viben in packages/core/src/prompts/reward-types/
 * - Custom: user-defined in docs/reward-types/
 */
export interface RewardType {
  /** Type identifier (e.g., "test_coverage") */
  name: string;

  /** Human-readable description of this type */
  description: string;

  /** Default weight when combining multiple reward types */
  weightDefault?: number;

  /** Whether this is a built-in or custom type */
  source: RewardTypeSource;

  /** Absolute path to the prompt template file */
  promptPath: string;
}

// =============================================================================
// Reward Score
// =============================================================================

/**
 * Score from a single reward type evaluation
 */
export interface RewardScore {
  /** Score value (0.0 - 1.0) */
  score: number;

  /** Explanation of the score */
  reasoning: string;
}

/**
 * Complete reward evaluation result
 */
export interface RewardResult {
  /** Scores from each reward type */
  scores: Record<string, RewardScore>;

  /** Weighted total score */
  total: number;

  /** Number of lines changed */
  diffLines: number;

  /** ISO timestamp when computed */
  computedAt: string;
}

/**
 * Reward configuration in task.json
 */
export interface RewardConfig {
  /** Reward types to use */
  types: string[];

  /** Weights for each type (must sum to 1.0) */
  weights: number[];
}

/**
 * Default reward configuration
 */
export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  types: ["test_coverage", "code_quality", "agent_review"],
  weights: [0.34, 0.33, 0.33],
};

// =============================================================================
// Result Types
// =============================================================================

/**
 * Result of listing reward types
 */
export interface RewardListTypesResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** Available reward types */
  types: RewardType[];

  /** Total count */
  count: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Result of viewing a reward type
 */
export interface RewardViewTypeResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** The reward type */
  rewardType?: RewardType;

  /** The prompt content (body without frontmatter) */
  promptContent?: string;

  /** Error message if failed */
  error?: string;
}

/**
 * Options for creating a custom reward type
 */
export interface RewardCreateTypeOptions {
  /** Type name (required) */
  name: string;

  /** Description (required) */
  description: string;

  /** Default weight (optional) */
  weightDefault?: number;

  /** Prompt content (optional, can be empty for initial creation) */
  promptContent?: string;
}

/**
 * Result of creating a reward type
 */
export interface RewardCreateTypeResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** The created reward type */
  rewardType?: RewardType;

  /** Path to the created file */
  filePath?: string;

  /** Error message if failed */
  error?: string;
}

/**
 * Result of updating a reward type
 */
export interface RewardUpdateTypeResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** The updated reward type */
  rewardType?: RewardType;

  /** Error message if failed */
  error?: string;
}

/**
 * Result of deleting a reward type
 */
export interface RewardDeleteTypeResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** Name of the deleted type */
  deletedType?: string;

  /** Error message if failed */
  error?: string;
}

/**
 * Result of computing reward for a task
 */
export interface RewardComputeResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** Agent ID for tracking */
  agentId?: string;

  /** Process ID of the spawned agent */
  pid?: number;

  /** Path to the log file */
  logFile?: string;

  /** Warning messages (non-fatal) */
  warnings?: string[];

  /** Error message if failed */
  error?: string;
}

// =============================================================================
// PPO Selection Types
// =============================================================================

/**
 * Options for PPO-based reward selection
 */
export interface SelectOptions {
  /** Minimum adjusted reward threshold (default: 0.6) */
  threshold?: number;

  /** KL penalty coefficient λ (default: 0.05) */
  klCoef?: number;

  /** Maximum diff lines for KL normalization (default: 500) */
  maxDiff?: number;

  /** FileRL directory path (for reading reward from iter{N}/{taskName}/reward.json) */
  filerlDir?: string;

  /** Current iteration number (required if filerlDir is set) */
  iteration?: number;
}

/**
 * Default values for PPO selection (core PPO parameters only)
 */
export const SELECT_DEFAULTS = {
  threshold: 0.6,
  klCoef: 0.05,
  maxDiff: 500,
} as const;

/**
 * PPO metrics for a single task candidate
 */
export interface TaskCandidate {
  /** Task name (directory name) */
  task: string;

  /** Original reward score (0-1) */
  reward: number;

  /** Number of lines changed */
  diffLines: number;

  /** KL penalty = λ × (diff_lines / max_diff) */
  klPenalty: number;

  /** Adjusted reward = reward - KL penalty */
  adjustedReward: number;

  /** Advantage = adjusted reward - baseline */
  advantage: number;

  /** PPO score (simplified, = advantage) */
  ppoScore: number;
}

/**
 * Result of PPO-based reward selection
 */
export interface SelectResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** Baseline (mean of adjusted rewards) */
  baseline?: number;

  /** Threshold used for selection */
  threshold?: number;

  /** All task candidates with PPO metrics */
  candidates?: TaskCandidate[];

  /** Selected task name (best PPO score above threshold) */
  selected?: string | null;

  /** Rejected task names */
  rejected?: string[];

  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a string is a built-in reward type
 */
export function isBuiltinRewardType(value: string): value is BuiltinRewardTypeName {
  return BUILTIN_REWARD_TYPES.includes(value as BuiltinRewardTypeName);
}
