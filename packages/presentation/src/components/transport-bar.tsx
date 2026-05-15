import { memo, useCallback } from "react"
import type { RefObject } from "react"
import type { PlayerRef } from "@remotion/player"
import type { PresentationStep } from "../types"
import { describeCommand } from "../types"
import { msToFrame } from "../utils/motion"
import { formatTime, getCurrentStepIndex } from "../utils/timeline"
import type { PlaybackState } from "../hooks/use-playback-state"

export interface TransportBarProps {
  playerRef: RefObject<PlayerRef | null>
  steps: PresentationStep[]
  playback: PlaybackState
  fps: number
  totalDurationMs: number
  /** Position: 'top' or 'bottom' (default 'bottom') */
  position?: "top" | "bottom"
}

// ---------------------------------------------------------------------------
// SVG Icons (inline, no dependencies)
// ---------------------------------------------------------------------------

function IconPlay({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}

function IconPause({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="3" width="5" height="18" rx="1" />
      <rect x="14" y="3" width="5" height="18" rx="1" />
    </svg>
  )
}

function IconSkipBack({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="19 18 11 12 19 6 19 18" fill="currentColor" opacity={0.7} />
      <line x1="5" y1="5" x2="5" y2="19" strokeWidth={2.5} />
    </svg>
  )
}

function IconSkipForward({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 6 13 12 5 18 5 6" fill="currentColor" opacity={0.7} />
      <line x1="19" y1="5" x2="19" y2="19" strokeWidth={2.5} />
    </svg>
  )
}

function IconStepBack({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="20 18 12 12 20 6 20 18" fill="currentColor" opacity={0.7} />
      <polygon points="12 18 4 12 12 6 12 18" fill="currentColor" opacity={0.5} />
    </svg>
  )
}

function IconStepForward({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="4 6 12 12 4 18 4 6" fill="currentColor" opacity={0.7} />
      <polygon points="12 6 20 12 12 18 12 6" fill="currentColor" opacity={0.5} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BAR_STYLE: React.CSSProperties = {
  position: "absolute",
  left: 8,
  right: 8,
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  background: "rgba(15, 15, 30, 0.92)",
  backdropFilter: "blur(12px)",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  pointerEvents: "auto",
  zIndex: 100,
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 12,
  color: "rgba(255,255,255,0.9)",
}

const BTN_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 6,
  border: "none",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.85)",
  cursor: "pointer",
  transition: "background 0.15s",
}

const SCRUBBER_STYLE: React.CSSProperties = {
  flex: 1,
  height: 4,
  borderRadius: 2,
  background: "rgba(255,255,255,0.12)",
  cursor: "pointer",
  position: "relative",
  minWidth: 80,
}

/**
 * TransportBar — built-in playback control bar for PresentationPlayer.
 * Renders play/pause, step navigation, scrubber, and time display.
 */
export const TransportBar = memo(function TransportBar({
  playerRef,
  steps,
  playback,
  fps,
  totalDurationMs,
  position = "bottom",
}: TransportBarProps) {
  const { currentMs, isPlaying } = playback

  const togglePlay = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (isPlaying) player.pause()
    else player.play()
  }, [playerRef, isPlaying])

  const seekTo = useCallback((ms: number) => {
    const player = playerRef.current
    if (!player) return
    player.seekTo(msToFrame(Math.max(0, ms), fps))
  }, [playerRef, fps])

  const goToStart = useCallback(() => seekTo(0), [seekTo])
  const goToEnd = useCallback(() => seekTo(totalDurationMs - 100), [seekTo, totalDurationMs])

  const goToPrevStep = useCallback(() => {
    const idx = getCurrentStepIndex(steps, currentMs)
    const prevIdx = Math.max(0, idx - 1)
    seekTo(steps[prevIdx]?.startMs ?? 0)
  }, [steps, currentMs, seekTo])

  const goToNextStep = useCallback(() => {
    const idx = getCurrentStepIndex(steps, currentMs)
    const nextIdx = Math.min(steps.length - 1, idx + 1)
    seekTo(steps[nextIdx]?.startMs ?? 0)
  }, [steps, currentMs, seekTo])

  const handleScrubberClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekTo(ratio * totalDurationMs)
  }, [seekTo, totalDurationMs])

  const progress = totalDurationMs > 0 ? Math.min(1, currentMs / totalDurationMs) : 0
  const currentStepIdx = getCurrentStepIndex(steps, currentMs)
  const activeStep = steps[currentStepIdx]
  const stepLabel = activeStep ? describeCommand(activeStep.command) : ""

  const posStyle = position === "top" ? { top: 8 } : { bottom: 8 }

  return (
    <div style={{ ...BAR_STYLE, ...posStyle }}>
      {/* Skip to start */}
      <button style={BTN_STYLE} onClick={goToStart} title="Go to start">
        <IconSkipBack />
      </button>

      {/* Prev step */}
      <button style={BTN_STYLE} onClick={goToPrevStep} title="Previous step">
        <IconStepBack />
      </button>

      {/* Play/Pause */}
      <button style={{ ...BTN_STYLE, width: 32, height: 32, background: "rgba(99,102,241,0.3)" }} onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
        {isPlaying ? <IconPause /> : <IconPlay />}
      </button>

      {/* Next step */}
      <button style={BTN_STYLE} onClick={goToNextStep} title="Next step">
        <IconStepForward />
      </button>

      {/* Skip to end */}
      <button style={BTN_STYLE} onClick={goToEnd} title="Go to end">
        <IconSkipForward />
      </button>

      {/* Scrubber */}
      <div style={SCRUBBER_STYLE} onClick={handleScrubberClick}>
        <div style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: "100%",
          width: `${progress * 100}%`,
          borderRadius: 2,
          background: "rgba(99,102,241,0.7)",
          transition: isPlaying ? "none" : "width 0.1s",
        }} />
      </div>

      {/* Time display */}
      <span style={{ whiteSpace: "nowrap", opacity: 0.7, fontVariantNumeric: "tabular-nums", minWidth: 70, textAlign: "right" }}>
        {formatTime(currentMs)} / {formatTime(totalDurationMs)}
      </span>

      {/* Active step label */}
      {stepLabel && (
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160, opacity: 0.6, fontSize: 11 }}>
          {stepLabel}
        </span>
      )}
    </div>
  )
})
