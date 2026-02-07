/**
 * viben cron add - Add a new cron job
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { getCronService, type AddJobOptions } from '../../lib/cron';

export interface AddCronOptions {
  name: string;
  message: string;
  cron?: string;
  every?: number;
  channel?: string;
  agent?: string;
  enabled?: boolean;
}

/**
 * Add a new cron job
 */
export async function addCronJob(
  ctx: OutputContext,
  options: AddCronOptions
): Promise<void> {
  const service = getCronService();

  const addOptions: AddJobOptions = {
    name: options.name,
    message: options.message,
    cron: options.cron,
    every: options.every,
    channel: options.channel,
    agent: options.agent,
    enabled: options.enabled !== false,
  };

  const job = await service.addJob(addOptions);

  output(
    ctx,
    successResponse({ job }),
    () => {
      console.log(chalk.green('Created cron job:'), job.id);
      console.log();
      console.log(`  Name:     ${job.name}`);
      console.log(`  Message:  "${job.message}"`);
      console.log(`  Schedule: ${job.cron ?? `every ${job.every}s`}`);
      if (job.channel) {
        console.log(`  Channel:  ${job.channel}`);
      }
      console.log(`  Agent:    ${job.agent ?? 'main'}`);
      console.log(`  Status:   ${job.enabled ? chalk.green('enabled') : chalk.gray('disabled')}`);

      if (job.nextRun) {
        const nextRunDate = new Date(job.nextRun);
        console.log(`  Next run: ${nextRunDate.toLocaleString()}`);
      }
    }
  );
}
