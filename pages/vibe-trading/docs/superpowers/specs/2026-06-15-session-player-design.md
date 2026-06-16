# SessionPlayer 接口设计

## 背景

当前回放逻辑散落在 `SessionStateProvider`（React context）中，与 live WebSocket、UI 状态紧耦合。每次 `step()` 都调用 `computeStateAtIndex` 从头遍历所有事件（O(N)），图表数据通过独立的 `getReplayCandles` 计算。这导致：

1. 回放逻辑不可独立测试
2. 性能差（每步 O(N)）
3. session 状态和图表数据走两条路径，容易不一致

## 目标

设计一个框架无关的纯逻辑类 `SessionPlayer`，统一管理回放状态和图表数据。React 侧通过薄 hook 包装消费。

## 接口定义

```typescript
import type { CandlestickData, SeriesMarker, Time } from "lightweight-charts";
import type { SessionEvent, SessionState } from "@/lib/types";
import type { PriceLineConfig } from "@/app/lib/replay-klines";

interface SessionPlayerOptions {
  events: SessionEvent[];
  initialIndex?: number;  // 默认 events.length - 1
}

interface ChartSnapshot {
  candles: CandlestickData<Time>[];
  intervalMs: number;
  markers: SeriesMarker<Time>[];
  priceLines: PriceLineConfig[];
}

class SessionPlayer {
  constructor(options: SessionPlayerOptions);

  // ─── 控制 ────────────────────────────────────────
  seek(index: number): void;
  step(): void;
  stepBack(): void;
  appendEvents(events: SessionEvent[]): void;

  // ─── 只读状态 ────────────────────────────────────
  get currentIndex(): number;
  get totalEvents(): number;
  get currentEvent(): SessionEvent | undefined;
  get state(): SessionState;
  get currentTs(): string;

  // ─── 图表数据 ────────────────────────────────────
  getChartData(symbol: string): ChartSnapshot;
}
```

## 语义约束

| 规则 | 说明 |
|------|------|
| 幂等 | 任何路径到达同一 `currentIndex`，`state` 和 `getChartData(symbol)` 结果完全相同 |
| 增量前进 | `step()` 和 `seek(n > currentIndex)` 增量 apply events（O(delta)） |
| 全量后退 | `stepBack()` 和 `seek(n < currentIndex)` 从头重放到 n（O(N)） |
| 追加不移动 | `appendEvents()` 增长 `totalEvents` 但不改变 `currentIndex` |
| 图表快照 | `getChartData(symbol)` 使用"最近 market_context 快照"语义，不跨事件合并 |

## 内部实现策略

### State 管理

```
内部字段:
  _events: SessionEvent[]         // 完整事件流（可 append）
  _currentIndex: number           // 当前游标
  _state: SessionState            // currentIndex 处的 session 状态（缓存）
```

- **前进（step）**：`_state = reduceEvent(_state, _events[_currentIndex + 1])`，O(1)
- **后退/seek**：`_state = computeFromScratch(_events, targetIndex)`，O(N)
- **seek 前进**：如果 `targetIndex > _currentIndex`，循环 apply events[current+1..target]，O(delta)

### 图表数据

`getChartData(symbol)` 内部调用已有的纯函数：
- `getReplayCandles(events, symbol, currentIndex)` → candles + intervalMs
- `buildTradeMarkers(state.trades, symbol, currentTs, intervalMs)` → markers
- `buildPriceLines(state.positions, symbol)` → priceLines

这些函数已通过真实数据测试验证幂等性。

### appendEvents

```typescript
appendEvents(newEvents: SessionEvent[]): void {
  this._events.push(...newEvents);
  // _currentIndex 和 _state 不变
}
```

调用者可在 append 后调用 `step()` 前进到新事件。

## 文件结构

```
lib/
  session-player.ts          // SessionPlayer class
  session-player.test.ts     // 测试（使用真实 session 数据）
  state-reducer.ts           // 已有，createEmptyState + reduceEvent
app/
  lib/replay-klines.ts       // 已有，getReplayCandles + buildTradeMarkers + buildPriceLines
  hooks/use-session-player.ts  // React hook wrapper（未来）
```

## 测试计划

使用真实 session 文件 `sessions/ses_ZFkpnQYi.jsonl`（451 事件）：

1. **幂等性**：`seek(n)` 后的 `state` 与从头 `computeStateAtIndex(events, n)` 结果相同
2. **增量一致**：连续 `step()` N 次 vs 直接 `seek(N)`，结果相同
3. **后退正确**：`step()` 3 次然后 `stepBack()` 1 次 = `seek(2)` 的结果
4. **图表幂等**：同一 index 的 `getChartData()` 多次调用结果相同
5. **图表连续性**：两个非 `market_context` 帧之间 `getChartData()` 结果相同
6. **appendEvents**：追加后 `currentIndex` 不变，`totalEvents` 增长，追加的事件可通过 `step()` 到达
7. **边界**：index=0、index=totalEvents-1、空 events 数组

## 与现有代码的关系

`SessionPlayer` 最终将替代 `SessionStateProvider` 中的 replay 部分。迁移路径：

1. 先实现 `SessionPlayer` + 测试
2. 在 `SessionStateProvider` 中内部使用 `SessionPlayer`（回放模式时委托给它）
3. 逐步将 live 模式也纳入（未来，不在本次范围内）

## 不在范围内

- Live WebSocket 管理
- 播放定时器（play/pause/speed）— 这是 UI 层关注点，由 hook 或 context 基于 `step()` 实现
- 图表渲染（lightweight-charts 实例管理）
