import { useMemo } from "react"
import type { CircleCommand, Point } from "../types"
import { useDraw } from "../utils/motion"

interface CircleAnnotationProps {
  command: CircleCommand
}

/**
 * Circle annotation overlay -- SVG circle with Remotion stroke-dashoffset draw animation.
 * Premium: gradient stroke with color transition, soft outer glow, refined proportions.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function CircleAnnotation({ command }: CircleAnnotationProps) {
  const { center: _center, radius, color = "#FF6B6B", strokeWidth = 2.5 } = command
  const center = _center as Point

  const circumference = 2 * Math.PI * radius
  const drawProgress = useDraw(0, 15)

  // Stable IDs based on position
  const ids = useMemo(() => {
    const base = `circle-${Math.round(center.x)}-${Math.round(center.y)}-${Math.round(radius)}`
    return {
      gradientId: `${base}-grad`,
      glowFilterId: `${base}-glow`,
    }
  }, [center.x, center.y, radius])

  // Derive a lighter/shifted tint for gradient end
  const colorEnd = color + "AA"

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
          {/* Gradient stroke: color transitions along the arc */}
          <linearGradient id={ids.gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="60%" stopColor={color} stopOpacity={0.9} />
            <stop offset="100%" stopColor={colorEnd} stopOpacity={0.7} />
          </linearGradient>
          {/* Soft outer glow */}
          <filter id={ids.glowFilterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
        </defs>

        {/* Outer glow layer */}
        <circle
          cx={center.x}
          cy={center.y}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - drawProgress)}
          filter={`url(#${ids.glowFilterId})`}
          opacity={0.3}
        />
        {/* Main circle with gradient stroke */}
        <circle
          cx={center.x}
          cy={center.y}
          r={radius}
          fill="none"
          stroke={`url(#${ids.gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - drawProgress)}
        />
      </svg>
    </div>
  )
}
