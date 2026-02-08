/**
 * viben cron run - Run a cron job immediately
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { getCronService } from '../../lib/cron';

/**
 * Run a cron job immediately
 */
export async function runCronJob(
  ctx: OutputContext,
  jobId: string
): Promise<void> {
  const service = getCronService();

  console.log(`Running job: ${jobId}...`);

  await service.runJob(jobId);

  output(
    ctx,
    successResponse({ executed: true, id: jobId }),
    () => {
      console.log(chalk.green('Job executed:'), jobId);
    }
  );
}
