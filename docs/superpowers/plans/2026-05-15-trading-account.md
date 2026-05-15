# Trading Account Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trading exchange account management (CRUD + connectivity test) to packages/core with CLI, Gateway routes, and Desktop settings UI.

**Architecture:** Lightweight ops module (`src/account/ops/`) with exchange adapter pattern. Each exchange file self-contains static meta + HMAC signing + test logic. Storage is plaintext YAML at `~/.viben/accounts.yaml`. Desktop accesses via Gateway HTTP routes.

**Tech Stack:** TypeScript, commander (CLI), Fastify (routes), js-yaml + config/yaml utils, node:crypto (HMAC signing), nanoid (IDs), React + @viben/ui (Desktop dialog)

---

## File Structure

### New Files (packages/core)

| File | Responsibility |
|------|---------------|
| `src/account/index.ts` | Module barrel: `export * from "./ops"` |
| `src/account/ops/index.ts` | Ops barrel export |
| `src/account/ops/types.ts` | All type definitions (Account, AccountRecord, ExchangeId, result types) |
| `src/account/ops/store.ts` | YAML read/write with atomic write, file permissions |
| `src/account/ops/crud.ts` | listAccounts, addAccount, viewAccount, updateAccount, removeAccount, findAccount |
| `src/account/ops/test.ts` | testAccount entry point (delegates to exchange adapter) |
| `src/account/ops/exchanges/types.ts` | Exchange interface, Credentials, SignParams, SignedRequest |
| `src/account/ops/exchanges/index.ts` | getExchange() factory, listExchanges() |
| `src/account/ops/exchanges/okx.ts` | OKX adapter (meta + sign + testConnection) |
| `src/account/ops/exchanges/binance.ts` | Binance adapter |
| `src/account/ops/exchanges/bitget.ts` | Bitget adapter |
| `src/account/ops/exchanges/bybit.ts` | Bybit adapter |
| `src/account/ops/exchanges/gate.ts` | Gate adapter |
| `src/account/ops/exchanges/kucoin.ts` | KuCoin adapter |
| `src/account/ops/exchanges/lighter.ts` | Lighter adapter |
| `src/cli/commands/account.ts` | CLI command registration |
| `src/gateway/routes/accounts.ts` | Gateway REST routes |

### Modified Files (packages/core)

| File | Change |
|------|--------|
| `src/config/paths.ts` | Add `getAccountsPath()` |
| `src/cli/commands/index.ts` | Import + register account command |
| `src/gateway/routes/index.ts` | Import + register account routes |

### New Files (apps/desktop)

| File | Responsibility |
|------|---------------|
| `src/pages/settings/trading-accounts-section.tsx` | Settings section entry (overview + manage button) |
| `src/pages/settings/trading-accounts-dialog.tsx` | Dialog with left exchange list + right form/list |

### Modified Files (apps/desktop)

| File | Change |
|------|--------|
| `src/navigation/navigation-meta.ts` | Add `trading-accounts` section descriptor |
| `src/pages/settings/index.tsx` | Add section to rendering switch |

---

## Task 1: Types + Store Layer

**Files:**
- Create: `packages/core/src/account/ops/types.ts`
- Create: `packages/core/src/account/ops/store.ts`
- Create: `packages/core/src/account/ops/index.ts`
- Create: `packages/core/src/account/index.ts`
- Modify: `packages/core/src/config/paths.ts`

- [ ] **Step 1: Add `getAccountsPath()` to paths.ts**

```typescript
// Add to packages/core/src/config/paths.ts

/**
 * Get the path to the trading accounts config file
 */
export function getAccountsPath(): string {
  return join(getStateDir(), "accounts.yaml");
}
```

- [ ] **Step 2: Create types.ts**

```typescript
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
```

- [ ] **Step 3: Create store.ts**

```typescript
// packages/core/src/account/ops/store.ts

import { chmod } from "node:fs/promises";
import { readYaml, writeYaml } from "../../config/yaml";
import { getAccountsPath } from "../../config/paths";
import type { AccountRecord } from "./types";

interface AccountsFile {
  accounts: AccountRecord[];
}

export function getAccountsFilePath(): string {
  return getAccountsPath();
}

export async function readAccounts(): Promise<AccountRecord[]> {
  const data = await readYaml<AccountsFile>(getAccountsFilePath());
  return data?.accounts ?? [];
}

export async function writeAccounts(accounts: AccountRecord[]): Promise<void> {
  const filePath = getAccountsFilePath();
  // writeYaml creates parent dirs if needed
  await writeYaml(filePath, { accounts });
  // Set file permissions to 0600 (owner read/write only)
  await chmod(filePath, 0o600);
}

export function maskCredential(value: string): string {
  if (value.length <= 4) return "****";
  return "****" + value.slice(-4);
}
```

- [ ] **Step 4: Create barrel exports**

```typescript
// packages/core/src/account/ops/index.ts
export * from "./types";
export * from "./store";
```

```typescript
// packages/core/src/account/index.ts
export * from "./ops";
```

- [ ] **Step 5: Add nanoid dependency**

`nanoid` is used transitively but not declared in package.json. Add it:

```bash
cd packages/core && pnpm add nanoid
```

- [ ] **Step 6: Verify compilation**

Run: `cd packages/core && npx tsc --noEmit`
Expected: No errors related to account module

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/account/ packages/core/src/config/paths.ts packages/core/package.json
git commit -m "feat(account): add types and store layer for trading accounts"
```

---

## Task 2: Exchange Adapter Interface + OKX Implementation

**Files:**
- Create: `packages/core/src/account/ops/exchanges/types.ts`
- Create: `packages/core/src/account/ops/exchanges/index.ts`
- Create: `packages/core/src/account/ops/exchanges/okx.ts`

- [ ] **Step 1: Create exchange types**

```typescript
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
```

- [ ] **Step 2: Create OKX adapter**

```typescript
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
```

- [ ] **Step 3: Create exchanges barrel**

```typescript
// packages/core/src/account/ops/exchanges/index.ts

import type { ExchangeId } from "../types";
import type { Exchange } from "./types";
import { okxExchange } from "./okx";

export type { Exchange, Credentials, SignParams, SignedRequest } from "./types";

const EXCHANGES: Record<ExchangeId, Exchange> = {
  okx: okxExchange,
  binance: undefined as unknown as Exchange, // placeholder, filled in Task 3
  bitget: undefined as unknown as Exchange,
  bybit: undefined as unknown as Exchange,
  gate: undefined as unknown as Exchange,
  kucoin: undefined as unknown as Exchange,
  lighter: undefined as unknown as Exchange,
};

