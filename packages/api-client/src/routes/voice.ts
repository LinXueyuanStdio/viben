/**
 * Voice token proxy routes
 */
import type { FastifyInstance } from "fastify";
import { VibenClient, ApiError } from "../client";

interface ProxyContext {
  baseUrl: string;
  fetch: typeof fetch;
}

function extractToken(request: Record<string, unknown>): string | undefined {
  const headers = request.headers as Record<string, string | undefined> | undefined;
  const auth = headers?.authorization || headers?.Authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const query = request.query as Record<string, string | undefined> | undefined;
  if (query?.access_token) return query.access_token;
  const body = request.body as Record<string, unknown> | undefined;
  if (body?.access_token) return String(body.access_token);
  return undefined;
}

export function registerVoiceProxyRoutes(
  fastify: FastifyInstance,
  ctx: ProxyContext,
): void {
  // POST /api/voice/token
  fastify.post("/api/voice/token", async (request, reply) => {
    const token = extractToken(request as unknown as Record<string, unknown>);
    if (!token) {
      reply.code(401);
      return { error: "Authentication required" };
    }

    try {
      const client = new VibenClient({ baseUrl: ctx.baseUrl, apiKey: token, fetch: ctx.fetch });
      return await client.voice.getToken(
        request.body as { api_key: string; agent_id: string; participant_name?: string }
      );
    } catch (error) {
      if (error instanceof ApiError) {
        reply.code(error.status || 500);
        return { error: error.message };
      }
      throw error;
    }
  });
}
