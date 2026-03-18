/**
 * Worktree Cleanup Utilities for Multi-Agent Pipeline
 *
 * Provides functions for cleaning up git worktrees and associated task directories.
 * Replaces Python implementation in templates/viben/scripts/multi_agent/cleanup.py
 *
 * Features:
 * - Archive task directories to .viben/tasks/archive/YYYY-MM/
 * - Remove agents from registry
 * - Remove git worktrees
 * - Optionally delete git branches
 * - Support for cleaning merged worktrees
 * - Support for cleaning all worktrees
 */
import { existsSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

import {
  archiveTask as archiveTaskToArchive,
  isSafeTaskPath,
  runGitCommand,
} from "../viben-workspace";

import {
  registryGetTaskDir,
  registryRemoveById,
  registryRemoveByWorktree,
  registrySearchAgent,
  type AgentEntry,
} from "./registry";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for cleanup operations
 */
export interface CleanupOptions {
  /** Keep the git branch after removing worktree (default: false) */
  keepBranch?: boolean;
  /** Skip confirmation prompts (default: false) */
  skipConfirm?: boolean;
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Path to archived task directory, if archived */
  archived?: string;
  /** Whether agent was removed from registry */
  removedFromRegistry?: boolean;
  /** Whether worktree was removed */
  worktreeRemoved?: boolean;
  /** Whether branch was deleted */
  branchDeleted?: boolean;
  /** Error message if operation failed */
  error?: string;
  /** Branch that was cleaned up */
  branch?: string;
  /** Worktree path that was cleaned up */
  worktreePath?: string;
}

/**
 * Worktree information from git worktree list --porcelain
 */
export interface WorktreeInfo {
  /** Absolute path to the worktree */
  path: string;
  /** Commit hash the worktree is at */
  commit: string;
  /** Branch name (without refs/heads/ prefix) */
  branch: string;
}

// =============================================================================
// Worktree Listing
// =============================================================================

/**
 * List all worktrees using git worktree list --porcelain
 *
 * @param repoRoot - Repository root path
 * @returns Array of worktree information objects
 */
export function listWorktrees(repoRoot: string): WorktreeInfo[] {
  const { code, stdout } = runGitCommand(
    ["worktree", "list", "--porcelain"],
    repoRoot
  );

  if (code !== 0) {
    return [];
  }

  const worktrees: WorktreeInfo[] = [];
  let currentWorktree: Partial<WorktreeInfo> = {};

  for (const line of stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      // Save previous worktree if complete
      if (currentWorktree.path) {
        worktrees.push({
          path: currentWorktree.path,
          commit: currentWorktree.commit || "",
          branch: currentWorktree.branch || "",
        });
      }
      currentWorktree = { path: line.substring(9) };
    } else if (line.startsWith("HEAD ")) {
      currentWorktree.commit = line.substring(5);
    } else if (line.startsWith("branch refs/heads/")) {
      currentWorktree.branch = line.substring(18);
    } else if (line === "" && currentWorktree.path) {
      // Empty line indicates end of entry
      worktrees.push({
        path: currentWorktree.path,
        commit: currentWorktree.commit || "",
        branch: currentWorktree.branch || "",
      });
      currentWorktree = {};
    }
  }

  // Handle last entry if not terminated by empty line
  if (currentWorktree.path) {
    worktrees.push({
      path: currentWorktree.path,
      commit: currentWorktree.commit || "",
      branch: currentWorktree.branch || "",
    });
  }

  return worktrees;
}

/**
 * Find worktree path for a given branch name
 *
 * @param branch - Branch name to find
 * @param repoRoot - Repository root path
 * @returns Worktree path, or null if not found
 */
export function findWorktreeByBranch(
  branch: string,
  repoRoot: string
): string | null {
  const worktrees = listWorktrees(repoRoot);
  const worktree = worktrees.find((wt) => wt.branch === branch);
  return worktree?.path ?? null;
}

/**
 * Get list of merged branches (excluding main branch)
 *
 * @param repoRoot - Repository root path
 * @param mainBranch - Main branch name (default: auto-detect from origin/HEAD)
 * @returns Array of merged branch names
 */
