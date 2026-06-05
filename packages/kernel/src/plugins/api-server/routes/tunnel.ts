import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from './types.js';
import { requireScopes } from '../middleware/auth.js';

const AddTunnelBodySchema = z.object({
  port: z.number().int().min(1).max(65535),
  label: z.string().max(200).optional(),
  sessionId: z.string().max(200).optional(),
});

/**
 * Tunnel management routes under `/api/v1/tunnel`.
 *
 * Read operations (status, list) require `system:health` scope.
 * Mutations (add, stop) require `system:admin` scope.
 * All routes return 400 if the tunnel service is not enabled.
 */
export async function tunnelRoutes(
  app: FastifyInstance,
  deps: RouteDeps,
): Promise<void> {
  // GET /tunnel — get tunnel status
  app.get('/', { preHandler: requireScopes('system:health') }, async () => {
    const tunnel = deps.core.tunnelService;
    if (tunnel) {
      return {
        enabled: true,
        url: tunnel.getPublicUrl(),
        provider: 'cloudflare',
      };
    }
    return { enabled: false };
  });

  // GET /tunnel/list — list all active tunnels
  app.get('/list', { preHandler: requireScopes('system:health') }, async () => {
    const tunnel = deps.core.tunnelService;
    if (!tunnel) {
      return [];
    }
    return tunnel.listTunnels();
  });

  // POST /tunnel — add a new tunnel
  app.post('/', { preHandler: requireScopes('system:admin') }, async (request, reply) => {
    const tunnel = deps.core.tunnelService;
    if (!tunnel) {
      return reply
        .status(400)
        .send({ error: 'Tunnel service is not enabled' });
    }

    const parsed = AddTunnelBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
    }
    const body = parsed.data;

    try {
      const entry = await tunnel.addTunnel(body.port, {
        label: body.label,
        sessionId: body.sessionId,
      });
      return entry;
    } catch (err) {
      return reply
        .status(400)
        .send({ error: (err as Error).message });
    }
  });

  // DELETE /tunnel/:port — stop a specific tunnel
  app.delete<{ Params: { port: string } }>('/:port', { preHandler: requireScopes('system:admin') }, async (request, reply) => {
    const tunnel = deps.core.tunnelService;
    if (!tunnel) {
      return reply
        .status(400)
        .send({ error: 'Tunnel service is not enabled' });
    }
    const port = parseInt(request.params.port, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return reply.status(400).send({ error: 'port must be an integer between 1 and 65535' });
    }
    try {
      await tunnel.stopTunnel(port);
      return { ok: true };
    } catch (err) {
      return reply
        .status(400)
        .send({ error: (err as Error).message });
    }
  });

  // DELETE /tunnel — stop all user tunnels
  app.delete('/', { preHandler: requireScopes('system:admin') }, async (_request, reply) => {
    const tunnel = deps.core.tunnelService;
    if (!tunnel) {
      return reply
        .status(400)
        .send({ error: 'Tunnel service is not enabled' });
    }
    const count = tunnel.listTunnels().length;
    await tunnel.stopAllUser();
    return { ok: true, stopped: count };
  });
}
