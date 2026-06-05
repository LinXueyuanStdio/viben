import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { ApiServerInstance } from './server.js';
import { requireScopes, requireRole } from './middleware/auth.js';

/**
 * The `api-server` service interface exposed to other plugins via ServiceRegistry.
 *
 * Other plugins (e.g. SSE adapter, tunnel plugin) use this to register their own
 * Fastify route plugins under the shared HTTP server without needing a direct
 * reference to the Fastify instance.
 */
export interface ApiServerService {
  /** Register a Fastify plugin at the given prefix, with optional auth bypass. */
  registerPlugin(prefix: string, plugin: FastifyPluginAsync, opts?: { auth?: boolean }): void;
  /** Pre-handler that validates Bearer/JWT auth — attach to routes that need custom auth. */
  authPreHandler: preHandlerHookHandler;
  /** Creates a pre-handler that requires all listed scopes. */
  requireScopes(...scopes: string[]): preHandlerHookHandler;
  /** Creates a pre-handler that requires a minimum role level. */
  requireRole(role: string): preHandlerHookHandler;
  getPort(): number;
  getBaseUrl(): string;
  /** Returns the public tunnel URL, or null if no tunnel is active. */
  getTunnelUrl(): string | null;
}

/**
 * Wraps an `ApiServerInstance` as a service object registered in the ServiceRegistry.
 *
 * The getPort/getBaseUrl/getTunnelUrl callbacks are evaluated lazily so callers always
 * get the current values (port is only known after the server starts listening).
 */
export function createApiServerService(
  server: ApiServerInstance,
  getPort: () => number,
  getBaseUrl: () => string,
  getTunnelUrl: () => string | null,
  authPreHandler: preHandlerHookHandler,
): ApiServerService {
  return {
    registerPlugin: server.registerPlugin.bind(server),
    authPreHandler,
    requireScopes,
    requireRole,
    getPort,
    getBaseUrl,
    getTunnelUrl,
  };
}
