/**
 * Cron job scheduling service
 *
 * Provides scheduled task execution using node-cron.
 * Jobs are persisted to a YAML configuration file.
 *
 * This service maintains scheduling state and broadcasts events.
 * It uses ops functions for data operations.
 */

import { spawn } from "node:child_process";
import { CronError } from "../error";
import { EventService, type CronJobData } from "../services/events";
import { trace, SpanStatusCode, recordCronExecution } from "../telemetry";
import { getSpanName } from "../telemetry/route-names";
import { channelManager, sendChannelMessage } from "../channels";
import { notifyCronCompletion } from "../notifications";

// Import ops functions
import * as ops from "./ops";
import type {
  CronJob,
  CreateCronJob,
  UpdateCronJob,
  CronExecutionLog,
  JobStatus,
} from "./ops";

// Get tracer for cron service
const tracer = trace.getTracer("viben-cron", "1.0.0");

/**
 * Cron service for managing scheduled jobs
 */
export class CronService {
  private configPath: string;
  private events: EventService;
  private jobs: Map<string, CronJob> = new Map();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private started = false;
  /** Track if current execution is manual (for log trigger field) */
  private manualExecutions: Set<string> = new Set();

  constructor(events: EventService, configPath?: string) {
    this.events = events;
    this.configPath = configPath || ops.getDefaultConfigPath();
  }

