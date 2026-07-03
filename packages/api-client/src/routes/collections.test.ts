import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerCollectionsProxyRoutes } from "./collections";

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
    list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    addItem: vi.fn(), removeItem: vi.fn(), fork: vi.fn(), toggleFavorite: vi.fn(),
    comments: vi.fn(), addComment: vi.fn(), fetch: vi.fn(),
  };
});

vi.mock("../client", () => ({
  VibenClient: class {
    constructor(_config: unknown) {}
    get collections() {
      return {
        list: mocks.list, get: mocks.get, create: mocks.create, update: mocks.update,
        delete: mocks.delete, addItem: mocks.addItem, removeItem: mocks.removeItem,
        fork: mocks.fork, toggleFavorite: mocks.toggleFavorite,
        comments: mocks.comments, addComment: mocks.addComment,
      };
    }
  },
  ApiError: mocks.MockApiError,
}));

const TOKEN = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
const LIST_RESULT = { collections: [{ id: "c1", name: "Test", entityType: "mcp", isPublic: true }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } };

describe("Collections Proxy Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    registerCollectionsProxyRoutes(app, { baseUrl: "https://test.example.com", fetch: mocks.fetch as any });
    await app.ready();
  });

  afterEach(async () => { await app.close(); });

  describe("GET /api/collections", () => {
    it("returns collections list", async () => {
      mocks.list.mockResolvedValue(LIST_RESULT);
      const res = await app.inject({ method: "GET", url: "/api/collections" });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).collections).toHaveLength(1);
    });
  });

  describe("POST /api/collections", () => {
    it("creates collection", async () => {
      mocks.create.mockResolvedValue({ collection: { id: "c1", name: "New", entityType: "mcp", isPublic: false } });
      const res = await app.inject({
        method: "POST", url: "/api/collections",
        headers: { authorization: `Bearer ${TOKEN}` },
        payload: { name: "New", entityType: "mcp" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.collection.id).toBe("c1");
      expect(body.collection.name).toBe("New");
      expect(body.collection.entityType).toBe("mcp");
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "POST", url: "/api/collections", payload: { name: "X", entityType: "mcp" } });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/collections/:id", () => {
    it("returns collection", async () => {
      mocks.get.mockResolvedValue({ collection: { id: "c1", name: "Test", entityType: "mcp", isPublic: true }, items: [] });
      const res = await app.inject({ method: "GET", url: "/api/collections/c1" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.collection.id).toBe("c1");
      expect(body.collection.name).toBe("Test");
      expect(body.items).toEqual([]);
    });

    it("returns 404 for non-existent collection", async () => {
      mocks.get.mockRejectedValue(
        new mocks.MockApiError("Collection not found", 404)
      );
      const res = await app.inject({ method: "GET", url: "/api/collections/ghost" });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toBe("Collection not found");
    });
  });

  describe("PATCH /api/collections/:id", () => {
    it("updates collection", async () => {
      mocks.update.mockResolvedValue({ collection: { id: "c1", name: "Updated", isPublic: true } });
      const res = await app.inject({
        method: "PATCH", url: "/api/collections/c1",
        headers: { authorization: `Bearer ${TOKEN}` },
        payload: { name: "Updated" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.collection.id).toBe("c1");
      expect(body.collection.name).toBe("Updated");
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "PATCH", url: "/api/collections/c1", payload: { name: "X" } });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/collections/:id", () => {
    it("deletes collection", async () => {
      mocks.delete.mockResolvedValue({ success: true });
      const res = await app.inject({ method: "DELETE", url: "/api/collections/c1", headers: { authorization: `Bearer ${TOKEN}` } });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "DELETE", url: "/api/collections/c1" });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/collections/:id/items", () => {
    it("adds item", async () => {
      mocks.addItem.mockResolvedValue({ success: true, item: { entityId: "pkg1", entityType: "mcp" } });
      const res = await app.inject({
        method: "POST", url: "/api/collections/c1/items",
        headers: { authorization: `Bearer ${TOKEN}` },
        payload: { entityId: "pkg1" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.item.entityId).toBe("pkg1");
    });

    it("propagates error from addItem", async () => {
      mocks.addItem.mockRejectedValue(
        new mocks.MockApiError("Item already exists", 409)
      );
      const res = await app.inject({
        method: "POST", url: "/api/collections/c1/items",
        headers: { authorization: `Bearer ${TOKEN}` },
        payload: { entityId: "pkg1" },
      });
      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).error).toBe("Item already exists");
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "POST", url: "/api/collections/c1/items", payload: { entityId: "x" } });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/collections/:id/items/:eid", () => {
    it("removes item", async () => {
      mocks.removeItem.mockResolvedValue({ success: true });
      const res = await app.inject({ method: "DELETE", url: "/api/collections/c1/items/pkg1", headers: { authorization: `Bearer ${TOKEN}` } });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "DELETE", url: "/api/collections/c1/items/pkg1" });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/collections/:id/fork", () => {
    it("forks collection", async () => {
      mocks.fork.mockResolvedValue({ collection: { id: "c2", name: "Forked" } });
      const res = await app.inject({ method: "POST", url: "/api/collections/c1/fork", headers: { authorization: `Bearer ${TOKEN}` } });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.collection.id).toBe("c2");
      expect(body.collection.name).toBe("Forked");
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "POST", url: "/api/collections/c1/fork" });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/collections/:id/favorite", () => {
    it("toggles favorite", async () => {
      mocks.toggleFavorite.mockResolvedValue({ favorited: true });
      const res = await app.inject({ method: "POST", url: "/api/collections/c1/favorite", headers: { authorization: `Bearer ${TOKEN}` } });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).favorited).toBe(true);
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "POST", url: "/api/collections/c1/favorite" });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/collections/:id/comments", () => {
    it("returns comments", async () => {
      mocks.comments.mockResolvedValue({ comments: [{ id: "cm1", content: "Nice!", entityType: "collection", entityId: "c1", userId: "u1", parentId: null, createdAt: "2025-01-01", updatedAt: "2025-01-01" }] });
      const res = await app.inject({ method: "GET", url: "/api/collections/c1/comments" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.comments).toHaveLength(1);
      expect(body.comments[0].id).toBe("cm1");
      expect(body.comments[0].content).toBe("Nice!");
    });

    it("returns 404 for comments of non-existent collection", async () => {
      mocks.comments.mockRejectedValue(
        new mocks.MockApiError("Collection not found", 404)
      );
      const res = await app.inject({ method: "GET", url: "/api/collections/ghost/comments" });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toBe("Collection not found");
    });
  });

  describe("POST /api/collections/:id/comments", () => {
    it("adds comment", async () => {
      mocks.addComment.mockResolvedValue({ success: true, id: "cm1" });
      const res = await app.inject({
        method: "POST", url: "/api/collections/c1/comments",
        headers: { authorization: `Bearer ${TOKEN}` },
        payload: { content: "Nice!" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.id).toBe("cm1");
    });

    it("returns 400 when content is missing", async () => {
      const res = await app.inject({
        method: "POST", url: "/api/collections/c1/comments",
        headers: { authorization: `Bearer ${TOKEN}` },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "POST", url: "/api/collections/c1/comments", payload: { content: "X" } });
      expect(res.statusCode).toBe(401);
    });
  });
});
