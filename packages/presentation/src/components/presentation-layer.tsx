import { memo, useRef } from "react"
import type { PlayerRef } from "@remotion/player"
import type { PresentationStep } from "../types"
import { PresentationPlayer } from "./presentation-player"

export interface PresentationLayerProps {
  /** Whether the presentation is active/visible */
  presentationActive: boolean
  /** Presentation steps */
  steps: PresentationStep[]
  /** FPS (default 30) */
  fps?: number
  /** Show built-in transport bar (default true) */
  showTransport?: boolean
  /** Show timeline panel (default false) */
  showTimeline?: boolean
  /** Auto-play on mount (default true) */
  autoPlay?: boolean
  /** z-index for the layer */
  zIndex?: number
  /** Additional style */
  style?: React.CSSProperties
  /** Class name */
  className?: string
  /** Called when the active step changes due to playback */
  onStepChange?: (step: PresentationStep | null, index: number) => void
  /** Called on stop/dismiss */
  onStop?: () => void
}

/**
 * PresentationLayer — High-level wrapper over PresentationPlayer.
 *
 * The Player owns all playback state internally. External code only provides
 * steps and receives callbacks. The transport bar directly controls the
 * Remotion Player — no external state sync needed.
 */
export const PresentationLayer = memo(function PresentationLayer({
  presentationActive,
  steps,
  fps = 30,
  showTransport = true,
  showTimeline = false,
  autoPlay = true,
  zIndex,
  style,
  className,
  onStepChange,
}: PresentationLayerProps) {
  const playerRef = useRef<PlayerRef>(null)

  if (!presentationActive) return null

  return (
    <PresentationPlayer
      ref={playerRef}
      steps={steps}
      fps={fps}
      showTransport={showTransport}
      showTimeline={showTimeline}
      autoPlay={autoPlay}
      onStepChange={onStepChange}
      className={className}
      style={{
        zIndex,
        ...style,
      }}
    />
  )
})
