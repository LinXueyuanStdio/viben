"use server";

import { runTradingCycle } from "@/lib/trading-engine";
import { revalidatePath } from "next/cache";
import type { TradingCycleResult } from "@/lib/trading-engine";

export async function runOneCycle(
  sessionId: string
): Promise<TradingCycleResult> {
  const result = await runTradingCycle(sessionId);
  revalidatePath("/");
  return result;
}
