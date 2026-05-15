import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, softSpring, stagger, loopSine, smoothStep } from "./motion"

/* ─────────────────────────────────────────────────────────────
   1. OKR Tree
   ───────────────────────────────────────────────────────────── */

export interface OKRObjective {
  label: string
  progress?: number
}

export interface OKRKeyResult {
  label: string
  progress: number
  metric?: string
}

export interface OKRTreeProps {
  objective: OKRObjective
  keyResults: OKRKeyResult[]
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
}

function progressColor(progress: number): string {
  if (progress > 80) return "#34D399"
  if (progress > 40) return "#F6C453"
  return "#FF5A5A"
}

export function OKRTree({
  objective,
  keyResults,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 560,
}: OKRTreeProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)

  const objEnter = softSpring(frame, fps, delay)
  const glow = loopSine(frame, 120, 0) * 0.5 + 0.5

  const objProgress = objective.progress ?? Math.round(keyResults.reduce((s, kr) => s + kr.progress, 0) / Math.max(1, keyResults.length))
  const progressAnimate = clampInterpolate(frame, [delay + 18, delay + 60], [0, objProgress / 100])

  // Layout
  const objCardW = 260
  const objCardH = 80
  const krCardW = Math.min(140, (width - 40) / Math.max(1, keyResults.length) - 12)
  const krCardH = 100
  const objCenterX = width / 2
  const objCenterY = 50
  const krY = 180

  // Progress ring geometry
  const ringR = 26
  const ringCircumference = 2 * Math.PI * ringR

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height: krY + krCardH + 30,
        marginLeft: -width / 2,
        marginTop: -(krY + krCardH + 30) / 2,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
        opacity: objEnter,
      }}
    >
      {/* SVG connectors */}
      <svg
        width={width}
        height={krY + krCardH + 30}
        viewBox={`0 0 ${width} ${krY + krCardH + 30}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          <filter id="okr-edge-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {keyResults.map((_, i) => {
          const krCount = keyResults.length
          const krX = (width - krCount * krCardW - (krCount - 1) * 12) / 2 + i * (krCardW + 12) + krCardW / 2
          const edgeDelay = delay + 20 + stagger(i, krCount, 18)
          const draw = clampInterpolate(frame, [edgeDelay, edgeDelay + 28], [0, 1])
          return (
            <path
              key={i}
              d={`M ${objCenterX} ${objCenterY + objCardH / 2 + 10} C ${objCenterX} ${objCenterY + objCardH / 2 + 50}, ${krX} ${krY - 30}, ${krX} ${krY}`}
              fill="none"
              stroke={accent}
              strokeWidth={1.5}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - draw}
              opacity={0.7 * draw}
              filter="url(#okr-edge-glow)"
            />
          )
        })}
      </svg>

      {/* Objective card */}
      <div
        style={{
          position: "absolute",
          left: objCenterX - objCardW / 2,
          top: objCenterY - objCardH / 2 + 10,
          width: objCardW,
          height: objCardH,
          borderRadius: 18,
          background: `linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.035)), rgba(10,10,15,0.62)`,
          border: `1px solid ${accent}45`,
          boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 ${38 * glow}px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.16)`,
          backdropFilter: "blur(18px)",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 16,
          opacity: objEnter,
          transform: `translateY(${(1 - objEnter) * -30}px) scale(${0.9 + objEnter * 0.1})`,
        }}
      >
        {/* Progress ring */}
        <svg width={ringR * 2 + 8} height={ringR * 2 + 8} viewBox={`0 0 ${ringR * 2 + 8} ${ringR * 2 + 8}`}>
          <circle
            cx={ringR + 4}
            cy={ringR + 4}
            r={ringR}
            fill="none"
            stroke="rgba(234,236,239,0.12)"
            strokeWidth={4}
          />
          <circle
            cx={ringR + 4}
            cy={ringR + 4}
            r={ringR}
            fill="none"
            stroke={progressColor(objProgress)}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={ringCircumference}
            strokeDashoffset={ringCircumference * (1 - progressAnimate)}
            transform={`rotate(-90 ${ringR + 4} ${ringR + 4})`}
            style={{ filter: `drop-shadow(0 0 6px ${progressColor(objProgress)}88)` }}
          />
          <text
            x={ringR + 4}
            y={ringR + 8}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
            fontWeight={700}
            fontFamily={cinematicTheme.font.mono}
          >
            {Math.round(progressAnimate * 100)}%
          </text>
        </svg>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: cinematicTheme.font.zh,
              fontSize: 18,
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1.3,
            }}
          >
            {objective.label}
          </div>
          <div style={{ marginTop: 4, fontSize: 10, letterSpacing: 1.6, color: cinematicTheme.colors.dim, fontFamily: cinematicTheme.font.mono }}>
            OBJECTIVE
          </div>
        </div>
      </div>

      {/* Key Result cards */}
      {keyResults.map((kr, i) => {
        const krCount = keyResults.length
        const krDelay = delay + 24 + stagger(i, krCount, 22)
        const krEnter = softSpring(frame, fps, krDelay)
        const barFill = clampInterpolate(frame, [krDelay + 10, krDelay + 40], [0, kr.progress / 100])
        const krX = (width - krCount * krCardW - (krCount - 1) * 12) / 2 + i * (krCardW + 12)
        const pColor = progressColor(kr.progress)

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: krX,
              top: krY,
              width: krCardW,
              height: krCardH,
              borderRadius: 14,
              background: `linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.025)), rgba(10,10,15,0.56)`,
              border: `1px solid ${pColor}35`,
              boxShadow: `0 16px 48px rgba(0,0,0,0.36), 0 0 18px ${pColor}18, inset 0 1px 0 rgba(255,255,255,0.12)`,
              backdropFilter: "blur(16px)",
              padding: "12px 14px",
              opacity: krEnter,
              transform: `translateY(${(1 - krEnter) * 20}px) scale(${0.88 + krEnter * 0.12})`,
              display: "flex",
              flexDirection: "column" as const,
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontFamily: cinematicTheme.font.zh,
                fontSize: 11,
                fontWeight: 600,
                color: "#fff",
                lineHeight: 1.4,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const,
              }}
            >
              {kr.label}
            </div>
            {kr.metric && (
              <div style={{ fontSize: 9, color: cinematicTheme.colors.dim, fontFamily: cinematicTheme.font.mono, marginTop: 4 }}>
                {kr.metric}
              </div>
            )}
            {/* Progress bar */}
            <div style={{ marginTop: "auto", paddingTop: 8 }}>
              <div style={{ position: "relative", height: 5, borderRadius: 3, background: "rgba(234,236,239,0.1)", overflow: "hidden" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${barFill * 100}%`,
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${pColor}88, ${pColor})`,
                    boxShadow: `0 0 8px ${pColor}66`,
                  }}
                />
              </div>
              <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: pColor, fontFamily: cinematicTheme.font.mono }}>
                {Math.round(barFill * 100)}%
              </div>
            </div>
          </div>
        )
      })}

      {/* Scan-line effect */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 18,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 1,
            top: `${((frame * 0.8) % 100)}%`,
            background: `linear-gradient(90deg, transparent, ${accent}22, transparent)`,
          }}
        />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   2. Risk Matrix
   ───────────────────────────────────────────────────────────── */

