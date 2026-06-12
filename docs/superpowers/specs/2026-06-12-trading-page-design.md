# 交易页面设计

## 概述

在 `pages/` 目录下新增交易页面，提供：
- 策略监控面板（账户净值、持仓、统计指标）
- 行情图表
- 手动开仓/平仓功能
- AI 决策日志（基于 session.jsonl 的流式播放器）
- 当前持仓 / 当前委托 / 历史成交 / 订单记录

连接 Gateway 获取真实账户数据，通过 exchange adapter 执行真实交易。

## 参考

- UI 风格：亮色金融（参考 `pages/0612-finance`）
- Trading Account 模块：`packages/core/src/account/`
- Gateway Routes：`GET/POST /api/accounts`, `GET /api/exchanges`

---

## 1. 页面结构

```
pages/0612-trading/
├── SKILL.md              # 页面元数据
├── index.html            # 单文件 HTML（React 18 + 内联 CSS/JS）
└── sessions/             # 交易会话存储目录
    ├── ses_abc123.jsonl   # 会话 A
    └── ses_def456.jsonl   # 会话 B
```

### SKILL.md

```yaml
---
name: trading
description: 交易终端 - 策略监控、手动下单、AI决策日志
metadata:
  icon:
    type: emoji
    value: "📈"
  cover: 'gradient:ocean'
  page:
    type: static
    file: index.html
    permission:
      - read
      - write
---
```

---

## 2. Session JSONL 数据架构

### 设计原则

| 原则 | 实现方式 |
|------|----------|
| 只追加写入 | 文件只 append，不修改历史行 |
| 完全可恢复 | `session_init` + 逐行重放 → 完整状态 |
| 流式计算 | 每行事件自含信息，可增量计算 NAV/PnL |
| Agent 无状态 | 每次运行收到完整上下文，不依赖前次内存 |
| 经验可复用 | 所有 `agent_decision` + `order_result` 可提取为 skill |
| 断点续传 | `session_resume` 携带同步后的账户状态 |

### 参与方

- **monitor** — 市场监控器 + 用户操作（系统/用户侧）
- **agent** — 交易员智能体（AI 侧，每次全新运行）

### 事件类型

