/**
 * Cron Service
 *
 * Core service for managing and executing scheduled jobs.
 * Uses node-cron for scheduling and cron-parser for next run calculation.
 */

import * as cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import cronParser from 'cron-parser';
import type { CronJob, CronExecutor, AddJobOptions } from './types';

// Handle both ESM and CJS imports
const CronExpressionParser = (cronParser as any).default || cronParser;
import {
  readCronConfig,
  writeCronConfig,
  getJob,
  listJobs,
  saveJob,
  removeJob as removeJobFromConfig,
  jobExists,
  generateJobId,
  validateJobId,
} from './config';
import { CliError } from '../../types';

/**
 * CronService manages scheduled job execution
 */
export class CronService {
  /** Map of job ID to scheduled task */
  private tasks: Map<string, ScheduledTask> = new Map();
  /** Job executor */
  private executor: CronExecutor | null = null;
  /** Whether the service is running */
  private running = false;

  constructor(executor?: CronExecutor) {
    this.executor = executor ?? null;
  }

  /**
   * Set the executor for running jobs
   */
  setExecutor(executor: CronExecutor): void {
    this.executor = executor;
  }

  /**
   * Initialize the service and start all enabled jobs
   */
  async initialize(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    const jobs = listJobs();

    for (const job of jobs) {
      if (job.enabled) {
        this.scheduleJob(job);
      }
    }

    console.log(`[Cron] Service initialized with ${jobs.filter(j => j.enabled).length} enabled jobs`);
  }

  /**
   * Shutdown the service and stop all jobs
   */
  async shutdown(): Promise<void> {
    this.running = false;

    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();

    console.log('[Cron] Service shut down');
  }

  /**
   * Add a new job
   */
  async addJob(options: AddJobOptions): Promise<CronJob> {
    const id = options.id ?? generateJobId(options.name);
    validateJobId(id);

    // Check for duplicate
    if (jobExists(id)) {
      throw new CliError(`Job with ID "${id}" already exists`, 'JOB_EXISTS');
    }

    // Validate schedule
    if (!options.cron && !options.every) {
      throw new CliError(
        'Job must have either a cron expression or interval (--cron or --every)',
        'INVALID_SCHEDULE'
      );
    }

    if (options.cron && options.every) {
      throw new CliError(
        'Job cannot have both cron expression and interval (use only one)',
        'INVALID_SCHEDULE'
      );
    }

    // Validate cron expression
    if (options.cron && !cron.validate(options.cron)) {
      throw new CliError(
        `Invalid cron expression: ${options.cron}`,
        'INVALID_CRON'
      );
    }

    // Validate interval
    if (options.every !== undefined) {
      if (options.every <= 0) {
        throw new CliError(
          'Interval must be a positive number of seconds',
          'INVALID_INTERVAL'
        );
      }
      // node-cron doesn't support sub-minute intervals easily
      // We use seconds field for intervals
      if (options.every < 60) {
        console.log(`[Cron] Warning: Intervals less than 60 seconds may have limited precision`);
      }
    }

    const enabled = options.enabled !== false;
    const nextRun = this.computeNextRun(options.cron, options.every);

    const job: CronJob = {
      id,
      name: options.name,
      enabled,
      message: options.message,
      cron: options.cron,
      every: options.every,
      channel: options.channel,
      agent: options.agent ?? 'main',
      nextRun,
    };

    // Save to config
    saveJob(job);

    // Schedule if enabled and service is running
    if (enabled && this.running) {
      this.scheduleJob(job);
    }

    console.log(`[Cron] Added job: ${id} (${options.cron ?? `every ${options.every}s`})`);
    return job;
  }

  /**
   * Remove a job
   */
  async removeJob(id: string): Promise<boolean> {
    // Stop scheduled task if running
    const task = this.tasks.get(id);
    if (task) {
      task.stop();
      this.tasks.delete(id);
    }

    // Remove from config
    const removed = removeJobFromConfig(id);

    if (removed) {
      console.log(`[Cron] Removed job: ${id}`);
    }

    return removed;
  }

  /**
   * Enable a job
   */
  async enableJob(id: string): Promise<CronJob> {
    const job = getJob(id);
    if (!job) {
      throw new CliError(`Job "${id}" not found`, 'JOB_NOT_FOUND');
    }

    job.enabled = true;
    job.nextRun = this.computeNextRun(job.cron, job.every);
    saveJob(job);

    // Schedule if service is running
    if (this.running) {
      this.scheduleJob(job);
    }

    console.log(`[Cron] Enabled job: ${id}`);
    return job;
  }

