# Trading Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Next.js 全栈交易终端页面（`pages/0612-trading/`），集成策略监控、手动交易、AI 决策回放，数据持久化为 session.jsonl。

**Architecture:** Next.js App Router 全栈应用（type=server），Server Components 直接读写文件，Server Actions 处理交易操作，Route Handlers 供外部 monitor/agent 写入事件。交易所签名适配器自包含于 page 内部，不依赖 packages/core。

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, js-yaml, nanoid, node:crypto (HMAC), TradingView Widget (CDN), Binance WebSocket

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `pages/0612-trading/SKILL.md` | Page 配置（type: server, port 3000） |
| `pages/0612-trading/package.json` | 依赖声明 |
| `pages/0612-trading/next.config.ts` | Next.js 配置 |
| `pages/0612-trading/tsconfig.json` | TypeScript 配置 |
| `pages/0612-trading/tailwind.config.ts` | Tailwind 配置 |
| `pages/0612-trading/app/globals.css` | 全局样式 |
| `pages/0612-trading/accounts.yaml` | 交易账户凭证（chmod 0600） |
| `pages/0612-trading/sessions/` | JSONL 数据目录 |
| **lib 层** | |
| `pages/0612-trading/lib/types.ts` | 所有事件类型 + SessionState + Position + TradeRecord |
| `pages/0612-trading/lib/session-store.ts` | JSONL 文件 I/O（append, readAll, readFrom, listSessions） |
| `pages/0612-trading/lib/state-machine.ts` | 事件序列 → SessionState 恢复 |
| `pages/0612-trading/lib/metrics.ts` | Performance 指标计算（胜率、夏普、回撤） |
| `pages/0612-trading/lib/account-store.ts` | accounts.yaml 读写 |
| `pages/0612-trading/lib/exchanges/types.ts` | Exchange 接口定义 |
| `pages/0612-trading/lib/exchanges/index.ts` | getExchange() 工厂 |
| `pages/0612-trading/lib/exchanges/binance.ts` | Binance 签名 + 下单 + 查询 |
| `pages/0612-trading/lib/exchanges/okx.ts` | OKX 签名适配器 |
| `pages/0612-trading/lib/order.ts` | 下单执行（读凭证 → 签名 → 调交易所） |
| `pages/0612-trading/lib/sync.ts` | 账户同步（余额 + 持仓查询） |
| **Server Actions** | |
| `pages/0612-trading/app/actions/order.ts` | submitOrder — 手动下单 |
| `pages/0612-trading/app/actions/cancel.ts` | cancelOrder — 撤单 |
| `pages/0612-trading/app/actions/session-control.ts` | pause/resume/stop |
| `pages/0612-trading/app/actions/create-session.ts` | 创建新会话 |
| `pages/0612-trading/app/actions/account-manage.ts` | 添加/删除/测试账户 |
| **Route Handlers** | |
| `pages/0612-trading/app/api/sessions/route.ts` | GET 列出 / POST 创建 |
| `pages/0612-trading/app/api/sessions/[id]/route.ts` | GET 状态 |
| `pages/0612-trading/app/api/sessions/[id]/events/route.ts` | GET 增量读 / POST 追加 |
| `pages/0612-trading/app/api/sessions/[id]/order/route.ts` | POST 下单 |
| `pages/0612-trading/app/api/sessions/[id]/control/route.ts` | POST pause/resume/stop |
| `pages/0612-trading/app/api/accounts/route.ts` | GET / POST 账户管理 |
| `pages/0612-trading/app/api/accounts/[id]/route.ts` | DELETE 删除 |
| `pages/0612-trading/app/api/accounts/[id]/test/route.ts` | POST 连通性测试 |
| **UI Components** | |
| `pages/0612-trading/app/layout.tsx` | Root layout |
| `pages/0612-trading/app/page.tsx` | 主页面（Server Component） |
| `pages/0612-trading/app/components/top-nav.tsx` | 顶部导航栏 |
| `pages/0612-trading/app/components/stat-cards.tsx` | 统计卡片行 |
| `pages/0612-trading/app/components/nav-chart.tsx` | 净值曲线（Client） |
| `pages/0612-trading/app/components/chart-area.tsx` | TradingView K 线（Client） |
| `pages/0612-trading/app/components/data-table.tsx` | 底部数据表格 |
| `pages/0612-trading/app/components/order-dialog.tsx` | 手动开仓对话框（Client） |
| `pages/0612-trading/app/components/decision-log.tsx` | 右侧决策日志（Client） |
| `pages/0612-trading/app/components/session-selector.tsx` | 会话选择器 |

---

## Task 1: 项目脚手架

**Files:**
- Create: `pages/0612-trading/SKILL.md`
- Create: `pages/0612-trading/package.json`
- Create: `pages/0612-trading/next.config.ts`
- Create: `pages/0612-trading/tsconfig.json`
- Create: `pages/0612-trading/tailwind.config.ts`
- Create: `pages/0612-trading/app/globals.css`
- Create: `pages/0612-trading/app/layout.tsx`
- Create: `pages/0612-trading/app/page.tsx`
- Create: `pages/0612-trading/accounts.yaml`
- Create: `pages/0612-trading/sessions/.gitkeep`

- [ ] **Step 1: 创建 SKILL.md**

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
    permission:
      - read
      - write
---

# 交易终端

策略交易监控面板，支持手动下单和 AI 决策回放。
```

- [ ] **Step 2: 创建 package.json**

```json
{
  "name": "0612-trading",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.3.2",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "js-yaml": "^4.1.0",
    "nanoid": "^5.1.5"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.15.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "typescript": "^5.8.0",
    "tailwindcss": "^4.1.0",
    "@tailwindcss/postcss": "^4.1.0",
    "postcss": "^8.5.0"
  }
}
```

- [ ] **Step 3: 创建 next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 4: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: 创建 postcss.config.mjs + tailwind.config.ts + globals.css**

`postcss.config.mjs`:
```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

`tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0891B2",
        gain: "#16a34a",
        loss: "#dc2626",
      },
    },
  },
  plugins: [],
};

export default config;
```

`app/globals.css`:
```css
@import "tailwindcss";

:root {
  --primary: #0891B2;
  --gain: #16a34a;
  --loss: #dc2626;
  --surface: #ffffff;
  --surface-secondary: #f8fafc;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --border: #e2e8f0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro", "Inter", sans-serif;
  background: var(--surface);
  color: var(--text-primary);
}
```

- [ ] **Step 6: 创建 app/layout.tsx + app/page.tsx（最小可运行版本）**

`app/layout.tsx`:
```tsx
import "./globals.css";

export const metadata = {
  title: "Trading Terminal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-white">{children}</body>
    </html>
  );
}
```

`app/page.tsx`:
```tsx
export default function TradingPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Trading Terminal</h1>
      <p className="text-gray-500 mt-2">Loading...</p>
    </div>
  );
}
```

- [ ] **Step 7: 创建 accounts.yaml 和 sessions 目录**

`accounts.yaml`:
```yaml
accounts: []
```

`sessions/.gitkeep`: 空文件

- [ ] **Step 8: 安装依赖并验证启动**

```bash
cd pages/0612-trading && pnpm install && pnpm dev
```

Expected: 终端输出 "Ready in" 且 `http://localhost:3000` 显示 "Trading Terminal"

- [ ] **Step 9: Commit**

```bash
git add pages/0612-trading/
git commit -m "feat(trading): scaffold Next.js trading page"
```

---

## Task 2: lib/types.ts — 核心类型定义

**Files:**
- Create: `pages/0612-trading/lib/types.ts`

- [ ] **Step 1: 创建类型文件**

```typescript
// lib/types.ts

export type ExchangeId = "binance" | "okx" | "bitget" | "bybit" | "gate";

// ─── 辅助类型 ───

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
}

export interface OHLCV {
  ts: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

// ─── 事件类型 ───

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

// ─── 联合类型 ───

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
  | SkillExtractedEvent;

// ─── 恢复后的状态 ───

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

// ─── Account ───

export interface Account {
  id: string;
  exchange: ExchangeId;
  name: string;
  api_key: string;
  secret: string;
  passphrase?: string;
  created_at: string;
}

export interface AccountsFile {
  accounts: Account[];
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/0612-trading/lib/types.ts
git commit -m "feat(trading): add core type definitions"
```

---

## Task 3: lib/session-store.ts — JSONL 文件操作

**Files:**
- Create: `pages/0612-trading/lib/session-store.ts`

- [ ] **Step 1: 实现 session store**

