/**
 * viben channel set-default - Set the default channel
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { setDefaultChannel, channelExists } from '../../lib/channels';

export interface SetDefaultOptions {
  name: string;
}

/**
 * Set the default channel
 */
export function setDefault(ctx: OutputContext, options: SetDefaultOptions): void {
  const { name } = options;

  // Check if channel exists
  if (!channelExists(name)) {
    throw new CliError(`Channel "${name}" not found`, 'CHANNEL_NOT_FOUND');
  }

  // Set as default
  setDefaultChannel(name);

  const response = successResponse({
    id: name,
    isDefault: true,
  });

  output(ctx, response, () => {
    console.log(
      chalk.green('\u2713') +
        ` Set ${chalk.cyan(name)} as the default channel`
    );
  });
}
