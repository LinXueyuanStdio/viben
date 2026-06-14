import { nanoid } from "nanoid";
import { getExchange } from "./exchanges";
import type { OrderParams } from "./exchanges/types";
import { getAccount } from "./account-store";
import { appendEvent, readAllEvents } from "./session-store";
import type {
  SessionEvent,
  OrderSubmitEvent,
  OrderResultEvent,
  SessionInitEvent,
  RiskViolationEvent,
  AccountSnapshotEvent,
} from "./types";
import {
  checkPreTradeRisk,
  getDefaultRiskConfig,
} from "./risk-control";
import type { RiskConfig, RiskContext } from "./risk-control";

export interface ExecuteOrderOptions {
  source?: "agent" | "manual";
  estimated_usdt?: number;
  risk_config?: RiskConfig;
  skip_risk_check?: boolean;
}

export async function executeOrder(
  sessionId: string,
  params: OrderParams & ExecuteOrderOptions
): Promise<OrderResultEvent> {
  const events = await readAllEvents(sessionId);
  const initEvent = events.find((e) => e.type === "session_init") as SessionInitEvent | undefined;
  if (!initEvent) throw new Error("Session not initialized");

  const account = await getAccount(initEvent.account_id);
  if (!account) throw new Error(`Account ${initEvent.account_id} not found`);

  const exchange = getExchange(account.exchange, account.is_demo);
  const cycle = events.filter((e) => "cycle" in e).reduce((max, e) => Math.max(max, (e as { cycle: number }).cycle), 0);

  // Risk check (unless explicitly skipped)
  if (!params.skip_risk_check) {
    const riskConfig = params.risk_config ?? getDefaultRiskConfig(initEvent.agent_config.risk_level);
    const context = buildRiskContext(events, initEvent);
    const estimatedUsdt = params.estimated_usdt ?? (params.price ? params.price * params.quantity : 0);

    const riskResult = checkPreTradeRisk(
      {
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
        estimated_usdt: estimatedUsdt,
      },
      context,
      riskConfig
    );

    // Record violations as events
    for (const violation of riskResult.violations) {
      const violationEvent: RiskViolationEvent = {
        type: "risk_violation",
        ts: new Date().toISOString(),
        cycle,
        rule: violation.rule,
        severity: violation.severity,
        message: violation.message,
        current_value: violation.current_value,
        limit_value: violation.limit_value,
        order_rejected: !riskResult.allowed,
      };
      await appendEvent(sessionId, violationEvent);
    }

    // If blocked, return a rejected order result without submitting
    if (!riskResult.allowed) {
      const rejectedResult: OrderResultEvent = {
        type: "order_result",
        ts: new Date().toISOString(),
        cycle,
        order_id: `ord_${nanoid(8)}`,
        symbol: params.symbol,
        side: params.side,
        status: "rejected",
        filled_price: 0,
        filled_quantity: 0,
        fee: 0,
        fee_asset: "USDT",
        error: `Risk check failed: ${riskResult.violations.filter((v) => v.severity === "block").map((v) => v.rule).join(", ")}`,
      };
      await appendEvent(sessionId, rejectedResult);
      return rejectedResult;
    }
  }

  const orderId = `ord_${nanoid(8)}`;

  const submitEvent: OrderSubmitEvent = {
    type: "order_submit",
    ts: new Date().toISOString(),
    cycle,
    order_id: orderId,
    source: params.source ?? "manual",
    symbol: params.symbol,
    side: params.side,
    order_type: params.type,
    quantity: params.quantity,
    price: params.price,
  };
  await appendEvent(sessionId, submitEvent);

  const creds = { api_key: account.api_key, secret: account.secret, passphrase: account.passphrase };
  const response = await exchange.placeOrder(creds, params);

  const resultEvent: OrderResultEvent = {
    type: "order_result",
    ts: new Date().toISOString(),
    cycle,
    order_id: orderId,
    symbol: params.symbol,
    side: params.side,
    status: response.status,
    filled_price: response.filled_price,
    filled_quantity: response.filled_quantity,
    fee: response.fee,
    fee_asset: response.fee_asset,
    error: response.error,
  };
  await appendEvent(sessionId, resultEvent);

  return resultEvent;
}

