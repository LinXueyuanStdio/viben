/**
 * Cron Job Types
 *
 * Re-exports from @viben/core/shared for browser compatibility.
 * Desktop-specific types (CronJobListResponse, CronExecutionLogResponse) are defined here.
 */

// Re-export core cron types from @viben/core/shared
// Note: Using /shared subpath to avoid Node.js-only dependencies
export type {
  JobStatus,
  CronJobType,
  CronNotificationSettings,
  CronJob,
  CreateCronJob,
  UpdateCronJob,
  CronExecutionLog,
} from "@viben/core/shared";

// NotificationSettings is re-exported for convenience (legacy alias)
export type { NotificationSettings } from "./channel";

import type { CronJob, CronExecutionLog } from "@viben/core/shared";

/** API response for listing cron jobs */
export interface CronJobListResponse {
  jobs: CronJob[];
}

/** API response for listing cron execution logs */
export interface CronExecutionLogResponse {
  logs: CronExecutionLog[];
}
