/**
 * Telemetry Module
 * 遥测模块 - 获取 trace 数据用于可视化
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type { TraceTree } from "@/components/observability/types";

// Re-export TraceTree type
export type { TraceTree };

/**
 * Trace stats
 */
export interface TraceStats {
  totalSpans: number;
  successSpans: number;
  errorSpans: number;
  maxDepth: number;
  operations: Array<{
    name: string;
    count: number;
    totalDuration: number;
    avgDuration: number;
  }>;
}

/**
 * Trace detail response from API
 */
export interface TraceDetailResponse {
  traceId: string;
  date: string;
  tree: TraceTree;
  stats: TraceStats;
}

/**
 * Trace list item
 */
export interface TraceListItem {
  traceId: string;
  size: number;
  mtime: string;
}

/**
 * Traces list response
 */
export interface TracesListResponse {
  date: string;
  route: string | null;
  count: number;
  traces: TraceListItem[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get trace details by ID
 *
 * @param baseUrl - Gateway base URL
 * @param traceId - The trace ID to fetch
 * @param date - Optional date (defaults to today)
 * @returns Trace tree with stats
 */
export async function getTrace(
  baseUrl: string,
  traceId: string,
  date?: string
): Promise<TraceDetailResponse> {
  const params = new URLSearchParams();
  if (date) params.set("date", date);

  const response = await fetch(
    `${baseUrl}/api/telemetry/trace/${encodeURIComponent(traceId)}?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get trace: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * List traces for a date
 *
 * @param baseUrl - Gateway base URL
 * @param date - Date to list traces for (defaults to today)
 * @param route - Optional route filter
 * @returns List of traces
 */
export async function listTraces(
  baseUrl: string,
  date?: string,
  route?: string
): Promise<TracesListResponse> {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (route) params.set("route", route);

  const response = await fetch(
    `${baseUrl}/api/telemetry/traces?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list traces: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get telemetry stats
 *
 * @param baseUrl - Gateway base URL
 * @returns Telemetry stats
 */
export async function getTelemetryStats(
  baseUrl: string
): Promise<{
  directory: string;
  dates: number;
  totalTraces: number;
  totalSizeBytes: number;
  totalSizeMB: string;
}> {
  const response = await fetch(`${baseUrl}/api/telemetry/stats`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get telemetry stats: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
