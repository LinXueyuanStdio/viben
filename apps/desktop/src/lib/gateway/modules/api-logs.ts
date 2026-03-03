/**
 * API Logs Module
 * API 日志模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type { ApiLogEntry, ApiLogSummary, ApiLogSession } from "../types";

// ============================================================================
// API Logs
// ============================================================================

/**
 * Get API logs directory path
 */
export async function getApiLogsDirPath(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/api-logs/dir`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get API logs dir: ${errorMessage}`,
      response.status
    );
  }

  const result = await response.json();
  return result.path;
}

/**
 * Get API log sessions
 */
export async function getApiLogSessions(
  baseUrl: string
): Promise<ApiLogSession[]> {
  const response = await fetch(`${baseUrl}/api/api-logs/sessions`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get API log sessions: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get API logs for a run
 */
export async function getApiLogs(
  baseUrl: string,
  runId: string,
  options?: {
    limit?: number;
    offset?: number;
    providerFilter?: string;
    sourceFilter?: string;
    statusFilter?: string;
    methodFilter?: string;
  }
): Promise<ApiLogEntry[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));
  if (options?.providerFilter) params.set("provider_filter", options.providerFilter);
  if (options?.sourceFilter) params.set("source_filter", options.sourceFilter);
  if (options?.statusFilter) params.set("status_filter", options.statusFilter);
  if (options?.methodFilter) params.set("method_filter", options.methodFilter);

  const response = await fetch(
    `${baseUrl}/api/api-logs/${encodeURIComponent(runId)}?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get API logs: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get API log summary
 */
export async function getApiLogSummary(
  baseUrl: string,
  runId: string
): Promise<ApiLogSummary> {
  const response = await fetch(
    `${baseUrl}/api/api-logs/${encodeURIComponent(runId)}/summary`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get API log summary: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Clear API logs for a run
 */
export async function clearApiLogs(
  baseUrl: string,
  runId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/api-logs/${encodeURIComponent(runId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to clear API logs: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Open API logs directory
 */
export async function openApiLogsDir(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/api-logs/open`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to open API logs dir: ${errorMessage}`,
      response.status
    );
  }
}
