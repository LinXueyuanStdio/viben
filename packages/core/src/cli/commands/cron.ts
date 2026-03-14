/**
 * viben cron - Cron job management commands
 *
 * Provides commands for managing scheduled cron jobs.
 * Jobs can be agent-based (send message to agent) or script-based (execute bash).
 *
 * CLI uses ops functions directly for data operations.
 * Jobs are not scheduled until Gateway is running.
 */
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  outputTable,
  outputKeyValue,
  handleCommandError,
} from "../lib";

// Import ops functions from cron module
import * as cronOps from "../../cron/ops";
import type { CronJob, CreateCronJob } from "../../cron/ops";

/**
 * Format job status for display
 */
function formatStatus(status?: string): string {
  switch (status) {
    case "success":
      return chalk.green("success");
    case "failure":
      return chalk.red("failure");
    case "running":
      return chalk.yellow("running");
    default:
      return chalk.gray("-");
  }
}

/**
 * Format enabled status for display
 */
function formatEnabled(enabled: boolean): string {
  return enabled ? chalk.green("enabled") : chalk.gray("disabled");
}

/**
 * Format timestamp for display
 */
function formatTimestamp(ts?: number): string {
  if (!ts) return chalk.gray("-");
  return new Date(ts).toLocaleString();
}

/**
 * Get output context from program options
 */
function getContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json || false,
    verbose: opts.verbose || false,
    quiet: opts.quiet || false,
  };
}

/**
 * List all cron jobs
 */
async function listJobs(ctx: OutputContext): Promise<void> {
  const result = await cronOps.listJobs();

  if (!result.success) {
    output(
      ctx,
      { success: false, error: { code: "LOAD_ERROR", message: result.error || "Unknown error" } },
      () => {
        console.error(chalk.red(`Failed to load jobs: ${result.error || "Unknown error"}`));
      }
    );
    return;
  }

  const jobs = result.jobs;

  output(
    ctx,
    successResponse({
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        enabled: j.enabled,
        job_type: j.job_type,
        schedule: j.cron || (j.every ? `every ${j.every}s` : null),
        agent: j.agent,
        last_status: j.last_status,
        next_run: j.next_run,
      })),
      count: jobs.length,
    }),
    () => {
      console.log(chalk.bold("Cron Jobs:"));
      console.log();

      if (jobs.length === 0) {
        console.log(chalk.gray("  No cron jobs configured."));
        console.log();
        console.log("Add a job with:");
        console.log(chalk.cyan("  viben cron add --name <name> --cron '0 9 * * *' --agent-id <agent>"));
        return;
      }

      const headers = ["ID", "Name", "Status", "Type", "Schedule", "Last Run", "Next Run"];
      const rows = jobs.map((j) => [
        j.id,
        j.name,
        formatEnabled(j.enabled),
        j.job_type,
        cronOps.formatSchedule(j),
        formatStatus(j.last_status),
        formatTimestamp(j.next_run),
      ]);

      outputTable(ctx, headers, rows);
    }
  );
}

/**
 * Show job details
 */
async function showJob(ctx: OutputContext, id: string): Promise<void> {
  const configPath = cronOps.getDefaultConfigPath();
  const result = await cronOps.getJob(configPath, id);

  if (!result.success || !result.job) {
    output(
      ctx,
      { success: false, error: { code: "NOT_FOUND", message: result.error || `Job not found: ${id}` } },
      () => {
        console.error(chalk.red(result.error || `Job not found: ${id}`));
      }
    );
    return;
  }

  const job = result.job;

  output(ctx, successResponse(job), () => {
    console.log(chalk.bold(`Job: ${job.name}`));
    console.log();

    const details: Record<string, string | number | boolean | undefined> = {
      ID: job.id,
      Name: job.name,
      Enabled: job.enabled ? "Yes" : "No",
      Type: job.job_type,
      Agent: job.agent,
    };

    if (job.cron) {
      details["Cron"] = job.cron;
    }
    if (job.every) {
      details["Interval"] = `${job.every} seconds`;
    }
    if (job.message) {
      details["Message"] = job.message;
    }
    if (job.script) {
      details["Script"] = job.script.length > 50 ? job.script.slice(0, 50) + "..." : job.script;
    }
    if (job.channel) {
      details["Channel"] = job.channel;
    }

    details["Created"] = formatTimestamp(job.created_at);
    details["Updated"] = formatTimestamp(job.updated_at);
    details["Last Run"] = formatTimestamp(job.last_run);
    details["Last Status"] = job.last_status || "-";
    details["Next Run"] = formatTimestamp(job.next_run);

    if (job.last_error) {
      details["Last Error"] = job.last_error;
    }
    if (job.last_output) {
      details["Last Output"] = job.last_output.length > 100
        ? job.last_output.slice(0, 100) + "..."
        : job.last_output;
    }

    outputKeyValue(ctx, details);
  });
}

