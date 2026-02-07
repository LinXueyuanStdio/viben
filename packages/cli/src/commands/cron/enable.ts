/**
 * viben cron enable - Enable a cron job
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { getCronService } from '../../lib/cron';

/**
 * Enable a cron job
 */
export async function enableCronJob(
  ctx: OutputContext,
  jobId: string
): Promise<void> {
  const service = getCronService();

  const job = await service.enableJob(jobId);

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
