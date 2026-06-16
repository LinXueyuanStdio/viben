import { useState, useRef, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import type { PresentationStep } from "../../types"
import { formatTime, commandColor } from "../../utils/timeline"
import { describeCommand } from "../../types"
import { IconStepBack, IconStepForward, IconPlay, IconPause, IconChevronUp } from "./icons"

export function CollapsedPlaybackConsole({
  title,
  currentMs,
  totalDurationMs,
  currentStepIndex,
  totalSteps,
  activeCount,
  activeSteps,
  allSteps,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  onNext,
  onPrevious,
  onToggleCollapse,
}: {
  title: string
  currentMs: number
  totalDurationMs: number
  currentStepIndex: number
  totalSteps: number
  activeCount: number
  activeSteps: PresentationStep[]
  allSteps: PresentationStep[]
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onSeek: (ms: number) => void
  onNext: () => void
  onPrevious: () => void
  onToggleCollapse: () => void
}) {
  const [hoverInfo, setHoverInfo] = useState<{ pct: number; ms: number; rectLeft: number; rectTop: number; rectWidth: number } | null>(null)
  const scrubRef = useRef<HTMLDivElement>(null)

  // Native DOM listener on the wrapper — mousemove bubbles from the input child
  useEffect(() => {
    const el = scrubRef.current
    if (!el) return

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      setHoverInfo({ pct: pct * 100, ms: pct * totalDurationMs, rectLeft: rect.left, rectTop: rect.top, rectWidth: rect.width })
    }

    const onLeave = () => {
      setHoverInfo(null)
    }

    el.addEventListener("mousemove", onMove)
    el.addEventListener("mouseleave", onLeave)
    return () => {
      el.removeEventListener("mousemove", onMove)
      el.removeEventListener("mouseleave", onLeave)
    }
  }, [totalDurationMs])

  // Compute steps active at the hovered time using allSteps
  const hoverPreviewSteps = useMemo(() => {
    if (!hoverInfo) return []
    const ms = hoverInfo.ms
    return allSteps.filter((s) =>
      s.startMs <= ms &&
      (s.endMs == null || s.endMs > ms) &&
      s.command.type !== "clear" &&
      s.command.type !== "wait"
    )
  }, [hoverInfo, allSteps])

  return (
    <>
      {/* Noise texture overlay for depth */}
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        opacity: 0.03,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        pointerEvents: "none",
      }} />

      {/* Transport cluster — tight spacing */}
      <div style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <button
          className="pbc-btn pbc-btn-ghost"
          type="button"
          title="Previous step  [Left]"
          aria-label="Previous step"
          onClick={onPrevious}
          style={{
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
          }}
        >
          <IconStepBack size={10} />
        </button>
        <button
          className="pbc-btn pbc-btn-primary"
          type="button"
          title={isPlaying ? "Pause  [Space]" : "Play  [Space]"}
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={isPlaying ? onPause : onPlay}
          style={{
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 7,
            border: isPlaying ? "1px solid rgba(118,185,0,0.5)" : "1px solid rgba(118,185,0,0.7)",
            background: isPlaying
              ? "radial-gradient(circle at center, rgba(118,185,0,0.3), rgba(118,185,0,0.15))"
              : "rgba(118,185,0,0.3)",
            color: "#fff",
            cursor: "pointer",
            padding: 0,
            boxShadow: isPlaying ? "0 0 8px rgba(118,185,0,0.3)" : "none",
          }}
        >
          {isPlaying ? <IconPause size={11} /> : <IconPlay size={11} />}
        </button>
        <button
          className="pbc-btn pbc-btn-ghost"
          type="button"
          title="Next step  [Right]"
          aria-label="Next step"
          onClick={onNext}
          style={{
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
          }}
        >
          <IconStepForward size={10} />
        </button>
      </div>

      {/* Title + metadata — prominent title, subdued meta */}
      <div style={{ minWidth: 120, flex: "0 1 200px", overflow: "hidden" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.2,
            letterSpacing: 0.1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 9,
            color: "rgba(255,255,255,0.35)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          <span style={{
            color: "rgba(255,255,255,0.75)",
            fontWeight: 600,
            fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', monospace",
            fontSize: 10,
            letterSpacing: -0.3,
          }}>
            {formatTime(currentMs)}
          </span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span>{formatTime(totalDurationMs)}</span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>{Math.min(currentStepIndex + 1, totalSteps)}/{totalSteps}</span>
        </div>
      </div>

      {/* Scrub slider — rich progress bar */}
      <div
        ref={scrubRef}
        className="pbc-scrub-wrapper"
        style={{ flex: 1, minWidth: 100, display: "flex", alignItems: "center", position: "relative", height: 24 }}
      >
        {/* Background track with subtle inner shadow */}
        <div style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: 5,
          borderRadius: 3,
          background: "rgba(255,255,255,0.06)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4), inset 0 0 0 0.5px rgba(255,255,255,0.05)",
        }} />
        {/* Tick marks — 10 evenly spaced */}
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(i + 1) * 10}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 1,
              height: 8,
              borderRadius: 0.5,
              background: "rgba(255,255,255,0.06)",
              pointerEvents: "none",
            }}
          />
        ))}
        {/* Progress fill with multi-stop gradient */}
        <div style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: `${totalDurationMs > 0 ? (currentMs / totalDurationMs) * 100 : 0}%`,
          height: 5,
          borderRadius: 3,
          background: isPlaying
            ? "linear-gradient(90deg, rgba(118,185,0,0.5) 0%, rgba(118,185,0,0.8) 60%, rgba(144,220,20,0.9) 100%)"
            : "linear-gradient(90deg, rgba(118,185,0,0.4) 0%, rgba(118,185,0,0.6) 100%)",
          boxShadow: isPlaying
            ? "0 0 8px rgba(118,185,0,0.3), 0 1px 2px rgba(0,0,0,0.2)"
            : "0 0 4px rgba(118,185,0,0.15)",
          transition: "width 80ms linear",
        }} />
        {/* Glow trail effect at the leading edge */}
        {isPlaying && totalDurationMs > 0 && (
          <div style={{
            position: "absolute",
            left: `calc(${(currentMs / totalDurationMs) * 100}% - 12px)`,
            top: "50%",
            transform: "translateY(-50%)",
            width: 12,
            height: 5,
            borderRadius: 3,
            background: "linear-gradient(90deg, transparent, rgba(118,185,0,0.6))",
            filter: "blur(2px)",
            pointerEvents: "none",
            transition: "left 80ms linear",
          }} />
        )}
        {/* Hover position indicator */}
        {hoverInfo && (
          <div style={{
            position: "absolute",
            left: `${hoverInfo.pct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 1,
            height: 14,
            background: "rgba(255,255,255,0.3)",
            borderRadius: 0.5,
            pointerEvents: "none",
          }} />
        )}
        {/* Thumb indicator */}
        <div
          className="pbc-scrub-thumb"
          style={{
            position: "absolute",
            left: `${totalDurationMs > 0 ? (currentMs / totalDurationMs) * 100 : 0}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, #9AE62B, #76B900)",
            border: "2px solid rgba(255,255,255,0.95)",
            boxShadow: "0 0 6px rgba(118,185,0,0.5), 0 1px 3px rgba(0,0,0,0.3)",
            transition: "left 80ms linear, transform 0.15s ease",
            pointerEvents: "none",
          }}
        />
        {/* Invisible range input on top for interaction */}
        <input
          className="pbc-range"
          aria-label="Presentation progress"
          type="range"
          min={0}
          max={totalDurationMs}
          value={Math.min(currentMs, totalDurationMs)}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          style={{
            position: "relative",
            width: "100%",
            height: 24,
            opacity: 0,
            cursor: "pointer",
            zIndex: 1,
          }}
        />
        {/* Preview popover — portal to body to escape overflow:hidden + backdrop-filter containing block */}
        {hoverInfo && createPortal(
          <div
            style={{
              position: "fixed",
              top: hoverInfo.rectTop - 10,
              left: hoverInfo.rectLeft + hoverInfo.rectWidth * Math.min(0.85, Math.max(0.15, hoverInfo.pct / 100)),
              transform: "translate(-50%, -100%)",
              minWidth: 160,
              maxWidth: 260,
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(12, 14, 28, 0.96)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
              pointerEvents: "none",
              zIndex: 99999,
            }}
          >
            {/* Time indicator */}
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 4, fontFamily: "SFMono-Regular, Consolas, monospace", fontVariantNumeric: "tabular-nums" }}>
              {formatTime(hoverInfo.ms)}
            </div>
            {hoverPreviewSteps.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {hoverPreviewSteps.slice(0, 5).map((step) => (
                  <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 2, background: commandColor(step.command.type), flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: commandColor(step.command.type), textTransform: "uppercase" }}>
                      {step.command.type}
                    </span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {step.description || describeCommand(step.command)}
                    </span>
                  </div>
                ))}
                {hoverPreviewSteps.length > 5 && (
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
                    +{hoverPreviewSteps.length - 5} more
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>No active steps</div>
            )}
            {/* Arrow pointing down */}
            <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid rgba(12, 14, 28, 0.96)" }} />
          </div>,
          document.body,
        )}
      </div>

      {/* Active count badge + status dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {activeCount > 0 && (
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: "rgba(118,185,0,0.15)",
              border: "1px solid rgba(118,185,0,0.3)",
              fontSize: 9,
              fontWeight: 700,
              color: "#76B900",
              padding: "0 4px",
              lineHeight: 1,
              boxShadow: `0 0 0 ${activeCount > 0 ? "3px" : "0"} rgba(118,185,0,0.15)`,
              transition: "box-shadow 0.3s ease",
            }}
            title={`${activeCount} active overlay${activeCount > 1 ? "s" : ""}`}
          >
            {activeCount}
          </div>
        )}
        {/* Playing state — minimal dot indicator */}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: isPlaying ? "#76B900" : "rgba(255,255,255,0.2)",
            boxShadow: isPlaying ? "0 0 6px rgba(118,185,0,0.6), 0 0 2px rgba(118,185,0,0.8)" : "none",
            transition: "all 0.2s ease",
          }}
          title={isPlaying ? "Playing" : "Paused"}
        />
      </div>

      {/* Expand button */}
      <button
        className="pbc-btn pbc-btn-ghost"
        type="button"
        title="Expand (Ctrl+Shift+E)"
        aria-label="Expand console"
        onClick={onToggleCollapse}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          height: 26,
          padding: "0 10px",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.6)",
          cursor: "pointer",
          fontSize: 10,
          fontWeight: 600,
          marginLeft: 2,
          flexShrink: 0,
        }}
      >
        <IconChevronUp size={10} />
        <span>Expand</span>
      </button>

      {/* Playing state border glow overlay */}
      {isPlaying && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            border: "1px solid rgba(118,185,0,0.15)",
            boxShadow: "inset 0 0 12px rgba(118,185,0,0.04), 0 0 8px rgba(118,185,0,0.06)",
            pointerEvents: "none",
          }}
        />
      )}

    </>
  )
}
