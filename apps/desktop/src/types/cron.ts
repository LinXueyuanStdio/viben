/**
 * Cron Job Types
 *
 * TypeScript types for cron job management matching the Rust backend.
 */

// NotificationSettings is re-exported for convenience
export type { NotificationSettings } from "./channel";

/** Job execution status */
export type JobStatus = "success" | "failure" | "running";

/** Notification settings for cron jobs */
export interface CronNotificationSettings {
  /** Enable in-app notifications */
  in_app: boolean;
  /** Enable system notifications (OS-level) */
  system: boolean;
  /** Channel instance IDs to notify */
  channel_ids: string[];
}

/** A scheduled cron job */
export interface CronJob {
  /** Unique job ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Whether the job is enabled */
  enabled: boolean;
  /** Message/command to execute (sent to agent) */
  message: string;
  /** Bash script to run (runs before agent message) */
  script?: string;
  /** Cron expression (e.g., "0 9 * * *") - mutually exclusive with `every` */
  cron?: string;
  /** Interval in seconds - mutually exclusive with `cron` */
  every?: number;
  /** Target channel ID (legacy) */
  channel?: string;
  /** Agent ID to use */
  agent: string;
  /** Notification settings */
  notifications?: CronNotificationSettings;
  /** Last execution timestamp (milliseconds) */
  last_run?: number;
  /** Last execution status */
  last_status?: JobStatus;
  /** Last error message if failed */
  last_error?: string;
  /** Last script output */
  last_output?: string;
  /** Next scheduled execution timestamp (milliseconds) */
  next_run?: number;
  /** Creation timestamp (milliseconds) */
  created_at: number;
  /** Last update timestamp (milliseconds) */
  updated_at: number;
}

/** Request to create a new cron job */
export interface CreateCronJob {
  /** Optional ID (auto-generated if not provided) */
  id?: string;
  /** Human-readable name */
  name: string;
  /** Message/command to execute (sent to agent) */
  message: string;
  /** Bash script to run (runs before agent message) */
  script?: string;
  /** Cron expression */
  cron?: string;
  /** Interval in seconds */
  every?: number;
  /** Target channel ID (legacy) */
  channel?: string;
  /** Agent ID */
  agent?: string;
  /** Whether enabled (default true) */
  enabled?: boolean;
  /** Notification settings */
  notifications?: CronNotificationSettings;
}

/** Request to update a cron job */
export interface UpdateCronJob {
  name?: string;
  message?: string;
  script?: string;
  cron?: string;
  every?: number;
  channel?: string;
  agent?: string;
  enabled?: boolean;
  notifications?: CronNotificationSettings;
}

/** API response for listing cron jobs */
export interface CronJobListResponse {
  jobs: CronJob[];
}
