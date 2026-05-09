import { useEffect, useRef, useCallback } from "react"
import type {
  PresentationStep,
  PlayerState,
  ClientToolResultContent,
} from "../types"
import { PresentationOverlay } from "./presentation-overlay"
import { OverlayControls } from "./overlay-controls"

export interface PresentationLayerProps {
  presentationActive: boolean
  steps: PresentationStep[]
  currentStep: number
  playerState: PlayerState
  detailsOpen: boolean
  streamDone: boolean
  sessionId: string
  zIndex?: number

  // Actions
  stopPresentation: () => void
  updateStepStatus: (stepId: string, status: PresentationStep["status"]) => void
  completePresentationStep: (stepId: string, screenshot: string) => void
  setCurrentStep: (index: number) => void
  playerPlay: () => void
  playerPause: () => void
  playerGoTo: (stepIndex: number) => void
  playerNext: () => void
  playerPrev: () => void
  playerGoToStart: () => void
  playerGoToEnd: () => void
  togglePresentationDetails: () => void
  markPresentationStreamDone: () => void

  // Callbacks
  postToolCompletion: (toolUseId: string, content: ClientToolResultContent[], isError: boolean) => void
  hasCompletedTool: (toolUseId: string) => boolean
  getGatewayUrl: () => string

  // Logger
  log: (msg: string, ...args: unknown[]) => void
  logFlush: () => Promise<void>
  logClear: () => Promise<void>

  // Getters (for reading latest state from store without closures)
  getSteps: () => PresentationStep[]
  getPlayerState: () => PlayerState
  getStreamDone: () => boolean
}

/**
 * PresentationLayer -- The main presentation layer component.
 *
 * Renders a full-screen overlay with CSS-animated annotations.
 * Handles step execution (auto-advance, completion callbacks).
 */
export function PresentationLayer({
  presentationActive,
  steps,
  currentStep,
  playerState,
  detailsOpen,
  streamDone: _streamDone,
  sessionId: _sessionId,
  zIndex,
  stopPresentation,
  updateStepStatus,
  completePresentationStep,
  setCurrentStep,
  playerPlay,
  playerPause,
  playerGoTo,
  playerNext,
  playerPrev,
  playerGoToStart,
  playerGoToEnd,
  togglePresentationDetails,
  markPresentationStreamDone: _markPresentationStreamDone,
  postToolCompletion,
  hasCompletedTool,
  getGatewayUrl: _getGatewayUrl,
  log,
  logFlush,
  logClear: _logClear,
  getSteps,
  getPlayerState,
  getStreamDone,
}: PresentationLayerProps) {
  // Props prefixed with _ are available for future use (screenshots, session management)
  void _streamDone
  void _sessionId
  void _markPresentationStreamDone
  void _getGatewayUrl
  void _logClear
  const processedIndexRef = useRef(-1)
  const stepsCount = steps.length

  // Execution engine: auto-advance through steps when playing
  useEffect(() => {
    if (!presentationActive || playerState !== "playing") return

    let cancelled = false

    const runLoop = async () => {
      while (!cancelled) {
        const currentSteps = getSteps()
        const currentPlayerState = getPlayerState()

        if (currentPlayerState !== "playing") break

        const nextIndex = processedIndexRef.current + 1
        if (nextIndex >= currentSteps.length) {
          // No more steps -- check if stream is done
          if (getStreamDone()) {
            // All done, auto-finish
            log("[PresentationLayer] All steps processed, stream done. Auto-finishing.")
            await autoFinish(currentSteps)
          }
          break
        }

        const step = currentSteps[nextIndex]
        if (step.status !== "pending") {
          processedIndexRef.current = nextIndex
          continue
        }

        // Mark as executing
        updateStepStatus(step.id, "executing")
        setCurrentStep(nextIndex)

        // Handle wait commands
        if (step.command.type === "wait") {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, step.command.type === "wait" ? step.command.ms : 0)
            if (cancelled) clearTimeout(timer)
          })
          if (cancelled) return
          completePresentationStep(step.id, "")
          processedIndexRef.current = nextIndex
          checkToolGroupCompletion(currentSteps, step)
          continue
        }

        // For visual commands, wait for animation duration
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 600) // Animation duration + small buffer
          if (cancelled) clearTimeout(timer)
        })
        if (cancelled) return

        // Mark step as done (no screenshot in CSS overlay mode)
        completePresentationStep(step.id, "")
        processedIndexRef.current = nextIndex

        // Check completion for tool group
        checkToolGroupCompletion(getSteps(), step)
      }
    }

    runLoop()
    return () => {
      cancelled = true
    }
  }, [stepsCount, playerState, presentationActive])

  // Reset on presentation stop
  useEffect(() => {
    if (!presentationActive) {
      processedIndexRef.current = -1
    }
  }, [presentationActive])

  // Check if all steps for a tool_use are done and post completion
  const checkToolGroupCompletion = useCallback(
    (allSteps: PresentationStep[], completedStep: PresentationStep) => {
      const toolSteps = allSteps.filter(
        (s) => s.toolUseId === completedStep.toolUseId
      )
      if (!toolSteps.every((s) => s.status === "done")) return
      if (hasCompletedTool(completedStep.toolUseId)) return

      const content: ClientToolResultContent[] = [
        {
          type: "text",
          text: `Executed ${completedStep.toolName} with ${toolSteps.length} command(s).`,
        },
      ]

      log(
        "[PresentationLayer] Tool group complete: toolUseId=%s, steps=%s",
        completedStep.toolUseId,
        toolSteps.length
      )

      postToolCompletion(completedStep.toolUseId, content, false)
    },
    [hasCompletedTool, postToolCompletion, log]
  )

  // Auto-finish: complete any remaining pending steps
  const autoFinish = useCallback(
    async (currentSteps: PresentationStep[]) => {
      const pendingSteps = currentSteps.filter((s) => s.status === "pending")
      for (const step of pendingSteps) {
        completePresentationStep(step.id, "")
      }
      // Post completion for all remaining tool groups
      const toolUseIds = new Set(pendingSteps.map((s) => s.toolUseId))
      const latestSteps = getSteps()
      for (const toolUseId of toolUseIds) {
        if (hasCompletedTool(toolUseId)) continue
        const toolSteps = latestSteps.filter((s) => s.toolUseId === toolUseId)
        const content: ClientToolResultContent[] = [
          {
            type: "text",
            text: `Executed ${toolSteps[0]?.toolName || "unknown"} with ${toolSteps.length} command(s).`,
          },
        ]
        postToolCompletion(toolUseId, content, false)
      }
    },
    [completePresentationStep, getSteps, hasCompletedTool, postToolCompletion]
  )

  const handleStop = useCallback(() => {
    log("[PresentationLayer] Stop pressed")
    logFlush()
    stopPresentation()
  }, [log, logFlush, stopPresentation])

  if (!presentationActive) return null

  return (
    <PresentationOverlay
      active={presentationActive}
      steps={steps}
      currentStep={currentStep}
      zIndex={zIndex}
      onStop={handleStop}
    >
      <OverlayControls
        steps={steps}
        currentStep={currentStep}
        playerState={playerState}
        detailsOpen={detailsOpen}
        onPlay={playerPlay}
        onPause={playerPause}
        onNext={playerNext}
        onPrev={playerPrev}
        onGoTo={playerGoTo}
        onGoToStart={playerGoToStart}
        onGoToEnd={playerGoToEnd}
        onToggleDetails={togglePresentationDetails}
      />
    </PresentationOverlay>
  )
}
