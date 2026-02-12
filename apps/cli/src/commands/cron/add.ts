/**
 * viben cron add - Add a new cron job
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { cronCreate, type CreateCronJobOptions } from '../../lib/native';

export interface AddCronOptions {
  name: string;
  message?: string;
  script?: string;
  jobType?: string;
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
  const createOptions: CreateCronJobOptions = {
    name: options.name,
    message: options.message,
    script: options.script,
    jobType: options.jobType,
    cron: options.cron,
    every: options.every,
    channel: options.channel,
    agent: options.agent,
    enabled: options.enabled !== false,
  };

  const job = await cronCreate(createOptions);

  output(
    ctx,
    successResponse({ job }),
    () => {
      console.log(chalk.green('Created cron job:'), job.id);
      console.log();
      console.log(`  Name:     ${job.name}`);
      console.log(`  Type:     ${job.jobType}`);
      if (job.message) {
        console.log(`  Message:  "${job.message}"`);
      }
      if (job.script) {
        console.log(`  Script:   "${job.script}"`);
      }
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
