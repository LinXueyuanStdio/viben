import { useEffect, useRef, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { Tldraw } from "tldraw"
import type { Editor } from "tldraw"
import "tldraw/tldraw.css"
import "./presentation-layer.css"
import { toPng } from "html-to-image"
import { CheckCircle } from "lucide-react"
import { useOverlayStore } from "@/stores/overlay-store"
import { animateCommand, replayToStep } from "@/lib/presentation/command-animator"
import { DOMZIndex } from "@/types/overlay"
import type { AnimationHandle } from "@/lib/presentation/command-animator"
import type { ClientToolResultContent } from "@/lib/client-side-tool/types"
import { PresentationPlayer } from "./presentation-player"
import { plog, pflush, pclear } from "@/lib/presentation/logger"

/** Post error completion for all incomplete tool groups */
function postIncompleteCompletions() {
  const currentSteps = useOverlayStore.getState().presentationSteps
  const incompleteToolUseIds = new Set<string>()
  for (const step of currentSteps) {
    if (step.status !== "done") {
      incompleteToolUseIds.add(step.toolUseId)
    }
  }
  for (const toolUseId of incompleteToolUseIds) {
    postToolCompletion(toolUseId, currentSteps, true)
  }
}

export function PresentationLayer() {
  const { t } = useTranslation()
  const presentationActive = useOverlayStore((s) => s.presentationActive)
  const steps = useOverlayStore((s) => s.presentationSteps)
  const currentStep = useOverlayStore((s) => s.presentationCurrentStep)
  const playerState = useOverlayStore((s) => s.presentationPlayerState)
  const actions = useOverlayStore((s) => s.actions)
  const editorRef = useRef<Editor | null>(null)
  const currentAnimRef = useRef<AnimationHandle | null>(null)
  const processedIndexRef = useRef(-1)
  // Counter incremented when editor mounts — triggers execution loop retry
  const [editorReady, setEditorReady] = useState(0)

  const stepsCount = steps.length

  // ---- Auto-finish: when all steps done, stream finished, no user interaction ----
  const autoFinish = useCallback(() => {
    plog("[Presentation] autoFinish called")
    const editor = editorRef.current
    if (editor) {
      const allShapes = editor.getCurrentPageShapes()
      if (allShapes.length > 0) {
        editor.deleteShapes(allShapes.map((s) => s.id))
      }
    }
    // Flush deferred + post all completed
    flushDeferredCompletions()
    const currentSteps = useOverlayStore.getState().presentationSteps
    const doneToolUseIds = new Set<string>()
    for (const step of currentSteps) {
      if (step.status === "done") doneToolUseIds.add(step.toolUseId)
    }
    for (const toolUseId of doneToolUseIds) {
      postToolCompletion(toolUseId, currentSteps, false)
    }
    pflush()
    actions.stopPresentation()
  }, [actions])

  // ---- Clear log file when presentation activates ----
  useEffect(() => {
    if (presentationActive) {
      pclear()
      plog("[Presentation] === PRESENTATION ACTIVATED === sessionId=%s", useOverlayStore.getState().presentationSessionId)
    }
  }, [presentationActive])

  // ---- Execution engine ----
  // When playerState changes to "playing", sync processedIndexRef with currentStep
  // so that resuming after a rewind re-animates from the rewound position.
  // Also flush any deferred completions that were waiting for user to resume.
  useEffect(() => {
    if (playerState === "playing") {
      flushDeferredCompletions()
      const storeCurrentStep = useOverlayStore.getState().presentationCurrentStep
      // If user rewound (currentStep < processedIndex), reset processedIndex
      if (storeCurrentStep - 1 < processedIndexRef.current) {
        processedIndexRef.current = storeCurrentStep - 1
      }
    }
  }, [playerState])

  const streamDone = useOverlayStore((s) => s.presentationStreamDone)

  useEffect(() => {
    if (!presentationActive || playerState !== "playing" || !editorRef.current) {
      plog("[Presentation] Execution effect skipped: active=%s, playerState=%s, editorReady=%s", presentationActive, playerState, !!editorRef.current)
      return
    }
    plog("[Presentation] Execution effect starting (stepsCount=%d, streamDone=%s)", stepsCount, streamDone)

    const editor = editorRef.current
    const getSteps = () => useOverlayStore.getState().presentationSteps
    const getPlayerState = () => useOverlayStore.getState().presentationPlayerState
    const getStreamDone = () => useOverlayStore.getState().presentationStreamDone
    let cancelled = false
    /** Tracks whether user interacted (paused/skipped) during this playback */
    let userInteracted = false
    const unsub = useOverlayStore.subscribe((state, prev) => {
      if (state.presentationPlayerState !== prev.presentationPlayerState && state.presentationPlayerState === "paused") {
        userInteracted = true
      }
    })

    const runLoop = async () => {
      plog("[Presentation] runLoop started, processedIndex:", processedIndexRef.current)
      while (!cancelled) {
        if (getPlayerState() !== "playing") {
          plog("[Presentation] Loop break: playerState is not playing")
          break
        }

        const currentSteps = getSteps()
        const nextIndex = processedIndexRef.current + 1

        // No more steps yet — check if stream is done (auto-finish)
        if (nextIndex >= currentSteps.length) {
          plog("[Presentation] Loop break: no more steps (next=%d, total=%d, streamDone=%s, userInteracted=%s)", nextIndex, currentSteps.length, getStreamDone(), userInteracted)
          if (getStreamDone() && !userInteracted) {
            plog("[Presentation] Auto-finishing (all steps done, stream finished, no interaction)")
            autoFinish()
          }
          break
        }
        const step = currentSteps[nextIndex]
        plog("[Presentation] Step %d/%d: %s (id=%s)", nextIndex + 1, currentSteps.length, step.command.type, step.id)

        // Mark executing (reset status if it was previously done)
        actions.updateStepStatus(step.id, "executing")

        // Animate
        plog("[Presentation] Step %d: animating...", nextIndex + 1)
        const anim = animateCommand(editor, step.command)
        currentAnimRef.current = anim
        await anim.done
        currentAnimRef.current = null
        plog("[Presentation] Step %d: animation done", nextIndex + 1)

        if (cancelled || getPlayerState() !== "playing") {
          plog("[Presentation] Loop break after animation: cancelled=%s, playerState=%s", cancelled, getPlayerState())
          break
        }

        // Screenshot: capture DOM via html-to-image (excluding player controls & exit buttons)
        plog("[Presentation] Step %d: taking screenshot (viewport: %dx%d)...", nextIndex + 1, window.innerWidth, window.innerHeight)
        const screenshotStart = performance.now()
        let screenshotData = ""
        try {
          const screenshotPromise = toPng(document.documentElement, {
            width: window.innerWidth,
            height: window.innerHeight,
            cacheBust: true,
            skipAutoScale: true,
            filter: (node) => {
              if (!(node instanceof HTMLElement)) return true
              const id = node.id
              return id !== "presentation-player-controls" && id !== "presentation-exit-btn"
            },
          })
          // Timeout after 8s to avoid hanging forever
          const dataUrl = await Promise.race([
            screenshotPromise,
            new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error("Screenshot timed out after 8s")), 8000)
            ),
          ])
          // Strip data:image/png;base64, prefix
          screenshotData = dataUrl.replace(/^data:image\/\w+;base64,/, "")
          plog("[Presentation] Step %d: screenshot OK (%dms, %d bytes)", nextIndex + 1, Math.round(performance.now() - screenshotStart), screenshotData.length)
        } catch (err) {
          plog("[Presentation] ERROR: Step %d: screenshot FAILED (%dms):", nextIndex + 1, Math.round(performance.now() - screenshotStart), err)
        }
        if (cancelled) {
          plog("[Presentation] Loop break after screenshot: cancelled")
          break
        }

        // Mark done
        actions.completePresentationStep(step.id, screenshotData)
        processedIndexRef.current = nextIndex
        plog("[Presentation] Step %d: marked done, processedIndex=%d", nextIndex + 1, nextIndex)

        // Update current step display
        useOverlayStore.setState({ presentationCurrentStep: nextIndex })

        // Check if all steps for this toolUseId are done → POST completion
        checkAndPostCompletion(getSteps(), step.toolUseId)
      }
      plog("[Presentation] runLoop ended, cancelled=%s, processedIndex=%d", cancelled, processedIndexRef.current)
    }

    runLoop()
    return () => {
      plog("[Presentation] Execution effect cleanup (cancelled)")
      cancelled = true
      unsub()
      currentAnimRef.current?.finish()
      postIncompleteCompletions()
    }
  }, [stepsCount, playerState, presentationActive, editorReady, streamDone])

  // ---- Pause: immediately finish current animation ----
  useEffect(() => {
    if (playerState === "paused" && currentAnimRef.current) {
      currentAnimRef.current.finish()
    }
  }, [playerState])

  // ---- Jump replay (paused state) ----
  const prevCurrentStepRef = useRef(currentStep)
  useEffect(() => {
    if (
      playerState === "paused" &&
      editorRef.current &&
      currentStep !== prevCurrentStepRef.current
    ) {
      const currentSteps = useOverlayStore.getState().presentationSteps
      // Replay to the requested step (limited by what's been executed)
      const lastDoneIndex = currentSteps.reduce(
        (max, s, i) => (s.status === "done" || s.status === "executing" ? i : max),
        -1
      )
      const safeTarget = Math.min(currentStep, lastDoneIndex)
      if (safeTarget >= 0) {
        replayToStep(editorRef.current, currentSteps, safeTarget)
      }
    }
    prevCurrentStepRef.current = currentStep
  }, [currentStep, playerState])

  // ---- Reset on stop ----
  useEffect(() => {
    if (!presentationActive) {
      processedIndexRef.current = -1
    }
  }, [presentationActive])

  // ---- Tldraw mount ----
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    // Reset camera to origin with zoom=1 so tldraw page coords match CSS pixels
    editor.setCamera({ x: 0, y: 0, z: 1 })
    editor.setCameraOptions({ isLocked: true })
    // Trigger execution engine now that editor is ready
    setEditorReady((n) => n + 1)
  }, [])

  // ---- Finish handler (user confirms presentation is done) ----
  const handleFinish = useCallback(() => {
    plog("[Presentation] handleFinish called")
    const editor = editorRef.current
    if (editor) {
      const allShapes = editor.getCurrentPageShapes()
      if (allShapes.length > 0) {
        editor.deleteShapes(allShapes.map((s) => s.id))
      }
    }

    // Flush deferred completions (fully done tool groups)
    flushDeferredCompletions()
    // POST completion for any remaining completed tool groups
    const currentSteps = useOverlayStore.getState().presentationSteps
    plog("[Presentation] handleFinish: steps=%d, statuses=%s", currentSteps.length, JSON.stringify(currentSteps.map(s => ({ id: s.id, status: s.status, toolUseId: s.toolUseId }))))
    const doneToolUseIds = new Set<string>()
    for (const step of currentSteps) {
      if (step.status === "done") doneToolUseIds.add(step.toolUseId)
    }
    plog("[Presentation] handleFinish: doneToolUseIds=%s", JSON.stringify([...doneToolUseIds]))
    for (const toolUseId of doneToolUseIds) {
      postToolCompletion(toolUseId, currentSteps, false)
    }
    // POST error for incomplete groups
    postIncompleteCompletions()

    pflush()
    actions.stopPresentation()
  }, [actions])

  // ---- Exit handler (abort — cancel everything) ----
  const handleExit = useCallback(() => {
    const editor = editorRef.current
    if (editor) {
      const allShapes = editor.getCurrentPageShapes()
      if (allShapes.length > 0) {
        editor.deleteShapes(allShapes.map((s) => s.id))
      }
    }

    // POST error result for ALL tool_use groups (abort)
    _deferredCompletions.clear()
    const currentSteps = useOverlayStore.getState().presentationSteps
    const allToolUseIds = new Set<string>()
    for (const step of currentSteps) {
      allToolUseIds.add(step.toolUseId)
    }
    for (const toolUseId of allToolUseIds) {
      postToolCompletion(toolUseId, currentSteps, true)
    }

    pflush()
    actions.stopPresentation()
  }, [actions])

  if (!presentationActive) return null

  return (
    <div
      id="presentation-overlay-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: DOMZIndex.PresentationLayer,
        pointerEvents: "auto",
      }}
    >
      {/* Semi-transparent backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.06)",
          pointerEvents: "auto",
        }}
      />

      {/* tldraw canvas */}
      <div
        className="presentation-tldraw-container"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        <Tldraw hideUi onMount={handleMount} options={{ maxPages: 1 }} />
      </div>

      {/* Top-right buttons */}
      <div
        id="presentation-exit-btn"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          pointerEvents: "auto",
          zIndex: 1,
          display: "flex",
          gap: 8,
        }}
      >
        {/* Finish button (success — post completions) */}
        <button
          onClick={handleFinish}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 20,
            border: "1px solid rgba(74, 222, 128, 0.3)",
            background: "rgba(10, 10, 14, 0.7)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            transition: "background 0.2s ease-out, transform 0.1s ease-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(34, 197, 94, 0.7)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(10, 10, 14, 0.7)"
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "scale(0.95)"
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1)"
          }}
        >
          <CheckCircle size={14} />
          {t("presentation.finish", "Finish Presentation")}
        </button>

        {/* Exit button (abort — cancel all) */}
        <button
          onClick={handleExit}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            borderRadius: 17,
            border: "1px solid rgba(255, 255, 255, 0.1)",
            background: "rgba(10, 10, 14, 0.7)",
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: 15,
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            transition: "background 0.2s ease-out, transform 0.1s ease-out, color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(220, 50, 50, 0.8)"
            e.currentTarget.style.color = "#fff"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(10, 10, 14, 0.7)"
            e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)"
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "scale(0.92)"
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1)"
          }}
          title={t("presentation.cancel", "Cancel Presentation")}
        >
          ✕
        </button>
      </div>

      {/* Player controls (bottom-center) */}
      <PresentationPlayer />
    </div>
  )
}

