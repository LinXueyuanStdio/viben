// Types
export type {
  PresentationCommand,
  SpotlightCommand,
  ArrowCommand,
  TextCommand,
  CircleCommand,
  HighlightCommand,
  CardCommand,
  PulseCommand,
  UnderlineCommand,
  BadgeCommand,
  ProgressCommand,
  CounterCommand,
  BracketCommand,
  TrendlineCommand,
  ComparisonCommand,
  TypewriterCommand,
  ChartCommand,
  ClearCommand,
  WaitCommand,
  Point,
  Rect,
  TargetRef,
  PositionOrTarget,
  RegionOrTarget,
  TldrawColor,
  PlayerState,
  PresentationStep,
  PresentationSequence,
  PresentationToolName,
  ClientToolResultContent,
  ClientToolResult,
  AnimationHandle,
} from "./types"
export { describeCommand, isTargetRef } from "./types"

// Target resolution utilities
export { resolvePosition, resolveRegion } from "./utils/resolve-target"

// Collision detection utilities
export {
  estimateBBox,
  detectCollisions,
  detectBoundaryViolations,
  logCollisionReport,
} from "./utils/collision-detect"
export type { OverlayBBox, Collision, BoundaryViolation } from "./utils/collision-detect"

// Hooks
export { useResolvedCommand } from "./hooks/use-resolved-command"
export { TargetRectsProvider, useTargetRects, useTargetRect } from "./hooks/use-target-rects"

// Command compiler
export {
  compilePresentationCommands,
  normalizePresentationToolName,
  isClientSidePresentationTool,
} from "./command-compiler"

// Completion callbacks
export {
  registerCompletionCallback,
  removeCompletionCallback,
  hasCompletionCallback,
  consumeCompletionCallback,
} from "./completion-callbacks"

// Overlay components (CSS-animated annotations)
export { Spotlight } from "./overlays/spotlight"
export { Arrow } from "./overlays/arrow"
export { TextAnnotation } from "./overlays/text-annotation"
export { CircleAnnotation } from "./overlays/circle-annotation"
export { Highlight } from "./overlays/highlight"
export { Card } from "./overlays/card"
export { Pulse } from "./overlays/pulse"
export { Underline } from "./overlays/underline"
export { Badge } from "./overlays/badge"
export { Progress } from "./overlays/progress"
export { Counter } from "./overlays/counter"
export { Bracket } from "./overlays/bracket"
export { Trendline } from "./overlays/trendline"
export { Comparison } from "./overlays/comparison"
export { Typewriter } from "./overlays/typewriter"
export { Chart } from "./overlays/chart"

// Main components
export { PresentationOverlay } from "./components/presentation-overlay"
export type { PresentationOverlayProps } from "./components/presentation-overlay"

export { PresentationLayer } from "./components/presentation-layer"
export type { PresentationLayerProps } from "./components/presentation-layer"

export { PresentationPlayer } from "./components/presentation-player"
export type { PresentationPlayerProps } from "./components/presentation-player"

export { OverlayControls, useAutoAdvance } from "./components/overlay-controls"
export type { OverlayControlsProps } from "./components/overlay-controls"

// Backward compatibility
export { PresentationComposition } from "./components/presentation-composition"
export type { PresentationCompositionProps } from "./components/presentation-composition"
