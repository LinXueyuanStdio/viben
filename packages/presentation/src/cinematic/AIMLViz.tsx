import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, loopSine, noiseSeed, softSpring, stagger } from "./motion"

// ─── NeuralNetworkViz ─────────────────────────────────────────────────────────

export function NeuralNetworkViz({
  layers = [4, 8, 6, 2],
  activationColor = "purple",
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  layers?: number[]
  activationColor?: CinematicTone
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
  const activeColor = toneColor(activationColor)

  const width = 640
  const height = 380
  const padX = 60
  const padY = 40
  const maxNodes = Math.max(...layers)
  const layerSpacing = (width - padX * 2) / Math.max(1, layers.length - 1)

  function nodePos(layerIdx: number, nodeIdx: number, layerSize: number) {
    const nx = padX + layerIdx * layerSpacing
    const totalHeight = height - padY * 2
    const spacing = totalHeight / Math.max(1, layerSize + 1)
    const ny = padY + spacing * (nodeIdx + 1)
    return { nx, ny }
  }

  // Pulse wave moves left to right through the network
  const pulsePhase = ((frame - delay) % 90) / 90

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
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 240}px) rotateX(${8 - enter * 4}deg) rotateY(${x > 0 ? -6 : 6}deg)`,
        borderRadius: 20,
        background: "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), rgba(10,10,15,0.62)",
        border: `1px solid ${accent}30`,
        boxShadow: `0 28px 80px rgba(0,0,0,0.45), 0 0 40px ${accent}18, inset 0 1px 0 rgba(255,255,255,0.14)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
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
          opacity: 0.5,
        }}
      />
      <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        {/* Connections */}
        {layers.map((layerSize, li) => {
          if (li === layers.length - 1) return null
          const nextSize = layers[li + 1]
          return Array.from({ length: layerSize }, (_, ni) => {
            const { nx: x1, ny: y1 } = nodePos(li, ni, layerSize)
            return Array.from({ length: nextSize }, (_, nj) => {
              const { nx: x2, ny: y2 } = nodePos(li + 1, nj, nextSize)
              const connectionDelay = delay + stagger(li, layers.length, 18)
              const connEnter = softSpring(frame, fps, connectionDelay)
              // Pulse: connection lights up when pulsePhase crosses it
              const connPhase = li / (layers.length - 1)
              const pulseDist = Math.abs(pulsePhase - connPhase)
              const pulseIntensity = Math.max(0, 1 - pulseDist * 4)
              return (
                <line
                  key={`${li}-${ni}-${nj}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={activeColor}
                  strokeWidth={1}
                  strokeOpacity={connEnter * (0.08 + pulseIntensity * 0.35)}
                />
              )
            })
          })
        })}
        {/* Nodes */}
        {layers.map((layerSize, li) => {
          return Array.from({ length: layerSize }, (_, ni) => {
            const { nx, ny } = nodePos(li, ni, layerSize)
            const nodeDelay = delay + stagger(li, layers.length, 20) + stagger(ni, layerSize, 8)
            const nodeEnter = softSpring(frame, fps, nodeDelay)
            // Active glow based on pulse
            const nodePhase = li / (layers.length - 1)
            const activeDist = Math.abs(pulsePhase - nodePhase)
            const isActive = activeDist < 0.15
            const glowRadius = isActive ? 8 + loopSine(frame, 30, ni) * 3 : 4
            const nodeRadius = 6
            return (
              <g key={`node-${li}-${ni}`} opacity={nodeEnter}>
                {/* Glow */}
                <circle
                  cx={nx}
                  cy={ny}
                  r={glowRadius}
                  fill="none"
                  stroke={isActive ? activeColor : accent}
                  strokeWidth={1.5}
                  strokeOpacity={isActive ? 0.6 : 0.2}
                />
                {/* Node body */}
                <circle
                  cx={nx}
                  cy={ny}
                  r={nodeRadius}
                  fill={isActive ? activeColor : `${accent}60`}
                  opacity={isActive ? 0.9 : 0.5}
                />
                {/* Center dot */}
                <circle cx={nx} cy={ny} r={2} fill="#fff" opacity={isActive ? 0.9 : 0.4} />
              </g>
            )
          })
        })}
      </svg>
      {/* Layer labels */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: padX,
          right: padX,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: cinematicTheme.font.mono,
          fontSize: 9,
          letterSpacing: 1.4,
          color: "rgba(234,236,239,0.4)",
        }}
      >
        {layers.map((size, i) => (
          <span key={i}>{size}N</span>
        ))}
      </div>
    </div>
  )
}

// ─── TrainingDashboard ────────────────────────────────────────────────────────

export function TrainingDashboard({
  metrics,
  epoch,
  totalEpochs,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  metrics: Array<{ name: string; values: number[]; target?: number; tone?: CinematicTone }>
  epoch: number
  totalEpochs: number
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

  const width = 560
  const height = 340 + metrics.length * 70

  // Animated epoch counter
  const epochDisplay = clampInterpolate(frame, [delay + 6, delay + 50], [0, epoch])
  const epochProgress = epochDisplay / Math.max(1, totalEpochs)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 220}px) rotateX(${10 - enter * 5}deg)`,
        borderRadius: 20,
        background: "linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.02)), rgba(10,10,15,0.6)",
        border: `1px solid ${accent}30`,
        boxShadow: `0 28px 80px rgba(0,0,0,0.45), 0 0 32px ${accent}15, inset 0 1px 0 rgba(255,255,255,0.13)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        padding: "24px 28px",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: cinematicTheme.font.mono,
          fontSize: 11,
          letterSpacing: 2,
          color: "rgba(234,236,239,0.45)",
          marginBottom: 16,
        }}
      >
        TRAINING PROGRESS
      </div>

      {/* Epoch bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>
            Epoch <span style={{ color: accent }}>{Math.round(epochDisplay)}</span>
            <span style={{ fontSize: 14, color: "rgba(234,236,239,0.4)", marginLeft: 6 }}>/ {totalEpochs}</span>
          </div>
          <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 12, color: accent }}>
            {(epochProgress * 100).toFixed(1)}%
          </div>
        </div>
        <div style={{ height: 4, borderRadius: 4, background: "rgba(234,236,239,0.08)", overflow: "hidden" }}>
          <div
            style={{
              width: `${epochProgress * 100}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${accent}, ${accent}aa)`,
              boxShadow: `0 0 18px ${accent}60`,
              borderRadius: 4,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Metrics */}
      {metrics.map((metric, mi) => {
        const metricDelay = delay + 10 + mi * 6
        const metricEnter = softSpring(frame, fps, metricDelay)
        const metricColor = toneColor(metric.tone ?? tone)
        const values = metric.values
        const currentVal = values.length > 0 ? values[values.length - 1] : 0
        const maxVal = Math.max(...values, metric.target ?? 0, 1)
        const minVal = Math.min(...values, 0)
        const range = maxVal - minVal || 1

        // Sparkline
        const sparkW = 280
        const sparkH = 36

        return (
          <div
            key={metric.name}
            style={{
              opacity: metricEnter,
              transform: `translateY(${(1 - metricEnter) * 14}px)`,
              marginBottom: 18,
              padding: "14px 16px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${metricColor}20`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 10, letterSpacing: 1.5, color: "rgba(234,236,239,0.5)" }}>
                {metric.name.toUpperCase()}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", textShadow: `0 0 16px ${metricColor}40` }}>
                {clampInterpolate(frame, [metricDelay + 4, metricDelay + 40], [0, currentVal]).toFixed(3)}
                {metric.target != null && (
                  <span style={{ fontSize: 11, color: "rgba(234,236,239,0.35)", marginLeft: 6 }}>
                    / {metric.target}
                  </span>
                )}
              </div>
            </div>
            {/* Sparkline SVG */}
            <svg width={sparkW} height={sparkH} style={{ display: "block" }}>
              {/* Target line */}
              {metric.target != null && (
                <line
                  x1={0}
                  y1={sparkH - ((metric.target - minVal) / range) * sparkH}
                  x2={sparkW}
                  y2={sparkH - ((metric.target - minVal) / range) * sparkH}
                  stroke={metricColor}
                  strokeWidth={0.8}
                  strokeDasharray="4 3"
                  strokeOpacity={0.4}
                />
              )}
              {/* Value line */}
              <polyline
                fill="none"
                stroke={metricColor}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={metricEnter}
                points={values
                  .map((v, i) => {
                    const px = (i / Math.max(1, values.length - 1)) * sparkW
                    const py = sparkH - ((v - minVal) / range) * sparkH
                    return `${px},${py}`
                  })
                  .join(" ")}
              />
              {/* Glow under the line */}
              <polyline
                fill="none"
                stroke={metricColor}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={metricEnter * 0.2}
                filter="blur(3px)"
                points={values
                  .map((v, i) => {
                    const px = (i / Math.max(1, values.length - 1)) * sparkW
                    const py = sparkH - ((v - minVal) / range) * sparkH
                    return `${px},${py}`
                  })
                  .join(" ")}
              />
            </svg>
          </div>
        )
      })}
    </div>
  )
}

