// Types
export type {
  PresentationCommand,
  SpotlightCommand,
  ArrowCommand,
  TextCommand,
  CircleCommand,
  HighlightCommand,
  CardCommand,
  ClearCommand,
  WaitCommand,
  Point,
  Rect,
  TldrawColor,
  PlayerState,
  PresentationStep,
  PresentationSequence,
  PresentationToolName,
  ClientToolResultContent,
  ClientToolResult,
  AnimationHandle,
} from "./types"
export { describeCommand } from "./types"

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
