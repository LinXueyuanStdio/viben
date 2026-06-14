/**
 * Presentation Mode Types -- CSS-animation-based overlay annotations
 *
 * Real-time transparent overlay for rendering animated annotations on top of page content.
 */

import type { CardSizeMode } from "./utils/card-sizes"

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Reference to a DOM element via data-presentation-id attribute.
 * The overlay system resolves this to pixel coordinates at runtime.
 */
export interface TargetRef {
  targetId: string
  /** Optional offset from the element's bounding box */
  offsetX?: number
  offsetY?: number
  /** Which part of the element to reference (default: "center") */
  anchor?:
    | "center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "top"
    | "bottom"
    | "left"
    | "right"
  /**
   * Relative placement around the target element.
   * Places the overlay OUTSIDE the target's bounding box in the specified direction.
   * offsetX/offsetY add extra distance beyond the default 8px gap.
   *
   * Basic (centered on the axis):
   * - "above" / "below" / "left-of" / "right-of"
   *
   * Corner-aligned (flush with target edge):
   * - "above-start" / "above-end" — above, left-aligned or right-aligned
   * - "below-start" / "below-end" — below, left-aligned or right-aligned
   * - "left-of-start" / "left-of-end" — left, top-aligned or bottom-aligned
   * - "right-of-start" / "right-of-end" — right, top-aligned or bottom-aligned
   */
  placement?:
    | "above" | "above-start" | "above-end"
    | "below" | "below-start" | "below-end"
    | "left-of" | "left-of-start" | "left-of-end"
    | "right-of" | "right-of-start" | "right-of-end"
}

/**
 * A position that can be either absolute pixels or a target reference.
 * Backward compatible: {x, y} still works.
 */
export type PositionOrTarget = Point | TargetRef

/**
 * A region that can be either absolute pixels or derived from a target element.
 * Backward compatible: {x, y, width, height} still works.
 */
export type RegionOrTarget = Rect | (TargetRef & { padding?: number })

/** Presentation command -- Agent-driven visual annotation instructions */
export type PresentationCommand =
  | SpotlightCommand
  | ArrowCommand
  | TextCommand
  | CircleCommand
  | HighlightCommand
  | CardCommand
  | PulseCommand
  | UnderlineCommand
  | BadgeCommand
  | ProgressCommand
  | CounterCommand
  | BracketCommand
  | TrendlineCommand
  | ComparisonCommand
  | TypewriterCommand
  | ChartCommand
  | ClearCommand
  | WaitCommand
  // Data Visualization
  | GaugeCommand
  | SparklineCommand
  | HeatmapCommand
  | FunnelCommand
  | WaterfallCommand
  // Narrative/Structural
  | CalloutCommand
  | TimelineCommand
  | FlowchartCommand
  | TableCommand
  | ListCommand
  // Interaction/Effects
  | ConfettiCommand
  | CountdownCommand
  | RevealCommand
  | ZoomCommand
  | MorphCommand
  // Advanced Data & Annotations
  | RadarCommand
  | SankeyCommand
  | KpiCommand
  | MatrixCommand
  | AnnotationGroupCommand
  // Visualization & Code
  | TreemapCommand
  | DonutCommand
  | StatCardCommand
  | CodeBlockCommand
  // New Visualization Types
  | RibbonCommand
  | PolarAreaCommand
  | StackedBarCommand
  | TooltipCommand
  | BadgeGroupCommand
  | ScatterCommand
  | MeterCommand
  | HtmlCommand

/** Info card */
export interface CardCommand {
  type: "card"
  position: PositionOrTarget
  width?: number
  title?: string
  content?: string
  imageSrc?: string
  enterFrom?: "left" | "right" | "bottom" | "top"
  background?: string
  titleColor?: string
  contentColor?: string
  borderColor?: string
  tag?: string
  tagColor?: string
  animate?: boolean
}

/** Spotlight: dark mask + highlighted region */
export interface SpotlightCommand {
  type: "spotlight"
  /** Highlighted region */
  region: RegionOrTarget
  /** Mask opacity (0-1, default 0.7) */
  maskOpacity?: number
  /** Spotlight border radius */
  borderRadius?: number
  /** Whether to animate transition */
  animate?: boolean
}

