/**
 * viben gateway - Gateway management commands
 *
 * Gateway is a special service that provides the HTTP/WebSocket API.
 * This module provides start/stop/restart/status commands for the gateway.
 *
 * Architecture:
 * - `gateway start` - Start gateway (foreground or daemon mode)
 * - `gateway stop` - Stop running gateway
 * - `gateway restart` - Restart gateway
 * - `gateway status` - Check gateway status
 * - `gateway serve` - Internal command to run the HTTP server (used by daemon mode)
 */
import chalk from "chalk";
import { execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import { dirname } from "node:path";
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
const DEFAULT_LOG_LEVEL = "info";
const DEFAULT_AGENT = "main";

/**
 * Find process ID using a specific port (cross-platform)
 */
function findProcessOnPort(port: number): number | null {
  try {
    const isWindows = process.platform === "win32";
    let result: string;

    if (isWindows) {
      // Windows: use netstat to find process on port
      // netstat -ano | findstr :18790 | findstr LISTENING
      result = execSync(
        `netstat -ano | findstr :${port} | findstr LISTENING`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
      );
      // Output format: TCP    127.0.0.1:18790    0.0.0.0:0    LISTENING    12345
      // PID is the last column
      const lines = result.trim().split("\n");
      if (lines.length > 0) {
        const parts = lines[0].trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1], 10);
        return isNaN(pid) ? null : pid;
      }
      return null;
    } else {
      // Unix: use lsof
      result = execSync(`lsof -ti :${port}`, { encoding: "utf-8" });
      const pid = parseInt(result.trim().split("\n")[0], 10);
      return isNaN(pid) ? null : pid;
    }
  } catch {
    return null;
  }
}

/**
 * Kill a process by PID (graceful SIGTERM)
 */
function killProcess(pid: number): boolean {
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

/**
 * Force kill a process by PID (SIGKILL)
 */
function forceKillProcess(pid: number): boolean {
  try {
    process.kill(pid, "SIGKILL");
    return true;
  } catch {
    return false;
  }
}

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
 * Run the gateway HTTP server (blocking)
 * This uses the full Fastify gateway with all routes
 */
async function runGatewayServer(options: {
  host: string;
  port: number;
  logLevel: string;
  agent: string;
}): Promise<void> {
  const { host, port } = options;
  const addr = `${host}:${port}`;

  console.log(`Starting gateway on ${addr}...`);

  try {
    // Dynamic import to avoid loading heavy dependencies when not needed
    const { runGateway } = await import("../../gateway");
    await runGateway({ host, port, cors: true });
  } catch (e) {
    // If Fastify is not available, fall back to simple HTTP server
    console.warn(`[Gateway] Fastify not available, using simple HTTP server: ${e instanceof Error ? e.message : e}`);
    await runSimpleGatewayServer(options);
  }
}

/**
 * Simple HTTP server fallback (when Fastify is not available)
 */
async function runSimpleGatewayServer(options: {
  host: string;
  port: number;
  logLevel: string;
  agent: string;
}): Promise<void> {
  const { host, port } = options;
  const addr = `${host}:${port}`;

  const { createServer } = await import("node:http");

  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${addr}`);

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        uptime: "running",
      }));
      return;
    }

    // API info
    if (url.pathname === "/api" || url.pathname === "/api/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        version: "1.0.0",
        endpoints: [
          "/health",
          "/api/agent",
          "/api/tasks",
          "/api/sessions",
          "/api/cron",
          "/api/channels",
          "/api/executors",
          "/api/events",
        ],
        note: "Running in simple mode - install fastify for full functionality",
      }));
      return;
    }

    // Empty list responses for basic endpoints
    if (url.pathname === "/api/agent") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ agents: [] }));
      return;
    }

    if (url.pathname === "/api/tasks") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ tasks: [] }));
      return;
    }

    if (url.pathname === "/api/sessions") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ sessions: [] }));
      return;
    }

    if (url.pathname === "/api/cron") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jobs: [] }));
      return;
    }

    if (url.pathname === "/api/channels") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ channels: [] }));
      return;
    }

    if (url.pathname === "/api/executors") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        executors: [
          { type: "CLAUDE_CODE", name: "Claude Code", available: true },
        ],
      }));
      return;
    }

    // SSE events endpoint (basic)
    if (url.pathname === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
      // Keep connection open
      return;
    }

    // 404 for everything else
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  // Handle graceful shutdown
  const shutdown = () => {
    console.log("\nShutting down gateway...");
    server.close(() => {
      console.log("Gateway stopped");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return new Promise((resolve, reject) => {
    server.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is already in use`));
      } else {
        reject(err);
      }
    });

    server.listen(port, host, () => {
      console.log("=========================================");
      console.log(`Viben Gateway running on http://${host}:${port}`);
      console.log("=========================================");
      console.log("API endpoints:");
      console.log("  GET  /health - Health check");
      console.log("  GET  /api - API info");
      console.log("  GET  /api/agent - List agents");
      console.log("  GET  /api/tasks - List tasks");
      console.log("  GET  /api/sessions - List sessions");
      console.log("  GET  /api/cron - List cron jobs");
      console.log("  GET  /api/channels - List channels");
      console.log("  GET  /api/executors - List executors");
      console.log("  GET  /api/events - SSE event stream");
      console.log("=========================================");
      console.log("Press Ctrl+C to stop");
    });
  });
}

