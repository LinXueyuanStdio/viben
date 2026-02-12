/**
 * viben provider list - List all providers
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { providerList, providerGetDefault, type Provider } from '../../lib/native';

/**
 * List all providers
 */
export async function listProvidersCommand(ctx: OutputContext): Promise<void> {
  const providers = await providerList();
  const defaultId = await providerGetDefault();

  output(
    ctx,
    successResponse({
      providers: providers.map((p: Provider) => ({
        id: p.id,
        name: p.name,
        type: p.providerType,
        enabled: p.enabled,
        isDefault: p.isDefault,
      })),
      count: providers.length,
      defaultProvider: defaultId,
    }),
    () => {
      if (providers.length === 0) {
        console.log(chalk.gray('No providers configured.'));
        console.log();
        console.log('Create a provider with:');
        console.log(chalk.cyan('  viben provider create -t <type>'));
        console.log();
        console.log('Available types: openai, anthropic, google, azure, openrouter, ollama, custom');
        return;
      }

      console.log(chalk.bold('Providers:'));
      console.log();

      outputTable(
        ctx,
        ['ID', 'Name', 'Type', 'Enabled', 'Default'],
        providers.map((p: Provider) => [
          p.isDefault ? chalk.cyan(p.id + '*') : p.id,
          p.name,
          p.providerType,
          p.enabled ? chalk.green('yes') : chalk.gray('no'),
          p.isDefault ? chalk.green('yes') : chalk.gray('no'),
        ])
      );

      console.log();
      console.log(chalk.gray('* = default provider'));
    }
  );
}
