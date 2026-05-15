import { createHmac } from "node:crypto";
import type { Exchange, Credentials, SignParams, SignedRequest } from "./types";
import type { TestResult } from "../types";

const BASE_URL = "https://api.bitget.com";

export const bitgetExchange: Exchange = {
  id: "bitget",
  name: "Bitget",
  fields: ["api_key", "secret", "passphrase"],
  referral_url: "https://www.bitget.com/referral/register?from=referral&clacCode=5JEW6H7G",
  api_doc_url: "https://www.bitget.com/account/newapi",

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
        "ACCESS-KEY": credentials.api_key,
        "ACCESS-SIGN": signature,
        "ACCESS-TIMESTAMP": timestamp,
        "ACCESS-PASSPHRASE": credentials.passphrase ?? "",
        "Content-Type": "application/json",
      },
    };
  },

  async testConnection(credentials: Credentials): Promise<TestResult> {
    const timestamp = Date.now().toString();
    const path = "/api/v2/spot/account/info";
    const signed = this.sign(credentials, { method: "GET", path, timestamp });

    const start = Date.now();
    try {
      const res = await fetch(signed.url, { method: "GET", headers: signed.headers, signal: AbortSignal.timeout(10_000) });
      const latency_ms = Date.now() - start;
      const json = (await res.json()) as { code?: string; msg?: string };
      if (json.code === "00000") return { success: true, latency_ms };
      return { success: false, error: json.msg ?? `Error: ${json.code}`, latency_ms };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Network error", latency_ms: Date.now() - start };
    }
  },
};
