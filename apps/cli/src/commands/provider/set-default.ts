/**
 * viben provider set-default - Set default provider
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { providerGet, providerSetDefault as nativeSetDefault } from '../../lib/native';

interface SetDefaultOptions {
  name: string;
}

/**
 * Set default provider
 */
export async function setDefaultProviderCommand(ctx: OutputContext, options: SetDefaultOptions): Promise<void> {
  const { name } = options;

  // Verify provider exists
  const provider = await providerGet(name);
  if (!provider) {
    throw new CliError(`Provider "${name}" not found`, 'PROVIDER_NOT_FOUND');
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
  await nativeSetDefault(name);

  output(
    ctx,
    successResponse({
      name,
      type: provider.providerType,
    }),
    () => {
      console.log(chalk.green('OK') + ` Set "${chalk.cyan(name)}" as default provider`);
    }
  );
}
