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
  | ClearCommand
  | WaitCommand

/** Info card */
export interface CardCommand {
  type: "card"
  position: Point
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
  region: Rect
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
  from: Point
  to: Point
  color?: string
  label?: string
  /** Stroke width */
  strokeWidth?: number
  animate?: boolean
}

/** Text annotation */
export interface TextCommand {
  type: "text"
  position: Point
  content: string
  color?: string
  fontSize?: number
  fontWeight?: number
  /** Background color */
  background?: string
  animate?: boolean
}

/** Circle annotation */
export interface CircleCommand {
  type: "circle"
  center: Point
  radius: number
  color?: string
  strokeWidth?: number
  animate?: boolean
}

/** Region highlight (semi-transparent color block) */
export interface HighlightCommand {
  type: "highlight"
  region: Rect
  color?: string
  opacity?: number
  borderRadius?: number
  animate?: boolean
}

/** Pulse: pulsing attention ring at a point */
export interface PulseCommand {
  type: "pulse"
  center: Point
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
  from: Point
  /** End point (right) */
  to: Point
  color?: string
  strokeWidth?: number
  /** Wavy style */
  style?: "straight" | "wavy"
  animate?: boolean
}

/** Badge: floating small label/chip */
export interface BadgeCommand {
  type: "badge"
  position: Point
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
  position: Point
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
  position: Point
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
  from: Point
  /** End point */
  to: Point
  /** Which side the bracket curves to */
  direction?: "left" | "right"
  color?: string
  strokeWidth?: number
  /** Optional label at the bracket center */
  label?: string
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

/** Generate a human-readable description for a PresentationCommand */
export function describeCommand(cmd: PresentationCommand): string {
  switch (cmd.type) {
    case "spotlight":
      return `Spotlight (${cmd.region.x}, ${cmd.region.y}) ${cmd.region.width}x${cmd.region.height}`
    case "arrow":
      return `Arrow (${cmd.from.x},${cmd.from.y}) -> (${cmd.to.x},${cmd.to.y})${cmd.label ? ` "${cmd.label}"` : ""}`
    case "circle":
      return `Circle (${cmd.center.x},${cmd.center.y}) r=${cmd.radius}`
    case "text":
      return `Text "${cmd.content.slice(0, 30)}"`
    case "highlight":
      return `Highlight (${cmd.region.x}, ${cmd.region.y}) ${cmd.region.width}x${cmd.region.height}`
    case "card":
      return `Card "${cmd.title || cmd.content?.slice(0, 20) || ""}"`
    case "pulse":
      return `Pulse (${cmd.center.x},${cmd.center.y}) r=${cmd.radius ?? 20}`
    case "underline":
      return `Underline (${cmd.from.x},${cmd.from.y}) -> (${cmd.to.x},${cmd.to.y}) ${cmd.style ?? "straight"}`
    case "badge":
      return `Badge "${cmd.text}"`
    case "progress":
      return `Progress ${cmd.value}%${cmd.label ? ` "${cmd.label}"` : ""}`
    case "counter":
      return `Counter ${cmd.prefix ?? ""}${cmd.value}${cmd.suffix ?? ""}`
    case "bracket":
      return `Bracket (${cmd.from.x},${cmd.from.y}) -> (${cmd.to.x},${cmd.to.y})${cmd.label ? ` "${cmd.label}"` : ""}`
    case "clear":
      return "Clear canvas"
    case "wait":
      return `Wait ${cmd.ms}ms`
  }
}
