import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring } from "remotion"
import type { WaterfallCommand, Point } from "../types"
import { useEntrance, staggerDelay } from "../utils/motion"

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 } as const

interface WaterfallProps {
  command: WaterfallCommand
}

/**
 * Waterfall overlay -- Incremental +/- bar chart.
 * Bars stack: increases go up, decreases go down. "total" bars span from 0.
 * Parent computes all spring values in one pass to avoid N child subscriptions.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Waterfall({ command }: WaterfallProps) {
  const {
    position: _position,
    data,
    width = 280,
    height = 180,
    colors,
  } = command
  const position = _position as Point

  const entrance = useEntrance(0, 12)
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

  // Pre-compute all spring values in parent (no useMemo -- frame changes every render)
  const springValues = bars.map((_, i) => {
    const delay = staggerDelay(i, 4) + 8
    const val = spring({ frame: frame - delay, fps, config: SPRING_CONFIG })
    return val >= 0.999 ? 1 : val
  })

  const uid = `wf-${position.x}-${position.y}`

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
          {/* Per-bar gradient fills */}
          {bars.map((bar, i) => (
            <linearGradient key={i} id={`${uid}-bar-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={bar.color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={bar.color} stopOpacity={0.7} />
            </linearGradient>
          ))}
        </defs>

        {/* Zero line -- dashed, subtle */}
        <line
          x1={padding.left}
          y1={zeroY}
          x2={width - padding.right}
          y2={zeroY}
          stroke="rgba(255, 255, 255, 0.04)"
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
          const springVal = springValues[i]
          return (
            <line
              key={`conn-${i}`}
              x1={prevX}
              y1={lineY}
              x2={currX}
              y2={lineY}
              stroke="rgba(255, 255, 255, 0.12)"
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
          const springVal = springValues[i]
          const animatedHeight = barHeight * springVal
          const isGrowingUp = endY < startY
          const rectY = isGrowingUp ? startY - animatedHeight : startY
          const rectHeight = Math.max(1, animatedHeight)
          const barTop = Math.min(startY, endY)

          return (
            <g key={i}>
              <rect
                x={x}
                y={rectY}
                width={barWidth}
                height={rectHeight}
                rx={3}
                fill={`url(#${uid}-bar-${i})`}
                style={{ filter: `drop-shadow(0 0 4px ${bar.color}33)` }}
              />
              {/* Inner shine highlight */}
              <rect
                x={x}
                y={rectY}
                width={barWidth}
                height={Math.min(rectHeight, 2)}
                rx={3}
                fill="rgba(255,255,255,0.15)"
                opacity={springVal}
              />
              {/* Value label */}
              <text
                x={x + barWidth / 2}
                y={isGrowingUp ? barTop - 6 : barTop + barHeight + 14}
                textAnchor="middle"
                fill="#fff"
                fontSize={9}
                fontFamily="system-ui, monospace"
                opacity={springVal}
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" } as React.CSSProperties}
              >
                {bar.value > 0 ? `+${bar.value}` : bar.value}
              </text>
              {/* Category label */}
              <text
                x={x + barWidth / 2}
                y={height - padding.bottom + 14}
                textAnchor="middle"
                fill="rgba(255,255,255,0.6)"
                fontSize={9}
                fontFamily="system-ui, sans-serif"
                opacity={springVal}
                letterSpacing={0.2}
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
