import { useCallback } from "react"
import { PresentationLayer as PresentationLayerBase } from "@viben/presentation"
import type { ClientToolResultContent } from "@viben/presentation"
import { useOverlayStore } from "@/stores/overlay-store"
import { completeClientSideToolOnce, hasCompletedClientSideTool } from "@/lib/client-side-tool/complete"
import { getGatewayUrl } from "@/lib/gateway/config"
import { DOMZIndex } from "@/types/overlay"
import { plog, pflush, pclear } from "@/lib/presentation/logger"

export function PresentationLayer() {
  const presentationActive = useOverlayStore((s) => s.presentationActive)
  const steps = useOverlayStore((s) => s.presentationSteps)
  const currentStep = useOverlayStore((s) => s.presentationCurrentStep)
  const playerState = useOverlayStore((s) => s.presentationPlayerState)
  const detailsOpen = useOverlayStore((s) => s.presentationDetailsOpen)
  const streamDone = useOverlayStore((s) => s.presentationStreamDone)
  const sessionId = useOverlayStore((s) => s.presentationSessionId)
  const actions = useOverlayStore((s) => s.actions)

  const postToolCompletion = useCallback((toolUseId: string, content: ClientToolResultContent[], isError: boolean) => {
    const currentSessionId = useOverlayStore.getState().presentationSessionId
    plog("[Presentation] postToolCompletion: sessionId=%s, toolUseId=%s, isError=%s", currentSessionId, toolUseId, isError)

    if (!currentSessionId) {
      plog("[Presentation] ERROR: postToolCompletion: ABORT - sessionId is empty!")
      return
    }

    plog("[Presentation] postToolCompletion: calling completeClientSideToolOnce toolUseId=%s sessionId=%s isError=%s", toolUseId, currentSessionId, isError)
    completeClientSideToolOnce(toolUseId, currentSessionId, { content, isError }).then((posted) => {
      plog("[Presentation] postToolCompletion: result posted=%s for toolUseId=%s", posted, toolUseId)
    }).catch((err) => {
      const errMsg = err instanceof Error ? `${err.message}\n${err.stack}` : JSON.stringify(err)
      plog("[Presentation] ERROR: postToolCompletion: completeClientSideToolOnce FAILED for toolUseId=%s: %s", toolUseId, errMsg)
    })
  }, [])

  const hasCompletedTool = useCallback((toolUseId: string) => {
    return hasCompletedClientSideTool(toolUseId)
  }, [])

  const getGatewayUrlCb = useCallback(() => getGatewayUrl(), [])

  const getSteps = useCallback(() => useOverlayStore.getState().presentationSteps, [])
  const getPlayerState = useCallback(() => useOverlayStore.getState().presentationPlayerState, [])
  const getStreamDone = useCallback(() => useOverlayStore.getState().presentationStreamDone, [])

  const setCurrentStep = useCallback((index: number) => {
    useOverlayStore.setState({ presentationCurrentStep: index })
  }, [])

  if (!presentationActive) return null

  return (
    <PresentationLayerBase
      presentationActive={presentationActive}
      steps={steps}
      currentStep={currentStep}
      playerState={playerState}
      detailsOpen={detailsOpen}
      streamDone={streamDone}
      sessionId={sessionId}
      zIndex={DOMZIndex.PresentationLayer}
      stopPresentation={actions.stopPresentation}
      updateStepStatus={actions.updateStepStatus}
      completePresentationStep={actions.completePresentationStep}
      setCurrentStep={setCurrentStep}
      playerPlay={actions.playerPlay}
      playerPause={actions.playerPause}
      playerGoTo={actions.playerGoTo}
      playerNext={actions.playerNext}
      playerPrev={actions.playerPrev}
      playerGoToStart={actions.playerGoToStart}
      playerGoToEnd={actions.playerGoToEnd}
      togglePresentationDetails={actions.togglePresentationDetails}
      markPresentationStreamDone={actions.markPresentationStreamDone}
      postToolCompletion={postToolCompletion}
      hasCompletedTool={hasCompletedTool}
      getGatewayUrl={getGatewayUrlCb}
      log={plog}
      logFlush={pflush}
      logClear={pclear}
      getSteps={getSteps}
      getPlayerState={getPlayerState}
      getStreamDone={getStreamDone}
    />
  )
}
