import { useEffect, useRef, useCallback } from "react"
import { Tldraw } from "tldraw"
import type { Editor } from "tldraw"
import "tldraw/tldraw.css"
import "./presentation-layer.css"
import { useOverlayStore } from "@/stores/overlay-store"
import { animateCommand, replayToStep } from "@/lib/presentation/command-animator"
import type { AnimationHandle } from "@/lib/presentation/command-animator"
import { DOMZIndex } from "@/types/overlay"
import { PresentationPlayer } from "./presentation-player"
import { invoke } from "@tauri-apps/api/core"
import type { ClientToolResultContent } from "@/lib/client-side-tool/types"

interface ScreenshotResult {
  data: string
  width: number
  height: number
}

/** Current session ID for completion callbacks — set by use-agent-conversation */
let _currentSessionId = ""
export function setCurrentSessionId(id: string) {
  _currentSessionId = id
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

  const stepsCount = steps.length

  // ---- Execution engine ----
  useEffect(() => {
    if (!presentationActive || playerState !== "playing" || !editorRef.current) return

    const getSteps = () => useOverlayStore.getState().presentationSteps
    const getPlayerState = () => useOverlayStore.getState().presentationPlayerState
    let cancelled = false

    const runLoop = async () => {
      while (!cancelled) {
        if (getPlayerState() !== "playing") break

        const currentSteps = getSteps()
        const nextIndex = processedIndexRef.current + 1

        if (nextIndex >= currentSteps.length) break
        const step = currentSteps[nextIndex]
        if (step.status !== "pending") {
          processedIndexRef.current = nextIndex
          continue
        }

        // Mark executing
        actions.updateStepStatus(step.id, "executing")

        // Animate
        const anim = animateCommand(editorRef.current!, step.command)
        currentAnimRef.current = anim
        await anim.done
        currentAnimRef.current = null

        if (cancelled || getPlayerState() !== "playing") break

        // Screenshot: hide overlay -> capture -> restore
        const overlayEl = document.getElementById("presentation-overlay-root")
        if (overlayEl) overlayEl.style.visibility = "hidden"

        let screenshotData = ""
        try {
          const result = await invoke<ScreenshotResult>("take_screenshot", { hideWindow: false })
          screenshotData = result.data
        } catch {
          // Screenshot failed, continue without it
        }

        if (overlayEl) overlayEl.style.visibility = "visible"
        if (cancelled) break

        // Mark done
        actions.completePresentationStep(step.id, screenshotData)
        processedIndexRef.current = nextIndex

        // Update current step display (only if still playing)
        if (getPlayerState() === "playing") {
          useOverlayStore.setState({ presentationCurrentStep: nextIndex })
        }

        // Check if all steps for this toolUseId are done -> POST completion
        checkAndPostCompletion(getSteps(), step.id)
      }
    }

    runLoop()
    return () => { cancelled = true }
  }, [stepsCount, playerState, presentationActive])

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
      const safeTarget = Math.min(currentStep, processedIndexRef.current)
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
    editor.setCameraOptions({ isLocked: true })
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
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)" }} />

      {/* tldraw canvas */}
      <div
        className="presentation-tldraw-container"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <Tldraw hideUi onMount={handleMount} options={{ maxPages: 1 }} />
      </div>

      {/* Exit button (top-right) */}
      <button
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
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220,50,50,0.8)" }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.6)" }}
        onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)" }}
        onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)" }}
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
  completedStepId: string
) {
  const step = steps.find((s) => s.id === completedStepId)
  if (!step) return
  postToolCompletion(step.toolUseId, steps, false)
}

function postToolCompletion(
  toolUseId: string,
  steps: Array<{ toolUseId: string; status: string; screenshot?: string; toolName: string }>,
  isError: boolean
) {
  const toolSteps = steps.filter((s) => s.toolUseId === toolUseId)
  if (!toolSteps.every((s) => s.status === "done") && !isError) return
  if (!_currentSessionId) return

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

  // Dynamic import to avoid circular dependency
  import("@/lib/gateway").then(({ getGatewayClient }) => {
    const client = getGatewayClient() as any
    client.completeClientTool({
      tool_use_id: toolUseId,
      session_id: _currentSessionId,
      result: { content, isError },
    })
  })
}
