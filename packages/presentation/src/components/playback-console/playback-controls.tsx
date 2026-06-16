import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import type { PresentationStep } from "../../types"
import { formatTime, commandColor } from "../../utils/timeline"
import { msToFrame } from "../../utils/motion"
import { ConsoleButton } from "./console-button"
import {
  IconSkipBack,
  IconSkipForward,
  IconStepBack,
  IconStepForward,
  IconPlay,
  IconPause,
  IconFrameBack,
  IconFrameForward,
  IconChevronUp,
  IconLoop,
} from "./icons"
import { PLAYBACK_SPEEDS, DEFAULT_FPS } from "./styles"

function formatTimeWithFlashingColon(ms: number, isPlaying: boolean): string {
  const safeMs = Math.max(0, Math.round(ms))
  const totalSeconds = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const tenths = Math.floor((safeMs % 1000) / 100)
  const colonVisible = !isPlaying || Math.floor(safeMs / 500) % 2 === 0
  const colon = colonVisible ? ":" : " "
  return `${minutes}${colon}${seconds.toString().padStart(2, "0")}.${tenths}`
}

export function WaveformProgressBar({ progress, totalDurationMs }: { progress: number; totalDurationMs: number }) {
  const barCount = 40
  const bars = useMemo(() => {
    const result: number[] = []
    for (let i = 0; i < barCount; i++) {
      const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453
      result.push(0.2 + (seed - Math.floor(seed)) * 0.8)
    }
    return result
  }, [totalDurationMs]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        height: 8,
        marginTop: 4,
        borderRadius: 4,
        background: "rgba(255,255,255,0.04)",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-end",
        gap: 1,
        padding: "0 1px",
        position: "relative",
      }}
    >
      {bars.map((h, i) => {
        const barProgress = (i / barCount) * 100
        const isBeforePlayhead = barProgress < progress
        return (
          <div
            key={i}
            className="pbc-waveform-bar"
            style={{
              flex: 1,
              height: `${h * 100}%`,
              background: isBeforePlayhead
                ? "linear-gradient(180deg, #76B900, #38BDF8)"
                : "rgba(255,255,255,0.12)",
              opacity: isBeforePlayhead ? 0.8 : 0.4,
              transition: "background 80ms linear, opacity 80ms linear",
            }}
          />
        )
      })}
    </div>
  )
}

