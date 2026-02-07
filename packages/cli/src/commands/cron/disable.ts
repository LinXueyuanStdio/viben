/**
 * viben cron disable - Disable a cron job
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { getCronService } from '../../lib/cron';

/**
 * Disable a cron job
 */
export async function disableCronJob(
  ctx: OutputContext,
  jobId: string
): Promise<void> {
  const service = getCronService();

  const job = await service.disableJob(jobId);

  output(
    ctx,
    successResponse({ job }),
    () => {
      console.log(chalk.yellow('Disabled cron job:'), jobId);
    }
  );
}
