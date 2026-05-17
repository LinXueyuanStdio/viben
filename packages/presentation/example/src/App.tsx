import React, { useState, useRef, useCallback, useEffect, useMemo, memo } from "react"
import { createPortal } from "react-dom"
import {
  PresentationPlayer,
  TargetRectsProvider,
  PerfProfiler,
  formatPerfReport,
  describeCommand,
  frameToMs,
  msToFrame,
  computeTotalMs,
  buildTimelineLanes,
  getActiveSteps,
  getCurrentStepIndex,
  commandColor,
  formatTime,
} from "@viben/presentation"
import type { PerfMetrics, TimelineItem, TimelineLane } from "@viben/presentation"
import type { PresentationStep, PlayerRef } from "@viben/presentation"
import {
  createJSONEditor,
  createValueSelection,
  Mode,
} from "vanilla-jsoneditor"
import type { JsonEditor } from "vanilla-jsoneditor"
import "vanilla-jsoneditor/themes/jse-theme-dark.css"
import { demoSteps, TOTAL_DURATION_MS } from "./demo-steps"
import { MockBackground } from "./MockBackground"
import { StepGallery } from "./StepGallery"
import { stepsToBashScript } from "./steps-to-bash"
import { createPresentationBash, joinMultilineQuotes, fixJsonQuoting } from "./bash-integration"
import { BashEditor } from "./BashEditor"
import { buildLineStepMapping } from "./editor-active-lines"

const FPS = 30
type JsonMode = "tree" | "text" | "table"
type JSONPath = string[]

// ============================================================================
// 内置短剧本 (timeline format)
// ============================================================================

let _stepId = 1000
function s(startMs: number, command: PresentationStep["command"], endMs?: number): PresentationStep {
  const id = `inline-${++_stepId}`
  return {
    id,
    toolUseId: `t-${id}`,
    toolName: "demo",
    toolInput: {},
    command,
    description: describeCommand(command),
    status: "done",
    startMs,
    endMs,
  }
}

function makeNewTypesSteps(): PresentationStep[] {
  return [
    // Data Visualization
    s(0, { type: "gauge", position: { x: 100, y: 100 }, value: 78, label: "Performance", color: "#6366F1" }, 4000),
    s(500, { type: "sparkline", position: { x: 400, y: 100 }, data: [10, 25, 18, 42, 35, 60, 55, 72, 68, 80], width: 200, height: 60, color: "#10B981", fill: true, showEndDot: true }, 4000),
    s(1000, { type: "heatmap", position: { x: 700, y: 80 }, data: [[0.2, 0.8, 0.5], [0.9, 0.3, 0.7], [0.4, 0.6, 1.0]], cellSize: 32, rowLabels: ["A", "B", "C"], colLabels: ["X", "Y", "Z"] }, 4000),

    // More data viz
    s(4000, { type: "funnel", position: { x: 120, y: 120 }, stages: [{ label: "Visitors", value: 10000, color: "#6366F1" }, { label: "Leads", value: 5200, color: "#8B5CF6" }, { label: "Trials", value: 2100, color: "#A855F7" }, { label: "Customers", value: 800, color: "#C084FC" }], width: 280, height: 220 }, 8000),
    s(4500, { type: "waterfall", position: { x: 500, y: 100 }, data: [{ label: "Revenue", value: 100, type: "total" }, { label: "Sales", value: 40, type: "increase" }, { label: "Services", value: 25, type: "increase" }, { label: "Costs", value: -35, type: "decrease" }, { label: "Tax", value: -15, type: "decrease" }, { label: "Net", value: 115, type: "total" }], width: 320, height: 200 }, 8000),

    // Narrative/Structural
    s(8000, { type: "callout", position: { x: 200, y: 200 }, content: "This is an important callout bubble!", arrowDirection: "bottom", background: "rgba(99,102,241,0.95)" }, 11000),
    s(8500, { type: "timeline", position: { x: 100, y: 400 }, events: [{ label: "Q1", description: "Launch", active: true }, { label: "Q2", description: "Growth" }, { label: "Q3", description: "Scale", color: "#10B981" }, { label: "Q4", description: "Profit" }], direction: "horizontal", width: 500 }, 11500),
    s(9000, { type: "list", position: { x: 700, y: 180 }, items: [{ text: "First item", color: "#6366F1" }, { text: "Second item", color: "#10B981" }, { text: "Third item", color: "#F59E0B" }, { text: "Fourth item", color: "#EF4444" }], listStyle: "check", stagger: 5 }, 12000),

    // More narrative
    s(11500, { type: "flowchart", position: { x: 150, y: 150 }, nodes: [{ id: "a", label: "Start", color: "#6366F1" }, { id: "b", label: "Process" }, { id: "c", label: "Decision", color: "#F59E0B" }, { id: "d", label: "End", color: "#10B981" }], edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "d" }], direction: "horizontal", width: 600 }, 15000),
    s(12000, { type: "table", position: { x: 150, y: 420 }, headers: ["Name", "Revenue", "Growth"], rows: [["NVIDIA", "$26B", "+122%"], ["AMD", "$3.5B", "+45%"], ["Intel", "$1.1B", "-8%"]], highlights: [[0, 2]], rowStagger: 4 }, 15500),

    // Effects
    s(15500, { type: "countdown", position: { x: 480, y: 300 }, from: 3, fontSize: 120, color: "#fff" }, 19500),
    s(19500, { type: "confetti", position: { x: 480, y: 300 }, count: 60, spread: 250, colors: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"] }, 23000),
    s(20000, { type: "morph", position: { x: 480, y: 300 }, from: 0, to: 100, color: "#6366F1", fontSize: 64 }, 23000),

    // Zoom + Reveal
    s(23000, { type: "reveal", region: { x: 100, y: 100, width: 400, height: 300 }, direction: "center", color: "#1a1a2e" }, 26000),
    s(24000, { type: "zoom", region: { x: 300, y: 200, width: 200, height: 150 }, scale: 2.5, borderColor: "#6366F1" }, 27000),

    s(27000, { type: "clear" }),
  ]
}

function makeAdvancedTypesSteps(): PresentationStep[] {
  return [
    s(0, { type: "radar", position: { x: 80, y: 80 }, axes: [{ label: "Speed", value: 85 }, { label: "Power", value: 72 }, { label: "Range", value: 60 }, { label: "Defense", value: 90 }, { label: "Accuracy", value: 78 }, { label: "Stealth", value: 65 }], color: "#6366F1", fillOpacity: 0.3, size: 220 }, 5000),
    s(500, { type: "kpi", position: { x: 400, y: 80 }, value: 2847000, label: "Monthly Revenue", trend: "up", trendValue: "+12.5%", sparkData: [20, 35, 28, 45, 42, 58, 55, 68, 72, 85], color: "#10B981" }, 5000),
    s(1000, { type: "kpi", position: { x: 650, y: 80 }, value: 14200, label: "Active Users", trend: "up", trendValue: "+8.3%", sparkData: [100, 120, 115, 140, 135, 160, 158, 175, 180, 195], color: "#6366F1" }, 5000),

    s(5000, { type: "sankey", position: { x: 80, y: 100 }, nodes: [{ id: "organic", label: "Organic" }, { id: "paid", label: "Paid Ads" }, { id: "social", label: "Social" }, { id: "signup", label: "Sign Up" }, { id: "trial", label: "Free Trial" }, { id: "convert", label: "Conversion" }], links: [{ source: "organic", target: "signup", value: 40 }, { source: "organic", target: "trial", value: 25 }, { source: "paid", target: "signup", value: 30 }, { source: "paid", target: "trial", value: 15 }, { source: "social", target: "signup", value: 20 }, { source: "social", target: "trial", value: 10 }, { source: "signup", target: "convert", value: 55 }, { source: "trial", target: "convert", value: 35 }], width: 520, height: 320 }, 10000),
    s(5500, { type: "matrix", position: { x: 640, y: 100 }, columns: ["Free", "Pro", "Enterprise"], rows: [{ label: "Unlimited projects", values: ["no", "yes", "yes"] }, { label: "Custom domains", values: ["no", "yes", "yes"] }, { label: "Analytics", values: ["partial", "yes", "yes"] }, { label: "API Access", values: ["no", "partial", "yes"] }, { label: "Priority Support", values: ["no", "no", "yes"] }, { label: "SLA Guarantee", values: ["no", "no", "yes"] }], width: 380 }, 10000),

    s(10000, { type: "annotation-group", position: { x: 120, y: 150 }, items: [{ label: "Data Collection", color: "#6366F1" }, { label: "Preprocessing", color: "#8B5CF6" }, { label: "Model Training", color: "#A855F7" }, { label: "Evaluation", color: "#EC4899" }, { label: "Deployment", color: "#10B981" }], direction: "vertical", connector: "bracket" }, 14000),
    s(10500, { type: "annotation-group", position: { x: 400, y: 150 }, items: [{ label: "Q1 2024", color: "#6366F1" }, { label: "Q2 2024", color: "#10B981" }, { label: "Q3 2024", color: "#F59E0B" }, { label: "Q4 2024", color: "#EF4444" }], direction: "horizontal", connector: "dots" }, 14000),
    s(11000, { type: "radar", position: { x: 400, y: 280 }, axes: [{ label: "React", value: 92 }, { label: "Vue", value: 78 }, { label: "Angular", value: 65 }, { label: "Svelte", value: 55 }, { label: "Solid", value: 45 }], color: "#EC4899", fillOpacity: 0.2, size: 200 }, 14000),
    s(11500, { type: "kpi", position: { x: 680, y: 280 }, value: "99.97%", label: "Uptime SLA", trend: "flat", color: "#38BDF8" }, 14000),

    s(14000, { type: "clear" }),
  ]
}

function makeVisualizationSteps(): PresentationStep[] {
  return [
    // Treemap — hierarchical data
    s(0, {
      type: "treemap",
      position: { x: 60, y: 80 },
      data: [
        { label: "React", value: 42, color: "#61DAFB" },
        { label: "Vue", value: 28, color: "#42B883" },
        { label: "Angular", value: 18, color: "#DD0031" },
        { label: "Svelte", value: 12, color: "#FF3E00" },
        { label: "Solid", value: 8, color: "#2C4F7C" },
        { label: "Preact", value: 5, color: "#673AB8" },
      ],
      width: 360,
      height: 220,
    }, 6000),

    // Donut — market share
    s(500, {
      type: "donut",
      position: { x: 500, y: 80 },
      segments: [
        { label: "Desktop", value: 54, color: "#6366F1" },
        { label: "Mobile", value: 32, color: "#10B981" },
        { label: "Tablet", value: 9, color: "#F59E0B" },
        { label: "Other", value: 5, color: "#EC4899" },
      ],
      size: 180,
      innerRatio: 0.6,
    }, 6000),

    // StatCard — performance improvement
    s(6000, {
      type: "stat-card",
      position: { x: 80, y: 120 },
      label: "Page Load Time",
      before: 3200,
      after: 890,
      unit: "ms",
      color: "#10B981",
    }, 11000),

    s(6500, {
      type: "stat-card",
      position: { x: 450, y: 120 },
      label: "Monthly Revenue",
      before: 48000,
      after: 127000,
      unit: "$",
      color: "#6366F1",
    }, 11000),

    // CodeBlock — animated code
    s(11000, {
      type: "code-block",
      position: { x: 80, y: 100 },
      code: "import { spring } from \"remotion\";\n\nconst animation = spring({\n  frame,\n  fps: 30,\n  config: { damping: 12 },\n});\n\nreturn (\n  <div style={{ opacity: animation }}>\n    Hello, Remotion!\n  </div>\n);",
      language: "typescript",
      highlightLines: [3, 4, 5, 6],
    }, 17000),

    s(11500, {
      type: "donut",
      position: { x: 560, y: 120 },
      segments: [
        { label: "TypeScript", value: 68, color: "#3178C6" },
        { label: "JavaScript", value: 22, color: "#F7DF1E" },
        { label: "CSS", value: 7, color: "#264DE4" },
        { label: "Other", value: 3, color: "#8B5CF6" },
      ],
      size: 160,
      innerRatio: 0.55,
    }, 17000),

    // Final scene — all together
    s(17000, {
      type: "treemap",
      position: { x: 60, y: 60 },
      data: [
        { label: "AWS", value: 32, color: "#FF9900" },
        { label: "Azure", value: 23, color: "#0078D4" },
        { label: "GCP", value: 11, color: "#4285F4" },
        { label: "Others", value: 8, color: "#6B7280" },
      ],
      width: 300,
      height: 180,
    }, 22000),

    s(17500, {
      type: "stat-card",
      position: { x: 420, y: 80 },
      label: "API Latency (p99)",
      before: 450,
      after: 89,
      unit: "ms",
      color: "#EC4899",
    }, 22000),

    s(18000, {
      type: "code-block",
      position: { x: 100, y: 320 },
      code: "// Performance optimization\nconst memo = useMemo(() => {\n  return computeExpensive(data);\n}, [data]);",
      language: "typescript",
      highlightLines: [2, 3, 4],
    }, 22000),

    s(22000, { type: "clear" }),
  ]
}

function makeSpotlightSteps(): PresentationStep[] {
  return [
    s(0, { type: "spotlight", region: { targetId: "title", padding: 12 }, maskOpacity: 0.75, borderRadius: 12 }, 3000),
    s(3000, { type: "spotlight", region: { targetId: "card-nvidia", padding: 8 }, maskOpacity: 0.75, borderRadius: 10 }, 5500),
    s(5500, { type: "spotlight", region: { targetId: "card-amd", padding: 8 }, maskOpacity: 0.7, borderRadius: 10 }, 8000),
    s(8000, { type: "spotlight", region: { targetId: "card-others", padding: 8 }, maskOpacity: 0.7, borderRadius: 10 }, 10500),
    s(10500, { type: "clear" }),
  ]
}

// ============================================================================
// Script definitions
// ============================================================================

interface Script {
  id: string
  title: string
  description: string
  icon: string
  steps: PresentationStep[]
  totalDurationMs: number
  /** Use MockBackground? */
  useBackground: boolean
}


function formatTimeWithFlashingColon(ms: number, isPlaying: boolean): string {
  const safeMs = Math.max(0, Math.round(ms))
  const totalSeconds = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const tenths = Math.floor((safeMs % 1000) / 100)
  const colonVisible = !isPlaying || Math.floor(safeMs / 500) % 2 === 0
  const colon = colonVisible ? ":" : " "
  return `${minutes}${colon}${seconds.toString().padStart(2, "0")}.${tenths}`
}

const SCRIPTS: Script[] = [
  {
    id: "ai-chip",
    title: "AI 芯片市场深度分析",
    description: "完整180s时间线演示，使用 Remotion 驱动所有动画",
    icon: "📊",
    steps: demoSteps,
    totalDurationMs: TOTAL_DURATION_MS,
    useBackground: true,
  },
  {
    id: "new-types",
    title: "新动作类型展示",
    description: "Gauge、Sparkline、Heatmap、Funnel、Timeline、Flowchart、Confetti 等 15 种新类型",
    icon: "✨",
    steps: makeNewTypesSteps(),
    totalDurationMs: computeTotalMs(makeNewTypesSteps()),
    useBackground: false,
  },
  {
    id: "advanced-types",
    title: "高级数据类型展示",
    description: "Radar、Sankey、KPI、Matrix、AnnotationGroup — 5 种高级数据可视化类型",
    icon: "🎯",
    steps: makeAdvancedTypesSteps(),
    totalDurationMs: computeTotalMs(makeAdvancedTypesSteps()),
    useBackground: false,
  },
  {
    id: "visualization",
    title: "数据可视化展示",
    description: "Treemap、Donut、StatCard、CodeBlock — 高级数据可视化组件",
    icon: "\uD83D\uDCC8",
    steps: makeVisualizationSteps(),
    totalDurationMs: computeTotalMs(makeVisualizationSteps()),
    useBackground: false,
  },
  {
    id: "spotlight-demo",
    title: "聚光灯演示",
    description: "Spotlight 遮罩聚焦效果",
    icon: "🔦",
    steps: makeSpotlightSteps(),
    totalDurationMs: computeTotalMs(makeSpotlightSteps()),
    useBackground: true,
  },
]

// ============================================================================
// Background components
// ============================================================================

function GradientBackground() {
  return <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }} />
}


function toEditorMode(mode: JsonMode): Mode {
  switch (mode) {
    case "tree":
      return Mode.tree
    case "table":
      return Mode.table
    case "text":
      return Mode.text
  }
}


function JsonInspector({
  value,
  height = 205,
  initialMode = "tree",
  focusPath,
  compact = false,
  fillHeight = false,
}: {
  value: unknown
  height?: number
  initialMode?: JsonMode
  focusPath?: JSONPath
  compact?: boolean
  fillHeight?: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<JsonEditor | null>(null)
  const prevValueRef = useRef<string>("")
  const [valueChanged, setValueChanged] = useState(false)

  const jsonStr = useMemo(() => JSON.stringify(value, null, 2), [value])

  // Detect value changes for diff flash effect
  useEffect(() => {
    if (prevValueRef.current && prevValueRef.current !== jsonStr) {
      setValueChanged(true)
      const timer = window.setTimeout(() => setValueChanged(false), 800)
      prevValueRef.current = jsonStr
      return () => window.clearTimeout(timer)
    }
    prevValueRef.current = jsonStr
  }, [jsonStr])

  const updateEditorProps = useCallback(() => {
    editorRef.current?.updateProps({
      content: { json: value },
      mode: toEditorMode(initialMode),
      readOnly: true,
      mainMenuBar: !compact,
      navigationBar: !compact,
      statusBar: !compact,
      indentation: 2,
      askToFormat: false,
    })
  }, [compact, initialMode, value])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    editorRef.current = createJSONEditor({
      target: host,
      props: {
        content: { json: value },
        mode: toEditorMode(initialMode),
        readOnly: true,
        mainMenuBar: !compact,
        navigationBar: !compact,
        statusBar: !compact,
        indentation: 2,
        askToFormat: false,
      },
    })

    return () => {
      void editorRef.current?.destroy()
      editorRef.current = null
    }
  }, [])

  useEffect(() => {
    updateEditorProps()
  }, [updateEditorProps])

  useEffect(() => {
    if (!focusPath || initialMode === "text") return
    const timer = window.setTimeout(() => {
      const editor = editorRef.current
      if (!editor) return
      const nextSelection = createValueSelection(focusPath)
      editor.select(nextSelection)
      void editor.scrollTo(focusPath)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [focusPath, initialMode, value])

  return (
    <div
      className={`jse-theme-dark ${valueChanged ? "pbc-diff-flash" : ""}`}
      style={{
        height: fillHeight ? "100%" : height,
        minHeight: fillHeight ? 0 : height,
        flex: fillHeight ? 1 : undefined,
        borderRadius: 9,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "#111827",
      }}
    >
      <div
        ref={hostRef}
        style={{
          height: "100%",
          ["--jse-font-size-mono" as string]: "11px",
        }}
      />
    </div>
  )
}


// ---------------------------------------------------------------------------
// SVG icon helpers — lightweight inline SVGs instead of text characters
// ---------------------------------------------------------------------------

function IconSkipBack({ size = 16 }: { size?: number }) {
  // Go to start: triple bar + triangle (||| <) — mirror of skip forward
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="21 18 13 12 21 6 21 18" fill="currentColor" opacity={0.7} />
      <line x1="10" y1="5" x2="10" y2="19" strokeWidth={2.2} />
      <line x1="6" y1="5" x2="6" y2="19" strokeWidth={2.2} />
      <line x1="2" y1="5" x2="2" y2="19" strokeWidth={2.2} />
    </svg>
  )
}

function IconStepBack({ size = 16 }: { size?: number }) {
  // Previous step: double triangle (|<<) — mirror of step forward
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="21 20 13 12 21 4 21 20" fill="currentColor" opacity={0.8} />
      <polygon points="12 20 4 12 12 4 12 20" fill="currentColor" opacity={0.5} />
      <line x1="3" y1="5" x2="3" y2="19" strokeWidth={2.5} />
    </svg>
  )
}

