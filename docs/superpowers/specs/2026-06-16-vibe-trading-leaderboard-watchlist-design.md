# Vibe Trading - 榜单 & 自选 Tab 设计

## 概述

在 `pages/vibe-trading` 的 ChartArea 组件中，现有 "行情图表 | 净值曲线" tab bar 右侧追加 "榜单 | 自选" 两个 tab。采用扁平扩展方案（方案 A），四个 tab 共用一个 `activeTab` state，切换时内容区整体替换。

## Tab Bar 扩展

现有 `chart-area.tsx` 的 tab 从 `"kline" | "nav"` 扩展为：

```typescript
type ChartTab = "kline" | "nav" | "leaderboard" | "watchlist";
```

| Tab 值 | 显示名称 | 内容组件 |
|--------|---------|---------|
| `kline` | 行情图表 | TradingView embed（现有） |
| `nav` | 净值曲线 | NavChart canvas（现有） |
| `leaderboard` | 榜单 | `<Leaderboard />` |
| `watchlist` | 自选 | `<Watchlist />` |

## 榜单（Leaderboard）

### 数据来源

从本地 session 历史中计算各策略/session 的绩效指标。通过 Gateway `/api/leaderboard` 路由获取。

### 表格列

| 列 | 说明 |
|----|------|
| 排名 | 序号，前3名带奖牌图标 |
| 策略名称 | session name |
| 累计收益率 | 百分比，涨绿跌红 |
| 最大回撤 | 百分比 |
| 夏普比率 | 数值 |
| 胜率 | 百分比 |
| 盈亏比 | 数值 |
| 日均收益 | 百分比 |
| 净值曲线 | mini sparkline |
| 标的数量 | 数字 |
| 最近操作时间 | 相对时间 |
| 运行时长 | 天数 |
| 操作次数 | 数字 |
| 操作 | "复制策略"按钮 |

### 交互

- 点击行可展开查看策略详情（标的列表、参数配置）
- "复制策略"按钮：复制该 session 的策略配置，创建新 session
- 表头可点击排序（切换排序字段）
- 默认按累计收益率降序排列

## 自选（Watchlist）

### 整体布局

```
┌─────────────────────────────────────────────────┐
│ [Tab1] [Tab2] [Tab3] [+]        列设置⚙ 刷新🔄 │  ← 子 tab 列表（选股列表）
├─────────────────────────────────────────────────┤
│ 📊 组合今日表现：+2.35%  ↑12 ↓3 平5            │  ← 置顶：虚拟组合标的
├─────────────────────────────────────────────────┤
│ 代码  名称  最新价  涨跌幅  成交量  mini K线 ...│  ← 表格（可配置列）
│ AAPL  苹果  189.2   +1.2%   32M    ~~~         │
│ BTC   比特币 67800  -0.5%   1.2B   ~~~         │
│ ...                                             │
└─────────────────────────────────────────────────┘
```

### 子 Tab（选股列表）

每个 tab 对应一个选股列表，拥有独立配置：

- `name`：名称
- `color`：标签颜色（tab 下边框/指示色）
- `refreshInterval`：自动刷新周期（秒）
- `refreshPrompt`：刷新时 AI 执行的 prompt（增删标的 + 评估标注）
- `symbols`：标的列表
- `columnConfig`：该列表独立的列显示配置

操作：
- 点击 [+] 新建列表
- 右键/长按 tab 编辑名称、颜色、刷新配置，或删除列表

### 置顶组合表现

将当前列表的所有标的等权组合，计算今日虚拟表现：
- 显示：组合涨跌幅、上涨/下跌/平盘标的数
- 可点击展开查看组合净值曲线（复用 NavChart）

### 表格列

默认显示列：代码、名称、最新价、涨跌幅、涨跌额、成交量、成交额、换手率、mini K线、AI 标注

完整可选列（用户通过 ⚙ 按钮多选勾选）：

#### 基础价格
- `symbol` 代码 | `name` 名称 | `lastPrice` 最新价 | `openPrice` 开盘价 | `highPrice` 最高价 | `lowPrice` 最低价 | `prevClose` 昨收价 | `vwap` 均价(VWAP) | `upperLimit` 涨停价 | `lowerLimit` 跌停价

#### 涨跌指标
- `change` 涨跌额 | `changePct` 涨跌幅 | `amplitude` 振幅 | `gapPct` 跳空幅度

