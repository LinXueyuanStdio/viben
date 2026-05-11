import { useState, useCallback, useEffect, useRef } from "react"
import {
  PresentationOverlay,
  OverlayControls,
  describeCommand,
} from "@viben/presentation"
import type { PresentationStep, PresentationCommand, PlayerState } from "@viben/presentation"
import { DEMO_STEPS as demoSteps } from "./demo-steps"
import { MockBackground } from "./MockBackground"

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
  intervalMs: number
}

const SCRIPTS: Script[] = [
  {
    id: "ai-chip",
    title: "AI 芯片市场深度分析",
    description: "小Lin说风格：15步讲透 NVIDIA、AMD 与 TPU 的三国演义",
    icon: "📊",
    steps: demoSteps,
    background: MockBackground,
    intervalMs: 2500,
  },
  {
    id: "spotlight-demo",
    title: "聚光灯演示",
    description: "展示 Spotlight 遮罩效果：暗色蒙层 + 高亮聚焦区域",
    icon: "🔦",
    steps: makeSpotlightSteps(),
    background: MockBackground,
    intervalMs: 2000,
  },
  {
    id: "card-gallery",
    title: "卡片画廊",
    description: "信息卡片从四个方向滑入，展示毛玻璃样式和动画效果",
    icon: "🃏",
    steps: makeCardSteps(),
    background: MockBackground,
    intervalMs: 1800,
  },
  {
    id: "new-actions",
    title: "新动作展示",
    description: "Pulse、Underline、Badge、Progress、Counter、Bracket 六种新动作",
    icon: "✨",
    steps: makeNewActionsSteps(),
    background: MockBackground,
    intervalMs: 2200,
  },
]

// ============================================================================
// App
// ============================================================================

export function App() {
  const [activeScript, setActiveScript] = useState<Script | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [playerState, setPlayerState] = useState<PlayerState>("idle")
  const [detailsOpen, setDetailsOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-advance timer
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (playerState !== "playing" || !activeScript) return

    timerRef.current = setInterval(() => {
      setCurrentStep((s) => {
        if (s >= activeScript.steps.length - 1) {
          setPlayerState("paused")
          return s
        }
        return s + 1
      })
    }, activeScript.intervalMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [playerState, activeScript])

  const handleNext = useCallback(() => {
    if (!activeScript) return
    setCurrentStep((s) => Math.min(s + 1, activeScript.steps.length - 1))
  }, [activeScript])

  const handlePrev = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0))
  }, [])

  const handleGoTo = useCallback((index: number) => {
    setCurrentStep(index)
    setPlayerState("paused")
  }, [])

  const startScript = useCallback((script: Script) => {
    setActiveScript(script)
    setCurrentStep(0)
    setPlayerState("playing")
  }, [])

  const stopPresentation = useCallback(() => {
    setActiveScript(null)
    setCurrentStep(0)
    setPlayerState("idle")
    setDetailsOpen(false)
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
      {/* 演示中：显示剧本背景。控制台：显示剧本选择器 */}
      {activeScript && Background ? (
        <Background />
      ) : (
        <Console scripts={SCRIPTS} onSelect={startScript} />
      )}

      {/* 遮罩演示层 */}
      {activeScript && (
        <PresentationOverlay
          active={true}
          steps={activeScript.steps}
          currentStep={currentStep}
          zIndex={100}
          onStop={stopPresentation}
        >
          <OverlayControls
            steps={activeScript.steps}
            currentStep={currentStep}
            playerState={playerState}
            detailsOpen={detailsOpen}
            onPlay={() => setPlayerState("playing")}
            onPause={() => setPlayerState("paused")}
            onNext={handleNext}
            onPrev={handlePrev}
            onGoTo={handleGoTo}
            onGoToStart={() => handleGoTo(0)}
            onGoToEnd={() => handleGoTo((activeScript.steps.length) - 1)}
            onToggleDetails={() => setDetailsOpen((s) => !s)}
          />
        </PresentationOverlay>
      )}
    </div>
  )
}

// ============================================================================
// Console — 剧本选择控制台
// ============================================================================

function Console({ scripts, onSelect }: { scripts: Script[]; onSelect: (s: Script) => void }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #0f0c29 0%, #1a1545 50%, #24243e 100%)",
        padding: 40,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "#fff", margin: 0 }}>
          @viben/presentation
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", margin: "12px 0 0", maxWidth: 500, lineHeight: 1.6 }}>
          选择一个剧本开始演示。演示中会叠加透明遮罩层，
          用聚光灯、标注、卡片等引导你的注意力。
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 260px)", gap: 20 }}>
        {scripts.map((script) => (
          <ScriptCard key={script.id} script={script} onClick={() => onSelect(script)} />
        ))}
      </div>

      <p style={{ position: "absolute", bottom: 24, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
        纯 CSS 动画 · 零运行时依赖 · React 18/19
      </p>
    </div>
  )
}

