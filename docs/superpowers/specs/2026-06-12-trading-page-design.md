# 交易页面设计

## 概述

在 `pages/` 目录下新增交易页面，实现一个**策略交易终端**，整合账户监控、手动交易、AI 决策回放三大能力。

核心场景：用户配置一个交易策略后启动运行，页面实时展示策略表现，同时支持用户手动介入交易。右侧面板作为**交易播放器**，流式展示 AI 交易员的每轮决策过程。

所有交易记录持久化为 `session.jsonl`，支持完整恢复与经验复用。

**架构**：采用 `type=server` 页面类型，**Next.js 全栈应用**。使用 Next.js App Router，前后端不分离 — Server Components 直接读写数据，Server Actions 处理交易操作，Route Handlers 提供外部 API 接口。交易逻辑**不放在 `packages/core`**，完全自包含于 page 目录内。账户凭证存储在 page 内部（`accounts.yaml`），不依赖 `~/.viben` 或主 Gateway。

---

## 1. 系统角色与交互模型

### 1.1 三方参与者

| 角色 | 身份 | 职责 |
|------|------|------|
| **用户** | 人类操作者 | 配置策略、监控进度、手动开仓/平仓、暂停/恢复 |
| **市场监控器** | 系统进程（cron/swarm） | 定时抓取市场数据（K线、指标、信号）、推送给 Agent、记录账户快照 |
| **交易员智能体** | AI Agent（每次全新实例） | 接收市场上下文 + 账户状态，决定是否下单，输出交易思路 |

### 1.2 交互时序（一个完整 cycle）

```
Monitor                          Agent                           Exchange
   │                               │                               │
   ├─ 抓取市场数据 ─────────────────┤                               │
   ├─ 记录 market_context ──────────┤                               │
   ├─ 组装上下文 ──────────────────→│                               │
   │  (agent_input)                │                               │
   │                               ├─ 分析市场 + 决定操作           │
   │                               ├─ 输出 agent_decision ────────→│
   │                               │                               │
   │  ←── order_submit ───────────←┤                               │
   │                               │         ├─ 执行订单           │
   │  ←── order_result ───────────────────────┤                    │
   │                               │                               │
   ├─ 记录 account_snapshot ────────┤                               │
   │                               │                               │
   └─ cycle 结束 ──────────────────┘                               │
```

### 1.3 用户可见 vs 不可见

| 信息 | 用户侧展示 |
|------|------------|
| 市场上下文摘要 | 决策卡片中可展开查看 |
| Agent 完整推理过程 | **不展示**（关联 `agent_session_id`，可跳转查看） |
| Agent 决策结论 + 思路总结 | 决策卡片主体 |
| 订单执行结果 | 决策卡片 + 底部表格 |
| Agent 错误 | 红色错误卡片 |

---

## 2. Session JSONL 数据架构

### 2.1 设计原则

| 原则 | 实现方式 |
|------|----------|
| **只追加写入** | 文件只 append，不修改历史行。保证并发安全 |
| **完全可恢复** | 任意时刻从 `session_init`/`session_resume` + 后续事件重建完整状态 |
| **流式计算** | 每个 `account_snapshot` 自含 NAV，无需全量回放即可绘制曲线 |
| **Agent 无状态** | Agent 每次运行收到 `agent_input` 中的完整上下文，不依赖前次记忆 |
| **经验可复用** | 历史 `agent_decision` + `order_result` 作为 `recent_trades` 传给下次 Agent |
| **断点续传** | `session_resume` 重新同步交易所真实状态，修正本地偏差后继续 |
| **可观测性** | 每行事件带精确时间戳和 cycle 编号，支持时间线回放 |

### 2.2 文件存储

Session 文件存储在 page 自身的 `sessions/` 子目录内：

```
pages/0612-trading/sessions/
├── ses_dpsk01ab.jsonl    # 策略实例 A
└── ses_xyz789cd.jsonl    # 策略实例 B
```

文件命名：`ses_{nanoid(8)}.jsonl`

Trading server 通过 `__dirname + '/sessions/'` 定位，前端通过 `/api/sessions` 接口访问。

### 2.3 事件类型定义

#### 会话生命周期事件

| 事件类型 | 触发者 | 说明 |
|----------|--------|------|
| `session_init` | 用户（创建策略） | 会话起点，记录初始配置和账户状态 |
| `session_pause` | 用户/系统 | 暂停交易，记录原因 |
| `session_resume` | 用户 | 恢复交易，重新同步真实账户状态 |
| `session_end` | 用户/系统 | 会话终止，记录最终统计 |

#### 市场与 Agent 事件

