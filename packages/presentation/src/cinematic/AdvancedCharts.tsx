import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, softSpring, stagger, loopSine } from "./motion"

// ─── BubbleChart ────────────────────────────────────────────────────────────────

export interface BubbleData {
  x: number
  y: number
  size: number
  label?: string
  color?: string
}

export interface BubbleChartProps {
  bubbles: BubbleData[]
  xLabel?: string
  yLabel?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function BubbleChart({
  bubbles,
  xLabel,
  yLabel,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 480,
  height = 360,
}: BubbleChartProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const drift = loopSine(frame, 190, 0.4)

  const pad = 50
  const chartW = width - pad * 2
  const chartH = height - pad * 2

  // Compute data ranges
  const xMin = Math.min(...bubbles.map((b) => b.x))
  const xMax = Math.max(...bubbles.map((b) => b.x))
  const yMin = Math.min(...bubbles.map((b) => b.y))
  const yMax = Math.max(...bubbles.map((b) => b.y))
  const xRange = Math.max(1, xMax - xMin)
  const yRange = Math.max(1, yMax - yMin)
  const maxSize = Math.max(...bubbles.map((b) => b.size))

  const mapX = (v: number) => pad + ((v - xMin) / xRange) * chartW
  const mapY = (v: number) => pad + (1 - (v - yMin) / yRange) * chartH

  const gridId = `bubble-grid-${tone}-${delay}`
  const glowId = `bubble-glow-${tone}-${delay}`

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
        transform: `translate3d(${x}px, ${y + drift * 4}px, ${z - (1 - enter) * 320}px) rotateX(${52 - enter * 14}deg) rotateY(${-10 + enter * 7}deg)`,
        filter: `blur(${(1 - enter) * 10}px)`,
      }}
    >
      {/* Glassmorphism panel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 24,
          background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), rgba(10,10,15,0.58)`,
          border: `1px solid ${accent}40`,
          boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 ${38 * (0.6 + loopSine(frame, 80) * 0.2)}px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.16)`,
          backdropFilter: "blur(18px)",
          overflow: "hidden",
        }}
      >
        {/* Scan-line texture */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "4px 4px", opacity: 0.3 }} />
      </div>

      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`${gridId}-bubble-fill`}>
            <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="70%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
          </radialGradient>
        </defs>

        {/* Grid lines */}
        <g opacity={clampInterpolate(frame, [delay, delay + 24], [0, 0.6])}>
          {Array.from({ length: 5 }).map((_, i) => {
            const gy = pad + (i / 4) * chartH
            return <line key={`h-${i}`} x1={pad} x2={pad + chartW} y1={gy} y2={gy} stroke="rgba(234,236,239,0.09)" strokeWidth={1} />
          })}
          {Array.from({ length: 5 }).map((_, i) => {
            const gx = pad + (i / 4) * chartW
            return <line key={`v-${i}`} x1={gx} x2={gx} y1={pad} y2={pad + chartH} stroke="rgba(214,179,106,0.07)" strokeWidth={1} />
          })}
        </g>

        {/* Axis labels */}
        {xLabel && (
          <text x={width / 2} y={height - 8} textAnchor="middle" fill={cinematicTheme.colors.muted} fontSize={11} fontFamily={cinematicTheme.font.en}>
            {xLabel}
          </text>
        )}
        {yLabel && (
          <text x={12} y={height / 2} textAnchor="middle" fill={cinematicTheme.colors.muted} fontSize={11} fontFamily={cinematicTheme.font.en} transform={`rotate(-90 12 ${height / 2})`}>
            {yLabel}
          </text>
        )}

        {/* Bubbles */}
        {bubbles.map((b, i) => {
          const bEnter = softSpring(frame, fps, delay + 10 + stagger(i, bubbles.length, 30))
          const cx = mapX(b.x)
          const cy = mapY(b.y)
          const radius = Math.max(8, (b.size / Math.max(1, maxSize)) * 38) * bEnter
          const color = b.color ?? accent
          const isLarge = b.size / maxSize > 0.7
          const floatPhase = i * 1.3
          const floatY = loopSine(frame, 90 + i * 7, floatPhase) * 3
          const floatX = loopSine(frame, 110 + i * 5, floatPhase + 0.5) * 2

          return (
            <g key={i} transform={`translate(${cx + floatX} ${cy + floatY})`} opacity={bEnter}>
              {/* Glow for large bubbles */}
              {isLarge && (
                <circle
                  r={radius + 6}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.2 + loopSine(frame, 60, i) * 0.1}
                  filter={`url(#${glowId})`}
                />
              )}
              {/* Main bubble */}
              <circle
                r={radius}
                fill={`url(#${gridId}-bubble-fill)`}
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.7}
              />
              {/* Inner highlight */}
              <circle
                r={radius * 0.6}
                fill={color}
                opacity={0.12}
              />
              {/* Label */}
              {b.label && (
                <text
                  y={radius > 20 ? 4 : radius + 16}
                  textAnchor="middle"
                  fill={radius > 20 ? "#fff" : cinematicTheme.colors.dim}
                  fontSize={radius > 20 ? 11 : 9}
                  fontWeight={600}
                  fontFamily={cinematicTheme.font.zh}
                >
                  {b.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── AreaStream ─────────────────────────────────────────────────────────────────

export interface AreaStreamSeries {
  label: string
  data: number[]
  color: string
}

export interface AreaStreamProps {
  series: AreaStreamSeries[]
  labels?: string[]
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

/**
 * Compute catmull-rom spline through points as SVG cubic bezier path.
 * Returns path string starting from the first point.
 */
function catmullRomPath(points: Array<{ x: number; y: number }>, tension = 0.4): string {
  if (points.length < 2) return ""
  const d: string[] = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`]

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    const cp1x = p1.x + (p2.x - p0.x) * tension / 3
    const cp1y = p1.y + (p2.y - p0.y) * tension / 3
    const cp2x = p2.x - (p3.x - p1.x) * tension / 3
    const cp2y = p2.y - (p3.y - p1.y) * tension / 3

    d.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`)
  }

  return d.join(" ")
}

export function AreaStream({
  series,
  labels,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 560,
  height = 300,
}: AreaStreamProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const drift = loopSine(frame, 200, 0.3)

  const pad = { top: 50, bottom: 40, left: 40, right: 40 }
  const chartW = width - pad.left - pad.right
  const chartH = height - pad.top - pad.bottom
  const numPoints = series[0]?.data.length ?? 0

  // Compute stacked values centered (stream graph: baseline = -(total/2))
  const totals: number[] = Array.from({ length: numPoints }, (_, i) =>
    series.reduce((sum, s) => sum + (s.data[i] ?? 0), 0)
  )
  const maxTotal = Math.max(1, ...totals)

  // Compute baseline (center the stream)
  const baselines: number[] = totals.map((t) => -t / 2)

  // Build area paths for each series
  const areaPaths: Array<{ topPoints: Array<{ x: number; y: number }>; bottomPoints: Array<{ x: number; y: number }>; color: string; label: string }> = []

  for (let si = 0; si < series.length; si++) {
    const topPoints: Array<{ x: number; y: number }> = []
    const bottomPoints: Array<{ x: number; y: number }> = []

    for (let pi = 0; pi < numPoints; pi++) {
      const px = pad.left + (pi / Math.max(1, numPoints - 1)) * chartW
      const cumBelow = series.slice(0, si).reduce((s, ser) => s + (ser.data[pi] ?? 0), 0)
      const val = series[si].data[pi] ?? 0

      const centerY = height / 2
      const scale = chartH / maxTotal
      const bottomY = centerY - (baselines[pi] + cumBelow) * scale
      const topY = centerY - (baselines[pi] + cumBelow + val) * scale

      topPoints.push({ x: px, y: topY })
      bottomPoints.push({ x: px, y: bottomY })
    }

    areaPaths.push({ topPoints, bottomPoints, color: series[si].color, label: series[si].label })
  }

  const drawProgress = clampInterpolate(frame, [delay + 10, delay + 70], [0, 1])
  const clipX = pad.left + drawProgress * chartW

  const clipId = `area-stream-clip-${delay}-${tone}`
  const gradIds = series.map((_, i) => `area-stream-grad-${delay}-${i}`)

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
        transform: `translate3d(${x}px, ${y + drift * 4}px, ${z - (1 - enter) * 300}px) rotateX(${48 - enter * 12}deg) rotateY(${-8 + enter * 6}deg)`,
        filter: `blur(${(1 - enter) * 10}px)`,
      }}
    >
      {/* Panel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 24,
          background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), rgba(10,10,15,0.58)`,
          border: `1px solid ${accent}40`,
          boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 ${34 * (0.6 + loopSine(frame, 90) * 0.2)}px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.16)`,
          backdropFilter: "blur(18px)",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "4px 4px", opacity: 0.3 }} />
      </div>

      {/* Legend chips */}
      <div style={{ position: "absolute", top: 14, left: pad.left, display: "flex", gap: 14, zIndex: 2 }}>
        {series.map((s, i) => {
          const chipEnter = softSpring(frame, fps, delay + 6 + i * 4)
          return (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, opacity: chipEnter }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, boxShadow: `0 0 8px ${s.color}66` }} />
              <span style={{ fontSize: 10, color: cinematicTheme.colors.muted, fontFamily: cinematicTheme.font.zh }}>{s.label}</span>
            </div>
          )
        })}
      </div>

      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={clipX} height={height} />
          </clipPath>
          {series.map((s, i) => (
            <linearGradient key={i} id={gradIds[i]} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.7} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.2} />
            </linearGradient>
          ))}
          <filter id={`area-glow-${delay}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Area streams */}
        <g clipPath={`url(#${clipId})`}>
          {areaPaths.map((area, i) => {
            const topPath = catmullRomPath(area.topPoints)
            const bottomReversed = [...area.bottomPoints].reverse()
            const bottomPath = catmullRomPath(bottomReversed)

            // Build closed path: top forward, then bottom reversed
            const lastTop = area.topPoints[area.topPoints.length - 1]
            const firstBottom = bottomReversed[0]
            const closedPath = `${topPath} L ${lastTop.x.toFixed(2)} ${lastTop.y.toFixed(2)} L ${firstBottom.x.toFixed(2)} ${firstBottom.y.toFixed(2)} ${bottomPath.replace(/^M [^ ]+ [^ ]+/, "")} Z`

            const isTop = i === series.length - 1

            return (
              <g key={area.label}>
                <path
                  d={closedPath}
                  fill={`url(#${gradIds[i]})`}
                  opacity={0.6}
                />
                {/* Highlight stroke on topmost series */}
                {isTop && (
                  <path
                    d={topPath}
                    fill="none"
                    stroke={area.color}
                    strokeWidth={2}
                    strokeOpacity={0.8}
                    filter={`url(#area-glow-${delay})`}
                  />
                )}
              </g>
            )
          })}
        </g>

        {/* X-axis labels */}
        {labels && labels.map((lbl, i) => {
          const lx = pad.left + (i / Math.max(1, labels.length - 1)) * chartW
          return (
            <text key={i} x={lx} y={height - 12} textAnchor="middle" fill="rgba(234,236,239,0.42)" fontSize={10} fontFamily={cinematicTheme.font.mono}>
              {lbl}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

// ─── SlopeChart ─────────────────────────────────────────────────────────────────

export interface SlopeItem {
  label: string
  start: number
  end: number
  color?: string
}

export interface SlopeChartProps {
  items: SlopeItem[]
  startLabel?: string
  endLabel?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function SlopeChart({
  items,
  startLabel = "Before",
  endLabel = "After",
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 400,
  height = 360,
}: SlopeChartProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const drift = loopSine(frame, 180, 0.6)

  const pad = { top: 60, bottom: 40, left: 80, right: 80 }
  const chartH = height - pad.top - pad.bottom

  // Compute value range
  const allValues = items.flatMap((it) => [it.start, it.end])
  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)
  const range = Math.max(1, maxVal - minVal)

  const mapY = (v: number) => pad.top + (1 - (v - minVal) / range) * chartH

  const leftX = pad.left
  const rightX = width - pad.right

  const glowId = `slope-glow-${delay}-${tone}`

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
        transform: `translate3d(${x}px, ${y + drift * 3}px, ${z - (1 - enter) * 280}px) rotateX(${46 - enter * 12}deg) rotateY(${-6 + enter * 5}deg)`,
        filter: `blur(${(1 - enter) * 9}px)`,
      }}
    >
      {/* Glassmorphism card */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 24,
          background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), rgba(10,10,15,0.58)`,
          border: `1px solid ${accent}40`,
          boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 ${32 * (0.6 + loopSine(frame, 70) * 0.15)}px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.16)`,
          backdropFilter: "blur(18px)",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "4px 4px", opacity: 0.3 }} />
      </div>

      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Axis titles */}
        <text x={leftX} y={pad.top - 20} textAnchor="middle" fill={cinematicTheme.colors.muted} fontSize={12} fontWeight={700} fontFamily={cinematicTheme.font.zh}>
          {startLabel}
        </text>
        <text x={rightX} y={pad.top - 20} textAnchor="middle" fill={cinematicTheme.colors.muted} fontSize={12} fontWeight={700} fontFamily={cinematicTheme.font.zh}>
          {endLabel}
        </text>

        {/* Vertical axes */}
        <line x1={leftX} x2={leftX} y1={pad.top} y2={pad.top + chartH} stroke="rgba(234,236,239,0.15)" strokeWidth={1.5} />
        <line x1={rightX} x2={rightX} y1={pad.top} y2={pad.top + chartH} stroke="rgba(234,236,239,0.15)" strokeWidth={1.5} />

        {/* Slope lines */}
        {items.map((item, i) => {
          const lineEnter = softSpring(frame, fps, delay + 14 + stagger(i, items.length, 28))
          const drawProgress = clampInterpolate(frame, [delay + 14 + stagger(i, items.length, 28), delay + 44 + stagger(i, items.length, 28)], [0, 1])
          const sy = mapY(item.start)
          const ey = mapY(item.end)

          // Color logic: green if improved, red if declined, gray if flat
          const diff = item.end - item.start
          const lineColor = item.color ?? (diff > 0 ? "#4ADE80" : diff < 0 ? "#F87171" : "rgba(234,236,239,0.5)")

          return (
            <g key={item.label} opacity={lineEnter}>
              {/* Connecting line */}
              <line
                x1={leftX}
                y1={sy}
                x2={leftX + (rightX - leftX) * drawProgress}
                y2={sy + (ey - sy) * drawProgress}
                stroke={lineColor}
                strokeWidth={2.5}
                strokeLinecap="round"
                filter={`url(#${glowId})`}
              />

              {/* Start dot and label */}
              <circle cx={leftX} cy={sy} r={5} fill={lineColor} opacity={lineEnter} />
              <text x={leftX - 12} y={sy + 4} textAnchor="end" fill={lineColor} fontSize={11} fontWeight={700} fontFamily={cinematicTheme.font.mono}>
                {item.start}
              </text>
              <text x={leftX - 12} y={sy + 18} textAnchor="end" fill="rgba(234,236,239,0.5)" fontSize={9} fontFamily={cinematicTheme.font.zh}>
                {item.label}
              </text>

              {/* End dot and label */}
              <circle cx={rightX} cy={ey} r={5} fill={lineColor} opacity={drawProgress} />
              <text x={rightX + 12} y={ey + 4} textAnchor="start" fill={lineColor} fontSize={11} fontWeight={700} fontFamily={cinematicTheme.font.mono} opacity={drawProgress}>
                {item.end}
              </text>
              <text x={rightX + 12} y={ey + 18} textAnchor="start" fill="rgba(234,236,239,0.5)" fontSize={9} fontFamily={cinematicTheme.font.zh} opacity={drawProgress}>
                {item.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── RadialBar ──────────────────────────────────────────────────────────────────

export interface RadialBarItem {
  label: string
  value: number
  color?: string
}

export interface RadialBarProps {
  items: RadialBarItem[]
  maxValue?: number
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  size?: number
}

export function RadialBar({
  items,
  maxValue,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  size = 320,
}: RadialBarProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const drift = loopSine(frame, 170, 0.8)

  const cx = size / 2
  const cy = size / 2
  const innerRadius = size * 0.15
  const outerRadius = size * 0.42
  const resolvedMax = maxValue ?? Math.max(...items.map((it) => it.value))

  const numItems = items.length
  const angleStep = (Math.PI * 2) / numItems
  const barAngleWidth = angleStep * 0.65
  const gapAngle = angleStep * 0.35

  const glowId = `radial-glow-${delay}-${tone}`

  // Reference circles
  const refLevels = [0.25, 0.5, 0.75, 1.0]

  /**
   * Create SVG arc path for a radial bar segment.
   */
  function arcPath(startAngle: number, endAngle: number, rInner: number, rOuter: number): string {
    const x1 = cx + rInner * Math.cos(startAngle)
    const y1 = cy + rInner * Math.sin(startAngle)
    const x2 = cx + rOuter * Math.cos(startAngle)
    const y2 = cy + rOuter * Math.sin(startAngle)
    const x3 = cx + rOuter * Math.cos(endAngle)
    const y3 = cy + rOuter * Math.sin(endAngle)
    const x4 = cx + rInner * Math.cos(endAngle)
    const y4 = cy + rInner * Math.sin(endAngle)

    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

    return [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `L ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `A ${rOuter.toFixed(2)} ${rOuter.toFixed(2)} 0 ${largeArc} 1 ${x3.toFixed(2)} ${y3.toFixed(2)}`,
      `L ${x4.toFixed(2)} ${y4.toFixed(2)}`,
      `A ${rInner.toFixed(2)} ${rInner.toFixed(2)} 0 ${largeArc} 0 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      "Z",
    ].join(" ")
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y + drift * 3}px, ${z - (1 - enter) * 260}px) rotateX(${38 - enter * 10}deg) rotateY(${-8 + enter * 6}deg)`,
        filter: `blur(${(1 - enter) * 8}px)`,
      }}
    >
      {/* Panel background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.02)), rgba(10,10,15,0.58)`,
          border: `1px solid ${accent}35`,
          boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 ${30 * (0.6 + loopSine(frame, 75) * 0.2)}px ${accent}28, inset 0 1px 0 rgba(255,255,255,0.12)`,
          backdropFilter: "blur(18px)",
        }}
      />

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Reference circles */}
        {refLevels.map((level, i) => {
          const r = innerRadius + (outerRadius - innerRadius) * level
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={cinematicTheme.colors.dim}
              strokeWidth={0.5}
              strokeDasharray="3 3"
              opacity={clampInterpolate(frame, [delay + 4, delay + 20], [0, 0.4])}
            />
          )
        })}

        {/* Center glow circle */}
        <circle
          cx={cx}
          cy={cy}
          r={innerRadius}
          fill={`${accent}10`}
          stroke={accent}
          strokeWidth={1}
          strokeOpacity={0.3 + loopSine(frame, 60) * 0.1}
          filter={`url(#${glowId})`}
        />

        {/* Radial bars */}
        {items.map((item, i) => {
          const barEnter = softSpring(frame, fps, delay + 12 + stagger(i, numItems, 32))
          const baseAngle = -Math.PI / 2 + i * angleStep + gapAngle / 2
          const endAngle = baseAngle + barAngleWidth

          const normalizedValue = Math.min(1, item.value / Math.max(1, resolvedMax))
          const barOuterRadius = innerRadius + (outerRadius - innerRadius) * normalizedValue * barEnter
          const color = item.color ?? accent

          // Label position at outer end
          const midAngle = (baseAngle + endAngle) / 2
          const labelR = barOuterRadius + 18
          const labelX = cx + labelR * Math.cos(midAngle)
          const labelY = cy + labelR * Math.sin(midAngle)

          // Value position at bar tip
          const valueR = barOuterRadius + 8
          const valueX = cx + valueR * Math.cos(midAngle)
          const valueY = cy + valueR * Math.sin(midAngle)

          return (
            <g key={item.label} opacity={barEnter}>
              {/* Bar arc */}
              <path
                d={arcPath(baseAngle, endAngle, innerRadius, barOuterRadius)}
                fill={`${color}99`}
                stroke={color}
                strokeWidth={1}
                strokeOpacity={0.8}
                filter={normalizedValue > 0.7 ? `url(#${glowId})` : undefined}
              />

              {/* Value label at tip */}
              <text
                x={valueX}
                y={valueY + 3}
                textAnchor="middle"
                fill={color}
                fontSize={9}
                fontWeight={700}
                fontFamily={cinematicTheme.font.mono}
                opacity={barEnter}
              >
                {item.value}
              </text>

              {/* Item label */}
              <text
                x={labelX}
                y={labelY + 4}
                textAnchor="middle"
                fill={cinematicTheme.colors.muted}
                fontSize={9}
                fontWeight={500}
                fontFamily={cinematicTheme.font.zh}
                opacity={barEnter * 0.8}
              >
                {item.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
