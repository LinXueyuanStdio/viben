import React from "react"
import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import {
  clampInterpolate,
  softSpring,
  stagger,
  loopSine,
  smoothStep,
  formatCompactNumber,
  noiseSeed,
} from "./motion"

// ─── Shared Helpers ─────────────────────────────────────────────────────────────

function GlassPanel({
  children,
  accent,
  width,
  height,
}: {
  children: React.ReactNode
  accent: string
  width: number
  height: number
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        borderRadius: 22,
        background: `linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.02)),
          radial-gradient(circle at 28% 0%, ${accent}22, transparent 38%),
          rgba(12, 12, 18, 0.58)`,
        border: `1px solid ${accent}35`,
        boxShadow: `0 32px 100px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.14), 0 0 48px ${accent}18`,
        backdropFilter: "blur(18px) saturate(1.2)",
        overflow: "hidden",
      }}
    >
      {/* Subtle noise grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px)",
          backgroundSize: "4px 4px",
          opacity: 0.3,
        }}
      />
      {children}
    </div>
  )
}

function ScanLine({
  frame,
  delay,
  accent,
  height,
}: {
  frame: number
  delay: number
  accent: string
  height: number
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: clampInterpolate(
          (frame - delay) % 120,
          [0, 120],
          [-4, height + 4]
        ),
        height: 2,
        background: `linear-gradient(90deg, transparent 5%, ${accent}50 30%, ${accent} 50%, ${accent}50 70%, transparent 95%)`,
        opacity: 0.35,
        filter: "blur(0.5px)",
      }}
    />
  )
}

function formatCurrency(value: number, currency: string): string {
  if (Math.abs(value) >= 1e6) {
    return `${currency}${formatCompactNumber(value)}`
  }
  if (Math.abs(value) >= 1000) {
    return `${currency}${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
  }
  return `${currency}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── OrderBookDepth ─────────────────────────────────────────────────────────────

export interface OrderBookDepthProps {
  bids: Array<{ price: number; volume: number }>
  asks: Array<{ price: number; volume: number }>
  midPrice?: number
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function OrderBookDepth({
  bids,
  asks,
  midPrice,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 480,
  height = 320,
}: OrderBookDepthProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const drift = loopSine(frame, 160, 0.4) * 3

  // Compute mid price
  const computedMid =
    midPrice ??
    (bids.length > 0 && asks.length > 0
      ? (bids[0]!.price + asks[0]!.price) / 2
      : 0)

  // Sort: bids descending, asks ascending
  const sortedBids = [...bids].sort((a, b) => b.price - a.price)
  const sortedAsks = [...asks].sort((a, b) => a.price - b.price)

  // Cumulative volumes
  const bidCumulative: number[] = []
  sortedBids.reduce((acc, b, i) => {
    bidCumulative[i] = acc + b.volume
    return acc + b.volume
  }, 0)

  const askCumulative: number[] = []
  sortedAsks.reduce((acc, a, i) => {
    askCumulative[i] = acc + a.volume
    return acc + a.volume
  }, 0)

  const maxCumulativeVol = Math.max(
    bidCumulative[bidCumulative.length - 1] ?? 1,
    askCumulative[askCumulative.length - 1] ?? 1
  )

  // Chart dimensions
  const padX = 40
  const padTop = 58
  const padBottom = 40
  const chartW = width - padX * 2
  const chartH = height - padTop - padBottom
  const halfW = chartW / 2

  // Height reveal animation
  const reveal = clampInterpolate(frame, [delay + 10, delay + 60], [0, 1])

  // Build bid path (from center going left)
  const bidPoints: Array<{ x: number; y: number }> = sortedBids.map((_, i) => {
    const xPos = padX + halfW - (i / Math.max(1, sortedBids.length - 1)) * halfW
    const yPos =
      padTop +
      chartH -
      ((bidCumulative[i] ?? 0) / maxCumulativeVol) * chartH * reveal
    return { x: xPos, y: yPos }
  })

  // Build ask path (from center going right)
  const askPoints: Array<{ x: number; y: number }> = sortedAsks.map((_, i) => {
    const xPos =
      padX + halfW + (i / Math.max(1, sortedAsks.length - 1)) * halfW
    const yPos =
      padTop +
      chartH -
      ((askCumulative[i] ?? 0) / maxCumulativeVol) * chartH * reveal
    return { x: xPos, y: yPos }
  })

  // SVG path builders (step chart style)
  function buildStepPath(points: Array<{ x: number; y: number }>): string {
    if (points.length === 0) return ""
    let d = `M ${points[0]!.x.toFixed(1)} ${(padTop + chartH).toFixed(1)}`
    d += ` L ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i]!.x.toFixed(1)} ${points[i - 1]!.y.toFixed(1)}`
      d += ` L ${points[i]!.x.toFixed(1)} ${points[i]!.y.toFixed(1)}`
    }
    return d
  }

  function buildAreaPath(points: Array<{ x: number; y: number }>): string {
    if (points.length === 0) return ""
    const line = buildStepPath(points)
    const lastX = points[points.length - 1]!.x
    return `${line} L ${lastX.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`
  }

  const bidLinePath = buildStepPath(bidPoints)
  const bidAreaPath = buildAreaPath(bidPoints)
  const askLinePath = buildStepPath(askPoints)
  const askAreaPath = buildAreaPath(askPoints)

  const midX = padX + halfW

  // Notable price labels
  const bidLabelIndex = Math.floor(sortedBids.length * 0.3)
  const askLabelIndex = Math.floor(sortedAsks.length * 0.3)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y + drift}px, ${z - (1 - enter) * 300}px) rotateX(${6 - enter * 3}deg)`,
        filter: `blur(${(1 - enter) * 10}px)`,
      }}
    >
      <GlassPanel accent={accent} width={width} height={height}>
        <ScanLine frame={frame} delay={delay} accent={accent} height={height} />

        {/* Title */}
        <div
          style={{
            position: "absolute",
            left: 28,
            top: 18,
            fontFamily: cinematicTheme.font.zh,
            fontSize: 16,
            fontWeight: 700,
            color: "#fff",
            zIndex: 2,
          }}
        >
          Order Book Depth
        </div>

        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <linearGradient id="ob-bid-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ADE80" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#4ADE80" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="ob-ask-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F87171" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#F87171" stopOpacity={0.05} />
            </linearGradient>
            <filter id="ob-glow-green" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="ob-glow-red" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          {Array.from({ length: 5 }).map((_, i) => {
            const gy = padTop + (i / 4) * chartH
            return (
              <line
                key={i}
                x1={padX}
                x2={width - padX}
                y1={gy}
                y2={gy}
                stroke="rgba(234,236,239,0.08)"
                strokeWidth={1}
              />
            )
          })}

          {/* Bid area */}
          <path d={bidAreaPath} fill="url(#ob-bid-grad)" />
          <path
            d={bidLinePath}
            fill="none"
            stroke="#4ADE80"
            strokeWidth={2}
            filter="url(#ob-glow-green)"
          />

          {/* Ask area */}
          <path d={askAreaPath} fill="url(#ob-ask-grad)" />
          <path
            d={askLinePath}
            fill="none"
            stroke="#F87171"
            strokeWidth={2}
            filter="url(#ob-glow-red)"
          />

          {/* Mid price line */}
          <line
            x1={midX}
            x2={midX}
            y1={padTop}
            y2={padTop + chartH}
            stroke={accent}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.7}
          />

          {/* Mid price label */}
          <rect
            x={midX - 38}
            y={padTop - 4}
            width={76}
            height={22}
            rx={6}
            fill="rgba(10,10,15,0.85)"
            stroke={accent}
            strokeWidth={1}
          />
          <text
            x={midX}
            y={padTop + 12}
            textAnchor="middle"
            fill={accent}
            fontSize={12}
            fontFamily={cinematicTheme.font.mono}
            fontWeight={700}
          >
            {computedMid.toFixed(2)}
          </text>

          {/* Notable bid price label */}
          {bidPoints[bidLabelIndex] && sortedBids[bidLabelIndex] && (
            <text
              x={bidPoints[bidLabelIndex]!.x}
              y={padTop + chartH + 16}
              textAnchor="middle"
              fill="#4ADE80"
              fontSize={10}
              fontFamily={cinematicTheme.font.mono}
              opacity={reveal}
            >
              {sortedBids[bidLabelIndex]!.price.toFixed(2)}
            </text>
          )}

          {/* Notable ask price label */}
          {askPoints[askLabelIndex] && sortedAsks[askLabelIndex] && (
            <text
              x={askPoints[askLabelIndex]!.x}
              y={padTop + chartH + 16}
              textAnchor="middle"
              fill="#F87171"
              fontSize={10}
              fontFamily={cinematicTheme.font.mono}
              opacity={reveal}
            >
              {sortedAsks[askLabelIndex]!.price.toFixed(2)}
            </text>
          )}

          {/* Volume axis labels */}
          {Array.from({ length: 3 }).map((_, i) => {
            const val = ((2 - i) / 2) * maxCumulativeVol
            const yPos = padTop + (i / 2) * chartH
            return (
              <text
                key={i}
                x={padX - 6}
                y={yPos + 4}
                textAnchor="end"
                fill="rgba(234,236,239,0.38)"
                fontSize={9}
                fontFamily={cinematicTheme.font.mono}
              >
                {formatCompactNumber(val)}
              </text>
            )
          })}

          {/* Legend */}
          <circle cx={width - 100} cy={padTop + 6} r={4} fill="#4ADE80" />
          <text
            x={width - 92}
            y={padTop + 10}
            fill="rgba(234,236,239,0.6)"
            fontSize={10}
            fontFamily={cinematicTheme.font.en}
          >
            Bids
          </text>
          <circle cx={width - 100} cy={padTop + 24} r={4} fill="#F87171" />
          <text
            x={width - 92}
            y={padTop + 28}
            fill="rgba(234,236,239,0.6)"
            fontSize={10}
            fontFamily={cinematicTheme.font.en}
          >
            Asks
          </text>
        </svg>
      </GlassPanel>
    </div>
  )
}