function buildRiskContext(
  events: SessionEvent[],
  initEvent: SessionInitEvent
): RiskContext {
  // Find the latest account snapshot for balance info
  const snapshots = events.filter(
    (e): e is AccountSnapshotEvent => e.type === "account_snapshot"
  );
  const latestSnapshot = snapshots[snapshots.length - 1];

  // Count today's trades
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  const todayOrders = events.filter(
    (e): e is OrderSubmitEvent => e.type === "order_submit" && e.ts >= todayStr
  );
  const dailyTradeCount = todayOrders.length;

  // Find last order timestamp
  const orderSubmits = events.filter(
    (e): e is OrderSubmitEvent => e.type === "order_submit"
  );
  const lastOrderTs = orderSubmits.length > 0
    ? orderSubmits[orderSubmits.length - 1].ts
    : null;

  // Calculate initial balance in USDT (assume USDT key exists)
  const initialBalanceUsdt = initEvent.initial_balance["USDT"] ?? initEvent.initial_balance["usdt"] ?? 0;

  // Current balance from snapshot or initial
  const totalBalanceUsdt = latestSnapshot?.nav ?? initialBalanceUsdt;
  const availableBalanceUsdt = latestSnapshot
    ? (latestSnapshot.balance["USDT"] ?? latestSnapshot.balance["usdt"] ?? 0)
    : initialBalanceUsdt;

  // Current positions from snapshot
  const positions = latestSnapshot?.positions ?? [];

  // Build basic metrics from available data
  const metrics = buildMetricsFromEvents(events, initialBalanceUsdt, totalBalanceUsdt);

  return {
    total_balance_usdt: totalBalanceUsdt,
    available_balance_usdt: availableBalanceUsdt,
    positions,
    metrics,
    daily_trade_count: dailyTradeCount,
    last_order_ts: lastOrderTs,
    initial_balance_usdt: initialBalanceUsdt,
  };
}

function buildMetricsFromEvents(
  events: SessionEvent[],
  initialBalance: number,
  currentNav: number
): RiskContext["metrics"] {
  const orderResults = events.filter(
    (e): e is OrderResultEvent => e.type === "order_result"
  );
  const filledOrders = orderResults.filter((e) => e.status === "filled" || e.status === "partial_filled");

  let totalPnl = 0;
  let totalFees = 0;
  let winCount = 0;
  let lossCount = 0;

  for (const o of filledOrders) {
    const pnl = o.realized_pnl ?? 0;
    totalPnl += pnl;
    totalFees += o.fee;
    if (pnl > 0) winCount++;
    else if (pnl < 0) lossCount++;
  }

  const totalTrades = filledOrders.length;
  const winRate = totalTrades > 0 ? winCount / totalTrades : 0;
  const totalPnlPct = initialBalance > 0 ? totalPnl / initialBalance : 0;
  const navChangePct = initialBalance > 0 ? (currentNav - initialBalance) / initialBalance : 0;

  // Approximate max drawdown from account snapshots
  const snapshots = events.filter(
    (e): e is AccountSnapshotEvent => e.type === "account_snapshot"
  );
  let peak = initialBalance;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  for (const snap of snapshots) {
    if (snap.nav > peak) peak = snap.nav;
    const dd = peak - snap.nav;
    const ddPct = peak > 0 ? dd / peak : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
  }

  return {
    win_rate: winRate,
    total_pnl: totalPnl,
    total_pnl_pct: totalPnlPct,
    nav: currentNav,
    nav_change_pct: navChangePct,
    max_drawdown: maxDrawdown,
    max_drawdown_pct: maxDrawdownPct,
    sharpe_ratio: 0,
    total_trades: totalTrades,
    win_count: winCount,
    loss_count: lossCount,
    total_fees: totalFees,
    position_pct: 0,
    available_balance: {},
  };
}
