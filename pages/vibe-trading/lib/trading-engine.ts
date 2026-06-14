import { nanoid } from "nanoid";
import type {
  SessionState,
  MarketContextEvent,
  AgentInputEvent,
  AgentDecisionEvent,
  AgentErrorEvent,
  AccountSnapshotEvent,
  OrderResultEvent,
  OrderSubmitEvent,
  RiskViolationEvent,
} from "./types";
import { restoreSessionState } from "./state-machine";
import { appendEvent } from "./session-store";
import { fetchMarketData } from "./market-data";
import { getAIDecision } from "./ai-decision";
import { executeOrder } from "./order";
import { getAccount } from "./account-store";
import {
  checkSessionRisk,
  checkPreTradeRisk,
  getDefaultRiskConfig,
} from "./risk-control";
import type { RiskConfig, RiskContext } from "./risk-control";

export interface TradingCycleResult {
  cycle: number;
  decision: AgentDecisionEvent | AgentErrorEvent;
  orders: OrderResultEvent[];
  snapshot: AccountSnapshotEvent | null;
  risk_violations: string[];
}

export async function runTradingCycle(
  sessionId: string
): Promise<TradingCycleResult> {
  // Step 1: Restore session state
  const state = await restoreSessionState(sessionId);

  // Step 2: Check session status
  if (state.status === "paused") {
    throw new Error("Session is paused. Resume it before running a cycle.");
  }
  if (state.status === "ended") {
    throw new Error("Session has ended. Cannot run more cycles.");
  }

  // Step 3: Increment cycle
  const cycle = state.current_cycle + 1;

  // Step 4: Check session-level risk
  const riskConfig = getDefaultRiskConfig(state.agent_config.risk_level);
  const riskViolations: string[] = [];

  const riskContext = buildRiskContextFromState(state);
  const sessionRisk = checkSessionRisk(riskContext, riskConfig);

  // Record all risk violations (but never auto-pause or stop)
  for (const violation of sessionRisk.violations) {
    riskViolations.push(violation.message);
    const violationEvent: RiskViolationEvent = {
      type: "risk_violation",
      ts: new Date().toISOString(),
      cycle,
      rule: violation.rule,
      severity: violation.severity,
      message: violation.message,
      current_value: violation.current_value,
      limit_value: violation.limit_value,
      order_rejected: !sessionRisk.allowed,
    };
    await appendEvent(sessionId, violationEvent);
  }

  // If session risk blocks, skip this cycle's trading (but don't pause/stop)
  if (!sessionRisk.allowed) {
    const holdDecision: AgentDecisionEvent = {
      type: "agent_decision",
      ts: new Date().toISOString(),
      cycle,
      agent_session_id: state.session_id,
      action: "hold",
      reasoning: `风控拦截，跳过本轮交易: ${riskViolations.join("; ")}`,
      confidence: 0,
    };
    await appendEvent(sessionId, holdDecision);
    return {
      cycle,
      decision: holdDecision,
      orders: [],
      snapshot: null,
      risk_violations: riskViolations,
    };
  }

  // Determine demo/real mode from session config and account
  const accountId = state.agent_config.account_id ?? state.account_id;
  const account = accountId ? await getAccount(accountId) : null;
  const isDemo =
    state.agent_config.market_mode !== "real" || !account || account.is_demo === true;

  // Step 5: Fetch market data
  const marketContext = await fetchMarketData({
    exchange: state.exchange,
    symbols: state.agent_config.symbols,
    interval: `${state.agent_config.interval_minutes}m`,
    limit: 100,
    market_mode: isDemo ? "simulated" : "real",
  });
  marketContext.cycle = cycle;
  await appendEvent(sessionId, marketContext);

  // Step 6: Build agent input
  const agentInput = buildAgentInput(state, cycle, marketContext);
  await appendEvent(sessionId, agentInput);

  // Step 7: Call AI for decision
  const decision = await getAIDecision(
    agentInput,
    marketContext.market_summary ?? "",
    {
      model: state.agent_config.model,
      strategy_name: state.agent_config.strategy_name,
      strategy_description: state.agent_config.strategy_description,
      risk_level: state.agent_config.risk_level,
    }
  );
  await appendEvent(sessionId, decision);

  // Step 8: Execute orders if applicable
  const orderResults: OrderResultEvent[] = [];

  if (decision.type === "agent_decision") {
    if (
      (decision.action === "order" || decision.action === "close") &&
      decision.orders &&
      decision.orders.length > 0
    ) {
      for (const order of decision.orders) {
        const estimatedPrice = order.price ?? getEstimatedPrice(marketContext, order.symbol);
        const estimatedUsdt = estimatedPrice * order.quantity;

        if (isDemo) {
          const result = await executeDemoOrder(
            sessionId, cycle, order, estimatedPrice, estimatedUsdt,
            buildRiskContextFromState(state), riskConfig
          );
          orderResults.push(result);
        } else {
          const result = await executeOrder(sessionId, {
            symbol: order.symbol,
            side: order.side,
            type: order.type,
            quantity: order.quantity,
            price: order.price,
            source: "agent",
            estimated_usdt: estimatedUsdt,
            risk_config: riskConfig,
          });
          orderResults.push(result);
        }
      }
    } else if (decision.action === "close_all" && state.positions.length > 0) {
      for (const pos of state.positions) {
        const estimatedPrice = getEstimatedPrice(marketContext, pos.symbol);
        const side = pos.side === "long" ? "sell" as const : "buy" as const;

        if (isDemo) {
          const result = await executeDemoOrder(
            sessionId, cycle,
            { symbol: pos.symbol, side, type: "market", quantity: pos.quantity },
            estimatedPrice, estimatedPrice * pos.quantity,
            buildRiskContextFromState(state), riskConfig
          );
          orderResults.push(result);
        } else {
          const result = await executeOrder(sessionId, {
            symbol: pos.symbol,
            side,
            type: "market",
            quantity: pos.quantity,
            source: "agent",
            estimated_usdt: estimatedPrice * pos.quantity,
            risk_config: riskConfig,
          });
          orderResults.push(result);
        }
      }
    }
  }

  // Step 9: Take account snapshot
  const snapshot = buildAccountSnapshot(state, cycle, orderResults, marketContext);
  await appendEvent(sessionId, snapshot);

  return {
    cycle,
    decision,
    orders: orderResults,
    snapshot,
    risk_violations: riskViolations,
  };
}

