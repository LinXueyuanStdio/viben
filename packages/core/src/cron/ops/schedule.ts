/**
 * Cron scheduling utilities
 *
 * Pure functions for calculating next execution times and formatting schedules.
 * Uses cron-parser for robust cron expression parsing.
 */

import { CronExpressionParser } from "cron-parser";
import type { CronJob } from "./types";

// =============================================================================
// Schedule Calculation
// =============================================================================

/**
 * Get next cron time using cron-parser library
 *
 * Supports all standard cron expressions including:
 * - Simple patterns: "0 9 * * *" (9 AM daily)
 * - Step patterns: "0/5 * * * *" (every 5 minutes)
 * - Range patterns: "0 9-17 * * *" (every hour 9 AM - 5 PM)
 * - List patterns: "0 0,12 * * *" (midnight and noon)
 * - Day of week: "0 9 * * 1-5" (weekdays at 9 AM)
 *
 * @param cronExpr - Standard 5-field cron expression
 * @returns Next execution Date or null if invalid
 */
export function getNextCronTime(cronExpr: string): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronExpr, {
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

/**
 * Get previous cron time using cron-parser library
 *
 * @param cronExpr - Standard 5-field cron expression
 * @returns Previous execution Date or null if invalid
 */
export function getPrevCronTime(cronExpr: string): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronExpr, {
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    return interval.prev().toDate();
  } catch {
    return null;
  }
}

/**
 * Validate a cron expression
 *
 * @param cronExpr - Cron expression to validate
 * @returns true if valid, false otherwise
 */
export function isValidCronExpression(cronExpr: string): boolean {
  try {
    CronExpressionParser.parse(cronExpr);
    return true;
  } catch {
    return false;
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
