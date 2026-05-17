# Card Size System Design

## Overview

重构 presentation 包中的图表/信息图类 overlay 卡片尺寸系统。引入 3 种标准尺寸模式（小/中/大），保证主要文字最小 16px，基于 1920x1080 参考分辨率设计，实际 viewport 不同时自动缩放。

## 约束

- 参考分辨率: 1920 × 1080
- 页面边距 (margin): 32px
- 卡片间距 (gap): 16px
- 可用区域: 1856 × 1016
- 主要文字（title/value/label）≥ 16px，次要文字（axis tick/小标注）≥ 14px
- 向后兼容: 旧 command 不传 `cardSize` 时保持原有默认尺寸不变

## 尺寸定义

| 模式 | 布局 | 宽度 (px) | 高度 (px) | 宽高比 |
|------|------|-----------|-----------|--------|
| sm   | 3×3  | 608       | 328       | 1.85:1 |
| md   | 2×2  | 920       | 500       | 1.84:1 |
| lg   | 1×1  | 1856      | 1016      | 1.83:1 |

计算公式: `(available - gap × (n-1)) / n`
- sm: `(1856 - 16×2) / 3 = 608`, `(1016 - 16×2) / 3 = 328`
- md: `(1856 - 16×1) / 2 = 920`, `(1016 - 16×1) / 2 = 500`
- lg: `1856`, `1016`

### 方形 overlay 变体

部分 overlay 本质是正方形（Gauge、Donut、Radar、PolarArea）。对这些 overlay，实际使用 `min(width, height)` 作为正方形边长，居中放置于卡片区域内：

| 模式 | 正方形边长 |
|------|-----------|
| sm   | 328       |
| md   | 500       |
| lg   | 1016      |

## 类型修改

### 新增公共字段

```typescript
// 添加到所有受影响的 command 类型
cardSize?: "sm" | "md" | "lg"
```

字段命名为 `cardSize`（非 `size`），避免与 RadarCommand、DonutCommand、PolarAreaCommand 已有的 `size: number` 字段冲突。

### 受影响的 Command 类型（22个）

**数据可视化类（17个）**:
ChartCommand, GaugeCommand, SparklineCommand, HeatmapCommand, FunnelCommand, WaterfallCommand, RadarCommand, SankeyCommand, TreemapCommand, DonutCommand, StatCardCommand, KpiCommand, ScatterCommand, StackedBarCommand, MeterCommand, RibbonCommand, PolarAreaCommand

**结构/叙事类（5个）**:
TableCommand, MatrixCommand, FlowchartCommand, TimelineCommand, ComparisonCommand

**不纳入的 overlay（排除理由）**:
- Spotlight, Arrow, Text, Circle, Highlight, Pulse, Underline, Bracket, Trendline — 标注型，尺寸取决于目标元素
- Card, Badge, Callout, Tooltip, BadgeGroup — 文本气泡型，大小由内容撑开
- Progress, Counter, List — 行内型，非卡片
- Confetti, Countdown, Reveal, Zoom, Morph — 动效型，无固定卡片
- AnnotationGroup, CodeBlock — 特殊布局，不适用标准卡片

### 优先级规则

1. `width`/`height` 都存在 → 直接使用，`mode` 从最接近的档位推断
2. 仅 `width` 或仅 `height` → 用存在的那个 + 对应模式的宽高比补全另一个
3. 仅 `cardSize` 存在 → 查表 `CARD_SIZES[cardSize]`
4. 都不存在 → **返回 null，overlay 使用自身原有默认值**（保持向后兼容）

## 新文件

### `src/utils/card-sizes.ts`

```typescript
export const REFERENCE_VIEWPORT = { width: 1920, height: 1080 } as const
export const PAGE_MARGIN = 32
export const CARD_GAP = 16

export const CARD_SIZES = {
  sm: { width: 608, height: 328 },
  md: { width: 920, height: 500 },
  lg: { width: 1856, height: 1016 },
} as const

export type CardSizeMode = "sm" | "md" | "lg"
```

### `src/utils/card-layout.ts`

```typescript
export interface CardLayout {
  mode: CardSizeMode
  fontSize: {
    title: number    // sm: 18, md: 22, lg: 32
    value: number    // sm: 20, md: 28, lg: 42
    label: number    // sm: 16, md: 16, lg: 18
    axis: number     // sm: 14, md: 14, lg: 16  (次要文字，≥14px)
    small: number    // sm: 14, md: 14, lg: 16  (最小档，≥14px)
  }
  padding: number    // sm: 12, md: 16, lg: 24
  gap: number        // sm: 8, md: 12, lg: 16
  strokeWidth: number   // sm: 1.5, md: 2, lg: 3
  dotRadius: number     // sm: 3, md: 4, lg: 6
  contentWidth: number  // width - padding * 2
  contentHeight: number // height - padding * 2
}

export function getCardLayout(mode: CardSizeMode, width: number, height: number): CardLayout
```

纯函数，无 React 依赖，可在 useMemo 内安全调用。

### `src/hooks/use-card-size.ts`

