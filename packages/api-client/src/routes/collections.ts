/**
 * Collections proxy routes
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

function createClient(ctx: ProxyContext, token?: string): VibenClient {
  return new VibenClient({ baseUrl: ctx.baseUrl, apiKey: token, fetch: ctx.fetch });
}

function requireToken(request: Record<string, unknown>): string {
  const token = extractToken(request);
  if (!token) throw new ApiError("Authentication required", 401);
  return token;
}

export function registerCollectionsProxyRoutes(
  fastify: FastifyInstance,
  ctx: ProxyContext,
): void {
  // GET /api/collections
  fastify.get("/api/collections", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    return createClient(ctx, extractToken(request as unknown as Record<string, unknown>))
      .collections.list({
        page: query?.page ? Number(query.page) : undefined,
        limit: query?.limit ? Number(query.limit) : undefined,
        entityType: query?.entityType as "mcp" | "skill" | undefined,
        userId: query?.userId,
      });
  });

  // POST /api/collections
  fastify.post("/api/collections", async (request, reply) => {
    try {
      const token = requireToken(request as unknown as Record<string, unknown>);
      return await createClient(ctx, token).collections.create(
        request.body as Record<string, unknown> as {
          name: string;
          description?: string;
          entityType: "mcp" | "skill";
          isPublic?: boolean;
        }
      );
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // GET /api/collections/:id
  fastify.get<{ Params: { id: string } }>("/api/collections/:id", async (request, reply) => {
    try {
      return await createClient(ctx, extractToken(request as unknown as Record<string, unknown>))
        .collections.get(request.params.id);
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // PATCH /api/collections/:id
  fastify.patch<{ Params: { id: string } }>("/api/collections/:id", async (request, reply) => {
    try {
      const token = requireToken(request as unknown as Record<string, unknown>);
      return await createClient(ctx, token).collections.update(request.params.id, request.body as Record<string, unknown> as {
        name?: string; description?: string; isPublic?: boolean;
      });
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // DELETE /api/collections/:id
  fastify.delete<{ Params: { id: string } }>("/api/collections/:id", async (request, reply) => {
    try {
      const token = requireToken(request as unknown as Record<string, unknown>);
      return await createClient(ctx, token).collections.delete(request.params.id);
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // POST /api/collections/:id/items
  fastify.post<{ Params: { id: string } }>("/api/collections/:id/items", async (request, reply) => {
    try {
      const token = requireToken(request as unknown as Record<string, unknown>);
      const { entityId, note } = request.body as Record<string, unknown>;
      return await createClient(ctx, token).collections.addItem(
        request.params.id, String(entityId), note as string | undefined
      );
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // DELETE /api/collections/:id/items/:eid
  fastify.delete<{ Params: { id: string; eid: string } }>(
    "/api/collections/:id/items/:eid",
    async (request, reply) => {
      try {
        const token = requireToken(request as unknown as Record<string, unknown>);
        return await createClient(ctx, token).collections.removeItem(request.params.id, request.params.eid);
      } catch (error) {
        if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
        throw error;
      }
    }
  );

  // POST /api/collections/:id/fork
  fastify.post<{ Params: { id: string } }>("/api/collections/:id/fork", async (request, reply) => {
    try {
      const token = requireToken(request as unknown as Record<string, unknown>);
      return await createClient(ctx, token).collections.fork(request.params.id);
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // POST /api/collections/:id/favorite
  fastify.post<{ Params: { id: string } }>("/api/collections/:id/favorite", async (request, reply) => {
    try {
      const token = requireToken(request as unknown as Record<string, unknown>);
      return await createClient(ctx, token).collections.toggleFavorite(request.params.id);
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // GET /api/collections/:id/comments
  fastify.get<{ Params: { id: string } }>("/api/collections/:id/comments", async (request, reply) => {
    try {
      return await createClient(ctx, extractToken(request as unknown as Record<string, unknown>))
        .collections.comments(request.params.id);
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // POST /api/collections/:id/comments
  fastify.post<{ Params: { id: string } }>("/api/collections/:id/comments", async (request, reply) => {
    try {
      const token = requireToken(request as unknown as Record<string, unknown>);
      const { content } = request.body as Record<string, unknown>;
      if (!content) { reply.code(400); return { error: "content is required" }; }
      return await createClient(ctx, token).collections.addComment(request.params.id, String(content));
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });
}
