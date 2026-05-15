import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { MeterCommand, Point } from "../types"

// Spring configs for layered timing
const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_FILL = { damping: 10, stiffness: 90, mass: 0.8 } as const
const SPRING_NEEDLE = { damping: 8, stiffness: 120, mass: 0.7 } as const
const SPRING_LABEL = { damping: 14, stiffness: 130, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface MeterProps {
  command: MeterCommand
}

/**
 * Meter overlay -- Linear meter/progress with gradient fill, tick marks, and animated needle.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance
 *   2. Track: fade in with slight scale
 *   3. Fill: animate width from 0 with spring
 *   4. Needle: spring to position with overshoot
 *   5. Tick marks and value label: staggered fade-in
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Meter({ command }: MeterProps) {
  const {
    position: _position,
    value,
    min = 0,
    max = 100,
    width = 280,
    label,
    color = "#6366F1",
    trackColor = "rgba(255,255,255,0.08)",
    ticks = 5,
    unit = "",
    showNeedle = true,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const clampedValue = Math.min(max, Math.max(min, value))
  const normalizedValue = (clampedValue - min) / (max - min)

  // ── Container entrance ──
  const containerProgress = spring({ frame, fps, config: SPRING_CONTAINER })
  const containerSettled = containerProgress >= 0.999
  const containerOpacity = containerSettled ? 1 : interpolate(containerProgress, [0, 0.3], [0, 1], CLAMP)
  const containerScale = containerSettled
    ? 1
    : interpolate(containerProgress, [0, 0.3, 0.8, 1], [0.9, 0.93, 1.02, 1], CLAMP)
  const containerTranslateY = containerSettled ? 0 : (1 - containerProgress) * 12
  const containerBlur = containerSettled ? 0 : interpolate(containerProgress, [0, 0.5], [4, 0], CLAMP)

  // ── Fill animation ──
  const fillDelay = 8
  const fillFrame = Math.max(0, frame - fillDelay)
  const fillSpring = frame < fillDelay ? 0 : spring({ frame: fillFrame, fps, config: SPRING_FILL })
  const fillSettled = fillSpring >= 0.999
  const fillProgress = fillSettled
    ? normalizedValue
    : normalizedValue * interpolate(fillSpring, [0, 0.7, 1], [0, 0.85, 1], CLAMP)

  // ── Needle animation (with overshoot) ──
  const needleDelay = 6
  const needleFrame = Math.max(0, frame - needleDelay)
  const needleSpring = frame < needleDelay ? 0 : spring({ frame: needleFrame, fps, config: SPRING_NEEDLE })
  const needleSettled = needleSpring >= 0.999
  const needleProgress = needleSettled
    ? normalizedValue
    : normalizedValue * interpolate(needleSpring, [0, 0.6, 0.85, 1], [0, 0.7, 1.06, 1], CLAMP)

  // ── Label animation ──
  const labelDelay = 14
  const labelFrame = Math.max(0, frame - labelDelay)
  const labelSpring = frame < labelDelay ? 0 : spring({ frame: labelFrame, fps, config: SPRING_LABEL })
  const labelSettled = labelSpring >= 0.999
  const labelOpacity = labelSettled ? 1 : interpolate(labelSpring, [0, 0.4], [0, 1], CLAMP)

  // Counter animation for displayed value
  const counterDuration = 25
  const counterElapsed = Math.max(0, frame - fillDelay)
  const counterProgress = counterElapsed >= counterDuration
    ? 1
    : interpolate(counterElapsed, [0, counterDuration], [0, 1], CLAMP)
  const inv = 1 - counterProgress
  const eased = 1 - inv * inv * inv
  const displayedValue = min + (clampedValue - min) * eased

  // Tick positions
  const tickPositions = useMemo(() => {
    const arr: number[] = []
    for (let i = 0; i <= ticks; i++) {
      arr.push(i / ticks)
    }
    return arr
  }, [ticks])

  const meterHeight = 14
  const padding = { left: 10, right: 10, top: 24, bottom: 30 }
  const svgW = width + padding.left + padding.right
  const svgH = meterHeight + padding.top + padding.bottom + (showNeedle ? 12 : 0)

  const uid = `meter-${position.x}-${position.y}`

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
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Label and value row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          opacity: labelOpacity,
        }}
      >
        {label && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.6)",
              fontFamily: "system-ui, sans-serif",
              letterSpacing: 0.3,
            }}
          >
            {label}
          </span>
        )}
        <span
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "#fff",
            fontFamily: "system-ui, monospace",
            letterSpacing: -0.5,
            textShadow: `0 0 8px ${color}44`,
          }}
        >
          {formatValue(displayedValue)}{unit}
        </span>
      </div>

      {/* SVG meter */}
      <svg width={svgW} height={svgH} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${uid}-fill-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity={0.7} />
            <stop offset="100%" stopColor={adjustColor(color, 40)} stopOpacity={1} />
          </linearGradient>
          <filter id={`${uid}-fill-glow`} x="-5%" y="-50%" width="110%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track background */}
        <rect
          x={padding.left}
          y={padding.top}
          width={width}
          height={meterHeight}
          rx={meterHeight / 2}
          ry={meterHeight / 2}
          fill={trackColor}
        />

        {/* Gradient fill */}
        <rect
          x={padding.left}
          y={padding.top}
          width={Math.max(0, width * fillProgress)}
          height={meterHeight}
          rx={meterHeight / 2}
          ry={meterHeight / 2}
          fill={`url(#${uid}-fill-grad)`}
          filter={`url(#${uid}-fill-glow)`}
        />

        {/* Tick marks */}
        {tickPositions.map((frac, i) => {
          const tickX = padding.left + frac * width
          const tickDelay = 12 + i * 2
          const tickFrame = Math.max(0, frame - tickDelay)
          const tickSpring = frame < tickDelay ? 0 : spring({ frame: tickFrame, fps, config: SPRING_LABEL })
          const tickSettled = tickSpring >= 0.999
          const tickOpacity = tickSettled ? 0.5 : interpolate(tickSpring, [0, 0.4], [0, 0.5], CLAMP)

          return (
            <g key={i} opacity={tickOpacity}>
              <line
                x1={tickX}
                y1={padding.top + meterHeight + 2}
                x2={tickX}
                y2={padding.top + meterHeight + 8}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={1}
              />
              <text
                x={tickX}
                y={padding.top + meterHeight + 18}
                textAnchor="middle"
                fill="rgba(255,255,255,0.4)"
                fontSize={8}
                fontFamily="system-ui, monospace"
              >
                {Math.round(min + frac * (max - min))}
              </text>
            </g>
          )
        })}

        {/* Needle */}
        {showNeedle && (
          <g>
            {/* Needle line */}
            <line
              x1={padding.left + Math.min(needleProgress, 1) * width}
              y1={padding.top - 4}
              x2={padding.left + Math.min(needleProgress, 1) * width}
              y2={padding.top + meterHeight + 4}
              stroke="rgba(255,255,255,0.9)"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={needleSpring > 0.05 ? 1 : 0}
            />
            {/* Needle head (triangle) */}
            <polygon
              points={`${padding.left + Math.min(needleProgress, 1) * width - 4},${padding.top - 4} ${padding.left + Math.min(needleProgress, 1) * width + 4},${padding.top - 4} ${padding.left + Math.min(needleProgress, 1) * width},${padding.top - 10}`}
              fill="rgba(255,255,255,0.9)"
              opacity={needleSpring > 0.05 ? 1 : 0}
            />
          </g>
        )}
      </svg>
    </div>
  )
}

function formatValue(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  return n.toFixed(1)
}

/** Lighten/shift a hex color */
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16)
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}
