import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from './types.js';
import { requireScopes } from '../middleware/auth.js';

const NotifyBodySchema = z.object({
  message: z.string().min(1).max(4_000),
});

/**
 * Notification broadcast route under `/api/v1/notify`.
 *
 * `POST /` sends a system notification to all connected adapters (Telegram, Slack, etc.)
 * via the notification manager. Requires `sessions:write` scope.
 * Used by CLI tools and external integrations to push custom alerts to the operator.
 */
export async function notifyRoutes(
  app: FastifyInstance,
  deps: RouteDeps,
): Promise<void> {
  // POST /notify — send a notification to all adapters
  app.post('/', { preHandler: requireScopes('sessions:write') }, async (request, reply) => {
    const body = NotifyBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.issues[0]?.message ?? 'Invalid request' });
    }

    await deps.core.notificationManager.notifyAll({
      sessionId: 'system',
      type: 'completed',
      summary: body.data.message,
    });
    return { ok: true };
  });
}
