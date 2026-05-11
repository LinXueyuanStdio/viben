import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import {
  PresentationOverlay,
  TargetRectsProvider,
  useTargetRects,
  describeCommand,
} from "@viben/presentation"
import type { PlayerState, PresentationStep } from "@viben/presentation"
import { demoSteps, TOTAL_DURATION_MS } from "./demo-steps"
import { MockBackground } from "./MockBackground"

// ============================================================================
// 内置短剧本 (timeline format) — 必须在 SCRIPTS 之前定义
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

function makeSpotlightSteps(): PresentationStep[] {
  return [
    s(0, { type: "spotlight", region: { targetId: "title", padding: 12 }, maskOpacity: 0.75, borderRadius: 12, animate: true }, 3000),
    s(3000, { type: "spotlight", region: { targetId: "card-nvidia", padding: 8 }, maskOpacity: 0.75, borderRadius: 10, animate: true }, 5500),
    s(5500, { type: "spotlight", region: { targetId: "card-amd", padding: 8 }, maskOpacity: 0.7, borderRadius: 10, animate: true }, 8000),
    s(8000, { type: "spotlight", region: { targetId: "card-others", padding: 8 }, maskOpacity: 0.7, borderRadius: 10, animate: true }, 10500),
    s(10500, { type: "spotlight", region: { targetId: "revenue-chart", padding: 10 }, maskOpacity: 0.6, borderRadius: 10, animate: true }, 12000),
    s(12000, { type: "clear" }),
  ]
}

