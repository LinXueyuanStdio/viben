// packages/core/src/account/ops/test.ts

import { findAccount } from "./crud";
import { getExchange } from "./exchanges";
import type { Credentials } from "./exchanges";
import type { TestResult } from "./types";

export async function testAccount(idOrName: string): Promise<TestResult> {
  const record = await findAccount(idOrName);
  if (!record) return { success: false, error: `Account not found: ${idOrName}` };

  const exchange = getExchange(record.exchange);
  const credentials: Credentials = {
    api_key: record.api_key,
    secret: record.secret,
    passphrase: record.passphrase,
  };

  return exchange.testConnection(credentials);
}
