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

export { AppState, createAppState } from "./state";
export { registerRoutes } from "./routes";

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
}

/**
 * Create and configure the gateway server
 *
 * @param config - Gateway configuration
 * @returns Configured Fastify instance
 */
export async function createGateway(config: GatewayConfig = {}): Promise<FastifyInstance> {
  const { host = "127.0.0.1", port = 18790, cors = true } = config;

  // Dynamically import fastify to keep it optional
  const fastify = (await import("fastify")).default;
  const app = fastify({ logger: true });

  // Enable CORS if configured
  if (cors) {
    const corsPlugin = await import("@fastify/cors");
    await app.register(corsPlugin.default, {
      origin: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
  }

  // Create application state
  const state = createAppState();

  // Register routes
  registerRoutes(app, state);

  // Start cron scheduler
  try {
    await state.cron.start();
    console.log("[Gateway] Cron scheduler started");
  } catch (e) {
    console.warn("[Gateway] Failed to start cron scheduler:", e);
  }

  // Handle shutdown
  app.addHook("onClose", async () => {
    console.log("[Gateway] Shutting down...");
    await state.cron.shutdown();
    state.container.killAllRunningProcesses();
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
  const { host = "127.0.0.1", port = 18790 } = config;

  const app = await createGateway(config);

  try {
    await app.listen({ host, port });
    console.log(`[Gateway] Server running on http://${host}:${port}`);
    console.log("[Gateway] API endpoints:");
    console.log("  GET  /health - Health check");
    console.log("  GET  /api/agents - List agents");
    console.log("  GET  /api/tasks - List tasks");
    console.log("  GET  /api/sessions - List sessions");
    console.log("  GET  /api/cron - List cron jobs");
    console.log("  GET  /api/events - SSE event stream");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
