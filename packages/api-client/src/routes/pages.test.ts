import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerPagesProxyRoutes } from "./pages";

// Hoist mock functions before vi.mock
const mocks = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;
    details?: unknown;
    constructor(message: string, status: number, details?: unknown) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.details = details;
    }
  }
  return {
    MockApiError,
    publish: vi.fn(),
    publishStatus: vi.fn(),
    publishHistory: vi.fn(),
    publishVersion: vi.fn(),
    publishRollback: vi.fn(),
    fetch: vi.fn(),
  };
});

vi.mock("../client", () => ({
  VibenClient: class {
    get pages() {
      return {
        publish: mocks.publish,
        publishStatus: mocks.publishStatus,
        publishHistory: mocks.publishHistory,
        publishVersion: mocks.publishVersion,
        publishRollback: mocks.publishRollback,
      };
    }
  },
  ApiError: mocks.MockApiError,
}));

describe("Pages Proxy Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    registerPagesProxyRoutes(app, {
      baseUrl: "https://test.example.com",
      fetch: mocks.fetch as unknown as typeof fetch,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /api/page/publish", () => {
    it("returns 200 on success", async () => {
      mocks.publish.mockResolvedValue({
        success: true,
        page_uid: "abc",
        url: "https://viben-web.vercel.app/page/u/abc",
        updated: false,
      });
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish",
        payload: {
          access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx",
          uid: "abc",
          title: "Test",
          html: "<h1>Test</h1>",
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.url).toContain("abc");
    });

    it("returns 401 when access_token is empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish",
        payload: {
          access_token: "",
          uid: "abc",
          title: "Test",
          html: "<h1>Test</h1>",
        },
      });
      expect(res.statusCode).toBe(401);
      expect(mocks.publish).not.toHaveBeenCalled();
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish",
        payload: { access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 500 on client error", async () => {
      mocks.publish.mockRejectedValue(
        new mocks.MockApiError("Server error", 500)
      );
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish",
        payload: {
          access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx",
          uid: "abc",
          title: "Test",
          html: "<h1>Test</h1>",
        },
      });
      expect(res.statusCode).toBe(500);
    });

    it("passes error details through when ApiError has details", async () => {
      mocks.publish.mockRejectedValue(
        new mocks.MockApiError("Validation failed", 422, {
          field: "html",
          message: "HTML contains disallowed tags",
        })
      );
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish",
        payload: {
          access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx",
          uid: "abc",
          title: "Test",
          html: "<script>alert('xss')</script>",
        },
      });
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Validation failed");
      expect(body.details).toEqual({
        field: "html",
        message: "HTML contains disallowed tags",
      });
    });

    it("returns 500 with error message on non-ApiError throw", async () => {
      mocks.publish.mockRejectedValue(new TypeError("Network failure"));
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish",
        payload: {
          access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx",
          uid: "abc",
          title: "Test",
          html: "<h1>Test</h1>",
        },
      });
      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Network failure");
    });
  });

  describe("POST /api/page/publish-status", () => {
    it("returns published status", async () => {
      mocks.publishStatus.mockResolvedValue({
        success: true,
        published: true,
        url: "/page/user/abc",
      });
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish-status",
        payload: {
          access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx",
          user_slug: "user",
          uid: "abc",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).published).toBe(true);
    });

    it("returns 401 when access_token is empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish-status",
        payload: { access_token: "  ", user_slug: "user", uid: "abc" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when user_slug or uid missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish-status",
        payload: {
          access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx",
          uid: "abc",
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/page/publish-history", () => {
    it("returns history", async () => {
      mocks.publishHistory.mockResolvedValue({
        success: true,
        history: [
          {
            version: 1,
            uid: "abc",
            title: "v1",
            html: "<h1>v1</h1>",
            published_at: "2025-01-01",
          },
        ],
      });
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish-history",
        payload: {
          access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx",
          uid: "abc",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).history).toHaveLength(1);
    });

    it("returns 401 when access_token is empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish-history",
        payload: { access_token: "", uid: "abc" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when uid is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish-history",
        payload: {
          access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx",
          uid: "",
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/page/publish-version", () => {
    it("returns version content", async () => {
      mocks.publishVersion.mockResolvedValue({
        success: true,
        version: {
          version: 1,
          uid: "abc",
          title: "v1",
          html: "<h1>v1</h1>",
          published_at: "2025-01-01",
        },
      });
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish-version",
        payload: {
          access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx",
          uid: "abc",
          version: 1,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.version.uid).toBe("abc");
      expect(body.version.version).toBe(1);
      expect(body.version.html).toBe("<h1>v1</h1>");
    });

    it("returns 401 when access_token is empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish-version",
        payload: { access_token: " ", uid: "abc", version: 1 },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when version is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish-version",
        payload: {
          access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx",
          uid: "abc",
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when version is non-integer", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish-version",
        payload: {
          access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx",
          uid: "abc",
          version: 1.5,
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/page/publish-rollback", () => {
    it("returns success on rollback", async () => {
      mocks.publishRollback.mockResolvedValue({ success: true, version: 1 });
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish-rollback",
        payload: {
          access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx",
          uid: "abc",
          version: 1,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.version).toBe(1);
    });

    it("returns 401 when access_token is empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish-rollback",
        payload: { access_token: "", uid: "abc", version: 1 },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when version is invalid", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/page/publish-rollback",
        payload: {
          access_token: "bmcp_12345678_abcdefghijklmnopqrstuvwx",
          uid: "abc",
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
