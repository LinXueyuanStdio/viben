import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion"
import type { PulseCommand, Point } from "../types"

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 } as const

interface PulseProps {
  command: PulseCommand
}

/**
 * Pulse overlay -- Multiple concentric rings that expand and fade out.
 * Center dot stays solid; rings animate with staggered delay.
 * Premium: gradient opacity fade on rings, softer edges with blur, center dot glow.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Pulse({ command }: PulseProps) {
  const { center: _center, radius = 20, color = "#6366F1", rings = 3 } = command
  const center = _center as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Center dot fades in with spring
  const dotProgress = spring({ frame, fps, config: SPRING_CONFIG })

  // Pulse ring period in frames (~1200ms at 30fps = 36 frames)
  const periodFrames = Math.round((1200 / 1000) * fps)

  // Memoize per-ring stagger offsets (avoid per-frame allocation)
  const staggerOffsets = useMemo(
    () => Array.from({ length: rings }, (_, i) => Math.round((i * 100 / 1000) * fps)),
    [rings, fps],
  )

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {/* Center dot with glow */}
      <div
        style={{
          position: "absolute",
          left: center.x,
          top: center.y,
          width: radius * 0.5,
          height: radius * 0.5,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color} 0%, ${color}CC 70%, ${color}88 100%)`,
          transform: "translate(-50%, -50%)",
          opacity: dotProgress,
          boxShadow: `0 0 10px 3px ${color}55, 0 0 20px 6px ${color}22`,
        }}
      />

      {/* Pulse rings with gradient fade and soft edges */}
      {staggerOffsets.map((stagger, i) => {
        const ringFrame = (frame - stagger + periodFrames) % periodFrames

        const scale = interpolate(ringFrame, [0, periodFrames], [1, 2.5], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
        const ringOpacity = interpolate(ringFrame, [0, periodFrames], [0.7, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })

        // Ring border width fades as it expands
        const borderWidth = interpolate(ringFrame, [0, periodFrames], [2, 0.5], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: center.x,
              top: center.y,
              width: radius * 2,
              height: radius * 2,
              borderRadius: "50%",
              border: `${borderWidth}px solid ${color}`,
              transform: `translate(-50%, -50%) scale(${scale})`,
              opacity: ringOpacity,
              boxShadow: `0 0 6px 1px ${color}33, inset 0 0 4px 1px ${color}22`,
              filter: "blur(0.5px)",
            }}
          />
        )
      })}
    </div>
  )
}