/** Arrow annotation */
export interface ArrowCommand {
  type: "arrow"
  from: PositionOrTarget
  to: PositionOrTarget
  color?: string
  label?: string
  /** Stroke width */
  strokeWidth?: number
  animate?: boolean
}

/** Text annotation */
export interface TextCommand {
  type: "text"
  position: PositionOrTarget
  content: string
  color?: string
  fontSize?: number
  fontWeight?: number
  /** Background color */
  background?: string
  /** Horizontal alignment relative to position point (default: "left") */
  textAlign?: "left" | "center"
  animate?: boolean
}

/** Circle annotation */
export interface CircleCommand {
  type: "circle"
  center: PositionOrTarget
  radius: number
  color?: string
  strokeWidth?: number
  animate?: boolean
}

/** Region highlight (semi-transparent color block) */
export interface HighlightCommand {
  type: "highlight"
  region: RegionOrTarget
  color?: string
  opacity?: number
  borderRadius?: number
  animate?: boolean
}

/** Pulse: pulsing attention ring at a point */
export interface PulseCommand {
  type: "pulse"
  center: PositionOrTarget
  /** Pulse radius (default 20) */
  radius?: number
  color?: string
  /** Number of pulse rings (default 3) */
  rings?: number
  animate?: boolean
}

/** Underline: animated underline below a region */
export interface UnderlineCommand {
  type: "underline"
  /** Start point (left) */
  from: PositionOrTarget
  /** End point (right) */
  to: PositionOrTarget
  color?: string
  strokeWidth?: number
  /** Wavy style */
  style?: "straight" | "wavy"
  animate?: boolean
}

/** Badge: floating small label/chip */
export interface BadgeCommand {
  type: "badge"
  position: PositionOrTarget
  text: string
  color?: string
  /** Background color */
  background?: string
  /** Size variant */
  size?: "sm" | "md" | "lg"
  animate?: boolean
}

/** Progress: animated progress bar */
export interface ProgressCommand {
  type: "progress"
  position: PositionOrTarget
  /** Bar width */
  width?: number
  /** Progress value 0-100 */
  value: number
  color?: string
  /** Background track color */
  trackColor?: string
  /** Show percentage label */
  showLabel?: boolean
  /** Optional label text (overrides percentage) */
  label?: string
  animate?: boolean
}

/** Counter: animated number counting up */
export interface CounterCommand {
  type: "counter"
  position: PositionOrTarget
  /** Target value to count to */
  value: number
  /** Prefix (e.g., "$", "Y") */
  prefix?: string
  /** Suffix (e.g., "%", "B") */
  suffix?: string
  color?: string
  fontSize?: number
  animate?: boolean
}

/** Bracket: curly brace grouping items */
export interface BracketCommand {
  type: "bracket"
  /** Start point */
  from: PositionOrTarget
  /** End point */
  to: PositionOrTarget
  /** Which side the bracket curves to */
  direction?: "left" | "right"
  color?: string
  strokeWidth?: number
  /** Optional label at the bracket center */
  label?: string
  animate?: boolean
}

/** Trendline: SVG polyline with optional dots, area fill, and end arrow */
export interface TrendlineCommand {
  type: "trendline"
  points: PositionOrTarget[]
  color: string
  strokeWidth?: number
  showDots?: boolean
  dotRadius?: number
  /** Gradient color for area below line */
  fillBelow?: string
  endArrow?: boolean
  animate?: boolean
}