```typescript
// 基础字段（所有事件共有）
interface BaseEvent {
  type: string;
  ts: string;       // ISO 8601 时间戳
  cycle?: number;   // 交易周期编号（从 1 递增）
}

// ─── 会话生命周期 ───

// 1. 会话初始化（恢复起点）
interface SessionInitEvent extends BaseEvent {
  type: "session_init";
  session_id: string;
  account_id: string;         // 关联的 trading account ID
  exchange: ExchangeId;
  initial_balance: Record<string, number>;  // {"USDT": 10.00, "BTC": 0.001}
  agent_config: {
    model: string;            // "deepseek-v4-pro"
    strategy: string;         // "AI500高频动能追踪策略（中风险）"
    risk_level: "low" | "medium" | "high";
    symbols: string[];        // ["BTCUSDT", "ETHUSDT"]
    interval_minutes: number; // 决策间隔（分钟）
  };
}

// 2. 会话暂停
interface SessionPauseEvent extends BaseEvent {
  type: "session_pause";
  reason: "user_manual" | "error" | "quota_exceeded" | "market_closed";
}

// 3. 会话恢复（断点续传）
interface SessionResumeEvent extends BaseEvent {
  type: "session_resume";
  resume_from_cycle: number;
  synced_balance: Record<string, number>; // 重新同步的账户余额
  synced_positions: Position[];           // 重新同步的持仓
}

// 4. 会话结束
interface SessionEndEvent extends BaseEvent {
  type: "session_end";
  reason: "user_stop" | "target_reached" | "max_loss" | "error";
  final_nav: number;
  total_pnl: number;
  total_trades: number;
}

// ─── 市场监控器推送 ───

// 5. 市场上下文（monitor → agent，定期推送）
interface MarketContextEvent extends BaseEvent {
  type: "market_context";
  symbols: string[];
  klines: Record<string, {
    interval: string;           // "1h", "15m"
    data: Array<{
      ts: string;
      o: number; h: number; l: number; c: number;
      v: number;
    }>;
  }>;
  indicators: Record<string, Record<string, number>>;  // {"BTCUSDT": {"rsi": 45.2, "macd_hist": 0.5}}
  signals: Record<string, Record<string, string>>;     // {"BTCUSDT": {"momentum": "bullish"}}
}

// ─── Agent 交互 ───

// 6. 传给 Agent 的上下文（完整输入）
interface AgentInputEvent extends BaseEvent {
  type: "agent_input";
  agent_session_id: string;   // Agent 独立运行的 session ID（可在其他地方查看详情）
  context: {
    market_summary: string;   // 市场概要
    positions: Position[];    // 当前持仓
    available_balance: Record<string, number>;
    recent_trades: TradeRecord[];  // 最近交易记录（作为经验）
    nav: number;              // 当前净值
    pnl: number;              // 累计盈亏
  };
}

// 7. Agent 决策结果（agent → 用户侧）
interface AgentDecisionEvent extends BaseEvent {
  type: "agent_decision";
  agent_session_id: string;
  action: "order" | "hold" | "close";
  order?: {
    symbol: string;
    side: "buy" | "sell";
    type: "market" | "limit";
    quantity: number;
    price?: number;           // limit 单时必填
  };
  reasoning: string;          // Agent 的交易思路总结
  thinking_summary?: string;  // 思考过程简述
  confidence: number;         // 0-1 置信度
}

// 8. Agent 运行错误
interface AgentErrorEvent extends BaseEvent {
  type: "agent_error";
  agent_session_id: string;
  error: string;
  error_code: string;         // "quota_exceeded" | "timeout" | "api_error"
}

// ─── 订单与执行 ───

// 9. 订单提交（手动或 Agent）
interface OrderSubmitEvent extends BaseEvent {
  type: "order_submit";
  order_id: string;
  source: "agent" | "manual"; // 区分手动/自动
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  quantity: number;
  price?: number;
}

// 10. 订单执行结果
interface OrderResultEvent extends BaseEvent {
  type: "order_result";
  order_id: string;
  symbol: string;
  side: "buy" | "sell";
  filled_price: number;
  filled_quantity: number;
  fee: number;
  fee_asset: string;          // "USDT", "BNB"
  status: "filled" | "partial" | "rejected" | "cancelled";
  error?: string;             // rejected/cancelled 时的原因
}

// ─── 状态快照 ───

// 11. 账户状态快照（每个 cycle 结束后自动追加）
interface AccountSnapshotEvent extends BaseEvent {
  type: "account_snapshot";
  balance: Record<string, number>;
  positions: Position[];
  nav: number;                // 净资产价值（USDT 计价）
  nav_change: number;         // 相对初始的变化
  nav_change_pct: number;     // 变化百分比
}

// ─── 辅助类型 ───

interface Position {
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entry_price: number;
  current_price?: number;
  unrealized_pnl?: number;
}

interface TradeRecord {
  order_id: string;
  symbol: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  pnl?: number;              // 平仓时的已实现盈亏
  ts: string;
}
```

### 示例文件内容

```jsonl
{"type":"session_init","ts":"2026-06-12T10:00:00Z","session_id":"ses_dpsk01","account_id":"abc123","exchange":"binance","initial_balance":{"USDT":10.00},"agent_config":{"model":"deepseek-v4-pro","strategy":"AI500高频动能追踪策略（中风险）","risk_level":"medium","symbols":["BTCUSDT","ETHUSDT"],"interval_minutes":15}}
{"type":"market_context","ts":"2026-06-12T10:15:00Z","cycle":1,"symbols":["BTCUSDT"],"klines":{"BTCUSDT":{"interval":"1h","data":[{"ts":"2026-06-12T09:00:00Z","o":67000,"h":67500,"l":66800,"c":67200,"v":1234}]}},"indicators":{"BTCUSDT":{"rsi":42.5,"macd_hist":-0.3}},"signals":{"BTCUSDT":{"momentum":"neutral"}}}
{"type":"agent_input","ts":"2026-06-12T10:15:01Z","cycle":1,"agent_session_id":"agent_001","context":{"market_summary":"BTC横盘震荡，RSI 42.5中性偏空","positions":[],"available_balance":{"USDT":10.00},"recent_trades":[],"nav":10.00,"pnl":0}}
{"type":"agent_decision","ts":"2026-06-12T10:15:12Z","cycle":1,"agent_session_id":"agent_001","action":"order","order":{"symbol":"BTCUSDT","side":"buy","type":"market","quantity":0.00015},"reasoning":"RSI接近超卖区域，MACD柱线收窄，预计短期反弹","confidence":0.65}
{"type":"order_submit","ts":"2026-06-12T10:15:12Z","cycle":1,"order_id":"ord_001","source":"agent","symbol":"BTCUSDT","side":"buy","type":"market","quantity":0.00015}
{"type":"order_result","ts":"2026-06-12T10:15:13Z","cycle":1,"order_id":"ord_001","symbol":"BTCUSDT","side":"buy","filled_price":67200.00,"filled_quantity":0.00015,"fee":0.01,"fee_asset":"USDT","status":"filled"}
{"type":"account_snapshot","ts":"2026-06-12T10:15:14Z","cycle":1,"balance":{"USDT":0.91,"BTC":0.00015},"positions":[{"symbol":"BTCUSDT","side":"long","quantity":0.00015,"entry_price":67200.00}],"nav":10.00,"nav_change":0,"nav_change_pct":0}
```