```typescript
// lib/session-store.ts
import { readFile, appendFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { nanoid } from "nanoid";
import type { SessionEvent } from "./types";

const SESSIONS_DIR = join(process.cwd(), "sessions");

async function ensureSessionsDir() {
  if (!existsSync(SESSIONS_DIR)) {
    await mkdir(SESSIONS_DIR, { recursive: true });
  }
}

export function generateSessionId(): string {
  return `ses_${nanoid(8)}`;
}

export function sessionFilePath(sessionId: string): string {
  return join(SESSIONS_DIR, `${sessionId}.jsonl`);
}

export async function appendEvent(sessionId: string, event: SessionEvent): Promise<void> {
  await ensureSessionsDir();
  const filePath = sessionFilePath(sessionId);
  const line = JSON.stringify(event) + "\n";
  await appendFile(filePath, line, "utf-8");
}

export async function readAllEvents(sessionId: string): Promise<SessionEvent[]> {
  const filePath = sessionFilePath(sessionId);
  if (!existsSync(filePath)) return [];
  const content = await readFile(filePath, "utf-8");
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SessionEvent);
}

export async function readEventsFrom(sessionId: string, fromLine: number): Promise<SessionEvent[]> {
  const all = await readAllEvents(sessionId);
  return all.slice(fromLine);
}

export async function countLines(sessionId: string): Promise<number> {
  const filePath = sessionFilePath(sessionId);
  if (!existsSync(filePath)) return 0;
  const content = await readFile(filePath, "utf-8");
  return content.trim().split("\n").filter(Boolean).length;
}

export async function listSessions(): Promise<string[]> {
  await ensureSessionsDir();
  const files = await readdir(SESSIONS_DIR);
  return files
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => f.replace(".jsonl", ""));
}

export async function getLatestSessionId(): Promise<string | null> {
  const sessions = await listSessions();
  if (sessions.length === 0) return null;
  // 按文件修改时间排序，取最新
  const { stat } = await import("node:fs/promises");
  const withMtime = await Promise.all(
    sessions.map(async (id) => ({
      id,
      mtime: (await stat(sessionFilePath(id))).mtimeMs,
    }))
  );
  withMtime.sort((a, b) => b.mtime - a.mtime);
  return withMtime[0].id;
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/0612-trading/lib/session-store.ts
git commit -m "feat(trading): add JSONL session store"
```

---

## Task 4: lib/state-machine.ts — 状态恢复

**Files:**
- Create: `pages/0612-trading/lib/state-machine.ts`

- [ ] **Step 1: 实现状态机**

```typescript
// lib/state-machine.ts
import type {
  SessionEvent,
  SessionState,
  SessionStatus,
  SessionMetrics,
  Position,
  TradeRecord,
  NavPoint,
  DecisionEntry,
  SessionInitEvent,
} from "./types";
import { readAllEvents } from "./session-store";
import { computeMetrics } from "./metrics";

function createEmptyState(): SessionState {
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

function reduceEvent(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "session_init": {
      return {
        ...state,
        session_id: event.session_id,
        session_name: event.session_name,
        status: "running",
        exchange: event.exchange,
        account_id: event.account_id,
        agent_config: event.agent_config,
        tags: event.tags,
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
      return {
        ...state,
        current_cycle: event.cycle,
        positions: event.positions,
        nav_history: [...state.nav_history, navPoint],
        metrics: {
          ...state.metrics,
          nav: event.nav,
          nav_change_pct: event.nav_change_pct,
          total_realized_pnl: event.total_realized_pnl,
          total_fees: event.total_fee,
          available_balance: event.balance,
          position_pct: event.positions.length > 0
            ? event.positions.reduce((s, p) => s + p.quantity * (p.current_price ?? p.entry_price), 0) / event.nav
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
        positions: event.synced_positions,
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

    case "config_update": {
      return state; // config 更新不影响 state 结构
    }

    default:
      return state;
  }
}

export async function restoreSessionState(sessionId: string): Promise<SessionState> {
  const events = await readAllEvents(sessionId);
  let state = createEmptyState();

  for (const event of events) {
    state = reduceEvent(state, event);
  }

  // 计算衍生指标
  state.metrics = computeMetrics(state);

  return state;
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/0612-trading/lib/state-machine.ts
git commit -m "feat(trading): add session state machine"
```

---

## Task 5: lib/metrics.ts — Performance 指标

**Files:**
- Create: `pages/0612-trading/lib/metrics.ts`

- [ ] **Step 1: 实现指标计算**

```typescript
// lib/metrics.ts
import type { SessionState, SessionMetrics, NavPoint } from "./types";

export function computeMetrics(state: SessionState): SessionMetrics {
  const { trades, nav_history, initial_balance } = state;
  const initialNav = Object.values(initial_balance).reduce((s, v) => s + v, 0);
  const currentNav = state.metrics.nav || initialNav;

  // 胜率
  const closedTrades = trades.filter((t) => t.realized_pnl !== undefined);
  const wins = closedTrades.filter((t) => (t.realized_pnl ?? 0) > 0);
  const losses = closedTrades.filter((t) => (t.realized_pnl ?? 0) < 0);
  const winRate = closedTrades.length > 0 ? wins.length / closedTrades.length : 0;

  // PnL
  const totalPnl = currentNav - initialNav;
  const totalPnlPct = initialNav > 0 ? (totalPnl / initialNav) * 100 : 0;

  // 最大回撤
  const { maxDrawdown, maxDrawdownPct } = computeMaxDrawdown(nav_history);

  // 夏普率
  const sharpeRatio = computeSharpe(nav_history);

  // 总手续费
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

  // 年化（假设每小时一个数据点）
  const annualizationFactor = Math.sqrt(365 * 24);
  return (mean / std) * annualizationFactor;
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/0612-trading/lib/metrics.ts
git commit -m "feat(trading): add performance metrics computation"
```

---

## Task 6: lib/account-store.ts — 账户管理

**Files:**
- Create: `pages/0612-trading/lib/account-store.ts`

- [ ] **Step 1: 实现账户 store**

```typescript
// lib/account-store.ts
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { nanoid } from "nanoid";
import type { Account, AccountsFile, ExchangeId } from "./types";

const ACCOUNTS_PATH = join(process.cwd(), "accounts.yaml");

export async function readAccounts(): Promise<Account[]> {
  if (!existsSync(ACCOUNTS_PATH)) return [];
  const content = await readFile(ACCOUNTS_PATH, "utf-8");
  const data = yaml.load(content) as AccountsFile | null;
  return data?.accounts ?? [];
}

export async function writeAccounts(accounts: Account[]): Promise<void> {
  const data: AccountsFile = { accounts };
  const content = yaml.dump(data, { lineWidth: 120 });
  await writeFile(ACCOUNTS_PATH, content, { encoding: "utf-8", mode: 0o600 });
}

export async function addAccount(params: {
  exchange: ExchangeId;
  name: string;
  api_key: string;
  secret: string;
  passphrase?: string;
}): Promise<Account> {
  const accounts = await readAccounts();
  const account: Account = {
    id: `acc_${nanoid(8)}`,
    ...params,
    created_at: new Date().toISOString(),
  };
  accounts.push(account);
  await writeAccounts(accounts);
  return account;
}

export async function removeAccount(id: string): Promise<boolean> {
  const accounts = await readAccounts();
  const filtered = accounts.filter((a) => a.id !== id);
  if (filtered.length === accounts.length) return false;
  await writeAccounts(filtered);
  return true;
}

export async function getAccount(id: string): Promise<Account | undefined> {
  const accounts = await readAccounts();
  return accounts.find((a) => a.id === id);
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/0612-trading/lib/account-store.ts
git commit -m "feat(trading): add accounts.yaml store"
```

---

## Task 7: lib/exchanges — 交易所签名适配器

**Files:**
- Create: `pages/0612-trading/lib/exchanges/types.ts`
- Create: `pages/0612-trading/lib/exchanges/index.ts`
- Create: `pages/0612-trading/lib/exchanges/binance.ts`
- Create: `pages/0612-trading/lib/exchanges/okx.ts`

- [ ] **Step 1: 创建 Exchange 接口**

```typescript
// lib/exchanges/types.ts
import type { ExchangeId, Position } from "../types";

export interface Credentials {
  api_key: string;
  secret: string;
  passphrase?: string;
}

export interface OrderParams {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  quantity: number;
  price?: number;
}

export interface OrderResponse {
  order_id: string;
  status: "filled" | "partial_filled" | "rejected" | "expired";
  filled_price: number;
  filled_quantity: number;
  fee: number;
  fee_asset: string;
  error?: string;
}

export interface BalanceInfo {
  balances: Record<string, number>;
}

export interface Exchange {
  id: ExchangeId;
  name: string;
  placeOrder(creds: Credentials, params: OrderParams): Promise<OrderResponse>;
  cancelOrder(creds: Credentials, orderId: string, symbol: string): Promise<boolean>;
  getBalance(creds: Credentials): Promise<BalanceInfo>;
  getPositions(creds: Credentials, symbols?: string[]): Promise<Position[]>;
  testConnection(creds: Credentials): Promise<{ ok: boolean; error?: string }>;
}
```

