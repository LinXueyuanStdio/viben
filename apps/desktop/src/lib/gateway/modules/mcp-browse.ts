/**
 * MCP Browse Module - Browse-MCP Process Management
 * MCP 浏览模块 - Browse-MCP 进程管理
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type { McpStatus, McpStartConfig, PortStatus } from "../types";

// ============================================================================
// Browse-MCP Server Management
// ============================================================================

/**
 * Get browse-mcp server status
 */
export async function getMcpStatus(baseUrl: string): Promise<McpStatus> {
  const response = await fetch(`${baseUrl}/api/mcp/browse/status`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get MCP status: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Start browse-mcp server
 */
export async function startMcpServer(
  baseUrl: string,
  config: McpStartConfig
): Promise<McpStatus> {
  const response = await fetch(`${baseUrl}/api/mcp/browse/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to start MCP server: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Stop browse-mcp server
 */
export async function stopMcpServer(
  baseUrl: string
): Promise<{ success: boolean }> {
  const response = await fetch(`${baseUrl}/api/mcp/browse/stop`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to stop MCP server: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Test browse-mcp connection
 */
export async function testMcpConnection(
  baseUrl: string,
  pythonPath: string
): Promise<boolean> {
  const response = await fetch(`${baseUrl}/api/mcp/browse/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ python_path: pythonPath }),
  });

  if (!response.ok) {
    return false;
  }

  const result = await response.json();
  return result.connected;
}

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
