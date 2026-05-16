import { memo, useCallback, useMemo } from "react"
import type { RefObject } from "react"
import type { PlayerRef } from "@remotion/player"
import type { PresentationStep } from "../types"
import { describeCommand } from "../types"
import { msToFrame } from "../utils/motion"
import { buildTimelineLanes, commandColor } from "../utils/timeline"
import type { PlaybackState } from "../hooks/use-playback-state"
import type { TimelineItem } from "../utils/timeline"

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
// Styles (module-level — zero allocation)
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

const LANE_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 20,
  marginBottom: 2,
}

const PLAYHEAD_CONTAINER_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: 72,
  right: 0,
  pointerEvents: "none",
}

const POS_TOP = { top: 0 } as const
const POS_BOTTOM = { bottom: 0 } as const

// ---------------------------------------------------------------------------
// Lane Item — memo'd to skip re-render when isActive hasn't changed
// ---------------------------------------------------------------------------

const LaneItem = memo(function LaneItem({
  item,
  totalDurationMs,
  isActive,
  onSeek,
}: {
  item: TimelineItem
  totalDurationMs: number
  isActive: boolean
  onSeek: (ms: number) => void
}) {
  const leftPct = (item.startMs / totalDurationMs) * 100
  const widthPct = ((item.endMs - item.startMs) / totalDurationMs) * 100
  const color = commandColor(item.step.command.type)
  const handleClick = useCallback(() => onSeek(item.startMs), [onSeek, item.startMs])

  return (
    <div
      onClick={handleClick}
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
}, (prev, next) => {
  // Custom comparator: only re-render if isActive changed or item identity changed
  return prev.item === next.item && prev.isActive === next.isActive && prev.totalDurationMs === next.totalDurationMs
})

/**
 * TimelinePanel — multi-lane timeline visualization.
 * Shows each command type as a separate lane with blocks representing duration.
 * Click a block to seek to that step's start time.
 *
 * Optimizations:
 * - `LaneItem` is memo'd with custom comparator (only re-renders on isActive change)
 * - `buildTimelineLanes` result is memoized
 * - Module-level style constants
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
  const posStyle = position === "top" ? POS_TOP : POS_BOTTOM

  return (
    <div style={{ ...PANEL_STYLE, ...posStyle, height }}>
      {/* Playhead indicator */}
      <div style={PLAYHEAD_CONTAINER_STYLE}>
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
          <div key={lane.id} style={LANE_ROW_STYLE}>
            <div style={LANE_LABEL_STYLE} title={lane.label}>
              {lane.label}
            </div>
            <div style={LANE_TRACK_STYLE}>
              {lane.items.map((item) => (
                <LaneItem
                  key={item.step.id}
                  item={item}
                  totalDurationMs={totalDurationMs}
                  isActive={currentMs >= item.startMs && currentMs < item.endMs}
                  onSeek={seekTo}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
