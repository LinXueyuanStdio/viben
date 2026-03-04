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
 * Task specs data response
 */
export interface TaskSpecsDataResponse {
  prd_content: string | null;
  prd_path: string | null;
  subtasks: TaskSpecSubtask[];
  logs: TaskLogs | null;
  task_dir: string; // Task directory path for file browsing
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

// =============================================================================
// Task State Machine API Types
// =============================================================================

/**
 * Task event types for state machine transitions
 */
export type TaskEventType =
  | 'QUEUE' | 'START' | 'DEQUEUE'
  | 'PLANNING_COMPLETE' | 'PLANNING_FAILED'
  | 'SUBTASK_COMPLETE' | 'ALL_SUBTASKS_DONE' | 'CODING_FAILED'
  | 'QA_PASSED' | 'QA_FAILED' | 'QA_FIXING_COMPLETE' | 'QA_FIXING_FAILED'
  | 'USER_STOPPED' | 'APPROVED' | 'REJECTED' | 'CREATE_PR'
  | 'RETRY' | 'ABANDON';

/**
 * Task event structure
 */
export interface TaskEvent {
  eventId: string;
  sequence: number;
  type: TaskEventType;
  timestamp: string;
  payload?: Record<string, unknown>;
}

/**
 * Result from applying an event
 */
export interface ApplyResult {
  success: boolean;
  error?: 'SEQUENCE_MISMATCH' | 'INVALID_TRANSITION';
  expected?: number;
  received?: number;
  currentState?: string;
  newState?: string;
}

/**
 * Task state response
 */
export interface TaskStateResponse {
  task_id: string;
  status: string;
  xstate_state?: string | Record<string, string>;
  last_event?: TaskEvent;
  review_reason?: string;
}

// =============================================================================
// Task State Machine API Functions
// =============================================================================

/**
 * Submit a task event to trigger state transition
 *
 * @param baseUrl - Gateway base URL
 * @param taskId - Task ID
 * @param workspacePath - Workspace path
 * @param event - Task event to submit
 * @returns Apply result with success status and new state
 */
export async function submitTaskEvent(
  baseUrl: string,
  taskId: string,
  workspacePath: string,
  event: TaskEvent
): Promise<ApplyResult> {
  const params = new URLSearchParams();
  params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/tasks/${encodeURIComponent(taskId)}/events?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    // For conflict errors (409), return the structured error
    if (response.status === 409) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error,
        expected: errorData.expected,
        received: errorData.received,
        currentState: errorData.current_state,
      };
    }

    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to submit task event: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return {
    success: true,
    newState: data.new_state,
  };
}

/**
 * Validate a task event without applying it
 *
 * @param baseUrl - Gateway base URL
 * @param taskId - Task ID
 * @param workspacePath - Workspace path
 * @param event - Task event to validate
 * @returns Apply result with validation status
 */
export async function validateTaskEvent(
  baseUrl: string,
  taskId: string,
  workspacePath: string,
  event: TaskEvent
): Promise<ApplyResult> {
  const params = new URLSearchParams();
  params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/tasks/${encodeURIComponent(taskId)}/events/validate?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    if (response.status === 409) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error,
        expected: errorData.expected,
        received: errorData.received,
        currentState: errorData.current_state,
      };
    }

    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to validate task event: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return {
    success: true,
    newState: data.new_state,
  };
}

/**
 * Get current task state including XState state and last event
 *
 * @param baseUrl - Gateway base URL
 * @param taskId - Task ID
 * @param workspacePath - Workspace path
 * @returns Task state response
 */
export async function getTaskState(
  baseUrl: string,
  taskId: string,
  workspacePath: string
): Promise<TaskStateResponse> {
  const params = new URLSearchParams();
  params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/tasks/${encodeURIComponent(taskId)}/state?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get task state: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get task event history
 *
 * @param baseUrl - Gateway base URL
 * @param taskId - Task ID
 * @param workspacePath - Workspace path
 * @returns Array of task events
 */
export async function getTaskEvents(
  baseUrl: string,
  taskId: string,
  workspacePath: string
): Promise<TaskEvent[]> {
  const params = new URLSearchParams();
  params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/tasks/${encodeURIComponent(taskId)}/events?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get task events: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.events ?? [];
}

/**
 * Create an EventSource for task events SSE stream
 *
 * @param baseUrl - Gateway base URL
 * @param taskId - Task ID
 * @param workspacePath - Workspace path
 * @returns EventSource for SSE stream
 */
export function subscribeTaskEvents(
  baseUrl: string,
  taskId: string,
  workspacePath: string
): EventSource {
  const params = new URLSearchParams();
  params.set("workspace_path", workspacePath);

  const url = `${baseUrl}/api/tasks/${encodeURIComponent(taskId)}/events/stream?${params.toString()}`;
  return new EventSource(url);
}
