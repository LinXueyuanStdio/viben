/**
 * Integration tests for the Viben Web Proxy Plugin.
 *
 * Verifies plugin registration, route existence (no 404s), and auth gating.
 * Full route behavior (200 responses, body shape, error propagation) is
 * tested in api-client's own test suite: src/routes/*.test.ts (96 tests).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import webProxyPlugin from "@viben/api-client/routes";

describe("Web Proxy Plugin Integration", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    // Use a mock fetch that returns a controlled response for non-auth routes
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    await app.register(webProxyPlugin, { fetch: mockFetch as any });
    await app.ready();
  });

  afterEach(async () => { await app.close(); });

  it("registers plugin without errors", () => {
    expect(app).toBeDefined();
  });

  describe("Route registration smoke tests", () => {
    const routes = [
      { method: "GET", url: "/api/mcp-market", desc: "MCP market list" },
      { method: "GET", url: "/api/mcp-market/search?q=test", desc: "MCP search" },
      { method: "GET", url: "/api/mcp-market/categories", desc: "MCP categories" },
      { method: "GET", url: "/api/mcp-market/test-id", desc: "MCP get by id" },
      { method: "GET", url: "/api/skill-market", desc: "skill market list" },
      { method: "GET", url: "/api/skill-market/search?q=test", desc: "skill search" },
      { method: "GET", url: "/api/skill-market/categories", desc: "skill categories" },
      { method: "GET", url: "/api/collections", desc: "collections list" },
      { method: "GET", url: "/api/collections/test-id", desc: "collections get" },
      { method: "GET", url: "/api/collections/test-id/comments", desc: "collection comments" },
      { method: "GET", url: "/api/user/testuser", desc: "user public profile" },
      { method: "GET", url: "/api/auth/github?redirect_uri=test", desc: "OAuth URL" },
    ];

    for (const { method, url, desc } of routes) {
      it(`${method} ${url} — ${desc}`, async () => {
        const res = await app.inject({ method: method as any, url });
        // Route exists (not 404). No mock VibenClient so 500 is expected,
        // but 404 means the route wasn't registered at all.
        expect(res.statusCode).not.toBe(404);
      });
    }
  });

  describe("Page publish proxy routes", () => {
    it("POST /api/page/publish returns 401 with empty token", async () => {
      const res = await app.inject({
        method: "POST", url: "/api/page/publish",
        payload: { access_token: "", uid: "abc", title: "Test", html: "<h1>Test</h1>" },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe("access_token is required");
    });

    it("POST /api/page/publish-status returns 401 with empty token", async () => {
      const res = await app.inject({
        method: "POST", url: "/api/page/publish-status",
        payload: { access_token: "  ", user_slug: "user", uid: "abc" },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe("access_token is required");
    });

    it("POST /api/page/publish-history returns 401 with empty token", async () => {
      const res = await app.inject({
        method: "POST", url: "/api/page/publish-history",
        payload: { access_token: "", uid: "abc" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("POST /api/page/publish-version returns 401 with empty token", async () => {
      const res = await app.inject({
        method: "POST", url: "/api/page/publish-version",
        payload: { access_token: " ", uid: "abc", version: 1 },
      });
      expect(res.statusCode).toBe(401);
    });

    it("POST /api/page/publish-rollback returns 401 with empty token", async () => {
      const res = await app.inject({
        method: "POST", url: "/api/page/publish-rollback",
        payload: { access_token: "", uid: "abc", version: 1 },
      });
      expect(res.statusCode).toBe(401);
    });

    it("POST /api/page/publish returns 400 when fields missing", async () => {
      const res = await app.inject({
        method: "POST", url: "/api/page/publish",
        payload: { access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("Auth-gated routes return 401 with error body", () => {
    const authRoutes = [
      { method: "GET", url: "/api/user/me", desc: "user me" },
      { method: "POST", url: "/api/user/me/api-keys", payload: { name: "test" }, desc: "create api key" },
      { method: "DELETE", url: "/api/user/me/api-keys/k1", desc: "delete api key" },
      { method: "POST", url: "/api/voice/token", payload: { api_key: "key", agent_id: "a1" }, desc: "voice token" },
      { method: "POST", url: "/api/mcp-market/test-id/favorite", desc: "mcp favorite" },
      { method: "POST", url: "/api/mcp-market/test-id/rating", payload: { score: 4 }, desc: "mcp rate" },
      { method: "POST", url: "/api/skill-market/test-id/favorite", desc: "skill favorite" },
      { method: "POST", url: "/api/collections", payload: { name: "Test", entityType: "mcp" }, desc: "create collection" },
      { method: "POST", url: "/api/collections/test-id/fork", desc: "fork collection" },
      { method: "POST", url: "/api/collections/test-id/favorite", desc: "collection favorite" },
    ];

    for (const { method, url, payload, desc } of authRoutes) {
      it(`${method} ${url} — ${desc}`, async () => {
        const res = await app.inject({
          method: method as any, url,
          ...(payload ? { payload } : {}),
        });
        expect(res.statusCode).toBe(401);
        const body = JSON.parse(res.body);
        expect(body.error).toBeTruthy();
      });
    }
  });
});