/**
 * Add a new cron job
 */
async function addJob(
  ctx: OutputContext,
  name: string,
  options: {
    cron?: string;
    every?: string;
    agentId?: string;
    message?: string;
    script?: string;
    channel?: string;
  }
): Promise<void> {
  // Validate options
  if (!options.cron && !options.every) {
    output(
      ctx,
      { success: false, error: { code: "VALIDATION_ERROR", message: "Must specify either --cron or --every" } },
      () => {
        console.error(chalk.red("Error: Must specify either --cron or --every"));
        console.log();
        console.log("Examples:");
        console.log(chalk.cyan("  viben cron add --name 'Daily report' --cron '0 9 * * *' --agent-id main"));
        console.log(chalk.cyan("  viben cron add --name 'Hourly check' --every 3600 --agent-id monitor"));
      }
    );
    return;
  }

  const createJob: CreateCronJob = {
    name,
    agent: options.agentId || "main",
    job_type: options.script ? "script" : "agent",
    cron: options.cron,
    every: options.every ? parseInt(options.every, 10) : undefined,
    message: options.message,
    script: options.script,
    channel: options.channel,
    enabled: true,
  };

  const configPath = cronOps.getDefaultConfigPath();
  const result = await cronOps.createJob(configPath, createJob);

  if (!result.success || !result.job) {
    output(
      ctx,
      { success: false, error: { code: "CREATE_ERROR", message: result.error || "Unknown error" } },
      () => {
        console.error(chalk.red(`Failed to create job: ${result.error || "Unknown error"}`));
      }
    );
    return;
  }

  const job = result.job;

  output(ctx, successResponse(job), () => {
    console.log(chalk.green(`Created cron job: ${job.name}`));
    console.log(`  ID: ${job.id}`);
    console.log(`  Type: ${job.job_type}`);
    console.log(`  Schedule: ${cronOps.formatSchedule(job)}`);
    console.log(`  Agent: ${job.agent}`);
    console.log();
    console.log(chalk.yellow("Note: Jobs are scheduled when Gateway is running."));
  });
}

/**
 * Remove a cron job
 */
async function removeJob(ctx: OutputContext, id: string): Promise<void> {
  const configPath = cronOps.getDefaultConfigPath();

  // Check if exists
  const getResult = await cronOps.getJob(configPath, id);
  if (!getResult.success || !getResult.job) {
    output(
      ctx,
      { success: false, error: { code: "NOT_FOUND", message: `Job not found: ${id}` } },
      () => {
        console.error(chalk.red(`Job not found: ${id}`));
      }
    );
    return;
  }

  const job = getResult.job;
  const result = await cronOps.deleteJob(configPath, id);

  if (!result.success) {
    output(
      ctx,
      { success: false, error: { code: "DELETE_ERROR", message: result.error || "Unknown error" } },
      () => {
        console.error(chalk.red(`Failed to delete job: ${result.error || "Unknown error"}`));
      }
    );
    return;
  }

  output(
    ctx,
    successResponse({ id, deleted: true }),
    () => {
      console.log(chalk.green(`Removed cron job: ${job.name}`));
      console.log(`  ID: ${id}`);
    }
  );
}

/**
 * Enable a cron job
 */