export function getMergedBranches(
  repoRoot: string,
  mainBranch?: string
): string[] {
  // Auto-detect main branch if not provided
  if (!mainBranch) {
    const { stdout: headOut } = runGitCommand(
      ["symbolic-ref", "refs/remotes/origin/HEAD"],
      repoRoot
    );
    mainBranch = headOut.trim().replace("refs/remotes/origin/", "") || "main";
  }

  // Get merged branches
  const { stdout: mergedOut } = runGitCommand(
    ["branch", "--merged", mainBranch],
    repoRoot
  );

  const mergedBranches: string[] = [];
  for (const line of mergedOut.split("\n")) {
    // Remove prefix: * = current branch, + = worktree branch
    const branch = line.trim().replace(/^[\*\+]\s*/, "");
    if (branch && branch !== mainBranch) {
      mergedBranches.push(branch);
    }
  }

  return mergedBranches;
}

// =============================================================================
// Archive Task
// =============================================================================

/**
 * Archive a task directory to .viben/tasks/archive/YYYY-MM/
 *
 * This is a wrapper around the core archiveTask function that handles
 * worktree-to-task mapping through the registry.
 *
 * @param taskDir - Task directory path (relative to repo root)
 * @param repoRoot - Repository root path
 * @returns Path to archived task directory, or null if not archived
 */
export function archiveTask(taskDir: string, repoRoot: string): string | null {
  // Validate path safety
  if (!taskDir || !isSafeTaskPath(taskDir, repoRoot)) {
    return null;
  }

  // Convert to absolute path
  const taskDirAbs = resolve(repoRoot, taskDir);
  if (!existsSync(taskDirAbs) || !statSync(taskDirAbs).isDirectory()) {
    return null;
  }

  // Use the core archive function
  return archiveTaskToArchive(taskDirAbs, repoRoot);
}

/**
 * Archive task from worktree path using registry lookup
 *
 * @param worktreePath - Worktree path
 * @param repoRoot - Repository root path
 * @returns Path to archived task directory, or null if not archived
 */
function archiveTaskFromWorktree(
  worktreePath: string,
  repoRoot: string
): string | null {
  // Get task directory from registry
  const taskDir = registryGetTaskDir(worktreePath, repoRoot);
  if (!taskDir) {
    return null;
  }

  return archiveTask(taskDir, repoRoot);
}

// =============================================================================
// Cleanup Operations
// =============================================================================

/**
 * Cleanup from registry only (when worktree doesn't exist)
 *
 * @param search - Search term (agent ID or task name)
 * @param repoRoot - Repository root path
 * @param options - Cleanup options
 * @returns Cleanup result
 */
export async function cleanupRegistryOnly(
  search: string,
  repoRoot: string,
  options: CleanupOptions = {}
): Promise<CleanupResult> {
  const agent = registrySearchAgent(search, repoRoot);

  if (!agent) {
    return {
      success: false,
      error: `No agent found in registry matching: ${search}`,
    };
  }

  const result: CleanupResult = {
    success: true,
    branch: search,
  };

  // Archive task directory if exists
  if (agent.task_dir && isSafeTaskPath(agent.task_dir, repoRoot)) {
    const archived = archiveTask(agent.task_dir, repoRoot);
    if (archived) {
      result.archived = archived;
    }
  }

  // Remove from registry
  const removed = registryRemoveById(agent.id, repoRoot);
  result.removedFromRegistry = removed;

  return result;
}

/**
 * Cleanup a single worktree by branch name
 *
 * This function:
 * 1. Archives the task directory to .viben/tasks/archive/YYYY-MM/
 * 2. Removes the agent from registry
 * 3. Removes the git worktree
 * 4. Optionally deletes the git branch
 *
 * @param repoRoot - Repository root path
 * @param branch - Branch name of the worktree to cleanup
 * @param options - Cleanup options
 * @returns Cleanup result
 */
