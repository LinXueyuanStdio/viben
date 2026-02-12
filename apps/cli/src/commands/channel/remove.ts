/**
 * viben channel remove - Remove a channel
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { channelRemove } from '../../lib/native';

export interface RemoveChannelOptions {
  name: string;
  force?: boolean;
}

/**
 * Remove a channel
 */
export async function removeChannel(ctx: OutputContext, options: RemoveChannelOptions): Promise<void> {
  const { name, force } = options;

  // In non-force mode, we would prompt for confirmation
  if (!force && !ctx.quiet) {
    console.log(chalk.yellow('Warning:'), `Removing channel "${name}"`);
  }

  // Delete the channel (will throw error if not found)
  await channelRemove(name);

  const response = successResponse({
    id: name,
    removed: true,
  });

  output(ctx, response, () => {
    console.log(chalk.green('\u2713') + ` Removed channel ${chalk.cyan(name)}`);
  });
}
