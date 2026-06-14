import type {
  SessionEvent,
  SessionState,
  TradeRecord,
  NavPoint,
  DecisionEntry,
} from "./types";

export function createEmptyState(): SessionState {
  return {
    session_id: "",
    session_name: "",
    status: "running",
    exchange: "binance",
    account_id: "",
    agent_config: {
      model: "",
      strategy_name: "",
      strategy_description: "",
      risk_level: "medium",
      symbols: [],
      interval_minutes: 60,
      max_position_pct: 0.5,
    },
    tags: [],
    current_cycle: 0,
    metrics: {
      win_rate: 0,
      total_pnl: 0,
      total_pnl_pct: 0,
      nav: 0,
      nav_change_pct: 0,
      max_drawdown: 0,
      max_drawdown_pct: 0,
      sharpe_ratio: 0,
      total_trades: 0,
      win_count: 0,
      loss_count: 0,
      total_fees: 0,
      position_pct: 0,
      available_balance: {},
    },
    positions: [],
    trades: [],
    nav_history: [],
    decisions: [],
    initial_balance: {},
  };
}

export function reduceEvent(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "session_init": {
      return {
        ...state,
        session_id: event.session_id,
        session_name: event.session_name,
        status: "running",
        exchange: event.exchange,
        account_id: event.account_id,
        agent_config: { ...state.agent_config, ...event.agent_config },
        tags: event.tags ?? [],
        initial_balance: event.initial_balance,
        metrics: {
          ...state.metrics,
          nav: Object.values(event.initial_balance).reduce((s, v) => s + v, 0),
          available_balance: event.initial_balance,
        },
      };
    }

    case "account_snapshot": {
      const navPoint: NavPoint = { ts: event.ts, nav: event.nav };
      const positions = event.positions ?? [];
      return {
        ...state,
        current_cycle: event.cycle,
        positions,
        nav_history: [...state.nav_history, navPoint],
        metrics: {
          ...state.metrics,
          nav: event.nav,
          nav_change_pct: event.nav_change_pct,
          total_fees: event.total_fee,
          available_balance: event.balance,
          position_pct: positions.length > 0
            ? positions.reduce((s, p) => s + p.quantity * (p.current_price ?? p.entry_price), 0) / event.nav
            : 0,
        },
      };
    }

    case "order_result": {
      if (event.status === "filled" || event.status === "partial_filled") {
        const trade: TradeRecord = {
          order_id: event.order_id,
          cycle: event.cycle,
          symbol: event.symbol,
          side: event.side,
          price: event.filled_price,
          quantity: event.filled_quantity,
          fee: event.fee,
          realized_pnl: event.realized_pnl,
          ts: event.ts,
          source: "agent",
        };
        const trades = [...state.trades, trade];
        const wins = trades.filter((t) => (t.realized_pnl ?? 0) > 0).length;
        const losses = trades.filter((t) => (t.realized_pnl ?? 0) < 0).length;
        return {
          ...state,
          trades,
          metrics: {
            ...state.metrics,
            total_trades: trades.length,
            win_count: wins,
            loss_count: losses,
            win_rate: wins + losses > 0 ? wins / (wins + losses) : 0,
          },
        };
      }
      return state;
    }

    case "agent_decision": {
      const entry: DecisionEntry = {
        cycle: event.cycle,
        ts: event.ts,
        agent_session_id: event.agent_session_id,
        action: event.action,
        reasoning: event.reasoning,
        thinking_summary: event.thinking_summary,
        confidence: event.confidence,
        key_signals: event.key_signals,
        orders: event.orders,
      };
      return {
        ...state,
        current_cycle: event.cycle,
        decisions: [...state.decisions, entry],
      };
    }

    case "agent_error": {
      const entry: DecisionEntry = {
        cycle: event.cycle,
        ts: event.ts,
        agent_session_id: event.agent_session_id,
        action: "hold",
        reasoning: "",
        confidence: 0,
        error: event.error,
        error_code: event.error_code,
      };
      return {
        ...state,
        decisions: [...state.decisions, entry],
      };
    }

    case "session_pause": {
      return { ...state, status: "paused" };
    }

    case "session_resume": {
      return {
        ...state,
        status: "running",
        current_cycle: event.resume_from_cycle,
        positions: event.synced_positions ?? [],
        metrics: {
          ...state.metrics,
          nav: event.synced_nav,
          available_balance: event.synced_balance,
        },
      };
    }

    case "session_end": {
      return { ...state, status: "ended" };
    }

    default:
      return state;
  }
}
