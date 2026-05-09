import type { ArrowCommand } from "../types"

interface ArrowProps {
  command: ArrowCommand
}

/**
 * Arrow overlay -- SVG arrow with CSS stroke-dasharray animation for draw-in effect.
 */
export function Arrow({ command }: ArrowProps) {
  const { from, to, color = "#FF6B6B", label, strokeWidth = 3, animate = true } = command

  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)

  // Arrow head points
  const arrowSize = 12
  const arrowAngle1 = angle + Math.PI * 0.8
  const arrowAngle2 = angle - Math.PI * 0.8

  const headX1 = to.x + Math.cos(arrowAngle1) * arrowSize
  const headY1 = to.y + Math.sin(arrowAngle1) * arrowSize
  const headX2 = to.x + Math.cos(arrowAngle2) * arrowSize
  const headY2 = to.y + Math.sin(arrowAngle2) * arrowSize

  // Label position (midpoint, offset above)
  const labelX = (from.x + to.x) / 2
  const labelY = (from.y + to.y) / 2 - 20

  const lineStyle: React.CSSProperties = animate
    ? {
        strokeDasharray: length,
        strokeDashoffset: length,
        animation: "presentationDrawLine 500ms ease-out forwards",
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
        {/* Arrow line */}
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={lineStyle}
        />
        {/* Arrow head */}
        <polygon
          points={`${to.x},${to.y} ${headX1},${headY1} ${headX2},${headY2}`}
          fill={color}
          style={{
            opacity: animate ? 0 : 1,
            animation: animate ? "presentationFadeIn 200ms ease-out 400ms forwards" : undefined,
          }}
        />
      </svg>
      {/* Label */}
      {label && (
        <div
          style={{
            position: "absolute",
            left: labelX,
            top: labelY,
            transform: "translateX(-50%)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            background: color,
            padding: "4px 12px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            opacity: animate ? 0 : 1,
            animation: animate ? "presentationFadeIn 300ms ease-out 300ms forwards" : undefined,
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}
