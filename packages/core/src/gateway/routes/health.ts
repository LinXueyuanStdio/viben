/**
 * Health check route
 */
import type { FastifyInstance } from "fastify";

/**
 * Health check response (matching Rust gateway format)
 */
export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
  timestamp: string;
  uptime: string;
}

/**
 * Register health routes
 */
export function registerHealthRoutes(fastify: FastifyInstance): void {
  fastify.get("/health", async () => {
    const response: HealthResponse = {
      status: "ok",
      service: "viben-gateway",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      uptime: "running",
    };
    return response;
  });
}
