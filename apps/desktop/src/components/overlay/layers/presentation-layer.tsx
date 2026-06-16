import { useCallback, memo } from "react"
import { PresentationLayer as PresentationLayerBase } from "@viben/presentation"
import { useOverlayStore } from "@/stores/overlay-store"
import { DOMZIndex } from "@/types/overlay"

export function PresentationLayer() {
  const presentationActive = useOverlayStore((s) => s.presentationActive)
  const steps = useOverlayStore((s) => s.presentationSteps)
  const actions = useOverlayStore((s) => s.actions)

  const handleStepChange = useCallback((_step: any, index: number) => {
    useOverlayStore.setState({ presentationCurrentStep: index })
  }, [])

  if (!presentationActive) return null

  return (
    <div style={LAYER_CONTAINER_STYLE}>
      <PresentationLayerBase
        presentationActive={presentationActive}
        steps={steps}
        autoPlay
        showTransport
        zIndex={DOMZIndex.PresentationLayer}
        onStepChange={handleStepChange}
        onStop={actions.stopPresentation}
      />
      <DismissButton onDismiss={actions.stopPresentation} />
    </div>
  )
}

const LAYER_CONTAINER_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: DOMZIndex.PresentationLayer,
  pointerEvents: "none",
}

// ---------------------------------------------------------------------------
// Dismiss Button — fixed top-right corner
// ---------------------------------------------------------------------------

const DISMISS_BTN_STYLE: React.CSSProperties = {
  position: "fixed",
  top: 12,
  right: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(15, 15, 30, 0.85)",
  backdropFilter: "blur(8px)",
  color: "rgba(255,255,255,0.9)",
  cursor: "pointer",
  pointerEvents: "auto",
  zIndex: DOMZIndex.PresentationLayer + 1,
  transition: "background 0.15s, border-color 0.15s",
}

const DismissButton = memo(function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      style={DISMISS_BTN_STYLE}
      onClick={onDismiss}
      title="Dismiss presentation"
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(239, 68, 68, 0.8)"
        e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.6)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(15, 15, 30, 0.85)"
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )
})
