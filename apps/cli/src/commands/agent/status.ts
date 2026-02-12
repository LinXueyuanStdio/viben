/**
 * viben agent status - Show agent status
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { agentList, agentGet, agentGetDefault, type Agent } from '../../lib/native';

interface StatusOptions {
  name?: string;
}

/**
 * Get the current/active agent
 */
async function getCurrentAgent(): Promise<string | null> {
  // First check environment variable
  const envAgent = process.env.VIBEN_AGENT;
  if (envAgent) {
    return envAgent;
  }

  // Then check default agent from NAPI
  return await agentGetDefault();
}

/**
 * Show status for a specific agent
 */
async function showAgentStatus(ctx: OutputContext, agentId: string): Promise<void> {
  const agent = await agentGet(agentId);
  const currentAgent = await getCurrentAgent();
  const defaultAgent = await agentGetDefault();

  if (!agent) {
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

  const isCurrent = currentAgent === agentId;
  const isDefault = defaultAgent === agentId;

  output(
    ctx,
    successResponse({
      id: agent.id,
      name: agent.name,
      model: agent.model,
      provider: agent.provider,
      executor: agent.executorType,
      path: agent.path,
      current: isCurrent,
      default: isDefault,
      found: true,
    }),
    () => {
      console.log(chalk.bold.underline(`Agent: ${agent.id}`));
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

      printField('Name', agent.name);
      printField('Model', agent.model, '(default)');
      printField('Provider', agent.provider, '(default)');
      printField('Executor', agent.executorType, '(default)');
      console.log();
      printField('Current', isCurrent);
      printField('Default', isDefault);
      if (agent.path) {
        console.log();
        console.log(chalk.gray('Agent directory:'), agent.path);
      }
    }
  );
}

/**
 * Show status for all agents
 */
async function showAllAgentsStatus(ctx: OutputContext): Promise<void> {
  const agents = await agentList();
  const currentAgent = await getCurrentAgent();
  const defaultAgent = await agentGetDefault();

  const agentStatuses = agents.map((agent: Agent) => ({
    id: agent.id,
    name: agent.name,
    model: agent.model,
    executor: agent.executorType,
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
        ['', 'ID', 'Name', 'Model', 'Executor'],
        agentStatuses.map((a) => [
          a.current ? chalk.green('*') : (a.default ? chalk.blue('D') : ' '),
          a.id,
          a.name || chalk.gray('(unnamed)'),
          a.model || chalk.gray('(default)'),
          a.executor || chalk.gray('(default)'),
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
export async function statusAgent(ctx: OutputContext, options: StatusOptions): Promise<void> {
  if (options.name) {
    await showAgentStatus(ctx, options.name);
  } else {
    await showAllAgentsStatus(ctx);
  }
}
