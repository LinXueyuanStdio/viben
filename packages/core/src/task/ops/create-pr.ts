/**
 * Task PR creation operations
 *
 * Create pull requests from tasks
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
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
  dryRun?: boolean;
}

export interface CreatePRResult {
  success: boolean;
  prUrl?: string;
  taskName?: string;
  baseBranch?: string;
  currentBranch?: string;
  commitMessage?: string;
  hadStagedChanges?: boolean;
  unpushedCommits?: number;
  error?: string;
  /** Dry run info for display */
  dryRunInfo?: {
    stagedFiles: string[];
    prTitle: string;
    prBase: string;
    prHead: string;
  };
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
 * @param options - Options including dryRun mode
 * @returns Result with PR URL and operation details
 */
export function createPR(
  repoRoot: string,
  taskNameOrPath: string,
  options: CreatePROptions = {}
): CreatePRResult {
  const dryRun = options.dryRun || false;
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
    // Check for unpushed commits
    const { stdout: logOut } = runGitCommand(
      ["log", `origin/${currentBranch}..HEAD`, "--oneline"],
      gitWorkDir
    );
    unpushedCommits = logOut.split("\n").filter((line) => line.trim()).length;

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

  // Push to remote (unless dry run)
  if (!dryRun) {
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
  }

  // Create PR
  const prTitle = taskTitle;
  let prUrl = "";

  if (dryRun) {
    prUrl = "https://github.com/example/repo/pull/DRY-RUN";
    // Reset staging area in dry run
    runGitCommand(["reset", "HEAD"], gitWorkDir);

    return {
      success: true,
      prUrl,
      taskName,
      baseBranch,
      currentBranch,
      commitMessage: commitMsg,
      hadStagedChanges: hasStagedChanges,
      unpushedCommits,
      dryRunInfo: {
        stagedFiles,
        prTitle,
        prBase: baseBranch,
        prHead: currentBranch,
      },
    };
  }

  // Check if PR already exists (gh commands run in git work directory)
  try {
    const existingPrResult = execSync(
      `gh pr list --head "${currentBranch}" --base "${baseBranch}" --json url --jq ".[0].url"`,
      { cwd: gitWorkDir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();

    if (existingPrResult) {
      prUrl = existingPrResult;
    }
  } catch {
    // No existing PR
  }

  if (!prUrl) {
    // Read PRD as PR body (from main repo task directory)
    const prdFile = join(taskDirPath, "prd.md");
    const hasPrdBody = existsSync(prdFile);

    // Use --body-file to avoid shell escaping issues with markdown content
    // Write PR body to a temp file to handle special characters and newlines properly
    let tempBodyFile: string | null = null;

    try {
      let ghCreateCmd: string;

      if (hasPrdBody) {
        // Create temp file for PR body to avoid shell escaping issues
        tempBodyFile = join(tmpdir(), `viben-pr-body-${Date.now()}.md`);
        const prBody = readFileSync(prdFile, "utf-8");
        writeFileSync(tempBodyFile, prBody, "utf-8");

        // Escape title for shell (only need to handle double quotes in title)
        const escapedTitle = prTitle.replace(/"/g, '\\"');
        ghCreateCmd = `gh pr create --draft --base "${baseBranch}" --title "${escapedTitle}" --body-file "${tempBodyFile}"`;
      } else {
        // No body file, create PR with empty body
        const escapedTitle = prTitle.replace(/"/g, '\\"');
        ghCreateCmd = `gh pr create --draft --base "${baseBranch}" --title "${escapedTitle}" --body ""`;
      }

      const createPrResult = execSync(ghCreateCmd, {
        cwd: gitWorkDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();

      prUrl = createPrResult;
    } catch (err) {
      const error = err as { stderr?: string };
      return {
        success: false,
        error: `Failed to create PR: ${error.stderr || "Unknown error"}`,
      };
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
  // taskDirPath always points to main repo's task directory
  let createPrPhase = getPhaseForAction(taskJsonPath, "create-pr");
  if (!createPrPhase) {
    createPrPhase = 4; // Default fallback
  }

  updateTaskField(taskDirPath, "status", "review");
  updateTaskField(taskDirPath, "pr_url", prUrl);
  updateTaskField(taskDirPath, "current_phase", createPrPhase);
  updateTaskField(taskDirPath, "prCreatedAt", new Date().toISOString());

  return {
    success: true,
    prUrl,
    taskName,
    baseBranch,
    currentBranch,
    commitMessage: commitMsg,
    hadStagedChanges: hasStagedChanges,
    unpushedCommits,
  };
}
