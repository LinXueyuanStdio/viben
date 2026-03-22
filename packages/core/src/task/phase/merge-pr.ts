/**
 * Merge PR Phase Runner
 *
 * Merges a PR for a task. First attempts direct merge via gh CLI,
 * falls back to merge-pr agent for complex cases (CI failures, conflicts).
 *
 * Prerequisites:
 *    - task.json must exist
 *    - task.json must contain pr_url
 *
 * Flow:
 *    1. Check PR status (CI, mergeable, draft)
 *    2. If draft, mark as ready for review
 *    3. Attempt direct merge via gh CLI
 *    4. If direct merge fails, optionally run merge-pr agent
 *    5. Update task.json with merged_at, merge_commit
 */

import { spawnSync, execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
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
  /** Use agent for merge (default: false, uses direct gh CLI) */
  useAgent?: boolean;
  /** PR URL override (if not reading from task.json) */
  prUrl?: string;
}

/**
 * Result of running the merge-pr phase
 */
export interface MergePRPhaseResult {
  /** Whether the merge completed successfully */
  success: boolean;
  /** Merge commit hash */
  mergeCommit?: string;
  /** Whether agent was used (vs direct merge) */
  usedAgent?: boolean;
  /** Agent ID for tracking (if agent was used) */
  agentId?: string;
  /** Process ID of the spawned agent (if agent was used) */
  pid?: number;
  /** Path to the log file (if agent was used) */
  logFile?: string;
  /** Exit code of the merge agent process (if agent was used) */
  exitCode?: number;
  /** Error message if failed */
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
// Direct Merge Function (gh CLI)
// =============================================================================

/**
 * Merge a PR directly using gh CLI
 *
 * @param prUrl - PR URL to merge
 * @param workingDir - Working directory (repo root or worktree)
 * @returns Object with success status, merge commit hash, and any errors
 */
function mergePRDirect(
  prUrl: string,
  workingDir: string
): { success: boolean; mergeCommit?: string; error?: string } {
  try {
    // First check PR status
    const checkResult = execSync(
      `gh pr view "${prUrl}" --json state,mergeable,mergeCommit,isDraft`,
      { cwd: workingDir, encoding: "utf-8", timeout: 30000 }
    );
    const prInfo = JSON.parse(checkResult);

    // If already merged, return the merge commit
    if (prInfo.state === "MERGED") {
      return {
        success: true,
        mergeCommit: prInfo.mergeCommit?.oid || undefined,
      };
    }

    // If closed without merge, fail
    if (prInfo.state === "CLOSED") {
      return { success: false, error: "PR is closed without being merged" };
    }

    // If not mergeable, fail
    if (prInfo.mergeable === "CONFLICTING") {
      return { success: false, error: "PR has merge conflicts" };
    }

    // If PR is a draft, mark it as ready for review first
    if (prInfo.isDraft) {
      execSync(
        `gh pr ready "${prUrl}"`,
        { cwd: workingDir, encoding: "utf-8", timeout: 30000 }
      );
    }

    // Merge the PR (without --delete-branch since we already cleaned up the local branch)
    execSync(
      `gh pr merge "${prUrl}" --merge`,
      { cwd: workingDir, encoding: "utf-8", timeout: 60000 }
    );

    // Get the merge commit hash
    const mergeResult = execSync(
      `gh pr view "${prUrl}" --json mergeCommit`,
      { cwd: workingDir, encoding: "utf-8", timeout: 30000 }
    );
    const mergeInfo = JSON.parse(mergeResult);

    return {
      success: true,
      mergeCommit: mergeInfo.mergeCommit?.oid || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Run the merge-pr phase for a task (synchronous)
 *
 * This function:
 * 1. Validates prerequisites (task.json, pr_url)
 * 2. Attempts direct merge via gh CLI (fast path)
 * 3. If useAgent=true or direct merge fails with conflicts, spawns merge-pr agent
 * 4. Returns result with merge commit hash
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path (relative or absolute)
 * @param options - Phase options
 * @returns MergePRPhaseResult with success status and merge commit
 */
export function runMergePRPhase(
  repoRoot: string,
  taskDir: string,
  options?: MergePRPhaseOptions
): MergePRPhaseResult {
  const { platform = "claude", verbose = true, useAgent = false, prUrl: prUrlOverride } = options || {};

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

  // 3. Get pr_url (from override or task.json)
  const prUrl = prUrlOverride || taskData.pr_url;
  if (!prUrl) {
    return {
      success: false,
      error: "No pr_url provided (neither in options nor task.json)",
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
  // Try Direct Merge First (unless useAgent is explicitly requested)
  // =============================================================================

  if (!useAgent) {
    const directResult = mergePRDirect(prUrl, workingDir);
    if (directResult.success) {
      return {
        success: true,
        mergeCommit: directResult.mergeCommit,
        usedAgent: false,
      };
    }

    // If direct merge failed due to conflicts, we could try agent
    // For now, just return the error (agent can be requested via useAgent=true)
    if (!directResult.error?.includes("merge conflicts")) {
      return {
        success: false,
        error: directResult.error,
        usedAgent: false,
      };
    }

    // Fall through to agent for conflict resolution
  }

  // =============================================================================
  // Check merge-pr agent exists (only needed if using agent)
  // =============================================================================

  const mergePrMd = adapter.getAgentConfigPath("merge-pr", repoRoot);
  if (!existsSync(mergePrMd)) {
    return {
      success: false,
      error: `merge-pr.md not found at ${mergePrMd}. Platform: ${platform}`,
    };
  }

  // =============================================================================
  // Set Up Environment for Agent
  // =============================================================================

  const env: Record<string, string> = { ...process.env } as Record<string, string>;

  // Task-specific environment variables
  env.MERGE_TASK_NAME = taskName;
  env.MERGE_TASK_DIR = taskDirRelative;
  env.MERGE_PR_URL = prUrl;
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
  // Build CLI Command for Agent
  // =============================================================================

  const prompt = `task_dir: ${taskDirAbs}

Merge the PR for this task.

PR URL: ${prUrl}

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
  // Spawn Agent Process Synchronously
  // =============================================================================

  const logFile = join(taskDirAbs, "merge-pr.log.jsonl");

  // Create empty log file
  writeFileSync(logFile, "", "utf-8");

  // Spawn synchronously and wait for completion
  const result = spawnSync(cliCmd[0], cliCmd.slice(1), {
    cwd: workingDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
  });

  // Write output to log file
  const output = (result.stdout || "") + (result.stderr || "");
  writeFileSync(logFile, output, "utf-8");

  const exitCode = result.status ?? 1;
  const agentPid = result.pid || 0;

  // =============================================================================
  // Register Agent to Registry
  // =============================================================================

  const agentId = `merge-pr-${taskName}`;

  registryAddAgent(
    {
      agentId,
      worktreePath: workingDir,
      pid: agentPid,
      taskDir: taskDirAbs, // Store absolute path
      platform,
    },
    repoRoot
  );

  // =============================================================================
  // Return Result
  // =============================================================================

  const success = exitCode === 0;

  // If agent succeeded, try to get merge commit from task.json (agent should have updated it)
  let mergeCommit: string | undefined;
  if (success) {
    const updatedTaskData = readTaskJson(taskDirAbs) as { merge_commit?: string } | null;
    mergeCommit = updatedTaskData?.merge_commit;
  }

  return {
    success,
    mergeCommit,
    usedAgent: true,
    agentId,
    pid: agentPid,
    logFile,
    exitCode,
    error: success ? undefined : `Merge agent exited with code ${exitCode}`,
  };
}