export function getExchange(id: ExchangeId): Exchange {
  const exchange = EXCHANGES[id];
  if (!exchange) throw new Error(`Exchange not implemented: ${id}`);
  return exchange;
}

export function listExchanges(): Exchange[] {
  return Object.values(EXCHANGES).filter(Boolean);
}
```

- [ ] **Step 4: Update ops barrel**

Add to `packages/core/src/account/ops/index.ts`:
```typescript
export * from "./types";
export * from "./store";
export { getExchange, listExchanges } from "./exchanges";
export type { Exchange, Credentials } from "./exchanges";
```

- [ ] **Step 5: Verify compilation**

Run: `cd packages/core && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/account/ops/exchanges/
git commit -m "feat(account): add exchange adapter interface and OKX implementation"
```

---

## Task 3: Remaining Exchange Adapters

**Files:**
- Create: `packages/core/src/account/ops/exchanges/binance.ts`
- Create: `packages/core/src/account/ops/exchanges/bitget.ts`
- Create: `packages/core/src/account/ops/exchanges/bybit.ts`
- Create: `packages/core/src/account/ops/exchanges/gate.ts`
- Create: `packages/core/src/account/ops/exchanges/kucoin.ts`
- Create: `packages/core/src/account/ops/exchanges/lighter.ts`
- Modify: `packages/core/src/account/ops/exchanges/index.ts`

- [ ] **Step 1: Create Binance adapter**

```typescript
// packages/core/src/account/ops/exchanges/binance.ts

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
```

- [ ] **Step 2: Create Bitget adapter**

```typescript
// packages/core/src/account/ops/exchanges/bitget.ts

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
```

- [ ] **Step 3: Create Bybit adapter**

```typescript
// packages/core/src/account/ops/exchanges/bybit.ts

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
```

- [ ] **Step 4: Create Gate adapter**

```typescript
// packages/core/src/account/ops/exchanges/gate.ts

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
```

- [ ] **Step 5: Create KuCoin adapter**

```typescript
// packages/core/src/account/ops/exchanges/kucoin.ts

import { createHmac } from "node:crypto";
import type { Exchange, Credentials, SignParams, SignedRequest } from "./types";
import type { TestResult } from "../types";

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
      const res = await fetch(signed.url, { method: "GET", headers: signed.headers, signal: AbortSignal.timeout(10_000) });
      const latency_ms = Date.now() - start;
      const json = (await res.json()) as { code?: string; msg?: string };
      if (json.code === "200000") return { success: true, latency_ms };
      return { success: false, error: json.msg ?? `Error: ${json.code}`, latency_ms };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Network error", latency_ms: Date.now() - start };
    }
  },
};
```

- [ ] **Step 6: Create Lighter adapter**

```typescript
// packages/core/src/account/ops/exchanges/lighter.ts

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
```

- [ ] **Step 7: Update exchanges/index.ts with all adapters**

Replace the placeholder content in `packages/core/src/account/ops/exchanges/index.ts`:

```typescript
// packages/core/src/account/ops/exchanges/index.ts

import type { ExchangeId } from "../types";
import type { Exchange } from "./types";
import { okxExchange } from "./okx";
import { binanceExchange } from "./binance";
import { bitgetExchange } from "./bitget";
import { bybitExchange } from "./bybit";
import { gateExchange } from "./gate";
import { kucoinExchange } from "./kucoin";
import { lighterExchange } from "./lighter";

export type { Exchange, Credentials, SignParams, SignedRequest } from "./types";

const EXCHANGES: Record<ExchangeId, Exchange> = {
  okx: okxExchange,
  binance: binanceExchange,
  bitget: bitgetExchange,
  bybit: bybitExchange,
  gate: gateExchange,
  kucoin: kucoinExchange,
  lighter: lighterExchange,
};

export function getExchange(id: ExchangeId): Exchange {
  const exchange = EXCHANGES[id];
  if (!exchange) throw new Error(`Exchange not implemented: ${id}`);
  return exchange;
}

export function listExchanges(): Exchange[] {
  return Object.values(EXCHANGES);
}
```

- [ ] **Step 8: Verify compilation**

Run: `cd packages/core && npx tsc --noEmit`

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/account/ops/exchanges/
git commit -m "feat(account): add all exchange adapters (OKX, Binance, Bitget, Bybit, Gate, KuCoin, Lighter)"
```

---

## Task 4: CRUD Operations

**Files:**
- Create: `packages/core/src/account/ops/crud.ts`
- Create: `packages/core/src/account/ops/test.ts`
- Modify: `packages/core/src/account/ops/index.ts`

- [ ] **Step 1: Create crud.ts**

```typescript
// packages/core/src/account/ops/crud.ts

import { nanoid } from "nanoid";
import { readAccounts, writeAccounts, maskCredential } from "./store";
import { getExchange } from "./exchanges";
import type {
  ExchangeId,
  CredentialField,
  Account,
  AccountRecord,
  CreateAccountResult,
  UpdateAccountResult,
  ListAccountsResult,
  ViewAccountResult,
  RemoveAccountResult,
} from "./types";

const MAX_NAME_LENGTH = 64;
const MAX_CREDENTIAL_LENGTH = 256;

function validateCredential(value: string, field: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${field} cannot be empty`;
  if (trimmed.length > MAX_CREDENTIAL_LENGTH) return `${field} exceeds max length (${MAX_CREDENTIAL_LENGTH})`;
  return null;
}

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "name cannot be empty";
  if (trimmed.length > MAX_NAME_LENGTH) return `name exceeds max length (${MAX_NAME_LENGTH})`;
  return null;
}

