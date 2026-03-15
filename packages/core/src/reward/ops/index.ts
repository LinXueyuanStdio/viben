/**
 * Reward Operations Module
 *
 * Public API for reward type management.
 */

// Re-export types
export {
  // Constants
  BUILTIN_REWARD_TYPES,
  CUSTOM_REWARD_TYPES_DIR,
  // Types
  type BuiltinRewardTypeName,
  type RewardTypeSource,
  type RewardType,
  type RewardScore,
  type RewardResult,
  type RewardConfig,
  type RewardListTypesResult,
  // Helper functions
  isBuiltinRewardType,
} from "./types";

// Re-export store functions
export {
  listRewardTypes,
  getRewardType,
  loadRewardTypePrompt,
  validateRewardTypes,
} from "./store";

// =============================================================================
// CRUD Operations (High-level wrappers with error handling)
// =============================================================================

import type { RewardListTypesResult } from "./types";
import { listRewardTypes as listRewardTypesFromStore } from "./store";

/**
 * List all available reward types
 *
 * @param repoRoot - Repository root path
 * @returns Result with types array and count
 */
export function listTypes(repoRoot: string): RewardListTypesResult {
  try {
    const types = listRewardTypesFromStore(repoRoot);
    return {
      success: true,
      types,
      count: types.length,
    };
  } catch (error) {
    return {
      success: false,
      types: [],
      count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