| 事件类型 | 触发者 | 说明 |
|----------|--------|------|
| `market_context` | 市场监控器 | 定时推送的市场快照（K线、指标、信号） |
| `agent_input` | 市场监控器 | 传给 Agent 的完整上下文（含余额、持仓、历史） |
| `agent_decision` | 交易员智能体 | Agent 的决策结论（下单/持有/平仓）+ 思路总结 |
| `agent_error` | 交易员智能体 | Agent 运行失败（配额耗尽、超时等） |

#### 交易执行事件

| 事件类型 | 触发者 | 说明 |
|----------|--------|------|
| `order_submit` | Agent/用户 | 订单已提交到交易所（标记来源 agent/manual） |
| `order_result` | 交易所回报 | 订单执行结果（成交价、数量、手续费、状态） |
| `order_cancel` | 用户/系统 | 撤销挂单 |

#### 状态快照事件

| 事件类型 | 触发者 | 说明 |
|----------|--------|------|
| `account_snapshot` | 市场监控器 | 每个 cycle 结束后记录完整账户状态 + NAV |

#### 经验学习事件（扩展）

| 事件类型 | 触发者 | 说明 |
|----------|--------|------|
| `skill_extracted` | 系统/Agent | 从历史交易中提炼出的 skill（模式识别结论） |
| `config_update` | 用户 | 运行中调整策略参数（如切换模型、调整风险等级） |

### 2.4 核心事件字段详细

```typescript
// ─── 会话初始化 ───
interface SessionInitEvent {
  type: "session_init";
  ts: string;
  session_id: string;
  session_name: string;           // 用户给策略起的名字，如 "dpsk"
  account_id: string;             // 关联的 trading account ID
  exchange: ExchangeId;
  initial_balance: Record<string, number>;

  agent_config: {
    model: string;                // "deepseek-v4-pro"
    strategy_name: string;        // "AI500高频动能追踪策略"
    strategy_description: string; // 策略简述
    risk_level: "low" | "medium" | "high";
    symbols: string[];            // 可交易标的列表
    interval_minutes: number;     // 决策间隔
    max_position_pct: number;     // 最大仓位占比（如 0.5 = 50%）
    stop_loss_pct?: number;       // 止损比例
    take_profit_pct?: number;     // 止盈比例
    max_daily_trades?: number;    // 每日最大交易次数
  };

  // 初始标注（用于 UI 展示）
  tags: string[];                 // ["Deepseek", "Binance", "中风险"]
  avatar_url?: string;            // 策略头像（可选）
}

// ─── 市场上下文 ───
interface MarketContextEvent {
  type: "market_context";
  ts: string;
  cycle: number;

  symbols: string[];              // 本次推送涉及的标的
  
  klines: Record<string, {
    interval: string;             // "1h", "15m", "4h"
    data: OHLCV[];                // 最近 N 根 K线
  }>;

  indicators: Record<string, {    // 每个标的的技术指标
    rsi?: number;
    macd?: { value: number; signal: number; hist: number };
    ema?: Record<string, number>; // {"ema12": 67100, "ema26": 66900}
    bollinger?: { upper: number; middle: number; lower: number };
    atr?: number;
    volume_ma?: number;
  }>;

  signals: Record<string, {       // 综合因子信号
    momentum: "bullish" | "bearish" | "neutral";
    trend: "up" | "down" | "sideways";
    volatility: "high" | "medium" | "low";
    strength: number;             // 0-100 信号强度
  }>;

  market_summary?: string;        // 人类可读的市场概要（给 UI 显示）
}

// ─── Agent 输入 ───
interface AgentInputEvent {
  type: "agent_input";
  ts: string;
  cycle: number;
  agent_session_id: string;       // Agent 本次运行的独立 session ID

  context: {
    market_summary: string;       // 发给 Agent 的市场文本描述
    current_positions: Position[];
    available_balance: Record<string, number>;
    recent_trades: TradeRecord[]; // 最近 N 笔交易（作为经验）
    nav: number;
    total_pnl: number;
    win_rate: number;             // 当前胜率
    max_drawdown: number;         // 当前最大回撤
    
    // 策略约束（让 Agent 知道边界）
    constraints: {
      max_position_pct: number;
      stop_loss_pct?: number;
      remaining_daily_trades?: number;
    };
  };
}

// ─── Agent 决策 ───
interface AgentDecisionEvent {
  type: "agent_decision";
  ts: string;
  cycle: number;
  agent_session_id: string;

  action: "order" | "hold" | "close" | "close_all";

  orders?: Array<{               // 可能一次下多个单
    symbol: string;
    side: "buy" | "sell";
    type: "market" | "limit";
    quantity: number;
    price?: number;
    stop_loss?: number;          // 止损价
    take_profit?: number;        // 止盈价
  }>;

  reasoning: string;              // 交易思路总结（用户可见）
  thinking_summary?: string;      // 思考过程简述
  confidence: number;             // 0-1
  
  // 关键信号引用（方便 UI 高亮）
  key_signals?: Array<{
    symbol: string;
    indicator: string;
    value: string;
    interpretation: string;
  }>;
}

// ─── Agent 错误 ───
interface AgentErrorEvent {
  type: "agent_error";
  ts: string;
  cycle: number;
  agent_session_id: string;
  error: string;
  error_code: "quota_exceeded" | "timeout" | "api_error" | "context_too_long" | "refused";
  retry_after?: number;           // 建议重试时间（秒）
}

// ─── 订单提交 ───
interface OrderSubmitEvent {
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

// ─── 订单结果 ───
interface OrderResultEvent {
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
  realized_pnl?: number;         // 平仓单的已实现盈亏
  error?: string;
}

// ─── 撤单 ───
interface OrderCancelEvent {
  type: "order_cancel";
  ts: string;
  cycle?: number;
  order_id: string;
  source: "agent" | "manual";
  reason?: string;
}

// ─── 账户快照 ───
interface AccountSnapshotEvent {
  type: "account_snapshot";
  ts: string;
  cycle: number;
  balance: Record<string, number>;
  positions: Position[];
  nav: number;
  nav_change: number;             // 绝对变化
  nav_change_pct: number;         // 百分比变化
  total_realized_pnl: number;     // 累计已实现盈亏
  total_unrealized_pnl: number;   // 当前未实现盈亏
  total_fee: number;              // 累计手续费
}

// ─── 会话暂停 ───
interface SessionPauseEvent {
  type: "session_pause";
  ts: string;
  reason: "user_manual" | "error" | "quota_exceeded" | "max_loss_reached" | "market_closed";
  last_cycle: number;
  current_nav: number;
}

// ─── 会话恢复 ───
interface SessionResumeEvent {
  type: "session_resume";
  ts: string;
  resume_from_cycle: number;
  synced_balance: Record<string, number>;
  synced_positions: Position[];
  synced_nav: number;
  drift_detected?: {             // 本地记录 vs 交易所真实状态的偏差
    balance_diff: Record<string, number>;
    position_diff: string;       // 人类可读描述
  };
}

// ─── 会话结束 ───
interface SessionEndEvent {
  type: "session_end";
  ts: string;
  reason: "user_stop" | "target_reached" | "max_loss" | "error" | "account_empty";
  
  // 最终统计
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

// ─── 策略参数更新（运行中调整） ───
interface ConfigUpdateEvent {
  type: "config_update";
  ts: string;
  field: string;                  // 修改的字段路径
  old_value: unknown;
  new_value: unknown;
  reason?: string;                // 用户备注
}

// ─── 经验提取 ───
interface SkillExtractedEvent {
  type: "skill_extracted";
  ts: string;
  skill_id: string;
  pattern: string;                // "RSI < 30 且 MACD 金叉时做多"
  win_rate: number;               // 该 pattern 在历史中的胜率
  sample_count: number;           // 样本数
  confidence: number;
}
```

