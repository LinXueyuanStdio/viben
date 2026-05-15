import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, softSpring, stagger, loopSine, formatCompactNumber } from "./motion"

// ─── SwotMatrix ─────────────────────────────────────────────────────────────────

interface SwotData {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
}

export function SwotMatrix({
  data,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 560,
}: {
  data: SwotData
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const glow = 0.35 + Math.max(0, loopSine(frame, 64, delay) * 0.2)
  const halfW = width / 2
  const cellW = halfW - 12
  const height = width * 0.88

  const quadrants: Array<{
    key: keyof SwotData
    label: string
    shortLabel: string
    color: string
    items: string[]
    col: number
    row: number
  }> = [
    { key: "strengths", label: "Strengths", shortLabel: "S", color: "#4ADE80", items: data.strengths, col: 0, row: 0 },
    { key: "weaknesses", label: "Weaknesses", shortLabel: "W", color: "#F87171", items: data.weaknesses, col: 1, row: 0 },
    { key: "opportunities", label: "Opportunities", shortLabel: "O", color: "#60A5FA", items: data.opportunities, col: 0, row: 1 },
    { key: "threats", label: "Threats", shortLabel: "T", color: "#FBBF24", items: data.threats, col: 1, row: 1 },
  ]

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
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 280}px) rotateX(${8 - enter * 4}deg)`,
        borderRadius: 22,
        background: "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), rgba(10,10,15,0.52)",
        border: `1px solid ${accent}30`,
        boxShadow: `0 32px 80px rgba(0,0,0,0.48), 0 0 ${42 * glow}px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.14)`,
        backdropFilter: "blur(20px)",
        overflow: "hidden",
        padding: 16,
      }}
    >
      {/* Scan line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: clampInterpolate((frame - delay) % 120, [0, 120], [-4, height + 4]),
          height: 2,
          background: `linear-gradient(90deg, transparent 5%, ${accent}50 30%, ${accent} 50%, ${accent}50 70%, transparent 95%)`,
          opacity: 0.4,
          filter: "blur(0.5px)",
        }}
      />

      {/* Center SWOT label */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10,
          fontFamily: cinematicTheme.font.mono,
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: 4,
          color: accent,
          textShadow: `0 0 ${20 * glow}px ${accent}88, 0 0 48px ${accent}44`,
          background: "rgba(10,10,15,0.85)",
          padding: "6px 14px",
          borderRadius: 8,
          border: `1px solid ${accent}50`,
        }}
      >
        SWOT
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 8,
          width: "100%",
          height: "100%",
        }}
      >
        {quadrants.map((q, qi) => {
          const qDelay = delay + 8 + qi * 8
          const qEnter = softSpring(frame, fps, qDelay)

          return (
            <div
              key={q.key}
              style={{
                position: "relative",
                borderRadius: 14,
                background: `linear-gradient(145deg, ${q.color}0A, ${q.color}04), rgba(12,12,18,0.5)`,
                border: `1px solid ${q.color}30`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.2)`,
                backdropFilter: "blur(10px)",
                padding: "14px 16px",
                opacity: qEnter,
                transform: `scale(${0.92 + qEnter * 0.08})`,
                overflow: "hidden",
              }}
            >
              {/* Quadrant header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: `${q.color}22`,
                    border: `1px solid ${q.color}55`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 900,
                    color: q.color,
                    fontFamily: cinematicTheme.font.mono,
                    textShadow: `0 0 10px ${q.color}66`,
                  }}
                >
                  {q.shortLabel}
                </div>
                <span
                  style={{
                    fontFamily: cinematicTheme.font.en,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1.2,
                    color: q.color,
                    textTransform: "uppercase",
                  }}
                >
                  {q.label}
                </span>
              </div>

              {/* Bullet items */}
              {q.items.map((item, ii) => {
                const itemDelay = qDelay + 6 + stagger(ii, q.items.length, 20)
                const itemEnter = softSpring(frame, fps, itemDelay)

                return (
                  <div
                    key={ii}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      marginBottom: 6,
                      opacity: itemEnter,
                      transform: `translateX(${(1 - itemEnter) * -12}px)`,
                    }}
                  >
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: q.color,
                        boxShadow: `0 0 8px ${q.color}55`,
                        marginTop: 5,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: cinematicTheme.font.zh,
                        fontSize: 12,
                        lineHeight: 1.4,
                        color: "rgba(234,236,239,0.78)",
                      }}
                    >
                      {item}
                    </span>
                  </div>
                )
              })}

              {/* Corner glow */}
              <div
                style={{
                  position: "absolute",
                  top: q.row === 0 ? -20 : "auto",
                  bottom: q.row === 1 ? -20 : "auto",
                  left: q.col === 0 ? -20 : "auto",
                  right: q.col === 1 ? -20 : "auto",
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${q.color}18 0%, transparent 70%)`,
                  filter: "blur(12px)",
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── MetricDashboard ────────────────────────────────────────────────────────────

interface MetricItem {
  label: string
  value: number
  unit?: string
  trend?: "up" | "down" | "flat"
  sparkData?: number[]
}

export function MetricDashboard({
  metrics,
  title,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  columns = 3,
}: {
  metrics: MetricItem[]
  title?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  columns?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const glow = 0.3 + Math.max(0, loopSine(frame, 58, delay) * 0.2)
  const cardW = 180
  const gap = 14
  const totalW = columns * cardW + (columns - 1) * gap + 40
  const rows = Math.ceil(metrics.length / columns)
  const totalH = (title ? 52 : 0) + rows * 130 + (rows - 1) * gap + 40

  // Scan animation for title bar
  const scanX = clampInterpolate((frame - delay) % 90, [0, 90], [0, totalW])

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: totalW,
        height: totalH,
        marginLeft: -totalW / 2,
        marginTop: -totalH / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 260}px) rotateX(${6 - enter * 3}deg)`,
        borderRadius: 20,
        background: "linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.02)), rgba(10,10,15,0.55)",
        border: `1px solid ${accent}30`,
        boxShadow: `0 28px 72px rgba(0,0,0,0.45), 0 0 ${36 * glow}px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.14)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        padding: 20,
      }}
    >
      {/* Title bar */}
      {title && (
        <div
          style={{
            position: "relative",
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: "1px solid rgba(234,236,239,0.08)",
          }}
        >
          <div
            style={{
              fontFamily: cinematicTheme.font.zh,
              fontSize: 16,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: 0.5,
            }}
          >
            {title}
          </div>
          {/* Scan sweep */}
          <div
            style={{
              position: "absolute",
              left: scanX,
              bottom: 0,
              width: 60,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              boxShadow: `0 0 8px ${accent}55`,
            }}
          />
        </div>
      )}

      {/* Metric cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap,
        }}
      >
        {metrics.map((metric, i) => {
          const cardDelay = delay + 6 + stagger(i, metrics.length, 28)
          const cardEnter = softSpring(frame, fps, cardDelay)
          const displayVal = clampInterpolate(frame, [cardDelay + 4, cardDelay + 50], [0, metric.value])
          const trendGlow = 0.5 + loopSine(frame, 44, i * 7) * 0.3

          // Sparkline path
          let sparkPath = ""
          if (metric.sparkData && metric.sparkData.length > 1) {
            const sparkW = cardW - 32
            const sparkH = 28
            const sparkMin = Math.min(...metric.sparkData)
            const sparkMax = Math.max(...metric.sparkData)
            const sparkRange = Math.max(1, sparkMax - sparkMin)
            sparkPath = metric.sparkData
              .map((v, si) => {
                const sx = (si / (metric.sparkData!.length - 1)) * sparkW
                const sy = sparkH - ((v - sparkMin) / sparkRange) * sparkH
                return `${si === 0 ? "M" : "L"} ${sx.toFixed(1)} ${sy.toFixed(1)}`
              })
              .join(" ")
          }

          const trendColor =
            metric.trend === "up" ? "#4ADE80" : metric.trend === "down" ? "#F87171" : "rgba(234,236,239,0.5)"
          const trendArrow = metric.trend === "up" ? "\u2191" : metric.trend === "down" ? "\u2193" : "\u2192"

          return (
            <div
              key={metric.label}
              style={{
                position: "relative",
                padding: "16px 16px 12px",
                borderRadius: 14,
                background: "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01)), rgba(12,12,18,0.5)",
                border: `1px solid ${accent}25`,
                boxShadow: `0 12px 36px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.1)`,
                backdropFilter: "blur(12px)",
                opacity: cardEnter,
                transform: `translateY(${(1 - cardEnter) * 18}px) scale(${0.94 + cardEnter * 0.06})`,
                overflow: "hidden",
              }}
            >
              {/* Label */}
              <div
                style={{
                  fontFamily: cinematicTheme.font.mono,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  color: "rgba(234,236,239,0.44)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                }}
              >
                {metric.label}
              </div>

              {/* Value + trend */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: "#fff",
                    fontFamily: cinematicTheme.font.en,
                    textShadow: `0 0 18px ${accent}30`,
                  }}
                >
                  {displayVal >= 1000 ? formatCompactNumber(displayVal) : displayVal >= 100 ? Math.round(displayVal).toString() : displayVal.toFixed(1)}
                </span>
                {metric.unit && (
                  <span style={{ fontSize: 13, color: accent, fontWeight: 700 }}>{metric.unit}</span>
                )}
                {metric.trend && (
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: trendColor,
                      textShadow: `0 0 ${12 * trendGlow}px ${trendColor}88`,
                      marginLeft: 4,
                    }}
                  >
                    {trendArrow}
                  </span>
                )}
              </div>

              {/* Sparkline */}
              {sparkPath && (
                <svg
                  width={cardW - 32}
                  height={28}
                  style={{ marginTop: 10, overflow: "visible" }}
                  viewBox={`0 0 ${cardW - 32} 28`}
                >
                  <defs>
                    <linearGradient id={`spark-grad-${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={accent} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={accent} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <path
                    d={sparkPath}
                    fill="none"
                    stroke={`url(#spark-grad-${i})`}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={1 - clampInterpolate(frame, [cardDelay + 10, cardDelay + 48], [0, 1])}
                  />
                </svg>
              )}

              {/* Card scan accent */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: `linear-gradient(180deg, transparent, ${accent}60, transparent)`,
                  opacity: cardEnter * 0.6,
                  boxShadow: `0 0 6px ${accent}30`,
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── BeforeAfterSlider ──────────────────────────────────────────────────────────

interface BeforeAfterState {
  label: string
  value: number
  items?: string[]
}

export function BeforeAfterSlider({
  before,
  after,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 520,
}: {
  before: BeforeAfterState
  after: BeforeAfterState
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const glow = 0.35 + Math.max(0, loopSine(frame, 56, delay) * 0.22)
  const height = 320

  // Divider animation: slides from left to center position
  const dividerProgress = clampInterpolate(frame, [delay + 14, delay + 52], [0, 1], cinematicTheme.easing.cinematic)

  // Value counters
  const beforeDisplay = clampInterpolate(frame, [delay + 8, delay + 54], [0, before.value])
  const afterDisplay = clampInterpolate(frame, [delay + 20, delay + 66], [0, after.value])

  // Delta
  const delta = after.value - before.value
  const deltaPercent = before.value !== 0 ? Math.round((delta / before.value) * 100) : 0
  const deltaPositive = delta >= 0

  // Divider X position
  const dividerX = dividerProgress * (width / 2)

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
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 240}px) rotateX(${6 - enter * 3}deg)`,
        borderRadius: 20,
        background: "linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.02)), rgba(10,10,15,0.56)",
        border: `1px solid ${accent}30`,
        boxShadow: `0 28px 72px rgba(0,0,0,0.46), 0 0 ${38 * glow}px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.14)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      {/* Before side (left) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: width / 2,
          height: "100%",
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          clipPath: `inset(0 ${width / 2 - dividerX}px 0 0)`,
        }}
      >
        {/* Before label */}
        <div
          style={{
            fontFamily: cinematicTheme.font.mono,
            fontSize: 10,
            letterSpacing: 2,
            color: "rgba(234,236,239,0.4)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          BEFORE
        </div>
        <div
          style={{
            fontFamily: cinematicTheme.font.zh,
            fontSize: 14,
            fontWeight: 700,
            color: cinematicTheme.colors.dim,
            marginBottom: 12,
          }}
        >
          {before.label}
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 900,
            color: "rgba(234,236,239,0.5)",
            fontFamily: cinematicTheme.font.en,
          }}
        >
          {beforeDisplay >= 1000 ? formatCompactNumber(beforeDisplay) : Math.round(beforeDisplay).toString()}
        </div>

        {/* Before items */}
        {before.items && (
          <div style={{ marginTop: 16, flex: 1 }}>
            {before.items.map((item, ii) => {
              const itemEnter = softSpring(frame, fps, delay + 18 + ii * 5)
              return (
                <div
                  key={ii}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    opacity: itemEnter * 0.6,
                    transform: `translateX(${(1 - itemEnter) * -10}px)`,
                  }}
                >
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(234,236,239,0.3)" }} />
                  <span style={{ fontFamily: cinematicTheme.font.zh, fontSize: 12, color: "rgba(234,236,239,0.45)" }}>
                    {item}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* After side (right) */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: width / 2,
          height: "100%",
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          clipPath: `inset(0 0 0 ${width / 2 - dividerX}px)`,
        }}
      >
        {/* After label */}
        <div
          style={{
            fontFamily: cinematicTheme.font.mono,
            fontSize: 10,
            letterSpacing: 2,
            color: accent,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          AFTER
        </div>
        <div
          style={{
            fontFamily: cinematicTheme.font.zh,
            fontSize: 14,
            fontWeight: 700,
            color: "rgba(234,236,239,0.85)",
            marginBottom: 12,
          }}
        >
          {after.label}
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 900,
            color: "#fff",
            fontFamily: cinematicTheme.font.en,
            textShadow: `0 0 22px ${accent}40`,
          }}
        >
          {afterDisplay >= 1000 ? formatCompactNumber(afterDisplay) : Math.round(afterDisplay).toString()}
        </div>

        {/* After items */}
        {after.items && (
          <div style={{ marginTop: 16, flex: 1 }}>
            {after.items.map((item, ii) => {
              const itemEnter = softSpring(frame, fps, delay + 28 + ii * 5)
              return (
                <div
                  key={ii}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    opacity: itemEnter,
                    transform: `translateX(${(1 - itemEnter) * 12}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: accent,
                      boxShadow: `0 0 6px ${accent}55`,
                    }}
                  />
                  <span style={{ fontFamily: cinematicTheme.font.zh, fontSize: 12, color: "rgba(234,236,239,0.82)" }}>
                    {item}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Animated divider line */}
      <div
        style={{
          position: "absolute",
          left: dividerX - 1,
          top: 0,
          width: 2,
          height: "100%",
          background: `linear-gradient(180deg, transparent 5%, ${accent} 30%, ${accent} 70%, transparent 95%)`,
          boxShadow: `0 0 ${16 * glow}px ${accent}66, 0 0 40px ${accent}22`,
          opacity: dividerProgress,
        }}
      />

      {/* Delta indicator (center) */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10,
          opacity: clampInterpolate(frame, [delay + 38, delay + 52], [0, 1]),
        }}
      >
        <div
          style={{
            background: "rgba(10,10,15,0.9)",
            border: `1px solid ${accent}60`,
            borderRadius: 10,
            padding: "8px 14px",
            textAlign: "center",
            boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 ${18 * glow}px ${accent}33`,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: deltaPositive ? "#4ADE80" : "#F87171",
              fontFamily: cinematicTheme.font.mono,
              textShadow: `0 0 12px ${deltaPositive ? "#4ADE80" : "#F87171"}55`,
            }}
          >
            {deltaPositive ? "+" : ""}{deltaPercent}%
          </div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 1.2,
              color: "rgba(234,236,239,0.5)",
              marginTop: 2,
              fontFamily: cinematicTheme.font.mono,
            }}
          >
            DELTA
          </div>
        </div>
      </div>

      {/* Bottom gradient fade overlay */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 40,
          background: "linear-gradient(180deg, transparent, rgba(10,10,15,0.4))",
          pointerEvents: "none",
        }}
      />
    </div>
  )
}

// ─── Scorecard ──────────────────────────────────────────────────────────────────

interface ScorecardCategory {
  label: string
  score: number
  maxScore?: number
  color?: string
}

export function Scorecard({
  categories,
  title,
  overallScore,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 400,
}: {
  categories: ScorecardCategory[]
  title?: string
  overallScore?: number
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const glow = 0.35 + Math.max(0, loopSine(frame, 52, delay) * 0.2)

  // Overall score animation
  const overallDisplay = overallScore != null
    ? clampInterpolate(frame, [delay + 6, delay + 56], [0, overallScore])
    : null
  const overallMax = 100

  // Progress ring dimensions
  const ringSize = 72
  const ringStroke = 6
  const ringRadius = (ringSize - ringStroke) / 2
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringProgress = overallDisplay != null
    ? clampInterpolate(frame, [delay + 10, delay + 60], [0, overallDisplay / overallMax])
    : 0

  // Overall ring color
  const overallColor = overallDisplay != null
    ? overallDisplay > 80 ? "#4ADE80" : overallDisplay > 50 ? "#FBBF24" : "#F87171"
    : accent

  const height = (title || overallScore != null ? 110 : 20) + categories.length * 48 + 28

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
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 240}px) rotateX(${8 - enter * 4}deg)`,
        borderRadius: 20,
        background: "linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02)), rgba(10,10,15,0.58)",
        border: `1px solid ${accent}30`,
        boxShadow: `0 28px 72px rgba(0,0,0,0.46), 0 0 ${38 * glow}px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.15)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        padding: "22px 24px",
      }}
    >
      {/* Scan line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: clampInterpolate((frame - delay) % 110, [0, 110], [-4, height + 4]),
          height: 2,
          background: `linear-gradient(90deg, transparent 5%, ${accent}50 30%, ${accent} 50%, ${accent}50 70%, transparent 95%)`,
          opacity: 0.35,
          filter: "blur(0.5px)",
        }}
      />

      {/* Header with overall score */}
      {(title || overallScore != null) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: "1px solid rgba(234,236,239,0.08)",
          }}
        >
          {/* Circular progress ring */}
          {overallScore != null && (
            <div style={{ position: "relative", width: ringSize, height: ringSize, flexShrink: 0 }}>
              <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
                {/* Background ring */}
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  fill="none"
                  stroke="rgba(234,236,239,0.1)"
                  strokeWidth={ringStroke}
                />
                {/* Progress ring */}
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  fill="none"
                  stroke={overallColor}
                  strokeWidth={ringStroke}
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringCircumference * (1 - ringProgress)}
                  style={{
                    filter: `drop-shadow(0 0 ${8 * glow}px ${overallColor}88)`,
                    transition: "stroke 0.3s",
                  }}
                />
              </svg>
              {/* Center score number */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 900,
                  color: "#fff",
                  fontFamily: cinematicTheme.font.en,
                  textShadow: `0 0 14px ${overallColor}44`,
                }}
              >
                {Math.round(overallDisplay ?? 0)}
              </div>
            </div>
          )}

          {/* Title area */}
          <div>
            {title && (
              <div
                style={{
                  fontFamily: cinematicTheme.font.zh,
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                {title}
              </div>
            )}
            {overallScore != null && (
              <div
                style={{
                  marginTop: 4,
                  fontFamily: cinematicTheme.font.mono,
                  fontSize: 10,
                  letterSpacing: 1.4,
                  color: "rgba(234,236,239,0.44)",
                }}
              >
                OVERALL SCORE
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {categories.map((cat, i) => {
          const catDelay = delay + 12 + stagger(i, categories.length, 24)
          const catEnter = softSpring(frame, fps, catDelay)
          const maxScore = cat.maxScore ?? 100
          const ratio = cat.score / maxScore
          const barWidth = clampInterpolate(frame, [catDelay + 4, catDelay + 40], [0, ratio * 100])

          // Color-coded by performance level
          const barColor = cat.color
            ? cat.color
            : ratio > 0.8 ? "#4ADE80" : ratio > 0.5 ? "#FBBF24" : "#F87171"

          return (
            <div
              key={cat.label}
              style={{
                opacity: catEnter,
                transform: `translateX(${(1 - catEnter) * -16}px)`,
              }}
            >
              {/* Label + score */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 5,
                }}
              >
                <span
                  style={{
                    fontFamily: cinematicTheme.font.zh,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(234,236,239,0.8)",
                  }}
                >
                  {cat.label}
                </span>
                <span
                  style={{
                    fontFamily: cinematicTheme.font.mono,
                    fontSize: 12,
                    fontWeight: 700,
                    color: barColor,
                    textShadow: `0 0 8px ${barColor}44`,
                  }}
                >
                  {Math.round(clampInterpolate(frame, [catDelay + 4, catDelay + 40], [0, cat.score]))}
                  <span style={{ color: "rgba(234,236,239,0.3)", fontSize: 10 }}>/{maxScore}</span>
                </span>
              </div>

              {/* Bar track */}
              <div
                style={{
                  position: "relative",
                  height: 8,
                  borderRadius: 4,
                  background: "rgba(234,236,239,0.08)",
                  overflow: "hidden",
                }}
              >
                {/* Filled bar */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${barWidth}%`,
                    borderRadius: 4,
                    background: `linear-gradient(90deg, ${barColor}CC, ${barColor})`,
                    boxShadow: `0 0 12px ${barColor}44, inset 0 1px 0 rgba(255,255,255,0.2)`,
                  }}
                />
                {/* Bar end glow */}
                <div
                  style={{
                    position: "absolute",
                    left: `${barWidth}%`,
                    top: -2,
                    bottom: -2,
                    width: 6,
                    marginLeft: -3,
                    borderRadius: 3,
                    background: barColor,
                    boxShadow: `0 0 ${10 * glow}px ${barColor}88`,
                    opacity: catEnter * 0.8,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