### 状态恢复算法

```
1. 读取整个 .jsonl 文件逐行解析
2. 找到最后一个 session_init 或 session_resume 作为基准
3. 从基准点开始累积：
   - account_snapshot → 更新余额和持仓状态
   - order_result → 更新交易历史
   - agent_decision → 更新决策日志
4. 计算 performance 指标：
   - NAV 序列 → 净值曲线
   - 累计 PnL → 收益率
   - NAV 序列最大回撤 → max drawdown
   - 胜率 = 盈利交易数 / 总平仓交易数
   - 夏普率 = mean(daily_returns) / std(daily_returns) * sqrt(252)
```

---

## 3. 页面 UI 布局

### 整体布局

```
┌─────────────────────────────────────────────────────────────────┐
│ TopNav: 策略名称 | 标签(交易所+模型) | 状态(运行中/已暂停) | 操作 │
├───────────────────────────────────────┬─────────────────────────┤
│ 左侧主区域 (70%)                       │ 右侧面板 (30%)          │
│                                       │                         │
│ ┌─────────────────────────────────┐   │ ┌─────────────────────┐ │
│ │ 统计卡片行                       │   │ │ 最近决策             │ │
│ │ 胜率 | 盈亏 | NAV | 持仓 | 余额  │   │ │                     │ │
│ └─────────────────────────────────┘   │ │ 周期 #N              │ │
│                                       │ │ ├ 市场上下文          │ │
│ ┌─────────────────────────────────┐   │ │ ├ 思考过程            │ │
│ │ Tab: 账户净值曲线 | 行情图表      │   │ │ ├ 交易决策            │ │
│ │                                 │   │ │ └ 执行结果            │ │
│ │ 净值: $10.00  +$0.06 (+0.62%)   │   │ │                     │ │
│ │ [1D] [7D] [1M] [3M] [All]      │   │ │ 周期 #N-1            │ │
│ │                                 │   │ │ ...                   │ │
│ │     ╭──────────╮                │   │ │                     │ │
│ │    ╱            ╲               │   │ └─────────────────────┘ │
│ │ ──╯              ╰──           │   │                         │
│ │                                 │   │                         │
│ └─────────────────────────────────┘   │                         │
│                                       │                         │
│ ┌─────────────────────────────────┐   │                         │
│ │ Tab: 持仓 | 委托 | 成交 | 记录   │   │                         │
│ │ [手动开仓]                       │   │                         │
│ │ ┌───┬────┬───┬───┬────┬───┐    │   │                         │
│ │ │币对│方向│数量│价格│盈亏│操作│    │   │                         │
│ │ └───┴────┴───┴───┴────┴───┘    │   │                         │
│ └─────────────────────────────────┘   │                         │
└───────────────────────────────────────┴─────────────────────────┘
```

### 配色方案（亮色金融）

```css
:root {
  --color-primary: #0891B2;     /* 主色调 - 青色 */
  --color-secondary: #22D3EE;
  --color-background: #ECFEFF;  /* 浅青背景 */
  --color-surface: #FFFFFF;     /* 卡片/面板 */
  --color-text: #164E63;
  --color-text2: #5B7A8A;
  --color-green: #059669;       /* 盈利 */
  --color-red: #DC2626;         /* 亏损 */
  --color-border: #E2E8F0;
}
```

### 组件设计

#### 3.1 TopNav

- 左侧：策略头像 + 名称 + 标签组（交易所、模型、策略名简称）
- 右侧：运行状态 badge（绿色"运行中" / 黄色"已暂停"）+ 操作按钮（暂停/恢复/设置）

#### 3.2 统计卡片

5 个指标卡片横排：
- **胜率** — 百分比 + 胜/亏条形图
- **交易盈亏** — 绝对金额（绿/红色）+ 初始金额
- **NAV收益率** — 百分比
- **持仓** — 占比% + 活跃数量
- **可用余额** — USDT 金额

#### 3.3 图表区

- Tab 切换：「账户净值曲线」|「行情图表」
- 净值曲线：纯 Canvas/SVG 绘制，显示 NAV 随时间变化
- 行情图表：嵌入 TradingView widget（与 finance 页面一致）
- 时间周期选择：1D / 7D / 1M / 3M / All
- 金额/百分比切换

#### 3.4 底部表格

