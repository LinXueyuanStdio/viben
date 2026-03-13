/**
 * Worktree Phase Module
 *
 * Creates an isolated git worktree for a task. This module handles:
 * 1. Validation (branch field required)
 * 2. Worktree creation with proper branch setup
 * 3. Environment file copying (from worktree.yaml config)
 * 4. Task directory copying (may not be committed yet)
 * 5. Post-create hooks execution
 *
 * @example
 * ```typescript
 * import { runCreateWorktree } from "@viben/core/task/phase/worktree";
 *
 * const result = await runCreateWorktree(repoRoot, taskDir);
 * if (result.success) {
 *   console.log(`Worktree created at: ${result.worktreePath}`);
 * }
 * ```
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  copyFileSync,
  rmSync,
  cpSync,
} from "node:fs";
import { join, resolve, relative, dirname } from "node:path";

import {
  FILE_TASK_JSON,
  readTaskJson,
  writeTaskJson,
  runGitCommand,
  getWorktreeConfig,
  getWorktreeBaseDir,
  parseSimpleYaml,
} from "../../cli/lib/viben-workspace";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for creating a worktree
 */
export interface CreateWorktreeOptions {
  // Currently no options - kept for future extensibility
}

/**
 * Result of creating a worktree
 */
export interface CreateWorktreeResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Path to the created worktree */
  worktreePath?: string;
  /** Branch name used */
  branch?: string;
  /** Base branch (PR target) */
  baseBranch?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Task data structure
 */
interface TaskData {
  id?: string;
  name?: string;
  branch?: string;
  status?: string;
  base_branch?: string;
  worktree_path?: string;
  [key: string]: unknown;
}

// =============================================================================
// Worktree Configuration Helpers
// =============================================================================

/**
 * Get list of files to copy from worktree.yaml
 */
function getWorktreeCopyFiles(repoRoot: string): string[] {
  const configPath = getWorktreeConfig(repoRoot);
  if (!existsSync(configPath)) {
    return [];
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = parseSimpleYaml(content);
    const copyFiles = config.copy;
    if (Array.isArray(copyFiles)) {
      return copyFiles.filter((f): f is string => typeof f === "string");
    }
  } catch {
    // Ignore errors
  }

  return [];
}

/**
 * Get post_create hooks from worktree.yaml
 */
