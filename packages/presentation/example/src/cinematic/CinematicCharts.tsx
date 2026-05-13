import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, formatCompactNumber, loopSine, softSpring, particleTrail } from "./motion"

export interface DataPoint {
  label: string
  value: number
}

export interface CinematicLineChartProps {
  data: DataPoint[]
  title: string
  subtitle?: string
  x?: number
  y?: number
  z?: number
  width?: number
  height?: number
  delay?: number
  tone?: CinematicTone
  area?: boolean
}

export function CinematicLineChart({
  data,
  title,
  subtitle,
  x = 0,
  y = 0,
  z = 0,
  width = 760,
  height = 420,
  delay = 0,
  tone = "gold",
  area = true,
}: CinematicLineChartProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const draw = clampInterpolate(frame, [delay + 12, delay + 78], [0, 1])
  const accent = toneColor(tone)
  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = 54
  const chartW = width - pad * 2
  const chartH = height - 128
  const points = data.map((d, i) => {
    const px = pad + (i / Math.max(1, data.length - 1)) * chartW
    const py = 86 + (1 - (d.value - min) / Math.max(1, max - min)) * chartH
    return { ...d, x: px, y: py }
  })
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")
  const areaPath = `${path} L ${points[points.length - 1]?.x ?? pad} ${86 + chartH} L ${pad} ${86 + chartH} Z`
  const drift = loopSine(frame, 180, 0.7)

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
        transform: `translate3d(${x}px, ${y + drift * 5}px, ${z - (1 - enter) * 380}px) rotateX(${58 - enter * 16}deg) rotateY(${-12 + enter * 9}deg)`,
        filter: `blur(${(1 - enter) * 12}px)`,
      }}
    >
      <PanelShell accent={accent}>
        <ChartHeader title={title} subtitle={subtitle} accent={accent} value={formatCompactNumber(max)} />
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            <linearGradient id={`line-area-${tone}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.34} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
            </linearGradient>
            <filter id={`line-glow-${tone}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g opacity={clampInterpolate(frame, [delay, delay + 26], [0, 1])}>
            {Array.from({ length: 6 }).map((_, i) => {
              const gy = 86 + (i / 5) * chartH
              return <line key={i} x1={pad} x2={pad + chartW} y1={gy} y2={gy} stroke="rgba(234,236,239,0.12)" strokeWidth={1} />
            })}
            {Array.from({ length: 8 }).map((_, i) => {
              const gx = pad + (i / 7) * chartW
              return <line key={i} x1={gx} x2={gx - 48} y1={86} y2={86 + chartH} stroke="rgba(214,179,106,0.08)" strokeWidth={1} />
            })}
          </g>
          {area && <path d={areaPath} fill={`url(#line-area-${tone})`} opacity={draw * 0.9} />}
          <path
            d={path}
            fill="none"
            stroke={accent}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - draw}
            filter={`url(#line-glow-${tone})`}
          />
          {points.map((p, i) => {
            const on = clampInterpolate(frame, [delay + 44 + i * 4, delay + 58 + i * 4], [0, 1])
            const pulse = 1 + loopSine(frame, 42, i) * 0.12
            const particles = on > 0.8 ? particleTrail(frame, 6, { spread: 28, speed: 0.8, decay: 0.9, phase: i * 3 }) : []
            return (
              <g key={p.label} opacity={on} transform={`translate(${p.x} ${p.y}) scale(${on * pulse})`}>
                {particles.map((pt, pi) => (
                  <circle key={pi} cx={pt.x} cy={pt.y} r={pt.size} fill={accent} opacity={pt.opacity * 0.7} />
                ))}
                <circle r={14} fill={accent} opacity={0.16} />
                <circle r={5.5} fill="#0B0B0F" stroke={accent} strokeWidth={2.5} />
                {i === points.length - 1 && <text x={18} y={4} fill={accent} fontSize={16} fontWeight={800}>{formatCompactNumber(p.value)}</text>}
              </g>
            )
          })}
          {points.map((p, i) => i % 2 === 0 && (
            <text key={`label-${p.label}`} x={p.x - 18} y={height - 32} fill="rgba(234,236,239,0.42)" fontSize={11} fontFamily={cinematicTheme.font.mono}>
              {p.label}
            </text>
          ))}
        </svg>
      </PanelShell>
    </div>
  )
}

