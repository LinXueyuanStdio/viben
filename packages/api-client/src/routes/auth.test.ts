import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthProxyRoutes } from "./auth";

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
    login: vi.fn(), getOAuthUrl: vi.fn(), handleOAuthCallback: vi.fn(),
    refresh: vi.fn(), validate: vi.fn(), logout: vi.fn(), fetch: vi.fn(),
  };
});

vi.mock("../client", () => ({
  VibenClient: class {
    constructor(_config: unknown) {}
    get auth() {
      return {
        login: mocks.login, getOAuthUrl: mocks.getOAuthUrl,
        handleOAuthCallback: mocks.handleOAuthCallback, refresh: mocks.refresh,
        validate: mocks.validate, logout: mocks.logout,
      };
    }
  },
  ApiError: mocks.MockApiError,
}));

const TOKEN = "bmcp_12345678_abcdefghijklmnopqrstuvwx";

describe("Auth Proxy Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    registerAuthProxyRoutes(app, { baseUrl: "https://test.example.com", fetch: mocks.fetch as any });
    await app.ready();
  });

  afterEach(async () => { await app.close(); });

  describe("POST /api/auth/login", () => {
    it("returns session on success", async () => {
      mocks.login.mockResolvedValue({ id: "1", email: "test@test.com", username: "test", accessToken: TOKEN, refreshToken: null, expiresAt: Date.now() + 3600000, userSlug: "test", displayName: "Test", avatarUrl: null });
      const res = await app.inject({
        method: "POST", url: "/api/auth/login",
        payload: { email: "test@test.com", password: "secret" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.username).toBe("test");
      expect(body.email).toBe("test@test.com");
      expect(body.accessToken).toBe(TOKEN);
    });

    it("returns error on invalid credentials", async () => {
      mocks.login.mockRejectedValue(new mocks.MockApiError("Invalid credentials", 401));
      const res = await app.inject({
        method: "POST", url: "/api/auth/login",
        payload: { email: "test@test.com", password: "wrong" },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe("Invalid credentials");
    });

    it("returns 400 on missing credentials", async () => {
      mocks.login.mockRejectedValue(new mocks.MockApiError("Email and password are required", 400));
      const res = await app.inject({
        method: "POST", url: "/api/auth/login",
        payload: { email: "", password: "" },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe("Email and password are required");
    });
  });

  describe("POST /api/auth/register", () => {
    it("forwards registration to web API", async () => {
      mocks.fetch.mockResolvedValue({ status: 200, json: async () => ({ user: { id: "1", username: "new", email: "new@test.com" }, accessToken: "tok" }) });
      const res = await app.inject({
        method: "POST", url: "/api/auth/register",
        payload: { email: "new@test.com", username: "newuser", password: "secret" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.username).toBe("new");
      expect(body.accessToken).toBe("tok");
      expect(mocks.fetch).toHaveBeenCalledWith("https://test.example.com/api/auth/register", expect.anything());
    });

    it("returns 500 on fetch failure", async () => {
      mocks.fetch.mockRejectedValue(new Error("Connection refused"));
      const res = await app.inject({
        method: "POST", url: "/api/auth/register",
        payload: { email: "new@test.com", username: "newuser", password: "secret" },
      });
      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body).error).toBe("Failed to register");
    });
  });

  describe("GET /api/auth/:provider", () => {
    it("returns OAuth URL", async () => {
      mocks.getOAuthUrl.mockReturnValue("https://test.example.com/api/auth/github?redirect_uri=test&state=abc");
      const res = await app.inject({ method: "GET", url: "/api/auth/github?redirect_uri=test&state=abc" });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).url).toContain("github");
    });
  });

  describe("POST /api/auth/callback/:provider", () => {
    it("handles OAuth callback", async () => {
      mocks.handleOAuthCallback.mockResolvedValue({ id: "1", email: "test@test.com", username: "test", accessToken: TOKEN, refreshToken: null, expiresAt: Date.now() + 3600000, userSlug: "test", displayName: "Test", avatarUrl: null });
      const res = await app.inject({
        method: "POST", url: "/api/auth/callback/github",
        payload: { code: "oauth_code" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.username).toBe("test");
      expect(body.accessToken).toBe(TOKEN);
    });

    it("returns 400 when code is missing", async () => {
      mocks.handleOAuthCallback.mockRejectedValue(
        new mocks.MockApiError("Authorization code is required", 400)
      );
      const res = await app.inject({
        method: "POST", url: "/api/auth/callback/github",
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe("Authorization code is required");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("refreshes token", async () => {
      mocks.refresh.mockResolvedValue({ id: "1", email: "test@test.com", username: "test", accessToken: "new_token", refreshToken: null, expiresAt: Date.now() + 3600000, userSlug: "test", displayName: "Test", avatarUrl: null });
      const res = await app.inject({
        method: "POST", url: "/api/auth/refresh",
        payload: { refreshToken: "old_refresh" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accessToken).toBe("new_token");
      expect(body.username).toBe("test");
    });

    it("returns error when refreshToken is missing", async () => {
      mocks.refresh.mockRejectedValue(
        new mocks.MockApiError("refreshToken is required", 400)
      );
      const res = await app.inject({
        method: "POST", url: "/api/auth/refresh",
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe("refreshToken is required");
    });
  });

  describe("POST /api/auth/validate", () => {
    it("returns valid:true with token", async () => {
      mocks.validate.mockResolvedValue({ valid: true, user: { id: "1", username: "test" } });
      const res = await app.inject({
        method: "POST", url: "/api/auth/validate",
        headers: { authorization: `Bearer ${TOKEN}` },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).valid).toBe(true);
    });

    it("returns valid:false for bad token", async () => {
      mocks.validate.mockResolvedValue({ valid: false });
      const res = await app.inject({
        method: "POST", url: "/api/auth/validate",
        headers: { authorization: "Bearer bad_token" },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).valid).toBe(false);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("logs out", async () => {
      mocks.logout.mockResolvedValue(undefined);
      const res = await app.inject({
        method: "POST", url: "/api/auth/logout",
        headers: { authorization: `Bearer ${TOKEN}` },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns error on logout failure", async () => {
      mocks.logout.mockRejectedValue(
        new mocks.MockApiError("Token expired", 401)
      );
      const res = await app.inject({
        method: "POST", url: "/api/auth/logout",
        headers: { authorization: `Bearer expired_token` },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe("Token expired");
    });
  });
});
