/**
 * viben executor - Executor discovery commands
 *
 * Executors are the underlying coding agents (e.g., Claude Code, Cursor)
 * that Viben uses to run agents with custom skills, prompts, and MCP servers.
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output } from '../../lib/output';
import { listExecutors } from './list';
import { showExecutor } from './show';

interface ExecutorOptions {
  name?: string;
}

/**
 * Register the executor command
 */
export function registerExecutorCommand(program: Command): void {
  const executorCmd = program
    .command('executor')
    .description('Discover and inspect executors (Claude Code, Cursor, etc.)');

  // executor list
  executorCmd
    .command('list')
    .description('List all discovered executors')
    .action(() => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        listExecutors(ctx);
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

  // executor show
  executorCmd
    .command('show')
    .description('Show executor details')
    .requiredOption('-n, --name <id>', 'Executor ID (e.g., CLAUDE_CODE)')
    .action((options: ExecutorOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        if (!options.name) {
          throw new CliError('Executor ID is required (-n, --name)', 'MISSING_ID');
        }
        showExecutor(ctx, options.name);
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