### 2.5 辅助类型

```typescript
interface Position {
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
}

interface TradeRecord {
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
}

interface OHLCV {
  ts: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}
```

### 2.6 Cycle 完整性约束

一个标准的完整 cycle 包含以下事件序列：

```
market_context → agent_input → agent_decision → [order_submit → order_result]* → account_snapshot
```

不完整 cycle 的场景：
- Agent 报错：`market_context → agent_input → agent_error → account_snapshot`
- Agent 选择观望：`market_context → agent_input → agent_decision(action=hold) → account_snapshot`
- 手动交易插入：`order_submit(manual) → order_result → account_snapshot`（无 cycle 编号或使用当前 cycle）

---

## 3. 状态恢复机制

### 3.1 恢复算法

```
function restoreState(events: Event[]):
  1. 从尾部向前找最近的 session_init 或 session_resume → 得到 base_state
  2. 从 base_state 开始正向扫描：
     - account_snapshot → 更新 latest_balance, latest_positions, NAV 时间序列
     - order_result(filled) → 追加到 trade_history
     - agent_decision → 追加到 decision_log
     - agent_error → 追加到 decision_log（标记失败）
     - session_pause → 标记状态为 paused
     - config_update → 更新运行配置
  3. 计算衍生指标（见 3.2）
  4. 返回 SessionState
```

### 3.2 Performance 指标计算

