/**
 * Path utilities for Viben configuration files
 */
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Get the Viben state directory path
 * Default: ~/.viben
 * Can be overridden with VIBEN_STATE_DIR environment variable
 */
export function getStateDir(): string {
  return process.env.VIBEN_STATE_DIR || join(homedir(), ".viben");
}

/**
 * Get the path to the global config file
 */
export function getConfigPath(): string {
  return join(getStateDir(), "config.yaml");
}

/**
 * Get the path to the providers config file
 */
export function getProvidersPath(): string {
  return join(getStateDir(), "providers.yaml");
}

/**
 * Get the path to the models config file
 */
export function getModelsPath(): string {
  return join(getStateDir(), "models.yaml");
}

/**
 * Get the agents directory path
 */
export function getAgentsDir(): string {
  return join(getStateDir(), "agents");
}

/**
 * Get the path to a specific agent's directory
 */
export function getAgentDir(agentId: string): string {
  return join(getAgentsDir(), agentId);
}

/**
 * Get the path to an agent's config file
 */
export function getAgentConfigPath(agentId: string): string {
  return join(getAgentDir(agentId), "config.yaml");
}

/**
 * Get the path to an agent's MCP servers config
 */
export function getAgentMcpServersPath(agentId: string): string {
  return join(getAgentDir(agentId), "mcp_servers.json");
}

/**
 * Get the path to an agent's skills directory
 */
export function getAgentSkillsDir(agentId: string): string {
  return join(getAgentDir(agentId), "skills");
}

/**
 * Get the path to an agent's memory directory
 */
export function getAgentMemoryDir(agentId: string): string {
  return join(getAgentDir(agentId), "memory");
}

/**
 * Get the path to an agent's sessions directory
 */
export function getAgentSessionsDir(agentId: string): string {
  return join(getAgentDir(agentId), ".agent_sessions");
}

/**
 * Get the agent templates directory path
 */
export function getTemplatesDir(): string {
  return join(getStateDir(), "agent-templates");
}

/**
 * Get the path to a specific template's directory
 */
export function getTemplateDir(templateId: string): string {
  return join(getTemplatesDir(), templateId);
}

/**
 * Get the shared MCP directory path
 */
export function getSharedMcpDir(): string {
  return join(getStateDir(), "mcp");
}

/**
 * Get the shared skills directory path
 */
export function getSharedSkillsDir(): string {
  return join(getStateDir(), "skills");
}

/**
 * Get the workspace templates directory path
 */
export function getWorkspaceTemplatesDir(): string {
  return join(getStateDir(), "templates", "workspace");
}

/**
 * Get the path to a specific workspace template's directory
 */
export function getWorkspaceTemplateDir(templateId: string): string {
  return join(getWorkspaceTemplatesDir(), templateId);
}
