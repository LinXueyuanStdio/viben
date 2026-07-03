import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerUserProxyRoutes } from "./user";

const mocks = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;
    constructor(msg: string, s: number) {
      super(msg);
      this.name = "ApiError";
      this.status = s;
    }
  }
  return {
    MockApiError,
    me: vi.fn(), update: vi.fn(), favorites: vi.fn(), apiKeys: vi.fn(),
    createApiKey: vi.fn(), deleteApiKey: vi.fn(), profile: vi.fn(), fetch: vi.fn(),
  };
});

vi.mock("../client", () => ({
  VibenClient: class {
    constructor(_config: unknown) {}
    get user() {
      return {
        me: mocks.me, update: mocks.update, favorites: mocks.favorites,
        apiKeys: mocks.apiKeys, createApiKey: mocks.createApiKey,
        deleteApiKey: mocks.deleteApiKey, profile: mocks.profile,
      };
    }
  },
  ApiError: mocks.MockApiError,
}));

const TOKEN = "bmcp_12345678_abcdefghijklmnopqrstuvwx";

describe("User Proxy Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    registerUserProxyRoutes(app, { baseUrl: "https://test.example.com", fetch: mocks.fetch as any });
    await app.ready();
  });

  afterEach(async () => { await app.close(); });

  describe("GET /api/user/me", () => {
    it("returns user when authenticated", async () => {
      mocks.me.mockResolvedValue({ user: { id: "1", username: "test", email: "test@test.com" } });
      const res = await app.inject({
        method: "GET", url: "/api/user/me",
        headers: { authorization: `Bearer ${TOKEN}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.username).toBe("test");
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "GET", url: "/api/user/me" });
      expect(res.statusCode).toBe(401);
    });

    it("extracts token from query param", async () => {
      mocks.me.mockResolvedValue({ user: { id: "1", username: "q", email: "q@t.com" } });
      const res = await app.inject({ method: "GET", url: `/api/user/me?access_token=${TOKEN}` });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PATCH /api/user/me", () => {
    it("updates profile with displayName", async () => {
      mocks.update.mockResolvedValue({ user: { id: "1", username: "test", displayName: "Updated" } });
      const res = await app.inject({
        method: "PATCH", url: "/api/user/me",
        headers: { authorization: `Bearer ${TOKEN}` },
        payload: { displayName: "Updated" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.displayName).toBe("Updated");
      expect(body.user.username).toBe("test");
    });

    it("updates profile with bio and websiteUrl", async () => {
      mocks.update.mockResolvedValue({ user: { id: "1", username: "test", bio: "Hello world", websiteUrl: "https://example.com" } });
      const res = await app.inject({
        method: "PATCH", url: "/api/user/me",
        headers: { authorization: `Bearer ${TOKEN}` },
        payload: { bio: "Hello world", websiteUrl: "https://example.com" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.bio).toBe("Hello world");
      expect(body.user.websiteUrl).toBe("https://example.com");
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "PATCH", url: "/api/user/me", payload: { displayName: "X" } });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/user/me/favorites", () => {
    it("returns favorites", async () => {
      mocks.favorites.mockResolvedValue({ favorites: [{ entityType: "mcp", entityId: "pkg1" }] });
      const res = await app.inject({ method: "GET", url: "/api/user/me/favorites", headers: { authorization: `Bearer ${TOKEN}` } });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.favorites).toHaveLength(1);
      expect(body.favorites[0].entityType).toBe("mcp");
      expect(body.favorites[0].entityId).toBe("pkg1");
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "GET", url: "/api/user/me/favorites" });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/user/me/api-keys", () => {
    it("returns keys", async () => {
      mocks.apiKeys.mockResolvedValue({ apiKeys: [{ id: "k1", name: "test", keyPrefix: "bmcp_", scopes: [], expiresAt: null, lastUsedAt: null, createdAt: "2025-01-01" }] });
      const res = await app.inject({ method: "GET", url: "/api/user/me/api-keys", headers: { authorization: `Bearer ${TOKEN}` } });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.apiKeys).toHaveLength(1);
      expect(body.apiKeys[0].id).toBe("k1");
      expect(body.apiKeys[0].name).toBe("test");
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "GET", url: "/api/user/me/api-keys" });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/user/me/api-keys", () => {
    it("creates key", async () => {
      mocks.createApiKey.mockResolvedValue({ apiKey: { id: "k1", name: "new", keyPrefix: "bmcp_", scopes: [], expiresAt: null, lastUsedAt: null, createdAt: "2025-01-01" }, key: "full_key" });
      const res = await app.inject({
        method: "POST", url: "/api/user/me/api-keys",
        headers: { authorization: `Bearer ${TOKEN}` },
        payload: { name: "new" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.apiKey.id).toBe("k1");
      expect(body.apiKey.name).toBe("new");
      expect(body.key).toBe("full_key");
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "POST", url: "/api/user/me/api-keys", payload: { name: "x" } });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/user/me/api-keys/:id", () => {
    it("deletes key", async () => {
      mocks.deleteApiKey.mockResolvedValue({ success: true });
      const res = await app.inject({
        method: "DELETE", url: "/api/user/me/api-keys/k1",
        headers: { authorization: `Bearer ${TOKEN}` },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "DELETE", url: "/api/user/me/api-keys/k1" });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/user/:username", () => {
    it("returns public profile", async () => {
      mocks.profile.mockResolvedValue({ user: { id: "2", username: "other", email: "other@test.com" } });
      const res = await app.inject({ method: "GET", url: "/api/user/other" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.username).toBe("other");
      expect(body.user.id).toBe("2");
      expect(body.user.email).toBe("other@test.com");
    });

    it("returns 404 for non-existent user", async () => {
      mocks.profile.mockRejectedValue(
        new mocks.MockApiError("User not found", 404)
      );
      const res = await app.inject({ method: "GET", url: "/api/user/ghost" });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toBe("User not found");
    });
  });

  describe("Error propagation", () => {
    it("propagates ApiError from client methods", async () => {
      mocks.me.mockRejectedValue(
        new mocks.MockApiError("Invalid token", 403)
      );
      const res = await app.inject({
        method: "GET", url: "/api/user/me",
        headers: { authorization: `Bearer ${TOKEN}` },
      });
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error).toBe("Invalid token");
    });
  });
});