// ─── PortfolioDonut ─────────────────────────────────────────────────────────────

export interface PortfolioDonutProps {
  holdings: Array<{
    name: string
    value: number
    allocation: number
    change?: number
    color?: string
  }>
  totalValue?: number
  currency?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  size?: number
}

export function PortfolioDonut({
  holdings,
  totalValue,
  currency = "$",
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  size = 320,
}: PortfolioDonutProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)

  const total =
    totalValue ?? holdings.reduce((sum, h) => sum + h.value, 0)
  const donutRadius = size * 0.32
  const innerRadius = donutRadius * 0.6
  const cx = size * 0.42
  const cy = size * 0.5
  const panelWidth = size + 180
  const panelHeight = size

  // Default colors for segments
  const defaultColors = [
    "#D6B36A",
    "#7A5AF8",
    "#FF3D8E",
    "#F6C453",
    "#4ADE80",
    "#60A5FA",
    "#A78BFA",
    "#FB923C",
  ]

  // Determine largest segment for glow
  let largestIdx = 0
  holdings.forEach((h, i) => {
    if (h.allocation > (holdings[largestIdx]?.allocation ?? 0)) {
      largestIdx = i
    }
  })

  // Rotation oscillation
  const rotation = loopSine(frame, 300, 0) * 2

  // Animated counter for total
  const counterProgress = clampInterpolate(frame, [delay + 20, delay + 70], [0, 1])
  const displayTotal = total * smoothStep(counterProgress)

  // Arc path helper
  function describeArc(
    centerX: number,
    centerY: number,
    outerR: number,
    innerR: number,
    startAngle: number,
    endAngle: number
  ): string {
    const startOuter = polarToCartesian(centerX, centerY, outerR, endAngle)
    const endOuter = polarToCartesian(centerX, centerY, outerR, startAngle)
    const startInner = polarToCartesian(centerX, centerY, innerR, startAngle)
    const endInner = polarToCartesian(centerX, centerY, innerR, endAngle)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
      "Z",
    ].join(" ")
  }

  function polarToCartesian(
    centerX: number,
    centerY: number,
    radius: number,
    angleDeg: number
  ) {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return {
      x: centerX + radius * Math.cos(rad),
      y: centerY + radius * Math.sin(rad),
    }
  }

  // Build segments
  let currentAngle = 0
  const segments = holdings.map((h, i) => {
    const sweepAngle = (h.allocation / 100) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + sweepAngle
    currentAngle = endAngle
    const color = h.color ?? defaultColors[i % defaultColors.length]!
    const segDelay = delay + stagger(i, holdings.length, 30)
    const drawProgress = clampInterpolate(
      frame,
      [segDelay + 10, segDelay + 40],
      [0, 1]
    )
    const actualEnd = startAngle + sweepAngle * drawProgress
    return {
      ...h,
      color,
      startAngle,
      endAngle: actualEnd,
      fullEnd: endAngle,
      index: i,
      drawProgress,
    }
  })

  const glowOscillation = 0.5 + loopSine(frame, 50, 0) * 0.3

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: panelWidth,
        height: panelHeight,
        marginLeft: -panelWidth / 2,
        marginTop: -panelHeight / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 280}px) rotateX(${5 - enter * 3}deg)`,
        filter: `blur(${(1 - enter) * 10}px)`,
      }}
    >
      <GlassPanel accent={accent} width={panelWidth} height={panelHeight}>
        <ScanLine
          frame={frame}
          delay={delay}
          accent={accent}
          height={panelHeight}
        />

        {/* Donut SVG */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{
            position: "absolute",
            left: 16,
            top: (panelHeight - size) / 2,
          }}
        >
          <g transform={`rotate(${rotation} ${cx} ${cy})`}>
            {segments.map((seg) => {
              if (seg.endAngle - seg.startAngle < 0.5) return null
              const isLargest = seg.index === largestIdx
              return (
                <path
                  key={seg.index}
                  d={describeArc(
                    cx,
                    cy,
                    donutRadius,
                    innerRadius,
                    seg.startAngle,
                    seg.endAngle
                  )}
                  fill={seg.color}
                  opacity={0.88}
                  stroke="rgba(10,10,15,0.6)"
                  strokeWidth={1.5}
                  filter={
                    isLargest
                      ? undefined
                      : undefined
                  }
                  style={
                    isLargest
                      ? {
                          filter: `drop-shadow(0 0 ${10 * glowOscillation}px ${seg.color})`,
                        }
                      : undefined
                  }
                />
              )
            })}
          </g>

          {/* Center total */}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            fill="#fff"
            fontSize={20}
            fontWeight={800}
            fontFamily={cinematicTheme.font.mono}
          >
            {currency}
            {formatCompactNumber(displayTotal)}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            fill="rgba(234,236,239,0.5)"
            fontSize={10}
            fontFamily={cinematicTheme.font.en}
          >
            Total Value
          </text>
        </svg>

        {/* Legend */}
        <div
          style={{
            position: "absolute",
            left: size + 24,
            top: 28,
            right: 20,
            bottom: 20,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            justifyContent: "center",
          }}
        >
          {holdings.map((h, i) => {
            const legendDelay = delay + 30 + stagger(i, holdings.length, 24)
            const legendOpacity = clampInterpolate(
              frame,
              [legendDelay, legendDelay + 16],
              [0, 1]
            )
            const color =
              h.color ?? defaultColors[i % defaultColors.length]!
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: legendOpacity,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: color,
                    boxShadow: `0 0 6px ${color}66`,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: cinematicTheme.font.zh,
                      fontSize: 11,
                      color: "rgba(234,236,239,0.85)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {h.name}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: cinematicTheme.font.mono,
                    fontSize: 11,
                    color: "rgba(234,236,239,0.6)",
                    marginRight: 6,
                  }}
                >
                  {h.allocation.toFixed(1)}%
                </div>
                {h.change !== undefined && (
                  <div
                    style={{
                      fontFamily: cinematicTheme.font.mono,
                      fontSize: 10,
                      color: h.change >= 0 ? "#4ADE80" : "#F87171",
                    }}
                  >
                    {h.change >= 0 ? "\u25B2" : "\u25BC"}
                    {Math.abs(h.change).toFixed(1)}%
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </GlassPanel>
    </div>
  )
}

// ─── PnLWaterfall ───────────────────────────────────────────────────────────────

export interface PnLWaterfallProps {
  items: Array<{
    label: string
    value: number
    type: "revenue" | "cost" | "profit" | "loss" | "subtotal"
  }>
  title?: string
  currency?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function PnLWaterfall({
  items,
  title = "P&L Waterfall",
  currency = "$",
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 540,
  height = 340,
}: PnLWaterfallProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)

  const padLeft = 56
  const padRight = 28
  const padTop = 64
  const padBottom = 52
  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  // Calculate running total and bounds
  let runningTotal = 0
  const computed = items.map((item) => {
    const start = item.type === "subtotal" ? 0 : runningTotal
    const end = item.type === "subtotal" ? item.value : runningTotal + item.value
    if (item.type !== "subtotal") {
      runningTotal += item.value
    } else {
      runningTotal = item.value
    }
    return { ...item, start, end }
  })

  const allValues = computed.flatMap((c) => [c.start, c.end])
  const minVal = Math.min(0, ...allValues)
  const maxVal = Math.max(...allValues)
  const range = maxVal - minVal || 1

  // Map value to Y position
  function valueToY(val: number): number {
    return padTop + chartH - ((val - minVal) / range) * chartH
  }

  const barWidth = Math.min(52, chartW / items.length - 8)
  const barGap = (chartW - barWidth * items.length) / Math.max(1, items.length)

  function getBarColor(
    type: "revenue" | "cost" | "profit" | "loss" | "subtotal"
  ): string {
    switch (type) {
      case "revenue":
      case "profit":
        return "#4ADE80"
      case "cost":
      case "loss":
        return "#F87171"
      case "subtotal":
        return accent
    }
  }

  const glowPulse = 0.5 + loopSine(frame, 56, 1.2) * 0.3

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 300}px) rotateX(${5 - enter * 3}deg)`,
        filter: `blur(${(1 - enter) * 10}px)`,
      }}
    >
      <GlassPanel accent={accent} width={width} height={height}>
        <ScanLine frame={frame} delay={delay} accent={accent} height={height} />

        {/* Title */}
        <div
          style={{
            position: "absolute",
            left: 28,
            top: 18,
            fontFamily: cinematicTheme.font.zh,
            fontSize: 18,
            fontWeight: 800,
            color: "#fff",
            zIndex: 2,
          }}
        >
          {title}
        </div>

        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", inset: 0 }}
        >
          {/* Grid lines */}
          {Array.from({ length: 5 }).map((_, i) => {
            const val = minVal + (i / 4) * range
            const gy = valueToY(val)
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={gy}
                  y2={gy}
                  stroke="rgba(234,236,239,0.08)"
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={gy + 4}
                  textAnchor="end"
                  fill="rgba(234,236,239,0.35)"
                  fontSize={9}
                  fontFamily={cinematicTheme.font.mono}
                >
                  {formatCompactNumber(val)}
                </text>
              </g>
            )
          })}

          {/* Zero line */}
          {minVal < 0 && (
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={valueToY(0)}
              y2={valueToY(0)}
              stroke="rgba(234,236,239,0.2)"
              strokeWidth={1}
              strokeDasharray="3 2"
            />
          )}

          {/* Bars and connectors */}
          {computed.map((item, i) => {
            const barDelay = delay + 12 + stagger(i, items.length, 30)
            const grow = softSpring(frame, fps, barDelay, {
              damping: 22,
              stiffness: 90,
            })
            const color = getBarColor(item.type)
            const barX =
              padLeft + i * (barWidth + barGap) + barGap / 2
            const yTop = valueToY(Math.max(item.start, item.end))
            const yBottom = valueToY(Math.min(item.start, item.end))
            const barH = Math.max(2, (yBottom - yTop) * grow)
            const barY = item.value >= 0 || item.type === "subtotal"
              ? yBottom - barH
              : yTop

            const isSubtotal = item.type === "subtotal"

            // Connector to next bar
            const nextItem = computed[i + 1]
            const connectorY = valueToY(item.end)
            const nextBarX =
              padLeft + (i + 1) * (barWidth + barGap) + barGap / 2

            return (
              <g key={i}>
                {/* Bar */}
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barH}
                  fill={color}
                  rx={3}
                  opacity={0.88}
                  style={
                    isSubtotal
                      ? {
                          filter: `drop-shadow(0 0 ${8 * glowPulse}px ${color})`,
                        }
                      : undefined
                  }
                />

                {/* Bar border highlight */}
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barH}
                  fill="none"
                  stroke={`${color}66`}
                  strokeWidth={1}
                  rx={3}
                />

                {/* Value label on top */}
                <text
                  x={barX + barWidth / 2}
                  y={barY - 8}
                  textAnchor="middle"
                  fill={color}
                  fontSize={10}
                  fontWeight={700}
                  fontFamily={cinematicTheme.font.mono}
                  opacity={grow}
                >
                  {item.value >= 0 ? "+" : ""}
                  {formatCurrency(item.value, currency)}
                </text>

                {/* X-axis label */}
                <text
                  x={barX + barWidth / 2}
                  y={height - padBottom + 16}
                  textAnchor="middle"
                  fill="rgba(234,236,239,0.5)"
                  fontSize={9}
                  fontFamily={cinematicTheme.font.zh}
                  opacity={grow}
                >
                  {item.label}
                </text>

                {/* Connector line */}
                {nextItem && (
                  <line
                    x1={barX + barWidth}
                    x2={nextBarX}
                    y1={connectorY}
                    y2={connectorY}
                    stroke="rgba(234,236,239,0.2)"
                    strokeWidth={1}
                    strokeDasharray="3 2"
                    opacity={grow}
                  />
                )}
              </g>
            )
          })}
        </svg>
      </GlassPanel>
    </div>
  )
}

