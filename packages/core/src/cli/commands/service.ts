/**
 * viben service - Service management commands
 *
 * Provides start/stop/restart/status/logs functionality for background services
 * including MCP servers, gateway, and viben services.
 */
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  outputTable,
  handleCommandError,
} from "../lib";
import {
  serviceManager,
  type ServiceInfo,
} from "../../services";

/**
 * Format status for display
 */
function formatStatus(status: string): string {
  switch (status) {
    case "running":
      return chalk.green("running");
    case "stopped":
      return chalk.gray("stopped");
    case "failed":
      return chalk.red("failed");
    default:
      return chalk.yellow("unknown");
  }
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
 * Show service status
 */
async function showServiceStatus(
  ctx: OutputContext,
  name?: string
): Promise<void> {
  if (name) {
    // Show single service status
    const info = await serviceManager.getServiceStatus(name);

    output(ctx, successResponse(info), () => {
      console.log(chalk.bold(`Service: ${info.name}`));
      console.log();
      console.log(`  ${chalk.cyan("Type:")}    ${info.type}`);
      console.log(`  ${chalk.cyan("Status:")}  ${formatStatus(info.status)}`);

      if (info.pid) {
        console.log(`  ${chalk.cyan("PID:")}     ${info.pid}`);
      }

      if (info.uptime) {
        console.log(`  ${chalk.cyan("Uptime:")}  ${info.uptime}`);
      }

      if (info.command) {
        const fullCmd = info.args?.length
          ? `${info.command} ${info.args.join(" ")}`
          : info.command;
        console.log(`  ${chalk.cyan("Command:")} ${fullCmd}`);
      }

      if (info.error) {
        console.log(`  ${chalk.cyan("Error:")}   ${chalk.red(info.error)}`);
      }
    });
    return;
  }

  // Show all services status
  const services = await serviceManager.listServices();

  const response = successResponse({
    services: services.map((s) => ({
      name: s.name,
      type: s.type,
      status: s.status,
      pid: s.pid,
      uptime: s.uptime,
    })),
    count: services.length,
  });

  output(ctx, response, () => {
    console.log(chalk.bold("Services:"));
    console.log();

    if (services.length === 0) {
      console.log(chalk.gray("  No services tracked."));
      return;
    }

    const headers = ["Name", "Type", "Status", "PID", "Uptime"];
    const rows = services.map((s) => [
      s.name,
      s.type,
      formatStatus(s.status),
      s.pid?.toString() || chalk.gray("-"),
      s.uptime || chalk.gray("-"),
    ]);

    outputTable(ctx, headers, rows);
  });
}

/**
 * Start a service
 */
async function startService(
  ctx: OutputContext,
  name: string,
  command?: string,
  args?: string[]
): Promise<void> {
  // Check if already running
  const current = await serviceManager.getServiceStatus(name);
  if (current.status === "running") {
    output(
      ctx,
      successResponse({
        name,
        status: "running",
        message: "Service is already running",
        pid: current.pid,
        uptime: current.uptime,
      }),
      () => {
        console.log(chalk.yellow(`Service ${name} is already running`));
        console.log(`  PID: ${current.pid}`);
        console.log(`  Uptime: ${current.uptime}`);
      }
    );
    return;
  }

  const info = await serviceManager.startService(name, command, args);

  if (info.status === "running") {
    output(
      ctx,
      successResponse({
        name,
        status: "running",
        pid: info.pid,
        command: info.command,
        args: info.args,
      }),
      () => {
        console.log(chalk.green(`Started service ${name}`));
        console.log(`  PID: ${info.pid}`);
        if (info.command) {
          const fullCmd = info.args?.length
            ? `${info.command} ${info.args.join(" ")}`
            : info.command;
          console.log(`  Command: ${fullCmd}`);
        }
      }
    );
  } else {
    output(
      ctx,
      successResponse({
        name,
        status: info.status,
        error: info.error,
      }),
      () => {
        console.error(chalk.red(`Failed to start service ${name}`));
        if (info.error) {
          console.error(`  Error: ${info.error}`);
        }
      }
    );
  }
}

/**
 * Stop a service
 */
async function stopService(ctx: OutputContext, name: string): Promise<void> {
  // Check if running
  const current = await serviceManager.getServiceStatus(name);
  if (current.status !== "running") {
    output(
      ctx,
      successResponse({
        name,
        status: "stopped",
        message: "Service is not running",
      }),
      () => {
        console.log(chalk.yellow(`Service ${name} is not running`));
      }
    );
    return;
  }

  const info = await serviceManager.stopService(name);

  output(
    ctx,
    successResponse({
      name,
      status: "stopped",
      previousPid: current.pid,
    }),
    () => {
      console.log(chalk.green(`Stopped service ${name}`));
      console.log(`  Previous PID: ${current.pid}`);
    }
  );
}

/**
 * Restart a service
 */
async function restartService(
  ctx: OutputContext,
  name: string,
  command?: string,
  args?: string[]
): Promise<void> {
  const info = await serviceManager.restartService(name, command, args);

  output(
    ctx,
    successResponse({
      name,
      status: info.status,
      pid: info.pid,
    }),
    () => {
      if (info.status === "running") {
        console.log(chalk.green(`Restarted service ${name}`));
        console.log(`  PID: ${info.pid}`);
      } else {
        console.log(chalk.yellow(`Service ${name} status: ${info.status}`));
        if (info.error) {
          console.log(`  Error: ${info.error}`);
        }
      }
    }
  );
}

/**
 * Show service logs
 */
async function showServiceLogs(
  ctx: OutputContext,
  name: string,
  options: { follow?: boolean; lines?: number; clear?: boolean }
): Promise<void> {
  const { follow, lines = 100, clear } = options;

  // Clear logs if requested
  if (clear) {
    await serviceManager.clearLogs(name);

    output(
      ctx,
      successResponse({ name, cleared: true }),
      () => {
        console.log(chalk.green(`Cleared logs for service ${name}`));
      }
    );
    return;
  }

  // Get log file path
  const logPath = serviceManager.getLogPath(name);

  if (follow) {
    // Follow mode - watch for changes
    if (ctx.json) {
      // In JSON mode, we can't stream, so just output current logs
      const logs = await serviceManager.getServiceLogs(name, lines);
      console.log(
        JSON.stringify(
          {
            success: true,
            data: {
              name,
              logPath,
              lines: logs,
              count: logs.length,
              note: "Follow mode not supported in JSON output",
            },
          },
          null,
          2
        )
      );
      return;
    }

    // Human mode - stream logs
    console.log(chalk.bold(`Logs for ${name}:`));
    console.log(chalk.gray(`Path: ${logPath}`));
    console.log(chalk.gray("Press Ctrl+C to stop following"));
    console.log();

    // Output existing logs first
    const existingLogs = await serviceManager.getServiceLogs(name, lines);
    for (const line of existingLogs) {
      console.log(line);
    }

    // Watch for new logs
    const stop = serviceManager.watchLogs({
      name,
      onLine: (line) => {
        console.log(line);
      },
    });

    // Handle SIGINT
    process.on("SIGINT", () => {
      stop();
      console.log();
      console.log(chalk.gray("Stopped following logs"));
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {
      // Never resolves - keep waiting until SIGINT
    });
    return;
  }

  // Regular mode - show last N lines
  const logs = await serviceManager.getServiceLogs(name, lines);

  output(
    ctx,
    successResponse({
      name,
      logPath,
      lines: logs,
      count: logs.length,
    }),
    () => {
      console.log(chalk.bold(`Logs for ${name}:`));
      console.log(chalk.gray(`Path: ${logPath}`));
      console.log();

      if (logs.length === 0) {
        console.log(chalk.gray("No logs available."));
        return;
      }

      for (const line of logs) {
        console.log(line);
      }
    }
  );
}

/**
 * Register the service command
 */
export function registerServiceCommand(program: Command): void {
  const serviceCmd = program
    .command("service")
    .description("Manage background services");

  // service status [name]
  serviceCmd
    .command("status")
    .argument("[name]", "Service name")
    .description("Show service status (all or specific)")
    .action(async (name: string | undefined) => {
      const ctx = getContext(program);
      try {
        await showServiceStatus(ctx, name);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // service start <name>
  serviceCmd
    .command("start")
    .argument("<name>", "Service name")
    .option("-c, --command <command>", "Command to run")
    .argument("[args...]", "Arguments to pass to the command")
    .description("Start a service")
    .action(
      async (
        name: string,
        args: string[],
        options: { command?: string }
      ) => {
        const ctx = getContext(program);
        try {
          await startService(
            ctx,
            name,
            options.command,
            args.length > 0 ? args : undefined
          );
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // service stop <name>
  serviceCmd
    .command("stop")
    .argument("<name>", "Service name")
    .description("Stop a service")
    .action(async (name: string) => {
      const ctx = getContext(program);
      try {
        await stopService(ctx, name);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // service restart <name>
  serviceCmd
    .command("restart")
    .argument("<name>", "Service name")
    .option("-c, --command <command>", "Command to run")
    .argument("[args...]", "Arguments to pass to the command")
    .description("Restart a service")
    .action(
      async (
        name: string,
        args: string[],
        options: { command?: string }
      ) => {
        const ctx = getContext(program);
        try {
          await restartService(
            ctx,
            name,
            options.command,
            args.length > 0 ? args : undefined
          );
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // service logs <name>
  serviceCmd
    .command("logs")
    .argument("<name>", "Service name")
    .option("-f, --follow", "Follow log output")
    .option("-n, --lines <number>", "Number of lines to show", "100")
    .option("--clear", "Clear service logs")
    .description("Show/follow service logs")
    .action(
      async (
        name: string,
        options: { follow?: boolean; lines?: string; clear?: boolean }
      ) => {
        const ctx = getContext(program);
        try {
          await showServiceLogs(ctx, name, {
            follow: options.follow,
            lines: options.lines ? parseInt(options.lines, 10) : 100,
            clear: options.clear,
          });
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );
}
