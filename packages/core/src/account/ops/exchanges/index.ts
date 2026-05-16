import type { ExchangeId } from "../types";
import type { Exchange } from "./types";
import { okxExchange } from "./okx";
import { binanceExchange } from "./binance";
import { bitgetExchange } from "./bitget";
import { bybitExchange } from "./bybit";
import { gateExchange } from "./gate";
import { kucoinExchange } from "./kucoin";
import { lighterExchange } from "./lighter";

export type { Exchange, Credentials, SignParams, SignedRequest } from "./types";

const EXCHANGES: Record<ExchangeId, Exchange> = {
  okx: okxExchange,
  binance: binanceExchange,
  bitget: bitgetExchange,
  bybit: bybitExchange,
  gate: gateExchange,
  kucoin: kucoinExchange,
  lighter: lighterExchange,
};

export function getExchange(id: ExchangeId): Exchange {
  const exchange = EXCHANGES[id];
  if (!exchange) throw new Error(`Exchange not implemented: ${id}`);
  return exchange;
}

export function listExchanges(): Exchange[] {
  return Object.values(EXCHANGES);
}
