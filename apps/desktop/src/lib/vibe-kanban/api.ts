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

// Export API base URL for debugging
export { getApiBaseUrl as getApiBaseUrl };
