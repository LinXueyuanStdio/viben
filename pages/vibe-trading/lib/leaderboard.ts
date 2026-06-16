import type { LeaderboardEntry } from "./types";
import { listSessions, readAllEvents } from "./session-store";
import { restoreSessionState } from "./state-machine";

export async function computeLeaderboard(): Promise<LeaderboardEntry[]> {
  const sessionIds = await listSessions();
  const entries: LeaderboardEntry[] = [];

  for (const id of sessionIds) {
    const state = await restoreSessionState(id);
    if (!state.agent_config) continue;

    const initialNav = Object.values(state.initial_balance).reduce((s, v) => s + v, 0);
    if (initialNav === 0) continue;

    const currentNav = state.metrics.nav || initialNav;
    const cumulativeReturn = ((currentNav - initialNav) / initialNav) * 100;

    const closedTrades = state.trades.filter((t) => t.realized_pnl !== undefined);
    const wins = closedTrades.filter((t) => (t.realized_pnl ?? 0) > 0);
    const losses = closedTrades.filter((t) => (t.realized_pnl ?? 0) < 0);
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.realized_pnl ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.realized_pnl ?? 0), 0) / losses.length) : 1;
    const profitLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

    const firstEvent = (await readAllEvents(id))[0];
    const startTime = firstEvent ? new Date(firstEvent.ts).getTime() : Date.now();
    const runningDays = Math.max(1, Math.round((Date.now() - startTime) / 86_400_000));
    const dailyReturn = cumulativeReturn / runningDays;

    const lastTradeTime = state.trades.length > 0
      ? state.trades[state.trades.length - 1].ts
      : firstEvent?.ts ?? new Date().toISOString();

    const navPoints = state.nav_history.slice(-30).map((p) => p.nav);

    entries.push({
      rank: 0,
      session_id: id,
      session_name: state.session_name || id,
      cumulative_return_pct: Math.round(cumulativeReturn * 100) / 100,
      max_drawdown_pct: Math.round(state.metrics.max_drawdown_pct * 10000) / 100,
      sharpe_ratio: Math.round(state.metrics.sharpe_ratio * 100) / 100,
      win_rate: Math.round(state.metrics.win_rate * 10000) / 100,
      profit_loss_ratio: Math.round(profitLossRatio * 100) / 100,
      daily_return_pct: Math.round(dailyReturn * 100) / 100,
      nav_history: navPoints,
      symbols_count: state.agent_config.symbols?.length ?? 0,
      last_trade_time: lastTradeTime,
      running_days: runningDays,
      total_trades: state.trades.length,
      agent_config: state.agent_config,
    });
  }

  entries.sort((a, b) => b.cumulative_return_pct - a.cumulative_return_pct);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return entries;
}
