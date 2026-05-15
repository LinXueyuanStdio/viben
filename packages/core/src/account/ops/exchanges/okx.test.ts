// packages/core/src/account/ops/exchanges/okx.test.ts

import { describe, it, expect } from "vitest";
import { okxExchange } from "./okx";

describe("okxExchange", () => {
  describe("meta", () => {
    it("has correct id and fields", () => {
      expect(okxExchange.id).toBe("okx");
      expect(okxExchange.name).toBe("OKX");
      expect(okxExchange.fields).toEqual(["api_key", "secret", "passphrase"]);
    });

    it("has referral and api doc URLs", () => {
      expect(okxExchange.referral_url).toBeDefined();
      expect(okxExchange.api_doc_url).toBeDefined();
    });
  });

  describe("sign", () => {
    it("produces correct HMAC-SHA256 Base64 signature", () => {
      const credentials = {
        api_key: "test-key",
        secret: "test-secret",
        passphrase: "test-pass",
      };
      const params = {
        method: "GET" as const,
        path: "/api/v5/account/balance",
        timestamp: "2026-05-14T10:00:00.000Z",
      };

      const result = okxExchange.sign(credentials, params);

      expect(result.url).toBe("https://www.okx.com/api/v5/account/balance");
      expect(result.headers["OK-ACCESS-KEY"]).toBe("test-key");
      expect(result.headers["OK-ACCESS-PASSPHRASE"]).toBe("test-pass");
      expect(result.headers["OK-ACCESS-TIMESTAMP"]).toBe("2026-05-14T10:00:00.000Z");
      // Signature should be a base64 string
      expect(result.headers["OK-ACCESS-SIGN"]).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it("includes body in prehash when provided", () => {
      const credentials = { api_key: "k", secret: "s", passphrase: "p" };
      const withBody = okxExchange.sign(credentials, {
        method: "POST",
        path: "/api/v5/trade/order",
        timestamp: "2026-01-01T00:00:00Z",
        body: '{"instId":"BTC-USDT"}',
      });
      const withoutBody = okxExchange.sign(credentials, {
        method: "POST",
        path: "/api/v5/trade/order",
        timestamp: "2026-01-01T00:00:00Z",
      });
      // Different body should produce different signature
      expect(withBody.headers["OK-ACCESS-SIGN"]).not.toBe(withoutBody.headers["OK-ACCESS-SIGN"]);
    });
  });
});
