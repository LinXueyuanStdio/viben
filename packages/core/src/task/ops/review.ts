/**
 * Task review operations
 *
 * Operations for reviewing tasks, including PR info retrieval
 */

import { execSync } from "node:child_process";

import type { TaskJson } from "./types";
import { viewTask } from "./crud";

// =============================================================================
// Types
// =============================================================================

export interface PRInfo {
  additions?: number;
  deletions?: number;
  changedFiles?: number;
}

export interface ReviewTaskResult {
  success: boolean;
  task?: TaskJson;
  dirName?: string;
  prInfo?: PRInfo;
  error?: string;
}

// =============================================================================
// Review Task
// =============================================================================

/**
 * Get task details for review, including PR info if available
 */
export function reviewTask(repoRoot: string, taskName: string): ReviewTaskResult {
  const result = viewTask(repoRoot, taskName);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    };
  }

  const task = result.task!;
  const dirName = taskName; // simplified, in CLI we extract from path

  // Try to get PR info if pr_url exists
  let prInfo: PRInfo = {};
  if (task.pr_url) {
    try {
      const prUrl = task.pr_url;
      // Extract PR number from URL
      const prMatch = prUrl.match(/\/pull\/(\d+)/);
      if (prMatch) {
        const ghResult = execSync(
          `gh pr view ${prMatch[1]} --json additions,deletions,changedFiles 2>/dev/null`,
          { cwd: repoRoot, encoding: "utf-8" }
        );
        prInfo = JSON.parse(ghResult);
      }
    } catch {
      // Ignore gh errors
    }
  }

  return {
    success: true,
    task,
    dirName,
    prInfo,
  };
}
