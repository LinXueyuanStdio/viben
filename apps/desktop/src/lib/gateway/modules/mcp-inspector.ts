/**
 * MCP Inspector Module
 * MCP 检查器模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  McpInspectorHealth,
  McpInspectorToken,
  McpInspectorConfig,
  McpInspectorSession,
} from "../types";

// ============================================================================
// MCP Inspector Operations
// ============================================================================

/**
 * Get MCP Inspector health and session count
 */
export async function getMcpInspectorHealth(
  baseUrl: string
): Promise<McpInspectorHealth> {
  const response = await fetch(`${baseUrl}/api/mcp/inspector/health`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get MCP Inspector health: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get MCP Inspector session token
 */
export async function getMcpInspectorToken(
  baseUrl: string
): Promise<McpInspectorToken> {
  const response = await fetch(`${baseUrl}/api/mcp/inspector/token`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get MCP Inspector token: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get MCP Inspector configuration
 */
export async function getMcpInspectorConfig(
  baseUrl: string,
  authToken: string
): Promise<McpInspectorConfig> {
  const response = await fetch(`${baseUrl}/api/mcp/inspector/config`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-MCP-Proxy-Auth": `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get MCP Inspector config: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * List active MCP Inspector sessions
 */
export async function getMcpInspectorSessions(
  baseUrl: string,
  authToken: string
): Promise<McpInspectorSession[]> {
  const response = await fetch(`${baseUrl}/api/mcp/inspector/sessions`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-MCP-Proxy-Auth": `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get MCP Inspector sessions: ${errorMessage}`,
      response.status
    );
  }

  const result = await response.json();
  return result.sessions;
}

/**
 * Close an MCP Inspector session
 */
export async function closeMcpInspectorSession(
  baseUrl: string,
  authToken: string,
  sessionId: string
): Promise<{ deleted: string }> {
  const response = await fetch(
    `${baseUrl}/api/mcp/inspector/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "X-MCP-Proxy-Auth": `Bearer ${authToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to close MCP Inspector session: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
