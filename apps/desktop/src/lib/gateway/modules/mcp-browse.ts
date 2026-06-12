/**
 * MCP Browse Module - Port and Process Utilities
 * MCP 浏览模块 - 端口和进程工具
 */

import type { PortStatus } from "../types";

// ============================================================================
// Port Management
// ============================================================================

/**
 * Check port status
 */
export async function checkPortStatus(
  baseUrl: string,
  port: number
): Promise<PortStatus> {
  const response = await fetch(`${baseUrl}/api/mcp/port/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ port }),
  });

  if (!response.ok) {
    return { in_use: false, pid: null, process_name: null };
  }

  return response.json();
}

/**
 * Kill a process by PID
 */
export async function killProcess(
  baseUrl: string,
  pid: number
): Promise<boolean> {
  const response = await fetch(`${baseUrl}/api/mcp/process/kill`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ pid }),
  });

  if (!response.ok) {
    return false;
  }

  const result = await response.json();
  return result.success;
}

/**
 * Check if a process is alive
 */
export async function isProcessAlive(
  baseUrl: string,
  pid: number
): Promise<boolean> {
  // Log call stack for debugging frequent requests
  console.log("[API] isProcessAlive called, pid:", pid, new Error().stack?.split("\n").slice(1, 5).join("\n"));

  const response = await fetch(`${baseUrl}/api/mcp/process/alive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ pid }),
  });

  if (!response.ok) {
    return false;
  }

  const result = await response.json();
  return result.alive;
}
