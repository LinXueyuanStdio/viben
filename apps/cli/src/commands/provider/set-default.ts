/**
 * viben provider set-default - Set default provider
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { setDefaultProvider, getProvider } from '../../lib/providers';
import { CliError } from '../../types';

interface SetDefaultOptions {
  name: string;
}

/**
 * Set default provider
 */
export function setDefaultProviderCommand(ctx: OutputContext, options: SetDefaultOptions): void {
  const { name } = options;

  // Verify provider exists
  const provider = getProvider(name);
  if (!provider) {
    throw new CliError(
      `Provider "${name}" not found`,
      'PROVIDER_NOT_FOUND'
    );
  }

  // Check if already default
  if (provider.isDefault) {
    output(
      ctx,
      successResponse({
        name,
        alreadyDefault: true,
      }),
      () => {
        console.log(chalk.yellow('Note:') + ` Provider "${chalk.cyan(name)}" is already the default.`);
      }
    );
    return;
  }

  // Set as default
  setDefaultProvider(name);

  output(
    ctx,
    successResponse({
      name,
      type: provider.type,
    }),
    () => {
      console.log(chalk.green('OK') + ` Set "${chalk.cyan(name)}" as default provider`);
    }
  );
}
