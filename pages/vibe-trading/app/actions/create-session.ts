"use server";

import { generateSessionId, appendEvent } from "@/lib/session-store";
import { syncAccountState } from "@/lib/sync";
import { startAutoTrading } from "@/lib/scheduler";
import { revalidatePath } from "next/cache";
import type { ExchangeId, SessionInitEvent } from "@/lib/types";

export async function createSession(formData: FormData) {
  const sessionName = formData.get("session_name") as string;
  const accountId = formData.get("account_id") as string;
  const exchange = formData.get("exchange") as ExchangeId;
  const model = formData.get("model") as string;
  const strategyName = formData.get("strategy_name") as string;
  const strategyDescription = (formData.get("strategy_description") as string) || "";
  const riskLevel = (formData.get("risk_level") as "low" | "medium" | "high") || "medium";
  const symbols = (formData.get("symbols") as string).split(",").map((s) => s.trim());
  const intervalMinutes = parseInt(formData.get("interval_minutes") as string) || 60;
  const maxPositionPct = parseFloat(formData.get("max_position_pct") as string) || 0.5;
  const marketMode = (formData.get("market_mode") as "simulated" | "real") || "simulated";

  const sessionId = generateSessionId();

  let initialBalance: Record<string, number> = { USDT: 10000 };
  if (accountId) {
    try {
      const synced = await syncAccountState(accountId);
      initialBalance = synced.balances;
    } catch {
      // Account sync failed (no API key, network issue), use default balance
    }
  }

  const event: SessionInitEvent = {
    type: "session_init",
    ts: new Date().toISOString(),
    session_id: sessionId,
    session_name: sessionName,
    account_id: accountId || "demo",
    exchange,
    initial_balance: initialBalance,
    agent_config: {
      model,
      strategy_name: strategyName,
      strategy_description: strategyDescription,
      risk_level: riskLevel,
      symbols,
      interval_minutes: intervalMinutes,
      max_position_pct: maxPositionPct,
      market_mode: marketMode,
      account_id: accountId || undefined,
    },
    tags: [exchange, model, riskLevel],
  };

  await appendEvent(sessionId, event);
  startAutoTrading(sessionId, intervalMinutes);
  revalidatePath("/");
  return { session_id: sessionId };
}