export interface RiskItem {
  label: string
  impact: number
  likelihood: number
  color?: string
}

export interface RiskMatrixProps {
  risks: RiskItem[]
  size?: 3 | 5
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
}

function riskCellColor(row: number, col: number, gridSize: number): string {
  const severity = (row + col) / ((gridSize - 1) * 2)
  if (severity < 0.33) return "rgba(52,211,153,0.12)"
  if (severity < 0.66) return "rgba(246,196,83,0.12)"
  return "rgba(255,90,90,0.12)"
}

export function RiskMatrix({
  risks,
  size = 5,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 440,
}: RiskMatrixProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)

  const containerEnter = softSpring(frame, fps, delay)
  const gridOpacity = clampInterpolate(frame, [delay + 8, delay + 30], [0, 1])
  const glow = loopSine(frame, 140, 0.4) * 0.5 + 0.5

  const padding = 52
  const headerH = 36
  const legendH = 32
  const totalH = width + headerH + legendH + 20
  const gridSize = width - padding * 2
  const cellSize = gridSize / size

  const axisLabels = size === 5
    ? ["Very Low", "Low", "Medium", "High", "Very High"]
    : ["Low", "Medium", "High"]

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
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
        opacity: containerEnter,
      }}
    >
      {/* Glass panel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 22,
          background: `linear-gradient(145deg, rgba(255,255,255,0.105), rgba(255,255,255,0.026)),
            radial-gradient(circle at 28% 0%, ${accent}22, transparent 38%),
            rgba(12, 12, 18, 0.58)`,
          border: `1px solid ${accent}35`,
          boxShadow: `0 32px 100px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.16), 0 0 ${55 * glow}px ${accent}18`,
          backdropFilter: "blur(22px) saturate(1.25)",
          overflow: "hidden",
        }}
      >
        {/* Scan-line texture */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.026) 1px, transparent 1px)", backgroundSize: "4px 4px", opacity: 0.3 }} />
      </div>

      {/* Title */}
      <div style={{ position: "absolute", left: 20, top: 14, display: "flex", alignItems: "center", gap: 8, opacity: containerEnter }}>
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 10, letterSpacing: 2.2, color: accent, fontWeight: 600 }}>
          RISK ASSESSMENT
        </div>
      </div>

      {/* Axis labels */}
      <div
        style={{
          position: "absolute",
          left: 8,
          top: headerH + padding + gridSize / 2 - 40,
          transform: "rotate(-90deg)",
          transformOrigin: "center",
          fontFamily: cinematicTheme.font.en,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 1.5,
          color: cinematicTheme.colors.dim,
          opacity: gridOpacity,
        }}
      >
        IMPACT
      </div>
      <div
        style={{
          position: "absolute",
          left: padding + gridSize / 2 - 30,
          bottom: legendH + 4,
          fontFamily: cinematicTheme.font.en,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 1.5,
          color: cinematicTheme.colors.dim,
          opacity: gridOpacity,
        }}
      >
        LIKELIHOOD
      </div>

      {/* Grid */}
      <svg
        width={width}
        height={totalH}
        viewBox={`0 0 ${width} ${totalH}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          <filter id="risk-dot-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background gradient from green(bottom-left) to red(top-right) */}
        <defs>
          <linearGradient id="risk-bg-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#34D399" stopOpacity={0.04} />
            <stop offset="50%" stopColor="#F6C453" stopOpacity={0.04} />
            <stop offset="100%" stopColor="#FF5A5A" stopOpacity={0.06} />
          </linearGradient>
        </defs>
        <rect x={padding} y={headerH} width={gridSize} height={gridSize} fill="url(#risk-bg-grad)" rx={8} opacity={gridOpacity} />

        {/* Grid cells */}
        {Array.from({ length: size }).map((_, row) =>
          Array.from({ length: size }).map((_, col) => {
            const cx = padding + col * cellSize
            const cy = headerH + (size - 1 - row) * cellSize
            return (
              <rect
                key={`${row}-${col}`}
                x={cx}
                y={cy}
                width={cellSize}
                height={cellSize}
                fill={riskCellColor(row, col, size)}
                stroke="rgba(234,236,239,0.08)"
                strokeWidth={0.5}
                opacity={gridOpacity}
                rx={3}
              />
            )
          })
        )}

        {/* Grid axis tick labels */}
        {axisLabels.map((label, i) => {
          const xPos = padding + i * cellSize + cellSize / 2
          const yPos = headerH + gridSize + 14
          return (
            <text
              key={`x-${i}`}
              x={xPos}
              y={yPos}
              textAnchor="middle"
              fill="rgba(234,236,239,0.4)"
              fontSize={8}
              fontFamily={cinematicTheme.font.en}
              opacity={gridOpacity}
            >
              {label}
            </text>
          )
        })}
        {axisLabels.map((label, i) => {
          const xPos = padding - 6
          const yPos = headerH + (size - 1 - i) * cellSize + cellSize / 2 + 3
          return (
            <text
              key={`y-${i}`}
              x={xPos}
              y={yPos}
              textAnchor="end"
              fill="rgba(234,236,239,0.4)"
              fontSize={8}
              fontFamily={cinematicTheme.font.en}
              opacity={gridOpacity}
            >
              {label}
            </text>
          )
        })}

        {/* Risk dots */}
        {risks.map((risk, i) => {
          const dotDelay = delay + 30 + stagger(i, risks.length, 24)
          const dotEnter = softSpring(frame, fps, dotDelay)
          const dotColor = risk.color ?? progressColor(100 - ((risk.impact + risk.likelihood) / (size * 2)) * 100)
          // Map 1-based grid positions to pixel positions
          const dotX = padding + (risk.likelihood - 0.5) * cellSize
          const dotY = headerH + (size - risk.impact + 0.5) * cellSize
          const drift = loopSine(frame, 100 + i * 13, i) * 2

          return (
            <g key={i} opacity={dotEnter} transform={`translate(${drift * 0.5}, ${drift})`}>
              <circle
                cx={dotX}
                cy={dotY}
                r={10 * dotEnter}
                fill={dotColor}
                opacity={0.9}
                filter="url(#risk-dot-glow)"
              />
              <circle
                cx={dotX}
                cy={dotY}
                r={14 * dotEnter}
                fill="none"
                stroke={dotColor}
                strokeWidth={1.5}
                opacity={0.4 * dotEnter}
              />
              <text
                x={dotX}
                y={dotY + 22}
                textAnchor="middle"
                fill="#fff"
                fontSize={8}
                fontWeight={600}
                fontFamily={cinematicTheme.font.zh}
                opacity={dotEnter * 0.9}
              >
                {risk.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: padding,
          right: padding,
          display: "flex",
          justifyContent: "center",
          gap: 16,
          opacity: gridOpacity,
        }}
      >
        {[
          { label: "Low", color: "#34D399" },
          { label: "Medium", color: "#F6C453" },
          { label: "High", color: "#FF5A5A" },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, boxShadow: `0 0 8px ${item.color}66` }} />
            <span style={{ fontSize: 9, color: cinematicTheme.colors.dim, fontFamily: cinematicTheme.font.en }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   3. Competitive Landscape
   ───────────────────────────────────────────────────────────── */

export interface CompetitivePlayer {
  name: string
  x: number
  y: number
  size?: number
  highlight?: boolean
}

export interface CompetitiveLandscapeProps {
  players: CompetitivePlayer[]
  xAxis: string
  yAxis: string
  quadrants?: [string, string, string, string]
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function CompetitiveLandscape({
  players,
  xAxis,
  yAxis,
  quadrants = ["Leaders", "Challengers", "Niche Players", "Visionaries"],
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 480,
  height = 480,
}: CompetitiveLandscapeProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)

  const containerEnter = softSpring(frame, fps, delay)
  const crosshairDraw = clampInterpolate(frame, [delay + 6, delay + 28], [0, 1])
  const glow = loopSine(frame, 150, 0.2) * 0.5 + 0.5

  const pad = 48
  const chartW = width - pad * 2
  const chartH = height - pad * 2

  // Quadrant tints (very subtle)
  const quadrantTints = [
    "rgba(122,90,248,0.04)",  // top-right: Leaders (purple tint)
    "rgba(246,196,83,0.04)",  // top-left: Challengers (amber tint)
    "rgba(52,211,153,0.03)",  // bottom-left: Niche Players (green tint)
    "rgba(255,61,142,0.03)",  // bottom-right: Visionaries (magenta tint)
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
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
        opacity: containerEnter,
      }}
    >
      {/* Glass panel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 22,
          background: `linear-gradient(145deg, rgba(255,255,255,0.105), rgba(255,255,255,0.026)),
            radial-gradient(circle at 70% 20%, ${accent}18, transparent 40%),
            rgba(12, 12, 18, 0.58)`,
          border: `1px solid ${accent}35`,
          boxShadow: `0 32px 100px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.16), 0 0 ${50 * glow}px ${accent}15`,
          backdropFilter: "blur(22px) saturate(1.25)",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.026) 1px, transparent 1px)", backgroundSize: "4px 4px", opacity: 0.25 }} />
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          <filter id="cl-player-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Quadrant backgrounds */}
        <rect x={pad + chartW / 2} y={pad} width={chartW / 2} height={chartH / 2} fill={quadrantTints[0]} opacity={crosshairDraw} />
        <rect x={pad} y={pad} width={chartW / 2} height={chartH / 2} fill={quadrantTints[1]} opacity={crosshairDraw} />
        <rect x={pad} y={pad + chartH / 2} width={chartW / 2} height={chartH / 2} fill={quadrantTints[2]} opacity={crosshairDraw} />
        <rect x={pad + chartW / 2} y={pad + chartH / 2} width={chartW / 2} height={chartH / 2} fill={quadrantTints[3]} opacity={crosshairDraw} />

        {/* Crosshair lines (dashed) */}
        <line
          x1={pad + chartW / 2}
          y1={pad}
          x2={pad + chartW / 2}
          y2={pad + chartH}
          stroke="rgba(234,236,239,0.2)"
          strokeWidth={1}
          strokeDasharray="6 4"
          pathLength={1}
          strokeDashoffset={1 - crosshairDraw}
        />
        <line
          x1={pad}
          y1={pad + chartH / 2}
          x2={pad + chartW}
          y2={pad + chartH / 2}
          stroke="rgba(234,236,239,0.2)"
          strokeWidth={1}
          strokeDasharray="6 4"
          pathLength={1}
          strokeDashoffset={1 - crosshairDraw}
        />

        {/* Border rectangle */}
        <rect
          x={pad}
          y={pad}
          width={chartW}
          height={chartH}
          fill="none"
          stroke="rgba(234,236,239,0.12)"
          strokeWidth={1}
          rx={4}
          opacity={crosshairDraw}
        />

        {/* Quadrant labels */}
        <text x={pad + chartW * 0.75} y={pad + 18} textAnchor="middle" fill="rgba(234,236,239,0.28)" fontSize={9} fontWeight={600} fontFamily={cinematicTheme.font.en} opacity={crosshairDraw}>
          {quadrants[0]}
        </text>
        <text x={pad + chartW * 0.25} y={pad + 18} textAnchor="middle" fill="rgba(234,236,239,0.28)" fontSize={9} fontWeight={600} fontFamily={cinematicTheme.font.en} opacity={crosshairDraw}>
          {quadrants[1]}
        </text>
        <text x={pad + chartW * 0.25} y={pad + chartH - 8} textAnchor="middle" fill="rgba(234,236,239,0.28)" fontSize={9} fontWeight={600} fontFamily={cinematicTheme.font.en} opacity={crosshairDraw}>
          {quadrants[2]}
        </text>
        <text x={pad + chartW * 0.75} y={pad + chartH - 8} textAnchor="middle" fill="rgba(234,236,239,0.28)" fontSize={9} fontWeight={600} fontFamily={cinematicTheme.font.en} opacity={crosshairDraw}>
          {quadrants[3]}
        </text>

        {/* Axis labels with arrows */}
        {/* X-axis */}
        <line x1={pad + chartW + 4} y1={pad + chartH / 2} x2={pad + chartW + 16} y2={pad + chartH / 2} stroke={accent} strokeWidth={1.5} opacity={crosshairDraw * 0.7} />
        <polygon points={`${pad + chartW + 16},${pad + chartH / 2 - 3} ${pad + chartW + 16},${pad + chartH / 2 + 3} ${pad + chartW + 22},${pad + chartH / 2}`} fill={accent} opacity={crosshairDraw * 0.7} />
        <text x={pad + chartW / 2} y={height - 10} textAnchor="middle" fill={accent} fontSize={10} fontWeight={600} fontFamily={cinematicTheme.font.en} opacity={crosshairDraw}>
          {xAxis}
        </text>
        {/* Y-axis */}
        <line x1={pad + chartW / 2} y1={pad - 4} x2={pad + chartW / 2} y2={pad - 16} stroke={accent} strokeWidth={1.5} opacity={crosshairDraw * 0.7} />
        <polygon points={`${pad + chartW / 2 - 3},${pad - 16} ${pad + chartW / 2 + 3},${pad - 16} ${pad + chartW / 2},${pad - 22}`} fill={accent} opacity={crosshairDraw * 0.7} />
        <text x={14} y={pad + chartH / 2} textAnchor="middle" fill={accent} fontSize={10} fontWeight={600} fontFamily={cinematicTheme.font.en} opacity={crosshairDraw} transform={`rotate(-90 14 ${pad + chartH / 2})`}>
          {yAxis}
        </text>

        {/* Players */}
        {players.map((player, i) => {
          const playerDelay = delay + 28 + stagger(i, players.length, 30)
          const playerEnter = softSpring(frame, fps, playerDelay)
          const playerSize = (player.size ?? 1) * 14
          const px = pad + (player.x / 100) * chartW
          const py = pad + (1 - player.y / 100) * chartH
          const drift = loopSine(frame, 120 + i * 11, i * 2.1) * 2
          const isHighlight = player.highlight

          return (
            <g key={i} opacity={playerEnter} transform={`translate(${drift * 0.3}, ${drift})`}>
              {/* Glow ring for highlighted */}
              {isHighlight && (
                <>
                  <circle
                    cx={px}
                    cy={py}
                    r={(playerSize + 8) * playerEnter}
                    fill="none"
                    stroke={accent}
                    strokeWidth={1.5}
                    opacity={0.5 * playerEnter * (glow * 0.5 + 0.5)}
                    filter="url(#cl-player-glow)"
                  />
                  <circle
                    cx={px}
                    cy={py}
                    r={(playerSize + 14) * playerEnter}
                    fill="none"
                    stroke={accent}
                    strokeWidth={0.8}
                    opacity={0.25 * playerEnter}
                    strokeDasharray="3 3"
                  />
                </>
              )}
              {/* Player circle */}
              <circle
                cx={px}
                cy={py}
                r={playerSize * playerEnter}
                fill={isHighlight ? `${accent}55` : "rgba(234,236,239,0.15)"}
                stroke={isHighlight ? accent : "rgba(234,236,239,0.3)"}
                strokeWidth={isHighlight ? 2 : 1}
              />
              {/* Name label */}
              <text
                x={px}
                y={py + playerSize + 14}
                textAnchor="middle"
                fill={isHighlight ? "#fff" : "rgba(234,236,239,0.7)"}
                fontSize={isHighlight ? 11 : 9}
                fontWeight={isHighlight ? 700 : 500}
                fontFamily={cinematicTheme.font.zh}
              >
                {player.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   4. Business Model Canvas
   ───────────────────────────────────────────────────────────── */

export interface BMCBlocks {
  partners?: string[]
  activities?: string[]
  resources?: string[]
  value?: string[]
  relationships?: string[]
  channels?: string[]
  segments?: string[]
  costs?: string[]
  revenue?: string[]
}

export interface BusinessModelCanvasProps {
  blocks: BMCBlocks
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

interface BMCCell {
  key: keyof BMCBlocks
  label: string
  col: number
  row: number
  colSpan: number
  rowSpan: number
  revealOrder: number
}

const bmcLayout: BMCCell[] = [
  // Top row: 5 logical columns, each 1/5 width, rows 0-1 for top, row 2 for bottom
  { key: "partners", label: "KEY PARTNERS", col: 0, row: 0, colSpan: 1, rowSpan: 2, revealOrder: 4 },
  { key: "activities", label: "KEY ACTIVITIES", col: 1, row: 0, colSpan: 1, rowSpan: 1, revealOrder: 2 },
  { key: "resources", label: "KEY RESOURCES", col: 1, row: 1, colSpan: 1, rowSpan: 1, revealOrder: 3 },
  { key: "value", label: "VALUE PROPOSITION", col: 2, row: 0, colSpan: 1, rowSpan: 2, revealOrder: 0 },
  { key: "relationships", label: "CUSTOMER RELATIONSHIPS", col: 3, row: 0, colSpan: 1, rowSpan: 1, revealOrder: 2 },
  { key: "channels", label: "CHANNELS", col: 3, row: 1, colSpan: 1, rowSpan: 1, revealOrder: 3 },
  { key: "segments", label: "CUSTOMER SEGMENTS", col: 4, row: 0, colSpan: 1, rowSpan: 2, revealOrder: 4 },
  { key: "costs", label: "COST STRUCTURE", col: 0, row: 2, colSpan: 2.5, rowSpan: 1, revealOrder: 5 },
  { key: "revenue", label: "REVENUE STREAMS", col: 2.5, row: 2, colSpan: 2.5, rowSpan: 1, revealOrder: 5 },
]

export function BusinessModelCanvas({
  blocks,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 720,
  height = 440,
}: BusinessModelCanvasProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)

  const containerEnter = softSpring(frame, fps, delay)
  const glow = loopSine(frame, 160, 0.3) * 0.5 + 0.5

  // Grid dimensions
  const padX = 12
  const padY = 12
  const colW = (width - padX * 2) / 5
  const topRowH = ((height - padY * 2) * 2) / 3 / 2
  const bottomRowH = (height - padY * 2) / 3
  const gap = 3

  function cellRect(cell: BMCCell) {
    const left = padX + cell.col * colW + gap
    const w = cell.colSpan * colW - gap * 2
    let top: number
    let h: number
    if (cell.row === 2) {
      top = padY + topRowH * 2 + gap
      h = bottomRowH - gap * 2
    } else if (cell.rowSpan === 2) {
      top = padY + gap
      h = topRowH * 2 - gap * 2
    } else {
      top = padY + cell.row * topRowH + gap
      h = topRowH - gap * 2
    }
    return { left, top, w, h }
  }

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
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
        opacity: containerEnter,
      }}
    >
      {/* Outer glass frame */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 22,
          background: `linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), rgba(10,10,15,0.52)`,
          border: `1px solid ${accent}30`,
          boxShadow: `0 32px 100px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.14), 0 0 ${45 * glow}px ${accent}12`,
          backdropFilter: "blur(20px) saturate(1.2)",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "4px 4px", opacity: 0.25 }} />
      </div>

      {/* Block cells */}
      {bmcLayout.map((cell) => {
        const items = blocks[cell.key] ?? []
        const rect = cellRect(cell)
        const cellDelay = delay + 8 + cell.revealOrder * 8
        const cellEnter = softSpring(frame, fps, cellDelay)
        const isValue = cell.key === "value"

        return (
          <div
            key={cell.key}
            style={{
              position: "absolute",
              left: rect.left,
              top: rect.top,
              width: rect.w,
              height: rect.h,
              borderRadius: 12,
              background: isValue
                ? `linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)), ${accent}12`
                : `linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015)), rgba(16,16,24,0.45)`,
              border: `1px solid ${isValue ? `${accent}50` : "rgba(234,236,239,0.1)"}`,
              boxShadow: isValue
                ? `0 0 20px ${accent}18, inset 0 1px 0 rgba(255,255,255,0.12)`
                : "inset 0 1px 0 rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)",
              padding: "10px 12px",
              overflow: "hidden",
              opacity: cellEnter,
              transform: `scale(${0.92 + cellEnter * 0.08})`,
            }}
          >
            {/* Block header */}
            <div
              style={{
                fontFamily: cinematicTheme.font.en,
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: 1.2,
                color: isValue ? accent : cinematicTheme.colors.dim,
                marginBottom: 8,
                textTransform: "uppercase" as const,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {cell.label}
            </div>

            {/* Items */}
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 4, overflow: "hidden" }}>
              {items.map((item, i) => {
                const itemDelay = cellDelay + 6 + i * 4
                const itemOpacity = clampInterpolate(frame, [itemDelay, itemDelay + 14], [0, 1])
                const itemY = clampInterpolate(frame, [itemDelay, itemDelay + 14], [6, 0])
                return (
                  <div
                    key={i}
                    style={{
                      fontFamily: cinematicTheme.font.zh,
                      fontSize: 10,
                      fontWeight: 400,
                      color: "rgba(234,236,239,0.82)",
                      lineHeight: 1.4,
                      opacity: itemOpacity,
                      transform: `translateY(${itemY}px)`,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 5,
                    }}
                  >
                    <span style={{ color: accent, fontSize: 7, marginTop: 3, flexShrink: 0 }}>●</span>
                    <span>{item}</span>
                  </div>
                )
              })}
            </div>

            {/* Accent glow line at top */}
            {isValue && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "10%",
                  right: "10%",
                  height: 1,
                  background: `linear-gradient(90deg, transparent, ${accent}66, transparent)`,
                  boxShadow: `0 0 8px ${accent}44`,
                }}
              />
            )}
          </div>
        )
      })}

      {/* Accent border glow lines between major sections */}
      <div
        style={{
          position: "absolute",
          left: padX,
          top: padY + topRowH * 2 - 1,
          right: padX,
          height: 1,
          background: `linear-gradient(90deg, transparent 5%, ${accent}30 30%, ${accent}40 50%, ${accent}30 70%, transparent 95%)`,
          opacity: containerEnter * 0.7,
        }}
      />

      {/* Scan-line */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 22,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 1,
            top: `${((frame * 0.6) % 100)}%`,
            background: `linear-gradient(90deg, transparent, ${accent}18, transparent)`,
          }}
        />
      </div>
    </div>
  )
}
