/**
 * viben skill - Skill management commands
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output } from '../../lib/output';
import { listInstalledSkills, listAvailableSkills } from './list';
import { installSkillCommand } from './install';
import { uninstallSkillCommand } from './uninstall';

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
 * Register the skill command
 */
export function registerSkillCommand(program: Command): void {
  const skillCmd = program
    .command('skill')
    .description('Manage skills');

  // skill list
  skillCmd
    .command('list')
    .description('List installed skills')
    .option('--available', 'List available skills from marketplace')
    .action((options: { available?: boolean }) => {
      const ctx = getOutputContext(program);
      try {
        if (options.available) {
          listAvailableSkills(ctx);
        } else {
          listInstalledSkills(ctx);
        }
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // skill install
  skillCmd
    .command('install <name>')
    .description('Install a skill')
    .action(async (name: string) => {
      const ctx = getOutputContext(program);
      try {
        await installSkillCommand(ctx, name);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // skill uninstall
  skillCmd
    .command('uninstall <name>')
    .description('Uninstall a skill')
    .action(async (name: string) => {
      const ctx = getOutputContext(program);
      try {
        await uninstallSkillCommand(ctx, name);
      } catch (error) {
        handleError(ctx, error);
      }
    });
}
