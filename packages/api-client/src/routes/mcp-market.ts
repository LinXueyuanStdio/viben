/**
 * MCP Marketplace proxy routes
 *
 * Proxies MCP marketplace API calls through the local gateway.
 * Public endpoints (list, search, get, categories, comments) work without auth.
 * Mutation endpoints (favorite, rate, comment) require authentication.
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
  return new VibenClient({
    baseUrl: ctx.baseUrl,
    apiKey: token,
    fetch: ctx.fetch,
  });
}

export function registerMcpMarketProxyRoutes(
  fastify: FastifyInstance,
  ctx: ProxyContext,
): void {
  // GET /api/mcp-market — list packages
  fastify.get("/api/mcp-market", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const token = extractToken(request as unknown as Record<string, unknown>);
    const client = createClient(ctx, token);
    try {
      return await client.mcp.list({
        page: query?.page ? Number(query.page) : undefined,
        limit: query?.limit ? Number(query.limit) : undefined,
        sort: query?.sort as "latest" | "popular" | "downloads" | undefined,
        category: query?.category,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        return { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      }
      throw error;
    }
  });

  // GET /api/mcp-market/search
  fastify.get("/api/mcp-market/search", async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const q = query?.q;
    if (!q) {
      reply.code(400);
      return { error: "q parameter is required" };
    }
    const token = extractToken(request as unknown as Record<string, unknown>);
    const client = createClient(ctx, token);
    try {
      return await client.mcp.search(q, {
        page: query?.page ? Number(query.page) : undefined,
        limit: query?.limit ? Number(query.limit) : undefined,
        sort: query?.sort as "latest" | "popular" | "downloads" | undefined,
        category: query?.category,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        reply.code(error.status || 500);
        return { error: error.message };
      }
      throw error;
    }
  });

  // GET /api/mcp-market/categories
  fastify.get("/api/mcp-market/categories", async () => {
    return createClient(ctx).mcp.categories();
  });

  // GET /api/mcp-market/:id
  fastify.get<{ Params: { id: string } }>("/api/mcp-market/:id", async (request, reply) => {
    const token = extractToken(request as unknown as Record<string, unknown>);
    const client = createClient(ctx, token);
    try {
      return await client.mcp.get(request.params.id);
    } catch (error) {
      if (error instanceof ApiError) {
        reply.code(error.status || 500);
        return { error: error.message };
      }
      throw error;
    }
  });

  // GET /api/mcp-market/:id/download — stream download
  fastify.get<{ Params: { id: string } }>("/api/mcp-market/:id/download", async (request, reply) => {
    const token = extractToken(request as unknown as Record<string, unknown>);
    const query = request.query as Record<string, string | undefined>;
    try {
      const client = createClient(ctx, token);
      const blob = await client.mcp.download(request.params.id, query?.version);
      const arrayBuffer = await blob.arrayBuffer();
      reply.type("application/octet-stream");
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof ApiError) {
        reply.code(error.status || 500);
        return { error: error.message };
      }
      throw error;
    }
  });

  // POST /api/mcp-market/:id/favorite
  fastify.post<{ Params: { id: string } }>("/api/mcp-market/:id/favorite", async (request, reply) => {
    const token = extractToken(request as unknown as Record<string, unknown>);
    if (!token) {
      reply.code(401);
      return { error: "Authentication required" };
    }
    try {
      return await createClient(ctx, token).mcp.toggleFavorite(request.params.id);
    } catch (error) {
      if (error instanceof ApiError) {
        reply.code(error.status || 500);
        return { error: error.message };
      }
      throw error;
    }
  });

  // GET /api/mcp-market/:id/comments
  fastify.get<{ Params: { id: string } }>("/api/mcp-market/:id/comments", async (request, reply) => {
    const token = extractToken(request as unknown as Record<string, unknown>);
    try {
      return await createClient(ctx, token).mcp.comments(request.params.id);
    } catch (error) {
      if (error instanceof ApiError) {
        reply.code(error.status || 500);
        return { error: error.message };
      }
      throw error;
    }
  });

  // POST /api/mcp-market/:id/comments
  fastify.post<{ Params: { id: string } }>("/api/mcp-market/:id/comments", async (request, reply) => {
    const token = extractToken(request as unknown as Record<string, unknown>);
    if (!token) {
      reply.code(401);
      return { error: "Authentication required" };
    }
    const { content, parentId } = request.body as Record<string, unknown>;
    if (!content) {
      reply.code(400);
      return { error: "content is required" };
    }
    try {
      return await createClient(ctx, token).mcp.addComment(request.params.id, String(content), parentId as string | undefined);
    } catch (error) {
      if (error instanceof ApiError) {
        reply.code(error.status || 500);
        return { error: error.message };
      }
      throw error;
    }
  });

  // POST /api/mcp-market/:id/rating
  fastify.post<{ Params: { id: string } }>("/api/mcp-market/:id/rating", async (request, reply) => {
    const token = extractToken(request as unknown as Record<string, unknown>);
    if (!token) {
      reply.code(401);
      return { error: "Authentication required" };
    }
    const { score } = request.body as Record<string, unknown>;
    if (!score || typeof score !== "number" || score < 1 || score > 5) {
      reply.code(400);
      return { error: "score must be a number 1-5" };
    }
    try {
      return await createClient(ctx, token).mcp.rate(request.params.id, score);
    } catch (error) {
      if (error instanceof ApiError) {
        reply.code(error.status || 500);
        return { error: error.message };
      }
      throw error;
    }
  });
}
