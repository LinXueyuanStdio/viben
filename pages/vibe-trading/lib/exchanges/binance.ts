import { createHmac } from "node:crypto";
import type { Credentials, Exchange, OrderParams, OrderResponse, BalanceInfo } from "./types";
import type { Position } from "../types";
import { proxyFetch } from "./proxy-fetch";

const BASE_URL = "https://api.binance.com";

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
    throw new Error(`Binance API error ${res.status}: ${body}`);
  }

  return res.json();
}

export const binance: Exchange = {
  id: "binance",
  name: "Binance",

  async placeOrder(creds, params) {
    const body: Record<string, string> = {
      symbol: params.symbol,
      side: params.side.toUpperCase(),
      type: params.type.toUpperCase(),
      quantity: params.quantity.toString(),
    };
    if (params.type === "limit" && params.price) {
      body.price = params.price.toString();
      body.timeInForce = "GTC";
    }

    const data = (await request("POST", "/api/v3/order", creds, body)) as {
      orderId: number;
      status: string;
      fills: Array<{ price: string; qty: string; commission: string; commissionAsset: string }>;
    };

    const fills = data.fills ?? [];
    const filledQty = fills.reduce((s, f) => s + parseFloat(f.qty), 0);
    const filledPrice = fills.length > 0
      ? fills.reduce((s, f) => s + parseFloat(f.price) * parseFloat(f.qty), 0) / filledQty
      : 0;
    const fee = fills.reduce((s, f) => s + parseFloat(f.commission), 0);
    const feeAsset = fills[0]?.commissionAsset ?? "USDT";

    return {
      order_id: data.orderId.toString(),
      status: data.status === "FILLED" ? "filled" : "partial_filled",
      filled_price: filledPrice,
      filled_quantity: filledQty,
      fee,
      fee_asset: feeAsset,
    };
  },

  async cancelOrder(creds, orderId, symbol) {
    try {
      await request("DELETE", "/api/v3/order", creds, { symbol, orderId });
      return true;
    } catch {
      return false;
    }
  },

  async getBalance(creds) {
    const data = (await request("GET", "/api/v3/account", creds)) as {
      balances: Array<{ asset: string; free: string }>;
    };
    const balances: Record<string, number> = {};
    for (const b of data.balances) {
      const free = parseFloat(b.free);
      if (free > 0) balances[b.asset] = free;
    }
    return { balances };
  },

  async getPositions(creds, symbols) {
    const { balances } = await this.getBalance(creds);
    const positions: Position[] = [];
    for (const [asset, qty] of Object.entries(balances)) {
      if (asset === "USDT" || asset === "BUSD") continue;
      if (symbols && !symbols.some((s) => s.startsWith(asset))) continue;
      positions.push({
        symbol: `${asset}USDT`,
        side: "long",
        quantity: qty,
        entry_price: 0,
        entry_time: new Date().toISOString(),
      });
    }
    return positions;
  },

  async testConnection(creds) {
    const start = Date.now();
    try {
      await request("GET", "/api/v3/account", creds);
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
