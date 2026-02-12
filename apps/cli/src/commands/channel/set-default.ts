/**
 * viben channel set-default - Set the default channel
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { channelSetDefault } from '../../lib/native';

export interface SetDefaultOptions {
  name: string;
}

/**
 * Set the default channel
 */
export async function setDefault(ctx: OutputContext, options: SetDefaultOptions): Promise<void> {
  const { name } = options;

  // Set as default (will throw if channel not found)
  await channelSetDefault(name);

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
