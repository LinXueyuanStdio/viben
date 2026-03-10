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
  ListTemplatesResponse,
  PromoteTemplateRequest,
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

  // Clean undefined values from body to avoid YAML serialization issues
  const cleanBody = JSON.parse(JSON.stringify(bodyOptions));

  // Debug log
  console.log("[gateway] updateAgent request:", {
    url,
    body: cleanBody,
  });

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(cleanBody),
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
 *
 * Templates are now regular agents with is_template=true.
 * This endpoint filters agents to return only templates.
 *
 * @param workspacePath - Optional workspace path to include workspace-scoped templates
 */
export async function listAgentTemplates(
  baseUrl: string,
  options?: {
    workspacePath?: string;
  }
): Promise<ListTemplatesResponse> {
  const params = new URLSearchParams();
  if (options?.workspacePath) params.set("workspace_path", options.workspacePath);

  const response = await fetch(
    `${baseUrl}/api/agent/templates?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

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
 *
 * @deprecated Templates are now regular agents. Use getAgent() instead.
 */
export async function getAgentTemplate(
  baseUrl: string,
  templateId: string,
  options?: { workspacePath?: string }
): Promise<AgentResponse | null> {
  // Templates are now just agents, so use getAgent
  try {
    return await getAgent(baseUrl, templateId, options);
  } catch (error) {
    if (error instanceof GatewayError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Mark an existing agent as a template
 *
 * @param agentId - The agent ID to mark as template
 * @param templateDescription - Optional description for template selection UI
 */
export async function setAgentAsTemplate(
  baseUrl: string,
  agentId: string,
  options: {
    templateDescription?: string;
    workspacePath?: string;
  }
): Promise<AgentResponse> {
  return updateAgent(baseUrl, agentId, {
    is_template: true,
    template_description: options.templateDescription,
    workspace_path: options.workspacePath,
  });
}

/**
 * Unmark an agent as template
 *
 * @param agentId - The agent ID to unmark as template
 */
export async function unsetAgentAsTemplate(
  baseUrl: string,
  agentId: string,
  options?: {
    workspacePath?: string;
  }
): Promise<AgentResponse> {
  return updateAgent(baseUrl, agentId, {
    is_template: false,
    template_description: undefined,
    workspace_path: options?.workspacePath,
  });
}

/**
 * Create agent from template
 *
 * Creates a new agent by copying configuration from a template agent.
 * The new agent is a complete copy and has no ongoing relationship with the template.
 *
 * @param templateId - Source template agent ID
 * @param options - Options for the new agent
 */
export async function createAgentFromTemplate(
  baseUrl: string,
  templateId: string,
  options: {
    name: string;
    agentId?: string;
    basePath?: string; // Workspace path for workspace-scoped agent
  }
): Promise<AgentResponse> {
  return createAgent(baseUrl, {
    name: options.name,
    id: options.agentId,
    from_template: templateId,
    base_path: options.basePath,
  });
}

/**
 * Promote workspace template to global
 *
 * Copies a workspace-scoped template agent to global scope.
 *
 * @param agentId - Workspace template agent ID
 * @param request - Promotion request with workspace path and optional new global ID
 */
export async function promoteTemplateToGlobal(
  baseUrl: string,
  agentId: string,
  request: PromoteTemplateRequest
): Promise<AgentResponse> {
  const response = await fetch(
    `${baseUrl}/api/agent/${encodeURIComponent(agentId)}/promote`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to promote template to global: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

