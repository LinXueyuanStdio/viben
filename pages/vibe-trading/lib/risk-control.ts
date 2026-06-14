import type { Position, SessionMetrics, ExchangeId } from "./types";

export interface RiskConfig {
  // Pre-trade limits
  max_position_pct: number;        // Max % of total balance per single position (0-1)
  max_single_order_usdt: number;   // Max USDT value per single order
  max_daily_trades: number;        // Max trades per day
  min_order_interval_sec: number;  // Minimum seconds between orders

  // Position limits
  stop_loss_pct: number;           // Stop-loss trigger (e.g., 0.05 = 5% loss)
  take_profit_pct: number;         // Take-profit trigger (e.g., 0.1 = 10% gain)
  max_leverage: number;            // Max allowed leverage
  max_open_positions: number;      // Max concurrent positions

  // Session/global limits
  max_daily_loss_pct: number;      // Max daily loss as % of initial balance (e.g., 0.05)
  max_drawdown_pct: number;        // Max drawdown before halting (e.g., 0.15)
  min_balance_usdt: number;        // Minimum balance to keep (safety floor)
}

export interface RiskCheckResult {
  allowed: boolean;
  violations: RiskViolation[];
}

export interface RiskViolation {
  rule: string;
  message: string;
  severity: "warning" | "block";
  current_value: number;
  limit_value: number;
}

export interface RiskContext {
  total_balance_usdt: number;
  available_balance_usdt: number;
  positions: Position[];
  metrics: SessionMetrics;
  daily_trade_count: number;
  last_order_ts: string | null;
  initial_balance_usdt: number;
}

export function getDefaultRiskConfig(riskLevel: "low" | "medium" | "high"): RiskConfig {
  switch (riskLevel) {
    case "low":
      return {
        max_position_pct: 0.1,
        max_single_order_usdt: 500,
        max_daily_trades: 5,
        min_order_interval_sec: 300,
        stop_loss_pct: 0.03,
        take_profit_pct: 0.06,
        max_leverage: 1,
        max_open_positions: 2,
        max_daily_loss_pct: 0.02,
        max_drawdown_pct: 0.05,
        min_balance_usdt: 1,
      };
    case "medium":
      return {
        max_position_pct: 0.25,
        max_single_order_usdt: 2000,
        max_daily_trades: 15,
        min_order_interval_sec: 60,
        stop_loss_pct: 0.05,
        take_profit_pct: 0.1,
        max_leverage: 3,
        max_open_positions: 5,
        max_daily_loss_pct: 0.05,
        max_drawdown_pct: 0.15,
        min_balance_usdt: 1,
      };
    case "high":
      return {
        max_position_pct: 0.5,
        max_single_order_usdt: 10000,
        max_daily_trades: 50,
        min_order_interval_sec: 10,
        stop_loss_pct: 0.08,
        take_profit_pct: 0.2,
        max_leverage: 10,
        max_open_positions: 10,
        max_daily_loss_pct: 0.1,
        max_drawdown_pct: 0.3,
        min_balance_usdt: 1,
      };
  }
}

export function checkPreTradeRisk(
  order: {
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    price?: number;
    estimated_usdt: number;
  },
  context: RiskContext,
  config: RiskConfig
): RiskCheckResult {
  const violations: RiskViolation[] = [];

  // Check: position size vs max_position_pct
  const positionPct = context.total_balance_usdt > 0
    ? order.estimated_usdt / context.total_balance_usdt
    : 1;
  if (positionPct > config.max_position_pct) {
    violations.push({
      rule: "max_position_pct",
      message: `Order size ${(positionPct * 100).toFixed(1)}% of balance exceeds limit ${(config.max_position_pct * 100).toFixed(1)}%`,
      severity: "block",
      current_value: positionPct,
      limit_value: config.max_position_pct,
    });
  }

  // Check: order value vs max_single_order_usdt
  if (order.estimated_usdt > config.max_single_order_usdt) {
    violations.push({
      rule: "max_single_order_usdt",
      message: `Order value $${order.estimated_usdt.toFixed(2)} exceeds limit $${config.max_single_order_usdt.toFixed(2)}`,
      severity: "block",
      current_value: order.estimated_usdt,
      limit_value: config.max_single_order_usdt,
    });
  }

  // Check: daily_trade_count vs max_daily_trades
  if (context.daily_trade_count >= config.max_daily_trades) {
    violations.push({
      rule: "max_daily_trades",
      message: `Daily trade count ${context.daily_trade_count} has reached limit ${config.max_daily_trades}`,
      severity: "block",
      current_value: context.daily_trade_count,
      limit_value: config.max_daily_trades,
    });
  }

  // Check: time since last order vs min_order_interval_sec
  if (context.last_order_ts) {
    const lastOrderTime = new Date(context.last_order_ts).getTime();
    const now = Date.now();
    const elapsedSec = (now - lastOrderTime) / 1000;
    if (elapsedSec < config.min_order_interval_sec) {
      violations.push({
        rule: "min_order_interval_sec",
        message: `Only ${elapsedSec.toFixed(0)}s since last order, minimum interval is ${config.min_order_interval_sec}s`,
        severity: "block",
        current_value: elapsedSec,
        limit_value: config.min_order_interval_sec,
      });
    }
  }

  // Check: total balance vs min_balance_usdt
  if (context.available_balance_usdt < config.min_balance_usdt) {
    violations.push({
      rule: "min_balance_usdt",
      message: `Available balance $${context.available_balance_usdt.toFixed(2)} is below safety floor $${config.min_balance_usdt.toFixed(2)}`,
      severity: "block",
      current_value: context.available_balance_usdt,
      limit_value: config.min_balance_usdt,
    });
  }

  // Check: number of open positions vs max_open_positions
  if (context.positions.length >= config.max_open_positions) {
    violations.push({
      rule: "max_open_positions",
      message: `Open positions ${context.positions.length} has reached limit ${config.max_open_positions}`,
      severity: "block",
      current_value: context.positions.length,
      limit_value: config.max_open_positions,
    });
  }

  const hasBlock = violations.some((v) => v.severity === "block");
  return {
    allowed: !hasBlock,
    violations,
  };
}

