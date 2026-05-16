import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, loopSine, softSpring, stagger } from "./motion"

/* ─────────────────────────────────────────────────────────────────────────────
 * CohortAnalysis — Triangular cohort retention table
 * ───────────────────────────────────────────────────────────────────────────── */

export function CohortAnalysis({
  cohorts,
  periods,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  cohorts: Array<{ label: string; values: number[] }>
  periods?: string[]
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
  const maxCols = Math.max(...cohorts.map((c) => c.values.length), 1)
  const defaultPeriods = periods ?? Array.from({ length: maxCols }, (_, i) => `W${i}`)

  function cellColor(value: number): string {
    // Green for high retention, red for low
    const t = Math.max(0, Math.min(1, value / 100))
    const r = Math.round(255 * (1 - t) * 0.85)
    const g = Math.round(255 * t * 0.78)
    const b = Math.round(40 + t * 30)
    return `rgba(${r}, ${g}, ${b}, 0.7)`
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 60 + maxCols * 70 + 100,
        marginLeft: -(60 + maxCols * 70 + 100) / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 240}px) rotateX(${10 - enter * 5}deg) rotateY(${x > 0 ? -6 : 6}deg)`,
        borderRadius: 20,
        background: "rgba(12,12,18,0.62)",
        border: `1px solid ${accent}28`,
        boxShadow: `0 28px 80px rgba(0,0,0,0.46), 0 0 32px ${accent}18, inset 0 1px 0 rgba(255,255,255,0.12)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        padding: "18px 22px",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8, paddingLeft: 100 }}>
        {defaultPeriods.map((p, i) => (
          <div
            key={i}
            style={{
              width: 64,
              textAlign: "center",
              fontFamily: cinematicTheme.font.mono,
              fontSize: 10,
              letterSpacing: 1.2,
              color: "rgba(234,236,239,0.44)",
            }}
          >
            {p}
          </div>
        ))}
      </div>
      {/* Cohort rows */}
      {cohorts.map((cohort, rowIdx) => {
        const rowDelay = delay + 10 + stagger(rowIdx, cohorts.length, 24)
        const rowEnter = softSpring(frame, fps, rowDelay)

        return (
          <div
            key={cohort.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 4,
              opacity: rowEnter,
              transform: `translateX(${(1 - rowEnter) * -20}px)`,
            }}
          >
            <div
              style={{
                width: 96,
                fontFamily: cinematicTheme.font.mono,
                fontSize: 11,
                color: "rgba(234,236,239,0.66)",
                flexShrink: 0,
              }}
            >
              {cohort.label}
            </div>
            {cohort.values.map((val, colIdx) => {
              const cellDelay = rowDelay + colIdx * 2
              const cellEnter = softSpring(frame, fps, cellDelay)
              return (
                <div
                  key={colIdx}
                  style={{
                    width: 64,
                    height: 32,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: cinematicTheme.font.mono,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                    background: cellColor(val),
                    opacity: cellEnter,
                    transform: `scale(${0.7 + cellEnter * 0.3})`,
                    boxShadow: val > 60 ? `0 0 10px ${cellColor(val)}` : "none",
                    textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                  }}
                >
                  {Math.round(clampInterpolate(frame, [cellDelay + 4, cellDelay + 30], [0, val]))}%
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * RetentionGrid — D1/D7/D14/D30 retention by segment
 * ───────────────────────────────────────────────────────────────────────────── */

export function RetentionGrid({
  segments,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  segments: Array<{ name: string; d1: number; d7: number; d14: number; d30: number; tone?: CinematicTone }>
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
  const columns = ["D1", "D7", "D14", "D30"] as const

  function intensityColor(value: number, baseColor: string): string {
    const alpha = 0.2 + (value / 100) * 0.6
    return `color-mix(in srgb, ${baseColor} ${Math.round(alpha * 100)}%, transparent)`
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 560,
        marginLeft: -280,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 220}px) rotateX(${8 - enter * 4}deg)`,
        borderRadius: 20,
        background: "rgba(12,12,18,0.62)",
        border: `1px solid ${accent}28`,
        boxShadow: `0 28px 80px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.12)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr",
          padding: "16px 22px",
          fontFamily: cinematicTheme.font.mono,
          fontSize: 11,
          letterSpacing: 1.4,
          color: "rgba(234,236,239,0.42)",
          borderBottom: "1px solid rgba(234,236,239,0.08)",
        }}
      >
        <div>SEGMENT</div>
        {columns.map((col) => (
          <div key={col} style={{ textAlign: "center" }}>{col}</div>
        ))}
      </div>
      {/* Rows */}
      {segments.map((seg, rowIdx) => {
        const rowDelay = delay + 10 + stagger(rowIdx, segments.length, 20)
        const rowEnter = softSpring(frame, fps, rowDelay)
        const segAccent = toneColor(seg.tone ?? tone)
        const values = [seg.d1, seg.d7, seg.d14, seg.d30]

        return (
          <div
            key={seg.name}
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr",
              padding: "14px 22px",
              alignItems: "center",
              opacity: rowEnter,
              transform: `translateX(${(1 - rowEnter) * -24}px)`,
              borderBottom: rowIdx === segments.length - 1 ? "none" : "1px solid rgba(234,236,239,0.06)",
            }}
          >
            {/* Left accent */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 2,
                background: `linear-gradient(180deg, transparent, ${segAccent}, transparent)`,
                opacity: rowEnter * 0.6,
                transform: `scaleY(${rowEnter})`,
                transformOrigin: "top",
              }}
            />
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{seg.name}</div>
            {values.map((val, colIdx) => {
              const cellDelay = rowDelay + colIdx * 3
              const cellEnter = softSpring(frame, fps, cellDelay)
              const display = clampInterpolate(frame, [cellDelay + 2, cellDelay + 28], [0, val])
              return (
                <div key={colIdx} style={{ display: "flex", justifyContent: "center" }}>
                  <div
                    style={{
                      width: 56,
                      height: 36,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: cinematicTheme.font.mono,
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      background: intensityColor(val, segAccent),
                      border: `1px solid ${segAccent}30`,
                      opacity: cellEnter,
                      transform: `scale(${0.75 + cellEnter * 0.25})`,
                      textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                    }}
                  >
                    {Math.round(display)}%
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ABTestPanel — Side-by-side variant comparison with confidence intervals
 * ───────────────────────────────────────────────────────────────────────────── */

export function ABTestPanel({
  testName,
  variants,
  winner,
  significance,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  testName: string
  variants: Array<{ name: string; value: number; ci: [number, number]; tone?: CinematicTone }>
  winner?: string
  significance?: number
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
  const maxValue = Math.max(...variants.map((v) => v.ci[1]), 1)
  const glow = 0.35 + Math.max(0, loopSine(frame, 56, delay) * 0.2)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 520,
        marginLeft: -260,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 240}px) rotateX(${10 - enter * 5}deg)`,
        borderRadius: 20,
        background: "rgba(12,12,18,0.62)",
        border: `1px solid ${accent}28`,
        boxShadow: `0 28px 80px rgba(0,0,0,0.46), 0 0 ${30 * glow}px ${accent}20, inset 0 1px 0 rgba(255,255,255,0.12)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        padding: "20px 24px",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: cinematicTheme.font.zh,
          fontSize: 16,
          fontWeight: 800,
          color: "#fff",
          marginBottom: 6,
        }}
      >
        {testName}
      </div>
      {significance !== undefined && (
        <div
          style={{
            fontFamily: cinematicTheme.font.mono,
            fontSize: 11,
            letterSpacing: 1.2,
            color: "rgba(234,236,239,0.5)",
            marginBottom: 18,
          }}
        >
          SIGNIFICANCE: {(significance * 100).toFixed(1)}%
        </div>
      )}
      {/* Variants */}
      {variants.map((variant, idx) => {
        const varDelay = delay + 14 + idx * 10
        const varEnter = softSpring(frame, fps, varDelay)
        const varAccent = toneColor(variant.tone ?? (idx === 0 ? "purple" : "amber"))
        const barWidth = (variant.value / maxValue) * 100
        const ciLeft = (variant.ci[0] / maxValue) * 100
        const ciRight = (variant.ci[1] / maxValue) * 100
        const isWinner = winner === variant.name
        const displayValue = clampInterpolate(frame, [varDelay + 4, varDelay + 40], [0, variant.value])

        return (
          <div
            key={variant.name}
            style={{
              marginBottom: 18,
              opacity: varEnter,
              transform: `translateX(${(1 - varEnter) * -20}px)`,
            }}
          >
            {/* Label row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{variant.name}</span>
                {isWinner && (
                  <span
                    style={{
                      fontFamily: cinematicTheme.font.mono,
                      fontSize: 10,
                      letterSpacing: 1,
                      fontWeight: 800,
                      color: cinematicTheme.colors.gold,
                      background: `${cinematicTheme.colors.gold}18`,
                      border: `1px solid ${cinematicTheme.colors.gold}40`,
                      borderRadius: 6,
                      padding: "2px 8px",
                      opacity: softSpring(frame, fps, varDelay + 20),
                      textShadow: `0 0 10px ${cinematicTheme.colors.gold}60`,
                    }}
                  >
                    WINNER
                  </span>
                )}
              </div>
              <span
                style={{
                  fontFamily: cinematicTheme.font.mono,
                  fontSize: 18,
                  fontWeight: 900,
                  color: varAccent,
                  textShadow: `0 0 14px ${varAccent}44`,
                }}
              >
                {displayValue.toFixed(1)}%
              </span>
            </div>
            {/* Bar + CI */}
            <div style={{ position: "relative", height: 28, borderRadius: 8, background: "rgba(234,236,239,0.06)", overflow: "hidden" }}>
              {/* Main bar */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 4,
                  bottom: 4,
                  width: `${barWidth * varEnter}%`,
                  borderRadius: 6,
                  background: `linear-gradient(90deg, ${varAccent}88, ${varAccent})`,
                  boxShadow: `0 0 16px ${varAccent}44`,
                }}
              />
              {/* Confidence interval */}
              <div
                style={{
                  position: "absolute",
                  left: `${ciLeft}%`,
                  width: `${(ciRight - ciLeft) * varEnter}%`,
                  top: 10,
                  bottom: 10,
                  borderRadius: 4,
                  background: `${varAccent}22`,
                  border: `1px solid ${varAccent}55`,
                  opacity: varEnter,
                }}
              />
              {/* CI whiskers */}
              <div style={{ position: "absolute", left: `${ciLeft}%`, top: 6, bottom: 6, width: 2, background: `${varAccent}88`, borderRadius: 1, opacity: varEnter }} />
              <div style={{ position: "absolute", left: `${ciRight}%`, top: 6, bottom: 6, width: 2, background: `${varAccent}88`, borderRadius: 1, opacity: varEnter }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ConversionPath — Horizontal multi-step path with drop-off bars
 * ───────────────────────────────────────────────────────────────────────────── */

export function ConversionPath({
  steps,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  steps: Array<{ label: string; users: number; tone?: CinematicTone }>
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
  const maxUsers = Math.max(...steps.map((s) => s.users), 1)
  const totalWidth = steps.length * 140 + (steps.length - 1) * 40 + 48

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: totalWidth,
        marginLeft: -totalWidth / 2,
        height: 220,
        marginTop: -110,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 200}px) rotateX(${8 - enter * 4}deg)`,
        borderRadius: 20,
        background: "rgba(12,12,18,0.62)",
        border: `1px solid ${accent}28`,
        boxShadow: `0 28px 80px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.12)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        padding: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {steps.map((step, idx) => {
        const stepDelay = delay + 8 + stagger(idx, steps.length, 28)
        const stepEnter = softSpring(frame, fps, stepDelay)
        const stepAccent = toneColor(step.tone ?? tone)
        const barHeight = (step.users / maxUsers) * 100
        const displayUsers = clampInterpolate(frame, [stepDelay + 4, stepDelay + 36], [0, step.users])
        const dropOff = idx > 0 ? Math.round((1 - step.users / steps[idx - 1].users) * 100) : 0

        return (
          <div key={step.label} style={{ display: "flex", alignItems: "center" }}>
            {/* Drop-off connector */}
            {idx > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 40,
                  opacity: stepEnter,
                }}
              >
                {/* Arrow line */}
                <div
                  style={{
                    width: 28,
                    height: 2,
                    background: `linear-gradient(90deg, ${accent}60, ${accent}20)`,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      right: -3,
                      top: -3,
                      width: 0,
                      height: 0,
                      borderLeft: `6px solid ${accent}60`,
                      borderTop: "4px solid transparent",
                      borderBottom: "4px solid transparent",
                    }}
                  />
                </div>
                {/* Drop-off label */}
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: cinematicTheme.font.mono,
                    fontSize: 10,
                    color: cinematicTheme.colors.magenta,
                    textShadow: `0 0 8px ${cinematicTheme.colors.magenta}44`,
                  }}
                >
                  -{dropOff}%
                </div>
              </div>
            )}
            {/* Step card */}
            <div
              style={{
                width: 120,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                opacity: stepEnter,
                transform: `translateY(${(1 - stepEnter) * 18}px)`,
              }}
            >
              {/* Bar */}
              <div
                style={{
                  width: 48,
                  height: 80,
                  borderRadius: 8,
                  background: "rgba(234,236,239,0.06)",
                  position: "relative",
                  overflow: "hidden",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${barHeight * stepEnter}%`,
                    borderRadius: "0 0 8px 8px",
                    background: `linear-gradient(180deg, ${stepAccent}, ${stepAccent}66)`,
                    boxShadow: `0 0 14px ${stepAccent}44`,
                  }}
                />
              </div>
              {/* User count */}
              <div
                style={{
                  fontFamily: cinematicTheme.font.mono,
                  fontSize: 16,
                  fontWeight: 900,
                  color: "#fff",
                  textShadow: `0 0 12px ${stepAccent}40`,
                  marginBottom: 4,
                }}
              >
                {displayUsers >= 1000
                  ? `${(displayUsers / 1000).toFixed(1)}k`
                  : Math.round(displayUsers).toLocaleString()}
              </div>
              {/* Label */}
              <div
                style={{
                  fontFamily: cinematicTheme.font.mono,
                  fontSize: 10,
                  letterSpacing: 1,
                  color: "rgba(234,236,239,0.52)",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