// ============================================================================
// Completion helpers
// ============================================================================

/** Track toolUseIds that are fully done but deferred (user paused before POST) */
const _deferredCompletions = new Set<string>()

function checkAndPostCompletion(
  steps: Array<{ id: string; toolUseId: string; status: string; screenshot?: string; toolName: string }>,
  toolUseId: string
) {
  const playerState = useOverlayStore.getState().presentationPlayerState
  plog("[Presentation] checkAndPostCompletion: toolUseId=%s, playerState=%s", toolUseId, playerState)
  if (playerState === "paused") {
    // Defer: remember this toolUseId and POST when user finishes/resumes
    const toolSteps = steps.filter((s) => s.toolUseId === toolUseId)
    const allDone = toolSteps.every((s) => s.status === "done")
    plog("[Presentation] checkAndPostCompletion: PAUSED, toolSteps=%d, allDone=%s", toolSteps.length, allDone)
    if (allDone) {
      _deferredCompletions.add(toolUseId)
    }
    return
  }
  postToolCompletion(toolUseId, steps, false)
}

/** Flush all deferred completions (called when user finishes presentation) */
function flushDeferredCompletions() {
  plog("[Presentation] flushDeferredCompletions: deferred=%d, ids=%s", _deferredCompletions.size, JSON.stringify([..._deferredCompletions]))
  if (_deferredCompletions.size === 0) return
  const steps = useOverlayStore.getState().presentationSteps
  for (const toolUseId of _deferredCompletions) {
    postToolCompletion(toolUseId, steps, false)
  }
  _deferredCompletions.clear()
}