| 指标 | 公式 | 数据来源 |
|------|------|----------|
| **胜率** | win_trades / (win_trades + loss_trades) | `order_result` 中 `realized_pnl > 0` 的统计 |
| **累计盈亏** | latest_nav - initial_nav | `account_snapshot.nav` 序列 |
| **NAV 收益率** | (latest_nav - initial_nav) / initial_nav × 100% | 同上 |
| **最大回撤** | max((peak - trough) / peak) | NAV 序列滚动最高点 |
| **夏普率** | mean(returns) / std(returns) × √(365×24/interval_hours) | 每个 snapshot 间的收益率 |
| **盈亏比** | avg(win_pnl) / avg(loss_pnl) | 已平仓交易 |
| **平均持仓时间** | mean(close_time - open_time) | 配对的开平仓订单 |
| **交易频率** | total_trades / duration_hours | 订单总数 / 运行时长 |
| **手续费占比** | total_fees / initial_nav × 100% | `order_result.fee` 累加 |

### 3.3 继续交易（经验复用）流程

```
用户点击「恢复交易」
  → 读取旧 session.jsonl 恢复状态
  → 调用交易所 API 获取真实余额和持仓
  → 对比本地记录 vs 真实状态，检测偏差（drift）
  → 追加 session_resume 事件（含 drift 报告）
  → 如果有偏差，提示用户确认
  → 恢复后继续正常 cycle
  
Agent 上下文中包含:
  - recent_trades: 最近 20 笔交易记录（含盈亏）
  - win_rate / max_drawdown: 当前 performance 指标
  → Agent 据此调整策略激进度
  
未来扩展:
  - skill_extracted 事件记录 Agent 学习到的 pattern
  - 下次 agent_input 可携带 skills 列表，Agent 据此优化决策
```

---

## 4. 页面功能详细

### 4.1 顶部导航栏

| 元素 | 说明 |
|------|------|
| 策略头像 | 圆形，可自定义或使用默认 |
| 策略名称 | 如 "dpsk"，可编辑 |
| 标签组 | 交易所标签（如 "Binance"）、模型标签（如 "Deepseek"）、策略简称 |
| 编辑按钮 | 跳转到策略配置/编辑 |
| 运行状态 | "运行中"（绿色脉动）/ "已暂停"（黄色）/ "已停止"（灰色） |
| 操作区 | 暂停/恢复按钮、停止按钮 |

### 4.2 统计卡片行

5 个等宽卡片横排：

| 卡片 | 主数据 | 副数据 | 视觉元素 |
|------|--------|--------|----------|
| **胜率** | 37.50% | "18 盈 30 亏" | 胜/亏条形比例图（绿/红） |
| **交易盈亏** | +$0.0607 | "初始: $10.00" | 金额颜色（绿=盈，红=亏） |
| **NAV收益率** | +0.62% | — | 百分比颜色 |
| **持仓** | 0.00% | "0 活跃" | — |
| **可用余额** | $0.00 | — | — |

### 4.3 图表区域

**Tab A：账户净值曲线**

- 数据源：所有 `account_snapshot.nav` 构成时间序列
- 显示：总净值金额 + 变化金额 + 变化百分比
- 时间周期切换：1D / 7D / 1M / 3M / All
- 显示模式切换：$ 绝对值 / % 百分比
- 图表样式：面积图（盈利区域浅绿，亏损区域浅红）
- 交互：hover 显示具体时间点的 NAV 值
- Y 轴标注：关键金额线

**Tab B：行情图表（TradingView K 线）**

- 使用 **TradingView Advanced Chart Widget**（CDN 嵌入）展示专业 K 线图
- 默认显示当前策略的主交易对（如 `BINANCE:BTCUSDT`）
- 支持切换交易对（从 `agent_config.symbols` 列表选择）
- K 线周期：1m / 5m / 15m / 1h / 4h / 1D
- 内置技术指标：RSI、MACD、布林带、EMA（与 Agent 使用的指标对应）
- 在图表上叠加 Agent 买入/卖出标记点位（通过 TradingView shape markers）
- 支持用户手动画线、添加指标
- 主题：Light（与页面亮色风格一致）

### 4.4 底部数据表格

4 个 Tab 切换：

**Tab 1：当前持仓**

| 列 | 说明 |
|----|------|
| 币对 | BTCUSDT |
| 方向 | 多/空（绿/红标签） |
| 数量 | 0.00015 |
| 开仓价 | 67,200.00 |
| 当前价 | 67,500.00（实时更新） |
| 未实现盈亏 | +$0.045（绿/红色） |
| 盈亏比例 | +0.45% |
| 止损/止盈 | 66,500 / 68,000 |
| 操作 | [平仓] [设止损] |

**Tab 2：当前委托**

