import { createHmac } from "node:crypto";
import type { Exchange, Credentials, SignParams, SignedRequest } from "./types";
import type { TestResult } from "../types";

const BASE_URL = "https://api.lighter.xyz";

export const lighterExchange: Exchange = {
  id: "lighter",
  name: "Lighter",
  fields: ["api_key", "secret"],
  referral_url: "https://lighter.xyz",
  api_doc_url: "https://docs.lighter.xyz",

  sign(credentials: Credentials, params: SignParams): SignedRequest {
    const { method, path, body } = params;
    const timestamp = params.timestamp;
    const prehash = timestamp + method + path + (body ?? "");
    const signature = createHmac("sha256", credentials.secret)
      .update(prehash)
      .digest("hex");

    return {
      url: BASE_URL + path,
      headers: {
        "X-API-KEY": credentials.api_key,
        "X-API-SIGNATURE": signature,
        "X-API-TIMESTAMP": timestamp,
        "Content-Type": "application/json",
      },
    };
  },

  async testConnection(credentials: Credentials): Promise<TestResult> {
    const timestamp = Date.now().toString();
    const path = "/api/v1/account";
    const signed = this.sign(credentials, { method: "GET", path, timestamp });

    const start = Date.now();
    try {
      const res = await fetch(signed.url, { method: "GET", headers: signed.headers, signal: AbortSignal.timeout(10_000) });
      const latency_ms = Date.now() - start;
      if (res.ok) return { success: true, latency_ms };
      const text = await res.text();
      return { success: false, error: text || `HTTP ${res.status}`, latency_ms };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Network error", latency_ms: Date.now() - start };
    }
  },
};
