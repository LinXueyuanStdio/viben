import { createHmac } from "node:crypto";
import type { Credentials, Exchange } from "./types";
import type { Position } from "../types";
import { proxyFetch } from "./proxy-fetch";

const BASE_URL = "https://www.okx.com";

function signOkx(timestamp: string, method: string, path: string, body: string, secret: string): string {
  const prehash = timestamp + method + path + body;
  return createHmac("sha256", secret).update(prehash).digest("base64");
}

async function request(
  method: string,
  path: string,
  creds: Credentials,
  body?: unknown
): Promise<unknown> {
  const timestamp = new Date().toISOString();
  const bodyStr = body ? JSON.stringify(body) : "";
  const signature = signOkx(timestamp, method, path, bodyStr, creds.secret);

  const res = await proxyFetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "OK-ACCESS-KEY": creds.api_key,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": creds.passphrase ?? "",
      "Content-Type": "application/json",
    },
    body: bodyStr || undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OKX API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { code: string; msg: string; data: unknown };
  if (data.code !== "0") throw new Error(`OKX: ${data.msg}`);
  return data.data;
}

export const okx: Exchange = {
  id: "okx",
  name: "OKX",

  async placeOrder(creds, params) {
    const body = {
      instId: params.symbol.replace("USDT", "-USDT"),
      tdMode: "cash",
      side: params.side,
      ordType: params.type === "market" ? "market" : "limit",
      sz: params.quantity.toString(),
      px: params.price?.toString(),
    };

    const data = (await request("POST", "/api/v5/trade/order", creds, body)) as Array<{
      ordId: string;
      sCode: string;
      sMsg: string;
    }>;

    const result = data[0];
    return {
      order_id: result.ordId,
      status: result.sCode === "0" ? "filled" as const : "rejected" as const,
      filled_price: params.price ?? 0,
      filled_quantity: params.quantity,
      fee: 0,
      fee_asset: "USDT",
      error: result.sCode !== "0" ? result.sMsg : undefined,
    };
  },

  async cancelOrder(creds, orderId, symbol) {
    try {
      await request("POST", "/api/v5/trade/cancel-order", creds, {
        instId: symbol.replace("USDT", "-USDT"),
        ordId: orderId,
      });
      return true;
    } catch {
      return false;
    }
  },

  async getBalance(creds) {
    const data = (await request("GET", "/api/v5/account/balance", creds)) as Array<{
      details: Array<{ ccy: string; availBal: string }>;
    }>;
    const balances: Record<string, number> = {};
    for (const detail of data[0]?.details ?? []) {
      const val = parseFloat(detail.availBal);
      if (val > 0) balances[detail.ccy] = val;
    }
    return { balances };
  },

  async getPositions(creds) {
    const data = (await request("GET", "/api/v5/account/positions", creds)) as Array<{
      instId: string;
      posSide: string;
      pos: string;
      avgPx: string;
      cTime: string;
    }>;
    return (data ?? []).map((p) => ({
      symbol: p.instId.replace("-", ""),
      side: (p.posSide === "short" ? "short" : "long") as "long" | "short",
      quantity: parseFloat(p.pos),
      entry_price: parseFloat(p.avgPx),
      entry_time: new Date(parseInt(p.cTime)).toISOString(),
    }));
  },

  async testConnection(creds) {
    const start = Date.now();
    try {
      await request("GET", "/api/v5/account/balance", creds);
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