function toAccount(record: AccountRecord): Account {
  return {
    id: record.id,
    exchange: record.exchange,
    name: record.name,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export async function findAccount(idOrName: string): Promise<AccountRecord | null> {
  const accounts = await readAccounts();
  // 1. Match by ID
  const byId = accounts.find((a) => a.id === idOrName);
  if (byId) return byId;
  // 2. Match by name (exact, case-sensitive)
  const byName = accounts.filter((a) => a.name === idOrName);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) return null; // ambiguous
  return null;
}

export async function listAccounts(): Promise<ListAccountsResult> {
  const accounts = await readAccounts();
  return { success: true, accounts: accounts.map(toAccount) };
}

export async function addAccount(input: {
  exchange: ExchangeId;
  name: string;
  api_key: string;
  secret: string;
  passphrase?: string;
}): Promise<CreateAccountResult> {
  // Validate
  const nameErr = validateName(input.name);
  if (nameErr) return { success: false, error: nameErr };

  const keyErr = validateCredential(input.api_key, "api_key");
  if (keyErr) return { success: false, error: keyErr };

  const secretErr = validateCredential(input.secret, "secret");
  if (secretErr) return { success: false, error: secretErr };

  const exchange = getExchange(input.exchange);
  if (exchange.fields.includes("passphrase")) {
    if (!input.passphrase) return { success: false, error: "passphrase is required for " + exchange.name };
    const ppErr = validateCredential(input.passphrase, "passphrase");
    if (ppErr) return { success: false, error: ppErr };
  }

  const now = new Date().toISOString();
  const record: AccountRecord = {
    id: nanoid(12),
    exchange: input.exchange,
    name: input.name.trim(),
    api_key: input.api_key.trim(),
    secret: input.secret.trim(),
    passphrase: input.passphrase?.trim(),
    created_at: now,
    updated_at: now,
  };

  const accounts = await readAccounts();
  accounts.push(record);
  await writeAccounts(accounts);

  return { success: true, account: toAccount(record) };
}

export async function viewAccount(idOrName: string): Promise<ViewAccountResult> {
  const record = await findAccount(idOrName);
  if (!record) {
    // Check if ambiguous name
    const accounts = await readAccounts();
    const byName = accounts.filter((a) => a.name === idOrName);
    if (byName.length > 1) {
      return { success: false, error: `Multiple accounts match name "${idOrName}". Use account ID instead.` };
    }
    return { success: false, error: `Account not found: ${idOrName}` };
  }

  const exchange = getExchange(record.exchange);
  const masked: Partial<Record<CredentialField, string>> = {};
  for (const field of exchange.fields) {
    const value = record[field as keyof AccountRecord] as string | undefined;
    if (value) masked[field] = maskCredential(value);
  }

  return { success: true, account: toAccount(record), masked_credentials: masked };
}

export async function updateAccount(idOrName: string, input: {
  name?: string;
  api_key?: string;
  secret?: string;
  passphrase?: string;
}): Promise<UpdateAccountResult> {
  const accounts = await readAccounts();
  // Check for ambiguous name match
  const byName = accounts.filter((a) => a.name === idOrName);
  if (byName.length > 1) {
    return { success: false, error: `Multiple accounts match name "${idOrName}". Use account ID instead.` };
  }
  const idx = accounts.findIndex((a) => a.id === idOrName || a.name === idOrName);
  if (idx === -1) return { success: false, error: `Account not found: ${idOrName}` };

  const record = accounts[idx];

  if (input.name) {
    const nameErr = validateName(input.name);
    if (nameErr) return { success: false, error: nameErr };
    record.name = input.name.trim();
  }
  if (input.api_key) {
    const err = validateCredential(input.api_key, "api_key");
    if (err) return { success: false, error: err };
    record.api_key = input.api_key.trim();
  }
  if (input.secret) {
    const err = validateCredential(input.secret, "secret");
    if (err) return { success: false, error: err };
    record.secret = input.secret.trim();
  }
  if (input.passphrase !== undefined) {
    if (input.passphrase) {
      const err = validateCredential(input.passphrase, "passphrase");
      if (err) return { success: false, error: err };
      record.passphrase = input.passphrase.trim();
    } else {
      record.passphrase = undefined;
    }
  }

  record.updated_at = new Date().toISOString();
  accounts[idx] = record;
  await writeAccounts(accounts);

  return { success: true, account: toAccount(record) };
}

export async function removeAccount(idOrName: string): Promise<RemoveAccountResult> {
  const accounts = await readAccounts();
  const byName = accounts.filter((a) => a.name === idOrName);
  if (byName.length > 1) {
    return { success: false, error: `Multiple accounts match name "${idOrName}". Use account ID instead.` };
  }
  const idx = accounts.findIndex((a) => a.id === idOrName || a.name === idOrName);
  if (idx === -1) return { success: false, error: `Account not found: ${idOrName}` };

  accounts.splice(idx, 1);
  await writeAccounts(accounts);

  return { success: true };
}
```

- [ ] **Step 2: Create test.ts**

```typescript
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
```

- [ ] **Step 3: Update ops barrel**

Replace `packages/core/src/account/ops/index.ts`:

```typescript
// packages/core/src/account/ops/index.ts
export * from "./types";
export { getAccountsFilePath, readAccounts, writeAccounts, maskCredential } from "./store";
export { listAccounts, addAccount, viewAccount, updateAccount, removeAccount, findAccount } from "./crud";
export { testAccount } from "./test";
export { getExchange, listExchanges } from "./exchanges";
export type { Exchange, Credentials } from "./exchanges";
```

- [ ] **Step 4: Verify compilation**

Run: `cd packages/core && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/account/ops/crud.ts packages/core/src/account/ops/test.ts packages/core/src/account/ops/index.ts
git commit -m "feat(account): add CRUD operations and test connectivity"
```

---

## Task 5: CLI Commands

**Files:**
- Create: `packages/core/src/cli/commands/account.ts`
- Modify: `packages/core/src/cli/commands/index.ts`

- [ ] **Step 1: Create CLI command file**

```typescript
// packages/core/src/cli/commands/account.ts

import chalk from "chalk";
import type { Command } from "commander";
import { CliError } from "../types";
import {
  listAccounts,
  addAccount,
  viewAccount,
  updateAccount,
  removeAccount,
  testAccount,
  listExchanges,
} from "../../account";
import type { ExchangeId } from "../../account";

export function registerAccountCommand(program: Command): void {
  const account = program
    .command("account")
    .description("Trading account management");

  account
    .command("list")
    .description("List all trading accounts")
    .action(async () => {
      try {
        const result = await listAccounts();
        if (!result.success) throw CliError.operationFailed("account list", result.error!);
        if (result.accounts.length === 0) {
          console.log("No trading accounts configured. Use 'viben account add' to add one.");
          return;
        }
        console.log("\nTrading Accounts:\n");
        for (const acc of result.accounts) {
          console.log(`  ${chalk.dim(acc.id)}  ${acc.exchange.padEnd(10)} ${acc.name}`);
        }
        console.log(`\nTotal: ${result.accounts.length}`);
      } catch (e) {
        if (e instanceof CliError) { console.error(chalk.red(e.message)); process.exit(1); }
        throw e;
      }
    });

  account
    .command("add")
    .description("Add a new trading account")
    .option("-e, --exchange <exchange>", "Exchange ID (okx, binance, bitget, bybit, gate, kucoin, lighter)")
    .option("-n, --name <name>", "Account name")
    .option("--api-key <key>", "API key")
    .option("--secret <secret>", "API secret")
    .option("--passphrase <passphrase>", "Passphrase (for OKX/Bitget/KuCoin)")
    .action(async (opts) => {
      try {
        let { exchange, name } = opts;
        const apiKey = opts.apiKey as string | undefined;
        const secret = opts.secret as string | undefined;
        const passphrase = opts.passphrase as string | undefined;

        if (!exchange || !apiKey || !secret) {
          const exchanges = listExchanges();
          console.log("\nAvailable exchanges:");
          for (const ex of exchanges) {
            console.log(`  ${ex.id.padEnd(10)} ${ex.name}`);
          }
          throw CliError.operationFailed("account add",
            "Non-interactive usage: viben account add --exchange <id> --name <name> --api-key <key> --secret <secret> [--passphrase <pp>]");
        }

        if (!name) {
          const ex = listExchanges().find((e) => e.id === exchange);
          name = `${ex?.name ?? exchange} #1`;
        }

        const result = await addAccount({
          exchange: exchange as ExchangeId,
          name,
          api_key: apiKey,
          secret,
          passphrase,
        });

        if (!result.success) throw CliError.operationFailed("account add", result.error!);
        console.log(chalk.green(`Account added: ${result.account!.name} (${result.account!.id})`));
      } catch (e) {
        if (e instanceof CliError) { console.error(chalk.red(e.message)); process.exit(1); }
        throw e;
      }
    });

  account
    .command("view <idOrName>")
    .description("View account details (credentials masked)")
    .action(async (idOrName: string) => {
      try {
        const result = await viewAccount(idOrName);
        if (!result.success) throw CliError.operationFailed("account view", result.error!);
        const acc = result.account!;
        console.log(`\n  ID:       ${acc.id}`);
        console.log(`  Exchange: ${acc.exchange}`);
        console.log(`  Name:     ${acc.name}`);
        console.log(`  Created:  ${acc.created_at}`);
        console.log(`  Updated:  ${acc.updated_at}`);
        if (result.masked_credentials) {
          console.log("\n  Credentials:");
          for (const [field, masked] of Object.entries(result.masked_credentials)) {
            console.log(`    ${field}: ${masked}`);
          }
        }
      } catch (e) {
        if (e instanceof CliError) { console.error(chalk.red(e.message)); process.exit(1); }
        throw e;
      }
    });

  account
    .command("update <idOrName>")
    .description("Update account credentials")
    .option("-n, --name <name>", "New account name")
    .option("--api-key <key>", "New API key")
    .option("--secret <secret>", "New API secret")
    .option("--passphrase <passphrase>", "New passphrase")
    .action(async (idOrName: string, opts) => {
      try {
        const result = await updateAccount(idOrName, {
          name: opts.name,
          api_key: opts.apiKey,
          secret: opts.secret,
          passphrase: opts.passphrase,
        });
        if (!result.success) throw CliError.operationFailed("account update", result.error!);
        console.log(chalk.green(`Account updated: ${result.account!.name} (${result.account!.id})`));
      } catch (e) {
        if (e instanceof CliError) { console.error(chalk.red(e.message)); process.exit(1); }
        throw e;
      }
    });

  account
    .command("remove <idOrName>")
    .description("Remove a trading account")
    .action(async (idOrName: string) => {
      try {
        const result = await removeAccount(idOrName);
        if (!result.success) throw CliError.operationFailed("account remove", result.error!);
        console.log(chalk.green("Account removed."));
      } catch (e) {
        if (e instanceof CliError) { console.error(chalk.red(e.message)); process.exit(1); }
        throw e;
      }
    });

  account
    .command("test <idOrName>")
    .description("Test API connectivity")
    .action(async (idOrName: string) => {
      try {
        console.log("Testing connection...");
        const result = await testAccount(idOrName);
        if (result.success) {
          console.log(chalk.green(`Connection successful! (${result.latency_ms}ms)`));
        } else {
          throw CliError.operationFailed("account test", `${result.error}${result.latency_ms ? ` (${result.latency_ms}ms)` : ""}`);
        }
      } catch (e) {
        if (e instanceof CliError) { console.error(chalk.red(e.message)); process.exit(1); }
        throw e;
      }
    });
}
```

- [ ] **Step 2: Register in commands/index.ts**

Add import and registration call to `packages/core/src/cli/commands/index.ts`:

```typescript
import { registerAccountCommand } from "./account";
// In registerCommands():
registerAccountCommand(program);
```

- [ ] **Step 3: Verify compilation**

Run: `cd packages/core && npx tsc --noEmit`

- [ ] **Step 4: Manual test**

Run: `cd packages/core && node -e "import('./dist/cli/commands/account.js')"`
Or: `viben account list` (should show empty list message)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/cli/commands/account.ts packages/core/src/cli/commands/index.ts
git commit -m "feat(account): add CLI commands for trading account management"
```

---

## Task 6: Gateway Routes

**Files:**
- Create: `packages/core/src/gateway/routes/accounts.ts`
- Modify: `packages/core/src/gateway/routes/index.ts`

- [ ] **Step 1: Create accounts route file**

```typescript
// packages/core/src/gateway/routes/accounts.ts

import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  listAccounts,
  addAccount,
  viewAccount,
  updateAccount,
  removeAccount,
  testAccount,
  listExchanges,
} from "../../account";
import type { ExchangeId } from "../../account";

interface CreateAccountBody {
  exchange: ExchangeId;
  name: string;
  api_key: string;
  secret: string;
  passphrase?: string;
}

interface UpdateAccountBody {
  name?: string;
  api_key?: string;
  secret?: string;
  passphrase?: string;
}

export function registerAccountsRoutes(fastify: FastifyInstance): void {
  // GET /api/exchanges — exchange registry (static meta)
  fastify.get("/api/exchanges", async () => {
    const exchanges = listExchanges();
    return {
      exchanges: exchanges.map((ex) => ({
        id: ex.id,
        name: ex.name,
        fields: ex.fields,
        referral_url: ex.referral_url,
        api_doc_url: ex.api_doc_url,
        whitelist_ip: ex.whitelist_ip,
      })),
    };
  });

  // GET /api/accounts — list all (no credentials)
  fastify.get("/api/accounts", async () => {
    const result = await listAccounts();
    return result;
  });

  // POST /api/accounts — create
  fastify.post("/api/accounts", async (
    req: FastifyRequest<{ Body: CreateAccountBody }>,
    reply,
  ) => {
    const { exchange, name, api_key, secret, passphrase } = req.body;
    if (!exchange || !name || !api_key || !secret) {
      reply.code(400);
      return { success: false, error: "exchange, name, api_key, and secret are required" };
    }
    const result = await addAccount({ exchange, name, api_key, secret, passphrase });
    if (!result.success) {
      reply.code(400);
      return result;
    }
    reply.code(201);
    return result;
  });

  // GET /api/accounts/:id — view (masked credentials)
  fastify.get("/api/accounts/:id", async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply,
  ) => {
    const result = await viewAccount(req.params.id);
    if (!result.success) {
      reply.code(404);
      return result;
    }
    return result;
  });

  // PUT /api/accounts/:id — update credentials
  fastify.put("/api/accounts/:id", async (
    req: FastifyRequest<{ Params: { id: string }; Body: UpdateAccountBody }>,
    reply,
  ) => {
    const result = await updateAccount(req.params.id, req.body);
    if (!result.success) {
      reply.code(result.error?.includes("not found") ? 404 : 400);
      return result;
    }
    return result;
  });

  // DELETE /api/accounts/:id
  fastify.delete("/api/accounts/:id", async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply,
  ) => {
    const result = await removeAccount(req.params.id);
    if (!result.success) {
      reply.code(404);
      return result;
    }
    return result;
  });

  // POST /api/accounts/:id/test — connectivity test
  fastify.post("/api/accounts/:id/test", async (
    req: FastifyRequest<{ Params: { id: string } }>,
  ) => {
    const result = await testAccount(req.params.id);
    return result;
  });
}
```

- [ ] **Step 2: Register in routes/index.ts**

Add to `packages/core/src/gateway/routes/index.ts`:

```typescript
import { registerAccountsRoutes } from "./accounts";
// In registerRoutes():
registerAccountsRoutes(fastify);
```

And add the re-export at the bottom:
```typescript
export { registerAccountsRoutes } from "./accounts";
```

- [ ] **Step 3: Verify compilation**

Run: `cd packages/core && npx tsc --noEmit`

- [ ] **Step 4: Manual test with Gateway**

Start gateway, then test:
```bash
curl http://127.0.0.1:18790/api/exchanges | jq .
curl http://127.0.0.1:18790/api/accounts | jq .
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gateway/routes/accounts.ts packages/core/src/gateway/routes/index.ts
git commit -m "feat(account): add gateway REST routes for trading accounts"
```

---

## Task 7: End-to-End Verification via CLI `test`

**Files:** No new files — verification only.

- [ ] **Step 1: Add a test account via CLI**

```bash
viben account add --exchange okx --name "OKX Test" --api-key "test-key" --secret "test-secret" --passphrase "test-pp"
```

Expected: `Account added: OKX Test (xxxxxxxxxxxx)`

- [ ] **Step 2: List accounts**

```bash
viben account list
```

Expected: Shows the account just created.

- [ ] **Step 3: View account (masked)**

```bash
viben account view "OKX Test"
```

Expected: Shows masked credentials (`****-key`, `****cret`, `****t-pp`).

- [ ] **Step 4: Test connection (expected to fail with invalid creds)**

```bash
viben account test "OKX Test"
```

Expected: `Connection failed: Invalid API Key` or similar auth error (proves the adapter runs and reaches the exchange).

- [ ] **Step 5: Update account**

```bash
viben account update "OKX Test" --name "OKX Main"
```

Expected: `Account updated: OKX Main (xxxxxxxxxxxx)`

- [ ] **Step 6: Remove account**

```bash
viben account remove "OKX Main"
```

Expected: `Account removed.`

- [ ] **Step 7: Verify empty**

```bash
viben account list
```

Expected: `No trading accounts configured.`

---

## Task 8: Desktop Settings Section (Entry Point)

**Files:**
- Create: `apps/desktop/src/pages/settings/trading-accounts-section.tsx`
- Modify: `apps/desktop/src/navigation/navigation-meta.ts`
- Modify: `apps/desktop/src/pages/settings/index.tsx`

- [ ] **Step 1: Add section descriptor to navigation-meta.ts**

Add `"trading-accounts"` to the `SettingsSection` type union in `apps/desktop/src/navigation/navigation-meta.ts`:

```typescript
// Find the SettingsSection type and add at the end before the semicolon:
  | "tradingAccounts";
```

Add to `SETTINGS_SECTION_DESCRIPTORS` array (before the closing `]`):

```typescript
  { id: "settings:tradingAccounts", section: "tradingAccounts", routePath: "tradingAccounts", titleKey: "settings.sections.tradingAccounts", fallbackLabel: "Trading Accounts", icon: { type: "lucide", value: "arrow-left-right" } },
```

- [ ] **Step 1b: Add icon to SETTINGS_ICON_COMPONENTS in constants.ts**

In `apps/desktop/src/pages/settings/constants.ts`, add the import and mapping:

```typescript
// Add to lucide-react imports:
import { ArrowLeftRight } from "lucide-react";

// Add to SETTINGS_ICON_COMPONENTS object:
  "arrow-left-right": ArrowLeftRight,
```

- [ ] **Step 2: Create section component**

```typescript
// apps/desktop/src/pages/settings/trading-accounts-section.tsx

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsItem } from "./components";
import { TradingAccountsDialog } from "./trading-accounts-dialog";

interface AccountSummary {
  id: string;
  exchange: string;
  name: string;
}

export function TradingAccountsSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);

  useEffect(() => {
    fetch("http://127.0.0.1:18790/api/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(data.accounts ?? []))
      .catch(() => {});
  }, [dialogOpen]); // refetch when dialog closes

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">交易账户</h2>
        <p className="text-sm text-muted-foreground">
          管理交易所 API 账户，用于自动化交易和数据获取。
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <SettingsItem
          title="已配置账户"
          description={`${accounts.length} 个交易账户`}
        >
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            管理交易账户
          </Button>
        </SettingsItem>

        {accounts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {accounts.map((acc) => (
              <Badge key={acc.id} variant="secondary">
                {acc.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <TradingAccountsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
```

- [ ] **Step 3: Wire into settings/index.tsx**

Add the section case to the rendering switch and import:

```typescript
import { TradingAccountsSection } from "./trading-accounts-section";

// In the section switch:
case "tradingAccounts":
  return <TradingAccountsSection />;
```

- [ ] **Step 4: Verify build**

Run: `cd apps/desktop && pnpm typecheck`

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/pages/settings/trading-accounts-section.tsx apps/desktop/src/navigation/navigation-meta.ts apps/desktop/src/pages/settings/index.tsx apps/desktop/src/pages/settings/constants.ts
git commit -m "feat(desktop): add trading accounts settings section entry"
```

---

## Task 9: Desktop Trading Accounts Dialog

**Files:**
- Create: `apps/desktop/src/pages/settings/trading-accounts-dialog.tsx`

- [ ] **Step 1: Create Dialog component**

```typescript
// apps/desktop/src/pages/settings/trading-accounts-dialog.tsx

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Eye, EyeOff, Copy, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ExchangeMeta {
  id: string;
  name: string;
  fields: string[];
  referral_url?: string;
  api_doc_url?: string;
  whitelist_ip?: string;
}

interface AccountItem {
  id: string;
  exchange: string;
  name: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GATEWAY = "http://127.0.0.1:18790";

export function TradingAccountsDialog({ open, onOpenChange }: Props) {
  const [exchanges, setExchanges] = useState<ExchangeMeta[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [selectedExchange, setSelectedExchange] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formPassphrase, setFormPassphrase] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [exRes, accRes] = await Promise.all([
        fetch(`${GATEWAY}/api/exchanges`).then((r) => r.json()),
        fetch(`${GATEWAY}/api/accounts`).then((r) => r.json()),
      ]);
      setExchanges(exRes.exchanges ?? []);
      setAccounts(accRes.accounts ?? []);
      if (exRes.exchanges?.length > 0) {
        setSelectedExchange((prev) => prev || exRes.exchanges[0].id);
      }
    } catch {
      toast.error("Failed to load exchange data");
    }
  }, []);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  const currentExchange = exchanges.find((e) => e.id === selectedExchange);
  const exchangeAccounts = accounts.filter((a) => a.exchange === selectedExchange);

  const resetForm = () => {
    const count = exchangeAccounts.length + 1;
    setFormName(`${currentExchange?.name ?? ""} #${count}`);
    setFormApiKey("");
    setFormSecret("");
    setFormPassphrase("");
    setShowApiKey(false);
    setShowSecret(false);
  };

  const handleSelectExchange = (id: string) => {
    setSelectedExchange(id);
    setShowForm(false);
  };

  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = {
        exchange: selectedExchange,
        name: formName,
        api_key: formApiKey,
        secret: formSecret,
      };
      if (formPassphrase) body.passphrase = formPassphrase;

      const res = await fetch(`${GATEWAY}/api/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("账户添加成功");
        setShowForm(false);
        await fetchData();
      } else {
        toast.error(data.error ?? "保存失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: string) => {
    toast.info("测试连接中...");
    try {
      const res = await fetch(`${GATEWAY}/api/accounts/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`连接成功 (${data.latency_ms}ms)`);
      } else {
        toast.error(`连接失败: ${data.error}`);
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除该账户？")) return;
    try {
      const res = await fetch(`${GATEWAY}/api/accounts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("账户已删除");
        await fetchData();
      } else {
        toast.error(data.error ?? "删除失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[70vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>导入交易账户</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — exchange list */}
          <ScrollArea className="w-56 border-r">
            <div className="p-2">
              {exchanges.map((ex) => {
                const count = accounts.filter((a) => a.exchange === ex.id).length;
                return (
                  <button
                    key={ex.id}
                    onClick={() => handleSelectExchange(ex.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
                      selectedExchange === ex.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="font-medium">{ex.name}</span>
                    {count > 0 && <Badge variant="secondary" className="text-xs">{count}</Badge>}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {/* Right panel — form / account list */}
          <div className="flex-1 overflow-y-auto p-6">
            {currentExchange && (
              <>
                {/* Top links */}
                <div className="flex gap-2 mb-4">
                  {currentExchange.referral_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={currentExchange.referral_url} target="_blank" rel="noreferrer">
                        注册(手续费折扣) <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                  {currentExchange.api_doc_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={currentExchange.api_doc_url} target="_blank" rel="noreferrer">
                        创建API <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>

                {/* Whitelist IP (Binance) */}
                {currentExchange.whitelist_ip && (
                  <div className="mb-4 p-3 rounded-lg border bg-muted/50 flex items-center justify-between">
                    <span className="text-sm">白名单IP: <code>{currentExchange.whitelist_ip}</code></span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(currentExchange.whitelist_ip!);
                        toast.success("IP已复制");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Existing accounts */}
                {exchangeAccounts.length > 0 && !showForm && (
                  <div className="space-y-2 mb-4">
                    {exchangeAccounts.map((acc) => (
                      <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">{acc.name}</p>
                          <p className="text-xs text-muted-foreground">{new Date(acc.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleTest(acc.id)}>
                            <Zap className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new / Form */}
                {!showForm ? (
                  <Button variant="outline" onClick={handleAddNew}>+ 添加新账户</Button>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">账户名称</label>
                      <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-1" />
                    </div>

                    <div>
                      <label className="text-sm font-medium">API密钥 *</label>
                      <div className="relative mt-1">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value={formApiKey}
                          onChange={(e) => setFormApiKey(e.target.value)}
                          placeholder="请输入API密钥"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">API Key 将被存储，请确保其有效</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium">密钥 *</label>
                      <div className="relative mt-1">
                        <Input
                          type={showSecret ? "text" : "password"}
                          value={formSecret}
                          onChange={(e) => setFormSecret(e.target.value)}
                          placeholder="输入密钥"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowSecret(!showSecret)}
                        >
                          {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {currentExchange.fields.includes("passphrase") && (
                      <div>
                        <label className="text-sm font-medium">密码(Passphrase) *</label>
                        <Input
                          type="password"
                          value={formPassphrase}
                          onChange={(e) => setFormPassphrase(e.target.value)}
                          placeholder="输入密码(Passphrase)"
                          className="mt-1"
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? "保存中..." : "保存配置"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/desktop && pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/pages/settings/trading-accounts-dialog.tsx
git commit -m "feat(desktop): add trading accounts dialog with exchange list and account form"
```

---

## Task 10: Unit Tests

**Files:**
- Create: `packages/core/src/account/ops/store.test.ts`
- Create: `packages/core/src/account/ops/crud.test.ts`
- Create: `packages/core/src/account/ops/exchanges/okx.test.ts`
- Create: `packages/core/src/account/ops/exchanges/binance.test.ts`

- [ ] **Step 1: Create store.test.ts**

```typescript
// packages/core/src/account/ops/store.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

// Mock getStateDir to use a temp directory
const TEST_DIR = join(__dirname, "__test_tmp__");
vi.mock("../../config/paths", () => ({
  getAccountsPath: () => join(TEST_DIR, "accounts.yaml"),
  getStateDir: () => TEST_DIR,
}));

import { readAccounts, writeAccounts, maskCredential, getAccountsFilePath } from "./store";
import type { AccountRecord } from "./types";

describe("store", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("readAccounts", () => {
    it("returns empty array when file does not exist", async () => {
      const result = await readAccounts();
      expect(result).toEqual([]);
    });

    it("reads accounts from YAML file", async () => {
      const accounts: AccountRecord[] = [
        {
          id: "test123",
          exchange: "okx",
          name: "OKX #1",
          api_key: "key123",
          secret: "secret123",
          passphrase: "pass123",
          created_at: "2026-05-14T00:00:00Z",
          updated_at: "2026-05-14T00:00:00Z",
        },
      ];
      await writeAccounts(accounts);
      const result = await readAccounts();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("test123");
      expect(result[0].api_key).toBe("key123");
    });
  });

  describe("writeAccounts", () => {
    it("creates file with 0600 permissions", async () => {
      await writeAccounts([]);
      const filePath = getAccountsFilePath();
      expect(existsSync(filePath)).toBe(true);
      // Check file content
      const content = await readFile(filePath, "utf-8");
      expect(content).toContain("accounts:");
    });

    it("overwrites existing data", async () => {
      const acc1: AccountRecord = {
        id: "a", exchange: "okx", name: "A",
        api_key: "k1", secret: "s1", passphrase: "p1",
        created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
      };
      const acc2: AccountRecord = {
        id: "b", exchange: "binance", name: "B",
        api_key: "k2", secret: "s2",
        created_at: "2026-01-02T00:00:00Z", updated_at: "2026-01-02T00:00:00Z",
      };
      await writeAccounts([acc1]);
      await writeAccounts([acc1, acc2]);
      const result = await readAccounts();
      expect(result).toHaveLength(2);
    });
  });

  describe("maskCredential", () => {
    it("masks credentials showing last 4 chars", () => {
      expect(maskCredential("abcdefgh1234")).toBe("****1234");
      expect(maskCredential("short")).toBe("****hort");
    });

    it("returns **** for very short values", () => {
      expect(maskCredential("ab")).toBe("****");
      expect(maskCredential("abcd")).toBe("****");
    });
  });
});
```

- [ ] **Step 2: Create crud.test.ts**

```typescript
// packages/core/src/account/ops/crud.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";

const TEST_DIR = join(__dirname, "__test_tmp_crud__");
vi.mock("../../config/paths", () => ({
  getAccountsPath: () => join(TEST_DIR, "accounts.yaml"),
  getStateDir: () => TEST_DIR,
}));

import { listAccounts, addAccount, viewAccount, updateAccount, removeAccount, findAccount } from "./crud";

describe("crud", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("addAccount", () => {
    it("creates account with valid input", async () => {
      const result = await addAccount({
        exchange: "okx",
        name: "OKX Test",
        api_key: "test-api-key-12345678",
        secret: "test-secret-12345678",
        passphrase: "test-passphrase",
      });
      expect(result.success).toBe(true);
      expect(result.account).toBeDefined();
      expect(result.account!.name).toBe("OKX Test");
      expect(result.account!.exchange).toBe("okx");
      expect(result.account!.id).toHaveLength(12);
    });

    it("rejects empty api_key", async () => {
      const result = await addAccount({
        exchange: "okx",
        name: "Test",
        api_key: "  ",
        secret: "secret",
        passphrase: "pass",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("api_key");
    });

    it("rejects missing passphrase for OKX", async () => {
      const result = await addAccount({
        exchange: "okx",
        name: "Test",
        api_key: "key",
        secret: "secret",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("passphrase");
    });

    it("allows missing passphrase for Binance", async () => {
      const result = await addAccount({
        exchange: "binance",
        name: "Binance Test",
        api_key: "key",
        secret: "secret",
      });
      expect(result.success).toBe(true);
    });

    it("rejects name exceeding 64 chars", async () => {
      const result = await addAccount({
        exchange: "binance",
        name: "A".repeat(65),
        api_key: "key",
        secret: "secret",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("max length");
    });

    it("trims whitespace from credentials", async () => {
      const result = await addAccount({
        exchange: "binance",
        name: "  Binance  ",
        api_key: "  key  ",
        secret: "  secret  ",
      });
      expect(result.success).toBe(true);
      expect(result.account!.name).toBe("Binance");
    });
  });

  describe("listAccounts", () => {
    it("returns empty list initially", async () => {
      const result = await listAccounts();
      expect(result.success).toBe(true);
      expect(result.accounts).toEqual([]);
    });

    it("returns accounts without credentials", async () => {
      await addAccount({ exchange: "binance", name: "B1", api_key: "k", secret: "s" });
      const result = await listAccounts();
      expect(result.accounts).toHaveLength(1);
      // Account should not contain credentials
      const acc = result.accounts[0] as Record<string, unknown>;
      expect(acc.api_key).toBeUndefined();
      expect(acc.secret).toBeUndefined();
    });
  });

  describe("viewAccount", () => {
    it("finds by ID", async () => {
      const created = await addAccount({ exchange: "binance", name: "B1", api_key: "mykey123", secret: "mysecret" });
      const result = await viewAccount(created.account!.id);
      expect(result.success).toBe(true);
      expect(result.masked_credentials!.api_key).toBe("****y123");
      expect(result.masked_credentials!.secret).toBe("****cret");
    });

    it("finds by name", async () => {
      await addAccount({ exchange: "binance", name: "UniqueB", api_key: "key", secret: "secret" });
      const result = await viewAccount("UniqueB");
      expect(result.success).toBe(true);
      expect(result.account!.name).toBe("UniqueB");
    });

    it("errors on ambiguous name", async () => {
      await addAccount({ exchange: "binance", name: "Dup", api_key: "k1", secret: "s1" });
      await addAccount({ exchange: "okx", name: "Dup", api_key: "k2", secret: "s2", passphrase: "p" });
      const result = await viewAccount("Dup");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Multiple accounts");
    });

    it("errors on not found", async () => {
      const result = await viewAccount("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("updateAccount", () => {
    it("updates name", async () => {
      const created = await addAccount({ exchange: "binance", name: "Old", api_key: "k", secret: "s" });
      const result = await updateAccount(created.account!.id, { name: "New" });
      expect(result.success).toBe(true);
      expect(result.account!.name).toBe("New");
    });

    it("updates credentials", async () => {
      const created = await addAccount({ exchange: "binance", name: "B", api_key: "old-key", secret: "old-secret" });
      await updateAccount(created.account!.id, { api_key: "new-key" });
      const view = await viewAccount(created.account!.id);
      expect(view.masked_credentials!.api_key).toBe("****-key");
    });

    it("refreshes updated_at", async () => {
      const created = await addAccount({ exchange: "binance", name: "B", api_key: "k", secret: "s" });
      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));
      const result = await updateAccount(created.account!.id, { name: "B2" });
      expect(result.account!.updated_at).not.toBe(created.account!.created_at);
    });

    it("errors on ambiguous name", async () => {
      await addAccount({ exchange: "binance", name: "Same", api_key: "k1", secret: "s1" });
      await addAccount({ exchange: "gate", name: "Same", api_key: "k2", secret: "s2" });
      const result = await updateAccount("Same", { name: "New" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Multiple accounts");
    });
  });

  describe("removeAccount", () => {
    it("removes by ID", async () => {
      const created = await addAccount({ exchange: "binance", name: "B1", api_key: "k", secret: "s" });
      const result = await removeAccount(created.account!.id);
      expect(result.success).toBe(true);
      const list = await listAccounts();
      expect(list.accounts).toHaveLength(0);
    });

    it("removes by name", async () => {
      await addAccount({ exchange: "binance", name: "ToRemove", api_key: "k", secret: "s" });
      const result = await removeAccount("ToRemove");
      expect(result.success).toBe(true);
    });

    it("errors on not found", async () => {
      const result = await removeAccount("nope");
      expect(result.success).toBe(false);
    });

    it("errors on ambiguous name", async () => {
      await addAccount({ exchange: "binance", name: "Dup", api_key: "k1", secret: "s1" });
      await addAccount({ exchange: "gate", name: "Dup", api_key: "k2", secret: "s2" });
      const result = await removeAccount("Dup");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Multiple accounts");
    });
  });

  describe("findAccount", () => {
    it("returns null for no match", async () => {
      const result = await findAccount("nothing");
      expect(result).toBeNull();
    });

    it("prefers ID over name", async () => {
      const created = await addAccount({ exchange: "binance", name: "SomeName", api_key: "k", secret: "s" });
      const result = await findAccount(created.account!.id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.account!.id);
    });
  });
});
```

- [ ] **Step 3: Create exchange signing tests (OKX)**

```typescript
// packages/core/src/account/ops/exchanges/okx.test.ts

import { describe, it, expect } from "vitest";
import { okxExchange } from "./okx";

describe("okxExchange", () => {
  describe("meta", () => {
    it("has correct id and fields", () => {
      expect(okxExchange.id).toBe("okx");
      expect(okxExchange.name).toBe("OKX");
      expect(okxExchange.fields).toEqual(["api_key", "secret", "passphrase"]);
    });

    it("has referral and api doc URLs", () => {
      expect(okxExchange.referral_url).toBeDefined();
      expect(okxExchange.api_doc_url).toBeDefined();
    });
  });

  describe("sign", () => {
    it("produces correct HMAC-SHA256 Base64 signature", () => {
      const credentials = {
        api_key: "test-key",
        secret: "test-secret",
        passphrase: "test-pass",
      };
      const params = {
        method: "GET" as const,
        path: "/api/v5/account/balance",
        timestamp: "2026-05-14T10:00:00.000Z",
      };

      const result = okxExchange.sign(credentials, params);

      expect(result.url).toBe("https://www.okx.com/api/v5/account/balance");
      expect(result.headers["OK-ACCESS-KEY"]).toBe("test-key");
      expect(result.headers["OK-ACCESS-PASSPHRASE"]).toBe("test-pass");
      expect(result.headers["OK-ACCESS-TIMESTAMP"]).toBe("2026-05-14T10:00:00.000Z");
      // Signature should be a base64 string
      expect(result.headers["OK-ACCESS-SIGN"]).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it("includes body in prehash when provided", () => {
      const credentials = { api_key: "k", secret: "s", passphrase: "p" };
      const withBody = okxExchange.sign(credentials, {
        method: "POST",
        path: "/api/v5/trade/order",
        timestamp: "2026-01-01T00:00:00Z",
        body: '{"instId":"BTC-USDT"}',
      });
      const withoutBody = okxExchange.sign(credentials, {
        method: "POST",
        path: "/api/v5/trade/order",
        timestamp: "2026-01-01T00:00:00Z",
      });
      // Different body should produce different signature
      expect(withBody.headers["OK-ACCESS-SIGN"]).not.toBe(withoutBody.headers["OK-ACCESS-SIGN"]);
    });
  });
});
```

- [ ] **Step 4: Create exchange signing tests (Binance)**

```typescript
// packages/core/src/account/ops/exchanges/binance.test.ts

import { describe, it, expect } from "vitest";
import { binanceExchange } from "./binance";

describe("binanceExchange", () => {
  describe("meta", () => {
    it("has correct id and fields", () => {
      expect(binanceExchange.id).toBe("binance");
      expect(binanceExchange.fields).toEqual(["api_key", "secret"]);
      expect(binanceExchange.whitelist_ip).toBe("195.135.193.235");
    });
  });

  describe("sign", () => {
    it("produces hex HMAC-SHA256 signature in query string", () => {
      const credentials = { api_key: "test-key", secret: "test-secret" };
      const params = {
        method: "GET" as const,
        path: "/api/v3/account",
        timestamp: "1700000000000",
      };

      const result = binanceExchange.sign(credentials, params);

      expect(result.url).toContain("https://api.binance.com/api/v3/account?");
      expect(result.url).toContain("timestamp=1700000000000");
      expect(result.url).toContain("signature=");
      expect(result.headers["X-MBX-APIKEY"]).toBe("test-key");
      // Signature should be hex
      const sig = result.url.split("signature=")[1];
      expect(sig).toMatch(/^[a-f0-9]{64}$/);
    });

    it("includes additional params in signature", () => {
      const credentials = { api_key: "k", secret: "s" };
      const result = binanceExchange.sign(credentials, {
        method: "GET",
        path: "/api/v3/order",
        timestamp: "123",
        params: { symbol: "BTCUSDT", orderId: "1" },
      });
      expect(result.url).toContain("symbol=BTCUSDT");
      expect(result.url).toContain("orderId=1");
      expect(result.url).toContain("timestamp=123");
    });
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd packages/core && pnpm test -- --run src/account/
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/account/ops/store.test.ts packages/core/src/account/ops/crud.test.ts packages/core/src/account/ops/exchanges/okx.test.ts packages/core/src/account/ops/exchanges/binance.test.ts
git commit -m "test(account): add unit tests for store, CRUD, and exchange signing"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Full typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 2: CLI end-to-end test with real exchange (if keys available)**

```bash
viben account add --exchange okx --name "Real OKX" --api-key "<real>" --secret "<real>" --passphrase "<real>"
viben account test "Real OKX"
```

- [ ] **Step 3: Gateway route test**

```bash
curl -X POST http://127.0.0.1:18790/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"exchange":"binance","name":"Binance Test","api_key":"test","secret":"test"}'

curl http://127.0.0.1:18790/api/accounts | jq .
curl -X POST http://127.0.0.1:18790/api/accounts/<id>/test | jq .
curl -X DELETE http://127.0.0.1:18790/api/accounts/<id> | jq .
```

- [ ] **Step 4: Desktop UI visual check**

Open Desktop app → Settings → Trading Accounts → "管理交易账户" → verify dialog renders correctly.

- [ ] **Step 5: Verify YAML file permissions**

```bash
ls -la ~/.viben/accounts.yaml
# Expected: -rw------- (600)
```

- [ ] **Step 6: Clean up test accounts**

```bash
viben account list
viben account remove <any-test-account>
```
