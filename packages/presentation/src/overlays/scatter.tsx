import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { ScatterCommand, Point } from "../types"

// Spring configs for layered timing
const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_DOT = { damping: 8, stiffness: 120, mass: 0.6 } as const
const SPRING_AXIS = { damping: 14, stiffness: 130, mass: 0.7 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface ScatterProps {
  command: ScatterCommand
}

/**
 * Scatter overlay -- Scatter plot with dots that appear with physics-based scatter animation.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance
 *   2. Axes: draw in with spring
 *   3. Dots: appear with staggered springs, overshoot from random directions
 *   4. Labels: fade in after dots settle
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Scatter({ command }: ScatterProps) {
  const {
    position: _position,
    points,
    width = 280,
    height = 200,
    color = "#6366F1",
    dotRadius = 5,
    xLabel,
    yLabel,
    showGrid = true,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ── Container entrance ──
  const containerProgress = spring({ frame, fps, config: SPRING_CONTAINER })
  const containerSettled = containerProgress >= 0.999
  const containerOpacity = containerSettled ? 1 : interpolate(containerProgress, [0, 0.3], [0, 1], CLAMP)
  const containerScale = containerSettled
    ? 1
    : interpolate(containerProgress, [0, 0.3, 0.8, 1], [0.9, 0.93, 1.02, 1], CLAMP)
  const containerTranslateY = containerSettled ? 0 : (1 - containerProgress) * 12
  const containerBlur = containerSettled ? 0 : interpolate(containerProgress, [0, 0.5], [4, 0], CLAMP)

  // ── Axis draw ──
  const axisDelay = 6
  const axisFrame = Math.max(0, frame - axisDelay)
  const axisSpring = frame < axisDelay ? 0 : spring({ frame: axisFrame, fps, config: SPRING_AXIS })
  const axisSettled = axisSpring >= 0.999
  const axisProgress = axisSettled ? 1 : interpolate(axisSpring, [0, 1], [0, 1], CLAMP)

  // Compute dot positions
  const padding = { top: 20, right: 20, bottom: 30, left: 40 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const dotPositions = useMemo(() => {
    if (points.length === 0) return []
    const xValues = points.map((p) => p.x)
    const yValues = points.map((p) => p.y)
    const xMin = Math.min(...xValues)
    const xMax = Math.max(...xValues)
    const yMin = Math.min(...yValues)
    const yMax = Math.max(...yValues)
    const xRange = xMax - xMin || 1
    const yRange = yMax - yMin || 1

    return points.map((p, i) => {
      const px = padding.left + ((p.x - xMin) / xRange) * plotW
      const py = padding.top + (1 - (p.y - yMin) / yRange) * plotH
      // Random scatter direction for entrance
      const angle = (i * 137.508) * (Math.PI / 180) // golden angle distribution
      const scatter = 20 + (i % 3) * 10
      return {
        px,
        py,
        scatterX: Math.cos(angle) * scatter,
        scatterY: Math.sin(angle) * scatter,
        color: p.color ?? color,
        label: p.label,
        size: p.size ?? dotRadius,
      }
    })
  }, [points, plotW, plotH, padding.left, padding.top, color, dotRadius])

  const uid = `scatter-${position.x}-${position.y}`

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        transform: `translateY(${containerTranslateY}px) scale(${containerScale})`,
        opacity: containerOpacity,
        filter: containerBlur > 0.01 ? `blur(${containerBlur}px)` : undefined,
        willChange: "transform, opacity",
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {showGrid && (
          <g opacity={axisProgress * 0.15}>
            {[0.25, 0.5, 0.75].map((frac) => (
              <g key={frac}>
                <line
                  x1={padding.left}
                  y1={padding.top + plotH * frac}
                  x2={padding.left + plotW}
                  y2={padding.top + plotH * frac}
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth={0.5}
                  strokeDasharray="3,3"
                />
                <line
                  x1={padding.left + plotW * frac}
                  y1={padding.top}
                  x2={padding.left + plotW * frac}
                  y2={padding.top + plotH}
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth={0.5}
                  strokeDasharray="3,3"
                />
              </g>
            ))}
          </g>
        )}

        {/* X axis */}
        <line
          x1={padding.left}
          y1={padding.top + plotH}
          x2={padding.left + plotW * axisProgress}
          y2={padding.top + plotH}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={1}
        />

        {/* Y axis */}
        <line
          x1={padding.left}
          y1={padding.top + plotH}
          x2={padding.left}
          y2={padding.top + plotH * (1 - axisProgress)}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={1}
        />

        {/* Axis labels */}
        {xLabel && (
          <text
            x={padding.left + plotW / 2}
            y={height - 4}
            textAnchor="middle"
            fill="rgba(255,255,255,0.5)"
            fontSize={9}
            fontFamily="system-ui, sans-serif"
            opacity={axisProgress}
          >
            {xLabel}
          </text>
        )}
        {yLabel && (
          <text
            x={10}
            y={padding.top + plotH / 2}
            textAnchor="middle"
            fill="rgba(255,255,255,0.5)"
            fontSize={9}
            fontFamily="system-ui, sans-serif"
            opacity={axisProgress}
            transform={`rotate(-90, 10, ${padding.top + plotH / 2})`}
          >
            {yLabel}
          </text>
        )}

        {/* Scatter dots */}
        {dotPositions.map((dot, i) => {
          const dotDelay = 10 + i * 2
          const dotFrame = Math.max(0, frame - dotDelay)
          const dotSpring = frame < dotDelay ? 0 : spring({ frame: dotFrame, fps, config: SPRING_DOT })
          const dotSettled = dotSpring >= 0.999

          const x = dotSettled
            ? dot.px
            : dot.px + dot.scatterX * (1 - dotSpring)
          const y = dotSettled
            ? dot.py
            : dot.py + dot.scatterY * (1 - dotSpring)
          const dotScale = dotSettled
            ? 1
            : interpolate(dotSpring, [0, 0.3, 0.7, 1], [0, 1.3, 0.9, 1], CLAMP)
          const dotOpacity = dotSettled ? 0.85 : interpolate(dotSpring, [0, 0.15], [0, 0.85], CLAMP)

          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={dot.size * dotScale}
                fill={dot.color}
                opacity={dotOpacity}
                filter={`url(#${uid}-glow)`}
              />
              {dot.label && dotSettled && (
                <text
                  x={x}
                  y={y - dot.size - 4}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.7)"
                  fontSize={8}
                  fontFamily="system-ui, sans-serif"
                  fontWeight={600}
                >
                  {dot.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
