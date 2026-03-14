/**
 * Cron CRUD operations
 *
 * Pure functions for creating, reading, updating, and deleting cron jobs.
 * These functions operate on config files and return structured results.
 * They do not schedule jobs or broadcast events - that's the service's job.
 */

import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import type {
  CronJob,
  CreateCronJob,
  UpdateCronJob,
  CronConfig,
  ListJobsResult,
  GetJobResult,
  CreateJobResult,
  UpdateJobResult,
  DeleteJobResult,
} from "./types";

// =============================================================================
// Config Path Utilities
// =============================================================================

/**
 * Get the default config path for cron jobs
 */
export function getDefaultConfigPath(): string {
  return join(homedir(), ".viben", "cron.yaml");
}

/**
 * Get the log directory for a cron job
 * - Global jobs: ~/.viben/cron/<cron-id>/
 * - Workspace jobs: <workspace_path>/.viben/cron/<cron-id>/
 */
export function getLogDir(job: CronJob): string {
  if (job.workspace_path) {
    return join(job.workspace_path, ".viben", "cron", job.id);
  }
  return join(homedir(), ".viben", "cron", job.id);
}

/**
 * Get the log file path for a cron job
 */
export function getLogPath(job: CronJob): string {
  return join(getLogDir(job), "logs.jsonl");
}

// =============================================================================
// Config File Operations
// =============================================================================

/**
 * Parse YAML config (simple implementation)
 */
function parseYaml(yaml: string): CronConfig {
  try {
    const config: CronConfig = { version: 1, jobs: {} };

    // Look for jobs entries
    const jobsMatch = yaml.match(/jobs:\s*\n([\s\S]*?)(?=\n\w|$)/);
    if (jobsMatch) {
      const jobLines = jobsMatch[1].split("\n");
      let currentJob: Partial<CronJob> | null = null;
      let currentId = "";

      for (const line of jobLines) {
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1].length : 0;

        if (indent === 2 && line.includes(":")) {
          // New job entry
          const idMatch = line.match(/^\s+"?([^":]+)"?:/);
          if (idMatch) {
            if (currentJob && currentId) {
              config.jobs[currentId] = currentJob as CronJob;
            }
            currentId = idMatch[1];
            currentJob = { id: currentId };
          }
        } else if (indent === 4 && currentJob) {
          // Job property
          const propMatch = line.match(/^\s+(\w+):\s*(.+)?$/);
          if (propMatch) {
            const [, key, valueStr] = propMatch;
            if (valueStr) {
              try {
                const value = JSON.parse(valueStr);
                (currentJob as Record<string, unknown>)[key] = value;
              } catch {
                (currentJob as Record<string, unknown>)[key] = valueStr.replace(/^["']|["']$/g, "");
              }
            }
          }
        }
      }

      if (currentJob && currentId) {
        config.jobs[currentId] = currentJob as CronJob;
      }
    }

    return config;
  } catch {
    return { version: 1, jobs: {} };
  }
}

/**
 * Convert config to YAML
 */