function IconStepForward({ size = 16 }: { size?: number }) {
  // Next step: double triangle (>>|) — distinct from single frame advance
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 4 11 12 3 20 3 4" fill="currentColor" opacity={0.8} />
      <polygon points="12 4 20 12 12 20 12 4" fill="currentColor" opacity={0.5} />
      <line x1="21" y1="5" x2="21" y2="19" strokeWidth={2.5} />
    </svg>
  )
}

function IconSkipForward({ size = 16 }: { size?: number }) {
  // Go to end: triple bar (|||>) — clearly "jump to end"
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 11 12 3 18 3 6" fill="currentColor" opacity={0.7} />
      <line x1="14" y1="5" x2="14" y2="19" strokeWidth={2.2} />
      <line x1="18" y1="5" x2="18" y2="19" strokeWidth={2.2} />
      <line x1="22" y1="5" x2="22" y2="19" strokeWidth={2.2} />
    </svg>
  )
}

function IconPlay({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}

function IconPause({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="3" width="5" height="18" rx="1" />
      <rect x="14" y="3" width="5" height="18" rx="1" />
    </svg>
  )
}

function IconChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function IconChevronUp({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 15 12 9 18 15" />
    </svg>
  )
}

function IconChevronLeft({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function IconChevronRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

function IconLoop({ size = 14, active = false }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={active ? "#76B900" : "currentColor"} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function IconFrameBack({ size = 14 }: { size?: number }) {
  // Single frame back: thin bar with tiny notch arrow — mirror of frame forward
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="4" x2="6" y2="20" />
      <line x1="18" y1="12" x2="10" y2="12" />
      <polyline points="13 8 9 12 13 16" />
    </svg>
  )
}

function IconFrameForward({ size = 14 }: { size?: number }) {
  // Single frame: thin bar with tiny notch arrow — minimal, distinct from step/skip
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="4" x2="18" y2="20" />
      <line x1="6" y1="12" x2="14" y2="12" />
      <polyline points="11 8 15 12 11 16" />
    </svg>
  )
}


// ---------------------------------------------------------------------------
// Shared style injection for CSS-based hover/active states & animations
// (Injected once, scoped via class names, avoids per-component useState for hover)
// ---------------------------------------------------------------------------

let _stylesInjected = false
function injectConsoleStyles() {
  if (_stylesInjected) return
  _stylesInjected = true
  const style = document.createElement("style")
  style.textContent = `
    .pbc-btn {
      transition: background 120ms ease, border-color 120ms ease, transform 80ms ease, box-shadow 120ms ease;
      outline: none;
    }
    .pbc-btn:hover { filter: brightness(1.25); }
    .pbc-btn:active { transform: scale(0.94); }
    .pbc-btn:focus-visible {
      box-shadow: 0 0 0 2px rgba(118,185,0,0.5);
    }
    .pbc-btn-primary:hover {
      background: rgba(118,185,0,0.38) !important;
      border-color: rgba(118,185,0,0.9) !important;
    }
    .pbc-btn-primary:active {
      background: rgba(118,185,0,0.5) !important;
    }
    .pbc-btn-ghost:hover {
      background: rgba(255,255,255,0.12) !important;
    }
    .pbc-btn-ghost:active {
      background: rgba(255,255,255,0.18) !important;
    }
    .pbc-seg:hover:not(.pbc-seg-active) {
      background: rgba(255,255,255,0.08) !important;
    }
    .pbc-seg-active {
      background: rgba(255,255,255,0.18) !important;
      color: #fff !important;
    }
    .pbc-seg:focus-visible {
      box-shadow: 0 0 0 2px rgba(118,185,0,0.5);
      outline: none;
    }
    @keyframes stepPopoverIn {
      from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.96); }
      to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    }
    @keyframes stepPopoverOut {
      from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
      to { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.97); }
    }
    .pbc-timeline-item {
      transition: opacity 100ms ease, filter 100ms ease, box-shadow 150ms ease;
    }
    .pbc-timeline-item:hover {
      opacity: 1 !important;
      filter: brightness(1.35);
      z-index: 3;
    }
    .pbc-timeline-item:focus-visible {
      outline: 2px solid rgba(118,185,0,0.7);
      outline-offset: 1px;
    }
    @keyframes pbc-active-pulse {
      0%, 100% { box-shadow: 0 0 8px var(--pulse-color, rgba(118,185,0,0.4)), inset 0 1px 0 rgba(255,255,255,0.15); }
      50% { box-shadow: 0 0 14px var(--pulse-color, rgba(118,185,0,0.6)), 0 0 4px var(--pulse-color, rgba(118,185,0,0.3)), inset 0 1px 0 rgba(255,255,255,0.2); }
    }
    .pbc-timeline-item-active {
      animation: pbc-active-pulse 1.8s ease-in-out infinite;
    }
    .pbc-lane-row {
      transition: background 120ms ease;
    }
    .pbc-lane-row:hover {
      background: rgba(255,255,255,0.035) !important;
    }
    .pbc-cmd-card {
      transition: background 100ms ease;
    }
    .pbc-cmd-card:hover {
      background: rgba(255,255,255,0.04);
    }
    .pbc-collapse-anim {
      transition: max-height 300ms cubic-bezier(0.34, 1.56, 0.64, 1), padding 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease;
    }
    /* Custom range slider styling */
    .pbc-range {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: transparent;
      cursor: pointer;
      outline: none;
    }
    .pbc-range::-webkit-slider-runnable-track {
      height: 6px;
      border-radius: 3px;
      background: rgba(255,255,255,0.1);
    }
    .pbc-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #76B900;
      border: 2px solid #fff;
      margin-top: -4px;
      cursor: pointer;
      box-shadow: 0 0 8px rgba(118,185,0,0.5);
      transition: transform 100ms ease, box-shadow 100ms ease;
    }
    .pbc-range::-webkit-slider-thumb:hover {
      transform: scale(1.2);
      box-shadow: 0 0 14px rgba(118,185,0,0.7);
    }
    .pbc-range::-moz-range-track {
      height: 6px;
      border-radius: 3px;
      background: rgba(255,255,255,0.1);
      border: none;
    }
    .pbc-range::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #76B900;
      border: 2px solid #fff;
      cursor: pointer;
      box-shadow: 0 0 8px rgba(118,185,0,0.5);
    }
    .pbc-range:focus-visible::-webkit-slider-thumb {
      box-shadow: 0 0 0 3px rgba(118,185,0,0.4), 0 0 12px rgba(118,185,0,0.6);
    }
    .pbc-scrub-wrapper:hover .pbc-scrub-thumb {
      transform: translate(-50%, -50%) scale(1.3);
    }
    .pbc-kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 4px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      font-size: 9px;
      font-weight: 700;
      color: rgba(255,255,255,0.5);
      font-family: SFMono-Regular, Consolas, monospace;
      line-height: 1;
    }
    /* Enhanced timeline playhead */
    .pbc-playhead-handle {
      cursor: ew-resize;
      transition: transform 80ms ease, filter 80ms ease;
    }
    .pbc-playhead-handle:hover {
      transform: scaleX(1.3);
      filter: brightness(1.3) drop-shadow(0 0 4px rgba(118,185,0,0.8));
    }
    .pbc-playhead-line {
      background: linear-gradient(180deg, #76B900, #9FE030, #76B900) !important;
      box-shadow: 0 0 12px rgba(118,185,0,0.7), 0 0 4px rgba(118,185,0,0.9), 0 0 24px rgba(118,185,0,0.3) !important;
    }
    /* Timeline track area custom scrollbar */
    .pbc-track-scroll::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    .pbc-track-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .pbc-track-scroll::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.12);
      border-radius: 3px;
    }
    .pbc-track-scroll::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.22);
    }
    .pbc-track-scroll {
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.12) transparent;
    }
    /* Minimap viewport drag */
    .pbc-minimap-viewport {
      cursor: grab;
      transition: border-color 100ms ease, background 100ms ease, box-shadow 100ms ease;
    }
    .pbc-minimap-viewport:hover {
      border-color: rgba(118,185,0,0.7) !important;
      background: rgba(118,185,0,0.1) !important;
      box-shadow: 0 0 6px rgba(118,185,0,0.2);
    }
    .pbc-minimap-viewport:active {
      cursor: grabbing;
      border-color: rgba(118,185,0,0.9) !important;
    }
    /* Minimap resize handles */
    .pbc-minimap-viewport::before,
    .pbc-minimap-viewport::after {
      content: '';
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 8px;
      border-radius: 1.5px;
      background: rgba(118,185,0,0.5);
      opacity: 0;
      transition: opacity 100ms ease;
    }
    .pbc-minimap-viewport::before { left: 2px; }
    .pbc-minimap-viewport::after { right: 2px; }
    .pbc-minimap-viewport:hover::before,
    .pbc-minimap-viewport:hover::after {
      opacity: 1;
    }
    /* Timeline block label */
    .pbc-timeline-item .pbc-block-label {
      opacity: 0.85;
      transition: opacity 80ms ease;
    }
    .pbc-timeline-item:hover .pbc-block-label {
      opacity: 1;
    }
    /* Active block glow animation - enhanced */
    @keyframes pbc-block-glow {
      0%, 100% { box-shadow: 0 0 8px var(--glow-color, rgba(118,185,0,0.4)), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2); }
      50% { box-shadow: 0 0 18px var(--glow-color, rgba(118,185,0,0.7)), 0 0 6px var(--glow-color, rgba(118,185,0,0.4)), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.2); }
    }
    .pbc-block-active-glow {
      animation: pbc-block-glow 2s ease-in-out infinite;
    }
    /* Playhead time badge */
    .pbc-playhead-time {
      position: absolute;
      top: -20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(118,185,0,0.95);
      font-size: 9px;
      font-weight: 700;
      color: #fff;
      font-variant-numeric: tabular-nums;
      font-family: SFMono-Regular, Consolas, monospace;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      pointer-events: none;
    }
    /* Playhead motion trail */
    @keyframes pbc-playhead-trail {
      0% { opacity: 0.4; }
      100% { opacity: 0; }
    }
    .pbc-playhead-trail {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      pointer-events: none;
      animation: pbc-playhead-trail 400ms ease-out forwards;
    }
    /* Group collapse/expand */
    .pbc-group-header {
      cursor: pointer;
      user-select: none;
      transition: background 120ms ease;
    }
    .pbc-group-header:hover {
      background: rgba(255,255,255,0.05) !important;
    }
    .pbc-group-chevron {
      transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
      display: inline-flex;
      align-items: center;
    }
    .pbc-group-chevron-collapsed {
      transform: rotate(-90deg);
    }
    /* Item count badge animation */
    @keyframes pbc-badge-pop {
      0% { transform: scale(0.7); opacity: 0; }
      50% { transform: scale(1.15); }
      100% { transform: scale(1); opacity: 1; }
    }
    .pbc-badge-pop {
      animation: pbc-badge-pop 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    /* Zoom controls */
    .pbc-zoom-btn {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 5px;
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.6);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background 100ms ease, border-color 100ms ease, color 100ms ease;
      padding: 0;
      line-height: 1;
    }
    .pbc-zoom-btn:hover {
      background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.2);
      color: rgba(255,255,255,0.9);
    }
    .pbc-zoom-btn:active {
      background: rgba(255,255,255,0.15);
      transform: scale(0.93);
    }
    /* Time ruler enhanced */
    .pbc-time-ruler {
      position: relative;
      height: 28px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
    }
    .pbc-ruler-tick-major {
      position: absolute;
      bottom: 0;
      width: 1px;
      height: 10px;
      background: rgba(255,255,255,0.2);
    }
    .pbc-ruler-tick-minor {
      position: absolute;
      bottom: 0;
      width: 1px;
      height: 5px;
      background: rgba(255,255,255,0.08);
    }
    .pbc-ruler-label {
      position: absolute;
      top: 4px;
      transform: translateX(-50%);
      font-size: 9px;
      color: rgba(255,255,255,0.4);
      font-variant-numeric: tabular-nums;
      font-family: SFMono-Regular, Consolas, monospace;
      white-space: nowrap;
    }
    /* Density curve minimap */
    .pbc-density-curve {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    /* Tooltip for block labels */
    .pbc-block-tooltip {
      position: absolute;
      bottom: calc(100% + 4px);
      left: 50%;
      transform: translateX(-50%);
      padding: 3px 7px;
      border-radius: 4px;
      background: rgba(10, 12, 28, 0.95);
      border: 1px solid rgba(255,255,255,0.1);
      font-size: 9px;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 120ms ease;
      z-index: 10;
    }
    .pbc-timeline-item:hover .pbc-block-tooltip {
      opacity: 1;
    }
    /* Speed dropdown */
    .pbc-speed-menu {
      position: absolute;
      bottom: calc(100% + 4px);
      left: 50%;
      transform: translateX(-50%);
      padding: 4px;
      border-radius: 8px;
      background: rgba(10, 12, 28, 0.97);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
      backdrop-filter: blur(20px);
      z-index: 20;
      min-width: 64px;
    }
    .pbc-speed-option {
      display: block;
      width: 100%;
      padding: 5px 10px;
      border: none;
      border-radius: 5px;
      background: transparent;
      color: rgba(255,255,255,0.65);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      font-variant-numeric: tabular-nums;
      font-family: SFMono-Regular, Consolas, monospace;
      transition: background 80ms ease;
    }
    .pbc-speed-option:hover {
      background: rgba(255,255,255,0.1);
    }
    .pbc-speed-option-active {
      color: #76B900 !important;
      background: rgba(118,185,0,0.12) !important;
    }
    /* Empty state clock animation */
    @keyframes pbc-clock-pulse {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.08); }
    }
    .pbc-empty-clock {
      animation: pbc-clock-pulse 2.5s ease-in-out infinite;
    }
    @keyframes pbc-clock-hand {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .pbc-clock-hand-anim {
      transform-origin: 12px 12px;
      animation: pbc-clock-hand 3s linear infinite;
    }
    /* Command card enter/exit transition */
    @keyframes pbc-card-enter {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .pbc-cmd-card-enter { animation: pbc-card-slide-in 250ms cubic-bezier(0.16,1,0.3,1) both; }
    @keyframes pbc-card-slide-in { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes pbc-card-pulse-glow { 0%,100% { box-shadow: inset 0 0 0 rgba(118,185,0,0); } 50% { box-shadow: inset 0 0 8px rgba(118,185,0,0.15); } }
    .pbc-cmd-card-pulse { animation: pbc-card-slide-in 250ms cubic-bezier(0.16,1,0.3,1) both, pbc-card-pulse-glow 600ms ease-out 250ms; }
    @keyframes pbc-loop-pulse-anim { 0%,100% { box-shadow: 0 0 0 0 rgba(118,185,0,0); } 50% { box-shadow: 0 0 8px 2px rgba(118,185,0,0.3); } }
    .pbc-loop-pulse { animation: pbc-loop-pulse-anim 2s ease-in-out infinite; }
    @keyframes pbc-badge-dot-pulse { 0%,100% { opacity:0.7; transform:scale(1); } 50% { opacity:1; transform:scale(1.3); } }
    .pbc-badge-dot { animation: pbc-badge-dot-pulse 1.5s ease-in-out infinite; }
    @keyframes pbc-play-press-ring { 0% { box-shadow: 0 0 0 0 rgba(118,185,0,0.6); } 100% { box-shadow: 0 0 0 8px rgba(118,185,0,0); } }
    .pbc-play-btn:active { animation: pbc-play-press-ring 400ms ease-out !important; }
    .pbc-cmd-card:hover {
      background: rgba(255,255,255,0.06) !important;
    }
    /* JSON diff highlight */
    @keyframes pbc-diff-flash {
      0% { background: rgba(118,185,0,0.25); }
      100% { background: transparent; }
    }
    .pbc-diff-flash {
      animation: pbc-diff-flash 800ms ease-out;
    }
    /* Copy button feedback */
    @keyframes pbc-copy-check {
      0% { transform: scale(0.8); opacity: 0; }
      30% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    .pbc-copy-check {
      animation: pbc-copy-check 300ms ease-out;
    }
    /* Time display glow */
    .pbc-time-glow {
      text-shadow: 0 0 12px rgba(118,185,0,0.4), 0 0 4px rgba(118,185,0,0.2);
    }
    /* Circular progress ring animation */
    .pbc-progress-ring {
      transition: stroke-dashoffset 120ms linear;
    }
    /* Speed dial visual */
    .pbc-speed-dial {
      transition: transform 200ms cubic-bezier(0.4,0,0.2,1);
    }
    /* Panel cross-fade */
    @keyframes pbc-panel-fadein {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .pbc-panel-fade {
      animation: pbc-panel-fadein 200ms ease-out;
    }
    /* Waiting countdown pulse */
    @keyframes pbc-waiting-pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 0.9; }
    }
    .pbc-waiting-pulse {
      animation: pbc-waiting-pulse 1.5s ease-in-out infinite;
    }
    /* Keyboard shortcut tooltip */
    .pbc-kbd-group {
      position: relative;
      display: inline-flex;
    }
    .pbc-kbd-group .pbc-kbd-tooltip {
      display: none;
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 8px;
      border-radius: 5px;
      background: rgba(0,0,0,0.92);
      border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.75);
      font-size: 9px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 30;
    }
    .pbc-kbd-group:hover .pbc-kbd-tooltip {
      display: block;
    }
    /* Waveform bar in progress background */
    .pbc-waveform-bar {
      display: inline-block;
      border-radius: 1px;
      background: rgba(118,185,0,0.25);
      min-width: 1px;
    }
  `
  document.head.appendChild(style)
}

function PresentationPlaybackConsole({
  script,
  currentMs,
  currentStepIndex,
  activeSteps,
  isPlaying,
  isLooping,
  playbackRate,
  onSeek,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onGoToStart,
  onGoToEnd,
  onToggleLoop,
  onSetPlaybackRate,
  onFrameStep,
  onStepsChange,
}: {
  script: Script
  currentMs: number
  currentStepIndex: number
  activeSteps: PresentationStep[]
  isPlaying: boolean
  isLooping: boolean
  playbackRate: number
  onSeek: (ms: number) => void
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrevious: () => void
  onGoToStart: () => void
  onGoToEnd: () => void
  onToggleLoop: () => void
  onSetPlaybackRate: (rate: number) => void
  onFrameStep: (direction: 1 | -1) => void
  onStepsChange: (steps: PresentationStep[], totalMs: number) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const lanes = useMemo(
    () => buildTimelineLanes(script.steps, script.totalDurationMs),
    [script],
  )

  useEffect(() => { injectConsoleStyles() }, [])

  // Ctrl+Shift+E keyboard shortcut for collapse/expand (whole console)
  // Ctrl+Shift+L keyboard shortcut for left panel toggle
  // Ctrl+Shift+R keyboard shortcut for right panel toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "E" || e.key === "e")) {
        e.preventDefault()
        setCollapsed((prev) => !prev)
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "L" || e.key === "l")) {
        e.preventDefault()
        setLeftCollapsed((prev) => !prev)
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "R" || e.key === "r")) {
        e.preventDefault()
        setRightCollapsed((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const gridTemplateColumns = useMemo(() => {
    const left = leftCollapsed ? "36px" : "260px"
    const right = rightCollapsed ? "36px" : "320px"
    return `${left} minmax(360px, 1fr) ${right}`
  }, [leftCollapsed, rightCollapsed])

  return (
    <div
      role="region"
      aria-label="Playback console"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 9998,
        borderRadius: 14,
        background: "rgba(8, 10, 22, 0.92)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.04)",
        backdropFilter: "blur(24px)",
        color: "#fff",
        pointerEvents: "auto",
      }}
    >
      {/* Top progress bar — visible only when expanded; collapsed state uses its own inline scrub slider */}
      {!collapsed && (
        <ProgressStrip
          currentMs={currentMs}
          totalDurationMs={script.totalDurationMs}
          onSeek={onSeek}
        />
      )}

      <div
        className="pbc-collapse-anim"
        style={{
          display: collapsed ? "flex" : "grid",
          gridTemplateColumns: collapsed ? undefined : gridTemplateColumns,
          transition: "max-height 280ms cubic-bezier(0.4, 0, 0.2, 1), padding 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease, gap 250ms ease",
          alignItems: collapsed ? "center" : undefined,
          gap: collapsed ? 12 : 14,
          padding: collapsed ? "8px 14px" : "8px 14px 14px",
          maxHeight: collapsed ? 50 : 360,
          overflow: collapsed ? "hidden" : "visible",
          gridTemplateRows: collapsed ? undefined : "minmax(0, 1fr)",
          opacity: 1,
        }}
      >
        {collapsed ? (
          <CollapsedPlaybackConsole
            title={script.title}
            currentMs={currentMs}
            totalDurationMs={script.totalDurationMs}
            currentStepIndex={currentStepIndex}
            totalSteps={script.steps.length}
            activeCount={activeSteps.length}
            activeSteps={activeSteps}
            allSteps={script.steps}
            isPlaying={isPlaying}
            onPlay={onPlay}
            onPause={onPause}
            onSeek={onSeek}
            onNext={onNext}
            onPrevious={onPrevious}
            onToggleCollapse={() => setCollapsed(false)}
          />
        ) : (
          <>
            {/* LEFT PANEL: PlaybackControls or collapsed strip */}
            {leftCollapsed ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: "100%", minHeight: 120 }}>
                <button className="pbc-btn pbc-btn-primary" type="button" title={isPlaying ? "Pause" : "Play"} aria-label={isPlaying ? "Pause" : "Play"} onClick={isPlaying ? onPause : onPlay} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(118,185,0,0.5)", background: "rgba(118,185,0,0.2)", color: "#76B900", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {isPlaying ? <IconPause size={13} /> : <IconPlay size={13} />}
                </button>
                <button className="pbc-btn pbc-btn-ghost" type="button" title="Expand left panel (Ctrl+Shift+L)" aria-label="Expand left panel" onClick={() => setLeftCollapsed(false)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <IconChevronRight size={11} />
                </button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <PlaybackControls
                  title={script.title}
                  currentMs={currentMs}
                  totalDurationMs={script.totalDurationMs}
                  currentStepIndex={currentStepIndex}
                  totalSteps={script.steps.length}
                  activeSteps={activeSteps}
                  isPlaying={isPlaying}
                  isLooping={isLooping}
                  playbackRate={playbackRate}
                  onSeek={onSeek}
                  onPlay={onPlay}
                  onPause={onPause}
                  onNext={onNext}
                  onPrevious={onPrevious}
                  onGoToStart={onGoToStart}
                  onGoToEnd={onGoToEnd}
                  onToggleLoop={onToggleLoop}
                  onSetPlaybackRate={onSetPlaybackRate}
                  onFrameStep={onFrameStep}
                />
                <button className="pbc-btn pbc-btn-ghost" type="button" title="Collapse left panel (Ctrl+Shift+L)" aria-label="Collapse left panel" onClick={() => setLeftCollapsed(true)} style={{ position: "absolute", top: 4, right: -6, width: 18, height: 18, borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}>
                  <IconChevronLeft size={9} />
                </button>
              </div>
            )}

            <TimelineTracks
              lanes={lanes}
              currentMs={currentMs}
              totalDurationMs={script.totalDurationMs}
              onSeek={onSeek}
              steps={script.steps}
              onStepsChange={onStepsChange}
            />

            {/* RIGHT PANEL: ActiveCommandList or collapsed strip */}
            {rightCollapsed ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: "100%", minHeight: 120 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: activeSteps.length > 0 ? "rgba(118,185,0,0.2)" : "rgba(255,255,255,0.08)", border: activeSteps.length > 0 ? "1px solid rgba(118,185,0,0.5)" : "1px solid rgba(255,255,255,0.15)", color: activeSteps.length > 0 ? "#76B900" : "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {activeSteps.length}
                </div>
                <button className="pbc-btn pbc-btn-ghost" type="button" title="Expand right panel (Ctrl+Shift+R)" aria-label="Expand right panel" onClick={() => setRightCollapsed(false)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <IconChevronLeft size={11} />
                </button>
              </div>
            ) : (
              <div style={{ position: "relative", height: "100%", minHeight: 0 }}>
                <ActiveCommandList
                  steps={activeSteps}
                  currentMs={currentMs}
                  totalDurationMs={script.totalDurationMs}
                  onSeek={onSeek}
                  isPlaying={isPlaying}
                  allSteps={script.steps}
                  onCollapse={() => setCollapsed(true)}
                  onCollapseRight={() => setRightCollapsed(true)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top progress strip — thin, always visible, clickable for quick scrubbing
// ---------------------------------------------------------------------------

function ProgressStrip({
  currentMs,
  totalDurationMs,
  onSeek,
}: {
  currentMs: number
  totalDurationMs: number
  onSeek: (ms: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const progress = totalDurationMs > 0 ? Math.min(1, currentMs / totalDurationMs) : 0

  const getTimeAtX = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * totalDurationMs
  }, [totalDurationMs])

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Playback position"
      aria-valuemin={0}
      aria-valuemax={totalDurationMs}
      aria-valuenow={Math.round(currentMs)}
      aria-valuetext={formatTime(currentMs)}
      tabIndex={0}
      onClick={(e) => onSeek(getTimeAtX(e.clientX))}
      onMouseMove={(e) => {
        const rect = trackRef.current?.getBoundingClientRect()
        if (rect) setHoverX(e.clientX - rect.left)
      }}
      onMouseLeave={() => setHoverX(null)}
      style={{
        position: "relative",
        height: 5,
        background: "rgba(255,255,255,0.06)",
        cursor: "pointer",
        overflow: "visible",
      }}
    >
      {/* Filled portion */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: `${progress * 100}%`,
          background: "linear-gradient(90deg, #76B900, #38BDF8)",
          borderRadius: "0 2px 2px 0",
          transition: "width 80ms linear",
        }}
      />
      {/* Hover time tooltip */}
      {hoverX !== null && trackRef.current && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: Math.max(24, Math.min(hoverX, trackRef.current.getBoundingClientRect().width - 24)),
            transform: "translateX(-50%)",
            padding: "2px 7px",
            borderRadius: 4,
            background: "rgba(0,0,0,0.85)",
            border: "1px solid rgba(255,255,255,0.15)",
            fontSize: 10,
            fontWeight: 600,
            color: "#fff",
            fontVariantNumeric: "tabular-nums",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 5,
          }}
        >
          {formatTime(getTimeAtX(hoverX + (trackRef.current?.getBoundingClientRect().left ?? 0)))}
        </div>
      )}
    </div>
  )
}

function CollapsedPlaybackConsole({
  title,
  currentMs,
  totalDurationMs,
  currentStepIndex,
  totalSteps,
  activeCount,
  activeSteps,
  allSteps,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  onNext,
  onPrevious,
  onToggleCollapse,
}: {
  title: string
  currentMs: number
  totalDurationMs: number
  currentStepIndex: number
  totalSteps: number
  activeCount: number
  activeSteps: PresentationStep[]
  allSteps: PresentationStep[]
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onSeek: (ms: number) => void
  onNext: () => void
  onPrevious: () => void
  onToggleCollapse: () => void
}) {
  const [hoverInfo, setHoverInfo] = useState<{ pct: number; ms: number; rectLeft: number; rectTop: number; rectWidth: number } | null>(null)
  const scrubRef = useRef<HTMLDivElement>(null)

  // Native DOM listener on the wrapper — mousemove bubbles from the input child
  useEffect(() => {
    const el = scrubRef.current
    if (!el) return

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      setHoverInfo({ pct: pct * 100, ms: pct * totalDurationMs, rectLeft: rect.left, rectTop: rect.top, rectWidth: rect.width })
    }

    const onLeave = () => {
      setHoverInfo(null)
    }

    el.addEventListener("mousemove", onMove)
    el.addEventListener("mouseleave", onLeave)
    return () => {
      el.removeEventListener("mousemove", onMove)
      el.removeEventListener("mouseleave", onLeave)
    }
  }, [totalDurationMs])

  // Compute steps active at the hovered time using allSteps
  const hoverPreviewSteps = useMemo(() => {
    if (!hoverInfo) return []
    const ms = hoverInfo.ms
    return allSteps.filter((s) =>
      s.startMs <= ms &&
      (s.endMs == null || s.endMs > ms) &&
      s.command.type !== "clear" &&
      s.command.type !== "wait"
    )
  }, [hoverInfo, allSteps])

  return (
    <>
      {/* Noise texture overlay for depth */}
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        opacity: 0.03,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        pointerEvents: "none",
      }} />

      {/* Transport cluster — tight spacing */}
      <div style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <button
          className="pbc-btn pbc-btn-ghost"
          type="button"
          title="Previous step  [Left]"
          aria-label="Previous step"
          onClick={onPrevious}
          style={{
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 5,
            border: "none",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.6)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <IconStepBack size={10} />
        </button>
        <button
          className="pbc-btn pbc-btn-primary"
          type="button"
          title={isPlaying ? "Pause  [Space]" : "Play  [Space]"}
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={isPlaying ? onPause : onPlay}
          style={{
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 7,
            border: isPlaying ? "1px solid rgba(118,185,0,0.5)" : "1px solid rgba(118,185,0,0.7)",
            background: isPlaying
              ? "radial-gradient(circle at center, rgba(118,185,0,0.3), rgba(118,185,0,0.15))"
              : "rgba(118,185,0,0.3)",
            color: "#fff",
            cursor: "pointer",
            padding: 0,
            boxShadow: isPlaying ? "0 0 8px rgba(118,185,0,0.3)" : "none",
          }}
        >
          {isPlaying ? <IconPause size={11} /> : <IconPlay size={11} />}
        </button>
        <button
          className="pbc-btn pbc-btn-ghost"
          type="button"
          title="Next step  [Right]"
          aria-label="Next step"
          onClick={onNext}
          style={{
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 5,
            border: "none",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.6)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <IconStepForward size={10} />
        </button>
      </div>

      {/* Title + metadata — prominent title, subdued meta */}
      <div style={{ minWidth: 120, flex: "0 1 200px", overflow: "hidden" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.2,
            letterSpacing: 0.1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 9,
            color: "rgba(255,255,255,0.35)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          <span style={{
            color: "rgba(255,255,255,0.75)",
            fontWeight: 600,
            fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', monospace",
            fontSize: 10,
            letterSpacing: -0.3,
          }}>
            {formatTime(currentMs)}
          </span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span>{formatTime(totalDurationMs)}</span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>{Math.min(currentStepIndex + 1, totalSteps)}/{totalSteps}</span>
        </div>
      </div>

      {/* Scrub slider — rich progress bar */}
      <div
        ref={scrubRef}
        className="pbc-scrub-wrapper"
        style={{ flex: 1, minWidth: 100, display: "flex", alignItems: "center", position: "relative", height: 24 }}
      >
        {/* Background track with subtle inner shadow */}
        <div style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: 5,
          borderRadius: 3,
          background: "rgba(255,255,255,0.06)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4), inset 0 0 0 0.5px rgba(255,255,255,0.05)",
        }} />
        {/* Tick marks — 10 evenly spaced */}
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(i + 1) * 10}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 1,
              height: 8,
              borderRadius: 0.5,
              background: "rgba(255,255,255,0.06)",
              pointerEvents: "none",
            }}
          />
        ))}
        {/* Progress fill with multi-stop gradient */}
        <div style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: `${totalDurationMs > 0 ? (currentMs / totalDurationMs) * 100 : 0}%`,
          height: 5,
          borderRadius: 3,
          background: isPlaying
            ? "linear-gradient(90deg, rgba(118,185,0,0.5) 0%, rgba(118,185,0,0.8) 60%, rgba(144,220,20,0.9) 100%)"
            : "linear-gradient(90deg, rgba(118,185,0,0.4) 0%, rgba(118,185,0,0.6) 100%)",
          boxShadow: isPlaying
            ? "0 0 8px rgba(118,185,0,0.3), 0 1px 2px rgba(0,0,0,0.2)"
            : "0 0 4px rgba(118,185,0,0.15)",
          transition: "width 80ms linear",
        }} />
        {/* Glow trail effect at the leading edge */}
        {isPlaying && totalDurationMs > 0 && (
          <div style={{
            position: "absolute",
            left: `calc(${(currentMs / totalDurationMs) * 100}% - 12px)`,
            top: "50%",
            transform: "translateY(-50%)",
            width: 12,
            height: 5,
            borderRadius: 3,
            background: "linear-gradient(90deg, transparent, rgba(118,185,0,0.6))",
            filter: "blur(2px)",
            pointerEvents: "none",
            transition: "left 80ms linear",
          }} />
        )}
        {/* Hover position indicator */}
        {hoverInfo && (
          <div style={{
            position: "absolute",
            left: `${hoverInfo.pct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 1,
            height: 14,
            background: "rgba(255,255,255,0.3)",
            borderRadius: 0.5,
            pointerEvents: "none",
          }} />
        )}
        {/* Thumb indicator */}
        <div
          className="pbc-scrub-thumb"
          style={{
            position: "absolute",
            left: `${totalDurationMs > 0 ? (currentMs / totalDurationMs) * 100 : 0}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, #9AE62B, #76B900)",
            border: "2px solid rgba(255,255,255,0.95)",
            boxShadow: "0 0 6px rgba(118,185,0,0.5), 0 1px 3px rgba(0,0,0,0.3)",
            transition: "left 80ms linear, transform 0.15s ease",
            pointerEvents: "none",
          }}
        />
        {/* Invisible range input on top for interaction */}
        <input
          className="pbc-range"
          aria-label="Presentation progress"
          type="range"
          min={0}
          max={totalDurationMs}
          value={Math.min(currentMs, totalDurationMs)}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          style={{
            position: "relative",
            width: "100%",
            height: 24,
            opacity: 0,
            cursor: "pointer",
            zIndex: 1,
          }}
        />
        {/* Preview popover — portal to body to escape overflow:hidden + backdrop-filter containing block */}
        {hoverInfo && createPortal(
          <div
            style={{
              position: "fixed",
              top: hoverInfo.rectTop - 10,
              left: hoverInfo.rectLeft + hoverInfo.rectWidth * Math.min(0.85, Math.max(0.15, hoverInfo.pct / 100)),
              transform: "translate(-50%, -100%)",
              minWidth: 160,
              maxWidth: 260,
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(12, 14, 28, 0.96)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
              pointerEvents: "none",
              zIndex: 99999,
            }}
          >
            {/* Time indicator */}
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 4, fontFamily: "SFMono-Regular, Consolas, monospace", fontVariantNumeric: "tabular-nums" }}>
              {formatTime(hoverInfo.ms)}
            </div>
            {hoverPreviewSteps.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {hoverPreviewSteps.slice(0, 5).map((step) => (
                  <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 2, background: commandColor(step.command.type), flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: commandColor(step.command.type), textTransform: "uppercase" }}>
                      {step.command.type}
                    </span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {step.description || describeCommand(step.command)}
                    </span>
                  </div>
                ))}
                {hoverPreviewSteps.length > 5 && (
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
                    +{hoverPreviewSteps.length - 5} more
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>No active steps</div>
            )}
            {/* Arrow pointing down */}
            <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid rgba(12, 14, 28, 0.96)" }} />
          </div>,
          document.body,
        )}
      </div>

      {/* Active count badge + status dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {activeCount > 0 && (
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: "rgba(118,185,0,0.15)",
              border: "1px solid rgba(118,185,0,0.3)",
              fontSize: 9,
              fontWeight: 700,
              color: "#76B900",
              padding: "0 4px",
              lineHeight: 1,
              boxShadow: `0 0 0 ${activeCount > 0 ? "3px" : "0"} rgba(118,185,0,0.15)`,
              transition: "box-shadow 0.3s ease",
            }}
            title={`${activeCount} active overlay${activeCount > 1 ? "s" : ""}`}
          >
            {activeCount}
          </div>
        )}
        {/* Playing state — minimal dot indicator */}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: isPlaying ? "#76B900" : "rgba(255,255,255,0.2)",
            boxShadow: isPlaying ? "0 0 6px rgba(118,185,0,0.6), 0 0 2px rgba(118,185,0,0.8)" : "none",
            transition: "all 0.2s ease",
          }}
          title={isPlaying ? "Playing" : "Paused"}
        />
      </div>

      {/* Expand button */}
      <button
        className="pbc-btn pbc-btn-ghost"
        type="button"
        title="Expand (Ctrl+Shift+E)"
        aria-label="Expand console"
        onClick={onToggleCollapse}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          height: 26,
          padding: "0 10px",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.6)",
          cursor: "pointer",
          fontSize: 10,
          fontWeight: 600,
          marginLeft: 2,
          flexShrink: 0,
        }}
      >
        <IconChevronUp size={10} />
        <span>Expand</span>
      </button>

      {/* Playing state border glow overlay */}
      {isPlaying && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            border: "1px solid rgba(118,185,0,0.15)",
            boxShadow: "inset 0 0 12px rgba(118,185,0,0.04), 0 0 8px rgba(118,185,0,0.06)",
            pointerEvents: "none",
          }}
        />
      )}

    </>
  )
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4] as const

