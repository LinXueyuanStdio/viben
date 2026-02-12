/**
 * viben agent remove - Remove an agent
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { agentGet, agentRemove as nativeAgentRemove } from '../../lib/native';

interface RemoveOptions {
  name: string;
  force?: boolean;
}

/**
 * Remove an agent
 */
export async function removeAgent(ctx: OutputContext, options: RemoveOptions): Promise<void> {
  const id = options.name;

  // Verify agent exists first
  const agent = await agentGet(id);

  if (!agent) {
    throw new CliError(`Agent "${id}" not found`, 'AGENT_NOT_FOUND');
  }

  // In non-force mode, we would prompt for confirmation
  // For CLI, we just proceed (use --force to skip any future confirmation logic)
  if (!options.force && !ctx.json) {
    // For now, proceed without confirmation
    // Could add readline prompt here in the future
  }

  // Delete the agent
  await nativeAgentRemove(id);

  output(
    ctx,
    successResponse({
      removed: true,
      id: agent.id,
      path: agent.path,
    }),
    () => {
      console.log(chalk.green('OK') + ` Removed agent "${chalk.cyan(id)}"`);
      if (agent.path) {
        console.log();
        console.log(chalk.gray('Deleted:'), agent.path);
      }
    }
  );
}
