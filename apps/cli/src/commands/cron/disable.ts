/**
 * viben cron disable - Disable a cron job
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { cronDisable } from '../../lib/native';

/**
 * Disable a cron job
 */
export async function disableCronJob(
  ctx: OutputContext,
  jobId: string
): Promise<void> {
  const job = await cronDisable(jobId);

  output(
    ctx,
    successResponse({ job }),
    () => {
      console.log(chalk.yellow('Disabled cron job:'), jobId);
    }
  );
}
