/**
 * viben init - Initialize a Viben workspace
 *
 * Uses NAPI bindings to viben-core for workspace initialization.
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import type { OutputContext } from '../types';
import { CliError } from '../types';
import { output, successResponse } from '../lib/output';
import { initWorkspace } from '../lib/workspace';

interface InitOptions {
  from?: string;
  force?: boolean;
}

/**
 * Register the init command
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a Viben workspace in the current directory')
    .option('--from <template>', 'Initialize from a template')
    .option('--force', 'Force initialization even if workspace already exists')
    .action(async (options: InitOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        // Use NAPI bindings for initialization
        const result = initWorkspace({
          targetDir: process.cwd(),
          template: options.from,
          force: options.force,
        });

        output(
          ctx,
          successResponse({
            success: result.success,
            path: result.path,
            files: result.files,
          }),
          () => {
            console.log(chalk.green('Workspace initialized successfully!'));
            console.log();
            console.log('Created:');
            for (const file of result.files) {
              console.log(chalk.gray(`  .viben/${file}`));
            }
            console.log();
            console.log('Next steps:');
            console.log(chalk.cyan('  viben config list') + '      - View configuration');
            console.log(chalk.cyan('  viben agent list') + '       - List agents');
            console.log(chalk.cyan('  viben mcp install <name>') + ' - Install MCP servers');
            console.log(chalk.cyan('  viben skill install <name>') + ' - Install skills');
          }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Check for specific error types based on message
        if (message.includes('Already inside workspace') || message.includes('Nested workspace')) {
          const cliError = new CliError(message, 'NESTED_WORKSPACE');
          output(ctx, cliError.toResponse(), () => {
            console.error(chalk.red('Error:'), message);
          });
          process.exit(1);
        }

        if (message.includes('already exists') || message.includes('AlreadyExists')) {
          const cliError = new CliError(
            'Workspace already initialized. Use "viben config" to modify settings, or use --force to reinitialize.',
            'WORKSPACE_EXISTS'
          );
          output(ctx, cliError.toResponse(), () => {
            console.error(chalk.red('Error:'), cliError.message);
          });
          process.exit(1);
        }

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