function PlaybackControls({
  title,
  currentMs,
  totalDurationMs,
  currentStepIndex,
  totalSteps,
  activeSteps,
  isPlaying,
  isLooping,
  playbackRate,
  onSeek,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onGoToStart,
  onGoToEnd,
  onToggleLoop,
  onSetPlaybackRate,
  onFrameStep,
}: {
  title: string
  currentMs: number
  totalDurationMs: number
  currentStepIndex: number
  totalSteps: number
  activeSteps: PresentationStep[]
  isPlaying: boolean
  isLooping: boolean
  playbackRate: number
  onSeek: (ms: number) => void
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrevious: () => void
  onGoToStart: () => void
  onGoToEnd: () => void
  onToggleLoop: () => void
  onSetPlaybackRate: (rate: number) => void
  onFrameStep: (direction: 1 | -1) => void
}) {
  const progress = totalDurationMs > 0 ? Math.min(100, (currentMs / totalDurationMs) * 100) : 0
  const progressFraction = totalDurationMs > 0 ? Math.min(1, currentMs / totalDurationMs) : 0
  const currentFrame = msToFrame(currentMs, FPS)
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false)
  const [showRemaining, setShowRemaining] = useState(false)
  // Time display mode: time | frame | percentage
  type TimeDisplayMode = "time" | "frame" | "percent"
  const [timeDisplayMode, setTimeDisplayMode] = useState<TimeDisplayMode>("time")
  // Loop count (increments each time we loop)
  const [loopCount, setLoopCount] = useState(0)
  const prevMsRef = useRef(currentMs)

  // Detect loop (time jumps backward significantly while looping)
  useEffect(() => {
    if (isLooping && prevMsRef.current > currentMs + 500) {
      setLoopCount((c) => c + 1)
    }
    prevMsRef.current = currentMs
  }, [currentMs, isLooping])

  // Reset loop count when loop disabled
  useEffect(() => {
    if (!isLooping) setLoopCount(0)
  }, [isLooping])

  // Circular progress ring params
  const ringRadius = 20
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset = ringCircumference * (1 - progressFraction)

  // Speed dial rotation: map speed to angle
  const speedAngle = useMemo(() => {
    const idx = PLAYBACK_SPEEDS.indexOf(playbackRate as typeof PLAYBACK_SPEEDS[number])
    return idx >= 0 ? (idx / (PLAYBACK_SPEEDS.length - 1)) * 270 - 135 : 0
  }, [playbackRate])

  // Cycle speed on badge click
  const cycleSpeed = useCallback(() => {
    const idx = PLAYBACK_SPEEDS.indexOf(playbackRate as typeof PLAYBACK_SPEEDS[number])
    const nextIdx = (idx + 1) % PLAYBACK_SPEEDS.length
    onSetPlaybackRate(PLAYBACK_SPEEDS[nextIdx])
  }, [playbackRate, onSetPlaybackRate])

  // Cycle time display mode
  const cycleTimeDisplay = useCallback(() => {
    setTimeDisplayMode((m) => m === "time" ? "frame" : m === "frame" ? "percent" : "time")
  }, [])

  return (
    <section
      aria-label="Playback controls"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
      }}
    >
      {/* Header: title */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
      </div>

      {/* Time display — prominent monospace with glow, click to cycle time/frame/percent */}
      <div
        onClick={cycleTimeDisplay}
        title="Click to cycle: time / frame / percentage"
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          fontVariantNumeric: "tabular-nums",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span
          className={isPlaying ? "pbc-time-glow" : ""}
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: -0.5,
            fontFamily: "SFMono-Regular, Consolas, monospace",
            lineHeight: 1,
          }}
        >
          {timeDisplayMode === "time" ? (
            <>
              {formatTimeWithFlashingColon(currentMs, isPlaying)}
            </>
          ) : timeDisplayMode === "frame" ? (
            <>F{currentFrame}</>
          ) : (
            <>{(progressFraction * 100).toFixed(1)}%</>
          )}
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
          / {timeDisplayMode === "time" ? formatTime(totalDurationMs) : timeDisplayMode === "frame" ? `F${msToFrame(totalDurationMs, FPS)}` : "100%"}
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); setShowRemaining((p) => !p) }}
          title="Click to toggle remaining time"
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            fontFamily: "SFMono-Regular, Consolas, monospace",
            marginLeft: 2,
            cursor: "pointer",
            padding: "1px 4px",
            borderRadius: 3,
            background: showRemaining ? "rgba(118,185,0,0.1)" : "transparent",
          }}
        >
          ({showRemaining ? `-${formatTime(Math.max(0, totalDurationMs - currentMs))}` : formatTime(Math.max(0, totalDurationMs - currentMs))})
        </span>
      </div>

      {/* Scrub slider + waveform progress bar */}
      <div style={{ position: "relative" }}>
        <input
          className="pbc-range"
          aria-label="Presentation progress"
          type="range"
          min={0}
          max={totalDurationMs}
          value={Math.min(currentMs, totalDurationMs)}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
        />
        {/* Waveform-style progress background */}
        <WaveformProgressBar progress={progress} totalDurationMs={totalDurationMs} />
      </div>

      {/* Transport buttons with circular ring around play/pause */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <ConsoleButton title="Go to start  [Home]" icon={<IconSkipBack size={12} />} onClick={onGoToStart} aria-label="Go to start" style={{ color: "#F59E0B" }} />
        <ConsoleButton title="Previous step  [Left]" icon={<IconStepBack size={12} />} onClick={onPrevious} aria-label="Previous step" style={{ color: "#76B900" }} />
        <ConsoleButton title="Frame back  [,]" icon={<IconFrameBack size={11} />} onClick={() => onFrameStep(-1)} aria-label="Frame back" style={{ color: "rgba(255,255,255,0.6)" }} />

        {/* Play/Pause with circular progress ring + rate badge */}
        <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg
            width={44}
            height={44}
            style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}
          >
            <circle
              cx={22}
              cy={22}
              r={ringRadius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={2.5}
            />
            <circle
              className="pbc-progress-ring"
              cx={22}
              cy={22}
              r={ringRadius}
              fill="none"
              stroke="#76B900"
              strokeWidth={2.5}
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 3px rgba(118,185,0,0.5))" }}
            />
          </svg>
          <button
            className="pbc-btn pbc-btn-primary pbc-play-btn"
            type="button"
            title={isPlaying ? "Pause  [Space]" : "Play  [Space]"}
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={isPlaying ? onPause : onPlay}
            style={{
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(118,185,0,0.7)",
              borderRadius: "50%",
              background: "rgba(118,185,0,0.22)",
              color: "#fff",
              cursor: "pointer",
              padding: 0,
              zIndex: 1,
            }}
          >
            {isPlaying ? <IconPause size={14} /> : <IconPlay size={14} />}
          </button>
          {/* Playback rate badge — click to cycle speeds */}
          {playbackRate !== 1 && (
            <span
              onClick={(e) => { e.stopPropagation(); cycleSpeed() }}
              title="Click to cycle playback speed"
              style={{
                position: "absolute",
                top: -4,
                right: -6,
                fontSize: 8,
                fontWeight: 800,
                fontFamily: "SFMono-Regular, Consolas, monospace",
                padding: "1px 4px",
                borderRadius: 4,
                background: "rgba(118,185,0,0.9)",
                color: "#000",
                cursor: "pointer",
                zIndex: 2,
                lineHeight: 1.3,
              }}
            >
              {playbackRate}x
            </span>
          )}
        </div>

        <ConsoleButton title="Frame forward  [.]" icon={<IconFrameForward size={11} />} onClick={() => onFrameStep(1)} aria-label="Frame forward" style={{ color: "rgba(255,255,255,0.6)" }} />
        <ConsoleButton title="Next step  [Right]" icon={<IconStepForward size={12} />} onClick={onNext} aria-label="Next step" style={{ color: "#76B900" }} />
        <ConsoleButton title="Go to end  [End]" icon={<IconSkipForward size={12} />} onClick={onGoToEnd} aria-label="Go to end" style={{ color: "#F59E0B" }} />
      </div>

      {/* Speed + Loop row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {/* Speed selector with dial visual */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
          {/* Dial indicator */}
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: playbackRate !== 1 ? "2px solid rgba(118,185,0,0.5)" : "2px solid rgba(255,255,255,0.12)",
              background: playbackRate !== 1 ? "rgba(118,185,0,0.08)" : "rgba(255,255,255,0.03)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              className="pbc-speed-dial"
              style={{
                width: 2,
                height: 9,
                borderRadius: 1,
                background: playbackRate !== 1 ? "#76B900" : "rgba(255,255,255,0.4)",
                transformOrigin: "center bottom",
                transform: `rotate(${speedAngle}deg)`,
              }}
            />
          </div>
          <button
            className="pbc-btn pbc-btn-ghost"
            type="button"
            title="Playback speed"
            aria-label={`Playback speed: ${playbackRate}x`}
            onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
            style={{
              height: 26,
              padding: "0 8px",
              display: "flex",
              alignItems: "center",
              gap: 4,
              borderRadius: 6,
              border: playbackRate !== 1 ? "1px solid rgba(118,185,0,0.4)" : "1px solid rgba(255,255,255,0.1)",
              background: playbackRate !== 1 ? "rgba(118,185,0,0.1)" : "rgba(255,255,255,0.05)",
              color: playbackRate !== 1 ? "#76B900" : "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "SFMono-Regular, Consolas, monospace",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {playbackRate}x
            <IconChevronUp size={9} />
          </button>
          {speedMenuOpen && (
            <div className="pbc-speed-menu">
              {PLAYBACK_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className={`pbc-speed-option ${speed === playbackRate ? "pbc-speed-option-active" : ""}`}
                  onClick={() => { onSetPlaybackRate(speed); setSpeedMenuOpen(false) }}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loop toggle with pulse and loop count */}
        <button
          className={`pbc-btn pbc-btn-ghost ${isLooping ? "pbc-loop-pulse" : ""}`}
          type="button"
          title={`Loop: ${isLooping ? "ON" : "OFF"}  [L]${isLooping && loopCount > 0 ? ` (${loopCount} loops)` : ""}`}
          aria-label={`Loop ${isLooping ? "enabled" : "disabled"}`}
          onClick={onToggleLoop}
          style={{
            width: 30,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
            border: isLooping ? "1px solid rgba(118,185,0,0.5)" : "1px solid rgba(255,255,255,0.1)",
            background: isLooping ? "rgba(118,185,0,0.15)" : "rgba(255,255,255,0.05)",
            color: isLooping ? "#76B900" : "rgba(255,255,255,0.5)",
            cursor: "pointer",
            padding: 0,
            position: "relative",
          }}
        >
          <IconLoop size={13} active={isLooping} />
          {isLooping && (
            <span style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 12,
              height: 12,
              borderRadius: 6,
              background: "#76B900",
              boxShadow: "0 0 6px rgba(118,185,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 7,
              fontWeight: 800,
              color: "#000",
              padding: "0 2px",
            }}>
              {loopCount > 0 ? loopCount : ""}
            </span>
          )}
        </button>

        {/* Status indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: isPlaying ? "#76B900" : "rgba(255,255,255,0.3)",
            boxShadow: isPlaying ? "0 0 6px rgba(118,185,0,0.6)" : "none",
          }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: isPlaying ? "#76B900" : "rgba(255,255,255,0.4)" }}>
            {isPlaying ? "PLAYING" : "PAUSED"}
          </span>
        </div>
      </div>

      {/* Status row: step counter + now-playing indicator + frame */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          fontVariantNumeric: "tabular-nums",
          gap: 6,
        }}
      >
        <span>Step {Math.min(currentStepIndex + 1, totalSteps)} / {totalSteps}</span>
        {/* Now-playing indicator: current step type with color dot */}
        {activeSteps.length > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "1px 5px", borderRadius: 3, background: "rgba(255,255,255,0.04)" }}>
            <span style={{ width: 5, height: 5, borderRadius: 2, background: commandColor(activeSteps[0].command.type), boxShadow: `0 0 4px ${commandColor(activeSteps[0].command.type)}66` }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: commandColor(activeSteps[0].command.type), textTransform: "uppercase" }}>
              {activeSteps[0].command.type}
            </span>
          </span>
        )}
        <span style={{ fontFamily: "SFMono-Regular, Consolas, monospace", color: "rgba(255,255,255,0.25)" }}>
          F{currentFrame} / {msToFrame(totalDurationMs, FPS)}
        </span>
      </div>

      {/* Keyboard shortcuts — grouped with hover tooltips */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          paddingTop: 2,
        }}
      >
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">Space</span>
          <span className="pbc-kbd-tooltip">Play / Pause</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">&larr;</span>
          <span className="pbc-kbd-tooltip">Previous step</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">&rarr;</span>
          <span className="pbc-kbd-tooltip">Next step</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">,</span>
          <span className="pbc-kbd-tooltip">Frame back</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">.</span>
          <span className="pbc-kbd-tooltip">Frame forward</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">L</span>
          <span className="pbc-kbd-tooltip">Toggle loop</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">Home</span>
          <span className="pbc-kbd-tooltip">Go to start</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">End</span>
          <span className="pbc-kbd-tooltip">Go to end</span>
        </span>
      </div>
    </section>
  )
}

