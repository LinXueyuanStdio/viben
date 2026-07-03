/**
 * Page publish proxy routes
 *
 * Proxies page publishing requests from the local gateway to the Viben Web platform.
 * Routes are backward-compatible with existing /api/page/publish paths.
 */
import type { FastifyInstance } from "fastify";
import { VibenClient, ApiError } from "../client";

interface ProxyContext {
  baseUrl: string;
  fetch: typeof fetch;
}

export function registerPagesProxyRoutes(
  fastify: FastifyInstance,
  ctx: ProxyContext,
): void {
  // POST /api/page/publish
  fastify.post("/api/page/publish", async (request, reply) => {
    const { access_token, uid, title, icon, description, html } = request.body as Record<string, unknown>;

    if (!access_token || !String(access_token).trim()) {
      reply.code(401);
      return { success: false, error: "access_token is required" };
    }

    if (!uid || !title || !html) {
      reply.code(400);
      return { success: false, error: "uid, title, and html are required" };
    }

    try {
      const client = new VibenClient({
        baseUrl: ctx.baseUrl,
        apiKey: String(access_token),
        fetch: ctx.fetch,
      });
      return await client.pages.publish({
        uid: String(uid),
        title: String(title),
        icon: icon as { type: string; value: string } | null | undefined,
        description: description as string | null | undefined,
        html: String(html),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        reply.code(error.status || 500);
        return { success: false, error: error.message, details: error.details };
      }
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to publish page",
      };
    }
  });

  // POST /api/page/publish-status
  fastify.post("/api/page/publish-status", async (request, reply) => {
    const { access_token, user_slug, uid } = request.body as Record<string, unknown>;

    if (!access_token || !String(access_token).trim()) {
      reply.code(401);
      return { success: false, error: "access_token is required" };
    }

    if (!user_slug || !uid) {
      reply.code(400);
      return { success: false, error: "user_slug and uid are required" };
    }

    try {
      const client = new VibenClient({
        baseUrl: ctx.baseUrl,
        apiKey: String(access_token),
        fetch: ctx.fetch,
      });
      return await client.pages.publishStatus(String(user_slug), String(uid));
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check publish status",
      };
    }
  });

  // POST /api/page/publish-history
  fastify.post("/api/page/publish-history", async (request, reply) => {
    const { access_token, uid } = request.body as Record<string, unknown>;

    if (!access_token || !String(access_token).trim()) {
      reply.code(401);
      return { success: false, error: "access_token is required" };
    }

    if (!uid || !String(uid).trim()) {
      reply.code(400);
      return { success: false, error: "uid is required" };
    }

    try {
      const client = new VibenClient({
        baseUrl: ctx.baseUrl,
        apiKey: String(access_token),
        fetch: ctx.fetch,
      });
      const result = await client.pages.publishHistory(String(uid));
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        reply.code(error.status || 500);
        return { success: false, error: error.message };
      }
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load publish history",
      };
    }
  });

  // POST /api/page/publish-version
  fastify.post("/api/page/publish-version", async (request, reply) => {
    const { access_token, uid, version } = request.body as Record<string, unknown>;

    if (!access_token || !String(access_token).trim()) {
      reply.code(401);
      return { success: false, error: "access_token is required" };
    }

    if (!uid || !version || !Number.isInteger(version)) {
      reply.code(400);
      return { success: false, error: "uid and version are required" };
    }

    try {
      const client = new VibenClient({
        baseUrl: ctx.baseUrl,
        apiKey: String(access_token),
        fetch: ctx.fetch,
      });
      const result = await client.pages.publishVersion(String(uid), version as number);
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        reply.code(error.status || 500);
        return { success: false, error: error.message };
      }
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load publish version",
      };
    }
  });

  // POST /api/page/publish-rollback
  fastify.post("/api/page/publish-rollback", async (request, reply) => {
    const { access_token, uid, version } = request.body as Record<string, unknown>;

    if (!access_token || !String(access_token).trim()) {
      reply.code(401);
      return { success: false, error: "access_token is required" };
    }

    if (!uid || !version || !Number.isInteger(version)) {
      reply.code(400);
      return { success: false, error: "uid and version are required" };
    }

    try {
      const client = new VibenClient({
        baseUrl: ctx.baseUrl,
        apiKey: String(access_token),
        fetch: ctx.fetch,
      });
      const result = await client.pages.publishRollback(String(uid), version as number);
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        reply.code(error.status || 500);
        return { success: false, error: error.message };
      }
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to rollback published page",
      };
    }
  });
}
