import { useEffect, useRef, useCallback } from "react"
import { Tldraw } from "tldraw"
import type { Editor } from "tldraw"
import "tldraw/tldraw.css"
import "./presentation-layer.css"
import { useOverlayStore } from "@/stores/overlay-store"
import { executeCommand } from "@/lib/presentation/command-executor"
import { DOMZIndex } from "@/types/overlay"

export function PresentationLayer() {
  const presentationActive = useOverlayStore((s) => s.presentationActive)
  const commands = useOverlayStore((s) => s.presentationCommands)
  const { stopPresentation, clearPresentationCommands } = useOverlayStore((s) => s.actions)
  const editorRef = useRef<Editor | null>(null)
  const processedCountRef = useRef(0)

  // Process new commands as they arrive
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !presentationActive) return

    const newCommands = commands.slice(processedCountRef.current)
    if (newCommands.length === 0) return

    // Execute new commands sequentially with delays
    let cancelled = false
    const run = async () => {
      for (const cmd of newCommands) {
        if (cancelled) break
        if (cmd.type === "wait") {
          await new Promise((r) => setTimeout(r, cmd.ms))
        } else {
          executeCommand(editor, cmd)
          await new Promise((r) => setTimeout(r, 50))
        }
      }
    }
    processedCountRef.current = commands.length
    run()

    return () => {
      cancelled = true
    }
  }, [commands, presentationActive])

  // Reset processed count when presentation starts/stops
  useEffect(() => {
    if (!presentationActive) {
      processedCountRef.current = 0
    }
  }, [presentationActive])

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    // Lock camera to prevent scroll/zoom
    editor.setCameraOptions({ isLocked: true })
  }, [])

  const handleExit = useCallback(() => {
    // Clear tldraw canvas
    const editor = editorRef.current
    if (editor) {
      const allShapes = editor.getCurrentPageShapes()
      if (allShapes.length > 0) {
        editor.deleteShapes(allShapes.map((s) => s.id))
      }
    }
    clearPresentationCommands()
    stopPresentation()
  }, [clearPresentationCommands, stopPresentation])

  if (!presentationActive) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: DOMZIndex.PresentationLayer,
        pointerEvents: "none",
      }}
    >
      {/* tldraw canvas — transparent background, no UI, no interaction */}
      <div
        className="presentation-tldraw-container"
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <Tldraw
          hideUi
          onMount={handleMount}
          options={{ maxPages: 1 }}
        />
      </div>

      {/* Exit button — top-right, interactive */}
      <button
        onClick={handleExit}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          pointerEvents: "auto",
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
    </div>
  )
}
