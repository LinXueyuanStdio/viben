import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { KpiCommand, Point } from "../types"
import { useCounter } from "../utils/motion"

const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_VALUE = { damping: 12, stiffness: 130, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface KpiProps {
  command: KpiCommand
}

/**
 * KPI Card overlay -- Beautifully styled metric card with cinematic layered entrance.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance with blur clear
 *   2. Accent bar: width expansion with glow
 *   3. Label: fade-in with translateY
 *   4. Value: counter animation with scale overshoot
 *   5. Trend arrow: elastic pop-in with gradient stroke
 *   6. Sparkline: progressive draw with end-dot glow
 *   7. Idle breathing: subtle border glow pulse
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Kpi({ command }: KpiProps) {
  const {
    position: _position,
    value,
    label,
    trend,
    trendValue,
    sparkData,
    color = "#6366F1",
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
    : interpolate(containerProgress, [0, 0.3, 0.8, 1], [0.92, 0.95, 1.02, 1], CLAMP)
  const containerTranslateY = containerSettled ? 0 : (1 - containerProgress) * 12
  const containerBlur = containerSettled ? 0 : interpolate(containerProgress, [0, 0.5], [4, 0], CLAMP)

  // ── Label entrance ──
  const labelDelay = 4
  const labelFrame = Math.max(0, frame - labelDelay)
  const labelSpring = frame < labelDelay ? 0 : spring({ frame: labelFrame, fps, config: SPRING_CONTAINER })
  const labelSettled = labelSpring >= 0.999
  const labelOpacity = labelSettled ? 1 : interpolate(labelSpring, [0, 0.4], [0, 1], CLAMP)
  const labelTranslateY = labelSettled ? 0 : (1 - labelSpring) * 6

  // ── Value entrance with scale overshoot ──
  const valueDelay = 6
  const valueFrame = Math.max(0, frame - valueDelay)
  const valueSpring = frame < valueDelay ? 0 : spring({ frame: valueFrame, fps, config: SPRING_VALUE })
  const valueSettled = valueSpring >= 0.999
  const valueScale = valueSettled
    ? 1
    : interpolate(valueSpring, [0, 0.6, 0.85, 1], [0.85, 1.03, 0.99, 1], CLAMP)
  const valueOpacity = valueSettled ? 1 : interpolate(valueSpring, [0, 0.3], [0, 1], CLAMP)

  // Number counter animation (only for numeric values)
  const numericValue = typeof value === "number" ? value : null
  const counterValue = useCounter(numericValue ?? 0, 5, 35)

  // Trend arrow bounce-in
  const trendDelay = 20
  const trendFrame = Math.max(0, frame - trendDelay)
  const trendProgress = frame < trendDelay ? 0 : spring({
    frame: trendFrame,
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.6 },
  })
  const trendSettled = trendProgress >= 0.999
  const trendOpacity = trendSettled ? 1 : interpolate(trendProgress, [0, 0.3], [0, 1], CLAMP)
  const trendScale = trendSettled
    ? 1
    : interpolate(trendProgress, [0, 0.4, 0.7, 1], [0.3, 1.2, 0.95, 1], CLAMP)
  const trendTranslateY = trendSettled ? 0 : (1 - trendProgress) * 10

  // Sparkline draw progress
  const sparkDelay = 15
  const sparkDrawProgress = interpolate(frame - sparkDelay, [0, 25], [0, 1], CLAMP)

  // Sparkline path (static computation)
  const sparkPath = useMemo(() => {
    if (!sparkData || sparkData.length < 2) return null
    const sparkWidth = 120
    const sparkHeight = 32
    const min = Math.min(...sparkData)
    const max = Math.max(...sparkData)
    const range = max - min || 1

    const points = sparkData.map((d, i) => ({
      x: (i / (sparkData.length - 1)) * sparkWidth,
      y: sparkHeight - ((d - min) / range) * sparkHeight,
    }))

    const pathD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ")

    let totalLength = 0
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x
      const dy = points[i].y - points[i - 1].y
      totalLength += Math.sqrt(dx * dx + dy * dy)
    }

    return { pathD, sparkWidth, sparkHeight, totalLength: totalLength || sparkWidth * 1.5 }
  }, [sparkData])

  // Display value
  const displayValue = numericValue !== null
    ? formatNumber(counterValue)
    : String(value)

  // Trend colors with gradient pairs
  const trendColorStart = trend === "up" ? "#10B981" : trend === "down" ? "#EF4444" : "rgba(255,255,255,0.5)"
  const trendColorEnd = trend === "up" ? "#34D399" : trend === "down" ? "#F87171" : "rgba(255,255,255,0.3)"

  // ── Idle breathing glow ──
  const breathePhase = containerSettled ? (frame - 20) * 0.06 : 0
  const breatheGlow = containerSettled ? 0.08 + 0.04 * Math.sin(breathePhase) : 0.08

  // Unique gradient IDs
  const uid = `kpi-${position.x}-${position.y}`
  const sparkGradId = `${uid}-spark`
  const sparkFillGradId = `${uid}-fill`
  const trendGradId = `${uid}-trend`

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
        background: "radial-gradient(ellipse at 20% 10%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.92) 70%)",
        borderRadius: 16,
        border: `1px solid rgba(255, 255, 255, ${breatheGlow})`,
        boxShadow: `0 8px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 60px ${color}10`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "22px 26px",
        minWidth: 190,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Noise texture */}
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

      {/* Color accent bar at top with animated width */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 16,
          right: 16,
          height: 3,
          borderRadius: "0 0 3px 3px",
          background: `linear-gradient(90deg, ${color}00, ${color}, ${color}00)`,
          opacity: containerOpacity,
          boxShadow: `0 2px 12px ${color}40`,
          transform: `scaleX(${containerSettled ? 1 : containerProgress})`,
        }}
      />

      {/* Label with delayed entrance */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(255, 255, 255, 0.5)",
          marginBottom: 8,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          opacity: labelOpacity,
          transform: `translateY(${labelTranslateY}px)`,
        }}
      >
        {label}
      </div>

      {/* Value row */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        {/* Big number with gradient text and scale entrance */}
        <div
          style={{
            fontSize: 38,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: -1.5,
            lineHeight: 1,
            background: `linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.75) 100%)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
            opacity: valueOpacity,
            transform: `scale(${valueScale})`,
            transformOrigin: "left baseline",
          }}
        >
          {displayValue}
        </div>

        {/* Trend indicator with elastic pop-in */}
        {trend && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              opacity: trendOpacity,
              transform: `translateY(${trendTranslateY}px) scale(${trendScale})`,
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: trend === "down" ? "rotate(180deg)" : trend === "flat" ? "rotate(90deg)" : "none",
              }}
            >
              <defs>
                <linearGradient id={trendGradId} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={trendColorStart} />
                  <stop offset="100%" stopColor={trendColorEnd} />
                </linearGradient>
              </defs>
              <polyline
                points="18 15 12 9 6 15"
                stroke={`url(#${trendGradId})`}
                style={{ filter: `drop-shadow(0 0 4px ${trendColorStart}60)` }}
              />
            </svg>
            {trendValue && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: trendColorStart,
                  textShadow: `0 0 8px ${trendColorStart}40`,
                }}
              >
                {trendValue}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sparkline */}
      {sparkPath && (
        <div style={{ marginTop: 10 }}>
          <svg
            width={sparkPath.sparkWidth}
            height={sparkPath.sparkHeight}
            style={{ overflow: "visible" }}
          >
            <defs>
              {/* Line gradient */}
              <linearGradient id={sparkGradId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="50%" stopColor={color} stopOpacity={0.8} />
                <stop offset="100%" stopColor={color} stopOpacity={1} />
              </linearGradient>
              {/* Fill gradient */}
              <linearGradient id={sparkFillGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25 * sparkDrawProgress} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Gradient fill area */}
            {sparkDrawProgress > 0.3 && (
              <path
                d={`${sparkPath.pathD} L ${sparkPath.sparkWidth} ${sparkPath.sparkHeight} L 0 ${sparkPath.sparkHeight} Z`}
                fill={`url(#${sparkFillGradId})`}
                opacity={interpolate(sparkDrawProgress, [0.3, 0.8], [0, 1], CLAMP)}
              />
            )}
            {/* Line with gradient stroke -- draw animation */}
            <path
              d={sparkPath.pathD}
              fill="none"
              stroke={`url(#${sparkGradId})`}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={sparkPath.totalLength}
              strokeDashoffset={sparkPath.totalLength * (1 - sparkDrawProgress)}
            />
            {/* End dot with glow */}
            {sparkDrawProgress >= 0.95 && sparkData && sparkData.length > 0 && (
              <g>
                {/* Glow halo */}
                <circle
                  cx={sparkPath.sparkWidth}
                  cy={sparkPath.sparkHeight - ((sparkData[sparkData.length - 1] - Math.min(...sparkData)) / (Math.max(...sparkData) - Math.min(...sparkData) || 1)) * sparkPath.sparkHeight}
                  r={6}
                  fill={color}
                  opacity={0.2 * sparkDrawProgress}
                />
                {/* Dot */}
                <circle
                  cx={sparkPath.sparkWidth}
                  cy={sparkPath.sparkHeight - ((sparkData[sparkData.length - 1] - Math.min(...sparkData)) / (Math.max(...sparkData) - Math.min(...sparkData) || 1)) * sparkPath.sparkHeight}
                  r={3}
                  fill={color}
                  opacity={sparkDrawProgress}
                />
                {/* Bright center */}
                <circle
                  cx={sparkPath.sparkWidth}
                  cy={sparkPath.sparkHeight - ((sparkData[sparkData.length - 1] - Math.min(...sparkData)) / (Math.max(...sparkData) - Math.min(...sparkData) || 1)) * sparkPath.sparkHeight}
                  r={1.2}
                  fill="#fff"
                  opacity={sparkDrawProgress * 0.8}
                />
              </g>
            )}
          </svg>
        </div>
      )}
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  if (Number.isInteger(n)) return String(Math.round(n))
  return n.toFixed(1)
}
