/**
 * viben channel remove - Remove a channel
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { deleteChannelConfig, channelExists } from '../../lib/channels';

export interface RemoveChannelOptions {
  name: string;
  force?: boolean;
}

/**
 * Remove a channel
 */
export function removeChannel(ctx: OutputContext, options: RemoveChannelOptions): void {
  const { name, force } = options;

  // Check if channel exists
  if (!channelExists(name)) {
    throw new CliError(`Channel "${name}" not found`, 'CHANNEL_NOT_FOUND');
  }

  // In non-force mode, we would prompt for confirmation
  // For now, just proceed (in a real CLI, we'd use readline or inquirer)
  if (!force && !ctx.quiet) {
    // Just warn, don't block
    console.log(chalk.yellow('Warning:'), `Removing channel "${name}"`);
  }

  // Delete the channel
  deleteChannelConfig(name);

  const response = successResponse({
    id: name,
    removed: true,
  });

  output(ctx, response, () => {
    console.log(chalk.green('\u2713') + ` Removed channel ${chalk.cyan(name)}`);
  });
}
