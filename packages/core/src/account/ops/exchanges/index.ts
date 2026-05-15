// packages/core/src/account/ops/exchanges/index.ts

import type { ExchangeId } from "../types";
import type { Exchange } from "./types";
import { okxExchange } from "./okx";

export type { Exchange, Credentials, SignParams, SignedRequest } from "./types";

const EXCHANGES: Record<ExchangeId, Exchange> = {
  okx: okxExchange,
  binance: undefined as unknown as Exchange, // placeholder, filled in Task 3
  bitget: undefined as unknown as Exchange,
  bybit: undefined as unknown as Exchange,
  gate: undefined as unknown as Exchange,
  kucoin: undefined as unknown as Exchange,
  lighter: undefined as unknown as Exchange,
};

export function getExchange(id: ExchangeId): Exchange {
  const exchange = EXCHANGES[id];
  if (!exchange) throw new Error(`Exchange not implemented: ${id}`);
  return exchange;
}

export function listExchanges(): Exchange[] {
  return Object.values(EXCHANGES).filter(Boolean);
}
