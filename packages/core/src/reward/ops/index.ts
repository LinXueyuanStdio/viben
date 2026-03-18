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
  SELECT_DEFAULTS,
  // Types
  type BuiltinRewardTypeName,
  type RewardTypeSource,
  type RewardType,
  type RewardScore,
  type RewardResult,
  type RewardConfig,
  type RewardListTypesResult,
  type RewardViewTypeResult,
  type RewardCreateTypeOptions,
  type RewardCreateTypeResult,
  type RewardUpdateTypeResult,
  type RewardDeleteTypeResult,
  type RewardComputeResult,
  type SelectOptions,
  type SelectResult,
  type TaskCandidate,
  // Helper functions
  isBuiltinRewardType,
} from "./types";

// Re-export store functions (low-level)
export {
  listRewardTypes,
  getRewardType,
  loadRewardTypePrompt,
  validateRewardTypes,
} from "./store";

// Re-export select functions
export { selectBestTask } from "./select";

// Re-export CRUD operations (high-level with error handling)
export {
  // List
  listTypes,
  // View
  viewType,
  // Create
  createType,
  // Update
  updateType,
  // Delete
  deleteType,
  // Compute
  computeReward,
  // Validate
  validateTypes,
} from "./crud";
