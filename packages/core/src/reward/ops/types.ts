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

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a string is a built-in reward type
 */
export function isBuiltinRewardType(value: string): value is BuiltinRewardTypeName {
  return BUILTIN_REWARD_TYPES.includes(value as BuiltinRewardTypeName);
}