export function PlaybackControls({
  title,
  currentMs,
  totalDurationMs,
  currentStepIndex,
  totalSteps,
  activeSteps,
  isPlaying,
  isLooping,
  playbackRate,
  fps = DEFAULT_FPS,
  onSeek,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onGoToStart,
  onGoToEnd,
  onToggleLoop,
  onSetPlaybackRate,
  onFrameStep,
}: {
  title: string
  currentMs: number
  totalDurationMs: number
  currentStepIndex: number
  totalSteps: number
  activeSteps: PresentationStep[]
  isPlaying: boolean
  isLooping: boolean
  playbackRate: number
  fps?: number
  onSeek: (ms: number) => void
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrevious: () => void
  onGoToStart: () => void
  onGoToEnd: () => void
  onToggleLoop: () => void
  onSetPlaybackRate: (rate: number) => void
  onFrameStep: (direction: 1 | -1) => void
}) {
  const progress = totalDurationMs > 0 ? Math.min(100, (currentMs / totalDurationMs) * 100) : 0
  const progressFraction = totalDurationMs > 0 ? Math.min(1, currentMs / totalDurationMs) : 0
  const currentFrame = msToFrame(currentMs, fps)
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false)
  const [showRemaining, setShowRemaining] = useState(false)
  // Time display mode: time | frame | percentage
  type TimeDisplayMode = "time" | "frame" | "percent"
  const [timeDisplayMode, setTimeDisplayMode] = useState<TimeDisplayMode>("time")
  // Loop count (increments each time we loop)
  const [loopCount, setLoopCount] = useState(0)
  const prevMsRef = useRef(currentMs)

  // Detect loop (time jumps backward significantly while looping)
  useEffect(() => {
    if (isLooping && prevMsRef.current > currentMs + 500) {
      setLoopCount((c) => c + 1)
    }
    prevMsRef.current = currentMs
  }, [currentMs, isLooping])

  // Reset loop count when loop disabled
  useEffect(() => {
    if (!isLooping) setLoopCount(0)
  }, [isLooping])

  // Circular progress ring params
  const ringRadius = 20
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset = ringCircumference * (1 - progressFraction)

  // Speed dial rotation: map speed to angle
  const speedAngle = useMemo(() => {
    const idx = PLAYBACK_SPEEDS.indexOf(playbackRate as typeof PLAYBACK_SPEEDS[number])
    return idx >= 0 ? (idx / (PLAYBACK_SPEEDS.length - 1)) * 270 - 135 : 0
  }, [playbackRate])

  // Cycle speed on badge click
  const cycleSpeed = useCallback(() => {
    const idx = PLAYBACK_SPEEDS.indexOf(playbackRate as typeof PLAYBACK_SPEEDS[number])
    const nextIdx = (idx + 1) % PLAYBACK_SPEEDS.length
    onSetPlaybackRate(PLAYBACK_SPEEDS[nextIdx])
  }, [playbackRate, onSetPlaybackRate])

  // Cycle time display mode
  const cycleTimeDisplay = useCallback(() => {
    setTimeDisplayMode((m) => m === "time" ? "frame" : m === "frame" ? "percent" : "time")
  }, [])

  return (
    <section
      aria-label="Playback controls"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
      }}
    >
      {/* Header: title */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
      </div>

      {/* Time display — prominent monospace with glow, click to cycle time/frame/percent */}
      <div
        onClick={cycleTimeDisplay}
        title="Click to cycle: time / frame / percentage"
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          fontVariantNumeric: "tabular-nums",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span
          className={isPlaying ? "pbc-time-glow" : ""}
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: -0.5,
            fontFamily: "SFMono-Regular, Consolas, monospace",
            lineHeight: 1,
          }}
        >
          {timeDisplayMode === "time" ? (
            <>
              {formatTimeWithFlashingColon(currentMs, isPlaying)}
            </>
          ) : timeDisplayMode === "frame" ? (
            <>F{currentFrame}</>
          ) : (
            <>{(progressFraction * 100).toFixed(1)}%</>
          )}
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
          / {timeDisplayMode === "time" ? formatTime(totalDurationMs) : timeDisplayMode === "frame" ? `F${msToFrame(totalDurationMs, fps)}` : "100%"}
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); setShowRemaining((p) => !p) }}
          title="Click to toggle remaining time"
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            fontFamily: "SFMono-Regular, Consolas, monospace",
            marginLeft: 2,
            cursor: "pointer",
            padding: "1px 4px",
            borderRadius: 3,
            background: showRemaining ? "rgba(118,185,0,0.1)" : "transparent",
          }}
        >
          ({showRemaining ? `-${formatTime(Math.max(0, totalDurationMs - currentMs))}` : formatTime(Math.max(0, totalDurationMs - currentMs))})
        </span>
      </div>

      {/* Scrub slider + waveform progress bar */}
      <div style={{ position: "relative" }}>
        <input
          className="pbc-range"
          aria-label="Presentation progress"
          type="range"
          min={0}
          max={totalDurationMs}
          value={Math.min(currentMs, totalDurationMs)}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
        />
        {/* Waveform-style progress background */}
        <WaveformProgressBar progress={progress} totalDurationMs={totalDurationMs} />
      </div>

      {/* Transport buttons with circular ring around play/pause */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <ConsoleButton title="Go to start  [Home]" icon={<IconSkipBack size={12} />} onClick={onGoToStart} aria-label="Go to start" style={{ color: "#F59E0B" }} />
        <ConsoleButton title="Previous step  [Left]" icon={<IconStepBack size={12} />} onClick={onPrevious} aria-label="Previous step" style={{ color: "#76B900" }} />
        <ConsoleButton title="Frame back  [,]" icon={<IconFrameBack size={11} />} onClick={() => onFrameStep(-1)} aria-label="Frame back" style={{ color: "rgba(255,255,255,0.6)" }} />

        {/* Play/Pause with circular progress ring + rate badge */}
        <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg
            width={44}
            height={44}
            style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}
          >
            <circle
              cx={22}
              cy={22}
              r={ringRadius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={2.5}
            />
            <circle
              className="pbc-progress-ring"
              cx={22}
              cy={22}
              r={ringRadius}
              fill="none"
              stroke="#76B900"
              strokeWidth={2.5}
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 3px rgba(118,185,0,0.5))" }}
            />
          </svg>
          <button
            className="pbc-btn pbc-btn-primary pbc-play-btn"
            type="button"
            title={isPlaying ? "Pause  [Space]" : "Play  [Space]"}
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={isPlaying ? onPause : onPlay}
            style={{
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(118,185,0,0.7)",
              borderRadius: "50%",
              background: "rgba(118,185,0,0.22)",
              color: "#fff",
              cursor: "pointer",
              padding: 0,
              zIndex: 1,
            }}
          >
            {isPlaying ? <IconPause size={14} /> : <IconPlay size={14} />}
          </button>
          {/* Playback rate badge — click to cycle speeds */}
          {playbackRate !== 1 && (
            <span
              onClick={(e) => { e.stopPropagation(); cycleSpeed() }}
              title="Click to cycle playback speed"
              style={{
                position: "absolute",
                top: -4,
                right: -6,
                fontSize: 8,
                fontWeight: 800,
                fontFamily: "SFMono-Regular, Consolas, monospace",
                padding: "1px 4px",
                borderRadius: 4,
                background: "rgba(118,185,0,0.9)",
                color: "#000",
                cursor: "pointer",
                zIndex: 2,
                lineHeight: 1.3,
              }}
            >
              {playbackRate}x
            </span>
          )}
        </div>

        <ConsoleButton title="Frame forward  [.]" icon={<IconFrameForward size={11} />} onClick={() => onFrameStep(1)} aria-label="Frame forward" style={{ color: "rgba(255,255,255,0.6)" }} />
        <ConsoleButton title="Next step  [Right]" icon={<IconStepForward size={12} />} onClick={onNext} aria-label="Next step" style={{ color: "#76B900" }} />
        <ConsoleButton title="Go to end  [End]" icon={<IconSkipForward size={12} />} onClick={onGoToEnd} aria-label="Go to end" style={{ color: "#F59E0B" }} />
      </div>

      {/* Speed + Loop row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {/* Speed selector with dial visual */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
          {/* Dial indicator */}
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: playbackRate !== 1 ? "2px solid rgba(118,185,0,0.5)" : "2px solid rgba(255,255,255,0.12)",
              background: playbackRate !== 1 ? "rgba(118,185,0,0.08)" : "rgba(255,255,255,0.03)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              className="pbc-speed-dial"
              style={{
                width: 2,
                height: 9,
                borderRadius: 1,
                background: playbackRate !== 1 ? "#76B900" : "rgba(255,255,255,0.4)",
                transformOrigin: "center bottom",
                transform: `rotate(${speedAngle}deg)`,
              }}
            />
          </div>
          <button
            className="pbc-btn pbc-btn-ghost"
            type="button"
            title="Playback speed"
            aria-label={`Playback speed: ${playbackRate}x`}
            onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
            style={{
              height: 26,
              padding: "0 8px",
              display: "flex",
              alignItems: "center",
              gap: 4,
              borderRadius: 6,
              border: playbackRate !== 1 ? "1px solid rgba(118,185,0,0.4)" : "1px solid rgba(255,255,255,0.1)",
              background: playbackRate !== 1 ? "rgba(118,185,0,0.1)" : "rgba(255,255,255,0.05)",
              color: playbackRate !== 1 ? "#76B900" : "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "SFMono-Regular, Consolas, monospace",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {playbackRate}x
            <IconChevronUp size={9} />
          </button>
          {speedMenuOpen && (
            <div className="pbc-speed-menu">
              {PLAYBACK_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className={`pbc-speed-option ${speed === playbackRate ? "pbc-speed-option-active" : ""}`}
                  onClick={() => { onSetPlaybackRate(speed); setSpeedMenuOpen(false) }}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loop toggle with pulse and loop count */}
        <button
          className={`pbc-btn pbc-btn-ghost ${isLooping ? "pbc-loop-pulse" : ""}`}
          type="button"
          title={`Loop: ${isLooping ? "ON" : "OFF"}  [L]${isLooping && loopCount > 0 ? ` (${loopCount} loops)` : ""}`}
          aria-label={`Loop ${isLooping ? "enabled" : "disabled"}`}
          onClick={onToggleLoop}
          style={{
            width: 30,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
            border: isLooping ? "1px solid rgba(118,185,0,0.5)" : "1px solid rgba(255,255,255,0.1)",
            background: isLooping ? "rgba(118,185,0,0.15)" : "rgba(255,255,255,0.05)",
            color: isLooping ? "#76B900" : "rgba(255,255,255,0.5)",
            cursor: "pointer",
            padding: 0,
            position: "relative",
          }}
        >
          <IconLoop size={13} active={isLooping} />
          {isLooping && (
            <span style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 12,
              height: 12,
              borderRadius: 6,
              background: "#76B900",
              boxShadow: "0 0 6px rgba(118,185,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 7,
              fontWeight: 800,
              color: "#000",
              padding: "0 2px",
            }}>
              {loopCount > 0 ? loopCount : ""}
            </span>
          )}
        </button>

        {/* Status indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: isPlaying ? "#76B900" : "rgba(255,255,255,0.3)",
            boxShadow: isPlaying ? "0 0 6px rgba(118,185,0,0.6)" : "none",
          }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: isPlaying ? "#76B900" : "rgba(255,255,255,0.4)" }}>
            {isPlaying ? "PLAYING" : "PAUSED"}
          </span>
        </div>
      </div>

      {/* Status row: step counter + now-playing indicator + frame */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          fontVariantNumeric: "tabular-nums",
          gap: 6,
        }}
      >
        <span>Step {Math.min(currentStepIndex + 1, totalSteps)} / {totalSteps}</span>
        {/* Now-playing indicator: current step type with color dot */}
        {activeSteps.length > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "1px 5px", borderRadius: 3, background: "rgba(255,255,255,0.04)" }}>
            <span style={{ width: 5, height: 5, borderRadius: 2, background: commandColor(activeSteps[0].command.type), boxShadow: `0 0 4px ${commandColor(activeSteps[0].command.type)}66` }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: commandColor(activeSteps[0].command.type), textTransform: "uppercase" }}>
              {activeSteps[0].command.type}
            </span>
          </span>
        )}
        <span style={{ fontFamily: "SFMono-Regular, Consolas, monospace", color: "rgba(255,255,255,0.25)" }}>
          F{currentFrame} / {msToFrame(totalDurationMs, fps)}
        </span>
      </div>

      {/* Keyboard shortcuts — grouped with hover tooltips */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          paddingTop: 2,
        }}
      >
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">Space</span>
          <span className="pbc-kbd-tooltip">Play / Pause</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">&larr;</span>
          <span className="pbc-kbd-tooltip">Previous step</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">&rarr;</span>
          <span className="pbc-kbd-tooltip">Next step</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">,</span>
          <span className="pbc-kbd-tooltip">Frame back</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">.</span>
          <span className="pbc-kbd-tooltip">Frame forward</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">L</span>
          <span className="pbc-kbd-tooltip">Toggle loop</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">Home</span>
          <span className="pbc-kbd-tooltip">Go to start</span>
        </span>
        <span className="pbc-kbd-group">
          <span className="pbc-kbd">End</span>
          <span className="pbc-kbd-tooltip">Go to end</span>
        </span>
      </div>
    </section>
  )
}
