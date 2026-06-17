import { memo, useCallback, useRef, useState, useEffect } from "react"
import type { RefObject } from "react"
import type { PlayerRef } from "@remotion/player"
import type { PresentationStep } from "../types"
import { describeCommand } from "../types"
import { msToFrame } from "../utils/motion"
import { formatTime, getCurrentStepIndex } from "../utils/timeline"
import type { PlaybackState } from "../hooks/use-playback-state"
import { IconPlay, IconPause, IconSkipBack, IconSkipForward, IconStepBack, IconStepForward } from "./playback-console/icons"

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
// Module-level constants (zero GC pressure at 60fps)
// ---------------------------------------------------------------------------

const NOISE_BG = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

const TICK_INDICES = Array.from({ length: 9 }, (_, i) => i)

const BAR_BASE: React.CSSProperties = {
  position: "absolute",
  left: 16,
  right: 16,
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 14px",
  background: "rgba(8, 10, 22, 0.92)",
  backdropFilter: "blur(24px)",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.1)",
  pointerEvents: "auto",
  zIndex: 100,
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 12,
  color: "rgba(255,255,255,0.9)",
  overflow: "hidden",
}

const BAR_STYLE_TOP: React.CSSProperties = { ...BAR_BASE, top: 12 }
const BAR_STYLE_BOTTOM: React.CSSProperties = { ...BAR_BASE, bottom: 12 }

const NOISE_OVERLAY_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "inherit",
  opacity: 0.03,
  backgroundImage: NOISE_BG,
  pointerEvents: "none",
}

const TRANSPORT_CLUSTER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  flexShrink: 0,
}

const GHOST_BTN_STYLE: React.CSSProperties = {
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 5,
  border: "none",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.6)",
  cursor: "pointer",
  padding: 0,
}

const PLAY_BTN_BASE: React.CSSProperties = {
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 7,
  color: "#fff",
  cursor: "pointer",
  padding: 0,
}

const PLAY_BTN_PLAYING: React.CSSProperties = {
  ...PLAY_BTN_BASE,
  border: "1px solid rgba(99,102,241,0.5)",
  background: "radial-gradient(circle at center, rgba(99,102,241,0.3), rgba(99,102,241,0.15))",
  boxShadow: "0 0 8px rgba(99,102,241,0.3)",
}

const PLAY_BTN_PAUSED: React.CSSProperties = {
  ...PLAY_BTN_BASE,
  border: "1px solid rgba(99,102,241,0.7)",
  background: "rgba(99,102,241,0.3)",
  boxShadow: "none",
}

const METADATA_STYLE: React.CSSProperties = {
  minWidth: 100,
  flex: "0 1 180px",
  overflow: "hidden",
}

const STEP_LABEL_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#fff",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  lineHeight: 1.2,
  letterSpacing: 0.1,
}

const TIME_CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 9,
  color: "rgba(255,255,255,0.35)",
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1,
}

const CURRENT_TIME_STYLE: React.CSSProperties = {
  color: "rgba(255,255,255,0.75)",
  fontWeight: 600,
  fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', monospace",
  fontSize: 10,
  letterSpacing: -0.3,
}

const SCRUBBER_CONTAINER_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 100,
  display: "flex",
  alignItems: "center",
  position: "relative",
  height: 24,
}

const TRACK_BG_STYLE: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "50%",
  transform: "translateY(-50%)",
  height: 5,
  borderRadius: 3,
  background: "rgba(255,255,255,0.06)",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4), inset 0 0 0 0.5px rgba(255,255,255,0.05)",
}

const TICK_STYLE_BASE: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: 1,
  height: 8,
  borderRadius: 0.5,
  background: "rgba(255,255,255,0.06)",
  pointerEvents: "none",
}

const PROGRESS_FILL_BASE: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: "50%",
  transform: "translateY(-50%)",
  height: 5,
  borderRadius: 3,
  transition: "width 80ms linear",
}

const PROGRESS_FILL_PLAYING: React.CSSProperties = {
  ...PROGRESS_FILL_BASE,
  background: "linear-gradient(90deg, rgba(99,102,241,0.5) 0%, rgba(99,102,241,0.8) 60%, rgba(139,92,246,0.9) 100%)",
  boxShadow: "0 0 8px rgba(99,102,241,0.3), 0 1px 2px rgba(0,0,0,0.2)",
}

const PROGRESS_FILL_PAUSED: React.CSSProperties = {
  ...PROGRESS_FILL_BASE,
  background: "linear-gradient(90deg, rgba(99,102,241,0.4) 0%, rgba(99,102,241,0.6) 100%)",
  boxShadow: "0 0 4px rgba(99,102,241,0.15)",
}

const GLOW_TRAIL_BASE: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: 12,
  height: 5,
  borderRadius: 3,
  background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.6))",
  filter: "blur(2px)",
  pointerEvents: "none",
  transition: "left 80ms linear",
}

const HOVER_INDICATOR_BASE: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: 1,
  height: 14,
  background: "rgba(255,255,255,0.3)",
  borderRadius: 0.5,
  pointerEvents: "none",
}

const THUMB_BASE: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "radial-gradient(circle at 30% 30%, #a78bfa, #6366f1)",
  border: "2px solid rgba(255,255,255,0.95)",
  boxShadow: "0 0 6px rgba(99,102,241,0.5), 0 1px 3px rgba(0,0,0,0.3)",
  transition: "left 80ms linear, transform 0.15s ease",
  pointerEvents: "none",
}

