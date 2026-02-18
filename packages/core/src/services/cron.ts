/**
 * Cron job scheduling service
 *
 * Provides scheduled task execution using node-cron.
 * Jobs are persisted to a YAML configuration file.
 *
 * All field names use snake_case for consistency.
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { CronError } from "../error";
import { EventService, type CronJobData } from "./events";

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
  /** Unique job ID */
  id: string;
  /** Human-readable name */
  name: string;
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
  job_type?: CronJobType;
  message?: string;
  script?: string;
  cron?: string;
  every?: number;
  channel?: string;
  agent?: string;
  enabled?: boolean;
  notifications?: CronNotificationSettings;
}

/**
 * YAML config structure
 */
interface CronConfig {
  version: number;
  jobs: Record<string, CronJob>;
}

/**
 * Cron service for managing scheduled jobs
 */
export class CronService {
  private config_path: string;
  private events: EventService;
  private jobs: Map<string, CronJob> = new Map();
  private scheduled_jobs: Map<string, NodeJS.Timeout> = new Map();
  private started = false;

  constructor(events: EventService, config_path?: string) {
    this.events = events;
    this.config_path =
      config_path ||
      join(homedir(), ".viben", "cron.yaml");
  }

  /**
   * Load jobs from config file
   */
  private async loadConfig(): Promise<CronConfig> {
    if (!existsSync(this.config_path)) {
      return { version: 1, jobs: {} };
    }

    const content = await readFile(this.config_path, "utf-8");
    return this.parseYaml(content);
  }

  /**
   * Save jobs to config file
   */
  private async saveConfig(): Promise<void> {
    const dir = join(this.config_path, "..");
    await mkdir(dir, { recursive: true });

    const config: CronConfig = {
      version: 1,
      jobs: Object.fromEntries(this.jobs),
    };

    const yaml = this.configToYaml(config);
    await writeFile(this.config_path, yaml);
  }

  /**
   * Load jobs from config file without scheduling (for CLI operations)
   */
  async load(): Promise<void> {
    const config = await this.loadConfig();
    this.jobs = new Map(Object.entries(config.jobs));
  }

  /**
   * Start the cron service and schedule all enabled jobs
   */
  async start(): Promise<void> {
    // Load jobs from config
    await this.load();

    // Schedule all enabled jobs
    for (const job of this.jobs.values()) {
      if (job.enabled) {
        this.scheduleJob(job);
      }
    }

    this.started = true;
  }

  /**
   * Shutdown the cron service
   */
  async shutdown(): Promise<void> {
    // Clear all scheduled jobs
    for (const [id, timer] of this.scheduled_jobs) {
      clearTimeout(timer);
      this.scheduled_jobs.delete(id);
    }

    // Save current state
    await this.saveConfig();

    this.started = false;
  }

  /**
   * Schedule a job
   */
  private scheduleJob(job: CronJob): void {
    // Clear existing schedule
    const existing_timer = this.scheduled_jobs.get(job.id);
    if (existing_timer) {
      clearTimeout(existing_timer);
      this.scheduled_jobs.delete(job.id);
    }

    if (job.cron) {
      // Calculate next run time from cron expression
      const next_run = this.getNextCronTime(job.cron);
      if (next_run) {
        job.next_run = next_run.getTime();
        const delay = next_run.getTime() - Date.now();
        if (delay > 0) {
          const timer = setTimeout(() => {
            this.executeJob(job.id);
            // Reschedule for next cron time
            this.scheduleJob(job);
          }, delay);
          this.scheduled_jobs.set(job.id, timer);
        }
      }
    } else if (job.every) {
      // Interval scheduling
      const delay = job.every * 1000;
      job.next_run = Date.now() + delay;
      const timer = setTimeout(() => {
        this.executeJob(job.id);
        // Reschedule
        this.scheduleJob(job);
      }, delay);
      this.scheduled_jobs.set(job.id, timer);
    }

    this.jobs.set(job.id, job);
  }

