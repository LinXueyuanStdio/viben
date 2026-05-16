// packages/core/src/account/ops/exchanges/bybit.test.ts

import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { bybitExchange } from "./bybit";

describe("bybitExchange", () => {
  describe("meta", () => {
    it("has correct id, name, and fields", () => {
      expect(bybitExchange.id).toBe("bybit");
      expect(bybitExchange.name).toBe("Bybit");
      expect(bybitExchange.fields).toEqual(["api_key", "secret"]);
    });

    it("has referral and api doc URLs", () => {
      expect(bybitExchange.referral_url).toBeDefined();
      expect(bybitExchange.api_doc_url).toBeDefined();
    });
  });

  describe("sign", () => {
    it("produces hex HMAC-SHA256 signature with correct URL and headers", () => {
      const credentials = { api_key: "test-key", secret: "test-secret" };
      const params = {
        method: "GET" as const,
        path: "/v5/account/wallet-balance",
        timestamp: "1700000000000",
        params: { accountType: "UNIFIED" },
      };

      const result = bybitExchange.sign(credentials, params);

      expect(result.url).toBe("https://api.bybit.com/v5/account/wallet-balance?accountType=UNIFIED");
      expect(result.headers["X-BAPI-API-KEY"]).toBe("test-key");
      expect(result.headers["X-BAPI-TIMESTAMP"]).toBe("1700000000000");
      expect(result.headers["X-BAPI-RECV-WINDOW"]).toBe("5000");
      expect(result.headers["Content-Type"]).toBe("application/json");
      // Signature should be hex (64 chars for SHA256)
      expect(result.headers["X-BAPI-SIGN"]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("sorts params alphabetically in query string and signature", () => {
      const credentials = { api_key: "test-key", secret: "test-secret" };
      const params = {
        method: "GET" as const,
        path: "/v5/order/realtime",
        timestamp: "1700000000000",
        params: { symbol: "BTCUSDT", category: "spot", orderId: "123" },
      };

      const result = bybitExchange.sign(credentials, params);

      // Query string should be alphabetically sorted
      expect(result.url).toContain("category=spot&orderId=123&symbol=BTCUSDT");

      // Verify signature is computed with sorted params
      const sortedQuery = "category=spot&orderId=123&symbol=BTCUSDT";
      const expectedPrehash = "1700000000000" + "test-key" + "5000" + sortedQuery;
      const expected = createHmac("sha256", "test-secret")
        .update(expectedPrehash)
        .digest("hex");
      expect(result.headers["X-BAPI-SIGN"]).toBe(expected);
    });

    it("produces correct known-value signature without params", () => {
      const credentials = { api_key: "my-key", secret: "my-secret" };
      const params = {
        method: "GET" as const,
        path: "/test",
        timestamp: "1700000000000",
      };

      const result = bybitExchange.sign(credentials, params);

      const expectedPrehash = "1700000000000" + "my-key" + "5000" + "";
      const expected = createHmac("sha256", "my-secret")
        .update(expectedPrehash)
        .digest("hex");
      expect(result.headers["X-BAPI-SIGN"]).toBe(expected);
      expect(result.url).toBe("https://api.bybit.com/test");
    });

    it("produces same signature regardless of body parameter", () => {
      const credentials = { api_key: "k", secret: "s" };
      const base = { method: "POST" as const, path: "/v5/order/create", timestamp: "123" };
      const withBody = bybitExchange.sign(credentials, { ...base, body: '{"side":"Buy"}' });
      const withoutBody = bybitExchange.sign(credentials, { ...base });
      expect(withBody.headers["X-BAPI-SIGN"]).toBe(withoutBody.headers["X-BAPI-SIGN"]);
    });
  });
});
