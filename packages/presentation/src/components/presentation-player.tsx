import type { PresentationStep, PlayerState } from "../types"
import { OverlayControls } from "./overlay-controls"

export interface PresentationPlayerProps {
  steps: PresentationStep[]
  currentStep: number
  playerState: PlayerState
  detailsOpen?: boolean
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
 * PresentationPlayer -- Standalone player controls component.
 *
 * Renders the overlay controls bar for presentation playback.
 * Can be used independently from PresentationLayer for custom layouts.
 */
export function PresentationPlayer({
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
}: PresentationPlayerProps) {
  return (
    <OverlayControls
      steps={steps}
      currentStep={currentStep}
      playerState={playerState}
      detailsOpen={detailsOpen}
      onPlay={onPlay}
      onPause={onPause}
      onNext={onNext}
      onPrev={onPrev}
      onGoTo={onGoTo}
      onGoToStart={onGoToStart}
      onGoToEnd={onGoToEnd}
      onToggleDetails={onToggleDetails}
    />
  )
}
