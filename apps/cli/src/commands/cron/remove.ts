/**
 * viben cron remove - Remove a cron job
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { cronRemove } from '../../lib/native';

/**
 * Remove a cron job
 */
export async function removeCronJob(
  ctx: OutputContext,
  jobId: string
): Promise<void> {
  await cronRemove(jobId);

  output(
    ctx,
    successResponse({ removed: true, id: jobId }),
    () => {
      console.log(chalk.green('Removed cron job:'), jobId);
    }
  );
}
