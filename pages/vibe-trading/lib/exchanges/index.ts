import type { Exchange } from "./types";
import type { ExchangeId } from "../types";
import { binance } from "./binance";
import { binanceDemo } from "./binance-demo";
import { okx } from "./okx";

const exchanges: Record<string, Exchange> = { binance, okx };

export function getExchange(id: ExchangeId, isDemo?: boolean): Exchange {
  if (isDemo) return binanceDemo;
  const ex = exchanges[id];
  if (!ex) throw new Error(`Exchange "${id}" not supported`);
  return ex;
}

export function listExchanges(): ExchangeId[] {
  return Object.keys(exchanges) as ExchangeId[];
}

export type { Exchange, Credentials, OrderParams, OrderResponse, BalanceInfo } from "./types";
