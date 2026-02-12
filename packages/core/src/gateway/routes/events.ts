/**
 * SSE Events route
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import type { AppState } from "../state";

/**
 * Register SSE events route
 */
export function registerEventsRoutes(fastify: FastifyInstance, state: AppState): void {
  // SSE event stream
  fastify.get("/api/events", async (request, reply) => {
    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send initial connection event
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

    // Subscribe to events
    const unsubscribe = state.events.subscribe((event) => {
      try {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
      } catch {
        // Connection closed
        unsubscribe();
      }
    });

    // Subscribe to JSON patches
    const unsubscribePatch = state.events.subscribePatch((patch) => {
      try {
        reply.raw.write(`event: json_patch\ndata: ${JSON.stringify(patch)}\n\n`);
      } catch {
        // Connection closed
        unsubscribePatch();
      }
    });

    // Handle client disconnect
    request.raw.on("close", () => {
      unsubscribe();
      unsubscribePatch();
    });

    // Keep connection open
    await new Promise<void>((resolve) => {
      request.raw.on("close", resolve);
    });
  });

  // JSON Patch stream (alternative endpoint)
  fastify.get("/api/patches", async (request, reply) => {
    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send initial connection event
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

    // Subscribe to patches only
    const unsubscribe = state.events.subscribePatch((patch) => {
      try {
        reply.raw.write(`event: patch\ndata: ${JSON.stringify(patch)}\n\n`);
      } catch {
        // Connection closed
        unsubscribe();
      }
    });

    // Handle client disconnect
    request.raw.on("close", () => {
      unsubscribe();
    });

    // Keep connection open
    await new Promise<void>((resolve) => {
      request.raw.on("close", resolve);
    });
  });
}
