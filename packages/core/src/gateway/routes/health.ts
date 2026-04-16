/**
 * Health check route
 */
import type { FastifyInstance } from "fastify";
import { homedir } from "node:os";
import { join } from "node:path";

// Injected by tsup at build time
declare const __VERSION__: string;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev";

/**
 * Gateway startup configuration (set at boot time)
 */
export interface GatewayStartupConfig {
  host: string;
  port: number;
  cors: boolean;
  started_at: string;
  pid: number;
  node_version: string;
  platform: string;
  arch: string;
  config_dir: string;
  state_dir: string;
  command: string;
}

// Startup config is set when gateway starts
let startupConfig: GatewayStartupConfig | null = null;
const gatewayStartTime = Date.now();

/**
 * Set the gateway startup configuration
 * Called from gateway/index.ts when server starts
 */
export function setGatewayStartupConfig(config: Partial<GatewayStartupConfig>): void {
  const vibenDir = join(homedir(), ".viben");
  startupConfig = {
    host: config.host || "127.0.0.1",
    port: config.port || 18790,
    cors: config.cors ?? true,
    started_at: new Date().toISOString(),
    pid: process.pid,
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    config_dir: vibenDir,
    state_dir: vibenDir,
    command: `viben gateway serve --host ${config.host || "127.0.0.1"} --port ${config.port || 18790}`,
  };
}

/**
 * Health check response (matching Rust gateway format)
 */
export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
  timestamp: string;
  uptime: string;
  uptime_seconds: number;
  startup?: GatewayStartupConfig;
}

/**
 * Register health routes
 */
export function registerHealthRoutes(fastify: FastifyInstance): void {
  fastify.get("/health", {
    schema: {
      description: "Health check endpoint",
      tags: ["health"],
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok"] },
            service: { type: "string" },
            version: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            uptime: { type: "string" },
            uptime_seconds: { type: "number" },
            startup: {
              type: "object",
              properties: {
                host: { type: "string" },
                port: { type: "number" },
                cors: { type: "boolean" },
                started_at: { type: "string", format: "date-time" },
                pid: { type: "number" },
                node_version: { type: "string" },
                platform: { type: "string" },
                arch: { type: "string" },
                config_dir: { type: "string" },
                state_dir: { type: "string" },
                command: { type: "string" },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const uptimeMs = Date.now() - gatewayStartTime;
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    const uptimeStr = hours > 0
      ? `${hours}h ${minutes}m ${seconds}s`
      : minutes > 0
        ? `${minutes}m ${seconds}s`
        : `${seconds}s`;

    const response: HealthResponse = {
      status: "ok",
      service: "viben-gateway",
      version: VERSION,
      timestamp: new Date().toISOString(),
      uptime: uptimeStr,
      uptime_seconds: uptimeSeconds,
      startup: startupConfig || undefined,
    };
    return response;
  });
}
