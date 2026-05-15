import { memo, useCallback, useMemo } from "react"
import type { RefObject } from "react"
import type { PlayerRef } from "@remotion/player"
import type { PresentationStep } from "../types"
import { describeCommand } from "../types"
import { msToFrame } from "../utils/motion"
import { buildTimelineLanes, commandColor } from "../utils/timeline"
import type { PlaybackState } from "../hooks/use-playback-state"

export interface TimelinePanelProps {
  playerRef: RefObject<PlayerRef | null>
  steps: PresentationStep[]
  playback: PlaybackState
  fps: number
  totalDurationMs: number
  /** Panel height in px (default 140) */
  height?: number
  /** Position: 'top' or 'bottom' (default 'bottom') */
  position?: "top" | "bottom"
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const PANEL_STYLE: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  overflow: "hidden",
  background: "rgba(10, 10, 25, 0.94)",
  backdropFilter: "blur(12px)",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  pointerEvents: "auto",
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 11,
  color: "rgba(255,255,255,0.8)",
}

const LANE_LABEL_STYLE: React.CSSProperties = {
  width: 72,
  flexShrink: 0,
  textAlign: "right",
  paddingRight: 8,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  opacity: 0.6,
  fontSize: 10,
}

const LANE_TRACK_STYLE: React.CSSProperties = {
  flex: 1,
  position: "relative",
  height: 16,
  borderRadius: 3,
  background: "rgba(255,255,255,0.03)",
}

/**
 * TimelinePanel — multi-lane timeline visualization.
 * Shows each command type as a separate lane with blocks representing duration.
 * Click a block to seek to that step's start time.
 */
export const TimelinePanel = memo(function TimelinePanel({
  playerRef,
  steps,
  playback,
  fps,
  totalDurationMs,
  height = 140,
  position = "bottom",
}: TimelinePanelProps) {
  const { currentMs } = playback

  const lanes = useMemo(
    () => buildTimelineLanes(steps, totalDurationMs),
    [steps, totalDurationMs],
  )

  const seekTo = useCallback((ms: number) => {
    const player = playerRef.current
    if (!player) return
    player.seekTo(msToFrame(Math.max(0, ms), fps))
  }, [playerRef, fps])

  const progressPct = totalDurationMs > 0 ? (currentMs / totalDurationMs) * 100 : 0

  const posStyle = position === "top" ? { top: 0 } : { bottom: 0 }

  return (
    <div style={{ ...PANEL_STYLE, ...posStyle, height }}>
      {/* Playhead indicator */}
      <div style={{
        position: "absolute",
        left: `calc(72px + ${progressPct}% * (100% - 72px) / 100%)`,
        top: 0,
        bottom: 0,
        width: 1,
        background: "rgba(99,102,241,0.8)",
        zIndex: 10,
        pointerEvents: "none",
        marginLeft: `${progressPct * 0.01 * (100 - 7.2)}%`,
      }} />
      <div style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 72,
        right: 0,
      }}>
        <div style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${progressPct}%`,
          width: 1.5,
          background: "rgba(99,102,241,0.9)",
          zIndex: 10,
          pointerEvents: "none",
        }} />
      </div>

      {/* Lane rows */}
      <div style={{ overflowY: "auto", height: "100%", padding: "4px 8px 4px 0" }}>
        {lanes.map((lane) => (
          <div key={lane.id} style={{ display: "flex", alignItems: "center", height: 20, marginBottom: 2 }}>
            <div style={LANE_LABEL_STYLE} title={lane.label}>
              {lane.label}
            </div>
            <div style={LANE_TRACK_STYLE}>
              {lane.items.map((item) => {
                const leftPct = (item.startMs / totalDurationMs) * 100
                const widthPct = ((item.endMs - item.startMs) / totalDurationMs) * 100
                const color = commandColor(item.step.command.type)
                const isActive = currentMs >= item.startMs && currentMs < item.endMs
                return (
                  <div
                    key={item.step.id}
                    onClick={() => seekTo(item.startMs)}
                    title={describeCommand(item.step.command)}
                    style={{
                      position: "absolute",
                      left: `${leftPct}%`,
                      width: `${Math.max(0.5, widthPct)}%`,
                      top: 2,
                      bottom: 2,
                      borderRadius: 2,
                      background: color,
                      opacity: isActive ? 1 : 0.5,
                      cursor: "pointer",
                      transition: "opacity 0.15s",
                      boxShadow: isActive ? `0 0 6px ${color}` : "none",
                    }}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
