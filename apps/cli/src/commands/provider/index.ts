/**
 * viben provider - Provider management commands
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output } from '../../lib/output';
import { listProvidersCommand } from './list';
import { createProviderCommand } from './create';
import { removeProviderCommand } from './remove';
import { setDefaultProviderCommand } from './set-default';
import { statusProviderCommand } from './status';

interface ProviderOptions {
  name?: string;
  type?: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Register the provider command
 */
export function registerProviderCommand(program: Command): void {
  const providerCmd = program
    .command('provider')
    .description('Manage API providers');

  // provider list
  providerCmd
    .command('list')
    .description('List all providers')
    .action(() => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        listProvidersCommand(ctx);
      } catch (error) {
        if (error instanceof CliError) {
          output(ctx, error.toResponse(), () => {
            console.error(chalk.red('Error:'), error.message);
          });
          process.exit(1);
        }
        throw error;
      }
    });

  // provider create
  providerCmd
    .command('create')
    .description('Create a new provider')
    .option('-n, --name <name>', 'Provider name (auto-generated if not provided)')
    .requiredOption('-t, --type <type>', 'Provider type (openai, anthropic, google, azure, openrouter, ollama, custom)')
    .option('--api-key <key>', 'API key')
    .option('--base-url <url>', 'Base URL')
    .action((options: ProviderOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        if (!options.type) {
          throw new CliError('Provider type is required (-t, --type)', 'MISSING_TYPE');
        }
        createProviderCommand(ctx, {
          name: options.name,
          type: options.type,
          apiKey: options.apiKey,
          baseUrl: options.baseUrl,
        });
      } catch (error) {
        if (error instanceof CliError) {
          output(ctx, error.toResponse(), () => {
            console.error(chalk.red('Error:'), error.message);
          });
          process.exit(1);
        }
        throw error;
      }
    });

  // provider remove
  providerCmd
    .command('remove')
    .description('Remove a provider')
    .requiredOption('-n, --name <name>', 'Provider name (required)')
    .action((options: ProviderOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        if (!options.name) {
          throw new CliError('Provider name is required (-n, --name)', 'MISSING_NAME');
        }
        removeProviderCommand(ctx, { name: options.name });
      } catch (error) {
        if (error instanceof CliError) {
          output(ctx, error.toResponse(), () => {
            console.error(chalk.red('Error:'), error.message);
          });
          process.exit(1);
        }
        throw error;
      }
    });

  // provider set-default
  providerCmd
    .command('set-default')
    .description('Set default provider')
    .requiredOption('-n, --name <name>', 'Provider name (required)')
    .action((options: ProviderOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        if (!options.name) {
          throw new CliError('Provider name is required (-n, --name)', 'MISSING_NAME');
        }
        setDefaultProviderCommand(ctx, { name: options.name });
      } catch (error) {
        if (error instanceof CliError) {
          output(ctx, error.toResponse(), () => {
            console.error(chalk.red('Error:'), error.message);
          });
          process.exit(1);
        }
        throw error;
      }
    });

  // provider status
  providerCmd
    .command('status')
    .description('Check provider connectivity')
    .option('-n, --name <name>', 'Provider name (optional, check all if not provided)')
    .action(async (options: ProviderOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        await statusProviderCommand(ctx, { name: options.name });
      } catch (error) {
        if (error instanceof CliError) {
          output(ctx, error.toResponse(), () => {
            console.error(chalk.red('Error:'), error.message);
          });
          process.exit(1);
        }
        throw error;
      }
    });
}
