/**
 * Reward Types
 *
 * Type definitions for the reward module.
 * Based on docs/plans/2026-03-17-evo-commands-design.md
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
 * - Built-in: shipped with viben in packages/core/templates/viben/reward-types/
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
  /** Quality threshold τ (default: 0.6) */
  threshold?: number;

  /** KL penalty coefficient λ (default: 0.05) */
  klCoef?: number;

  /** Change sensitivity β (default: 2.0) */
  changeSensitivity?: number;

  /** Clip range ε (default: 0.2) */
  clipRange?: number;

  /** Maximum diff lines for normalization (default: 500) */
  maxDiff?: number;

  /** Map of task -> ideaId for two-stage selection */
  taskIdeaMap?: Record<string, string>;

  /** Evo directory path */
  evoDir?: string;

  /** Current iteration number */
  iteration?: number;
}

/**
 * Default values for PPO selection (core PPO parameters only)
 */
export const SELECT_DEFAULTS = {
  threshold: 0.6,
  klCoef: 0.05,
  changeSensitivity: 2.0,
  clipRange: 0.2,
  maxDiff: 500,
} as const;

/**
 * PPO metrics for a single task candidate
 */
export interface TaskCandidate {
  /** Task name (directory name) */
  task: string;

  /** Source idea ID */
  ideaId?: string;

  /** Original reward score (0-1) */
  reward: number;

  /** Number of lines changed */
  diffLines: number;

  /** Normalized change amount d = min(1, diffLines/maxDiff) */
  d: number;

  /** Change weight w = exp(-β × d) */
  changeWeight: number;

  /** KL penalty = λ × d */
  klPenalty: number;

  /** Adjusted reward R̃ = R - λ × d */
  adjustedReward: number;

  /** Relative score S = R̃ - baseline */
  relativeScore: number;

  /** Final score L = min(w×S, clip(w)×S) */
  finalScore: number;
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
