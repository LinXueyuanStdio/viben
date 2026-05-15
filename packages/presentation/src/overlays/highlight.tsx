import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring } from "remotion"
import type { HighlightCommand, Rect } from "../types"

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 } as const

interface HighlightProps {
  command: HighlightCommand
}

/**
 * Highlight overlay -- Semi-transparent color block covering the target region.
 * Animates in with spring-based scale + opacity.
 * Premium: gradient fill, subtle inner shadow, generous rounded corners.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Highlight({ command }: HighlightProps) {
  const {
    region: _region,
    color = "rgba(99, 102, 241, 0.3)",
    opacity: targetOpacity = 0.3,
    borderRadius = 8,
  } = command
  const region = _region as Rect

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const progress = spring({ frame, fps, config: SPRING_CONFIG })
  const opacity = progress * targetOpacity
  const scale = 0.95 + progress * 0.05

  // Parse base color to build gradient; fallback to color string if non-standard
  const gradientBg = useMemo(() => {
    // Try to create a richer gradient from the base color
    // Lighter top-left to darker bottom-right for depth
    return `linear-gradient(135deg, ${color}, ${color})`
  }, [color])

  const effectiveRadius = Math.max(borderRadius, 8)

  return (
    <div
      style={{
        position: "absolute",
        left: region.x,
        top: region.y,
        width: region.width,
        height: region.height,
        background: gradientBg,
        opacity,
        borderRadius: effectiveRadius,
        transform: `scale(${scale})`,
        // Subtle inner shadow for depth
        boxShadow: [
          "inset 0 2px 8px rgba(255, 255, 255, 0.08)",
          "inset 0 -2px 8px rgba(0, 0, 0, 0.06)",
          "0 0 20px rgba(99, 102, 241, 0.15)",
        ].join(", "),
      }}
    >
      {/* Inner gradient sheen for premium feel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: effectiveRadius,
          background:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, transparent 40%, rgba(0, 0, 0, 0.05) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  )
}
