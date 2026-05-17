# Card Size System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a 3-mode card size system (sm/md/lg) for 22 chart/infographic overlays with minimum font sizes and responsive layout utilities.

**Architecture:** Central size constants + `getCardLayout` pure function + `useCardSize` hook. Each overlay adopts via a standard pattern: resolve size → get layout → render with layout params. Backward compatible — no `cardSize` means no change.

**Tech Stack:** TypeScript, React, Remotion

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/utils/card-sizes.ts` | Constants: CARD_SIZES, REFERENCE_VIEWPORT, PAGE_MARGIN, CARD_GAP |
| Create | `src/utils/card-layout.ts` | Pure function `getCardLayout(mode, w, h) → CardLayout` |
| Create | `src/hooks/use-card-size.ts` | Hook `useCardSize(command) → CardSizeResult \| null` |
| Modify | `src/types.ts` | Add `cardSize?: CardSizeMode` to 22 command interfaces |
| Modify | `src/index.ts` | Export new utilities and types |
| Modify | `src/overlays/chart.tsx` | Adopt card size system |
| Modify | `src/overlays/gauge.tsx` | Adopt card size system (square variant) |
| Modify | `src/overlays/sparkline.tsx` | Adopt card size system |
| Modify | `src/overlays/heatmap.tsx` | Adopt card size system (cellSize derivation) |
| Modify | `src/overlays/funnel.tsx` | Adopt card size system |
| Modify | `src/overlays/waterfall.tsx` | Adopt card size system |
| Modify | `src/overlays/radar.tsx` | Adopt card size system (square variant) |
| Modify | `src/overlays/sankey.tsx` | Adopt card size system (labelMargin proportional) |
| Modify | `src/overlays/treemap.tsx` | Adopt card size system |
| Modify | `src/overlays/donut.tsx` | Adopt card size system (square variant) |
| Modify | `src/overlays/stat-card.tsx` | Adopt card size system |
| Modify | `src/overlays/kpi.tsx` | Adopt card size system |
| Modify | `src/overlays/scatter.tsx` | Adopt card size system |
| Modify | `src/overlays/stacked-bar.tsx` | Adopt card size system |
| Modify | `src/overlays/meter.tsx` | Adopt card size system |
| Modify | `src/overlays/ribbon.tsx` | Adopt card size system |
| Modify | `src/overlays/polar-area.tsx` | Adopt card size system (square variant) |
| Modify | `src/overlays/table.tsx` | Adopt card size system |
| Modify | `src/overlays/matrix.tsx` | Adopt card size system |
| Modify | `src/overlays/flowchart.tsx` | Adopt card size system |
| Modify | `src/overlays/timeline.tsx` | Adopt card size system |
| Modify | `src/overlays/comparison.tsx` | Adopt card size system |

---

### Task 1: Create `src/utils/card-sizes.ts`

**Files:**
- Create: `packages/presentation/src/utils/card-sizes.ts`

- [ ] **Step 1: Create the card sizes constants file**

```typescript
// packages/presentation/src/utils/card-sizes.ts

/** Reference viewport for card size calculations */
export const REFERENCE_VIEWPORT = { width: 1920, height: 1080 } as const

/** Page margin (px) surrounding all cards */
export const PAGE_MARGIN = 32

/** Gap between adjacent cards (px) */
export const CARD_GAP = 16

/** Standard card size modes */
export type CardSizeMode = "sm" | "md" | "lg"

/**
 * Preset card dimensions for each mode.
 * Derived from: (available - gap * (n-1)) / n
 * Available = REFERENCE_VIEWPORT - PAGE_MARGIN * 2
 */
export const CARD_SIZES: Record<CardSizeMode, { width: number; height: number }> = {
  sm: { width: 608, height: 328 },
  md: { width: 920, height: 500 },
  lg: { width: 1856, height: 1016 },
} as const
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/src/utils/card-sizes.ts
git commit -m "feat(presentation): add card size constants (sm/md/lg)"
```

---

### Task 2: Create `src/utils/card-layout.ts`

**Files:**
- Create: `packages/presentation/src/utils/card-layout.ts`

- [ ] **Step 1: Create the card layout utility**

```typescript
// packages/presentation/src/utils/card-layout.ts
import type { CardSizeMode } from "./card-sizes"

