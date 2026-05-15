import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { BadgeCommand, Point } from "../types"

// Elastic spring for overshoot bounce
const SPRING_ELASTIC = { damping: 10, stiffness: 180, mass: 0.5 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface BadgeProps {
  command: BadgeCommand
}

const FONT_SIZES = {
  sm: 11,
  md: 13,
  lg: 15,
} as const

const PADDING_MAP = {
  sm: "4px 10px",
  md: "5px 14px",
  lg: "7px 18px",
} as const

/**
 * Badge overlay -- Premium pill with cinematic elastic entrance.
 *
 * Motion layers:
 *   1. Scale: 0.5 -> 1.08 -> 1.0 (elastic overshoot)
 *   2. Y offset: -8px -> 0 with spring
 *   3. Blur: 4px -> 0 during entrance
 *   4. After settle: subtle glow pulse (sine oscillation)
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Badge({ command }: BadgeProps) {
  const {
    position: _position,
    text,
    color = "#FFFFFF",
    background = "#6366F1",
    size = "md",
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ── Elastic entrance spring ──
  const progress = spring({ frame, fps, config: SPRING_ELASTIC })
  const settled = progress >= 0.999

  // Scale: 0.5 -> overshoot 1.08 -> settle 1.0
  const scale = settled
    ? 1
    : interpolate(progress, [0, 0.5, 0.75, 1], [0.5, 1.08, 0.97, 1], CLAMP)

  // Y offset: spring upward from -8px
  const translateY = settled ? 0 : (1 - progress) * -8

  // Opacity: fast reveal
  const opacity = settled ? 1 : interpolate(progress, [0, 0.3], [0, 1], CLAMP)

  // Blur: 4px -> 0 (clears before position settles)
  const blur = settled ? 0 : interpolate(progress, [0, 0.5], [4, 0], CLAMP)

  // ── Post-entrance glow pulse (sine wave) ──
  // Only starts after entrance settles (~15 frames in)
  const glowPhase = Math.max(0, frame - 15)
  const glowIntensity = settled ? 0.15 + 0.1 * Math.sin(glowPhase * 0.12) : 0

  const fontSize = FONT_SIZES[size]
  const padding = PADDING_MAP[size]

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        color,
        background: `linear-gradient(135deg, ${background}, color-mix(in oklch, ${background} 80%, #000))`,
        fontSize,
        fontWeight: 600,
        fontFamily: "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif",
        letterSpacing: 0.3,
        padding,
        borderRadius: 999,
        whiteSpace: "nowrap",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: [
          `0 4px 16px color-mix(in oklch, ${background} 40%, transparent)`,
          "0 2px 6px rgba(0, 0, 0, 0.2)",
          "inset 0 1px 0 rgba(255, 255, 255, 0.15)",
          "inset 0 -1px 0 rgba(0, 0, 0, 0.1)",
          // Glow pulse layer
          settled ? `0 0 ${12 + glowIntensity * 20}px color-mix(in oklch, ${background} ${Math.round(glowIntensity * 100)}%, transparent)` : "",
        ].filter(Boolean).join(", "),
        textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
        lineHeight: 1.4,
        backdropFilter: "blur(12px) saturate(160%)",
        WebkitBackdropFilter: "blur(12px) saturate(160%)",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        filter: blur > 0.01 ? `blur(${blur}px)` : undefined,
      }}
    >
      {text}
    </div>
  )
}
