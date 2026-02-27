/**
 * Tunnel routes
 *
 * Provides HTTP API for managing cloudflared tunnels.
 * Used for exposing local gateway to the internet for webhook configuration.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  getTunnelService,
  isCloudflaredAvailable,
  type TunnelState,
} from "../../services/tunnel";

/**
 * Register tunnel routes
 */
export function registerTunnelRoutes(fastify: FastifyInstance): void {
  const tunnelService = getTunnelService();

  // Get tunnel status
  fastify.get("/api/tunnel/status", async (): Promise<TunnelState & { available: boolean }> => {
    const available = await isCloudflaredAvailable();
    const state = tunnelService.getState();
    return { ...state, available };
  });

  // Start tunnel
  fastify.post(
    "/api/tunnel/start",
    async (
      request: FastifyRequest<{ Body: { port?: number } }>,
      reply: FastifyReply
    ) => {
      const { port = 18790 } = request.body || {};

      try {
        // Check if cloudflared is available
        const available = await isCloudflaredAvailable();
        if (!available) {
          reply.code(503);
          return {
            success: false,
            error: "cloudflared is not available. Please install it first.",
          };
        }

        const url = await tunnelService.start(port);
        return {
          success: true,
          url,
          state: tunnelService.getState(),
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        reply.code(500);
        return {
          success: false,
          error: errorMsg,
          state: tunnelService.getState(),
        };
      }
    }
  );

  // Stop tunnel
  fastify.post("/api/tunnel/stop", async () => {
    tunnelService.stop();
    return {
      success: true,
      state: tunnelService.getState(),
    };
  });

  // Restart tunnel
  fastify.post(
    "/api/tunnel/restart",
    async (
      request: FastifyRequest<{ Body: { port?: number } }>,
      reply: FastifyReply
    ) => {
      const { port } = request.body || {};

      try {
        const url = await tunnelService.restart();
        return {
          success: true,
          url,
          state: tunnelService.getState(),
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        reply.code(500);
        return {
          success: false,
          error: errorMsg,
          state: tunnelService.getState(),
        };
      }
    }
  );
}