function makeCardSteps(): PresentationStep[] {
  return [
    s(0, { type: "card", position: { targetId: "card-nvidia", placement: "right-of-start", offsetX: 10 }, width: 280, title: "从右侧滑入", content: "毛玻璃效果 + 柔和阴影", tag: "Right", tagColor: "#6366F1", enterFrom: "right", animate: true }, 5000),
    s(1500, { type: "card", position: { targetId: "card-amd", placement: "below-start" }, width: 280, title: "从下方滑入", content: "每个方向都有弹性动画", tag: "Bottom", tagColor: "#F59E0B", enterFrom: "bottom", animate: true }, 6000),
    s(3000, { type: "card", position: { targetId: "card-others", placement: "below-start" }, width: 280, title: "再从下方滑入", content: "适合展示补充信息", tag: "Below", tagColor: "#10B981", enterFrom: "bottom", animate: true }, 7000),
    s(5000, { type: "card", position: { targetId: "analysis", placement: "right-of-start", offsetX: 10 }, width: 280, title: "从右侧滑入", content: "组合创建丰富视觉叙事", tag: "RightOf", tagColor: "#EF4444", enterFrom: "right", animate: true }, 9000),
    s(7000, { type: "text", position: { targetId: "title", placement: "below-start" }, content: "纯 CSS @keyframes，零依赖！", fontSize: 15, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg, #6366F1, #8B5CF6)", animate: true }, 10000),
    s(10000, { type: "clear" }),
  ]
}

function makeNewActionsSteps(): PresentationStep[] {
  return [
    s(0, { type: "pulse", center: { targetId: "nvidia-value", anchor: "center" }, radius: 24, color: "#76B900", rings: 3, animate: true }, 3000),
    s(1000, { type: "badge", position: { targetId: "title", placement: "above-end" }, text: "HOT", color: "#fff", background: "#EF4444", size: "md", animate: true }, 5000),
    s(3000, { type: "underline", from: { targetId: "bar-nvidia", anchor: "bottom-left" }, to: { targetId: "bar-nvidia", anchor: "bottom-right" }, color: "#F59E0B", strokeWidth: 3, style: "wavy", animate: true }, 7000),
    s(5000, { type: "progress", position: { targetId: "card-nvidia", placement: "below-start" }, width: 280, value: 80, color: "#76B900", showLabel: true, label: "NVIDIA 80%", animate: true }, 9000),
    s(7000, { type: "counter", position: { targetId: "card-amd", placement: "below-start" }, value: 26, prefix: "$", suffix: "B", color: "#76B900", fontSize: 48, animate: true }, 11000),
    s(9000, { type: "bracket", from: { targetId: "bar-intel", anchor: "right" }, to: { targetId: "bar-huawei", anchor: "right" }, direction: "right", color: "#6366F1", strokeWidth: 2, label: "Others", animate: true }, 13000),
    s(11000, { type: "chart", position: { targetId: "analysis", placement: "below-start" }, width: 320, height: 150, chartType: "bar", title: "季度收入对比", data: [{ name: "NVIDIA", value: 26 }, { name: "AMD", value: 3.5 }, { name: "Intel", value: 1.1 }], colors: ["#76B900", "#ED1C24", "#0071C5"], animate: true }, 15000),
    s(13000, { type: "typewriter", position: { targetId: "card-nvidia", placement: "below-start" }, content: "以上就是所有动作类型！", fontSize: 16, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #6366F1, #EC4899)", speed: "normal", animate: true }, 17000),
    s(17000, { type: "clear" }),
  ]
}

// ============================================================================
// 剧本定义
// ============================================================================

interface Script {
  id: string
  title: string
  description: string
  icon: string
  steps: PresentationStep[]
  background: React.ComponentType
  /** Total duration in ms (timeline endpoint) */
  totalDurationMs: number
}

const SCRIPTS: Script[] = [
  {
    id: "ai-chip",
    title: "AI 芯片市场深度分析",
    description: "小Lin说风格：时间线多轨并行，60s 深度演示",
    icon: "📊",
    steps: demoSteps,
    background: MockBackground,
    totalDurationMs: TOTAL_DURATION_MS,
  },
  {
    id: "spotlight-demo",
    title: "聚光灯演示",
    description: "Spotlight 遮罩效果：暗色蒙层 + 高亮聚焦区域",
    icon: "🔦",
    steps: makeSpotlightSteps(),
    background: MockBackground,
    totalDurationMs: computeTotalMs(makeSpotlightSteps()),
  },
  {
    id: "card-gallery",
    title: "卡片画廊",
    description: "信息卡片从四个方向滑入，展示毛玻璃样式和动画效果",
    icon: "🃏",
    steps: makeCardSteps(),
    background: MockBackground,
    totalDurationMs: computeTotalMs(makeCardSteps()),
  },
  {
    id: "new-actions",
    title: "新动作展示",
    description: "Pulse、Underline、Badge、Progress、Counter、Bracket 六种新动作",
    icon: "✨",
    steps: makeNewActionsSteps(),
    background: MockBackground,
    totalDurationMs: computeTotalMs(makeNewActionsSteps()),
  },
]

// ============================================================================
// 工具函数
// ============================================================================

/** Extract sorted unique cues (time points) from steps */
function getCues(steps: PresentationStep[]): number[] {
  const set = new Set(steps.map((s) => s.startMs))
  return [...set].sort((a, b) => a - b)
}

/** Auto-compute total duration from steps */
function computeTotalMs(steps: PresentationStep[]): number {
  if (steps.length === 0) return 0
  return Math.max(...steps.map((s) => Math.max(s.startMs, s.endMs ?? s.startMs))) + 2000
}

// ============================================================================
// App
// ============================================================================

export function App() {
  const [activeScript, setActiveScript] = useState<Script | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [playerState, setPlayerState] = useState<PlayerState>("idle")
  const [showDebugRects, setShowDebugRects] = useState(true) // DEBUG: show rect overlay

  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedAtRef = useRef<number>(0)

  // Cues: sorted unique startMs values
  const cues = useMemo(() => (activeScript ? getCues(activeScript.steps) : []), [activeScript])

  // Current cue index (derived from elapsedMs)
  const currentCueIndex = useMemo(() => {
    if (cues.length === 0) return 0
    let idx = 0
    for (let i = 0; i < cues.length; i++) {
      if (cues[i] <= elapsedMs) idx = i
      else break
    }
    return idx
  }, [cues, elapsedMs])

  // requestAnimationFrame-based timeline player
  useEffect(() => {
    if (playerState !== "playing" || !activeScript) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      return
    }

    const totalDuration = activeScript.totalDurationMs
    startTimeRef.current = performance.now() - pausedAtRef.current

    const tick = () => {
      const now = performance.now()
      const elapsed = now - startTimeRef.current
      if (elapsed >= totalDuration) {
        setElapsedMs(totalDuration)
        setPlayerState("paused")
        return
      }
      setElapsedMs(elapsed)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playerState, activeScript])

  // --- Controls ---
  const handlePlay = useCallback(() => setPlayerState("playing"), [])
  const handlePause = useCallback(() => {
    pausedAtRef.current = elapsedMs
    setPlayerState("paused")
  }, [elapsedMs])

  const handleNext = useCallback(() => {
    const nextIdx = Math.min(currentCueIndex + 1, cues.length - 1)
    const nextMs = cues[nextIdx]
    setElapsedMs(nextMs)
    pausedAtRef.current = nextMs
    setPlayerState("paused")
  }, [currentCueIndex, cues])

  const handlePrev = useCallback(() => {
    const prevIdx = Math.max(currentCueIndex - 1, 0)
    const prevMs = cues[prevIdx]
    setElapsedMs(prevMs)
    pausedAtRef.current = prevMs
    setPlayerState("paused")
  }, [currentCueIndex, cues])

  const handleGoToStart = useCallback(() => {
    setElapsedMs(0)
    pausedAtRef.current = 0
    setPlayerState("paused")
  }, [])

  const handleGoToEnd = useCallback(() => {
    if (!activeScript) return
    const end = activeScript.totalDurationMs
    setElapsedMs(end)
    pausedAtRef.current = end
    setPlayerState("paused")
  }, [activeScript])

  const handleSeek = useCallback((ms: number) => {
    setElapsedMs(ms)
    pausedAtRef.current = ms
    setPlayerState("paused")
  }, [])

  const startScript = useCallback((script: Script) => {
    setActiveScript(script)
    setElapsedMs(0)
    pausedAtRef.current = 0
    setPlayerState("playing")
  }, [])

  const stopPresentation = useCallback(() => {
    setActiveScript(null)
    setElapsedMs(0)
    pausedAtRef.current = 0
    setPlayerState("idle")
  }, [])

  const Background = activeScript?.background

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
      <TargetRectsProvider>
        {activeScript && Background ? (
          <Background />
        ) : (
          <Console scripts={SCRIPTS} onSelect={startScript} />
        )}

        {/* DEBUG: Rect visualization overlay */}
        {activeScript && showDebugRects && <DebugRectsOverlay />}

        {activeScript && (
          <PresentationOverlay
            active={true}
            steps={activeScript.steps}
            elapsedMs={elapsedMs}
            zIndex={100}
            onStop={stopPresentation}
          >
            <MultiTrackTimeline
              steps={activeScript.steps}
              elapsedMs={elapsedMs}
              totalMs={activeScript.totalDurationMs}
              onSeek={handleSeek}
            />
            <TimelineControls
              elapsedMs={elapsedMs}
              totalMs={activeScript.totalDurationMs}
              cueIndex={currentCueIndex}
              cueCount={cues.length}
              playerState={playerState}
              onPlay={handlePlay}
              onPause={handlePause}
              onNext={handleNext}
              onPrev={handlePrev}
              onGoToStart={handleGoToStart}
              onGoToEnd={handleGoToEnd}
              onSeek={handleSeek}
              showDebug={showDebugRects}
              onToggleDebug={() => setShowDebugRects((s) => !s)}
            />
          </PresentationOverlay>
        )}
      </TargetRectsProvider>
    </div>
  )
}

// ============================================================================
// DebugRectsOverlay — 可视化所有测量到的 data-presentation-id 元素 rect
// ============================================================================

function DebugRectsOverlay() {
  const rects = useTargetRects()

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, pointerEvents: "none" }}>
      {[...rects.entries()].map(([id, rect]) => (
        <div
          key={id}
          style={{
            position: "absolute",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            border: "2px dashed rgba(255, 0, 0, 0.6)",
            borderRadius: 4,
            background: "rgba(255, 0, 0, 0.05)",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: -16,
              left: 0,
              fontSize: 10,
              color: "#ff4444",
              background: "rgba(0,0,0,0.8)",
              padding: "1px 4px",
              borderRadius: 2,
              whiteSpace: "nowrap",
              fontFamily: "monospace",
            }}
          >
            {id} ({rect.width.toFixed(0)}x{rect.height.toFixed(0)})
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Console — 剧本选择控制台
// ============================================================================

function Console({ scripts, onSelect }: { scripts: Script[]; onSelect: (s: Script) => void }) {
  const totalSteps = scripts.reduce((acc, s) => acc + s.steps.length, 0)
  const totalDuration = scripts.reduce((acc, s) => acc + s.totalDurationMs, 0)
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
      {/* Decorative background elements */}
      <div style={{ position: "absolute", top: -200, right: -150, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.08), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -100, left: -80, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(118,185,0,0.06), transparent 70%)", pointerEvents: "none" }} />

      {/* Hero section */}
      <div style={{ padding: "60px 40px 40px", textAlign: "center", position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "4px 12px", borderRadius: 20, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366F1", animation: "presentationPulseSmall 2s infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#818CF8", letterSpacing: 0.5 }}>PRESENTATION ENGINE</span>
        </div>

        <h1 style={{ fontSize: 36, fontWeight: 800, color: "#fff", margin: "0 0 12px", letterSpacing: -0.5 }}>
          @viben/presentation
        </h1>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", margin: "0 auto", maxWidth: 560, lineHeight: 1.7 }}>
          时间线驱动的演示覆盖层系统。多轨并行动画，纯 CSS 零依赖，
          支持 {actionTypes.size} 种动作类型。
        </p>

        {/* Stats row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 28 }}>
          <StatBadge value={`${actionTypes.size}`} label="动作类型" />
          <StatBadge value={`${totalSteps}`} label="总步骤" />
          <StatBadge value={`${Math.ceil(totalDuration / 1000)}s`} label="总时长" />
          <StatBadge value="0" label="运行时依赖" />
        </div>
      </div>

      {/* Feature pills */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "0 40px 32px", flexWrap: "wrap" }}>
        {["Timeline Mode", "Multi-Track", "Collision Detection", "CSS Animations", "Target Resolution", "React 18/19"].map(f => (
          <span key={f} style={{ padding: "5px 12px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
            {f}
          </span>
        ))}
      </div>

      {/* Scripts grid */}
      <div style={{ padding: "0 40px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, paddingLeft: 4 }}>
          Demo Scripts
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {scripts.map((script) => (
            <ScriptCard key={script.id} script={script} onClick={() => onSelect(script)} />
          ))}
        </div>
      </div>

      {/* Action type showcase */}
      <div style={{ padding: "24px 40px 40px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, paddingLeft: 4 }}>
          Supported Actions
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(TRACK_COLORS).filter(([k]) => k !== "clear" && k !== "wait").map(([type, color]) => (
            <span key={type} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: `${color}15`, border: `1px solid ${color}33` }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{type}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "16px 40px 24px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
          Built with React + TypeScript + Pure CSS Keyframes
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
          github.com/LinXueyuanStdio/viben
        </span>
      </div>

      <style>{`
        @keyframes presentationPulseSmall {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
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
  const cueCount = getCues(script.steps).length
  const durationSec = Math.ceil(script.totalDurationMs / 1000)
  const actionTypeCount = new Set(script.steps.map(s => s.command.type)).size

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
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Hover glow */}
      {hovered && <div style={{ position: "absolute", top: -30, right: -30, width: 80, height: 80, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)", pointerEvents: "none" }} />}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{script.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
            {script.title}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
            {script.description}
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center" }}>
        <MetaChip icon="◉" value={`${script.steps.length} 步`} />
        <MetaChip icon="⏱" value={durationSec >= 60 ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : `${durationSec}s`} />
        <MetaChip icon="◈" value={`${actionTypeCount} 类型`} />
        <MetaChip icon="⚡" value={`${cueCount} cues`} />
      </div>

      {/* Play hint on hover */}
      {hovered && (
        <div style={{ position: "absolute", top: 20, right: 20, width: 28, height: 28, borderRadius: "50%", background: "rgba(99,102,241,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 12, color: "#fff", marginLeft: 2 }}>▶</span>
        </div>
      )}
    </div>
  )
}

function MetaChip({ icon, value }: { icon: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
      <span style={{ fontSize: 8 }}>{icon}</span>
      {value}
    </span>
  )
}

// ============================================================================
// TimelineControls — 完整控件：播放/暂停/前进/后退/最前/最后/进度条/debug
// ============================================================================

function TimelineControls({
  elapsedMs,
  totalMs,
  cueIndex,
  cueCount,
  playerState,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onGoToStart,
  onGoToEnd,
  onSeek,
  showDebug,
  onToggleDebug,
}: {
  elapsedMs: number
  totalMs: number
  cueIndex: number
  cueCount: number
  playerState: PlayerState
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrev: () => void
  onGoToStart: () => void
  onGoToEnd: () => void
  onSeek: (ms: number) => void
  showDebug: boolean
  onToggleDebug: () => void
}) {
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const progress = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 0
  const btnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: 14,
    cursor: "pointer",
    padding: "4px 6px",
    opacity: 0.8,
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        borderRadius: 24,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        minWidth: 480,
      }}
    >
      {/* Go to start */}
      <button onClick={onGoToStart} style={btnStyle} title="Go to start">⏮</button>
      {/* Prev */}
      <button onClick={onPrev} style={btnStyle} title="Previous cue">⏪</button>
      {/* Play/Pause */}
      <button onClick={playerState === "playing" ? onPause : onPlay} style={{ ...btnStyle, fontSize: 18 }}>
        {playerState === "playing" ? "⏸" : "▶️"}
      </button>
      {/* Next */}
      <button onClick={onNext} style={btnStyle} title="Next cue">⏩</button>
      {/* Go to end */}
      <button onClick={onGoToEnd} style={btnStyle} title="Go to end">⏭</button>

      {/* Time */}
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "monospace", minWidth: 36 }}>
        {formatTime(elapsedMs)}
      </span>

      {/* Progress bar */}
      <div
        style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, cursor: "pointer", position: "relative" }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const ratio = (e.clientX - rect.left) / rect.width
          onSeek(Math.round(ratio * totalMs))
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${progress}%`, background: "#6366F1", borderRadius: 2 }} />
      </div>

      {/* Total time */}
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "monospace", minWidth: 36 }}>
        {formatTime(totalMs)}
      </span>

      {/* Cue counter */}
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>
        {cueIndex + 1}/{cueCount}
      </span>

      {/* Debug toggle */}
      <button
        onClick={onToggleDebug}
        style={{ ...btnStyle, fontSize: 11, opacity: showDebug ? 1 : 0.4, color: showDebug ? "#ff4444" : "#fff" }}
        title="Toggle debug rects"
      >
        DBG
      </button>
    </div>
  )
}

// ============================================================================
// MultiTrackTimeline — 多轨时间线可视化编排面板
// ============================================================================

/** Color for each command type */
const TRACK_COLORS: Record<string, string> = {
  spotlight: "#F59E0B",
  arrow: "#10B981",
  text: "#6366F1",
  circle: "#EF4444",
  highlight: "#8B5CF6",
  card: "#3B82F6",
  pulse: "#EC4899",
  underline: "#F97316",
  badge: "#14B8A6",
  progress: "#06B6D4",
  counter: "#84CC16",
  bracket: "#A855F7",
  trendline: "#F43F5E",
  comparison: "#0EA5E9",
  typewriter: "#D946EF",
  clear: "#6B7280",
  wait: "#374151",
}

function MultiTrackTimeline({
  steps,
  elapsedMs,
  totalMs,
  onSeek,
}: {
  steps: PresentationStep[]
  elapsedMs: number
  totalMs: number
  onSeek: (ms: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // Assign each step to a "track" (row) — simple greedy lane assignment
  const tracks = useMemo(() => {
    const sorted = [...steps].filter(s => s.command.type !== "clear" && s.command.type !== "wait")
      .sort((a, b) => a.startMs - b.startMs)

    const lanes: Array<{ endMs: number }> = []
    const assignments: Array<{ step: PresentationStep; lane: number }> = []

    for (const step of sorted) {
      const end = step.endMs ?? step.startMs + 2000
      // Find first lane whose last item ended before this step starts
      let assigned = false
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i].endMs <= step.startMs) {
          lanes[i].endMs = end
          assignments.push({ step, lane: i })
          assigned = true
          break
        }
      }
      if (!assigned) {
        lanes.push({ endMs: end })
        assignments.push({ step, lane: lanes.length - 1 })
      }
    }

    return { assignments, laneCount: lanes.length }
  }, [steps])

  // Also collect "clear" markers
  const clearMarkers = useMemo(
    () => steps.filter(s => s.command.type === "clear").map(s => s.startMs),
    [steps],
  )

  const TRACK_HEIGHT = 18
  const LANE_GAP = 2
  const MAX_PANEL_HEIGHT = 160
  const naturalHeight = Math.max(80, tracks.laneCount * (TRACK_HEIGHT + LANE_GAP) + 48)
  const panelHeight = expanded
    ? Math.min(naturalHeight, MAX_PANEL_HEIGHT)
    : 28

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    onSeek(Math.round(ratio * totalMs))
  }

  const playheadPct = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 0

  return (
    <div
      style={{
        position: "absolute",
        bottom: 72,
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "auto",
        width: "min(90vw, 800px)",
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        overflow: "hidden",
        transition: "height 200ms ease",
        height: panelHeight,
      }}
    >
      {/* Header bar — click to toggle */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          padding: "4px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          borderBottom: expanded ? "1px solid rgba(255,255,255,0.08)" : "none",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: 0.5 }}>
          MULTI-TRACK TIMELINE ({tracks.laneCount} tracks · {steps.length} steps)
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          {expanded ? "▼" : "▲"}
        </span>
      </div>

      {/* Track area */}
      {expanded && (
        <div
          ref={containerRef}
          onClick={handleClick}
          style={{
            position: "relative",
            padding: "8px 12px",
            cursor: "crosshair",
            height: tracks.laneCount * (TRACK_HEIGHT + LANE_GAP) + 16,
            overflowY: "auto",
          }}
        >
          {/* Time grid lines */}
          {Array.from({ length: Math.ceil(totalMs / 5000) + 1 }, (_, i) => {
            const t = i * 5000
            const pct = (t / totalMs) * 100
            return (
              <div key={`grid-${i}`} style={{ position: "absolute", left: `${pct}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.06)" }}>
                <span style={{ position: "absolute", top: -2, left: 2, fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>
                  {Math.floor(t / 1000)}s
                </span>
              </div>
            )
          })}

          {/* Clear markers */}
          {clearMarkers.map((ms, i) => (
            <div
              key={`clear-${i}`}
              style={{
                position: "absolute",
                left: `${(ms / totalMs) * 100}%`,
                top: 8,
                bottom: 8,
                width: 2,
                background: "rgba(239, 68, 68, 0.5)",
                borderRadius: 1,
              }}
            >
              <span style={{ position: "absolute", bottom: -12, left: -8, fontSize: 7, color: "#EF4444", whiteSpace: "nowrap" }}>CLR</span>
            </div>
          ))}

          {/* Step bars */}
          {tracks.assignments.map(({ step, lane }) => {
            const startPct = (step.startMs / totalMs) * 100
            const endMs = step.endMs ?? step.startMs + 2000
            const widthPct = ((endMs - step.startMs) / totalMs) * 100
            const color = TRACK_COLORS[step.command.type] ?? "#888"
            const isActive = elapsedMs >= step.startMs && (step.endMs == null || elapsedMs < step.endMs)

            return (
              <div
                key={step.id}
                title={`${step.command.type}: ${step.description || step.id}\n${step.startMs}ms → ${endMs}ms`}
                style={{
                  position: "absolute",
                  left: `${startPct}%`,
                  width: `${Math.max(widthPct, 0.5)}%`,
                  top: 8 + lane * (TRACK_HEIGHT + LANE_GAP),
                  height: TRACK_HEIGHT,
                  background: isActive ? color : `${color}88`,
                  borderRadius: 3,
                  border: isActive ? `1px solid ${color}` : "1px solid transparent",
                  boxShadow: isActive ? `0 0 6px ${color}66` : "none",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 4px",
                  overflow: "hidden",
                  transition: "opacity 100ms",
                }}
              >
                <span style={{ fontSize: 8, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>
                  {step.command.type}
                </span>
              </div>
            )
          })}

          {/* Playhead */}
          <div
            style={{
              position: "absolute",
              left: `${playheadPct}%`,
              top: 0,
              bottom: 0,
              width: 2,
              background: "#fff",
              borderRadius: 1,
              boxShadow: "0 0 4px rgba(255,255,255,0.5)",
              pointerEvents: "none",
              transition: "left 16ms linear",
            }}
          />
        </div>
      )}
    </div>
  )
}

