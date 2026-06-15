import type { Exchange } from "./types";
import type { ExchangeId } from "../types";
import { binance } from "./binance";
import { binanceDemo } from "./binance-demo";
import { binanceFutures } from "./binance-futures";
import { okx } from "./okx";

const exchanges: Record<string, Exchange> = {
  binance,
  binance_futures: binanceFutures,
  okx,
};

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
