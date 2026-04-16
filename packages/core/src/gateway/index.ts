/**
 * Viben Gateway — Agent Swarm × Code Evolution
 *
 * HTTP/WebSocket server for multi-agent orchestration and code evolution.
 * Supports Evo-based agent learning, XState task management, and
 * real-time collaboration through SSE/WebSocket streaming.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyMultipart from "@fastify/multipart";
import fastifyWebsocket from "@fastify/websocket";
import { AppState, createAppState } from "./state";
import { registerRoutes } from "./routes";
import { setGatewayStartupConfig } from "./routes/health";
import {
  initTelemetry,
  getDefaultTelemetryDir,
  registerGaugeCallbacks,
  logger as globalLogger,
  type TelemetryInstance,
  type Logger,
} from "../telemetry";
import { agentService } from "../services/agent";
import { getActiveWsConnectionCount } from "./routes/ws";
import { workspaceManager } from "../workspace";

export { AppState, createAppState } from "./state";
export { registerRoutes } from "./routes";
export { setGatewayStartupConfig } from "./routes/health";

// Global telemetry instance
let telemetry: TelemetryInstance | null = null;

// Module-level logger
const log = globalLogger.child({ module: "gateway" });

/**
 * Get the gateway logger
 */
export function getLogger(): Logger | null {
  return telemetry?.logger || null;
}

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  /** Host to bind to */
  host?: string;
  /** Port to listen on */
  port?: number;
  /** Enable CORS */
  cors?: boolean;
  /** Enable telemetry */
  telemetry?: boolean;
  /** Telemetry directory */
  telemetryDir?: string;
}

/**
 * Create and configure the gateway server
 *
 * @param config - Gateway configuration
 * @returns Configured Fastify instance
 */
