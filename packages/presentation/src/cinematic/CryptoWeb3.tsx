import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, loopSine, softSpring, stagger } from "./motion"

// ─── BlockchainFlow ───────────────────────────────────────────────────────────

export function BlockchainFlow({
  blocks,
  speed = 1,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "purple",
}: {
  blocks: Array<{ hash: string; txCount: number; size?: string; tone?: CinematicTone }>
  speed?: number
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const blockWidth = 140
  const linkWidth = 48
  const totalWidth = blocks.length * (blockWidth + linkWidth) - linkWidth

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: totalWidth + 40,
        height: 160,
        marginLeft: -(totalWidth + 40) / 2,
        marginTop: -80,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 240}px) rotateX(${8 - enter * 4}deg) rotateY(${-4 + enter * 2}deg)`,
      }}
    >
      {blocks.map((block, index) => {
        const blockDelay = delay + stagger(index, blocks.length, 24) * speed
        const blockEnter = softSpring(frame, fps, blockDelay)
        const blockAccent = toneColor(block.tone ?? tone)
        const pulse = 0.3 + Math.max(0, loopSine(frame, 60, index * 11) * 0.2)
        const abbrevHash = block.hash.length > 8 ? `${block.hash.slice(0, 4)}...${block.hash.slice(-4)}` : block.hash
        const offsetX = index * (blockWidth + linkWidth) + 20

        return (
          <div key={index}>
            {/* Chain link connector */}
            {index > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: offsetX - linkWidth,
                  top: "50%",
                  width: linkWidth,
                  height: 3,
                  marginTop: -1.5,
                  background: `linear-gradient(90deg, ${blockAccent}80, ${blockAccent})`,
                  boxShadow: `0 0 12px ${blockAccent}55`,
                  opacity: blockEnter,
                  transformOrigin: "left center",
                  transform: `scaleX(${blockEnter})`,
                }}
              >
                {/* Animated data packet */}
                <div
                  style={{
                    position: "absolute",
                    left: `${((frame * speed * 2 + index * 20) % 60) / 60 * 100}%`,
                    top: -3,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: blockAccent,
                    boxShadow: `0 0 10px ${blockAccent}`,
                    opacity: blockEnter * 0.8,
                  }}
                />
              </div>
            )}
            {/* Block */}
            <div
              style={{
                position: "absolute",
                left: offsetX,
                top: "50%",
                width: blockWidth,
                height: 110,
                marginTop: -55,
                opacity: blockEnter,
                transform: `translateX(${(1 - blockEnter) * 60}px)`,
                borderRadius: 14,
                background: "linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.02)), rgba(10,10,15,0.62)",
                border: `1px solid ${blockAccent}40`,
                boxShadow: `0 16px 50px rgba(0,0,0,0.38), 0 0 ${28 * pulse}px ${blockAccent}30, inset 0 1px 0 rgba(255,255,255,0.14)`,
                backdropFilter: "blur(18px)",
                padding: "14px 12px",
                display: "flex",
                flexDirection: "column" as const,
                justifyContent: "space-between",
              }}
            >
              {/* Block number indicator */}
              <div
                style={{
                  position: "absolute",
                  top: -6,
                  right: 12,
                  fontSize: 9,
                  fontFamily: cinematicTheme.font.mono,
                  color: blockAccent,
                  background: "rgba(10,10,15,0.8)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  border: `1px solid ${blockAccent}40`,
                }}
              >
                #{index + 1}
              </div>
              {/* Hash */}
              <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 10, letterSpacing: 0.8, color: "rgba(234,236,239,0.5)" }}>
                {abbrevHash}
              </div>
              {/* Tx count */}
              <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", textShadow: `0 0 18px ${blockAccent}40` }}>
                {Math.round(clampInterpolate(frame, [blockDelay + 4, blockDelay + 36], [0, block.txCount]))}
                <span style={{ fontSize: 11, color: "rgba(234,236,239,0.5)", marginLeft: 4 }}>txns</span>
              </div>
              {/* Size */}
              {block.size && (
                <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 10, color: "rgba(234,236,239,0.38)" }}>
                  {block.size}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── TokenomicsRing ───────────────────────────────────────────────────────────

export function TokenomicsRing({
  allocations,
  totalSupply = "",
  tokenName = "",
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  allocations: Array<{ label: string; percentage: number; tone?: CinematicTone }>
  totalSupply?: string
  tokenName?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const size = 340
  const centerX = size / 2
  const centerY = size / 2

  function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
    const startRad = (startAngle - 90) * (Math.PI / 180)
    const endRad = (endAngle - 90) * (Math.PI / 180)
    const x1 = cx + radius * Math.cos(startRad)
    const y1 = cy + radius * Math.sin(startRad)
    const x2 = cx + radius * Math.cos(endRad)
    const y2 = cy + radius * Math.sin(endRad)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  let cumulativeAngle = 0

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size + 180,
        height: size + 40,
        marginLeft: -(size + 180) / 2,
        marginTop: -(size + 40) / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 200}px) rotateX(${6 - enter * 3}deg)`,
      }}
    >
      <svg width={size} height={size} style={{ position: "absolute", left: 90, top: 20 }}>
        {allocations.map((alloc, index) => {
          const ringDelay = delay + stagger(index, allocations.length, 28)
          const ringEnter = softSpring(frame, fps, ringDelay)
          const ringAccent = toneColor(alloc.tone ?? tone)
          const startAngle = cumulativeAngle
          const sweepAngle = (alloc.percentage / 100) * 360
          const endAngle = startAngle + sweepAngle * ringEnter
          cumulativeAngle += sweepAngle
          const radius = 80 + index * 22
          const glow = 0.4 + loopSine(frame, 48, index * 7) * 0.2

          return (
            <g key={index}>
              {/* Background track */}
              <circle
                cx={centerX}
                cy={centerY}
                r={radius}
                fill="none"
                stroke="rgba(234,236,239,0.06)"
                strokeWidth={14}
              />
              {/* Filled arc */}
              {endAngle > startAngle + 0.5 && (
                <path
                  d={describeArc(centerX, centerY, radius, startAngle, endAngle)}
                  fill="none"
                  stroke={ringAccent}
                  strokeWidth={14}
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 ${8 * glow}px ${ringAccent})`,
                    opacity: 0.85 + glow * 0.15,
                  }}
                />
              )}
            </g>
          )
        })}
        {/* Center text */}
        <text
          x={centerX}
          y={centerY - 10}
          textAnchor="middle"
          fill="#fff"
          fontSize={14}
          fontWeight={900}
          fontFamily={cinematicTheme.font.en}
          opacity={enter}
        >
          {tokenName}
        </text>
        <text
          x={centerX}
          y={centerY + 14}
          textAnchor="middle"
          fill="rgba(234,236,239,0.5)"
          fontSize={10}
          fontFamily={cinematicTheme.font.mono}
          opacity={enter}
        >
          {totalSupply}
        </text>
      </svg>
      {/* Labels */}
      {(() => {
        let labelAngle = 0
        return allocations.map((alloc, index) => {
          const labelDelay = delay + stagger(index, allocations.length, 28) + 16
          const labelEnter = softSpring(frame, fps, labelDelay)
          const ringAccent = toneColor(alloc.tone ?? tone)
          const sweepAngle = (alloc.percentage / 100) * 360
          const midAngle = labelAngle + sweepAngle / 2
          labelAngle += sweepAngle
          const labelRadius = 80 + allocations.length * 22 + 28
          const rad = (midAngle - 90) * (Math.PI / 180)
          const lx = centerX + labelRadius * Math.cos(rad) + 90
          const ly = centerY + labelRadius * Math.sin(rad) + 20

          return (
            <div
              key={index}
              style={{
                position: "absolute",
                left: lx,
                top: ly,
                transform: "translate(-50%, -50%)",
                opacity: labelEnter,
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: ringAccent, boxShadow: `0 0 8px ${ringAccent}` }} />
              <span style={{ fontFamily: cinematicTheme.font.mono, fontSize: 10, color: "rgba(234,236,239,0.7)" }}>
                {alloc.label}
              </span>
              <span style={{ fontFamily: cinematicTheme.font.mono, fontSize: 10, color: ringAccent, fontWeight: 700 }}>
                {alloc.percentage}%
              </span>
            </div>
          )
        })
      })()}
    </div>
  )
}

// ─── LiquidityDepth ───────────────────────────────────────────────────────────

export function LiquidityDepth({
  bids,
  asks,
  currentPrice,
  tokenPair = "",
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  bids: Array<{ price: number; amount: number }>
  asks: Array<{ price: number; amount: number }>
  currentPrice: number
  tokenPair?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const chartW = 560
  const chartH = 220
  const padding = 40

  // Sort and cumulate
  const sortedBids = [...bids].sort((a, b) => b.price - a.price)
  const sortedAsks = [...asks].sort((a, b) => a.price - b.price)

  let bidCum = 0
  const cumulativeBids = sortedBids.map((b) => {
    bidCum += b.amount
    return { price: b.price, cumAmount: bidCum }
  })
  let askCum = 0
  const cumulativeAsks = sortedAsks.map((a) => {
    askCum += a.amount
    return { price: a.price, cumAmount: askCum }
  })

  const maxCum = Math.max(bidCum, askCum, 1)
  const allPrices = [...sortedBids.map((b) => b.price), ...sortedAsks.map((a) => a.price)]
  const minPrice = Math.min(...allPrices, currentPrice)
  const maxPrice = Math.max(...allPrices, currentPrice)
  const priceRange = maxPrice - minPrice || 1

  const drawProgress = clampInterpolate(frame, [delay + 6, delay + 44], [0, 1])

  function priceToX(price: number): number {
    return padding + ((price - minPrice) / priceRange) * (chartW - padding * 2)
  }
  function amountToY(cumAmount: number): number {
    return chartH - padding - (cumAmount / maxCum) * (chartH - padding * 2)
  }

  // Build bid path (right to left — descending price)
  const bidPoints = cumulativeBids.map((b) => ({ x: priceToX(b.price), y: amountToY(b.cumAmount) }))
  const askPoints = cumulativeAsks.map((a) => ({ x: priceToX(a.price), y: amountToY(a.cumAmount) }))

  function buildAreaPath(points: Array<{ x: number; y: number }>, baseline: number, progress: number): string {
    if (points.length === 0) return ""
    const count = Math.max(1, Math.round(points.length * progress))
    const visible = points.slice(0, count)
    let path = `M ${visible[0].x} ${baseline}`
    for (const pt of visible) {
      path += ` L ${pt.x} ${pt.y}`
    }
    path += ` L ${visible[visible.length - 1].x} ${baseline} Z`
    return path
  }

  const bidColor = "#22C55E"
  const askColor = cinematicTheme.colors.magenta
  const centerX = priceToX(currentPrice)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: chartW + 40,
        height: chartH + 80,
        marginLeft: -(chartW + 40) / 2,
        marginTop: -(chartH + 80) / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 220}px) rotateX(${6 - enter * 3}deg)`,
        borderRadius: 20,
        background: "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), rgba(10,10,15,0.62)",
        border: `1px solid ${accent}30`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.12)`,
        backdropFilter: "blur(18px)",
        padding: "16px 20px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 11, letterSpacing: 1.5, color: "rgba(234,236,239,0.46)" }}>
          LIQUIDITY DEPTH
        </div>
        {tokenPair && (
          <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 12, color: accent, fontWeight: 700 }}>
            {tokenPair}
          </div>
        )}
      </div>
      {/* Chart */}
      <svg width={chartW} height={chartH} style={{ display: "block" }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={padding}
            y1={chartH - padding - ratio * (chartH - padding * 2)}
            x2={chartW - padding}
            y2={chartH - padding - ratio * (chartH - padding * 2)}
            stroke="rgba(234,236,239,0.06)"
            strokeWidth={1}
          />
        ))}
        {/* Bid area */}
        <path
          d={buildAreaPath(bidPoints, chartH - padding, drawProgress)}
          fill={`${bidColor}20`}
          stroke={bidColor}
          strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 6px ${bidColor}55)` }}
        />
        {/* Ask area */}
        <path
          d={buildAreaPath(askPoints, chartH - padding, drawProgress)}
          fill={`${askColor}20`}
          stroke={askColor}
          strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 6px ${askColor}55)` }}
        />
        {/* Current price line */}
        <line
          x1={centerX}
          y1={padding}
          x2={centerX}
          y2={chartH - padding}
          stroke={accent}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={enter * 0.7}
        />
        {/* Price label */}
        <text
          x={centerX}
          y={padding - 8}
          textAnchor="middle"
          fill={accent}
          fontSize={11}
          fontFamily={cinematicTheme.font.mono}
          fontWeight={700}
          opacity={enter}
        >
          {currentPrice.toLocaleString()}
        </text>
        {/* Axis labels */}
        <text x={padding} y={chartH - 12} fill="rgba(234,236,239,0.35)" fontSize={9} fontFamily={cinematicTheme.font.mono}>
          BID
        </text>
        <text x={chartW - padding} y={chartH - 12} textAnchor="end" fill="rgba(234,236,239,0.35)" fontSize={9} fontFamily={cinematicTheme.font.mono}>
          ASK
        </text>
      </svg>
      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 3, borderRadius: 2, background: bidColor }} />
          <span style={{ fontFamily: cinematicTheme.font.mono, fontSize: 9, color: "rgba(234,236,239,0.5)" }}>BIDS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 3, borderRadius: 2, background: askColor }} />
          <span style={{ fontFamily: cinematicTheme.font.mono, fontSize: 9, color: "rgba(234,236,239,0.5)" }}>ASKS</span>
        </div>
      </div>
    </div>
  )
}

// ─── StakingDashboard ─────────────────────────────────────────────────────────

export function StakingDashboard({
  metrics,
  history = [],
  protocol = "",
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "purple",
}: {
  metrics: { apy: number; tvl: number; validators: number; staked: number }
  history?: number[]
  protocol?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)

  const stakingRatio = Math.min(1, metrics.staked / 100)
  const circleR = 44
  const circleCirc = 2 * Math.PI * circleR
  const progressEnter = clampInterpolate(frame, [delay + 10, delay + 52], [0, 1])
  const strokeDash = circleCirc * stakingRatio * progressEnter

  // Metric cards data
  const metricCards = [
    { label: "APY", value: metrics.apy, suffix: "%", color: cinematicTheme.colors.gold },
    { label: "TVL", value: metrics.tvl, suffix: "", prefix: "$", color: accent },
    { label: "VALIDATORS", value: metrics.validators, suffix: "", color: cinematicTheme.colors.amber },
  ]

  // Sparkline
  const sparkW = 200
  const sparkH = 48
  const maxHist = Math.max(...history, 1)
  const minHist = Math.min(...history, 0)
  const histRange = maxHist - minHist || 1
  const sparkPath = history.length > 1
    ? history
        .map((v, i) => {
          const px = (i / (history.length - 1)) * sparkW
          const py = sparkH - ((v - minHist) / histRange) * (sparkH - 8) - 4
          return `${i === 0 ? "M" : "L"} ${px} ${py}`
        })
        .join(" ")
    : ""
  const sparkDrawProgress = clampInterpolate(frame, [delay + 14, delay + 50], [0, 1])

  function formatTvl(value: number): string {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
    return value.toFixed(0)
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 580,
        height: 300,
        marginLeft: -290,
        marginTop: -150,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 240}px) rotateX(${8 - enter * 4}deg) rotateY(${-3 + enter * 1.5}deg)`,
        borderRadius: 22,
        background: "linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.02)), rgba(10,10,15,0.6)",
        border: `1px solid ${accent}30`,
        boxShadow: `0 28px 80px rgba(0,0,0,0.45), 0 0 40px ${accent}15, inset 0 1px 0 rgba(255,255,255,0.13)`,
        backdropFilter: "blur(18px)",
        padding: "24px 28px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 11, letterSpacing: 1.8, color: "rgba(234,236,239,0.46)" }}>
          STAKING OVERVIEW
        </div>
        {protocol && (
          <div
            style={{
              fontFamily: cinematicTheme.font.en,
              fontSize: 13,
              fontWeight: 700,
              color: accent,
              background: `${accent}14`,
              padding: "3px 10px",
              borderRadius: 6,
              border: `1px solid ${accent}30`,
            }}
          >
            {protocol}
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ display: "flex", gap: 28 }}>
        {/* Left: Metric cards */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12, flex: 1 }}>
          {metricCards.map((card, i) => {
            const cardEnter = softSpring(frame, fps, delay + 6 + i * 5)
            const displayValue = clampInterpolate(frame, [delay + 8 + i * 5, delay + 48 + i * 5], [0, card.value])

            return (
              <div
                key={card.label}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: "rgba(12,12,18,0.5)",
                  border: `1px solid ${card.color}28`,
                  boxShadow: `0 8px 28px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)`,
                  backdropFilter: "blur(12px)",
                  opacity: cardEnter,
                  transform: `translateX(${(1 - cardEnter) * -20}px)`,
                }}
              >
                <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 9, letterSpacing: 1.5, color: "rgba(234,236,239,0.4)" }}>
                  {card.label}
                </div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#fff", textShadow: `0 0 16px ${card.color}35` }}>
                  <span style={{ color: card.color }}>{card.prefix ?? ""}</span>
                  {card.label === "TVL" ? formatTvl(displayValue) : displayValue >= 100 ? Math.round(displayValue) : displayValue.toFixed(1)}
                  <span style={{ color: card.color, fontSize: 14, marginLeft: 3 }}>{card.suffix}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Right: Circular progress + sparkline */}
        <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 16, flex: 1 }}>
          {/* Circular progress */}
          <div style={{ position: "relative", width: 110, height: 110 }}>
            <svg width={110} height={110} style={{ transform: "rotate(-90deg)" }}>
              <circle
                cx={55}
                cy={55}
                r={circleR}
                fill="none"
                stroke="rgba(234,236,239,0.07)"
                strokeWidth={10}
              />
              <circle
                cx={55}
                cy={55}
                r={circleR}
                fill="none"
                stroke={accent}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={`${strokeDash} ${circleCirc}`}
                style={{ filter: `drop-shadow(0 0 8px ${accent}66)` }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>
                {Math.round(stakingRatio * 100 * progressEnter)}%
              </div>
              <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 8, color: "rgba(234,236,239,0.4)", letterSpacing: 1 }}>
                STAKED
              </div>
            </div>
          </div>

          {/* Sparkline */}
          {history.length > 1 && (
            <div style={{ position: "relative", width: sparkW, height: sparkH }}>
              <svg width={sparkW} height={sparkH}>
                <defs>
                  <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                {/* Area fill */}
                {sparkPath && (
                  <path
                    d={`${sparkPath} L ${sparkW} ${sparkH} L 0 ${sparkH} Z`}
                    fill="url(#spark-grad)"
                    opacity={sparkDrawProgress}
                  />
                )}
                {/* Line */}
                {sparkPath && (
                  <path
                    d={sparkPath}
                    fill="none"
                    stroke={accent}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray={sparkW * 2}
                    strokeDashoffset={sparkW * 2 * (1 - sparkDrawProgress)}
                    style={{ filter: `drop-shadow(0 0 4px ${accent}55)` }}
                  />
                )}
              </svg>
              <div style={{ position: "absolute", bottom: -14, left: 0, right: 0, textAlign: "center", fontFamily: cinematicTheme.font.mono, fontSize: 8, color: "rgba(234,236,239,0.35)", letterSpacing: 1 }}>
                TVL HISTORY
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
