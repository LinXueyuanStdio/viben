/**
 * viben agent show - Show agent details
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import chalk from 'chalk';
import type { OutputContext, Agent } from '../../types';
import { CliError } from '../../types';
import { output, successResponse, formatDate } from '../../lib/output';
import { getWorkspaceDir, getStateDir } from '../../lib/scope';

/**
 * Find agent by ID
 */
function findAgent(id: string): { agent: Agent; path: string; source: string } | null {
  // Check workspace first
  const workspaceDir = getWorkspaceDir();
  if (workspaceDir) {
    const workspaceAgentPath = path.join(workspaceDir, 'agents', `${id}.yaml`);
    if (fs.existsSync(workspaceAgentPath)) {
      const content = fs.readFileSync(workspaceAgentPath, 'utf-8');
      const parsed = yaml.parse(content) as Record<string, unknown>;
      const stat = fs.statSync(workspaceAgentPath);

      return {
        agent: {
          id: (parsed.id as string) || id,
          name: parsed.name as string | undefined,
          description: parsed.description as string | undefined,
          model: parsed.model as string | undefined,
          provider: parsed.provider as string | undefined,
          createdAt: stat.birthtime.toISOString(),
          updatedAt: stat.mtime.toISOString(),
        },
        path: workspaceAgentPath,
        source: 'workspace',
      };
    }
  }

  // Check global
  const globalAgentPath = path.join(getStateDir(), 'agents', `${id}.yaml`);
  if (fs.existsSync(globalAgentPath)) {
    const content = fs.readFileSync(globalAgentPath, 'utf-8');
    const parsed = yaml.parse(content) as Record<string, unknown>;
    const stat = fs.statSync(globalAgentPath);

    return {
      agent: {
        id: (parsed.id as string) || id,
        name: parsed.name as string | undefined,
        description: parsed.description as string | undefined,
        model: parsed.model as string | undefined,
        provider: parsed.provider as string | undefined,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      },
      path: globalAgentPath,
      source: 'global',
    };
  }

  return null;
}

/**
 * Show agent details
 */
export function showAgent(ctx: OutputContext, id: string): void {
  const result = findAgent(id);

  if (!result) {
    throw new CliError(
      `Agent "${id}" not found`,
      'AGENT_NOT_FOUND'
    );
  }

  const { agent, path: agentPath, source } = result;

  output(
    ctx,
    successResponse({
      agent,
      path: agentPath,
      source,
    }),
    () => {
      console.log(chalk.bold.underline(`Agent: ${agent.id}`));
      console.log();

      const printField = (label: string, value: string | undefined, defaultVal?: string) => {
        const displayValue = value || chalk.gray(defaultVal || '(not set)');
        console.log(`  ${chalk.cyan(label.padEnd(12))} ${displayValue}`);
      };

      printField('Name', agent.name);
      printField('Description', agent.description);
      printField('Model', agent.model, '(default)');
      printField('Provider', agent.provider, '(default)');
      printField('Source', source);
      console.log();
      printField('Created', formatDate(agent.createdAt));
      printField('Updated', formatDate(agent.updatedAt));
      console.log();
      console.log(chalk.gray('Config file:'), agentPath);
    }
  );
}