/** Waveform-style progress bar showing step density as tiny bars */
function WaveformProgressBar({ progress, totalDurationMs }: { progress: number; totalDurationMs: number }) {
  const barCount = 40
  const bars = useMemo(() => {
    const result: number[] = []
    for (let i = 0; i < barCount; i++) {
      const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453
      result.push(0.2 + (seed - Math.floor(seed)) * 0.8)
    }
    return result
  }, [totalDurationMs]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        height: 8,
        marginTop: 4,
        borderRadius: 4,
        background: "rgba(255,255,255,0.04)",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-end",
        gap: 1,
        padding: "0 1px",
        position: "relative",
      }}
    >
      {bars.map((h, i) => {
        const barProgress = (i / barCount) * 100
        const isBeforePlayhead = barProgress < progress
        return (
          <div
            key={i}
            className="pbc-waveform-bar"
            style={{
              flex: 1,
              height: `${h * 100}%`,
              background: isBeforePlayhead
                ? "linear-gradient(180deg, #76B900, #38BDF8)"
                : "rgba(255,255,255,0.12)",
              opacity: isBeforePlayhead ? 0.8 : 0.4,
              transition: "background 80ms linear, opacity 80ms linear",
            }}
          />
        )
      })}
    </div>
  )
}

function ConsoleButton({
  title,
  icon,
  onClick,
  primary,
  large,
  style: styleProp,
  "aria-label": ariaLabel,
}: {
  title: string
  icon: React.ReactNode
  onClick: () => void
  primary?: boolean
  large?: boolean
  style?: React.CSSProperties
  "aria-label"?: string
}) {
  const size = large ? 38 : 32

  return (
    <button
      className={`pbc-btn ${primary ? "pbc-btn-primary" : "pbc-btn-ghost"}`}
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: primary ? "1px solid rgba(118,185,0,0.7)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: primary ? 10 : 8,
        background: primary ? "rgba(118,185,0,0.22)" : "rgba(255,255,255,0.05)",
        color: "#fff",
        cursor: "pointer",
        padding: 0,
        ...styleProp,
      }}
    >
      {icon}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Track grouping helpers
// ---------------------------------------------------------------------------
const TRACK_GROUPS: Record<string, string[]> = {
  "Text": ["text", "title", "subtitle", "caption", "label", "annotation", "callout", "list"],
  "Shape": ["rect", "circle", "arrow", "line", "polygon", "highlight", "underline"],
  "Data": ["gauge", "sparkline", "heatmap", "funnel", "waterfall", "table", "chart"],
  "Narrative": ["timeline", "flowchart", "countdown", "morph", "reveal"],
  "Effect": ["confetti", "spotlight", "zoom", "clear"],
}

function getTrackGroup(type: string): string {
  for (const [group, types] of Object.entries(TRACK_GROUPS)) {
    if (types.includes(type)) return group
  }
  return "Other"
}

function computeDensityBuckets(lanes: TimelineLane[], totalDurationMs: number, bucketCount: number): number[] {
  const buckets = new Array(bucketCount).fill(0)
  if (totalDurationMs <= 0 || bucketCount <= 0) return buckets
  const bucketMs = totalDurationMs / bucketCount
  for (const lane of lanes) {
    for (const item of lane.items) {
      const startBucket = Math.max(0, Math.floor(item.startMs / bucketMs))
      const endBucket = Math.min(bucketCount - 1, Math.floor(item.endMs / bucketMs))
      for (let b = startBucket; b <= endBucket; b++) buckets[b]++
    }
  }
  return buckets
}

