import { createHmac } from "node:crypto";
import type { Exchange, Credentials, SignParams, SignedRequest } from "./types";
import type { TestResult } from "../types";

const BASE_URL = "https://api.bybit.com";

export const bybitExchange: Exchange = {
  id: "bybit",
  name: "Bybit",
  fields: ["api_key", "secret"],
  referral_url: "https://www.bybit.com/invite?ref=INVITE",
  api_doc_url: "https://www.bybit.com/app/user/api-management",

  sign(credentials: Credentials, params: SignParams): SignedRequest {
    const { method, path } = params;
    const timestamp = params.timestamp;
    const recvWindow = "5000";
    // Bybit requires alphabetically sorted params for signature
    const queryString = params.params
      ? Object.entries(params.params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&")
      : "";
    const prehash = timestamp + credentials.api_key + recvWindow + queryString;
    const signature = createHmac("sha256", credentials.secret)
      .update(prehash)
      .digest("hex");

    const url = queryString
      ? `${BASE_URL}${path}?${queryString}`
      : `${BASE_URL}${path}`;

    return {
      url,
      headers: {
        "X-BAPI-API-KEY": credentials.api_key,
        "X-BAPI-SIGN": signature,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": recvWindow,
        "Content-Type": "application/json",
      },
    };
  },

  async testConnection(credentials: Credentials): Promise<TestResult> {
    const timestamp = Date.now().toString();
    const path = "/v5/account/wallet-balance";
    const signed = this.sign(credentials, { method: "GET", path, timestamp, params: { accountType: "UNIFIED" } });

    const start = Date.now();
    try {
      const res = await fetch(signed.url, { method: "GET", headers: signed.headers, signal: AbortSignal.timeout(10_000) });
      const latency_ms = Date.now() - start;
      const json = (await res.json()) as { retCode?: number; retMsg?: string };
      if (json.retCode === 0) return { success: true, latency_ms };
      return { success: false, error: json.retMsg ?? `Error: ${json.retCode}`, latency_ms };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Network error", latency_ms: Date.now() - start };
    }
  },
};
