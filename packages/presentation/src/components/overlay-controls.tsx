import { useState, useEffect, useCallback } from "react"
import type { PresentationStep, PlayerState } from "../types"

export interface OverlayControlsProps {
  steps: PresentationStep[]
  currentStep: number
  playerState: PlayerState
  detailsOpen?: boolean
  /** Auto-advance interval in ms (default 3000) */
  autoAdvanceInterval?: number
  onPlay?: () => void
  onPause?: () => void
  onNext?: () => void
  onPrev?: () => void
  onGoTo?: (index: number) => void
  onGoToStart?: () => void
  onGoToEnd?: () => void
  onToggleDetails?: () => void
}

/**
 * OverlayControls -- Minimal bottom-center control bar.
 *
 * Dark pill-shaped bar with glass effect, similar to macOS media controls.
 * Includes: step indicator, previous/next, play/pause, stop.
 */
export function OverlayControls({
  steps,
  currentStep,
  playerState,
  detailsOpen = false,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onGoTo,
  onGoToStart,
  onGoToEnd,
  onToggleDetails,
}: OverlayControlsProps) {
  const total = steps.length

  if (total === 0) return null

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "auto",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {/* Details panel (above controls) */}
      {detailsOpen && (
        <StepDetailsPanel
          steps={steps}
          currentStep={currentStep}
          onGoTo={onGoTo}
        />
      )}

      {/* Control bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
          borderRadius: 24,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          color: "#fff",
          fontSize: 13,
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
        }}
      >
        <ControlButton
          onClick={onGoToStart}
          title="Go to start"
          label={"\u23EE"}
        />
        <ControlButton onClick={onPrev} title="Previous" label={"\u25C0"} />
        <ControlButton
          onClick={playerState === "playing" ? onPause : onPlay}
          title={playerState === "playing" ? "Pause" : "Play"}
          label={playerState === "playing" ? "\u23F8" : "\u25B6"}
          primary
        />
        <ControlButton onClick={onNext} title="Next" label={"\u25B6"} />
        <ControlButton
          onClick={onGoToEnd}
          title="Go to end"
          label={"\u23ED"}
        />

        <Divider />

        {/* Progress slider */}
        <input
          type="range"
          min={0}
          max={Math.max(total - 1, 0)}
          value={currentStep}
          onChange={(e) => onGoTo?.(Number(e.target.value))}
          style={{
            width: 120,
            accentColor: "#fff",
            cursor: "pointer",
          }}
        />

        {/* Step counter */}
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            minWidth: 44,
            textAlign: "center",
            fontSize: 12,
            opacity: 0.8,
          }}
        >
          {currentStep + 1} / {total}
        </span>

        <Divider />

        {/* Details toggle */}
        <ControlButton
          onClick={onToggleDetails}
          title="Step details"
          label={"\u2630"}
          active={detailsOpen}
        />
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function ControlButton({
  onClick,
  title,
  label,
  primary,
  active,
}: {
  onClick?: () => void
  title: string
  label: string
  primary?: boolean
  active?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: primary ? 32 : 28,
        height: primary ? 32 : 28,
        borderRadius: "50%",
        border: "none",
        background: active
          ? "rgba(255, 255, 255, 0.2)"
          : hovered
            ? "rgba(255, 255, 255, 0.15)"
            : "transparent",
        color: "#fff",
        fontSize: primary ? 16 : 13,
        cursor: "pointer",
        transition: "background 150ms",
        padding: 0,
        lineHeight: 1,
      }}
    >
      {label}
    </button>
  )
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        background: "rgba(255, 255, 255, 0.2)",
        margin: "0 4px",
      }}
    />
  )
}

// ============================================================================
// Step Details Panel
// ============================================================================

function StepDetailsPanel({
  steps,
  currentStep,
  onGoTo,
}: {
  steps: PresentationStep[]
  currentStep: number
  onGoTo?: (index: number) => void
}) {
  return (
    <div
      style={{
        width: 420,
        maxHeight: 360,
        overflowY: "auto",
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        padding: 8,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
      }}
    >
      {steps.map((step, i) => (
        <StepCard
          key={step.id}
          step={step}
          index={i}
          isCurrent={i === currentStep}
          onClick={() => onGoTo?.(i)}
        />
      ))}
    </div>
  )
}

function StepCard({
  step,
  index,
  isCurrent,
  onClick,
}: {
  step: PresentationStep
  index: number
  isCurrent: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        gap: 10,
        padding: 8,
        borderRadius: 8,
        cursor: "pointer",
        background: isCurrent
          ? "rgba(255, 255, 255, 0.12)"
          : hovered
            ? "rgba(255, 255, 255, 0.06)"
            : "transparent",
        border: isCurrent
          ? "1px solid rgba(255, 255, 255, 0.3)"
          : "1px solid transparent",
        transition: "background 150ms",
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: 80,
          height: 50,
          borderRadius: 6,
          overflow: "hidden",
          flexShrink: 0,
          background: "rgba(255, 255, 255, 0.05)",
        }}
      >
        {step.screenshot ? (
          <img
            src={step.screenshot}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {index + 1}. {step.description}
        </div>
        <div
          style={{
            color: "rgba(255, 255, 255, 0.4)",
            fontSize: 10,
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {JSON.stringify(step.command, null, 0).slice(0, 80)}
        </div>
      </div>

      {/* Status */}
      <span
        style={{
          fontSize: 11,
          color: "rgba(255, 255, 255, 0.4)",
          alignSelf: "center",
        }}
      >
        {step.status === "executing"
          ? "\u23F3"
          : step.status === "done"
            ? "\u2713"
            : "\u00B7"}
      </span>
    </div>
  )
}

// ============================================================================
// Auto-advance hook (convenience export)
// ============================================================================

/**
 * Hook that auto-advances to the next step when playerState is "playing".
 */
export function useAutoAdvance({
  playerState,
  currentStep,
  totalSteps,
  intervalMs = 3000,
  onNext,
}: {
  playerState: PlayerState
  currentStep: number
  totalSteps: number
  intervalMs?: number
  onNext?: () => void
}) {
  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      onNext?.()
    }
  }, [currentStep, totalSteps, onNext])

  useEffect(() => {
    if (playerState !== "playing") return
    const timer = setInterval(handleNext, intervalMs)
    return () => clearInterval(timer)
  }, [playerState, handleNext, intervalMs])
}