export function CinematicBarChart({
  data,
  title,
  x = 0,
  y = 0,
  z = 0,
  width = 620,
  height = 360,
  delay = 0,
  tone = "purple",
}: CinematicLineChartProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const max = Math.max(...data.map((d) => d.value))
  const chartBottom = height - 62
  const barW = Math.min(62, (width - 120) / data.length - 16)

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
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 320}px) rotateX(${54 - enter * 15}deg) rotateY(${14 - enter * 10}deg)`,
        filter: `blur(${(1 - enter) * 10}px)`,
      }}
    >
      <PanelShell accent={accent}>
        <ChartHeader title={title} accent={accent} value={`${data.length} SECTORS`} />
        <div style={{ position: "absolute", left: 58, right: 58, bottom: 46, height: 1, background: "rgba(234,236,239,0.16)" }} />
        {data.map((d, i) => {
          const grow = softSpring(frame, fps, delay + 12 + i * 5, { damping: 22, stiffness: 92 })
          const h = (d.value / max) * (height - 150) * grow
          const left = 66 + i * ((width - 132) / data.length)
          const hue = i % 3 === 0 ? cinematicTheme.colors.gold : i % 3 === 1 ? accent : cinematicTheme.colors.magenta
          return (
            <div key={d.label} style={{ position: "absolute", left, bottom: 54, width: barW, height: Math.max(2, h), transformStyle: "preserve-3d" }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(180deg, ${hue}, rgba(255,255,255,0.08))`,
                  border: `1px solid ${hue}66`,
                  boxShadow: `0 0 26px ${hue}44, inset 0 1px 0 rgba(255,255,255,0.28)`,
                  transform: "translateZ(24px)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: barW,
                  top: 7,
                  width: 22,
                  height: Math.max(0, h - 7),
                  background: `linear-gradient(180deg, ${hue}55, rgba(0,0,0,0.25))`,
                  transform: "skewY(-32deg)",
                  transformOrigin: "left top",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: -11,
                  width: barW,
                  height: 22,
                  background: `linear-gradient(180deg, ${hue}CC, ${hue}88)`,
                  transform: "skewX(-32deg) translateX(11px)",
                  transformOrigin: "bottom left",
                  border: `1px solid ${hue}88`,
                }}
              />
              <div style={{ position: "absolute", left: -4, top: -28, fontSize: 13, fontWeight: 800, color: hue }}>{d.value}%</div>
              <div style={{ position: "absolute", left: -8, top: h + 12, width: 90, transform: "rotate(36deg)", transformOrigin: "left top", fontSize: 10, color: "rgba(234,236,239,0.46)", fontFamily: cinematicTheme.font.mono }}>{d.label}</div>
            </div>
          )
        })}
      </PanelShell>
    </div>
  )
}

export function PercentageRing({
  value,
  label,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "amber",
}: {
  value: number
  label: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const progress = clampInterpolate(frame, [delay + 8, delay + 70], [0, value])
  const accent = toneColor(tone)
  const size = 230
  const radius = 88
  const circumference = radius * 2 * Math.PI

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
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 250}px) rotateX(${24 - enter * 8}deg) rotateY(${-18 + enter * 9}deg)`,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(234,236,239,0.12)" strokeWidth={12} fill="rgba(10,10,15,0.36)" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={accent}
          strokeWidth={12}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 16px ${accent})` }}
        />
        {Array.from({ length: 8 }).map((_, i) => {
          const dotAngle = ((frame * (0.8 + progress / 100)) / 30 + (i / 8) * Math.PI * 2)
          const dotR = radius + 18
          const dx = size / 2 + Math.cos(dotAngle) * dotR
          const dy = size / 2 + Math.sin(dotAngle) * dotR
          const dotOpacity = 0.15 + (Math.sin(dotAngle * 2) + 1) * 0.2
          return (
            <circle key={i} cx={dx} cy={dy} r={2} fill={accent} opacity={dotOpacity * enter} />
          )
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 44, fontWeight: 900, color: accent, textShadow: `0 0 28px ${accent}66` }}>{Math.round(progress)}%</div>
        <div style={{ marginTop: 4, fontSize: 11, letterSpacing: 1.7, color: cinematicTheme.colors.muted }}>{label}</div>
      </div>
    </div>
  )
}