const RANGE_INPUT_STYLE: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: 24,
  opacity: 0,
  cursor: "pointer",
  zIndex: 1,
}

const STATUS_DOT_PLAYING: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#6366f1",
  boxShadow: "0 0 6px rgba(99,102,241,0.6), 0 0 2px rgba(99,102,241,0.8)",
  transition: "all 0.2s ease",
  flexShrink: 0,
}

const STATUS_DOT_PAUSED: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.2)",
  boxShadow: "none",
  transition: "all 0.2s ease",
  flexShrink: 0,
}

const BORDER_GLOW_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "inherit",
  border: "1px solid rgba(99,102,241,0.15)",
  boxShadow: "inset 0 0 12px rgba(99,102,241,0.04), 0 0 8px rgba(99,102,241,0.06)",
  pointerEvents: "none",
}

/**
 * TransportBar — built-in playback control bar for PresentationPlayer.
 * Visually polished to match the IsolatedPlaybackConsole collapsed state.
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
  const scrubRef = useRef<HTMLDivElement>(null)
  const [hoverPct, setHoverPct] = useState<number | null>(null)

  const playbackRef = useRef(playback)
  playbackRef.current = playback

  const togglePlay = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (playbackRef.current.isPlaying) {
      player.pause()
    } else {
      // If at the end, seek to start before playing
      const frame = player.getCurrentFrame()
      const totalFrames = Math.max(1, msToFrame(totalDurationMs, fps))
      if (frame >= totalFrames - 1) {
        player.seekTo(0)
      }
      player.play()
    }
  }, [playerRef, totalDurationMs, fps])

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

  useEffect(() => {
    const el = scrubRef.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      setHoverPct(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 100)
    }
    const onLeave = () => setHoverPct(null)
    el.addEventListener("mousemove", onMove)
    el.addEventListener("mouseleave", onLeave)
    return () => {
      el.removeEventListener("mousemove", onMove)
      el.removeEventListener("mouseleave", onLeave)
    }
  }, [])

  const handleScrubChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(Number(e.currentTarget.value))
  }, [seekTo])

  const progressPct = totalDurationMs > 0 ? Math.min(100, (currentMs / totalDurationMs) * 100) : 0

  // Step label (memoized to avoid describeCommand every frame)
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

  return (
    <div style={barStyle}>
      <div style={NOISE_OVERLAY_STYLE} />

      {/* Transport cluster */}
      <div style={TRANSPORT_CLUSTER_STYLE}>
        <button type="button" title="Skip to start" aria-label="Skip to start" onClick={goToStart} style={GHOST_BTN_STYLE}>
          <IconSkipBack size={10} />
        </button>
        <button type="button" title="Previous step" aria-label="Previous step" onClick={goToPrevStep} style={GHOST_BTN_STYLE}>
          <IconStepBack size={10} />
        </button>
        <button type="button" title={isPlaying ? "Pause" : "Play"} aria-label={isPlaying ? "Pause" : "Play"} onClick={togglePlay} style={isPlaying ? PLAY_BTN_PLAYING : PLAY_BTN_PAUSED}>
          {isPlaying ? <IconPause size={11} /> : <IconPlay size={11} />}
        </button>
        <button type="button" title="Next step" aria-label="Next step" onClick={goToNextStep} style={GHOST_BTN_STYLE}>
          <IconStepForward size={10} />
        </button>
        <button type="button" title="Skip to end" aria-label="Skip to end" onClick={goToEnd} style={GHOST_BTN_STYLE}>
          <IconSkipForward size={10} />
        </button>
      </div>

      {/* Step metadata */}
      <div style={METADATA_STYLE}>
        {stepLabel && <div style={STEP_LABEL_STYLE}>{stepLabel}</div>}
        <div style={{ ...TIME_CONTAINER_STYLE, marginTop: stepLabel ? 1 : 0 }}>
          <span style={CURRENT_TIME_STYLE}>{formatTime(currentMs)}</span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span>{formatTime(totalDurationMs)}</span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>{Math.min(currentStepIdx + 1, steps.length)}/{steps.length}</span>
        </div>
      </div>

      {/* Rich scrubber */}
      <div ref={scrubRef} style={SCRUBBER_CONTAINER_STYLE}>
        <div style={TRACK_BG_STYLE} />
        {TICK_INDICES.map((i) => (
          <div key={i} style={{ ...TICK_STYLE_BASE, left: `${(i + 1) * 10}%` }} />
        ))}
        <div style={{ ...(isPlaying ? PROGRESS_FILL_PLAYING : PROGRESS_FILL_PAUSED), width: `${progressPct}%` }} />
        {isPlaying && totalDurationMs > 0 && (
          <div style={{ ...GLOW_TRAIL_BASE, left: `calc(${progressPct}% - 12px)` }} />
        )}
        {hoverPct !== null && (
          <div style={{ ...HOVER_INDICATOR_BASE, left: `${hoverPct}%` }} />
        )}
        <div style={{ ...THUMB_BASE, left: `${progressPct}%` }} />
        <input
          aria-label="Playback progress"
          type="range"
          min={0}
          max={totalDurationMs}
          value={Math.min(currentMs, totalDurationMs)}
          onChange={handleScrubChange}
          style={RANGE_INPUT_STYLE}
        />
      </div>

      <span style={isPlaying ? STATUS_DOT_PLAYING : STATUS_DOT_PAUSED} title={isPlaying ? "Playing" : "Paused"} />

      {isPlaying && <div style={BORDER_GLOW_STYLE} />}
    </div>
  )
})