/** Comparison: side-by-side bar comparison */
export interface ComparisonCommand {
  type: "comparison"
  position: PositionOrTarget
  width: number
  leftLabel: string
  rightLabel: string
  leftValue: number
  rightValue: number
  leftColor: string
  rightColor: string
  unit?: string
  animate?: boolean
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Typewriter: text that types itself character by character */
export interface TypewriterCommand {
  type: "typewriter"
  position: PositionOrTarget
  content: string
  fontSize?: number
  fontWeight?: number
  color?: string
  background?: string
  speed?: "slow" | "normal" | "fast"
  animate?: boolean
}

/** Chart: professional animated chart (recharts) */
export interface ChartCommand {
  type: "chart"
  position: PositionOrTarget
  /** Chart width (default 360) */
  width?: number
  /** Chart height (default 200) */
  height?: number
  /** Chart variant */
  chartType: "line" | "bar" | "area" | "pie"
  /** Simple data (single series) */
  data: Array<{ name: string; value: number; color?: string }>
  /** Multi-series definitions (for line/area/bar with multiple lines) */
  series?: Array<{ dataKey: string; color: string; name?: string }>
  /** Multi-series data rows (when series is provided) */
  dataMulti?: Array<Record<string, string | number>>
  /** Show grid lines (default true for cartesian charts) */
  showGrid?: boolean
  /** Show axis labels (default true for cartesian charts) */
  showAxis?: boolean
  /** Chart title */
  title?: string
  /** Color palette for automatic coloring */
  colors?: string[]
  /** Pie: inner radius for donut effect (0 = full pie) */
  innerRadius?: number
  animate?: boolean
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Clear canvas */
export interface ClearCommand {
  type: "clear"
}

/** Wait */
export interface WaitCommand {
  type: "wait"
  ms: number
}

// ─── Data Visualization Commands ─────────────────────────────────

/** Gauge: circular gauge meter with animated needle */
export interface GaugeCommand {
  type: "gauge"
  position: PositionOrTarget
  /** Value 0-100 */
  value: number
  /** Gauge radius (default 60) */
  radius?: number
  /** Label below gauge */
  label?: string
  color?: string
  /** Track background color */
  trackColor?: string
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Sparkline: compact inline line chart */
export interface SparklineCommand {
  type: "sparkline"
  position: PositionOrTarget
  data: number[]
  width?: number
  height?: number
  color?: string
  /** Fill area below line */
  fill?: boolean
  /** Show end dot */
  showEndDot?: boolean
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Heatmap: grid of colored cells */
export interface HeatmapCommand {
  type: "heatmap"
  position: PositionOrTarget
  /** 2D grid of values (0-1 normalized) */
  data: number[][]
  /** Cell size in pixels (default 24) */
  cellSize?: number
  /** Row labels */
  rowLabels?: string[]
  /** Column labels */
  colLabels?: string[]
  /** Color range: [low, high] */
  colors?: [string, string]
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Funnel: vertical funnel/pyramid with stage labels */
export interface FunnelCommand {
  type: "funnel"
  position: PositionOrTarget
  stages: Array<{ label: string; value: number; color?: string }>
  width?: number
  height?: number
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Waterfall: incremental +/- chart */
export interface WaterfallCommand {
  type: "waterfall"
  position: PositionOrTarget
  data: Array<{ label: string; value: number; type?: "increase" | "decrease" | "total" }>
  width?: number
  height?: number
  /** Colors for increase/decrease/total */
  colors?: { increase?: string; decrease?: string; total?: string }
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

// ─── Narrative/Structural Commands ───────────────────────────────

/** Callout: speech bubble pointing to target */
export interface CalloutCommand {
  type: "callout"
  position: PositionOrTarget
  content: string
  /** Arrow direction pointing away from bubble */
  arrowDirection?: "top" | "bottom" | "left" | "right"
  background?: string
  color?: string
  /** Max width (default 240) */
  maxWidth?: number
}

/** Timeline: horizontal/vertical timeline with milestones */
export interface TimelineCommand {
  type: "timeline"
  position: PositionOrTarget
  events: Array<{ label: string; description?: string; color?: string; active?: boolean }>
  /** Layout direction */
  direction?: "horizontal" | "vertical"
  width?: number
  color?: string
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Flowchart: connected boxes with arrows */
export interface FlowchartCommand {
  type: "flowchart"
  position: PositionOrTarget
  nodes: Array<{ id: string; label: string; color?: string }>
  edges: Array<{ from: string; to: string; label?: string }>
  /** Layout direction */
  direction?: "horizontal" | "vertical"
  width?: number
  height?: number
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Table: data table with row-by-row reveal */
export interface TableCommand {
  type: "table"
  position: PositionOrTarget
  headers: string[]
  rows: string[][]
  /** Width per column (default auto) */
  columnWidths?: number[]
  /** Highlight specific cells [row, col] */
  highlights?: Array<[number, number]>
  headerColor?: string
  /** Stagger row reveal (frames between rows) */
  rowStagger?: number
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** List: animated bullet list */
export interface ListCommand {
  type: "list"
  position: PositionOrTarget
  items: Array<{ text: string; icon?: string; color?: string }>
  /** List style */
  listStyle?: "bullet" | "number" | "check" | "arrow"
  color?: string
  fontSize?: number
  /** Stagger between items (frames) */
  stagger?: number
}

// ─── Interaction/Effects Commands ────────────────────────────────

/** Confetti: particle burst celebration */
export interface ConfettiCommand {
  type: "confetti"
  /** Origin point of burst */
  position: PositionOrTarget
  /** Number of particles (default 50) */
  count?: number
  /** Spread radius (default 200) */
  spread?: number
  /** Colors for particles */
  colors?: string[]
}

/** Countdown: large countdown timer */
export interface CountdownCommand {
  type: "countdown"
  position: PositionOrTarget
  /** Start number (default 3) */
  from?: number
  color?: string
  fontSize?: number
}

/** Reveal: mask wipe revealing content */
export interface RevealCommand {
  type: "reveal"
  region: RegionOrTarget
  /** Wipe direction */
  direction?: "left" | "right" | "top" | "bottom" | "center"
  color?: string
}

/** Zoom: magnifying lens on a region */
export interface ZoomCommand {
  type: "zoom"
  region: RegionOrTarget
  /** Zoom level (default 2) */
  scale?: number
  /** Lens border color */
  borderColor?: string
}

/** Morph: shape/number morph transition */
export interface MorphCommand {
  type: "morph"
  position: PositionOrTarget
  /** From value */
  from: string | number
  /** To value */
  to: string | number
  color?: string
  fontSize?: number
}

// ─── Advanced Data & Annotation Commands ─────────────────────────

/** Radar/Spider chart with multiple axes */
export interface RadarCommand {
  type: "radar"
  position: PositionOrTarget
  /** Axes with labels and values (0-100 scale) */
  axes: Array<{ label: string; value: number }>
  /** Fill/stroke color */
  color?: string
  /** Polygon fill opacity (default 0.25) */
  fillOpacity?: number
  /** Chart size in pixels (default 200) */
  size?: number
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Sankey flow diagram */
export interface SankeyCommand {
  type: "sankey"
  position: PositionOrTarget
  /** Node definitions */
  nodes: Array<{ id: string; label: string }>
  /** Link connections with values proportional to width */
  links: Array<{ source: string; target: string; value: number }>
  width?: number
  height?: number
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** KPI metric card */
export interface KpiCommand {
  type: "kpi"
  position: PositionOrTarget
  /** Main value (number for counter animation, string for static display) */
  value: number | string
  /** Metric label */
  label: string
  /** Trend direction */
  trend?: "up" | "down" | "flat"
  /** Trend percentage or text (e.g., "+12%") */
  trendValue?: string
  /** Mini sparkline data points */
  sparkData?: number[]
  /** Accent color */
  color?: string
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Comparison matrix with indicators */
export interface MatrixCommand {
  type: "matrix"
  position: PositionOrTarget
  /** Column headers */
  columns: string[]
  /** Row data with yes/no/partial indicators */
  rows: Array<{ label: string; values: ("yes" | "no" | "partial")[] }>
  /** Total width (default 420) */
  width?: number
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Grouped annotations with connector */
export interface AnnotationGroupCommand {
  type: "annotation-group"
  position: PositionOrTarget
  /** Annotation items */
  items: Array<{ label: string; color?: string }>
  /** Layout direction */
  direction?: "horizontal" | "vertical"
  /** Connector style between items */
  connector?: "line" | "bracket" | "dots"
}

// ─── Visualization & Code Commands ───────────────────────────────

/** Treemap: rectangular treemap showing hierarchical data */
export interface TreemapCommand {
  type: "treemap"
  position: PositionOrTarget
  /** Data items with label, value, and color */
  data: Array<{ label: string; value: number; color: string }>
  /** Total width (default 320) */
  width?: number
  /** Total height (default 200) */
  height?: number
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Donut: ring chart with animated arc drawing */
export interface DonutCommand {
  type: "donut"
  position: PositionOrTarget
  /** Segments with label, value, and color */
  segments: Array<{ label: string; value: number; color: string }>
  /** Outer diameter (default 180) */
  size?: number
  /** Inner radius as ratio of outer radius (default 0.6) */
  innerRatio?: number
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** StatCard: before vs after comparison card with delta */
export interface StatCardCommand {
  type: "stat-card"
  position: PositionOrTarget
  /** Metric label */
  label: string
  /** Before value */
  before: number
  /** After value */
  after: number
  /** Unit suffix (e.g., "%", "ms", "K") */
  unit?: string
  /** Accent color */
  color?: string
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** CodeBlock: animated code snippet with syntax highlighting */
export interface CodeBlockCommand {
  type: "code-block"
  position: PositionOrTarget
  /** Code content */
  code: string
  /** Language for syntax highlighting (default "typescript") */
  language?: string
  /** Line numbers to highlight with glow (1-indexed) */
  highlightLines?: number[]
}

// ─── New Visualization Types ─────────────────────────────────────

/** Ribbon: flowing ribbon/banner with text (like an award ribbon) */
export interface RibbonCommand {
  type: "ribbon"
  position: PositionOrTarget
  /** Text displayed on the ribbon */
  text: string
  /** Ribbon width (default 240) */
  width?: number
  /** Ribbon color */
  color?: string
  /** Text color (default "#FFFFFF") */
  textColor?: string
  /** Font size (default 14) */
  fontSize?: number
  /** Ribbon variant (default "flat") */
  variant?: "flat" | "award"
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** PolarArea: Polar area chart (rose chart) with animated segments */
export interface PolarAreaCommand {
  type: "polar-area"
  position: PositionOrTarget
  /** Segments with label, value, and optional color */
  segments: Array<{ label: string; value: number; color?: string }>
  /** Chart size in pixels (default 200) */
  size?: number
  /** Color palette (cycles if fewer colors than segments) */
  colors?: string[]
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** StackedBar: Horizontal stacked bar chart with labels */
export interface StackedBarCommand {
  type: "stacked-bar"
  position: PositionOrTarget
  /** Bars with label and segments */
  bars: Array<{
    label: string
    segments: Array<{ value: number; color: string; label?: string }>
  }>
  /** Total bar width (default 320) */
  width?: number
  /** Bar height per row (default 32) */
  barHeight?: number
  /** Gap between bars (default 12) */
  gap?: number
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Tooltip: contextual tooltip pointing at a target */
export interface TooltipCommand {
  type: "tooltip"
  position: PositionOrTarget
  /** Tooltip text content */
  content: string
  /** Arrow direction (which side the arrow points FROM) (default "top") */
  direction?: "top" | "bottom" | "left" | "right"
  /** Background color */
  background?: string
  /** Text color */
  color?: string
  /** Max width (default 200) */
  maxWidth?: number
  /** Font size (default 12) */
  fontSize?: number
}

/** BadgeGroup: multiple animated badges in a grid/flow layout */
export interface BadgeGroupCommand {
  type: "badge-group"
  position: PositionOrTarget
  /** Array of badge items */
  badges: Array<{ text: string; color?: string; background?: string; icon?: string }>
  /** Layout mode (default "flow") */
  layout?: "flow" | "grid"
  /** Gap between badges (default 8) */
  gap?: number
  /** Columns for grid layout (default 3) */
  columns?: number
}

/** Scatter: scatter plot with physics-based dot animation */
export interface ScatterCommand {
  type: "scatter"
  position: PositionOrTarget
  /** Data points with x, y coordinates */
  points: Array<{ x: number; y: number; label?: string; color?: string; size?: number }>
  /** Chart width (default 280) */
  width?: number
  /** Chart height (default 200) */
  height?: number
  /** Default dot color */
  color?: string
  /** Default dot radius (default 5) */
  dotRadius?: number
  /** X-axis label */
  xLabel?: string
  /** Y-axis label */
  yLabel?: string
  /** Show grid lines (default true) */
  showGrid?: boolean
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Html: isolated HTML card rendered via iframe srcdoc */
export interface HtmlCommand {
  type: "html"
  position: PositionOrTarget
  /** HTML string to render inside iframe via srcdoc */
  html: string
  /** iframe width (default 400) */
  width?: number
  /** iframe height (default 300) */
  height?: number
  /** Entrance animation direction */
  enterFrom?: "left" | "right" | "bottom" | "top"
  animate?: boolean
}

/** Meter: linear meter with gradient fill, tick marks, and animated needle */
export interface MeterCommand {
  type: "meter"
  position: PositionOrTarget
  /** Current value */
  value: number
  /** Minimum value (default 0) */
  min?: number
  /** Maximum value (default 100) */
  max?: number
  /** Meter width (default 280) */
  width?: number
  /** Label text */
  label?: string
  /** Fill color */
  color?: string
  /** Track background color */
  trackColor?: string
  /** Number of tick marks (default 5) */
  ticks?: number
  /** Unit suffix */
  unit?: string
  /** Show needle indicator (default true) */
  showNeedle?: boolean
  /** Card size mode (sm: 3×3 grid, md: 2×2 grid, lg: full screen) */
  cardSize?: CardSizeMode
}

/** Player state */
export type PlayerState = "idle" | "playing" | "paused"

/** Presentation step */
export interface PresentationStep {
  id: string
  toolUseId: string
  toolName: string
  toolInput: Record<string, unknown>
  command: PresentationCommand
  /** Human-readable description */
  description: string
  /** Step status */
  status: "pending" | "executing" | "done"
  /** Screenshot captured after step execution */
  screenshot?: string
  /**
   * Timeline mode: absolute start time in ms from presentation start.
   * Multiple steps can share the same startMs to execute in parallel.
   */
  startMs: number
  /**
   * Timeline mode: when this annotation disappears (absolute ms).
   * If omitted, persists until a "clear" command fires or presentation ends.
   */
  endMs?: number
  /**
   * @deprecated Use startMs/endMs instead. Kept for backward compat with sequential player.
   */
  durationMs?: number
  /** Optional metadata for debugging/validation */
  meta?: {
    /** Expected rendered position {x, y} for validation in dev logs */
    expect?: { x: number; y: number }
    [key: string]: unknown
  }
}

/** Presentation sequence config */
export interface PresentationSequence {
  steps: PresentationStep[]
  /** Width */
  width: number
  /** Height */
  height: number
}

/** Known presentation tool names */
export type PresentationToolName = `presentation_${PresentationCommand["type"]}`

/** MCP CallToolResult equivalent for frontend */
export type ClientToolResultContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }

export interface ClientToolResult {
  content: ClientToolResultContent[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

/** Animation handle for step execution */
export interface AnimationHandle {
  /** Immediately finish the animation */
  finish: () => void
  /** Promise that resolves when animation is done */
  done: Promise<void>
}

/** Helper to check if a value is a TargetRef */
export function isTargetRef(val: PositionOrTarget | RegionOrTarget): val is TargetRef {
  return "targetId" in val
}

/** Describe a position or target ref for human-readable output */
function describePos(pos: PositionOrTarget): string {
  if (isTargetRef(pos)) return `@${pos.targetId}`
  return `(${pos.x},${pos.y})`
}

/** Describe a region or target ref for human-readable output */
function describeRegion(region: RegionOrTarget): string {
  if (isTargetRef(region)) return `@${region.targetId}`
  return `(${region.x}, ${region.y}) ${region.width}x${region.height}`
}

/** Generate a human-readable description for a PresentationCommand */
export function describeCommand(cmd: PresentationCommand): string {
  switch (cmd.type) {
    case "spotlight":
      return `Spotlight ${describeRegion(cmd.region)}`
    case "arrow":
      return `Arrow ${describePos(cmd.from)} -> ${describePos(cmd.to)}${cmd.label ? ` "${cmd.label}"` : ""}`
    case "circle":
      return `Circle ${describePos(cmd.center)} r=${cmd.radius}`
    case "text":
      return `Text "${cmd.content.slice(0, 30)}"`
    case "highlight":
      return `Highlight ${describeRegion(cmd.region)}`
    case "card":
      return `Card "${cmd.title || cmd.content?.slice(0, 20) || ""}"`
    case "pulse":
      return `Pulse ${describePos(cmd.center)} r=${cmd.radius ?? 20}`
    case "underline":
      return `Underline ${describePos(cmd.from)} -> ${describePos(cmd.to)} ${cmd.style ?? "straight"}`
    case "badge":
      return `Badge "${cmd.text}"`
    case "progress":
      return `Progress ${cmd.value}%${cmd.label ? ` "${cmd.label}"` : ""}`
    case "counter":
      return `Counter ${cmd.prefix ?? ""}${cmd.value}${cmd.suffix ?? ""}`
    case "bracket":
      return `Bracket ${describePos(cmd.from)} -> ${describePos(cmd.to)}${cmd.label ? ` "${cmd.label}"` : ""}`
    case "trendline":
      return `Trendline ${cmd.points.length} points`
    case "comparison":
      return `Comparison "${cmd.leftLabel}" vs "${cmd.rightLabel}"`
    case "typewriter":
      return `Typewriter "${cmd.content.slice(0, 30)}"`
    case "chart":
      return `Chart ${cmd.chartType}${cmd.title ? ` "${cmd.title}"` : ""}`
    case "gauge":
      return `Gauge ${cmd.value}%${cmd.label ? ` "${cmd.label}"` : ""}`
    case "sparkline":
      return `Sparkline ${cmd.data.length} points`
    case "heatmap":
      return `Heatmap ${cmd.data.length}x${cmd.data[0]?.length ?? 0}`
    case "funnel":
      return `Funnel ${cmd.stages.length} stages`
    case "waterfall":
      return `Waterfall ${cmd.data.length} items`
    case "callout":
      return `Callout "${cmd.content.slice(0, 30)}"`
    case "timeline":
      return `Timeline ${cmd.events.length} events`
    case "flowchart":
      return `Flowchart ${cmd.nodes.length} nodes`
    case "table":
      return `Table ${cmd.rows.length}x${cmd.headers.length}`
    case "list":
      return `List ${cmd.items.length} items`
    case "confetti":
      return `Confetti ${cmd.count ?? 50} particles`
    case "countdown":
      return `Countdown from ${cmd.from ?? 3}`
    case "reveal":
      return `Reveal ${cmd.direction ?? "left"}`
    case "zoom":
      return `Zoom ${cmd.scale ?? 2}x`
    case "morph":
      return `Morph ${cmd.from} → ${cmd.to}`
    case "radar":
      return `Radar ${cmd.axes.length} axes`
    case "sankey":
      return `Sankey ${cmd.nodes.length} nodes, ${cmd.links.length} links`
    case "kpi":
      return `KPI "${cmd.label}" = ${cmd.value}`
    case "matrix":
      return `Matrix ${cmd.rows.length}x${cmd.columns.length}`
    case "annotation-group":
      return `AnnotationGroup ${cmd.items.length} items`
    case "treemap":
      return `Treemap ${cmd.data.length} items`
    case "donut":
      return `Donut ${cmd.segments.length} segments`
    case "stat-card":
      return `StatCard "${cmd.label}" ${cmd.before} → ${cmd.after}`
    case "code-block":
      return `CodeBlock ${cmd.code.split("\n").length} lines${cmd.language ? ` (${cmd.language})` : ""}`
    case "ribbon":
      return `Ribbon "${cmd.text}"`
    case "polar-area":
      return `PolarArea ${cmd.segments.length} segments`
    case "stacked-bar":
      return `StackedBar ${cmd.bars.length} bars`
    case "tooltip":
      return `Tooltip "${cmd.content.slice(0, 30)}"`
    case "badge-group":
      return `BadgeGroup ${cmd.badges.length} badges`
    case "scatter":
      return `Scatter ${cmd.points.length} points`
    case "meter":
      return `Meter ${cmd.value}${cmd.unit ?? ""}${cmd.label ? ` "${cmd.label}"` : ""}`
    case "html":
      return `Html ${cmd.html.length} chars`
    case "clear":
      return "Clear canvas"
    case "wait":
      return `Wait ${cmd.ms}ms`
  }
}
