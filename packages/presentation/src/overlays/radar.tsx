import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { RadarCommand, Point } from "../types"
import { useEntrance, staggerDelay } from "../utils/motion"

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 } as const

interface RadarProps {
  command: RadarCommand
}

/**
 * Radar overlay -- Spider/radar chart with animated polygon fill and staggered axis labels.
 * Uses spring physics for polygon expansion from center outward.
 * Premium visual: glass container, gradient polygon fill, glowing axis labels, refined grid.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Radar({ command }: RadarProps) {
  const {
    position: _position,
    axes,
    color = "#6366F1",
    fillOpacity = 0.25,
    size = 200,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const containerEntrance = useEntrance(0, 12)

  const axisCount = axes.length

  // Static geometry (does not depend on frame)
  const geometry = useMemo(() => {
    const cx = size / 2
    const cy = size / 2
    const radius = size / 2 - 30
    const angleStep = (2 * Math.PI) / axisCount

    // Grid rings (3 levels)
    const rings = [0.33, 0.66, 1.0]

    // Axis endpoints
    const axisEndpoints = axes.map((_, i) => {
      const angle = -Math.PI / 2 + i * angleStep
      return {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      }
    })

    // Value points (normalized 0-1)
    const valuePoints = axes.map((axis, i) => {
      const angle = -Math.PI / 2 + i * angleStep
      const normalizedValue = Math.min(1, Math.max(0, axis.value / 100))
      return {
        x: cx + radius * normalizedValue * Math.cos(angle),
        y: cy + radius * normalizedValue * Math.sin(angle),
      }
    })

    // Label positions (slightly outside the chart)
    const labelPositions = axes.map((_, i) => {
      const angle = -Math.PI / 2 + i * angleStep
      const labelRadius = radius + 20
      return {
        x: cx + labelRadius * Math.cos(angle),
        y: cy + labelRadius * Math.sin(angle),
        anchor: Math.abs(Math.cos(angle)) < 0.1
          ? "middle" as const
          : Math.cos(angle) > 0
            ? "start" as const
            : "end" as const,
      }
    })

    return { cx, cy, radius, angleStep, rings, axisEndpoints, valuePoints, labelPositions }
  }, [axes, axisCount, size])

  const { cx, cy, radius, rings, axisEndpoints, valuePoints, labelPositions } = geometry

  // Polygon fill expansion (spring-based)
  const fillProgress = spring({
    frame: frame - 8,
    fps,
    config: { damping: 14, stiffness: 80, mass: 1.0 },
  })
  const clampedFill = Math.min(1, Math.max(0, fillProgress))

  // Per-label opacity with stagger
  const labelOpacities = axes.map((_, i) => {
    const delay = staggerDelay(i, 3) + 5
    const progress = spring({ frame: frame - delay, fps, config: SPRING_CONFIG })
    return progress >= 0.999 ? 1 : Math.max(0, progress)
  })

  // Build the value polygon path with animation
  const polygonPath = useMemo(() => {
    if (clampedFill <= 0) return ""
    return valuePoints
      .map((pt, i) => {
        const x = cx + (pt.x - cx) * clampedFill
        const y = cy + (pt.y - cy) * clampedFill
        return `${i === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ") + " Z"
  }, [valuePoints, cx, cy, clampedFill])

  // Unique gradient ID
  const gradId = `radar-fill-${size}`
  const glowId = `radar-glow-${size}`

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.92) 70%)",
        borderRadius: 14,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 8px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: 16,
        opacity: containerEntrance.opacity,
        transform: `translateY(${containerEntrance.translateY}px) scale(${containerEntrance.scale})`,
        willChange: "transform, opacity",
      }}
    >
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        <defs>
          {/* Radial gradient for polygon fill */}
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity * 1.5} />
            <stop offset="100%" stopColor={color} stopOpacity={fillOpacity * 0.5} />
          </radialGradient>
          {/* Glow filter for value dots */}
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid rings with refined styling */}
        {rings.map((ringScale, i) => (
          <polygon
            key={i}
            points={axisEndpoints
              .map((ep) => `${cx + (ep.x - cx) * ringScale},${cy + (ep.y - cy) * ringScale}`)
              .join(" ")}
            fill="none"
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth={i === rings.length - 1 ? 1.5 : 0.5}
            strokeDasharray={i === rings.length - 1 ? "none" : "3 3"}
          />
        ))}

        {/* Axis lines */}
        {axisEndpoints.map((ep, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={ep.x}
            y2={ep.y}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={0.8}
          />
        ))}

        {/* Value polygon fill with gradient */}
        {polygonPath && (
          <path
            d={polygonPath}
            fill={`url(#${gradId})`}
            fillOpacity={clampedFill}
            stroke={color}
            strokeWidth={2}
            strokeOpacity={clampedFill}
            style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
          />
        )}

        {/* Value dots with glow */}
        {valuePoints.map((pt, i) => {
          const x = cx + (pt.x - cx) * clampedFill
          const y = cy + (pt.y - cy) * clampedFill
          return (
            <g key={i}>
              {/* Glow halo */}
              <circle
                cx={x}
                cy={y}
                r={8}
                fill={color}
                opacity={clampedFill * 0.15}
              />
              {/* Dot */}
              <circle
                cx={x}
                cy={y}
                r={4}
                fill={color}
                opacity={clampedFill}
                filter={`url(#${glowId})`}
              />
              {/* Bright center */}
              <circle
                cx={x}
                cy={y}
                r={1.5}
                fill="#fff"
                opacity={clampedFill * 0.8}
              />
            </g>
          )
        })}

        {/* Axis labels with glow effect */}
        {axes.map((axis, i) => {
          const lp = labelPositions[i]
          return (
            <g key={i} opacity={labelOpacities[i]}>
              {/* Label glow */}
              <text
                x={lp.x}
                y={lp.y}
                textAnchor={lp.anchor}
                dominantBaseline="central"
                fill={color}
                fontSize={11}
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight={600}
                opacity={0.3}
                style={{ filter: "blur(4px)" }}
              >
                {axis.label}
              </text>
              {/* Label text */}
              <text
                x={lp.x}
                y={lp.y}
                textAnchor={lp.anchor}
                dominantBaseline="central"
                fill="rgba(255, 255, 255, 0.9)"
                fontSize={11}
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight={600}
              >
                {axis.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
