# Vibe Trading 榜单 & 自选 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 ChartArea 的 tab bar 中追加"榜单"和"自选"两个 tab，实现 AI 交易绩效排行榜和用户自选股管理功能。

**Architecture:** 扩展现有 `chart-area.tsx` 的 tab 为 4 值 union type，新增 `leaderboard/` 和 `watchlist/` 两个组件目录。自选数据持久化为 YAML 文件（路径由 workspace_path 决定），行情数据通过 vibe-trading 自身的 Next.js API routes 对接外部交易所。Agent action 注册到现有 `viben-action-provider.tsx`。

**Tech Stack:** Next.js 15 App Router, React 19, TailwindCSS v4, lightweight-charts, js-yaml, nanoid

---

## File Map

### 新增文件

| 文件路径 | 职责 |
|---------|------|
| `lib/watchlist-store.ts` | 自选列表 YAML 文件读写（CRUD） |
| `lib/leaderboard.ts` | 从 session 历史计算绩效排行 |
| `app/api/market/quote/route.ts` | 批量行情 API route |
| `app/api/market/kline/route.ts` | K 线数据 API route |
| `app/api/market/search/route.ts` | 标的搜索 API route |
| `app/api/leaderboard/route.ts` | 榜单数据 API route |
| `app/api/watchlist/route.ts` | 自选列表 CRUD API route |
| `app/api/watchlist/[list_id]/route.ts` | 单个列表操作 API route |
| `app/components/leaderboard/leaderboard.tsx` | 榜单主组件 |
| `app/components/leaderboard/leaderboard-table.tsx` | 排行表格 |
| `app/components/leaderboard/copy-strategy-button.tsx` | 复制策略按钮 |
| `app/components/watchlist/types.ts` | 自选相关类型定义 |
| `app/components/watchlist/watchlist.tsx` | 自选主组件 |
| `app/components/watchlist/watchlist-tabs.tsx` | 子 tab 列表管理 |
| `app/components/watchlist/watchlist-table.tsx` | 行情数据表格 |
| `app/components/watchlist/watchlist-column-config.tsx` | 列配置面板 |
| `app/components/watchlist/portfolio-summary.tsx` | 置顶组合今日表现 |
| `app/components/watchlist/list-config-dialog.tsx` | 列表编辑弹窗 |
| `app/components/ui/mini-kline.tsx` | mini K 线组件 |
| `app/hooks/use-market-quote.ts` | 行情轮询 + 缓存 hook |
| `app/hooks/use-watchlists.ts` | 自选列表状态管理 hook |

### 现有文件（不需要新建，直接使用）

| 文件路径 | 用途 |
|---------|------|
| `app/components/ui/mini-sparkline.tsx` | 榜单净值曲线 sparkline（已存在） |

### 修改文件

| 文件路径 | 改动 |
|---------|------|
| `app/components/chart-area.tsx` | 扩展 tab 类型为 4 值，添加 leaderboard/watchlist 内容切换 |
| `app/components/viben-action-provider.tsx` | 新增 watchlist.* agent actions |
| `app/page.tsx` | Props 接口添加 workspace_path，传递给 ChartArea |
| `lib/types.ts` | 添加 WatchlistItem、LeaderboardEntry 等类型 |

---

## Task 1: 类型定义

**Files:**
- Modify: `lib/types.ts`
- Create: `app/components/watchlist/types.ts`

- [ ] **Step 1: 在 `lib/types.ts` 末尾添加共享类型**

```typescript
// --- Watchlist & Leaderboard types ---

export interface WatchlistSymbolEntry {
  symbol: string;
  annotation: string;
  added_at: string;
}

export interface WatchlistConfig {
  id: string;
  name: string;
  color: string;
  refresh_interval: number;
  refresh_prompt: string;
  symbols: WatchlistSymbolEntry[];
  column_config: string[];
}

export interface LeaderboardEntry {
  rank: number;
  session_id: string;
  session_name: string;
  cumulative_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  win_rate: number;
  profit_loss_ratio: number;
  daily_return_pct: number;
  nav_history: number[];
  symbols_count: number;
  last_trade_time: string;
  running_days: number;
  total_trades: number;
  agent_config: SessionInitEvent["agent_config"];
}

export interface MarketQuote {
  symbol: string;
  last_price: number;
  open_price: number;
  high_price: number;
  low_price: number;
  prev_close: number;
  change: number;
  change_pct: number;
  volume: number;
  turnover: number;
  turnover_rate: number;
  amplitude: number;
  [key: string]: unknown;
}
```

- [ ] **Step 2: 创建 `app/components/watchlist/types.ts`**

