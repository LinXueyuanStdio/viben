import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { PolarAreaCommand, Point } from "../types"

// Spring configs for layered timing
const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_SEGMENT = { damping: 10, stiffness: 120, mass: 0.7 } as const
const SPRING_LABEL = { damping: 14, stiffness: 130, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface PolarAreaProps {
  command: PolarAreaCommand
}

/**
 * PolarArea overlay -- Polar area chart (rose chart) with animated segment fan-out.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance
 *   2. Segments: fan out from center with staggered spring, each segment's radius is proportional to value
 *   3. Labels: fade in after segments settle
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function PolarArea({ command }: PolarAreaProps) {
  const {
    position: _position,
    segments,
    size = 200,
    colors,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const defaultColors = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#8B5CF6", "#14B8A6"]
  const palette = colors ?? defaultColors

  // ── Container entrance ──
  const containerProgress = spring({ frame, fps, config: SPRING_CONTAINER })
  const containerSettled = containerProgress >= 0.999
  const containerOpacity = containerSettled ? 1 : interpolate(containerProgress, [0, 0.3], [0, 1], CLAMP)
  const containerScale = containerSettled
    ? 1
    : interpolate(containerProgress, [0, 0.3, 0.8, 1], [0.9, 0.93, 1.02, 1], CLAMP)
  const containerTranslateY = containerSettled ? 0 : (1 - containerProgress) * 12
  const containerBlur = containerSettled ? 0 : interpolate(containerProgress, [0, 0.5], [4, 0], CLAMP)

  // Compute geometry
  const geometry = useMemo(() => {
    const maxValue = Math.max(...segments.map((s) => s.value), 1)
    const cx = size / 2
    const cy = size / 2
    const maxRadius = size / 2 - 20
    const anglePerSegment = (2 * Math.PI) / segments.length

    return segments.map((seg, i) => {
      const startAngle = i * anglePerSegment - Math.PI / 2
      const endAngle = startAngle + anglePerSegment
      const r = (seg.value / maxValue) * maxRadius
      const color = seg.color ?? palette[i % palette.length]

      // Build SVG path for sector
      const x1 = cx + r * Math.cos(startAngle)
      const y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(endAngle)
      const y2 = cy + r * Math.sin(endAngle)
      const largeArc = anglePerSegment > Math.PI ? 1 : 0

      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`

      // Label position (midpoint of arc, slightly outside)
      const midAngle = (startAngle + endAngle) / 2
      const labelR = Math.min(r + 16, maxRadius + 12)
      const labelX = cx + labelR * Math.cos(midAngle)
      const labelY = cy + labelR * Math.sin(midAngle)

      return { path, color, label: seg.label, labelX, labelY, midAngle }
    })
  }, [segments, size, palette])

  const uid = `polar-${position.x}-${position.y}`

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
        padding: 20,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Center ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={8}
          fill="rgba(255,255,255,0.1)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1}
        />

        {/* Segments with staggered spring animation */}
        {geometry.map((geo, i) => {
          const staggerDelay = 6 + i * 4
          const segFrame = Math.max(0, frame - staggerDelay)
          const segSpring = frame < staggerDelay ? 0 : spring({ frame: segFrame, fps, config: SPRING_SEGMENT })
          const segSettled = segSpring >= 0.999
          const segScale = segSettled
            ? 1
            : interpolate(segSpring, [0, 0.5, 0.85, 1], [0, 0.6, 1.06, 1], CLAMP)
          const segOpacity = segSettled ? 0.85 : interpolate(segSpring, [0, 0.2], [0, 0.85], CLAMP)

          // Label entrance
          const labelDelay = staggerDelay + 10
          const labelFrame = Math.max(0, frame - labelDelay)
          const labelSpring = frame < labelDelay ? 0 : spring({ frame: labelFrame, fps, config: SPRING_LABEL })
          const labelSettled = labelSpring >= 0.999
          const labelOpacity = labelSettled ? 1 : interpolate(labelSpring, [0, 0.4], [0, 1], CLAMP)

          return (
            <g key={i}>
              <path
                d={geo.path}
                fill={geo.color}
                opacity={segOpacity}
                transform={`scale(${segScale})`}
                style={{ transformOrigin: `${size / 2}px ${size / 2}px` } as React.CSSProperties}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1}
              />
              {geo.label && (
                <text
                  x={geo.labelX}
                  y={geo.labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="rgba(255,255,255,0.8)"
                  fontSize={9}
                  fontFamily="system-ui, sans-serif"
                  fontWeight={600}
                  opacity={labelOpacity}
                >
                  {geo.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
