/**
 * Task PR creation operations
 *
 * Create pull requests from tasks
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  readTaskJson,
  updateTaskField,
  runGitCommand,
  getPhaseForAction,
  DIR_VIBEN,
  FILE_TASK_JSON,
} from "../../cli/lib/viben-workspace";

// =============================================================================
// Result Types
// =============================================================================

export interface CreatePROptions {
  dry_run?: boolean;
}

export interface CreatePRResult {
  success: boolean;
  pr_url?: string;
  task_name?: string;
  base_branch?: string;
  current_branch?: string;
  commit_message?: string;
  had_staged_changes?: boolean;
  unpushed_commits?: number;
  error?: string;
  /** True if running in local-only mode (no remote) */
  local_only?: boolean;
  /** Dry run info for display */
  dry_run_info?: {
    staged_files: string[];
    pr_title: string;
    pr_base: string;
    pr_head: string;
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if origin remote exists
 */
function hasOriginRemote(gitWorkDir: string): boolean {
  const { stdout } = runGitCommand(["remote"], gitWorkDir);
  const remotes = stdout.split("\n").map((r) => r.trim()).filter(Boolean);
  return remotes.includes("origin");
}

/**
 * Check if origin remote is GitHub
 */
function isGitHubRemote(gitWorkDir: string): boolean {
  const { stdout } = runGitCommand(["remote", "-v"], gitWorkDir);
  return stdout.includes("github.com");
}

/**
 * Run gh CLI command safely (no shell interpolation)
 */
function runGhCommand(args: string[], cwd: string): { code: number; stdout: string; stderr: string } {
  const result = spawnSync("gh", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return {
    code: result.status ?? 1,
    stdout: (result.stdout as string) || "",
    stderr: (result.stderr as string) || "",
  };
}

/**
 * Update task.json for PR creation
 */
function updateTaskForPR(
  taskDirPath: string,
  taskJsonPath: string,
  prUrl?: string
): void {
  let createPrPhase = getPhaseForAction(taskJsonPath, "create-pr");
  if (!createPrPhase) {
    createPrPhase = 4; // Default fallback
  }

  updateTaskField(taskDirPath, "status", "review");
  updateTaskField(taskDirPath, "current_phase", createPrPhase);
  updateTaskField(taskDirPath, "pr_created_at", new Date().toISOString());

  if (prUrl) {
    updateTaskField(taskDirPath, "pr_url", prUrl);
  }
}

// =============================================================================
// Create PR
// =============================================================================

/**
 * Create a pull request from a task
 *
 * This command should be run from the MAIN REPO, not the worktree.
 * If the task has a worktree_path, git operations will be performed there.
 * Task.json updates are always written to the main repo's task directory.
 *
 * @param repoRoot - The main repository root directory (NOT worktree)
 * @param taskNameOrPath - Task name or directory path (required)
 * @param options - Options including dry_run mode
 * @returns Result with PR URL and operation details
 */
export function createPR(
  repoRoot: string,
  taskNameOrPath: string,
  options: CreatePROptions = {}
): CreatePRResult {
  const dryRun = options.dry_run || false;
  const targetDir = taskNameOrPath;

  // Resolve task directory path (in main repo)
  const taskDirPath = targetDir.startsWith("/")
    ? targetDir
    : join(repoRoot, targetDir);

  const taskJsonPath = join(taskDirPath, FILE_TASK_JSON);
  if (!existsSync(taskJsonPath)) {
    return {
      success: false,
      error: `Task not found: ${targetDir}`,
    };
  }

  // Read task config
  const taskData = readTaskJson(taskDirPath);
  if (!taskData) {
    return {
      success: false,
      error: "Failed to read task.json",
    };
  }

  const taskName = (taskData.name as string) || "";
  const baseBranch = (taskData.base_branch as string) || "main";
  // Use task title directly as commit/PR title
  const taskTitle = (taskData.title as string) || taskName;

  // Determine where to run git operations
  // If task has worktree_path, git ops MUST run there (not in main repo)
  const worktreePath = taskData.worktree_path as string | undefined;
  const isWorktreeTask = taskData.worktree === true || !!worktreePath;

  // If this is a worktree task, worktree_path must exist
  if (isWorktreeTask) {
    if (!worktreePath) {
      return {
        success: false,
        error: "Task has worktree=true but worktree_path is not set. Run 'viben task create-worktree' first.",
      };
    }
    if (!existsSync(worktreePath)) {
      return {
        success: false,
        error: `Worktree path does not exist: ${worktreePath}. Run 'viben task create-worktree' first.`,
      };
    }
  }

  // Git operations run in worktree if it exists, otherwise in main repo
  const gitWorkDir = worktreePath && existsSync(worktreePath) ? worktreePath : repoRoot;

  // Check remote status early (before any operations that depend on it)
  const hasRemote = hasOriginRemote(gitWorkDir);
  const isGitHub = hasRemote && isGitHubRemote(gitWorkDir);

  // Get current branch (from git work directory)
  const { stdout: branchOut } = runGitCommand(["branch", "--show-current"], gitWorkDir);
  const currentBranch = branchOut.trim();

  // Stage changes (in git work directory)
  runGitCommand(["add", "-A"], gitWorkDir);

  // Exclude workspace and temp files (in git work directory)
  runGitCommand(["reset", `${DIR_VIBEN}/workspace/`], gitWorkDir);
  runGitCommand(["reset", "agent.log.jsonl", "session-id.txt"], gitWorkDir);

  // Check if there are staged changes
  const { code: diffCode } = runGitCommand(["diff", "--cached", "--quiet"], gitWorkDir);
  const hasStagedChanges = diffCode !== 0;

  let unpushedCommits = 0;
  const commitMsg = taskTitle;

  if (!hasStagedChanges) {
    // Check for unpushed commits (only if remote exists)
    if (hasRemote) {
      const { stdout: logOut, code: logCode } = runGitCommand(
        ["log", `origin/${currentBranch}..HEAD`, "--oneline"],
        gitWorkDir
      );
      // Only count if command succeeded (remote branch exists)
      if (logCode === 0) {
        unpushedCommits = logOut.split("\n").filter((line) => line.trim()).length;
      }
    }

    // For local-only mode, check if there are any local commits not in base branch
    if (!hasRemote) {
      const { stdout: localLogOut, code: localLogCode } = runGitCommand(
        ["log", `${baseBranch}..HEAD`, "--oneline"],
        gitWorkDir
      );
      if (localLogCode === 0) {
        unpushedCommits = localLogOut.split("\n").filter((line) => line.trim()).length;
      }
    }

    if (unpushedCommits === 0) {
      if (dryRun) {
        runGitCommand(["reset", "HEAD"], gitWorkDir);
      }
      return {
        success: false,
        error: "No changes to create PR",
      };
    }
  } else {
    // Commit changes (unless dry run)
    if (!dryRun) {
      runGitCommand(["commit", "-m", commitMsg], gitWorkDir);
    }
  }

  // Get staged files for dry run info
  let stagedFiles: string[] = [];
  if (dryRun && hasStagedChanges) {
    const { stdout: stagedOut } = runGitCommand(["diff", "--cached", "--name-only"], gitWorkDir);
    stagedFiles = stagedOut.split("\n").filter((line) => line.trim());
  }

  // Dry run mode: show what would be done
  if (dryRun) {
    // Reset staging area in dry run
    runGitCommand(["reset", "HEAD"], gitWorkDir);

    return {
      success: true,
      pr_url: hasRemote ? "https://github.com/example/repo/pull/DRY-RUN" : undefined,
      task_name: taskName,
      base_branch: baseBranch,
      current_branch: currentBranch,
      commit_message: commitMsg,
      had_staged_changes: hasStagedChanges,
      unpushed_commits: unpushedCommits,
      local_only: !hasRemote,
      dry_run_info: {
        staged_files: stagedFiles,
        pr_title: taskTitle,
        pr_base: baseBranch,
        pr_head: currentBranch,
      },
    };
  }

  // Local-only mode: no remote, skip push and PR creation but update status
  if (!hasRemote) {
    updateTaskForPR(taskDirPath, taskJsonPath);

    return {
      success: true,
      local_only: true,
      task_name: taskName,
      base_branch: baseBranch,
      current_branch: currentBranch,
      commit_message: commitMsg,
      had_staged_changes: hasStagedChanges,
      unpushed_commits: unpushedCommits,
    };
  }

  // Push to remote
  const { code: pushCode, stderr: pushErr } = runGitCommand(
    ["push", "-u", "origin", currentBranch],
    gitWorkDir
  );
  if (pushCode !== 0) {
    return {
      success: false,
      error: `Failed to push: ${pushErr}`,
    };
  }

  // Non-GitHub remote: skip PR creation but update status
  if (!isGitHub) {
    updateTaskForPR(taskDirPath, taskJsonPath);

    return {
      success: true,
      local_only: true,
      task_name: taskName,
      base_branch: baseBranch,
      current_branch: currentBranch,
      commit_message: commitMsg,
      had_staged_changes: hasStagedChanges,
      unpushed_commits: unpushedCommits,
    };
  }

  // GitHub flow: check if PR already exists
  let prUrl = "";
  const { stdout: existingPrOut, code: existingPrCode } = runGhCommand(
    ["pr", "list", "--head", currentBranch, "--base", baseBranch, "--json", "url", "--jq", ".[0].url"],
    gitWorkDir
  );

  if (existingPrCode === 0 && existingPrOut.trim()) {
    prUrl = existingPrOut.trim();
  }

  if (!prUrl) {
    // Read PRD as PR body (from main repo task directory)
    const prdFile = join(taskDirPath, "prd.md");
    const hasPrdBody = existsSync(prdFile);

    // Use --body-file to avoid shell escaping issues with markdown content
    let tempBodyFile: string | null = null;

    try {
      const ghArgs = ["pr", "create", "--draft", "--base", baseBranch, "--title", taskTitle];

      if (hasPrdBody) {
        // Create temp file for PR body to avoid shell escaping issues
        tempBodyFile = join(tmpdir(), `viben-pr-body-${Date.now()}.md`);
        const prBody = readFileSync(prdFile, "utf-8");
        writeFileSync(tempBodyFile, prBody, "utf-8");
        ghArgs.push("--body-file", tempBodyFile);
      } else {
        ghArgs.push("--body", "");
      }

      const { code: createCode, stdout: createOut, stderr: createErr } = runGhCommand(ghArgs, gitWorkDir);

      if (createCode !== 0) {
        return {
          success: false,
          error: `Failed to create PR: ${createErr || "Unknown error"}`,
        };
      }

      prUrl = createOut.trim();
    } finally {
      // Clean up temp file
      if (tempBodyFile && existsSync(tempBodyFile)) {
        try {
          unlinkSync(tempBodyFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  // Update task.json in MAIN REPO (not worktree copy)
  updateTaskForPR(taskDirPath, taskJsonPath, prUrl);

  return {
    success: true,
    pr_url: prUrl,
    task_name: taskName,
    base_branch: baseBranch,
    current_branch: currentBranch,
    commit_message: commitMsg,
    had_staged_changes: hasStagedChanges,
    unpushed_commits: unpushedCommits,
  };
}
