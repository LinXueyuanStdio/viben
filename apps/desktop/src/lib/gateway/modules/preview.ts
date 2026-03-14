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
 */
export type PreviewServerStatus = "starting" | "running" | "stopped" | "error";

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
 * Start a Vite preview server
 *
 * @param baseUrl - Gateway base URL
 * @param taskId - Task identifier
 * @param workDir - Working directory path
 * @param port - Optional preferred port
 * @returns Preview status
 */
export async function startPreview(
  baseUrl: string,
  taskId: string,
  workDir: string,
  port?: number
): Promise<PreviewStatusResponse> {
  const request: StartPreviewRequest = {
    task_id: taskId,
    work_dir: workDir,
    port,
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
