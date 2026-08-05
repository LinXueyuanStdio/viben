/**
 * Viben Gateway — Agent Swarm × Code Evolution
 *
 * HTTP/WebSocket server for multi-agent orchestration and code evolution.
 * Supports Evo-based agent learning, XState task management, and
 * real-time collaboration through SSE/WebSocket streaming.
 */
import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import fastifySwagger from "@fastify/swagger";
import fastifyWebsocket from "@fastify/websocket";
import { AppState, createAppState } from "./state";
import { registerRoutes } from "./routes";
import { createOperationIdGenerator } from "./openapi/operation-id";
import { VERSION, setGatewayStartupConfig } from "./routes/health";
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
import { ClientSocketServer } from "./client-socket-server";
import { acpSessionManager, cleanupStaleAcpSessions } from "../acp";

export { AppState, createAppState } from "./state";
export { registerRoutes } from "./routes";
export { setGatewayStartupConfig } from "./routes/health";
export { ClientStore } from "./client-store";
export { ClientSocketServer } from "./client-socket-server";

// Global telemetry instance
let telemetry: TelemetryInstance | null = null;

// Module-level logger
const log = globalLogger.child({ module: "gateway" });
const EXCLUDED_OPENAPI_ROUTE_PREFIXES = ["/api/mcp-server", "/api/python-mcp"];

