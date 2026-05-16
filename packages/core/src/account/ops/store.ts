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
