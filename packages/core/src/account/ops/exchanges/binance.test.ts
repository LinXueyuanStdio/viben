// packages/core/src/account/ops/exchanges/binance.test.ts

import { describe, it, expect } from "vitest";
import { binanceExchange } from "./binance";

describe("binanceExchange", () => {
  describe("meta", () => {
    it("has correct id and fields", () => {
      expect(binanceExchange.id).toBe("binance");
      expect(binanceExchange.fields).toEqual(["api_key", "secret"]);
      expect(binanceExchange.whitelist_ip).toBe("195.135.193.235");
    });
  });

  describe("sign", () => {
    it("produces hex HMAC-SHA256 signature in query string", () => {
      const credentials = { api_key: "test-key", secret: "test-secret" };
      const params = {
        method: "GET" as const,
        path: "/api/v3/account",
        timestamp: "1700000000000",
      };

      const result = binanceExchange.sign(credentials, params);

      expect(result.url).toContain("https://api.binance.com/api/v3/account?");
      expect(result.url).toContain("timestamp=1700000000000");
      expect(result.url).toContain("signature=");
      expect(result.headers["X-MBX-APIKEY"]).toBe("test-key");
      // Signature should be hex
      const sig = result.url.split("signature=")[1];
      expect(sig).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces known-value signature", () => {
      const { createHmac } = require("node:crypto");
      const credentials = { api_key: "test-key", secret: "test-secret" };
      const params = { method: "GET" as const, path: "/api/v3/account", timestamp: "1700000000000" };
      const result = binanceExchange.sign(credentials, params);

      const toSign = "timestamp=1700000000000";
      const expected = createHmac("sha256", "test-secret").update(toSign).digest("hex");
      expect(result.url).toContain(`signature=${expected}`);
    });

    it("includes additional params in signature", () => {
      const credentials = { api_key: "k", secret: "s" };
      const result = binanceExchange.sign(credentials, {
        method: "GET",
        path: "/api/v3/order",
        timestamp: "123",
        params: { symbol: "BTCUSDT", orderId: "1" },
      });
      expect(result.url).toContain("symbol=BTCUSDT");
      expect(result.url).toContain("orderId=1");
      expect(result.url).toContain("timestamp=123");
    });

    it("handles empty params object", () => {
      const credentials = { api_key: "key", secret: "secret" };
      const result = binanceExchange.sign(credentials, {
        method: "GET",
        path: "/api/v3/account",
        timestamp: "123",
        params: {},
      });
      // Empty params should not add extra query string entries
      expect(result.url).toContain("timestamp=123");
      expect(result.url).toContain("signature=");
      // Should not have && or empty key=value pairs
      expect(result.url).not.toContain("&&");
    });

    it("produces correct signature with empty params", () => {
      const { createHmac } = require("node:crypto");
      const credentials = { api_key: "key", secret: "secret" };
      const result = binanceExchange.sign(credentials, {
        method: "GET",
        path: "/api/v3/account",
        timestamp: "123",
        params: {},
      });
      const expected = createHmac("sha256", "secret").update("timestamp=123").digest("hex");
      expect(result.url).toContain(`signature=${expected}`);
    });
  });

  describe("meta URLs", () => {
    it("has referral and api doc URLs", () => {
      expect(binanceExchange.referral_url).toBeDefined();
      expect(binanceExchange.api_doc_url).toBeDefined();
    });
  });
});