```typescript
export type WatchlistColumnKey =
  | "symbol" | "name" | "lastPrice" | "openPrice" | "highPrice" | "lowPrice"
  | "prevClose" | "vwap" | "upperLimit" | "lowerLimit"
  | "change" | "changePct" | "amplitude" | "gapPct"
  | "volume" | "volumeRatio" | "turnover" | "turnoverRate"
  | "avgVolume5d" | "avgVolume10d" | "relativeVolume" | "netVolume" | "openInterest"
  | "bidPrice1" | "askPrice1" | "spread" | "spreadPct" | "bidAskRatio" | "tradeCount"
  | "ma5" | "ma10" | "ma20" | "ma60" | "ma120" | "ma250"
  | "ema20" | "ema50" | "ema200" | "priceMa5Pct" | "priceMa20Pct"
  | "macdDif" | "macdDea" | "macdHistogram" | "rsi6" | "rsi14"
  | "kdjK" | "kdjD" | "kdjJ" | "cci14" | "williamR14" | "mfi14" | "obv"
  | "bollUpper" | "bollMiddle" | "bollLower" | "bollWidth" | "atr14" | "adx14" | "parabolicSar"
  | "historicalVol10d" | "historicalVol20d" | "beta" | "sharpeRatio" | "maxDrawdown"
  | "return1d" | "return5d" | "return1m" | "return3m" | "return6m" | "return1y" | "returnYtd"
  | "high52w" | "low52w" | "pctFrom52wHigh" | "pctFrom52wLow"
  | "rsRating" | "sectorRank" | "industryRank"
  | "marketCap" | "floatMarketCap" | "peRatioTtm" | "pbRatio" | "psRatioTtm" | "evEbitda" | "pegRatio"
  | "eps" | "bookValuePerShare" | "dividendYield" | "dividendPerShare"
  | "revenueGrowthYoy" | "netIncomeGrowthYoy" | "grossMargin" | "netMargin" | "roe" | "roa" | "debtToEquity"
  | "circulatingSupply" | "totalSupply" | "fullyDilutedValuation" | "fundingRate" | "longShortRatio" | "stakingYield"
  | "analystRating" | "priceTarget" | "priceTargetUpside" | "nextEarningsDate"
  | "exchange" | "sector" | "industry" | "lastUpdateTime" | "notes" | "tags" | "annotation" | "watchlistAddedAt"
  | "miniKline";

export interface ColumnDefinition {
  key: WatchlistColumnKey;
  label: string;
  category: string;
  width: number;
  align: "left" | "right" | "center";
  render?: "number" | "percent" | "currency" | "sparkline" | "text" | "time";
}

export const DEFAULT_COLUMNS: WatchlistColumnKey[] = [
  "symbol", "name", "lastPrice", "changePct", "change",
  "volume", "turnover", "turnoverRate", "miniKline", "annotation",
];

export const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { key: "symbol", label: "代码", category: "基础价格", width: 80, align: "left", render: "text" },
  { key: "name", label: "名称", category: "基础价格", width: 80, align: "left", render: "text" },
  { key: "lastPrice", label: "最新价", category: "基础价格", width: 80, align: "right", render: "currency" },
  { key: "openPrice", label: "开盘价", category: "基础价格", width: 80, align: "right", render: "currency" },
  { key: "highPrice", label: "最高价", category: "基础价格", width: 80, align: "right", render: "currency" },
  { key: "lowPrice", label: "最低价", category: "基础价格", width: 80, align: "right", render: "currency" },
  { key: "prevClose", label: "昨收价", category: "基础价格", width: 80, align: "right", render: "currency" },
  { key: "vwap", label: "均价(VWAP)", category: "基础价格", width: 90, align: "right", render: "currency" },
  { key: "change", label: "涨跌额", category: "涨跌指标", width: 80, align: "right", render: "currency" },
  { key: "changePct", label: "涨跌幅", category: "涨跌指标", width: 80, align: "right", render: "percent" },
  { key: "amplitude", label: "振幅", category: "涨跌指标", width: 70, align: "right", render: "percent" },
  { key: "volume", label: "成交量", category: "成交量", width: 90, align: "right", render: "number" },
  { key: "volumeRatio", label: "量比", category: "成交量", width: 60, align: "right", render: "number" },
  { key: "turnover", label: "成交额", category: "成交量", width: 100, align: "right", render: "currency" },
  { key: "turnoverRate", label: "换手率", category: "成交量", width: 70, align: "right", render: "percent" },
  { key: "ma5", label: "MA5", category: "技术指标-均线", width: 80, align: "right", render: "currency" },
  { key: "ma10", label: "MA10", category: "技术指标-均线", width: 80, align: "right", render: "currency" },
  { key: "ma20", label: "MA20", category: "技术指标-均线", width: 80, align: "right", render: "currency" },
  { key: "ma60", label: "MA60", category: "技术指标-均线", width: 80, align: "right", render: "currency" },
  { key: "rsi14", label: "RSI14", category: "技术指标-动量", width: 60, align: "right", render: "number" },
  { key: "macdDif", label: "MACD-DIF", category: "技术指标-动量", width: 80, align: "right", render: "number" },
  { key: "macdHistogram", label: "MACD柱", category: "技术指标-动量", width: 80, align: "right", render: "number" },
  { key: "atr14", label: "ATR14", category: "技术指标-趋势", width: 80, align: "right", render: "number" },
  { key: "bollUpper", label: "布林上轨", category: "技术指标-趋势", width: 90, align: "right", render: "currency" },
  { key: "bollLower", label: "布林下轨", category: "技术指标-趋势", width: 90, align: "right", render: "currency" },
  { key: "return1d", label: "1日涨幅", category: "区间表现", width: 80, align: "right", render: "percent" },
  { key: "return5d", label: "5日涨幅", category: "区间表现", width: 80, align: "right", render: "percent" },
  { key: "return1m", label: "1月涨幅", category: "区间表现", width: 80, align: "right", render: "percent" },
  { key: "returnYtd", label: "年初至今", category: "区间表现", width: 80, align: "right", render: "percent" },
  { key: "marketCap", label: "总市值", category: "基本面-估值", width: 100, align: "right", render: "currency" },
  { key: "peRatioTtm", label: "PE(TTM)", category: "基本面-估值", width: 80, align: "right", render: "number" },
  { key: "pbRatio", label: "PB", category: "基本面-估值", width: 60, align: "right", render: "number" },
  { key: "dividendYield", label: "股息率", category: "基本面-每股", width: 70, align: "right", render: "percent" },
  { key: "roe", label: "ROE", category: "基本面-成长", width: 70, align: "right", render: "percent" },
  { key: "fundingRate", label: "资金费率", category: "加密货币", width: 80, align: "right", render: "percent" },
  { key: "longShortRatio", label: "多空比", category: "加密货币", width: 70, align: "right", render: "number" },
  { key: "annotation", label: "AI标注", category: "其他", width: 200, align: "left", render: "text" },
  { key: "miniKline", label: "mini K线", category: "其他", width: 80, align: "center", render: "sparkline" },
  { key: "watchlistAddedAt", label: "加入时间", category: "其他", width: 100, align: "right", render: "time" },
  { key: "notes", label: "备注", category: "其他", width: 150, align: "left", render: "text" },
];
```

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts app/components/watchlist/types.ts
git commit -m "feat(trading): add watchlist and leaderboard type definitions"
```

---

## Task 2: 自选列表数据存储层

**Files:**
- Create: `lib/watchlist-store.ts`

- [ ] **Step 1: 实现 watchlist-store.ts**

```typescript
import { readFile, writeFile, readdir, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { nanoid } from "nanoid";
import yaml from "js-yaml";
import type { WatchlistConfig, WatchlistSymbolEntry } from "./types";

function getWatchlistDir(workspacePath?: string): string {
  if (workspacePath) {
    return join(workspacePath, ".viben", "shared", "watchlists");
  }
  const home = process.env.HOME || process.env.USERPROFILE || "~";
  return join(home, ".viben", "shared", "watchlists");
}

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

function configToYaml(config: WatchlistConfig): string {
  const { id, ...rest } = config;
  return yaml.dump({ id, ...rest }, { lineWidth: 120 });
}

function yamlToConfig(content: string, filename: string): WatchlistConfig {
  const data = yaml.load(content) as Record<string, unknown>;
  return {
    id: (data.id as string) || filename.replace(".yaml", ""),
    name: (data.name as string) || "",
    color: (data.color as string) || "#0891B2",
    refresh_interval: (data.refresh_interval as number) || 300,
    refresh_prompt: (data.refresh_prompt as string) || "",
    symbols: (data.symbols as WatchlistSymbolEntry[]) || [],
    column_config: (data.column_config as string[]) || [],
  };
}

export async function listWatchlists(workspacePath?: string): Promise<WatchlistConfig[]> {
  const dir = getWatchlistDir(workspacePath);
  await ensureDir(dir);
  const files = await readdir(dir);
  const yamlFiles = files.filter((f) => f.endsWith(".yaml"));
  const lists: WatchlistConfig[] = [];
  for (const file of yamlFiles) {
    const content = await readFile(join(dir, file), "utf-8");
    lists.push(yamlToConfig(content, file));
  }
  return lists;
}

export async function getWatchlist(listId: string, workspacePath?: string): Promise<WatchlistConfig | null> {
  const dir = getWatchlistDir(workspacePath);
  const filePath = join(dir, `${listId}.yaml`);
  if (!existsSync(filePath)) return null;
  const content = await readFile(filePath, "utf-8");
  return yamlToConfig(content, `${listId}.yaml`);
}

export async function createWatchlist(
  params: { name: string; color?: string; refresh_interval?: number; refresh_prompt?: string },
  workspacePath?: string
): Promise<WatchlistConfig> {
  const dir = getWatchlistDir(workspacePath);
  await ensureDir(dir);
  const id = `wl_${nanoid(8)}`;
  const config: WatchlistConfig = {
    id,
    name: params.name,
    color: params.color || "#0891B2",
    refresh_interval: params.refresh_interval || 300,
    refresh_prompt: params.refresh_prompt || "",
    symbols: [],
    column_config: [],
  };
  await writeFile(join(dir, `${id}.yaml`), configToYaml(config), "utf-8");
  return config;
}

export async function updateWatchlist(
  listId: string,
  updates: Partial<Pick<WatchlistConfig, "name" | "color" | "refresh_interval" | "refresh_prompt" | "column_config">>,
  workspacePath?: string
): Promise<WatchlistConfig | null> {
  const config = await getWatchlist(listId, workspacePath);
  if (!config) return null;
  const updated = { ...config, ...updates };
  const dir = getWatchlistDir(workspacePath);
  await writeFile(join(dir, `${listId}.yaml`), configToYaml(updated), "utf-8");
  return updated;
}

export async function deleteWatchlist(listId: string, workspacePath?: string): Promise<boolean> {
  const dir = getWatchlistDir(workspacePath);
  const filePath = join(dir, `${listId}.yaml`);
  if (!existsSync(filePath)) return false;
  await unlink(filePath);
  return true;
}

export async function addSymbols(
  listId: string,
  symbols: string[],
  workspacePath?: string
): Promise<WatchlistConfig | null> {
  const config = await getWatchlist(listId, workspacePath);
  if (!config) return null;
  const existing = new Set(config.symbols.map((s) => s.symbol));
  const newEntries: WatchlistSymbolEntry[] = symbols
    .filter((s) => !existing.has(s))
    .map((symbol) => ({ symbol, annotation: "", added_at: new Date().toISOString() }));
  config.symbols.push(...newEntries);
  const dir = getWatchlistDir(workspacePath);
  await writeFile(join(dir, `${listId}.yaml`), configToYaml(config), "utf-8");
  return config;
}

export async function removeSymbols(
  listId: string,
  symbols: string[],
  workspacePath?: string
): Promise<WatchlistConfig | null> {
  const config = await getWatchlist(listId, workspacePath);
  if (!config) return null;
  const toRemove = new Set(symbols);
  config.symbols = config.symbols.filter((s) => !toRemove.has(s.symbol));
  const dir = getWatchlistDir(workspacePath);
  await writeFile(join(dir, `${listId}.yaml`), configToYaml(config), "utf-8");
  return config;
}

export async function setAnnotation(
  listId: string,
  symbol: string,
  annotation: string,
  workspacePath?: string
): Promise<boolean> {
  const config = await getWatchlist(listId, workspacePath);
  if (!config) return false;
  const entry = config.symbols.find((s) => s.symbol === symbol);
  if (!entry) return false;
  entry.annotation = annotation;
  const dir = getWatchlistDir(workspacePath);
  await writeFile(join(dir, `${listId}.yaml`), configToYaml(config), "utf-8");
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/watchlist-store.ts
git commit -m "feat(trading): add watchlist YAML storage layer"
```

---

## Task 3: 榜单数据计算层

**Files:**
- Create: `lib/leaderboard.ts`

- [ ] **Step 1: 实现 leaderboard.ts**

```typescript
import type { LeaderboardEntry, SessionState } from "./types";
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/leaderboard.ts
git commit -m "feat(trading): add leaderboard computation from session history"
```

---

## Task 4: API Routes

**Files:**
- Create: `app/api/leaderboard/route.ts`
- Create: `app/api/market/quote/route.ts`
- Create: `app/api/market/kline/route.ts`
- Create: `app/api/market/search/route.ts`
- Create: `app/api/watchlist/route.ts`
- Create: `app/api/watchlist/[list_id]/route.ts`

- [ ] **Step 1: 创建 `app/api/leaderboard/route.ts`**

```typescript
import { computeLeaderboard } from "@/lib/leaderboard";
import { NextResponse } from "next/server";

export async function GET() {
  const entries = await computeLeaderboard();
  return NextResponse.json({ entries });
}
```

- [ ] **Step 2: 创建 `app/api/market/quote/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/exchanges/proxy-fetch";

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get("symbols")?.split(",") ?? [];
  if (symbols.length === 0) {
    return NextResponse.json({ error: "symbols required" }, { status: 400 });
  }

  const quotes = await Promise.all(
    symbols.map(async (symbol) => {
      const binanceSymbol = symbol.replace("/", "");
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
      try {
        const res = await proxyFetch(url);
        if (!res.ok) return null;
        const data = await res.json() as Record<string, string>;
        return {
          symbol,
          last_price: parseFloat(data.lastPrice),
          open_price: parseFloat(data.openPrice),
          high_price: parseFloat(data.highPrice),
          low_price: parseFloat(data.lowPrice),
          prev_close: parseFloat(data.prevClosePrice),
          change: parseFloat(data.priceChange),
          change_pct: parseFloat(data.priceChangePercent),
          volume: parseFloat(data.volume),
          turnover: parseFloat(data.quoteVolume),
          turnover_rate: 0,
          amplitude: ((parseFloat(data.highPrice) - parseFloat(data.lowPrice)) / parseFloat(data.prevClosePrice)) * 100,
        };
      } catch {
        return null;
      }
    })
  );

  return NextResponse.json({ quotes: quotes.filter(Boolean) });
}
```

- [ ] **Step 3: 创建 `app/api/market/kline/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/exchanges/proxy-fetch";
import type { OHLCV } from "@/lib/types";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "";
  const interval = req.nextUrl.searchParams.get("interval") ?? "1d";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "30", 10);

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const binanceSymbol = symbol.replace("/", "");
  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;

  try {
    const res = await proxyFetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: `Binance API error: ${res.status}` }, { status: 502 });
    }
    const data: unknown[] = await res.json();
    const klines: OHLCV[] = data.map((k) => {
      const row = k as [number, string, string, string, string, string, ...unknown[]];
      return {
        ts: new Date(row[0]).toISOString(),
        o: parseFloat(row[1]),
        h: parseFloat(row[2]),
        l: parseFloat(row[3]),
        c: parseFloat(row[4]),
        v: parseFloat(row[5]),
      };
    });
    return NextResponse.json({ klines });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 4: 创建 `app/api/market/search/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/exchanges/proxy-fetch";

interface BinanceSymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

let symbolCache: BinanceSymbolInfo[] = [];
let cacheTime = 0;

async function getSymbolList(): Promise<BinanceSymbolInfo[]> {
  if (symbolCache.length > 0 && Date.now() - cacheTime < 3600_000) {
    return symbolCache;
  }
  const res = await proxyFetch("https://api.binance.com/api/v3/exchangeInfo");
  if (!res.ok) return symbolCache;
  const data = await res.json() as { symbols: BinanceSymbolInfo[] };
  symbolCache = data.symbols.filter((s) => s.status === "TRADING");
  cacheTime = Date.now();
  return symbolCache;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").toUpperCase();
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const symbols = await getSymbolList();
  const results = symbols
    .filter((s) => s.symbol.includes(q) || s.baseAsset.includes(q))
    .slice(0, 20)
    .map((s) => ({ symbol: s.symbol, base: s.baseAsset, quote: s.quoteAsset }));

  return NextResponse.json({ results });
}
```