function PanelShell({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 26,
        background: `linear-gradient(145deg, rgba(255,255,255,0.105), rgba(255,255,255,0.026)),
          radial-gradient(circle at 28% 0%, ${accent}22, transparent 38%),
          rgba(12, 12, 18, 0.58)`,
        border: `1px solid ${accent}35`,
        boxShadow: `0 32px 100px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.16), 0 0 55px ${accent}18`,
        backdropFilter: "blur(22px) saturate(1.25)",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.026) 1px, transparent 1px)", backgroundSize: "4px 4px", opacity: 0.3 }} />
      {children}
    </div>
  )
}

function ChartHeader({ title, subtitle, accent, value }: { title: string; subtitle?: string; accent: string; value: string }) {
  return (
    <div style={{ position: "absolute", left: 34, right: 34, top: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", zIndex: 2 }}>
      <div>
        <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 24, fontWeight: 800, color: "#fff" }}>{title}</div>
        {subtitle && <div style={{ marginTop: 4, fontSize: 11, color: "rgba(234,236,239,0.48)", letterSpacing: 1.6 }}>{subtitle}</div>}
      </div>
      <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 13, color: accent, letterSpacing: 1.3 }}>{value}</div>
    </div>
  )
}

export interface CandlestickData {
  label: string
  open: number
  close: number
  high: number
  low: number
}

export function CandlestickChart({
  data,
  title,
  subtitle,
  x = 0,
  y = 0,
  z = 0,
  width = 680,
  height = 380,
  delay = 0,
  tone = "gold",
}: {
  data: CandlestickData[]
  title: string
  subtitle?: string
  x?: number
  y?: number
  z?: number
  width?: number
  height?: number
  delay?: number
  tone?: CinematicTone
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const drift = loopSine(frame, 180, 0.5)

  const allValues = data.flatMap((d) => [d.open, d.close, d.high, d.low])
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const range = Math.max(1, max - min)
  const pad = 60
  const chartW = width - pad * 2
  const chartH = height - 130
  const barWidth = Math.min(32, chartW / data.length - 8)

  const normalize = (v: number) => 90 + (1 - (v - min) / range) * chartH

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
        transform: `translate3d(${x}px, ${y + drift * 4}px, ${z - (1 - enter) * 340}px) rotateX(${54 - enter * 14}deg) rotateY(${-10 + enter * 7}deg)`,
        filter: `blur(${(1 - enter) * 10}px)`,
      }}
    >
      <PanelShell accent={accent}>
        <ChartHeader title={title} subtitle={subtitle} accent={accent} value={`${data.length} CANDLES`} />
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <filter id="candle-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Grid */}
          <g opacity={clampInterpolate(frame, [delay, delay + 20], [0, 0.6])}>
            {Array.from({ length: 5 }).map((_, i) => {
              const gy = 90 + (i / 4) * chartH
              return <line key={i} x1={pad} x2={pad + chartW} y1={gy} y2={gy} stroke="rgba(234,236,239,0.1)" strokeWidth={1} />
            })}
          </g>
          {/* Candles */}
          {data.map((d, i) => {
            const candleEnter = softSpring(frame, fps, delay + 10 + i * 4)
            const cx = pad + (i + 0.5) * (chartW / data.length)
            const bullish = d.close >= d.open
            const bodyTop = normalize(bullish ? d.close : d.open)
            const bodyBottom = normalize(bullish ? d.open : d.close)
            const bodyH = Math.max(2, bodyBottom - bodyTop)
            const wickTop = normalize(d.high)
            const wickBottom = normalize(d.low)
            const color = bullish ? accent : cinematicTheme.colors.magenta

            return (
              <g key={d.label} opacity={candleEnter}>
                <line
                  x1={cx} x2={cx} y1={wickTop} y2={wickBottom}
                  stroke={color} strokeWidth={1.5}
                  filter="url(#candle-glow)"
                  opacity={0.8}
                />
                <rect
                  x={cx - barWidth / 2} y={bodyTop}
                  width={barWidth} height={bodyH}
                  fill={bullish ? `${color}88` : `${color}55`}
                  stroke={color} strokeWidth={1.5}
                  rx={3}
                  filter="url(#candle-glow)"
                />
                {i % 2 === 0 && (
                  <text x={cx} y={height - 28} fill="rgba(234,236,239,0.4)" fontSize={10} textAnchor="middle" fontFamily={cinematicTheme.font.mono}>
                    {d.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </PanelShell>
    </div>
  )
}