export interface CardLayout {
  mode: CardSizeMode
  fontSize: {
    /** Title text (sm: 18, md: 22, lg: 32) */
    title: number
    /** Primary value/number (sm: 20, md: 28, lg: 42) */
    value: number
    /** Labels (sm: 16, md: 16, lg: 18) */
    label: number
    /** Axis ticks, secondary text (sm: 14, md: 14, lg: 16) */
    axis: number
    /** Smallest allowed text (sm: 14, md: 14, lg: 16) */
    small: number
  }
  /** Padding inside card container */
  padding: number
  /** Gap between internal elements */
  gap: number
  /** SVG stroke width for chart lines */
  strokeWidth: number
  /** Dot/point radius for charts */
  dotRadius: number
  /** Available content width (width - padding * 2) */
  contentWidth: number
  /** Available content height (height - padding * 2) */
  contentHeight: number
}

const LAYOUT_PRESETS: Record<CardSizeMode, Omit<CardLayout, "contentWidth" | "contentHeight" | "mode">> = {
  sm: {
    fontSize: { title: 18, value: 20, label: 16, axis: 14, small: 14 },
    padding: 12,
    gap: 8,
    strokeWidth: 1.5,
    dotRadius: 3,
  },
  md: {
    fontSize: { title: 22, value: 28, label: 16, axis: 14, small: 14 },
    padding: 16,
    gap: 12,
    strokeWidth: 2,
    dotRadius: 4,
  },
  lg: {
    fontSize: { title: 32, value: 42, label: 18, axis: 16, small: 16 },
    padding: 24,
    gap: 16,
    strokeWidth: 3,
    dotRadius: 6,
  },
}

/**
 * Compute layout parameters for a given card size mode and dimensions.
 * Pure function — safe for useMemo.
 */
