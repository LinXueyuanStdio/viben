/**
 * User proxy routes
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

function requireClient(ctx: ProxyContext, request: Record<string, unknown>): VibenClient {
  const token = extractToken(request);
  if (!token) throw new ApiError("Authentication required", 401);
  return new VibenClient({ baseUrl: ctx.baseUrl, apiKey: token, fetch: ctx.fetch });
}

export function registerUserProxyRoutes(
  fastify: FastifyInstance,
  ctx: ProxyContext,
): void {
  // GET /api/user/me
  fastify.get("/api/user/me", async (request, reply) => {
    try {
      const client = requireClient(ctx, request as unknown as Record<string, unknown>);
      return await client.user.me();
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // PATCH /api/user/me
  fastify.patch("/api/user/me", async (request, reply) => {
    try {
      const client = requireClient(ctx, request as unknown as Record<string, unknown>);
      return await client.user.update(request.body as Record<string, unknown> as {
        displayName?: string;
        bio?: string;
        websiteUrl?: string;
      });
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // GET /api/user/me/favorites
  fastify.get("/api/user/me/favorites", async (request, reply) => {
    try {
      const client = requireClient(ctx, request as unknown as Record<string, unknown>);
      return await client.user.favorites();
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // GET /api/user/me/api-keys
  fastify.get("/api/user/me/api-keys", async (request, reply) => {
    try {
      const client = requireClient(ctx, request as unknown as Record<string, unknown>);
      return await client.user.apiKeys();
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // POST /api/user/me/api-keys
  fastify.post("/api/user/me/api-keys", async (request, reply) => {
    try {
      const client = requireClient(ctx, request as unknown as Record<string, unknown>);
      return await client.user.createApiKey(request.body as Record<string, unknown> as {
        name: string;
        scopes?: string[];
        expiresIn?: number;
      });
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // DELETE /api/user/me/api-keys/:id
  fastify.delete<{ Params: { id: string } }>("/api/user/me/api-keys/:id", async (request, reply) => {
    try {
      const client = requireClient(ctx, request as unknown as Record<string, unknown>);
      return await client.user.deleteApiKey(request.params.id);
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // GET /api/user/:username — public profile
  fastify.get<{ Params: { username: string } }>("/api/user/:username", async (request, reply) => {
    try {
      const token = extractToken(request as unknown as Record<string, unknown>);
      return await new VibenClient({ baseUrl: ctx.baseUrl, apiKey: token, fetch: ctx.fetch })
        .user.profile(request.params.username);
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });
}
