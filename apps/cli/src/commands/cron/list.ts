/**
 * viben cron list - List all cron jobs
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { cronList, type CronJob } from '../../lib/native';

/**
 * Format a timestamp for display
 */
function formatTimestamp(ms: number | undefined): string {
  if (!ms) {
    return '-';
  }

  const date = new Date(ms);

  // Format as "YYYY-MM-DD HH:mm"
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Format schedule for display
 */
function formatSchedule(cron?: string, every?: number): string {
  if (cron) {
    return `"${cron}"`;
  }
  if (every) {
    if (every >= 3600) {
      const hours = every / 3600;
      return `every ${hours}h`;
    }
    if (every >= 60) {
      const minutes = every / 60;
      return `every ${minutes}m`;
    }
    return `every ${every}s`;
  }
  return '-';
}

/**
 * List all cron jobs
 */
export async function listCronJobs(ctx: OutputContext): Promise<void> {
  const jobs = await cronList();

  output(
    ctx,
    successResponse({ jobs, count: jobs.length }),
    () => {
      if (jobs.length === 0) {
        console.log(chalk.gray('No scheduled jobs found.'));
        console.log();
        console.log('Add a cron job with:');
        console.log(chalk.cyan('  viben cron add --name "my-job" --message "Hello" --cron "0 9 * * *"'));
        return;
      }

      console.log('Scheduled Jobs:');

      outputTable(
        ctx,
        ['ID', 'Status', 'Schedule', 'Next Run'],
        jobs.map((job) => [
          job.id,
          job.enabled ? chalk.green('enabled') : chalk.gray('disabled'),
          formatSchedule(job.cron, job.every),
          job.enabled ? formatTimestamp(job.nextRun) : '-',
        ])
      );
    }
  );
}
