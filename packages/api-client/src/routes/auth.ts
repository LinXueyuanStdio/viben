/**
 * Authentication proxy routes
 *
 * Pass-through proxy for auth endpoints to the Viben Web platform.
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
  return undefined;
}

export function registerAuthProxyRoutes(
  fastify: FastifyInstance,
  ctx: ProxyContext,
): void {
  // POST /api/auth/login
  fastify.post("/api/auth/login", async (request, reply) => {
    try {
      const client = new VibenClient({ baseUrl: ctx.baseUrl, fetch: ctx.fetch });
      const body = request.body as { email: string; password: string };
      return await client.auth.login(body);
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // POST /api/auth/register
  fastify.post("/api/auth/register", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const response = await ctx.fetch(`${ctx.baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      reply.code(response.status);
      return response.json();
    } catch {
      reply.code(500);
      return { error: "Failed to register" };
    }
  });

  // GET /api/auth/:provider — OAuth URL
  fastify.get<{ Params: { provider: string } }>("/api/auth/:provider", async (request, reply) => {
    try {
      const query = request.query as Record<string, string | undefined>;
      const client = new VibenClient({ baseUrl: ctx.baseUrl, fetch: ctx.fetch });
      const url = client.auth.getOAuthUrl(request.params.provider as "github" | "google", {
        redirectUri: query?.redirect_uri || "",
        client: query?.client as "desktop" | "web" | "cli" | undefined,
        state: query?.state,
      });
      return { url };
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // POST /api/auth/callback/:provider
  fastify.post<{ Params: { provider: string } }>("/api/auth/callback/:provider", async (request, reply) => {
    try {
      const { code } = request.body as { code: string };
      const client = new VibenClient({ baseUrl: ctx.baseUrl, fetch: ctx.fetch });
      return await client.auth.handleOAuthCallback(request.params.provider as "github" | "google", code);
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // POST /api/auth/refresh
  fastify.post("/api/auth/refresh", async (request, reply) => {
    try {
      const { refreshToken } = request.body as { refreshToken: string };
      const client = new VibenClient({ baseUrl: ctx.baseUrl, fetch: ctx.fetch });
      return await client.auth.refresh(refreshToken);
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // POST /api/auth/validate
  fastify.post("/api/auth/validate", async (request, reply) => {
    try {
      const token = extractToken(request as unknown as Record<string, unknown>);
      const client = new VibenClient({ baseUrl: ctx.baseUrl, apiKey: token, fetch: ctx.fetch });
      return await client.auth.validate();
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });

  // POST /api/auth/logout
  fastify.post("/api/auth/logout", async (request, reply) => {
    try {
      const token = extractToken(request as unknown as Record<string, unknown>);
      const client = new VibenClient({ baseUrl: ctx.baseUrl, apiKey: token, fetch: ctx.fetch });
      await client.auth.logout();
      return { success: true };
    } catch (error) {
      if (error instanceof ApiError) { reply.code(error.status || 500); return { error: error.message }; }
      throw error;
    }
  });
}
