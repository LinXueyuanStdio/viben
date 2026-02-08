/**
 * viben provider remove - Remove a provider
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { removeProvider, getProvider } from '../../lib/providers';
import { CliError } from '../../types';

interface RemoveOptions {
  name: string;
}

/**
 * Remove a provider
 */
export function removeProviderCommand(ctx: OutputContext, options: RemoveOptions): void {
  const { name } = options;

  // Get provider info before removing
  const provider = getProvider(name);
  if (!provider) {
    throw new CliError(
      `Provider "${name}" not found`,
      'PROVIDER_NOT_FOUND'
    );
  }

  const wasDefault = provider.isDefault;

  // Remove the provider
  removeProvider(name);

  output(
    ctx,
    successResponse({
      removed: name,
      wasDefault,
    }),
    () => {
      console.log(chalk.green('OK') + ` Removed provider "${chalk.cyan(name)}"`);

      if (wasDefault) {
        console.log();
        console.log(chalk.yellow('Note:') + ' This was the default provider.');
        console.log('Use ' + chalk.cyan('viben provider set-default -n <name>') + ' to set a new default.');
      }
    }
  );
}
