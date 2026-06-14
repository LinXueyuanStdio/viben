import type { ExchangeId } from "./types";

/**
 * Maps internal exchange IDs to TradingView exchange prefixes.
 */
const EXCHANGE_TV_MAP: Record<ExchangeId, string> = {
  binance: "BINANCE",
  okx: "OKX",
  bybit: "BYBIT",
  bitget: "BITGET",
  gate: "GATEIO",
};

/**
 * Converts an internal exchange + symbol pair to a TradingView-compatible symbol string.
 *
 * Examples:
 *   toTradingViewSymbol("binance", "BTC/USDT") => "BINANCE:BTCUSDT"
 *   toTradingViewSymbol("gate", "ETH/USDT")    => "GATEIO:ETHUSDT"
 *   toTradingViewSymbol("okx", "SOL/USDT")     => "OKX:SOLUSDT"
 */
export function toTradingViewSymbol(exchange: ExchangeId, symbol: string): string {
  const tvExchange = EXCHANGE_TV_MAP[exchange];
  const tvSymbol = symbol.replace("/", "");
  return `${tvExchange}:${tvSymbol}`;
}
