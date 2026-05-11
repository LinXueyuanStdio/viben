import type { UnderlineCommand, Point } from "../types"

interface UnderlineProps {
  command: UnderlineCommand
}

/**
 * Underline overlay -- SVG line (straight or wavy) with stroke-dasharray draw animation.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Underline({ command }: UnderlineProps) {
  const {
    from: _from,
    to: _to,
    color = "#FF6B6B",
    strokeWidth = 3,
    style = "straight",
    animate = true,
  } = command
  const from = _from as Point
  const to = _to as Point

  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.sqrt(dx * dx + dy * dy)

  // Generate path
  const path = style === "wavy" ? generateWavyPath(from, to, length) : `M ${from.x} ${from.y} L ${to.x} ${to.y}`

  // For wavy path, the actual path length is longer
  const pathLength = style === "wavy" ? length * 1.3 : length

  const lineStyle: React.CSSProperties = animate
    ? {
        strokeDasharray: pathLength,
        strokeDashoffset: pathLength,
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
    </div>
  )
}

/** Generate a sine-wave SVG path between two points */
function generateWavyPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  length: number
): string {
  const segments = Math.max(4, Math.round(length / 20))
  const amplitude = 4
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