// ─── TradingDashboard ───────────────────────────────────────────────────────────

export interface TradingDashboardProps {
  ticker: string
  price: number
  change: number
  changePercent: number
  sparkData: number[]
  stats: Array<{ label: string; value: string }>
  position?: { side: "long" | "short"; entry: number; pnl: number }
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function TradingDashboard({
  ticker,
  price,
  change,
  changePercent,
  sparkData,
  stats,
  position,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 520,
  height = 300,
}: TradingDashboardProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const isUp = change >= 0
  const trendColor = isUp ? "#4ADE80" : "#F87171"

  // Price oscillation for real-time feel
  const priceOscillation = loopSine(frame, 90, 2.1) * price * 0.001
  const displayPrice = price + priceOscillation

  // Sparkline
  const sparkW = width - 56
  const sparkH = 64
  const sparkMin = Math.min(...sparkData)
  const sparkMax = Math.max(...sparkData)
  const sparkRange = sparkMax - sparkMin || 1

  const sparkPoints = sparkData.map((v, i) => {
    const px = (i / Math.max(1, sparkData.length - 1)) * sparkW
    const py = sparkH - ((v - sparkMin) / sparkRange) * (sparkH - 8) - 4
    return { x: px, y: py }
  })

  const sparkLinePath = sparkPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ")
  const sparkAreaPath = `${sparkLinePath} L ${sparkW} ${sparkH} L 0 ${sparkH} Z`

  const drawSpark = clampInterpolate(frame, [delay + 15, delay + 55], [0, 1])

  const drift = loopSine(frame, 180, 0.3) * 2

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y + drift}px, ${z - (1 - enter) * 280}px) rotateX(${5 - enter * 3}deg)`,
        filter: `blur(${(1 - enter) * 10}px)`,
      }}
    >
      <GlassPanel accent={accent} width={width} height={height}>
        <ScanLine frame={frame} delay={delay} accent={accent} height={height} />

        {/* Header: Ticker + Price + Change */}
        <div
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            top: 18,
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            zIndex: 2,
          }}
        >
          {/* Ticker */}
          <div
            style={{
              fontFamily: cinematicTheme.font.mono,
              fontSize: 22,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: 1.5,
            }}
          >
            {ticker}
          </div>

          {/* Price */}
          <div
            style={{
              fontFamily: cinematicTheme.font.mono,
              fontSize: 20,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {displayPrice.toFixed(2)}
          </div>

          {/* Change badge */}
          <div
            style={{
              fontFamily: cinematicTheme.font.mono,
              fontSize: 12,
              fontWeight: 700,
              color: trendColor,
              background: `${trendColor}18`,
              border: `1px solid ${trendColor}44`,
              borderRadius: 6,
              padding: "2px 8px",
              boxShadow: `0 0 8px ${trendColor}33`,
            }}
          >
            {isUp ? "+" : ""}
            {change.toFixed(2)} ({isUp ? "+" : ""}
            {changePercent.toFixed(2)}%)
          </div>
        </div>

        {/* Sparkline */}
        <svg
          width={sparkW}
          height={sparkH}
          viewBox={`0 0 ${sparkW} ${sparkH}`}
          style={{ position: "absolute", left: 28, top: 56 }}
        >
          <defs>
            <linearGradient id="td-spark-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trendColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={trendColor} stopOpacity={0.02} />
            </linearGradient>
            <filter id="td-spark-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d={sparkAreaPath} fill="url(#td-spark-grad)" opacity={drawSpark} />
          <path
            d={sparkLinePath}
            fill="none"
            stroke={trendColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - drawSpark}
            filter="url(#td-spark-glow)"
          />
          {/* End dot */}
          {drawSpark > 0.95 && sparkPoints.length > 0 && (
            <circle
              cx={sparkPoints[sparkPoints.length - 1]!.x}
              cy={sparkPoints[sparkPoints.length - 1]!.y}
              r={4}
              fill={trendColor}
              opacity={0.9}
            >
            </circle>
          )}
        </svg>

        {/* Stats grid (2x3) */}
        <div
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            top: 130,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "8px 12px",
          }}
        >
          {stats.slice(0, 6).map((s, i) => {
            const statDelay = delay + 20 + stagger(i, Math.min(6, stats.length), 18)
            const statOpacity = clampInterpolate(
              frame,
              [statDelay, statDelay + 14],
              [0, 1]
            )
            return (
              <div key={i} style={{ opacity: statOpacity }}>
                <div
                  style={{
                    fontFamily: cinematicTheme.font.en,
                    fontSize: 9,
                    color: "rgba(234,236,239,0.45)",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 2,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontFamily: cinematicTheme.font.mono,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "rgba(234,236,239,0.88)",
                  }}
                >
                  {s.value}
                </div>
              </div>
            )
          })}
        </div>

        {/* Position section */}
        {position && (
          <div
            style={{
              position: "absolute",
              left: 24,
              right: 24,
              bottom: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              opacity: clampInterpolate(frame, [delay + 40, delay + 54], [0, 1]),
            }}
          >
            {/* Side badge */}
            <div
              style={{
                fontFamily: cinematicTheme.font.mono,
                fontSize: 10,
                fontWeight: 800,
                color:
                  position.side === "long" ? "#4ADE80" : "#F87171",
                background:
                  position.side === "long"
                    ? "rgba(74,222,128,0.12)"
                    : "rgba(248,113,113,0.12)",
                border: `1px solid ${position.side === "long" ? "#4ADE8044" : "#F8717144"}`,
                borderRadius: 5,
                padding: "3px 8px",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {position.side}
            </div>

            {/* Entry price */}
            <div>
              <div
                style={{
                  fontFamily: cinematicTheme.font.en,
                  fontSize: 9,
                  color: "rgba(234,236,239,0.4)",
                  letterSpacing: 0.6,
                }}
              >
                ENTRY
              </div>
              <div
                style={{
                  fontFamily: cinematicTheme.font.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "rgba(234,236,239,0.8)",
                }}
              >
                {position.entry.toFixed(2)}
              </div>
            </div>

            {/* P&L */}
            <div>
              <div
                style={{
                  fontFamily: cinematicTheme.font.en,
                  fontSize: 9,
                  color: "rgba(234,236,239,0.4)",
                  letterSpacing: 0.6,
                }}
              >
                P&L
              </div>
              <div
                style={{
                  fontFamily: cinematicTheme.font.mono,
                  fontSize: 13,
                  fontWeight: 800,
                  color: position.pnl >= 0 ? "#4ADE80" : "#F87171",
                  textShadow: `0 0 10px ${position.pnl >= 0 ? "#4ADE8066" : "#F8717166"}`,
                }}
              >
                {position.pnl >= 0 ? "+" : ""}
                {position.pnl.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
