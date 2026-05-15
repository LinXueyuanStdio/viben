import { memo, useRef, useEffect, useCallback } from "react"
import type { PlayerRef } from "@remotion/player"
import type { PresentationStep, PlayerState, ClientToolResultContent } from "../types"
import { msToFrame } from "../utils/motion"
import { computeTotalMs } from "../utils/timeline"
import { PresentationPlayer } from "./presentation-player"

export interface PresentationLayerProps {
  /** Whether the presentation is active/visible */
  presentationActive: boolean
  /** Presentation steps */
  steps: PresentationStep[]
  /** Current step index (controlled) */
  currentStep: number
  /** Player state */
  playerState: PlayerState
  /** FPS (default 30) */
  fps?: number
  /** Show built-in controls (default true) */
  showControls?: boolean
  /** Show timeline panel (default false) */
  showTimeline?: boolean
  /** z-index for the layer */
  zIndex?: number
  /** Additional style */
  style?: React.CSSProperties
  /** Class name */
  className?: string

  // Imperative control callbacks
  onPlay?: () => void
  onPause?: () => void
  onNext?: () => void
  onPrev?: () => void
  onGoTo?: (index: number) => void
  onStop?: () => void
  /** Called when the active step changes due to playback */
  onStepChange?: (step: PresentationStep | null, index: number) => void

  // --- Legacy props (backward compatibility with apps/desktop) ---
  /** @deprecated Use onStop */
  stopPresentation?: () => void
  /** @deprecated Use onPlay */
  playerPlay?: () => void
  /** @deprecated Use onPause */
  playerPause?: () => void
  /** @deprecated Use onNext */
  playerNext?: () => void
  /** @deprecated Use onPrev */
  playerPrev?: () => void
  /** @deprecated Use onGoTo */
  playerGoTo?: (index: number) => void
  /** @deprecated */
  playerGoToStart?: () => void
  /** @deprecated */
  playerGoToEnd?: () => void
  /** @deprecated */
  togglePresentationDetails?: () => void
  /** @deprecated */
  detailsOpen?: boolean
  /** @deprecated */
  streamDone?: boolean
  /** @deprecated */
  sessionId?: string
  /** @deprecated */
  completePresentationStep?: (stepId: string, screenshot: string) => void
  /** @deprecated */
  updateStepStatus?: (stepId: string, status: any) => void
  /** @deprecated */
  setCurrentStep?: (index: number) => void
  /** @deprecated */
  markPresentationStreamDone?: () => void
  /** @deprecated */
  getSteps?: () => PresentationStep[]
  /** @deprecated */
  getPlayerState?: () => PlayerState
  /** @deprecated */
  getStreamDone?: () => boolean
  /** @deprecated */
  hasCompletedTool?: (toolUseId: string) => boolean
  /** @deprecated */
  postToolCompletion?: (toolUseId: string, content: ClientToolResultContent[], isError: boolean) => void
  /** @deprecated */
  getGatewayUrl?: () => string
  /** @deprecated */
  log?: (...args: any[]) => void
  /** @deprecated */
  logFlush?: () => void
  /** @deprecated */
  logClear?: () => void
}

/**
 * PresentationLayer — High-level step-controller wrapper over PresentationPlayer.
 *
 * Provides step-by-step navigation semantics on top of the timeline-based player.
 * Maps step indices to ms timestamps and exposes imperative callbacks for
 * navigation (play, pause, next, prev, goTo, stop).
 *
 * Accepts legacy props for backward compatibility with apps/desktop.
 * For new code, use PresentationPlayer directly with showTransport/showTimeline.
 */
export const PresentationLayer = memo(function PresentationLayer({
  presentationActive,
  steps,
  currentStep,
  playerState,
  fps = 30,
  showControls = true,
  showTimeline = false,
  zIndex,
  style,
  className,
  onStepChange,
  // Legacy props accepted for backward compatibility (not used for rendering)
}: PresentationLayerProps) {
  const playerRef = useRef<PlayerRef>(null)
  const totalDurationMs = computeTotalMs(steps)

  // Sync playerState → Remotion Player
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    if (playerState === "playing") {
      player.play()
    } else {
      player.pause()
    }
  }, [playerState])

  // Sync currentStep → seek
  useEffect(() => {
    const player = playerRef.current
    if (!player || !steps[currentStep]) return
    const targetMs = steps[currentStep].startMs
    const targetFrame = msToFrame(targetMs, fps)
    const current = player.getCurrentFrame()
    // Only seek if significantly different (avoid jitter)
    if (Math.abs(current - targetFrame) > 2) {
      player.seekTo(targetFrame)
    }
  }, [currentStep, steps, fps])

  // Handle step change from playback
  const handleStepChange = useCallback((step: PresentationStep | null, index: number) => {
    onStepChange?.(step, index)
  }, [onStepChange])

  if (!presentationActive) return null

  return (
    <PresentationPlayer
      ref={playerRef}
      steps={steps}
      fps={fps}
      totalDurationMs={totalDurationMs}
      showTransport={showControls}
      showTimeline={showTimeline}
      autoPlay={playerState === "playing"}
      onStepChange={handleStepChange}
      className={className}
      style={{
        zIndex,
        ...style,
      }}
    />
  )
})
