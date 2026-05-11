import type { BracketCommand, Point } from "../types"

interface BracketProps {
  command: BracketCommand
}

/**
 * Bracket overlay -- SVG curly brace path between two points with draw animation.
 * Uses cubic bezier path for brace shape. Optional label at midpoint.
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
    animate = true,
  } = command
  const from = _from as Point
  const to = _to as Point

  const path = generateBracePath(from, to, direction)
  // Estimate path length for dasharray animation
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const pathLength = dist * 1.6

  // Label position: midpoint offset in the bracket direction
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const perpX = direction === "right" ? -Math.sin(angle) : Math.sin(angle)
  const perpY = direction === "right" ? Math.cos(angle) : -Math.cos(angle)
  const curveDepth = Math.min(40, dist * 0.25)
  const labelX = midX + perpX * (curveDepth + 16)
  const labelY = midY + perpY * (curveDepth + 16)

  const lineStyle: React.CSSProperties = animate
    ? {
        strokeDasharray: pathLength,
        strokeDashoffset: pathLength,
        animation: "presentationDrawLine 600ms ease-out forwards",
      }
    : {}

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
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={lineStyle}
        />
      </svg>

      {/* Label */}
      {label && (
        <div
          style={{
            position: "absolute",
            left: labelX,
            top: labelY,
            transform: "translate(-50%, -50%)",
            color,
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
            opacity: animate ? 0 : 1,
            animation: animate ? "presentationFadeIn 300ms ease-out 500ms forwards" : undefined,
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
