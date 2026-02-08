/**
 * viben provider list - List all providers
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { listProviders } from '../../lib/providers';

/**
 * List all providers
 */
export function listProvidersCommand(ctx: OutputContext): void {
  const providers = listProviders();

  output(
    ctx,
    successResponse({
      providers: providers.map((p) => ({
        name: p.name,
        type: p.type,
        isDefault: p.isDefault,
      })),
      count: providers.length,
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
        ['Name', 'Type', 'Default'],
        providers.map((p) => [
          p.isDefault ? chalk.cyan(p.name + '*') : p.name,
          p.type,
          p.isDefault ? chalk.green('yes') : chalk.gray('no'),
        ])
      );

      console.log();
      console.log(chalk.gray('* = default provider'));
    }
  );
}
