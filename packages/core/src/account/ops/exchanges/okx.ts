// packages/core/src/account/ops/exchanges/okx.ts

import { createHmac } from "node:crypto";
import type { Exchange, Credentials, SignParams, SignedRequest } from "./types";
import type { TestResult } from "../types";

const BASE_URL = "https://www.okx.com";

export const okxExchange: Exchange = {
  id: "okx",
  name: "OKX",
  fields: ["api_key", "secret", "passphrase"],
  referral_url: "https://okx.com/join/80926498",
  api_doc_url: "https://www.okx.com/account/my-api",

  sign(credentials: Credentials, params: SignParams): SignedRequest {
    const { method, path, body } = params;
    const timestamp = params.timestamp;
    const prehash = timestamp + method + path + (body ?? "");
    const signature = createHmac("sha256", credentials.secret)
      .update(prehash)
      .digest("base64");

    return {
      url: BASE_URL + path,
      headers: {
        "OK-ACCESS-KEY": credentials.api_key,
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": credentials.passphrase ?? "",
        "Content-Type": "application/json",
      },
    };
  },

  async testConnection(credentials: Credentials): Promise<TestResult> {
    const timestamp = new Date().toISOString();
    const path = "/api/v5/account/balance";
    const signed = this.sign(credentials, { method: "GET", path, timestamp });

    const start = Date.now();
    try {
      const res = await fetch(signed.url, {
        method: "GET",
        headers: signed.headers,
        signal: AbortSignal.timeout(10_000),
      });
      const latency_ms = Date.now() - start;
      const json = (await res.json()) as { code?: string; msg?: string };

      if (json.code === "0") {
        return { success: true, latency_ms };
      }
      return { success: false, error: json.msg ?? `Error code: ${json.code}`, latency_ms };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Network error", latency_ms: Date.now() - start };
    }
  },
};
