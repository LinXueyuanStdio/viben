import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion"
import type { ProgressCommand, Point } from "../types"

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 } as const

interface ProgressProps {
  command: ProgressCommand
}

/**
 * Progress overlay -- Rounded bar with inner shadow track, gradient fill with shine, premium label.
 * Uses spring for entrance fade-in, then interpolate for bar width animation.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Progress({ command }: ProgressProps) {
  const {
    position: _position,
    width = 200,
    value,
    color = "#6366F1",
    trackColor = "rgba(255,255,255,0.15)",
    showLabel = false,
    label,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Entrance fade-in (first ~300ms = ~9 frames at 30fps)
  const entranceProgress = spring({ frame, fps, config: SPRING_CONFIG })

  // Bar fill starts after a short delay (~300ms = ~9 frames)
  const delayFrames = Math.round((300 / 1000) * fps)
  const fillDurationFrames = Math.round((800 / 1000) * fps)
  const fillProgress = interpolate(frame - delayFrames, [0, fillDurationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  const barHeight = 10
  const displayLabel = label ?? `${Math.round(value)}%`
  const fillWidth = fillProgress * Math.min(100, Math.max(0, value))

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width,
        opacity: entranceProgress,
      }}
    >
      {/* Track with inner shadow for depth */}
      <div
        style={{
          width: "100%",
          height: barHeight,
          borderRadius: barHeight / 2,
          background: `linear-gradient(180deg, color-mix(in oklch, ${trackColor} 80%, rgba(0, 0, 0, 0.3)), ${trackColor})`,
          overflow: "hidden",
          boxShadow:
            "inset 0 1px 3px rgba(0, 0, 0, 0.3), inset 0 -1px 1px rgba(255, 255, 255, 0.04), 0 1px 2px rgba(0, 0, 0, 0.15)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        {/* Fill with gradient and subtle shine */}
        <div
          style={{
            height: "100%",
            width: "100%",
            borderRadius: barHeight / 2,
            background: `linear-gradient(180deg, color-mix(in oklch, ${color} 85%, #fff) 0%, ${color} 50%, color-mix(in oklch, ${color} 80%, #000) 100%)`,
            boxShadow: `0 0 8px color-mix(in oklch, ${color} 40%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.25)`,
            transformOrigin: "left center",
            transform: `scaleX(${fillWidth / 100})`,
          }}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif",
            letterSpacing: 0.3,
            color: color,
            textShadow: `0 0 8px color-mix(in oklch, ${color} 30%, transparent)`,
            textAlign: "right",
            opacity: fillProgress > 0 ? 1 : 0,
          }}
        >
          {displayLabel}
        </div>
      )}
    </div>
  )
}