function configToYaml(config: CronConfig): string {
  const lines: string[] = [];
  lines.push(`version: ${config.version}`);
  lines.push("jobs:");

  for (const [id, job] of Object.entries(config.jobs)) {
    lines.push(`  "${id}":`);
    for (const [key, value] of Object.entries(job)) {
      if (value !== undefined && value !== null) {
        lines.push(`    ${key}: ${JSON.stringify(value)}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * Load config from file
 */
export async function loadConfig(configPath: string): Promise<CronConfig> {
  if (!existsSync(configPath)) {
    return { version: 1, jobs: {} };
  }

  const content = await readFile(configPath, "utf-8");
  return parseYaml(content);
}

/**
 * Save config to file
 */
export async function saveConfig(configPath: string, config: CronConfig): Promise<void> {
  const dir = join(configPath, "..");
  await mkdir(dir, { recursive: true });

  const yaml = configToYaml(config);
  await writeFile(configPath, yaml);
}

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * List all jobs from config
 */
export async function listJobs(configPath?: string): Promise<ListJobsResult> {
  try {
    const path = configPath || getDefaultConfigPath();
    const config = await loadConfig(path);
    return {
      success: true,
      jobs: Object.values(config.jobs),
    };
  } catch (error) {
    return {
      success: false,
      jobs: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get a job by ID
 */
export async function getJob(configPath: string, id: string): Promise<GetJobResult> {
  try {
    const config = await loadConfig(configPath);
    const job = config.jobs[id];

    if (!job) {
      return {
        success: false,
        error: `Job not found: ${id}`,
      };
    }

    return {
      success: true,
      job,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a new job
 */
export async function createJob(
  configPath: string,
  create: CreateCronJob
): Promise<CreateJobResult> {
  try {
    // Validate schedule
    if (create.cron && create.every) {
      return {
        success: false,
        error: "Invalid schedule: cannot specify both cron and every",
      };
    }
    if (!create.cron && !create.every) {
      return {
        success: false,
        error: "Invalid schedule: must specify either cron expression or interval",
      };
    }

    const config = await loadConfig(configPath);

    // Generate ID if not provided
    const id =
      create.id ||
      create.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

    // Check if already exists
    if (config.jobs[id]) {
      return {
        success: false,
        error: `Job already exists: ${id}`,
      };
    }

    const now = Date.now();
    const job: CronJob = {
      id,
      name: create.name,
      enabled: create.enabled ?? true,
      job_type: create.job_type || "agent",
      message: create.message,
      script: create.script,
      cron: create.cron,
      every: create.every,
      channel: create.channel,
      agent: create.agent || "main",
      workspace_path: create.workspace_path,
      notifications: create.notifications,
      created_at: now,
      updated_at: now,
    };

    // Store job
    config.jobs[id] = job;

    // Save config
    await saveConfig(configPath, config);

    return {
      success: true,
      job,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Update an existing job
 */
export async function updateJob(
  configPath: string,
  id: string,
  update: UpdateCronJob
): Promise<UpdateJobResult> {
  try {
    const config = await loadConfig(configPath);
    const job = config.jobs[id];

    if (!job) {
      return {
        success: false,
        error: `Job not found: ${id}`,
      };
    }

    // Apply updates
    if (update.name !== undefined) job.name = update.name;
    if (update.job_type !== undefined) job.job_type = update.job_type;
    if (update.message !== undefined) job.message = update.message;
    if (update.script !== undefined) job.script = update.script;
    if (update.cron !== undefined) {
      job.cron = update.cron;
      job.every = undefined;
    }
    if (update.every !== undefined) {
      job.every = update.every;
      job.cron = undefined;
    }
    if (update.channel !== undefined) job.channel = update.channel;
    if (update.agent !== undefined) job.agent = update.agent;
    if (update.workspace_path !== undefined) job.workspace_path = update.workspace_path;
    if (update.enabled !== undefined) job.enabled = update.enabled;
    if (update.notifications !== undefined) job.notifications = update.notifications;
    job.updated_at = Date.now();

    // Store updated job
    config.jobs[id] = job;

    // Save config
    await saveConfig(configPath, config);

    return {
      success: true,
      job,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Delete a job
 */
export async function deleteJob(configPath: string, id: string): Promise<DeleteJobResult> {
  try {
    const config = await loadConfig(configPath);

    if (!config.jobs[id]) {
      return {
        success: false,
        error: `Job not found: ${id}`,
      };
    }

    // Remove from jobs
    delete config.jobs[id];

    // Save config
    await saveConfig(configPath, config);

    return {
      success: true,
      deleted: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Enable a job (shorthand for updateJob with enabled: true)
 */
export async function enableJob(configPath: string, id: string): Promise<UpdateJobResult> {
  return updateJob(configPath, id, { enabled: true });
}

/**
 * Disable a job (shorthand for updateJob with enabled: false)
 */
export async function disableJob(configPath: string, id: string): Promise<UpdateJobResult> {
  return updateJob(configPath, id, { enabled: false });
}

/**
 * Update job execution status (used after job runs)
 */
export async function updateJobStatus(
  configPath: string,
  id: string,
  status: {
    last_run: number;
    last_status: "success" | "failure" | "running";
    last_error?: string;
    last_output?: string;
    next_run?: number;
  }
): Promise<UpdateJobResult> {
  try {
    const config = await loadConfig(configPath);
    const job = config.jobs[id];

    if (!job) {
      return {
        success: false,
        error: `Job not found: ${id}`,
      };
    }

    // Update execution status fields
    job.last_run = status.last_run;
    job.last_status = status.last_status;
    job.last_error = status.last_error;
    job.last_output = status.last_output;
    if (status.next_run !== undefined) {
      job.next_run = status.next_run;
    }

    // Store updated job
    config.jobs[id] = job;

    // Save config
    await saveConfig(configPath, config);

    return {
      success: true,
      job,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
