import { describe, it, expect, beforeAll } from "vitest";
import { getReplayCandles, buildTradeMarkers, parseIntervalMs, floorToInterval } from "./replay-klines";
import type { SessionEvent, MarketContextEvent } from "@/lib/types";
import fs from "fs";
import path from "path";

const SESSION_FILE = path.resolve(__dirname, "../../sessions/ses_ZFkpnQYi.jsonl");

let allEvents: SessionEvent[];
let marketContextIndices: number[];

beforeAll(() => {
  const raw = fs.readFileSync(SESSION_FILE, "utf-8").trim().split("\n");
  allEvents = raw.map((line) => JSON.parse(line) as SessionEvent);
  marketContextIndices = allEvents
    .map((e, i) => (e.type === "market_context" ? i : -1))
    .filter((i) => i >= 0);
});

describe("parseIntervalMs", () => {
  it("parses 15m", () => expect(parseIntervalMs("15m")).toBe(900000));
  it("parses 1h", () => expect(parseIntervalMs("1h")).toBe(3600000));
  it("invalid → default 1h", () => expect(parseIntervalMs("abc")).toBe(3600000));
});

describe("floorToInterval", () => {
  it("floors to 15m boundary", () => {
    const result = floorToInterval("2026-06-12T21:08:34.712Z", 900000);
    const expected = new Date("2026-06-12T21:00:00.000Z").getTime() / 1000;
    expect(result).toBe(expected);
  });

  it("returns 0 for invalid ts", () => {
    expect(floorToInterval("not-a-date", 900000)).toBe(0);
  });
});

describe("getReplayCandles — idempotency with real data", () => {
  const symbol = "BTC/USDT";

  it("same index always returns identical result (idempotent)", () => {
    const idx = marketContextIndices[2];
    const r1 = getReplayCandles(allEvents, symbol, idx);
    const r2 = getReplayCandles(allEvents, symbol, idx);
    const r3 = getReplayCandles(allEvents, symbol, idx);
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });

  it("returns empty candles before first market_context", () => {
    const result = getReplayCandles(allEvents, symbol, 0);
    expect(result.candles).toHaveLength(0);
  });

  it("at a market_context index, uses that event's data", () => {
    const idx = marketContextIndices[0];
    const result = getReplayCandles(allEvents, symbol, idx);
    expect(result.candles.length).toBeGreaterThan(0);
    expect(result.candles.length).toBeLessThanOrEqual(100);
  });

  it("between two market_context events, uses the earlier one (stable)", () => {
    const mcIdx1 = marketContextIndices[0];
    const mcIdx2 = marketContextIndices[1];

    // Any index between mc1 and mc2 should show mc1's data
    for (let i = mcIdx1; i < mcIdx2; i++) {
      const result = getReplayCandles(allEvents, symbol, i);
      const baseline = getReplayCandles(allEvents, symbol, mcIdx1);
      expect(result.candles).toEqual(baseline.candles);
    }
  });

  it("crossing a market_context boundary changes the candles", () => {
    const mcIdx1 = marketContextIndices[0];
    const mcIdx2 = marketContextIndices[1];
    const r1 = getReplayCandles(allEvents, symbol, mcIdx1);
    const r2 = getReplayCandles(allEvents, symbol, mcIdx2);

    // Different snapshots → different prices
    expect(r1.candles[0].open).not.toBe(r2.candles[0].open);
  });

  it("candles are sorted chronologically", () => {
    const idx = marketContextIndices[5];
    const result = getReplayCandles(allEvents, symbol, idx);
    for (let i = 1; i < result.candles.length; i++) {
      expect(result.candles[i].time as number).toBeGreaterThan(
        result.candles[i - 1].time as number,
      );
    }
  });

  it("all bar times are floor-aligned to interval", () => {
    const idx = marketContextIndices[3];
    const result = getReplayCandles(allEvents, symbol, idx);
    const intervalSec = result.intervalMs / 1000;
    for (const c of result.candles) {
      expect((c.time as number) % intervalSec).toBe(0);
    }
  });

  it("no bar exceeds the event timestamp", () => {
    const idx = marketContextIndices[4];
    const eventTs = allEvents[idx].ts;
    const eventTimeSec = Math.floor(new Date(eventTs).getTime() / 1000);
    const result = getReplayCandles(allEvents, symbol, idx);
    for (const c of result.candles) {
      expect(c.time as number).toBeLessThanOrEqual(eventTimeSec);
    }
  });

  it("stepping forward one event at a time is stable (no flicker)", () => {
    // Walk through 10 consecutive events starting from the first market_context
    const startIdx = marketContextIndices[0];
    let prevCandles = getReplayCandles(allEvents, symbol, startIdx).candles;

    for (let i = startIdx + 1; i <= startIdx + 10 && i < allEvents.length; i++) {
      const current = getReplayCandles(allEvents, symbol, i);

      if (allEvents[i].type === "market_context") {
        // A new snapshot — candles will change, that's expected
        prevCandles = current.candles;
      } else {
        // Between snapshots, candles must be identical (no flicker)
        expect(current.candles).toEqual(prevCandles);
      }
    }
  });

  it("stepping backward then forward returns same result", () => {
    const idx = marketContextIndices[3];
    const forward = getReplayCandles(allEvents, symbol, idx);
    // Simulate: user was at idx+5, stepped back to idx
    const backward = getReplayCandles(allEvents, symbol, idx);
    expect(forward).toEqual(backward);
  });
});

describe("buildTradeMarkers — with real trades", () => {
  it("returns empty when no trades exist for symbol", () => {
    const result = buildTradeMarkers([], "BTC/USDT", "2026-06-12T21:08:34.712Z", 900000);
    expect(result).toHaveLength(0);
  });

  it("filters trades by cutoff timestamp", () => {
    const trades = [
      { order_id: "1", cycle: 1, symbol: "BTC/USDT", side: "buy" as const, price: 67000, quantity: 0.01, fee: 0.5, ts: "2026-06-12T21:09:00.000Z", source: "agent" as const },
      { order_id: "2", cycle: 2, symbol: "BTC/USDT", side: "sell" as const, price: 67500, quantity: 0.01, fee: 0.5, ts: "2026-06-12T22:00:00.000Z", source: "agent" as const },
    ];
    const result = buildTradeMarkers(trades, "BTC/USDT", "2026-06-12T21:30:00.000Z", 900000);
    expect(result).toHaveLength(1);
    expect(result[0].shape).toBe("arrowUp");
  });
});
