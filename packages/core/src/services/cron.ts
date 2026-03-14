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
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { CronError } from "../error";
import { EventService, type CronJobData } from "./events";
import { trace, SpanStatusCode, recordCronExecution } from "../telemetry";
import { getSpanName } from "../telemetry/route-names";
import { channelManager, sendChannelMessage } from "../channels";
import { notifyCronCompletion } from "../notifications";

// Get tracer for cron service
const tracer = trace.getTracer("viben-cron", "1.0.0");

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
 * YAML config structure
 */
interface CronConfig {
  version: number;
  jobs: Record<string, CronJob>;
}

/** Maximum output length to store in logs */
const MAX_LOG_OUTPUT_LENGTH = 10000;

/** Maximum number of log entries to keep per job */
const MAX_LOG_ENTRIES_PER_JOB = 1000;

/**
 * Cron service for managing scheduled jobs
 */
export class CronService {
  private config_path: string;
  private events: EventService;
  private jobs: Map<string, CronJob> = new Map();
  private scheduled_jobs: Map<string, NodeJS.Timeout> = new Map();
  private started = false;
  /** Track if current execution is manual (for log trigger field) */
  private manual_executions: Set<string> = new Set();

  constructor(events: EventService, config_path?: string) {
    this.events = events;
    this.config_path =
      config_path ||
      join(homedir(), ".viben", "cron.yaml");
  }

  /**
   * Get the log directory for a cron job
   * - Global jobs: ~/.viben/cron/<cron-id>/
   * - Workspace jobs: <workspace_path>/.viben/cron/<cron-id>/
   */
  private getLogDir(job: CronJob): string {
    if (job.workspace_path) {
      return join(job.workspace_path, ".viben", "cron", job.id);
    }
    return join(homedir(), ".viben", "cron", job.id);
  }

  /**
   * Get the log file path for a cron job
   */
  private getLogPath(job: CronJob): string {
    return join(this.getLogDir(job), "logs.jsonl");
  }

  /**
   * Generate a unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Append an execution log entry
   */
  private async appendExecutionLog(job: CronJob, log: CronExecutionLog): Promise<void> {
    const logDir = this.getLogDir(job);
    const logPath = this.getLogPath(job);

    try {
      // Ensure log directory exists
      await mkdir(logDir, { recursive: true });

      // Append log entry as JSONL
      const logLine = JSON.stringify(log) + "\n";
      await appendFile(logPath, logLine, "utf-8");

      // Rotate logs if needed (async, don't block)
      this.rotateLogsIfNeeded(job).catch(() => {
        // Ignore rotation errors
      });
    } catch (e) {
      // Log error but don't fail the execution
      console.error(`[cron] Failed to write execution log for job ${job.id}:`, e);
    }
  }

  /**
   * Rotate logs if they exceed the maximum entries
   */
  private async rotateLogsIfNeeded(job: CronJob): Promise<void> {
    const logPath = this.getLogPath(job);

    try {
      if (!existsSync(logPath)) return;

      const content = await readFile(logPath, "utf-8");
      const lines = content.trim().split("\n").filter(line => line.length > 0);

      if (lines.length > MAX_LOG_ENTRIES_PER_JOB) {
        // Keep only the most recent entries
        const trimmedLines = lines.slice(-MAX_LOG_ENTRIES_PER_JOB);
        await writeFile(logPath, trimmedLines.join("\n") + "\n", "utf-8");
      }
    } catch (e) {
      // Ignore rotation errors
    }
  }

