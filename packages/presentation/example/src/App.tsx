import { useState, useCallback } from "react"
import {
  PresentationOverlay,
  OverlayControls,
  describeCommand,
} from "@viben/presentation"
import type { PresentationStep, PlayerState } from "@viben/presentation"

// ============================================================================
// Demo steps
// ============================================================================

const demoSteps: PresentationStep[] = [
  {
    id: "step-1",
    toolUseId: "tool-1",
    toolName: "presentation_spotlight",
    toolInput: {},
    command: {
      type: "spotlight",
      region: { x: 80, y: 130, width: 260, height: 100 },
      maskOpacity: 0.65,
      borderRadius: 12,
      animate: true,
    },
    description: describeCommand({
      type: "spotlight",
      region: { x: 80, y: 130, width: 260, height: 100 },
    }),
    status: "done",
  },
  {
    id: "step-2",
    toolUseId: "tool-1",
    toolName: "presentation_draw",
    toolInput: {},
    command: {
      type: "card",
      position: { x: 580, y: 180 },
      width: 300,
      title: "NVIDIA market dominance",
      content: "CUDA ecosystem + full-stack optimization\nVertical integration is the core moat",
      tag: "Key Insight",
      tagColor: "#76B900",
      enterFrom: "right",
      animate: true,
    },
    description: describeCommand({
      type: "card",
      position: { x: 580, y: 180 },
      title: "NVIDIA market dominance",
    }),
    status: "done",
  },
  {
    id: "step-3",
    toolUseId: "tool-2",
    toolName: "presentation_callout",
    toolInput: {},
    command: {
      type: "arrow",
      from: { x: 580, y: 230 },
      to: { x: 330, y: 178 },
      color: "#76B900",
      label: "80% monopoly",
      strokeWidth: 2.5,
      animate: true,
    },
    description: describeCommand({
      type: "arrow",
      from: { x: 580, y: 230 },
      to: { x: 330, y: 178 },
      label: "80% monopoly",
    }),
    status: "done",
  },
  {
    id: "step-4",
    toolUseId: "tool-3",
    toolName: "presentation_draw",
    toolInput: {},
    command: {
      type: "circle",
      center: { x: 427, y: 178 },
      radius: 28,
      color: "#ED1C24",
      strokeWidth: 2.5,
      animate: true,
    },
    description: describeCommand({
      type: "circle",
      center: { x: 427, y: 178 },
      radius: 28,
    }),
    status: "done",
  },
  {
    id: "step-5",
    toolUseId: "tool-4",
    toolName: "presentation_draw",
    toolInput: {},
    command: {
      type: "highlight",
      region: { x: 80, y: 280, width: 760, height: 80 },
      color: "rgba(99, 102, 241, 0.3)",
      borderRadius: 8,
      animate: true,
    },
    description: describeCommand({
      type: "highlight",
      region: { x: 80, y: 280, width: 760, height: 80 },
    }),
    status: "done",
  },
  {
    id: "step-6",
    toolUseId: "tool-5",
    toolName: "presentation_draw",
    toolInput: {},
    command: {
      type: "text",
      position: { x: 260, y: 420 },
      content: "AI chip market: from monopoly to competition",
      fontSize: 16,
      fontWeight: 700,
      color: "#fff",
      background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
      animate: true,
    },
    description: describeCommand({
      type: "text",
      position: { x: 260, y: 420 },
      content: "AI chip market: from monopoly to competition",
    }),
    status: "done",
  },
]

// ============================================================================
// App
// ============================================================================

export function App() {
  const [active, setActive] = useState(true)
  const [currentStep, setCurrentStep] = useState(5) // Show all steps
  const [playerState, setPlayerState] = useState<PlayerState>("paused")
  const [detailsOpen, setDetailsOpen] = useState(false)

  const handleGoTo = useCallback((index: number) => {
    setCurrentStep(index)
    setPlayerState("paused")
  }, [])

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#0a0a0f",
        fontFamily: "'PingFang SC', -apple-system, sans-serif",
        position: "relative",
      }}
    >
      {/* Background content to annotate over */}
      <MockBackground />

      {/* Presentation overlay */}
      <PresentationOverlay
        active={active}
        steps={demoSteps}
        currentStep={currentStep}
        zIndex={100}
        onStop={() => setActive(false)}
      >
        <OverlayControls
          steps={demoSteps}
          currentStep={currentStep}
          playerState={playerState}
          detailsOpen={detailsOpen}
          onPlay={() => setPlayerState("playing")}
          onPause={() => setPlayerState("paused")}
          onNext={() => setCurrentStep((s) => Math.min(s + 1, demoSteps.length - 1))}
          onPrev={() => setCurrentStep((s) => Math.max(s - 1, 0))}
          onGoTo={handleGoTo}
          onGoToStart={() => handleGoTo(0)}
          onGoToEnd={() => handleGoTo(demoSteps.length - 1)}
          onToggleDetails={() => setDetailsOpen((s) => !s)}
        />
      </PresentationOverlay>

      {/* Toggle button if overlay is hidden */}
      {!active && (
        <button
          onClick={() => {
            setActive(true)
            setCurrentStep(5)
          }}
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 24px",
            fontSize: 14,
            background: "rgba(255,255,255,0.1)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Show Presentation Overlay
        </button>
      )}
    </div>
  )
}

// ============================================================================
// Mock background
// ============================================================================

function MockBackground() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
        fontFamily: "'PingFang SC', -apple-system, sans-serif",
        padding: 40,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: 32,
          background: "rgba(255,255,255,0.03)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
          2024 Global AI Chip Market Analysis
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
          Source: Morgan Stanley Research | 2024.03
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
          <DataBox label="NVIDIA Market Share" value="80%" color="#76B900" />
          <DataBox label="AMD Market Share" value="12%" color="#ED1C24" />
          <DataBox label="Others" value="8%" color="#6366F1" />
        </div>

        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", lineHeight: 1.8 }}>
          According to the latest data, NVIDIA holds an 80% share of the AI training chip market.
          The H100/H200 GPU series maintains an absolute lead in large model training.
          AMD has gained 12% market share with the MI300X, showing significant growth.
          Intel, Google TPU, and other players collectively hold the remaining 8%.
        </div>
      </div>
    </div>
  )
}

function DataBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        padding: "16px 24px",
        background: "rgba(255,255,255,0.05)",
        borderRadius: 10,
        borderLeft: `3px solid ${color}`,
        flex: 1,
      }}
    >
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}
