import { createHmac } from "node:crypto";
import type { Credentials, Exchange, OrderParams, OrderResponse, BalanceInfo } from "./types";
import type { Position } from "../types";
import { proxyFetch } from "./proxy-fetch";

const BASE_URL = "https://fapi.binance.com";

function sign(queryString: string, secret: string): string {
  return createHmac("sha256", secret).update(queryString).digest("hex");
}

async function request(
  method: string,
  path: string,
  creds: Credentials,
  params: Record<string, string> = {}
): Promise<unknown> {
  const timestamp = Date.now().toString();
  const allParams = { ...params, timestamp, recvWindow: "5000" };
  const queryString = new URLSearchParams(allParams).toString();
  const signature = sign(queryString, creds.secret);
  const url = `${BASE_URL}${path}?${queryString}&signature=${signature}`;

  const res = await proxyFetch(url, {
    method,
    headers: { "X-MBX-APIKEY": creds.api_key },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Binance Futures API error ${res.status}: ${body}`);
  }

  return res.json();
}

export const binanceFutures: Exchange = {
  id: "binance_futures",
  name: "Binance Futures",

  async placeOrder(creds, params) {
    const body: Record<string, string> = {
      symbol: params.symbol.replace("/", ""),
      side: params.side.toUpperCase(),
      type: params.type.toUpperCase(),
      quantity: params.quantity.toString(),
    };

    if (params.type === "limit" && params.price) {
      body.price = params.price.toString();
      body.timeInForce = "GTC";
    }

    if (params.position_side) {
      body.positionSide = params.position_side;
    }

    if (params.reduce_only) {
      body.reduceOnly = "true";
    }

    const data = (await request("POST", "/fapi/v1/order", creds, body)) as {
      orderId: number;
      status: string;
      avgPrice: string;
      executedQty: string;
      cumQuote: string;
    };

    const filledQty = parseFloat(data.executedQty);
    const avgPrice = parseFloat(data.avgPrice);
    const cumQuote = parseFloat(data.cumQuote);
    const fee = cumQuote * 0.0004; // taker fee 0.04%

    let status: OrderResponse["status"];
    if (data.status === "FILLED") status = "filled";
    else if (data.status === "PARTIALLY_FILLED") status = "partial_filled";
    else if (data.status === "EXPIRED") status = "expired";
    else status = "rejected";

    return {
      order_id: data.orderId.toString(),
      status,
      filled_price: avgPrice,
      filled_quantity: filledQty,
      fee,
      fee_asset: "USDT",
    };
  },

  async cancelOrder(creds, orderId, symbol) {
    try {
      await request("DELETE", "/fapi/v1/order", creds, {
        symbol: symbol.replace("/", ""),
        orderId,
      });
      return true;
    } catch {
      return false;
    }
  },

  async getBalance(creds) {
    const data = (await request("GET", "/fapi/v2/balance", creds)) as Array<{
      asset: string;
      availableBalance: string;
      balance: string;
    }>;

    const balances: Record<string, number> = {};
    for (const item of data) {
      const available = parseFloat(item.availableBalance);
      if (available > 0) {
        balances[item.asset] = available;
      }
    }
    return { balances };
  },

  async getPositions(creds, symbols) {
    const data = (await request("GET", "/fapi/v2/positionRisk", creds)) as Array<{
      symbol: string;
      positionAmt: string;
      entryPrice: string;
      markPrice: string;
      unRealizedProfit: string;
      liquidationPrice: string;
      leverage: string;
      marginType: string;
      isolatedMargin: string;
      notional: string;
      positionSide: string;
      updateTime: string;
    }>;

    const positions: Position[] = [];
    for (const item of data) {
      const qty = parseFloat(item.positionAmt);
      if (qty === 0) continue;

      const sym = item.symbol;
      if (symbols && !symbols.some((s) => s.replace("/", "") === sym)) continue;

      const entryPrice = parseFloat(item.entryPrice);
      const markPrice = parseFloat(item.markPrice);
      const unrealizedPnl = parseFloat(item.unRealizedProfit);
      const leverage = parseInt(item.leverage);
      const notional = Math.abs(parseFloat(item.notional));
      const marginUsed = notional / leverage;
      const liqPrice = parseFloat(item.liquidationPrice);

      positions.push({
        symbol: sym,
        side: qty > 0 ? "long" : "short",
        quantity: Math.abs(qty),
        entry_price: entryPrice,
        entry_time: new Date(parseInt(item.updateTime)).toISOString(),
        current_price: markPrice,
        unrealized_pnl: unrealizedPnl,
        unrealized_pnl_pct: entryPrice > 0 ? unrealizedPnl / (entryPrice * Math.abs(qty)) : 0,
        leverage,
        margin_used: Math.round(marginUsed * 100) / 100,
        liquidation_price: liqPrice > 0 ? liqPrice : undefined,
        mark_price: markPrice,
        notional_value: Math.round(notional * 100) / 100,
      });
    }

    return positions;
  },

  async testConnection(creds) {
    const start = Date.now();
    try {
      await request("GET", "/fapi/v2/balance", creds);
      return { ok: true, latency_ms: Date.now() - start };
    } catch (e) {
      const msg = (e as Error).message;
      const isProxy = msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || msg.includes("proxy");
      return {
        ok: false,
        error: isProxy ? `网络连接失败（请检查代理设置）: ${msg}` : msg,
        latency_ms: Date.now() - start,
      };
    }
  },
};

export async function setLeverage(
  creds: Credentials,
  symbol: string,
  leverage: number
): Promise<void> {
  await request("POST", "/fapi/v1/leverage", creds, {
    symbol: symbol.replace("/", ""),
    leverage: leverage.toString(),
  });
}

export async function setMarginType(
  creds: Credentials,
  symbol: string,
  marginType: "ISOLATED" | "CROSSED"
): Promise<void> {
  try {
    await request("POST", "/fapi/v1/marginType", creds, {
      symbol: symbol.replace("/", ""),
      marginType,
    });
  } catch (e) {
    // Binance returns error if margin type is already set to the requested value
    const msg = (e as Error).message;
    if (!msg.includes("No need to change margin type")) throw e;
  }
}