- [ ] **Step 5: 创建 `app/api/watchlist/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { listWatchlists, createWatchlist } from "@/lib/watchlist-store";

export async function GET(req: NextRequest) {
  const workspacePath = req.nextUrl.searchParams.get("workspace_path") || undefined;
  const lists = await listWatchlists(workspacePath);
  return NextResponse.json({ lists });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { name: string; color?: string; refresh_interval?: number; refresh_prompt?: string; workspace_path?: string };
  const { workspace_path, ...params } = body;
  const list = await createWatchlist(params, workspace_path);
  return NextResponse.json({ list }, { status: 201 });
}
```

- [ ] **Step 6: 创建 `app/api/watchlist/[list_id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import type { WatchlistConfig } from "@/lib/types";
import { getWatchlist, updateWatchlist, deleteWatchlist, addSymbols, removeSymbols, setAnnotation } from "@/lib/watchlist-store";

export async function GET(req: NextRequest, { params }: { params: Promise<{ list_id: string }> }) {
  const { list_id } = await params;
  const workspacePath = req.nextUrl.searchParams.get("workspace_path") || undefined;
  const list = await getWatchlist(list_id, workspacePath);
  if (!list) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ list });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ list_id: string }> }) {
  const { list_id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const workspacePath = (body.workspace_path as string) || undefined;

  if (body.action === "add_symbols") {
    const result = await addSymbols(list_id, body.symbols as string[], workspacePath);
    if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ list: result });
  }

  if (body.action === "remove_symbols") {
    const result = await removeSymbols(list_id, body.symbols as string[], workspacePath);
    if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ list: result });
  }

  if (body.action === "set_annotation") {
    const ok = await setAnnotation(list_id, body.symbol as string, body.annotation as string, workspacePath);
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  const { action, workspace_path: _wp, symbols, symbol, annotation, ...updates } = body;
  const result = await updateWatchlist(list_id, updates as Partial<Pick<WatchlistConfig, "name" | "color" | "refresh_interval" | "refresh_prompt" | "column_config">>, workspacePath);
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ list: result });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ list_id: string }> }) {
  const { list_id } = await params;
  const workspacePath = req.nextUrl.searchParams.get("workspace_path") || undefined;
  const ok = await deleteWatchlist(list_id, workspacePath);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 7: Commit**

```bash
git add app/api/leaderboard/ app/api/market/ app/api/watchlist/
git commit -m "feat(trading): add API routes for leaderboard, market data, and watchlist CRUD"
```

---

## Task 5: 前端 Hooks

**Files:**
- Create: `app/hooks/use-market-quote.ts`
- Create: `app/hooks/use-watchlists.ts`

- [ ] **Step 1: 创建 `app/hooks/use-market-quote.ts`**

```typescript
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { MarketQuote } from "@/lib/types";

