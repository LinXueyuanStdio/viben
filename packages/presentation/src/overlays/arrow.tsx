import { useMemo } from "react"
import type { ArrowCommand, Point } from "../types"
import { useDraw, useFadeIn } from "../utils/motion"

interface ArrowProps {
  command: ArrowCommand
}

/**
 * Arrow overlay -- SVG arrow with Remotion stroke-dashoffset draw animation.
 * Premium: gradient stroke, glowing arrowhead, glass-plate label, soft drop-shadow.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Arrow({ command }: ArrowProps) {
  const { from: _from, to: _to, color = "#FF6B6B", label, strokeWidth = 3 } = command
  const from = _from as Point
  const to = _to as Point

  // Memoize all static geometry (6 trig calls + string for static positions)
  const geo = useMemo(() => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)
    const arrowSize = 14
    const headX1 = to.x + Math.cos(angle + Math.PI * 0.8) * arrowSize
    const headY1 = to.y + Math.sin(angle + Math.PI * 0.8) * arrowSize
    const headX2 = to.x + Math.cos(angle - Math.PI * 0.8) * arrowSize
    const headY2 = to.y + Math.sin(angle - Math.PI * 0.8) * arrowSize
    const arrowPoints = `${to.x},${to.y} ${headX1},${headY1} ${headX2},${headY2}`
    const labelX = (from.x + to.x) / 2
    const labelY = (from.y + to.y) / 2 - 20
    const gradientId = `arrow-grad-${Math.round(from.x)}-${Math.round(from.y)}-${Math.round(to.x)}`
    const filterId = `arrow-glow-${Math.round(from.x)}-${Math.round(from.y)}-${Math.round(to.x)}`
    const headGlowId = `arrow-head-glow-${Math.round(from.x)}-${Math.round(from.y)}-${Math.round(to.x)}`
    return { length, arrowPoints, labelX, labelY, gradientId, filterId, headGlowId }
  }, [from.x, from.y, to.x, to.y])

  // Remotion animations
  const drawProgress = useDraw(0, 15) // line draw over ~15 frames
  const arrowHeadOpacity = useFadeIn(12, 6) // fade in arrowhead after line mostly drawn
  const labelOpacity = useFadeIn(9, 9) // label fades in mid-draw

  // Derive a lighter tint for gradient end
  const colorLight = color + "CC"

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
          <linearGradient id={geo.gradientId} x1={from.x} y1={from.y} x2={to.x} y2={to.y} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={color} stopOpacity={0.7} />
            <stop offset="50%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={colorLight} stopOpacity={1} />
          </linearGradient>
          {/* Soft glow filter for the line */}
          <filter id={geo.filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
          </filter>
          {/* Arrowhead glow filter */}
          <filter id={geo.headGlowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
        </defs>

        {/* Glow layer behind the line */}
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={color}
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          strokeDasharray={geo.length}
          strokeDashoffset={geo.length * (1 - drawProgress)}
          filter={`url(#${geo.filterId})`}
          opacity={0.35}
        />
        {/* Arrow line */}
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={`url(#${geo.gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={geo.length}
          strokeDashoffset={geo.length * (1 - drawProgress)}
        />
        {/* Arrowhead glow */}
        <polygon
          points={geo.arrowPoints}
          fill={color}
          filter={`url(#${geo.headGlowId})`}
          style={{ opacity: arrowHeadOpacity * 0.5 }}
        />
        {/* Arrow head */}
        <polygon
          points={geo.arrowPoints}
          fill={color}
          style={{ opacity: arrowHeadOpacity }}
        />
      </svg>
      {/* Label with glass plate background */}
      {label && (
        <div
          style={{
            position: "absolute",
            left: geo.labelX,
            top: geo.labelY,
            transform: "translateX(-50%)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
            padding: "4px 10px",
            borderRadius: 8,
            whiteSpace: "nowrap",
            opacity: labelOpacity,
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
