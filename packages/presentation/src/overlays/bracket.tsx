import { useMemo } from "react"
import type { BracketCommand, Point } from "../types"
import { useDraw, useFadeIn } from "../utils/motion"

interface BracketProps {
  command: BracketCommand
}

/**
 * Bracket overlay -- SVG curly brace path between two points with Remotion draw animation.
 * Uses cubic bezier path for brace shape. Optional label at midpoint.
 * Premium: gradient stroke, glass-plate label, soft shadow on path.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Bracket({ command }: BracketProps) {
  const {
    from: _from,
    to: _to,
    direction = "right",
    color = "#FF6B6B",
    strokeWidth = 2.5,
    label,
  } = command
  const from = _from as Point
  const to = _to as Point

  // Memoize all static geometry (trig + path string only depend on positions/direction)
  const { path, pathLength, labelX, labelY, gradientId, glowFilterId } = useMemo(() => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const pathLength = dist * 1.6
    const path = generateBracePath(from, to, direction)

    const midX = (from.x + to.x) / 2
    const midY = (from.y + to.y) / 2
    const angle = Math.atan2(dy, dx)
    const perpX = direction === "right" ? -Math.sin(angle) : Math.sin(angle)
    const perpY = direction === "right" ? Math.cos(angle) : -Math.cos(angle)
    const curveDepth = Math.min(40, dist * 0.25)
    const labelX = midX + perpX * (curveDepth + 16)
    const labelY = midY + perpY * (curveDepth + 16)

    const base = `bracket-${Math.round(from.x)}-${Math.round(from.y)}-${Math.round(to.x)}`
    return {
      path,
      pathLength,
      labelX,
      labelY,
      gradientId: `${base}-grad`,
      glowFilterId: `${base}-glow`,
    }
  }, [from.x, from.y, to.x, to.y, direction])

  // Remotion animations
  const drawProgress = useDraw(0, 18) // ~18 frames for brace draw
  const labelOpacity = useFadeIn(15, 9) // label fades in after draw mostly complete

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
          {/* Soft shadow filter */}
          <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
          </filter>
        </defs>

        {/* Glow/shadow layer behind the bracket */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={pathLength * (1 - drawProgress)}
          filter={`url(#${glowFilterId})`}
          opacity={0.25}
        />
        {/* Main bracket path with gradient stroke */}
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

      {/* Label with glass-plate background */}
      {label && (
        <div
          style={{
            position: "absolute",
            left: labelX,
            top: labelY,
            transform: "translate(-50%, -50%)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
            opacity: labelOpacity,
            background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 12px ${color}33`,
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

/**
 * Generate a curly brace SVG path between two points.
 * Uses cubic bezier curves to create the brace shape.
 */
function generateBracePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  direction: "left" | "right"
): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Perpendicular direction
  const angle = Math.atan2(dy, dx)
  const sign = direction === "right" ? 1 : -1
  const perpX = -Math.sin(angle) * sign
  const perpY = Math.cos(angle) * sign

  const curveDepth = Math.min(40, dist * 0.25)
  const tipDepth = curveDepth * 1.4

  // Midpoint
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2

  // Quarter points
  const q1X = from.x + dx * 0.25
  const q1Y = from.y + dy * 0.25
  const q3X = from.x + dx * 0.75
  const q3Y = from.y + dy * 0.75

  // Control points with perpendicular offset
  const cp1X = q1X + perpX * curveDepth
  const cp1Y = q1Y + perpY * curveDepth
  const cp2X = q3X + perpX * curveDepth
  const cp2Y = q3Y + perpY * curveDepth

  // Tip point (center of brace extends further)
  const tipX = midX + perpX * tipDepth
  const tipY = midY + perpY * tipDepth

  // Build path: from -> curve to tip -> curve to end
  return [
    `M ${from.x} ${from.y}`,
    `C ${from.x + perpX * curveDepth * 0.3} ${from.y + perpY * curveDepth * 0.3} ${cp1X} ${cp1Y} ${tipX} ${tipY}`,
    `C ${cp2X} ${cp2Y} ${to.x + perpX * curveDepth * 0.3} ${to.y + perpY * curveDepth * 0.3} ${to.x} ${to.y}`,
  ].join(" ")
}
