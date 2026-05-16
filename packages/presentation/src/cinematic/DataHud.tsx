import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, loopSine, softSpring } from "./motion"

export function KpiBlock({
  label,
  value,
  suffix = "",
  prefix = "",
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  label: string
  value: number
  suffix?: string
  prefix?: string
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
  const display = clampInterpolate(frame, [delay + 4, delay + 58], [0, value])
  const glow = 0.35 + Math.max(0, loopSine(frame, 52, delay) * 0.25)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 304,
        height: 132,
        marginLeft: -152,
        marginTop: -66,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 220}px) rotateX(${10 - enter * 5}deg) rotateY(${x > 0 ? -8 : 8}deg)`,
        borderRadius: 18,
        background: "linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), rgba(10,10,15,0.58)",
        border: `1px solid ${accent}40`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 ${38 * glow}px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.16)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        padding: "20px 22px",
      }}
    >
      {/* Scan line — triggers on value change animation */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: clampInterpolate((frame - delay) % 96, [0, 96], [-4, 140]),
          height: 2,
          background: `linear-gradient(90deg, transparent 5%, ${accent}60 30%, ${accent} 50%, ${accent}60 70%, transparent 95%)`,
          boxShadow: `0 0 12px ${accent}40`,
          opacity: 0.6,
          filter: "blur(0.5px)",
        }}
      />
      {/* Secondary faint scan */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: clampInterpolate((frame - delay + 48) % 96, [0, 96], [-4, 140]),
          height: 12,
          background: `linear-gradient(180deg, transparent, ${accent}10, transparent)`,
          opacity: 0.4,
        }}
      />
      <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 11, letterSpacing: 1.8, color: "rgba(234,236,239,0.46)" }}>{label}</div>
      <div style={{ marginTop: 12, fontSize: 42, fontWeight: 900, color: "#fff", letterSpacing: 0, textShadow: `0 0 26px ${accent}40` }}>
        <span style={{ color: accent }}>{prefix}</span>
        {display >= 100 ? display.toFixed(0) : display.toFixed(1)}
        <span style={{ color: accent, fontSize: 24, marginLeft: 4 }}>{suffix}</span>
      </div>
      <div style={{ marginTop: 8, height: 3, borderRadius: 3, background: "rgba(234,236,239,0.1)", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, (display / Math.max(1, value)) * 100)}%`, height: "100%", background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0.35))`, boxShadow: `0 0 16px ${accent}` }} />
      </div>
    </div>
  )
}

export function MarketTable({
  rows,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
}: {
  rows: Array<{ name: string; cap: string; cagr: string; risk: string; tone?: CinematicTone }>
  x?: number
  y?: number
  z?: number
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 680,
        marginLeft: -340,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 260}px) rotateX(48deg) rotateY(${-8 + enter * 4}deg)`,
        borderRadius: 20,
        background: "rgba(12,12,18,0.62)",
        border: "1px solid rgba(214,179,106,0.24)",
        boxShadow: "0 32px 90px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.12)",
        backdropFilter: "blur(20px)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr 1fr", padding: "16px 22px", fontFamily: cinematicTheme.font.mono, fontSize: 11, letterSpacing: 1.3, color: "rgba(234,236,239,0.4)", borderBottom: "1px solid rgba(234,236,239,0.09)" }}>
        <div>ASSET</div>
        <div>MARKET CAP</div>
        <div>CAGR</div>
        <div>RISK SIGNAL</div>
      </div>
      {rows.map((row, index) => {
        const reveal = softSpring(frame, fps, delay + 12 + index * 5)
        const accent = toneColor(row.tone ?? "gold")
        return (
          <div
            key={row.name}
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 0.8fr 1fr",
              padding: "15px 22px",
              alignItems: "center",
              opacity: reveal,
              transform: `translateX(${(1 - reveal) * -28}px)`,
              borderBottom: index === rows.length - 1 ? "none" : "1px solid rgba(234,236,239,0.07)",
              background: index % 2 === 0 ? "rgba(255,255,255,0.018)" : "transparent",
            }}
          >
            {/* Left accent sweep */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 2,
                background: `linear-gradient(180deg, transparent, ${accent}, transparent)`,
                opacity: reveal * 0.6,
                boxShadow: `0 0 8px ${accent}40`,
                transform: `scaleY(${reveal})`,
                transformOrigin: "top",
              }}
            />
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{row.name}</div>
            <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 14, color: "rgba(234,236,239,0.72)" }}>{row.cap}</div>
            <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 14, color: accent, textShadow: `0 0 16px ${accent}55` }}>{row.cagr}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, color: "rgba(234,236,239,0.62)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, boxShadow: `0 0 14px ${accent}` }} />
              {row.risk}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export interface TickerItem {
  symbol: string
  value: string
  change: string
  positive: boolean
}

