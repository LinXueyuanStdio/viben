import { Fragment } from "react"
import {
  SkipBack,
  ChevronLeft,
  Play,
  Pause,
  ChevronRight,
  SkipForward,
  List,
} from "lucide-react"
import { useOverlayStore } from "@/stores/overlay-store"
import type { PresentationStep } from "@/lib/client-side-tool/types"

export function PresentationPlayer() {
  const steps = useOverlayStore((s) => s.presentationSteps)
  const currentStep = useOverlayStore((s) => s.presentationCurrentStep)
  const playerState = useOverlayStore((s) => s.presentationPlayerState)
  const detailsOpen = useOverlayStore((s) => s.presentationDetailsOpen)
  const actions = useOverlayStore((s) => s.actions)
  const total = steps.length

  if (total === 0) return null

  return (
    <div
      id="presentation-player-controls"
      style={{
        position: "absolute",
        bottom: 48,
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
        <StepDetailsPanel steps={steps} currentStep={currentStep} onGoTo={actions.playerGoTo} />
      )}

      {/* Control bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 12px",
          borderRadius: 40,
          background: "rgba(10, 10, 14, 0.78)",
          backdropFilter: "blur(20px) saturate(1.6)",
          WebkitBackdropFilter: "blur(20px) saturate(1.6)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          color: "#fff",
          fontSize: 13,
        }}
      >
        <PlayerButton
          icon={<SkipBack size={14} />}
          onClick={actions.playerGoToStart}
          label="Go to start"
        />
        <PlayerButton
          icon={<ChevronLeft size={16} />}
          onClick={actions.playerPrev}
          label="Previous step"
        />
        <PlayerButton
          icon={playerState === "playing" ? <Pause size={16} /> : <Play size={16} />}
          onClick={playerState === "playing" ? actions.playerPause : actions.playerPlay}
          primary
          label={playerState === "playing" ? "Pause" : "Play"}
        />
        <PlayerButton
          icon={<ChevronRight size={16} />}
          onClick={actions.playerNext}
          label="Next step"
        />
        <PlayerButton
          icon={<SkipForward size={14} />}
          onClick={actions.playerGoToEnd}
          label="Go to end"
        />

        <Divider />

        <input
          type="range"
          min={0}
          max={Math.max(total - 1, 0)}
          value={currentStep}
          onChange={(e) => actions.playerGoTo(Number(e.target.value))}
          aria-label="Step progress"
          style={{
            width: 140,
            height: 3,
            appearance: "none",
            WebkitAppearance: "none",
            background: `linear-gradient(to right, rgba(255,255,255,0.8) ${total > 1 ? (currentStep / (total - 1)) * 100 : 0}%, rgba(255,255,255,0.15) ${total > 1 ? (currentStep / (total - 1)) * 100 : 0}%)`,
            borderRadius: 2,
            outline: "none",
            cursor: "pointer",
          }}
        />

        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            minWidth: 44,
            textAlign: "center",
            fontSize: 12,
            fontWeight: 500,
            color: "rgba(255, 255, 255, 0.7)",
            letterSpacing: "-0.01em",
          }}
        >
          {currentStep + 1}/{total}
        </span>

        <Divider />

        <PlayerButton
          icon={<List size={14} />}
          onClick={actions.togglePresentationDetails}
          active={detailsOpen}
          label="Step details"
        />
      </div>
    </div>
  )
}

// ---- Sub-components ----

function PlayerButton({
  icon,
  onClick,
  label,
  primary,
  active,
}: {
  icon: React.ReactNode
  onClick: () => void
  label: string
  primary?: boolean
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: primary ? 36 : 30,
        height: primary ? 36 : 30,
        background: active
          ? "rgba(255, 255, 255, 0.14)"
          : primary
            ? "rgba(255, 255, 255, 0.1)"
            : "transparent",
        border: "none",
        color: "#fff",
        cursor: "pointer",
        borderRadius: primary ? 18 : 8,
        opacity: active ? 1 : 0.75,
        transition: "opacity 0.2s ease-out, background 0.2s ease-out, transform 0.1s ease-out",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "1"
        e.currentTarget.style.background = primary
          ? "rgba(255, 255, 255, 0.18)"
          : "rgba(255, 255, 255, 0.1)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = active ? "1" : "0.75"
        e.currentTarget.style.background = active
          ? "rgba(255, 255, 255, 0.14)"
          : primary
            ? "rgba(255, 255, 255, 0.1)"
            : "transparent"
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.92)"
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)"
      }}
    >
      {icon}
    </button>
  )
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: "rgba(255, 255, 255, 0.1)",
        margin: "0 4px",
      }}
    />
  )
}

// ---- Step Details Panel ----

function StepDetailsPanel({
  steps,
  currentStep,
  onGoTo,
}: {
  steps: PresentationStep[]
  currentStep: number
  onGoTo: (index: number) => void
}) {
  let lastToolUseId = ""

  return (
    <div
      style={{
        maxHeight: 360,
        overflowY: "auto",
        width: 420,
        background: "rgba(10, 10, 14, 0.82)",
        backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {steps.map((step, i) => {
        const showGroupHeader = step.toolUseId !== lastToolUseId
        lastToolUseId = step.toolUseId
        return (
          <Fragment key={step.id}>
            {showGroupHeader && (
              <div
                style={{
                  color: "rgba(255, 255, 255, 0.4)",
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "8px 4px 2px",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                {step.toolName.replace("presentation_", "")}
              </div>
            )}
            <StepCard
              step={step}
              index={i}
              isCurrent={i === currentStep}
              onClick={() => onGoTo(i)}
            />
          </Fragment>
        )
      })}
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
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        gap: 10,
        padding: 8,
        borderRadius: 10,
        cursor: "pointer",
        background: isCurrent ? "rgba(255, 255, 255, 0.08)" : "transparent",
        border: isCurrent
          ? "1px solid rgba(255, 255, 255, 0.15)"
          : "1px solid transparent",
        transition: "background 0.2s ease-out, border-color 0.2s ease-out",
      }}
      onMouseEnter={(e) => {
        if (!isCurrent) e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)"
      }}
      onMouseLeave={(e) => {
        if (!isCurrent) e.currentTarget.style.background = "transparent"
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
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        {step.screenshot ? (
          <img
            src={step.screenshot.startsWith("data:") ? step.screenshot : `data:image/png;base64,${step.screenshot}`}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            alt={`Step ${index + 1} screenshot`}
          />
        ) : null}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: isCurrent ? "#fff" : "rgba(255, 255, 255, 0.85)",
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          {index + 1}. {step.description}
        </div>
        <pre
          style={{
            color: "rgba(255, 255, 255, 0.3)",
            fontSize: 10,
            margin: "3px 0 0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          {JSON.stringify(step.command, null, 0).slice(0, 80)}
        </pre>
      </div>

      {/* Status */}
      <span
        style={{
          fontSize: 11,
          color: step.status === "done"
            ? "rgba(74, 222, 128, 0.8)"
            : step.status === "executing"
              ? "rgba(251, 191, 36, 0.8)"
              : "rgba(255, 255, 255, 0.25)",
          alignSelf: "center",
          fontWeight: 500,
        }}
      >
        {step.status === "executing" ? "●" : step.status === "done" ? "✓" : "○"}
      </span>
    </div>
  )
}
