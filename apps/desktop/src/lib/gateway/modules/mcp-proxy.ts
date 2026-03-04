/**
 * MCP Proxy Module
 * MCP 代理模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  McpProxyStatus,
  McpProxyConfig,
  PortProcess,
  McpServerPortStatus,
} from "../types";

// ============================================================================
// MCP Proxy Management
// ============================================================================

/**
 * Get MCP proxy status
 */
export async function getMcpProxyStatus(
  baseUrl: string
): Promise<McpProxyStatus> {
  const response = await fetch(`${baseUrl}/api/mcp/proxy/status`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get MCP proxy status: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Check if MCP proxy is installed
 */
export async function checkMcpProxyInstalled(
  baseUrl: string,
  pythonPath: string
): Promise<boolean> {
  const response = await fetch(`${baseUrl}/api/mcp/proxy/check-installed`, {
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
  return result.installed;
}

/**
 * Start MCP proxy
 */
export async function startMcpProxy(
  baseUrl: string,
  config: McpProxyConfig
): Promise<McpProxyStatus> {
  const response = await fetch(`${baseUrl}/api/mcp/proxy/start`, {
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
      `Failed to start MCP proxy: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Stop MCP proxy
 */
export async function stopMcpProxy(
  baseUrl: string
): Promise<{ success: boolean }> {
  const response = await fetch(`${baseUrl}/api/mcp/proxy/stop`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to stop MCP proxy: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Install MCP proxy
 */
export async function installMcpProxy(
  baseUrl: string,
  pythonPath: string
): Promise<{ success: boolean }> {
  const response = await fetch(`${baseUrl}/api/mcp/proxy/install`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ python_path: pythonPath }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to install MCP proxy: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get process using a port
 */
export async function getPortProcess(
  baseUrl: string,
  port: number
): Promise<PortProcess | null> {
  const response = await fetch(`${baseUrl}/api/mcp/proxy/port-process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ port }),
  });

  if (!response.ok) {
    return null;
  }

  const result = await response.json();
  return result.process;
}

/**
 * Kill process using a port
 */
export async function killPortProcess(
  baseUrl: string,
  port: number
): Promise<{ success: boolean }> {
  const response = await fetch(`${baseUrl}/api/mcp/proxy/kill-port-process`, {
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
      `Failed to kill port process: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Check MCP server on port
 */
export async function checkMcpServerOnPort(
  baseUrl: string,
  port: number
): Promise<McpServerPortStatus> {
  const response = await fetch(`${baseUrl}/api/mcp/server/check-port`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ port }),
  });

  if (!response.ok) {
    return {
      status: "stopped",
      pid: null,
      process_name: null,
      is_mcp_server: false,
    };
  }

  return response.json();
}
