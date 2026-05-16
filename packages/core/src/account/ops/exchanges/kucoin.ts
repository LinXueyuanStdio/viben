import { createHmac } from "node:crypto";
import type { Exchange, Credentials, SignParams, SignedRequest } from "./types";
import type { TestResult } from "../types";
import { proxyFetch } from "../../../http/proxy";

const BASE_URL = "https://api.kucoin.com";

export const kucoinExchange: Exchange = {
  id: "kucoin",
  name: "KuCoin",
  fields: ["api_key", "secret", "passphrase"],
  referral_url: "https://www.kucoin.com/r/af/REFERRAL",
  api_doc_url: "https://www.kucoin.com/account/api",

  sign(credentials: Credentials, params: SignParams): SignedRequest {
    const { method, path, body } = params;
    const timestamp = params.timestamp;
    const prehash = timestamp + method + path + (body ?? "");
    const signature = createHmac("sha256", credentials.secret)
      .update(prehash)
      .digest("base64");
    const passphraseSign = createHmac("sha256", credentials.secret)
      .update(credentials.passphrase ?? "")
      .digest("base64");

    return {
      url: BASE_URL + path,
      headers: {
        "KC-API-KEY": credentials.api_key,
        "KC-API-SIGN": signature,
        "KC-API-TIMESTAMP": timestamp,
        "KC-API-PASSPHRASE": passphraseSign,
        "KC-API-KEY-VERSION": "2",
        "Content-Type": "application/json",
      },
    };
  },

  async testConnection(credentials: Credentials): Promise<TestResult> {
    const timestamp = Date.now().toString();
    const path = "/api/v1/accounts";
    const signed = this.sign(credentials, { method: "GET", path, timestamp });

    const start = Date.now();
    try {
      const res = await proxyFetch(signed.url, { method: "GET", headers: signed.headers, signal: AbortSignal.timeout(10_000) });
      const latency_ms = Date.now() - start;
      const json = (await res.json()) as { code?: string; msg?: string };
      if (json.code === "200000") return { success: true, latency_ms };
      return { success: false, error: json.msg ?? `Error: ${json.code}`, latency_ms };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Network error", latency_ms: Date.now() - start };
    }
  },
};
