/**
 * Reward Store Operations
 *
 * Functions for loading and managing reward types.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type RewardType,
  type RewardTypeSource,
  BUILTIN_REWARD_TYPES,
  CUSTOM_REWARD_TYPES_DIR,
  isBuiltinRewardType,
} from "./types";

// =============================================================================
// Path Utilities
// =============================================================================

/**
 * Get the directory containing built-in reward type prompts
 */
function getBuiltinRewardTypesDir(): string {
  // In ESM, use import.meta.url to get the current file's directory
  const currentDir = dirname(fileURLToPath(import.meta.url));
  // After bundling, code runs from dist/cli/bin.js
  // Navigate to dist/prompts/reward-types
  return resolve(currentDir, "../prompts/reward-types");
}

/**
 * Get the path to a built-in reward type prompt
 */
function getBuiltinRewardTypePromptPath(typeName: string): string {
  return join(getBuiltinRewardTypesDir(), `${typeName}.md`);
}

/**
 * Get the custom reward types directory for a project
 */
function getCustomRewardTypesDir(repoRoot: string): string {
  return join(repoRoot, CUSTOM_REWARD_TYPES_DIR);
}

// =============================================================================
// Frontmatter Parsing
// =============================================================================

interface FrontmatterResult {
  data: Record<string, unknown>;
  body: string;
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): FrontmatterResult {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { data: {}, body: content };
  }

  const yamlContent = match[1];
  const body = match[2];

  // Simple YAML parsing for frontmatter
  const data: Record<string, unknown> = {};
  const lines = yamlContent.split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value: unknown = line.slice(colonIndex + 1).trim();

      // Parse numbers
      if (!isNaN(Number(value)) && value !== "") {
        value = Number(value);
      }
      // Parse booleans
      else if (value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      }

      data[key] = value;
    }
  }

  return { data, body };
}

// =============================================================================
// Reward Type Loading
// =============================================================================

/**
 * Load a reward type from a file
 *
 * @param promptPath - Absolute path to the prompt file
 * @param source - Whether this is a builtin or custom type
 * @returns RewardType object or null if loading failed
 */
function loadRewardTypeFromFile(
  promptPath: string,
  source: RewardTypeSource
): RewardType | null {
  try {
    const content = readFileSync(promptPath, "utf-8");
    const { data } = parseFrontmatter(content);

    const name = data.name as string;
    const description = data.description as string;
    const weightDefault = data.weight_default as number | undefined;

    if (!name || !description) {
      return null;
    }

    return {
      name,
      description,
      weightDefault,
      source,
      promptPath,
    };
  } catch {
    return null;
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * List all available reward types
 *
 * Search order:
 * 1. Custom types in docs/reward-types/ (project-local)
 * 2. Built-in types in packages/core/src/prompts/reward-types/ (fallback)
 *
 * @param repoRoot - Repository root path
 * @returns Array of RewardType objects
 */
export function listRewardTypes(repoRoot: string): RewardType[] {
  const types: RewardType[] = [];
  const seenNames = new Set<string>();

  // First, read custom/project-local types from docs/reward-types/
  const customTypesDir = getCustomRewardTypesDir(repoRoot);
  if (existsSync(customTypesDir)) {
    try {
      const files = readdirSync(customTypesDir);
      for (const file of files) {
        if (file.endsWith(".md")) {
          const promptPath = join(customTypesDir, file);
          const typeName = file.replace(".md", "");
          const source: RewardTypeSource = isBuiltinRewardType(typeName)
            ? "builtin"
            : "custom";
          const rewardType = loadRewardTypeFromFile(promptPath, source);
          if (rewardType && !seenNames.has(rewardType.name)) {
            types.push(rewardType);
            seenNames.add(rewardType.name);
          }
        }
      }
    } catch {
      // Ignore errors reading types directory
    }
  }

  // Then, add built-in types that weren't overridden
  for (const typeName of BUILTIN_REWARD_TYPES) {
    if (!seenNames.has(typeName)) {
      const builtinPromptPath = getBuiltinRewardTypePromptPath(typeName);
      if (existsSync(builtinPromptPath)) {
        const rewardType = loadRewardTypeFromFile(builtinPromptPath, "builtin");
        if (rewardType) {
          types.push(rewardType);
          seenNames.add(rewardType.name);
        }
      }
    }
  }

  return types.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get a specific reward type by name
 *
 * @param repoRoot - Repository root path
 * @param typeName - Name of the reward type
 * @returns RewardType object or null if not found
 */
export function getRewardType(
  repoRoot: string,
  typeName: string
): RewardType | null {
  // First check custom types
  const customTypesDir = getCustomRewardTypesDir(repoRoot);
  const customPath = join(customTypesDir, `${typeName}.md`);
  if (existsSync(customPath)) {
    const source: RewardTypeSource = isBuiltinRewardType(typeName)
      ? "builtin"
      : "custom";
    return loadRewardTypeFromFile(customPath, source);
  }

  // Then check built-in types
  if (isBuiltinRewardType(typeName)) {
    const builtinPath = getBuiltinRewardTypePromptPath(typeName);
    if (existsSync(builtinPath)) {
      return loadRewardTypeFromFile(builtinPath, "builtin");
    }
  }

  return null;
}

/**
 * Load the prompt content for a reward type
 *
 * @param rewardType - RewardType object
 * @returns Prompt content (without frontmatter) or null
 */
export function loadRewardTypePrompt(rewardType: RewardType): string | null {
  if (!existsSync(rewardType.promptPath)) {
    return null;
  }

  try {
    const content = readFileSync(rewardType.promptPath, "utf-8");
    const { body } = parseFrontmatter(content);
    return body.trim();
  } catch {
    return null;
  }
}

/**
 * Validate that all specified reward types exist
 *
 * @param repoRoot - Repository root path
 * @param typeNames - Array of type names to validate
 * @returns Validation result with valid flag and any invalid types
 */
export function validateRewardTypes(
  repoRoot: string,
  typeNames: string[]
): { valid: boolean; invalidTypes: string[] } {
  const invalidTypes: string[] = [];

  for (const typeName of typeNames) {
    const rewardType = getRewardType(repoRoot, typeName);
    if (!rewardType) {
      invalidTypes.push(typeName);
    }
  }

  return {
    valid: invalidTypes.length === 0,
    invalidTypes,
  };
}
