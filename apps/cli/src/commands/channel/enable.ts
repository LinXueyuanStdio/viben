/**
 * viben channel enable/disable - Enable or disable a channel
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { setChannelEnabled, channelExists } from '../../lib/channels';

export interface EnableChannelOptions {
  name: string;
}

/**
 * Enable a channel
 */
export function enableChannel(ctx: OutputContext, options: EnableChannelOptions): void {
  const { name } = options;

  // Check if channel exists
  if (!channelExists(name)) {
    throw new CliError(`Channel "${name}" not found`, 'CHANNEL_NOT_FOUND');
  }

  // Enable the channel
  setChannelEnabled(name, true);

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
export function disableChannel(ctx: OutputContext, options: EnableChannelOptions): void {
  const { name } = options;

  // Check if channel exists
  if (!channelExists(name)) {
    throw new CliError(`Channel "${name}" not found`, 'CHANNEL_NOT_FOUND');
  }

  // Disable the channel
  setChannelEnabled(name, false);

  const response = successResponse({
    id: name,
    enabled: false,
  });

  output(ctx, response, () => {
    console.log(chalk.green('\u2713') + ` Disabled channel ${chalk.cyan(name)}`);
  });
}
