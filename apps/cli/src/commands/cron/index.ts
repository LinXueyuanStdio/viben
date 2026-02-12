/**
 * viben cron - Cron job management commands
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output } from '../../lib/output';
import { listCronJobs } from './list';
import { addCronJob, type AddCronOptions } from './add';
import { removeCronJob } from './remove';
import { enableCronJob } from './enable';
import { disableCronJob } from './disable';
import { showCronJob } from './show';
import { runCronJob } from './run';

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
 * Register the cron command
 */
export function registerCronCommand(program: Command): void {
  const cronCmd = program
    .command('cron')
    .description('Manage scheduled tasks');

  // cron list
  cronCmd
    .command('list')
    .description('List all cron jobs')
    .action(async () => {
      const ctx = getOutputContext(program);
      try {
        await listCronJobs(ctx);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // cron add
  cronCmd
    .command('add')
    .description('Add a new cron job')
    .requiredOption('--name <name>', 'Job name (required)')
    .requiredOption('--message <message>', 'Message to send when job runs (required)')
    .option('--cron <expression>', 'Cron expression (e.g., "0 9 * * *")')
    .option('--every <seconds>', 'Interval in seconds', parseInt)
    .option('--channel <id>', 'Target channel ID')
    .option('--agent <id>', 'Agent ID to use (default: main)')
    .option('--disabled', 'Create job in disabled state')
    .action(async (options: {
      name: string;
      message: string;
      cron?: string;
      every?: number;
      channel?: string;
      agent?: string;
      disabled?: boolean;
    }) => {
      const ctx = getOutputContext(program);
      try {
        const addOptions: AddCronOptions = {
          name: options.name,
          message: options.message,
          cron: options.cron,
          every: options.every,
          channel: options.channel,
          agent: options.agent,
          enabled: !options.disabled,
        };
        await addCronJob(ctx, addOptions);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // cron remove
  cronCmd
    .command('remove <job_id>')
    .description('Remove a cron job')
    .action(async (jobId: string) => {
      const ctx = getOutputContext(program);
      try {
        await removeCronJob(ctx, jobId);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // cron enable
  cronCmd
    .command('enable <job_id>')
    .description('Enable a cron job')
    .action(async (jobId: string) => {
      const ctx = getOutputContext(program);
      try {
        await enableCronJob(ctx, jobId);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // cron disable
  cronCmd
    .command('disable <job_id>')
    .description('Disable a cron job')
    .action(async (jobId: string) => {
      const ctx = getOutputContext(program);
      try {
        await disableCronJob(ctx, jobId);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // cron show
  cronCmd
    .command('show <job_id>')
    .description('Show cron job details')
    .action(async (jobId: string) => {
      const ctx = getOutputContext(program);
      try {
        await showCronJob(ctx, jobId);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // cron run
  cronCmd
    .command('run <job_id>')
    .description('Run a cron job immediately')
    .action(async (jobId: string) => {
      const ctx = getOutputContext(program);
      try {
        await runCronJob(ctx, jobId);
      } catch (error) {
        handleError(ctx, error);
      }
    });
}
