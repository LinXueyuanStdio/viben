import { createHmac } from "node:crypto";
import type { Exchange, Credentials, SignParams, SignedRequest } from "./types";
import type { TestResult } from "../types";

const BASE_URL = "https://api.binance.com";

export const binanceExchange: Exchange = {
  id: "binance",
  name: "Binance",
  fields: ["api_key", "secret"],
  referral_url: "https://accounts.binance.com/register?ref=11427183",
  api_doc_url: "https://www.binance.com/en/my/settings/api-management",
  whitelist_ip: "195.135.193.235",

  sign(credentials: Credentials, params: SignParams): SignedRequest {
    const { method, path } = params;
    const queryString = params.params
      ? Object.entries(params.params).map(([k, v]) => `${k}=${v}`).join("&")
      : "";
    const toSign = queryString + (queryString ? "&" : "") + `timestamp=${params.timestamp}`;
    const signature = createHmac("sha256", credentials.secret)
      .update(toSign)
      .digest("hex");
    const fullQuery = toSign + `&signature=${signature}`;

    return {
      url: `${BASE_URL}${path}?${fullQuery}`,
      headers: {
        "X-MBX-APIKEY": credentials.api_key,
      },
    };
  },

  async testConnection(credentials: Credentials): Promise<TestResult> {
    const timestamp = Date.now().toString();
    const path = "/api/v3/account";
    const signed = this.sign(credentials, { method: "GET", path, timestamp });

    const start = Date.now();
    try {
      const res = await fetch(signed.url, {
        method: "GET",
        headers: signed.headers,
        signal: AbortSignal.timeout(10_000),
      });
      const latency_ms = Date.now() - start;

      if (res.ok) return { success: true, latency_ms };
      const json = (await res.json()) as { msg?: string; code?: number };
      return { success: false, error: json.msg ?? `HTTP ${res.status}`, latency_ms };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Network error", latency_ms: Date.now() - start };
    }
  },
};
