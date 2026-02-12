/**
 * viben agent list - List all agents
 *
 * Uses NAPI bindings to Rust viben-core for consistent behavior with Desktop/Gateway.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { agentList, type Agent } from '../../lib/native';

/**
 * List all agents using NAPI bindings
 */
export async function listAgents(ctx: OutputContext): Promise<void> {
  const agents = await agentList();

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
        ['ID', 'Name', 'Model', 'Executor'],
        agents.map((a: Agent) => [
          a.id,
          a.name || chalk.gray('(unnamed)'),
          a.model || chalk.gray('(default)'),
          a.executorType || chalk.gray('(default)'),
        ])
      );
    }
  );
}
