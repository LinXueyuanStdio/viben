/**
 * MCP Servers Module
 * MCP 服务器配置模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  WorkspaceMcpServerConfig,
  WorkspaceMcpServersResponse,
} from "../types";

// ============================================================================
// MCP Server Config
// ============================================================================

/**
 * Get MCP servers for workspace
 */
export async function getMcpServers(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string
): Promise<WorkspaceMcpServersResponse> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/mcp-servers?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get MCP servers: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Add MCP server to workspace
 */
export async function addMcpServer(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string,
  server: WorkspaceMcpServerConfig
): Promise<{ success: boolean; server: WorkspaceMcpServerConfig }> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/mcp-servers?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ server }),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to add MCP server: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Update MCP server in workspace
 */
export async function updateMcpServer(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string,
  serverName: string,
  updates: Partial<WorkspaceMcpServerConfig>
): Promise<{ success: boolean }> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/mcp-servers/${encodeURIComponent(serverName)}?${params.toString()}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to update MCP server: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete MCP server from workspace
 */
export async function deleteMcpServer(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string,
  serverName: string
): Promise<{ success: boolean; deleted: string }> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/mcp-servers/${encodeURIComponent(serverName)}?${params.toString()}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete MCP server: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Enable MCP server
 */
export async function enableMcpServer(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string,
  serverName: string
): Promise<{ success: boolean; server: WorkspaceMcpServerConfig }> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/mcp-servers/${encodeURIComponent(serverName)}/enable?${params.toString()}`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to enable MCP server: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Disable MCP server
 */
export async function disableMcpServer(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string,
  serverName: string
): Promise<{ success: boolean; server: WorkspaceMcpServerConfig }> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/mcp-servers/${encodeURIComponent(serverName)}/disable?${params.toString()}`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to disable MCP server: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
