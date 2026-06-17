import React, { useState, useRef, useCallback, useEffect, useMemo, memo } from "react"
import {
  PresentationPlayer,
  TargetRectsProvider,
  describeCommand,
  computeTotalMs,
  IsolatedPlaybackConsole,
} from "@viben/presentation"
import type { PerfMetrics } from "@viben/presentation"
import type { PresentationStep, PlayerRef, JsonInspectorRenderProps, BashEditorRenderProps } from "@viben/presentation"
import {
  createJSONEditor,
  createValueSelection,
  Mode,
} from "vanilla-jsoneditor"
import type { JsonEditor } from "vanilla-jsoneditor"
import "vanilla-jsoneditor/themes/jse-theme-dark.css"
import { MockBackground } from "./components/MockBackground"
import { StepGallery } from "./components/StepGallery"
import { demoSteps, TOTAL_DURATION_MS } from "./data/demo-steps"
import { BashEditor } from "./features/bash/BashEditor"
import { createPresentationBash, joinMultilineQuotes, fixJsonQuoting } from "./features/bash/bash-integration"
import { stepsToBashScript } from "./features/bash/steps-to-bash"

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

  const handleEditorRun = useCallback(async (text: string): Promise<{ steps: PresentationStep[]; totalMs: number; errors: Map<number, string> } | null> => {
    const processed = fixJsonQuoting(joinMultilineQuotes(text))
    const lines = processed.split("\n")
    const collectedSteps: PresentationStep[] = []
    let cursorMs = 0
    const errors = new Map<number, string>()

    const bash = createPresentationBash({
      onStep: (step) => { collectedSteps.push(step) },
      getCursorMs: () => cursorMs,
      setCursorMs: (ms) => { cursorMs = ms },
    })

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.startsWith("#")) continue
      try {
        const result = await bash.exec(line)
        if (result.exitCode !== 0 && result.stderr) {
          errors.set(i + 1, result.stderr.trim())
        }
      } catch (err: unknown) {
        errors.set(i + 1, err instanceof Error ? err.message : String(err))
      }
    }

    const totalMs = collectedSteps.length > 0
      ? Math.max(...collectedSteps.map(s => s.endMs ?? s.startMs + 3000))
      : 0

    return { steps: collectedSteps, totalMs, errors }
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
          <IsolatedPlaybackConsole
            script={activeScript}
            playerRef={playerRef}
            onStepsChange={handleStepsChange}
            renderJsonInspector={(props: JsonInspectorRenderProps) => (
              <JsonInspector
                value={props.value}
                height={props.height}
                initialMode={props.initialMode}
                focusPath={props.focusPath}
                compact={props.compact}
                fillHeight={props.fillHeight}
              />
            )}
            renderBashEditor={(props: BashEditorRenderProps) => (
              <BashEditor
                value={props.value}
                onChange={props.onChange}
                activeLines={props.activeLines}
                errorLines={props.errorLines}
                onLineClick={props.onLineClick}
                steps={props.steps}
                onRun={props.onRun}
                style={props.style}
              />
            )}
            stepsToScript={stepsToBashScript}
            onEditorRun={handleEditorRun}
          />

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
