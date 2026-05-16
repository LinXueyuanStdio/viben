import { PresentationLayer } from "@viben/presentation"
import { useOverlayStore } from "@/stores/overlay-store"

export function PresentationPlayer() {
  const presentationActive = useOverlayStore((s) => s.presentationActive)
  const steps = useOverlayStore((s) => s.presentationSteps)
  const currentStep = useOverlayStore((s) => s.presentationCurrentStep)
  const playerState = useOverlayStore((s) => s.presentationPlayerState)

  return (
    <PresentationLayer
      presentationActive={presentationActive}
      steps={steps}
      currentStep={currentStep}
      playerState={playerState}
      showControls
    />
  )
}