// ---------------------------------------------------------------------------
// TimelineTracks  (enhanced: zoom, minimap, density, playhead drag, grouping)
// ---------------------------------------------------------------------------
function TimelineTracks({
  lanes,
  currentMs,
  totalDurationMs,
  onSeek,
  steps,
  onStepsChange,
}: {
  lanes: TimelineLane[]
  currentMs: number
  totalDurationMs: number
  onSeek: (ms: number) => void
  steps: PresentationStep[]
  onStepsChange: (steps: PresentationStep[], totalMs: number) => void
}) {
  const LABEL_WIDTH = 100
  const DENSITY_BUCKETS = 120
  const MIN_ZOOM = 1
  const MAX_ZOOM = 10
  // --- zoom state ---
  const [zoom, setZoom] = useState(1)
  const [viewCenterMs, setViewCenterMs] = useState(totalDurationMs / 2)
  const visibleDurationMs = totalDurationMs / zoom
  const viewStartMs = Math.max(0, Math.min(totalDurationMs - visibleDurationMs, viewCenterMs - visibleDurationMs / 2))
  const viewEndMs = Math.min(totalDurationMs, viewStartMs + visibleDurationMs)

  const FRAME_MS = 1000 / FPS

  // --- editor mode state ---
  const [timelineMode, setTimelineMode] = useState<"timeline" | "editor">("timeline")
  const [editorText, setEditorText] = useState("")
  const [editorError, setEditorError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [errorLines, setErrorLines] = useState<Map<number, string>>(new Map())

  // Memoize line↔step mapping (only recomputes when script text changes)
  const lineMapping = useMemo(
    () => timelineMode === "editor" ? buildLineStepMapping(editorText) : null,
    [timelineMode, editorText],
  )

  // Compute active lines per frame (cheap: just iterates steps, no string parsing)
  const activeLines = useMemo(() => {
    if (!lineMapping || lineMapping.stepToLine.size !== steps.length) return []
    const result: number[] = []
    for (let i = 0; i < steps.length; i++) {
      const { startMs, endMs } = steps[i]
      if (currentMs >= startMs && (endMs === undefined || currentMs < endMs)) {
        const line = lineMapping.stepToLine.get(i)
        if (line !== undefined) result.push(line)
      }
    }
    return result
  }, [lineMapping, steps, currentMs])

  const switchToEditor = useCallback(() => {
    setEditorText(stepsToBashScript(steps))
    setEditorError(null)
    setErrorLines(new Map())
    setTimelineMode("editor")
  }, [steps])

  // Clear per-line errors when editor text changes
  useEffect(() => {
    if (errorLines.size > 0) setErrorLines(new Map())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorText])

  const handleLineClick = useCallback((lineNumber: number) => {
    if (!lineMapping) return
    const stepIdx = lineMapping.lineToStep.get(lineNumber)
    if (stepIdx === undefined || stepIdx >= steps.length) return
    const step = steps[stepIdx]
    onSeek(step.startMs)
  }, [lineMapping, steps, onSeek])

  const handleEditorRun = useCallback(async () => {
    setIsRunning(true)
    setEditorError(null)
    setErrorLines(new Map())
    try {
      const newSteps: PresentationStep[] = []
      let cursorMs = 0
      const bash = createPresentationBash({
        onStep: (step) => newSteps.push(step),
        getCursorMs: () => cursorMs,
        setCursorMs: (ms) => { cursorMs = ms },
      })
      // Pre-process the script text (fix quoting, join multiline)
      const processed = fixJsonQuoting(joinMultilineQuotes(editorText))
      const lines = processed.split("\n")
      const errors = new Map<number, string>()

      // Execute line by line to track per-line errors
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line === "" || line.startsWith("#")) continue
        const result = await bash.exec(lines[i])
        if (result.exitCode !== 0) {
          errors.set(i + 1, result.stderr || "Error") // 1-based line number
        }
      }

      setErrorLines(errors)

      if (newSteps.length > 0) {
        onStepsChange(newSteps, cursorMs)
      } else if (errors.size === 0) {
        setEditorError("No steps produced. Check your script.")
      }
    } catch (err: unknown) {
      setEditorError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsRunning(false)
    }
  }, [editorText, onStepsChange])


  // --- drag / hover state ---
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<TimelineItem | null>(null)
  const [pinnedItem, setPinnedItem] = useState<TimelineItem | null>(null)
  const [hoverTimeMs, setHoverTimeMs] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const trackAreaRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const minimapDragRef = useRef<{ dragging: boolean; startX: number; startCenterMs: number }>({ dragging: false, startX: 0, startCenterMs: 0 })
  const lastManualPanRef = useRef<number>(0)

  // --- scrub preview state ---
  const [scrubPreviewMs, setScrubPreviewMs] = useState<number | null>(null)
  const [scrubSnapped, setScrubSnapped] = useState(false)
  const [scrubTooltipX, setScrubTooltipX] = useState<number | null>(null)

  // --- momentum state ---
  const momentumRef = useRef<{ velocity: number; lastTime: number; rafId: number | null }>({ velocity: 0, lastTime: 0, rafId: null })
  const scrubHistoryRef = useRef<Array<{ ms: number; time: number }>>([])

  // --- keyboard focus / selection ---
  const [focusedBlockIndex, setFocusedBlockIndex] = useState<number>(-1)
  const [selectedBlockItem, setSelectedBlockItem] = useState<TimelineItem | null>(null)

  // --- range selection ---
  const [rangeStartItem, setRangeStartItem] = useState<TimelineItem | null>(null)
  const [rangeEndItem, setRangeEndItem] = useState<TimelineItem | null>(null)

  // --- context menu ---
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: Array<{ label: string; action: () => void }> } | null>(null)

  // --- panning state (middle-mouse, trackpad) ---
  const panRef = useRef<{ isPanning: boolean; startX: number; startCenterMs: number }>({ isPanning: false, startX: 0, startCenterMs: 0 })
  const panMomentumRef = useRef<{ velocity: number; rafId: number | null }>({ velocity: 0, rafId: null })

  // --- auto-pan: keep playhead visible when playing ---
  useEffect(() => {
    if (zoom <= 1) return
    if (Date.now() - lastManualPanRef.current < 1500) return
    if (currentMs < viewStartMs || currentMs > viewEndMs) {
      setViewCenterMs(currentMs)
    }
  }, [currentMs, zoom, viewStartMs, viewEndMs])

  // reset center when total changes
  useEffect(() => { setViewCenterMs(totalDurationMs / 2) }, [totalDurationMs])

  // --- grouped lanes ---
  const groupedLanes = useMemo(() => {
    const groups: Record<string, TimelineLane[]> = {}
    for (const lane of lanes) {
      const g = getTrackGroup(lane.label)
      ;(groups[g] ??= []).push(lane)
    }
    return groups
  }, [lanes])

  // --- collapsed groups state ---
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const toggleGroupCollapse = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }, [])

  // --- density ---
  const densityBuckets = useMemo(() => computeDensityBuckets(lanes, totalDurationMs, DENSITY_BUCKETS), [lanes, totalDurationMs])
  const maxDensity = useMemo(() => Math.max(1, ...densityBuckets), [densityBuckets])

  // --- density color buckets (predominant lane color at each bucket position) ---
  const densityColors = useMemo(() => {
    if (totalDurationMs <= 0) return new Array(DENSITY_BUCKETS).fill("#76B900")
    const bucketMs = totalDurationMs / DENSITY_BUCKETS
    return Array.from({ length: DENSITY_BUCKETS }, (_, i) => {
      const bucketStart = i * bucketMs
      const bucketEnd = (i + 1) * bucketMs
      const counts = new Map<string, number>()
      for (const lane of lanes) {
        for (const item of lane.items) {
          if (item.endMs > bucketStart && item.startMs < bucketEnd) {
            counts.set(lane.label, (counts.get(lane.label) ?? 0) + 1)
          }
        }
      }
      let maxLabel = ""
      let maxCount = 0
      for (const [label, count] of counts) {
        if (count > maxCount) { maxLabel = label; maxCount = count }
      }
      return maxLabel ? commandColor(maxLabel) : "#76B900"
    })
  }, [lanes, totalDurationMs])

  // --- playhead trail positions (for motion blur effect) ---
  const prevPlayheadRef = useRef<number>(currentMs)
  const [playheadTrails, setPlayheadTrails] = useState<Array<{ id: number; percent: number }>>([])
  const trailIdRef = useRef(0)
  useEffect(() => {
    const prevMs = prevPlayheadRef.current
    const diff = Math.abs(currentMs - prevMs)
    if (diff > 50 && diff < visibleDurationMs * 0.3) {
      const trailPercent = visibleDurationMs > 0 ? ((prevMs - viewStartMs) / visibleDurationMs) * 100 : 0
      if (trailPercent >= 0 && trailPercent <= 100) {
        const id = ++trailIdRef.current
        setPlayheadTrails((prev) => [...prev.slice(-3), { id, percent: trailPercent }])
        setTimeout(() => setPlayheadTrails((prev) => prev.filter((t) => t.id !== id)), 400)
      }
    }
    prevPlayheadRef.current = currentMs
  }, [currentMs, viewStartMs, visibleDurationMs])

  // --- helpers ---
  const clientXToMs = useCallback((clientX: number): number | null => {
    const el = trackAreaRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    const trackLeft = LABEL_WIDTH
    const trackWidth = rect.width - trackLeft - 10
    if (x < trackLeft || trackWidth <= 0) return null
    const ratio = (x - trackLeft) / trackWidth
    return viewStartMs + ratio * visibleDurationMs
  }, [viewStartMs, visibleDurationMs])

  const msToPercent = useCallback((ms: number): number => {
    return visibleDurationMs > 0 ? ((ms - viewStartMs) / visibleDurationMs) * 100 : 0
  }, [viewStartMs, visibleDurationMs])

  const msToTrackX = useCallback((ms: number): number | null => {
    const el = trackAreaRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const trackLeft = LABEL_WIDTH
    const trackWidth = rect.width - trackLeft - 10
    if (trackWidth <= 0) return null
    const ratio = (ms - viewStartMs) / visibleDurationMs
    return trackLeft + ratio * trackWidth
  }, [viewStartMs, visibleDurationMs])

  // --- all blocks flattened for keyboard navigation ---
  const allBlocks = useMemo(() => {
    const result: TimelineItem[] = []
    for (const lane of lanes) {
      for (const item of lane.items) {
        result.push(item)
      }
    }
    result.sort((a, b) => a.startMs - b.startMs)
    return result
  }, [lanes])

  // --- range computation ---
  const rangeMs = useMemo<{ start: number; end: number } | null>(() => {
    if (!rangeStartItem || !rangeEndItem) return null
    const startMs = Math.min(rangeStartItem.startMs, rangeEndItem.startMs)
    const endMs = Math.max(rangeStartItem.endMs, rangeEndItem.endMs)
    return { start: startMs, end: endMs }
  }, [rangeStartItem, rangeEndItem])

  // --- hover popover ---
  const showStepPopover = useCallback((item: TimelineItem) => {
    if (hoverTimerRef.current != null) window.clearTimeout(hoverTimerRef.current)
    // "Warm hover" — if popover already showing, switch instantly
    const delay = hoveredItem ? 0 : 150
    hoverTimerRef.current = window.setTimeout(() => setHoveredItem(item), delay)
  }, [hoveredItem])

  const hideStepPopover = useCallback(() => {
    if (hoverTimerRef.current != null) { window.clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
    hoverTimerRef.current = window.setTimeout(() => setHoveredItem(null), 300)
  }, [])

  // Called when mouse enters the popover — cancel pending hide
  const handlePopoverEnter = useCallback(() => {
    if (hoverTimerRef.current != null) { window.clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
  }, [])

  // Called when mouse leaves the popover — schedule hide
  const handlePopoverLeave = useCallback(() => {
    if (hoverTimerRef.current != null) { window.clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
    hoverTimerRef.current = window.setTimeout(() => setHoveredItem(null), 300)
  }, [])

  useEffect(() => () => { if (hoverTimerRef.current != null) window.clearTimeout(hoverTimerRef.current) }, [])

  // --- mouse interactions ---
  const handleTrackMouseMove = useCallback((e: React.MouseEvent) => {
    const el = trackAreaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const trackLeft = LABEL_WIDTH
    const trackWidth = rect.width - trackLeft - 10
    if (x >= trackLeft && trackWidth > 0) {
      const ratio = (x - trackLeft) / trackWidth
      setHoverTimeMs(Math.round(viewStartMs + ratio * visibleDurationMs))
      setHoverX(x)
    } else {
      setHoverTimeMs(null); setHoverX(null)
    }
  }, [viewStartMs, visibleDurationMs])

  // --- snap threshold: fraction of visible duration that equals ~100ms in time ---
  const snapThresholdMs = Math.min(200, visibleDurationMs * 0.015)

  const snapToNearestStep = useCallback((ms: number): { snapped: number; didSnap: boolean } => {
    let closest = ms
    let closestDist = snapThresholdMs
    let didSnap = false
    for (const lane of lanes) {
      for (const item of lane.items) {
        const distToStart = Math.abs(item.startMs - ms)
        const distToEnd = Math.abs(item.endMs - ms)
        if (distToStart < closestDist) { closest = item.startMs; closestDist = distToStart; didSnap = true }
        if (distToEnd < closestDist) { closest = item.endMs; closestDist = distToEnd; didSnap = true }
      }
    }
    return { snapped: closest, didSnap }
  }, [lanes, snapThresholdMs])

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (isDraggingPlayhead) return
    if (contextMenu) { setContextMenu(null); return }
    const ms = clientXToMs(e.clientX)
    if (ms != null) {
      const { snapped } = snapToNearestStep(ms)
      onSeek(Math.round(Math.max(0, Math.min(totalDurationMs, snapped))))
    }
  }, [clientXToMs, onSeek, totalDurationMs, isDraggingPlayhead, snapToNearestStep, contextMenu])

  // --- momentum helper ---
  const applyMomentum = useCallback((velocity: number) => {
    if (momentumRef.current.rafId != null) cancelAnimationFrame(momentumRef.current.rafId)
    const FRICTION = 0.92
    const MIN_VELOCITY = 0.5
    let currentVel = velocity
    const tick = () => {
      if (Math.abs(currentVel) < MIN_VELOCITY) { momentumRef.current.rafId = null; return }
      const delta = currentVel * FRAME_MS
      onSeek(Math.round(Math.max(0, Math.min(totalDurationMs, currentMs + delta))))
      currentVel *= FRICTION
      momentumRef.current.rafId = requestAnimationFrame(tick)
    }
    momentumRef.current.rafId = requestAnimationFrame(tick)
  }, [totalDurationMs, onSeek, FRAME_MS, currentMs])

  // --- playhead drag (with preview, snap feedback, momentum) ---
  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsDraggingPlayhead(true)
    setScrubPreviewMs(currentMs)
    scrubHistoryRef.current = [{ ms: currentMs, time: Date.now() }]
    if (momentumRef.current.rafId != null) { cancelAnimationFrame(momentumRef.current.rafId); momentumRef.current.rafId = null }

    const onMove = (ev: MouseEvent) => {
      const ms = clientXToMs(ev.clientX)
      if (ms != null) {
        const clamped = Math.max(0, Math.min(totalDurationMs, ms))
        const { snapped, didSnap } = snapToNearestStep(clamped)
        setScrubSnapped(didSnap)
        setScrubPreviewMs(snapped)
        const trackX = msToTrackX(snapped)
        setScrubTooltipX(trackX)
        onSeek(Math.round(snapped))
        const now = Date.now()
        scrubHistoryRef.current.push({ ms: snapped, time: now })
        if (scrubHistoryRef.current.length > 5) scrubHistoryRef.current.shift()
      }
    }
    const onUp = () => {
      setIsDraggingPlayhead(false)
      setScrubPreviewMs(null)
      setScrubSnapped(false)
      setScrubTooltipX(null)
      const history = scrubHistoryRef.current
      if (history.length >= 2) {
        const last = history[history.length - 1]
        const prev = history[history.length - 2]
        const dt = last.time - prev.time
        if (dt > 0 && dt < 100) {
          const velocity = (last.ms - prev.ms) / dt
          if (Math.abs(velocity) > 0.3) {
            applyMomentum(velocity)
          }
        }
      }
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [clientXToMs, onSeek, totalDurationMs, snapToNearestStep, msToTrackX, currentMs, applyMomentum])

  // --- Ctrl+wheel zoom + trackpad horizontal pan ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Ctrl/Meta + wheel = zoom
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.3 : 0.3
      setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)))
      lastManualPanRef.current = Date.now()
      const ms = clientXToMs(e.clientX)
      if (ms != null) setViewCenterMs((prev) => prev + (ms - prev) * 0.15)
      return
    }
    // Horizontal scroll (trackpad two-finger) = pan when zoomed
    if (zoom > 1 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault()
      const panAmount = (e.deltaX / 400) * visibleDurationMs
      setViewCenterMs((prev) => {
        const next = prev + panAmount
        return Math.max(visibleDurationMs / 2, Math.min(totalDurationMs - visibleDurationMs / 2, next))
      })
      lastManualPanRef.current = Date.now()
    }
  }, [clientXToMs, zoom, visibleDurationMs, totalDurationMs])

  // --- middle-mouse drag for panning ---
  const handleTrackMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1) return
    e.preventDefault()
    panRef.current = { isPanning: true, startX: e.clientX, startCenterMs: viewCenterMs }
    let lastX = e.clientX
    let lastTime = Date.now()
    let panVelocity = 0

    const onMove = (ev: MouseEvent) => {
      if (!panRef.current.isPanning) return
      const el = trackAreaRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const trackWidth = rect.width - LABEL_WIDTH - 10
      if (trackWidth <= 0) return
      const dx = ev.clientX - panRef.current.startX
      const msPerPx = visibleDurationMs / trackWidth
      const newCenter = panRef.current.startCenterMs - dx * msPerPx
      setViewCenterMs(Math.max(visibleDurationMs / 2, Math.min(totalDurationMs - visibleDurationMs / 2, newCenter)))
      lastManualPanRef.current = Date.now()
      const now = Date.now()
      const dt = now - lastTime
      if (dt > 0) { panVelocity = (ev.clientX - lastX) / dt }
      lastX = ev.clientX
      lastTime = now
    }
    const onUp = () => {
      panRef.current.isPanning = false
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      // Momentum panning deceleration
      if (Math.abs(panVelocity) > 0.2) {
        const el = trackAreaRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const trackWidth = rect.width - LABEL_WIDTH - 10
        if (trackWidth <= 0) return
        const msPerPx = visibleDurationMs / trackWidth
        if (panMomentumRef.current.rafId != null) cancelAnimationFrame(panMomentumRef.current.rafId)
        panMomentumRef.current.velocity = panVelocity
        const FRICTION = 0.94
        const MIN_V = 0.01
        const tick = () => {
          const v = panMomentumRef.current.velocity
          if (Math.abs(v) < MIN_V) { panMomentumRef.current.rafId = null; return }
          setViewCenterMs((prev) => {
            const next = prev - v * 16 * msPerPx
            return Math.max(visibleDurationMs / 2, Math.min(totalDurationMs - visibleDurationMs / 2, next))
          })
          panMomentumRef.current.velocity *= FRICTION
          lastManualPanRef.current = Date.now()
          panMomentumRef.current.rafId = requestAnimationFrame(tick)
        }
        panMomentumRef.current.rafId = requestAnimationFrame(tick)
      }
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [viewCenterMs, visibleDurationMs, totalDurationMs])

  // --- minimap drag ---
  const handleMinimapMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    minimapDragRef.current = { dragging: true, startX: e.clientX, startCenterMs: viewCenterMs }
    const onMove = (ev: MouseEvent) => {
      if (!minimapDragRef.current.dragging) return
      const el = (e.target as HTMLElement).closest("[data-minimap]") as HTMLElement | null
      if (!el) return
      const rect = el.getBoundingClientRect()
      const dx = ev.clientX - minimapDragRef.current.startX
      const ratio = dx / rect.width
      const newCenter = minimapDragRef.current.startCenterMs + ratio * totalDurationMs
      setViewCenterMs(Math.max(visibleDurationMs / 2, Math.min(totalDurationMs - visibleDurationMs / 2, newCenter)))
      lastManualPanRef.current = Date.now()
    }
    const onUp = () => {
      minimapDragRef.current.dragging = false
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [viewCenterMs, totalDurationMs, visibleDurationMs])

  // --- keyboard navigation (zoom, arrow scrub, tab, enter, escape) ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "=" || e.key === "+") {
        e.preventDefault()
        setZoom((prev) => Math.min(MAX_ZOOM, prev + 0.5))
        lastManualPanRef.current = Date.now()
      } else if (e.key === "-") {
        e.preventDefault()
        setZoom((prev) => Math.max(MIN_ZOOM, prev - 0.5))
        lastManualPanRef.current = Date.now()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        const step = e.shiftKey ? FRAME_MS * 10 : FRAME_MS
        onSeek(Math.round(Math.max(0, currentMs - step)))
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        const step = e.shiftKey ? FRAME_MS * 10 : FRAME_MS
        onSeek(Math.round(Math.min(totalDurationMs, currentMs + step)))
      } else if (e.key === "Tab") {
        e.preventDefault()
        if (allBlocks.length === 0) return
        const dir = e.shiftKey ? -1 : 1
        const next = focusedBlockIndex < 0 ? 0 : (focusedBlockIndex + dir + allBlocks.length) % allBlocks.length
        setFocusedBlockIndex(next)
        setSelectedBlockItem(allBlocks[next])
      } else if (e.key === "Enter") {
        if (focusedBlockIndex >= 0 && focusedBlockIndex < allBlocks.length) {
          e.preventDefault()
          onSeek(allBlocks[focusedBlockIndex].startMs)
        }
      } else if (e.key === "Escape") {
        setFocusedBlockIndex(-1)
        setSelectedBlockItem(null)
        setRangeStartItem(null)
        setRangeEndItem(null)
        setPinnedItem(null)
        setContextMenu(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [allBlocks, focusedBlockIndex, currentMs, totalDurationMs, onSeek, FRAME_MS])

  // --- close context menu on outside click ---
  useEffect(() => {
    if (!contextMenu) return
    const onClick = () => setContextMenu(null)
    window.addEventListener("click", onClick)
    return () => window.removeEventListener("click", onClick)
  }, [contextMenu])

  // --- block interaction callbacks ---
  const handleBlockClick = useCallback((item: TimelineItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.shiftKey) {
      if (!rangeStartItem) {
        setRangeStartItem(item)
      } else {
        setRangeEndItem(item)
      }
      return
    }
    onSeek(item.startMs)
    setSelectedBlockItem(item)
    const idx = allBlocks.findIndex((b) => b.step.id === item.step.id)
    setFocusedBlockIndex(idx)
  }, [onSeek, rangeStartItem, allBlocks])

  const handleBlockDoubleClick = useCallback((item: TimelineItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setPinnedItem((prev) => prev?.step.id === item.step.id ? null : item)
  }, [])

  const handleBlockContextMenu = useCallback((item: TimelineItem, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const menuItems = [
      { label: "Go to start", action: () => { onSeek(item.startMs); setContextMenu(null) } },
      { label: "Go to end", action: () => { onSeek(item.endMs); setContextMenu(null) } },
      { label: "Copy JSON", action: () => { navigator.clipboard.writeText(JSON.stringify(item.step.command, null, 2)).catch(() => {}); setContextMenu(null) } },
      { label: "Select range from here", action: () => { setRangeStartItem(item); setRangeEndItem(null); setContextMenu(null) } },
    ]
    setContextMenu({ x: e.clientX, y: e.clientY, items: menuItems })
  }, [onSeek])

  // --- minimap double-click: fit to all ---
  const handleMinimapDoubleClick = useCallback(() => {
    setZoom(1)
    setViewCenterMs(totalDurationMs / 2)
  }, [totalDurationMs])

  // --- ticks adapted to zoom window ---
  const tickCount = 6
  const ticks = useMemo(() => {
    const result: number[] = []
    for (let i = 0; i <= tickCount; i++) {
      result.push(viewStartMs + (i / tickCount) * visibleDurationMs)
    }
    return result
  }, [viewStartMs, visibleDurationMs])

  const playheadPercent = msToPercent(currentMs)
  const playheadVisible = currentMs >= viewStartMs && currentMs <= viewEndMs

  return (
    <section
      aria-label="Multi-track timeline"
      style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}
    >
      {/* Header with mode toggle and zoom controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Mode toggle buttons */}
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
            <button
              type="button"
              onClick={() => setTimelineMode("timeline")}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: timelineMode === "timeline" ? "rgba(118,185,0,0.2)" : "rgba(255,255,255,0.03)",
                color: timelineMode === "timeline" ? "#76B900" : "rgba(255,255,255,0.45)",
                borderRight: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              Timeline
            </button>
            <button
              type="button"
              onClick={switchToEditor}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: timelineMode === "editor" ? "rgba(118,185,0,0.2)" : "rgba(255,255,255,0.03)",
                color: timelineMode === "editor" ? "#76B900" : "rgba(255,255,255,0.45)",
              }}
            >
              Editor
            </button>
          </div>
          {timelineMode === "timeline" && (
            <span style={{ padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>
              {lanes.length} tracks
            </span>
          )}
          {timelineMode === "editor" && (
            <>
              <span style={{ padding: "1px 6px", borderRadius: 4, background: "rgba(118,185,0,0.06)", fontSize: 10, fontWeight: 600, color: "rgba(118,185,0,0.6)" }}>
                {steps.length} steps • {formatTime(totalDurationMs)}
              </span>
              {errorLines.size > 0 && (
                <span style={{ fontSize: 9, background: "rgba(239,68,68,0.2)", color: "#ef4444", padding: "1px 5px", borderRadius: 8, fontWeight: 600 }}>
                  {errorLines.size} error{errorLines.size > 1 ? "s" : ""}
                </span>
              )}
            </>
          )}
        </div>
        {timelineMode === "timeline" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums", fontFamily: "SFMono-Regular, Consolas, monospace" }}>
              {formatTime(currentMs)}
            </div>
            {/* Zoom level indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 5, background: zoom > 1 ? "rgba(118,185,0,0.1)" : "rgba(255,255,255,0.03)", border: zoom > 1 ? "1px solid rgba(118,185,0,0.25)" : "1px solid rgba(255,255,255,0.06)" }}>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6 }}>
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 9, fontWeight: 700, color: zoom > 1 ? "#76B900" : "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums", fontFamily: "SFMono-Regular, Consolas, monospace" }}>
                {zoom.toFixed(1)}x
              </span>
            </div>
            {/* Zoom buttons */}
            <button className="pbc-zoom-btn" type="button" aria-label="Zoom out" onClick={() => { setZoom((z) => Math.max(MIN_ZOOM, z - 0.5)); lastManualPanRef.current = Date.now() }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
            <button className="pbc-zoom-btn" type="button" aria-label="Zoom in" onClick={() => { setZoom((z) => Math.min(MAX_ZOOM, z + 0.5)); lastManualPanRef.current = Date.now() }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="8" y1="4" x2="8" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
            <button className="pbc-zoom-btn" type="button" aria-label="Fit all" title="Fit timeline to view" onClick={() => { setZoom(1); setViewCenterMs(totalDurationMs / 2) }} style={{ width: 32, fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>
              FIT
            </button>
          </div>
        )}
      </div>

      {/* Editor mode */}
      {timelineMode === "editor" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0 }}>
          <BashEditor
            value={editorText}
            onChange={setEditorText}
            activeLines={activeLines}
            errorLines={errorLines}
            onLineClick={handleLineClick}
            steps={steps}
            onRun={handleEditorRun}
            style={{ flex: 1, minHeight: 180, maxHeight: 260 }}
          />
          {activeLines.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "3px 8px", borderRadius: 4,
              background: "rgba(118,185,0,0.06)",
              border: "1px solid rgba(118,185,0,0.15)",
              fontSize: 10, color: "rgba(118,185,0,0.8)",
              fontFamily: "SFMono-Regular, Consolas, monospace"
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#76B900", animation: "pulse 1.5s infinite" }} />
              Playing line {activeLines[0]}{activeLines.length > 1 ? `\u2013${activeLines[activeLines.length - 1]}` : ""} ({activeLines.length} active)
            </div>
          )}
          {editorError && (
            <div style={{ fontSize: 10, color: "#f87171", padding: "4px 8px", borderRadius: 4, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}>
              {editorError}
            </div>
          )}
          {errorLines.size > 0 && (
            <div style={{
              padding: "4px 8px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.15)",
              borderRadius: 4,
              fontSize: 10,
              color: "#ef4444",
              maxHeight: 60,
              overflow: "auto",
              fontFamily: "SFMono-Regular, Consolas, monospace",
            }}>
              {Array.from(errorLines.entries()).map(([line, msg]) => (
                <div key={line}>Line {line}: {msg.trim()}</div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={handleEditorRun}
              disabled={isRunning || !editorText.trim()}
              style={{
                padding: "5px 14px",
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                border: "1px solid rgba(118,185,0,0.5)",
                background: "rgba(118,185,0,0.15)",
                color: "#76B900",
                cursor: isRunning || !editorText.trim() ? "not-allowed" : "pointer",
                opacity: isRunning || !editorText.trim() ? 0.5 : 1,
              }}
            >
              {isRunning ? "Running..." : "\u25B6 Run"}
            </button>
          </div>
        </div>
      ) : (
      <>
      {/* Density minimap - SVG smooth curve with color coding */}
      <div style={{ display: "grid", gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, paddingRight: 10 }}>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", paddingLeft: 8 }}>density</div>
        <div style={{ position: "relative", height: 24, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${DENSITY_BUCKETS} 24`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
            <defs>
              <linearGradient id="density-grad-stroke" x1="0" y1="0" x2="1" y2="0">
                {densityColors.filter((_, i) => i % 4 === 0).map((col, i, arr) => (
                  <stop key={i} offset={`${(i / Math.max(1, arr.length - 1)) * 100}%`} stopColor={col} stopOpacity="0.8" />
                ))}
              </linearGradient>
              <linearGradient id="density-grad-fill" x1="0" y1="0" x2="1" y2="0">
                {densityColors.filter((_, i) => i % 4 === 0).map((col, i, arr) => (
                  <stop key={i} offset={`${(i / Math.max(1, arr.length - 1)) * 100}%`} stopColor={col} stopOpacity="0.3" />
                ))}
              </linearGradient>
            </defs>
            {/* Filled area under curve */}
            <path
              d={(() => {
                const pts = densityBuckets.map((count, i) => ({ x: i, y: 24 - (count / maxDensity) * 20 }))
                if (pts.length < 2) return ""
                let d = `M 0 24 L 0 ${pts[0].y}`
                for (let i = 0; i < pts.length - 1; i++) {
                  const cp1x = pts[i].x + 0.4
                  const cp2x = pts[i + 1].x - 0.4
                  d += ` C ${cp1x} ${pts[i].y} ${cp2x} ${pts[i + 1].y} ${pts[i + 1].x} ${pts[i + 1].y}`
                }
                d += ` L ${DENSITY_BUCKETS - 1} 24 Z`
                return d
              })()}
              fill="url(#density-grad-fill)"
            />
            {/* Stroke line on top */}
            <path
              className="pbc-density-curve"
              d={(() => {
                const pts = densityBuckets.map((count, i) => ({ x: i, y: 24 - (count / maxDensity) * 20 }))
                if (pts.length < 2) return ""
                let d = `M ${pts[0].x} ${pts[0].y}`
                for (let i = 0; i < pts.length - 1; i++) {
                  const cp1x = pts[i].x + 0.4
                  const cp2x = pts[i + 1].x - 0.4
                  d += ` C ${cp1x} ${pts[i].y} ${cp2x} ${pts[i + 1].y} ${pts[i + 1].x} ${pts[i + 1].y}`
                }
                return d
              })()}
              stroke="url(#density-grad-stroke)"
              strokeWidth="1.2"
            />
          </svg>
          {/* Shine overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 50%)", pointerEvents: "none" }} />
          {/* Current viewport window indicator */}
          {zoom > 1 && (
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(viewStartMs / totalDurationMs) * 100}%`, width: `${(visibleDurationMs / totalDurationMs) * 100}%`, background: "rgba(255,255,255,0.04)", borderLeft: "1px solid rgba(255,255,255,0.15)", borderRight: "1px solid rgba(255,255,255,0.15)", pointerEvents: "none", borderRadius: 2 }} />
          )}
          {/* Playhead position on density */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${totalDurationMs > 0 ? (currentMs / totalDurationMs) * 100 : 0}%`, width: 1.5, background: "#76B900", boxShadow: "0 0 4px rgba(118,185,0,0.6)", pointerEvents: "none" }} />
        </div>
      </div>

      {/* Minimap (only when zoomed) */}
      {zoom > 1 && (
        <div data-minimap style={{ display: "grid", gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, paddingRight: 10 }}>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", paddingLeft: 8 }}>overview</div>
          <div
            style={{ position: "relative", height: 18, borderRadius: 5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", overflow: "hidden" }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const ratio = (e.clientX - rect.left) / rect.width
              const newCenter = ratio * totalDurationMs
              setViewCenterMs(Math.max(visibleDurationMs / 2, Math.min(totalDurationMs - visibleDurationMs / 2, newCenter)))
              lastManualPanRef.current = Date.now()
            }}
            onDoubleClick={handleMinimapDoubleClick}
          >
            {/* Density gradient background in minimap */}
            <div style={{ position: "absolute", inset: 0, display: "flex", opacity: 0.4 }}>
              {densityBuckets.map((count, i) => {
                const alpha = count / maxDensity
                return <div key={`mm-d-${i}`} style={{ flex: 1, background: alpha > 0 ? `rgba(118,185,0,${alpha * 0.35})` : "transparent" }} />
              })}
            </div>
            {lanes.map((lane) => lane.items.map((item) => {
              const l = totalDurationMs > 0 ? (item.startMs / totalDurationMs) * 100 : 0
              const w = totalDurationMs > 0 ? Math.max(0.3, ((item.endMs - item.startMs) / totalDurationMs) * 100) : 0
              return <div key={item.step.id} style={{ position: "absolute", top: 3, bottom: 3, left: `${l}%`, width: `${w}%`, borderRadius: 2, background: `${commandColor(lane.label)}66` }} />
            }))}
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${totalDurationMs > 0 ? (currentMs / totalDurationMs) * 100 : 0}%`, width: 1.5, background: "#76B900", boxShadow: "0 0 4px rgba(118,185,0,0.6)", zIndex: 3 }} />
            <div className="pbc-minimap-viewport" onMouseDown={handleMinimapMouseDown} style={{ position: "absolute", top: 0, bottom: 0, left: `${totalDurationMs > 0 ? (viewStartMs / totalDurationMs) * 100 : 0}%`, width: `${totalDurationMs > 0 ? (visibleDurationMs / totalDurationMs) * 100 : 100}%`, borderRadius: 4, border: "1.5px solid rgba(118,185,0,0.45)", background: "rgba(118,185,0,0.06)", zIndex: 2 }} />
          </div>
        </div>
      )}

      {/* Enhanced Time Ruler */}
      <div style={{ display: "grid", gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, paddingRight: 10 }}>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.15)", display: "flex", alignItems: "flex-end", paddingLeft: 8, paddingBottom: 2 }}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.4 }}>
            <rect x="1" y="3" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <line x1="4" y1="1" x2="4" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="12" y1="1" x2="12" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="pbc-time-ruler">
          {/* Highlighted viewport range background */}
          {zoom > 1 && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(118,185,0,0.02)", borderRadius: 3 }} />
          )}
          {ticks.map((t, i) => {
            const leftPct = (i / tickCount) * 100
            return (
              <React.Fragment key={i}>
                {/* Major tick mark */}
                <span className="pbc-ruler-tick-major" style={{ left: `${leftPct}%` }} />
                {/* Time label */}
                <span className="pbc-ruler-label" style={{ left: `${leftPct}%` }}>
                  {formatTime(t)}
                </span>
              </React.Fragment>
            )
          })}
          {/* Minor ticks between major ticks */}
          {ticks.slice(0, -1).map((_, i) => {
            const subTickCount = zoom > 4 ? 5 : zoom > 2 ? 3 : 1
            return Array.from({ length: subTickCount }, (__, j) => {
              const subPos = ((i + (j + 1) / (subTickCount + 1)) / tickCount) * 100
              return <span key={`sub-${i}-${j}`} className="pbc-ruler-tick-minor" style={{ left: `${subPos}%` }} />
            })
          })}
          {/* Playhead marker on ruler */}
          {playheadVisible && (
            <div style={{ position: "absolute", bottom: 0, left: `${playheadPercent}%`, width: 2, height: 12, background: "#76B900", borderRadius: "1px 1px 0 0", boxShadow: "0 0 6px rgba(118,185,0,0.5)", transform: "translateX(-1px)" }} />
          )}
        </div>
      </div>

      {/* Track area */}
      <div
        ref={trackAreaRef}
        onClick={handleTrackClick}
        onMouseDown={handleTrackMouseDown}
        onMouseMove={handleTrackMouseMove}
        onMouseLeave={() => { setHoverTimeMs(null); setHoverX(null) }}
        onWheel={handleWheel}
        onContextMenu={(e) => { e.preventDefault() }}
        style={{ position: "relative", borderRadius: 8, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", cursor: isDraggingPlayhead ? "ew-resize" : panRef.current.isPanning ? "grabbing" : "crosshair" }}
      >
        {/* Vertical grid lines from ticks */}
        {ticks.map((_, i) => {
          const leftPercent = (i / tickCount) * 100
          return (
            <div key={`grid-${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px - 10px) * ${leftPercent / 100})`, width: 1, background: "rgba(255,255,255,0.03)", borderLeft: "1px dotted rgba(255,255,255,0.04)", zIndex: 0, pointerEvents: "none" }} />
          )
        })}

        {/* Range selection highlight */}
        {rangeMs && visibleDurationMs > 0 && (() => {
          const rangeStartPct = Math.max(0, msToPercent(rangeMs.start))
          const rangeEndPct = Math.min(100, msToPercent(rangeMs.end))
          if (rangeEndPct <= 0 || rangeStartPct >= 100) return null
          return (
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px - 10px) * ${rangeStartPct / 100})`, width: `calc((100% - ${LABEL_WIDTH}px - 10px) * ${(rangeEndPct - rangeStartPct) / 100})`, background: "rgba(118,185,0,0.06)", borderLeft: "2px solid rgba(118,185,0,0.4)", borderRight: "2px solid rgba(118,185,0,0.4)", zIndex: 1, pointerEvents: "none" }}>
              <div style={{ position: "absolute", top: 0, left: -1, width: 2, height: 8, background: "#76B900", borderRadius: "0 0 2px 2px" }} />
              <div style={{ position: "absolute", top: 0, right: -1, width: 2, height: 8, background: "#76B900", borderRadius: "0 0 2px 2px" }} />
            </div>
          )
        })()}

        <div ref={scrollContainerRef} className="pbc-track-scroll" style={{ maxHeight: 220, overflowY: "auto", overflowX: "hidden", padding: "4px 0 2px", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: LABEL_WIDTH, width: 1, background: "rgba(255,255,255,0.06)", zIndex: 1 }} />
          {lanes.length === 0 ? (
            <div style={{ height: 186, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.25)", fontSize: 12 }}>No tracks</div>
          ) : (
            Object.entries(groupedLanes).map(([group, groupLanes], groupIdx) => {
              const isCollapsed = collapsedGroups.has(group)
              const groupItemCount = groupLanes.reduce((sum, lane) => sum + lane.items.length, 0)
              return (
              <div key={group}>
                {Object.keys(groupedLanes).length > 1 && (
                  <div
                    className="pbc-group-header"
                    onClick={() => toggleGroupCollapse(group)}
                    style={{ display: "grid", gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, minHeight: 22, alignItems: "center", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)", borderTop: groupIdx > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined, marginTop: groupIdx > 0 ? 2 : 0 }}
                  >
                    <div style={{ padding: "0 8px", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.6, display: "flex", alignItems: "center", gap: 5 }}>
                      {/* Collapse/expand chevron */}
                      <span className={`pbc-group-chevron${isCollapsed ? " pbc-group-chevron-collapsed" : ""}`}>
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                          <path d="M2.5 3.5L5 6L7.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>{group}</span>
                      {/* Item count badge */}
                      <span className="pbc-badge-pop" style={{ padding: "0 4px", borderRadius: 3, background: "rgba(255,255,255,0.06)", fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.3)", lineHeight: "14px" }}>
                        {groupItemCount}
                      </span>
                    </div>
                    <div style={{ height: 1, background: isCollapsed ? "transparent" : "rgba(255,255,255,0.03)" }} />
                  </div>
                )}
                {!isCollapsed && groupLanes.map((lane, laneIndex) => (
                  <TimelineLaneRow key={lane.id} lane={lane} viewStartMs={viewStartMs} visibleDurationMs={visibleDurationMs} labelWidth={LABEL_WIDTH} even={laneIndex % 2 === 0} currentMs={currentMs} onSeek={onSeek} onStepHoverStart={showStepPopover} onStepHoverEnd={hideStepPopover} selectedBlockId={selectedBlockItem?.step.id ?? null} focusedBlockId={focusedBlockIndex >= 0 && focusedBlockIndex < allBlocks.length ? allBlocks[focusedBlockIndex].step.id : null} rangeMs={rangeMs} onBlockClick={handleBlockClick} onBlockDoubleClick={handleBlockDoubleClick} onBlockContextMenu={handleBlockContextMenu} />
                ))}
              </div>
              )
            })
          )}
        </div>

        {/* Motion blur trails */}
        {playheadTrails.map((trail) => (
          <div
            key={trail.id}
            className="pbc-playhead-trail"
            style={{ left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px - 10px) * ${trail.percent / 100})`, background: "rgba(118,185,0,0.3)", zIndex: 4 }}
          />
        ))}

        {/* Playhead with gradient fade, time display, and glow */}
        {playheadVisible && (
          <div className="pbc-playhead-line" style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px - 10px) * ${playheadPercent / 100})`, width: 2, background: "linear-gradient(180deg, transparent 0%, #9FE030 8%, #76B900 50%, #9FE030 92%, transparent 100%)", boxShadow: "0 0 12px rgba(118,185,0,0.7), 0 0 4px rgba(118,185,0,0.9), 0 0 24px rgba(118,185,0,0.3)", zIndex: 5, pointerEvents: "none", borderRadius: 1 }}>
            {/* Time display following playhead */}
            <div className="pbc-playhead-time">{formatTime(currentMs)}</div>
            {/* Top triangle handle */}
            <div className="pbc-playhead-handle" onMouseDown={handlePlayheadMouseDown} style={{ position: "absolute", top: -3, left: -7, width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "9px solid #9FE030", filter: "drop-shadow(0 0 4px rgba(118,185,0,0.8))", pointerEvents: "auto", cursor: "ew-resize" }} />
            {/* Bottom triangle handle */}
            <div className="pbc-playhead-handle" onMouseDown={handlePlayheadMouseDown} style={{ position: "absolute", bottom: -3, left: -7, width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: "9px solid #9FE030", filter: "drop-shadow(0 0 4px rgba(118,185,0,0.8))", pointerEvents: "auto", cursor: "ew-resize" }} />
          </div>
        )}

        {/* Hover time indicator */}
        {hoverX !== null && hoverTimeMs !== null && (
          <>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: hoverX, width: 1, background: "rgba(118,185,0,0.25)", borderLeft: "1px dashed rgba(118,185,0,0.3)", zIndex: 3, pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 2, left: hoverX, transform: "translateX(-50%)", padding: "2px 6px", borderRadius: 4, background: "rgba(118,185,0,0.9)", fontSize: 9, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums", pointerEvents: "none", zIndex: 6, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>{formatTime(hoverTimeMs)}</div>
          </>
        )}

        {hoveredItem && (
          <StepJsonPopover item={hoveredItem} viewStartMs={viewStartMs} visibleDurationMs={visibleDurationMs} labelWidth={LABEL_WIDTH} onMouseEnter={handlePopoverEnter} onMouseLeave={handlePopoverLeave} />
        )}
      </div>

      {/* Zoom hint footer */}
      {zoom <= 1 && (
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", textAlign: "right", paddingRight: 4 }}>Ctrl+wheel or +/- to zoom</div>
      )}
      </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// TimelineLaneRow  (zoom-aware, block labels, visual polish)
// ---------------------------------------------------------------------------
function TimelineLaneRow({
  lane,
  viewStartMs,
  visibleDurationMs,
  labelWidth,
  even,
  currentMs,
  onSeek,
  onStepHoverStart,
  onStepHoverEnd,
  selectedBlockId: _selectedBlockId,
  focusedBlockId: _focusedBlockId,
  rangeMs: _rangeMs,
  onBlockClick: _onBlockClick,
  onBlockDoubleClick: _onBlockDoubleClick,
  onBlockContextMenu: _onBlockContextMenu,
}: {
  lane: TimelineLane
  viewStartMs: number
  visibleDurationMs: number
  labelWidth: number
  even: boolean
  currentMs: number
  onSeek: (ms: number) => void
  onStepHoverStart: (item: TimelineItem) => void
  onStepHoverEnd: () => void
  selectedBlockId?: string | null
  focusedBlockId?: string | null
  rangeMs?: { start: number; end: number } | null
  onBlockClick?: (item: TimelineItem, e: React.MouseEvent) => void
  onBlockDoubleClick?: (item: TimelineItem, e: React.MouseEvent) => void
  onBlockContextMenu?: (item: TimelineItem, e: React.MouseEvent<HTMLDivElement>) => void
}) {
  const color = commandColor(lane.label)
  const viewEndMs = viewStartMs + visibleDurationMs

  const visibleItems = useMemo(() =>
    lane.items.filter((item) => item.endMs > viewStartMs && item.startMs < viewEndMs),
    [lane.items, viewStartMs, viewEndMs]
  )

  // Compute waveform-like border-radius variation based on duration
  const getBlockRadius = (durationMs: number): string => {
    // Short clips: pill-shaped; medium: slightly rounded; long: more rectangular
    if (durationMs < 500) return "9px"
    if (durationMs < 1500) return "6px"
    if (durationMs < 3000) return "5px 7px 7px 5px"
    return "4px 6px 6px 4px"
  }

  return (
    <div className="pbc-lane-row" style={{ display: "grid", gridTemplateColumns: `${labelWidth}px 1fr`, minHeight: 32, alignItems: "center", position: "relative", background: even ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.008) 30%, rgba(255,255,255,0.012) 70%, transparent)" : "linear-gradient(90deg, transparent, rgba(255,255,255,0.018) 30%, rgba(255,255,255,0.022) 70%, transparent)", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
      {/* Track label with color indicator and item count */}
      <div style={{ padding: "0 8px", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
        {/* Color-coded lane indicator with gradient */}
        <span style={{ flexShrink: 0, width: 3, height: 18, borderRadius: 2, background: `linear-gradient(180deg, ${color}ee, ${color}88)`, boxShadow: `0 0 5px ${color}44, inset 0 0 2px rgba(255,255,255,0.2)` }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }} title={lane.label}>{lane.label}</span>
        {/* Item count badge */}
        <span className="pbc-badge-pop" style={{ flexShrink: 0, minWidth: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", borderRadius: 4, background: `${color}18`, border: `1px solid ${color}33`, fontSize: 8, fontWeight: 700, color: `${color}cc`, lineHeight: 1 }}>
          {lane.items.length}
        </span>
      </div>
      {/* Track content area */}
      <div style={{ position: "relative", height: 26, marginRight: 10, borderRadius: 5, background: "rgba(255,255,255,0.015)" }}>
        {visibleItems.map((item) => {
          const left = visibleDurationMs > 0 ? ((item.startMs - viewStartMs) / visibleDurationMs) * 100 : 0
          const width = visibleDurationMs > 0 ? Math.max(0.4, ((item.endMs - item.startMs) / visibleDurationMs) * 100) : 0
          const clampedLeft = Math.max(0, left)
          const clampedWidth = Math.min(width, 100 - clampedLeft)
          const isActive = currentMs >= item.startMs && currentMs < item.endMs
          const approxPxWidth = (clampedWidth / 100) * 600
          const durationMs = item.endMs - item.startMs
          const blockRadius = getBlockRadius(durationMs)

          return (
            <button
              className={`pbc-timeline-item${isActive ? " pbc-block-active-glow" : ""}`}
              key={item.step.id}
              type="button"
              title={`${item.step.command.type}  |  ${formatTime(item.startMs)} - ${formatTime(item.endMs)}  (${(durationMs / 1000).toFixed(1)}s)`}
              aria-label={`${item.step.command.type} at ${formatTime(item.startMs)}`}
              onClick={(e) => { e.stopPropagation(); onSeek(item.startMs) }}
              onMouseEnter={() => onStepHoverStart(item)}
              onMouseLeave={onStepHoverEnd}
              onFocus={() => onStepHoverStart(item)}
              onBlur={onStepHoverEnd}
              style={{
                ["--glow-color" as string]: `${color}88`,
                ["--pulse-color" as string]: `${color}66`,
                position: "absolute",
                top: 3,
                left: `${clampedLeft}%`,
                width: `${clampedWidth}%`,
                minWidth: 4,
                height: 20,
                border: isActive ? `1px solid ${color}cc` : `1px solid ${color}33`,
                borderRadius: blockRadius,
                // 3D bevel effect: lighter top, darker bottom, with subtle mid-shine
                background: isActive
                  ? `linear-gradient(180deg, ${color}ff 0%, ${color}cc 30%, ${color}aa 70%, ${color}77 100%)`
                  : `linear-gradient(180deg, ${color}99 0%, ${color}77 35%, ${color}55 65%, ${color}44 100%)`,
                boxShadow: isActive
                  ? `0 0 14px ${color}66, 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.2)`
                  : `0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.15)`,
                opacity: isActive ? 1 : 0.82,
                cursor: "pointer",
                padding: 0,
                zIndex: isActive ? 2 : 1,
                overflow: "visible",
              }}
            >
              {/* Top bevel highlight */}
              <span style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
              {/* Inner waveform-like texture for longer blocks */}
              {approxPxWidth > 40 && durationMs > 800 && (
                <span style={{ position: "absolute", top: "40%", left: 4, right: 4, height: 2, background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.06) 60%, rgba(255,255,255,0.1) 80%, transparent 100%)`, pointerEvents: "none", borderRadius: 1 }} />
              )}
              {/* Block label with tooltip for truncated text */}
              {approxPxWidth > 50 && (
                <span className="pbc-block-label" style={{ position: "relative", display: "block", padding: "0 6px", fontSize: 8.5, fontWeight: 700, color: "rgba(255,255,255,0.95)", lineHeight: "20px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 2px rgba(0,0,0,0.6)", letterSpacing: 0.2 }}>
                  {item.step.command.type}
                  {/* Tooltip shown on hover for potentially-truncated labels */}
                  {approxPxWidth < 120 && (
                    <span className="pbc-block-tooltip">{item.step.command.type}</span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StepJsonPopover  (zoom-aware positioning, shown below track area)
// ---------------------------------------------------------------------------
function StepJsonPopover({
  item,
  viewStartMs,
  visibleDurationMs,
  labelWidth,
  onMouseEnter,
  onMouseLeave,
}: {
  item: TimelineItem
  viewStartMs: number
  visibleDurationMs: number
  labelWidth: number
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const color = commandColor(item.step.command.type)
  const itemMidpoint = item.startMs + (item.endMs - item.startMs) / 2
  const left = visibleDurationMs > 0 ? Math.min(75, Math.max(15, ((itemMidpoint - viewStartMs) / visibleDurationMs) * 100)) : 50
  const durationMs = item.endMs - item.startMs

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: "absolute", left: `calc(${labelWidth}px + (100% - ${labelWidth}px) * ${left / 100})`, bottom: "calc(100% + 10px)", width: 320, transform: "translateX(-50%)", zIndex: 50, padding: 10, borderRadius: 10, background: "rgba(16, 18, 36, 0.94)", border: `1px solid ${color}44`, boxShadow: `0 -6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", animation: "stepPopoverIn 180ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      {/* Connector arrow pointing down */}
      <div style={{ position: "absolute", bottom: -7, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: `7px solid ${color}55` }} />
      <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid rgba(16, 18, 36, 0.96)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 4, background: `${color}33`, border: `1px solid ${color}66` }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: 0.3 }}>{item.step.command.type}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontVariantNumeric: "tabular-nums", fontFamily: "SFMono-Regular, Consolas, monospace" }}>
            {formatTime(item.startMs)} – {formatTime(item.endMs)} ({(durationMs / 1000).toFixed(1)}s)
          </div>
        </div>
      </div>
      <JsonInspector
        value={item.step.command}
        height={200}
        initialMode="tree"
        focusPath={["type"]}
        compact
      />
    </div>
  )
}

function ActiveCommandList({
  steps,
  currentMs,
  totalDurationMs,
  onSeek,
  isPlaying,
  allSteps,
  onCollapse,
  onCollapseRight,
}: {
  steps: PresentationStep[]
  currentMs: number
  totalDurationMs: number
  onSeek: (ms: number) => void
  isPlaying: boolean
  allSteps?: PresentationStep[]
  onCollapse?: () => void
  onCollapseRight?: () => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const prevStepIdsRef = useRef<Set<string>>(new Set())
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<"list" | "json">("list")

  // Track entering steps for transition indicators
  const currentStepIds = useMemo(() => new Set(steps.map((s) => s.id)), [steps])

  useEffect(() => {
    const prevIds = prevStepIdsRef.current
    const newEntering = new Set<string>()

    for (const id of currentStepIds) {
      if (!prevIds.has(id)) newEntering.add(id)
    }

    if (newEntering.size > 0) {
      setEnteringIds(newEntering)
      const timer = window.setTimeout(() => setEnteringIds(new Set()), 400)
      prevStepIdsRef.current = currentStepIds
      return () => window.clearTimeout(timer)
    }

    prevStepIdsRef.current = currentStepIds
  }, [currentStepIds])

  // Auto-scroll to bottom when playing and new steps appear
  useEffect(() => {
    if (isPlaying && listRef.current && steps.length > 0) {
      const el = listRef.current
      el.scrollTop = el.scrollHeight
    }
  }, [steps.length, isPlaying])

  // Next upcoming step (for empty state)
  const nextStep = useMemo(() => {
    if (!allSteps || steps.length > 0) return null
    const upcoming = allSteps
      .filter((s) => s.startMs > currentMs && s.command.type !== "wait" && s.command.type !== "clear")
      .sort((a, b) => a.startMs - b.startMs)
    return upcoming[0] ?? null
  }, [allSteps, steps, currentMs])

  const contentHeight = 220

  return (
    <section
      aria-label="Active commands"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
        height: "100%",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        {/* Left: collapse-right button + label + count */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
          {onCollapseRight && (
            <button
              className="pbc-btn pbc-btn-ghost"
              type="button"
              title="Collapse right panel (Ctrl+Shift+R)"
              aria-label="Collapse right panel"
              onClick={onCollapseRight}
              style={{
                width: 22,
                height: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 5,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
            >
              <IconChevronRight size={10} />
            </button>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
            Active
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 8,
              background: steps.length > 0 ? "rgba(118,185,0,0.18)" : "rgba(255,255,255,0.06)",
              fontSize: 9,
              fontWeight: 700,
              color: steps.length > 0 ? "#76B900" : "rgba(255,255,255,0.35)",
            }}
          >
            {steps.length}
          </span>
        </div>

        {/* Right: List/JSON toggle + Collapse button */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* List/JSON toggle */}
          <div style={{ display: "flex", padding: 2, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <button
              type="button"
              onClick={() => setMode("list")}
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                border: "none",
                background: mode === "list" ? "rgba(255,255,255,0.14)" : "transparent",
                color: mode === "list" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 100ms ease",
              }}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setMode("json")}
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                border: "none",
                background: mode === "json" ? "rgba(255,255,255,0.14)" : "transparent",
                color: mode === "json" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 100ms ease",
              }}
            >
              JSON
            </button>
          </div>
          {onCollapse && (
            <button
              className="pbc-btn pbc-btn-ghost"
              type="button"
              title="Collapse (Ctrl+Shift+E)"
              aria-label="Collapse console"
              onClick={onCollapse}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                height: 26,
                padding: "0 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              <IconChevronDown size={10} />
              <span>Collapse</span>
            </button>
          )}
        </div>
      </div>

      {/* Content area — fills remaining height */}
      {mode === "json" ? (
        <div
          className="pbc-panel-fade"
          style={{
            flex: 1,
            minHeight: 0,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <JsonInspector
            value={steps}
            initialMode="tree"
            focusPath={steps.length > 0 ? ["0", "command"] : undefined}
            fillHeight
          />
        </div>
      ) : (
        <div
          ref={listRef}
          className="pbc-panel-fade"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            borderRadius: 8,
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {steps.length === 0 ? (
            <ActiveEmptyState currentMs={currentMs} totalDurationMs={totalDurationMs} nextStep={nextStep} />
          ) : (
            <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
              {steps.map((step, idx) => (
                <ActiveCommandCard
                  key={step.id}
                  step={step}
                  currentMs={currentMs}
                  totalDurationMs={totalDurationMs}
                  isEntering={enteringIds.has(step.id)}
                  onClick={() => onSeek(step.startMs)}
                  staggerIndex={idx}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** Enhanced empty state with animated clock, countdown to next step, and preview */
function ActiveEmptyState({ currentMs, totalDurationMs, nextStep }: { currentMs: number; totalDurationMs: number; nextStep?: PresentationStep | null }) {
  const timeToNext = nextStep ? Math.max(0, nextStep.startMs - currentMs) : null
  const timeToNextSec = timeToNext !== null ? (timeToNext / 1000).toFixed(1) : null
  const progressPct = totalDurationMs > 0 ? (currentMs / totalDurationMs) * 100 : 0

  return (
    <div
      style={{
        height: 205,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "rgba(255,255,255,0.25)",
        fontSize: 12,
        textAlign: "center",
        padding: "8px 12px",
      }}
    >
      {/* Animated clock with spinning hand */}
      <div style={{ position: "relative", width: 36, height: 36 }}>
        <svg className="pbc-empty-clock" width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="10" stroke="rgba(118,185,0,0.2)" strokeWidth={0.5} />
        </svg>
        <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="rgba(118,185,0,0.6)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", top: 0, left: 0 }}>
          <polyline className="pbc-clock-hand-anim" points="12 7 12 12 15 14" />
        </svg>
      </div>

      {/* Countdown to next step */}
      {timeToNextSec !== null ? (
        <span className="pbc-waiting-pulse" style={{ fontWeight: 600, color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
          Next step in {timeToNextSec}s
        </span>
      ) : (
        <span className="pbc-waiting-pulse" style={{ fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>
          Waiting for next step...
        </span>
      )}

      {/* Next step preview */}
      {nextStep && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: commandColor(nextStep.command.type), boxShadow: `0 0 4px ${commandColor(nextStep.command.type)}66` }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: commandColor(nextStep.command.type), textTransform: "uppercase" }}>
            {nextStep.command.type}
          </span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {nextStep.description || describeCommand(nextStep.command)}
          </span>
        </div>
      )}

      {/* Mini timeline progress bar */}
      <div style={{ width: "80%", height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", position: "relative", overflow: "hidden", marginTop: 4 }}>
        <div style={{ width: `${progressPct}%`, height: "100%", background: "linear-gradient(90deg, rgba(118,185,0,0.4), rgba(118,185,0,0.7))", borderRadius: 2, transition: "width 100ms linear" }} />
        {nextStep && totalDurationMs > 0 && (
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(nextStep.startMs / totalDurationMs) * 100}%`, width: 2, background: commandColor(nextStep.command.type), borderRadius: 1, opacity: 0.6 }} />
        )}
      </div>

      <div style={{ display: "flex", gap: 12, fontSize: 10, color: "rgba(255,255,255,0.2)", fontVariantNumeric: "tabular-nums", fontFamily: "SFMono-Regular, Consolas, monospace" }}>
        <span>{formatTime(currentMs)}</span>
        <span style={{ color: "rgba(255,255,255,0.1)" }}>/</span>
        <span>{formatTime(totalDurationMs)}</span>
      </div>
    </div>
  )
}