// ─── ModelComparison ──────────────────────────────────────────────────────────

export function ModelComparison({
  models,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  models: Array<{ name: string; metrics: Array<{ label: string; value: number }>; tone?: CinematicTone }>
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

  const cardWidth = 240
  const cardGap = 20
  const totalWidth = models.length * cardWidth + (models.length - 1) * cardGap

  // Determine best values per metric
  const allLabels = models.length > 0 ? models[0].metrics.map((m) => m.label) : []
  const bestPerMetric: Record<string, number> = {}
  for (const label of allLabels) {
    let best = -Infinity
    for (const model of models) {
      const found = model.metrics.find((m) => m.label === label)
      if (found && found.value > best) best = found.value
    }
    bestPerMetric[label] = best
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: totalWidth + 48,
        marginLeft: -(totalWidth + 48) / 2,
        marginTop: -160,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 200}px) rotateX(${8 - enter * 4}deg)`,
        display: "flex",
        gap: cardGap,
        padding: 24,
        borderRadius: 22,
        background: "rgba(10,10,15,0.5)",
        border: `1px solid ${accent}22`,
        boxShadow: `0 32px 90px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)`,
        backdropFilter: "blur(18px)",
      }}
    >
      {models.map((model, mi) => {
        const cardDelay = delay + 8 + mi * 10
        const cardEnter = softSpring(frame, fps, cardDelay)
        const cardColor = toneColor(model.tone ?? tone)
        const slideDir = mi < models.length / 2 ? -1 : 1

        return (
          <div
            key={model.name}
            style={{
              width: cardWidth,
              opacity: cardEnter,
              transform: `translateX(${(1 - cardEnter) * slideDir * 60}px)`,
              borderRadius: 16,
              background: "rgba(12,12,18,0.6)",
              border: `1px solid ${cardColor}30`,
              boxShadow: `0 14px 40px rgba(0,0,0,0.3), 0 0 20px ${cardColor}10, inset 0 1px 0 rgba(255,255,255,0.1)`,
              padding: "18px 16px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Card top accent */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: `linear-gradient(90deg, transparent, ${cardColor}, transparent)`,
                opacity: 0.7,
              }}
            />
            {/* Model name */}
            <div
              style={{
                fontFamily: cinematicTheme.font.en,
                fontSize: 15,
                fontWeight: 800,
                color: "#fff",
                marginBottom: 16,
                textShadow: `0 0 12px ${cardColor}30`,
              }}
            >
              {model.name}
            </div>
            {/* Metrics */}
            {model.metrics.map((metric, metricIdx) => {
              const barDelay = cardDelay + 6 + metricIdx * 4
              const barEnter = softSpring(frame, fps, barDelay)
              const isBest = metric.value === bestPerMetric[metric.label]
              const maxForBar = Math.max(...models.flatMap((m) => m.metrics.filter((mm) => mm.label === metric.label).map((mm) => mm.value)), 1)
              const barPercent = (metric.value / maxForBar) * 100

              return (
                <div key={metric.label} style={{ marginBottom: 12, opacity: barEnter }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span
                      style={{
                        fontFamily: cinematicTheme.font.mono,
                        fontSize: 9,
                        letterSpacing: 1.2,
                        color: "rgba(234,236,239,0.5)",
                      }}
                    >
                      {metric.label.toUpperCase()}
                    </span>
                    <span
                      style={{
                        fontFamily: cinematicTheme.font.mono,
                        fontSize: 11,
                        fontWeight: 700,
                        color: isBest ? cardColor : "rgba(234,236,239,0.7)",
                        textShadow: isBest ? `0 0 10px ${cardColor}60` : "none",
                      }}
                    >
                      {metric.value.toFixed(1)}
                      {isBest && " ★"}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: "rgba(234,236,239,0.08)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${barPercent * barEnter}%`,
                        height: "100%",
                        borderRadius: 4,
                        background: isBest
                          ? `linear-gradient(90deg, ${cardColor}, ${cardColor}cc)`
                          : `linear-gradient(90deg, rgba(234,236,239,0.3), rgba(234,236,239,0.15))`,
                        boxShadow: isBest ? `0 0 12px ${cardColor}50` : "none",
                      }}
                    />
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

