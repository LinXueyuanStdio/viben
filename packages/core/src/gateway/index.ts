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
  type TelemetryInstance,
  type Logger,
} from "../telemetry";
import { agentService } from "../services/agent";
import { getActiveWsConnectionCount } from "./routes/ws";

export { AppState, createAppState } from "./state";
export { registerRoutes } from "./routes";
export { setGatewayStartupConfig } from "./routes/health";

// Global telemetry instance
let telemetry: TelemetryInstance | null = null;

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

  const logger = telemetry?.logger;

  // Dynamically import fastify to keep it optional
  const fastify = (await import("fastify")).default;
  const app = fastify({ logger: true });

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

    logger?.info("Swagger API documentation registered at /docs");
    console.log("[Gateway] Swagger API documentation available at /docs");
  } catch (e) {
    logger?.warn({ error: e }, "Failed to register Swagger plugin");
    console.warn("[Gateway] Failed to register Swagger plugin:", e);
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
    logger?.info("Multipart plugin registered");
  } catch (e) {
    logger?.warn({ error: e }, "Failed to register multipart plugin");
    console.warn("[Gateway] Failed to register multipart plugin:", e);
  }

  // Register WebSocket plugin once at the top level
  // This prevents ERR_HTTP_SOCKET_ASSIGNED errors when multiple routes try to register it separately
  try {
    const websocketPlugin = await import("@fastify/websocket");
    await app.register(websocketPlugin.default);
    logger?.info("WebSocket plugin registered");
    console.log("[Gateway] WebSocket plugin registered");
  } catch (e) {
    logger?.warn({ error: e }, "Failed to register WebSocket plugin");
    console.warn("[Gateway] Failed to register WebSocket plugin:", e);
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
    logger?.info("Cron scheduler started");
    console.log("[Gateway] Cron scheduler started");
  } catch (e) {
    logger?.warn({ error: e }, "Failed to start cron scheduler");
    console.warn("[Gateway] Failed to start cron scheduler:", e);
  }

  // Start channel router for message routing to bound agents
  try {
    await state.channelRouter.start();
    logger?.info("Channel router started");
    console.log("[Gateway] Channel router started");
  } catch (e) {
    logger?.warn({ error: e }, "Failed to start channel router");
    console.warn("[Gateway] Failed to start channel router:", e);
  }

  // Start channel runtime for long polling (receives messages from external channels)
  try {
    await state.channelRuntime.start();
    const activePollers = state.channelRuntime.getActivePollers();
    logger?.info({ count: activePollers.length }, "Channel runtime started");
    console.log(`[Gateway] Channel runtime started (${activePollers.length} active poller(s))`);
  } catch (e) {
    logger?.warn({ error: e }, "Failed to start channel runtime");
    console.warn("[Gateway] Failed to start channel runtime:", e);
  }

  // Start task queue manager
  try {
    await state.taskQueue.start();
    const queueStatus = state.taskQueue.getStatus();
    logger?.info(
      { pending: queueStatus.pending_count, running: queueStatus.running_count },
      "Task queue manager started"
    );
    console.log(
      `[Gateway] Task queue manager started (pending: ${queueStatus.pending_count}, running: ${queueStatus.running_count})`
    );
  } catch (e) {
    logger?.warn({ error: e }, "Failed to start task queue manager");
    console.warn("[Gateway] Failed to start task queue manager:", e);
  }

  // Register Observable Gauge callbacks for metrics
  if (enableTelemetry) {
    registerGaugeCallbacks({
      getActiveAgentSessions: () => agentService.getActiveSessionCount(),
      getActiveWsConnections: () => getActiveWsConnectionCount(),
      getCronJobCounts: () => state.cron.getJobStats(),
    });
    logger?.info("Metrics gauge callbacks registered");
    console.log("[Gateway] Metrics gauge callbacks registered");
  }

  // Handle shutdown
  app.addHook("onClose", async () => {
    logger?.info("Shutting down gateway...");
    console.log("[Gateway] Shutting down...");
    state.channelRouter.stop();
    await state.channelRuntime.stop();
    await state.cron.shutdown();
    // Gracefully shutdown task queue (waits for running tasks)
    await state.taskQueue.shutdown();
    state.container.killAllRunningProcesses();
    if (telemetry) {
      await telemetry.shutdown();
      telemetry = null;
    }
    logger?.info("Shutdown complete");
    console.log("[Gateway] Shutdown complete");
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
      console.log(`[Gateway] Already shutting down, ignoring ${signal}`);
      return;
    }
    isShuttingDown = true;

    console.log(`\n[Gateway] Received ${signal}, shutting down gracefully...`);
    telemetry?.logger.info({ signal }, "Received shutdown signal");

    try {
      // Close Fastify server with a timeout
      const closePromise = app.close();
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Shutdown timeout")), 5000)
      );

      await Promise.race([closePromise, timeoutPromise]);
      console.log("[Gateway] Server closed successfully");
    } catch (err) {
      console.warn("[Gateway] Shutdown timed out or failed, forcing exit");
      telemetry?.logger.warn({ error: err }, "Shutdown error");
    }

    process.exit(0);
  };

  // Register signal handlers
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await app.listen({ host, port });

    const logger = telemetry?.logger;
    logger?.info({ host, port }, "Gateway server started");

    console.log(`[Gateway] Server running on http://${host}:${port}`);
    console.log("[Gateway] API endpoints:");
    console.log("  GET  /health - Health check");
    console.log("  GET  /api/agents - List agents");
    console.log("  GET  /api/tasks - List tasks");
    console.log("  GET  /api/sessions - List sessions");
    console.log("  GET  /api/cron - List cron jobs");
    console.log("  GET  /api/events - SSE event stream");
    console.log("  POST /api/queue/enqueue - Enqueue agent task");
    console.log("  GET  /api/queue/status - Queue status");

    if (enableTelemetry) {
      console.log(`[Gateway] Telemetry enabled, data stored in: ${telemetryDir}`);
    }

    // Keep the process running
    await new Promise<void>(() => {});
  } catch (err) {
    telemetry?.logger.error({ error: err }, "Failed to start gateway");
    app.log.error(err);
    process.exit(1);
  }
}
