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
 * Updated to match original gateway.ts endpoint
 */
export async function getExecutors(
  baseUrl: string,
  options?: {
    workspacePath?: string;
    includeGlobal?: boolean;
  }
): Promise<ExecutorsResponse> {
  const params = new URLSearchParams();
  if (options?.workspacePath) {
    params.set("workspace_path", options.workspacePath);
  }
  if (options?.includeGlobal !== undefined) {
    params.set("include_global", String(options.includeGlobal));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${baseUrl}/api/executors?${queryString}`
    : `${baseUrl}/api/executors`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

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
 * Updated to match original gateway.ts endpoint and signature
 */
export async function getWorkspaceModels(
  baseUrl: string,
  options?: {
    workspacePath?: string;
    includeGlobal?: boolean;
    /** Include predefined models for reference (used in Settings > Models) */
    includeProviderPredefined?: boolean;
  }
): Promise<WorkspaceModelsResponse> {
  const params = new URLSearchParams();
  if (options?.workspacePath) {
    params.set("workspace_path", options.workspacePath);
  }
  if (options?.includeGlobal !== undefined) {
    params.set("include_global", String(options.includeGlobal));
  }
  if (options?.includeProviderPredefined) {
    params.set("include_provider_predefined", "true");
  }

  const queryString = params.toString();
  const url = queryString
    ? `${baseUrl}/api/models?${queryString}`
    : `${baseUrl}/api/models`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get models: ${errorMessage}`,
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
 * Updated to match original gateway.ts endpoint and signature
 */
export async function getWorkspaceAgents(
  baseUrl: string,
  options?: {
    workspacePath?: string;
    includeGlobal?: boolean;
  }
): Promise<AgentsResponse> {
  const params = new URLSearchParams();
  if (options?.workspacePath) {
    params.set("workspace_path", options.workspacePath);
  }
  if (options?.includeGlobal !== undefined) {
    params.set("include_global", String(options.includeGlobal));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${baseUrl}/api/agents?${queryString}`
    : `${baseUrl}/api/agents`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

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
 * Get agent details by type (executor type)
 * Note: This is the same as getExecutorDetails in the original gateway.ts
 */
export async function getAgentDetails(
  baseUrl: string,
  agentType: string
): Promise<AgentDetails | null> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentType)}`,
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

/**
 * Get a single agent by ID
 * Added to match original gateway.ts functionality
 */
export async function getAgentById(
  baseUrl: string,
  agentId: string,
  workspacePath?: string
): Promise<AgentDetails | null> {
  const params = new URLSearchParams();
  if (workspacePath) {
    params.set("workspace_path", workspacePath);
  }

  const queryString = params.toString();
  const url = queryString
    ? `${baseUrl}/api/agents/${encodeURIComponent(agentId)}?${queryString}`
    : `${baseUrl}/api/agents/${encodeURIComponent(agentId)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get agent: ${errorMessage}`,
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
 * Updated to match original gateway.js endpoint and signature
 */
export async function getChatList(
  baseUrl: string,
  options?: {
    workspacePath?: string;
    includeGlobal?: boolean;
  }
): Promise<ChatListResponse> {
  const params = new URLSearchParams();
  if (options?.workspacePath) {
    params.set("workspace_path", options.workspacePath);
  }
  if (options?.includeGlobal !== undefined) {
    params.set("include_global", String(options.includeGlobal));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${baseUrl}/api/chat-list?${queryString}`
    : `${baseUrl}/api/chat-list`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get chat list: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
