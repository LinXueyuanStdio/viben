/**
 * Cron module type definitions
 *
 * This is the single source of truth for all cron-related types.
 * All other modules should import types from here.
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Job execution status
 */
export type JobStatus = "success" | "failure" | "running";

/**
 * Cron job type
 */
export type CronJobType = "agent" | "script";

/**
 * Notification settings for cron jobs
 */
export interface CronNotificationSettings {
  /** Enable in-app notifications */
  in_app?: boolean;
  /** Enable system notifications (OS-level) */
  system?: boolean;
  /** Channel instance IDs to notify */
  channel_ids?: string[];
}

/**
 * A scheduled cron job
 * All fields use snake_case naming convention
 */
export interface CronJob {
  /** Unique job ID (UUID) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Job description */
  description?: string;
  /** Whether the job is enabled */
  enabled: boolean;
  /** Job type: agent or script */
  job_type: CronJobType;
  /** Message to send to agent (optional - uses name if empty) */
  message?: string;
  /** Bash script to execute (for script type) */
  script?: string;
  /** Cron expression (e.g., "0 9 * * *" for 9 AM daily) */
  cron?: string;
  /** Interval in seconds (alternative to cron) */
  every?: number;
  /** Target channel ID */
  channel?: string;
  /** Agent ID to use */
  agent: string;
  /** Workspace path for workspace-level cron jobs (optional) */
  workspace_path?: string;
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

/**
 * Request to create a new cron job
 */
export interface CreateCronJob {
  /** Optional ID (auto-generated if not provided) */
  id?: string;
  /** Human-readable name */
  name: string;
  /** Job description */
  description?: string;
  /** Job type: agent or script */
  job_type?: CronJobType;
  /** Message to send to agent (optional - defaults to name if empty) */
  message?: string;
  /** Bash script to execute (for script type) */
  script?: string;
  /** Cron expression */
  cron?: string;
  /** Interval in seconds */
  every?: number;
  /** Target channel ID */
  channel?: string;
  /** Agent ID */
  agent?: string;
  /** Workspace path for workspace-level cron jobs */
  workspace_path?: string;
  /** Whether enabled (default true) */
  enabled?: boolean;
  /** Notification settings */
  notifications?: CronNotificationSettings;
}

/**
 * Request to update a cron job
 */
export interface UpdateCronJob {
  name?: string;
  description?: string;
  job_type?: CronJobType;
  message?: string;
  script?: string;
  cron?: string;
  every?: number;
  channel?: string;
  agent?: string;
  workspace_path?: string;
  enabled?: boolean;
  notifications?: CronNotificationSettings;
}

/**
 * Cron job execution log entry
 * Stored in JSONL format for easy querying and analysis
 */
export interface CronExecutionLog {
  /** Unique execution ID */
  execution_id: string;
  /** Job ID */
  job_id: string;
  /** Job name at execution time */
  job_name: string;
  /** Job type at execution time */
  job_type: CronJobType;
  /** Agent ID used */
  agent: string;
  /** Channel ID if specified */
  channel?: string;
  /** Execution start timestamp (milliseconds) */
  started_at: number;
  /** Execution end timestamp (milliseconds) */
  completed_at: number;
  /** Execution duration (milliseconds) */
  duration_ms: number;
  /** Execution status */
  status: JobStatus;
  /** Error message if failed */
  error?: string;
  /** Output (truncated if too long) */
  output?: string;
  /** Full output length */
  output_length: number;
  /** Next scheduled run timestamp */
  next_run?: number;
  /** Trigger type: scheduled or manual */
  trigger: "scheduled" | "manual";
  /** Cron expression if using cron schedule */
  cron?: string;
  /** Interval in seconds if using interval schedule */
  every?: number;
}

// =============================================================================
// Config Types
// =============================================================================

/**
 * YAML config structure
 * jobs is an array of CronJob objects
 */
export interface CronConfig {
  version: number;
  jobs: CronJob[];
}

// =============================================================================
// Result Types (for ops functions)
// =============================================================================

/**
 * Result from listJobs operation
 */
export interface ListJobsResult {
  success: boolean;
  jobs: CronJob[];
  error?: string;
}

/**
 * Result from getJob operation
 */
export interface GetJobResult {
  success: boolean;
  job?: CronJob;
  error?: string;
}

/**
 * Result from createJob operation
 */
export interface CreateJobResult {
  success: boolean;
  job?: CronJob;
  error?: string;
}

/**
 * Result from updateJob operation
 */
export interface UpdateJobResult {
  success: boolean;
  job?: CronJob;
  error?: string;
}

/**
 * Result from deleteJob operation
 */
export interface DeleteJobResult {
  success: boolean;
  deleted?: boolean;
  error?: string;
}

/**
 * Result from getExecutionLogs operation
 */
export interface GetLogsResult {
  success: boolean;
  logs: CronExecutionLog[];
  error?: string;
}

/**
 * Result from clearExecutionLogs operation
 */
export interface ClearLogsResult {
  success: boolean;
  error?: string;
}
