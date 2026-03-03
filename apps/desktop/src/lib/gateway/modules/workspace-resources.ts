/**
 * Workspace Resources Module
 * 工作区资源模块 - 获取执行器、模型、智能体
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  ExecutorsResponse,
  WorkspaceModelsResponse,
  AgentsResponse,
  ChatListResponse,
  AgentDetails,
} from "../types";

// ============================================================================
// Executors
// ============================================================================

/**
 * Get executors for a workspace
 */
export async function getExecutors(
  baseUrl: string,
  workspacePath: string
): Promise<ExecutorsResponse> {
  const params = new URLSearchParams({ workspace_path: workspacePath });

  const response = await fetch(
    `${baseUrl}/api/workspace/executors?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get executors: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// ============================================================================
// Models
// ============================================================================

/**
 * Get models for a workspace
 */
export async function getWorkspaceModels(
  baseUrl: string,
  workspacePath: string
): Promise<WorkspaceModelsResponse> {
  const params = new URLSearchParams({ workspace_path: workspacePath });

  const response = await fetch(
    `${baseUrl}/api/workspace/models?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get workspace models: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// ============================================================================
// Agents
// ============================================================================

/**
 * Get agents for a workspace
 */
export async function getAgents(
  baseUrl: string,
  workspacePath: string,
  includeGlobal = true
): Promise<AgentsResponse> {
  const params = new URLSearchParams({ workspace_path: workspacePath });
  if (includeGlobal) params.set("include_global", "true");

  const response = await fetch(
    `${baseUrl}/api/workspace/agents?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get agents: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get agent details by type
 */
export async function getAgentDetails(
  baseUrl: string,
  agentType: string
): Promise<AgentDetails | null> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentType)}/details`,
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
      `Failed to get agent details: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// ============================================================================
// Chat List (Aggregated sidebar list)
// ============================================================================

/**
 * Get aggregated chat list for workspace
 */
export async function getChatList(
  baseUrl: string,
  workspacePath: string,
  includeGlobal = true
): Promise<ChatListResponse> {
  const params = new URLSearchParams({ workspace_path: workspacePath });
  if (includeGlobal) params.set("include_global", "true");

  const response = await fetch(
    `${baseUrl}/api/workspace/chat-list?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get chat list: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
