import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from './types.js';
import { requireScopes } from '../middleware/auth.js';

/**
 * System routes for health, version, restart, and adapters.
 *
 * This route group is registered with { auth: false } so health can be public.
 * Individual sensitive routes add auth + scope checks via preHandler.
 */
export async function systemRoutes(
  app: FastifyInstance,
  deps: RouteDeps,
): Promise<void> {
  const authPreHandler = deps.authPreHandler;

  // GET /system/health — basic liveness check (public, no auth required).
  // Sensitive details (memory, adapters, session counts) are omitted intentionally:
  // the tunnel exposes this endpoint to the internet, so leaking internal topology
  // or session counts would aid reconnaissance.
  // instanceId is included so callers (e.g. `instances list`) can verify this response
  // belongs to the expected instance and not an unrelated process on the same port.
  app.get('/health', async () => {
    return {
      status: 'ok',
      instanceId: deps.instanceId,
      uptime: Date.now() - deps.startedAt,
      version: deps.getVersion(),
    };
  });

  // GET /system/health/details — full health info (requires auth + system:health scope)
  app.get('/health/details', {
    preHandler: [...(authPreHandler ? [authPreHandler] : []), requireScopes('system:health')],
  }, async () => {
    const activeSessions = deps.core.sessionManager.listSessions();
    const allRecords = deps.core.sessionManager.listRecords();
    const mem = process.memoryUsage();
    const tunnel = deps.core.tunnelService;

    return {
      status: 'ok',
      uptime: Date.now() - deps.startedAt,
      version: deps.getVersion(),
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
      },
      sessions: {
        active: activeSessions.filter(
          (s) => s.status === 'active' || s.status === 'initializing',
        ).length,
        total: allRecords.length,
      },
      adapters: Array.from(deps.core.adapters.keys()),
      tunnel: tunnel
        ? { enabled: true, url: tunnel.getPublicUrl() }
        : { enabled: false },
    };
  });

  // GET /system/version — get version (requires auth + system:health scope)
  app.get('/version', {
    preHandler: [...(authPreHandler ? [authPreHandler] : []), requireScopes('system:health')],
  }, async () => {
    return { version: deps.getVersion() };
  });

  // POST /system/restart — request a graceful restart (requires auth + system:admin scope)
  app.post('/restart', {
    preHandler: [...(authPreHandler ? [authPreHandler] : []), requireScopes('system:admin')],
  }, async (_request, reply) => {
    if (!deps.core.requestRestart) {
      return reply.status(501).send({ error: 'Restart not available' });
    }

    // Send response before restarting
    const response = { ok: true, message: 'Restarting...' };
    setImmediate(() => deps.core.requestRestart!());
    return response;
  });

  // GET /system/adapters — list connected adapters (requires auth + system:health scope)
  app.get('/adapters', {
    preHandler: [...(authPreHandler ? [authPreHandler] : []), requireScopes('system:health')],
  }, async () => {
    const adapters = Array.from(deps.core.adapters.entries()).map(
      ([name]) => ({
        name,
        type: 'built-in' as const,
      }),
    );
    return { adapters };
  });
}
