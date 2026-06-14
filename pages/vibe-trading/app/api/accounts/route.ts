import { readAccounts, addAccount } from "@/lib/account-store";
import { NextResponse } from "next/server";
import type { ExchangeId } from "@/lib/types";

export async function GET() {
  const accounts = await readAccounts();
  const safe = accounts.map(({ secret, ...rest }) => ({ ...rest, secret: "***" }));
  return NextResponse.json({ accounts: safe });
}

export async function POST(req: Request) {
  const body = await req.json();
  const account = await addAccount({
    exchange: body.exchange as ExchangeId,
    name: body.name,
    api_key: body.api_key,
    secret: body.secret,
    passphrase: body.passphrase,
  });
  return NextResponse.json(account);
}
