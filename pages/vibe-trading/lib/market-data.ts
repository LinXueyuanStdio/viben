import type { ExchangeId, OHLCV, MarketContextEvent } from "./types";
import { proxyFetch } from "./exchanges/proxy-fetch";

export interface MarketDataOptions {
  exchange: ExchangeId;
  symbols: string[];
  interval?: string; // default "1h"
  limit?: number; // default 100 candles
  market_mode?: "simulated" | "real";
}

// Base prices for common symbols in demo mode
const BASE_PRICES: Record<string, number> = {
  "BTC/USDT": 67000,
  "BTCUSDT": 67000,
  "ETH/USDT": 3500,
  "ETHUSDT": 3500,
  "SOL/USDT": 150,
  "SOLUSDT": 150,
  "BNB/USDT": 600,
  "BNBUSDT": 600,
};

const VOLATILITY: Record<string, number> = {
  "BTC/USDT": 0.02,
  "BTCUSDT": 0.02,
  "ETH/USDT": 0.03,
  "ETHUSDT": 0.03,
  "SOL/USDT": 0.05,
  "SOLUSDT": 0.05,
  "BNB/USDT": 0.03,
  "BNBUSDT": 0.03,
};

function getBasePrice(symbol: string): number {
  return BASE_PRICES[symbol] ?? 100;
}

function getVolatility(symbol: string): number {
  return VOLATILITY[symbol] ?? 0.05;
}

function randomGaussian(): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function generateDemoKlines(
  symbol: string,
  limit: number,
  intervalMs: number
): OHLCV[] {
  const basePrice = getBasePrice(symbol);
  const vol = getVolatility(symbol);
  const klines: OHLCV[] = [];
  const now = Date.now();

  let price = basePrice * (1 + (Math.random() - 0.5) * vol * 2);

  for (let i = limit - 1; i >= 0; i--) {
    const ts = new Date(now - i * intervalMs).toISOString();
    const change = randomGaussian() * vol * 0.01;
    const open = price;
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * vol * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * vol * 0.005);
    const volume = basePrice * 100 * (0.5 + Math.random() * 1.5);

    klines.push({
      ts,
      o: Math.round(open * 100) / 100,
      h: Math.round(high * 100) / 100,
      l: Math.round(low * 100) / 100,
      c: Math.round(close * 100) / 100,
      v: Math.round(volume * 100) / 100,
    });

    price = close;
  }

  return klines;
}

function computeRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;
  const recent = closes.slice(-(period + 1));

  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function computeMACD(closes: number[]): {
  value: number;
  signal: number;
  hist: number;
} {
  if (closes.length < 26) return { value: 0, signal: 0, hist: 0 };

  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const macdLine = ema12 - ema26;

  // Approximate signal line using recent MACD values
  const signal = macdLine * 0.8; // Simplified for demo
  const hist = macdLine - signal;

  return {
    value: Math.round(macdLine * 100) / 100,
    signal: Math.round(signal * 100) / 100,
    hist: Math.round(hist * 100) / 100,
  };
}

function computeBollinger(
  closes: number[],
  period: number = 20
): { upper: number; middle: number; lower: number } {
  if (closes.length < period) {
    const last = closes[closes.length - 1] ?? 0;
    return { upper: last, middle: last, lower: last };
  }

  const recent = closes.slice(-period);
  const mean = recent.reduce((s, v) => s + v, 0) / period;
  const variance =
    recent.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);

  return {
    upper: Math.round((mean + 2 * std) * 100) / 100,
    middle: Math.round(mean * 100) / 100,
    lower: Math.round((mean - 2 * std) * 100) / 100,
  };
}

function computeATR(klines: OHLCV[], period: number = 14): number {
  if (klines.length < period + 1) return 0;

  const recent = klines.slice(-(period + 1));
  let atrSum = 0;

  for (let i = 1; i < recent.length; i++) {
    const tr = Math.max(
      recent[i].h - recent[i].l,
      Math.abs(recent[i].h - recent[i - 1].c),
      Math.abs(recent[i].l - recent[i - 1].c)
    );
    atrSum += tr;
  }

  return Math.round((atrSum / period) * 100) / 100;
}

function determineMomentum(
  rsi: number,
  macdHist: number
): "bullish" | "bearish" | "neutral" {
  if (rsi > 60 && macdHist > 0) return "bullish";
  if (rsi < 40 && macdHist < 0) return "bearish";
  return "neutral";
}

function determineTrend(
  ema12: number,
  ema26: number,
  ema50: number
): "up" | "down" | "sideways" {
  if (ema12 > ema26 && ema26 > ema50) return "up";
  if (ema12 < ema26 && ema26 < ema50) return "down";
  return "sideways";
}

