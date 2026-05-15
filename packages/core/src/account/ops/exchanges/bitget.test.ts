// packages/core/src/account/ops/exchanges/bitget.test.ts

import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { bitgetExchange } from "./bitget";

describe("bitgetExchange", () => {
  describe("meta", () => {
    it("has correct id, name, and fields", () => {
      expect(bitgetExchange.id).toBe("bitget");
      expect(bitgetExchange.name).toBe("Bitget");
      expect(bitgetExchange.fields).toEqual(["api_key", "secret", "passphrase"]);
    });

    it("has referral and api doc URLs", () => {
      expect(bitgetExchange.referral_url).toBeDefined();
      expect(bitgetExchange.api_doc_url).toBeDefined();
    });
  });

  describe("sign", () => {
    it("produces base64 HMAC-SHA256 signature with correct URL and headers", () => {
      const credentials = {
        api_key: "test-key",
        secret: "test-secret",
        passphrase: "test-pass",
      };
      const params = {
        method: "GET" as const,
        path: "/api/v2/spot/account/info",
        timestamp: "1700000000000",
      };

      const result = bitgetExchange.sign(credentials, params);

      expect(result.url).toBe("https://api.bitget.com/api/v2/spot/account/info");
      expect(result.headers["ACCESS-KEY"]).toBe("test-key");
      expect(result.headers["ACCESS-TIMESTAMP"]).toBe("1700000000000");
      expect(result.headers["ACCESS-PASSPHRASE"]).toBe("test-pass");
      expect(result.headers["Content-Type"]).toBe("application/json");
      // Signature should be base64
      expect(result.headers["ACCESS-SIGN"]).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it("includes body in prehash when provided", () => {
      const credentials = { api_key: "k", secret: "s", passphrase: "p" };
      const withBody = bitgetExchange.sign(credentials, {
        method: "POST",
        path: "/api/v2/spot/trade/order",
        timestamp: "1700000000000",
        body: '{"symbol":"BTCUSDT"}',
      });
      const withoutBody = bitgetExchange.sign(credentials, {
        method: "POST",
        path: "/api/v2/spot/trade/order",
        timestamp: "1700000000000",
      });
      // Different body should produce different signature
      expect(withBody.headers["ACCESS-SIGN"]).not.toBe(withoutBody.headers["ACCESS-SIGN"]);
    });

    it("produces correct known-value signature", () => {
      const credentials = { api_key: "my-key", secret: "my-secret", passphrase: "my-pass" };
      const params = {
        method: "GET" as const,
        path: "/test",
        timestamp: "1700000000000",
      };

      const result = bitgetExchange.sign(credentials, params);

      const expected = createHmac("sha256", "my-secret")
        .update("1700000000000GET/test")
        .digest("base64");
      expect(result.headers["ACCESS-SIGN"]).toBe(expected);
    });

    it("handles undefined passphrase gracefully", () => {
      const credentials = { api_key: "key", secret: "secret" };
      const params = { method: "GET" as const, path: "/api/v2/spot/account/info", timestamp: "123" };
      const result = bitgetExchange.sign(credentials, params);
      expect(result.headers["ACCESS-PASSPHRASE"]).toBe("");
    });
  });
});
