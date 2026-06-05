import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from './types.js';
import { requireScopes } from '../middleware/auth.js';
import { ExecuteCommandBodySchema } from '../schemas/commands.js';

/**
 * Command routes under `/api/v1/commands`.
 *
 * `GET /` lists all registered chat commands (plugin commands included).
 * `POST /execute` dispatches a command through the CommandRegistry with `channelId: 'api'`
 * so the result can be returned synchronously to the HTTP caller rather than routed
 * back to a messaging adapter.
 *
 * Requires `commands:execute` scope.
 */
export async function commandRoutes(
  app: FastifyInstance,
  deps: RouteDeps,
): Promise<void> {
  // GET /commands — list all registered commands
  app.get('/', { preHandler: requireScopes('commands:execute') }, async () => {
    if (!deps.commandRegistry) {
      return { commands: [] };
    }
    const commands = deps.commandRegistry.getAll().map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      usage: cmd.usage ?? null,
      category: cmd.category,
      pluginName: cmd.pluginName ?? null,
    }));
    return { commands };
  });

  // POST /commands/execute — execute a command
  app.post('/execute', { preHandler: requireScopes('commands:execute') }, async (request, reply) => {
    if (!deps.commandRegistry) {
      return reply.status(501).send({ error: 'Command registry not available' });
    }

    const body = ExecuteCommandBodySchema.parse(request.body);

    // Prefix with / if not present (command registry expects /commandname)
    const commandString = body.command.startsWith('/')
      ? body.command
      : `/${body.command}`;

    const result = await deps.commandRegistry.execute(commandString, {
      raw: '',
      sessionId: body.sessionId ?? null,
      channelId: 'api',
      userId: (request as any).auth?.tokenId ?? 'api',
      reply: async () => {},
    });

    return { result };
  });
}