- [ ] **Step 2: 实现 Binance 适配器**

```typescript
// lib/exchanges/binance.ts
import { createHmac } from "node:crypto";
import type { Credentials, Exchange, OrderParams, OrderResponse, BalanceInfo } from "./types";
import type { Position } from "../types";

const BASE_URL = "https://api.binance.com";

function sign(queryString: string, secret: string): string {
  return createHmac("sha256", secret).update(queryString).digest("hex");
}

async function request(
  method: string,
  path: string,
  creds: Credentials,
  params: Record<string, string> = {}
): Promise<unknown> {
  const timestamp = Date.now().toString();
  const allParams = { ...params, timestamp, recvWindow: "5000" };
  const queryString = new URLSearchParams(allParams).toString();
  const signature = sign(queryString, creds.secret);
  const url = `${BASE_URL}${path}?${queryString}&signature=${signature}`;

  const res = await fetch(url, {
    method,
    headers: { "X-MBX-APIKEY": creds.api_key },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Binance API error ${res.status}: ${body}`);
  }

  return res.json();
}

export const binance: Exchange = {
  id: "binance",
  name: "Binance",

  async placeOrder(creds, params) {
    const body: Record<string, string> = {
      symbol: params.symbol,
      side: params.side.toUpperCase(),
      type: params.type.toUpperCase(),
      quantity: params.quantity.toString(),
    };
    if (params.type === "limit" && params.price) {
      body.price = params.price.toString();
      body.timeInForce = "GTC";
    }

    const data = (await request("POST", "/api/v3/order", creds, body)) as {
      orderId: number;
      status: string;
      fills: Array<{ price: string; qty: string; commission: string; commissionAsset: string }>;
    };

    const fills = data.fills ?? [];
    const filledQty = fills.reduce((s, f) => s + parseFloat(f.qty), 0);
    const filledPrice = fills.length > 0
      ? fills.reduce((s, f) => s + parseFloat(f.price) * parseFloat(f.qty), 0) / filledQty
      : 0;
    const fee = fills.reduce((s, f) => s + parseFloat(f.commission), 0);
    const feeAsset = fills[0]?.commissionAsset ?? "USDT";

    return {
      order_id: data.orderId.toString(),
      status: data.status === "FILLED" ? "filled" : "partial_filled",
      filled_price: filledPrice,
      filled_quantity: filledQty,
      fee,
      fee_asset: feeAsset,
    };
  },

  async cancelOrder(creds, orderId, symbol) {
    try {
      await request("DELETE", "/api/v3/order", creds, { symbol, orderId });
      return true;
    } catch {
      return false;
    }
  },

  async getBalance(creds) {
    const data = (await request("GET", "/api/v3/account", creds)) as {
      balances: Array<{ asset: string; free: string }>;
    };
    const balances: Record<string, number> = {};
    for (const b of data.balances) {
      const free = parseFloat(b.free);
      if (free > 0) balances[b.asset] = free;
    }
    return { balances };
  },

  async getPositions(creds, symbols) {
    // Spot 不支持持仓概念，返回非零余额作为 "持仓"
    const { balances } = await this.getBalance(creds);
    const positions: Position[] = [];
    for (const [asset, qty] of Object.entries(balances)) {
      if (asset === "USDT" || asset === "BUSD") continue;
      if (symbols && !symbols.some((s) => s.startsWith(asset))) continue;
      positions.push({
        symbol: `${asset}USDT`,
        side: "long",
        quantity: qty,
        entry_price: 0,
        entry_time: new Date().toISOString(),
      });
    }
    return positions;
  },

  async testConnection(creds) {
    try {
      await request("GET", "/api/v3/account", creds);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};
```

- [ ] **Step 3: 实现 OKX 适配器（最小版本）**

```typescript
// lib/exchanges/okx.ts
import { createHmac } from "node:crypto";
import type { Credentials, Exchange, OrderParams, OrderResponse, BalanceInfo } from "./types";
import type { Position } from "../types";

const BASE_URL = "https://www.okx.com";

function signOkx(timestamp: string, method: string, path: string, body: string, secret: string): string {
  const prehash = timestamp + method + path + body;
  return createHmac("sha256", secret).update(prehash).digest("base64");
}

async function request(
  method: string,
  path: string,
  creds: Credentials,
  body?: unknown
): Promise<unknown> {
  const timestamp = new Date().toISOString();
  const bodyStr = body ? JSON.stringify(body) : "";
  const signature = signOkx(timestamp, method, path, bodyStr, creds.secret);

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "OK-ACCESS-KEY": creds.api_key,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": creds.passphrase ?? "",
      "Content-Type": "application/json",
    },
    body: bodyStr || undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OKX API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { code: string; msg: string; data: unknown };
  if (data.code !== "0") throw new Error(`OKX: ${data.msg}`);
  return data.data;
}

export const okx: Exchange = {
  id: "okx",
  name: "OKX",

  async placeOrder(creds, params) {
    const body = {
      instId: params.symbol.replace("USDT", "-USDT"),
      tdMode: "cash",
      side: params.side,
      ordType: params.type === "market" ? "market" : "limit",
      sz: params.quantity.toString(),
      px: params.price?.toString(),
    };

    const data = (await request("POST", "/api/v5/trade/order", creds, body)) as Array<{
      ordId: string;
      sCode: string;
      sMsg: string;
    }>;

    const result = data[0];
    return {
      order_id: result.ordId,
      status: result.sCode === "0" ? "filled" as const : "rejected" as const,
      filled_price: params.price ?? 0,
      filled_quantity: params.quantity,
      fee: 0,
      fee_asset: "USDT",
      error: result.sCode !== "0" ? result.sMsg : undefined,
    };
  },

  async cancelOrder(creds, orderId, symbol) {
    try {
      await request("POST", "/api/v5/trade/cancel-order", creds, {
        instId: symbol.replace("USDT", "-USDT"),
        ordId: orderId,
      });
      return true;
    } catch {
      return false;
    }
  },

  async getBalance(creds) {
    const data = (await request("GET", "/api/v5/account/balance", creds)) as Array<{
      details: Array<{ ccy: string; availBal: string }>;
    }>;
    const balances: Record<string, number> = {};
    for (const detail of data[0]?.details ?? []) {
      const val = parseFloat(detail.availBal);
      if (val > 0) balances[detail.ccy] = val;
    }
    return { balances };
  },

  async getPositions(creds) {
    const data = (await request("GET", "/api/v5/account/positions", creds)) as Array<{
      instId: string;
      posSide: string;
      pos: string;
      avgPx: string;
      cTime: string;
    }>;
    return (data ?? []).map((p) => ({
      symbol: p.instId.replace("-", ""),
      side: (p.posSide === "short" ? "short" : "long") as "long" | "short",
      quantity: parseFloat(p.pos),
      entry_price: parseFloat(p.avgPx),
      entry_time: new Date(parseInt(p.cTime)).toISOString(),
    }));
  },

  async testConnection(creds) {
    try {
      await request("GET", "/api/v5/account/balance", creds);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};
```

- [ ] **Step 4: 创建工厂 index**

```typescript
// lib/exchanges/index.ts
import type { Exchange } from "./types";
import type { ExchangeId } from "../types";
import { binance } from "./binance";
import { okx } from "./okx";

const exchanges: Record<string, Exchange> = { binance, okx };

export function getExchange(id: ExchangeId): Exchange {
  const ex = exchanges[id];
  if (!ex) throw new Error(`Exchange "${id}" not supported`);
  return ex;
}

export function listExchanges(): ExchangeId[] {
  return Object.keys(exchanges) as ExchangeId[];
}

export type { Exchange, Credentials, OrderParams, OrderResponse, BalanceInfo } from "./types";
```

- [ ] **Step 5: Commit**

```bash
git add pages/0612-trading/lib/exchanges/
git commit -m "feat(trading): add exchange adapters (binance, okx)"
```

---

## Task 8: lib/order.ts + lib/sync.ts — 下单与同步

**Files:**
- Create: `pages/0612-trading/lib/order.ts`
- Create: `pages/0612-trading/lib/sync.ts`

- [ ] **Step 1: 实现下单逻辑**

```typescript
// lib/order.ts
import { nanoid } from "nanoid";
import { getExchange } from "./exchanges";
import type { OrderParams } from "./exchanges/types";
import { getAccount } from "./account-store";
import { appendEvent, readAllEvents } from "./session-store";
import type { OrderSubmitEvent, OrderResultEvent, SessionInitEvent } from "./types";

export async function executeOrder(
  sessionId: string,
  params: OrderParams & { source?: "agent" | "manual" }
): Promise<OrderResultEvent> {
  // 从 session 获取 account_id
  const events = await readAllEvents(sessionId);
  const initEvent = events.find((e) => e.type === "session_init") as SessionInitEvent | undefined;
  if (!initEvent) throw new Error("Session not initialized");

  const account = await getAccount(initEvent.account_id);
  if (!account) throw new Error(`Account ${initEvent.account_id} not found`);

  const exchange = getExchange(account.exchange);
  const orderId = `ord_${nanoid(8)}`;
  const cycle = events.filter((e) => "cycle" in e).reduce((max, e) => Math.max(max, (e as { cycle: number }).cycle), 0);

  // 记录提交
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

  // 执行
  const creds = { api_key: account.api_key, secret: account.secret, passphrase: account.passphrase };
  const response = await exchange.placeOrder(creds, params);

  // 记录结果
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
```

- [ ] **Step 2: 实现账户同步**

```typescript
// lib/sync.ts
import { getExchange } from "./exchanges";
import { getAccount } from "./account-store";
import type { Position } from "./types";

export async function syncAccountState(accountId: string): Promise<{
  balances: Record<string, number>;
  positions: Position[];
  nav: number;
}> {
  const account = await getAccount(accountId);
  if (!account) throw new Error(`Account ${accountId} not found`);

  const exchange = getExchange(account.exchange);
  const creds = { api_key: account.api_key, secret: account.secret, passphrase: account.passphrase };

  const [balanceInfo, positions] = await Promise.all([
    exchange.getBalance(creds),
    exchange.getPositions(creds),
  ]);

  // 简单 NAV 计算：余额总和 + 持仓价值
  const balanceTotal = Object.values(balanceInfo.balances).reduce((s, v) => s + v, 0);
  const positionValue = positions.reduce(
    (s, p) => s + p.quantity * (p.current_price ?? p.entry_price),
    0
  );

  return {
    balances: balanceInfo.balances,
    positions,
    nav: balanceTotal + positionValue,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add pages/0612-trading/lib/order.ts pages/0612-trading/lib/sync.ts
git commit -m "feat(trading): add order execution and account sync"
```

---

## Task 9: Server Actions

**Files:**
- Create: `pages/0612-trading/app/actions/order.ts`
- Create: `pages/0612-trading/app/actions/cancel.ts`
- Create: `pages/0612-trading/app/actions/session-control.ts`
- Create: `pages/0612-trading/app/actions/create-session.ts`
- Create: `pages/0612-trading/app/actions/account-manage.ts`

- [ ] **Step 1: 下单 Action**

```typescript
// app/actions/order.ts
"use server";

import { executeOrder } from "@/lib/order";
import { revalidatePath } from "next/cache";

export async function submitOrder(sessionId: string, formData: FormData) {
  const symbol = formData.get("symbol") as string;
  const side = formData.get("side") as "buy" | "sell";
  const type = formData.get("type") as "market" | "limit";
  const quantity = parseFloat(formData.get("quantity") as string);
  const priceStr = formData.get("price") as string | null;
  const price = priceStr ? parseFloat(priceStr) : undefined;

  const result = await executeOrder(sessionId, {
    symbol,
    side,
    type,
    quantity,
    price,
    source: "manual",
  });

  revalidatePath("/");
  return result;
}
```

- [ ] **Step 2: 撤单 Action**

```typescript
// app/actions/cancel.ts
"use server";

import { readAllEvents, appendEvent } from "@/lib/session-store";
import { getAccount } from "@/lib/account-store";
import { getExchange } from "@/lib/exchanges";
import { revalidatePath } from "next/cache";
import type { SessionInitEvent, OrderCancelEvent } from "@/lib/types";

export async function cancelOrder(sessionId: string, orderId: string, symbol: string) {
  const events = await readAllEvents(sessionId);
  const initEvent = events.find((e) => e.type === "session_init") as SessionInitEvent | undefined;
  if (!initEvent) throw new Error("Session not initialized");

  const account = await getAccount(initEvent.account_id);
  if (!account) throw new Error("Account not found");

  const exchange = getExchange(account.exchange);
  const creds = { api_key: account.api_key, secret: account.secret, passphrase: account.passphrase };

  const success = await exchange.cancelOrder(creds, orderId, symbol);

  const cancelEvent: OrderCancelEvent = {
    type: "order_cancel",
    ts: new Date().toISOString(),
    order_id: orderId,
    source: "manual",
    reason: success ? "user_cancelled" : "cancel_failed",
  };
  await appendEvent(sessionId, cancelEvent);

  revalidatePath("/");
  return { success };
}
```

- [ ] **Step 3: 会话控制 Actions**

```typescript
// app/actions/session-control.ts
"use server";

import { appendEvent, readAllEvents } from "@/lib/session-store";
import { syncAccountState } from "@/lib/sync";
import { restoreSessionState } from "@/lib/state-machine";
import { revalidatePath } from "next/cache";
import type { SessionPauseEvent, SessionResumeEvent, SessionEndEvent, SessionInitEvent } from "@/lib/types";

export async function pauseSession(sessionId: string) {
  const state = await restoreSessionState(sessionId);
  const event: SessionPauseEvent = {
    type: "session_pause",
    ts: new Date().toISOString(),
    reason: "user_manual",
    last_cycle: state.current_cycle,
    current_nav: state.metrics.nav,
  };
  await appendEvent(sessionId, event);
  revalidatePath("/");
}

export async function resumeSession(sessionId: string) {
  const state = await restoreSessionState(sessionId);
  const synced = await syncAccountState(state.account_id);

  const event: SessionResumeEvent = {
    type: "session_resume",
    ts: new Date().toISOString(),
    resume_from_cycle: state.current_cycle,
    synced_balance: synced.balances,
    synced_positions: synced.positions,
    synced_nav: synced.nav,
    drift_detected: detectDrift(state.metrics.available_balance, synced.balances),
  };
  await appendEvent(sessionId, event);
  revalidatePath("/");
}

export async function stopSession(sessionId: string) {
  const state = await restoreSessionState(sessionId);
  const initialNav = Object.values(state.initial_balance).reduce((s, v) => s + v, 0);
  const duration = state.nav_history.length > 0
    ? (Date.now() - new Date(state.nav_history[0].ts).getTime()) / 3600000
    : 0;

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
      best_trade: findBestTrade(state.trades),
      worst_trade: findWorstTrade(state.trades),
      total_fees: state.metrics.total_fees,
    },
  };
  await appendEvent(sessionId, event);
  revalidatePath("/");
}

function detectDrift(local: Record<string, number>, synced: Record<string, number>) {
  const diff: Record<string, number> = {};
  const allKeys = new Set([...Object.keys(local), ...Object.keys(synced)]);
  let hasDrift = false;
  for (const key of allKeys) {
    const d = (synced[key] ?? 0) - (local[key] ?? 0);
    if (Math.abs(d) > 0.0001) {
      diff[key] = d;
      hasDrift = true;
    }
  }
  return hasDrift ? { balance_diff: diff, position_diff: "Balance mismatch detected" } : undefined;
}

function findBestTrade(trades: { symbol: string; realized_pnl?: number }[]) {
  const closed = trades.filter((t) => t.realized_pnl !== undefined);
  if (closed.length === 0) return { symbol: "-", pnl: 0, pnl_pct: 0 };
  const best = closed.reduce((a, b) => ((a.realized_pnl ?? 0) > (b.realized_pnl ?? 0) ? a : b));
  return { symbol: best.symbol, pnl: best.realized_pnl ?? 0, pnl_pct: 0 };
}

function findWorstTrade(trades: { symbol: string; realized_pnl?: number }[]) {
  const closed = trades.filter((t) => t.realized_pnl !== undefined);
  if (closed.length === 0) return { symbol: "-", pnl: 0, pnl_pct: 0 };
  const worst = closed.reduce((a, b) => ((a.realized_pnl ?? 0) < (b.realized_pnl ?? 0) ? a : b));
  return { symbol: worst.symbol, pnl: worst.realized_pnl ?? 0, pnl_pct: 0 };
}
```

- [ ] **Step 4: 创建会话 Action**

```typescript
// app/actions/create-session.ts
"use server";

import { generateSessionId, appendEvent } from "@/lib/session-store";
import { syncAccountState } from "@/lib/sync";
import { revalidatePath } from "next/cache";
import type { ExchangeId, SessionInitEvent } from "@/lib/types";

export async function createSession(formData: FormData) {
  const sessionName = formData.get("session_name") as string;
  const accountId = formData.get("account_id") as string;
  const exchange = formData.get("exchange") as ExchangeId;
  const model = formData.get("model") as string;
  const strategyName = formData.get("strategy_name") as string;
  const strategyDescription = formData.get("strategy_description") as string || "";
  const riskLevel = (formData.get("risk_level") as "low" | "medium" | "high") || "medium";
  const symbols = (formData.get("symbols") as string).split(",").map((s) => s.trim());
  const intervalMinutes = parseInt(formData.get("interval_minutes") as string) || 60;
  const maxPositionPct = parseFloat(formData.get("max_position_pct") as string) || 0.5;

  const sessionId = generateSessionId();

  // 同步初始余额
  const synced = await syncAccountState(accountId);

  const event: SessionInitEvent = {
    type: "session_init",
    ts: new Date().toISOString(),
    session_id: sessionId,
    session_name: sessionName,
    account_id: accountId,
    exchange,
    initial_balance: synced.balances,
    agent_config: {
      model,
      strategy_name: strategyName,
      strategy_description: strategyDescription,
      risk_level: riskLevel,
      symbols,
      interval_minutes: intervalMinutes,
      max_position_pct: maxPositionPct,
    },
    tags: [exchange, model, riskLevel],
  };

  await appendEvent(sessionId, event);
  revalidatePath("/");
  return { session_id: sessionId };
}
```

- [ ] **Step 5: 账户管理 Actions**

```typescript
// app/actions/account-manage.ts
"use server";

import { addAccount, removeAccount, readAccounts, getAccount } from "@/lib/account-store";
import { getExchange } from "@/lib/exchanges";
import { revalidatePath } from "next/cache";
import type { ExchangeId } from "@/lib/types";

export async function addAccountAction(formData: FormData) {
  const exchange = formData.get("exchange") as ExchangeId;
  const name = formData.get("name") as string;
  const apiKey = formData.get("api_key") as string;
  const secret = formData.get("secret") as string;
  const passphrase = formData.get("passphrase") as string | null;

  const account = await addAccount({
    exchange,
    name,
    api_key: apiKey,
    secret,
    passphrase: passphrase || undefined,
  });

  revalidatePath("/");
  return account;
}

export async function removeAccountAction(id: string) {
  const success = await removeAccount(id);
  revalidatePath("/");
  return { success };
}

export async function testAccountAction(id: string) {
  const account = await getAccount(id);
  if (!account) return { ok: false, error: "Account not found" };

  const exchange = getExchange(account.exchange);
  const creds = { api_key: account.api_key, secret: account.secret, passphrase: account.passphrase };
  return exchange.testConnection(creds);
}

export async function listAccountsAction() {
  return readAccounts();
}
```

- [ ] **Step 6: Commit**

```bash
git add pages/0612-trading/app/actions/
git commit -m "feat(trading): add server actions (order, session, account)"
```

---

## Task 10: Route Handlers — 外部 API

**Files:**
- Create: `pages/0612-trading/app/api/sessions/route.ts`
- Create: `pages/0612-trading/app/api/sessions/[id]/route.ts`
- Create: `pages/0612-trading/app/api/sessions/[id]/events/route.ts`
- Create: `pages/0612-trading/app/api/sessions/[id]/order/route.ts`
- Create: `pages/0612-trading/app/api/sessions/[id]/control/route.ts`
- Create: `pages/0612-trading/app/api/accounts/route.ts`
- Create: `pages/0612-trading/app/api/accounts/[id]/route.ts`
- Create: `pages/0612-trading/app/api/accounts/[id]/test/route.ts`

- [ ] **Step 1: Sessions 列表 / 创建**

```typescript
// app/api/sessions/route.ts
import { listSessions } from "@/lib/session-store";
import { restoreSessionState } from "@/lib/state-machine";
import { NextResponse } from "next/server";

export async function GET() {
  const ids = await listSessions();
  const sessions = await Promise.all(
    ids.map(async (id) => {
      const state = await restoreSessionState(id);
      return {
        id,
        name: state.session_name,
        status: state.status,
        exchange: state.exchange,
        nav: state.metrics.nav,
        pnl_pct: state.metrics.total_pnl_pct,
        current_cycle: state.current_cycle,
      };
    })
  );
  return NextResponse.json({ sessions });
}
```

- [ ] **Step 2: Session 状态 + 事件增量读 / 追加**

```typescript
// app/api/sessions/[id]/route.ts
import { restoreSessionState } from "@/lib/state-machine";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await restoreSessionState(id);
  return NextResponse.json(state);
}
```

```typescript
// app/api/sessions/[id]/events/route.ts
import { readEventsFrom, appendEvent, countLines } from "@/lib/session-store";
import { NextResponse } from "next/server";
import type { SessionEvent } from "@/lib/types";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const fromLine = parseInt(url.searchParams.get("from_line") ?? "0");
  const events = await readEventsFrom(id, fromLine);
  const total = await countLines(id);
  return NextResponse.json({ events, total_lines: total });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = (await req.json()) as SessionEvent;
  await appendEvent(id, event);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: 下单 + 控制 Route Handlers**

```typescript
// app/api/sessions/[id]/order/route.ts
import { executeOrder } from "@/lib/order";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const result = await executeOrder(id, {
    symbol: body.symbol,
    side: body.side,
    type: body.type ?? "market",
    quantity: body.quantity,
    price: body.price,
    source: body.source ?? "agent",
  });
  return NextResponse.json(result);
}
```

```typescript
// app/api/sessions/[id]/control/route.ts
import { pauseSession, resumeSession, stopSession } from "@/app/actions/session-control";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = await req.json();

  switch (action) {
    case "pause":
      await pauseSession(id);
      break;
    case "resume":
      await resumeSession(id);
      break;
    case "stop":
      await stopSession(id);
      break;
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: 账户 Route Handlers**

```typescript
// app/api/accounts/route.ts
import { readAccounts, addAccount } from "@/lib/account-store";
import { NextResponse } from "next/server";
import type { ExchangeId } from "@/lib/types";

export async function GET() {
  const accounts = await readAccounts();
  // 不暴露 secret
  const safe = accounts.map(({ secret, ...rest }) => ({ ...rest, secret: "***" }));
  return NextResponse.json({ accounts: safe });
}

export async function POST(req: Request) {
  const body = await req.json();
  const account = await addAccount({
    exchange: body.exchange as ExchangeId,
    name: body.name,
    api_key: body.api_key,
    secret: body.secret,
    passphrase: body.passphrase,
  });
  return NextResponse.json(account);
}
```

```typescript
// app/api/accounts/[id]/route.ts
import { removeAccount } from "@/lib/account-store";
import { NextResponse } from "next/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const success = await removeAccount(id);
  return NextResponse.json({ success });
}
```

```typescript
// app/api/accounts/[id]/test/route.ts
import { getAccount } from "@/lib/account-store";
import { getExchange } from "@/lib/exchanges";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const exchange = getExchange(account.exchange);
  const result = await exchange.testConnection({
    api_key: account.api_key,
    secret: account.secret,
    passphrase: account.passphrase,
  });
  return NextResponse.json(result);
}
```

- [ ] **Step 5: Commit**

```bash
git add pages/0612-trading/app/api/
git commit -m "feat(trading): add route handlers for external API"
```

---

## Task 11: UI — Layout + 主页面（Server Component）

**Files:**
- Modify: `pages/0612-trading/app/layout.tsx`
- Modify: `pages/0612-trading/app/page.tsx`

- [ ] **Step 1: 完善 layout.tsx（字体 + 全局结构）**

```tsx
// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "Trading Terminal",
  description: "策略交易监控面板",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: 实现主页面（读取 session 状态 → 传给组件）**

```tsx
// app/page.tsx
import { restoreSessionState } from "@/lib/state-machine";
import { getLatestSessionId, listSessions } from "@/lib/session-store";
import { TopNav } from "./components/top-nav";
import { StatCards } from "./components/stat-cards";
import { ChartArea } from "./components/chart-area";
import { NavChart } from "./components/nav-chart";
import { DataTable } from "./components/data-table";
import { DecisionLog } from "./components/decision-log";
import { SessionSelector } from "./components/session-selector";

interface Props {
  searchParams: Promise<{ session?: string }>;
}

export default async function TradingPage({ searchParams }: Props) {
  const { session: sessionParam } = await searchParams;
  const sessionId = sessionParam ?? (await getLatestSessionId());
  const sessions = await listSessions();

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Trading Terminal</h1>
          <p className="text-slate-500 mb-6">还没有交易会话，创建一个开始吧。</p>
          <SessionSelector sessions={sessions} currentId={null} />
        </div>
      </div>
    );
  }

  const state = await restoreSessionState(sessionId);

  return (
    <div className="grid grid-cols-[1fr_380px] h-screen overflow-hidden">
      {/* 左侧主内容 */}
      <main className="flex flex-col overflow-hidden">
        <TopNav
          sessionName={state.session_name}
          status={state.status}
          tags={state.tags}
          sessionId={sessionId}
        />
        <StatCards metrics={state.metrics} initialBalance={state.initial_balance} />
        <div className="flex-1 min-h-0 flex flex-col">
          <ChartArea
            sessionId={sessionId}
            symbols={state.agent_config.symbols}
            exchange={state.exchange}
          />
          <DataTable
            positions={state.positions}
            trades={state.trades}
            sessionId={sessionId}
          />
        </div>
      </main>

      {/* 右侧决策日志 */}
      <aside className="border-l border-slate-200 flex flex-col overflow-hidden">
        <DecisionLog
          sessionId={sessionId}
          initialDecisions={state.decisions}
        />
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add pages/0612-trading/app/layout.tsx pages/0612-trading/app/page.tsx
git commit -m "feat(trading): implement main page server component"
```

---

## Task 12: UI — TopNav 组件

**Files:**
- Create: `pages/0612-trading/app/components/top-nav.tsx`

- [ ] **Step 1: 实现顶部导航栏**

```tsx
// app/components/top-nav.tsx
"use client";

import { pauseSession, resumeSession, stopSession } from "@/app/actions/session-control";
import type { SessionStatus } from "@/lib/types";
import { useTransition } from "react";

interface TopNavProps {
  sessionName: string;
  status: SessionStatus;
  tags: string[];
  sessionId: string;
}

export function TopNav({ sessionName, status, tags, sessionId }: TopNavProps) {
  const [isPending, startTransition] = useTransition();

  const statusColor = {
    running: "bg-green-500",
    paused: "bg-yellow-500",
    ended: "bg-gray-400",
  }[status];

  const statusLabel = {
    running: "运行中",
    paused: "已暂停",
    ended: "已停止",
  }[status];

  function handlePause() {
    startTransition(() => pauseSession(sessionId));
  }

  function handleResume() {
    startTransition(() => resumeSession(sessionId));
  }

  function handleStop() {
    if (confirm("确认停止该策略？停止后无法恢复。")) {
      startTransition(() => stopSession(sessionId));
    }
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-4">
        {/* 策略名 */}
        <h1 className="text-lg font-semibold">{sessionName}</h1>

        {/* 标签 */}
        <div className="flex gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* 状态 */}
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${statusColor} ${status === "running" ? "animate-pulse" : ""}`} />
          <span className="text-sm text-slate-500">{statusLabel}</span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        {status === "running" && (
          <button
            onClick={handlePause}
            disabled={isPending}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            暂停
          </button>
        )}
        {status === "paused" && (
          <button
            onClick={handleResume}
            disabled={isPending}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            恢复
          </button>
        )}
        {status !== "ended" && (
          <button
            onClick={handleStop}
            disabled={isPending}
            className="px-3 py-1.5 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            停止
          </button>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/0612-trading/app/components/top-nav.tsx
git commit -m "feat(trading): add TopNav component"
```

---

## Task 13: UI — StatCards 统计卡片

**Files:**
- Create: `pages/0612-trading/app/components/stat-cards.tsx`

- [ ] **Step 1: 实现统计卡片行**

```tsx
// app/components/stat-cards.tsx
import type { SessionMetrics } from "@/lib/types";

interface StatCardsProps {
  metrics: SessionMetrics;
  initialBalance: Record<string, number>;
}

export function StatCards({ metrics, initialBalance }: StatCardsProps) {
  const initialNav = Object.values(initialBalance).reduce((s, v) => s + v, 0);
  const totalBalance = Object.values(metrics.available_balance).reduce((s, v) => s + v, 0);

  const cards = [
    {
      label: "胜率",
      value: `${(metrics.win_rate * 100).toFixed(2)}%`,
      sub: `${metrics.win_count} 盈 ${metrics.loss_count} 亏`,
      color: metrics.win_rate >= 0.5 ? "text-gain" : "text-loss",
    },
    {
      label: "交易盈亏",
      value: `${metrics.total_pnl >= 0 ? "+" : ""}$${metrics.total_pnl.toFixed(4)}`,
      sub: `初始: $${initialNav.toFixed(2)}`,
      color: metrics.total_pnl >= 0 ? "text-gain" : "text-loss",
    },
    {
      label: "NAV 收益率",
      value: `${metrics.total_pnl_pct >= 0 ? "+" : ""}${metrics.total_pnl_pct.toFixed(2)}%`,
      sub: `回撤: ${(metrics.max_drawdown_pct * 100).toFixed(2)}%`,
      color: metrics.total_pnl_pct >= 0 ? "text-gain" : "text-loss",
    },
    {
      label: "持仓",
      value: `${(metrics.position_pct * 100).toFixed(2)}%`,
      sub: `${metrics.total_trades} 笔交易`,
      color: "text-slate-900",
    },
    {
      label: "可用余额",
      value: `$${totalBalance.toFixed(2)}`,
      sub: `夏普: ${metrics.sharpe_ratio.toFixed(2)}`,
      color: "text-slate-900",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 px-6 py-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">{card.label}</p>
          <p className={`text-xl font-semibold ${card.color}`}>{card.value}</p>
          <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/0612-trading/app/components/stat-cards.tsx
git commit -m "feat(trading): add StatCards component"
```

---

## Task 14: UI — ChartArea（TradingView K 线）

**Files:**
- Create: `pages/0612-trading/app/components/chart-area.tsx`

- [ ] **Step 1: 实现 TradingView K 线组件**

```tsx
// app/components/chart-area.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { ExchangeId } from "@/lib/types";

interface ChartAreaProps {
  sessionId: string;
  symbols: string[];
  exchange: ExchangeId;
}

export function ChartArea({ sessionId, symbols, exchange }: ChartAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"nav" | "kline">("kline");
  const [selectedSymbol, setSelectedSymbol] = useState(symbols[0] ?? "BTCUSDT");

  useEffect(() => {
    if (activeTab !== "kline" || !containerRef.current) return;

    // 清空容器
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `${exchange.toUpperCase()}:${selectedSymbol}`,
      interval: "60",
      timezone: "Asia/Shanghai",
      theme: "light",
      style: "1",
      locale: "zh_CN",
      toolbar_bg: "#f1f3f6",
      enable_publishing: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      studies: ["RSI@tv-basicstudies", "MACD@tv-basicstudies"],
      container_id: "tradingview-chart",
    });

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";

    const inner = document.createElement("div");
    inner.id = "tradingview-chart";
    inner.style.height = "100%";
    inner.style.width = "100%";

    wrapper.appendChild(inner);
    wrapper.appendChild(script);
    containerRef.current.appendChild(wrapper);
  }, [activeTab, selectedSymbol, exchange]);

  return (
    <div className="flex-1 min-h-0 flex flex-col border-b border-slate-200">
      {/* Tab 切换 + symbol 选择 */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("kline")}
            className={`text-sm pb-1 ${activeTab === "kline" ? "text-primary border-b-2 border-primary font-medium" : "text-slate-500"}`}
          >
            行情图表
          </button>
          <button
            onClick={() => setActiveTab("nav")}
            className={`text-sm pb-1 ${activeTab === "nav" ? "text-primary border-b-2 border-primary font-medium" : "text-slate-500"}`}
          >
            净值曲线
          </button>
        </div>

        {activeTab === "kline" && symbols.length > 1 && (
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="text-sm border border-slate-200 rounded px-2 py-1"
          >
            {symbols.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {/* 图表内容 */}
      <div className="flex-1 min-h-0">
        {activeTab === "kline" ? (
          <div ref={containerRef} className="h-full w-full" />
        ) : (
          <NavChartPlaceholder sessionId={sessionId} />
        )}
      </div>
    </div>
  );
}

function NavChartPlaceholder({ sessionId }: { sessionId: string }) {
  return (
    <div className="h-full flex items-center justify-center text-slate-400">
      <p>净值曲线（基于 account_snapshot.nav 数据绘制）</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/0612-trading/app/components/chart-area.tsx
git commit -m "feat(trading): add TradingView chart component"
```

---

## Task 15: UI — NavChart 净值曲线

**Files:**
- Create: `pages/0612-trading/app/components/nav-chart.tsx`

- [ ] **Step 1: 实现净值曲线（Canvas 绘制）**

```tsx
// app/components/nav-chart.tsx
"use client";

import { useEffect, useRef } from "react";
import type { NavPoint } from "@/lib/types";

interface NavChartProps {
  navHistory: NavPoint[];
  initialNav: number;
}

export function NavChart({ navHistory, initialNav }: NavChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || navHistory.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 60 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const values = navHistory.map((p) => p.nav);
    const min = Math.min(...values) * 0.998;
    const max = Math.max(...values) * 1.002;
    const range = max - min || 1;

    ctx.clearRect(0, 0, w, h);

    // 绘制面积图
    ctx.beginPath();
    navHistory.forEach((point, i) => {
      const x = padding.left + (i / (navHistory.length - 1)) * chartW;
      const y = padding.top + (1 - (point.nav - min) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // 线
    ctx.strokeStyle = "#0891B2";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 面积填充
    const lastX = padding.left + chartW;
    ctx.lineTo(lastX, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.closePath();

    const latestNav = values[values.length - 1];
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    if (latestNav >= initialNav) {
      gradient.addColorStop(0, "rgba(22, 163, 74, 0.15)");
      gradient.addColorStop(1, "rgba(22, 163, 74, 0)");
    } else {
      gradient.addColorStop(0, "rgba(220, 38, 38, 0.15)");
      gradient.addColorStop(1, "rgba(220, 38, 38, 0)");
    }
    ctx.fillStyle = gradient;
    ctx.fill();

    // Y 轴标签
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const val = min + (range * i) / 4;
      const y = padding.top + (1 - i / 4) * chartH;
      ctx.fillText(`$${val.toFixed(2)}`, padding.left - 8, y + 4);
    }
  }, [navHistory, initialNav]);

  if (navHistory.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <p>等待数据积累...</p>
      </div>
    );
  }

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/0612-trading/app/components/nav-chart.tsx
git commit -m "feat(trading): add NAV chart canvas component"
```

---

## Task 16: UI — DataTable 数据表格

**Files:**
- Create: `pages/0612-trading/app/components/data-table.tsx`

- [ ] **Step 1: 实现底部多 Tab 数据表格**

```tsx
// app/components/data-table.tsx
"use client";

import { useState } from "react";
import type { Position, TradeRecord } from "@/lib/types";
import { OrderDialog } from "./order-dialog";

interface DataTableProps {
  positions: Position[];
  trades: TradeRecord[];
  sessionId: string;
}

type TabId = "positions" | "orders" | "history" | "all";

export function DataTable({ positions, trades, sessionId }: DataTableProps) {
  const [activeTab, setActiveTab] = useState<TabId>("positions");
  const [showOrderDialog, setShowOrderDialog] = useState(false);

  const tabs: { id: TabId; label: string }[] = [
    { id: "positions", label: `当前持仓 (${positions.length})` },
    { id: "history", label: `历史成交 (${trades.length})` },
    { id: "all", label: "订单记录" },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Tab 行 + 开仓按钮 */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-sm pb-1 ${activeTab === tab.id ? "text-primary border-b-2 border-primary font-medium" : "text-slate-500"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowOrderDialog(true)}
          className="px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-cyan-700"
        >
          手动开仓
        </button>
      </div>

      {/* 表格内容 */}
      <div className="flex-1 overflow-auto px-6 py-2">
        {activeTab === "positions" && <PositionsTable positions={positions} />}
        {activeTab === "history" && <TradesTable trades={trades} />}
        {activeTab === "all" && <TradesTable trades={trades} />}
      </div>

      {showOrderDialog && (
        <OrderDialog
          sessionId={sessionId}
          onClose={() => setShowOrderDialog(false)}
        />
      )}
    </div>
  );
}

function PositionsTable({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return <p className="text-sm text-slate-400 py-4">暂无持仓</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
          <th className="py-2 font-medium">币对</th>
          <th className="py-2 font-medium">方向</th>
          <th className="py-2 font-medium">数量</th>
          <th className="py-2 font-medium">开仓价</th>
          <th className="py-2 font-medium">当前价</th>
          <th className="py-2 font-medium">未实现盈亏</th>
          <th className="py-2 font-medium">止损/止盈</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((pos, i) => (
          <tr key={i} className="border-b border-slate-50">
            <td className="py-2 font-medium">{pos.symbol}</td>
            <td className="py-2">
              <span className={pos.side === "long" ? "text-gain" : "text-loss"}>
                {pos.side === "long" ? "多" : "空"}
              </span>
            </td>
            <td className="py-2">{pos.quantity}</td>
            <td className="py-2">{pos.entry_price.toFixed(2)}</td>
            <td className="py-2">{pos.current_price?.toFixed(2) ?? "-"}</td>
            <td className={`py-2 ${(pos.unrealized_pnl ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
              {pos.unrealized_pnl !== undefined ? `$${pos.unrealized_pnl.toFixed(4)}` : "-"}
            </td>
            <td className="py-2 text-xs text-slate-400">
              {pos.stop_loss ?? "-"} / {pos.take_profit ?? "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TradesTable({ trades }: { trades: TradeRecord[] }) {
  if (trades.length === 0) {
    return <p className="text-sm text-slate-400 py-4">暂无交易记录</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
          <th className="py-2 font-medium">币对</th>
          <th className="py-2 font-medium">方向</th>
          <th className="py-2 font-medium">价格</th>
          <th className="py-2 font-medium">数量</th>
          <th className="py-2 font-medium">手续费</th>
          <th className="py-2 font-medium">盈亏</th>
          <th className="py-2 font-medium">来源</th>
          <th className="py-2 font-medium">时间</th>
        </tr>
      </thead>
      <tbody>
        {[...trades].reverse().map((trade) => (
          <tr key={trade.order_id} className="border-b border-slate-50">
            <td className="py-2 font-medium">{trade.symbol}</td>
            <td className={`py-2 ${trade.side === "buy" ? "text-gain" : "text-loss"}`}>
              {trade.side === "buy" ? "买入" : "卖出"}
            </td>
            <td className="py-2">{trade.price.toFixed(2)}</td>
            <td className="py-2">{trade.quantity}</td>
            <td className="py-2 text-slate-500">${trade.fee.toFixed(4)}</td>
            <td className={`py-2 ${(trade.realized_pnl ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
              {trade.realized_pnl !== undefined ? `$${trade.realized_pnl.toFixed(4)}` : "-"}
            </td>
            <td className="py-2">
              <span className={`text-xs px-1.5 py-0.5 rounded ${trade.source === "agent" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-600"}`}>
                {trade.source === "agent" ? "AI" : "手动"}
              </span>
            </td>
            <td className="py-2 text-xs text-slate-400">
              {new Date(trade.ts).toLocaleString("zh-CN", { hour12: false })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/0612-trading/app/components/data-table.tsx
git commit -m "feat(trading): add DataTable component with tabs"
```

---

## Task 17: UI — OrderDialog 手动开仓

**Files:**
- Create: `pages/0612-trading/app/components/order-dialog.tsx`

- [ ] **Step 1: 实现下单对话框**

```tsx
// app/components/order-dialog.tsx
"use client";

import { useState, useTransition } from "react";
import { submitOrder } from "@/app/actions/order";

interface OrderDialogProps {
  sessionId: string;
  onClose: () => void;
}

export function OrderDialog({ sessionId, onClose }: OrderDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!quantity || parseFloat(quantity) <= 0) {
      setError("请输入有效数量");
      return;
    }

    const formData = new FormData();
    formData.set("symbol", symbol);
    formData.set("side", side);
    formData.set("type", type);
    formData.set("quantity", quantity);
    if (type === "limit" && price) {
      formData.set("price", price);
    }

    setError(null);
    startTransition(async () => {
      try {
        await submitOrder(sessionId, formData);
        onClose();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-[420px] p-6">
        <h2 className="text-lg font-semibold mb-4">手动开仓</h2>

        {/* 交易对 */}
        <div className="mb-4">
          <label className="text-sm text-slate-500 mb-1 block">交易对</label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
          />
        </div>

        {/* 方向 */}
        <div className="mb-4">
          <label className="text-sm text-slate-500 mb-1 block">方向</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSide("buy")}
              className={`flex-1 py-2 rounded-md text-sm font-medium ${side === "buy" ? "bg-gain text-white" : "border border-slate-200 text-slate-600"}`}
            >
              买入 (做多)
            </button>
            <button
              onClick={() => setSide("sell")}
              className={`flex-1 py-2 rounded-md text-sm font-medium ${side === "sell" ? "bg-loss text-white" : "border border-slate-200 text-slate-600"}`}
            >
              卖出 (做空)
            </button>
          </div>
        </div>

        {/* 类型 */}
        <div className="mb-4">
          <label className="text-sm text-slate-500 mb-1 block">类型</label>
          <div className="flex gap-2">
            <button
              onClick={() => setType("market")}
              className={`px-4 py-1.5 rounded-md text-sm ${type === "market" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"}`}
            >
              市价
            </button>
            <button
              onClick={() => setType("limit")}
              className={`px-4 py-1.5 rounded-md text-sm ${type === "limit" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"}`}
            >
              限价
            </button>
          </div>
        </div>

        {/* 限价价格 */}
        {type === "limit" && (
          <div className="mb-4">
            <label className="text-sm text-slate-500 mb-1 block">价格</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              step="any"
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              placeholder="限价价格"
            />
          </div>
        )}

        {/* 数量 */}
        <div className="mb-4">
          <label className="text-sm text-slate-500 mb-1 block">数量</label>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            type="number"
            step="any"
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
            placeholder="下单数量"
          />
        </div>

        {/* 错误 */}
        {error && (
          <p className="text-sm text-red-600 mb-4">{error}</p>
        )}

        {/* 按钮 */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {isPending ? "提交中..." : "确认下单"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/0612-trading/app/components/order-dialog.tsx
git commit -m "feat(trading): add OrderDialog component"
```

---

## Task 18: UI — DecisionLog 决策日志面板

**Files:**
- Create: `pages/0612-trading/app/components/decision-log.tsx`

- [ ] **Step 1: 实现右侧决策日志**

```tsx
// app/components/decision-log.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import type { DecisionEntry } from "@/lib/types";

interface DecisionLogProps {
  sessionId: string;
  initialDecisions: DecisionEntry[];
}

export function DecisionLog({ sessionId, initialDecisions }: DecisionLogProps) {
  const [decisions, setDecisions] = useState(initialDecisions);
  const [filter, setFilter] = useState<"all" | "order" | "hold" | "error">("all");
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // 轮询新事件
  useEffect(() => {
    let lineCount = 0;

    async function poll() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/events?from_line=${lineCount}`);
        const data = await res.json();
        if (data.events.length > 0) {
          lineCount = data.total_lines;
          const newDecisions = data.events
            .filter((e: { type: string }) => e.type === "agent_decision" || e.type === "agent_error")
            .map(mapEventToDecision);
          if (newDecisions.length > 0) {
            setDecisions((prev) => [...prev, ...newDecisions]);
          }
        }
      } catch {}
    }

    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, [sessionId]);

  const filtered = decisions.filter((d) => {
    if (filter === "all") return true;
    if (filter === "error") return !!d.error;
    if (filter === "hold") return d.action === "hold" && !d.error;
    return d.action === "order" || d.action === "close" || d.action === "close_all";
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold mb-2">最近决策</h2>
        <div className="flex gap-1">
          {(["all", "order", "hold", "error"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 text-xs rounded ${filter === f ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {{ all: "全部", order: "下单", hold: "观望", error: "失败" }[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Decision cards */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {[...filtered].reverse().map((d, i) => (
          <DecisionCard key={`${d.cycle}-${i}`} decision={d} />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 py-8 text-center">暂无决策记录</p>
        )}
      </div>
    </div>
  );
}

function DecisionCard({ decision }: { decision: DecisionEntry }) {
  const [expanded, setExpanded] = useState(false);
  const isError = !!decision.error;
  const time = new Date(decision.ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const actionLabel = {
    order: "📈 下单",
    hold: "⏸ 观望",
    close: "📉 平仓",
    close_all: "🔴 全部平仓",
  }[decision.action];

  return (
    <div className={`rounded-lg border ${isError ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"} text-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <span className="text-xs text-slate-400">{time} · 周期 #{decision.cycle}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${isError ? "bg-red-100 text-red-600" : "bg-green-50 text-green-600"}`}>
          {isError ? "失败" : "成功"}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        {isError ? (
          <p className="text-red-600 text-sm">⚠️ {decision.error}</p>
        ) : (
          <>
            <p className="font-medium mb-1">{actionLabel}</p>
            {decision.orders?.map((o, i) => (
              <p key={i} className="text-xs text-slate-600">
                {o.side === "buy" ? "买入" : "卖出"} {o.symbol} · 数量 {o.quantity}
                {o.price ? ` · 价格 ${o.price}` : ""}
              </p>
            ))}
            {decision.reasoning && (
              <p className="text-slate-600 mt-2 leading-relaxed">{decision.reasoning}</p>
            )}
            {decision.confidence > 0 && (
              <p className="text-xs text-slate-400 mt-1">置信度: {(decision.confidence * 100).toFixed(0)}%</p>
            )}
          </>
        )}
      </div>

      {/* Expandable */}
      {(decision.thinking_summary || decision.key_signals) && (
        <div className="px-3 py-2 border-t border-slate-100">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary hover:underline"
          >
            {expanded ? "▾ 收起" : "▸ 思考过程"}
          </button>
          {expanded && (
            <div className="mt-2 text-xs text-slate-500 space-y-1">
              {decision.thinking_summary && <p>{decision.thinking_summary}</p>}
              {decision.key_signals?.map((sig, i) => (
                <p key={i}>• {sig.indicator}: {sig.value} → {sig.interpretation}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function mapEventToDecision(event: Record<string, unknown>): DecisionEntry {
  if (event.type === "agent_error") {
    return {
      cycle: event.cycle as number,
      ts: event.ts as string,
      agent_session_id: event.agent_session_id as string,
      action: "hold",
      reasoning: "",
      confidence: 0,
      error: event.error as string,
      error_code: event.error_code as DecisionEntry["error_code"],
    };
  }
  return {
    cycle: event.cycle as number,
    ts: event.ts as string,
    agent_session_id: event.agent_session_id as string,
    action: event.action as DecisionEntry["action"],
    reasoning: event.reasoning as string,
    thinking_summary: event.thinking_summary as string | undefined,
    confidence: event.confidence as number,
    key_signals: event.key_signals as DecisionEntry["key_signals"],
    orders: event.orders as DecisionEntry["orders"],
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/0612-trading/app/components/decision-log.tsx
git commit -m "feat(trading): add DecisionLog panel component"
```

---

## Task 19: UI — SessionSelector 会话选择器

**Files:**
- Create: `pages/0612-trading/app/components/session-selector.tsx`

- [ ] **Step 1: 实现会话选择器**

```tsx
// app/components/session-selector.tsx
"use client";

import { useRouter } from "next/navigation";

interface SessionSelectorProps {
  sessions: string[];
  currentId: string | null;
}

export function SessionSelector({ sessions, currentId }: SessionSelectorProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {sessions.length > 0 && (
        <select
          value={currentId ?? ""}
          onChange={(e) => {
            if (e.target.value) {
              router.push(`/?session=${e.target.value}`);
            }
          }}
          className="text-sm border border-slate-200 rounded-md px-3 py-1.5"
        >
          <option value="" disabled>选择会话...</option>
          {sessions.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      )}
      <button
        onClick={() => router.push("/?create=true")}
        className="px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-cyan-700"
      >
        新建会话
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/0612-trading/app/components/session-selector.tsx
git commit -m "feat(trading): add SessionSelector component"
```

---

## Task 20: 集成验证与收尾

**Files:**
- Modify: `pages/0612-trading/app/page.tsx`（引入 NavChart 到 ChartArea）
- Verify: 所有文件类型正确、dev server 启动成功

- [ ] **Step 1: 更新 ChartArea 引入 NavChart**

在 `chart-area.tsx` 中将 `NavChartPlaceholder` 替换为真实的 `NavChart` 组件引用。修改 props 使 `page.tsx` 传递 `navHistory` 和 `initialNav` 到 `ChartArea`。

- [ ] **Step 2: 验证 dev server 启动**

```bash
cd pages/0612-trading && pnpm install && pnpm dev
```

Expected: 无编译错误，页面可访问 `http://localhost:3000`

- [ ] **Step 3: 验证 API 路由**

```bash
curl http://localhost:3000/api/sessions
```

Expected: `{"sessions":[]}`

```bash
curl http://localhost:3000/api/accounts
```

Expected: `{"accounts":[]}`

- [ ] **Step 4: Final commit**

```bash
git add pages/0612-trading/
git commit -m "feat(trading): complete trading page integration"
```

---

## Summary

| Task | 范围 | 文件数 |
|------|------|--------|
| 1 | 项目脚手架 | 10 |
| 2 | 核心类型 | 1 |
| 3 | Session Store | 1 |
| 4 | State Machine | 1 |
| 5 | Metrics | 1 |
| 6 | Account Store | 1 |
| 7 | Exchange Adapters | 4 |
| 8 | Order + Sync | 2 |
| 9 | Server Actions | 5 |
| 10 | Route Handlers | 8 |
| 11 | Layout + Page | 2 |
| 12 | TopNav | 1 |
| 13 | StatCards | 1 |
| 14 | ChartArea (TradingView) | 1 |
| 15 | NavChart | 1 |
| 16 | DataTable | 1 |
| 17 | OrderDialog | 1 |
| 18 | DecisionLog | 1 |
| 19 | SessionSelector | 1 |
| 20 | 集成验证 | - |

**总计 20 个 Task，约 44 个新文件。**
