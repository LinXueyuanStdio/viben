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
  });
});
