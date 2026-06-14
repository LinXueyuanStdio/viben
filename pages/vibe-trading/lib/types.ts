export type ExchangeId = "binance" | "okx" | "bitget" | "bybit" | "gate";

export interface Position {
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entry_price: number;
  entry_time: string;
  current_price?: number;
  unrealized_pnl?: number;
  unrealized_pnl_pct?: number;
  stop_loss?: number;
  take_profit?: number;
  leverage?: number;
  margin_used?: number;
  liquidation_price?: number;
  funding_rate?: number;
  mark_price?: number;
  notional_value?: number;
}

export interface TradeRecord {
  order_id: string;
  cycle: number;
  symbol: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  fee: number;
  realized_pnl?: number;
  ts: string;
  source: "agent" | "manual";
  slippage?: number;
  expected_price?: number;
  trade_duration_ms?: number;
}

export interface OHLCV {
  ts: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface SessionInitEvent {
  type: "session_init";
  ts: string;
  session_id: string;
  session_name: string;
  account_id: string;
  exchange: ExchangeId;
  initial_balance: Record<string, number>;
  agent_config: {
    model: string;
    strategy_name: string;
    strategy_description: string;
    risk_level: "low" | "medium" | "high";
    symbols: string[];
    interval_minutes: number;
    max_position_pct: number;
    stop_loss_pct?: number;
    take_profit_pct?: number;
    max_daily_trades?: number;
    market_mode?: "simulated" | "real";
    account_id?: string;
  };
  tags: string[];
  avatar_url?: string;
}

export interface MarketContextEvent {
  type: "market_context";
  ts: string;
  cycle: number;
  symbols: string[];
  klines: Record<string, { interval: string; data: OHLCV[] }>;
  indicators: Record<string, {
    rsi?: number;
    macd?: { value: number; signal: number; hist: number };
    ema?: Record<string, number>;
    bollinger?: { upper: number; middle: number; lower: number };
    atr?: number;
    volume_ma?: number;
  }>;
  signals: Record<string, {
    momentum: "bullish" | "bearish" | "neutral";
    trend: "up" | "down" | "sideways";
    volatility: "high" | "medium" | "low";
    strength: number;
  }>;
  market_summary?: string;
}

export interface AgentInputEvent {
  type: "agent_input";
  ts: string;
  cycle: number;
  agent_session_id: string;
  context: {
    market_summary: string;
    current_positions: Position[];
    available_balance: Record<string, number>;
    recent_trades: TradeRecord[];
    nav: number;
    total_pnl: number;
    win_rate: number;
    max_drawdown: number;
    constraints: {
      max_position_pct: number;
      stop_loss_pct?: number;
      remaining_daily_trades?: number;
    };
  };
}

export interface AgentDecisionEvent {
  type: "agent_decision";
  ts: string;
  cycle: number;
  agent_session_id: string;
  action: "order" | "hold" | "close" | "close_all";
  orders?: Array<{
    symbol: string;
    side: "buy" | "sell";
    type: "market" | "limit";
    quantity: number;
    price?: number;
    stop_loss?: number;
    take_profit?: number;
  }>;
  reasoning: string;
  thinking_summary?: string;
  confidence: number;
  key_signals?: Array<{
    symbol: string;
    indicator: string;
    value: string;
    interpretation: string;
  }>;
}

export interface AgentErrorEvent {
  type: "agent_error";
  ts: string;
  cycle: number;
  agent_session_id: string;
  error: string;
  error_code: "quota_exceeded" | "timeout" | "api_error" | "context_too_long" | "refused";
  retry_after?: number;
}

export interface OrderSubmitEvent {
  type: "order_submit";
  ts: string;
  cycle: number;
  order_id: string;
  source: "agent" | "manual";
  symbol: string;
  side: "buy" | "sell";
  order_type: "market" | "limit";
  quantity: number;
  price?: number;
  stop_loss?: number;
  take_profit?: number;
}

export interface OrderResultEvent {
  type: "order_result";
  ts: string;
  cycle: number;
  order_id: string;
  symbol: string;
  side: "buy" | "sell";
  status: "filled" | "partial_filled" | "rejected" | "expired" | "cancelled";
  filled_price: number;
  filled_quantity: number;
  fee: number;
  fee_asset: string;
  realized_pnl?: number;
  error?: string;
}

export interface OrderCancelEvent {
  type: "order_cancel";
  ts: string;
  cycle?: number;
  order_id: string;
  source: "agent" | "manual";
  reason?: string;
}

export interface AccountSnapshotEvent {
  type: "account_snapshot";
  ts: string;
  cycle: number;
  balance: Record<string, number>;
  positions: Position[];
  nav: number;
  nav_change: number;
  nav_change_pct: number;
  total_realized_pnl: number;
  total_unrealized_pnl: number;
  total_fee: number;
}

export interface SessionPauseEvent {
  type: "session_pause";
  ts: string;
  reason: "user_manual" | "error" | "quota_exceeded" | "max_loss_reached" | "market_closed";
  last_cycle: number;
  current_nav: number;
}

export interface SessionResumeEvent {
  type: "session_resume";
  ts: string;
  resume_from_cycle: number;
  synced_balance: Record<string, number>;
  synced_positions: Position[];
  synced_nav: number;
  drift_detected?: {
    balance_diff: Record<string, number>;
    position_diff: string;
  };
}

export interface SessionEndEvent {
  type: "session_end";
  ts: string;
  reason: "user_stop" | "target_reached" | "max_loss" | "error" | "account_empty";
  summary: {
    duration_hours: number;
    total_cycles: number;
    total_trades: number;
    win_count: number;
    loss_count: number;
    win_rate: number;
    total_pnl: number;
    total_pnl_pct: number;
    max_drawdown: number;
    max_drawdown_pct: number;
    sharpe_ratio: number;
    best_trade: { symbol: string; pnl: number; pnl_pct: number };
    worst_trade: { symbol: string; pnl: number; pnl_pct: number };
    total_fees: number;
  };
}

export interface ConfigUpdateEvent {
  type: "config_update";
  ts: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  reason?: string;
}

export interface SkillExtractedEvent {
  type: "skill_extracted";
  ts: string;
  skill_id: string;
  pattern: string;
  win_rate: number;
  sample_count: number;
  confidence: number;
}

export interface RiskViolationEvent {
  type: "risk_violation";
  ts: string;
  cycle: number;
  rule: string;
  severity: "warning" | "block";
  message: string;
  current_value: number;
  limit_value: number;
  order_rejected: boolean;
}

export type SessionEvent =
  | SessionInitEvent
  | MarketContextEvent
  | AgentInputEvent
  | AgentDecisionEvent
  | AgentErrorEvent
  | OrderSubmitEvent
  | OrderResultEvent
  | OrderCancelEvent
  | AccountSnapshotEvent
  | SessionPauseEvent
  | SessionResumeEvent
  | SessionEndEvent
  | ConfigUpdateEvent
  | SkillExtractedEvent
  | RiskViolationEvent;

export type SessionStatus = "running" | "paused" | "ended";

export interface SessionMetrics {
  win_rate: number;
  total_pnl: number;
  total_pnl_pct: number;
  nav: number;
  nav_change_pct: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  total_trades: number;
  win_count: number;
  loss_count: number;
  total_fees: number;
  position_pct: number;
  available_balance: Record<string, number>;
}

export interface NavPoint {
  ts: string;
  nav: number;
}

export interface DecisionEntry {
  cycle: number;
  ts: string;
  agent_session_id: string;
  action: AgentDecisionEvent["action"];
  reasoning: string;
  thinking_summary?: string;
  confidence: number;
  key_signals?: AgentDecisionEvent["key_signals"];
  orders?: AgentDecisionEvent["orders"];
  error?: string;
  error_code?: AgentErrorEvent["error_code"];
}

export interface SessionState {
  session_id: string;
  session_name: string;
  status: SessionStatus;
  exchange: ExchangeId;
  account_id: string;
  agent_config: SessionInitEvent["agent_config"];
  tags: string[];
  current_cycle: number;
  metrics: SessionMetrics;
  positions: Position[];
  trades: TradeRecord[];
  nav_history: NavPoint[];
  decisions: DecisionEntry[];
  initial_balance: Record<string, number>;
}

export interface Account {
  id: string;
  exchange: ExchangeId;
  name: string;
  api_key: string;
  secret: string;
  passphrase?: string;
  is_demo?: boolean;
  created_at: string;
}

export interface AccountsFile {
  accounts: Account[];
}