async function enableJob(ctx: OutputContext, id: string): Promise<void> {
  const configPath = cronOps.getDefaultConfigPath();
  const result = await cronOps.enableJob(configPath, id);

  if (!result.success || !result.job) {
    output(
      ctx,
      { success: false, error: { code: "UPDATE_ERROR", message: result.error || `Failed to enable job: ${id}` } },
      () => {
        console.error(chalk.red(result.error || `Failed to enable job: ${id}`));
      }
    );
    return;
  }

  const job = result.job;

  output(ctx, successResponse(job), () => {
    console.log(chalk.green(`Enabled cron job: ${job.name}`));
    console.log(`  ID: ${id}`);
    console.log();
    console.log(chalk.yellow("Note: Scheduling takes effect when Gateway is running."));
  });
}

/**
 * Disable a cron job
 */
async function disableJob(ctx: OutputContext, id: string): Promise<void> {
  const configPath = cronOps.getDefaultConfigPath();
  const result = await cronOps.disableJob(configPath, id);

  if (!result.success || !result.job) {
    output(
      ctx,
      { success: false, error: { code: "UPDATE_ERROR", message: result.error || `Failed to disable job: ${id}` } },
      () => {
        console.error(chalk.red(result.error || `Failed to disable job: ${id}`));
      }
    );
    return;
  }

  const job = result.job;

  output(ctx, successResponse(job), () => {
    console.log(chalk.yellow(`Disabled cron job: ${job.name}`));
    console.log(`  ID: ${id}`);
  });
}

/**
 * Run a cron job immediately
 * Note: This requires the Gateway to be running
 */