| 列 | 说明 |
|----|------|
| 币对 | 交易对 |
| 方向 | 买入/卖出 |
| 类型 | 限价/止损 |
| 委托价 | 挂单价格 |
| 委托量 | 数量 |
| 已成交 | 部分成交数量 |
| 下单时间 | ISO 时间 |
| 来源 | Agent/手动（小标签） |
| 操作 | [撤单] |

**Tab 3：历史成交**

| 列 | 说明 |
|----|------|
| 币对 | 交易对 |
| 方向 | 买入/卖出 |
| 成交价 | 实际成交均价 |
| 成交量 | 数量 |
| 手续费 | 金额 + 币种 |
| 已实现盈亏 | 平仓单才有 |
| 成交时间 | 时间 |
| 来源 | Agent/手动 |

**Tab 4：订单记录**

| 列 | 说明 |
|----|------|
| 订单ID | ord_xxxx |
| 币对 | 交易对 |
| 方向 | 买入/卖出 |
| 类型 | 市价/限价 |
| 价格 | 委托价 / 成交价 |
| 数量 | 委托量 / 成交量 |
| 状态 | 已成交/部分成交/已撤销/已拒绝 |
| 时间 | 下单时间 |
| 来源 | Agent #cycle / 手动 |

**表格全局功能：**
- 「仅当前币种」复选框：按当前选中的交易对过滤
- 「手动开仓」按钮：弹出下单对话框
- 实时价格更新：通过 Binance WebSocket 推送

### 4.5 手动开仓对话框

```
┌── 手动开仓 ──────────────────────────────┐
│                                          │
│  交易对   [BTCUSDT        ▾]            │
│                                          │
│  方向     [● 买入(做多)] [○ 卖出(做空)]  │
│                                          │
│  类型     [● 市价]  [○ 限价]             │
│                                          │
│  价格     [67,200.00    ] (限价时显示)    │
│                                          │
│  金额     [______] USDT                  │
│  ─── 或 ───                              │
│  数量     [______] BTC                   │
│                                          │
│  ┄┄ 高级选项（折叠） ┄┄                  │
│  止损价   [______]                       │
│  止盈价   [______]                       │
│                                          │
│  ────────────────────────────            │
│  预计成交: ~0.00015 BTC                   │
│  预计手续费: ~$0.01                       │
│  可用余额: $10.00 USDT                   │
│                                          │
│         [取消]     [确认下单]             │
└──────────────────────────────────────────┘
```

**下单流程：**
1. 用户填写参数 → 前端校验（余额够？数量合法？）
2. 调用 `POST /api/trading/sessions/:id/order`
3. Gateway 通过 exchange adapter 签名并发送
4. 返回 order_result → 追加到 session.jsonl
5. UI 更新持仓表格 + toast 提示

### 4.6 右侧决策日志面板（交易播放器）

**标题行：** "最近决策" + 筛选按钮（全部/成功/失败）

**决策卡片结构（从新到旧排列）：**

```
┌─────────────────────────────────────┐
│ 05-30 19:30  周期 #2585             │
│ deepseek-v4-pro                [失败]│
├─────────────────────────────────────┤
│ ⚠️ AI 模型配额已用尽，请检查计费。    │
│ ▸ 详情 · DEC-C4542B                │
├─────────────────────────────────────┤
│ ✨ 思考过程 ▾    🔒 提示词           │
└─────────────────────────────────────┘
```

```
┌─────────────────────────────────────┐
│ 05-30 18:00  周期 #2580             │
│ deepseek-v4-pro                [成功]│
├─────────────────────────────────────┤
│ 📈 买入 BTCUSDT                     │
│    数量: 0.00015  价格: 67,200      │
│    置信度: 65%                       │
│                                     │
│ 思路: RSI接近超卖，MACD柱线收窄，    │
│       预计短期反弹。设 66,500 止损。  │
├─────────────────────────────────────┤
│ ✨ 思考过程 ▾    🔒 提示词           │
│ ───────────────────────────────     │
│ 关键信号:                            │
│   • RSI: 42.5 → 接近超卖            │
│   • MACD hist: -0.3 → 收窄          │
│   • 趋势: sideways                   │
└─────────────────────────────────────┘
```

**可展开内容：**
- 「思考过程」→ 展开显示 `thinking_summary`
- 「提示词」→ 展开显示 `agent_input.context` 的格式化视图（市场摘要 + 持仓 + 余额 + 约束条件）
- 「详情」链接 → 关联到 `agent_session_id`，可跳转查看 Agent 完整运行日志

**面板交互：**
- 无限滚动加载历史决策
- 新决策到达时自动滚动到顶部（如果用户在顶部）
- 点击卡片可高亮对应的图表时间点
- 支持按状态过滤：全部 / 成功(下单) / 观望(hold) / 失败(error)

### 4.7 会话选择器