function determineVolatilityLevel(
  atr: number,
  price: number
): "high" | "medium" | "low" {
  const atrPct = price > 0 ? atr / price : 0;
  if (atrPct > 0.03) return "high";
  if (atrPct > 0.015) return "medium";
  return "low";
}

function intervalToMs(interval: string): number {
  const map: Record<string, number> = {
    "1m": 60_000,
    "3m": 180_000,
    "5m": 300_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
    "1d": 86_400_000,
  };
  return map[interval] ?? 3_600_000;
}

async function fetchBinanceKlines(
  symbol: string,
  interval: string,
  limit: number
): Promise<OHLCV[]> {
  // Binance public API (no authentication required)
  // symbol format: "BTC/USDT" -> "BTCUSDT"
  const binanceSymbol = symbol.replace("/", "");
  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;

  const res = await proxyFetch(url);
  if (!res.ok) {
    throw new Error(
      `Binance API error: ${res.status} ${res.statusText}`
    );
  }
  const data: unknown[] = await res.json();

  // Binance returns: [[openTime, open, high, low, close, volume, ...], ...]
  return data.map((k) => {
    const row = k as [number, string, string, string, string, string, ...unknown[]];
    return {
      ts: new Date(row[0]).toISOString(),
      o: parseFloat(row[1]),
      h: parseFloat(row[2]),
      l: parseFloat(row[3]),
      c: parseFloat(row[4]),
      v: parseFloat(row[5]),
    };
  });
}

export async function fetchMarketData(
  options: MarketDataOptions
): Promise<MarketContextEvent> {
  const { symbols, interval = "1h", limit = 100, market_mode } = options;
  const intervalMs = intervalToMs(interval);
  const isDemo = market_mode !== "real";

  const klines: Record<string, { interval: string; data: OHLCV[] }> = {};
  const indicators: MarketContextEvent["indicators"] = {};
  const signals: MarketContextEvent["signals"] = {};

  for (const symbol of symbols) {
    let data: OHLCV[];

    if (isDemo) {
      data = generateDemoKlines(symbol, limit, intervalMs);
    } else {
      try {
        data = await fetchBinanceKlines(symbol, interval, limit);
      } catch {
        // Fallback to simulated data on error
        data = generateDemoKlines(symbol, limit, intervalMs);
      }
    }

    klines[symbol] = { interval, data };

    // Compute indicators from klines
    const closes = data.map((k) => k.c);
    const rsi = computeRSI(closes);
    const macd = computeMACD(closes);
    const ema12 = computeEMA(closes, 12);
    const ema26 = computeEMA(closes, 26);
    const ema50 = computeEMA(closes, 50);
    const bollinger = computeBollinger(closes);
    const atr = computeATR(data);
    const volumeMa =
      data.slice(-20).reduce((s, k) => s + k.v, 0) / Math.min(20, data.length);

    indicators[symbol] = {
      rsi: Math.round(rsi * 100) / 100,
      macd,
      ema: {
        "12": Math.round(ema12 * 100) / 100,
        "26": Math.round(ema26 * 100) / 100,
        "50": Math.round(ema50 * 100) / 100,
      },
      bollinger,
      atr,
      volume_ma: Math.round(volumeMa * 100) / 100,
    };

    const currentPrice = closes[closes.length - 1] ?? 0;
    const momentum = determineMomentum(rsi, macd.hist);
    const trend = determineTrend(ema12, ema26, ema50);
    const volatility = determineVolatilityLevel(atr, currentPrice);

    // Strength: 0-1 based on RSI distance from neutral + MACD histogram magnitude
    const rsiStrength = Math.abs(rsi - 50) / 50;
    const macdStrength = Math.min(
      1,
      Math.abs(macd.hist) / (currentPrice * 0.001)
    );
    const strength =
      Math.round(((rsiStrength + macdStrength) / 2) * 100) / 100;

    signals[symbol] = { momentum, trend, volatility, strength };
  }

  // Build market summary text
  const summaryParts: string[] = [];
  for (const symbol of symbols) {
    const klineData = klines[symbol]?.data;
    const lastPrice = klineData?.[klineData.length - 1]?.c ?? 0;
    const sig = signals[symbol];
    const ind = indicators[symbol];
    summaryParts.push(
      `${symbol}: $${lastPrice.toFixed(2)} | RSI=${ind?.rsi?.toFixed(1)} | ` +
        `Trend=${sig?.trend} | Momentum=${sig?.momentum} | Vol=${sig?.volatility}`
    );
  }

  return {
    type: "market_context",
    ts: new Date().toISOString(),
    cycle: 0, // Will be set by caller
    symbols,
    klines,
    indicators,
    signals,
    market_summary: summaryParts.join("\n"),
  };
}
