/**
 * viben config - Git-style configuration management
 */

import { spawn } from 'child_process';
import chalk from 'chalk';
import type { Command } from 'commander';
import type { OutputContext, ConfigScope, VibenConfig } from '../types';
import { CliError } from '../types';
import {
  readScopedConfig,
  writeScopedConfig,
  getConfigValue,
  setConfigValue,
  deleteConfigValue,
  flattenConfig,
  getConfigWithOrigin,
  DEFAULT_CONFIG,
  getEditor,
} from '../lib/config';
import { resolveScope, getConfigPathForScope } from '../lib/scope';
import { output, successResponse, outputKeyValue, outputTable } from '../lib/output';

interface ConfigOptions {
  global?: boolean;
  workspace?: boolean;
  showOrigin?: boolean;
}

/**
 * Parse value string to appropriate type
 */
function parseValue(value: string): unknown {
  // Try to parse as JSON first (handles arrays, objects, booleans, numbers)
  try {
    return JSON.parse(value);
  } catch {
    // Return as string if not valid JSON
    return value;
  }
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Get command - read a config value
 */
function handleGet(
  ctx: OutputContext,
  scope: ConfigScope,
  key: string
): void {
  const config = readScopedConfig(scope) || DEFAULT_CONFIG;
  const value = getConfigValue(config, key);

  if (value === undefined) {
    output(ctx, successResponse({ key, value: null }), () => {
      // No output for undefined values (git config behavior)
    });
    return;
  }

  output(ctx, successResponse({ key, value }), () => {
    console.log(formatValue(value));
  });
}

/**
 * Set command - set a config value
 */
function handleSet(
  ctx: OutputContext,
  scope: ConfigScope,
  key: string,
  value: string
): void {
  const config = readScopedConfig(scope) || { version: 1 };
  const parsedValue = parseValue(value);
  const newConfig = setConfigValue(config, key, parsedValue);

  writeScopedConfig(scope, newConfig);

  output(ctx, successResponse({ key, value: parsedValue, scope }), () => {
    console.log(chalk.green('OK') + ` Set ${chalk.cyan(key)} = ${formatValue(parsedValue)}`);
  });
}

/**
 * Unset command - remove a config value
 */
function handleUnset(
  ctx: OutputContext,
  scope: ConfigScope,
  key: string
): void {
  const config = readScopedConfig(scope);
  if (!config) {
    throw new CliError(
      `No config file found for scope: ${scope}`,
      'CONFIG_NOT_FOUND'
    );
  }

  const newConfig = deleteConfigValue(config, key);
  writeScopedConfig(scope, newConfig);

  output(ctx, successResponse({ key, scope }), () => {
    console.log(chalk.green('OK') + ` Unset ${chalk.cyan(key)}`);
  });
}

/**
 * List command - list all config values
 */
function handleList(
  ctx: OutputContext,
  scope: ConfigScope,
  showOrigin: boolean
): void {
  if (showOrigin) {
    // Show config with origin information
    const items = getConfigWithOrigin();

    output(ctx, successResponse({ items }), () => {
      outputKeyValue(ctx, items);
    });
    return;
  }

  // List config for specific scope
  const config = readScopedConfig(scope) || DEFAULT_CONFIG;
  const items = flattenConfig(config);

  output(ctx, successResponse({ items, scope }), () => {
    for (const item of items) {
      console.log(`${chalk.cyan(item.key)}=${item.value}`);
    }
  });
}

/**
 * Edit command - open config in editor
 */
async function handleEdit(
  ctx: OutputContext,
  scope: ConfigScope
): Promise<void> {
  const configPath = getConfigPathForScope(scope);
  const editor = getEditor();

  output(ctx, successResponse({ configPath, editor }), () => {
    console.log(`Opening ${chalk.cyan(configPath)} in ${chalk.yellow(editor)}...`);
  });

  // Spawn editor
  const child = spawn(editor, [configPath], {
    stdio: 'inherit',
    shell: true,
  });

  return new Promise((resolve, reject) => {
    child.on('error', (error) => {
      reject(new CliError(
        `Failed to open editor: ${error.message}`,
        'EDITOR_ERROR',
        error
      ));
    });
    child.on('close', () => {
      resolve();
    });
  });
}

/**
 * Register the config command
 */
export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Manage Viben configuration (git-style)');

  // config get <key>
  configCmd
    .command('get <key>')
    .description('Get a config value')
    .option('-g, --global', 'Use global config')
    .option('-w, --workspace', 'Use workspace config')
    .action((key: string, options: ConfigOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        const scope = resolveScope({
          global: options.global || program.opts().global,
          workspace: options.workspace || program.opts().workspace,
        });
        handleGet(ctx, scope, key);
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

  // config set <key> <value>
  configCmd
    .command('set <key> <value>')
    .description('Set a config value')
    .option('-g, --global', 'Use global config')
    .option('-w, --workspace', 'Use workspace config')
    .action((key: string, value: string, options: ConfigOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        const scope = resolveScope({
          global: options.global || program.opts().global,
          workspace: options.workspace || program.opts().workspace,
        });
        handleSet(ctx, scope, key, value);
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

  // config unset <key>
  configCmd
    .command('unset <key>')
    .description('Remove a config value')
    .option('-g, --global', 'Use global config')
    .option('-w, --workspace', 'Use workspace config')
    .action((key: string, options: ConfigOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        const scope = resolveScope({
          global: options.global || program.opts().global,
          workspace: options.workspace || program.opts().workspace,
        });
        handleUnset(ctx, scope, key);
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

  // config list
  configCmd
    .command('list')
    .description('List all config values')
    .option('-g, --global', 'Use global config')
    .option('-w, --workspace', 'Use workspace config')
    .option('--show-origin', 'Show the origin of each config value')
    .action((options: ConfigOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        const scope = resolveScope({
          global: options.global || program.opts().global,
          workspace: options.workspace || program.opts().workspace,
        });
        handleList(ctx, scope, options.showOrigin || false);
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

  // config edit
  configCmd
    .command('edit')
    .description('Open config in editor')
    .option('-g, --global', 'Edit global config')
    .option('-w, --workspace', 'Edit workspace config')
    .action(async (options: ConfigOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        const scope = resolveScope({
          global: options.global || program.opts().global,
          workspace: options.workspace || program.opts().workspace,
        });
        await handleEdit(ctx, scope);
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