  /**
   * Get execution logs for a job
   * @param jobId - Job ID
   * @param limit - Maximum number of entries to return (default 100)
   * @param offset - Number of entries to skip from the end (default 0)
   * @returns Array of execution logs (newest first)
   */
  async getExecutionLogs(
    jobId: string,
    limit = 100,
    offset = 0
  ): Promise<CronExecutionLog[]> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new CronError(`Job not found: ${jobId}`);
    }

    const logPath = this.getLogPath(job);

    try {
      if (!existsSync(logPath)) {
        return [];
      }

      const content = await readFile(logPath, "utf-8");
      const lines = content.trim().split("\n").filter(line => line.length > 0);

      // Parse and return logs (newest first)
      const logs: CronExecutionLog[] = [];
      const startIndex = Math.max(0, lines.length - offset - limit);
      const endIndex = Math.max(0, lines.length - offset);

      for (let i = endIndex - 1; i >= startIndex; i--) {
        try {
          const log = JSON.parse(lines[i]) as CronExecutionLog;
          logs.push(log);
        } catch {
          // Skip invalid lines
        }
      }

      return logs;
    } catch (e) {
      console.error(`[cron] Failed to read execution logs for job ${jobId}:`, e);
      return [];
    }
  }

  /**
   * Clear execution logs for a job
   * @param jobId - Job ID
   */
  async clearExecutionLogs(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new CronError(`Job not found: ${jobId}`);
    }

    const logPath = this.getLogPath(job);

    try {
      if (existsSync(logPath)) {
        await writeFile(logPath, "", "utf-8");
      }
    } catch (e) {
      console.error(`[cron] Failed to clear execution logs for job ${jobId}:`, e);
      throw new CronError(`Failed to clear execution logs: ${e instanceof Error ? e.message : String(e)}`);
    }
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
    const execution_id = this.generateExecutionId();
    const is_manual = this.manual_executions.has(job_id);

    // Clear manual flag after reading
    this.manual_executions.delete(job_id);

    // Create telemetry span for job execution
    const span = tracer.startSpan(getSpanName("cron.execute"), {
      attributes: {
        "cron.job_id": job_id,
        "cron.job_name": job.name,
        "cron.job_type": job.job_type,
        "cron.job_agent": job.agent,
        "cron.job_channel": job.channel || "",
        "cron.job_workspace": job.workspace_path || "",
        "cron.triggered_at": now,
        "cron.execution_id": execution_id,
        "cron.trigger": is_manual ? "manual" : "scheduled",
      },
    });

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
        // Create child span for script execution
        const scriptSpan = tracer.startSpan(getSpanName("cron.script_execute"), {
          attributes: {
            "cron.job_id": job_id,
            "cron.script_length": job.script?.length || 0,
          },
        });
        try {
          const result = await this.executeScript(job);
          status = result.status;
          error = result.error;
          output = result.output;
          scriptSpan.setAttributes({
            "cron.script_status": status,
            "cron.script_output_length": output?.length || 0,
          });
          if (status === "success") {
            scriptSpan.setStatus({ code: SpanStatusCode.OK });
          } else {
            scriptSpan.setStatus({ code: SpanStatusCode.ERROR, message: error || "Script failed" });
          }
        } catch (e) {
          scriptSpan.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : String(e) });
          scriptSpan.recordException(e instanceof Error ? e : new Error(String(e)));
          throw e;
        } finally {
          scriptSpan.end();
        }
      } else {
        // Agent job - broadcast message for frontend to handle
        const message = job.message || job.name;
        this.events.broadcast({
          type: "cron_job_message",
          data: { job_id, agent_id: job.agent, message },
        });
        status = "success";
        output = `Message sent to agent '${job.agent}': ${message}`;
        span.setAttribute("cron.agent_message_sent", true);
      }
    } catch (e) {
      status = "failure";
      error = e instanceof Error ? e.message : String(e);
      span.recordException(e instanceof Error ? e : new Error(String(e)));
    }

    // Update job status
    job.last_status = status;
    job.last_error = error;
    job.last_output = output;
    this.jobs.set(job_id, job);

    // Calculate next run time BEFORE broadcasting completed event
    // This ensures the client receives the updated next_run value
    let next_run: number | undefined;
    if (job.cron) {
      const nextTime = this.getNextCronTime(job.cron);
      if (nextTime) {
        next_run = nextTime.getTime();
      }
    } else if (job.every) {
      next_run = Date.now() + job.every * 1000;
    }

    // Save config
    await this.saveConfig();

    // Calculate execution duration
    const completed_at = Date.now();
    const duration_ms = completed_at - now;

    // Update span with final attributes
    span.setAttributes({
      "cron.status": status,
      "cron.duration_ms": duration_ms,
      "cron.next_run": next_run || 0,
      "cron.output_length": output?.length || 0,
    });
    if (status === "success") {
      span.setStatus({ code: SpanStatusCode.OK });
    } else {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error || "Job failed" });
    }
    span.end();

    // Record cron execution metrics
    recordCronExecution({
      jobId: job_id,
      jobName: job.name,
      jobType: job.job_type,
      status: status === "success" ? "success" : "error",
      trigger: is_manual ? "manual" : "schedule",
      durationMs: duration_ms,
    });

    // Log execution history
    const executionLog: CronExecutionLog = {
      execution_id,
      job_id,
      job_name: job.name,
      job_type: job.job_type,
      agent: job.agent,
      channel: job.channel,
      started_at: now,
      completed_at,
      duration_ms,
      status,
      error,
      output: output && output.length > MAX_LOG_OUTPUT_LENGTH
        ? output.slice(0, MAX_LOG_OUTPUT_LENGTH) + "...[truncated]"
        : output,
      output_length: output?.length || 0,
      next_run,
      trigger: is_manual ? "manual" : "scheduled",
      cron: job.cron,
      every: job.every,
    };
    await this.appendExecutionLog(job, executionLog);

    // Truncate output for notification
    const truncated_output = output && output.length > 200 ? output.slice(0, 200) + "..." : output;

    // Broadcast completed event with next_run and notifications included
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
        next_run,
        notifications: job.notifications,
      },
    });

    // Send channel notifications if configured
    await this.sendChannelNotifications(job, status, truncated_output, error);

    // Send system notification if configured
    if (job.notifications?.system) {
      await notifyCronCompletion(
        job.name,
        status === "success" ? "success" : "failure",
        duration_ms
      );
    }
  }

  /**
   * Send notifications to configured channels
   */
  private async sendChannelNotifications(
    job: CronJob,
    status: JobStatus,
    output?: string,
    error?: string
  ): Promise<void> {
    const notifications = job.notifications;
    if (!notifications?.channel_ids?.length) {
      return;
    }

    // Build notification message
    const statusEmoji = status === "success" ? "✅" : status === "failure" ? "❌" : "⏳";
    const statusText = status === "success" ? "成功" : status === "failure" ? "失败" : "运行中";

    let message = `${statusEmoji} **定时任务${statusText}**\n\n`;
    message += `📋 任务: ${job.name}\n`;
    message += `⏰ 时间: ${new Date().toLocaleString()}\n`;

    if (error) {
      message += `\n❗ 错误: ${error}\n`;
    }

    if (output) {
      message += `\n📝 输出:\n\`\`\`\n${output}\n\`\`\``;
    }

    // Send to each configured channel
    for (const channelId of notifications.channel_ids) {
      try {
        // Load channel manager config
        await channelManager.load();
        const channel = await channelManager.getChannel(channelId);

        if (!channel || !channel.enabled) {
          console.warn(`[CronService] Channel ${channelId} not found or disabled, skipping notification`);
          continue;
        }

        // Get chat_id from channel config (required for sending messages)
        const chatId = (channel.config as Record<string, unknown>)?.chat_id as string;
        if (!chatId) {
          console.warn(`[CronService] Channel ${channelId} has no chat_id configured, skipping notification`);
          continue;
        }

        // Build channel config
        const config = channelManager.buildChannelConfig(channelId, {
          type: channel.type,
          name: channel.name,
          enabled: channel.enabled,
          created_at: channel.created_at,
          allow_from: channel.allow_from,
          ...channel.config,
        });

        // Send message
        const result = await sendChannelMessage(config, {
          chatId,
          message,
          parseMode: "markdown",
        });

        if (!result.success) {
          console.error(`[CronService] Failed to send notification to channel ${channelId}: ${result.error}`);
        } else {
          console.log(`[CronService] Sent notification to channel ${channelId}`);
        }
      } catch (err) {
        console.error(`[CronService] Error sending notification to channel ${channelId}:`, err);
      }
    }
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
   * Get job statistics for metrics/telemetry
   * Synchronous method for use in Observable Gauge callbacks
   */
  getJobStats(): { enabled: number; disabled: number; agent: number; script: number } {
    const jobs = Array.from(this.jobs.values());
    return {
      enabled: jobs.filter((j) => j.enabled).length,
      disabled: jobs.filter((j) => !j.enabled).length,
      agent: jobs.filter((j) => j.job_type === "agent").length,
      script: jobs.filter((j) => j.job_type === "script").length,
    };
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
      workspace_path: create.workspace_path,
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
    if (update.workspace_path !== undefined) job.workspace_path = update.workspace_path;
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

    // Mark this execution as manual
    this.manual_executions.add(id);

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
