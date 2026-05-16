import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// Mock the account module
vi.mock("../../account", () => ({
  listAccounts: vi.fn(),
  addAccount: vi.fn(),
  viewAccount: vi.fn(),
  updateAccount: vi.fn(),
  removeAccount: vi.fn(),
  testAccount: vi.fn(),
  listExchanges: vi.fn(),
}));

import { registerAccountsRoutes } from "./accounts";
import {
  listAccounts,
  addAccount,
  viewAccount,
  updateAccount,
  removeAccount,
  testAccount,
  listExchanges,
} from "../../account";

describe("Accounts Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    registerAccountsRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // ─── GET /api/exchanges ─────────────────────────────────────────────

  describe("GET /api/exchanges", () => {
    it("returns list of exchanges with correct fields", async () => {
      vi.mocked(listExchanges).mockReturnValue([
        {
          id: "okx",
          name: "OKX",
          fields: ["api_key", "secret", "passphrase"],
          referral_url: "https://okx.com",
          api_doc_url: "https://okx.com/api",
          sign: vi.fn() as any,
          testConnection: vi.fn() as any,
        },
        {
          id: "binance",
          name: "Binance",
          fields: ["api_key", "secret"],
          whitelist_ip: "195.135.193.235",
          referral_url: "https://binance.com",
          api_doc_url: "https://binance.com/api",
          sign: vi.fn() as any,
          testConnection: vi.fn() as any,
        },
      ]);

      const res = await app.inject({ method: "GET", url: "/api/exchanges" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.exchanges).toHaveLength(2);
      expect(body.exchanges[0]).toEqual({
        id: "okx",
        name: "OKX",
        fields: ["api_key", "secret", "passphrase"],
        referral_url: "https://okx.com",
        api_doc_url: "https://okx.com/api",
      });
      expect(body.exchanges[1]).toMatchObject({
        id: "binance",
        name: "Binance",
        whitelist_ip: "195.135.193.235",
      });
      // sign and testConnection should NOT be in the response
      expect(body.exchanges[0]).not.toHaveProperty("sign");
      expect(body.exchanges[0]).not.toHaveProperty("testConnection");
    });

    it("returns 7 exchanges when all are registered", async () => {
      const exchangeIds = ["okx", "binance", "bitget", "bybit", "gate", "kucoin", "lighter"];
      vi.mocked(listExchanges).mockReturnValue(
        exchangeIds.map((id) => ({
          id,
          name: id.toUpperCase(),
          fields: ["api_key", "secret"],
          referral_url: `https://${id}.com`,
          api_doc_url: `https://${id}.com/api`,
          sign: vi.fn() as any,
          testConnection: vi.fn() as any,
        })),
      );

      const res = await app.inject({ method: "GET", url: "/api/exchanges" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.exchanges).toHaveLength(7);
      expect(body.exchanges.map((e: any) => e.id)).toEqual(exchangeIds);
    });
  });

  // ─── GET /api/accounts ──────────────────────────────────────────────

  describe("GET /api/accounts", () => {
    it("returns empty list when no accounts", async () => {
      vi.mocked(listAccounts).mockResolvedValue({ success: true, accounts: [] });

      const res = await app.inject({ method: "GET", url: "/api/accounts" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toEqual({ success: true, accounts: [] });
    });

    it("returns accounts without credentials", async () => {
      vi.mocked(listAccounts).mockResolvedValue({
        success: true,
        accounts: [
          { id: "abc123", exchange: "okx", name: "OKX #1", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
          { id: "def456", exchange: "binance", name: "Binance Main", created_at: "2026-01-02T00:00:00Z", updated_at: "2026-01-02T00:00:00Z" },
        ],
      });

      const res = await app.inject({ method: "GET", url: "/api/accounts" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.accounts).toHaveLength(2);
      expect(body.accounts[0]).not.toHaveProperty("api_key");
      expect(body.accounts[0]).not.toHaveProperty("secret");
      expect(body.accounts[0]).not.toHaveProperty("passphrase");
    });
  });

  // ─── POST /api/accounts ─────────────────────────────────────────────

  describe("POST /api/accounts", () => {
    it("returns 201 on successful create", async () => {
      vi.mocked(addAccount).mockResolvedValue({
        success: true,
        account: { id: "abc123", exchange: "okx", name: "OKX #1", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/accounts",
        headers: { "content-type": "application/json" },
        payload: { exchange: "okx", name: "OKX #1", api_key: "key123", secret: "secret123", passphrase: "pass123" },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.account.id).toBe("abc123");
      expect(addAccount).toHaveBeenCalledWith({
        exchange: "okx",
        name: "OKX #1",
        api_key: "key123",
        secret: "secret123",
        passphrase: "pass123",
      });
    });

    it("returns 400 when required fields missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/accounts",
        headers: { "content-type": "application/json" },
        payload: { exchange: "okx" },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("required");
      expect(addAccount).not.toHaveBeenCalled();
    });

    it("returns 400 on validation error from addAccount", async () => {
      vi.mocked(addAccount).mockResolvedValue({
        success: false,
        error: "Unsupported exchange: invalid_exchange",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/accounts",
        headers: { "content-type": "application/json" },
        payload: { exchange: "invalid_exchange", name: "Test", api_key: "key", secret: "sec" },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("Unsupported exchange");
    });
  });

  // ─── GET /api/accounts/:id ──────────────────────────────────────────

  describe("GET /api/accounts/:id", () => {
    it("returns 200 with account and masked credentials", async () => {
      vi.mocked(viewAccount).mockResolvedValue({
        success: true,
        account: { id: "abc123", exchange: "okx", name: "OKX #1", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
        masked_credentials: { api_key: "****y123", secret: "****cret", passphrase: "****pass" },
      });

      const res = await app.inject({ method: "GET", url: "/api/accounts/abc123" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.account.id).toBe("abc123");
      expect(body.masked_credentials.api_key).toBe("****y123");
      expect(body.masked_credentials.secret).toBe("****cret");
      expect(viewAccount).toHaveBeenCalledWith("abc123");
    });

    it("returns 404 when account not found", async () => {
      vi.mocked(viewAccount).mockResolvedValue({
        success: false,
        error: "Account not found: xyz",
      });

      const res = await app.inject({ method: "GET", url: "/api/accounts/xyz" });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("not found");
    });
  });

  // ─── PUT /api/accounts/:id ──────────────────────────────────────────

  describe("PUT /api/accounts/:id", () => {
    it("returns 200 on successful update", async () => {
      vi.mocked(updateAccount).mockResolvedValue({
        success: true,
        account: { id: "abc123", exchange: "okx", name: "OKX Updated", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-15T00:00:00Z" },
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/accounts/abc123",
        headers: { "content-type": "application/json" },
        payload: { name: "OKX Updated" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.account.name).toBe("OKX Updated");
      expect(updateAccount).toHaveBeenCalledWith("abc123", { name: "OKX Updated" });
    });

    it("returns 404 when account not found", async () => {
      vi.mocked(updateAccount).mockResolvedValue({
        success: false,
        error: "Account not found: xyz",
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/accounts/xyz",
        headers: { "content-type": "application/json" },
        payload: { name: "New Name" },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("not found");
    });

    it("returns 400 on validation error", async () => {
      vi.mocked(updateAccount).mockResolvedValue({
        success: false,
        error: "Name must be 50 characters or fewer",
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/accounts/abc123",
        headers: { "content-type": "application/json" },
        payload: { name: "A".repeat(100) },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("50 characters");
    });
  });

  // ─── DELETE /api/accounts/:id ───────────────────────────────────────

  describe("DELETE /api/accounts/:id", () => {
    it("returns 200 on successful delete", async () => {
      vi.mocked(removeAccount).mockResolvedValue({ success: true });

      const res = await app.inject({ method: "DELETE", url: "/api/accounts/abc123" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(removeAccount).toHaveBeenCalledWith("abc123");
    });

    it("returns 404 when account not found", async () => {
      vi.mocked(removeAccount).mockResolvedValue({
        success: false,
        error: "Account not found: xyz",
      });

      const res = await app.inject({ method: "DELETE", url: "/api/accounts/xyz" });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("not found");
    });
  });

  // ─── POST /api/accounts/:id/test ───────────────────────────────────

  describe("POST /api/accounts/:id/test", () => {
    it("returns successful test result", async () => {
      vi.mocked(testAccount).mockResolvedValue({
        success: true,
        latency_ms: 42,
      });

      const res = await app.inject({ method: "POST", url: "/api/accounts/abc123/test" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.latency_ms).toBe(42);
      expect(testAccount).toHaveBeenCalledWith("abc123");
    });

    it("returns failed test result with 200 status", async () => {
      vi.mocked(testAccount).mockResolvedValue({
        success: false,
        error: "Connection timeout",
      });

      const res = await app.inject({ method: "POST", url: "/api/accounts/abc123/test" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Connection timeout");
    });
  });

  // ─── GET /api/accounts - edge cases ──────────────────────────────────

  describe("GET /api/accounts - edge cases", () => {
    it("returns 200 even when listAccounts fails (no error handling in route)", async () => {
      vi.mocked(listAccounts).mockResolvedValue({
        success: false,
        accounts: [],
        error: "Read failed",
      });
      const response = await app.inject({ method: "GET", url: "/api/accounts" });
      // Route blindly returns result - documents this behavior
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/accounts - partial missing fields", () => {
    it("returns 400 when only secret is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/accounts",
        payload: { exchange: "okx", name: "Test", api_key: "key" },
      });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("required");
    });

    it("returns 400 when exchange is empty string", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/accounts",
        payload: { exchange: "", name: "Test", api_key: "key", secret: "secret" },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe("PUT /api/accounts/:id - edge cases", () => {
    it("handles empty body gracefully (no-op update)", async () => {
      vi.mocked(updateAccount).mockResolvedValue({
        success: true,
        account: { id: "abc", exchange: "binance", name: "B", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:01Z" },
      });
      const response = await app.inject({
        method: "PUT",
        url: "/api/accounts/abc",
        payload: {},
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).success).toBe(true);
    });
  });

  // ─── POST /api/accounts/:id/test - additional cases ─────────────────

  describe("POST /api/accounts/:id/test - additional cases", () => {
    it("returns 404 when account not found", async () => {
      vi.mocked(testAccount).mockResolvedValue({
        success: false,
        error: "Account not found: xyz",
      });
      const response = await app.inject({
        method: "POST",
        url: "/api/accounts/xyz/test",
      });
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("not found");
    });

    it("returns 200 for connection failure (not account-not-found)", async () => {
      vi.mocked(testAccount).mockResolvedValue({
        success: false,
        error: "Connection timeout",
        latency_ms: 10000,
      });
      const response = await app.inject({
        method: "POST",
        url: "/api/accounts/abc123/test",
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Connection timeout");
    });
  });

  // ─── 500 error when ops function throws ─────────────────────────────

  describe("internal server error (500)", () => {
    it("returns 500 when listAccounts throws an exception", async () => {
      vi.mocked(listAccounts).mockRejectedValue(new Error("disk full"));
      const res = await app.inject({ method: "GET", url: "/api/accounts" });
      expect(res.statusCode).toBe(500);
    });

    it("returns 500 when addAccount throws an exception", async () => {
      vi.mocked(addAccount).mockRejectedValue(new Error("disk full"));
      const res = await app.inject({
        method: "POST",
        url: "/api/accounts",
        headers: { "content-type": "application/json" },
        payload: { exchange: "okx", name: "Test", api_key: "k", secret: "s" },
      });
      expect(res.statusCode).toBe(500);
    });

    it("returns 500 when viewAccount throws an exception", async () => {
      vi.mocked(viewAccount).mockRejectedValue(new Error("disk full"));
      const res = await app.inject({ method: "GET", url: "/api/accounts/abc123" });
      expect(res.statusCode).toBe(500);
    });
  });

  // ─── POST /api/accounts - missing name field ─────────────────────────

  describe("POST /api/accounts - name missing", () => {
    it("returns 400 when name is missing from body", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/accounts",
        headers: { "content-type": "application/json" },
        payload: { exchange: "binance", api_key: "key", secret: "secret" },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("required");
      expect(addAccount).not.toHaveBeenCalled();
    });
  });

  // ─── POST /api/accounts - without passphrase (Binance) ───────────────

  describe("POST /api/accounts - without passphrase", () => {
    it("calls addAccount with passphrase undefined for Binance", async () => {
      vi.mocked(addAccount).mockResolvedValue({
        success: true,
        account: { id: "bin1", exchange: "binance", name: "Binance Main", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/accounts",
        headers: { "content-type": "application/json" },
        payload: { exchange: "binance", name: "Binance Main", api_key: "key", secret: "secret" },
      });

      expect(res.statusCode).toBe(201);
      expect(addAccount).toHaveBeenCalledWith({
        exchange: "binance",
        name: "Binance Main",
        api_key: "key",
        secret: "secret",
        passphrase: undefined,
      });
    });
  });
});
