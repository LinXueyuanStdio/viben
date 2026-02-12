/**
 * viben gateway - Gateway management commands
 *
 * Gateway is a special service that provides the HTTP/WebSocket API.
 * This module provides start/stop/restart/status commands for the gateway.
 */
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  handleCommandError,
} from "../lib";
import { serviceManager } from "../../services";

const GATEWAY_SERVICE_NAME = "gateway";

/**
 * Default gateway configuration
 */
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 18790;

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
 * Show gateway status
 */
async function showGatewayStatus(ctx: OutputContext): Promise<void> {
  const info = await serviceManager.getServiceStatus(GATEWAY_SERVICE_NAME);

  output(ctx, successResponse(info), () => {
    console.log(chalk.bold("Gateway Status"));
    console.log();
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

    // Show default endpoints when running
    if (info.status === "running") {
      console.log();
      console.log(chalk.bold("Endpoints:"));
      console.log(`  ${chalk.cyan("Health:")}  http://${DEFAULT_HOST}:${DEFAULT_PORT}/health`);
      console.log(`  ${chalk.cyan("API:")}     http://${DEFAULT_HOST}:${DEFAULT_PORT}/api`);
    }
  });
}

/**
 * Start the gateway
 */
async function startGateway(
  ctx: OutputContext,
  options: { port?: number; host?: string }
): Promise<void> {
  const { port = DEFAULT_PORT, host = DEFAULT_HOST } = options;

  // Check if already running
  const current = await serviceManager.getServiceStatus(GATEWAY_SERVICE_NAME);
  if (current.status === "running") {
    output(
      ctx,
      successResponse({
        name: GATEWAY_SERVICE_NAME,
        status: "running",
        message: "Gateway is already running",
        pid: current.pid,
        uptime: current.uptime,
      }),
      () => {
        console.log(chalk.yellow("Gateway is already running"));
        console.log(`  PID: ${current.pid}`);
        console.log(`  Uptime: ${current.uptime}`);
      }
    );
    return;
  }

  // Build gateway command with options
  const args = ["gateway", "serve"];
  if (port !== DEFAULT_PORT) {
    args.push("--port", String(port));
  }
  if (host !== DEFAULT_HOST) {
    args.push("--host", host);
  }

  const info = await serviceManager.startService(GATEWAY_SERVICE_NAME, "viben", args);

  if (info.status === "running") {
    output(
      ctx,
      successResponse({
        name: GATEWAY_SERVICE_NAME,
        status: "running",
        pid: info.pid,
        host,
        port,
      }),
      () => {
        console.log(chalk.green("Started gateway"));
        console.log(`  PID: ${info.pid}`);
        console.log(`  Address: http://${host}:${port}`);
      }
    );
  } else {
    output(
      ctx,
      successResponse({
        name: GATEWAY_SERVICE_NAME,
        status: info.status,
        error: info.error,
      }),
      () => {
        console.error(chalk.red("Failed to start gateway"));
        if (info.error) {
          console.error(`  Error: ${info.error}`);
        }
      }
    );
  }
}

/**
 * Stop the gateway
 */
async function stopGateway(ctx: OutputContext): Promise<void> {
  // Check if running
  const current = await serviceManager.getServiceStatus(GATEWAY_SERVICE_NAME);
  if (current.status !== "running") {
    output(
      ctx,
      successResponse({
        name: GATEWAY_SERVICE_NAME,
        status: "stopped",
        message: "Gateway is not running",
      }),
      () => {
        console.log(chalk.yellow("Gateway is not running"));
      }
    );
    return;
  }

  await serviceManager.stopService(GATEWAY_SERVICE_NAME);

  output(
    ctx,
    successResponse({
      name: GATEWAY_SERVICE_NAME,
      status: "stopped",
      previousPid: current.pid,
    }),
    () => {
      console.log(chalk.green("Stopped gateway"));
      console.log(`  Previous PID: ${current.pid}`);
    }
  );
}

/**
 * Restart the gateway
 */
async function restartGateway(
  ctx: OutputContext,
  options: { port?: number; host?: string }
): Promise<void> {
  const { port = DEFAULT_PORT, host = DEFAULT_HOST } = options;

  // Build gateway command with options
  const args = ["gateway", "serve"];
  if (port !== DEFAULT_PORT) {
    args.push("--port", String(port));
  }
  if (host !== DEFAULT_HOST) {
    args.push("--host", host);
  }

  const info = await serviceManager.restartService(GATEWAY_SERVICE_NAME, "viben", args);

  output(
    ctx,
    successResponse({
      name: GATEWAY_SERVICE_NAME,
      status: info.status,
      pid: info.pid,
      host,
      port,
    }),
    () => {
      if (info.status === "running") {
        console.log(chalk.green("Restarted gateway"));
        console.log(`  PID: ${info.pid}`);
        console.log(`  Address: http://${host}:${port}`);
      } else {
        console.log(chalk.yellow(`Gateway status: ${info.status}`));
        if (info.error) {
          console.log(`  Error: ${info.error}`);
        }
      }
    }
  );
}

/**
 * Register the gateway command
 */
export function registerGatewayCommand(program: Command): void {
  const gatewayCmd = program
    .command("gateway")
    .description("Manage the Viben gateway");

  // gateway status
  gatewayCmd
    .command("status")
    .description("Show gateway status")
    .action(async () => {
      const ctx = getContext(program);
      try {
        await showGatewayStatus(ctx);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // gateway start
  gatewayCmd
    .command("start")
    .option("-p, --port <port>", "Port to listen on", String(DEFAULT_PORT))
    .option("-h, --host <host>", "Host to bind to", DEFAULT_HOST)
    .description("Start the gateway")
    .action(async (options: { port?: string; host?: string }) => {
      const ctx = getContext(program);
      try {
        await startGateway(ctx, {
          port: options.port ? parseInt(options.port, 10) : DEFAULT_PORT,
          host: options.host,
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // gateway stop
  gatewayCmd
    .command("stop")
    .description("Stop the gateway")
    .action(async () => {
      const ctx = getContext(program);
      try {
        await stopGateway(ctx);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // gateway restart
  gatewayCmd
    .command("restart")
    .option("-p, --port <port>", "Port to listen on", String(DEFAULT_PORT))
    .option("-h, --host <host>", "Host to bind to", DEFAULT_HOST)
    .description("Restart the gateway")
    .action(async (options: { port?: string; host?: string }) => {
      const ctx = getContext(program);
      try {
        await restartGateway(ctx, {
          port: options.port ? parseInt(options.port, 10) : DEFAULT_PORT,
          host: options.host,
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
