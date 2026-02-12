/**
 * viben cron run - Run a cron job immediately
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { cronRun } from '../../lib/native';

/**
 * Run a cron job immediately
 */
export async function runCronJob(
  ctx: OutputContext,
  jobId: string
): Promise<void> {
  console.log(`Running job: ${jobId}...`);

  await cronRun(jobId);

  output(
    ctx,
    successResponse({ executed: true, id: jobId }),
    () => {
      console.log(chalk.green('Job executed:'), jobId);
    }
  );
}
