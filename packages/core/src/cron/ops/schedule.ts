/**
 * Cron scheduling utilities
 *
 * Pure functions for calculating next execution times and formatting schedules.
 */

import type { CronJob } from "./types";

// =============================================================================
// Schedule Calculation
// =============================================================================

/**
 * Get next cron time (simple implementation for common patterns)
 *
 * Note: This is a simplified cron parser that handles basic patterns.
 * For complex cron expressions, consider using a full cron library.
 */
export function getNextCronTime(cronExpr: string): Date | null {
  try {
    // Simple cron parser for common patterns
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5 && parts.length !== 6) return null;

    // For now, just return a time in the near future for interval-like patterns
    // A full cron parser would be needed for complex expressions
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0);
    next.setMilliseconds(0);

    // Parse minute and hour for simple patterns
    const minute = parts[parts.length === 6 ? 1 : 0];
    const hour = parts[parts.length === 6 ? 2 : 1];

    if (minute !== "*") {
      next.setMinutes(parseInt(minute, 10));
    }
    if (hour !== "*") {
      next.setHours(parseInt(hour, 10));
    }

    // If the calculated time is in the past, move to next day
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  } catch {
    return null;
  }
}

/**
 * Calculate next interval execution time
 *
 * @param every - Interval in seconds
 * @param lastRun - Last run timestamp in milliseconds (optional)
 * @returns Next run timestamp in milliseconds
 */
export function getNextIntervalTime(every: number, lastRun?: number): number {
  const now = Date.now();
  const intervalMs = every * 1000;

  if (lastRun) {
    // Calculate from last run
    const nextFromLastRun = lastRun + intervalMs;
    // If that's in the past, calculate from now
    return nextFromLastRun > now ? nextFromLastRun : now + intervalMs;
  }

  // No last run, schedule from now
  return now + intervalMs;
}

// =============================================================================
// Format Utilities
// =============================================================================

/**
 * Format schedule for display
 */
export function formatSchedule(job: CronJob): string {
  if (job.cron) {
    return `cron: ${job.cron}`;
  }
  if (job.every) {
    if (job.every < 60) {
      return `every ${job.every}s`;
    }
    if (job.every < 3600) {
      return `every ${Math.floor(job.every / 60)}m`;
    }
    if (job.every < 86400) {
      return `every ${Math.floor(job.every / 3600)}h`;
    }
    return `every ${Math.floor(job.every / 86400)}d`;
  }
  return "-";
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(ts?: number): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

/**
 * Format duration in milliseconds for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`;
  }
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Calculate next run time for a job
 */
export function calculateNextRun(job: CronJob): number | undefined {
  if (job.cron) {
    const nextTime = getNextCronTime(job.cron);
    return nextTime?.getTime();
  }
  if (job.every) {
    return getNextIntervalTime(job.every, job.last_run);
  }
  return undefined;
}