Tab 切换：
- **当前持仓** — symbol, side, qty, entry_price, current_price, unrealized_pnl, 操作(平仓)
- **当前委托** — 挂单列表 + 撤单操作
- **历史成交** — 已完成的交易
- **订单记录** — 全部订单含状态

右上角：「仅当前币种」筛选 + 「手动开仓」按钮

#### 3.5 手动开仓弹窗

```
┌── 手动开仓 ──────────────────┐
│ 币对: [BTCUSDT ▾]           │
│ 方向: [买入] [卖出]          │
│ 类型: [市价] [限价]          │
│ 数量: [______] USDT         │
│ 价格: [______] (限价时显示)  │
│                              │
│ 预计成交: ~0.00015 BTC       │
│                              │
│        [取消]  [确认下单]     │
└──────────────────────────────┘
```

#### 3.6 右侧决策日志面板

时间线布局，每个 cycle 为一个卡片：
- 标题：时间 + 周期编号 + 模型名 + 状态（成功/失败）
- 可展开内容：
  - 思考过程（`thinking_summary`）
  - 提示词（`agent_input.context`）
- 操作结果：下单详情或 hold 说明

失败的 cycle 显示红色错误信息。

---

## 4. 新增 Gateway Routes

```typescript
// packages/core/src/gateway/routes/trading.ts

// GET /api/trading/sessions — 列出所有 trading sessions
// GET /api/trading/sessions/:id — 读取某个 session 的事件（支持 ?from_line=N 分页）
// POST /api/trading/sessions — 创建新 session
// POST /api/trading/sessions/:id/events — 追加事件到 session
// POST /api/trading/sessions/:id/order — 执行手动下单

// GET /api/trading/sessions/:id/state — 计算并返回当前状态（从 jsonl 恢复）
// POST /api/trading/sessions/:id/pause — 暂停会话
// POST /api/trading/sessions/:id/resume — 恢复会话
```

### 手动下单流程

```
页面 → POST /api/trading/sessions/:id/order
     → Gateway 读取 session 获取 account_id
     → 调用 exchange adapter sign() + 发送请求
     → 返回执行结果
     → 追加 order_submit + order_result 事件到 session.jsonl
```

---

## 5. 核心模块结构

```
packages/core/src/trading/
├── index.ts
└── ops/
    ├── index.ts
    ├── types.ts          # 所有事件类型定义
    ├── session-store.ts  # session.jsonl 读写（追加、读取、分页）
    ├── state.ts          # 状态恢复与计算（NAV、PnL、胜率、夏普率）
    ├── order.ts          # 下单执行（调用 exchange adapter）
    └── metrics.ts        # Performance 指标计算
```

---

## 6. 状态恢复与 Performance 计算

### 恢复流程

```
readSessionFile(path)
  → 逐行 JSON.parse
  → 找到最后一个 session_init 或 session_resume
  → 从该点开始累积状态
  → 输出: { balance, positions, nav_history, trades, decisions, metrics }
```

### Performance 指标

| 指标 | 计算方式 |
|------|----------|
| 胜率 | 盈利平仓交易数 / 总平仓交易数 |
| 累计盈亏 | 最新 NAV - 初始 NAV |
| NAV 收益率 | (最新 NAV - 初始 NAV) / 初始 NAV * 100% |
| 最大回撤 | max(peak - trough) / peak over NAV series |
| 夏普率 | mean(period_returns) / std(period_returns) * sqrt(N) |
| 交易频率 | total_trades / session_duration_days |

---

## 7. 继续交易（经验复用）

当从旧 session 恢复时：

1. 追加 `session_resume` 事件（包含同步后的真实账户余额）
2. Agent 接收的 `agent_input.context.recent_trades` 包含历史交易记录
3. Agent 可从中提取 skill（如：RSI < 30 时做多成功率高）
4. 未来可在 session 中追加 `skill_extracted` 事件记录学习结果

---

## 8. 技术选型

| 依赖 | 用途 | 新增？ |
|------|------|--------|
| React 18 (CDN) | 页面 UI | 否（与 finance 一致） |
| TradingView Widget | 行情图表 | 否（与 finance 一致） |
| Binance WS | 实时行情 | 否（与 finance 一致） |
| Exchange Adapters | 下单签名 | 否（已有） |
| node:readline | JSONL 逐行读取 | 内置 |
| node:fs/appendFile | JSONL 追加写入 | 内置 |

---

## 9. 不在范围

- Agent 运行时（由外部 swarm/cron 触发，不在此页面实现）
- 市场监控器的定时调度逻辑
- 策略配置 UI（使用现有 session_init 的 agent_config）
- 多用户权限
