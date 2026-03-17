/**
 * Merge PR Phase Runner
 *
 * Runs the merge-pr agent for a task to merge an associated PR.
 * This is an async phase runner - it spawns the agent and returns immediately.
 *
 * Prerequisites:
 *    - task.json must exist
 *    - task.json must contain pr_url
 *    - merge-pr agent must exist (.claude/agents/merge-pr.md)
 *
 * The agent will:
 *    1. Check PR status (CI, mergeable)
 *    2. Merge the PR if ready
 *    3. Update task.json with merged_at, merge_commit, status
 */

import { spawn, type SpawnOptions, type ChildProcess } from "node:child_process";
import { existsSync, writeFileSync, openSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  readTaskJson,
  createCLIAdapter,
  registryAddAgent,
} from "../../cli/lib/viben-workspace";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for running the merge-pr phase
 *
 * Note: pr_url and worktree_path are read from task.json, not passed as options.
 */
export interface MergePRPhaseOptions {
  /** Platform to use (default: "claude") */
  platform?: string;
  /** Enable verbose output */
  verbose?: boolean;
}

/**
 * Result of running the merge-pr phase
 */
export interface MergePRPhaseResult {
  /** Whether the agent started successfully (not whether merge completed) */
  success: boolean;
  /** Agent ID for tracking */
  agentId?: string;
  /** Process ID of the spawned agent */
  pid?: number;
  /** Path to the log file */
  logFile?: string;
  /** Error message if failed to start */
  error?: string;
}

/**
 * Task data structure (subset of TaskJson)
 */
interface TaskData {
  id?: string;
  name?: string;
  pr_url?: string;
  worktree_path?: string;
  [key: string]: unknown;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Run the merge-pr phase for a task (async - returns immediately after spawning agent)
 *
 * This function:
 * 1. Validates prerequisites (task.json, pr_url, merge-pr agent)
 * 2. Sets up environment variables
 * 3. Spawns the merge-pr agent in background
 * 4. Registers the agent to the registry
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path (relative or absolute)
 * @param options - Phase options
 * @returns MergePRPhaseResult with success status and details
 */
export async function runMergePRPhase(
  repoRoot: string,
  taskDir: string,
  options?: MergePRPhaseOptions
): Promise<MergePRPhaseResult> {
  const { platform = "claude", verbose = true } = options || {};

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

  // =============================================================================
  // Validation
  // =============================================================================

  // 1. Check task.json exists
  const taskJsonPath = join(taskDirAbs, "task.json");
  if (!existsSync(taskJsonPath)) {
    return {
      success: false,
      error: `task.json not found at ${taskJsonPath}`,
    };
  }

  // 2. Read task.json
  const taskData = readTaskJson(taskDirAbs) as TaskData | null;
  if (!taskData) {
    return {
      success: false,
      error: "Failed to read task.json",
    };
  }

  // 3. Check pr_url exists
  if (!taskData.pr_url) {
    return {
      success: false,
      error: "task.json does not contain pr_url",
    };
  }

  // 4. Check merge-pr agent exists
  const mergePrMd = adapter.getAgentConfigPath("merge-pr", repoRoot);
  if (!existsSync(mergePrMd)) {
    return {
      success: false,
      error: `merge-pr.md not found at ${mergePrMd}. Platform: ${platform}`,
    };
  }

  // Get task identification
  const taskName = taskData.name || taskData.id || "unknown";

  // =============================================================================
  // Determine Working Directory
  // =============================================================================

  // Use worktree_path if it exists and is valid, otherwise use repoRoot
  let workingDir = repoRoot;
  if (taskData.worktree_path && existsSync(taskData.worktree_path)) {
    workingDir = taskData.worktree_path;
  }

  // =============================================================================
  // Set Up Environment
  // =============================================================================

  const env: Record<string, string> = { ...process.env } as Record<string, string>;

  // Task-specific environment variables
  env.MERGE_TASK_NAME = taskName;
  env.MERGE_TASK_DIR = taskDirRelative;
  env.MERGE_PR_URL = taskData.pr_url;
  if (taskData.worktree_path) {
    env.MERGE_WORKTREE_PATH = taskData.worktree_path;
  }

  // Proxy environment variables
  env.https_proxy = process.env.https_proxy || "";
  env.http_proxy = process.env.http_proxy || "";
  env.all_proxy = process.env.all_proxy || "";

  // Platform non-interactive env
  Object.assign(env, adapter.getNonInteractiveEnv());

  // =============================================================================
  // Build CLI Command
  // =============================================================================

  const prompt = `task_dir: ${taskDirAbs}

Merge the PR for this task.

PR URL: ${taskData.pr_url}

Check CI status, resolve conflicts if any, then merge.
Update task.json with merged_at, merge_commit, and status when done.`;

  const cliCmd = adapter.buildRunCommand({
    agent: "merge-pr",
    prompt,
    skipPermissions: true,
    verbose,
    jsonOutput: true,
  });

  // =============================================================================
  // Spawn Background Process
  // =============================================================================

  const logFile = join(taskDirAbs, "merge-pr.log.jsonl");

  // Create empty log file
  writeFileSync(logFile, "", "utf-8");

  // Open log file for writing
  const logFd = openSync(logFile, "w");

  // Spawn options
  const spawnOpts: SpawnOptions = {
    cwd: workingDir,
    env,
    stdio: ["ignore", logFd, logFd],
    detached: true,
  };

  let child: ChildProcess;
  try {
    child = spawn(cliCmd[0], cliCmd.slice(1), spawnOpts);
  } catch (error) {
    return {
      success: false,
      error: `Failed to spawn merge-pr agent: ${error}`,
    };
  }

  // Detach process so it continues running after parent exits
  child.unref();

  const agentPid = child.pid || 0;

  // =============================================================================
  // Register Agent to Registry
  // =============================================================================

  const agentId = `merge-pr-${taskName}`;

  registryAddAgent(
    {
      agentId,
      worktreePath: workingDir,
      pid: agentPid,
      taskDir: taskDirRelative,
      platform,
    },
    repoRoot
  );

  // =============================================================================
  // Return Result
  // =============================================================================

  return {
    success: true,
    agentId,
    pid: agentPid,
    logFile,
  };
}
