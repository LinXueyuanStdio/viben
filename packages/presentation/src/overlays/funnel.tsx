import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring } from "remotion"
import type { FunnelCommand, Point } from "../types"
import { useEntrance, staggerDelay } from "../utils/motion"

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 } as const

interface FunnelProps {
  command: FunnelCommand
}

/**
 * Funnel overlay -- Vertical funnel/pyramid with staggered stage reveal.
 * Each stage is a trapezoid, wider at top, narrower at bottom.
 * Parent computes all stage spring values to avoid per-stage useCurrentFrame subscriptions.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Funnel({ command }: FunnelProps) {
  const {
    position: _position,
    stages,
    width = 240,
    height = 200,
  } = command
  const position = _position as Point

  const entrance = useEntrance(0, 12)
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  if (stages.length === 0) return null

  const stageCount = stages.length
  const stageHeight = height / stageCount
  const gap = 2

  // Default colors
  const defaultColors = ["#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899", "#F43F5E", "#F97316"]

  // Pre-compute all stage spring values in parent (no useMemo -- frame changes every render)
  const stageSprings = stages.map((_, i) => {
    const delay = staggerDelay(i, 4) + 8
    const val = spring({ frame: frame - delay, fps, config: SPRING_CONFIG })
    return val >= 0.999 ? 1 : val
  })

  const centerX = width / 2
  const minWidthFraction = 0.3
  const uid = `funnel-${position.x}-${position.y}`

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        transform: `translateY(${entrance.translateY}px) scale(${entrance.scale})`,
        opacity: entrance.opacity,
        willChange: "transform, opacity",
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
        <defs>
          {stages.map((stage, i) => {
            const color = stage.color ?? defaultColors[i % defaultColors.length]
            return (
              <linearGradient key={i} id={`${uid}-stage-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={color} stopOpacity={0.7} />
              </linearGradient>
            )
          })}
          {/* Inner shine filter */}
          <filter id={`${uid}-shine`} x="0" y="0" width="100%" height="100%">
            <feFlood floodColor="white" floodOpacity="0.08" result="flood" />
            <feComposite in="flood" in2="SourceAlpha" operator="in" result="shine" />
            <feOffset dy="1" result="shineOffset" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="shineOffset" />
            </feMerge>
          </filter>
        </defs>

        {stages.map((stage, i) => {
          const springVal = stageSprings[i]
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

          return (
            <g
              key={i}
              style={{
                opacity: springVal,
                transform: `scaleY(${0.7 + springVal * 0.3})`,
                transformOrigin: `${centerX}px ${labelY}px`,
              }}
            >
              <polygon
                points={points}
                fill={`url(#${uid}-stage-${i})`}
                filter={`url(#${uid}-shine)`}
              />
              <text
                x={centerX}
                y={labelY - 3}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize={11}
                fontWeight={600}
                fontFamily="system-ui, sans-serif"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" } as React.CSSProperties}
              >
                {stage.label}
              </text>
              <text
                x={centerX}
                y={labelY + 13}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.6)"
                fontSize={10}
                fontFamily="system-ui, monospace"
                letterSpacing={0.3}
              >
                {typeof stage.value === "number" ? stage.value.toLocaleString() : stage.value}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
