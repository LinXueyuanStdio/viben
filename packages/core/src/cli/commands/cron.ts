/**
 * viben cron - Cron job management commands
 *
 * Provides commands for managing scheduled cron jobs.
 * Jobs can be agent-based (send message to agent) or script-based (execute bash).
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
import {
  CronService,
  eventService,
  type CronJob,
  type CreateCronJob,
} from "../../services";

// Create a shared cron service instance for CLI
const cronService = new CronService(eventService);

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
 * Format schedule for display
 */
function formatSchedule(job: CronJob): string {
  if (job.cron) {
    return `cron: ${job.cron}`;
  }
  if (job.every) {
    if (job.every < 60) {
      return `every ${job.every}s`;
    }
    if (job.every < 3600) {
      return `every ${Math.floor(job.every / 60)}m`;
    }
    return `every ${Math.floor(job.every / 3600)}h`;
  }
  return chalk.gray("-");
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
 * Ensure cron service is loaded
 */
async function ensureLoaded(): Promise<void> {
  await cronService.load();
}

/**
 * List all cron jobs
 */
async function listJobs(ctx: OutputContext): Promise<void> {
  await ensureLoaded();
  const jobs = await cronService.listJobs();

  output(
    ctx,
    successResponse({
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        enabled: j.enabled,
        jobType: j.jobType,
        schedule: j.cron || (j.every ? `every ${j.every}s` : null),
        agent: j.agent,
        lastStatus: j.lastStatus,
        nextRun: j.nextRun,
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
        j.jobType,
        formatSchedule(j),
        formatStatus(j.lastStatus),
        formatTimestamp(j.nextRun),
      ]);

      outputTable(ctx, headers, rows);
    }
  );
}

/**
 * Show job details
 */
async function showJob(ctx: OutputContext, id: string): Promise<void> {
  await ensureLoaded();
  const job = await cronService.getJob(id);

  if (!job) {
    output(
      ctx,
      { success: false, error: { code: "NOT_FOUND", message: `Job not found: ${id}` } },
      () => {
        console.error(chalk.red(`Job not found: ${id}`));
      }
    );
    return;
  }

  output(ctx, successResponse(job), () => {
    console.log(chalk.bold(`Job: ${job.name}`));
    console.log();

    const details: Record<string, string | number | boolean | undefined> = {
      ID: job.id,
      Name: job.name,
      Enabled: job.enabled ? "Yes" : "No",
      Type: job.jobType,
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

    details["Created"] = formatTimestamp(job.createdAt);
    details["Updated"] = formatTimestamp(job.updatedAt);
    details["Last Run"] = formatTimestamp(job.lastRun);
    details["Last Status"] = job.lastStatus || "-";
    details["Next Run"] = formatTimestamp(job.nextRun);

    if (job.lastError) {
      details["Last Error"] = job.lastError;
    }
    if (job.lastOutput) {
      details["Last Output"] = job.lastOutput.length > 100
        ? job.lastOutput.slice(0, 100) + "..."
        : job.lastOutput;
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
  await ensureLoaded();

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
    jobType: options.script ? "script" : "agent",
    cron: options.cron,
    every: options.every ? parseInt(options.every, 10) : undefined,
    message: options.message,
    script: options.script,
    channel: options.channel,
    enabled: true,
  };

  const job = await cronService.createJob(createJob);

  output(ctx, successResponse(job), () => {
    console.log(chalk.green(`Created cron job: ${job.name}`));
    console.log(`  ID: ${job.id}`);
    console.log(`  Type: ${job.jobType}`);
    console.log(`  Schedule: ${formatSchedule(job)}`);
    console.log(`  Agent: ${job.agent}`);
    if (job.nextRun) {
      console.log(`  Next Run: ${formatTimestamp(job.nextRun)}`);
    }
  });
}

/**
 * Remove a cron job
 */
async function removeJob(ctx: OutputContext, id: string): Promise<void> {
  await ensureLoaded();

  // Check if exists
  const job = await cronService.getJob(id);
  if (!job) {
    output(
      ctx,
      { success: false, error: { code: "NOT_FOUND", message: `Job not found: ${id}` } },
      () => {
        console.error(chalk.red(`Job not found: ${id}`));
      }
    );
    return;
  }

  await cronService.deleteJob(id);

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
  await ensureLoaded();

  const job = await cronService.enableJob(id);

  output(ctx, successResponse(job), () => {
    console.log(chalk.green(`Enabled cron job: ${job.name}`));
    console.log(`  ID: ${id}`);
    if (job.nextRun) {
      console.log(`  Next Run: ${formatTimestamp(job.nextRun)}`);
    }
  });
}

/**
 * Disable a cron job
 */
async function disableJob(ctx: OutputContext, id: string): Promise<void> {
  await ensureLoaded();

  const job = await cronService.disableJob(id);

  output(ctx, successResponse(job), () => {
    console.log(chalk.yellow(`Disabled cron job: ${job.name}`));
    console.log(`  ID: ${id}`);
  });
}

/**
 * Run a cron job immediately
 */
async function runJob(ctx: OutputContext, id: string): Promise<void> {
  await ensureLoaded();

  // Check if exists
  const job = await cronService.getJob(id);
  if (!job) {
    output(
      ctx,
      { success: false, error: { code: "NOT_FOUND", message: `Job not found: ${id}` } },
      () => {
        console.error(chalk.red(`Job not found: ${id}`));
      }
    );
    return;
  }

  console.log(chalk.cyan(`Running job: ${job.name}...`));

  await cronService.runJob(id);

  // Get updated job status
  const updatedJob = await cronService.getJob(id);

  output(
    ctx,
    successResponse({
      id,
      name: job.name,
      status: updatedJob?.lastStatus,
      output: updatedJob?.lastOutput,
      error: updatedJob?.lastError,
    }),
    () => {
      if (updatedJob?.lastStatus === "success") {
        console.log(chalk.green(`Job completed successfully`));
      } else if (updatedJob?.lastStatus === "failure") {
        console.log(chalk.red(`Job failed`));
        if (updatedJob.lastError) {
          console.log(`  Error: ${updatedJob.lastError}`);
        }
      }

      if (updatedJob?.lastOutput) {
        console.log();
        console.log(chalk.bold("Output:"));
        console.log(updatedJob.lastOutput);
      }
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
    .description("Run a job immediately")
    .action(async (id: string) => {
      const ctx = getContext(program);
      try {
        await runJob(ctx, id);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