#### 成交量
- `volume` 成交量 | `volumeRatio` 量比 | `turnover` 成交额 | `turnoverRate` 换手率 | `avgVolume5d` 5日均量 | `avgVolume10d` 10日均量 | `relativeVolume` 相对成交量 | `netVolume` 净买量 | `openInterest` 持仓量

#### 买卖盘
- `bidPrice1` 买一价 | `askPrice1` 卖一价 | `spread` 买卖价差 | `spreadPct` 买卖价差率 | `bidAskRatio` 买卖比 | `tradeCount` 成交笔数

#### 技术指标 - 均线
- `ma5` MA5 | `ma10` MA10 | `ma20` MA20 | `ma60` MA60 | `ma120` MA120 | `ma250` MA250 | `ema20` EMA20 | `ema50` EMA50 | `ema200` EMA200 | `priceMa5Pct` 偏离MA5 | `priceMa20Pct` 偏离MA20

#### 技术指标 - 动量与振荡
- `macdDif` MACD-DIF | `macdDea` MACD-DEA | `macdHistogram` MACD柱 | `rsi6` RSI6 | `rsi14` RSI14 | `kdjK` KDJ-K | `kdjD` KDJ-D | `kdjJ` KDJ-J | `cci14` CCI14 | `williamR14` W%R14 | `mfi14` MFI14 | `obv` OBV

#### 技术指标 - 趋势与通道
- `bollUpper` 布林上轨 | `bollMiddle` 布林中轨 | `bollLower` 布林下轨 | `bollWidth` 布林带宽 | `atr14` ATR14 | `adx14` ADX14 | `parabolicSar` SAR

#### 波动率
- `historicalVol10d` 历史波动率10日 | `historicalVol20d` 历史波动率20日 | `beta` Beta | `sharpeRatio` 夏普比率 | `maxDrawdown` 最大回撤

#### 区间表现
- `return1d` 1日涨幅 | `return5d` 5日涨幅 | `return1m` 1月涨幅 | `return3m` 3月涨幅 | `return6m` 6月涨幅 | `return1y` 1年涨幅 | `returnYtd` 年初至今 | `high52w` 52周最高 | `low52w` 52周最低 | `pctFrom52wHigh` 距52周高点 | `pctFrom52wLow` 距52周低点

#### 相对强弱
- `rsRating` RS评级 | `sectorRank` 板块排名 | `industryRank` 行业排名

#### 基本面 - 估值
- `marketCap` 总市值 | `floatMarketCap` 流通市值 | `peRatioTtm` PE(TTM) | `pbRatio` PB | `psRatioTtm` PS(TTM) | `evEbitda` EV/EBITDA | `pegRatio` PEG

#### 基本面 - 每股指标
- `eps` EPS | `bookValuePerShare` 每股净资产 | `dividendYield` 股息率 | `dividendPerShare` 每股股息

#### 基本面 - 成长与质量
- `revenueGrowthYoy` 营收增速(YoY) | `netIncomeGrowthYoy` 净利润增速(YoY) | `grossMargin` 毛利率 | `netMargin` 净利率 | `roe` ROE | `roa` ROA | `debtToEquity` 负债权益比

#### 加密货币专属
- `circulatingSupply` 流通供应量 | `totalSupply` 总供应量 | `fullyDilutedValuation` FDV | `fundingRate` 资金费率 | `longShortRatio` 多空比 | `stakingYield` 质押收益率

#### 分析师
- `analystRating` 分析师评级 | `priceTarget` 目标价 | `priceTargetUpside` 目标价空间 | `nextEarningsDate` 下次财报日

#### 其他
- `exchange` 交易所 | `sector` 板块 | `industry` 行业 | `lastUpdateTime` 最后更新时间 | `notes` 备注 | `tags` 标签 | `annotation` AI标注 | `watchlistAddedAt` 加入自选时间

### Mini K 线

每行内嵌一个小型 K 线/sparkline 图，展示最近 30 根日 K 线走势。扩展现有 `mini-sparkline.tsx` 组件或新建 `mini-kline.tsx` 支持 K 线样式。

## Agent Action 接口

作用范围：仅操作"自选"模块，可管理列表及列表内标的，也可修改列表配置。

