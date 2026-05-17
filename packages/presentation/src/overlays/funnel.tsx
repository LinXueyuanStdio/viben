import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { FunnelCommand, Point } from "../types"
import { staggerDelay } from "../utils/motion"
import { useOverlayStyle } from "../hooks/use-overlay-style"

const SPRING_STAGE = { damping: 14, stiffness: 110, mass: 0.8 } as const
const SPRING_VALUE = { damping: 12, stiffness: 130, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface FunnelProps {
  command: FunnelCommand
}

/**
 * Funnel overlay -- Vertical funnel/pyramid with cinematic staggered stage reveal.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance with blur clear
 *   2. Stages: staggered drop-in from top with scale overshoot
 *   3. Values: counter animation after stage settles
 *   4. Conversion arrows: draw between stages
 *   5. Gradient shine: sweeping highlight after settle
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Funnel({ command }: FunnelProps) {
  const {
    position: _position,
    stages,
    width: _width = 240,
    height: _height = 200,
  } = command
  const position = _position as Point
  const width = Math.max(280, _width)
  const height = Math.max(200, _height)

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  if (stages.length === 0) return null

  const stageCount = stages.length
  const stageHeight = height / stageCount
  const gap = 2

  // Default colors
  const defaultColors = ["#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899", "#F43F5E", "#F97316"]

  // Pre-compute all stage spring values
  const stageSprings = stages.map((_, i) => {
    const delay = staggerDelay(i, 5) + 6
    const val = spring({ frame: frame - delay, fps, config: SPRING_STAGE })
    return val >= 0.999 ? 1 : Math.max(0, val)
  })

  // Value counter springs (delayed further)
  const valueSprings = stages.map((_, i) => {
    const delay = staggerDelay(i, 5) + 14
    const val = spring({ frame: frame - delay, fps, config: SPRING_VALUE })
    return val >= 0.999 ? 1 : Math.max(0, val)
  })

  // Counter animation for values
  const counterDuration = 20
  const counterValues = stages.map((stage, i) => {
    const delay = staggerDelay(i, 5) + 14
    const elapsed = Math.max(0, frame - delay)
    const progress = elapsed >= counterDuration ? 1 : interpolate(elapsed, [0, counterDuration], [0, 1], CLAMP)
    const inv = 1 - progress
    const eased = 1 - inv * inv * inv
    return Math.round((typeof stage.value === "number" ? stage.value : 0) * eased)
  })

  const centerX = width / 2
  const minWidthFraction = 0.3
  const uid = `funnel-${position.x}-${position.y}`

  // Conversion rate labels
  const conversionRates = useMemo(() => {
    return stages.slice(1).map((stage, i) => {
      const prev = stages[i]
      if (typeof prev.value === "number" && typeof stage.value === "number" && prev.value > 0) {
        return Math.round((stage.value / prev.value) * 100)
      }
      return null
    })
  }, [stages])

  const containerWidth = width + 40   // 20px padding * 2
  const containerHeight = height + 40

  const overlayStyle = useOverlayStyle({ position, width: containerWidth, height: containerHeight })

  return (
    <div
      style={{
        ...overlayStyle,
        minWidth: 280,
        minHeight: 200,
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {/* Noise texture overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 16,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          pointerEvents: "none",
        }}
      />

      <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
        <defs>
          {stages.map((stage, i) => {
            const color = stage.color ?? defaultColors[i % defaultColors.length]
            return (
              <linearGradient key={i} id={`${uid}-stage-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                <stop offset="60%" stopColor={color} stopOpacity={0.8} />
                <stop offset="100%" stopColor={color} stopOpacity={0.6} />
              </linearGradient>
            )
          })}
          {/* Inner shine filter */}
          <filter id={`${uid}-shine`} x="0" y="0" width="100%" height="100%">
            <feFlood floodColor="white" floodOpacity="0.1" result="flood" />
            <feComposite in="flood" in2="SourceAlpha" operator="in" result="shine" />
            <feOffset dy="1" result="shineOffset" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="shineOffset" />
            </feMerge>
          </filter>
          {/* Drop shadow filter */}
          <filter id={`${uid}-shadow`} x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.3)" />
          </filter>
        </defs>

        {stages.map((stage, i) => {
          const springVal = stageSprings[i]
          const valueSpring = valueSprings[i]
          const color = stage.color ?? defaultColors[i % defaultColors.length]

          const topFraction = 1 - (i / stageCount) * (1 - minWidthFraction)
          const bottomFraction = 1 - ((i + 1) / stageCount) * (1 - minWidthFraction)

          const topWidth = width * topFraction
          const bottomWidth = width * bottomFraction

          const y = i * stageHeight
          const labelY = y + stageHeight / 2

          const x1 = centerX - topWidth / 2
          const x2 = centerX + topWidth / 2
          const x3 = centerX + bottomWidth / 2
          const x4 = centerX - bottomWidth / 2

          const points = `${x1},${y + gap} ${x2},${y + gap} ${x3},${y + stageHeight - gap} ${x4},${y + stageHeight - gap}`

          // Scale-from-top entrance with overshoot
          const stageScale = springVal < 1
            ? interpolate(springVal, [0, 0.6, 0.85, 1], [0.7, 0.95, 1.03, 1], CLAMP)
            : 1

          return (
            <g
              key={i}
              style={{
                opacity: springVal,
                transform: `scaleY(${stageScale}) translateY(${(1 - springVal) * -8}px)`,
                transformOrigin: `${centerX}px ${labelY}px`,
              }}
            >
              <polygon
                points={points}
                fill={`url(#${uid}-stage-${i})`}
                filter={`url(#${uid}-shine)`}
                style={{ filter: `drop-shadow(0 2px 4px ${color}33)` }}
              />
              {/* Inner highlight edge */}
              <polygon
                points={points}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={0.5}
              />
              {/* Label */}
              <text
                x={centerX}
                y={labelY - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize={11}
                fontWeight={700}
                fontFamily="system-ui, sans-serif"
                opacity={valueSpring}
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" } as React.CSSProperties}
              >
                {stage.label}
              </text>
              {/* Value with counter animation */}
              <text
                x={centerX}
                y={labelY + 12}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.75)"
                fontSize={10}
                fontWeight={600}
                fontFamily="system-ui, monospace"
                opacity={valueSpring}
                letterSpacing={0.5}
                style={{ fontVariantNumeric: "tabular-nums" } as React.CSSProperties}
              >
                {typeof stage.value === "number" ? counterValues[i].toLocaleString() : stage.value}
              </text>
            </g>
          )
        })}

        {/* Conversion rate indicators between stages */}
        {conversionRates.map((rate, i) => {
          if (rate === null) return null
          const y = (i + 1) * stageHeight
          const valueSpring = valueSprings[i + 1]
          return (
            <g key={`conv-${i}`} opacity={valueSpring * 0.7}>
              <text
                x={width - 4}
                y={y}
                textAnchor="end"
                dominantBaseline="central"
                fill="rgba(255,255,255,0.4)"
                fontSize={10}
                fontWeight={600}
                fontFamily="system-ui, monospace"
                letterSpacing={0.3}
              >
                {rate}%
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
