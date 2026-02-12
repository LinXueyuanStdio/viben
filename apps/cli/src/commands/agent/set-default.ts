/**
 * viben agent set-default - Set the default agent
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { agentGet, agentSetDefault as nativeSetDefault, agentGetDefault } from '../../lib/native';

interface SetDefaultOptions {
  name: string;
}

/**
 * Set the default agent
 */
export async function setDefaultAgent(ctx: OutputContext, options: SetDefaultOptions): Promise<void> {
  const id = options.name;

  // Verify the agent exists
  const agent = await agentGet(id);

  if (!agent) {
    throw new CliError(`Agent "${id}" not found`, 'AGENT_NOT_FOUND');
  }

  // Set as default via NAPI
  await nativeSetDefault(id);

  output(
    ctx,
    successResponse({
      default_agent: id,
    }),
    () => {
      console.log(chalk.green('OK') + ` Set default agent to "${chalk.cyan(id)}"`);
      console.log();
      console.log('The default agent will be used when no agent is specified.');
      console.log();
      console.log('You can also set the agent via:');
      console.log(chalk.cyan(`  export VIBEN_AGENT=${id}`));
    }
  );
}
