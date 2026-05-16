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