// ─── AttentionMatrix ──────────────────────────────────────────────────────────

export function AttentionMatrix({
  tokens,
  weights,
  headLabel,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  tokens: string[]
  weights: number[][]
  headLabel?: string
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

  const cellSize = 38
  const labelPad = 60
  const n = tokens.length
  const gridSize = n * cellSize
  const totalW = gridSize + labelPad + 32
  const totalH = gridSize + labelPad + 56

  // Scan line moves diagonally
  const scanProgress = ((frame - delay) % 80) / 80

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
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 220}px) rotateX(${10 - enter * 5}deg) rotateY(${x > 0 ? -4 : 4}deg)`,
        borderRadius: 20,
        background: "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), rgba(10,10,15,0.62)",
        border: `1px solid ${accent}30`,
        boxShadow: `0 28px 80px rgba(0,0,0,0.45), 0 0 36px ${accent}15, inset 0 1px 0 rgba(255,255,255,0.13)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        padding: "20px 16px",
      }}
    >
      {/* Head label */}
      {headLabel && (
        <div
          style={{
            fontFamily: cinematicTheme.font.mono,
            fontSize: 10,
            letterSpacing: 2,
            color: "rgba(234,236,239,0.45)",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          {headLabel.toUpperCase()}
        </div>
      )}

      {/* Matrix container */}
      <div style={{ position: "relative", marginLeft: labelPad }}>
        {/* Column headers (tokens on top) */}
        <div style={{ display: "flex", marginBottom: 4, height: 20 }}>
          {tokens.map((tok, ci) => {
            const headerDelay = delay + 6 + ci * 2
            const headerEnter = softSpring(frame, fps, headerDelay)
            return (
              <div
                key={`col-${ci}`}
                style={{
                  width: cellSize,
                  textAlign: "center",
                  fontFamily: cinematicTheme.font.mono,
                  fontSize: 9,
                  color: "rgba(234,236,239,0.5)",
                  opacity: headerEnter,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {tok}
              </div>
            )
          })}
        </div>

        {/* Rows */}
        {tokens.map((tok, ri) => {
          const rowDelay = delay + 10 + ri * 3
          const rowEnter = softSpring(frame, fps, rowDelay)

          return (
            <div key={`row-${ri}`} style={{ display: "flex", alignItems: "center", opacity: rowEnter }}>
              {/* Row label */}
              <div
                style={{
                  position: "absolute",
                  left: -labelPad,
                  width: labelPad - 6,
                  textAlign: "right",
                  fontFamily: cinematicTheme.font.mono,
                  fontSize: 9,
                  color: "rgba(234,236,239,0.5)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {tok}
              </div>
              {/* Cells */}
              {(weights[ri] ?? []).map((w, ci) => {
                const cellDelay = delay + 12 + stagger(ri * n + ci, n * n, 30)
                const cellEnter = softSpring(frame, fps, cellDelay)
                const clampedW = Math.max(0, Math.min(1, w))
                // Scan highlight
                const scanRow = Math.floor(scanProgress * n)
                const isScanRow = ri === scanRow
                const brightness = clampedW * cellEnter
                const noise = noiseSeed(ri, ci)

                return (
                  <div
                    key={`cell-${ri}-${ci}`}
                    style={{
                      width: cellSize - 2,
                      height: cellSize - 2,
                      margin: 1,
                      borderRadius: 4,
                      background: accent,
                      opacity: brightness * 0.85 + 0.04,
                      boxShadow: brightness > 0.6 ? `0 0 ${8 * brightness}px ${accent}60` : "none",
                      border: isScanRow ? `1px solid ${accent}50` : "1px solid transparent",
                      transform: `scale(${0.85 + cellEnter * 0.15})`,
                      position: "relative",
                    }}
                  >
                    {/* Value text for high attention */}
                    {clampedW > 0.5 && cellEnter > 0.8 && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: cinematicTheme.font.mono,
                          fontSize: 8,
                          color: "#fff",
                          opacity: 0.8,
                        }}
                      >
                        {clampedW.toFixed(2)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Scan line overlay */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 20 + Math.floor(scanProgress * n) * cellSize,
            height: cellSize,
            background: `linear-gradient(180deg, transparent, ${accent}12, transparent)`,
            pointerEvents: "none",
            borderRadius: 4,
          }}
        />
      </div>
    </div>
  )
}
