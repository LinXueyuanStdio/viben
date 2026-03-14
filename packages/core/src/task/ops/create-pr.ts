/**
 * Task PR creation operations
 *
 * Create pull requests from tasks
 */

import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

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
 * @param repoRoot - The repository root directory
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

  // Resolve path
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

  // Get current branch
  const { stdout: branchOut } = runGitCommand(["branch", "--show-current"], repoRoot);
  const currentBranch = branchOut.trim();

  // Stage changes
  runGitCommand(["add", "-A"], repoRoot);

  // Exclude workspace and temp files
  runGitCommand(["reset", `${DIR_VIBEN}/workspace/`], repoRoot);
  runGitCommand(["reset", "agent.log.jsonl", "session-id.txt"], repoRoot);

  // Check if there are staged changes
  const { code: diffCode } = runGitCommand(["diff", "--cached", "--quiet"], repoRoot);
  const hasStagedChanges = diffCode !== 0;

  let unpushedCommits = 0;
  const commitMsg = taskTitle;

  if (!hasStagedChanges) {
    // Check for unpushed commits
    const { stdout: logOut } = runGitCommand(
      ["log", `origin/${currentBranch}..HEAD`, "--oneline"],
      repoRoot
    );
    unpushedCommits = logOut.split("\n").filter((line) => line.trim()).length;

    if (unpushedCommits === 0) {
      if (dryRun) {
        runGitCommand(["reset", "HEAD"], repoRoot);
      }
      return {
        success: false,
        error: "No changes to create PR",
      };
    }
  } else {
    // Commit changes (unless dry run)
    if (!dryRun) {
      runGitCommand(["commit", "-m", commitMsg], repoRoot);
    }
  }

  // Get staged files for dry run info
  let stagedFiles: string[] = [];
  if (dryRun && hasStagedChanges) {
    const { stdout: stagedOut } = runGitCommand(["diff", "--cached", "--name-only"], repoRoot);
    stagedFiles = stagedOut.split("\n").filter((line) => line.trim());
  }

  // Push to remote (unless dry run)
  if (!dryRun) {
    const { code: pushCode, stderr: pushErr } = runGitCommand(
      ["push", "-u", "origin", currentBranch],
      repoRoot
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
    runGitCommand(["reset", "HEAD"], repoRoot);

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

  // Check if PR already exists
  try {
    const existingPrResult = execSync(
      `gh pr list --head "${currentBranch}" --base "${baseBranch}" --json url --jq ".[0].url"`,
      { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();

    if (existingPrResult) {
      prUrl = existingPrResult;
    }
  } catch {
    // No existing PR
  }

  if (!prUrl) {
    // Read PRD as PR body
    let prBody = "";
    const prdFile = join(taskDirPath, "prd.md");
    if (existsSync(prdFile)) {
      prBody = readFileSync(prdFile, "utf-8");
    }

    try {
      const createPrResult = execSync(
        `gh pr create --draft --base "${baseBranch}" --title "${prTitle}" --body "${prBody.replace(/"/g, '\\"')}"`,
        { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      ).trim();

      prUrl = createPrResult;
    } catch (err) {
      const error = err as { stderr?: string };
      return {
        success: false,
        error: `Failed to create PR: ${error.stderr || "Unknown error"}`,
      };
    }
  }

  // Update task.json
  let createPrPhase = getPhaseForAction(taskJsonPath, "create-pr");
  if (!createPrPhase) {
    createPrPhase = 4; // Default fallback
  }

  updateTaskField(taskDirPath, "status", "review");
  updateTaskField(taskDirPath, "pr_url", prUrl);
  updateTaskField(taskDirPath, "current_phase", createPrPhase);

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