页面顶部或侧边需要一个**会话切换入口**：
- 列出 `sessions/` 目录下所有 `.jsonl` 文件
- 显示：名称、状态（运行中/已暂停/已结束）、创建时间、当前 NAV
- 支持创建新会话

### 4.8 实时更新机制

| 数据 | 更新方式 | 频率 |
|------|----------|------|
| 当前价格 | Binance WebSocket | 实时 |
| 持仓未实现盈亏 | 价格变化时本地计算 | 实时 |
| NAV 曲线数据点 | 轮询 session.jsonl 新行 | 每 5s |
| 决策日志 | 轮询 session.jsonl 新行 | 每 5s |
| 统计卡片 | 从最新 snapshot 计算 | 每 cycle |

Gateway 可提供 `GET /api/trading/sessions/:id/events?from_line=N` 支持增量拉取。

---

## 5. 架构：Next.js 全栈应用（type=server）

### 5.1 设计思想

采用 `type=server` 页面类型，**Next.js App Router 全栈应用**，前后端不分离：

- **Server Components**：页面直接在服务端读取 session.jsonl、accounts.yaml，渲染初始状态
- **Server Actions**：表单提交（下单、暂停、恢复）直接调用服务端函数，无需手写 API fetch
- **Route Handlers**：`app/api/` 目录提供 REST 接口，供外部系统（monitor/agent）写入事件
- **Client Components**：TradingView K 线、Binance WebSocket 实时价格、决策日志轮询等需要浏览器环境的部分
- **数据**：`sessions/*.jsonl` + `accounts.yaml` 存储在 page 目录内
- **完全自包含**：不依赖 `~/.viben`、不依赖主 Gateway，page 即完整应用

**不在 `packages/core` 中新增任何交易模块。**

### 5.2 目录结构

```
pages/0612-trading/
├── SKILL.md                        # type: server 配置
├── package.json                    # next, react, typescript...
├── next.config.ts
├── tsconfig.json
│
├── accounts.yaml                   # 交易账户凭证（权限 0600）
│
├── app/                            # Next.js App Router
│   ├── layout.tsx                  # Root layout（全局样式、字体）
│   ├── page.tsx                    # 主页面（Server Component，读取 session 初始状态）
│   │
│   ├── components/                 # UI 组件
│   │   ├── TopNav.tsx              # 顶部导航（策略名 + 状态 + 操作）
│   │   ├── StatCards.tsx           # 统计卡片行
│   │   ├── ChartArea.tsx           # 'use client' — TradingView K 线
│   │   ├── NavChart.tsx            # 'use client' — 净值曲线（Canvas）
│   │   ├── DataTable.tsx           # 持仓/委托/成交/记录表格
│   │   ├── OrderDialog.tsx         # 'use client' — 手动开仓对话框
│   │   ├── DecisionLog.tsx         # 'use client' — 右侧决策日志
│   │   └── SessionSelector.tsx     # 会话切换器
│   │
│   ├── actions/                    # Server Actions
│   │   ├── order.ts                # 'use server' — 下单
│   │   ├── cancel.ts              # 'use server' — 撤单
│   │   ├── session-control.ts     # 'use server' — 暂停/恢复/终止
│   │   ├── create-session.ts      # 'use server' — 创建新会话
│   │   └── account-manage.ts      # 'use server' — 添加/删除账户
│   │
│   └── api/                        # Route Handlers（供外部系统调用）
│       ├── sessions/
│       │   ├── route.ts            # GET 列出会话 / POST 创建会话
│       │   └── [id]/
│       │       ├── route.ts        # GET 当前状态
│       │       ├── events/
│       │       │   └── route.ts    # GET 增量读取 / POST 追加事件
│       │       ├── order/
│       │       │   └── route.ts    # POST 下单
│       │       └── control/
│       │           └── route.ts    # POST pause/resume/stop
│       └── accounts/
│           ├── route.ts            # GET 列出 / POST 添加
│           └── [id]/
│               ├── route.ts        # DELETE 删除
│               └── test/
│                   └── route.ts    # POST 测试连通性
│
├── lib/                            # 共享逻辑（server-only）
│   ├── types.ts                    # 事件类型 + SessionState
│   ├── session-store.ts            # JSONL 文件操作（append、read、tail）
│   ├── state-machine.ts            # 状态恢复：逐行 reduce → SessionState
│   ├── metrics.ts                  # Performance 指标计算
│   ├── account-store.ts            # 读写 accounts.yaml
│   ├── exchanges/                  # 交易所签名适配器
│   │   ├── index.ts                # getExchange() 工厂
│   │   ├── types.ts
│   │   ├── binance.ts
│   │   ├── okx.ts
│   │   ├── bitget.ts
│   │   ├── bybit.ts
│   │   └── gate.ts
│   ├── order.ts                    # 下单执行（读凭证 → 签名 → 交易所 API）
│   └── sync.ts                     # 账户同步（调交易所余额/持仓 API）
│
└── sessions/                       # 数据目录（JSONL 文件）
    ├── ses_dpsk01ab.jsonl
    └── ses_xyz789cd.jsonl
```

