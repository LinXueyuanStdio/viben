import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { WaterfallCommand, Point } from "../types"
import { staggerDelay } from "../utils/motion"
import { useOverlayStyle } from "../hooks/use-overlay-style"
import { useCardSize } from "../hooks/use-card-size"
import { getCardLayout } from "../utils/card-layout"

const SPRING_BAR = { damping: 14, stiffness: 110, mass: 0.8 } as const
const SPRING_LABEL = { damping: 12, stiffness: 130, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface WaterfallProps {
  command: WaterfallCommand
}

/**
 * Waterfall overlay -- Incremental +/- bar chart with cinematic layered entrance.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance with blur clear
 *   2. Bars: staggered spring growth from zero line
 *   3. Connection lines: draw after adjacent bars settle
 *   4. Value labels: counter animation + fade-in
 *   5. Glow: colored drop-shadow per bar
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Waterfall({ command }: WaterfallProps) {
  const {
    position: _position,
    data,
    width: _width = 280,
    height: _height = 180,
    colors,
    cardSize: _cardSize,
  } = command
  const position = _position as Point

  const cardSizeResult = useCardSize({ width: _width, height: _height, cardSize: _cardSize })
  const width = Math.max(280, cardSizeResult?.width ?? _width)
  const height = Math.max(200, cardSizeResult?.height ?? _height)
  const mode = cardSizeResult?.mode ?? "md"
  const layout = useMemo(() => getCardLayout(mode, width, height), [mode, width, height])

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  if (data.length === 0) return null

  const increaseColor = colors?.increase ?? "#22C55E"
  const decreaseColor = colors?.decrease ?? "#EF4444"
  const totalColor = colors?.total ?? "#6366F1"

  // Memoize bar geometry (depends only on data/dimensions, not frame)
  const { bars, barWidth, barGap, zeroY, valToY, padding } = useMemo(() => {
    const padding = { top: 20, right: 12, bottom: 32, left: 12 }
    const chartW = width - padding.left - padding.right
    const chartH = height - padding.top - padding.bottom

    let running = 0
    const bars = data.map((item) => {
      const isTotal = item.type === "total"
      const isDecrease = item.type === "decrease" || (!item.type && item.value < 0)

      let barStart: number
      let barEnd: number

      if (isTotal) {
        barStart = 0
        barEnd = item.value
        running = item.value
      } else {
        barStart = running
        barEnd = running + item.value
        running = barEnd
      }

      const barColor = isTotal
        ? totalColor
        : isDecrease
          ? decreaseColor
          : increaseColor

      return { label: item.label, value: item.value, start: barStart, end: barEnd, color: barColor }
    })

    const allValues = bars.flatMap((b) => [b.start, b.end])
    const minVal = Math.min(0, ...allValues)
    const maxVal = Math.max(0, ...allValues)
    const valRange = maxVal - minVal || 1

    const barWidth = Math.min(30, (chartW / data.length) * 0.7)
    const barGap = (chartW - barWidth * data.length) / (data.length + 1)

    const valToY = (v: number) => padding.top + chartH - ((v - minVal) / valRange) * chartH
    const zeroY = valToY(0)

    return { bars, barWidth, barGap, zeroY, valToY, padding }
  }, [data, width, height, increaseColor, decreaseColor, totalColor])

  // Pre-compute bar spring values with stagger
  const barSprings = bars.map((_, i) => {
    const delay = staggerDelay(i, 4) + 8
    const val = spring({ frame: frame - delay, fps, config: SPRING_BAR })
    return val >= 0.999 ? 1 : Math.max(0, val)
  })

  // Label spring values (delayed further)
  const labelSprings = bars.map((_, i) => {
    const delay = staggerDelay(i, 4) + 14
    const val = spring({ frame: frame - delay, fps, config: SPRING_LABEL })
    return val >= 0.999 ? 1 : Math.max(0, val)
  })

  // Counter animation for value labels
  const counterDuration = 18
  const counterValues = bars.map((bar, i) => {
    const delay = staggerDelay(i, 4) + 14
    const elapsed = Math.max(0, frame - delay)
    const progress = elapsed >= counterDuration ? 1 : interpolate(elapsed, [0, counterDuration], [0, 1], CLAMP)
    const inv = 1 - progress
    const eased = 1 - inv * inv * inv
    return Math.round(bar.value * eased)
  })

  const uid = `wf-${position.x}-${position.y}`

  const containerWidth = width + layout.padding * 2
  const containerHeight = height + layout.padding * 2

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
        padding: layout.padding,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
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

      <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
        <defs>
          {/* Per-bar gradient fills */}
          {bars.map((bar, i) => (
            <linearGradient key={i} id={`${uid}-bar-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={bar.color} stopOpacity={0.95} />
              <stop offset="50%" stopColor={bar.color} stopOpacity={0.85} />
              <stop offset="100%" stopColor={bar.color} stopOpacity={0.65} />
            </linearGradient>
          ))}
          {/* Glow filter */}
          <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Zero line -- dashed, subtle */}
        <line
          x1={padding.left}
          y1={zeroY}
          x2={width - padding.right}
          y2={zeroY}
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Connection lines between bars -- dashed */}
        {bars.map((bar, i) => {
          if (i === 0) return null
          const prevBar = bars[i - 1]
          const prevX = padding.left + barGap + (i - 1) * (barWidth + barGap) + barWidth
          const currX = padding.left + barGap + i * (barWidth + barGap)
          const lineY = valToY(prevBar.end)
          const springVal = barSprings[i]
          return (
            <line
              key={`conn-${i}`}
              x1={prevX}
              y1={lineY}
              x2={prevX + (currX - prevX) * springVal}
              y2={lineY}
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={springVal}
            />
          )
        })}

        {/* Bars */}
        {bars.map((bar, i) => {
          const x = padding.left + barGap + i * (barWidth + barGap)
          const startY = valToY(bar.start)
          const endY = valToY(bar.end)
          const barHeight = Math.abs(endY - startY)
          const springVal = barSprings[i]
          const labelSpring = labelSprings[i]
          const animatedHeight = barHeight * springVal
          const isGrowingUp = endY < startY
          const rectY = isGrowingUp ? startY - animatedHeight : startY
          const rectHeight = Math.max(1, animatedHeight)
          const barTop = Math.min(startY, endY)
          const counterVal = counterValues[i]

          return (
            <g key={i}>
              {/* Bar with gradient fill and colored glow */}
              <rect
                x={x}
                y={rectY}
                width={barWidth}
                height={rectHeight}
                rx={3}
                fill={`url(#${uid}-bar-${i})`}
                style={{ filter: `drop-shadow(0 0 6px ${bar.color}44)` }}
              />
              {/* Inner shine highlight */}
              <rect
                x={x + 1}
                y={rectY}
                width={barWidth - 2}
                height={Math.min(rectHeight, 3)}
                rx={2}
                fill="rgba(255,255,255,0.2)"
                opacity={springVal}
              />
              {/* Side highlight for depth */}
              <rect
                x={x}
                y={rectY}
                width={1.5}
                height={rectHeight}
                rx={1}
                fill="rgba(255,255,255,0.08)"
                opacity={springVal}
              />
              {/* Value label with counter */}
              <text
                x={x + barWidth / 2}
                y={isGrowingUp ? barTop - 8 : barTop + barHeight + 14}
                textAnchor="middle"
                fill="#fff"
                fontSize={layout.fontSize.axis}
                fontWeight={700}
                fontFamily="system-ui, monospace"
                opacity={labelSpring}
                style={{ fontVariantNumeric: "tabular-nums", textShadow: "0 1px 3px rgba(0,0,0,0.5)" } as React.CSSProperties}
              >
                {counterVal > 0 ? `+${counterVal}` : counterVal}
              </text>
              {/* Category label */}
              <text
                x={x + barWidth / 2}
                y={height - padding.bottom + 14}
                textAnchor="middle"
                fill="rgba(255,255,255,0.6)"
                fontSize={layout.fontSize.axis}
                fontWeight={600}
                fontFamily="system-ui, sans-serif"
                opacity={labelSpring}
                letterSpacing={0.3}
              >
                {bar.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
