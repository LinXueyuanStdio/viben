/**
 * viben workspace - Workspace management commands
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output } from '../../lib/output';
import { listWorkspacesCommand } from './list';
import { showCurrentWorkspace } from './current';

/**
 * Register the workspace command
 */
export function registerWorkspaceCommand(program: Command): void {
  const workspaceCmd = program
    .command('workspace')
    .description('Workspace operations');

  // workspace list
  workspaceCmd
    .command('list')
    .description('List all known workspaces')
    .action(() => {
      const ctx = getContext(program);

      try {
        listWorkspacesCommand(ctx);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // workspace current
  workspaceCmd
    .command('current')
    .description('Show current workspace information')
    .action(() => {
      const ctx = getContext(program);

      try {
        showCurrentWorkspace(ctx);
      } catch (error) {
        handleError(ctx, error);
      }
    });
}

/**
 * Get output context from program options
 */
function getContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json || false,
    verbose: opts.verbose || false,
    quiet: opts.quiet || false,
  };
}

/**
 * Handle errors with proper output
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
