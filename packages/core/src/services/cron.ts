/**
 * Cron job scheduling service
 *
 * Provides scheduled task execution using node-cron.
 * Jobs are persisted to a YAML configuration file.
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
  inApp?: boolean;
  /** Enable system notifications (OS-level) */
  system?: boolean;
  /** Channel instance IDs to notify */
  channelIds?: string[];
}

/**
 * A scheduled cron job
 */
export interface CronJob {
  /** Unique job ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Whether the job is enabled */
  enabled: boolean;
  /** Job type: agent or script */
  jobType: CronJobType;
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
  lastRun?: number;
  /** Last execution status */
  lastStatus?: JobStatus;
  /** Last error message if failed */
  lastError?: string;
  /** Last script output */
  lastOutput?: string;
  /** Next scheduled execution timestamp (milliseconds) */
  nextRun?: number;
  /** Creation timestamp (milliseconds) */
  createdAt: number;
  /** Last update timestamp (milliseconds) */
  updatedAt: number;
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
  jobType?: CronJobType;
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
  jobType?: CronJobType;
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
  private configPath: string;
  private events: EventService;
  private jobs: Map<string, CronJob> = new Map();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private started = false;

  constructor(events: EventService, configPath?: string) {
    this.events = events;
    this.configPath =
      configPath ||
      join(homedir(), ".viben", "cron.yaml");
  }

  /**
   * Load jobs from config file
   */
  private async loadConfig(): Promise<CronConfig> {
    if (!existsSync(this.configPath)) {
      return { version: 1, jobs: {} };
    }

    const content = await readFile(this.configPath, "utf-8");
    return this.parseYaml(content);
  }

  /**
   * Save jobs to config file
   */
  private async saveConfig(): Promise<void> {
    const dir = join(this.configPath, "..");
    await mkdir(dir, { recursive: true });

    const config: CronConfig = {
      version: 1,
      jobs: Object.fromEntries(this.jobs),
    };

    const yaml = this.configToYaml(config);
    await writeFile(this.configPath, yaml);
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
    for (const [id, timer] of this.scheduledJobs) {
      clearTimeout(timer);
      this.scheduledJobs.delete(id);
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
    const existingTimer = this.scheduledJobs.get(job.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.scheduledJobs.delete(job.id);
    }

    if (job.cron) {
      // Calculate next run time from cron expression
      const nextRun = this.getNextCronTime(job.cron);
      if (nextRun) {
        job.nextRun = nextRun.getTime();
        const delay = nextRun.getTime() - Date.now();
        if (delay > 0) {
          const timer = setTimeout(() => {
            this.executeJob(job.id);
            // Reschedule for next cron time
            this.scheduleJob(job);
          }, delay);
          this.scheduledJobs.set(job.id, timer);
        }
      }
    } else if (job.every) {
      // Interval scheduling
      const delay = job.every * 1000;
      job.nextRun = Date.now() + delay;
      const timer = setTimeout(() => {
        this.executeJob(job.id);
        // Reschedule
        this.scheduleJob(job);
      }, delay);
      this.scheduledJobs.set(job.id, timer);
    }

    this.jobs.set(job.id, job);
  }

  /**
   * Get next cron time (simple implementation for common patterns)
   */
  private getNextCronTime(cronExpr: string): Date | null {
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
   * Execute a job
   */
  private async executeJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const now = Date.now();

    // Mark job as running
    job.lastRun = now;
    job.lastStatus = "running";
    this.jobs.set(jobId, job);

    // Broadcast triggered event
    this.events.broadcast({
      type: "cron_job_triggered",
      data: { jobId, triggeredAt: now },
    });

    let status: JobStatus;
    let error: string | undefined;
    let output: string | undefined;

    try {
      if (job.jobType === "script") {
        const result = await this.executeScript(job);
        status = result.status;
        error = result.error;
        output = result.output;
      } else {
        // Agent job - broadcast message for frontend to handle
        const message = job.message || job.name;
        this.events.broadcast({
          type: "cron_job_message",
          data: { jobId, agentId: job.agent, message },
        });
        status = "success";
        output = `Message sent to agent '${job.agent}': ${message}`;
      }
    } catch (e) {
      status = "failure";
      error = e instanceof Error ? e.message : String(e);
    }

    // Update job status
    job.lastStatus = status;
    job.lastError = error;
    job.lastOutput = output;
    this.jobs.set(jobId, job);

    // Save config
    await this.saveConfig();

    // Calculate execution duration
    const completedAt = Date.now();
    const durationMs = completedAt - now;

    // Truncate output for notification
    const truncatedOutput = output && output.length > 200 ? output.slice(0, 200) + "..." : output;

    // Broadcast completed event
    this.events.broadcast({
      type: "cron_job_completed",
      data: {
        jobId,
        jobName: job.name,
        jobType: job.jobType,
        status,
        durationMs,
        output: truncatedOutput,
        completedAt,
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
        const combinedOutput = stderr ? `${stdout}\n[stderr]\n${stderr}` : stdout;

        if (code === 0) {
          resolve({ status: "success", output: combinedOutput });
        } else {
          resolve({
            status: "failure",
            error: `Script exited with code: ${code}`,
            output: combinedOutput,
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
      jobType: create.jobType || "agent",
      message: create.message,
      script: create.script,
      cron: create.cron,
      every: create.every,
      channel: create.channel,
      agent: create.agent || "main",
      notifications: create.notifications,
      createdAt: now,
      updatedAt: now,
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

    const scheduleChanged = update.cron !== undefined || update.every !== undefined;
    const enabledChanged = update.enabled !== undefined;

    // Apply updates
    if (update.name !== undefined) job.name = update.name;
    if (update.jobType !== undefined) job.jobType = update.jobType;
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
    job.updatedAt = Date.now();

    // Store updated job
    this.jobs.set(id, job);

    // Save config
    await this.saveConfig();

    // Reschedule if needed
    if ((scheduleChanged || enabledChanged) && this.started) {
      // Clear existing schedule
      const timer = this.scheduledJobs.get(id);
      if (timer) {
        clearTimeout(timer);
        this.scheduledJobs.delete(id);
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
    const timer = this.scheduledJobs.get(id);
    if (timer) {
      clearTimeout(timer);
      this.scheduledJobs.delete(id);
    }

    // Remove from jobs
    this.jobs.delete(id);

    // Save config
    await this.saveConfig();

    // Broadcast event
    this.events.broadcast({
      type: "cron_job_deleted",
      data: { jobId: id },
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
      jobType: job.jobType,
      message: job.message,
      script: job.script,
      cron: job.cron,
      every: job.every,
      channel: job.channel,
      agent: job.agent,
      lastRun: job.lastRun,
      lastStatus: job.lastStatus,
      nextRun: job.nextRun,
    };
  }

  /**
   * Parse YAML config (simple implementation)
   */
  private parseYaml(yaml: string): CronConfig {
    try {
      // Try to parse as JSON first (our format is JSON-like)
      const jsonLike = yaml
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
      const jobsMatch = yaml.match(/jobs:\s*\n([\s\S]*?)(?=\n\w|$)/);
      if (jobsMatch) {
        // Parse each job - this is a simplified parser
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
