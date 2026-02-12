/**
 * Health check route
 */
import type { FastifyInstance } from "fastify";

/**
 * Health check response
 */
export interface HealthResponse {
  status: "ok";
  version: string;
  timestamp: string;
}

/**
 * Register health routes
 */
export function registerHealthRoutes(fastify: FastifyInstance): void {
  fastify.get("/health", async () => {
    const response: HealthResponse = {
      status: "ok",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    };
    return response;
  });
}
