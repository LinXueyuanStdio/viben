import { getExchange } from "./exchanges";
import { getAccount } from "./account-store";
import type { Position } from "./types";

export async function syncAccountState(accountId: string): Promise<{
  balances: Record<string, number>;
  positions: Position[];
  nav: number;
}> {
  const account = await getAccount(accountId);
  if (!account) throw new Error(`Account ${accountId} not found`);

  const exchange = getExchange(account.exchange, account.is_demo);
  const creds = { api_key: account.api_key, secret: account.secret, passphrase: account.passphrase };

  const [balanceInfo, positions] = await Promise.all([
    exchange.getBalance(creds),
    exchange.getPositions(creds),
  ]);

  const balanceTotal = Object.values(balanceInfo.balances).reduce((s, v) => s + v, 0);
  const positionValue = positions.reduce(
    (s, p) => s + p.quantity * (p.current_price ?? p.entry_price),
    0
  );

  return {
    balances: balanceInfo.balances,
    positions,
    nav: balanceTotal + positionValue,
  };
}
