/**
 * viben model - Model management commands
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output } from '../../lib/output';
import { listAvailableModels } from './list';
import { showModelStatus } from './status';
import { setDefault } from './set-default';
import { listAliases, createModelAlias, removeModelAlias } from './aliases';
import {
  listFallbacks,
  addToFallbacks,
  removeFromFallbacks,
  clearFallbackChain,
} from './fallbacks';

/**
 * Get output context from program options
 */
function getOutputContext(program: Command): OutputContext {
  return {
    json: program.opts().json || false,
    verbose: program.opts().verbose || false,
    quiet: program.opts().quiet || false,
  };
}

/**
 * Handle command errors
 */
function handleError(ctx: OutputContext, error: unknown): void {
  if (error instanceof CliError) {
    output(ctx, error.toResponse(), () => {
      console.error(chalk.red('Error:'), error.message);
    });
    process.exit(1);
  }
  throw error;
}

/**
 * Register the model command
 */
export function registerModelCommand(program: Command): void {
  const modelCmd = program
    .command('model')
    .description('Manage models, aliases, and fallbacks');

  // model list
  modelCmd
    .command('list')
    .description('List available models')
    .option('--provider <name>', 'Filter by provider name')
    .action((options: { provider?: string }) => {
      const ctx = getOutputContext(program);
      try {
        listAvailableModels(ctx, options.provider);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // model status
  modelCmd
    .command('status')
    .description('Show model status')
    .option('-n, --name <model>', 'Specific model to check')
    .action((options: { name?: string }) => {
      const ctx = getOutputContext(program);
      try {
        showModelStatus(ctx, options.name);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // model set-default
  modelCmd
    .command('set-default')
    .description('Set the default model')
    .requiredOption('-n, --name <model>', 'Model ID to set as default')
    .action((options: { name: string }) => {
      const ctx = getOutputContext(program);
      try {
        setDefault(ctx, options.name);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // model aliases (subcommand group)
  const aliasesCmd = modelCmd
    .command('aliases')
    .description('Manage model aliases');

  // model aliases list
  aliasesCmd
    .command('list')
    .description('List all model aliases')
    .action(() => {
      const ctx = getOutputContext(program);
      try {
        listAliases(ctx);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // model aliases create
  aliasesCmd
    .command('create')
    .description('Create a model alias')
    .requiredOption('-n, --name <alias>', 'Alias name')
    .requiredOption('-f, --from <model>', 'Target model ID')
    .action((options: { name: string; from: string }) => {
      const ctx = getOutputContext(program);
      try {
        createModelAlias(ctx, options.name, options.from);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // model aliases remove
  aliasesCmd
    .command('remove')
    .description('Remove a model alias')
    .requiredOption('-n, --name <alias>', 'Alias name to remove')
    .action((options: { name: string }) => {
      const ctx = getOutputContext(program);
      try {
        removeModelAlias(ctx, options.name);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // model fallbacks (subcommand group)
  const fallbacksCmd = modelCmd
    .command('fallbacks')
    .description('Manage model fallback chain');

  // model fallbacks list
  fallbacksCmd
    .command('list')
    .description('List the fallback chain')
    .action(() => {
      const ctx = getOutputContext(program);
      try {
        listFallbacks(ctx);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // model fallbacks create
  fallbacksCmd
    .command('create')
    .description('Add a model to the fallback chain')
    .requiredOption('-n, --name <model>', 'Model ID to add')
    .action((options: { name: string }) => {
      const ctx = getOutputContext(program);
      try {
        addToFallbacks(ctx, options.name);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // model fallbacks remove
  fallbacksCmd
    .command('remove')
    .description('Remove a model from the fallback chain')
    .requiredOption('-n, --name <model>', 'Model ID to remove')
    .action((options: { name: string }) => {
      const ctx = getOutputContext(program);
      try {
        removeFromFallbacks(ctx, options.name);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // model fallbacks clear
  fallbacksCmd
    .command('clear')
    .description('Clear the entire fallback chain')
    .action(() => {
      const ctx = getOutputContext(program);
      try {
        clearFallbackChain(ctx);
      } catch (error) {
        handleError(ctx, error);
      }
    });
}
