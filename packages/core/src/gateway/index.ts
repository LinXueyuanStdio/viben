/**
 * Viben Gateway
 *
 * HTTP/WebSocket server for AI agent orchestration.
 * Provides REST API endpoints for agent, task, and session management,
 * as well as SSE event streaming.
 *
 * Note: This module requires fastify as a dependency. It is designed to be
 * optionally loaded only when the gateway server is needed.
 */
import type { FastifyInstance } from "fastify";
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

  // Dynamically import fastify to keep it optional
  const fastify = (await import("fastify")).default;
  const app = fastify({ logger: true });

  // Override default JSON parser to handle empty bodies gracefully
  // This fixes "Unexpected end of JSON input" errors on POST requests with empty body
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body: string, done) => {
      if (!body || body.trim() === "") {
        done(null, {});
        return;
      }
      try {
        const json = JSON.parse(body);
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  // Enable CORS if configured
  if (cors) {
    const corsPlugin = await import("@fastify/cors");
    await app.register(corsPlugin.default, {
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
    const swaggerPlugin = await import("@fastify/swagger");
    const swaggerUiPlugin = await import("@fastify/swagger-ui");

    await app.register(swaggerPlugin.default, {
      openapi: {
        info: {
          title: "Viben Gateway API",
          description: "API for AI agent orchestration and multi-agent workspace management",
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

    await app.register(swaggerUiPlugin.default, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
      },
    });

    log.info("Swagger API documentation registered at /docs");
  } catch (e) {
    log.warn({ err: e }, "Failed to register Swagger plugin");
  }

  // Enable multipart file uploads
  try {
    const multipartPlugin = await import("@fastify/multipart");
    await app.register(multipartPlugin.default, {
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
    const websocketPlugin = await import("@fastify/websocket");
    await app.register(websocketPlugin.default);
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
