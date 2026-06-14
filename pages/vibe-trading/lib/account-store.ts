import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { nanoid } from "nanoid";
import type { Account, AccountsFile, ExchangeId } from "./types";

const ACCOUNTS_PATH = join(process.cwd(), "accounts.yaml");

export async function readAccounts(): Promise<Account[]> {
  if (!existsSync(ACCOUNTS_PATH)) return [];
  const content = await readFile(ACCOUNTS_PATH, "utf-8");
  const data = yaml.load(content) as AccountsFile | null;
  return data?.accounts ?? [];
}

export async function writeAccounts(accounts: Account[]): Promise<void> {
  const data: AccountsFile = { accounts };
  const content = yaml.dump(data, { lineWidth: 120 });
  await writeFile(ACCOUNTS_PATH, content, { encoding: "utf-8", mode: 0o600 });
}

export async function addAccount(params: {
  exchange: ExchangeId;
  name: string;
  api_key: string;
  secret: string;
  passphrase?: string;
  is_demo?: boolean;
}): Promise<Account> {
  const accounts = await readAccounts();
  const account: Account = {
    id: `acc_${nanoid(8)}`,
    ...params,
    created_at: new Date().toISOString(),
  };
  accounts.push(account);
  await writeAccounts(accounts);
  return account;
}

export async function removeAccount(id: string): Promise<boolean> {
  const accounts = await readAccounts();
  const filtered = accounts.filter((a) => a.id !== id);
  if (filtered.length === accounts.length) return false;
  await writeAccounts(filtered);
  return true;
}

export async function getAccount(id: string): Promise<Account | undefined> {
  const accounts = await readAccounts();
  return accounts.find((a) => a.id === id);
}
