/**
 * viben cron show - Show cron job details
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { cronGet, type CronJob } from '../../lib/native';

/**
 * Describe a cron expression in human-readable format
 */
function describeCron(expr: string): string {
  // Simple descriptions for common patterns
  const patterns: Record<string, string> = {
    '* * * * *': 'Every minute',
    '0 * * * *': 'Every hour',
    '0 0 * * *': 'Every day at midnight',
    '0 0 * * 0': 'Every Sunday at midnight',
    '0 0 1 * *': 'First day of every month at midnight',
  };

  if (patterns[expr]) {
    return patterns[expr];
  }

  // Parse the expression parts
  const parts = expr.split(' ');
  if (parts.length < 5) {
    return expr;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Simple descriptions
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (minute.startsWith('*/') && hour === '*') {
      const mins = minute.slice(2);
      return `Every ${mins} minutes`;
    }
    if (hour.startsWith('*/') && minute === '0') {
      const hours = hour.slice(2);
      return `Every ${hours} hours`;
    }
    if (!minute.includes('*') && !hour.includes('*')) {
      return `Every day at ${hour}:${minute.padStart(2, '0')}`;
    }
  }

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '1-5') {
    if (!minute.includes('*') && !hour.includes('*')) {
      return `Weekdays at ${hour}:${minute.padStart(2, '0')}`;
    }
  }

  return expr;
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(ms: number | undefined): string {
  if (!ms) {
    return '-';
  }

  const date = new Date(ms);
  return date.toLocaleString();
}

/**
 * Show cron job details
 */
export async function showCronJob(ctx: OutputContext, jobId: string): Promise<void> {
  const job = await cronGet(jobId);

  if (!job) {
    throw new CliError(`Job "${jobId}" not found`, 'JOB_NOT_FOUND');
  }

  output(
    ctx,
    successResponse({ job }),
    () => {
      console.log(`Cron Job: ${chalk.cyan(job.id)}`);
      console.log(`  Name:    ${job.name}`);
      console.log(`  Type:    ${job.jobType}`);
      console.log(`  Status:  ${job.enabled ? chalk.green('enabled') : chalk.gray('disabled')}`);

      if (job.cron) {
        console.log(`  Schedule: ${job.cron} (${describeCron(job.cron)})`);
      } else if (job.every) {
        const desc = job.every >= 3600
          ? `${job.every / 3600} hours`
          : job.every >= 60
            ? `${job.every / 60} minutes`
            : `${job.every} seconds`;
        console.log(`  Schedule: every ${desc}`);
      }

      if (job.message) {
        console.log(`  Message: "${job.message}"`);
      }
      if (job.script) {
        console.log(`  Script:  "${job.script}"`);
      }

      if (job.channel) {
        console.log(`  Channel: ${job.channel}`);
      }

      console.log(`  Agent:   ${job.agent ?? 'main'}`);
      console.log();

      if (job.lastRun) {
        const statusColor = job.lastStatus === 'Success' ? chalk.green : chalk.red;
        console.log(`  Last run:  ${formatTimestamp(job.lastRun)} (${statusColor(job.lastStatus ?? 'unknown')})`);
        if (job.lastError) {
          console.log(`  Last error: ${chalk.red(job.lastError)}`);
        }
        if (job.lastOutput) {
          console.log(`  Last output: ${job.lastOutput.substring(0, 100)}${job.lastOutput.length > 100 ? '...' : ''}`);
        }
      } else {
        console.log(`  Last run:  ${chalk.gray('never')}`);
      }

      if (job.enabled && job.nextRun) {
        console.log(`  Next run:  ${formatTimestamp(job.nextRun)}`);
      }
    }
  );
}
