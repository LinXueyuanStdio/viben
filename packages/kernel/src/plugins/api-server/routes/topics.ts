import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from './types.js';
import { requireScopes } from '../middleware/auth.js';
import { SessionIdParamSchema } from '../schemas/sessions.js';

const VALID_TOPIC_STATUSES = ['active', 'finished', 'cancelled', 'error', 'archived'] as const;

const TopicCleanupBodySchema = z.object({
  statuses: z.array(z.enum(VALID_TOPIC_STATUSES)).optional(),
});

/**
 * Telegram topic management routes under `/api/v1/topics`.
 *
 * Topics are Telegram forum threads created per session. These routes let the App
 * UI manage topic lifecycle without going through the Telegram adapter directly.
 * All routes require `sessions:write` scope and return 501 if no topic manager is loaded.
 *
 * `DELETE /:sessionId` with `?force=true` bypasses the active-session confirmation gate.
 */
export async function topicRoutes(
  app: FastifyInstance,
  deps: RouteDeps,
): Promise<void> {
  // GET /topics — list topics with optional status filter
  app.get<{ Querystring: { status?: string } }>('/', { preHandler: requireScopes('sessions:write') }, async (request, reply) => {
    if (!deps.topicManager) {
      return reply
        .status(501)
        .send({ error: 'Topic management not available' });
    }
    const statusParam = (request.query as Record<string, string>).status;
    let filter: { statuses: string[] } | undefined
    if (statusParam) {
      const parsed = statusParam.split(',').map(s => s.trim())
      const valid = parsed.filter(s => (VALID_TOPIC_STATUSES as readonly string[]).includes(s))
      filter = valid.length > 0 ? { statuses: valid } : undefined
    }
    const topics = deps.topicManager.listTopics(filter);
    return { topics };
  });

  // POST /topics/cleanup — cleanup topics by status
  app.post('/cleanup', { preHandler: requireScopes('sessions:write') }, async (request, reply) => {
    if (!deps.topicManager) {
      return reply
        .status(501)
        .send({ error: 'Topic management not available' });
    }
    const body = TopicCleanupBodySchema.parse(request.body ?? {});
    const result = await deps.topicManager.cleanup(body.statuses);
    return result;
  });

  // DELETE /topics/:sessionId — delete a topic
  app.delete<{ Params: { sessionId: string }; Querystring: { force?: string } }>(
    '/:sessionId',
    { preHandler: requireScopes('sessions:write') },
    async (request, reply) => {
      if (!deps.topicManager) {
        return reply
          .status(501)
          .send({ error: 'Topic management not available' });
      }
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const force =
        (request.query as Record<string, string>).force === 'true';
      const result = await deps.topicManager.deleteTopic(
        sessionId,
        force ? { confirmed: true } : undefined,
      );
      if (result.ok) {
        return result;
      } else if (result.needsConfirmation) {
        return reply.status(409).send({
          error: 'Session is active',
          needsConfirmation: true,
          session: result.session,
        });
      } else if (result.error === 'Cannot delete system topic') {
        return reply.status(403).send({ error: result.error });
      } else {
        return reply
          .status(404)
          .send({ error: result.error ?? 'Not found' });
      }
    },
  );
}
