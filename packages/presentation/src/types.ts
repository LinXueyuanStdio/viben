/**
 * Presentation Mode Types -- CSS-animation-based overlay annotations
 *
 * Real-time transparent overlay for rendering animated annotations on top of page content.
 */

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

/** tldraw color names (kept for compatibility) */
export type TldrawColor =
  | "black"
  | "grey"
  | "light-violet"
  | "violet"
  | "blue"
  | "light-blue"
  | "yellow"
  | "orange"
  | "green"
  | "light-green"
  | "light-red"
  | "red"
  | "white"

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
export type PresentationToolName =
  | "presentation_draw"
  | "presentation_spotlight"
  | "presentation_callout"
  | "presentation_walkthrough"
  | "presentation_compare"
  | "presentation_clear"

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
    case "clear":
      return "Clear canvas"
    case "wait":
      return `Wait ${cmd.ms}ms`
  }
}