export function getCardLayout(mode: CardSizeMode, width: number, height: number): CardLayout {
  const preset = LAYOUT_PRESETS[mode]
  return {
    ...preset,
    mode,
    contentWidth: width - preset.padding * 2,
    contentHeight: height - preset.padding * 2,
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/src/utils/card-layout.ts
git commit -m "feat(presentation): add getCardLayout utility"
```

---

### Task 3: Create `src/hooks/use-card-size.ts`

**Files:**
- Create: `packages/presentation/src/hooks/use-card-size.ts`

- [ ] **Step 1: Create the useCardSize hook**

```typescript
// packages/presentation/src/hooks/use-card-size.ts
import { useMemo } from "react"
import { CARD_SIZES, type CardSizeMode } from "../utils/card-sizes"

export interface CardSizeResult {
  width: number
  height: number
  mode: CardSizeMode
}

/**
 * Resolve card dimensions from command fields.
 * Returns null when no sizing info is provided (overlay should use its own defaults).
 *
 * Priority:
 * 1. width + height both present → use them, infer mode
 * 2. Only width or only height → use it + mode aspect ratio to fill the other
 * 3. Only cardSize → look up CARD_SIZES
 * 4. None → return null (backward compat)
 */
export function useCardSize(command: {
  width?: number
  height?: number
  cardSize?: CardSizeMode
}): CardSizeResult | null {
  const { width, height, cardSize } = command

  return useMemo(() => {
    // Rule 1: both width and height provided
    if (width != null && height != null) {
      return { width, height, mode: inferMode(width * height) }
    }

    // Rule 2: only one dimension provided
    if (width != null && cardSize) {
      const preset = CARD_SIZES[cardSize]
      const aspectRatio = preset.height / preset.width
      return { width, height: Math.round(width * aspectRatio), mode: cardSize }
    }
    if (height != null && cardSize) {
      const preset = CARD_SIZES[cardSize]
      const aspectRatio = preset.width / preset.height
      return { width: Math.round(height * aspectRatio), height, mode: cardSize }
    }
    if (width != null) {
      const mode = inferMode(width * (width / 1.84))
      const preset = CARD_SIZES[mode]
      const aspectRatio = preset.height / preset.width
      return { width, height: Math.round(width * aspectRatio), mode }
    }
    if (height != null) {
      const mode = inferMode(height * (height * 1.84))
      const preset = CARD_SIZES[mode]
      const aspectRatio = preset.width / preset.height
      return { width: Math.round(height * aspectRatio), height, mode }
    }

    // Rule 3: only cardSize
    if (cardSize) {
      const preset = CARD_SIZES[cardSize]
      return { width: preset.width, height: preset.height, mode: cardSize }
    }

    // Rule 4: nothing provided → overlay uses its own defaults
    return null
  }, [width, height, cardSize])
}

/** Infer closest mode by comparing area ratios */
function inferMode(area: number): CardSizeMode {
  const smArea = CARD_SIZES.sm.width * CARD_SIZES.sm.height
  const mdArea = CARD_SIZES.md.width * CARD_SIZES.md.height
  const lgArea = CARD_SIZES.lg.width * CARD_SIZES.lg.height

  const smRatio = Math.abs(area / smArea - 1)
  const mdRatio = Math.abs(area / mdArea - 1)
  const lgRatio = Math.abs(area / lgArea - 1)

  if (smRatio <= mdRatio && smRatio <= lgRatio) return "sm"
  if (mdRatio <= lgRatio) return "md"
  return "lg"
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/src/hooks/use-card-size.ts
git commit -m "feat(presentation): add useCardSize hook"
```

---

### Task 4: Add `cardSize` field to 22 command types

**Files:**
- Modify: `packages/presentation/src/types.ts`

- [ ] **Step 1: Import CardSizeMode and add cardSize to all 22 command interfaces**

At the top of `src/types.ts`, add the import:

```typescript
import type { CardSizeMode } from "./utils/card-sizes"
```

Then add `cardSize?: CardSizeMode` field to each of these 22 interfaces (add as the last optional field before the closing `}`):

1. `ChartCommand` (line ~355)
2. `GaugeCommand` (line ~397)
3. `SparklineCommand` (line ~412)
4. `HeatmapCommand` (line ~426)
5. `FunnelCommand` (line ~442)
6. `WaterfallCommand` (line ~451)
7. `TimelineCommand` (line ~477)
8. `FlowchartCommand` (line ~488)
9. `TableCommand` (line ~500)
10. `RadarCommand` (line ~586)
11. `SankeyCommand` (line ~600)
12. `KpiCommand` (line ~612)
13. `MatrixCommand` (line ~630)
14. `TreemapCommand` (line ~656)
15. `DonutCommand` (line ~668)
16. `StatCardCommand` (line ~680)
17. `RibbonCommand` (line ~710)
18. `PolarAreaCommand` (line ~728)
19. `StackedBarCommand` (line ~740)
20. `ScatterCommand` (line ~789)
21. `MeterCommand` (line ~811)
22. `ComparisonCommand` (line ~327)

Each addition looks like:
```typescript
  /** Card size mode for standardized sizing (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/src/types.ts
git commit -m "feat(presentation): add cardSize field to 22 command types"
```

---

### Task 5: Update `src/index.ts` exports

**Files:**
- Modify: `packages/presentation/src/index.ts`

- [ ] **Step 1: Add new exports**

Add after the existing `// Motion utilities` section (around line 87):

```typescript
// Card size system
export { CARD_SIZES, REFERENCE_VIEWPORT, PAGE_MARGIN, CARD_GAP } from "./utils/card-sizes"
export type { CardSizeMode } from "./utils/card-sizes"
export { getCardLayout } from "./utils/card-layout"
export type { CardLayout } from "./utils/card-layout"
export { useCardSize } from "./hooks/use-card-size"
export type { CardSizeResult } from "./hooks/use-card-size"
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/src/index.ts
git commit -m "feat(presentation): export card size system utilities"
```

---

### Task 6: Migrate `chart.tsx` (landscape template)

**Files:**
- Modify: `packages/presentation/src/overlays/chart.tsx`

This serves as the **reference template** for all landscape-type overlays.

- [ ] **Step 1: Add imports and adopt card size system**

Add imports at top:
```typescript
import { useMemo } from "react"
import { useCardSize } from "../hooks/use-card-size"
import { getCardLayout } from "../utils/card-layout"
```

Replace the size computation section in the `Chart` component:

```typescript
export function Chart({ command }: ChartProps) {
  const {
    position: _position,
    width: _width,
    height: _height,
    cardSize: _cardSize,
    chartType,
    data,
    series,
    dataMulti,
    showGrid = true,
    showAxis = true,
    title,
    colors = DEFAULT_COLORS,
    innerRadius = 0,
  } = command
  const position = _position as Point

  // Card size system (null = use legacy defaults)
  const cardSizeResult = useCardSize({ width: _width, height: _height, cardSize: _cardSize })
  const width = cardSizeResult?.width ?? Math.max(280, _width ?? 360)
  const height = cardSizeResult?.height ?? Math.max(200, _height ?? 200)
  const mode = cardSizeResult?.mode ?? "md"
  const layout = useMemo(() => getCardLayout(mode, width, height), [mode, width, height])

  const overlayStyle = useOverlayStyle({ position, width, height })

  return (
    <div
      style={{
        ...overlayStyle,
        width: layout.contentWidth + layout.padding * 2,
        minHeight: 200,
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
        padding: layout.padding,
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      }}
    >
      {title && (
        <div style={{
          fontSize: layout.fontSize.label,
          fontWeight: 600,
          color: "rgba(255,255,255,0.6)",
          marginBottom: layout.gap,
          paddingLeft: 8,
          letterSpacing: 0.3,
          textShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }}>
          {title}
        </div>
      )}

      {renderChart(chartType, data, series, dataMulti, colors, showGrid, showAxis, innerRadius, layout.contentWidth - 24, layout.contentHeight - (title ? layout.fontSize.label + layout.gap + 8 : 0), layout)}
    </div>
  )
}
```

Update `renderChart` to accept `layout` param and use `layout.fontSize.axis` for axis styles:

```typescript
function renderChart(
  chartType: ChartCommand["chartType"],
  data: ChartCommand["data"],
  series: ChartCommand["series"],
  dataMulti: ChartCommand["dataMulti"],
  colors: string[],
  showGrid: boolean,
  showAxis: boolean,
  innerRadius: number,
  chartWidth: number,
  chartHeight: number,
  layout: CardLayout,
): React.ReactElement {
  const axisStyle = { fontSize: layout.fontSize.axis, fill: "rgba(255,255,255,0.5)" } as const
  const gridStyle = GRID_STYLE
  // ... rest unchanged
```

Add import for `CardLayout`:
```typescript
import type { CardLayout } from "../utils/card-layout"
```

Update the `tooltipStyle` font size:
```typescript
const tooltipStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(15, 15, 30, 0.95), rgba(25, 25, 50, 0.9))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  fontSize: 14,  // was 11
  color: "#fff",
  boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
  backdropFilter: "blur(12px)",
}
```

Also update Legend wrapperStyle in the pie chart section:
```typescript
wrapperStyle={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/src/overlays/chart.tsx
git commit -m "feat(presentation): migrate chart overlay to card size system"
```

---

### Task 7: Migrate `gauge.tsx` (square template)

**Files:**
- Modify: `packages/presentation/src/overlays/gauge.tsx`

- [ ] **Step 1: Add imports and adopt card size system**

Add imports:
```typescript
import { useCardSize } from "../hooks/use-card-size"
import { getCardLayout } from "../utils/card-layout"
```

Replace size computation in `Gauge` component. Key change: when `cardSizeResult` is present, derive `radius` from the square variant:

```typescript
export function Gauge({ command }: GaugeProps) {
  const {
    position: _position,
    value,
    radius: _radius,
    label,
    color = "#6366F1",
    trackColor = "rgba(255,255,255,0.08)",
    cardSize: _cardSize,
  } = command
  const position = _position as Point

  // Card size system
  const cardSizeResult = useCardSize({ width: undefined, height: undefined, cardSize: _cardSize })
  const mode = cardSizeResult?.mode ?? "md"

  // Square variant: use min(width, height) for square content
  const squareSize = cardSizeResult ? Math.min(cardSizeResult.width, cardSizeResult.height) : null
  // Derive radius: from explicit prop, or from card square size, or default
  const radius = _radius ?? (squareSize ? Math.floor((squareSize - 80) / 2) : 60)

  const containerWidth = cardSizeResult?.width ?? Math.max(280, (radius + 16) * 2 + 40)
  const containerHeight = cardSizeResult?.height ?? Math.max(200, (radius + 16) * 2 + 40 + 40)
  const layout = useMemo(() => getCardLayout(mode, containerWidth, containerHeight), [mode, containerWidth, containerHeight])
```

Update all font sizes in the component:
- Value text `fontSize={radius * 0.35}` → `fontSize={Math.max(layout.fontSize.value, radius * 0.35)}`
- Label `fontSize: 12` → `fontSize: layout.fontSize.label`

- [ ] **Step 2: Run typecheck**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/src/overlays/gauge.tsx
git commit -m "feat(presentation): migrate gauge overlay to card size system (square)"
```

---

### Task 8: Migrate `radar.tsx` (square template)

**Files:**
- Modify: `packages/presentation/src/overlays/radar.tsx`

- [ ] **Step 1: Add imports and adopt card size system**

Add imports:
```typescript
import { useCardSize } from "../hooks/use-card-size"
import { getCardLayout } from "../utils/card-layout"
```

Replace size computation:
```typescript
export function Radar({ command }: RadarProps) {
  const {
    position: _position,
    axes,
    color = "#6366F1",
    fillOpacity = 0.25,
    size: _size = 200,
    cardSize: _cardSize,
  } = command
  const position = _position as Point

  // Card size system
  const cardSizeResult = useCardSize({ width: undefined, height: undefined, cardSize: _cardSize })
  const mode = cardSizeResult?.mode ?? "md"
  // Square variant
  const squareSize = cardSizeResult ? Math.min(cardSizeResult.width, cardSizeResult.height) : null
  const size = squareSize ?? _size
  const layout = useMemo(
    () => getCardLayout(mode, cardSizeResult?.width ?? size + 80, cardSizeResult?.height ?? size + 80),
    [mode, cardSizeResult?.width, cardSizeResult?.height, size]
  )

  // Label margin proportional to size
  const labelMargin = Math.floor(size * 0.08)
  const svgSize = size + labelMargin * 2
```

Update font sizes:
- Label text `fontSize={11}` → `fontSize={layout.fontSize.label}`
- Value text `fontSize={10}` → `fontSize={layout.fontSize.axis}`

- [ ] **Step 2: Run typecheck**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/src/overlays/radar.tsx
git commit -m "feat(presentation): migrate radar overlay to card size system (square)"
```

---

### Task 9: Migrate `sankey.tsx` (labelMargin proportional)

**Files:**
- Modify: `packages/presentation/src/overlays/sankey.tsx`

- [ ] **Step 1: Add imports and adopt card size system**

Add imports:
```typescript
import { useCardSize } from "../hooks/use-card-size"
import { getCardLayout } from "../utils/card-layout"
```

Replace size computation:
```typescript
export function Sankey({ command }: SankeyProps) {
  const {
    position: _position,
    nodes,
    links,
    width: _width = 500,
    height: _height = 300,
    cardSize: _cardSize,
  } = command
  const position = _position as Point

  // Card size system
  const cardSizeResult = useCardSize({ width: _width, height: _height, cardSize: _cardSize })
  const width = cardSizeResult?.width ?? Math.max(280, _width)
  const height = cardSizeResult?.height ?? Math.max(200, _height)
  const mode = cardSizeResult?.mode ?? "md"
  const layout = useMemo(() => getCardLayout(mode, width, height), [mode, width, height])

  // Label margin proportional to content width
  const labelMargin = Math.floor(layout.contentWidth * 0.12)
  const svgWidth = layout.contentWidth
  const svgHeight = layout.contentHeight
```

Update node layout computation to use `layout.contentWidth - labelMargin * 2` as the node area width.

Update font sizes:
- Node label `fontSize={11}` → `fontSize={layout.fontSize.label}`

Container rendering:
```typescript
  const overlayStyle = useOverlayStyle({ position, width, height })

  return (
    <div style={{
      ...overlayStyle,
      width,
      height,
      // ... existing visual styles ...
      padding: layout.padding,
    }}>
      <svg width={svgWidth} height={svgHeight} style={{ overflow: "visible" }}>
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/src/overlays/sankey.tsx
git commit -m "feat(presentation): migrate sankey overlay to card size system"
```

---

### Task 10: Migrate `heatmap.tsx` (cellSize derivation)

**Files:**
- Modify: `packages/presentation/src/overlays/heatmap.tsx`

- [ ] **Step 1: Add imports and adopt card size system**

Add imports:
```typescript
import { useCardSize } from "../hooks/use-card-size"
import { getCardLayout } from "../utils/card-layout"
```

Key logic: when `cardSize` is present and no explicit `cellSize`, derive cellSize from content dimensions:
```typescript
  const cardSizeResult = useCardSize({ width: undefined, height: undefined, cardSize: _cardSize })
  const mode = cardSizeResult?.mode ?? "md"

  const rows = data.length
  const cols = data[0]?.length ?? 0

  // cellSize derivation: explicit > auto from card size > default 24
  const cellSize = _cellSize ?? (cardSizeResult
    ? Math.min(
        Math.floor((cardSizeResult.width - 80) / Math.max(cols, 1)),
        Math.floor((cardSizeResult.height - 60) / Math.max(rows, 1)),
        48  // cap
      )
    : 24)
```

Update all font sizes (label fontSize: 10 → `layout.fontSize.axis`).

- [ ] **Step 2: Run typecheck**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/src/overlays/heatmap.tsx
git commit -m "feat(presentation): migrate heatmap overlay to card size system"
```

---

### Task 11: Migrate remaining landscape overlays (batch)

**Files:**
- Modify: `packages/presentation/src/overlays/sparkline.tsx`
- Modify: `packages/presentation/src/overlays/funnel.tsx`
- Modify: `packages/presentation/src/overlays/waterfall.tsx`
- Modify: `packages/presentation/src/overlays/treemap.tsx`
- Modify: `packages/presentation/src/overlays/stat-card.tsx`
- Modify: `packages/presentation/src/overlays/kpi.tsx`
- Modify: `packages/presentation/src/overlays/scatter.tsx`
- Modify: `packages/presentation/src/overlays/stacked-bar.tsx`
- Modify: `packages/presentation/src/overlays/meter.tsx`
- Modify: `packages/presentation/src/overlays/ribbon.tsx`

Each follows the **same landscape template pattern** as Task 6 (chart.tsx):

- [ ] **Step 1: For each file, add imports and adopt card size system**

Pattern for each:
```typescript
import { useMemo } from "react"
import { useCardSize } from "../hooks/use-card-size"
import { getCardLayout } from "../utils/card-layout"

// Inside the component:
const cardSizeResult = useCardSize({ width: _width, height: _height, cardSize: _cardSize })
const width = cardSizeResult?.width ?? Math.max(EXISTING_MIN, _width ?? EXISTING_DEFAULT)
const height = cardSizeResult?.height ?? Math.max(EXISTING_MIN, _height ?? EXISTING_DEFAULT)
const mode = cardSizeResult?.mode ?? "md"
const layout = useMemo(() => getCardLayout(mode, width, height), [mode, width, height])
```

Specific per-overlay defaults to preserve:
| Overlay | Default width | Default height | Min width | Min height |
|---------|--------------|---------------|-----------|-----------|
| sparkline | 160 | 48 | 220 | 80 |
| funnel | 240 | 200 | 280 | 200 |
| waterfall | 280 | 180 | 280 | 200 |
| treemap | 320 | 200 | 280 | 200 |
| stat-card | 300 | 180 | 220 | 120 |
| kpi | 220 | 200 | 220 | 200 |
| scatter | 280 | 200 | 280 | 200 |
| stacked-bar | 320 | auto | 280 | - |
| meter | 280 | auto | 280 | - |
| ribbon | 240 | auto | 240 | - |

Replace all `fontSize: 10`, `fontSize: 11`, `fontSize: 12` with appropriate `layout.fontSize.*`:
- Titles/headers → `layout.fontSize.title`
- Values/numbers → `layout.fontSize.value`
- Labels/descriptions → `layout.fontSize.label`
- Axis ticks/secondary → `layout.fontSize.axis`

- [ ] **Step 2: Run typecheck after each file**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit all together**

```bash
git add packages/presentation/src/overlays/sparkline.tsx packages/presentation/src/overlays/funnel.tsx packages/presentation/src/overlays/waterfall.tsx packages/presentation/src/overlays/treemap.tsx packages/presentation/src/overlays/stat-card.tsx packages/presentation/src/overlays/kpi.tsx packages/presentation/src/overlays/scatter.tsx packages/presentation/src/overlays/stacked-bar.tsx packages/presentation/src/overlays/meter.tsx packages/presentation/src/overlays/ribbon.tsx
git commit -m "feat(presentation): migrate 10 landscape overlays to card size system"
```

---

### Task 12: Migrate `donut.tsx` and `polar-area.tsx` (square variants)

**Files:**
- Modify: `packages/presentation/src/overlays/donut.tsx`
- Modify: `packages/presentation/src/overlays/polar-area.tsx`

- [ ] **Step 1: Adopt card size system with square variant logic**

Same pattern as gauge/radar — use `Math.min(width, height)` for square content:

```typescript
// donut.tsx
const cardSizeResult = useCardSize({ width: undefined, height: undefined, cardSize: _cardSize })
const squareSize = cardSizeResult ? Math.min(cardSizeResult.width, cardSizeResult.height) : null
const size = squareSize ?? _size ?? 180

// polar-area.tsx
const cardSizeResult = useCardSize({ width: undefined, height: undefined, cardSize: _cardSize })
const squareSize = cardSizeResult ? Math.min(cardSizeResult.width, cardSizeResult.height) : null
const size = squareSize ?? _size ?? 200
```

Update font sizes (legend `fontSize: 10` → `layout.fontSize.axis`, labels → `layout.fontSize.label`).

- [ ] **Step 2: Run typecheck**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/src/overlays/donut.tsx packages/presentation/src/overlays/polar-area.tsx
git commit -m "feat(presentation): migrate donut and polar-area to card size system (square)"
```

---

### Task 13: Migrate structural overlays (table, matrix, flowchart, timeline, comparison)

**Files:**
- Modify: `packages/presentation/src/overlays/table.tsx`
- Modify: `packages/presentation/src/overlays/matrix.tsx`
- Modify: `packages/presentation/src/overlays/flowchart.tsx`
- Modify: `packages/presentation/src/overlays/timeline.tsx`
- Modify: `packages/presentation/src/overlays/comparison.tsx`

- [ ] **Step 1: Adopt card size system for each**

Same landscape pattern. Notable specifics:

**table.tsx**: No explicit width/height in command — pass `cardSize` only:
```typescript
const cardSizeResult = useCardSize({ cardSize: _cardSize })
// If null, use existing auto-sizing logic
```

**matrix.tsx**: Has `width` but no `height`:
```typescript
const cardSizeResult = useCardSize({ width: _width, cardSize: _cardSize })
const width = cardSizeResult?.width ?? _width ?? 420
const height = cardSizeResult?.height ?? /* compute from rows */
```

**comparison.tsx**: Has required `width` (not optional):
```typescript
const cardSizeResult = useCardSize({ width, cardSize: _cardSize })
// width always present, so cardSizeResult is never null here
```

**flowchart.tsx / timeline.tsx**: Standard pattern with width/height.

Update all fontSize references to use `layout.fontSize.*`.

- [ ] **Step 2: Run typecheck**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/src/overlays/table.tsx packages/presentation/src/overlays/matrix.tsx packages/presentation/src/overlays/flowchart.tsx packages/presentation/src/overlays/timeline.tsx packages/presentation/src/overlays/comparison.tsx
git commit -m "feat(presentation): migrate 5 structural overlays to card size system"
```

---

### Task 14: Final typecheck and visual verification

**Files:** None (verification only)

- [ ] **Step 1: Full typecheck**

Run: `cd packages/presentation && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Verify example app builds**

Run: `cd packages/presentation/example && npx tsc --noEmit`
Expected: No errors (or note any issues from example not using new fields)

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(presentation): resolve any remaining type issues from card size migration"
```