async function runJob(ctx: OutputContext, id: string): Promise<void> {
  const configPath = cronOps.getDefaultConfigPath();

  // Check if exists
  const result = await cronOps.getJob(configPath, id);
  if (!result.success || !result.job) {
    output(
      ctx,
      { success: false, error: { code: "NOT_FOUND", message: `Job not found: ${id}` } },
      () => {
        console.error(chalk.red(`Job not found: ${id}`));
      }
    );
    return;
  }

  const job = result.job;

  // Try to trigger via Gateway API
  try {
    const response = await fetch(`http://127.0.0.1:18790/api/cron/${id}/run`, {
      method: "POST",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" })) as { error?: string };
      const errorMsg = errorData.error || "Unknown error";
      output(
        ctx,
        { success: false, error: { code: "API_ERROR", message: errorMsg } },
        () => {
          console.error(chalk.red(`Failed to run job: ${errorMsg}`));
          console.log();
          console.log(chalk.yellow("Ensure the Gateway is running:"));
          console.log(chalk.cyan("  viben service start gateway"));
        }
      );
      return;
    }

    output(
      ctx,
      successResponse({ id, name: job.name, triggered: true }),
      () => {
        console.log(chalk.green(`Triggered job: ${job.name}`));
        console.log(`  ID: ${id}`);
        console.log();
        console.log("Check execution logs with:");
        console.log(chalk.cyan(`  viben cron logs ${id}`));
      }
    );
  } catch (error) {
    output(
      ctx,
      { success: false, error: { code: "CONNECTION_ERROR", message: "Failed to connect to Gateway" } },
      () => {
        console.error(chalk.red("Failed to connect to Gateway"));
        console.log();
        console.log(chalk.yellow("Ensure the Gateway is running:"));
        console.log(chalk.cyan("  viben service start gateway"));
      }
    );
  }
}

/**
 * Show execution logs for a cron job
 */
async function showLogs(
  ctx: OutputContext,
  id: string,
  options: { limit?: string; offset?: string }
): Promise<void> {
  const configPath = cronOps.getDefaultConfigPath();

  // Get job first
  const jobResult = await cronOps.getJob(configPath, id);
  if (!jobResult.success || !jobResult.job) {
    output(
      ctx,
      { success: false, error: { code: "NOT_FOUND", message: `Job not found: ${id}` } },
      () => {
        console.error(chalk.red(`Job not found: ${id}`));
      }
    );
    return;
  }

  const job = jobResult.job;
  const limit = options.limit ? parseInt(options.limit, 10) : 20;
  const offset = options.offset ? parseInt(options.offset, 10) : 0;

  const logsResult = await cronOps.getExecutionLogs(job, limit, offset);

  if (!logsResult.success) {
    output(
      ctx,
      { success: false, error: { code: "LOAD_ERROR", message: logsResult.error || "Unknown error" } },
      () => {
        console.error(chalk.red(`Failed to load logs: ${logsResult.error || "Unknown error"}`));
      }
    );
    return;
  }

  const logs = logsResult.logs;

  output(
    ctx,
    successResponse({ job_id: id, logs, count: logs.length }),
    () => {
      console.log(chalk.bold(`Execution Logs: ${job.name}`));
      console.log();

      if (logs.length === 0) {
        console.log(chalk.gray("  No execution logs found."));
        return;
      }

      const headers = ["Time", "Status", "Duration", "Trigger", "Output"];
      const rows = logs.map((log) => [
        new Date(log.started_at).toLocaleString(),
        log.status === "success"
          ? chalk.green(log.status)
          : log.status === "failure"
          ? chalk.red(log.status)
          : chalk.yellow(log.status),
        cronOps.formatDuration(log.duration_ms),
        log.trigger,
        log.error || (log.output ? log.output.slice(0, 50) + (log.output.length > 50 ? "..." : "") : "-"),
      ]);

      outputTable(ctx, headers, rows);
    }
  );
}

/**
 * Register the cron command
 */
export function registerCronCommand(program: Command): void {
  const cronCmd = program
    .command("cron")
    .description("Manage scheduled cron jobs");

  // cron list
  cronCmd
    .command("list")
    .description("List all cron jobs")
    .action(async () => {
      const ctx = getContext(program);
      try {
        await listJobs(ctx);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // cron show <id>
  cronCmd
    .command("show")
    .argument("<id>", "Job ID")
    .description("Show job details")
    .action(async (id: string) => {
      const ctx = getContext(program);
      try {
        await showJob(ctx, id);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // cron add --name <name>
  cronCmd
    .command("add")
    .requiredOption("-n, --name <name>", "Job name")
    .option("--cron <expression>", "Cron expression (e.g., '0 9 * * *')")
    .option("--every <seconds>", "Interval in seconds")
    .option("--agent-id <id>", "Agent ID to use", "main")
    .option("--message <message>", "Message to send to agent")
    .option("--script <bash>", "Bash script to execute (for script type)")
    .option("--channel <id>", "Channel ID to target")
    .description("Add a new cron job")
    .action(
      async (options: {
        name: string;
        cron?: string;
        every?: string;
        agentId?: string;
        message?: string;
        script?: string;
        channel?: string;
      }) => {
        const ctx = getContext(program);
        try {
          await addJob(ctx, options.name, options);
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // cron remove <id>
  cronCmd
    .command("remove")
    .argument("<id>", "Job ID")
    .description("Remove a cron job")
    .action(async (id: string) => {
      const ctx = getContext(program);
      try {
        await removeJob(ctx, id);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // cron enable <id>
  cronCmd
    .command("enable")
    .argument("<id>", "Job ID")
    .description("Enable a cron job")
    .action(async (id: string) => {
      const ctx = getContext(program);
      try {
        await enableJob(ctx, id);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // cron disable <id>
  cronCmd
    .command("disable")
    .argument("<id>", "Job ID")
    .description("Disable a cron job")
    .action(async (id: string) => {
      const ctx = getContext(program);
      try {
        await disableJob(ctx, id);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // cron run <id>
  cronCmd
    .command("run")
    .argument("<id>", "Job ID")
    .description("Run a job immediately (requires Gateway)")
    .action(async (id: string) => {
      const ctx = getContext(program);
      try {
        await runJob(ctx, id);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // cron logs <id>
  cronCmd
    .command("logs")
    .argument("<id>", "Job ID")
    .option("-l, --limit <count>", "Number of logs to show", "20")
    .option("-o, --offset <count>", "Offset from most recent", "0")
    .description("Show execution logs for a job")
    .action(async (id: string, options: { limit?: string; offset?: string }) => {
      const ctx = getContext(program);
      try {
        await showLogs(ctx, id, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
