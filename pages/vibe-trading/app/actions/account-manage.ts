"use server";

import { addAccount, removeAccount, readAccounts, getAccount } from "@/lib/account-store";
import { getExchange } from "@/lib/exchanges";
import { revalidatePath } from "next/cache";
import type { ExchangeId } from "@/lib/types";

export async function addAccountAction(formData: FormData) {
  const exchange = formData.get("exchange") as ExchangeId;
  const name = formData.get("name") as string;
  const apiKey = formData.get("api_key") as string;
  const secret = formData.get("secret") as string;
  const passphrase = formData.get("passphrase") as string | null;
  const isDemo = formData.get("is_demo") === "true";

  const account = await addAccount({
    exchange,
    name,
    api_key: isDemo ? `demo_key_${Date.now()}` : apiKey,
    secret: isDemo ? `demo_secret_${Date.now()}` : secret,
    passphrase: passphrase || undefined,
    is_demo: isDemo || undefined,
  });

  revalidatePath("/");
  return account;
}

export async function removeAccountAction(id: string) {
  const success = await removeAccount(id);
  revalidatePath("/");
  return { success };
}

export async function testAccountAction(id: string) {
  const account = await getAccount(id);
  if (!account) return { ok: false, error: "Account not found" };

  const exchange = getExchange(account.exchange, account.is_demo);
  const creds = { api_key: account.api_key, secret: account.secret, passphrase: account.passphrase };
  return exchange.testConnection(creds);
}

export async function listAccountsAction() {
  return readAccounts();
}
