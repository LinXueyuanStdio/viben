/**
 * Executor Resources Module
 * 执行器资源模块 - Skills/Subagents/Commands/Prompts
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  WorkspaceSkillConfig,
  WorkspaceSkillsResponse,
  WorkspaceAgentConfigData,
  WorkspaceAgentConfigsResponse,
  WorkspaceCommandData,
  WorkspaceCommandsResponse,
  WorkspacePromptData,
  WorkspacePromptsResponse,
} from "../types";

// ============================================================================
// Skills
// ============================================================================

/**
 * Get skills for an executor in a workspace
 */
export async function getSkills(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string
): Promise<WorkspaceSkillsResponse> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/skills?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get skills: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Add skill to an executor
 */
export async function addSkill(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string,
  skill: WorkspaceSkillConfig
): Promise<{ success: boolean; skill: WorkspaceSkillConfig }> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/skills?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ skill }),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to add skill: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete skill from an executor
 */
export async function deleteSkill(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string,
  skillId: string
): Promise<{ success: boolean; deleted: string }> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/skills/${encodeURIComponent(skillId)}?${params.toString()}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete skill: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// ============================================================================
// Subagents
// ============================================================================

/**
 * Get subagents for an executor in a workspace
 */
export async function getAgentConfigs(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string
): Promise<WorkspaceAgentConfigsResponse> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/subagents?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get subagents: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get a single subagent file
 */
export async function getAgentConfig(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string,
  configId: string
): Promise<{ config: WorkspaceAgentConfigData }> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/subagents/${encodeURIComponent(configId)}?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get subagent: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// ============================================================================
// Commands
// ============================================================================

/**
 * Get commands for an executor in a workspace
 */
export async function getCommands(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string
): Promise<WorkspaceCommandsResponse> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/commands?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get commands: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get a single command file
 */
export async function getCommand(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string,
  commandId: string
): Promise<{ command: WorkspaceCommandData }> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/commands/${encodeURIComponent(commandId)}?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get command: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// ============================================================================
// Prompts
// ============================================================================

/**
 * Get all prompts for an executor in a workspace
 */
export async function getPrompts(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string
): Promise<WorkspacePromptsResponse> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/prompts?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get prompts: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get a single prompt file
 */
export async function getPrompt(
  baseUrl: string,
  workspacePath: string | undefined,
  executorType: string,
  promptId: string
): Promise<{ prompt: WorkspacePromptData }> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/prompts/${encodeURIComponent(promptId)}?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get prompt: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
