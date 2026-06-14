"use server";

import { appendEvent } from "@/lib/session-store";
import { syncAccountState } from "@/lib/sync";
import { restoreSessionState } from "@/lib/state-machine";
import { startAutoTrading, stopAutoTrading } from "@/lib/scheduler";
import { revalidatePath } from "next/cache";
import type { SessionPauseEvent, SessionResumeEvent, SessionEndEvent } from "@/lib/types";

export async function pauseSession(sessionId: string) {
  stopAutoTrading(sessionId);
  const state = await restoreSessionState(sessionId);
  const event: SessionPauseEvent = {
    type: "session_pause",
    ts: new Date().toISOString(),
    reason: "user_manual",
    last_cycle: state.current_cycle,
    current_nav: state.metrics.nav,
  };
  await appendEvent(sessionId, event);
  revalidatePath("/");
}

export async function resumeSession(sessionId: string) {
  const state = await restoreSessionState(sessionId);
  const synced = await syncAccountState(state.account_id);

  const localBalance = state.metrics.available_balance;
  const diff: Record<string, number> = {};
  const allKeys = new Set([...Object.keys(localBalance), ...Object.keys(synced.balances)]);
  let hasDrift = false;
  for (const key of allKeys) {
    const d = (synced.balances[key] ?? 0) - (localBalance[key] ?? 0);
    if (Math.abs(d) > 0.0001) { diff[key] = d; hasDrift = true; }
  }

  const event: SessionResumeEvent = {
    type: "session_resume",
    ts: new Date().toISOString(),
    resume_from_cycle: state.current_cycle,
    synced_balance: synced.balances,
    synced_positions: synced.positions,
    synced_nav: synced.nav,
    drift_detected: hasDrift ? { balance_diff: diff, position_diff: "Balance mismatch detected" } : undefined,
  };
  await appendEvent(sessionId, event);
  startAutoTrading(sessionId, state.agent_config.interval_minutes);
  revalidatePath("/");
}

export async function stopSession(sessionId: string) {
  stopAutoTrading(sessionId);
  const state = await restoreSessionState(sessionId);
  const initialNav = Object.values(state.initial_balance).reduce((s, v) => s + v, 0);
  const duration = state.nav_history.length > 0
    ? (Date.now() - new Date(state.nav_history[0].ts).getTime()) / 3600000
    : 0;

  const closedTrades = state.trades.filter((t) => t.realized_pnl !== undefined);
  const best = closedTrades.length > 0
    ? closedTrades.reduce((a, b) => ((a.realized_pnl ?? 0) > (b.realized_pnl ?? 0) ? a : b))
    : null;
  const worst = closedTrades.length > 0
    ? closedTrades.reduce((a, b) => ((a.realized_pnl ?? 0) < (b.realized_pnl ?? 0) ? a : b))
    : null;

  const event: SessionEndEvent = {
    type: "session_end",
    ts: new Date().toISOString(),
    reason: "user_stop",
    summary: {
      duration_hours: duration,
      total_cycles: state.current_cycle,
      total_trades: state.metrics.total_trades,
      win_count: state.metrics.win_count,
      loss_count: state.metrics.loss_count,
      win_rate: state.metrics.win_rate,
      total_pnl: state.metrics.total_pnl,
      total_pnl_pct: state.metrics.total_pnl_pct,
      max_drawdown: state.metrics.max_drawdown,
      max_drawdown_pct: state.metrics.max_drawdown_pct,
      sharpe_ratio: state.metrics.sharpe_ratio,
      best_trade: best ? { symbol: best.symbol, pnl: best.realized_pnl ?? 0, pnl_pct: 0 } : { symbol: "-", pnl: 0, pnl_pct: 0 },
      worst_trade: worst ? { symbol: worst.symbol, pnl: worst.realized_pnl ?? 0, pnl_pct: 0 } : { symbol: "-", pnl: 0, pnl_pct: 0 },
      total_fees: state.metrics.total_fees,
    },
  };
  await appendEvent(sessionId, event);
  revalidatePath("/");
}
