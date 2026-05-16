import { useEffect, useRef, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { Tldraw } from "tldraw"
import type { Editor } from "tldraw"
import "tldraw/tldraw.css"
import "./presentation-layer.css"
import { toPng } from "html-to-image"
import { CheckCircle } from "lucide-react"
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
