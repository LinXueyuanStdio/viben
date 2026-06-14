"use server";

import { readAllEvents, appendEvent } from "@/lib/session-store";
import { getAccount } from "@/lib/account-store";
import { getExchange } from "@/lib/exchanges";
import { revalidatePath } from "next/cache";
import type { SessionInitEvent, OrderCancelEvent } from "@/lib/types";

export async function cancelOrder(sessionId: string, orderId: string, symbol: string) {
  const events = await readAllEvents(sessionId);
  const initEvent = events.find((e) => e.type === "session_init") as SessionInitEvent | undefined;
  if (!initEvent) throw new Error("Session not initialized");

  const account = await getAccount(initEvent.account_id);
  if (!account) throw new Error("Account not found");

  const exchange = getExchange(account.exchange, account.is_demo);
  const creds = { api_key: account.api_key, secret: account.secret, passphrase: account.passphrase };

  const success = await exchange.cancelOrder(creds, orderId, symbol);

  const cancelEvent: OrderCancelEvent = {
    type: "order_cancel",
    ts: new Date().toISOString(),
    order_id: orderId,
    source: "manual",
    reason: success ? "user_cancelled" : "cancel_failed",
  };
  await appendEvent(sessionId, cancelEvent);

  revalidatePath("/");
  return { success };
}
