import { describe, it, expect, vi, beforeEach } from "vitest";
import { okxExchange } from "./okx";
import { binanceExchange } from "./binance";
import { bitgetExchange } from "./bitget";
import { bybitExchange } from "./bybit";
import { gateExchange } from "./gate";
import { kucoinExchange } from "./kucoin";
import { lighterExchange } from "./lighter";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const TEST_CREDENTIALS = { api_key: "test-key", secret: "test-secret", passphrase: "test-pass" };

describe("testConnection", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ─── OKX ─────────────────────────────────────────────────────────────────────

  describe("okxExchange", () => {
    it("returns success when code is '0'", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: "0", msg: "" }),
      });
      const result = await okxExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(true);
      expect(result.latency_ms).toBeDefined();
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v5/account/balance");
      expect(opts.signal).toBeDefined();
    });

    it("returns failure with error message when code is non-zero", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ code: "50111", msg: "Invalid API key" }),
      });
      const result = await okxExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API key");
      expect(result.latency_ms).toBeDefined();
    });

    it("returns failure with fallback message when msg is undefined", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ code: "50000" }),
      });
      const result = await okxExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Error code: 50000");
    });

    it("handles network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network timeout"));
      const result = await okxExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Network timeout");
      expect(result.latency_ms).toBeDefined();
    });
  });

  // ─── Binance ──────────────────────────────────────────────────────────────────

  describe("binanceExchange", () => {
    it("returns success when res.ok is true", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ balances: [] }),
      });
      const result = await binanceExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(true);
      expect(result.latency_ms).toBeDefined();
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v3/account");
      expect(opts.signal).toBeDefined();
    });

    it("returns failure with msg when res.ok is false", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: -2015, msg: "Invalid API-key" }),
      });
      const result = await binanceExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API-key");
      expect(result.latency_ms).toBeDefined();
    });

    it("returns failure with HTTP fallback when msg is undefined", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ code: -1003 }),
      });
      const result = await binanceExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("HTTP 403");
    });

    it("handles network error", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
      const result = await binanceExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("ECONNREFUSED");
      expect(result.latency_ms).toBeDefined();
    });
  });

  // ─── Bitget ───────────────────────────────────────────────────────────────────

  describe("bitgetExchange", () => {
    it("returns success when code is '00000'", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: "00000", msg: "success" }),
      });
      const result = await bitgetExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(true);
      expect(result.latency_ms).toBeDefined();
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v2/spot/account/info");
      expect(opts.signal).toBeDefined();
    });

    it("returns failure with msg when code is non-success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: "40014", msg: "Invalid ApiKey" }),
      });
      const result = await bitgetExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid ApiKey");
      expect(result.latency_ms).toBeDefined();
    });

    it("returns failure with fallback when msg is undefined", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: "40001" }),
      });
      const result = await bitgetExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Error: 40001");
    });

    it("handles network error", async () => {
      mockFetch.mockRejectedValue(new Error("DNS resolution failed"));
      const result = await bitgetExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("DNS resolution failed");
      expect(result.latency_ms).toBeDefined();
    });
  });

  // ─── Bybit ────────────────────────────────────────────────────────────────────

  describe("bybitExchange", () => {
    it("returns success when retCode is 0", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ retCode: 0, retMsg: "OK", result: {} }),
      });
      const result = await bybitExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(true);
      expect(result.latency_ms).toBeDefined();
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/v5/account/wallet-balance");
      expect(opts.signal).toBeDefined();
    });

    it("returns failure with retMsg when retCode is non-zero", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ retCode: 10003, retMsg: "Invalid apikey" }),
      });
      const result = await bybitExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid apikey");
      expect(result.latency_ms).toBeDefined();
    });

    it("returns failure with fallback when retMsg is undefined", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ retCode: 10004 }),
      });
      const result = await bybitExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Error: 10004");
    });

    it("handles network error", async () => {
      mockFetch.mockRejectedValue(new Error("Socket hang up"));
      const result = await bybitExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Socket hang up");
      expect(result.latency_ms).toBeDefined();
    });
  });

  // ─── Gate ─────────────────────────────────────────────────────────────────────

  describe("gateExchange", () => {
    it("returns success when res.ok is true", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ([{ currency: "BTC", available: "0.1" }]),
      });
      const result = await gateExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(true);
      expect(result.latency_ms).toBeDefined();
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v4/spot/accounts");
      expect(opts.signal).toBeDefined();
    });

    it("returns failure with message when res.ok is false", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Invalid key" }),
      });
      const result = await gateExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid key");
      expect(result.latency_ms).toBeDefined();
    });

    it("returns failure with HTTP fallback when message is undefined", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      });
      const result = await gateExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("HTTP 500");
    });

    it("handles network error", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));
      const result = await gateExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection refused");
      expect(result.latency_ms).toBeDefined();
    });
  });

  // ─── KuCoin ───────────────────────────────────────────────────────────────────

  describe("kucoinExchange", () => {
    it("returns success when code is '200000'", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: "200000", data: [] }),
      });
      const result = await kucoinExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(true);
      expect(result.latency_ms).toBeDefined();
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/accounts");
      expect(opts.signal).toBeDefined();
    });

    it("returns failure with msg when code is non-success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: "400003", msg: "KC-API-KEY not exists" }),
      });
      const result = await kucoinExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("KC-API-KEY not exists");
      expect(result.latency_ms).toBeDefined();
    });

    it("returns failure with fallback when msg is undefined", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: "400001" }),
      });
      const result = await kucoinExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Error: 400001");
    });

    it("handles network error", async () => {
      mockFetch.mockRejectedValue(new Error("Request timed out"));
      const result = await kucoinExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Request timed out");
      expect(result.latency_ms).toBeDefined();
    });
  });

  // ─── OKX signed headers ──────────────────────────────────────────────────────

  describe("okxExchange signed headers", () => {
    it("passes signed headers to fetch (okx)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: "0", msg: "" }),
      });
      await okxExchange.testConnection({ api_key: "mykey", secret: "mysecret", passphrase: "mypass" });
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers["OK-ACCESS-KEY"]).toBe("mykey");
      expect(opts.headers["OK-ACCESS-PASSPHRASE"]).toBe("mypass");
      expect(opts.headers["OK-ACCESS-SIGN"]).toBeDefined();
      expect(opts.headers["OK-ACCESS-TIMESTAMP"]).toBeDefined();
    });
  });

  // ─── Lighter ──────────────────────────────────────────────────────────────────

  describe("lighterExchange", () => {
    it("returns success when res.ok is true", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ account: {} }),
      });
      const result = await lighterExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(true);
      expect(result.latency_ms).toBeDefined();
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/account");
      expect(opts.signal).toBeDefined();
    });

    it("returns failure with text body when res.ok is false", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized: invalid API key",
      });
      const result = await lighterExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized: invalid API key");
      expect(result.latency_ms).toBeDefined();
    });

    it("returns failure with HTTP fallback when text is empty", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "",
      });
      const result = await lighterExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("HTTP 503");
    });

    it("handles network error", async () => {
      mockFetch.mockRejectedValue(new Error("ETIMEDOUT"));
      const result = await lighterExchange.testConnection(TEST_CREDENTIALS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("ETIMEDOUT");
      expect(result.latency_ms).toBeDefined();
    });
  });

  // ─── Non-Error throw handling ────────────────────────────────────────────────

  describe("non-Error throw handling", () => {
    it("returns 'Network error' when fetch throws a non-Error value (okx)", async () => {
      mockFetch.mockRejectedValue("some string rejection");
      const result = await okxExchange.testConnection({ api_key: "k", secret: "s", passphrase: "p" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
      expect(result.latency_ms).toBeDefined();
    });

    it("returns 'Network error' when fetch throws a non-Error value (binance)", async () => {
      mockFetch.mockRejectedValue(42);
      const result = await binanceExchange.testConnection({ api_key: "k", secret: "s" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
      expect(result.latency_ms).toBeDefined();
    });

    it("returns 'Network error' when fetch throws null (okx)", async () => {
      mockFetch.mockRejectedValue(null);
      const result = await okxExchange.testConnection({ api_key: "k", secret: "s", passphrase: "p" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
      expect(result.latency_ms).toBeDefined();
    });

    it("returns 'Network error' when fetch throws undefined (binance)", async () => {
      mockFetch.mockRejectedValue(undefined);
      const result = await binanceExchange.testConnection({ api_key: "k", secret: "s" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
      expect(result.latency_ms).toBeDefined();
    });
  });
});
