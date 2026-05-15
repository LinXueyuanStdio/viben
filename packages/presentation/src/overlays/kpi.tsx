import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { KpiCommand, Point } from "../types"
import { useEntrance, useCounter } from "../utils/motion"

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 } as const

interface KpiProps {
  command: KpiCommand
}

/**
 * KPI Card overlay -- Beautifully styled metric card with big number, label, trend indicator, and sparkline.
 * Number counts up, trend arrow bounces in, sparkline draws.
 * Premium visual: glass background, gradient trend arrow, refined typography, accent glow.
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
  const containerEntrance = useEntrance(0, 12)

  // Number counter animation (only for numeric values)
  const numericValue = typeof value === "number" ? value : null
  const counterValue = useCounter(numericValue ?? 0, 5, 35)

  // Trend arrow bounce-in
  const trendProgress = spring({
    frame: frame - 20,
    fps,
    config: { damping: 12, stiffness: 150, mass: 0.6 },
  })
  const trendSettled = trendProgress >= 0.999
  const trendOpacity = trendSettled ? 1 : Math.max(0, trendProgress)
  const trendScale = trendSettled ? 1 : 0.5 + trendProgress * 0.5
  const trendTranslateY = trendSettled ? 0 : (1 - trendProgress) * 10

  // Sparkline draw progress
  const sparkDrawProgress = interpolate(frame - 15, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

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

    return { pathD, sparkWidth, sparkHeight, totalLength: sparkWidth * 1.5 }
  }, [sparkData])

  // Display value
  const displayValue = numericValue !== null
    ? formatNumber(counterValue)
    : String(value)

  // Trend colors with gradient pairs
  const trendColorStart = trend === "up" ? "#10B981" : trend === "down" ? "#EF4444" : "rgba(255,255,255,0.5)"
  const trendColorEnd = trend === "up" ? "#34D399" : trend === "down" ? "#F87171" : "rgba(255,255,255,0.3)"

  // Unique gradient IDs
  const sparkGradId = `kpi-spark-${label}`
  const sparkFillGradId = `kpi-fill-${label}`
  const trendGradId = `kpi-trend-${label}`

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        background: "radial-gradient(ellipse at 20% 10%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.92) 70%)",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: `0 8px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 60px ${color}10`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "22px 26px",
        minWidth: 190,
        fontFamily: "system-ui, -apple-system, sans-serif",
        opacity: containerEntrance.opacity,
        transform: `translateY(${containerEntrance.translateY}px) scale(${containerEntrance.scale})`,
        willChange: "transform, opacity",
      }}
    >
      {/* Color accent bar at top with refined gradient */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 16,
          right: 16,
          height: 3,
          borderRadius: "0 0 3px 3px",
          background: `linear-gradient(90deg, ${color}00, ${color}, ${color}00)`,
          opacity: containerEntrance.opacity,
          boxShadow: `0 2px 12px ${color}40`,
        }}
      />

      {/* Label */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(255, 255, 255, 0.5)",
          marginBottom: 8,
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      {/* Value row */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        {/* Big number with gradient text */}
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
          }}
        >
          {displayValue}
        </div>

        {/* Trend indicator with gradient arrow */}
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
                <stop offset="100%" stopColor={color} stopOpacity={1} />
              </linearGradient>
              {/* Fill gradient */}
              <linearGradient id={sparkFillGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25 * sparkDrawProgress} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Gradient fill area */}
            {sparkDrawProgress > 0 && (
              <path
                d={`${sparkPath.pathD} L ${sparkPath.sparkWidth} ${sparkPath.sparkHeight} L 0 ${sparkPath.sparkHeight} Z`}
                fill={`url(#${sparkFillGradId})`}
                opacity={sparkDrawProgress}
              />
            )}
            {/* Line with gradient stroke */}
            <path
              d={sparkPath.pathD}
              fill="none"
              stroke={`url(#${sparkGradId})`}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={sparkPath.totalLength}
              strokeDashoffset={sparkPath.totalLength * (1 - sparkDrawProgress)}
            />
            {/* End dot with glow */}
            {sparkDrawProgress >= 0.95 && sparkData && sparkData.length > 0 && (
              <g>
                <circle
                  cx={sparkPath.sparkWidth}
                  cy={sparkPath.sparkHeight - ((sparkData[sparkData.length - 1] - Math.min(...sparkData)) / (Math.max(...sparkData) - Math.min(...sparkData) || 1)) * sparkPath.sparkHeight}
                  r={6}
                  fill={color}
                  opacity={0.2 * sparkDrawProgress}
                />
                <circle
                  cx={sparkPath.sparkWidth}
                  cy={sparkPath.sparkHeight - ((sparkData[sparkData.length - 1] - Math.min(...sparkData)) / (Math.max(...sparkData) - Math.min(...sparkData) || 1)) * sparkPath.sparkHeight}
                  r={3}
                  fill={color}
                  opacity={sparkDrawProgress}
                />
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