  /**
   * Disable a job
   */
  async disableJob(id: string): Promise<CronJob> {
    const job = getJob(id);
    if (!job) {
      throw new CliError(`Job "${id}" not found`, 'JOB_NOT_FOUND');
    }

    // Stop scheduled task
    const task = this.tasks.get(id);
    if (task) {
      task.stop();
      this.tasks.delete(id);
    }

    job.enabled = false;
    job.nextRun = undefined;
    saveJob(job);

    console.log(`[Cron] Disabled job: ${id}`);
    return job;
  }

  /**
   * Run a job immediately
   */
  async runJob(id: string): Promise<void> {
    const job = getJob(id);
    if (!job) {
      throw new CliError(`Job "${id}" not found`, 'JOB_NOT_FOUND');
    }

    await this.executeJob(job);
  }

  /**
   * Get job details
   */
  getJob(id: string): CronJob | null {
    const job = getJob(id);
    if (!job) {
      return null;
    }

    // Update next run time if enabled
    if (job.enabled) {
      job.nextRun = this.computeNextRun(job.cron, job.every);
    }

    return job;
  }

  /**
   * List all jobs
   */
  listJobs(): CronJob[] {
    const jobs = listJobs();

    // Update next run times for enabled jobs
    for (const job of jobs) {
      if (job.enabled) {
        job.nextRun = this.computeNextRun(job.cron, job.every);
      }
    }

    return jobs;
  }

  /**
   * Schedule a job for execution
   */
  private scheduleJob(job: CronJob): void {
    // Stop existing task if any
    const existing = this.tasks.get(job.id);
    if (existing) {
      existing.stop();
    }

    let task: ScheduledTask;

    if (job.cron) {
      // Use cron expression directly
      task = cron.schedule(
        job.cron,
        () => {
          this.executeJob(job).catch((err) => {
            console.error(`[Cron] Error executing job ${job.id}:`, err);
          });
        },
        { name: job.id }
      );
    } else if (job.every) {
      // Convert interval to cron expression
      // For intervals >= 60 seconds, use minute-based cron
      if (job.every >= 60) {
        const minutes = Math.floor(job.every / 60);
        const cronExpr = `*/${minutes} * * * *`;
        task = cron.schedule(
          cronExpr,
          () => {
            this.executeJob(job).catch((err) => {
              console.error(`[Cron] Error executing job ${job.id}:`, err);
            });
          },
          { name: job.id }
        );
      } else {
        // For sub-minute intervals, use seconds field
        const cronExpr = `*/${job.every} * * * * *`;
        task = cron.schedule(
          cronExpr,
          () => {
            this.executeJob(job).catch((err) => {
              console.error(`[Cron] Error executing job ${job.id}:`, err);
            });
          },
          { name: job.id }
        );
      }
    } else {
      throw new CliError(`Job ${job.id} has no schedule`, 'INVALID_SCHEDULE');
    }

    this.tasks.set(job.id, task);
    console.log(`[Cron] Scheduled job: ${job.id} (${job.cron ?? `every ${job.every}s`})`);
  }

  /**
   * Execute a job
   */
  private async executeJob(job: CronJob): Promise<void> {
    console.log(`[Cron] Executing job: ${job.id}`);

    const config = readCronConfig();
    const jobConfig = config.jobs[job.id];

    try {
      if (this.executor) {
        await this.executor.execute(job);
      } else {
        // No executor - just log
        console.log(`[Cron] Job ${job.id} message: ${job.message}`);
      }

      // Update execution record
      if (jobConfig) {
        jobConfig.lastRun = Date.now();
        jobConfig.lastStatus = 'success';
        delete jobConfig.lastError;
        writeCronConfig(config);
      }

      console.log(`[Cron] Job ${job.id} completed successfully`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Update execution record
      if (jobConfig) {
        jobConfig.lastRun = Date.now();
        jobConfig.lastStatus = 'failure';
        jobConfig.lastError = errorMsg;
        writeCronConfig(config);
      }

      console.error(`[Cron] Job ${job.id} failed:`, errorMsg);
      throw error;
    }
  }

  /**
   * Compute the next run time for a job
   */
  private computeNextRun(cronExpr?: string, every?: number): number | undefined {
    const now = Date.now();

    if (cronExpr) {
      try {
        const interval = CronExpressionParser.parse(cronExpr);
        const nextDate = interval.next();
        return nextDate.toDate().getTime();
      } catch {
        return undefined;
      }
    }

    if (every) {
      // Next run is now + interval
      return now + every * 1000;
    }

    return undefined;
  }
}

/**
 * Global service instance
 */
let serviceInstance: CronService | null = null;

/**
 * Get the global cron service instance
 */
export function getCronService(executor?: CronExecutor): CronService {
  if (!serviceInstance) {
    serviceInstance = new CronService(executor);
  } else if (executor) {
    serviceInstance.setExecutor(executor);
  }
  return serviceInstance;
}
