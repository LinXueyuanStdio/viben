/**
 * Agent management for Viben CLI
 *
 * Handles listing, reading, and writing agent configurations.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import type { Agent, ConfigScope } from '../types';
import { CliError } from '../types';
import { getWorkspaceDir, getStateDir, ensureDir } from './scope';

/**
 * Agent configuration stored in YAML files
 */
export interface AgentConfig {
  id: string;
  name?: string;
  description?: string;
  type?: string;
  model?: string;
  provider?: string;
  type_config?: Record<string, unknown>;
  mcp?: {
    enabled?: string[];
    disabled?: string[];
  };
  skills?: {
    enabled?: string[];
  };
}

/**
 * Get the agents directory for a given scope
 */
export function getAgentsDir(scope: ConfigScope): string {
  if (scope === 'workspace') {
    const workspaceDir = getWorkspaceDir();
    if (!workspaceDir) {
      throw new CliError(
        'Not in a workspace. Use --global or run "viben init" first.',
        'NO_WORKSPACE'
      );
    }
    return path.join(workspaceDir, 'agents');
  }
  return path.join(getStateDir(), 'agents');
}

/**
 * List agents from a specific scope
 */
export function listAgentsFromScope(scope: ConfigScope): Agent[] {
  const agentsDir = scope === 'workspace'
    ? (() => {
        const workspaceDir = getWorkspaceDir();
        return workspaceDir ? path.join(workspaceDir, 'agents') : null;
      })()
    : path.join(getStateDir(), 'agents');

  if (!agentsDir || !fs.existsSync(agentsDir)) {
    return [];
  }

  return readAgentsFromDir(agentsDir);
}

/**
 * Read all agent files from a directory
 */
function readAgentsFromDir(agentsDir: string): Agent[] {
  if (!fs.existsSync(agentsDir)) {
    return [];
  }

  const agents: Agent[] = [];
  const files = fs.readdirSync(agentsDir);

  for (const file of files) {
    if (!file.endsWith('.yaml') && !file.endsWith('.yml')) {
      continue;
    }

    const filePath = path.join(agentsDir, file);

    // Skip directories
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = yaml.parse(content) as AgentConfig;

      const agent: Agent = {
        id: parsed.id || path.basename(file, path.extname(file)),
        name: parsed.name,
        description: parsed.description,
        model: parsed.model,
        provider: parsed.provider,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      };

      agents.push(agent);
    } catch {
      // Skip invalid files
      continue;
    }
  }

  return agents;
}

/**
 * Get the file path for an agent
 */
export function getAgentPath(scope: ConfigScope, agentId: string): string {
  const agentsDir = getAgentsDir(scope);
  return path.join(agentsDir, `${agentId}.yaml`);
}

/**
 * Find an agent by ID across all scopes
 * Returns the agent, its path, and source scope
 */
export function findAgent(agentId: string): {
  config: AgentConfig;
  path: string;
  source: ConfigScope;
} | null {
  // Check workspace first
  const workspaceDir = getWorkspaceDir();
  if (workspaceDir) {
    const workspaceAgentPath = path.join(workspaceDir, 'agents', `${agentId}.yaml`);
    if (fs.existsSync(workspaceAgentPath)) {
      try {
        const content = fs.readFileSync(workspaceAgentPath, 'utf-8');
        const config = yaml.parse(content) as AgentConfig;
        return { config, path: workspaceAgentPath, source: 'workspace' };
      } catch {
        // Fall through to global
      }
    }
  }

  // Check global
  const globalAgentPath = path.join(getStateDir(), 'agents', `${agentId}.yaml`);
  if (fs.existsSync(globalAgentPath)) {
    try {
      const content = fs.readFileSync(globalAgentPath, 'utf-8');
      const config = yaml.parse(content) as AgentConfig;
      return { config, path: globalAgentPath, source: 'global' };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Read an agent configuration
 */
export function readAgentConfig(scope: ConfigScope, agentId: string): AgentConfig | null {
  const agentPath = getAgentPath(scope, agentId);

  if (!fs.existsSync(agentPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(agentPath, 'utf-8');
    return yaml.parse(content) as AgentConfig;
  } catch (error) {
    throw new CliError(
      `Failed to read agent config: ${agentPath}`,
      'AGENT_READ_ERROR',
      error
    );
  }
}

/**
 * Write an agent configuration
 */
export function writeAgentConfig(
  scope: ConfigScope,
  agentId: string,
  config: AgentConfig
): void {
  const agentsDir = getAgentsDir(scope);
  ensureDir(agentsDir);

  const agentPath = path.join(agentsDir, `${agentId}.yaml`);

  try {
    const content = yaml.stringify(config, {
      indent: 2,
      lineWidth: 0,
    });
    fs.writeFileSync(agentPath, content, 'utf-8');
  } catch (error) {
    throw new CliError(
      `Failed to write agent config: ${agentPath}`,
      'AGENT_WRITE_ERROR',
      error
    );
  }
}

/**
 * Create agent directory structure
 */
export function createAgentDir(scope: ConfigScope, agentId: string): string {
  const agentsDir = getAgentsDir(scope);
  ensureDir(agentsDir);

  // For simple agents, we just create the YAML file in the agents directory
  // For complex agents with memory/sessions, we create a directory structure
  const agentDir = path.join(agentsDir, agentId);

  // Only create directory for complex agents (with memory, sessions, etc.)
  // For now, we just return the agents directory
  return agentsDir;
}

/**
 * Check if an agent exists
 */
export function agentExists(scope: ConfigScope, agentId: string): boolean {
  const agentPath = getAgentPath(scope, agentId);
  return fs.existsSync(agentPath);
}

/**
 * Delete an agent
 */
export function deleteAgent(scope: ConfigScope, agentId: string): void {
  const agentPath = getAgentPath(scope, agentId);

  if (!fs.existsSync(agentPath)) {
    throw new CliError(
      `Agent "${agentId}" not found`,
      'AGENT_NOT_FOUND'
    );
  }

  try {
    fs.unlinkSync(agentPath);
  } catch (error) {
    throw new CliError(
      `Failed to delete agent: ${agentPath}`,
      'AGENT_DELETE_ERROR',
      error
    );
  }
}

/**
 * Validate agent ID format
 */
export function validateAgentId(id: string): void {
  if (!id || id.trim() === '') {
    throw new CliError('Agent ID cannot be empty', 'INVALID_ID');
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)) {
    throw new CliError(
      'Agent ID must start with a letter and contain only letters, numbers, underscores, and hyphens',
      'INVALID_ID'
    );
  }

  if (id.length > 64) {
    throw new CliError('Agent ID must be 64 characters or less', 'INVALID_ID');
  }
}

/**
 * Get all agents from both scopes, with workspace overriding global
 */
export function getAllAgents(): Array<Agent & { source: ConfigScope }> {
  const agents: Array<Agent & { source: ConfigScope }> = [];
  const seenIds = new Set<string>();

  // Workspace agents (higher priority)
  const workspaceAgents = listAgentsFromScope('workspace');
  for (const agent of workspaceAgents) {
    agents.push({ ...agent, source: 'workspace' });
    seenIds.add(agent.id);
  }

  // Global agents
  const globalAgents = listAgentsFromScope('global');
  for (const agent of globalAgents) {
    if (!seenIds.has(agent.id)) {
      agents.push({ ...agent, source: 'global' });
    }
  }

  return agents;
}
