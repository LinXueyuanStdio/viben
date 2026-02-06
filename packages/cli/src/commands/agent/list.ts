/**
 * viben agent list - List all agents
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import chalk from 'chalk';
import type { OutputContext, Agent } from '../../types';
import { CliError } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { getWorkspaceDir, getStateDir } from '../../lib/scope';

/**
 * Read agent files from a directory
 */
function readAgentsFromDir(agentsDir: string, source: string): Agent[] {
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
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = yaml.parse(content) as Record<string, unknown>;

      const stat = fs.statSync(filePath);
      const agent: Agent = {
        id: (parsed.id as string) || path.basename(file, path.extname(file)),
        name: (parsed.name as string) || undefined,
        description: (parsed.description as string) || undefined,
        model: (parsed.model as string) || undefined,
        provider: (parsed.provider as string) || undefined,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      };

      agents.push(agent);
    } catch (error) {
      // Skip invalid files
      continue;
    }
  }

  return agents;
}

/**
 * List all agents
 */
export function listAgents(ctx: OutputContext): void {
  const agents: Array<Agent & { source: string }> = [];

  // List workspace agents
  const workspaceDir = getWorkspaceDir();
  if (workspaceDir) {
    const workspaceAgentsDir = path.join(workspaceDir, 'agents');
    const workspaceAgents = readAgentsFromDir(workspaceAgentsDir, 'workspace');
    for (const agent of workspaceAgents) {
      agents.push({ ...agent, source: 'workspace' });
    }
  }

  // List global agents
  const globalAgentsDir = path.join(getStateDir(), 'agents');
  const globalAgents = readAgentsFromDir(globalAgentsDir, 'global');
  for (const agent of globalAgents) {
    // Don't add if already exists from workspace
    if (!agents.find((a) => a.id === agent.id)) {
      agents.push({ ...agent, source: 'global' });
    }
  }

  output(
    ctx,
    successResponse({ agents, count: agents.length }),
    () => {
      if (agents.length === 0) {
        console.log(chalk.gray('No agents found.'));
        console.log();
        console.log('Create an agent with:');
        console.log(chalk.cyan('  viben agent create -n <agent-id>'));
        return;
      }

      outputTable(
        ctx,
        ['ID', 'Name', 'Model', 'Source'],
        agents.map((a) => [
          a.id,
          a.name || chalk.gray('(unnamed)'),
          a.model || chalk.gray('(default)'),
          a.source,
        ])
      );
    }
  );
}
