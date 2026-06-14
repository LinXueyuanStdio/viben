import type { SessionState, SessionMetrics, NavPoint } from "./types";

export function computeMetrics(state: SessionState): SessionMetrics {
  const { trades, nav_history, initial_balance } = state;
  const initialNav = Object.values(initial_balance).reduce((s, v) => s + v, 0);
  const currentNav = state.metrics.nav || initialNav;

  const closedTrades = trades.filter((t) => t.realized_pnl !== undefined);
  const wins = closedTrades.filter((t) => (t.realized_pnl ?? 0) > 0);
  const losses = closedTrades.filter((t) => (t.realized_pnl ?? 0) < 0);
  const winRate = closedTrades.length > 0 ? wins.length / closedTrades.length : 0;

  const totalPnl = currentNav - initialNav;
  const totalPnlPct = initialNav > 0 ? (totalPnl / initialNav) * 100 : 0;

  const { maxDrawdown, maxDrawdownPct } = computeMaxDrawdown(nav_history);
  const sharpeRatio = computeSharpe(nav_history);
  const totalFees = trades.reduce((s, t) => s + t.fee, 0);

  return {
    ...state.metrics,
    win_rate: winRate,
    total_pnl: totalPnl,
    total_pnl_pct: totalPnlPct,
    nav: currentNav,
    nav_change_pct: totalPnlPct,
    max_drawdown: maxDrawdown,
    max_drawdown_pct: maxDrawdownPct,
    sharpe_ratio: sharpeRatio,
    total_trades: trades.length,
    win_count: wins.length,
    loss_count: losses.length,
    total_fees: totalFees,
  };
}

function computeMaxDrawdown(navHistory: NavPoint[]): { maxDrawdown: number; maxDrawdownPct: number } {
  if (navHistory.length < 2) return { maxDrawdown: 0, maxDrawdownPct: 0 };

  let peak = navHistory[0].nav;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;

  for (const point of navHistory) {
    if (point.nav > peak) peak = point.nav;
    const drawdown = peak - point.nav;
    const drawdownPct = peak > 0 ? drawdown / peak : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPct = drawdownPct;
    }
  }

  return { maxDrawdown, maxDrawdownPct };
}

function computeSharpe(navHistory: NavPoint[]): number {
  if (navHistory.length < 3) return 0;

  const returns: number[] = [];
  for (let i = 1; i < navHistory.length; i++) {
    const prev = navHistory[i - 1].nav;
    if (prev > 0) {
      returns.push((navHistory[i].nav - prev) / prev);
    }
  }

  if (returns.length < 2) return 0;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);

  if (std === 0) return 0;

  const annualizationFactor = Math.sqrt(365 * 24);
  return (mean / std) * annualizationFactor;
}
