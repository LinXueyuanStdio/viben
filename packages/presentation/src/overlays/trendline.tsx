import { useEffect, useRef, useState } from "react"
import type { TrendlineCommand, Point } from "../types"

interface TrendlineProps {
  command: TrendlineCommand
}

/**
 * Trendline overlay -- SVG polyline/path with stroke-dashoffset draw animation.
 * Supports optional dots (staggered fade-in), area fill below the line,
 * and an arrowhead at the end point.
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
    animate = true,
  } = command
  const points = _points as Point[]

  const pathRef = useRef<SVGPathElement>(null)
  const [pathLength, setPathLength] = useState(0)

  // Measure real path length once mounted
  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength())
    }
  }, [points])

  if (points.length < 2) return null

  // Build the SVG path string from points
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ")

  // Compute bounding box for the fill area
  const minX = Math.min(...points.map((p) => p.x))
  const maxX = Math.max(...points.map((p) => p.x))
  const maxY = Math.max(...points.map((p) => p.y))

  // Build the closed area path for fillBelow
  const areaD = fillBelow
    ? `${pathD} L ${points[points.length - 1].x} ${maxY + 20} L ${points[0].x} ${maxY + 20} Z`
    : ""

  // End arrow: arrowhead at the last point, pointing in the direction of the last segment
  const lastPt = points[points.length - 1]
  const prevPt = points[points.length - 2]
  const arrowAngle = Math.atan2(lastPt.y - prevPt.y, lastPt.x - prevPt.x)
  const arrowSize = 10
  const arrowAngle1 = arrowAngle + Math.PI * 0.8
  const arrowAngle2 = arrowAngle - Math.PI * 0.8
  const headX1 = lastPt.x + Math.cos(arrowAngle1) * arrowSize
  const headY1 = lastPt.y + Math.sin(arrowAngle1) * arrowSize
  const headX2 = lastPt.x + Math.cos(arrowAngle2) * arrowSize
  const headY2 = lastPt.y + Math.sin(arrowAngle2) * arrowSize

  // Use an estimated length for initial render (before measurement kicks in)
  const estimatedLength =
    pathLength > 0
      ? pathLength
      : points.reduce((sum, p, i) => {
          if (i === 0) return 0
          const prev = points[i - 1]
          return sum + Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2)
        }, 0)

  const lineDrawStyle: React.CSSProperties = animate
    ? {
        strokeDasharray: estimatedLength,
        strokeDashoffset: estimatedLength,
        animation: `presentationDrawLine 800ms ease-out forwards`,
      }
    : {}

  // Unique gradient ID per instance
  const gradientId = `trendline-fill-${points.map((p) => `${p.x}-${p.y}`).join("-").slice(0, 40)}`

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
        {/* Gradient definition for area fill */}
        {fillBelow && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillBelow} stopOpacity={0.4} />
              <stop offset="100%" stopColor={fillBelow} stopOpacity={0.02} />
            </linearGradient>
            <clipPath id={`${gradientId}-clip`}>
              <rect
                x={minX}
                y={0}
                width={animate ? 0 : maxX - minX}
                height="100%"
                style={
                  animate
                    ? {
                        animation: `presentationTrendlineClip 800ms ease-out forwards`,
                      }
                    : undefined
                }
              >
                {animate && (
                  <animate
                    attributeName="width"
                    from="0"
                    to={maxX - minX}
                    dur="0.8s"
                    fill="freeze"
                    calcMode="spline"
                    keySplines="0.4 0 0.2 1"
                    keyTimes="0;1"
                  />
                )}
              </rect>
            </clipPath>
          </defs>
        )}

        {/* Area fill below line */}
        {fillBelow && (
          <path
            d={areaD}
            fill={`url(#${gradientId})`}
            clipPath={`url(#${gradientId}-clip)`}
          />
        )}

        {/* Main trend line */}
        <path
          ref={pathRef}
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={lineDrawStyle}
        />

        {/* End arrow */}
        {endArrow && (
          <polygon
            points={`${lastPt.x},${lastPt.y} ${headX1},${headY1} ${headX2},${headY2}`}
            fill={color}
            style={{
              opacity: animate ? 0 : 1,
              animation: animate
                ? "presentationFadeIn 200ms ease-out 700ms forwards"
                : undefined,
            }}
          />
        )}

        {/* Dots */}
        {showDots &&
          points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={dotRadius}
              fill={color}
              style={{
                opacity: animate ? 0 : 1,
                animation: animate
                  ? `presentationFadeIn 250ms ease-out ${300 + i * 80}ms forwards`
                  : undefined,
              }}
            />
          ))}
      </svg>
    </div>
  )
}
