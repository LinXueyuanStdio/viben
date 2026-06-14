import { appendEvent, readAllEvents } from "@/lib/session-store";
import { restoreSessionState } from "@/lib/state-machine";
import { syncAccountState } from "@/lib/sync";
import { startAutoTrading, stopAutoTrading } from "@/lib/scheduler";
import { NextResponse } from "next/server";
import type { SessionPauseEvent, SessionResumeEvent, SessionEndEvent } from "@/lib/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = await req.json();

  switch (action) {
    case "pause": {
      stopAutoTrading(id);
      const state = await restoreSessionState(id);
      const event: SessionPauseEvent = {
        type: "session_pause",
        ts: new Date().toISOString(),
        reason: "user_manual",
        last_cycle: state.current_cycle,
        current_nav: state.metrics.nav,
      };
      await appendEvent(id, event);
      break;
    }
    case "resume": {
      const state = await restoreSessionState(id);
      const synced = await syncAccountState(state.account_id);
      const event: SessionResumeEvent = {
        type: "session_resume",
        ts: new Date().toISOString(),
        resume_from_cycle: state.current_cycle,
        synced_balance: synced.balances,
        synced_positions: synced.positions,
        synced_nav: synced.nav,
      };
      await appendEvent(id, event);
      startAutoTrading(id, state.agent_config.interval_minutes);
      break;
    }
    case "stop": {
      stopAutoTrading(id);
      const state = await restoreSessionState(id);
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
      await appendEvent(id, event);
      break;
    }
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