| Action | 参数 | 说明 |
|--------|------|------|
| `watchlist.createList` | `{name, color?, refresh_interval?, refresh_prompt?}` | 创建新选股列表 |
| `watchlist.deleteList` | `{list_id}` | 删除选股列表 |
| `watchlist.updateList` | `{list_id, name?, color?, refresh_interval?, refresh_prompt?}` | 修改列表配置 |
| `watchlist.addSymbols` | `{list_id, symbols: string[]}` | 向列表添加标的 |
| `watchlist.removeSymbols` | `{list_id, symbols: string[]}` | 从列表移除标的 |
| `watchlist.setAnnotation` | `{list_id, symbol, annotation: string}` | 设置标的 AI 标注 |
| `watchlist.getList` | `{list_id}` | 查询列表详情（标的+配置） |
| `watchlist.getLists` | `{}` | 查询所有列表摘要 |

### 自动刷新流程

1. 按 `refresh_interval` 触发
2. 将当前列表的 symbols + `refresh_prompt` 发送给 agent
3. Agent 通过上述 action 自行增删标的、设置标注
4. 刷新完成后更新 UI

## 数据持久化

### 存储路径

- 默认：`~/.viben/shared/watchlists/`
- 有 workspace：`{workspace_path}/.viben/shared/watchlists/`

路径通过 URL query param `workspace_path` 决定。

### 文件结构

每个选股列表一个 YAML 文件：

```yaml
# ~/.viben/shared/watchlists/tech-leaders.yaml
name: "科技龙头"
color: "#0891B2"
refresh_interval: 300
refresh_prompt: "筛选市值前10的科技股，标注近期利好利空"
symbols:
  - symbol: "AAPL"
    annotation: "Q4财报超预期，目标价上调"
    added_at: "2026-06-15T10:00:00Z"
  - symbol: "NVDA"
    annotation: ""
    added_at: "2026-06-15T10:00:00Z"
column_config:
  - lastPrice
  - changePct
  - volume
  - turnoverRate
  - miniKline
  - annotation
```

## 行情数据接入

### vibe-trading App API Routes

行情数据路由放在 vibe-trading 自身的 Next.js API routes 中（`pages/vibe-trading/app/api/`），不走 Gateway。

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/market/quote` | GET | 批量行情，`?symbols=AAPL,BTC&fields=lastPrice,changePct,...` |
| `/api/market/kline` | GET | K 线数据，`?symbol=AAPL&interval=1d&limit=30` |
| `/api/market/search` | GET | 搜索标的，`?q=苹果` |
| `/api/leaderboard` | GET | 榜单数据，从 session 历史计算绩效排行 |

后端对接外部行情 API（币安、东财等），做数据格式统一和缓存。

### 刷新策略

- 自选列表按各自 `refresh_interval` 独立轮询 `/api/market/quote`
- 行情数据前端缓存，相同 symbol 跨列表共享
- Mini K 线数据加载一次后缓存，不随行情轮询刷新（用户手动刷新或切换 tab 时更新）

## 文件结构

新增文件（均在 `pages/vibe-trading/app/components/` 下）：

```
components/
├── chart-area.tsx                 ← 修改：扩展 tab 类型
├── leaderboard/
│   ├── leaderboard.tsx            ← 榜单主组件
│   ├── leaderboard-table.tsx      ← 排行表格
│   └── copy-strategy-button.tsx   ← 复制策略按钮
├── watchlist/
│   ├── watchlist.tsx              ← 自选主组件
│   ├── watchlist-tabs.tsx         ← 子 tab 列表管理
│   ├── watchlist-table.tsx        ← 行情数据表格
│   ├── watchlist-column-config.tsx← 列配置面板
│   ├── portfolio-summary.tsx      ← 置顶组合今日表现
│   ├── list-config-dialog.tsx     ← 列表编辑弹窗（名称/颜色/刷新/prompt）
│   └── types.ts                   ← 类型定义
└── ui/
    └── mini-kline.tsx             ← mini K 线组件
```

### 状态管理

- `chart-area.tsx` 的 `activeTab` 扩展为 4 值 union type
- 自选数据用 `useState` + context 管理（列表配置 + 行情数据分离）
- 行情数据通过自定义 hook `useMarketQuote(symbols)` 管理轮询和缓存

### Action 注册

在 `viben-action-provider.tsx` 中新增 watchlist 相关 action。