function getWorktreePostCreateHooks(repoRoot: string): string[] {
  const configPath = getWorktreeConfig(repoRoot);
  if (!existsSync(configPath)) {
    return [];
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = parseSimpleYaml(content);
    const hooks = config.post_create;
    if (Array.isArray(hooks)) {
      return hooks.filter((h): h is string => typeof h === "string");
    }
  } catch {
    // Ignore errors
  }

  return [];
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Create a worktree for a task
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path (relative or absolute)
 * @param options - Create options
 * @returns CreateWorktreeResult with success status and worktree path
 */
export async function runCreateWorktree(
  repoRoot: string,
  taskDir: string,
  _options: CreateWorktreeOptions = {}
): Promise<CreateWorktreeResult> {

  // Normalize paths
  let taskDirRelative: string;
  let taskDirAbs: string;

  if (taskDir.startsWith("/")) {
    taskDirAbs = taskDir;
    taskDirRelative = relative(repoRoot, taskDir);
  } else {
    taskDirRelative = taskDir;
    taskDirAbs = resolve(repoRoot, taskDir);
  }

  const taskJsonPath = join(taskDirAbs, FILE_TASK_JSON);

  // =============================================================================
  // Validation
  // =============================================================================

  // Check task.json exists
  if (!existsSync(taskJsonPath)) {
    return {
      success: false,
      error: `task.json not found at ${taskJsonPath}`,
    };
  }

  // Check worktree.yaml exists
  const configFile = getWorktreeConfig(repoRoot);
  if (!existsSync(configFile)) {
    return {
      success: false,
      error: `worktree.yaml not found at ${configFile}`,
    };
  }

  // =============================================================================
  // Read Task Config
  // =============================================================================

  const taskData = readTaskJson(taskDirAbs) as TaskData | null;
  if (!taskData) {
    return {
      success: false,
      error: "Failed to read task.json",
    };
  }

  const branch = taskData.branch;
  let worktreePath = taskData.worktree_path;

  // Check branch field
  if (!branch) {
    return {
      success: false,
      error: `branch field not set in task.json. Set it first with: viben task set-branch <task> <branch>`,
    };
  }

  // =============================================================================
  // Check if worktree already exists
  // =============================================================================

  if (worktreePath && existsSync(worktreePath)) {
    return {
      success: true,
      worktreePath,
      branch,
      baseBranch: taskData.base_branch,
    };
  }

  // =============================================================================
  // Create Worktree
  // =============================================================================

  // Record current branch as base_branch (PR target)
  const { stdout: baseBranchOut } = runGitCommand(
    ["branch", "--show-current"],
    repoRoot
  );
  const baseBranch = baseBranchOut.trim() || "main";

  // Calculate worktree path
  let worktreeBaseDir = getWorktreeBaseDir(repoRoot);
  if (!existsSync(worktreeBaseDir)) {
    mkdirSync(worktreeBaseDir, { recursive: true });
  }
  worktreeBaseDir = resolve(worktreeBaseDir);

  const worktreePathObj = join(worktreeBaseDir, branch);
  worktreePath = worktreePathObj;

  // Create parent directory
  const parentDir = dirname(worktreePathObj);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  // Check if branch exists
  const { code: refCode } = runGitCommand(
    ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
    repoRoot
  );

  let gitResult: { code: number; stderr: string };
  if (refCode === 0) {
    // Branch exists, check it out
    gitResult = runGitCommand(
      ["worktree", "add", worktreePath, branch],
      repoRoot
    );
  } else {
    // Create new branch
    gitResult = runGitCommand(
      ["worktree", "add", "-b", branch, worktreePath],
      repoRoot
    );
  }

  if (gitResult.code !== 0) {
    return {
      success: false,
      error: `Failed to create worktree: ${gitResult.stderr}`,
    };
  }

  // Update task.json with worktree_path and base_branch
  taskData.worktree_path = worktreePath;
  taskData.base_branch = baseBranch;
  writeTaskJson(taskDirAbs, taskData as Record<string, unknown>);

  // =============================================================================
  // Copy Environment Files
  // =============================================================================

  const copyList = getWorktreeCopyFiles(repoRoot);
  for (const item of copyList) {
    if (!item) continue;

    const source = join(repoRoot, item);
    const target = join(worktreePath, item);

    if (existsSync(source)) {
      const targetDir = dirname(target);
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }
      copyFileSync(source, target);
    }
  }

  // =============================================================================
  // Copy Task Directory (may not be committed yet)
  // =============================================================================

  const taskTargetDir = join(worktreePath, taskDirRelative);
  const taskTargetParent = dirname(taskTargetDir);
  if (!existsSync(taskTargetParent)) {
    mkdirSync(taskTargetParent, { recursive: true });
  }
  if (existsSync(taskTargetDir)) {
    rmSync(taskTargetDir, { recursive: true, force: true });
  }
  cpSync(taskDirAbs, taskTargetDir, { recursive: true });

  // =============================================================================
  // Run Post-Create Hooks
  // =============================================================================

  const postCreateHooks = getWorktreePostCreateHooks(repoRoot);
  for (const cmd of postCreateHooks) {
    if (!cmd) continue;

    try {
      execSync(cmd, {
        cwd: worktreePath,
        stdio: "inherit",
        shell: "/bin/sh",
      });
    } catch (error) {
      return {
        success: false,
        error: `Post-create hook failed: ${cmd}. Error: ${error}`,
      };
    }
  }

  // =============================================================================
  // Return Result
  // =============================================================================

  return {
    success: true,
    worktreePath,
    branch,
    baseBranch,
  };
}
