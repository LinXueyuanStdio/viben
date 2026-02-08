/**
 * viben agent status - Show agent status
 */

import * as path from 'path';
import chalk from 'chalk';
import type { OutputContext, ConfigScope } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { getAllAgents, findAgent } from '../../lib/agents';
import { readConfigFile } from '../../lib/config';
import { getGlobalConfigDir, getWorkspaceDir, CONFIG_FILE } from '../../lib/scope';

interface StatusOptions {
  name?: string;
}

/**
 * Get the default agent from config
 */
function getDefaultAgent(): string | null {
  // Check workspace config first
  const workspaceDir = getWorkspaceDir();
  if (workspaceDir) {
    const workspaceConfig = readConfigFile(path.join(workspaceDir, CONFIG_FILE));
    if (workspaceConfig?.settings) {
      const defaultAgent = (workspaceConfig.settings as Record<string, unknown>).default_agent;
      if (typeof defaultAgent === 'string') {
        return defaultAgent;
      }
    }
  }

  // Check global config
  const globalDir = getGlobalConfigDir();
  const globalConfig = readConfigFile(path.join(globalDir, CONFIG_FILE));
  if (globalConfig?.settings) {
    const defaultAgent = (globalConfig.settings as Record<string, unknown>).default_agent;
    if (typeof defaultAgent === 'string') {
      return defaultAgent;
    }
  }

  // Check environment variable
  const envAgent = process.env.VIBEN_AGENT;
  if (envAgent) {
    return envAgent;
  }

  return null;
}

/**
 * Get the current/active agent
 */
function getCurrentAgent(): string | null {
  // First check environment variable
  const envAgent = process.env.VIBEN_AGENT;
  if (envAgent) {
    return envAgent;
  }

  // Then check default agent from config
  return getDefaultAgent();
}

/**
 * Show status for a specific agent
 */
function showAgentStatus(ctx: OutputContext, agentId: string): void {
  const result = findAgent(agentId);
  const currentAgent = getCurrentAgent();
  const defaultAgent = getDefaultAgent();

  if (!result) {
    output(
      ctx,
      successResponse({
        id: agentId,
        found: false,
        current: false,
        default: false,
      }),
      () => {
        console.log(chalk.yellow('Agent not found:'), agentId);
      }
    );
    return;
  }

  const { config, path: agentPath, source } = result;
  const isCurrent = currentAgent === agentId;
  const isDefault = defaultAgent === agentId;

  output(
    ctx,
    successResponse({
      id: config.id || agentId,
      name: config.name,
      type: config.type,
      model: config.model,
      provider: config.provider,
      source,
      path: agentPath,
      current: isCurrent,
      default: isDefault,
      found: true,
    }),
    () => {
      console.log(chalk.bold.underline(`Agent: ${config.id || agentId}`));
      console.log();

      const printField = (label: string, value: string | undefined | boolean, defaultVal?: string) => {
        let displayValue: string;
        if (typeof value === 'boolean') {
          displayValue = value ? chalk.green('yes') : chalk.gray('no');
        } else {
          displayValue = value || chalk.gray(defaultVal || '(not set)');
        }
        console.log(`  ${chalk.cyan(label.padEnd(12))} ${displayValue}`);
      };

      printField('Name', config.name);
      printField('Type', config.type, '(default)');
      printField('Model', config.model, '(default)');
      printField('Provider', config.provider, '(default)');
      printField('Source', source);
      console.log();
      printField('Current', isCurrent);
      printField('Default', isDefault);
      console.log();
      console.log(chalk.gray('Config file:'), agentPath);
    }
  );
}

/**
 * Show status for all agents
 */
function showAllAgentsStatus(ctx: OutputContext): void {
  const agents = getAllAgents();
  const currentAgent = getCurrentAgent();
  const defaultAgent = getDefaultAgent();

  const agentStatuses = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    type: (findAgent(agent.id)?.config?.type) || undefined,
    model: agent.model,
    source: agent.source,
    current: currentAgent === agent.id,
    default: defaultAgent === agent.id,
  }));

  output(
    ctx,
    successResponse({
      current_agent: currentAgent,
      default_agent: defaultAgent,
      agents: agentStatuses,
      count: agents.length,
    }),
    () => {
      console.log(chalk.bold('Agent Status'));
      console.log();

      if (currentAgent) {
        console.log(`  ${chalk.cyan('Current:')} ${currentAgent}${process.env.VIBEN_AGENT ? chalk.gray(' (from VIBEN_AGENT)') : ''}`);
      } else {
        console.log(`  ${chalk.cyan('Current:')} ${chalk.gray('(none set)')}`);
      }

      if (defaultAgent) {
        console.log(`  ${chalk.cyan('Default:')} ${defaultAgent}`);
      } else {
        console.log(`  ${chalk.cyan('Default:')} ${chalk.gray('(none set)')}`);
      }

      console.log();

      if (agents.length === 0) {
        console.log(chalk.gray('No agents found.'));
        console.log();
        console.log('Create an agent with:');
        console.log(chalk.cyan('  viben agent create -n <agent-id>'));
        return;
      }

      outputTable(
        ctx,
        ['', 'ID', 'Name', 'Type', 'Model', 'Source'],
        agentStatuses.map((a) => [
          a.current ? chalk.green('*') : (a.default ? chalk.blue('D') : ' '),
          a.id,
          a.name || chalk.gray('(unnamed)'),
          a.type || chalk.gray('(default)'),
          a.model || chalk.gray('(default)'),
          a.source,
        ])
      );

      console.log();
      console.log(chalk.gray('* = current agent, D = default agent'));
    }
  );
}

/**
 * Show agent status (main entry point)
 */
export function statusAgent(ctx: OutputContext, options: StatusOptions): void {
  if (options.name) {
    showAgentStatus(ctx, options.name);
  } else {
    showAllAgentsStatus(ctx);
  }
}