### 5.3 SKILL.md

```yaml
---
name: trading
description: 交易终端 - 策略监控、手动下单、AI决策日志
metadata:
  icon:
    type: lucide
    value: candlestick-chart
  cover: 'gradient:ocean'
  page:
    type: server
    command: "pnpm dev"
    port: 3000
    ready_pattern: "Ready in"
    timeout: 20000
    permission: [read, write]
---
```

### 5.4 Next.js 全栈模式详解

#### Server Components（服务端渲染，零 JS bundle）

```tsx
// app/page.tsx — 主页面入口
import { restoreSessionState } from '@/lib/state-machine'
import { StatCards } from './components/StatCards'
import { DataTable } from './components/DataTable'
import { ChartArea } from './components/ChartArea'
import { DecisionLog } from './components/DecisionLog'

export default async function TradingPage({ searchParams }) {
  const sessionId = searchParams.session ?? 'latest'
  const state = await restoreSessionState(sessionId)  // 直接读文件，无 API 调用
  
  return (
    <div className="grid grid-cols-[1fr_360px] h-screen">
      <main>
        <StatCards metrics={state.metrics} />
        <ChartArea sessionId={sessionId} navHistory={state.navHistory} />
        <DataTable positions={state.positions} trades={state.trades} />
      </main>
      <aside>
        <DecisionLog sessionId={sessionId} initialDecisions={state.decisions} />
      </aside>
    </div>
  )
}
```

#### Server Actions（表单提交，无需 fetch）

```tsx
// app/actions/order.ts
'use server'
import { executeOrder } from '@/lib/order'
import { appendEvent } from '@/lib/session-store'
import { revalidatePath } from 'next/cache'

export async function submitOrder(sessionId: string, formData: FormData) {
  const symbol = formData.get('symbol') as string
  const side = formData.get('side') as 'buy' | 'sell'
  const quantity = parseFloat(formData.get('quantity') as string)
  
  const result = await executeOrder(sessionId, { symbol, side, type: 'market', quantity })
  
  await appendEvent(sessionId, { type: 'order_submit', ... })
  await appendEvent(sessionId, { type: 'order_result', ...result })
  
  revalidatePath('/') // 触发页面重新渲染
  return result
}
```

#### Route Handlers（供外部 monitor/agent 调用）

```tsx
// app/api/sessions/[id]/events/route.ts
import { appendEvent, readEventsFrom } from '@/lib/session-store'

export async function GET(req: Request, { params }) {
  const fromLine = new URL(req.url).searchParams.get('from_line') ?? '0'
  const events = await readEventsFrom(params.id, parseInt(fromLine))
  return Response.json({ events, total_lines: events.length })
}

export async function POST(req: Request, { params }) {
  const event = await req.json()
  await appendEvent(params.id, event)
  return Response.json({ ok: true })
}
```

#### Client Components（浏览器端交互）

```tsx
// app/components/ChartArea.tsx
'use client'
// TradingView widget、Binance WebSocket、用户交互
```

### 5.5 accounts.yaml（page 本地凭证）

存储在 page 目录根部，**完全独立于 `~/.viben`**：

```yaml
# pages/0612-trading/accounts.yaml
accounts:
  - id: "acc_001"
    exchange: "binance"
    name: "Binance #1"
    api_key: "xxxxxxxx"
    secret: "XXXXXXXX"
    created_at: "2026-06-12T10:00:00Z"
  - id: "acc_002"
    exchange: "okx"
    name: "OKX #1"
    api_key: "xxxxxxxx"
    secret: "XXXXXXXX"
    passphrase: "myPass"
    created_at: "2026-06-12T10:00:00Z"
```

- 文件权限 `0600`
- Server Components / Server Actions 直接读取（`lib/account-store.ts`）
- 用户通过页面 UI + Server Actions 管理账户（添加/删除/测试）

### 5.6 路由总览

**内部（Server Actions，前端直接调用）：**

| Action | 文件 | 功能 |
|--------|------|------|
| `submitOrder` | `actions/order.ts` | 手动下单 |
| `cancelOrder` | `actions/cancel.ts` | 撤单 |
| `pauseSession` | `actions/session-control.ts` | 暂停 |
| `resumeSession` | `actions/session-control.ts` | 恢复 |
| `stopSession` | `actions/session-control.ts` | 终止 |
| `createSession` | `actions/create-session.ts` | 创建新会话 |
| `addAccount` | `actions/account-manage.ts` | 添加账户 |
| `removeAccount` | `actions/account-manage.ts` | 删除账户 |
| `testAccount` | `actions/account-manage.ts` | 测试连通性 |

