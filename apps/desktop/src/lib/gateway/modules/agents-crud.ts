/**
 * Agents CRUD Module
 * 智能体 CRUD 模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  AgentResponse,
  CreateAgentOptions,
  UpdateAgentOptions,
  DefaultAgentResponse,
  AgentTemplate,
  ListTemplatesResponse,
} from "../types";

// ============================================================================
// Agent CRUD
// ============================================================================

/**
 * List all agents
 */
export async function listAgents(
  baseUrl: string,
  workspacePath?: string
): Promise<AgentResponse[]> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/agents?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list agents: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get agent by ID
 */
export async function getAgent(
  baseUrl: string,
  agentId: string,
  workspacePath?: string
): Promise<AgentResponse | null> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}?${params.toString()}`,
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
      `Failed to get agent: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create agent
 */
export async function createAgent(
  baseUrl: string,
  options: CreateAgentOptions
): Promise<AgentResponse> {
  const response = await fetch(`${baseUrl}/api/agents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to create agent: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Update agent
 */
export async function updateAgent(
  baseUrl: string,
  agentId: string,
  updates: UpdateAgentOptions
): Promise<AgentResponse> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}`,
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
      `Failed to update agent: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete agent
 */
export async function deleteAgent(
  baseUrl: string,
  agentId: string,
  workspacePath?: string
): Promise<void> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}?${params.toString()}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete agent: ${errorMessage}`,
      response.status
    );
  }
}

// ============================================================================
// Default Agent
// ============================================================================

/**
 * Get default agent
 */
export async function getDefaultAgent(
  baseUrl: string
): Promise<DefaultAgentResponse> {
  const response = await fetch(`${baseUrl}/api/agents/default`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get default agent: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Set default agent
 */
export async function setDefaultAgent(
  baseUrl: string,
  agentId: string
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/agents/default`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ agent_id: agentId }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to set default agent: ${errorMessage}`,
      response.status
    );
  }
}

// ============================================================================
// Agent Templates
// ============================================================================

/**
 * List agent templates
 */
export async function listAgentTemplates(
  baseUrl: string
): Promise<ListTemplatesResponse> {
  const response = await fetch(`${baseUrl}/api/agents/templates`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list agent templates: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get agent template by ID
 */
export async function getAgentTemplate(
  baseUrl: string,
  templateId: string
): Promise<AgentTemplate | null> {
  const response = await fetch(
    `${baseUrl}/api/agents/templates/${encodeURIComponent(templateId)}`,
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
      `Failed to get agent template: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
