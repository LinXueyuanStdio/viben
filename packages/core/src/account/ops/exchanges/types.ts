// packages/core/src/account/ops/exchanges/types.ts

import type { ExchangeId, CredentialField, TestResult } from "../types";

export interface Credentials {
  api_key: string;
  secret: string;
  passphrase?: string;
}

export interface SignParams {
  method: "GET" | "POST";
  path: string;
  params?: Record<string, string>;
  body?: string;
  timestamp: string;
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface Exchange {
  id: ExchangeId;
  name: string;
  fields: CredentialField[];
  referral_url?: string;
  api_doc_url?: string;
  whitelist_ip?: string;

  sign(credentials: Credentials, params: SignParams): SignedRequest;
  testConnection(credentials: Credentials): Promise<TestResult>;
}