export function checkPositionRisk(
  position: Position,
  config: RiskConfig
): RiskCheckResult {
  const violations: RiskViolation[] = [];

  const pnlPct = position.unrealized_pnl_pct ?? 0;

  // Check: unrealized loss vs stop_loss_pct
  if (pnlPct < 0 && Math.abs(pnlPct) >= config.stop_loss_pct) {
    violations.push({
      rule: "stop_loss_pct",
      message: `Position ${position.symbol} loss ${(Math.abs(pnlPct) * 100).toFixed(2)}% has hit stop-loss ${(config.stop_loss_pct * 100).toFixed(1)}%`,
      severity: "block",
      current_value: Math.abs(pnlPct),
      limit_value: config.stop_loss_pct,
    });
  }

  // Check: unrealized gain vs take_profit_pct (warning only)
  if (pnlPct > 0 && pnlPct >= config.take_profit_pct) {
    violations.push({
      rule: "take_profit_pct",
      message: `Position ${position.symbol} gain ${(pnlPct * 100).toFixed(2)}% has reached take-profit ${(config.take_profit_pct * 100).toFixed(1)}%`,
      severity: "warning",
      current_value: pnlPct,
      limit_value: config.take_profit_pct,
    });
  }

  const hasBlock = violations.some((v) => v.severity === "block");
  return {
    allowed: !hasBlock,
    violations,
  };
}

export function checkSessionRisk(
  context: RiskContext,
  config: RiskConfig
): RiskCheckResult {
  const violations: RiskViolation[] = [];

  // Check: current day's loss vs max_daily_loss_pct
  const dailyLossPct = context.initial_balance_usdt > 0
    ? Math.max(0, -context.metrics.total_pnl) / context.initial_balance_usdt
    : 0;
  if (dailyLossPct >= config.max_daily_loss_pct) {
    violations.push({
      rule: "max_daily_loss_pct",
      message: `Daily loss ${(dailyLossPct * 100).toFixed(2)}% has reached limit ${(config.max_daily_loss_pct * 100).toFixed(1)}%`,
      severity: "block",
      current_value: dailyLossPct,
      limit_value: config.max_daily_loss_pct,
    });
  }

  // Check: max_drawdown vs max_drawdown_pct
  if (context.metrics.max_drawdown_pct >= config.max_drawdown_pct) {
    violations.push({
      rule: "max_drawdown_pct",
      message: `Max drawdown ${(context.metrics.max_drawdown_pct * 100).toFixed(2)}% has reached limit ${(config.max_drawdown_pct * 100).toFixed(1)}%`,
      severity: "block",
      current_value: context.metrics.max_drawdown_pct,
      limit_value: config.max_drawdown_pct,
    });
  }

  // Check: remaining balance vs min_balance_usdt
  if (context.total_balance_usdt < config.min_balance_usdt) {
    violations.push({
      rule: "min_balance_usdt",
      message: `Total balance $${context.total_balance_usdt.toFixed(2)} is below safety floor $${config.min_balance_usdt.toFixed(2)}`,
      severity: "block",
      current_value: context.total_balance_usdt,
      limit_value: config.min_balance_usdt,
    });
  }

  const hasBlock = violations.some((v) => v.severity === "block");
  return {
    allowed: !hasBlock,
    violations,
  };
}

export function formatRiskReport(result: RiskCheckResult): string {
  if (result.violations.length === 0) {
    return "Risk check passed. No violations detected.";
  }

  const lines: string[] = [];
  lines.push(result.allowed ? "Risk check passed with warnings:" : "Risk check FAILED - order blocked:");
  lines.push("");

  for (const v of result.violations) {
    const icon = v.severity === "block" ? "[BLOCK]" : "[WARN]";
    lines.push(`  ${icon} ${v.rule}: ${v.message}`);
  }

  const blockCount = result.violations.filter((v) => v.severity === "block").length;
  const warnCount = result.violations.filter((v) => v.severity === "warning").length;
  lines.push("");
  lines.push(`Summary: ${blockCount} block(s), ${warnCount} warning(s)`);

  return lines.join("\n");
}