export async function createGateway(config: GatewayConfig = {}): Promise<FastifyInstance> {
  const {
    host = "127.0.0.1",
    port = 18790,
    cors = true,
    telemetry: enableTelemetry = process.env.VIBEN_TELEMETRY !== "false",
    telemetryDir = getDefaultTelemetryDir(),
  } = config;

  // Initialize telemetry first (before Fastify, so instrumentation works)
  if (enableTelemetry && !telemetry) {
    telemetry = initTelemetry({
      serviceName: "viben-gateway",
      serviceVersion: "1.0.0",
      baseDir: telemetryDir,
      enabled: enableTelemetry,
      trace: {
        flushDelayMs: 5000,
        batchSize: 100,
      },
      metrics: {
        exportIntervalMs: 60000,
      },
      log: {
        level: process.env.LOG_LEVEL || "info",
      },
    });
  }

  const app = fastify({ logger: true });

  // Enable CORS if configured
  if (cors) {
    await app.register(fastifyCors, {
      origin: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Accept",
        // MCP Inspector proxy headers
        "X-MCP-Proxy-Auth",
        "MCP-Session-Id",
        "X-Custom-Auth-Header",
        "X-Custom-Auth-Headers",
        "Last-Event-Id",
        // MCP SDK headers
        "mcp-protocol-version",
      ],
      exposedHeaders: ["MCP-Session-Id", "mcp-protocol-version"],
      credentials: true,
    });
  }

  // Register Swagger for API documentation
  try {
    // Determine baseDir for Swagger UI static files
    // In bundled mode, static files are copied to swagger-ui-static/ alongside the binary
    const execDir = dirname(process.execPath);
    const bundledStaticDir = join(execDir, "swagger-ui-static");
    const hasBundledStatic = existsSync(bundledStaticDir);

    // Check if we're running as a bundled binary (Bun compiled binary)
    // In bundled mode, process.execPath points to the binary itself, not node/bun
    // and the binary name typically contains "viben" (e.g., viben-aarch64-apple-darwin)
    const execName = process.execPath.toLowerCase();
    const isBundledBinary = execName.includes("viben") && !execName.includes("node") && !execName.includes("bun");

    // Skip Swagger UI if we're in bundled mode but static files aren't available
    if (isBundledBinary && !hasBundledStatic) {
      log.info("Swagger UI disabled: static files not available in bundled mode");
    } else {
      await app.register(fastifySwagger, {
        openapi: {
          info: {
            title: "Viben Gateway API",
            description: "Agent Swarm × Code Evolution — API for multi-agent orchestration, Evo-based code evolution, and XState task management",
            version: "1.0.0",
          },
          servers: [{ url: `http://${host}:${port}` }],
          tags: [
            { name: "health", description: "Health check endpoints" },
            { name: "agents", description: "Agent management" },
            { name: "executors", description: "Executor discovery and management" },
            { name: "sessions", description: "Session management" },
            { name: "providers", description: "Provider management" },
            { name: "models", description: "Model management" },
            { name: "workspaces", description: "Workspace management" },
            { name: "channels", description: "Channel management" },
            { name: "cron", description: "Cron job management" },
            { name: "tasks", description: "Task management" },
            { name: "mcp", description: "MCP server management" },
            { name: "kanban", description: "Kanban board management" },
          ],
        },
      });

      const swaggerUiBaseDir = hasBundledStatic ? bundledStaticDir : undefined;
      await app.register(fastifySwaggerUi, {
        routePrefix: "/docs",
        baseDir: swaggerUiBaseDir,
        uiConfig: {
          docExpansion: "list",
          deepLinking: true,
        },
      });
      log.info("Swagger API documentation registered at /docs");
    }
  } catch (e) {
    log.warn({ err: e }, "Failed to register Swagger plugin");
  }

  // Enable multipart file uploads
  try {
    await app.register(fastifyMultipart, {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max file size
        files: 10, // Max 10 files per request
      },
    });
    log.info("Multipart plugin registered");
  } catch (e) {
    log.warn({ err: e }, "Failed to register multipart plugin");
  }

  // Register WebSocket plugin once at the top level
  // This prevents ERR_HTTP_SOCKET_ASSIGNED errors when multiple routes try to register it separately
  try {
    await app.register(fastifyWebsocket);
    log.info("WebSocket plugin registered");
  } catch (e) {
    log.warn({ err: e }, "Failed to register WebSocket plugin");
  }

  // Create application state
  const state = createAppState();

  // Register routes
  registerRoutes(app, state);

  // Set startup configuration for health endpoint
  setGatewayStartupConfig({ host, port, cors });

  // Start cron scheduler
  try {
    await state.cron.start();
    log.info("Cron scheduler started");
  } catch (e) {
    log.warn({ err: e }, "Failed to start cron scheduler");
  }

  // Start channel router for message routing to bound agents
  try {
    await state.channelRouter.start();
    log.info("Channel router started");
  } catch (e) {
    log.warn({ err: e }, "Failed to start channel router");
  }

  // Start channel runtime for long polling (receives messages from external channels)
  try {
    await state.channelRuntime.start();
    const activePollers = state.channelRuntime.getActivePollers();
    log.info({ activePollerCount: activePollers.length }, "Channel runtime started");
  } catch (e) {
    log.warn({ err: e }, "Failed to start channel runtime");
  }

  // Start task queue manager
  try {
    await state.taskQueue.start();
    const queueStatus = state.taskQueue.getStatus();
    log.info(
      { pending: queueStatus.pending_count, running: queueStatus.running_count },
      "Task queue manager started"
    );
  } catch (e) {
    log.warn({ err: e }, "Failed to start task queue manager");
  }

  // Start SSE heartbeat and cleanup for dead connection detection
  try {
    state.taskSSEManager.startHeartbeat();
    log.info("Task SSE Manager heartbeat started");
  } catch (e) {
    log.warn({ err: e }, "Failed to start SSE heartbeat");
  }

  // Start command queue (promoter + monitor for detached shell commands)
  try {
    await state.commandQueue.start();
    const queueStatus = state.commandQueue.getStatus();
    log.info(
      { pending: queueStatus.pending, running: queueStatus.running, maxConcurrency: queueStatus.max_concurrency },
      "Command queue started"
    );
  } catch (e) {
    log.warn({ err: e }, "Failed to start command queue");
  }

  // Run task recovery on startup for all known workspaces
  try {
    const workspaces = await workspaceManager.listWorkspaces();
    let totalRecovered = 0;
    let totalChecked = 0;

    for (const workspace of workspaces) {
      try {
        const summary = await state.taskRecovery.recoverOnStartup(workspace.path);
        totalChecked += summary.totalChecked;
        totalRecovered += summary.recovered;

        if (summary.recovered > 0) {
          log.info(
            { workspace: workspace.path, recovered: summary.recovered, checked: summary.totalChecked },
            "Task recovery completed for workspace"
          );
        }
      } catch (workspaceError) {
        log.warn(
          { workspace: workspace.path, err: workspaceError },
          "Failed to recover tasks for workspace"
        );
      }
    }

    if (totalChecked > 0) {
      log.info(
        { totalChecked, totalRecovered, workspaceCount: workspaces.length },
        "Task recovery completed"
      );
    }
  } catch (e) {
    log.warn({ err: e }, "Failed to run task recovery");
  }

  // Register Observable Gauge callbacks for metrics
  if (enableTelemetry) {
    registerGaugeCallbacks({
      getActiveAgentSessions: () => agentService.getActiveSessionCount(),
      getActiveWsConnections: () => getActiveWsConnectionCount(),
      getCronJobCounts: () => state.cron.getJobStats(),
    });
    log.info("Metrics gauge callbacks registered");
  }

  // Handle shutdown
  app.addHook("onClose", async () => {
    log.info("Shutting down gateway...");
    state.channelRouter.stop();
    await state.channelRuntime.stop();
    await state.cron.shutdown();
    // Gracefully shutdown task queue (waits for running tasks)
    await state.taskQueue.shutdown();
    // Stop command queue (promoter + monitor)
    // Note: Running detached processes continue independently
    await state.commandQueue.stop();
    // Stop SSE heartbeat and cleanup all SSE connections
    state.taskSSEManager.stopHeartbeat();
    state.taskSSEManager.close();
    state.container.killAllRunningProcesses();
    if (telemetry) {
      await telemetry.shutdown();
      telemetry = null;
    }
    log.info("Shutdown complete");
  });

  return app;
}