  /**
   * Load jobs from config file without scheduling (for CLI operations)
   */
  async load(): Promise<void> {
    const result = await ops.listJobs(this.configPath);
    if (result.success) {
      this.jobs = new Map(result.jobs.map((job) => [job.id, job]));
    }
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
      const nextRun = ops.getNextCronTime(job.cron);
      if (nextRun) {
        job.next_run = nextRun.getTime();
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
      job.next_run = Date.now() + delay;
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
   * Execute a job
   */
  private async executeJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const now = Date.now();
    const executionId = ops.generateExecutionId();
    const isManual = this.manualExecutions.has(jobId);

    // Clear manual flag after reading
    this.manualExecutions.delete(jobId);

    // Create telemetry span for job execution
    const span = tracer.startSpan(getSpanName("cron.execute"), {
      attributes: {
        "cron.job_id": jobId,
        "cron.job_name": job.name,
        "cron.job_type": job.job_type,
        "cron.job_agent": job.agent,
        "cron.job_channel": job.channel || "",
        "cron.job_workspace": job.workspace_path || "",
        "cron.triggered_at": now,
        "cron.execution_id": executionId,
        "cron.trigger": isManual ? "manual" : "scheduled",
      },
    });

    // Mark job as running
    job.last_run = now;
    job.last_status = "running";
    this.jobs.set(jobId, job);

    // Broadcast triggered event
    this.events.broadcast({
      type: "cron_job_triggered",
      data: { job_id: jobId, triggered_at: now },
    });

    let status: JobStatus;
    let error: string | undefined;
    let output: string | undefined;

    try {
      if (job.job_type === "script") {
        // Create child span for script execution
        const scriptSpan = tracer.startSpan(getSpanName("cron.script_execute"), {
          attributes: {
            "cron.job_id": jobId,
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
          scriptSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: e instanceof Error ? e.message : String(e),
          });
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
          data: { job_id: jobId, agent_id: job.agent, message },
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
    this.jobs.set(jobId, job);

    // Calculate next run time BEFORE broadcasting completed event
    let nextRun: number | undefined;
    if (job.cron) {
      const nextTime = ops.getNextCronTime(job.cron);
      if (nextTime) {
        nextRun = nextTime.getTime();
      }
    } else if (job.every) {
      nextRun = Date.now() + job.every * 1000;
    }

    // Save config using ops
    await ops.updateJobStatus(this.configPath, jobId, {
      last_run: now,
      last_status: status,
      last_error: error,
      last_output: output,
      next_run: nextRun,
    });

    // Calculate execution duration
    const completedAt = Date.now();
    const durationMs = completedAt - now;

    // Update span with final attributes
    span.setAttributes({
      "cron.status": status,
      "cron.duration_ms": durationMs,
      "cron.next_run": nextRun || 0,
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
      jobId,
      jobName: job.name,
      jobType: job.job_type,
      status: status === "success" ? "success" : "error",
      trigger: isManual ? "manual" : "schedule",
      durationMs,
    });

    // Log execution history using ops
    const executionLog: CronExecutionLog = {
      execution_id: executionId,
      job_id: jobId,
      job_name: job.name,
      job_type: job.job_type,
      agent: job.agent,
      channel: job.channel,
      started_at: now,
      completed_at: completedAt,
      duration_ms: durationMs,
      status,
      error,
      output: ops.truncateOutput(output),
      output_length: output?.length || 0,
      next_run: nextRun,
      trigger: isManual ? "manual" : "scheduled",
      cron: job.cron,
      every: job.every,
    };
    await ops.appendExecutionLog(job, executionLog);

    // Truncate output for notification
    const truncatedOutput =
      output && output.length > 200 ? output.slice(0, 200) + "..." : output;

    // Broadcast completed event with next_run and notifications included
    this.events.broadcast({
      type: "cron_job_completed",
      data: {
        job_id: jobId,
        job_name: job.name,
        job_type: job.job_type,
        status,
        duration_ms: durationMs,
        output: truncatedOutput,
        completed_at: completedAt,
        next_run: nextRun,
        notifications: job.notifications,
      },
    });

    // Send channel notifications if configured
    await this.sendChannelNotifications(job, status, truncatedOutput, error);

    // Send system notification if configured
    if (job.notifications?.system) {
      await notifyCronCompletion(
        job.name,
        status === "success" ? "success" : "failure",
        durationMs
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
          console.warn(
            `[CronService] Channel ${channelId} not found or disabled, skipping notification`
          );
          continue;
        }

        // Get chat_id from channel config (required for sending messages)
        const chatId = (channel.config as Record<string, unknown>)?.chat_id as string;
        if (!chatId) {
          console.warn(
            `[CronService] Channel ${channelId} has no chat_id configured, skipping notification`
          );
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
          console.error(
            `[CronService] Failed to send notification to channel ${channelId}: ${result.error}`
          );
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
  private async executeScript(
    job: CronJob
  ): Promise<{ status: JobStatus; error?: string; output?: string }> {
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
    const result = await ops.createJob(this.configPath, create);

    if (!result.success || !result.job) {
      throw new CronError(result.error || "Failed to create job");
    }

    const job = result.job;

    // Store job in memory
    this.jobs.set(job.id, job);

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
    const result = await ops.updateJob(this.configPath, id, update);

    if (!result.success || !result.job) {
      throw new CronError(result.error || "Failed to update job");
    }

    const job = result.job;
    const scheduleChanged = update.cron !== undefined || update.every !== undefined;
    const enabledChanged = update.enabled !== undefined;

    // Store updated job in memory
    this.jobs.set(id, job);

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
    const result = await ops.deleteJob(this.configPath, id);

    if (!result.success) {
      throw new CronError(result.error || "Failed to delete job");
    }

    // Clear schedule
    const timer = this.scheduledJobs.get(id);
    if (timer) {
      clearTimeout(timer);
      this.scheduledJobs.delete(id);
    }

    // Remove from memory
    this.jobs.delete(id);

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
    this.manualExecutions.add(id);

    await this.executeJob(id);
  }

  /**
   * Get execution logs for a job
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

    const result = await ops.getExecutionLogs(job, limit, offset);
    if (!result.success) {
      throw new CronError(result.error || "Failed to get execution logs");
    }

    return result.logs;
  }

  /**
   * Clear execution logs for a job
   */
  async clearExecutionLogs(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new CronError(`Job not found: ${jobId}`);
    }

    const result = await ops.clearExecutionLogs(job);
    if (!result.success) {
      throw new CronError(result.error || "Failed to clear execution logs");
    }
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
}
