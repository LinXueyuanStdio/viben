/**
 * Worktree utilities for Multi-Agent Pipeline.
 *
 * This module provides utilities for managing git worktrees in the Viben swarm system.
 * It re-exports core functions from viben-workspace.ts and adds worktree-specific helpers.
 *
 * Provides:
 *   getWorktreeConfig         - Get worktree.yaml path
 *   getWorktreeBaseDir        - Get worktree storage directory
 *   getWorktreeCopyFiles      - Get files to copy list
 *   getWorktreePostCreateHooks - Get post-create hooks
 *   getAgentsDir              - Get agents registry directory
 *   parseSimpleYaml           - Parse simple YAML config
 */
import { existsSync, readFileSync } from "node:fs";

// Re-export core worktree functions from viben-workspace
export {
  parseSimpleYaml,
  getWorktreeConfig,
  getWorktreeBaseDir,
  getAgentsDir,
  getWorkspaceDir,
  getDeveloper,
  findVibenRoot,
  DIR_VIBEN,
} from "../viben-workspace";

import {
  getWorktreeConfig,
  parseSimpleYaml,
} from "../viben-workspace";

// =============================================================================
// Worktree Configuration - Extended Functions
// =============================================================================

/**
 * Helper to read a list section from worktree.yaml
 *
 * @param configFile - Path to config file
 * @param section - Section name
 * @returns List of items
 */
function yamlGetList(configFile: string, section: string): string[] {
  if (!existsSync(configFile)) {
    return [];
  }

  try {
    const content = readFileSync(configFile, "utf-8");
    const data = parseSimpleYaml(content);
    const value = data[section];
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
  } catch {
    // Ignore errors
  }

  return [];
}

/**
 * Get files to copy list from worktree.yaml
 *
 * These are files that should be copied from the main repo to new worktrees.
 * Typically includes environment files like .env, .env.local that are gitignored.
 *
 * @param repoRoot - Repository root path
 * @returns List of file paths to copy
 *
 * @example
 * // worktree.yaml:
 * // copy:
 * //   - .env
 * //   - .env.local
 * //   - .npmrc
 *
 * const files = getWorktreeCopyFiles("/path/to/repo");
 * // Returns: [".env", ".env.local", ".npmrc"]
 */
export function getWorktreeCopyFiles(repoRoot: string): string[] {
  const configFile = getWorktreeConfig(repoRoot);
  return yamlGetList(configFile, "copy");
}

/**
 * Get post-create hooks from worktree.yaml
 *
 * These are commands to run after creating a new worktree.
 * Typically includes package installation commands.
 *
 * @param repoRoot - Repository root path
 * @returns List of commands to run
 *
 * @example
 * // worktree.yaml:
 * // post_create:
 * //   - pnpm install
 * //   - pnpm build
 *
 * const hooks = getWorktreePostCreateHooks("/path/to/repo");
 * // Returns: ["pnpm install", "pnpm build"]
 */
export function getWorktreePostCreateHooks(repoRoot: string): string[] {
  const configFile = getWorktreeConfig(repoRoot);
  return yamlGetList(configFile, "post_create");
}
