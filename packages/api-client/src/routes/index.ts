/**
 * Viben Web Proxy Plugin
 *
 * Fastify plugin that registers proxy routes for the Viben Web platform API.
 * Each domain group gets its own semantic prefix (e.g. /api/page/, /api/mcp-market/).
 *
 * Uses fastify-plugin to share the parent Fastify instance's decorators (logger, telemetry).
 * Accepts `fetch` via options to avoid circular dependencies on packages/core.
 */
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { resolveWebUrl } from "../utils/config";
import { registerPagesProxyRoutes } from "./pages";
import { registerMcpMarketProxyRoutes } from "./mcp-market";
import { registerSkillMarketProxyRoutes } from "./skill-market";
import { registerUserProxyRoutes } from "./user";
import { registerCollectionsProxyRoutes } from "./collections";
import { registerAuthProxyRoutes } from "./auth";
import { registerVoiceProxyRoutes } from "./voice";

export interface WebProxyPluginOptions {
  /** Web API base URL, defaults to VIBEN_WEB_URL env or built-in constant */
  baseUrl?: string;
  /** Custom fetch function (for proxy support) */
  fetch?: typeof fetch;
}

async function webProxyPlugin(
  fastify: FastifyInstance,
  opts: WebProxyPluginOptions = {},
): Promise<void> {
  const baseUrl = resolveWebUrl(opts.baseUrl);
  const fetcher = opts.fetch ?? fetch;

  registerPagesProxyRoutes(fastify, { baseUrl, fetch: fetcher });
  registerMcpMarketProxyRoutes(fastify, { baseUrl, fetch: fetcher });
  registerSkillMarketProxyRoutes(fastify, { baseUrl, fetch: fetcher });
  registerUserProxyRoutes(fastify, { baseUrl, fetch: fetcher });
  registerCollectionsProxyRoutes(fastify, { baseUrl, fetch: fetcher });
  registerAuthProxyRoutes(fastify, { baseUrl, fetch: fetcher });
  registerVoiceProxyRoutes(fastify, { baseUrl, fetch: fetcher });
}

export default fp(webProxyPlugin, { name: "viben-web-proxy" });
