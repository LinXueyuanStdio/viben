/**
 * API client for kanban - connects to Viben Gateway
 */

import type {
  ApiResponse,
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

// API path prefix for kanban endpoints
const API_PREFIX = "/api/kanban";

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
 * Make a request to the kanban API via Gateway
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
        if (errorJson.message) {
          errorMessage = errorJson.message;
        }
        errorData = errorJson.error_data;
      } catch {
        // Ignore JSON parse errors
      }

      throw new VibeKanbanApiError(errorMessage, response.status, errorData);
    }

    const json: ApiResponse<T> = await response.json();

    if (!json.success) {
      throw new VibeKanbanApiError(
        json.message || "API request failed",
        undefined,
        json.error_data
      );
    }

    return json.data;
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
 * Health check
 */
export async function checkHealth(): Promise<boolean> {
  try {
    await makeRequest<string>(`${API_PREFIX}/health`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get tasks for a workspace
 * @param workspacePath - workspace path to filter tasks (empty for global tasks)
 */
export async function getTasks(workspacePath?: string): Promise<TaskWithAttemptStatus[]> {
  const params = workspacePath
    ? `?workspace_path=${encodeURIComponent(workspacePath)}`
    : "";
  return makeRequest<TaskWithAttemptStatus[]>(`${API_PREFIX}/tasks${params}`);
}

/**
 * Get a single task
 */
export async function getTask(taskId: string): Promise<Task> {
  return makeRequest<Task>(`${API_PREFIX}/tasks/${encodeURIComponent(taskId)}`);
}

/**
 * Create a new task
 */
export async function createTask(data: CreateTaskRequest): Promise<Task> {
  return makeRequest<Task>(`${API_PREFIX}/tasks`, {
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
  return makeRequest<Task>(`${API_PREFIX}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  await makeRequest<unknown>(`${API_PREFIX}/tasks/${encodeURIComponent(taskId)}`, {
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