function ActiveCommandCard({
  step,
  currentMs,
  totalDurationMs,
  isEntering,
  onClick,
  staggerIndex = 0,
}: {
  step: PresentationStep
  currentMs: number
  totalDurationMs: number
  isEntering: boolean
  onClick: () => void
  staggerIndex?: number
}) {
  const color = commandColor(step.command.type)
  const elapsed = Math.max(0, currentMs - step.startMs)
  const duration = (step.endMs ?? step.startMs) - step.startMs
  const progressPct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 100
  const endMs = step.endMs ?? totalDurationMs
  const nearEnd = endMs - currentMs < 500 && endMs - currentMs > 0
  const remainingSec = Math.max(0, (endMs - currentMs) / 1000)

  return (
    <div
      className={`pbc-cmd-card ${isEntering ? "pbc-cmd-card-enter pbc-cmd-card-pulse" : ""}`}
      onClick={onClick}
      title={`Click to seek to ${formatTime(step.startMs)}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "7px 8px 7px 12px",
        borderRadius: 6,
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        borderLeft: `3px solid ${color}`,
        animationDelay: isEntering ? `${staggerIndex * 50}ms` : undefined,
      }}
    >
      {/* Progress background fill */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${progressPct}%`,
          background: `${color}0a`,
          borderRight: progressPct < 100 ? `1px solid ${color}22` : "none",
          pointerEvents: "none",
          transition: "width 100ms linear",
        }}
      />

      {/* Top row: type icon + name prominently */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
        {/* Color dot icon */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
          {isEntering && (
            <span style={{ fontSize: 8, color: "#76B900", lineHeight: 1 }}>&#x2191;</span>
          )}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 18,
              height: 18,
              borderRadius: 4,
              background: `${color}18`,
              border: `1px solid ${color}33`,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 2,
                background: color,
                boxShadow: `0 0 5px ${color}88`,
              }}
            />
          </span>
        </div>

        {/* Type name + timing */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            {step.command.type}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {nearEnd && (
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "SFMono-Regular, Consolas, monospace" }}>
                {remainingSec.toFixed(1)}s
              </span>
            )}
            <span
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.3)",
                fontVariantNumeric: "tabular-nums",
                fontFamily: "SFMono-Regular, Consolas, monospace",
                whiteSpace: "nowrap",
              }}
            >
              {formatTime(step.startMs)}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 11,
          lineHeight: 1.4,
          color: "rgba(255,255,255,0.7)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          paddingLeft: 30,
          position: "relative",
        }}
      >
        {step.description || describeCommand(step.command)}
      </div>

      {/* Mini-timeline bar showing step progress */}
      <div
        style={{
          marginLeft: 30,
          height: 3,
          borderRadius: 2,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${progressPct}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${color}aa)`,
            borderRadius: 2,
            transition: "width 100ms linear",
          }}
        />
      </div>
    </div>
  )
}

// ============================================================================
// App
// ============================================================================

/**
 * Isolated playback console — manages its own time state via PlayerRef events.
 * Does NOT cause parent (App/Player) to re-render.
 */
function IsolatedPlaybackConsole({
  script,
  playerRef,
  onStepsChange,
}: {
  script: Script
  playerRef: React.RefObject<PlayerRef | null>
  onStepsChange: (steps: PresentationStep[], totalMs: number) => void
}) {
  const [currentMs, setCurrentMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isLooping, setIsLooping] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const currentMsRef = useRef(0)
  const throttleRef = useRef<number | null>(null)
  const isLoopingRef = useRef(false)

  // Keep ref in sync for use in event handlers
  useEffect(() => {
    isLoopingRef.current = isLooping
  }, [isLooping])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const handleFrameUpdate = ({ detail }: { detail: { frame: number } }) => {
      const ms = frameToMs(detail.frame, FPS)
      currentMsRef.current = ms
      // Throttle UI state to ~10fps -- control panel doesn't need 30fps
      if (throttleRef.current === null) {
        throttleRef.current = window.setTimeout(() => {
          throttleRef.current = null
          setCurrentMs(currentMsRef.current)
        }, 100)
      }
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => {
      setIsPlaying(false)
      setCurrentMs(currentMsRef.current)
    }
    const handleEnded = () => {
      if (isLoopingRef.current) {
        // Loop: seek to start and replay
        player.seekTo(0)
        player.play()
        currentMsRef.current = 0
        setCurrentMs(0)
      } else {
        setCurrentMs(script.totalDurationMs)
        currentMsRef.current = script.totalDurationMs
        setIsPlaying(false)
      }
    }

    player.addEventListener("frameupdate", handleFrameUpdate)
    player.addEventListener("play", handlePlay)
    player.addEventListener("pause", handlePause)
    player.addEventListener("ended", handleEnded)

    return () => {
      player.removeEventListener("frameupdate", handleFrameUpdate)
      player.removeEventListener("play", handlePlay)
      player.removeEventListener("pause", handlePause)
      player.removeEventListener("ended", handleEnded)
      if (throttleRef.current !== null) {
        window.clearTimeout(throttleRef.current)
        throttleRef.current = null
      }
    }
  }, [script, playerRef])

  const seekToMs = useCallback((ms: number) => {
    const safeMs = Math.max(0, Math.min(ms, script.totalDurationMs))
    playerRef.current?.seekTo(msToFrame(safeMs, FPS))
    currentMsRef.current = safeMs
    setCurrentMs(safeMs)
  }, [script, playerRef])

  const play = useCallback(() => {
    playerRef.current?.play()
    setIsPlaying(true)
  }, [playerRef])

  const pause = useCallback(() => {
    playerRef.current?.pause()
    setIsPlaying(false)
  }, [playerRef])

  const goToStart = useCallback(() => seekToMs(0), [seekToMs])

  const goToEnd = useCallback(() => {
    seekToMs(script.totalDurationMs)
    playerRef.current?.pause()
  }, [script, seekToMs, playerRef])

  const goToNext = useCallback(() => {
    const nextStep = script.steps.find((step) => step.startMs > currentMsRef.current + 80)
    seekToMs(nextStep?.startMs ?? script.totalDurationMs)
  }, [script, seekToMs])

  const goToPrevious = useCallback(() => {
    const previousStep = [...script.steps]
      .reverse()
      .find((step) => step.startMs < currentMsRef.current - 500)
    seekToMs(previousStep?.startMs ?? 0)
  }, [script, seekToMs])

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => !prev)
  }, [])

  const handleSetPlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate)
    // Remotion Player uses .setPlaybackRate if available, otherwise we use the
    // internal play rate mechanism. The Remotion Player exposes playbackRate
    // control via the `playbackRate` prop, but since we're using a ref-based
    // approach, we need to pause/play to apply the new rate. However, the
    // simplest approach is to use the player's internal method if available.
    const player = playerRef.current as PlayerRef & { setPlaybackRate?: (r: number) => void } | null
    if (player && typeof player.setPlaybackRate === "function") {
      player.setPlaybackRate(rate)
    }
  }, [playerRef])

  const frameStep = useCallback((direction: 1 | -1) => {
    const frameDurationMs = 1000 / FPS
    const nextMs = currentMsRef.current + direction * frameDurationMs
    seekToMs(Math.max(0, Math.min(nextMs, script.totalDurationMs)))
    // Pause when frame-stepping
    playerRef.current?.pause()
    setIsPlaying(false)
  }, [seekToMs, script, playerRef])

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      switch (e.key) {
        case " ": {
          e.preventDefault()
          if (isPlaying) {
            pause()
          } else {
            play()
          }
          break
        }
        case "ArrowLeft": {
          e.preventDefault()
          if (e.shiftKey) {
            seekToMs(Math.max(0, currentMsRef.current - 5000))
          } else {
            goToPrevious()
          }
          break
        }
        case "ArrowRight": {
          e.preventDefault()
          if (e.shiftKey) {
            seekToMs(Math.min(script.totalDurationMs, currentMsRef.current + 5000))
          } else {
            goToNext()
          }
          break
        }
        case ",": {
          e.preventDefault()
          frameStep(-1)
          break
        }
        case ".": {
          e.preventDefault()
          frameStep(1)
          break
        }
        case "l":
        case "L": {
          e.preventDefault()
          toggleLoop()
          break
        }
        case "Home": {
          e.preventDefault()
          goToStart()
          break
        }
        case "End": {
          e.preventDefault()
          goToEnd()
          break
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [script, isPlaying, play, pause, seekToMs, goToNext, goToPrevious, goToStart, goToEnd, frameStep, toggleLoop])

  const activeSteps = useMemo(
    () => getActiveSteps(script.steps, currentMs, script.totalDurationMs),
    [script, currentMs],
  )

  const currentStepIndex = useMemo(
    () => getCurrentStepIndex(script.steps, currentMs),
    [script, currentMs],
  )

  return (
    <PresentationPlaybackConsole
      script={script}
      currentMs={currentMs}
      currentStepIndex={currentStepIndex}
      activeSteps={activeSteps}
      isPlaying={isPlaying}
      isLooping={isLooping}
      playbackRate={playbackRate}
      onSeek={seekToMs}
      onPlay={play}
      onPause={pause}
      onNext={goToNext}
      onPrevious={goToPrevious}
      onGoToStart={goToStart}
      onGoToEnd={goToEnd}
      onToggleLoop={toggleLoop}
      onSetPlaybackRate={handleSetPlaybackRate}
      onFrameStep={frameStep}
      onStepsChange={onStepsChange}
    />
  )
}

// ---------------------------------------------------------------------------
// FPS Monitor — real-time framerate graph overlay
// ---------------------------------------------------------------------------

function FpsMonitor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const samplesRef = useRef<number[]>([])
  const lastFrameRef = useRef(performance.now())
  const rafRef = useRef<number>(0)
  const [currentFps, setCurrentFps] = useState(0)

  useEffect(() => {
    const maxSamples = 120 // ~2 seconds of history at 60fps

    const tick = (now: number) => {
      const delta = now - lastFrameRef.current
      lastFrameRef.current = now
      if (delta > 0) {
        const fps = Math.min(120, 1000 / delta)
        const samples = samplesRef.current
        samples.push(fps)
        if (samples.length > maxSamples) samples.shift()

        // Update displayed FPS at ~4Hz to avoid jitter
        if (samples.length % 15 === 0) {
          const recent = samples.slice(-15)
          const avg = recent.reduce((a, b) => a + b, 0) / recent.length
          setCurrentFps(Math.round(avg))
        }

        // Draw chart
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext("2d")
          if (ctx) {
            const w = canvas.width
            const h = canvas.height
            ctx.clearRect(0, 0, w, h)

            // Background
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
            ctx.fillRect(0, 0, w, h)

            // Grid lines at 30 and 60 fps
            ctx.strokeStyle = "rgba(255,255,255,0.1)"
            ctx.lineWidth = 0.5
            ctx.setLineDash([2, 2])
            const y60 = h - (60 / 120) * h
            const y30 = h - (30 / 120) * h
            ctx.beginPath()
            ctx.moveTo(0, y60)
            ctx.lineTo(w, y60)
            ctx.moveTo(0, y30)
            ctx.lineTo(w, y30)
            ctx.stroke()
            ctx.setLineDash([])

            // FPS curve
            if (samples.length > 1) {
              ctx.beginPath()
              const stepX = w / (maxSamples - 1)
              for (let i = 0; i < samples.length; i++) {
                const x = i * stepX
                const y = h - (samples[i] / 120) * h
                if (i === 0) ctx.moveTo(x, y)
                else ctx.lineTo(x, y)
              }
              ctx.strokeStyle = currentFps >= 55 ? "#76B900" : currentFps >= 30 ? "#F59E0B" : "#EF4444"
              ctx.lineWidth = 1.5
              ctx.stroke()

              // Fill under curve
              ctx.lineTo((samples.length - 1) * stepX, h)
              ctx.lineTo(0, h)
              ctx.closePath()
              ctx.fillStyle = currentFps >= 55 ? "rgba(118,185,0,0.1)" : currentFps >= 30 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)"
              ctx.fill()
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [currentFps])

  const fpsColor = currentFps >= 55 ? "#76B900" : currentFps >= 30 ? "#F59E0B" : "#EF4444"

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 9999,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(8, 10, 22, 0.85)",
        backdropFilter: "blur(8px)",
        pointerEvents: "none",
      }}
    >
      <div style={{ padding: "4px 8px 2px", display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: fpsColor, fontVariantNumeric: "tabular-nums", fontFamily: "SFMono-Regular, Consolas, monospace" }}>
          {currentFps}
        </span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>FPS</span>
      </div>
      <canvas
        ref={canvasRef}
        width={160}
        height={40}
        style={{ display: "block", width: 160, height: 40 }}
      />
    </div>
  )
}

/** Memoized background — never re-renders during playback */
const MemoizedMockBackground = memo(MockBackground)
const MemoizedGradientBackground = memo(GradientBackground)

type AppView = "console" | "gallery"

export function App() {
  const [activeScript, setActiveScript] = useState<Script | null>(null)
  const [view, setView] = useState<AppView>("console")
  const playerRef = useRef<PlayerRef>(null)
  // Enable perf monitor via URL param: ?perf=1
  const perfMonitorEnabled = useMemo(() => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).has("perf")
  }, [])
  // Enable FPS monitor via URL param: ?fps=1
  const fpsMonitorEnabled = useMemo(() => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).has("fps")
  }, [])

  const handlePerfReport = useCallback((_metrics: PerfMetrics, formatted: string) => {
    console.log(formatted)
  }, [])

  const startScript = useCallback((script: Script) => {
    setActiveScript(script)
  }, [])

  const stopPresentation = useCallback(() => {
    playerRef.current?.pause()
    setActiveScript(null)
  }, [])

  const handleStepsChange = useCallback((newSteps: PresentationStep[], totalMs: number) => {
    setActiveScript(prev => prev ? { ...prev, steps: newSteps, totalDurationMs: totalMs } : null)
    // Seek player to start and play after React re-renders with new steps/duration
    setTimeout(() => {
      playerRef.current?.seekTo(0)
      playerRef.current?.play()
    }, 100)
  }, [])

  const handleGalleryDemo = useCallback((steps: PresentationStep[], totalDurationMs: number) => {
    const script: Script = {
      id: `gallery-demo-${Date.now()}`,
      title: `Demo: ${steps[0]?.command.type ?? "unknown"}`,
      description: "Gallery demo",
      icon: "🎬",
      steps,
      totalDurationMs,
      useBackground: false,
    }
    setActiveScript(script)
  }, [])

  const openGallery = useCallback(() => setView("gallery"), [])
  const openConsole = useCallback(() => setView("console"), [])

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#0a0a0f",
        fontFamily: "'PingFang SC', 'SF Pro Display', -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {activeScript ? (
        <TargetRectsProvider>
          {/* Background layer — memoized, never re-renders */}
          {activeScript.useBackground ? <MemoizedMockBackground /> : <MemoizedGradientBackground />}

          {/* Overlay layer (transparent, on top) — stable props, no parent re-render */}
          <PresentationPlayer
            ref={playerRef}
            steps={activeScript.steps}
            fps={FPS}
            totalDurationMs={activeScript.totalDurationMs}
            controls={false}
            autoPlay
            enablePerfMonitor={perfMonitorEnabled}
            onPerfReport={handlePerfReport}
          />

          {/* Console layer — isolated rendering, manages own time state */}
          <IsolatedPlaybackConsole script={activeScript} playerRef={playerRef} onStepsChange={handleStepsChange} />

          {/* FPS monitor overlay */}
          {fpsMonitorEnabled && <FpsMonitor />}

          {/* Back button */}
          <button
            onClick={stopPresentation}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 20,
              background: "rgba(0, 0, 0, 0.7)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 14 }}>&#x2715;</span>
            Exit
          </button>
        </TargetRectsProvider>
      ) : view === "gallery" ? (
        <StepGallery onPlayDemo={handleGalleryDemo} onBack={openConsole} />
      ) : (
        <Console scripts={SCRIPTS} onSelect={startScript} onOpenGallery={openGallery} />
      )}
    </div>
  )
}

// ============================================================================
// Console — script selector
// ============================================================================

function Console({ scripts, onSelect, onOpenGallery }: { scripts: Script[]; onSelect: (s: Script) => void; onOpenGallery: () => void }) {
  const totalSteps = scripts.reduce((acc, s) => acc + s.steps.length, 0)
  const actionTypes = new Set(scripts.flatMap(s => s.steps.map(st => st.command.type)))

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(160deg, #0f0c29 0%, #1a1545 50%, #24243e 100%)",
        overflow: "auto",
      }}
    >
      <div style={{ position: "absolute", top: -200, right: -150, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.08), transparent 70%)", pointerEvents: "none" }} />

      {/* Hero */}
      <div style={{ padding: "60px 40px 40px", textAlign: "center", position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "4px 12px", borderRadius: 20, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366F1" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#818CF8", letterSpacing: 0.5 }}>REMOTION-POWERED</span>
        </div>

        <h1 style={{ fontSize: 36, fontWeight: 800, color: "#fff", margin: "0 0 12px", letterSpacing: -0.5 }}>
          @viben/presentation
        </h1>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", margin: "0 auto", maxWidth: 560, lineHeight: 1.7 }}>
          Remotion 驱动的时间线演示覆盖层系统。{actionTypes.size} 种动作类型，spring 物理动画，支持视频导出。
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 28 }}>
          <StatBadge value={`${actionTypes.size}`} label="动作类型" />
          <StatBadge value={`${totalSteps}`} label="总步骤" />
          <StatBadge value="Remotion" label="渲染引擎" />
        </div>
      </div>

      {/* Feature pills */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "0 40px 32px", flexWrap: "wrap" }}>
        {["Remotion Player", "Spring Physics", "Video Export", "Transparent Overlay", "Target Resolution", "33 Action Types"].map(f => (
          <span key={f} style={{ padding: "5px 12px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
            {f}
          </span>
        ))}
      </div>

      {/* Scripts grid */}
      <div style={{ padding: "0 40px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingLeft: 4, paddingRight: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1 }}>
            Demo Scripts
          </div>
          <button
            onClick={onOpenGallery}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 18px",
              borderRadius: 10,
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.3)",
              color: "#818CF8",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(99,102,241,0.2)"
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"
              e.currentTarget.style.transform = "translateY(-1px)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(99,102,241,0.12)"
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)"
              e.currentTarget.style.transform = "none"
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Step Gallery
            <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "rgba(99,102,241,0.2)", color: "#A5B4FC" }}>
              {actionTypes.size}
            </span>
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {scripts.map((script) => (
            <ScriptCard key={script.id} script={script} onClick={() => onSelect(script)} />
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 40px 24px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
          Built with React + Remotion + TypeScript
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
          github.com/LinXueyuanStdio/viben
        </span>
      </div>
    </div>
  )
}

function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{label}</div>
    </div>
  )
}

function ScriptCard({ script, onClick }: { script: Script; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const durationSec = Math.ceil(script.totalDurationMs / 1000)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "20px 24px",
        borderRadius: 14,
        background: hovered ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
        border: hovered ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.07)",
        cursor: "pointer",
        transition: "all 200ms ease",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 32px rgba(99,102,241,0.12)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>{script.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
            {script.title}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
            {script.description}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 12, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
        <span>◉ {script.steps.length} steps</span>
        <span>⏱ {durationSec}s</span>
        <span>◈ {new Set(script.steps.map(s => s.command.type)).size} types</span>
      </div>
    </div>
  )
}
