/**
 * viben cron remove - Remove a cron job
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { getCronService } from '../../lib/cron';

/**
 * Remove a cron job
 */
export async function removeCronJob(
  ctx: OutputContext,
  jobId: string
): Promise<void> {
  const service = getCronService();

  const removed = await service.removeJob(jobId);

  if (!removed) {
    throw new CliError(`Job "${jobId}" not found`, 'JOB_NOT_FOUND');
  }

  output(
    ctx,
    successResponse({ removed: true, id: jobId }),
    () => {
      console.log(chalk.green('Removed cron job:'), jobId);
    }
  );
}
