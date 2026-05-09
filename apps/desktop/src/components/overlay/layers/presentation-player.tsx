import { PresentationPlayer as PresentationPlayerBase } from "@viben/presentation"
import { useOverlayStore } from "@/stores/overlay-store"

export function PresentationPlayer() {
  const steps = useOverlayStore((s) => s.presentationSteps)
  const currentStep = useOverlayStore((s) => s.presentationCurrentStep)
  const playerState = useOverlayStore((s) => s.presentationPlayerState)
  const detailsOpen = useOverlayStore((s) => s.presentationDetailsOpen)
  const actions = useOverlayStore((s) => s.actions)

  return (
    <PresentationPlayerBase
      steps={steps}
      currentStep={currentStep}
      playerState={playerState}
      detailsOpen={detailsOpen}
      onPlay={actions.playerPlay}
      onPause={actions.playerPause}
      onGoTo={actions.playerGoTo}
      onGoToStart={actions.playerGoToStart}
      onGoToEnd={actions.playerGoToEnd}
      onNext={actions.playerNext}
      onPrev={actions.playerPrev}
      onToggleDetails={actions.togglePresentationDetails}
    />
  )
}
