// packages/core/src/account/ops/exchanges/lighter.test.ts

import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { lighterExchange } from "./lighter";

describe("lighterExchange", () => {
  describe("meta", () => {
    it("has correct id, name, and fields", () => {
      expect(lighterExchange.id).toBe("lighter");
      expect(lighterExchange.name).toBe("Lighter");
      expect(lighterExchange.fields).toEqual(["api_key", "secret"]);
    });

    it("has referral and api doc URLs", () => {
      expect(lighterExchange.referral_url).toBeDefined();
      expect(lighterExchange.api_doc_url).toBeDefined();
    });
  });

  describe("sign", () => {
    it("produces hex HMAC-SHA256 signature with correct URL and headers", () => {
      const credentials = { api_key: "test-key", secret: "test-secret" };
      const params = {
        method: "GET" as const,
        path: "/api/v1/account",
        timestamp: "1700000000000",
      };

      const result = lighterExchange.sign(credentials, params);

      expect(result.url).toBe("https://api.lighter.xyz/api/v1/account");
      expect(result.headers["X-API-KEY"]).toBe("test-key");
      expect(result.headers["X-API-TIMESTAMP"]).toBe("1700000000000");
      expect(result.headers["Content-Type"]).toBe("application/json");
      // SHA256 hex signature is 64 chars
      expect(result.headers["X-API-SIGNATURE"]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("body changes signature", () => {
      const credentials = { api_key: "k", secret: "s" };
      const withBody = lighterExchange.sign(credentials, {
        method: "POST",
        path: "/api/v1/order",
        timestamp: "1700000000000",
        body: '{"pair":"BTC-USD","size":"0.1"}',
      });
      const withoutBody = lighterExchange.sign(credentials, {
        method: "POST",
        path: "/api/v1/order",
        timestamp: "1700000000000",
      });
      // Different body should produce different signature
      expect(withBody.headers["X-API-SIGNATURE"]).not.toBe(withoutBody.headers["X-API-SIGNATURE"]);
    });

    it("produces correct known-value signature", () => {
      const credentials = { api_key: "my-key", secret: "my-secret" };
      const params = {
        method: "GET" as const,
        path: "/test",
        timestamp: "1700000000000",
      };

      const result = lighterExchange.sign(credentials, params);

      const expected = createHmac("sha256", "my-secret")
        .update("1700000000000GET/test")
        .digest("hex");
      expect(result.headers["X-API-SIGNATURE"]).toBe(expected);
    });

    it("undefined body produces same signature as empty string body", () => {
      const credentials = { api_key: "k", secret: "s" };
      const base = { method: "GET" as const, path: "/api/v1/account", timestamp: "123" };
      const undefinedBody = lighterExchange.sign(credentials, { ...base });
      const emptyBody = lighterExchange.sign(credentials, { ...base, body: "" });
      expect(undefinedBody.headers["X-API-SIGNATURE"]).toBe(emptyBody.headers["X-API-SIGNATURE"]);
    });
  });
});
