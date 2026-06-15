import type { CandlestickData, SeriesMarker, Time } from "lightweight-charts";
import type { SessionEvent, MarketContextEvent, TradeRecord, Position } from "@/lib/types";

export function parseIntervalMs(interval: string): number {
  const num = parseInt(interval);
  if (isNaN(num)) return 3600 * 1000;
  if (interval.endsWith("m")) return num * 60 * 1000;
  if (interval.endsWith("h")) return num * 3600 * 1000;
  if (interval.endsWith("d")) return num * 86400 * 1000;
  return 3600 * 1000;
}

export function floorToInterval(isoTs: string, intervalMs: number): number {
  const ms = new Date(isoTs).getTime();
  if (isNaN(ms)) return 0;
  return Math.floor(ms / intervalMs) * intervalMs / 1000;
}

export interface ReplayCandleResult {
  candles: CandlestickData<Time>[];
  intervalMs: number;
}

/**
 * Pure function: given all events and a target index, return the candles to display.
 * Uses the most recent market_context event at or before upToIndex as the data source.
 * Does NOT merge across multiple market_context events — each is a complete snapshot.
 */
export function getReplayCandles(
  events: SessionEvent[],
  symbol: string,
  upToIndex: number,
): ReplayCandleResult {
  // Find the last market_context for this symbol at or before upToIndex
  let lastMc: MarketContextEvent | null = null;
  for (let i = upToIndex; i >= 0; i--) {
    const e = events[i];
    if (e.type === "market_context") {
      const mc = e as MarketContextEvent;
      if (mc.klines[symbol]) {
        lastMc = mc;
        break;
      }
    }
  }

  if (!lastMc) return { candles: [], intervalMs: 3600000 };

  const klineEntry = lastMc.klines[symbol];
  const intervalMs = parseIntervalMs(klineEntry.interval);

  // Floor-align each bar to interval boundaries and deduplicate
  const map = new Map<number, CandlestickData<Time>>();
  for (const bar of klineEntry.data) {
    const timeSec = floorToInterval(bar.ts, intervalMs);
    if (timeSec === 0) continue;
    map.set(timeSec, {
      time: timeSec as Time,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
    });
  }

  // Filter: only include bars up to the event's own timestamp (floored)
  const eventTimeSec = floorToInterval(lastMc.ts, intervalMs);
  const result: CandlestickData<Time>[] = [];
  for (const [timeSec, bar] of map) {
    if (timeSec <= eventTimeSec) result.push(bar);
  }

  result.sort((a, b) => (a.time as number) - (b.time as number));
  return { candles: result, intervalMs };
}

export function buildTradeMarkers(
  trades: TradeRecord[],
  symbol: string,
  cutoffTs: string,
  intervalMs: number,
): SeriesMarker<Time>[] {
  if (!cutoffTs) return [];
  const cutoffTime = new Date(cutoffTs).getTime();
  if (isNaN(cutoffTime)) return [];

  return trades
    .filter((t) => t.symbol === symbol && new Date(t.ts).getTime() <= cutoffTime)
    .map((t) => ({
      time: floorToInterval(t.ts, intervalMs) as Time,
      position: t.side === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
      shape: t.side === "buy" ? ("arrowUp" as const) : ("arrowDown" as const),
      color: t.side === "buy" ? "#16a34a" : "#dc2626",
      text: `${t.side === "buy" ? "B" : "S"} ${t.price.toFixed(2)}`,
      size: 1,
    }));
}

export interface PriceLineConfig {
  price: number;
  color: string;
  lineStyle: number;
  lineWidth: number;
  title: string;
  axisLabelVisible: boolean;
}

export function buildPriceLines(positions: Position[], symbol: string): PriceLineConfig[] {
  const lines: PriceLineConfig[] = [];
  const symbolPositions = positions.filter((p) => p.symbol === symbol);

  symbolPositions.forEach((pos, idx) => {
    const suffix = symbolPositions.length > 1
      ? ` ${pos.side === "long" ? "多" : "空"}#${idx + 1}`
      : "";

    lines.push({
      price: pos.entry_price,
      color: "#0891b2",
      lineStyle: 0,
      lineWidth: 2,
      title: `入场${suffix}`,
      axisLabelVisible: true,
    });

    if (pos.stop_loss) {
      lines.push({
        price: pos.stop_loss,
        color: "#dc2626",
        lineStyle: 2,
        lineWidth: 1,
        title: `止损${suffix}`,
        axisLabelVisible: true,
      });
    }

    if (pos.take_profit) {
      lines.push({
        price: pos.take_profit,
        color: "#16a34a",
        lineStyle: 2,
        lineWidth: 1,
        title: `止盈${suffix}`,
        axisLabelVisible: true,
      });
    }

    if (pos.liquidation_price) {
      lines.push({
        price: pos.liquidation_price,
        color: "#f97316",
        lineStyle: 1,
        lineWidth: 1,
        title: `强平${suffix}`,
        axisLabelVisible: true,
      });
    }
  });

  return lines;
}
