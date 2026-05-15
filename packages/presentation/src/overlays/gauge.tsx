import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { GaugeCommand, Point } from "../types"

// Spring configs for layered timing
const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_NEEDLE = { damping: 8, stiffness: 120, mass: 0.7 } as const
const SPRING_VALUE = { damping: 14, stiffness: 130, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface GaugeProps {
  command: GaugeCommand
}

/**
 * Gauge overlay -- Circular SVG arc gauge with cinematic layered entrance.
 *
 * Motion layers:
 *   1. Arc: animated stroke-dashoffset draw with slight overshoot
 *   2. Needle: spring rotation with overshoot (goes past target, bounces back)
 *   3. Value text: counter animation with blur clear
 *   4. Background ring: subtle rotating glow
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Gauge({ command }: GaugeProps) {
  const {
    position: _position,
    value,
    radius = 60,
    label,
    color = "#6366F1",
    trackColor = "rgba(255,255,255,0.08)",
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const clampedValue = Math.min(100, Math.max(0, value))

  // ── Container entrance ──
  const containerProgress = spring({ frame, fps, config: SPRING_CONTAINER })
  const containerSettled = containerProgress >= 0.999
  const containerOpacity = containerSettled ? 1 : interpolate(containerProgress, [0, 0.3], [0, 1], CLAMP)
  const containerScale = containerSettled
    ? 1
    : interpolate(containerProgress, [0, 0.3, 0.8, 1], [0.9, 0.93, 1.02, 1], CLAMP)
  const containerTranslateY = containerSettled ? 0 : (1 - containerProgress) * 12
  const containerBlur = containerSettled ? 0 : interpolate(containerProgress, [0, 0.5], [4, 0], CLAMP)

  // ── Arc draw: spring-based with overshoot ──
  const arcDelay = 8
  const arcFrame = Math.max(0, frame - arcDelay)
  const arcSpring = frame < arcDelay ? 0 : spring({ frame: arcFrame, fps, config: SPRING_NEEDLE })
  const arcSettled = arcSpring >= 0.999
  // Overshoot: draw past target then settle back
  const arcProgress = arcSettled
    ? 1
    : interpolate(arcSpring, [0, 0.6, 0.85, 1], [0, 0.7, 1.06, 1], CLAMP)

  // ── Needle: spring rotation with overshoot ──
  const needleDelay = 6
  const needleFrame = Math.max(0, frame - needleDelay)
  const needleSpring = frame < needleDelay ? 0 : spring({ frame: needleFrame, fps, config: SPRING_NEEDLE })
  const needleSettled = needleSpring >= 0.999
  // Overshoot: goes ~8% past target, bounces back
  const needleProgress = needleSettled
    ? 1
    : interpolate(needleSpring, [0, 0.55, 0.8, 1], [0, 0.65, 1.08, 1], CLAMP)

  // ── Value text: counter with blur clear ──
  const valueDelay = 10
  const valueFrame = Math.max(0, frame - valueDelay)
  const valueSpring = frame < valueDelay ? 0 : spring({ frame: valueFrame, fps, config: SPRING_VALUE })
  const valueSettled = valueSpring >= 0.999
  const valueOpacity = valueSettled ? 1 : interpolate(valueSpring, [0, 0.3], [0, 1], CLAMP)
  const valueBlur = valueSettled ? 0 : interpolate(valueSpring, [0, 0.7], [6, 0], CLAMP)
  const valueScale = valueSettled
    ? 1
    : interpolate(valueSpring, [0, 0.7, 1], [0.85, 1.03, 1], CLAMP)

  // Value counter
  const counterDuration = 25
  const counterElapsed = Math.max(0, frame - valueDelay)
  const counterProgress = counterElapsed >= counterDuration
    ? 1
    : interpolate(counterElapsed, [0, counterDuration], [0, 1], CLAMP)
  // Ease-out cubic
  const inv = 1 - counterProgress
  const eased = 1 - inv * inv * inv
  const displayedValue = Math.round(clampedValue * eased)

  // ── Rotating glow on background ring (after settle) ──
  const glowRotation = frame * 1.2

  // ── Label entrance ──
  const labelDelay = 16
  const labelFrame = Math.max(0, frame - labelDelay)
  const labelSpring = frame < labelDelay ? 0 : spring({ frame: labelFrame, fps, config: SPRING_VALUE })
  const labelSettled = labelSpring >= 0.999
  const labelOpacity = labelSettled ? 1 : interpolate(labelSpring, [0, 0.4], [0, 1], CLAMP)
  const labelTranslateY = labelSettled ? 0 : (1 - labelSpring) * 6

  // Static geometry memoized
  const staticGeo = useMemo(() => {
    const startAngle = 150
    const endAngle = 390
    const totalSweep = endAngle - startAngle
    const cx = radius + 16
    const cy = radius + 16
    const svgSize = (radius + 16) * 2
    const strokeW = Math.max(8, radius * 0.15)
    const r = radius - strokeW / 2

    const angleToPoint = (angle: number) => {
      const rad = (angle * Math.PI) / 180
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
    }

    const buildArc = (start: number, sweep: number) => {
      if (sweep <= 0) return ""
      const end = start + sweep
      const startPt = angleToPoint(start)
      const endPt = angleToPoint(end)
      const largeArc = sweep > 180 ? 1 : 0
      return `M ${startPt.x} ${startPt.y} A ${r} ${r} 0 ${largeArc} 1 ${endPt.x} ${endPt.y}`
    }

    const trackPath = buildArc(startAngle, totalSweep)
    const needleLength = radius * 0.65

    return { startAngle, totalSweep, cx, cy, svgSize, strokeW, trackPath, needleLength, buildArc }
  }, [radius])

  const { startAngle, totalSweep, cx, cy, svgSize, strokeW, trackPath, needleLength } = staticGeo

  // Arc sweep with overshoot
  const valueSweep = (clampedValue / 100) * totalSweep * Math.min(arcProgress, 1.1)
  const clampedSweep = Math.min(valueSweep, totalSweep)
  const valuePath = staticGeo.buildArc(startAngle, clampedSweep)

  // Needle angle with overshoot
  const targetSweep = (clampedValue / 100) * totalSweep
  const needleSweep = targetSweep * Math.min(needleProgress, 1.1)
  const clampedNeedleSweep = Math.min(needleSweep, totalSweep)
  const needleAngle = startAngle + clampedNeedleSweep
  const needleRad = (needleAngle * Math.PI) / 180
  const needleEndX = cx + needleLength * Math.cos(needleRad)
  const needleEndY = cy + needleLength * Math.sin(needleRad)

  const uid = `gauge-${position.x}-${position.y}`

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
        minWidth: 280,
        minHeight: 200,
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Noise texture overlay for depth */}
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
      {/* Gradient border accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 16,
          right: 16,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
          borderRadius: 1,
          pointerEvents: "none",
        }}
      />
      <svg width={svgSize} height={svgSize} style={{ overflow: "visible" }}>
        <defs>
          {/* Gradient for value arc */}
          <linearGradient id={`${uid}-arc-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={adjustColor(color, 40)} stopOpacity={0.9} />
          </linearGradient>
          {/* Glow filter for value arc */}
          <filter id={`${uid}-arc-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Glow filter for needle tip */}
          <filter id={`${uid}-needle-glow`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Rotating glow gradient for track */}
          <linearGradient
            id={`${uid}-track-glow`}
            gradientTransform={`rotate(${glowRotation}, 0.5, 0.5)`}
          >
            <stop offset="0%" stopColor={color} stopOpacity={0.05} />
            <stop offset="50%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>

        {/* Background track arc */}
        <path
          d={trackPath}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />

        {/* Rotating glow ring (subtle) */}
        {containerSettled && (
          <path
            d={trackPath}
            fill="none"
            stroke={`url(#${uid}-track-glow)`}
            strokeWidth={strokeW + 4}
            strokeLinecap="round"
            opacity={0.4}
          />
        )}

        {/* Value arc with gradient and glow */}
        {valuePath && (
          <path
            d={valuePath}
            fill="none"
            stroke={`url(#${uid}-arc-grad)`}
            strokeWidth={strokeW}
            strokeLinecap="round"
            filter={`url(#${uid}-arc-glow)`}
          />
        )}

        {/* Needle with spring rotation */}
        <line
          x1={cx}
          y1={cy}
          x2={needleEndX}
          y2={needleEndY}
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={2}
          strokeLinecap="round"
          filter={`url(#${uid}-needle-glow)`}
          opacity={interpolate(needleSpring, [0, 0.2], [0, 1], CLAMP)}
        />
        {/* Needle center dot */}
        <circle cx={cx} cy={cy} r={5} fill="rgba(255,255,255,0.9)" />
        <circle cx={cx} cy={cy} r={3} fill={color} />

        {/* Value text with blur clear */}
        <g
          opacity={valueOpacity}
          transform={`translate(${cx}, ${cy + radius * 0.3}) scale(${valueScale})`}
          style={{ filter: valueBlur > 0.01 ? `blur(${valueBlur}px)` : undefined } as React.CSSProperties}
        >
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fff"
            fontSize={radius * 0.35}
            fontFamily="system-ui, monospace"
            fontWeight={700}
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)", fontVariantNumeric: "tabular-nums" } as React.CSSProperties}
          >
            {displayedValue}
          </text>
        </g>
      </svg>

      {/* Label with delayed entrance */}
      {label && (
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.6)",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            letterSpacing: 0.3,
            textShadow: "0 1px 2px rgba(0,0,0,0.2)",
            opacity: labelOpacity,
            transform: `translateY(${labelTranslateY}px)`,
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

/** Lighten/shift a hex color for gradient end stop */
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16)
  const r = Math.min(255, ((num >> 16) & 0xff) + amount)
  const g = Math.min(255, ((num >> 8) & 0xff) + amount)
  const b = Math.min(255, (num & 0xff) + amount)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}
