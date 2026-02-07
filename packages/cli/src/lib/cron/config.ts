/**
 * Cron Configuration File Management
 *
 * Handles reading and writing cron.yaml configuration file.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { CliError } from '../../types';
import { getStateDir, ensureDir } from '../scope';
import {
  type CronConfig,
  type CronJob,
  type CronJobConfig,
  DEFAULT_CRON_CONFIG,
  CRON_CONFIG_FILE,
} from './types';

/**
 * Get the path to the cron configuration file
 */
export function getCronConfigPath(): string {
  const stateDir = getStateDir();
  return path.join(stateDir, CRON_CONFIG_FILE);
}

/**
 * Read cron configuration from file
 * Returns default config if file doesn't exist
 */
export function readCronConfig(): CronConfig {
  const configPath = getCronConfigPath();

  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CRON_CONFIG };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = yaml.parse(content) as CronConfig;

    // Ensure structure is valid
    return {
      version: parsed.version ?? 1,
      jobs: parsed.jobs ?? {},
    };
  } catch (error) {
    throw new CliError(
      `Failed to read cron config: ${configPath}`,
      'CRON_CONFIG_READ_ERROR',
      error
    );
  }
}

/**
 * Write cron configuration to file
 */
export function writeCronConfig(config: CronConfig): void {
  const configPath = getCronConfigPath();
  const stateDir = getStateDir();

  try {
    ensureDir(stateDir);

    const content = yaml.stringify(config, {
      indent: 2,
      lineWidth: 0,
    });

    fs.writeFileSync(configPath, content, 'utf-8');
  } catch (error) {
    throw new CliError(
      `Failed to write cron config: ${configPath}`,
      'CRON_CONFIG_WRITE_ERROR',
      error
    );
  }
}

/**
 * Get a job by ID
 * Returns the full CronJob with id populated
 */
export function getJob(id: string): CronJob | null {
  const config = readCronConfig();
  const jobConfig = config.jobs[id];

  if (!jobConfig) {
    return null;
  }

  return { id, ...jobConfig };
}

/**
 * List all jobs
 * Returns array of CronJob objects with id populated
 */
export function listJobs(): CronJob[] {
  const config = readCronConfig();

  return Object.entries(config.jobs).map(([id, jobConfig]) => ({
    id,
    ...jobConfig,
  }));
}

/**
 * Add or update a job
 */
export function saveJob(job: CronJob): void {
  const config = readCronConfig();
  const { id, ...jobConfig } = job;

  config.jobs[id] = jobConfig;
  writeCronConfig(config);
}

/**
 * Remove a job by ID
 * Returns true if the job was removed, false if it didn't exist
 */
export function removeJob(id: string): boolean {
  const config = readCronConfig();

  if (!config.jobs[id]) {
    return false;
  }

  delete config.jobs[id];
  writeCronConfig(config);
  return true;
}

/**
 * Check if a job exists
 */
export function jobExists(id: string): boolean {
  const config = readCronConfig();
  return id in config.jobs;
}

/**
 * Update job execution status
 */
export function updateJobStatus(
  id: string,
  status: 'success' | 'failure',
  error?: string
): void {
  const config = readCronConfig();
  const job = config.jobs[id];

  if (!job) {
    return;
  }

  job.lastRun = Date.now();
  job.lastStatus = status;

  if (status === 'success') {
    delete job.lastError;
  } else if (error) {
    job.lastError = error;
  }

  writeCronConfig(config);
}

/**
 * Generate a job ID from a name
 * Converts to lowercase and replaces spaces with hyphens
 */
export function generateJobId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 64);
}

/**
 * Validate job ID format
 */
export function validateJobId(id: string): void {
  if (!id || id.trim() === '') {
    throw new CliError('Job ID cannot be empty', 'INVALID_JOB_ID');
  }

  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) {
    throw new CliError(
      'Job ID must start with a letter or number and contain only lowercase letters, numbers, underscores, and hyphens',
      'INVALID_JOB_ID'
    );
  }

  if (id.length > 64) {
    throw new CliError('Job ID must be 64 characters or less', 'INVALID_JOB_ID');
  }
}