interface UseMarketQuoteOptions {
  symbols: string[];
  interval?: number; // polling interval in ms, default 5000
  enabled?: boolean;
}

const quoteCache = new Map<string, { data: MarketQuote; ts: number }>();
const CACHE_TTL = 3000;

export function useMarketQuote({ symbols, interval = 5000, enabled = true }: UseMarketQuoteOptions) {
  const [quotes, setQuotes] = useState<Map<string, MarketQuote>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetchQuotes = useCallback(async () => {
    if (symbols.length === 0) return;

    const now = Date.now();
    const stale = symbols.filter((s) => {
      const cached = quoteCache.get(s);
      return !cached || now - cached.ts > CACHE_TTL;
    });

    if (stale.length === 0) {
      const cached = new Map<string, MarketQuote>();
      symbols.forEach((s) => {
        const c = quoteCache.get(s);
        if (c) cached.set(s, c.data);
      });
      setQuotes(cached);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/market/quote?symbols=${stale.join(",")}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { quotes: MarketQuote[] };

      const updatedTs = Date.now();
      for (const q of data.quotes) {
        quoteCache.set(q.symbol, { data: q, ts: updatedTs });
      }

      const all = new Map<string, MarketQuote>();
      symbols.forEach((s) => {
        const c = quoteCache.get(s);
        if (c) all.set(s, c.data);
      });
      setQuotes(all);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    if (!enabled || symbols.length === 0) return;
    fetchQuotes();
    timerRef.current = setInterval(fetchQuotes, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, symbols, interval, fetchQuotes]);

  return { quotes, loading, error, refresh: fetchQuotes };
}
```

- [ ] **Step 2: 创建 `app/hooks/use-watchlists.ts`**

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { WatchlistConfig } from "@/lib/types";

export function useWatchlists(workspacePath?: string) {
  const [lists, setLists] = useState<WatchlistConfig[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const activeListIdRef = useRef(activeListId);
  activeListIdRef.current = activeListId;

  const qp = workspacePath ? `?workspace_path=${encodeURIComponent(workspacePath)}` : "";

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/watchlist${qp}`);
      const data = await res.json() as { lists: WatchlistConfig[] };
      setLists(data.lists);
      if (data.lists.length > 0 && !activeListIdRef.current) {
        setActiveListId(data.lists[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [qp]);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const createList = useCallback(async (params: { name: string; color?: string; refresh_interval?: number; refresh_prompt?: string }) => {
    const res = await fetch(`/api/watchlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, workspace_path: workspacePath }),
    });
    const data = await res.json() as { list: WatchlistConfig };
    setLists((prev) => [...prev, data.list]);
    setActiveListId(data.list.id);
    return data.list;
  }, [workspacePath]);

  const updateList = useCallback(async (listId: string, updates: Record<string, unknown>) => {
    const res = await fetch(`/api/watchlist/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, workspace_path: workspacePath }),
    });
    const data = await res.json() as { list: WatchlistConfig };
    setLists((prev) => prev.map((l) => l.id === listId ? data.list : l));
    return data.list;
  }, [workspacePath]);

  const deleteList = useCallback(async (listId: string) => {
    await fetch(`/api/watchlist/${listId}?${workspacePath ? `workspace_path=${encodeURIComponent(workspacePath)}` : ""}`, {
      method: "DELETE",
    });
    setLists((prev) => prev.filter((l) => l.id !== listId));
    if (activeListId === listId) {
      setActiveListId(lists.find((l) => l.id !== listId)?.id ?? null);
    }
  }, [workspacePath, activeListId, lists]);

  const addSymbols = useCallback(async (listId: string, symbols: string[]) => {
    const res = await fetch(`/api/watchlist/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_symbols", symbols, workspace_path: workspacePath }),
    });
    const data = await res.json() as { list: WatchlistConfig };
    setLists((prev) => prev.map((l) => l.id === listId ? data.list : l));
    return data.list;
  }, [workspacePath]);

  const removeSymbols = useCallback(async (listId: string, symbols: string[]) => {
    const res = await fetch(`/api/watchlist/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_symbols", symbols, workspace_path: workspacePath }),
    });
    const data = await res.json() as { list: WatchlistConfig };
    setLists((prev) => prev.map((l) => l.id === listId ? data.list : l));
    return data.list;
  }, [workspacePath]);

  const setAnnotation = useCallback(async (listId: string, symbol: string, annotation: string) => {
    await fetch(`/api/watchlist/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_annotation", symbol, annotation, workspace_path: workspacePath }),
    });
    setLists((prev) => prev.map((l) => {
      if (l.id !== listId) return l;
      return { ...l, symbols: l.symbols.map((s) => s.symbol === symbol ? { ...s, annotation } : s) };
    }));
  }, [workspacePath]);

  const activeList = lists.find((l) => l.id === activeListId) ?? null;

  return {
    lists,
    activeList,
    activeListId,
    setActiveListId,
    loading,
    createList,
    updateList,
    deleteList,
    addSymbols,
    removeSymbols,
    setAnnotation,
    refresh: fetchLists,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add app/hooks/use-market-quote.ts app/hooks/use-watchlists.ts
git commit -m "feat(trading): add useMarketQuote and useWatchlists hooks"
```

---

## Task 6: Mini K 线组件

**Files:**
- Create: `app/components/ui/mini-kline.tsx`

- [ ] **Step 1: 实现 `mini-kline.tsx`**

```typescript
"use client";

import type { OHLCV } from "@/lib/types";

interface MiniKlineProps {
  data: OHLCV[];
  width?: number;
  height?: number;
}

export function MiniKline({ data, width = 80, height = 24 }: MiniKlineProps) {
  if (data.length < 2) return null;

  const padding = 2;
  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  const allPrices = data.flatMap((k) => [k.h, k.l]);
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = max - min || 1;

  const barWidth = Math.max(1, (drawWidth / data.length) * 0.6);
  const gap = drawWidth / data.length;

  const toY = (price: number) => padding + drawHeight - ((price - min) / range) * drawHeight;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block align-middle"
    >
      {data.map((k, i) => {
        const x = padding + i * gap + gap / 2;
        const isUp = k.c >= k.o;
        const color = isUp ? "#16a34a" : "#dc2626";
        const bodyTop = toY(Math.max(k.o, k.c));
        const bodyBottom = toY(Math.min(k.o, k.c));
        const bodyHeight = Math.max(0.5, bodyBottom - bodyTop);

        return (
          <g key={i}>
            {/* Wick */}
            <line
              x1={x}
              y1={toY(k.h)}
              x2={x}
              y2={toY(k.l)}
              stroke={color}
              strokeWidth={0.5}
            />
            {/* Body */}
            <rect
              x={x - barWidth / 2}
              y={bodyTop}
              width={barWidth}
              height={bodyHeight}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/ui/mini-kline.tsx
git commit -m "feat(trading): add MiniKline SVG component"
```

---

## Task 7: 榜单组件

**Files:**
- Create: `app/components/leaderboard/leaderboard.tsx`
- Create: `app/components/leaderboard/leaderboard-table.tsx`
- Create: `app/components/leaderboard/copy-strategy-button.tsx`

- [ ] **Step 1: 创建 `app/components/leaderboard/copy-strategy-button.tsx`**

```typescript
"use client";

import { useState } from "react";
import type { SessionInitEvent } from "@/lib/types";

interface CopyStrategyButtonProps {
  agentConfig: SessionInitEvent["agent_config"];
  sessionName: string;
}

export function CopyStrategyButton({ agentConfig, sessionName }: CopyStrategyButtonProps) {
  const [copying, setCopying] = useState(false);

  async function handleCopy() {
    setCopying(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_name: `${sessionName} (副本)`,
          ...agentConfig,
        }),
      });
      if (!res.ok) throw new Error("Failed to copy");
      alert("策略已复制，新会话已创建");
    } catch (err) {
      alert(`复制失败: ${err}`);
    } finally {
      setCopying(false);
    }
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleCopy(); }}
      disabled={copying}
      className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 disabled:opacity-50"
    >
      {copying ? "复制中..." : "复制策略"}
    </button>
  );
}
```

- [ ] **Step 2: 创建 `app/components/leaderboard/leaderboard-table.tsx`**

```typescript
"use client";

import { useState } from "react";
import type { LeaderboardEntry } from "@/lib/types";
import { MiniSparkline } from "../ui/mini-sparkline";
import { CopyStrategyButton } from "./copy-strategy-button";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

type SortField = "cumulative_return_pct" | "max_drawdown_pct" | "sharpe_ratio" | "win_rate" | "profit_loss_ratio" | "daily_return_pct" | "total_trades" | "running_days";

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  const [sortField, setSortField] = useState<SortField>("cumulative_return_pct");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...entries].sort((a, b) => {
    const diff = (a[sortField] as number) - (b[sortField] as number);
    return sortAsc ? diff : -diff;
  });

  function handleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  function rankIcon(rank: number): string {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return String(rank);
  }

  const headerClass = "px-2 py-1.5 text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-800 whitespace-nowrap";
  const cellClass = "px-2 py-1.5 text-xs whitespace-nowrap";

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-white border-b border-slate-100">
          <tr>
            <th className={headerClass}>#</th>
            <th className={`${headerClass} text-left`}>策略名称</th>
            <th className={headerClass} onClick={() => handleSort("cumulative_return_pct")}>累计收益</th>
            <th className={headerClass} onClick={() => handleSort("max_drawdown_pct")}>最大回撤</th>
            <th className={headerClass} onClick={() => handleSort("sharpe_ratio")}>夏普</th>
            <th className={headerClass} onClick={() => handleSort("win_rate")}>胜率</th>
            <th className={headerClass} onClick={() => handleSort("profit_loss_ratio")}>盈亏比</th>
            <th className={headerClass} onClick={() => handleSort("daily_return_pct")}>日均收益</th>
            <th className={headerClass}>净值曲线</th>
            <th className={headerClass}>标的数</th>
            <th className={headerClass}>最近操作</th>
            <th className={headerClass} onClick={() => handleSort("running_days")}>运行天数</th>
            <th className={headerClass} onClick={() => handleSort("total_trades")}>操作次数</th>
            <th className={headerClass}>操作</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => (
            <>
              <tr
                key={entry.session_id}
                onClick={() => setExpandedId(expandedId === entry.session_id ? null : entry.session_id)}
                className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
              >
                <td className={`${cellClass} text-center`}>{rankIcon(i + 1)}</td>
                <td className={`${cellClass} font-medium`}>{entry.session_name}</td>
                <td className={`${cellClass} text-right ${entry.cumulative_return_pct >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {entry.cumulative_return_pct >= 0 ? "+" : ""}{entry.cumulative_return_pct}%
                </td>
                <td className={`${cellClass} text-right text-red-600`}>{entry.max_drawdown_pct}%</td>
                <td className={`${cellClass} text-right`}>{entry.sharpe_ratio}</td>
                <td className={`${cellClass} text-right`}>{entry.win_rate}%</td>
                <td className={`${cellClass} text-right`}>{entry.profit_loss_ratio}</td>
                <td className={`${cellClass} text-right ${entry.daily_return_pct >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {entry.daily_return_pct >= 0 ? "+" : ""}{entry.daily_return_pct}%
                </td>
                <td className={cellClass}>
                  <MiniSparkline
                    data={entry.nav_history}
                    width={60}
                    height={18}
                    color={entry.cumulative_return_pct >= 0 ? "#16a34a" : "#dc2626"}
                  />
                </td>
                <td className={`${cellClass} text-center`}>{entry.symbols_count}</td>
                <td className={`${cellClass} text-right text-slate-400`}>
                  {formatRelativeTime(entry.last_trade_time)}
                </td>
                <td className={`${cellClass} text-right`}>{entry.running_days}d</td>
                <td className={`${cellClass} text-right`}>{entry.total_trades}</td>
                <td className={cellClass}>
                  <CopyStrategyButton agentConfig={entry.agent_config} sessionName={entry.session_name} />
                </td>
              </tr>
              {expandedId === entry.session_id && (
                <tr key={`${entry.session_id}-detail`} className="bg-slate-50">
                  <td colSpan={14} className="px-4 py-3 text-xs text-slate-600">
                    <div className="grid grid-cols-3 gap-4">
                      <div><span className="font-medium">策略：</span>{entry.agent_config.strategy_name}</div>
                      <div><span className="font-medium">模型：</span>{entry.agent_config.model}</div>
                      <div><span className="font-medium">风险：</span>{entry.agent_config.risk_level}</div>
                      <div><span className="font-medium">标的：</span>{entry.agent_config.symbols?.join(", ")}</div>
                      <div><span className="font-medium">周期：</span>{entry.agent_config.interval_minutes}min</div>
                      <div><span className="font-medium">最大仓位：</span>{entry.agent_config.max_position_pct}%</div>
                    </div>
                    <div className="mt-2"><span className="font-medium">描述：</span>{entry.agent_config.strategy_description}</div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}
```

- [ ] **Step 3: 创建 `app/components/leaderboard/leaderboard.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import type { LeaderboardEntry } from "@/lib/types";
import { LeaderboardTable } from "./leaderboard-table";

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json() as { entries: LeaderboardEntry[] };
        setEntries(data.entries);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        加载中...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        暂无策略数据，创建交易会话后将自动生成排行
      </div>
    );
  }

  return <LeaderboardTable entries={entries} />;
}
```

- [ ] **Step 4: Commit**

```bash
git add app/components/leaderboard/
git commit -m "feat(trading): add Leaderboard components with sortable table and copy strategy"
```

---

## Task 8: 自选组件 - 子 Tab 管理 & 列表配置弹窗

**Files:**
- Create: `app/components/watchlist/watchlist-tabs.tsx`
- Create: `app/components/watchlist/list-config-dialog.tsx`

- [ ] **Step 1: 创建 `app/components/watchlist/list-config-dialog.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import type { WatchlistConfig } from "@/lib/types";

interface ListConfigDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: { name: string; color: string; refresh_interval: number; refresh_prompt: string }) => void;
  initial?: Pick<WatchlistConfig, "name" | "color" | "refresh_interval" | "refresh_prompt"> | null;
}

const PRESET_COLORS = ["#0891B2", "#7c3aed", "#ea580c", "#16a34a", "#dc2626", "#2563eb", "#d97706", "#db2777"];

export function ListConfigDialog({ open, onClose, onSave, initial }: ListConfigDialogProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [refreshInterval, setRefreshInterval] = useState(initial?.refresh_interval ?? 300);
  const [refreshPrompt, setRefreshPrompt] = useState(initial?.refresh_prompt ?? "");

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setColor(initial.color);
      setRefreshInterval(initial.refresh_interval);
      setRefreshPrompt(initial.refresh_prompt);
    } else {
      setName("");
      setColor(PRESET_COLORS[0]);
      setRefreshInterval(300);
      setRefreshPrompt("");
    }
  }, [initial, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-[420px] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-medium mb-4">{initial ? "编辑列表" : "新建列表"}</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm"
              placeholder="例如：科技龙头"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">颜色</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-slate-800" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">自动刷新周期（秒）</label>
            <input
              type="number"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10) || 300)}
              className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm"
              min={60}
              step={60}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">刷新 Prompt（AI 执行指令）</label>
            <textarea
              value={refreshPrompt}
              onChange={(e) => setRefreshPrompt(e.target.value)}
              className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm h-20 resize-none"
              placeholder="例如：筛选市值前10的科技股，标注近期利好利空"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded">
            取消
          </button>
          <button
            onClick={() => { onSave({ name, color, refresh_interval: refreshInterval, refresh_prompt: refreshPrompt }); onClose(); }}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 `app/components/watchlist/watchlist-tabs.tsx`**

```typescript
"use client";

import { useState } from "react";
import type { WatchlistConfig } from "@/lib/types";
import { ListConfigDialog } from "./list-config-dialog";

interface WatchlistTabsProps {
  lists: WatchlistConfig[];
  activeListId: string | null;
  onSelect: (id: string) => void;
  onCreate: (config: { name: string; color?: string; refresh_interval?: number; refresh_prompt?: string }) => void;
  onUpdate: (listId: string, config: { name?: string; color?: string; refresh_interval?: number; refresh_prompt?: string }) => void;
  onDelete: (listId: string) => void;
}

export function WatchlistTabs({ lists, activeListId, onSelect, onCreate, onUpdate, onDelete }: WatchlistTabsProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingList, setEditingList] = useState<WatchlistConfig | null>(null);
  const [contextMenu, setContextMenu] = useState<{ listId: string; x: number; y: number } | null>(null);

  function handleContextMenu(e: React.MouseEvent, list: WatchlistConfig) {
    e.preventDefault();
    setContextMenu({ listId: list.id, x: e.clientX, y: e.clientY });
  }

  function handleEdit() {
    const list = lists.find((l) => l.id === contextMenu?.listId);
    if (list) { setEditingList(list); setShowDialog(true); }
    setContextMenu(null);
  }

  function handleDelete() {
    if (contextMenu) onDelete(contextMenu.listId);
    setContextMenu(null);
  }

  return (
    <>
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-100 overflow-x-auto">
        {lists.map((list) => (
          <button
            key={list.id}
            onClick={() => onSelect(list.id)}
            onContextMenu={(e) => handleContextMenu(e, list)}
            className={`px-2.5 py-1 text-xs rounded-t whitespace-nowrap border-b-2 transition-colors ${
              activeListId === list.id
                ? "font-medium text-slate-800"
                : "text-slate-500 border-transparent hover:text-slate-700"
            }`}
            style={{ borderBottomColor: activeListId === list.id ? list.color : undefined }}
          >
            {list.name}
          </button>
        ))}
        <button
          onClick={() => { setEditingList(null); setShowDialog(true); }}
          className="px-2 py-1 text-xs text-slate-400 hover:text-primary"
        >
          +
        </button>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded shadow-lg py-1 text-xs"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button onClick={handleEdit} className="block w-full text-left px-4 py-1.5 hover:bg-slate-100">编辑</button>
          <button onClick={handleDelete} className="block w-full text-left px-4 py-1.5 hover:bg-slate-100 text-red-600">删除</button>
        </div>
      )}

      <ListConfigDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        initial={editingList}
        onSave={(config) => {
          if (editingList) {
            onUpdate(editingList.id, config);
          } else {
            onCreate(config);
          }
        }}
      />
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/watchlist/watchlist-tabs.tsx app/components/watchlist/list-config-dialog.tsx
git commit -m "feat(trading): add watchlist tabs and list config dialog"
```

---

## Task 9: 自选组件 - 列配置面板 & 组合表现

**Files:**
- Create: `app/components/watchlist/watchlist-column-config.tsx`
- Create: `app/components/watchlist/portfolio-summary.tsx`

- [ ] **Step 1: 创建 `app/components/watchlist/watchlist-column-config.tsx`**

```typescript
"use client";

import { useState } from "react";
import { COLUMN_DEFINITIONS, type WatchlistColumnKey } from "./types";

interface WatchlistColumnConfigProps {
  selected: WatchlistColumnKey[];
  onChange: (columns: WatchlistColumnKey[]) => void;
}

export function WatchlistColumnConfig({ selected, onChange }: WatchlistColumnConfigProps) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);

  const categories = Array.from(new Set(COLUMN_DEFINITIONS.map((c) => c.category)));

  function toggle(key: WatchlistColumnKey) {
    if (selectedSet.has(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 text-slate-400 hover:text-slate-600 text-sm"
        title="列设置"
      >
        ⚙
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-4 w-[360px] max-h-[400px] overflow-auto">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-medium">选择显示列</span>
            <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">关闭</button>
          </div>

          {categories.map((cat) => (
            <div key={cat} className="mb-3">
              <div className="text-xs text-slate-400 mb-1">{cat}</div>
              <div className="flex flex-wrap gap-1">
                {COLUMN_DEFINITIONS.filter((c) => c.category === cat).map((col) => (
                  <button
                    key={col.key}
                    onClick={() => toggle(col.key)}
                    className={`px-2 py-0.5 text-xs rounded border ${
                      selectedSet.has(col.key)
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建 `app/components/watchlist/portfolio-summary.tsx`**

```typescript
"use client";

import type { MarketQuote } from "@/lib/types";

interface PortfolioSummaryProps {
  quotes: Map<string, MarketQuote>;
  symbols: string[];
}

export function PortfolioSummary({ quotes, symbols }: PortfolioSummaryProps) {
  if (symbols.length === 0) return null;

  let totalChangePct = 0;
  let upCount = 0;
  let downCount = 0;
  let flatCount = 0;
  let validCount = 0;

  for (const symbol of symbols) {
    const q = quotes.get(symbol);
    if (!q) continue;
    validCount++;
    totalChangePct += q.change_pct;
    if (q.change_pct > 0) upCount++;
    else if (q.change_pct < 0) downCount++;
    else flatCount++;
  }

  const avgChangePct = validCount > 0 ? totalChangePct / validCount : 0;
  const isPositive = avgChangePct >= 0;

  return (
    <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-4 text-xs">
      <span className="text-slate-500">组合今日表现：</span>
      <span className={`font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? "+" : ""}{avgChangePct.toFixed(2)}%
      </span>
      <span className="text-slate-400">|</span>
      <span className="text-green-600">↑{upCount}</span>
      <span className="text-red-600">↓{downCount}</span>
      <span className="text-slate-400">平{flatCount}</span>
      {validCount < symbols.length && (
        <span className="text-slate-300">({validCount}/{symbols.length} 已加载)</span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/watchlist/watchlist-column-config.tsx app/components/watchlist/portfolio-summary.tsx
git commit -m "feat(trading): add column config panel and portfolio summary"
```

---

## Task 10: 自选组件 - 行情表格 & 主组件

**Files:**
- Create: `app/components/watchlist/watchlist-table.tsx`
- Create: `app/components/watchlist/watchlist.tsx`

- [ ] **Step 1: 创建 `app/components/watchlist/watchlist-table.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import type { MarketQuote, OHLCV } from "@/lib/types";
import { COLUMN_DEFINITIONS, type WatchlistColumnKey } from "./types";
import { MiniKline } from "../ui/mini-kline";

interface WatchlistTableProps {
  symbols: Array<{ symbol: string; annotation: string }>;
  quotes: Map<string, MarketQuote>;
  columns: WatchlistColumnKey[];
}

export function WatchlistTable({ symbols, quotes, columns }: WatchlistTableProps) {
  const [klineCache, setKlineCache] = useState<Map<string, OHLCV[]>>(new Map());

  const showKline = columns.includes("miniKline");

  useEffect(() => {
    if (!showKline) return;
    const toFetch = symbols
      .map((s) => s.symbol)
      .filter((sym) => !klineCache.has(sym));
    if (toFetch.length === 0) return;

    Promise.all(
      toFetch.map(async (sym) => {
        try {
          const res = await fetch(`/api/market/kline?symbol=${sym}&interval=1d&limit=30`);
          const data = await res.json() as { klines: OHLCV[] };
          return { sym, klines: data.klines };
        } catch {
          return { sym, klines: [] };
        }
      })
    ).then((results) => {
      setKlineCache((prev) => {
        const next = new Map(prev);
        for (const { sym, klines } of results) {
          next.set(sym, klines);
        }
        return next;
      });
    });
  }, [symbols, showKline, klineCache]);

  const visibleCols = COLUMN_DEFINITIONS.filter((c) => columns.includes(c.key));

  function formatCell(key: WatchlistColumnKey, quote: MarketQuote | undefined, entry: { symbol: string; annotation: string }): React.ReactNode {
    if (key === "symbol") return entry.symbol;
    if (key === "annotation") return <span className="text-slate-500 truncate max-w-[180px] inline-block">{entry.annotation || "—"}</span>;
    if (key === "miniKline") {
      const klines = klineCache.get(entry.symbol);
      if (!klines || klines.length === 0) return <span className="text-slate-300">—</span>;
      return <MiniKline data={klines} width={70} height={20} />;
    }
    if (!quote) return "—";

    const value = quote[key as keyof MarketQuote];
    if (value === undefined || value === null) return "—";

    const col = COLUMN_DEFINITIONS.find((c) => c.key === key);
    if (!col) return String(value);

    const num = typeof value === "number" ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value);

    switch (col.render) {
      case "percent": {
        const cls = num > 0 ? "text-green-600" : num < 0 ? "text-red-600" : "";
        return <span className={cls}>{num > 0 ? "+" : ""}{num.toFixed(2)}%</span>;
      }
      case "currency":
        return num >= 10000 ? `${(num / 10000).toFixed(2)}万` : num.toFixed(2);
      case "number":
        return num >= 1_000_000 ? `${(num / 1_000_000).toFixed(2)}M` : num >= 1000 ? `${(num / 1000).toFixed(1)}K` : num.toFixed(2);
      default:
        return String(value);
    }
  }

  return (
    <div className="overflow-auto flex-1">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-white border-b border-slate-100">
          <tr>
            {visibleCols.map((col) => (
              <th key={col.key} className={`px-2 py-1.5 font-medium text-slate-500 whitespace-nowrap text-${col.align}`} style={{ width: col.width }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {symbols.map((entry) => {
            const quote = quotes.get(entry.symbol);
            return (
              <tr key={entry.symbol} className="border-b border-slate-50 hover:bg-slate-50">
                {visibleCols.map((col) => (
                  <td key={col.key} className={`px-2 py-1.5 whitespace-nowrap text-${col.align}`}>
                    {formatCell(col.key, quote, entry)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {symbols.length === 0 && (
        <div className="flex items-center justify-center h-32 text-sm text-slate-400">
          暂无标的，通过搜索或 AI 添加
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建 `app/components/watchlist/watchlist.tsx`**

```typescript
"use client";

import { useMemo } from "react";
import { useWatchlists } from "@/app/hooks/use-watchlists";
import { useMarketQuote } from "@/app/hooks/use-market-quote";
import { WatchlistTabs } from "./watchlist-tabs";
import { WatchlistTable } from "./watchlist-table";
import { WatchlistColumnConfig } from "./watchlist-column-config";
import { PortfolioSummary } from "./portfolio-summary";
import { DEFAULT_COLUMNS, type WatchlistColumnKey } from "./types";

interface WatchlistProps {
  workspacePath?: string;
}

export function Watchlist({ workspacePath }: WatchlistProps) {
  const {
    lists, activeList, activeListId, setActiveListId,
    loading, createList, updateList, deleteList,
  } = useWatchlists(workspacePath);

  const symbols = useMemo(() => activeList?.symbols.map((s) => s.symbol) ?? [], [activeList]);
  const refreshInterval = activeList?.refresh_interval ? activeList.refresh_interval * 1000 : 5000;

  const { quotes } = useMarketQuote({
    symbols,
    interval: refreshInterval,
    enabled: symbols.length > 0,
  });

  const columns: WatchlistColumnKey[] = (activeList?.column_config?.length ?? 0) > 0
    ? (activeList!.column_config as WatchlistColumnKey[])
    : DEFAULT_COLUMNS;

  function handleColumnChange(newColumns: WatchlistColumnKey[]) {
    if (activeListId) {
      updateList(activeListId, { column_config: newColumns });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pr-3">
        <WatchlistTabs
          lists={lists}
          activeListId={activeListId}
          onSelect={setActiveListId}
          onCreate={createList}
          onUpdate={updateList}
          onDelete={deleteList}
        />
        <div className="flex items-center gap-1">
          <WatchlistColumnConfig selected={columns} onChange={handleColumnChange} />
          <button
            onClick={() => { /* trigger refresh */ }}
            className="p-1 text-slate-400 hover:text-slate-600 text-sm"
            title="刷新"
          >
            🔄
          </button>
        </div>
      </div>

      <PortfolioSummary quotes={quotes} symbols={symbols} />

      <WatchlistTable
        symbols={activeList?.symbols ?? []}
        quotes={quotes}
        columns={columns}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/watchlist/watchlist-table.tsx app/components/watchlist/watchlist.tsx
git commit -m "feat(trading): add watchlist table and main watchlist component"
```

---

## Task 11: 扩展 ChartArea Tab Bar

**Files:**
- Modify: `app/components/chart-area.tsx`

- [ ] **Step 1: 修改 `chart-area.tsx` 添加新 tab 和组件导入**

将 `activeTab` 类型从 `"kline" | "nav"` 扩展为 `"kline" | "nav" | "leaderboard" | "watchlist"`，在 tab bar 追加两个按钮，在内容区添加对应的组件渲染。

修改后的完整文件：

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import type { ExchangeId, NavPoint } from "@/lib/types";
import { toTradingViewSymbol } from "@/lib/tradingview";
import { NavChart } from "./nav-chart";
import dynamic from "next/dynamic";
import { Leaderboard } from "./leaderboard/leaderboard";
import { Watchlist } from "./watchlist/watchlist";

const ReplayKlineChart = dynamic(() => import("./replay-kline-chart"), { ssr: false });
import { useSessionState } from "@/app/context/session-state-context";

type ChartTab = "kline" | "nav" | "leaderboard" | "watchlist";

interface ChartAreaProps {
  sessionId: string;
  symbols: string[];
  exchange: ExchangeId;
  navHistory: NavPoint[];
  initialNav: number;
  workspacePath?: string;
}

export function ChartArea({ sessionId, symbols, exchange, navHistory: propNavHistory, initialNav: propInitialNav, workspacePath }: ChartAreaProps) {
  const { state, mode } = useSessionState();
  const navHistory = state.nav_history.length > 0 ? state.nav_history : propNavHistory;
  const initialNav = Object.keys(state.initial_balance).length > 0
    ? Object.values(state.initial_balance).reduce((s, v) => s + v, 0)
    : propInitialNav;
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<ChartTab>("kline");
  const [selectedSymbol, setSelectedSymbol] = useState((symbols ?? [])[0] ?? "BTCUSDT");

  useEffect(() => {
    if (activeTab !== "kline" || mode === "replay" || !containerRef.current) return;

    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: toTradingViewSymbol(exchange, selectedSymbol),
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
    });

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";

    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.height = "100%";
    inner.style.width = "100%";

    wrapper.appendChild(inner);
    wrapper.appendChild(script);
    containerRef.current.appendChild(wrapper);
  }, [activeTab, selectedSymbol, exchange, mode]);

  const tabs: { key: ChartTab; label: string }[] = [
    { key: "kline", label: "行情图表" },
    { key: "nav", label: "净值曲线" },
    { key: "leaderboard", label: "榜单" },
    { key: "watchlist", label: "自选" },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col border-b border-slate-200">
      <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-sm pb-1 ${activeTab === tab.key ? "text-primary border-b-2 border-primary font-medium" : "text-slate-500"}`}
            >
              {tab.label}
            </button>
          ))}
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
      <div className="flex-1 min-h-0">
        {activeTab === "kline" ? (
          mode === "replay" ? (
            <ReplayKlineChart symbol={selectedSymbol} />
          ) : (
            <div ref={containerRef} className="h-full w-full" />
          )
        ) : activeTab === "nav" ? (
          <NavChart navHistory={navHistory} initialNav={initialNav} />
        ) : activeTab === "leaderboard" ? (
          <Leaderboard />
        ) : (
          <Watchlist workspacePath={workspacePath} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/chart-area.tsx
git commit -m "feat(trading): extend ChartArea with leaderboard and watchlist tabs"
```

---

## Task 12: Agent Actions 注册

**Files:**
- Modify: `app/components/viben-action-provider.tsx`

- [ ] **Step 1: 在 `viben-action-provider.tsx` 的 actions useMemo 中追加 watchlist actions**

在现有 `replay_seek` action 后面追加以下 action 定义：

```typescript
      // --- Watchlist Actions ---

      "watchlist.getLists": {
        description: "获取所有自选列表摘要",
        execute: async () => {
          const res = await fetch(`/api/watchlist`);
          const data = await res.json();
          return data.lists;
        },
      },

      "watchlist.getList": {
        description: "获取单个自选列表详情（标的+配置）",
        inputSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "列表 ID" },
          },
          required: ["list_id"],
        },
        execute: async (payload: unknown) => {
          const p = payload as { list_id: string };
          const res = await fetch(`/api/watchlist/${p.list_id}`);
          if (!res.ok) throw new Error("List not found");
          const data = await res.json();
          return data.list;
        },
      },

      "watchlist.createList": {
        description: "创建新的自选列表",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "列表名称" },
            color: { type: "string", description: "标签颜色（hex）" },
            refresh_interval: { type: "number", description: "刷新周期（秒）" },
            refresh_prompt: { type: "string", description: "AI 刷新指令" },
          },
          required: ["name"],
        },
        execute: async (payload: unknown) => {
          const p = payload as { name: string; color?: string; refresh_interval?: number; refresh_prompt?: string };
          const res = await fetch("/api/watchlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          });
          const data = await res.json();
          return data.list;
        },
      },

      "watchlist.deleteList": {
        description: "删除自选列表",
        inputSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "列表 ID" },
          },
          required: ["list_id"],
        },
        execute: async (payload: unknown) => {
          const p = payload as { list_id: string };
          const res = await fetch(`/api/watchlist/${p.list_id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Delete failed");
          return "Deleted";
        },
      },

      "watchlist.updateList": {
        description: "修改自选列表配置（名称、颜色、刷新周期、prompt）",
        inputSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "列表 ID" },
            name: { type: "string", description: "新名称" },
            color: { type: "string", description: "新颜色" },
            refresh_interval: { type: "number", description: "新刷新周期" },
            refresh_prompt: { type: "string", description: "新 AI 指令" },
          },
          required: ["list_id"],
        },
        execute: async (payload: unknown) => {
          const p = payload as { list_id: string; [key: string]: unknown };
          const { list_id, ...updates } = p;
          const res = await fetch(`/api/watchlist/${list_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });
          const data = await res.json();
          return data.list;
        },
      },

      "watchlist.addSymbols": {
        description: "向自选列表添加标的",
        inputSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "列表 ID" },
            symbols: { type: "array", items: { type: "string" }, description: "要添加的标的代码列表" },
          },
          required: ["list_id", "symbols"],
        },
        execute: async (payload: unknown) => {
          const p = payload as { list_id: string; symbols: string[] };
          const res = await fetch(`/api/watchlist/${p.list_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "add_symbols", symbols: p.symbols }),
          });
          const data = await res.json();
          return data.list;
        },
      },

      "watchlist.removeSymbols": {
        description: "从自选列表移除标的",
        inputSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "列表 ID" },
            symbols: { type: "array", items: { type: "string" }, description: "要移除的标的代码列表" },
          },
          required: ["list_id", "symbols"],
        },
        execute: async (payload: unknown) => {
          const p = payload as { list_id: string; symbols: string[] };
          const res = await fetch(`/api/watchlist/${p.list_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "remove_symbols", symbols: p.symbols }),
          });
          const data = await res.json();
          return data.list;
        },
      },

      "watchlist.setAnnotation": {
        description: "设置标的的 AI 标注",
        inputSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "列表 ID" },
            symbol: { type: "string", description: "标的代码" },
            annotation: { type: "string", description: "标注文本" },
          },
          required: ["list_id", "symbol", "annotation"],
        },
        execute: async (payload: unknown) => {
          const p = payload as { list_id: string; symbol: string; annotation: string };
          const res = await fetch(`/api/watchlist/${p.list_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "set_annotation", symbol: p.symbol, annotation: p.annotation }),
          });
          if (!res.ok) throw new Error("Set annotation failed");
          return "Annotation set";
        },
      },
```

- [ ] **Step 2: Commit**

```bash
git add app/components/viben-action-provider.tsx
git commit -m "feat(trading): register watchlist agent actions"
```

---

## Task 13: 传递 workspacePath 到 ChartArea

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 在 page.tsx 中读取 URL searchParams 的 workspace_path 并传递给 ChartArea**

page.tsx 现有 Props 接口定义了 `searchParams: Promise<{ session?: string; create?: string }>`。需要：

1. 扩展 searchParams 类型添加 `workspace_path?: string`：

```typescript
interface Props {
  searchParams: Promise<{ session?: string; create?: string; workspace_path?: string }>;
}
```

2. 解构时获取 `workspace_path`：

```typescript
const { session, create, workspace_path } = await searchParams;
```

3. 传递给 ChartArea：

```typescript
<ChartArea
  sessionId={sessionId}
  symbols={symbols}
  exchange={exchange}
  navHistory={navHistory}
  initialNav={initialNav}
  workspacePath={workspace_path}
/>
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat(trading): pass workspace_path to ChartArea for watchlist storage"
```

---

## Task 14: COLUMN_DEFINITIONS 补全缺失项

**Files:**
- Modify: `app/components/watchlist/types.ts`

- [ ] **Step 1: 在 Task 1 创建的 COLUMN_DEFINITIONS 数组中添加 upperLimit 和 lowerLimit**

在 `COLUMN_DEFINITIONS` 数组中 `prevClose` 之后添加：

```typescript
  { key: "upperLimit", label: "涨停价", category: "基础价格", width: 80, align: "right", render: "currency" },
  { key: "lowerLimit", label: "跌停价", category: "基础价格", width: 80, align: "right", render: "currency" },
```

- [ ] **Step 2: Commit**

```bash
git add app/components/watchlist/types.ts
git commit -m "fix(trading): add missing upperLimit/lowerLimit to column definitions"
```

---

## Follow-up Tasks (不在本轮实现)

以下功能在 spec 中定义但依赖更深层的 agent runtime 集成，留作下一轮迭代：

1. **Agent 自动刷新 loop**：按 `refresh_interval` 定时触发 agent 执行 `refresh_prompt`，agent 通过 watchlist actions 自动增删标的和标注。当前 plan 仅实现了行情数据的定时轮询，agent 驱动的刷新需要与 viben-agent 的 session 机制对接。

2. **组合表现展开查看 NavChart**：spec 中 "可点击展开查看组合净值曲线（复用 NavChart）"。当前 `portfolio-summary.tsx` 仅展示汇总数据，展开功能需要计算组合历史净值序列（需要历史行情数据支撑），作为后续增强。
