// packages/core/src/account/ops/types.ts

export type ExchangeId = "okx" | "binance" | "bitget" | "bybit" | "gate" | "kucoin" | "lighter";

export type CredentialField = "api_key" | "secret" | "passphrase";

export interface Account {
  id: string;
  exchange: ExchangeId;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface AccountRecord extends Account {
  api_key: string;
  secret: string;
  passphrase?: string;
}

export interface TestResult {
  success: boolean;
  error?: string;
  latency_ms?: number;
}

export interface CreateAccountResult {
  success: boolean;
  account?: Account;
  error?: string;
}

export interface UpdateAccountResult {
  success: boolean;
  account?: Account;
  error?: string;
}

export interface ListAccountsResult {
  success: boolean;
  accounts: Account[];
  error?: string;
}

export interface ViewAccountResult {
  success: boolean;
  account?: Account;
  masked_credentials?: Partial<Record<CredentialField, string>>;
  error?: string;
}

export interface RemoveAccountResult {
  success: boolean;
  error?: string;
}
