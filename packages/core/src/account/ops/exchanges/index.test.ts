import { describe, it, expect } from "vitest";
import { getExchange, listExchanges } from "./index";

describe("exchanges registry", () => {
  describe("getExchange", () => {
    it("returns OKX exchange for 'okx'", () => {
      const ex = getExchange("okx");
      expect(ex.id).toBe("okx");
      expect(ex.name).toBe("OKX");
    });

    it("returns Binance exchange for 'binance'", () => {
      const ex = getExchange("binance");
      expect(ex.id).toBe("binance");
    });

    it("returns all 7 exchanges by ID", () => {
      const ids = ["okx", "binance", "bitget", "bybit", "gate", "kucoin", "lighter"] as const;
      for (const id of ids) {
        const ex = getExchange(id);
        expect(ex.id).toBe(id);
        expect(ex.sign).toBeDefined();
        expect(ex.testConnection).toBeDefined();
      }
    });

    it("throws for unknown exchange ID", () => {
      expect(() => getExchange("unknown" as any)).toThrow("Exchange not implemented: unknown");
    });
  });

  describe("listExchanges", () => {
    it("returns all 7 exchanges", () => {
      const exchanges = listExchanges();
      expect(exchanges).toHaveLength(7);
    });

    it("includes all expected exchange IDs", () => {
      const exchanges = listExchanges();
      const ids = exchanges.map((e) => e.id);
      expect(ids).toContain("okx");
      expect(ids).toContain("binance");
      expect(ids).toContain("bitget");
      expect(ids).toContain("bybit");
      expect(ids).toContain("gate");
      expect(ids).toContain("kucoin");
      expect(ids).toContain("lighter");
    });

    it("each exchange has required fields", () => {
      const exchanges = listExchanges();
      for (const ex of exchanges) {
        expect(ex.id).toBeDefined();
        expect(ex.name).toBeDefined();
        expect(ex.fields).toBeDefined();
        expect(ex.fields.length).toBeGreaterThan(0);
      }
    });
  });
});
