/**
 * API client for kanban - connects to Viben Gateway
 * Uses unified /api/tasks endpoint
 */

import type {
  Task,
  TaskWithAttemptStatus,
  CreateTaskRequest,
  UpdateTaskRequest,
} from "./types";
import { getGatewayUrl } from "@/lib/gateway";

// Get Gateway URL dynamically
function getApiBaseUrl(): string {
  return getGatewayUrl();
}

// API path prefix for task endpoints (unified API)
const API_PREFIX = "/api/tasks";

/**
 * Custom error class for API errors
 */
export class VibeKanbanApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public errorData?: unknown
  ) {
    super(message);
    this.name = "VibeKanbanApiError";
  }
}

/**
 * Response format from unified /api/tasks endpoint
 */
interface TasksResponse {
  tasks: TaskWithAttemptStatus[];
}

/**
 * Make a request to the tasks API via Gateway
 */
async function makeRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `API request failed with status ${response.status}`;
      let errorData: unknown = null;

      try {
        const errorJson = await response.json();
        if (errorJson.error) {
          errorMessage = errorJson.error;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        }
        errorData = errorJson.error_data;
      } catch {
        // Ignore JSON parse errors
      }

      throw new VibeKanbanApiError(errorMessage, response.status, errorData);
    }

    const json = await response.json();
    return json as T;
  } catch (error) {
    if (error instanceof VibeKanbanApiError) {
      throw error;
    }

    // Network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new VibeKanbanApiError(
        "Cannot connect to Gateway. Is it running?"
      );
    }

    throw new VibeKanbanApiError(
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Health check (uses gateway health endpoint)
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const url = `${getApiBaseUrl()}/health`;
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get tasks for a workspace
 * @param workspacePath - workspace path to filter tasks (empty string for global tasks, undefined for all tasks)
 */
export async function getTasks(workspacePath?: string): Promise<TaskWithAttemptStatus[]> {
  // Build query params - use empty string to get global tasks (tasks without workspace)
  const params = workspacePath !== undefined
    ? `?workspace_path=${encodeURIComponent(workspacePath)}`
    : "";
  const response = await makeRequest<TasksResponse>(`${API_PREFIX}${params}`);
  return response.tasks;
}

/**
 * Get a single task
 */
export async function getTask(taskId: string): Promise<Task> {
  return makeRequest<Task>(`${API_PREFIX}/${encodeURIComponent(taskId)}`);
}

/**
 * Create a new task
 */
export async function createTask(data: CreateTaskRequest): Promise<Task> {
  return makeRequest<Task>(`${API_PREFIX}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update a task
 */
export async function updateTask(
  taskId: string,
  data: UpdateTaskRequest
): Promise<Task> {
  return makeRequest<Task>(`${API_PREFIX}/${encodeURIComponent(taskId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  await makeRequest<{ deleted: string }>(`${API_PREFIX}/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });
}

/**
 * Update task status (convenience method)
 */
export async function updateTaskStatus(
  taskId: string,
  status: Task["status"]
): Promise<Task> {
  return updateTask(taskId, { status });
}

/**
 * Response from the task running check endpoint
 */
interface TaskRunningResponse {
  success: boolean;
  data?: {
    task_id: string;
    running: boolean;
    status: string;
  };
  error?: string;
}

/**
 * Check if a task process is actually running
 *
 * This queries the Gateway to verify the task's worker process
 * is still active. Useful for detecting stuck tasks where the
 * status says "running" but the process has died.
 *
 * @param taskId - Task ID to check
 * @param timeoutMs - Timeout in milliseconds (default: 10000ms = 10 seconds)
 * @returns True if the task process is actively running
 */
export async function checkTaskRunning(
  taskId: string,
  timeoutMs: number = 10000
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${getApiBaseUrl()}/api/queue/tasks/${encodeURIComponent(taskId)}/running`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      console.warn(`[checkTaskRunning] Failed to check task ${taskId}: ${response.status}`);
      return false;
    }

    const data: TaskRunningResponse = await response.json();
    return data.success && data.data?.running === true;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`[checkTaskRunning] Timeout (${timeoutMs}ms) for task ${taskId}`);
    } else {
      console.error("[checkTaskRunning] Failed to check task running status:", error);
    }
    // On error/timeout, assume task might still be running to avoid false positives
    // Return true (running) to prevent marking healthy tasks as stuck due to network issues
    return true;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Export API base URL for debugging
export { getApiBaseUrl as getApiBaseUrl };
