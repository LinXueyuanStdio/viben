import { useMemo } from "react"
import type { TrendlineCommand, Point } from "../types"
import { useDraw, useFadeIn } from "../utils/motion"
import { useCurrentFrame, interpolate } from "remotion"

interface TrendlineProps {
  command: TrendlineCommand
}

/**
 * Trendline overlay -- SVG polyline/path with Remotion stroke-dashoffset draw animation.
 * Supports optional dots (staggered fade-in), area fill below the line,
 * and an arrowhead at the end point.
 * Premium: gradient stroke along path, glowing dots with rings, refined area fill.
 * Static geometry is memoized to avoid recomputation on every frame.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Trendline({ command }: TrendlineProps) {
  const {
    points: _points,
    color,
    strokeWidth = 2.5,
    showDots = true,
    dotRadius = 4,
    fillBelow,
    endArrow,
  } = command
  const points = _points as Point[]

  const frame = useCurrentFrame()

  if (points.length < 2) return null

  // Memoize all static geometry (depends only on points, not frame)
  const geometry = useMemo(() => {
    const pathD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ")

    const minX = Math.min(...points.map((p) => p.x))
    const maxX = Math.max(...points.map((p) => p.x))
    const maxY = Math.max(...points.map((p) => p.y))

    const areaD = fillBelow
      ? `${pathD} L ${points[points.length - 1].x} ${maxY + 20} L ${points[0].x} ${maxY + 20} Z`
      : ""

    const lastPt = points[points.length - 1]
    const prevPt = points[points.length - 2]
    const arrowAngle = Math.atan2(lastPt.y - prevPt.y, lastPt.x - prevPt.x)
    const arrowSize = 10
    const headX1 = lastPt.x + Math.cos(arrowAngle + Math.PI * 0.8) * arrowSize
    const headY1 = lastPt.y + Math.sin(arrowAngle + Math.PI * 0.8) * arrowSize
    const headX2 = lastPt.x + Math.cos(arrowAngle - Math.PI * 0.8) * arrowSize
    const headY2 = lastPt.y + Math.sin(arrowAngle - Math.PI * 0.8) * arrowSize

    // Compute path length from straight segments (exact for polyline)
    const pathLength = points.reduce((sum, p, i) => {
      if (i === 0) return 0
      const prev = points[i - 1]
      return sum + Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2)
    }, 0)

    const base = `trendline-${Math.round(points[0].x)}-${Math.round(points[0].y)}-${points.length}`
    const gradientId = `${base}-fill`
    const strokeGradientId = `${base}-stroke`
    const glowFilterId = `${base}-glow`
    const dotGlowFilterId = `${base}-dot-glow`

    return {
      pathD, minX, maxX, maxY, areaD, lastPt,
      headX1, headY1, headX2, headY2,
      pathLength, gradientId, strokeGradientId, glowFilterId, dotGlowFilterId,
    }
  }, [points, fillBelow])

  const {
    pathD, minX, maxX, areaD, lastPt,
    headX1, headY1, headX2, headY2,
    pathLength, gradientId, strokeGradientId, glowFilterId, dotGlowFilterId,
  } = geometry

  // Remotion animations
  const drawProgress = useDraw(0, 24)
  const arrowOpacity = useFadeIn(21, 6)

  // Area fill clip width animated via interpolate
  const clipWidth = interpolate(frame, [0, 24], [0, maxX - minX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  // Derive lighter tint for gradient
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
          {/* Gradient for area fill */}
          {fillBelow && (
            <>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fillBelow} stopOpacity={0.35} />
                <stop offset="50%" stopColor={fillBelow} stopOpacity={0.15} />
                <stop offset="100%" stopColor={fillBelow} stopOpacity={0.02} />
              </linearGradient>
              <clipPath id={`${gradientId}-clip`}>
                <rect
                  x={minX}
                  y={0}
                  width={clipWidth}
                  height="100%"
                />
              </clipPath>
            </>
          )}
          {/* Gradient stroke along the line path */}
          <linearGradient
            id={strokeGradientId}
            x1={points[0].x}
            y1={points[0].y}
            x2={points[points.length - 1].x}
            y2={points[points.length - 1].y}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={color} stopOpacity={0.7} />
            <stop offset="40%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={colorLight} stopOpacity={1} />
          </linearGradient>
          {/* Soft glow for the line */}
          <filter id={glowFilterId} x="-10%" y="-20%" width="120%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
          </filter>
          {/* Dot glow filter */}
          <filter id={dotGlowFilterId} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>

        {/* Area fill below line */}
        {fillBelow && (
          <path
            d={areaD}
            fill={`url(#${gradientId})`}
            clipPath={`url(#${gradientId}-clip)`}
          />
        )}

        {/* Glow layer behind the main line */}
        <path
          d={pathD}
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
        {/* Main trend line with gradient stroke */}
        <path
          d={pathD}
          fill="none"
          stroke={`url(#${strokeGradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={pathLength * (1 - drawProgress)}
        />

        {/* End arrow */}
        {endArrow && (
          <polygon
            points={`${lastPt.x},${lastPt.y} ${headX1},${headY1} ${headX2},${headY2}`}
            fill={color}
            style={{ opacity: arrowOpacity }}
          />
        )}

        {/* Dots with glow ring */}
        {showDots &&
          points.map((p, i) => {
            const dotDelay = 9 + i * 2
            const dotOpacity = interpolate(frame - dotDelay, [0, 7], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
            return (
              <g key={i} style={{ opacity: dotOpacity }}>
                {/* Outer glow ring */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={dotRadius + 3}
                  fill={color}
                  filter={`url(#${dotGlowFilterId})`}
                  opacity={0.3}
                />
                {/* Outer ring */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={dotRadius + 1.5}
                  fill="none"
                  stroke={color}
                  strokeWidth={1}
                  opacity={0.5}
                />
                {/* Inner dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={dotRadius}
                  fill={color}
                />
                {/* Highlight speck */}
                <circle
                  cx={p.x - dotRadius * 0.25}
                  cy={p.y - dotRadius * 0.25}
                  r={dotRadius * 0.35}
                  fill="rgba(255, 255, 255, 0.5)"
                />
              </g>
            )
          })}
      </svg>
    </div>
  )
}
