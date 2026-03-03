/**
 * Tasks Module
 * 任务模块 - 提供任务相关的 Gateway API
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";

// =============================================================================
// Types
// =============================================================================

/**
 * Subtask status
 */
export type SubtaskStatus = "pending" | "in_progress" | "completed" | "failed";

/**
 * Implementation plan subtask
 */
export interface TaskSpecSubtask {
  id: string;
  title: string;
  description?: string;
  status: SubtaskStatus;
  files?: string[];
  order?: number;
}

/**
 * Log entry type
 */
export type TaskLogEntryType =
  | "text"
  | "error"
  | "warning"
  | "success"
  | "info"
  | "tool_start"
  | "tool_end";

/**
 * A single log entry
 */
export interface TaskLogEntry {
  id: string;
  type: TaskLogEntryType;
  message: string;
  timestamp: string;
  details?: string;
}

/**
 * Log phase status
 */
export type TaskLogPhaseStatus = "pending" | "running" | "complete" | "failed";

/**
 * A log phase
 */
export interface TaskLogPhase {
  id: string;
  name: string;
  status: TaskLogPhaseStatus;
  entries: TaskLogEntry[];
}

/**
 * Task logs
 */
export interface TaskLogs {
  phases: TaskLogPhase[];
}

/**
 * Task file entry
 */
export interface TaskFileEntry {
  path: string;
  name: string;
  type: "file" | "directory";
  extension?: string;
}

/**
 * Task specs data response
 */
export interface TaskSpecsDataResponse {
  prd_content: string | null;
  prd_path: string | null;
  subtasks: TaskSpecSubtask[];
  logs: TaskLogs | null;
  files: TaskFileEntry[];
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Get task specs data (PRD, subtasks, logs, files)
 *
 * @param baseUrl - Gateway base URL
 * @param taskId - Task ID
 * @param workspacePath - Workspace path
 * @returns Task specs data
 */
export async function getTaskSpecsData(
  baseUrl: string,
  taskId: string,
  workspacePath: string
): Promise<TaskSpecsDataResponse> {
  const params = new URLSearchParams();
  params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/tasks/${encodeURIComponent(taskId)}/specs?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get task specs: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
