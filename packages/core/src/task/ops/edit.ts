/**
 * Task edit operations
 *
 * Edit task.json in external editor
 */

import { existsSync } from "node:fs";
import { spawn } from "child_process";
import { join } from "node:path";

import {
  resolveTaskDirectory,
  FILE_TASK_JSON,
} from "../../cli/lib/viben-workspace";

// =============================================================================
// Result Types
// =============================================================================

export interface EditTaskResult {
  success: boolean;
  taskJsonPath?: string;
  editor?: string;
  error?: string;
}

export interface EditTaskCallbacks {
  onClose?: (code: number | null) => void;
  onError?: (error: Error) => void;
}

// =============================================================================
// Edit Task
// =============================================================================

/**
 * Open task.json in the user's preferred editor
 *
 * @param repoRoot - The repository root directory
 * @param taskName - Task name or directory path
 * @param callbacks - Optional callbacks for editor events
 * @returns Result with task path and editor info, plus spawned child process
 */
export function editTask(
  repoRoot: string,
  taskName: string,
  callbacks?: EditTaskCallbacks
): { result: EditTaskResult; child?: ReturnType<typeof spawn> } {
  // Resolve task directory
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir) {
    return {
      result: {
        success: false,
        error: `Task not found: ${taskName}`,
      },
    };
  }

  const taskJsonPath = join(taskDir, FILE_TASK_JSON);

  if (!existsSync(taskJsonPath)) {
    return {
      result: {
        success: false,
        error: `Task not found: ${taskName}`,
      },
    };
  }

  // Get editor from environment
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";

  // Spawn editor process
  const child = spawn(editor, [taskJsonPath], {
    stdio: "inherit",
    shell: true,
  });

  // Set up callbacks if provided
  if (callbacks?.onClose) {
    child.on("close", callbacks.onClose);
  }

  if (callbacks?.onError) {
    child.on("error", callbacks.onError);
  }

  return {
    result: {
      success: true,
      taskJsonPath,
      editor,
    },
    child,
  };
}
