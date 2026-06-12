/**
 * Preview Module - Vite Preview Server Management
 * 预览模块 - Vite 预览服务器管理
 *
 * Provides API functions for managing live preview servers with HMR support.
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";

// ============================================================================
// Types
// ============================================================================

/**
 * Preview server status
 * Note: "idle" is a frontend-only status representing "stopped" or "not started"
 */
export type PreviewServerStatus = "idle" | "starting" | "running" | "stopped" | "error";

/**
 * Response from preview API endpoints
 */
export interface PreviewStatusResponse {
  /** Unique identifier for this preview instance */
  id: string;
  /** Associated task ID */
  taskId: string;
  /** Current status of the preview server */
  status: PreviewServerStatus;
  /** URL to access the preview (e.g., http://localhost:5173) */
  url?: string;
  /** Port number on the host */
  hostPort?: number;
  /** Error message if status is 'error' */
  error?: string;
  /** When the server was started */
  startedAt?: string;
  /** Last time the preview was accessed */
  lastAccessedAt?: string;
}

/**
 * Request to start a preview server
 */
export interface StartPreviewRequest {
  /** Task identifier */
  task_id: string;
  /** Working directory path containing the files to preview */
  work_dir: string;
  /** Preferred port (optional, auto-assign if not specified) */
  port?: number;
  /** Custom command to run (e.g., "npm run serve") */
  command?: string;
  /** Regex pattern to detect server ready in stdout/stderr */
  ready_pattern?: string;
  /** Startup timeout in milliseconds */
  timeout?: number;
}

/**
 * Request to stop a preview server
 */
export interface StopPreviewRequest {
  /** Task identifier */
  task_id: string;
}

/**
 * Response from stop-all endpoint
 */
export interface StopAllPreviewsResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Response from list endpoint
 */
export interface ListPreviewsResponse {
  previews: PreviewStatusResponse[];
  count: number;
}

/**
 * Response from node-available endpoint
 */
export interface NodeAvailableResponse {
  available: boolean;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Check if Node.js is available for live preview
 *
 * @param baseUrl - Gateway base URL
 * @returns Whether Node.js is available
 */
export async function checkNodeAvailable(baseUrl: string): Promise<boolean> {
  const response = await fetch(`${baseUrl}/api/preview/node-available`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    console.warn("[Preview] Failed to check Node.js availability");
    return false;
  }

  const data: NodeAvailableResponse = await response.json();
  return data.available;
}

/**
 * Start a preview server
 *
 * @param baseUrl - Gateway base URL
 * @param taskId - Task identifier
 * @param workDir - Working directory path
 * @param options - Optional server options (port, command, ready_pattern, timeout)
 * @returns Preview status
 */
export async function startPreview(
  baseUrl: string,
  taskId: string,
  workDir: string,
  options?: { port?: number; command?: string; ready_pattern?: string; timeout?: number }
): Promise<PreviewStatusResponse> {
  const request: StartPreviewRequest = {
    task_id: taskId,
    work_dir: workDir,
    port: options?.port,
    command: options?.command,
    ready_pattern: options?.ready_pattern,
    timeout: options?.timeout,
  };

  const response = await fetch(`${baseUrl}/api/preview/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to start preview: ${errorMessage}`,
      response.status,
      "PREVIEW_START_FAILED"
    );
  }

  return response.json();
}

/**
 * Stop a Vite preview server
 *
 * @param baseUrl - Gateway base URL
 * @param taskId - Task identifier
 * @returns Preview status
 */
export async function stopPreview(
  baseUrl: string,
  taskId: string
): Promise<PreviewStatusResponse> {
  const request: StopPreviewRequest = {
    task_id: taskId,
  };

  const response = await fetch(`${baseUrl}/api/preview/stop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to stop preview: ${errorMessage}`,
      response.status,
      "PREVIEW_STOP_FAILED"
    );
  }

  return response.json();
}

/**
 * Get status of a preview server
 *
 * @param baseUrl - Gateway base URL
 * @param taskId - Task identifier
 * @returns Preview status
 */
export async function getPreviewStatus(
  baseUrl: string,
  taskId: string
): Promise<PreviewStatusResponse> {
  const response = await fetch(
    `${baseUrl}/api/preview/status/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get preview status: ${errorMessage}`,
      response.status,
      "PREVIEW_STATUS_FAILED"
    );
  }

  return response.json();
}

/**
 * Stop all running preview servers
 *
 * @param baseUrl - Gateway base URL
 * @returns Success response
 */
