/**
 * viben channel enable/disable - Enable or disable a channel
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { channelEnable, channelDisable } from '../../lib/native';

export interface EnableChannelOptions {
  name: string;
}

/**
 * Enable a channel
 */
export async function enableChannel(ctx: OutputContext, options: EnableChannelOptions): Promise<void> {
  const { name } = options;

  // Enable the channel (will throw if not found)
  await channelEnable(name);

  const response = successResponse({
    id: name,
    enabled: true,
  });

  output(ctx, response, () => {
    console.log(chalk.green('\u2713') + ` Enabled channel ${chalk.cyan(name)}`);
  });
}

/**
 * Disable a channel
 */
export async function disableChannel(ctx: OutputContext, options: EnableChannelOptions): Promise<void> {
  const { name } = options;

  // Disable the channel (will throw if not found)
  await channelDisable(name);

  const response = successResponse({
    id: name,
    enabled: false,
  });

  output(ctx, response, () => {
    console.log(chalk.green('\u2713') + ` Disabled channel ${chalk.cyan(name)}`);
  });
}
