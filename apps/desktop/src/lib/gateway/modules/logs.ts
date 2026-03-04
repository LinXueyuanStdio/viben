/**
 * Logs Module
 * 会话日志模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type { LogLevel, LogEntry, LogSessionSummary } from "../types";

// ============================================================================
// Session Logs
// ============================================================================

/**
 * Initialize logs system
 */
export async function initLogs(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/logs/init`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to initialize logs: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Get logs directory path
 */
export async function getLogsDirPath(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/logs/dir`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get logs dir: ${errorMessage}`,
      response.status
    );
  }

  const result = await response.json();
  return result.path;
}

/**
 * Get log sessions
 */
export async function getLogSessions(
  baseUrl: string,
  serverId?: string
): Promise<LogSessionSummary> {
  const params = new URLSearchParams();
  if (serverId) params.set("server_id", serverId);

  const response = await fetch(
    `${baseUrl}/api/logs/sessions?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get log sessions: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get session logs
 */
export async function getSessionLogs(
  baseUrl: string,
  sessionId: string,
  levelFilter?: string,
  limit?: number
): Promise<LogEntry[]> {
  const params = new URLSearchParams();
  if (levelFilter) params.set("level_filter", levelFilter);
  if (limit) params.set("limit", String(limit));

  const response = await fetch(
    `${baseUrl}/api/logs/session/${encodeURIComponent(sessionId)}?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get session logs: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Add a log entry
 */
export async function addLog(
  baseUrl: string,
  level: LogLevel,
  message: string,
  source?: string,
  sessionId?: string
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/logs/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      level,
      message,
      source,
      session_id: sessionId,
    }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to add log: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Clear session logs
 */
export async function clearSessionLogs(
  baseUrl: string,
  sessionId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/logs/session/${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to clear session logs: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Clear all logs
 */
export async function clearLogs(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/logs`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to clear logs: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Cleanup old sessions
 */
export async function cleanupOldSessions(
  baseUrl: string,
  keepCount = 10
): Promise<number> {
  const response = await fetch(`${baseUrl}/api/logs/cleanup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ keep_count: keepCount }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to cleanup sessions: ${errorMessage}`,
      response.status
    );
  }

  const result = await response.json();
  return result.deleted;
}

/**
 * Export session logs
 */
export async function exportSessionLogs(
  baseUrl: string,
  sessionId: string,
  exportPath: string
): Promise<string> {
  const response = await fetch(
    `${baseUrl}/api/logs/session/${encodeURIComponent(sessionId)}/export`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ export_path: exportPath }),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to export session logs: ${errorMessage}`,
      response.status
    );
  }

  const result = await response.json();
  return result.exported;
}
