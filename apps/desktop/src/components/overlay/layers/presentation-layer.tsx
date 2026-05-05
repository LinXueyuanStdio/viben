import { useEffect, useRef, useCallback, useState } from "react"
import { Tldraw } from "tldraw"
import type { Editor } from "tldraw"
import "tldraw/tldraw.css"
import "./presentation-layer.css"
import { useOverlayStore } from "@/stores/overlay-store"
import { animateCommand, replayToStep } from "@/lib/presentation/command-animator"
import { DOMZIndex } from "@/types/overlay"
import type { AnimationHandle } from "@/lib/presentation/command-animator"
import type { ClientToolResultContent } from "@/lib/client-side-tool/types"
import { PresentationPlayer } from "./presentation-player"

interface ScreenshotResult {
  data: string
  width: number
  height: number
}

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

  // ---- Execution engine ----
  // When playerState changes to "playing", sync processedIndexRef with currentStep
  // so that resuming after a rewind re-animates from the rewound position.
  useEffect(() => {
    if (playerState === "playing") {
      const storeCurrentStep = useOverlayStore.getState().presentationCurrentStep
      // If user rewound (currentStep < processedIndex), reset processedIndex
      if (storeCurrentStep - 1 < processedIndexRef.current) {
        processedIndexRef.current = storeCurrentStep - 1
      }
    }
  }, [playerState])

  useEffect(() => {
    if (!presentationActive || playerState !== "playing" || !editorRef.current) return

    const editor = editorRef.current
    const getSteps = () => useOverlayStore.getState().presentationSteps
    const getPlayerState = () => useOverlayStore.getState().presentationPlayerState
    let cancelled = false

    const runLoop = async () => {
      while (!cancelled) {
        if (getPlayerState() !== "playing") break

        const currentSteps = getSteps()
        const nextIndex = processedIndexRef.current + 1

        // No more steps yet — wait for new ones to arrive
        if (nextIndex >= currentSteps.length) break
        const step = currentSteps[nextIndex]

        // Mark executing (reset status if it was previously done)
        actions.updateStepStatus(step.id, "executing")

        // Animate
        const anim = animateCommand(editor, step.command)
        currentAnimRef.current = anim
        await anim.done
        currentAnimRef.current = null

        if (cancelled || getPlayerState() !== "playing") break

        // Screenshot: hide player controls only, keep tldraw canvas visible
        const playerEl = document.getElementById("presentation-player-controls")
        const exitBtn = document.getElementById("presentation-exit-btn")
        if (playerEl) playerEl.style.visibility = "hidden"
        if (exitBtn) exitBtn.style.visibility = "hidden"
        // Wait one frame for repaint
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

        let screenshotData = ""
        try {
          const { invoke } = await import("@tauri-apps/api/core")
          const result = await invoke<ScreenshotResult>("take_screenshot", { hideWindow: false })
          screenshotData = result.data
        } catch {
          // Screenshot failed, continue without it
        }

        if (playerEl) playerEl.style.visibility = "visible"
        if (exitBtn) exitBtn.style.visibility = "visible"
        if (cancelled) break

        // Mark done
        actions.completePresentationStep(step.id, screenshotData)
        processedIndexRef.current = nextIndex

        // Update current step display
        useOverlayStore.setState({ presentationCurrentStep: nextIndex })

        // Check if all steps for this toolUseId are done → POST completion
        checkAndPostCompletion(getSteps(), step.toolUseId)
      }
    }

    runLoop()
    return () => {
      cancelled = true
      currentAnimRef.current?.finish()
      postIncompleteCompletions()
    }
  }, [stepsCount, playerState, presentationActive, editorReady])

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

  // ---- Exit handler ----
  const handleExit = useCallback(() => {
    const editor = editorRef.current
    if (editor) {
      const allShapes = editor.getCurrentPageShapes()
      if (allShapes.length > 0) {
        editor.deleteShapes(allShapes.map((s) => s.id))
      }
    }

    // POST error result for any incomplete tool_use groups
    postIncompleteCompletions()

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
          background: "rgba(0,0,0,0.15)",
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

      {/* Exit button (top-right) */}
      <button
        id="presentation-exit-btn"
        onClick={handleExit}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          pointerEvents: "auto",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          transition: "background 0.2s, transform 0.1s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(220,50,50,0.8)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(0,0,0,0.6)"
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "scale(0.95)"
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "scale(1)"
        }}
      >
        <span style={{ fontSize: 16 }}>✕</span>
        退出演示
      </button>

      {/* Player controls (bottom-center) */}
      <PresentationPlayer />
    </div>
  )
}

// ============================================================================
// Completion helpers
// ============================================================================

function checkAndPostCompletion(
  steps: Array<{ id: string; toolUseId: string; status: string; screenshot?: string; toolName: string }>,
  toolUseId: string
) {
  postToolCompletion(toolUseId, steps, false)
}

function postToolCompletion(
  toolUseId: string,
  steps: Array<{ toolUseId: string; status: string; screenshot?: string; toolName: string }>,
  isError: boolean
) {
  const toolSteps = steps.filter((s) => s.toolUseId === toolUseId)
  if (!toolSteps.every((s) => s.status === "done") && !isError) return

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

  // Dynamic import to avoid circular deps and allow gateway client to be added later
  import("@/lib/gateway").then(({ getGatewayClient }) => {
    const client = getGatewayClient() as any
    if (typeof client.completeClientTool === "function") {
      client.completeClientTool({
        tool_use_id: toolUseId,
        session_id: sessionId,
        result: { content, isError },
      })
    }
  }).catch((err) => {
    console.warn("[Presentation] Failed to POST tool completion:", err)
  })
}
