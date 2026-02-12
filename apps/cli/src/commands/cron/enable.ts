/**
 * viben cron enable - Enable a cron job
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { cronEnable } from '../../lib/native';

/**
 * Enable a cron job
 */
export async function enableCronJob(
  ctx: OutputContext,
  jobId: string
): Promise<void> {
  const job = await cronEnable(jobId);

  output(
    ctx,
    successResponse({ job }),
    () => {
      console.log(chalk.green('Enabled cron job:'), jobId);
      if (job.nextRun) {
        const nextRunDate = new Date(job.nextRun);
        console.log(`  Next run: ${nextRunDate.toLocaleString()}`);
      }
    }
  );
}