**外部（Route Handlers，供 monitor/agent HTTP 调用）：**

| 路由 | 方法 | 职责 |
|------|------|------|
| `/api/sessions` | GET/POST | 列出/创建会话 |
| `/api/sessions/:id` | GET | 获取当前状态 |
| `/api/sessions/:id/events` | GET | 增量读取事件（`?from_line=N`） |
| `/api/sessions/:id/events` | POST | 追加事件 |
| `/api/sessions/:id/order` | POST | 执行下单 |
| `/api/sessions/:id/control` | POST | pause/resume/stop |
| `/api/accounts` | GET/POST | 列出/添加账户 |
| `/api/accounts/:id` | DELETE | 删除账户 |
| `/api/accounts/:id/test` | POST | 测试连通性 |

### 5.7 数据流全景

```
┌──────────────────────────────────────────────────────────────────────┐
│  pages/0612-trading/ (Next.js dev server, port 3000)                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  app/page.tsx (Server Component)                        │         │
│  │    → lib/state-machine.ts → sessions/*.jsonl            │         │
│  │    → 渲染初始 HTML（含完整数据）                          │         │
│  └─────────────────────────────────────────────────────────┘         │
│                         │ hydrate                                     │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  Client Components                                      │         │
│  │    ├─ TradingView K线（Binance symbol）                  │         │
│  │    ├─ Binance WebSocket（实时价格）                       │         │
│  │    ├─ DecisionLog（轮询 /api/sessions/:id/events）       │         │
│  │    └─ OrderDialog → Server Action submitOrder()         │         │
│  └─────────────────────────────────────────────────────────┘         │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  Server Actions                                         │         │
│  │    ├→ lib/order.ts → accounts.yaml → exchange API       │         │
│  │    ├→ lib/session-store.ts → sessions/*.jsonl (append)  │         │
│  │    └→ revalidatePath → 触发重新渲染                      │         │
│  └─────────────────────────────────────────────────────────┘         │
│                                                                      │
│  外部写入者（通过 Route Handlers）：                                   │
│  ┌──────────────┐  POST /api/sessions/:id/events                     │
│  │ 市场监控器    │ ─────────────────────────────→ session.jsonl       │
│  └──────────────┘                                                    │
│  ┌──────────────┐  POST /api/sessions/:id/events + /order            │
│  │ 交易员 Agent  │ ─────────────────────────────→ session.jsonl      │
│  └──────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.8 下单流程

```
用户点击「确认下单」
  → OrderDialog 调用 Server Action submitOrder(sessionId, formData)
  → actions/order.ts (服务端执行):
    1. 从 session.jsonl 读取 account_id
    2. 从 accounts.yaml 读取凭证
    3. exchanges/binance.ts sign() 生成签名
    4. fetch → 交易所 REST API
    5. append order_submit + order_result 到 session.jsonl
    6. revalidatePath('/') 触发页面刷新
  → 前端自动更新（Server Component 重新渲染）
```

### 5.9 技术选型

| 依赖 | 用途 |
|------|------|
| `next` | 全栈框架（App Router + Server Actions + Route Handlers） |
| `react` / `react-dom` | UI |
| `typescript` | 类型安全 |
| `tailwindcss` | 样式 |
| `js-yaml` | 读写 accounts.yaml |
| `nanoid` | 生成 ID |
| `node:crypto` | HMAC 签名 |
| TradingView Widget (CDN) | K 线图表 |
| Binance WebSocket (浏览器原生) | 实时价格 |

---

## 6. 不在本页面范围（由外部系统负责）

| 功能 | 负责方 | 交互方式 |
|------|--------|----------|
| 市场数据抓取 | 市场监控器（cron/swarm） | `POST /api/sessions/:id/events` |
| Agent 调度与运行 | swarm 系统 | `POST /api/sessions/:id/events` |
| Agent 工具调用（下单） | Agent runtime | `POST /api/sessions/:id/order` |

**关键设计**：
- 完全独立运行，**不依赖主 Gateway（18790）、不依赖 `~/.viben`**
- Account 管理在页面内完成（Server Action + `accounts.yaml`）
- Route Handlers 是外部系统的统一写入入口
- Client Components 通过轮询 GET `/api/sessions/:id/events?from_line=N` 获取实时更新
- Server Components 首屏渲染完整状态（SEO 无关，但保证首屏快）