export function RealtimeTicker({
  items,
  speed = 1.2,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
}: {
  items: TickerItem[]
  speed?: number
  x?: number
  y?: number
  z?: number
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const totalWidth = items.length * 200
  const offset = ((frame - delay) * speed) % totalWidth

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 900,
        height: 56,
        marginLeft: -450,
        marginTop: -28,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
        borderRadius: 12,
        background: "rgba(12, 12, 18, 0.6)",
        border: "1px solid rgba(214, 179, 106, 0.18)",
        backdropFilter: "blur(16px)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          transform: `translateX(${-offset}px)`,
          whiteSpace: "nowrap",
        }}
      >
        {[...items, ...items].map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 24px",
              borderRight: "1px solid rgba(234,236,239,0.08)",
              height: "100%",
            }}
          >
            <span style={{ fontFamily: cinematicTheme.font.mono, fontSize: 12, color: "rgba(234,236,239,0.6)", letterSpacing: 1 }}>
              {item.symbol}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
              {item.value}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: item.positive ? cinematicTheme.colors.gold : cinematicTheme.colors.magenta,
                textShadow: `0 0 8px ${item.positive ? cinematicTheme.colors.gold : cinematicTheme.colors.magenta}44`,
              }}
            >
              {item.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RankingList({
  items,
  title,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  items: Array<{ rank: number; name: string; value: string; tone?: CinematicTone }>
  title: string
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
  const maxValue = Math.max(...items.map((it) => parseFloat(it.value) || 0), 1)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 420,
        marginLeft: -210,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 200}px) rotateX(${12 - enter * 5}deg)`,
        borderRadius: 18,
        background: "rgba(12,12,18,0.6)",
        border: `1px solid ${accent}28`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.12)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "18px 20px 10px", fontFamily: cinematicTheme.font.zh, fontSize: 18, fontWeight: 800, color: "#fff", borderBottom: "1px solid rgba(234,236,239,0.08)" }}>
        {title}
      </div>
      {items.map((item, index) => {
        const rowEnter = softSpring(frame, fps, delay + 8 + index * 5)
        const itemAccent = toneColor(item.tone ?? tone)
        const barWidth = (parseFloat(item.value) || 0) / maxValue * 100

        return (
          <div
            key={item.rank}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 20px",
              gap: 14,
              opacity: rowEnter,
              transform: `translateX(${(1 - rowEnter) * -20}px)`,
              borderBottom: index === items.length - 1 ? "none" : "1px solid rgba(234,236,239,0.05)",
              position: "relative",
            }}
          >
            {/* Background bar */}
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${barWidth * rowEnter}%`, background: `linear-gradient(90deg, ${itemAccent}12, transparent)` }} />
            <div style={{ fontSize: 22, fontWeight: 900, color: itemAccent, width: 32, textAlign: "center", textShadow: `0 0 14px ${itemAccent}44` }}>
              {item.rank}
            </div>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#fff" }}>{item.name}</div>
            <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 13, color: itemAccent }}>{item.value}</div>
          </div>
        )
      })}
    </div>
  )
}

export function StatDashboard({
  metrics,
  columns = 3,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
}: {
  metrics: Array<{ label: string; value: number; suffix?: string; prefix?: string; tone?: CinematicTone }>
  columns?: number
  x?: number
  y?: number
  z?: number
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 180}px) rotateX(${8 - enter * 4}deg)`,
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 16,
        marginLeft: -(columns * 170) / 2,
      }}
    >
      {metrics.map((metric, i) => {
        const metricEnter = softSpring(frame, fps, delay + 4 + i * 4)
        const accent = toneColor(metric.tone ?? "gold")
        const display = clampInterpolate(frame, [delay + 6 + i * 4, delay + 52 + i * 4], [0, metric.value])

        return (
          <div
            key={metric.label}
            style={{
              width: 154,
              padding: "16px 14px",
              borderRadius: 14,
              background: "rgba(12,12,18,0.55)",
              border: `1px solid ${accent}30`,
              boxShadow: `0 14px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`,
              backdropFilter: "blur(14px)",
              opacity: metricEnter,
              transform: `translateY(${(1 - metricEnter) * 16}px)`,
            }}
          >
            <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 10, letterSpacing: 1.5, color: "rgba(234,236,239,0.44)" }}>{metric.label}</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: "#fff" }}>
              <span style={{ color: accent }}>{metric.prefix ?? ""}</span>
              {display >= 100 ? Math.round(display) : display.toFixed(1)}
              <span style={{ color: accent, fontSize: 16, marginLeft: 2 }}>{metric.suffix ?? ""}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