function postToolCompletion(
  toolUseId: string,
  steps: Array<{ toolUseId: string; status: string; screenshot?: string; toolName: string }>,
  isError: boolean
) {
  const toolSteps = steps.filter((s) => s.toolUseId === toolUseId)
  const allDone = toolSteps.every((s) => s.status === "done")
  plog("[Presentation] postToolCompletion: toolUseId=%s, isError=%s, toolSteps=%d, allDone=%s, statuses=%s",
    toolUseId, isError, toolSteps.length, allDone, JSON.stringify(toolSteps.map(s => s.status)))
  if (!allDone && !isError) {
    plog("[Presentation] postToolCompletion: SKIPPED (not all done and not error)")
    return
  }

  const content: ClientToolResultContent[] = [
    { type: "text", text: `Executed ${toolSteps[0]?.toolName ?? "tool"} with ${toolSteps.length} command(s).` },
    ...toolSteps
      .filter((s) => s.screenshot)
      .map((s) => ({
        type: "image" as const,
        data: s.screenshot!.replace(/^data:image\/\w+;base64,/, ""),
        mimeType: "image/png",
      })),
  ]

  const sessionId = useOverlayStore.getState().presentationSessionId
  plog("[Presentation] postToolCompletion: sessionId=%s, content items=%d", sessionId, content.length)

  if (!sessionId) {
    plog("[Presentation] ERROR: postToolCompletion: ABORT - sessionId is empty!")
    return
  }

  // Dynamic import to avoid circular deps and allow gateway client to be added later
  import("@/lib/gateway").then(({ getGatewayClient }) => {
    const client = getGatewayClient() as any
    plog("[Presentation] postToolCompletion: gateway client type=%s, hasCompleteClientTool=%s",
      typeof client, typeof client?.completeClientTool)
    if (typeof client.completeClientTool === "function") {
      plog("[Presentation] postToolCompletion: CALLING completeClientTool(%s)", JSON.stringify({ tool_use_id: toolUseId, session_id: sessionId, isError }))
      client.completeClientTool({
        tool_use_id: toolUseId,
        session_id: sessionId,
        result: { content, isError },
      }).then((res: any) => {
        plog("[Presentation] postToolCompletion: SUCCESS response=%s", JSON.stringify(res))
      }).catch((err: any) => {
        plog("[Presentation] ERROR: postToolCompletion: completeClientTool FAILED:", err)
      })
    } else {
      plog("[Presentation] ERROR: postToolCompletion: completeClientTool NOT FOUND on client!", Object.keys(client || {}))
    }
  }).catch((err) => {
    plog("[Presentation] ERROR: postToolCompletion: dynamic import FAILED:", err)
  })
}
