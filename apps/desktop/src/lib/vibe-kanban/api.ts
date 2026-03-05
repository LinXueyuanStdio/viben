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
import { NETWORK_RETRY_CONFIG } from "./constants";

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
 * Result type for checkTaskRunning with detailed status
 */
export interface CheckTaskRunningResult {
  /** Whether the task is running */
  running: boolean;
  /**
   * Whether the check result is reliable.
   * - true: The check completed successfully and the result can be trusted
   * - false: The check failed (network error, timeout) and the result is an assumption
   */
  reliable: boolean;
  /** Whether the check was successful (no network errors) - alias for reliable */
  success: boolean;
  /** Error message if check failed */
  error?: string;
  /** Number of retry attempts made */
  retryCount: number;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a task process is actually running
 *
 * This queries the Gateway to verify the task's worker process
 * is still active. Useful for detecting stuck tasks where the
 * status says "running" but the process has died.
 *
 * Uses retry logic with exponential backoff for network failures
 * to balance between avoiding false positives and detecting
 * genuinely stuck tasks.
 *
 * @param taskId - Task ID to check
 * @param timeoutMs - Timeout in milliseconds (default from NETWORK_RETRY_CONFIG)
 * @returns True if the task process is actively running
 */
export async function checkTaskRunning(
  taskId: string,
  timeoutMs: number = NETWORK_RETRY_CONFIG.timeoutMs
): Promise<boolean> {
  const result = await checkTaskRunningDetailed(taskId, timeoutMs);

  // If check failed after all retries, return true (assume running)
  // to avoid false positives during persistent network issues
  if (!result.success) {
    console.warn(
      `[checkTaskRunning] Failed after ${result.retryCount} retries for task ${taskId}: ${result.error}. ` +
      "Assuming task is running to avoid false positive stuck detection."
    );
    return true;
  }

  return result.running;
}

/**
 * Check if a task process is actually running (detailed version)
 *
 * Returns detailed result including success status and retry count.
 * Use this for more granular control over error handling.
 *
 * @param taskId - Task ID to check
 * @param timeoutMs - Timeout in milliseconds
 * @returns Detailed result with running status, success flag, and retry info
 */
export async function checkTaskRunningDetailed(
  taskId: string,
  timeoutMs: number = NETWORK_RETRY_CONFIG.timeoutMs
): Promise<CheckTaskRunningResult> {
  const { maxRetries, initialDelayMs, backoffMultiplier } = NETWORK_RETRY_CONFIG;
  let lastError: string | undefined;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Apply exponential backoff delay for retries
    if (attempt > 0) {
      const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      console.log(`[checkTaskRunning] Retry ${attempt}/${maxRetries} for task ${taskId} after ${delay}ms`);
      await sleep(delay);
      retryCount = attempt;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${getApiBaseUrl()}/api/queue/tasks/${encodeURIComponent(taskId)}/running`;
      const response = await fetch(url, { signal: controller.signal });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // HTTP error - task might not exist or server error
        // Don't retry for 404 (task not found) - this is a reliable result
        if (response.status === 404) {
          return {
            running: false,
            reliable: true,
            success: true,
            retryCount,
          };
        }

        lastError = `HTTP ${response.status}`;
        console.warn(`[checkTaskRunning] HTTP error for task ${taskId}: ${response.status}`);
        continue; // Retry on server errors
      }

      const data: TaskRunningResponse = await response.json();
      return {
        running: data.success && data.data?.running === true,
        reliable: true,
        success: true,
        retryCount,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          lastError = `Timeout (${timeoutMs}ms)`;
          console.warn(`[checkTaskRunning] Timeout for task ${taskId}, attempt ${attempt + 1}/${maxRetries + 1}`);
        } else {
          lastError = error.message;
          console.warn(`[checkTaskRunning] Network error for task ${taskId}: ${error.message}`);
        }
      } else {
        lastError = "Unknown error";
      }
      // Continue to next retry attempt
    }
  }

  // All retries exhausted - result is NOT reliable
  // Return running: true as a conservative default to avoid false positives
  return {
    running: true, // Conservative default: assume running to avoid false stuck detection
    reliable: false,
    success: false,
    error: lastError,
    retryCount,
  };
}

// Export API base URL for debugging
export { getApiBaseUrl as getApiBaseUrl };