/**
 * Show gateway status
 */
async function showGatewayStatus(ctx: OutputContext, port: number): Promise<void> {
  const pid = findProcessOnPort(port);
  const running = pid !== null;

  const info = {
    name: GATEWAY_SERVICE_NAME,
    status: running ? "running" : "stopped",
    host: DEFAULT_HOST,
    port,
    ...(running && { pid }),
  };

  output(ctx, successResponse({
    ...info,
    ...(ctx.verbose && { logPath: serviceManager.getLogPath(GATEWAY_SERVICE_NAME) }),
  }), () => {
    console.log(chalk.bold("Gateway Status"));
    console.log();
    console.log(`  ${chalk.cyan("Status:")}  ${formatStatus(info.status)}`);
    console.log(`  ${chalk.cyan("Port:")}    ${port}`);

    if (pid) {
      console.log(`  ${chalk.cyan("PID:")}     ${pid}`);
    }

    // Show endpoints when running
    if (running) {
      console.log();
      console.log(chalk.bold("Endpoints:"));
      console.log(`  ${chalk.cyan("Health:")}  http://${DEFAULT_HOST}:${port}/health`);
      console.log(`  ${chalk.cyan("API:")}     http://${DEFAULT_HOST}:${port}/api`);
    }

    if (ctx.verbose) {
      console.log();
      console.log(chalk.dim("Verbose info:"));
      console.log(chalk.dim(`  Log file: ${serviceManager.getLogPath(GATEWAY_SERVICE_NAME)}`));
    }
  });
}

/**
 * Start the gateway
 */
