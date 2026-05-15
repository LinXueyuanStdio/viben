import { createHmac, createHash } from "node:crypto";
import type { Exchange, Credentials, SignParams, SignedRequest } from "./types";
import type { TestResult } from "../types";

const BASE_URL = "https://api.gateio.ws";

export const gateExchange: Exchange = {
  id: "gate",
  name: "Gate",
  fields: ["api_key", "secret"],
  referral_url: "https://www.gate.io/signup",
  api_doc_url: "https://www.gate.io/myaccount/api_key_manage",

  sign(credentials: Credentials, params: SignParams): SignedRequest {
    const { method, path, body } = params;
    const timestamp = params.timestamp;
    const queryString = params.params
      ? Object.entries(params.params).map(([k, v]) => `${k}=${v}`).join("&")
      : "";
    const hashedBody = createHash("sha512").update(body ?? "").digest("hex");
    const prehash = `${method}\n${path}\n${queryString}\n${hashedBody}\n${timestamp}`;
    const signature = createHmac("sha512", credentials.secret)
      .update(prehash)
      .digest("hex");

    const url = queryString
      ? `${BASE_URL}${path}?${queryString}`
      : `${BASE_URL}${path}`;

    return {
      url,
      headers: {
        KEY: credentials.api_key,
        SIGN: signature,
        Timestamp: timestamp,
        "Content-Type": "application/json",
      },
    };
  },

  async testConnection(credentials: Credentials): Promise<TestResult> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = "/api/v4/spot/accounts";
    const signed = this.sign(credentials, { method: "GET", path, timestamp });

    const start = Date.now();
    try {
      const res = await fetch(signed.url, { method: "GET", headers: signed.headers, signal: AbortSignal.timeout(10_000) });
      const latency_ms = Date.now() - start;
      if (res.ok) return { success: true, latency_ms };
      const json = (await res.json()) as { message?: string };
      return { success: false, error: json.message ?? `HTTP ${res.status}`, latency_ms };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Network error", latency_ms: Date.now() - start };
    }
  },
};
