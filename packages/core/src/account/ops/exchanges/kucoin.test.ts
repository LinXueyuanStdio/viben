// packages/core/src/account/ops/exchanges/kucoin.test.ts

import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { kucoinExchange } from "./kucoin";

describe("kucoinExchange", () => {
  describe("meta", () => {
    it("has correct id, name, and fields", () => {
      expect(kucoinExchange.id).toBe("kucoin");
      expect(kucoinExchange.name).toBe("KuCoin");
      expect(kucoinExchange.fields).toEqual(["api_key", "secret", "passphrase"]);
    });

    it("has referral and api doc URLs", () => {
      expect(kucoinExchange.referral_url).toBeDefined();
      expect(kucoinExchange.api_doc_url).toBeDefined();
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
        path: "/api/v1/accounts",
        timestamp: "1700000000000",
      };

      const result = kucoinExchange.sign(credentials, params);

      expect(result.url).toBe("https://api.kucoin.com/api/v1/accounts");
      expect(result.headers["KC-API-KEY"]).toBe("test-key");
      expect(result.headers["KC-API-TIMESTAMP"]).toBe("1700000000000");
      expect(result.headers["KC-API-KEY-VERSION"]).toBe("2");
      expect(result.headers["Content-Type"]).toBe("application/json");
      // Signature should be base64
      expect(result.headers["KC-API-SIGN"]).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it("passphrase is HMAC-signed (not raw passphrase in header)", () => {
      const credentials = {
        api_key: "test-key",
        secret: "test-secret",
        passphrase: "test-pass",
      };
      const params = {
        method: "GET" as const,
        path: "/api/v1/accounts",
        timestamp: "1700000000000",
      };

      const result = kucoinExchange.sign(credentials, params);

      // The passphrase header should NOT be the raw passphrase
      expect(result.headers["KC-API-PASSPHRASE"]).not.toBe("test-pass");
      // It should be HMAC-SHA256(secret, passphrase) base64
      const expectedPassphrase = createHmac("sha256", "test-secret")
        .update("test-pass")
        .digest("base64");
      expect(result.headers["KC-API-PASSPHRASE"]).toBe(expectedPassphrase);
    });

    it("produces correct known-value signature", () => {
      const credentials = { api_key: "my-key", secret: "my-secret", passphrase: "my-pass" };
      const params = {
        method: "GET" as const,
        path: "/test",
        timestamp: "1700000000000",
      };

      const result = kucoinExchange.sign(credentials, params);

      const expectedSign = createHmac("sha256", "my-secret")
        .update("1700000000000GET/test")
        .digest("base64");
      expect(result.headers["KC-API-SIGN"]).toBe(expectedSign);

      const expectedPassphrase = createHmac("sha256", "my-secret")
        .update("my-pass")
        .digest("base64");
      expect(result.headers["KC-API-PASSPHRASE"]).toBe(expectedPassphrase);
    });

    it("includes body in prehash for POST requests", () => {
      const { createHmac } = require("node:crypto");
      const credentials = { api_key: "key", secret: "secret", passphrase: "pass" };
      const params = {
        method: "POST" as const,
        path: "/api/v1/orders",
        timestamp: "1700000000000",
        body: '{"symbol":"BTC-USDT"}',
      };
      const result = kucoinExchange.sign(credentials, params);

      const expectedPrehash = "1700000000000POST/api/v1/orders{\"symbol\":\"BTC-USDT\"}";
      const expectedSig = createHmac("sha256", "secret").update(expectedPrehash).digest("base64");
      expect(result.headers["KC-API-SIGN"]).toBe(expectedSig);
      expect(result.body).toBeUndefined(); // sign doesn't set body on result
    });

    it("handles undefined passphrase in HMAC signing", () => {
      const { createHmac } = require("node:crypto");
      const credentials = { api_key: "key", secret: "secret" };
      const params = { method: "GET" as const, path: "/test", timestamp: "123" };
      const result = kucoinExchange.sign(credentials, params);

      const expectedPassphraseSig = createHmac("sha256", "secret").update("").digest("base64");
      expect(result.headers["KC-API-PASSPHRASE"]).toBe(expectedPassphraseSig);
    });
  });
});
