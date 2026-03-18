/**
 * Reward Type CRUD Operations
 *
 * Create, Read, Update, Delete operations for reward types.
 * Used by both CLI and API endpoints.
 */

import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";

import {
  type RewardType,
  type RewardListTypesResult,
  type RewardViewTypeResult,
  type RewardCreateTypeOptions,
  type RewardCreateTypeResult,
  type RewardUpdateTypeResult,
  type RewardDeleteTypeResult,
  type RewardComputeResult,
  CUSTOM_REWARD_TYPES_DIR,
  isBuiltinRewardType,
} from "./types";

import {
  listRewardTypes,
  getRewardType,
  loadRewardTypePrompt,
  validateRewardTypes,
} from "./store";

import { runRewardPhaseSync } from "../../task/phase";
import { resolveTaskDirectory, findVibenRoot } from "../../cli/lib/viben-workspace";

// =============================================================================
// List Types
// =============================================================================

/**
 * List all available reward types
 *
 * @param repoRoot - Repository root path
 * @returns Result with types array and count
 */
export function listTypes(repoRoot: string): RewardListTypesResult {
  try {
    const types = listRewardTypes(repoRoot);
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

// =============================================================================
// View Type
// =============================================================================

/**
 * Get details of a specific reward type
 *
 * @param repoRoot - Repository root path
 * @param typeName - Name of the reward type
 * @returns Result with reward type and prompt content
 */
export function viewType(repoRoot: string, typeName: string): RewardViewTypeResult {
  try {
    const rewardType = getRewardType(repoRoot, typeName);

    if (!rewardType) {
      return {
        success: false,
        error: `Reward type not found: ${typeName}`,
      };
    }

    const promptContent = loadRewardTypePrompt(rewardType);

    return {
      success: true,
      rewardType,
      promptContent: promptContent || undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Create Type
// =============================================================================

/**
 * Generate frontmatter for a reward type prompt file
 */
function generateFrontmatter(options: RewardCreateTypeOptions): string {
  const lines = [
    "---",
    `name: ${options.name}`,
    `description: ${options.description}`,
  ];

  if (options.weightDefault !== undefined) {
    lines.push(`weight_default: ${options.weightDefault}`);
  }

  lines.push("---");
  return lines.join("\n");
}

/**
 * Create a new custom reward type
 *
 * @param repoRoot - Repository root path
 * @param options - Create options
 * @returns Result with created reward type
 */
export function createType(
  repoRoot: string,
  options: RewardCreateTypeOptions
): RewardCreateTypeResult {
  try {
    // Validate name
    if (!options.name || !options.name.trim()) {
      return {
        success: false,
        error: "Reward type name is required",
      };
    }

    if (!options.description || !options.description.trim()) {
      return {
        success: false,
        error: "Reward type description is required",
      };
    }

    // Check if type already exists
    const existing = getRewardType(repoRoot, options.name);
    if (existing) {
      return {
        success: false,
        error: `Reward type already exists: ${options.name} (source: ${existing.source})`,
      };
    }

    // Check if trying to create a builtin name as custom
    if (isBuiltinRewardType(options.name)) {
      return {
        success: false,
        error: `Cannot create custom type with builtin name: ${options.name}. Use a different name or override by placing in docs/reward-types/`,
      };
    }

    // Create custom types directory if needed
    const customDir = join(repoRoot, CUSTOM_REWARD_TYPES_DIR);
    if (!existsSync(customDir)) {
      mkdirSync(customDir, { recursive: true });
    }

    // Generate file content
    const frontmatter = generateFrontmatter(options);
    const content = options.promptContent
      ? `${frontmatter}\n\n${options.promptContent}`
      : `${frontmatter}\n\n# ${options.name}\n\nDescribe the evaluation criteria here.\n`;

    // Write file
    const filePath = join(customDir, `${options.name}.md`);
    writeFileSync(filePath, content, "utf-8");

    // Get the created type
    const rewardType = getRewardType(repoRoot, options.name);

    return {
      success: true,
      rewardType: rewardType || undefined,
      filePath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Update Type
// =============================================================================

/**
 * Update a custom reward type
 *
 * @param repoRoot - Repository root path
 * @param typeName - Name of the type to update
 * @param updates - Fields to update
 * @returns Result with updated reward type
 */
export function updateType(
  repoRoot: string,
  typeName: string,
  updates: Partial<Omit<RewardCreateTypeOptions, "name">>
): RewardUpdateTypeResult {
  try {
    const existing = getRewardType(repoRoot, typeName);

    if (!existing) {
      return {
        success: false,
        error: `Reward type not found: ${typeName}`,
      };
    }

    // Only allow updating custom types (or builtin overrides in custom dir)
    const customDir = join(repoRoot, CUSTOM_REWARD_TYPES_DIR);
    const customPath = join(customDir, `${typeName}.md`);

    if (!existsSync(customPath)) {
      if (existing.source === "builtin") {
        return {
          success: false,
          error: `Cannot update builtin reward type "${typeName}". Create an override in ${CUSTOM_REWARD_TYPES_DIR}/ instead.`,
        };
      }
      return {
        success: false,
        error: `Custom type file not found: ${customPath}`,
      };
    }

    // Get current prompt content
    const currentPrompt = loadRewardTypePrompt(existing);

    // Build updated options
    const updatedOptions: RewardCreateTypeOptions = {
      name: typeName,
      description: updates.description || existing.description,
      weightDefault: updates.weightDefault ?? existing.weightDefault,
      promptContent: updates.promptContent ?? currentPrompt ?? undefined,
    };

    // Generate new content
    const frontmatter = generateFrontmatter(updatedOptions);
    const content = updatedOptions.promptContent
      ? `${frontmatter}\n\n${updatedOptions.promptContent}`
      : `${frontmatter}\n`;

    // Write file
    writeFileSync(customPath, content, "utf-8");

    // Get the updated type
    const rewardType = getRewardType(repoRoot, typeName);

    return {
      success: true,
      rewardType: rewardType || undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Delete Type
// =============================================================================

/**
 * Delete a custom reward type
 *
 * @param repoRoot - Repository root path
 * @param typeName - Name of the type to delete
 * @returns Result with deleted type name
 */
export function deleteType(repoRoot: string, typeName: string): RewardDeleteTypeResult {
  try {
    const existing = getRewardType(repoRoot, typeName);

    if (!existing) {
      return {
        success: false,
        error: `Reward type not found: ${typeName}`,
      };
    }

    // Only allow deleting custom types
    const customDir = join(repoRoot, CUSTOM_REWARD_TYPES_DIR);
    const customPath = join(customDir, `${typeName}.md`);

    if (!existsSync(customPath)) {
      if (existing.source === "builtin") {
        return {
          success: false,
          error: `Cannot delete builtin reward type "${typeName}". Builtin types are shipped with viben.`,
        };
      }
      return {
        success: false,
        error: `Custom type file not found: ${customPath}`,
      };
    }

    // Delete the file
    unlinkSync(customPath);

    return {
      success: true,
      deletedType: typeName,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Compute Reward
// =============================================================================

/**
 * Compute reward for a task
 *
 * @param repoRoot - Repository root path
 * @param task - Task name or directory
 * @param options - Compute options
 * @returns Result with agent info
 */
export function computeReward(
  repoRoot: string,
  task: string,
  options?: { platform?: string; verbose?: boolean }
): RewardComputeResult {
  try {
    // Resolve task directory
    const taskDir = resolveTaskDirectory(task, repoRoot);
    if (!taskDir) {
      return {
        success: false,
        error: `Task not found: ${task}`,
      };
    }

    // Run reward phase
    const result = runRewardPhaseSync(repoRoot, taskDir, {
      platform: options?.platform || "claude",
      verbose: options?.verbose ?? true,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to compute reward",
      };
    }

    return {
      success: true,
      agentId: result.agentId,
      pid: result.pid,
      logFile: result.logFile,
      warnings: result.warnings,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Validate Types
// =============================================================================

/**
 * Validate that reward types exist
 *
 * @param repoRoot - Repository root path
 * @param typeNames - Type names to validate
 * @returns Validation result
 */
export function validateTypes(
  repoRoot: string,
  typeNames: string[]
): { valid: boolean; invalidTypes: string[] } {
  return validateRewardTypes(repoRoot, typeNames);
}