function ScriptCard({ script, onClick }: { script: Script; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 24,
        borderRadius: 16,
        background: hovered ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
        border: hovered ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.08)",
        cursor: "pointer",
        transition: "all 200ms ease",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.3)" : "none",
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 12 }}>{script.icon}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: "#fff", marginBottom: 8 }}>
        {script.title}
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
        {script.description}
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
        {script.steps.length} 步 · ~{Math.ceil((script.steps.length * script.intervalMs) / 1000)}s
      </div>
    </div>
  )
}

// ============================================================================
// 内置短剧本
// ============================================================================

function makeStep(id: string, cmd: PresentationCommand): PresentationStep {
  return { id, toolUseId: `t-${id}`, toolName: "demo", toolInput: {}, command: cmd, description: describeCommand(cmd), status: "pending" }
}

function makeSpotlightSteps(): PresentationStep[] {
  return [
    makeStep("s1", { type: "spotlight", region: { x: 60, y: 30, width: 700, height: 80 }, maskOpacity: 0.75, borderRadius: 12, animate: true }),
    makeStep("s2", { type: "spotlight", region: { x: 60, y: 135, width: 240, height: 100 }, maskOpacity: 0.75, borderRadius: 10, animate: true }),
    makeStep("s3", { type: "spotlight", region: { x: 310, y: 135, width: 240, height: 100 }, maskOpacity: 0.7, borderRadius: 10, animate: true }),
    makeStep("s4", { type: "spotlight", region: { x: 560, y: 135, width: 240, height: 100 }, maskOpacity: 0.7, borderRadius: 10, animate: true }),
    makeStep("s5", { type: "spotlight", region: { x: 60, y: 135, width: 740, height: 100 }, maskOpacity: 0.6, borderRadius: 10, animate: true }),
    makeStep("s6", { type: "clear" }),
  ]
}

function makeCardSteps(): PresentationStep[] {
  return [
    makeStep("c1", { type: "card", position: { x: 60, y: 80 }, width: 280, title: "从右侧滑入", content: "毛玻璃效果 + 柔和阴影", tag: "Right", tagColor: "#6366F1", enterFrom: "right", animate: true }),
    makeStep("c2", { type: "card", position: { x: 380, y: 80 }, width: 280, title: "从左侧滑入", content: "每个方向都有弹性动画", tag: "Left", tagColor: "#F59E0B", enterFrom: "left", animate: true }),
    makeStep("c3", { type: "card", position: { x: 700, y: 80 }, width: 280, title: "从下方滑入", content: "适合展示补充信息", tag: "Bottom", tagColor: "#10B981", enterFrom: "bottom", animate: true }),
    makeStep("c4", { type: "card", position: { x: 60, y: 320 }, width: 280, title: "从上方滑入", content: "组合创建丰富视觉叙事", tag: "Top", tagColor: "#EF4444", enterFrom: "top", animate: true }),
    makeStep("c5", { type: "text", position: { x: 380, y: 400 }, content: "✨ 纯 CSS @keyframes，零依赖！", fontSize: 15, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg, #6366F1, #8B5CF6)", animate: true }),
    makeStep("c6", { type: "clear" }),
  ]
}

function makeNewActionsSteps(): PresentationStep[] {
  return [
    // Step 1: Pulse - draw attention to NVIDIA data
    makeStep("n1", {
      type: "pulse",
      center: { x: 180, y: 175 },
      radius: 24,
      color: "#76B900",
      rings: 3,
      animate: true,
    }),
    // Step 2: Badge - label something
    makeStep("n2", {
      type: "badge",
      position: { x: 400, y: 50 },
      text: "HOT",
      color: "#fff",
      background: "#EF4444",
      size: "md",
      animate: true,
    }),
    // Step 3: Underline - emphasize text
    makeStep("n3", {
      type: "underline",
      from: { x: 80, y: 380 },
      to: { x: 450, y: 380 },
      color: "#F59E0B",
      strokeWidth: 3,
      style: "wavy",
      animate: true,
    }),
    // Step 4: Progress bar - show market share
    makeStep("n4", {
      type: "progress",
      position: { x: 80, y: 440 },
      width: 400,
      value: 80,
      color: "#76B900",
      showLabel: true,
      label: "NVIDIA 80%",
      animate: true,
    }),
    // Step 5: Counter - count up revenue
    makeStep("n5", {
      type: "counter",
      position: { x: 550, y: 200 },
      value: 26,
      prefix: "$",
      suffix: "B",
      color: "#76B900",
      fontSize: 48,
      animate: true,
    }),
    // Step 6: Bracket grouping
    makeStep("n6", {
      type: "bracket",
      from: { x: 500, y: 135 },
      to: { x: 500, y: 235 },
      direction: "right",
      color: "#6366F1",
      strokeWidth: 2,
      label: "竞争者",
      animate: true,
    }),
    // Step 7: Multiple combined - show all at once
    makeStep("n7", {
      type: "text",
      position: { x: 200, y: 500 },
      content: "以上就是 6 种新动作类型！",
      fontSize: 18,
      fontWeight: 700,
      color: "#fff",
      background: "linear-gradient(135deg, #6366F1, #EC4899)",
      animate: true,
    }),
    makeStep("n8", { type: "clear" }),
  ]
}