async function executeDemoOrder(
  sessionId: string,
  cycle: number,
  order: { symbol: string; side: "buy" | "sell"; type: "market" | "limit"; quantity: number; price?: number },
  estimatedPrice: number,
  estimatedUsdt: number,
  riskContext: RiskContext,
  riskConfig: RiskConfig
): Promise<OrderResultEvent> {
  const orderId = `ord_${nanoid(8)}`;

  // Run pre-trade risk check
  const riskResult = checkPreTradeRisk(
    {
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      estimated_usdt: estimatedUsdt,
    },
    riskContext,
    riskConfig
  );

  // Record violations
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

  // If risk check blocks, return rejected
  if (!riskResult.allowed) {
    const rejectedResult: OrderResultEvent = {
      type: "order_result",
      ts: new Date().toISOString(),
      cycle,
      order_id: orderId,
      symbol: order.symbol,
      side: order.side,
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

  // Record order submission
  const submitEvent: OrderSubmitEvent = {
    type: "order_submit",
    ts: new Date().toISOString(),
    cycle,
    order_id: orderId,
    source: "agent",
    symbol: order.symbol,
    side: order.side,
    order_type: order.type,
    quantity: order.quantity,
    price: order.price,
  };
  await appendEvent(sessionId, submitEvent);

  // Simulate fill with slight slippage
  const slippage = (Math.random() - 0.5) * 0.002; // +/- 0.1% slippage
  const filledPrice = Math.round(estimatedPrice * (1 + slippage) * 100) / 100;
  const fee = Math.round(estimatedUsdt * 0.001 * 100) / 100; // 0.1% fee

  const resultEvent: OrderResultEvent = {
    type: "order_result",
    ts: new Date().toISOString(),
    cycle,
    order_id: orderId,
    symbol: order.symbol,
    side: order.side,
    status: "filled",
    filled_price: filledPrice,
    filled_quantity: order.quantity,
    fee,
    fee_asset: "USDT",
  };
  await appendEvent(sessionId, resultEvent);
  return resultEvent;
}

function buildRiskContextFromState(state: SessionState): RiskContext {
  const initialBalanceUsdt =
    state.initial_balance["USDT"] ?? state.initial_balance["usdt"] ?? 0;
  const totalBalanceUsdt = state.metrics.nav || initialBalanceUsdt;
  const availableBalanceUsdt =
    state.metrics.available_balance["USDT"] ??
    state.metrics.available_balance["usdt"] ??
    initialBalanceUsdt;

  // Count today's trades
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();
  const dailyTradeCount = state.trades.filter((t) => t.ts >= todayStr).length;

  // Last order timestamp
  const lastOrderTs =
    state.trades.length > 0
      ? state.trades[state.trades.length - 1].ts
      : null;

  return {
    total_balance_usdt: totalBalanceUsdt,
    available_balance_usdt: availableBalanceUsdt,
    positions: state.positions,
    metrics: state.metrics,
    daily_trade_count: dailyTradeCount,
    last_order_ts: lastOrderTs,
    initial_balance_usdt: initialBalanceUsdt,
  };
}

function buildAgentInput(
  state: SessionState,
  cycle: number,
  marketContext: MarketContextEvent
): AgentInputEvent {
  const initialNav = Object.values(state.initial_balance).reduce(
    (s, v) => s + v,
    0
  );

  // Get remaining daily trades count
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();
  const todayTradeCount = state.trades.filter((t) => t.ts >= todayStr).length;
  const maxDaily = state.agent_config.max_daily_trades;
  const remainingDailyTrades = maxDaily
    ? maxDaily - todayTradeCount
    : undefined;

  return {
    type: "agent_input",
    ts: new Date().toISOString(),
    cycle,
    agent_session_id: state.session_id,
    context: {
      market_summary: marketContext.market_summary ?? "",
      current_positions: state.positions,
      available_balance: state.metrics.available_balance,
      recent_trades: state.trades.slice(-10),
      nav: state.metrics.nav || initialNav,
      total_pnl: state.metrics.total_pnl,
      win_rate: state.metrics.win_rate,
      max_drawdown: state.metrics.max_drawdown,
      constraints: {
        max_position_pct: state.agent_config.max_position_pct,
        stop_loss_pct: state.agent_config.stop_loss_pct,
        remaining_daily_trades: remainingDailyTrades,
      },
    },
  };
}

function getEstimatedPrice(
  marketContext: MarketContextEvent,
  symbol: string
): number {
  const klineData = marketContext.klines[symbol]?.data;
  if (klineData && klineData.length > 0) {
    return klineData[klineData.length - 1].c;
  }
  // Fallback: try common symbol variations
  for (const [key, value] of Object.entries(marketContext.klines)) {
    if (
      key.replace("/", "") === symbol.replace("/", "") ||
      key === symbol
    ) {
      const data = value.data;
      if (data.length > 0) return data[data.length - 1].c;
    }
  }
  return 0;
}

function buildAccountSnapshot(
  state: SessionState,
  cycle: number,
  orderResults: OrderResultEvent[],
  marketContext: MarketContextEvent
): AccountSnapshotEvent {
  const initialNav = Object.values(state.initial_balance).reduce(
    (s, v) => s + v,
    0
  );

  // Calculate balance changes from orders in this cycle
  let balanceChange = 0;
  let feeTotal = state.metrics.total_fees;
  let realizedPnlTotal = state.metrics.total_pnl;

  for (const result of orderResults) {
    if (result.status === "filled" || result.status === "partial_filled") {
      const orderValue = result.filled_price * result.filled_quantity;
      if (result.side === "buy") {
        balanceChange -= orderValue;
      } else {
        balanceChange += orderValue;
      }
      balanceChange -= result.fee;
      feeTotal += result.fee;
      if (result.realized_pnl) {
        realizedPnlTotal += result.realized_pnl;
      }
    }
  }

  // Update available balance
  const prevBalance = { ...state.metrics.available_balance };
  const usdtKey = "USDT" in prevBalance ? "USDT" : "usdt";
  const currentUsdt = (prevBalance[usdtKey] ?? 0) + balanceChange;
  const newBalance = { ...prevBalance, [usdtKey]: Math.max(0, currentUsdt) };

  // Update positions based on order results
  const positions = [...state.positions];
  for (const result of orderResults) {
    if (result.status !== "filled" && result.status !== "partial_filled") continue;

    if (result.side === "buy") {
      // Check if adding to existing position or new
      const existing = positions.find((p) => p.symbol === result.symbol && p.side === "long");
      if (existing) {
        existing.quantity += result.filled_quantity;
      } else {
        const leverage = Math.floor(Math.random() * 20) + 1;
        const marginUsed = (result.filled_quantity * result.filled_price) / leverage;
        const liquidationDistance = 1 / leverage * 0.9; // approx distance to liquidation
        const liquidationPrice = result.filled_price * (1 - liquidationDistance);
        const fundingRate = (Math.random() * 0.0004 - 0.0001); // -0.01% ~ 0.03%

        positions.push({
          symbol: result.symbol,
          side: "long",
          quantity: result.filled_quantity,
          entry_price: result.filled_price,
          entry_time: result.ts,
          current_price: result.filled_price,
          leverage,
          margin_used: Math.round(marginUsed * 100) / 100,
          liquidation_price: Math.round(liquidationPrice * 100) / 100,
          funding_rate: Math.round(fundingRate * 1000000) / 1000000,
          mark_price: result.filled_price,
          notional_value: Math.round(result.filled_quantity * result.filled_price * 100) / 100,
        });
      }
    } else {
      // Selling: reduce or close position
      const existing = positions.find((p) => p.symbol === result.symbol && p.side === "long");
      if (existing) {
        existing.quantity -= result.filled_quantity;
        if (existing.quantity <= 0) {
          const idx = positions.indexOf(existing);
          positions.splice(idx, 1);
        }
      }
    }
  }

  // Update current prices from market data
  for (const pos of positions) {
    const price = getEstimatedPrice(marketContext, pos.symbol);
    if (price > 0) {
      pos.current_price = price;
      pos.unrealized_pnl = (price - pos.entry_price) * pos.quantity * (pos.side === "long" ? 1 : -1);
      pos.unrealized_pnl_pct = pos.entry_price > 0 ? pos.unrealized_pnl / (pos.entry_price * pos.quantity) : 0;
    }
  }

  // Calculate NAV
  const positionValue = positions.reduce(
    (s, p) => s + p.quantity * (p.current_price ?? p.entry_price),
    0
  );
  const totalUnrealizedPnl = positions.reduce(
    (s, p) => s + (p.unrealized_pnl ?? 0),
    0
  );
  const nav = Math.max(0, currentUsdt) + positionValue;
  const navChange = nav - initialNav;
  const navChangePct = initialNav > 0 ? navChange / initialNav : 0;

  return {
    type: "account_snapshot",
    ts: new Date().toISOString(),
    cycle,
    balance: newBalance,
    positions,
    nav: Math.round(nav * 100) / 100,
    nav_change: Math.round(navChange * 100) / 100,
    nav_change_pct: Math.round(navChangePct * 10000) / 10000,
    total_realized_pnl: Math.round(realizedPnlTotal * 100) / 100,
    total_unrealized_pnl: Math.round(totalUnrealizedPnl * 100) / 100,
    total_fee: Math.round(feeTotal * 100) / 100,
  };
}