export async function stopAllPreviews(
  baseUrl: string
): Promise<StopAllPreviewsResponse> {
  const response = await fetch(`${baseUrl}/api/preview/stop-all`, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to stop all previews: ${errorMessage}`,
      response.status,
      "PREVIEW_STOP_ALL_FAILED"
    );
  }

  return response.json();
}

/**
 * List all active preview servers
 *
 * @param baseUrl - Gateway base URL
 * @returns List of active previews
 */
export async function listPreviews(
  baseUrl: string
): Promise<ListPreviewsResponse> {
  const response = await fetch(`${baseUrl}/api/preview/list`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list previews: ${errorMessage}`,
      response.status,
      "PREVIEW_LIST_FAILED"
    );
  }

  return response.json();
}

/**
 * Kill the process occupying a specific port
 *
 * @param baseUrl - Gateway base URL
 * @param port - Port number to free
 * @returns Success status
 */
export async function killPort(
  baseUrl: string,
  port: number
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${baseUrl}/api/preview/kill-port`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ port }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to kill port: ${errorMessage}`,
      response.status,
      "PREVIEW_KILL_PORT_FAILED"
    );
  }

  return response.json();
}

// ============================================================================
// SSE Types and Functions
// ============================================================================

/**
 * SSE event types for preview startup
 */
export type PreviewSSEEventType =
  | "status"      // Status update
  | "log"         // Log message (stdout/stderr)
  | "retry"       // Port retry attempt
  | "complete"    // Startup complete (success or final error)
  | "error";      // Error during startup

/**
 * SSE event data for preview startup
 */
export interface PreviewSSEEvent {
  type: PreviewSSEEventType;
  data: {
    status?: PreviewServerStatus;
    message?: string;
    port?: number;
    attempt?: number;
    maxAttempts?: number;
    url?: string;
    error?: string;
    /** Final status object (only for 'complete' event) */
    result?: PreviewStatusResponse;
  };
}

/**
 * Callbacks for SSE preview events
 */
export interface PreviewSSECallbacks {
  onStatus?: (status: PreviewServerStatus, message?: string, port?: number, url?: string) => void;
  onLog?: (message: string) => void;
  onRetry?: (attempt: number, maxAttempts: number, message: string) => void;
  onComplete?: (result: PreviewStatusResponse) => void;
  onError?: (error: string) => void;
}

/**
 * Start a preview server with SSE streaming for real-time feedback
 *
 * @param baseUrl - Gateway base URL
 * @param taskId - Task identifier
 * @param workDir - Working directory path
 * @param options - Optional server options
 * @param callbacks - Event callbacks
 * @returns Abort function to cancel the SSE connection
 */
export function startPreviewWithSSE(
  baseUrl: string,
  taskId: string,
  workDir: string,
  options?: { port?: number; command?: string; ready_pattern?: string; timeout?: number },
  callbacks?: PreviewSSECallbacks
): () => void {
  const params = new URLSearchParams({
    task_id: taskId,
    work_dir: workDir,
  });

  if (options?.port !== undefined) {
    params.set("port", String(options.port));
  }
  if (options?.command) {
    params.set("command", options.command);
  }
  if (options?.ready_pattern) {
    params.set("ready_pattern", options.ready_pattern);
  }
  if (options?.timeout !== undefined) {
    params.set("timeout", String(options.timeout));
  }

  const url = `${baseUrl}/api/preview/start-sse?${params.toString()}`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const parsed: PreviewSSEEvent = JSON.parse(event.data);

      switch (parsed.type) {
        case "status":
          callbacks?.onStatus?.(
            parsed.data.status!,
            parsed.data.message,
            parsed.data.port,
            parsed.data.url
          );
          break;
        case "log":
          callbacks?.onLog?.(parsed.data.message ?? "");
          break;
        case "retry":
          callbacks?.onRetry?.(
            parsed.data.attempt ?? 0,
            parsed.data.maxAttempts ?? 10,
            parsed.data.message ?? ""
          );
          break;
        case "complete":
          if (parsed.data.result) {
            callbacks?.onComplete?.(parsed.data.result);
          }
          eventSource.close();
          break;
        case "error":
          callbacks?.onError?.(parsed.data.error ?? "Unknown error");
          break;
      }
    } catch (err) {
      console.error("[Preview SSE] Failed to parse event:", err, event.data);
    }
  };

  eventSource.onerror = (err) => {
    // EventSource errors don't provide much detail
    // Check readyState to determine connection status
    const errorMsg = eventSource.readyState === EventSource.CLOSED
      ? "SSE connection closed by server"
      : "SSE connection error - network issue or server unavailable";
    console.error("[Preview SSE] Connection error:", err, "readyState:", eventSource.readyState);
    callbacks?.onError?.(errorMsg);
    eventSource.close();
  };

  // Return abort function
  return () => {
    eventSource.close();
  };
}
