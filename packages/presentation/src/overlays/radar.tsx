import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { RadarCommand, Point } from "../types"
import { staggerDelay } from "../utils/motion"
import { useOverlayStyle } from "../hooks/use-overlay-style"
import { useCardSize } from "../hooks/use-card-size"
import { getCardLayout } from "../utils/card-layout"

const SPRING_RING = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_POLYGON = { damping: 14, stiffness: 80, mass: 1.0 } as const
const SPRING_LABEL = { damping: 18, stiffness: 120, mass: 0.8 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface RadarProps {
  command: RadarCommand
}

/**
 * Radar overlay -- Spider/radar chart with cinematic layered entrance.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance with blur clear
 *   2. Grid rings: sequential fade-in from center outward
 *   3. Polygon: spring expansion from center with overshoot
 *   4. Value dots: staggered elastic pop-in after polygon settles
 *   5. Labels: staggered fade with blur clear
 *   6. Glow pulse: value dots breathe after settle
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Radar({ command }: RadarProps) {
  const {
    position: _position,
    axes,
    color = "#6366F1",
    fillOpacity = 0.25,
    size: _size = 200,
    cardSize: _cardSize,
  } = command
  const position = _position as Point

  const cardSizeResult = useCardSize({ width: undefined, height: undefined, cardSize: _cardSize })
  const csWidth = cardSizeResult?.width ?? 0
  const csHeight = cardSizeResult?.height ?? 0
  const mode = cardSizeResult?.mode ?? "md"
  const layout = useMemo(() => getCardLayout(mode, csWidth || _size + 80, csHeight || _size + 80), [mode, csWidth, csHeight, _size])
  const size = cardSizeResult
    ? Math.min(csWidth, csHeight) - layout.padding * 2
    : _size
  const labelMargin = Math.floor(size * 0.08)

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const axisCount = axes.length

  // Static geometry (does not depend on frame)
  const geometry = useMemo(() => {
    const cx = size / 2 + labelMargin
    const cy = size / 2 + labelMargin
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
  }, [axes, axisCount, size, labelMargin])

  const { cx, cy, radius, rings, axisEndpoints, valuePoints, labelPositions } = geometry

  // ── Grid ring entrances (staggered from center) ──
  const ringOpacities = rings.map((_, i) => {
    const delay = 4 + i * 3
    const progress = spring({ frame: frame - delay, fps, config: SPRING_RING })
    return progress >= 0.999 ? 1 : Math.max(0, progress)
  })

  // ── Polygon fill expansion (spring-based with overshoot) ──
  const fillDelay = 8
  const fillFrame = Math.max(0, frame - fillDelay)
  const fillProgress = frame < fillDelay ? 0 : spring({ frame: fillFrame, fps, config: SPRING_POLYGON })
  const fillSettled = fillProgress >= 0.999
  const clampedFill = fillSettled ? 1 : interpolate(fillProgress, [0, 0.7, 0.9, 1], [0, 0.75, 1.03, 1], CLAMP)

  // ── Value dot entrances (staggered elastic) ──
  const dotEntrances = axes.map((_, i) => {
    const delay = staggerDelay(i, 3) + 16
    const progress = spring({ frame: frame - delay, fps, config: { damping: 10, stiffness: 160, mass: 0.5 } })
    const settled = progress >= 0.999
    return {
      scale: settled ? 1 : interpolate(progress, [0, 0.4, 0.7, 1], [0, 1.3, 0.9, 1], CLAMP),
      opacity: settled ? 1 : interpolate(progress, [0, 0.2], [0, 1], CLAMP),
    }
  })

  // ── Label entrances with stagger ──
  const labelEntrances = axes.map((_, i) => {
    const delay = staggerDelay(i, 3) + 12
    const progress = spring({ frame: frame - delay, fps, config: SPRING_LABEL })
    const settled = progress >= 0.999
    return {
      opacity: settled ? 1 : interpolate(progress, [0, 0.4], [0, 1], CLAMP),
      blur: settled ? 0 : (1 - Math.max(0, progress)) * 3,
    }
  })

  // ── Dot glow pulse after settle ──
  const glowPhase = frame * 0.08

  // Build the value polygon path with animation
  const polygonPath = useMemo(() => {
    if (clampedFill <= 0) return ""
    const actualFill = Math.min(clampedFill, 1)
    return valuePoints
      .map((pt, i) => {
        const x = cx + (pt.x - cx) * actualFill
        const y = cy + (pt.y - cy) * actualFill
        return `${i === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ") + " Z"
  }, [valuePoints, cx, cy, clampedFill])

  // Unique gradient IDs
  const gradId = `radar-fill-${position.x}-${position.y}`
  const glowId = `radar-glow-${position.x}-${position.y}`
  const strokeGradId = `radar-stroke-${position.x}-${position.y}`

  const svgSize = size + labelMargin * 2
  const containerWidth = Math.max(280, svgSize) + 32   // 16px padding * 2
  const containerHeight = Math.max(200, svgSize) + 32

  const overlayStyle = useOverlayStyle({ position, width: containerWidth, height: containerHeight })

  return (
    <div
      style={{
        ...overlayStyle,
        minWidth: 280,
        minHeight: 200,
        background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.92) 70%)",
        borderRadius: 14,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: `0 8px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 60px ${color}10`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: 16,
      }}
    >
      {/* Noise texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 14,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          pointerEvents: "none",
        }}
      />

      <svg width={svgSize} height={svgSize} style={{ overflow: "visible" }}>
        <defs>
          {/* Radial gradient for polygon fill */}
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity * 1.8} />
            <stop offset="70%" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={color} stopOpacity={fillOpacity * 0.4} />
          </radialGradient>
          {/* Stroke gradient */}
          <linearGradient id={strokeGradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={adjustColor(color, 40)} stopOpacity={0.8} />
          </linearGradient>
          {/* Glow filter for value dots */}
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid rings with staggered entrance */}
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
            opacity={ringOpacities[i]}
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
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={0.8}
            opacity={ringOpacities[0]}
          />
        ))}

        {/* Value polygon fill with gradient */}
        {polygonPath && (
          <path
            d={polygonPath}
            fill={`url(#${gradId})`}
            fillOpacity={Math.min(clampedFill, 1)}
            stroke={`url(#${strokeGradId})`}
            strokeWidth={2}
            strokeOpacity={Math.min(clampedFill, 1)}
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
          />
        )}

        {/* Value dots with elastic pop-in and glow pulse */}
        {valuePoints.map((pt, i) => {
          const actualFill = Math.min(clampedFill, 1)
          const x = cx + (pt.x - cx) * actualFill
          const y = cy + (pt.y - cy) * actualFill
          const dotEntrance = dotEntrances[i]
          const glowIntensity = dotEntrance.scale >= 0.99
            ? 0.15 + 0.1 * Math.sin(glowPhase + i * 0.8)
            : 0
          return (
            <g key={i} opacity={dotEntrance.opacity}>
              {/* Glow halo (pulsing) */}
              <circle
                cx={x}
                cy={y}
                r={8 + glowIntensity * 4}
                fill={color}
                opacity={glowIntensity}
              />
              {/* Outer ring */}
              <circle
                cx={x}
                cy={y}
                r={5}
                fill="none"
                stroke={color}
                strokeWidth={1}
                opacity={dotEntrance.opacity * 0.4}
                transform={`scale(${dotEntrance.scale})`}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
              {/* Dot */}
              <circle
                cx={x}
                cy={y}
                r={4}
                fill={color}
                filter={`url(#${glowId})`}
                transform={`scale(${dotEntrance.scale})`}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
              {/* Bright center */}
              <circle
                cx={x}
                cy={y}
                r={1.5}
                fill="#fff"
                opacity={dotEntrance.opacity * 0.8}
                transform={`scale(${dotEntrance.scale})`}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
            </g>
          )
        })}

        {/* Axis labels with blur-clear entrance */}
        {axes.map((axis, i) => {
          const lp = labelPositions[i]
          const labelEntrance = labelEntrances[i]
          return (
            <g key={i} opacity={labelEntrance.opacity}>
              {/* Label glow */}
              <text
                x={lp.x}
                y={lp.y}
                textAnchor={lp.anchor}
                dominantBaseline="central"
                fill={color}
                fontSize={layout.fontSize.label}
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight={600}
                opacity={0.3}
                style={{ filter: `blur(${4 + labelEntrance.blur}px)` }}
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
                fontSize={layout.fontSize.label}
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight={600}
                style={{ filter: labelEntrance.blur > 0.01 ? `blur(${labelEntrance.blur}px)` : undefined }}
              >
                {axis.label}
              </text>
              {/* Value text below label */}
              <text
                x={lp.x}
                y={lp.y + 13}
                textAnchor={lp.anchor}
                dominantBaseline="central"
                fill="rgba(255, 255, 255, 0.45)"
                fontSize={layout.fontSize.axis}
                fontFamily="system-ui, monospace"
                fontWeight={600}
                letterSpacing={0.3}
                style={{ fontVariantNumeric: "tabular-nums" } as React.CSSProperties}
              >
                {axis.value}
              </text>
            </g>
          )
        })}
      </svg>
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