```typescript
export interface CardSizeResult {
  width: number
  height: number
  mode: CardSizeMode
}

/**
 * 返回 CardSizeResult | null。
 * null 表示 command 未指定任何尺寸信息，overlay 应使用自身默认值。
 */
export function useCardSize(command: {
  width?: number
  height?: number
  cardSize?: CardSizeMode
}): CardSizeResult | null
```

内部逻辑:
- 规则 1-3 返回 `CardSizeResult`
- 规则 4（都不存在）返回 `null`
- mode 推断：按面积比值最接近的档位归档（`|area/preset_area - 1|` 最小的那个）

## Overlay 改造模式

每个受影响的 overlay 统一按以下模式改造:

```typescript
export function SomeChart({ command }: Props) {
  const { position: _position, cardSize, width: _width, height: _height, ... } = command
  const position = _position as Point

  // 1. 确定尺寸（null 时走原有默认值）
  const cardSizeResult = useCardSize({ width: _width, height: _height, cardSize })
  const width = cardSizeResult?.width ?? DEFAULT_WIDTH   // overlay 自身默认
  const height = cardSizeResult?.height ?? DEFAULT_HEIGHT
  const mode = cardSizeResult?.mode ?? "md"

  // 2. 获取布局参数
  const layout = useMemo(() => getCardLayout(mode, width, height), [mode, width, height])

  // 3. 定位 + 渲染
  const overlayStyle = useOverlayStyle({ position, width, height })

  return (
    <div style={{ ...overlayStyle, padding: layout.padding }}>
      {/* 标题用 layout.fontSize.title */}
      {/* 数值用 layout.fontSize.value */}
      {/* 标签用 layout.fontSize.label */}
      {/* 坐标轴/tick 用 layout.fontSize.axis */}
      {/* SVG 区域用 layout.contentWidth × layout.contentHeight */}
    </div>
  )
}
```

### 特殊处理

**方形 overlay（Gauge、Donut、Radar、PolarArea）**:
- 当 `cardSize` 存在时，取 `squareSize = min(width, height)` 作为正方形边长
- SVG/内容区域为 `squareSize × squareSize`，居中于 `width × height` 卡片内
- GaugeCommand radius 推算: `(squareSize - layout.padding * 2) / 2 - 16`（16px 为 SVG 内边距）

**Heatmap（数据驱动网格）**:
- 当 `cardSize` 存在时，`cellSize` 自动推导: `min(floor(contentWidth / cols), floor(contentHeight / rows))`
- 当同时传了 `cellSize` 时，`cellSize` 优先（与 width/height 优先 cardSize 一致）

**Sparkline（扁平 overlay）**:
- 当 `cardSize` 存在时，使用完整的 `contentWidth × contentHeight`
- Sparkline 的 SVG 高度直接使用 `contentHeight`（不乘系数）
- sm 模式下 328px 高度对 sparkline 合理（它成为一个 dashboard-style 卡片而非 inline 图表）

**Sankey（需要 label 边距）**:
- `labelMargin = floor(contentWidth * 0.12)`（按比例而非硬编码 80px）
- SVG 宽度 = `contentWidth`，节点区域 = `contentWidth - labelMargin * 2`

**Radar（需要 label 边距）**:
- `labelMargin = floor(squareSize * 0.08)`
- SVG 尺寸 = `squareSize`，cx/cy 偏移 labelMargin

**ComparisonCommand（只有 width，无 height）**:
- 规则 2 适用：用 width + 当前推断的 mode 宽高比补全 height

## 导出

`src/index.ts` 新增:

```typescript
// Card size system
export { CARD_SIZES, REFERENCE_VIEWPORT, PAGE_MARGIN, CARD_GAP } from "./utils/card-sizes"
export type { CardSizeMode } from "./utils/card-sizes"
export { getCardLayout } from "./utils/card-layout"
export type { CardLayout } from "./utils/card-layout"
export { useCardSize } from "./hooks/use-card-size"
export type { CardSizeResult } from "./hooks/use-card-size"
```

## 向后兼容

- `cardSize` 字段可选，**不传时 overlay 保持原有默认尺寸**（不会变大/变小）
- 原有 `width`/`height`/`radius`/`size` (number) 字段保留不动，优先级最高
- 仅当显式传 `cardSize` 时才启用标准卡片尺寸系统
- `useOverlayStyle` / `useViewportClamp` 行为不变（当实际 viewport < 参考分辨率时自动 scale-down）
- 字号限制仅在 `cardSize` 启用时生效；不传 cardSize 时字号保持原有值

## 验证标准

1. `pnpm tsc --noEmit` 通过
2. 22 个 overlay 在 sm/md/lg 模式下均正确渲染
3. 启用 cardSize 时：主要文字 ≥ 16px，次要文字 ≥ 14px（视觉检查）
4. **不传 cardSize 时：行为与重构前完全一致**（核心向后兼容）
5. 传 width/height 时优先使用自定义值
6. 方形 overlay 在任意 cardSize 下保持正方形、居中显示
7. Heatmap cellSize 在 cardSize 模式下自动适配网格密度