  /**
   * Get next cron time (simple implementation for common patterns)
   */
  private getNextCronTime(cron_expr: string): Date | null {
    try {
      // Simple cron parser for common patterns
      const parts = cron_expr.trim().split(/\s+/);
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
   * Execute a job
   */
  private async executeJob(job_id: string): Promise<void> {
    const job = this.jobs.get(job_id);
    if (!job) return;

    const now = Date.now();

    // Mark job as running
    job.last_run = now;
    job.last_status = "running";
    this.jobs.set(job_id, job);

    // Broadcast triggered event
    this.events.broadcast({
      type: "cron_job_triggered",
      data: { job_id, triggered_at: now },
    });

    let status: JobStatus;
    let error: string | undefined;
    let output: string | undefined;

    try {
      if (job.job_type === "script") {
        const result = await this.executeScript(job);
        status = result.status;
        error = result.error;
        output = result.output;
      } else {
        // Agent job - broadcast message for frontend to handle
        const message = job.message || job.name;
        this.events.broadcast({
          type: "cron_job_message",
          data: { job_id, agent_id: job.agent, message },
        });
        status = "success";
        output = `Message sent to agent '${job.agent}': ${message}`;
      }
    } catch (e) {
      status = "failure";
      error = e instanceof Error ? e.message : String(e);
    }

    // Update job status
    job.last_status = status;
    job.last_error = error;
    job.last_output = output;
    this.jobs.set(job_id, job);

    // Save config
    await this.saveConfig();

    // Calculate execution duration
    const completed_at = Date.now();
    const duration_ms = completed_at - now;

    // Truncate output for notification
    const truncated_output = output && output.length > 200 ? output.slice(0, 200) + "..." : output;

    // Broadcast completed event
    this.events.broadcast({
      type: "cron_job_completed",
      data: {
        job_id,
        job_name: job.name,
        job_type: job.job_type,
        status,
        duration_ms,
        output: truncated_output,
        completed_at,
      },
    });
  }

  /**
   * Execute a script job
   */
  private async executeScript(job: CronJob): Promise<{ status: JobStatus; error?: string; output?: string }> {
    const script = job.script || "";

    if (!script) {
      return {
        status: "success",
        output: `No script defined. Job name: ${job.name}`,
      };
    }

    return new Promise((resolve) => {
      const { spawn } = require("node:child_process");
      const child = spawn("bash", ["-c", script], {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("close", (code: number | null) => {
        const combined_output = stderr ? `${stdout}\n[stderr]\n${stderr}` : stdout;

        if (code === 0) {
          resolve({ status: "success", output: combined_output });
        } else {
          resolve({
            status: "failure",
            error: `Script exited with code: ${code}`,
            output: combined_output,
          });
        }
      });

      child.on("error", (err: Error) => {
        resolve({
          status: "failure",
          error: `Failed to execute script: ${err.message}`,
        });
      });
    });
  }

  /**
   * List all jobs
   */
  async listJobs(): Promise<CronJob[]> {
    return Array.from(this.jobs.values());
  }

  /**
   * Get a job by ID
   */
  async getJob(id: string): Promise<CronJob | undefined> {
    return this.jobs.get(id);
  }

  /**
   * Create a new job
   */
  async createJob(create: CreateCronJob): Promise<CronJob> {
    // Validate schedule
    if (create.cron && create.every) {
      throw new CronError("Invalid schedule: cannot specify both cron and every");
    }
    if (!create.cron && !create.every) {
      throw new CronError("Invalid schedule: must specify either cron expression or interval");
    }

    // Generate ID if not provided
    const id =
      create.id ||
      create.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

    // Check if already exists
    if (this.jobs.has(id)) {
      throw new CronError(`Job already exists: ${id}`);
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
      notifications: create.notifications,
      created_at: now,
      updated_at: now,
    };

    // Store job
    this.jobs.set(id, job);

    // Save config
    await this.saveConfig();

    // Schedule if enabled and service is started
    if (job.enabled && this.started) {
      this.scheduleJob(job);
    }

    // Broadcast event
    this.events.broadcast({
      type: "cron_job_created",
      data: { job: this.toCronJobData(job) },
    });

    return job;
  }

  /**
   * Update an existing job
   */
  async updateJob(id: string, update: UpdateCronJob): Promise<CronJob> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new CronError(`Job not found: ${id}`);
    }

    const schedule_changed = update.cron !== undefined || update.every !== undefined;
    const enabled_changed = update.enabled !== undefined;

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
    if (update.enabled !== undefined) job.enabled = update.enabled;
    if (update.notifications !== undefined) job.notifications = update.notifications;
    job.updated_at = Date.now();

    // Store updated job
    this.jobs.set(id, job);

    // Save config
    await this.saveConfig();

    // Reschedule if needed
    if ((schedule_changed || enabled_changed) && this.started) {
      // Clear existing schedule
      const timer = this.scheduled_jobs.get(id);
      if (timer) {
        clearTimeout(timer);
        this.scheduled_jobs.delete(id);
      }

      // Reschedule if enabled
      if (job.enabled) {
        this.scheduleJob(job);
      }
    }

    // Broadcast event
    this.events.broadcast({
      type: "cron_job_updated",
      data: { job: this.toCronJobData(job) },
    });

    return job;
  }

  /**
   * Delete a job
   */
  async deleteJob(id: string): Promise<void> {
    if (!this.jobs.has(id)) {
      throw new CronError(`Job not found: ${id}`);
    }

    // Clear schedule
    const timer = this.scheduled_jobs.get(id);
    if (timer) {
      clearTimeout(timer);
      this.scheduled_jobs.delete(id);
    }

    // Remove from jobs
    this.jobs.delete(id);

    // Save config
    await this.saveConfig();

    // Broadcast event
    this.events.broadcast({
      type: "cron_job_deleted",
      data: { job_id: id },
    });
  }

  /**
   * Enable a job
   */
  async enableJob(id: string): Promise<CronJob> {
    return this.updateJob(id, { enabled: true });
  }

  /**
   * Disable a job
   */
  async disableJob(id: string): Promise<CronJob> {
    return this.updateJob(id, { enabled: false });
  }

  /**
   * Run a job immediately
   */
  async runJob(id: string): Promise<void> {
    if (!this.jobs.has(id)) {
      throw new CronError(`Job not found: ${id}`);
    }

    await this.executeJob(id);
  }

  /**
   * Convert CronJob to CronJobData for events
   */
  private toCronJobData(job: CronJob): CronJobData {
    return {
      id: job.id,
      name: job.name,
      enabled: job.enabled,
      job_type: job.job_type,
      message: job.message,
      script: job.script,
      cron: job.cron,
      every: job.every,
      channel: job.channel,
      agent: job.agent,
      last_run: job.last_run,
      last_status: job.last_status,
      next_run: job.next_run,
    };
  }

  /**
   * Parse YAML config (simple implementation)
   */
  private parseYaml(yaml: string): CronConfig {
    try {
      // Try to parse as JSON first (our format is JSON-like)
      const json_like = yaml
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return "";
          return trimmed;
        })
        .join(" ");

      // Simple extraction of jobs object
      const config: CronConfig = { version: 1, jobs: {} };

      // Look for jobs entries
      const jobs_match = yaml.match(/jobs:\s*\n([\s\S]*?)(?=\n\w|$)/);
      if (jobs_match) {
        // Parse each job - this is a simplified parser
        const job_lines = jobs_match[1].split("\n");
        let current_job: Partial<CronJob> | null = null;
        let current_id = "";

        for (const line of job_lines) {
          const indent_match = line.match(/^(\s*)/);
          const indent = indent_match ? indent_match[1].length : 0;

          if (indent === 2 && line.includes(":")) {
            // New job entry
            const id_match = line.match(/^\s+"?([^":]+)"?:/);
            if (id_match) {
              if (current_job && current_id) {
                config.jobs[current_id] = current_job as CronJob;
              }
              current_id = id_match[1];
              current_job = { id: current_id };
            }
          } else if (indent === 4 && current_job) {
            // Job property
            const prop_match = line.match(/^\s+(\w+):\s*(.+)?$/);
            if (prop_match) {
              const [, key, value_str] = prop_match;
              if (value_str) {
                try {
                  const value = JSON.parse(value_str);
                  (current_job as Record<string, unknown>)[key] = value;
                } catch {
                  (current_job as Record<string, unknown>)[key] = value_str.replace(/^["']|["']$/g, "");
                }
              }
            }
          }
        }

        if (current_job && current_id) {
          config.jobs[current_id] = current_job as CronJob;
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
  private configToYaml(config: CronConfig): string {
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
}