async function startGateway(
  ctx: OutputContext,
  options: {
    port?: number;
    host?: string;
    logLevel?: string;
    agent?: string;
    daemon?: boolean;
  }
): Promise<void> {
  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  const logLevel = options.logLevel ?? DEFAULT_LOG_LEVEL;
  const agent = options.agent ?? DEFAULT_AGENT;
  const daemon = options.daemon ?? false;

  // Check if already running on this port
  const existingPid = findProcessOnPort(port);
  if (existingPid !== null) {
    output(
      ctx,
      successResponse({
        name: GATEWAY_SERVICE_NAME,
        status: "running",
        message: "Gateway is already running",
        pid: existingPid,
        port,
      }),
      () => {
        console.log(chalk.yellow("Gateway is already running"));
        console.log(`  PID: ${existingPid}`);
        console.log(`  Port: ${port}`);
      }
    );
    return;
  }

  if (daemon) {
    // Daemon mode: spawn a detached process running `gateway serve`
    const logPath = serviceManager.getLogPath(GATEWAY_SERVICE_NAME);

    // Ensure log directory exists
    const logDir = dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFd = fs.openSync(logPath, "a");

    // Get the path to the current executable
    const vibenPath = process.argv[1];

    const child = spawn(process.execPath, [vibenPath, "gateway", "serve", "--port", String(port), "--host", host], {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: { ...process.env, VIBEN_GATEWAY_DAEMON: "1" },
    });

    fs.closeSync(logFd);
    child.unref();

    // Wait a bit and check if it started
    await new Promise((resolve) => setTimeout(resolve, 500));

    const pid = findProcessOnPort(port);
    if (pid !== null) {
      output(
        ctx,
        successResponse({
          name: GATEWAY_SERVICE_NAME,
          status: "running",
          pid,
          host,
          port,
          logLevel,
          agent,
          daemon: true,
        }),
        () => {
          console.log(chalk.green("Started gateway (daemon)"));
          console.log(`  PID: ${pid}`);
          console.log(`  Address: http://${host}:${port}`);
          if (ctx.verbose) {
            console.log();
            console.log(chalk.dim("Verbose info:"));
            console.log(chalk.dim(`  Log file: ${logPath}`));
          }
        }
      );
    } else {
      output(
        ctx,
        successResponse({
          name: GATEWAY_SERVICE_NAME,
          status: "failed",
          error: "Gateway failed to start",
          ...(ctx.verbose && { logPath }),
        }),
        () => {
          console.error(chalk.red("Failed to start gateway"));
          if (ctx.verbose) {
            console.log();
            console.log(chalk.dim("Verbose info:"));
            console.log(chalk.dim(`  Log file: ${logPath}`));
            console.log(chalk.dim(`  Check logs with: cat ${logPath}`));
          }
        }
      );
    }
  } else {
    // Foreground mode: run the server directly
    if (!ctx.quiet) {
      console.log(chalk.cyan(`Starting gateway on ${host}:${port}...`));
    }

    try {
      await runGatewayServer({ host, port, logLevel, agent });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (ctx.json) {
        output(ctx, successResponse({
          name: GATEWAY_SERVICE_NAME,
          status: "failed",
          error: errorMessage,
        }), () => {});
      } else {
        console.error(chalk.red(`Failed to start gateway: ${errorMessage}`));
      }
    }
  }
}

/**
 * Stop the gateway
 */
