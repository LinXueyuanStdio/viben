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
  options?: {
    workspacePath?: string;
    includeGlobal?: boolean;
  }
): Promise<AgentResponse[]> {
  const params = new URLSearchParams();
  if (options?.workspacePath) params.set("workspace_path", options.workspacePath);
  if (options?.includeGlobal !== undefined) params.set("include_global", String(options.includeGlobal));

  const response = await fetch(
    `${baseUrl}/api/agent?${params.toString()}`,
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

  const data = await response.json();
  return data.agents || data; // Handle both {agents: []} and direct array formats
}

/**
 * Get agent by ID
 */
export async function getAgent(
  baseUrl: string,
  agentId: string,
  options?: { workspacePath?: string }
): Promise<AgentResponse> {
  const params = new URLSearchParams();
  if (options?.workspacePath) params.set("workspace_path", options.workspacePath);

  const response = await fetch(
    `${baseUrl}/api/agent/${encodeURIComponent(agentId)}?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

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
  const response = await fetch(`${baseUrl}/api/agent`, {
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
  options: UpdateAgentOptions
): Promise<AgentResponse> {
  // Extract workspace_path for query param, rest goes to body
  const { workspace_path, ...bodyOptions } = options;

  // Build URL with optional workspace_path query param
  const params = new URLSearchParams();
  if (workspace_path) {
    params.set("workspace_path", workspace_path);
  }
  const queryString = params.toString();
  const url = queryString
    ? `${baseUrl}/api/agent/${encodeURIComponent(agentId)}?${queryString}`
    : `${baseUrl}/api/agent/${encodeURIComponent(agentId)}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(bodyOptions),
  });

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
  options?: { workspacePath?: string }
): Promise<void> {
  const params = new URLSearchParams();
  if (options?.workspacePath) params.set("workspace_path", options.workspacePath);

  const response = await fetch(
    `${baseUrl}/api/agent/${encodeURIComponent(agentId)}?${params.toString()}`,
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
  const response = await fetch(`${baseUrl}/api/agent/default`, {
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
  const response = await fetch(`${baseUrl}/api/agent/default`, {
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

/**
 * Get default agent ID (compatibility method)
 */
export async function getDefaultAgentId(baseUrl: string): Promise<string | null> {
  const response = await getDefaultAgent(baseUrl);
  return response.default_agent_id;
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
  const response = await fetch(`${baseUrl}/api/agent/templates`, {
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
    `${baseUrl}/api/agent/templates/${encodeURIComponent(templateId)}`,
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

/**
 * Create agent template from an existing agent
 */
export async function createAgentTemplate(
  baseUrl: string,
  agentId: string,
  templateId: string
): Promise<AgentTemplate> {
  const response = await fetch(`${baseUrl}/api/agent/templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ agent_id: agentId, template_id: templateId }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to create template: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create agent from template
 */
export async function createAgentFromTemplate(
  baseUrl: string,
  templateId: string,
  agentId: string
): Promise<AgentResponse> {
  const response = await fetch(
    `${baseUrl}/api/agent/templates/${encodeURIComponent(templateId)}/instantiate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ agent_id: agentId }),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to create agent from template: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
