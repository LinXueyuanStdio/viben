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
  // New: Data Visualization
  GaugeCommand,
  SparklineCommand,
  HeatmapCommand,
  FunnelCommand,
  WaterfallCommand,
  // New: Narrative/Structural
  CalloutCommand,
  TimelineCommand,
  FlowchartCommand,
  TableCommand,
  ListCommand,
  // New: Interaction/Effects
  ConfettiCommand,
  CountdownCommand,
  RevealCommand,
  ZoomCommand,
  MorphCommand,
  // New: Advanced Data & Annotations
  RadarCommand,
  SankeyCommand,
  KpiCommand,
  MatrixCommand,
  AnnotationGroupCommand,
  // New: Visualization & Code
  TreemapCommand,
  DonutCommand,
  StatCardCommand,
  CodeBlockCommand,
  // New: Visualization Types
  RibbonCommand,
  PolarAreaCommand,
  StackedBarCommand,
  TooltipCommand,
  BadgeGroupCommand,
  ScatterCommand,
  MeterCommand,
  // Core types
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

// Motion utilities (Remotion-based)
export {
  msToFrame,
  frameToMs,
  useEntrance,
  useSlideIn,
  useFadeIn,
  useDraw,
  useCounter,
  usePulse,
  usePulseOpacity,
  useTypewriter,
  useSpringValue,
  staggerDelay,
  // Cinematic motion hooks
  useElasticEntrance,
  useGlowPulse,
  useStaggeredReveal,
  useParallaxFloat,
  useMorphTransition,
  useShimmer,
  useCinematicEntrance,
} from "./utils/motion"
export type {
  EntranceValues,
  SlideDirection,
  SlideValues,
  ElasticEntranceValues,
  GlowPulseValues,
  StaggeredRevealValues,
  ParallaxFloatValues,
  MorphTransitionValues,
  ShimmerValues,
  CinematicEntranceValues,
  CinematicDirection,
} from "./utils/motion"

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

// Overlay components (Remotion-animated annotations)
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
// New: Data Visualization
export { Gauge } from "./overlays/gauge"
export { Sparkline } from "./overlays/sparkline"
export { Heatmap } from "./overlays/heatmap"
export { Funnel } from "./overlays/funnel"
export { Waterfall } from "./overlays/waterfall"
// New: Narrative/Structural
export { Callout } from "./overlays/callout"
export { Timeline } from "./overlays/timeline"
export { Flowchart } from "./overlays/flowchart"
export { Table } from "./overlays/table"
export { List } from "./overlays/list"
// New: Interaction/Effects
export { Confetti } from "./overlays/confetti"
export { Countdown } from "./overlays/countdown"
export { Reveal } from "./overlays/reveal"
export { Zoom } from "./overlays/zoom"
export { Morph } from "./overlays/morph"
// New: Advanced Data & Annotations
export { Radar } from "./overlays/radar"
export { Sankey } from "./overlays/sankey"
export { Kpi } from "./overlays/kpi"
export { Matrix } from "./overlays/matrix"
export { AnnotationGroup } from "./overlays/annotation-group"
// New: Visualization & Code
export { Treemap } from "./overlays/treemap"
export { Donut } from "./overlays/donut"
export { StatCard } from "./overlays/stat-card"
export { CodeBlock } from "./overlays/code-block"
// New: Visualization Types
export { Ribbon } from "./overlays/ribbon"
export { PolarArea } from "./overlays/polar-area"
export { StackedBar } from "./overlays/stacked-bar"
export { Tooltip } from "./overlays/tooltip"
export { BadgeGroup } from "./overlays/badge-group"
export { Scatter } from "./overlays/scatter"
export { Meter } from "./overlays/meter"

// Performance monitoring
export { createPerfMonitor, formatPerfReport } from "./utils/perf-monitor"
export type { PerfMetrics, PerfMonitor } from "./utils/perf-monitor"
export { PerfProfiler } from "./components/perf-profiler"
export type { PerfProfilerProps } from "./components/perf-profiler"

// Dev logger (isolated from render path, uses requestIdleCallback)
export { OverlayLogger } from "./components/overlay-logger"
export type { OverlayLoggerProps } from "./components/overlay-logger"

// Main components
export { PresentationLayer } from "./components/presentation-layer"
export type { PresentationLayerProps } from "./components/presentation-layer"

export { PresentationOverlay } from "./components/presentation-overlay"
export type { PresentationOverlayProps } from "./components/presentation-overlay"

export { PresentationComposition } from "./components/presentation-composition"
export type { PresentationCompositionProps } from "./components/presentation-composition"

export { PresentationPlayer } from "./components/presentation-player"
export type { PresentationPlayerProps } from "./components/presentation-player"

// Cinematic components (high-fidelity 3D-style visuals for Remotion)
export {
  CinematicStage,
  CameraRig,
  CinematicConceptCard,
  ConceptCardMatrix,
  PyramidConceptStack,
  FloatingConceptCards,
  CinematicLineChart,
  CinematicBarChart,
  PercentageRing,
  CandlestickChart,
  WorldMapHeatmap,
  TimelineChart,
  FloatingNodeGraph,
  TreeStructure,
  RadialStructure,
  TimelineStructure,
  KpiBlock,
  MarketTable,
  RealtimeTicker,
  RankingList,
  StatDashboard,
  PyramidInfoScene,
  CausalChainScene,
  CapitalFlowDiagram,
  LayeredExplanation,
  CinematicDollyZoom,
  FocusPull,
  SlowOrbit,
  ParallaxLayers,
  CinematicFinanceShowcase,
  cinematicTheme,
  toneColor,
  noiseFilterId,
  volumetricGlow,
  colorMix,
  clampInterpolate,
  softSpring,
  loopSine,
  particleTrail,
  noiseSeed,
  smoothStep,
  stagger,
  formatCompactNumber,
} from "./cinematic"
export type {
  CameraRigProps,
  CinematicConceptCardProps,
  ConceptCardData,
  CinematicLineChartProps,
  DataPoint,
  CandlestickData,
  MapRegion,
  TimelineEvent,
  StructureEdge,
  StructureNode,
  TreeNode,
  TickerItem,
  PyramidLayer,
  ChainStep,
  FlowTarget,
  ExplanationLayer,
  DollyZoomProps,
  FocusPullProps,
  SlowOrbitProps,
  ParallaxLayersProps,
  CinematicTone,
} from "./cinematic"

// Step command definitions (for just-bash integration)
export { ALL_STEP_COMMANDS, STEP_COMMAND_MAP, createPresentationTools } from "./commands"
export type {
  StepCommandDef,
  CommandCategory,
  CreatePresentationToolsOptions,
  PresentationToolDef,
} from "./commands"

// Re-export useful Remotion types
export type { PlayerRef } from "@remotion/player"
