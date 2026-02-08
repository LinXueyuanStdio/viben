/**
 * viben agent create - Create a new agent
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import chalk from 'chalk';
import type { OutputContext, Agent, ConfigScope } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { getWorkspaceDir, getStateDir, resolveScope } from '../../lib/scope';

interface CreateOptions {
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  global?: boolean;
  workspace?: boolean;
}

/**
 * Get agents directory for scope
 */
function getAgentsDir(scope: ConfigScope): string {
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
 * Validate agent ID
 */
function validateAgentId(id: string): void {
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
 * Create a new agent
 */
export function createAgent(ctx: OutputContext, options: CreateOptions): void {
  const id = options.name;
  validateAgentId(id);

  const scope = resolveScope({
    global: options.global,
    workspace: options.workspace,
  });

  const agentsDir = getAgentsDir(scope);
  const agentPath = path.join(agentsDir, `${id}.yaml`);

  // Check if already exists
  if (fs.existsSync(agentPath)) {
    throw new CliError(
      `Agent "${id}" already exists`,
      'AGENT_EXISTS'
    );
  }

  // Create agents directory if needed
  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }

  // Create agent config
  const now = new Date().toISOString();
  const agent: Agent = {
    id,
    name: options.description ? undefined : id,
    description: options.description,
    model: options.model,
    provider: options.provider,
    createdAt: now,
    updatedAt: now,
  };

  // Build YAML content
  const agentConfig: Record<string, unknown> = {
    id: agent.id,
  };

  if (agent.name) {
    agentConfig.name = agent.name;
  }
  if (agent.description) {
    agentConfig.description = agent.description;
  }
  if (agent.model) {
    agentConfig.model = agent.model;
  }
  if (agent.provider) {
    agentConfig.provider = agent.provider;
  }

  const content = yaml.stringify(agentConfig, { indent: 2 });
  fs.writeFileSync(agentPath, content, 'utf-8');

  output(
    ctx,
    successResponse({
      agent,
      path: agentPath,
      scope,
    }),
    () => {
      console.log(chalk.green('OK') + ` Created agent "${chalk.cyan(id)}"`);
      console.log();
      console.log('Agent file:', chalk.gray(agentPath));
      console.log();
      console.log('Next steps:');
      console.log(chalk.cyan(`  viben agent show -n ${id}`) + ' - View agent details');
    }
  );
}