export async function cleanupWorktree(
  repoRoot: string,
  branch: string,
  options: CleanupOptions = {}
): Promise<CleanupResult> {
  const { keepBranch = false } = options;

  // Find worktree path for branch
  const worktreePath = findWorktreeByBranch(branch, repoRoot);

  if (!worktreePath) {
    // No worktree found, try registry-only cleanup
    return cleanupRegistryOnly(branch, repoRoot, options);
  }

  const result: CleanupResult = {
    success: true,
    branch,
    worktreePath,
  };

  // 1. Archive task directory
  const archived = archiveTaskFromWorktree(worktreePath, repoRoot);
  if (archived) {
    result.archived = archived;
  }

  // 2. Remove from registry
  const removedFromRegistry = registryRemoveByWorktree(worktreePath, repoRoot);
  result.removedFromRegistry = removedFromRegistry;

  // 3. Remove worktree
  const { code: removeCode } = runGitCommand(
    ["worktree", "remove", worktreePath, "--force"],
    repoRoot
  );

  if (removeCode !== 0) {
    // Try removing directory manually
    try {
      if (existsSync(worktreePath)) {
        rmSync(worktreePath, { recursive: true, force: true });
      }
      result.worktreeRemoved = true;
    } catch (error) {
      result.worktreeRemoved = false;
      result.error = `Failed to remove worktree directory: ${error}`;
    }
  } else {
    result.worktreeRemoved = true;
  }

  // 4. Delete branch (optional)
  if (!keepBranch) {
    const { code: branchCode } = runGitCommand(
      ["branch", "-D", branch],
      repoRoot
    );
    result.branchDeleted = branchCode === 0;
  } else {
    result.branchDeleted = false;
  }

  return result;
}

/**
 * Cleanup all merged worktrees
 *
 * This finds all branches that have been merged into main (or specified branch)
 * and have associated worktrees, then cleans them up.
 *
 * @param repoRoot - Repository root path
 * @param options - Cleanup options
 * @returns Array of cleanup results
 */
export async function cleanupMerged(
  repoRoot: string,
  options: CleanupOptions = {}
): Promise<CleanupResult[]> {
  const results: CleanupResult[] = [];

  // Get merged branches
  const mergedBranches = getMergedBranches(repoRoot);
  if (mergedBranches.length === 0) {
    return results;
  }

  // Get worktree list to filter only branches with worktrees
  const worktrees = listWorktrees(repoRoot);
  const worktreeBranches = worktrees.map((wt) => wt.branch);

  // Find merged branches that have worktrees
  const mergedWithWorktrees = mergedBranches.filter((branch) =>
    worktreeBranches.includes(branch)
  );

  if (mergedWithWorktrees.length === 0) {
    return results;
  }

  // Cleanup each merged worktree
  for (const branch of mergedWithWorktrees) {
    const result = await cleanupWorktree(repoRoot, branch, {
      ...options,
      skipConfirm: true, // Always skip confirm for batch operations
    });
    results.push(result);
  }

  return results;
}

/**
 * Cleanup all worktrees (except main worktree)
 *
 * WARNING: This will remove ALL worktrees. Use with caution.
 *
 * @param repoRoot - Repository root path
 * @param options - Cleanup options
 * @returns Array of cleanup results
 */
export async function cleanupAll(
  repoRoot: string,
  options: CleanupOptions = {}
): Promise<CleanupResult[]> {
  const results: CleanupResult[] = [];

  // Get all worktrees
  const worktrees = listWorktrees(repoRoot);
  const mainWorktree = resolve(repoRoot);

  // Filter out main worktree
  const worktreesToRemove = worktrees.filter(
    (wt) => resolve(wt.path) !== mainWorktree
  );

  if (worktreesToRemove.length === 0) {
    return results;
  }

  // Cleanup each worktree
  for (const wt of worktreesToRemove) {
    if (wt.branch) {
      const result = await cleanupWorktree(repoRoot, wt.branch, {
        ...options,
        skipConfirm: true, // Always skip confirm for batch operations
      });
      results.push(result);
    }
  }

  return results;
}

// =============================================================================
// Summary Functions
// =============================================================================

/**
 * Get summary statistics from cleanup results
 *
 * @param results - Array of cleanup results
 * @returns Summary object
 */
export function getCleanupSummary(results: CleanupResult[]): {
  total: number;
  successful: number;
  failed: number;
  archived: number;
  branchesDeleted: number;
} {
  return {
    total: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    archived: results.filter((r) => r.archived).length,
    branchesDeleted: results.filter((r) => r.branchDeleted).length,
  };
}