function shouldExcludeFromOpenApi(url: string): boolean {
  // Only include /api/* routes in the OpenAPI spec
  if (!url.startsWith("/api/")) return true;
  // Exclude bundled MCP server routes
  return EXCLUDED_OPENAPI_ROUTE_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}/`));
}

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
  /** Start gateway background runtime services */
  runtime?: boolean;
}

type CleanupStaleAcpSessionsFn = typeof cleanupStaleAcpSessions;

let cleanupStaleAcpSessionsForStartup: CleanupStaleAcpSessionsFn = cleanupStaleAcpSessions;

export function setCleanupStaleAcpSessionsForTests(cleanup: CleanupStaleAcpSessionsFn): void {
  cleanupStaleAcpSessionsForStartup = cleanup;
}

export function resetCleanupStaleAcpSessionsForTests(): void {
  cleanupStaleAcpSessionsForStartup = cleanupStaleAcpSessions;
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
    runtime = true,
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

  // Register Swagger for OpenAPI spec generation (no UI)
  try {
    // Create a generator for globally unique operationIds.
    // Per-tag method name dedup is handled in the transform below
    // so it uses the final (post-merge) tags, not URL-derived ones.
    const makeOperationId = createOperationIdGenerator();
    const seenPerTag = new Map<string, Set<string>>();

    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: "Viben Gateway API",
          description: "Agent Swarm × Code Evolution - Multi-agent orchestration and code evolution API",
          version: VERSION,
        },
        servers: [
          {
            url: `http://${host}:${port}`,
            description: "Local development server",
          },
        ],
        tags: [
          { name: "health", description: "Health check endpoints" },
          { name: "agents", description: "Agent management" },
          { name: "sessions", description: "Session management" },
          { name: "tasks", description: "Task management" },
          { name: "models", description: "Model configuration" },
          { name: "providers", description: "Provider configuration" },
          { name: "workspaces", description: "Workspace management" },
          { name: "cron", description: "Scheduled jobs" },
          { name: "channels", description: "Channel management" },
          { name: "mcp", description: "MCP server management" },
          { name: "executors", description: "Executor configuration" },
        ],
      },
      transform: ({ schema, url, route }) => {
        if (shouldExcludeFromOpenApi(url)) {
          return { schema: { ...schema, hide: true }, url };
        }
        // Auto-generate operationId and tags for every route
        const method = (route as any).method ?? "GET";
        const { operationId, methodName, tags: autoTags } = makeOperationId(method, url);
        const existingSchema = schema || {};

        // Use the final tag (explicit takes precedence) for per-tag method dedup
        const finalTag = (existingSchema.tags && existingSchema.tags.length > 0)
          ? existingSchema.tags[0]
          : autoTags[0];

        // Per-tag dedup: ensure unique methodName within each tag namespace
        let finalMethodName = existingSchema["x-speakeasy-name-override"] ?? methodName;
        const tagMethods = seenPerTag.get(finalTag) ?? new Set();
        if (tagMethods.has(finalMethodName)) {
          let n = 2;
          while (tagMethods.has(`${methodName}${n}`)) n++;
          finalMethodName = `${methodName}${n}`;
        }
        tagMethods.add(finalMethodName);
        seenPerTag.set(finalTag, tagMethods);

        return {
          schema: {
            ...existingSchema,
            operationId: existingSchema.operationId ?? operationId,
            "x-speakeasy-name-override": finalMethodName,
            tags: existingSchema.tags && existingSchema.tags.length > 0
              ? existingSchema.tags
              : autoTags,
          },
          url,
        };
      },
    });

    // Register OpenAPI spec endpoints
    app.get("/openapi.json", async () => {
      return app.swagger();
    });

    app.get("/openapi.yaml", async (_, reply) => {
      const yaml = app.swagger({ yaml: true });
      reply.type("application/x-yaml").send(yaml);
    });

    log.info("Swagger plugin registered (OpenAPI spec at /openapi.json, /openapi.yaml)");
  } catch (e) {
    log.warn({ err: e }, "Failed to register Swagger plugin");
  }

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

  // Create application state with configured host/port
  const state = createAppState({ host, port, runtime });

  // Create client socket server (Socket.io) BEFORE @fastify/websocket so we can
  // capture both upgrade listeners and replace them with a URL-routed dispatcher.
  // Only mounted during normal gateway startup (runtime=true), not for
  // openapi.json export (runtime=false).
  if (runtime) {
    const httpServer = app.server;
    state.clientSocketServer = new ClientSocketServer(httpServer, state.clientStore);
    log.info("Client Socket.io server started");
  }

  // Register WebSocket plugin once at the top level
  // This prevents ERR_HTTP_SOCKET_ASSIGNED errors when multiple routes try to register it separately
  try {
    await app.register(fastifyWebsocket);
    log.info("WebSocket plugin registered");
  } catch (e) {
    log.warn({ err: e }, "Failed to register WebSocket plugin");
  }

  // Replace the two independent upgrade listeners (Socket.io + @fastify/websocket)
  // with a single URL-routed dispatcher. Each upgrade request goes to exactly one
  // handler — no double-processing, no "headers already sent" noise.
  if (runtime) {
    const listeners = app.server.listeners("upgrade");
    const socketIOListener = listeners[0] as (...args: any[]) => void;
    const fwsListener = listeners[1] as (...args: any[]) => void;

    if (socketIOListener && fwsListener) {
      app.server.removeAllListeners("upgrade");
      app.server.on("upgrade", (req: any, socket: any, head: any) => {
        const url: string = req.url || "";
        if (url.startsWith("/socket.io/client")) {
          socketIOListener(req, socket, head);
        } else {
          fwsListener(req, socket, head);
        }
      });
      log.info("WebSocket upgrade dispatcher installed (Socket.io + Fastify)");
    }
  }

  // Register routes
  await registerRoutes(app, state);

  try {
    await cleanupStaleAcpSessionsForStartup(acpSessionManager.storage);
  } catch (err) {
    log.warn({ err }, "Stale ACP session cleanup failed");
  }

  // Set startup configuration for health endpoint
  setGatewayStartupConfig({ host, port, cors });

  if (runtime) {
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

    // Start mDNS discovery (advertise + browse for peers)
    try {
      await state.discovery.start();
      log.info({ mdnsAvailable: await state.discovery.isMdnsAvailable() }, "Discovery service started");
    } catch (e) {
      log.warn({ err: e }, "Failed to start discovery service");
    }

    // Reconnect to previously known mesh peers
    try {
      await state.mesh.reconnectKnownPeers();
      log.info("Mesh peer reconnection initiated");
    } catch (e) {
      log.warn({ err: e }, "Failed to reconnect known peers");
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
  }

  // Handle shutdown
  if (runtime) {
    app.addHook("onClose", async () => {
      log.info("Shutting down gateway...");
      state.clientSocketServer?.shutdown();
      state.clientStore.shutdown();
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
      // Stop discovery (mDNS unpublish) and mesh connections
      state.discovery.stop();
      state.mesh.shutdown();
      state.container.killAllRunningProcesses();
      await state.firebase.shutdown();
      if (telemetry) {
        await telemetry.shutdown();
        telemetry = null;
      }
      log.info("Shutdown complete");
    });
  }

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
    console.log("[Gateway] API: /health, /api/agent, /api/tasks, /api/sessions");
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
