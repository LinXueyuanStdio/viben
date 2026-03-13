/**
 * Multi-Agent Pipeline: Start Worktree Agent
 *
 * @deprecated Use `viben task work-phase` instead of `viben swarm start`.
 *             The work-phase command auto-creates worktree when task.json has `worktree=true` or `branch` set.
 *
 * TypeScript implementation of packages/core/templates/viben/scripts/multi_agent/start.py
 *
 * This module:
 * 1. Creates worktree (if not exists) with dependency install
 * 2. Copies environment files (from worktree.yaml config)
 * 3. Sets .current-task in worktree
 * 4. Starts claude agent in background
 * 5. Registers agent to registry.json
 *
 * Prerequisites:
 *    - task.json must exist with 'branch' field
 *    - prd.md must exist (plan completed)
 *    - agents/work.md must exist (in .claude/, .cursor/, .iflow/, or .opencode/)
 *
 * Configuration: .viben/worktree.yaml
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
  createCLIAdapter,
  type Platform,
} from "../viben-workspace";

import { runWorkPhase } from "../../../task/phase/work";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for starting an agent
 */
export interface StartOptions {
  /** Platform to use (default: claude) */
  platform?: Platform;
  /** Run in detached mode (default: true) */
  detach?: boolean;
  /** Skip permission prompts (default: true) */
  skipPermissions?: boolean;
  /** Enable verbose output (default: true) */
  verbose?: boolean;
  /** Output JSON format (default: true) */
  jsonOutput?: boolean;
}

/**
 * Result of starting an agent
 */
export interface StartResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Agent ID (task ID) */
  agentId?: string;
  /** Process ID */
  pid?: number;
  /** Session ID for resuming */
  sessionId?: string;
  /** Path to the worktree */
  worktreePath?: string;
  /** Path to the log file */
  logFile?: string;
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
 * Start an agent for a task in a worktree
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path (relative or absolute)
 * @param options - Start options
 * @returns StartResult with success status and details
 */
export async function startAgent(
  repoRoot: string,
  taskDir: string,
  options: StartOptions = {}
): Promise<StartResult> {
  const {
    platform = "claude",
    detach = true,
    skipPermissions = true,
    verbose = true,
    jsonOutput = true,
  } = options;

  // Initialize CLI adapter
  const adapter = createCLIAdapter(platform);

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

  // Check work agent exists
  const workMd = adapter.getAgentConfigPath("work", repoRoot);
  if (!existsSync(workMd)) {
    return {
      success: false,
      error: `work.md not found at ${workMd}. Platform: ${platform}`,
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
  const taskStatus = taskData.status;
  let worktreePath = taskData.worktree_path;

  // Check if task was rejected
  if (taskStatus === "rejected") {
    const rejectedFile = join(taskDirAbs, "REJECTED.md");
    let reason = "";
    if (existsSync(rejectedFile)) {
      reason = readFileSync(rejectedFile, "utf-8");
    }
    return {
      success: false,
      error: `Task was rejected by Plan Agent. ${reason ? `Reason: ${reason}` : "Check REJECTED.md for details."}`,
    };
  }

  // Check if prd.md exists (plan completed successfully)
  const prdFile = join(taskDirAbs, "prd.md");
  if (!existsSync(prdFile)) {
    return {
      success: false,
      error: `prd.md not found - Plan Agent may not have completed. Check ${join(taskDirAbs, ".plan-log")} for details.`,
    };
  }

  // Check branch field
  if (!branch) {
    return {
      success: false,
      error: `branch field not set in task.json. Please set it first, e.g.: jq '.branch = "task/my-task"' task.json > tmp && mv tmp task.json`,
    };
  }

  // =============================================================================
  // Step 1: Create Worktree (if not exists)
  // =============================================================================

  if (!worktreePath || !existsSync(worktreePath)) {
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

    // ----- Copy environment files -----
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

    // ----- Copy task directory (may not be committed yet) -----
    const taskTargetDir = join(worktreePath, taskDirRelative);
    const taskTargetParent = dirname(taskTargetDir);
    if (!existsSync(taskTargetParent)) {
      mkdirSync(taskTargetParent, { recursive: true });
    }
    if (existsSync(taskTargetDir)) {
      rmSync(taskTargetDir, { recursive: true, force: true });
    }
    cpSync(taskDirAbs, taskTargetDir, { recursive: true });

    // ----- Run post_create hooks -----
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
  }

  // =============================================================================
  // Step 2: Start Agent using runWorkPhase
  // =============================================================================

  // Generate agent ID
  let taskId = taskData.id;
  if (!taskId) {
    taskId = branch.replace(/\//g, "-");
  }

  // Task directory stays in main repo (for status tracking)
  // Agent runs in worktree but reports status to main repo's task dir
  const workResult = await runWorkPhase({
    repoRoot,
    workingDir: worktreePath,
    taskDir: taskDirAbs, // Main repo's task dir, not worktree's copy
    platform,
    verbose,
    detach,
    skipPermissions,
    jsonOutput,
    logFileName: ".agent-log",
    agentId: taskId,
    skipNextActionValidation: true, // swarm start doesn't require next_action
  });

  if (!workResult.success) {
    return {
      success: false,
      error: workResult.error,
    };
  }

  // =============================================================================
  // Return Result
  // =============================================================================

  return {
    success: true,
    agentId: workResult.agentId,
    pid: workResult.pid,
    sessionId: workResult.sessionId,
    worktreePath,
    logFile: workResult.logFile,
  };
}

