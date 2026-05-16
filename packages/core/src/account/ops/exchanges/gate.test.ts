// packages/core/src/account/ops/exchanges/gate.test.ts

import { createHmac, createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { gateExchange } from "./gate";

describe("gateExchange", () => {
  describe("meta", () => {
    it("has correct id, name, and fields", () => {
      expect(gateExchange.id).toBe("gate");
      expect(gateExchange.name).toBe("Gate");
      expect(gateExchange.fields).toEqual(["api_key", "secret"]);
    });

    it("has referral and api doc URLs", () => {
      expect(gateExchange.referral_url).toBeDefined();
      expect(gateExchange.api_doc_url).toBeDefined();
    });
  });

  describe("sign", () => {
    it("produces hex HMAC-SHA512 signature with correct URL and headers", () => {
      const credentials = { api_key: "test-key", secret: "test-secret" };
      const params = {
        method: "GET" as const,
        path: "/api/v4/spot/accounts",
        timestamp: "1700000000",
      };

      const result = gateExchange.sign(credentials, params);

      expect(result.url).toBe("https://api.gateio.ws/api/v4/spot/accounts");
      expect(result.headers["KEY"]).toBe("test-key");
      expect(result.headers["Timestamp"]).toBe("1700000000");
      expect(result.headers["Content-Type"]).toBe("application/json");
      // SHA512 hex signature is 128 chars
      expect(result.headers["SIGN"]).toMatch(/^[a-f0-9]{128}$/);
    });

    it("body hashing affects signature", () => {
      const credentials = { api_key: "k", secret: "s" };
      const withBody = gateExchange.sign(credentials, {
        method: "POST",
        path: "/api/v4/spot/orders",
        timestamp: "1700000000",
        body: '{"currency_pair":"BTC_USDT","amount":"0.01"}',
      });
      const withoutBody = gateExchange.sign(credentials, {
        method: "POST",
        path: "/api/v4/spot/orders",
        timestamp: "1700000000",
      });
      // Different body produces different signature
      expect(withBody.headers["SIGN"]).not.toBe(withoutBody.headers["SIGN"]);
    });

    it("produces correct known-value signature", () => {
      const credentials = { api_key: "my-key", secret: "my-secret" };
      const params = {
        method: "GET" as const,
        path: "/test",
        timestamp: "1700000000",
      };

      const result = gateExchange.sign(credentials, params);

      const hashedBody = createHash("sha512").update("").digest("hex");
      const prehash = `GET\n/test\n\n${hashedBody}\n1700000000`;
      const expected = createHmac("sha512", "my-secret")
        .update(prehash)
        .digest("hex");
      expect(result.headers["SIGN"]).toBe(expected);
    });

    it("includes params in query string and URL", () => {
      const credentials = { api_key: "key", secret: "secret" };
      const params = {
        method: "GET" as const,
        path: "/api/v4/spot/accounts",
        timestamp: "1700000000",
        params: { currency: "BTC", limit: "10" },
      };
      const result = gateExchange.sign(credentials, params);
      expect(result.url).toContain("currency=BTC");
      expect(result.url).toContain("limit=10");
      expect(result.url).toBe("https://api.gateio.ws/api/v4/spot/accounts?currency=BTC&limit=10");
    });

    it("params affect the computed signature", () => {
      const credentials = { api_key: "k", secret: "s" };
      const base = { method: "GET" as const, path: "/api/v4/spot/accounts", timestamp: "123" };
      const withParams = gateExchange.sign(credentials, { ...base, params: { currency: "BTC" } });
      const withoutParams = gateExchange.sign(credentials, { ...base });
      expect(withParams.headers["SIGN"]).not.toBe(withoutParams.headers["SIGN"]);
    });
  });
});