async function stopGateway(
  ctx: OutputContext,
  options: { port?: number } = {}
): Promise<void> {
  const port = options.port ?? DEFAULT_PORT;

  const pid = findProcessOnPort(port);
  if (pid === null) {
    output(
      ctx,
      successResponse({
        name: GATEWAY_SERVICE_NAME,
        status: "stopped",
        message: "Gateway is not running",
        port,
      }),
      () => {
        console.log(chalk.yellow("Gateway is not running"));
        console.log(`  Port: ${port}`);
      }
    );
    return;
  }

  // Kill the process
  const killed = killProcess(pid);

  if (killed) {
    // Wait for process to terminate
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  output(
    ctx,
    successResponse({
      name: GATEWAY_SERVICE_NAME,
      status: "stopped",
      previousPid: pid,
      port,
      ...(ctx.verbose && { logPath: serviceManager.getLogPath(GATEWAY_SERVICE_NAME) }),
    }),
    () => {
      console.log(chalk.green("Stopped gateway"));
      console.log(`  Previous PID: ${pid}`);
      console.log(`  Port: ${port}`);
      if (ctx.verbose) {
        console.log();
        console.log(chalk.dim("Verbose info:"));
        console.log(chalk.dim(`  Log file: ${serviceManager.getLogPath(GATEWAY_SERVICE_NAME)}`));
      }
    }
  );
}

/**
 * Restart the gateway
 */
async function restartGateway(
  ctx: OutputContext,
  options: {
    port?: number;
    host?: string;
    logLevel?: string;
    agent?: string;
    daemon?: boolean;
    force?: boolean;
  }
): Promise<void> {
  const port = options.port ?? DEFAULT_PORT;
  const force = options.force ?? false;

  // Stop existing gateway if running
  let existingPid = findProcessOnPort(port);
  if (existingPid !== null) {
    if (force) {
      if (!ctx.quiet) {
        console.log(chalk.cyan(`Force killing existing gateway (PID ${existingPid})...`));
      }
      forceKillProcess(existingPid);
    } else {
      if (!ctx.quiet) {
        console.log(chalk.cyan(`Stopping existing gateway (PID ${existingPid})...`));
      }
      killProcess(existingPid);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));

    // If force mode, verify port is released and retry if needed
    if (force) {
      existingPid = findProcessOnPort(port);
      if (existingPid !== null) {
        if (!ctx.quiet) {
          console.log(chalk.yellow(`Port ${port} still occupied, retrying force kill...`));
        }
        forceKillProcess(existingPid);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  // Start new gateway
  await startGateway(ctx, options);
}

/**
 * Gateway start options interface
 */
interface GatewayStartOptions {
  port?: string;
  host?: string;
  logLevel?: string;
  agent?: string;
  daemon?: boolean;
}

/**
 * Gateway restart options interface
 */
interface GatewayRestartOptions extends GatewayStartOptions {
  force?: boolean;
}

/**
 * Gateway stop options interface
 */
interface GatewayStopOptions {
  port?: string;
}

/**
 * Parse gateway start options
 */
function parseStartOptions(options: GatewayStartOptions) {
  return {
    port: options.port ? parseInt(options.port, 10) : undefined,
    host: options.host,
    logLevel: options.logLevel,
    agent: options.agent,
    daemon: options.daemon || false,
  };
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
    .option("-p, --port <port>", "Port to check", String(DEFAULT_PORT))
    .description("Show gateway status")
    .action(async (options: { port?: string }) => {
      const ctx = getContext(program);
      try {
        const port = options.port ? parseInt(options.port, 10) : DEFAULT_PORT;
        await showGatewayStatus(ctx, port);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // gateway start
  gatewayCmd
    .command("start")
    .option("-p, --port <port>", "Port to listen on")
    .option("-h, --host <host>", "Host to bind to")
    .option("-l, --log-level <level>", "Log level (debug, info, warn, error)")
    .option("-n, --agent <agent-id>", "Agent to run")
    .option("-d, --daemon", "Run in daemon mode")
    .description("Start the gateway")
    .action(async (options: GatewayStartOptions) => {
      const ctx = getContext(program);
      try {
        await startGateway(ctx, parseStartOptions(options));
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // gateway stop
  gatewayCmd
    .command("stop")
    .option("-p, --port <port>", "Stop gateway on specific port")
    .description("Stop the gateway")
    .action(async (options: GatewayStopOptions) => {
      const ctx = getContext(program);
      try {
        await stopGateway(ctx, {
          port: options.port ? parseInt(options.port, 10) : undefined,
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // gateway restart
  gatewayCmd
    .command("restart")
    .option("-p, --port <port>", "Port to listen on")
    .option("-h, --host <host>", "Host to bind to")
    .option("-l, --log-level <level>", "Log level (debug, info, warn, error)")
    .option("-n, --agent <agent-id>", "Agent to run")
    .option("-d, --daemon", "Run in daemon mode")
    .option("-f, --force", "Force kill the existing process (SIGKILL instead of SIGTERM)")
    .description("Restart the gateway")
    .action(async (options: GatewayRestartOptions) => {
      const ctx = getContext(program);
      try {
        await restartGateway(ctx, {
          ...parseStartOptions(options),
          force: options.force || false,
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // gateway serve (internal command for daemon mode)
  gatewayCmd
    .command("serve")
    .option("-p, --port <port>", "Port to listen on", String(DEFAULT_PORT))
    .option("-h, --host <host>", "Host to bind to", DEFAULT_HOST)
    .option("-l, --log-level <level>", "Log level", DEFAULT_LOG_LEVEL)
    .option("-n, --agent <agent-id>", "Agent to run", DEFAULT_AGENT)
    .description("Run the gateway server (internal)")
    .action(async (options: GatewayStartOptions) => {
      const port = options.port ? parseInt(options.port, 10) : DEFAULT_PORT;
      const host = options.host ?? DEFAULT_HOST;
      const logLevel = options.logLevel ?? DEFAULT_LOG_LEVEL;
      const agent = options.agent ?? DEFAULT_AGENT;

      try {
        await runGatewayServer({ host, port, logLevel, agent });
      } catch (error) {
        console.error(`Gateway error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
