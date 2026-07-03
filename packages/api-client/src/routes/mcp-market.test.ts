import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerMcpMarketProxyRoutes } from "./mcp-market";

const mocks = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.name = "ApiError";
      this.status = status;
    }
  }
  return {
    MockApiError,
    list: vi.fn(),
    get: vi.fn(),
    search: vi.fn(),
    categories: vi.fn(),
    download: vi.fn(),
    toggleFavorite: vi.fn(),
    comments: vi.fn(),
    addComment: vi.fn(),
    rate: vi.fn(),
    fetch: vi.fn(),
  };
});

vi.mock("../client", () => ({
  VibenClient: class {
    get mcp() {
      return {
        list: mocks.list,
        get: mocks.get,
        search: mocks.search,
        categories: mocks.categories,
        download: mocks.download,
        toggleFavorite: mocks.toggleFavorite,
        comments: mocks.comments,
        addComment: mocks.addComment,
        rate: mocks.rate,
      };
    }
  },
  ApiError: mocks.MockApiError,
}));

describe("MCP Market Proxy Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    registerMcpMarketProxyRoutes(app, {
      baseUrl: "https://test.example.com",
      fetch: mocks.fetch as unknown as typeof fetch,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/mcp-market", () => {
    it("returns paginated list on success", async () => {
      mocks.list.mockResolvedValue({
        data: [{ id: "1", name: "test-mcp" }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
      const res = await app.inject({
        method: "GET",
        url: "/api/mcp-market",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
    });

    it("returns empty data on error", async () => {
      mocks.list.mockRejectedValue(
        new mocks.MockApiError("Server error", 500)
      );
      const res = await app.inject({
        method: "GET",
        url: "/api/mcp-market",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });
  });

  describe("GET /api/mcp-market/search", () => {
    it("returns search results", async () => {
      mocks.search.mockResolvedValue({
        data: [{ id: "1", name: "test-mcp" }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
      const res = await app.inject({
        method: "GET",
        url: "/api/mcp-market/search?q=test",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("1");
      expect(body.pagination.total).toBe(1);
    });

    it("returns 400 when q param is empty", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/mcp-market/search?q=",
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when q param is missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/mcp-market/search",
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /api/mcp-market/categories", () => {
    it("returns categories", async () => {
      mocks.categories.mockResolvedValue([
        { id: "cat1", name: "Developer Tools" },
      ]);
      const res = await app.inject({
        method: "GET",
        url: "/api/mcp-market/categories",
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toHaveLength(1);
    });
  });

  describe("GET /api/mcp-market/:id", () => {
    it("returns package details by id", async () => {
      mocks.get.mockResolvedValue({ id: "pkg1", name: "test-mcp", description: "A test MCP", version: "1.0.0", author: { username: "creator" } });
      const res = await app.inject({
        method: "GET",
        url: "/api/mcp-market/pkg1",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe("pkg1");
      expect(body.name).toBe("test-mcp");
      expect(body.description).toBe("A test MCP");
    });

    it("returns 404 on client error", async () => {
      mocks.get.mockRejectedValue(
        new mocks.MockApiError("Not found", 404)
      );
      const res = await app.inject({
        method: "GET",
        url: "/api/mcp-market/nonexistent",
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /api/mcp-market/:id/download", () => {
    it("returns binary response", async () => {
      mocks.download.mockResolvedValue({
        arrayBuffer: async () => new ArrayBuffer(8),
      });
      const res = await app.inject({
        method: "GET",
        url: "/api/mcp-market/pkg1/download",
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("application/octet-stream");
      expect(res.body).toBeTruthy();
    });

    it("returns 500 on download error", async () => {
      mocks.download.mockRejectedValue(
        new mocks.MockApiError("Download failed", 500)
      );
      const res = await app.inject({
        method: "GET",
        url: "/api/mcp-market/pkg1/download",
      });
      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body).error).toBe("Download failed");
    });
  });

  describe("POST /api/mcp-market/:id/favorite", () => {
    it("returns success with auth via Authorization header", async () => {
      mocks.toggleFavorite.mockResolvedValue({ favorited: true });
      const res = await app.inject({
        method: "POST",
        url: "/api/mcp-market/pkg1/favorite",
        headers: {
          Authorization: "Bearer bmcp_12345678_abcdefghijklmnopqrstuvwx",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).favorited).toBe(true);
    });

    it("returns 401 when no auth token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/mcp-market/pkg1/favorite",
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/mcp-market/:id/comments", () => {
    it("returns comments", async () => {
      mocks.comments.mockResolvedValue({
        data: [{ id: "c1", content: "Great!", author: { username: "alice" } }],
      });
      const res = await app.inject({
        method: "GET",
        url: "/api/mcp-market/pkg1/comments",
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toHaveLength(1);
    });
  });

  describe("POST /api/mcp-market/:id/comments", () => {
    it("returns success with auth and content", async () => {
      mocks.addComment.mockResolvedValue({ success: true, id: "c1" });
      const res = await app.inject({
        method: "POST",
        url: "/api/mcp-market/pkg1/comments",
        headers: {
          Authorization: "Bearer bmcp_12345678_abcdefghijklmnopqrstuvwx",
        },
        payload: { content: "Great package!" },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns 401 when no auth token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/mcp-market/pkg1/comments",
        payload: { content: "Great package!" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when content is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/mcp-market/pkg1/comments",
        headers: {
          Authorization: "Bearer bmcp_12345678_abcdefghijklmnopqrstuvwx",
        },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/mcp-market/:id/rating", () => {
    it("returns success with valid score", async () => {
      mocks.rate.mockResolvedValue({ success: true, averageScore: 4.2, totalRatings: 10 });
      const res = await app.inject({
        method: "POST",
        url: "/api/mcp-market/pkg1/rating",
        headers: {
          Authorization: "Bearer bmcp_12345678_abcdefghijklmnopqrstuvwx",
        },
        payload: { score: 4 },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.averageScore).toBe(4.2);
      expect(body.totalRatings).toBe(10);
    });

    it("returns 400 when score is 0 (too low)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/mcp-market/pkg1/rating",
        headers: {
          Authorization: "Bearer bmcp_12345678_abcdefghijklmnopqrstuvwx",
        },
        payload: { score: 0 },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toContain("score");
    });

    it("returns 400 when score is 6 (too high)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/mcp-market/pkg1/rating",
        headers: {
          Authorization: "Bearer bmcp_12345678_abcdefghijklmnopqrstuvwx",
        },
        payload: { score: 6 },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toContain("score");
    });

    it("returns 400 when score is non-number", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/mcp-market/pkg1/rating",
        headers: {
          Authorization: "Bearer bmcp_12345678_abcdefghijklmnopqrstuvwx",
        },
        payload: { score: "bad" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 401 when no auth token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/mcp-market/pkg1/rating",
        payload: { score: 4 },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
