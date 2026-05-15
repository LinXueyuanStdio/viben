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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute catmull-rom spline control points for a series of data values mapped to x/y */
function catmullRomPath(
  points: Array<{ x: number; y: number }>,
  tension = 0.35,
): string {
  if (points.length < 2) return ""
  const d: string[] = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 3
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 3
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 3
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 3
    d.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`)
  }
  return d.join(" ")
}

// ---------------------------------------------------------------------------
// 1. JourneyMap
// ---------------------------------------------------------------------------

export interface JourneyMapStage {
  label: string
  emotion: number // -1 to 1
  touchpoints?: string[]
  pain?: string
}

export interface JourneyMapProps {
  stages: JourneyMapStage[]
  title?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function JourneyMap({
  stages,
  title,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 700,
  height = 340,
}: JourneyMapProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const count = stages.length

  // Layout constants
  const padX = 56
  const padTop = 68
  const padBottom = 80
  const chartW = width - padX * 2
  const chartH = height - padTop - padBottom
  const midY = padTop + chartH / 2

  // Map stages to curve points
  const curvePoints = stages.map((s, i) => ({
    x: padX + (i / Math.max(1, count - 1)) * chartW,
    y: midY - s.emotion * (chartH / 2) * 0.85,
  }))

  // Animate draw progress
  const drawProgress = clampInterpolate(frame, [delay + 14, delay + 14 + count * 14], [0, 1])

  // SVG path for emotion curve
  const fullPath = catmullRomPath(curvePoints)

  const drift = loopSine(frame, 200, 0.3) * 3

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
        transform: `translate3d(${x}px, ${y + drift}px, ${z - (1 - enter) * 200}px)`,
        borderRadius: 20,
        background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), ${cinematicTheme.colors.glass}`,
        border: `1px solid ${accent}40`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 ${28 * (0.7 + loopSine(frame, 120) * 0.3)}px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.16)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      {/* Title */}
      {title && (
        <div
          style={{
            position: "absolute",
            left: 24,
            top: 18,
            fontFamily: cinematicTheme.font.mono,
            fontSize: 10,
            letterSpacing: 2.2,
            color: accent,
            opacity: enter,
          }}
        >
          {title.toUpperCase()}
        </div>
      )}

      {/* Stage labels at top */}
      {stages.map((stage, i) => {
        const stageEnter = softSpring(frame, fps, delay + 8 + stagger(i, count, 30))
        const sx = padX + (i / Math.max(1, count - 1)) * chartW
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: sx,
              top: padTop - 24,
              transform: `translateX(-50%) translateY(${(1 - stageEnter) * 12}px)`,
              opacity: stageEnter,
              fontFamily: cinematicTheme.font.zh,
              fontSize: 11,
              fontWeight: 700,
              color: cinematicTheme.colors.coldWhite,
              whiteSpace: "nowrap",
            }}
          >
            {stage.label}
          </div>
        )
      })}

      {/* SVG layer: grid, curve, markers */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          <linearGradient id={`journey-grad-${tone}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity={0.8} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.4} />
          </linearGradient>
          <filter id="journey-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal neutral baseline */}
        <line
          x1={padX}
          y1={midY}
          x2={padX + chartW}
          y2={midY}
          stroke="rgba(234,236,239,0.12)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Vertical stage separators */}
        {stages.map((_, i) => {
          if (i === 0) return null
          const sx = padX + (i / Math.max(1, count - 1)) * chartW
          const stageEnter = softSpring(frame, fps, delay + 8 + stagger(i, count, 30))
          return (
            <line
              key={i}
              x1={sx}
              y1={padTop - 8}
              x2={sx}
              y2={height - padBottom + 8}
              stroke="rgba(234,236,239,0.1)"
              strokeWidth={1}
              strokeDasharray="3 5"
              opacity={stageEnter}
            />
          )
        })}

        {/* Emotion curve */}
        <path
          d={fullPath}
          fill="none"
          stroke={`url(#journey-grad-${tone})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - drawProgress}
          filter="url(#journey-glow)"
        />

        {/* Data point markers */}
        {curvePoints.map((pt, i) => {
          const ptProgress = clampInterpolate(
            frame,
            [delay + 14 + (i / Math.max(1, count - 1)) * count * 14, delay + 14 + (i / Math.max(1, count - 1)) * count * 14 + 8],
            [0, 1],
          )
          const isPain = !!stages[i].pain
          const markerColor = isPain ? cinematicTheme.colors.magenta : accent
          return (
            <g key={i} opacity={ptProgress}>
              <circle cx={pt.x} cy={pt.y} r={6} fill="none" stroke={markerColor} strokeWidth={1.5} opacity={0.6} />
              <circle cx={pt.x} cy={pt.y} r={3} fill={markerColor} />
              {isPain && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={10 + loopSine(frame, 60, i) * 3}
                  fill="none"
                  stroke={cinematicTheme.colors.magenta}
                  strokeWidth={1}
                  opacity={0.4 * ptProgress}
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* Touchpoints below curve */}
      {stages.map((stage, i) => {
        if (!stage.touchpoints?.length && !stage.pain) return null
        const stageEnter = softSpring(frame, fps, delay + 20 + stagger(i, count, 30))
        const sx = padX + (i / Math.max(1, count - 1)) * chartW
        return (
          <div
            key={`tp-${i}`}
            style={{
              position: "absolute",
              left: sx,
              bottom: padBottom - 50,
              transform: "translateX(-50%)",
              opacity: stageEnter,
              maxWidth: chartW / count - 8,
              textAlign: "center",
            }}
          >
            {stage.touchpoints?.map((tp, j) => (
              <div
                key={j}
                style={{
                  fontSize: 9,
                  lineHeight: 1.5,
                  color: cinematicTheme.colors.dim,
                  fontFamily: cinematicTheme.font.zh,
                }}
              >
                {tp}
              </div>
            ))}
            {stage.pain && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 9,
                  color: cinematicTheme.colors.magenta,
                  fontFamily: cinematicTheme.font.zh,
                  textShadow: `0 0 8px ${cinematicTheme.colors.magenta}66`,
                }}
              >
                {stage.pain}
              </div>
            )}
          </div>
        )
      })}

      {/* Emotion labels */}
      <div style={{ position: "absolute", left: 10, top: padTop + 2, fontSize: 8, color: "rgba(234,236,239,0.3)", fontFamily: cinematicTheme.font.mono }}>+1</div>
      <div style={{ position: "absolute", left: 10, top: midY - 4, fontSize: 8, color: "rgba(234,236,239,0.3)", fontFamily: cinematicTheme.font.mono }}>0</div>
      <div style={{ position: "absolute", left: 10, bottom: padBottom + 2, fontSize: 8, color: "rgba(234,236,239,0.3)", fontFamily: cinematicTheme.font.mono }}>-1</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. PersonaCard
// ---------------------------------------------------------------------------

export interface PersonaCardProps {
  name: string
  role: string
  age?: number
  goals: string[]
  frustrations: string[]
  traits?: Array<{ label: string; value: number }>
  avatar?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
}

export function PersonaCard({
  name,
  role,
  age,
  goals,
  frustrations,
  traits,
  avatar,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "purple",
  width = 380,
}: PersonaCardProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)

  // Avatar: emoji or first letter
  const avatarDisplay = avatar || name.charAt(0).toUpperCase()
  const isEmoji = avatar && /\p{Emoji}/u.test(avatar)

  const drift = loopSine(frame, 180, 1.2) * 3
  const ringPulse = 0.7 + loopSine(frame, 80, 0) * 0.3

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        marginLeft: -width / 2,
        marginTop: -240,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y + (1 - enter) * 40 + drift}px, ${z - (1 - enter) * 200}px)`,
        borderRadius: 20,
        background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), ${cinematicTheme.colors.glass}`,
        border: `1px solid ${accent}40`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 30px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.16)`,
        backdropFilter: "blur(18px)",
        padding: "28px 24px",
      }}
    >
      {/* Header: avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Avatar circle */}
        <div
          style={{
            position: "relative",
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${accent}30, ${accent}10)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: isEmoji ? 28 : 24,
            fontWeight: 800,
            color: accent,
            fontFamily: isEmoji ? undefined : cinematicTheme.font.en,
            flexShrink: 0,
          }}
        >
          {avatarDisplay}
          {/* Pulsing ring */}
          <div
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: "50%",
              border: `2px solid ${accent}`,
              opacity: ringPulse * 0.5,
              boxShadow: `0 0 12px ${accent}44`,
            }}
          />
        </div>
        <div>
          <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 20, fontWeight: 800, color: "#fff" }}>{name}</div>
          <div style={{ marginTop: 3, fontSize: 12, color: cinematicTheme.colors.muted, fontFamily: cinematicTheme.font.zh }}>
            {role}
            {age != null && <span style={{ marginLeft: 8, color: cinematicTheme.colors.dim }}>{age}</span>}
          </div>
        </div>
      </div>

      {/* Goals */}
      <div style={{ marginTop: 22 }}>
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 9, letterSpacing: 1.8, color: "#4ade80", marginBottom: 8 }}>GOALS</div>
        {goals.map((goal, i) => {
          const itemEnter = softSpring(frame, fps, delay + 12 + stagger(i, goals.length, 16))
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 5,
                opacity: itemEnter,
                transform: `translateX(${(1 - itemEnter) * 12}px)`,
              }}
            >
              <span style={{ color: "#4ade80", fontSize: 10, marginTop: 2 }}>&#9679;</span>
              <span style={{ fontSize: 12, lineHeight: 1.5, color: "rgba(234,236,239,0.78)", fontFamily: cinematicTheme.font.zh }}>{goal}</span>
            </div>
          )
        })}
      </div>

      {/* Frustrations */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 9, letterSpacing: 1.8, color: cinematicTheme.colors.magenta, marginBottom: 8 }}>FRUSTRATIONS</div>
        {frustrations.map((fr, i) => {
          const itemEnter = softSpring(frame, fps, delay + 18 + stagger(i, frustrations.length, 16))
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 5,
                opacity: itemEnter,
                transform: `translateX(${(1 - itemEnter) * 12}px)`,
              }}
            >
              <span style={{ color: cinematicTheme.colors.magenta, fontSize: 10, marginTop: 2 }}>&#9679;</span>
              <span style={{ fontSize: 12, lineHeight: 1.5, color: "rgba(234,236,239,0.78)", fontFamily: cinematicTheme.font.zh }}>{fr}</span>
            </div>
          )
        })}
      </div>

      {/* Traits */}
      {traits && traits.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 9, letterSpacing: 1.8, color: cinematicTheme.colors.dim, marginBottom: 10 }}>TRAITS</div>
          {traits.map((trait, i) => {
            const barEnter = softSpring(frame, fps, delay + 24 + stagger(i, traits.length, 20))
            const barWidth = trait.value * barEnter
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: "rgba(234,236,239,0.6)", fontFamily: cinematicTheme.font.zh }}>{trait.label}</span>
                  <span style={{ fontSize: 10, color: accent, fontFamily: cinematicTheme.font.mono }}>{Math.round(barWidth)}%</span>
                </div>
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: "rgba(234,236,239,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${barWidth}%`,
                      height: "100%",
                      borderRadius: 2,
                      background: `linear-gradient(90deg, ${accent}88, ${accent})`,
                      boxShadow: `0 0 8px ${accent}44`,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. FeatureMatrix
// ---------------------------------------------------------------------------

export interface FeatureMatrixFeature {
  name: string
  values: ("yes" | "no" | "partial" | string)[]
}

export interface FeatureMatrixProps {
  products: string[]
  features: FeatureMatrixFeature[]
  highlight?: number
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
}

function CellIcon({ value }: { value: "yes" | "no" | "partial" | string }) {
  if (value === "yes") {
    return (
      <svg width={16} height={16} viewBox="0 0 16 16">
        <circle cx={8} cy={8} r={7} fill="none" stroke="#4ade80" strokeWidth={1.5} opacity={0.6} />
        <path d="M 4.5 8.2 L 7 10.5 L 11.5 5.5" fill="none" stroke="#4ade80" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (value === "no") {
    return (
      <svg width={16} height={16} viewBox="0 0 16 16">
        <circle cx={8} cy={8} r={7} fill="none" stroke="#f87171" strokeWidth={1.5} opacity={0.6} />
        <path d="M 5.5 5.5 L 10.5 10.5 M 10.5 5.5 L 5.5 10.5" fill="none" stroke="#f87171" strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    )
  }
  if (value === "partial") {
    return (
      <svg width={16} height={16} viewBox="0 0 16 16">
        <circle cx={8} cy={8} r={7} fill="none" stroke="#fbbf24" strokeWidth={1.5} opacity={0.6} />
        <path d="M 8 8 L 8 3 A 5 5 0 0 1 8 13 Z" fill="#fbbf24" opacity={0.5} />
      </svg>
    )
  }
  // String text value
  return null
}

export function FeatureMatrix({
  products,
  features,
  highlight,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 560,
}: FeatureMatrixProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)

  const colCount = products.length
  const rowCount = features.length
  const nameColW = 140
  const cellW = (width - nameColW - 48) / colCount
  const rowH = 36
  const headerH = 44
  const totalH = headerH + rowCount * rowH + 36

  const drift = loopSine(frame, 190, 0.5) * 2.5

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height: totalH,
        marginLeft: -width / 2,
        marginTop: -totalH / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y + drift}px, ${z - (1 - enter) * 200}px)`,
        borderRadius: 20,
        background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), ${cinematicTheme.colors.glass}`,
        border: `1px solid ${accent}40`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 24px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.16)`,
        backdropFilter: "blur(18px)",
        padding: "18px 24px",
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", height: headerH, borderBottom: "1px solid rgba(234,236,239,0.1)" }}>
        <div style={{ width: nameColW, flexShrink: 0 }} />
        {products.map((product, ci) => {
          const isHighlight = ci === highlight
          return (
            <div
              key={ci}
              style={{
                width: cellW,
                textAlign: "center",
                fontFamily: cinematicTheme.font.zh,
                fontSize: 12,
                fontWeight: 700,
                color: isHighlight ? accent : cinematicTheme.colors.coldWhite,
                textShadow: isHighlight ? `0 0 12px ${accent}66` : undefined,
              }}
            >
              {product}
            </div>
          )
        })}
      </div>

      {/* Feature rows */}
      {features.map((feature, ri) => {
        const rowEnter = softSpring(frame, fps, delay + 10 + stagger(ri, rowCount, 30))
        const isEven = ri % 2 === 0
        return (
          <div
            key={ri}
            style={{
              display: "flex",
              alignItems: "center",
              height: rowH,
              opacity: rowEnter,
              transform: `translateX(${(1 - rowEnter) * 20}px)`,
              background: isEven ? "rgba(234,236,239,0.03)" : "transparent",
              borderRadius: 6,
            }}
          >
            <div
              style={{
                width: nameColW,
                flexShrink: 0,
                fontSize: 11,
                color: "rgba(234,236,239,0.72)",
                fontFamily: cinematicTheme.font.zh,
                paddingLeft: 4,
              }}
            >
              {feature.name}
            </div>
            {feature.values.map((val, ci) => {
              const isHighlight2 = ci === highlight
              const isIcon = val === "yes" || val === "no" || val === "partial"
              return (
                <div
                  key={ci}
                  style={{
                    width: cellW,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    fontSize: 11,
                    color: "rgba(234,236,239,0.7)",
                    fontFamily: cinematicTheme.font.zh,
                  }}
                >
                  {/* Highlight column background */}
                  {isHighlight2 && (
                    <div
                      style={{
                        position: "absolute",
                        inset: "-2px -4px",
                        background: `${accent}0A`,
                        borderLeft: ri === 0 ? `1px solid ${accent}30` : undefined,
                        borderRight: ri === 0 ? `1px solid ${accent}30` : undefined,
                      }}
                    />
                  )}
                  {isIcon ? <CellIcon value={val} /> : <span>{val}</span>}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Highlight column glow border (overlay) */}
      {highlight != null && (
        <div
          style={{
            position: "absolute",
            left: 24 + nameColW + highlight * cellW - 4,
            top: 18,
            width: cellW + 8,
            height: totalH - 36,
            borderRadius: 10,
            border: `1px solid ${accent}30`,
            boxShadow: `0 0 18px ${accent}1A`,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. FunnelAnalysis
// ---------------------------------------------------------------------------

export interface FunnelStage {
  label: string
  value: number
  dropoff?: string
}

export interface FunnelAnalysisProps {
  stages: FunnelStage[]
  title?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function FunnelAnalysis({
  stages,
  title,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 420,
  height = 380,
}: FunnelAnalysisProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const count = stages.length

  // Normalize widths relative to first stage value
  const maxVal = stages[0]?.value ?? 1
  const minWidth = 0.25 // minimum width ratio
  const stageH = Math.min(52, (height - 80) / count - 8)
  const drift = loopSine(frame, 200, 0.8) * 3

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
        transform: `translate3d(${x}px, ${y + drift}px, ${z - (1 - enter) * 200}px)`,
        borderRadius: 20,
        background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), ${cinematicTheme.colors.glass}`,
        border: `1px solid ${accent}40`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 28px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.16)`,
        backdropFilter: "blur(18px)",
        padding: "24px 20px",
      }}
    >
      {/* Title */}
      {title && (
        <div
          style={{
            fontFamily: cinematicTheme.font.mono,
            fontSize: 10,
            letterSpacing: 2.2,
            color: accent,
            marginBottom: 20,
          }}
        >
          {title.toUpperCase()}
        </div>
      )}

      {/* Funnel stages */}
      <div style={{ position: "relative" }}>
        {stages.map((stage, i) => {
          const stageEnter = softSpring(frame, fps, delay + 8 + stagger(i, count, 28))
          const widthRatio = Math.max(minWidth, stage.value / maxVal)
          const barW = (width - 120) * widthRatio
          const valueAnim = clampInterpolate(
            frame,
            [delay + 12 + stagger(i, count, 28), delay + 40 + stagger(i, count, 28)],
            [0, stage.value],
          )

          // Compute dropoff percentage
          const nextStage = stages[i + 1]
          const dropoffPct = nextStage ? Math.round((1 - nextStage.value / stage.value) * 100) : 0

          // Color gradient per stage (shifts hue slightly)
          const hueShift = i * 12
          const stageColor = i === 0 ? accent : accent

          return (
            <div key={i} style={{ position: "relative", marginBottom: 8 }}>
              {/* Stage bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  opacity: stageEnter,
                  transform: `translateY(${(1 - stageEnter) * 16}px)`,
                }}
              >
                <div
                  style={{
                    width: barW * stageEnter,
                    height: stageH,
                    borderRadius: 10,
                    background: `linear-gradient(90deg, ${accent}${(60 - i * 8).toString(16).padStart(2, "0")}, ${accent}${(30 - i * 4).toString(16).padStart(2, "0")})`,
                    border: `1px solid ${accent}${(50 - i * 6).toString(16).padStart(2, "0")}`,
                    boxShadow: `0 4px 16px rgba(0,0,0,0.3), 0 0 12px ${accent}18`,
                    backdropFilter: "blur(8px)",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 14px",
                    justifyContent: "space-between",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {/* Label */}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: cinematicTheme.colors.coldWhite,
                      fontFamily: cinematicTheme.font.zh,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {stage.label}
                  </span>
                  {/* Animated counter */}
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: accent,
                      fontFamily: cinematicTheme.font.mono,
                      textShadow: `0 0 10px ${accent}44`,
                    }}
                  >
                    {formatCompactNumber(Math.round(valueAnim))}
                  </span>

                  {/* Scan line */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)`,
                      transform: `translateX(${((frame * 2 + i * 20) % 200) - 100}%)`,
                    }}
                  />
                </div>

                {/* Dropoff indicator */}
                {i < count - 1 && dropoffPct > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      opacity: stageEnter * 0.9,
                    }}
                  >
                    <svg width={12} height={14} viewBox="0 0 12 14">
                      <path d="M 6 0 L 6 10 M 3 7 L 6 10 L 9 7" fill="none" stroke="#f87171" strokeWidth={1.5} strokeLinecap="round" />
                    </svg>
                    <span style={{ fontSize: 10, color: "#f87171", fontFamily: cinematicTheme.font.mono }}>
                      -{dropoffPct}%
                    </span>
                  </div>
                )}
              </div>

              {/* Dropoff reason */}
              {stage.dropoff && (
                <div
                  style={{
                    position: "absolute",
                    right: 12,
                    bottom: -2,
                    fontSize: 9,
                    color: "#f87171",
                    fontFamily: cinematicTheme.font.zh,
                    opacity: stageEnter * 0.7,
                  }}
                >
                  {stage.dropoff}
                </div>
              )}

              {/* Connecting arrow between stages */}
              {i < count - 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "2px 0",
                    opacity: stageEnter * 0.4,
                  }}
                >
                  <svg width={16} height={10} viewBox="0 0 16 10">
                    <path d="M 8 0 L 8 7 M 5 5 L 8 8 L 11 5" fill="none" stroke={accent} strokeWidth={1.2} strokeLinecap="round" opacity={0.6} />
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Sparkle particles at conversion points */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
      >
        {stages.map((stage, i) => {
          if (i === 0) return null
          const stageEnter2 = softSpring(frame, fps, delay + 14 + stagger(i, count, 28))
          const sparkleY = 44 + i * (stageH + 18) - 4
          return Array.from({ length: 3 }, (_, j) => {
            const seed = noiseSeed(i, j)
            const sparkleX = 30 + seed * (width - 100)
            const phase = seed * Math.PI * 2
            const opacity = (0.3 + loopSine(frame, 40 + j * 10, phase) * 0.3) * stageEnter2
            const size = 1.5 + seed * 1.5
            return (
              <circle
                key={`${i}-${j}`}
                cx={sparkleX}
                cy={sparkleY}
                r={size}
                fill={accent}
                opacity={opacity}
              />
            )
          })
        })}
      </svg>
    </div>
  )
}