/**
 * Start the gateway server
 *
 * @param config - Gateway configuration
 */
export async function runGateway(config: GatewayConfig = {}): Promise<void> {
  const {
    host = "127.0.0.1",
    port = 18790,
    telemetry: enableTelemetry = process.env.VIBEN_TELEMETRY !== "false",
    telemetryDir = getDefaultTelemetryDir(),
  } = config;

  const app = await createGateway(config);

  // Track if we're already shutting down to prevent multiple shutdowns
  let isShuttingDown = false;

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      log.debug({ signal }, "Already shutting down, ignoring signal");
      return;
    }
    isShuttingDown = true;

    log.info({ signal }, "Received shutdown signal, shutting down gracefully...");

    try {
      // Close Fastify server with a timeout
      const closePromise = app.close();
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Shutdown timeout")), 5000)
      );

      await Promise.race([closePromise, timeoutPromise]);
      log.info("Server closed successfully");
    } catch (err) {
      log.warn({ err }, "Shutdown timed out or failed, forcing exit");
    }

    process.exit(0);
  };

  // Register signal handlers
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await app.listen({ host, port });

    log.info({ host, port, telemetryEnabled: enableTelemetry, telemetryDir }, "Gateway server started");

    // CLI user-facing output
    console.log(`\n[Gateway] Server running on http://${host}:${port}`);
    console.log("[Gateway] API: /health, /api/agent, /api/tasks, /api/sessions, /docs");
    if (enableTelemetry) {
      console.log(`[Gateway] Telemetry: ${telemetryDir}`);
    }
    console.log("");

    // Keep the process running
    await new Promise<void>(() => {});
  } catch (err) {
    log.error({ err }, "Failed to start gateway");
    process.exit(1);
  }
}
