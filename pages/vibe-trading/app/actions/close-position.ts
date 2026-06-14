"use server";

import { executeOrder } from "@/lib/order";
import { revalidatePath } from "next/cache";

export async function closePosition(
  sessionId: string,
  symbol: string,
  side: "long" | "short",
  quantity: number
) {
  await executeOrder(sessionId, {
    symbol,
    side: side === "long" ? "sell" : "buy",
    type: "market",
    quantity,
    source: "manual",
    estimated_usdt: 0,
    skip_risk_check: true,
  });
  revalidatePath("/");
}

export async function closeAllPositions(
  sessionId: string,
  positions: Array<{ symbol: string; side: "long" | "short"; quantity: number }>
) {
  for (const pos of positions) {
    await executeOrder(sessionId, {
      symbol: pos.symbol,
      side: pos.side === "long" ? "sell" : "buy",
      type: "market",
      quantity: pos.quantity,
      source: "manual",
      estimated_usdt: 0,
      skip_risk_check: true,
    });
  }
  revalidatePath("/");
}
