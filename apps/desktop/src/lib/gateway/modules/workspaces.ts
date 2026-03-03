/**
 * Workspaces Module
 * 工作区模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  WorkspaceResponse,
  WorkspacesListResponse,
  DetectAgentsResponse,
} from "../types";

// ============================================================================
// Workspace CRUD
// ============================================================================

/**
 * List workspaces
 */
export async function listWorkspaces(
  baseUrl: string
): Promise<WorkspacesListResponse> {
  const response = await fetch(`${baseUrl}/api/workspaces`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list workspaces: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get workspace by ID
 */
export async function getWorkspace(
  baseUrl: string,
  workspaceId: string
): Promise<WorkspaceResponse | null> {
  const response = await fetch(
    `${baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get workspace: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create or register workspace
 */
export async function createWorkspace(
  baseUrl: string,
  path: string,
  name?: string
): Promise<WorkspaceResponse> {
  const response = await fetch(`${baseUrl}/api/workspaces`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ path, name }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to create workspace: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Update workspace
 */
export async function updateWorkspace(
  baseUrl: string,
  workspaceId: string,
  updates: Partial<Pick<WorkspaceResponse, "name" | "mcp" | "skills" | "agents">>
): Promise<WorkspaceResponse> {
  const response = await fetch(
    `${baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}`,
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
      `Failed to update workspace: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete workspace
 */
export async function deleteWorkspace(
  baseUrl: string,
  workspaceId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete workspace: ${errorMessage}`,
      response.status
    );
  }
}

// ============================================================================
// Active Workspace
// ============================================================================

/**
 * Get active workspace
 * Updated to match original gateway.ts return type
 */
export async function getActiveWorkspace(
  baseUrl: string
): Promise<{ active_workspace: WorkspaceResponse | null }> {
  const response = await fetch(`${baseUrl}/api/workspaces/active`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get active workspace: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Set active workspace
 * Updated to match original gateway.ts signature and return type
 */
export async function setActiveWorkspace(
  baseUrl: string,
  options: { workspaceId?: string; path?: string }
): Promise<WorkspaceResponse> {
  const body: Record<string, string> = {};
  if (options.workspaceId) body.workspace_id = options.workspaceId;
  if (options.path) body.path = options.path;

  const response = await fetch(`${baseUrl}/api/workspaces/active`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to set active workspace: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.active_workspace;
}

// ============================================================================
// Agent Detection
// ============================================================================

/**
 * Detect agents in workspace
 */
export async function detectAgents(
  baseUrl: string,
  workspaceId: string
): Promise<DetectAgentsResponse> {
  const response = await fetch(
    `${baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/detect-agents`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to detect agents: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Detect workspace agents (alias for detectAgents)
 * Added to match original gateway.ts naming
 */
export async function detectWorkspaceAgents(
  baseUrl: string,
  workspaceId: string
): Promise<DetectAgentsResponse> {
  return detectAgents(baseUrl, workspaceId);
}
