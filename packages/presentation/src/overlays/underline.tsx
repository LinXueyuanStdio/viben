import { useMemo } from "react"
import type { UnderlineCommand, Point } from "../types"
import { useDraw } from "../utils/motion"

interface UnderlineProps {
  command: UnderlineCommand
}

/**
 * Underline overlay -- SVG line (straight or wavy) with Remotion stroke-dashoffset draw animation.
 * Premium: gradient stroke, soft glow beneath, smoother wavy curves.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Underline({ command }: UnderlineProps) {
  const {
    from: _from,
    to: _to,
    color = "#FF6B6B",
    strokeWidth = 2.5,
    style = "straight",
  } = command
  const from = _from as Point
  const to = _to as Point

  // Memoize static path geometry (N sin() calls for wavy path)
  const { path, pathLength, gradientId, glowFilterId } = useMemo(() => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const path = style === "wavy" ? generateWavyPath(from, to, length) : `M ${from.x} ${from.y} L ${to.x} ${to.y}`
    const pathLength = style === "wavy" ? length * 1.3 : length
    const base = `underline-${Math.round(from.x)}-${Math.round(from.y)}-${Math.round(to.x)}`
    return {
      path,
      pathLength,
      gradientId: `${base}-grad`,
      glowFilterId: `${base}-glow`,
    }
  }, [from.x, from.y, to.x, to.y, style])

  // Remotion draw animation
  const drawProgress = useDraw(0, 15)

  // Derive lighter tint for gradient end
  const colorEnd = color + "BB"

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          {/* Gradient stroke */}
          <linearGradient id={gradientId} x1={from.x} y1={from.y} x2={to.x} y2={to.y} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={color} stopOpacity={0.8} />
            <stop offset="50%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={colorEnd} stopOpacity={0.9} />
          </linearGradient>
          {/* Soft glow beneath */}
          <filter id={glowFilterId} x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
        </defs>

        {/* Glow layer beneath the line */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={pathLength * (1 - drawProgress)}
          filter={`url(#${glowFilterId})`}
          opacity={0.25}
        />
        {/* Main underline with gradient stroke */}
        <path
          d={path}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={pathLength * (1 - drawProgress)}
        />
      </svg>
    </div>
  )
}

/** Generate a sine-wave SVG path between two points — smoother curves */
function generateWavyPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  length: number
): string {
  const segments = Math.max(4, Math.round(length / 20))
  const amplitude = 5
  const dx = (to.x - from.x) / segments
  const dy = (to.y - from.y) / segments

  // Perpendicular direction for wave
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const perpX = -Math.sin(angle)
  const perpY = Math.cos(angle)

  let d = `M ${from.x} ${from.y}`

  for (let i = 1; i <= segments; i++) {
    const x = from.x + dx * i
    const y = from.y + dy * i
    const wave = Math.sin((i / segments) * Math.PI * segments) * amplitude
    const offsetX = perpX * wave
    const offsetY = perpY * wave

    if (i === 1) {
      d += ` Q ${from.x + dx * 0.5 + offsetX} ${from.y + dy * 0.5 + offsetY} ${x} ${y}`
    } else {
      const cpX = from.x + dx * (i - 0.5) + offsetX
      const cpY = from.y + dy * (i - 0.5) + offsetY
      d += ` Q ${cpX} ${cpY} ${x} ${y}`
    }
  }

  return d
}
