import { memo, useCallback, useRef, useMemo } from "react"
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
// SVG Icons — memo'd to avoid re-render on parent updates
// ---------------------------------------------------------------------------

const IconPlay = memo(function IconPlay({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
})

const IconPause = memo(function IconPause({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="3" width="5" height="18" rx="1" />
      <rect x="14" y="3" width="5" height="18" rx="1" />
    </svg>
  )
})

const IconSkipBack = memo(function IconSkipBack({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="19 18 11 12 19 6 19 18" fill="currentColor" opacity={0.7} />
      <line x1="5" y1="5" x2="5" y2="19" strokeWidth={2.5} />
    </svg>
  )
})

const IconSkipForward = memo(function IconSkipForward({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 6 13 12 5 18 5 6" fill="currentColor" opacity={0.7} />
      <line x1="19" y1="5" x2="19" y2="19" strokeWidth={2.5} />
    </svg>
  )
})

const IconStepBack = memo(function IconStepBack({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="20 18 12 12 20 6 20 18" fill="currentColor" opacity={0.7} />
      <polygon points="12 18 4 12 12 6 12 18" fill="currentColor" opacity={0.5} />
    </svg>
  )
})

const IconStepForward = memo(function IconStepForward({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="4 6 12 12 4 18 4 6" fill="currentColor" opacity={0.7} />
      <polygon points="12 6 20 12 12 18 12 6" fill="currentColor" opacity={0.5} />
    </svg>
  )
})

// ---------------------------------------------------------------------------
// Styles (module-level constants — zero GC pressure)
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

const PLAY_BTN_STYLE: React.CSSProperties = {
  ...BTN_STYLE,
  width: 32,
  height: 32,
  background: "rgba(99,102,241,0.3)",
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

const TIME_STYLE: React.CSSProperties = {
  whiteSpace: "nowrap",
  opacity: 0.7,
  fontVariantNumeric: "tabular-nums",
  minWidth: 70,
  textAlign: "right",
}

const LABEL_STYLE: React.CSSProperties = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 160,
  opacity: 0.6,
  fontSize: 11,
}

const SCRUBBER_FILL_BASE: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  height: "100%",
  borderRadius: 2,
  background: "rgba(99,102,241,0.7)",
}

const BAR_STYLE_TOP: React.CSSProperties = { ...BAR_STYLE, top: 8 }
const BAR_STYLE_BOTTOM: React.CSSProperties = { ...BAR_STYLE, bottom: 8 }

const POS_TOP = { top: 8 } as const
const POS_BOTTOM = { bottom: 8 } as const

/**
 * TransportBar — built-in playback control bar for PresentationPlayer.
 * Renders play/pause, step navigation, scrubber, and time display.
 *
 * Optimizations:
 * - Latest-ref pattern for togglePlay (stable callback identity)
 * - Module-level style constants (zero allocation per render)
 * - Memo'd icon components
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

  // Latest-ref pattern: stable togglePlay identity regardless of isPlaying changes
  const playbackRef = useRef(playback)
  playbackRef.current = playback

  const togglePlay = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (playbackRef.current.isPlaying) player.pause()
    else player.play()
  }, [playerRef])

  const seekTo = useCallback((ms: number) => {
    const player = playerRef.current
    if (!player) return
    player.seekTo(msToFrame(Math.max(0, ms), fps))
  }, [playerRef, fps])

  const goToStart = useCallback(() => seekTo(0), [seekTo])
  const goToEnd = useCallback(() => seekTo(totalDurationMs - 100), [seekTo, totalDurationMs])

  const stepsRef = useRef(steps)
  stepsRef.current = steps

  const goToPrevStep = useCallback(() => {
    const s = stepsRef.current
    const idx = getCurrentStepIndex(s, playbackRef.current.currentMs)
    const prevIdx = Math.max(0, idx - 1)
    seekTo(s[prevIdx]?.startMs ?? 0)
  }, [seekTo])

  const goToNextStep = useCallback(() => {
    const s = stepsRef.current
    const idx = getCurrentStepIndex(s, playbackRef.current.currentMs)
    const nextIdx = Math.min(s.length - 1, idx + 1)
    seekTo(s[nextIdx]?.startMs ?? 0)
  }, [seekTo])

  const handleScrubberClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekTo(ratio * totalDurationMs)
  }, [seekTo, totalDurationMs])

  const progress = totalDurationMs > 0 ? Math.min(1, currentMs / totalDurationMs) : 0

  // Memoize step label to avoid describeCommand string formatting every frame
  const prevStepIdxRef = useRef(-1)
  const prevStepLabelRef = useRef("")
  const currentStepIdx = getCurrentStepIndex(steps, currentMs)
  if (currentStepIdx !== prevStepIdxRef.current) {
    prevStepIdxRef.current = currentStepIdx
    const activeStep = steps[currentStepIdx]
    prevStepLabelRef.current = activeStep ? describeCommand(activeStep.command) : ""
  }
  const stepLabel = prevStepLabelRef.current

  const barStyle = position === "top" ? BAR_STYLE_TOP : BAR_STYLE_BOTTOM

  // Scrubber fill: only allocate new style when progress or isPlaying changes
  const scrubberFillStyle = useMemo<React.CSSProperties>(() => ({
    ...SCRUBBER_FILL_BASE,
    width: `${progress * 100}%`,
    transition: isPlaying ? "none" : "width 0.1s",
  }), [progress, isPlaying])

  return (
    <div style={barStyle}>
      <button style={BTN_STYLE} onClick={goToStart} title="Go to start">
        <IconSkipBack />
      </button>

      <button style={BTN_STYLE} onClick={goToPrevStep} title="Previous step">
        <IconStepBack />
      </button>

      <button style={PLAY_BTN_STYLE} onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
        {isPlaying ? <IconPause /> : <IconPlay />}
      </button>

      <button style={BTN_STYLE} onClick={goToNextStep} title="Next step">
        <IconStepForward />
      </button>

      <button style={BTN_STYLE} onClick={goToEnd} title="Go to end">
        <IconSkipForward />
      </button>

      {/* Scrubber */}
      <div style={SCRUBBER_STYLE} onClick={handleScrubberClick}>
        <div style={scrubberFillStyle} />
      </div>

      <span style={TIME_STYLE}>
        {formatTime(currentMs)} / {formatTime(totalDurationMs)}
      </span>

      {stepLabel && (
        <span style={LABEL_STYLE}>
          {stepLabel}
        </span>
      )}
    </div>
  )
})
