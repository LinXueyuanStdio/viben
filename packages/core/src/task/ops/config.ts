/**
 * Task configuration operations
 *
 * Setters for task fields (branch, base_branch, agent)
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  resolveTaskDirectory,
  updateTaskField,
  FILE_TASK_JSON,
} from "../../cli/lib/viben-workspace";

// =============================================================================
// Result Types
// =============================================================================

export interface SetFieldResult {
  success: boolean;
  task?: string;
  field?: string;
  value?: string;
  error?: string;
}

// =============================================================================
// Set Task Field
// =============================================================================

/**
 * Set a field in task.json
 */
export function setTaskField(
  repoRoot: string,
  taskName: string,
  field: string,
  value: string
): SetFieldResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);

  if (!taskDir || !existsSync(join(taskDir, FILE_TASK_JSON))) {
    return {
      success: false,
      error: `Task not found: ${taskName}`,
    };
  }

  if (updateTaskField(taskDir, field, value)) {
    return {
      success: true,
      task: taskName,
      field,
      value,
    };
  } else {
    return {
      success: false,
      error: `Failed to update task.json field: ${field}`,
    };
  }
}

// =============================================================================
// Convenience Methods
// =============================================================================

/**
 * Set task branch
 */
export function setTaskBranch(
  repoRoot: string,
  taskName: string,
  branch: string
): SetFieldResult {
  return setTaskField(repoRoot, taskName, "branch", branch);
}

/**
 * Set task base branch (PR target)
 */
export function setTaskBaseBranch(
  repoRoot: string,
  taskName: string,
  baseBranch: string
): SetFieldResult {
  return setTaskField(repoRoot, taskName, "base_branch", baseBranch);
}

/**
 * Set task agent
 */
export function setTaskAgent(
  repoRoot: string,
  taskName: string,
  agent: string
): SetFieldResult {
  return setTaskField(repoRoot, taskName, "agent", agent);
}
