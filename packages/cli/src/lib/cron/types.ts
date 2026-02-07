/**
 * Cron Service Types
 *
 * Type definitions for scheduled jobs in Viben CLI.
 */

/**
 * Status of the last job execution
 */
export type JobStatus = 'success' | 'failure';

/**
 * Cron Job definition
 */
export interface CronJob {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Whether the job is enabled */
  enabled: boolean;
  /** Message to send when the job runs */
  message: string;

  // Schedule (one of these must be set)
  /** Cron expression (e.g., "0 9 * * *") */
  cron?: string;
  /** Interval in seconds */
  every?: number;

  // Target configuration
  /** Target channel ID (optional) */
  channel?: string;
  /** Agent ID to use (defaults to "main") */
  agent?: string;

  // Execution record
  /** Last execution timestamp (ms) */
  lastRun?: number;
  /** Status of last execution */
  lastStatus?: JobStatus;
  /** Error message from last execution */
  lastError?: string;
  /** Next scheduled execution timestamp (ms) */
  nextRun?: number;
}

/**
 * Cron job config without id (for storage)
 */
export type CronJobConfig = Omit<CronJob, 'id'>;

/**
 * Cron configuration file structure
 * Stored in ~/.viben/cron.yaml
 */
export interface CronConfig {
  version: number;
  jobs: Record<string, CronJobConfig>;
}

/**
 * Options for adding a new job
 */
export interface AddJobOptions {
  id?: string;
  name: string;
  message: string;
  cron?: string;
  every?: number;
  channel?: string;
  agent?: string;
  enabled?: boolean;
}

/**
 * Cron executor interface
 * Implementations handle the actual job execution
 */
export interface CronExecutor {
  /**
   * Execute a cron job
   * @param job The job to execute
   */
  execute(job: CronJob): Promise<void>;
}

/**
 * Default cron configuration
 */
export const DEFAULT_CRON_CONFIG: CronConfig = {
  version: 1,
  jobs: {},
};

/**
 * Cron file name
 */
export const CRON_CONFIG_FILE = 'cron.yaml';
