import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { MorphCommand, Point } from "../types"

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 } as const
const SPRING_BOUNCE = { damping: 10, stiffness: 200, mass: 0.5 } as const

interface MorphProps {
  command: MorphCommand
}

// Glass plate shared styles
const glassPlateStyle: React.CSSProperties = {
  position: "absolute",
  inset: -16,
  borderRadius: 14,
  background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 50%, rgba(0,0,0,0.2) 100%)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
  pointerEvents: "none" as const,
}

/**
 * Morph overlay -- Morphs one value/text to another.
 * For numbers: smoothly interpolates the displayed value.
 * For strings: crossfades from one text to another.
 * Premium visual: gradient text, glass plate container, text-shadow depth, scale pulse at midpoint.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Morph({ command }: MorphProps) {
  const {
    position: _position,
    from,
    to,
    color = "#FFFFFF",
    fontSize = 32,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const isNumeric = typeof from === "number" && typeof to === "number"
  const morphDuration = isNumeric ? 40 : 20 // frames

  // Entrance spring
  const entranceProgress = spring({
    frame,
    fps,
    config: SPRING_CONFIG,
  })

  // Morph progress (0 to 1)
  const morphProgress = interpolate(frame, [5, 5 + morphDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  // Scale bounce at midpoint
  const midpointBounce = spring({
    frame: frame - Math.floor(morphDuration / 2),
    fps,
    config: SPRING_BOUNCE,
  })
  const scaleBoost = morphProgress > 0 && morphProgress < 1
    ? 1 + (1 - Math.abs(midpointBounce - 0.5) * 2) * 0.15
    : 1

  // Gradient text style via background-clip technique
  const gradientTextBase: React.CSSProperties = {
    fontSize,
    fontWeight: 700,
    fontFamily: "system-ui, -apple-system, sans-serif",
    whiteSpace: "nowrap",
    background: `linear-gradient(135deg, ${color} 0%, ${color}CC 50%, ${color} 100%)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    textShadow: `0 2px 8px ${color}40, 0 0 30px ${color}20`,
    // text-shadow doesn't work with background-clip text, so we use filter for glow
    filter: `drop-shadow(0 2px 6px ${color}30) drop-shadow(0 0 20px ${color}15)`,
  }

  if (isNumeric) {
    // Number morphing: interpolate the value
    const fromNum = from as number
    const toNum = to as number
    const currentValue = interpolate(morphProgress, [0, 1], [fromNum, toNum], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })

    // Format: use appropriate decimal places
    const isInteger = Number.isInteger(fromNum) && Number.isInteger(toNum)
    const displayValue = isInteger
      ? Math.round(currentValue).toLocaleString()
      : currentValue.toFixed(1)

    return (
      <div
        style={{
          position: "absolute",
          left: position.x,
          top: position.y,
          transform: `translate(-50%, -50%) scale(${entranceProgress * scaleBoost})`,
          opacity: entranceProgress,
          pointerEvents: "none",
        }}
      >
        {/* Glass plate */}
        <div style={glassPlateStyle} />
        <div
          style={{
            position: "relative",
            ...gradientTextBase,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {displayValue}
        </div>
      </div>
    )
  }

  // String morphing: crossfade
  const fromOpacity = interpolate(morphProgress, [0, 0.5], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  const toOpacity = interpolate(morphProgress, [0.5, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        transform: `translate(-50%, -50%) scale(${entranceProgress * scaleBoost})`,
        pointerEvents: "none",
      }}
    >
      {/* Glass plate */}
      <div style={glassPlateStyle} />

      {/* From text (fading out) */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          ...gradientTextBase,
          opacity: fromOpacity * entranceProgress,
        }}
      >
        {String(from)}
      </div>

      {/* To text (fading in) */}
      <div
        style={{
          position: "relative",
          ...gradientTextBase,
          opacity: toOpacity * entranceProgress,
        }}
      >
        {String(to)}
      </div>
    </div>
  )
}
