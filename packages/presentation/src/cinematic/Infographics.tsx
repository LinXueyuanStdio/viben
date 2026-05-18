import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, loopSine, softSpring } from "./motion"

export interface PyramidLayer {
  title: string
  subtitle: string
  value?: string
  tone: CinematicTone
}

export function PyramidInfoScene({
  layers,
  title,
  delay = 0,
}: {
  layers: PyramidLayer[]
  title: string
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const titleEnter = softSpring(frame, fps, delay)
  const count = layers.length
  const buildProgress = clampInterpolate(frame, [delay + 10, delay + 10 + count * 12], [0, 1])
  const cameraTilt = 58 - buildProgress * 8

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 60,
          opacity: titleEnter,
          transform: `translateY(${(1 - titleEnter) * 20}px)`,
          zIndex: 5,
        }}
      >
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 11, letterSpacing: 2.2, color: cinematicTheme.colors.gold }}>{title.toUpperCase()}</div>
      </div>

      {/* Pyramid layers */}
      {layers.map((layer, index) => {
        const layerDelay = delay + 10 + (count - 1 - index) * 12
        const enter = softSpring(frame, fps, layerDelay)
        const accent = toneColor(layer.tone)
        const w = 840 - index * (400 / count)
        const h = 72
        const yPos = 180 + (count - 1 - index) * 94
        const z = -80 + index * 50
        const drift = loopSine(frame, 200 + index * 15, index) * 2

        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: w,
              height: h,
              marginLeft: -w / 2,
              marginTop: -h / 2,
              opacity: enter,
              transformStyle: "preserve-3d",
              transform: `translate3d(0, ${yPos - 340 + (1 - enter) * 80 + drift}px, ${z - (1 - enter) * 200}px) rotateX(${cameraTilt}deg)`,
              borderRadius: 16,
              background: `linear-gradient(90deg, rgba(255,255,255,0.04), ${accent}18, rgba(255,255,255,0.03))`,
              border: `1px solid ${accent}45`,
              boxShadow: `0 16px 48px rgba(0,0,0,0.36), 0 0 28px ${accent}1A, inset 0 1px 0 rgba(255,255,255,0.14)`,
              backdropFilter: "blur(14px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 28px",
            }}
          >
            <div>
              <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 22, fontWeight: 800, color: "#fff" }}>{layer.title}</div>
              <div style={{ marginTop: 3, fontSize: 10, letterSpacing: 1.4, color: "rgba(234,236,239,0.5)" }}>{layer.subtitle}</div>
            </div>
            {layer.value && (
              <div style={{ fontSize: 22, fontWeight: 800, color: accent, textShadow: `0 0 18px ${accent}44` }}>{layer.value}</div>
            )}
            {/* Edge glow */}
            <div style={{ position: "absolute", inset: -1, borderRadius: 16, border: `1px solid ${accent}30`, opacity: enter * 0.5, boxShadow: `0 0 16px ${accent}20` }} />
          </div>
        )
      })}

      {/* Volumetric fog between layers */}
      <div
        style={{
          position: "absolute",
          left: "30%",
          bottom: "15%",
          width: "40%",
          height: "20%",
          background: `radial-gradient(ellipse, rgba(214,179,106,0.08) 0%, transparent 70%)`,
          filter: "blur(40px)",
          transform: `translateY(${loopSine(frame, 180) * 10}px)`,
        }}
      />
    </div>
  )
}

export interface ChainStep {
  title: string
  body?: string
  tone: CinematicTone
}

export function CausalChainScene({
  steps,
  title,
  layout = "horizontal",
  delay = 0,
}: {
  steps: ChainStep[]
  title: string
  layout?: "horizontal" | "s-curve"
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const titleEnter = softSpring(frame, fps, delay)
  const count = steps.length

  const positions = steps.map((_, i) => {
    if (layout === "s-curve") {
      const row = Math.floor(i / 3)
      const col = row % 2 === 0 ? i % 3 : 2 - (i % 3)
      return { x: -340 + col * 340, y: -180 + row * 200 }
    }
    return { x: -((count - 1) * 180) / 2 + i * 180, y: 0 }
  })

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 60,
          opacity: titleEnter,
          zIndex: 5,
        }}
      >
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 11, letterSpacing: 2.2, color: cinematicTheme.colors.gold }}>{title.toUpperCase()}</div>
      </div>

      {/* Connection lines with particle flow */}
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id="chain-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {steps.slice(0, -1).map((_step, i) => {
          const lineDelay = delay + 14 + i * 10
          const draw = clampInterpolate(frame, [lineDelay, lineDelay + 28], [0, 1])
          const from = positions[i]
          const to = positions[i + 1]
          const accent = toneColor(steps[i + 1].tone)
          const fx = 960 + from.x + 80
          const fy = 540 + from.y
          const tx = 960 + to.x - 80
          const ty = 540 + to.y
          const mx = (fx + tx) / 2
          const my = (fy + ty) / 2 - 30

          return (
            <g key={i} opacity={draw}>
              <path
                d={`M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}`}
                fill="none"
                stroke={accent}
                strokeWidth={2}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - draw}
                filter="url(#chain-glow)"
                opacity={0.6}
              />
              {/* Flow particles */}
              {[0, 0.3, 0.6].map((offset) => {
                const t = ((frame * 0.02 + offset) % 1) * draw
                const px = fx + (tx - fx) * t
                const py = fy + (ty - fy) * t - 30 * Math.sin(t * Math.PI)
                return <circle key={offset} cx={px} cy={py} r={2.5} fill={accent} opacity={0.7 * draw} />
              })}
              {/* Arrow head */}
              <polygon
                points={`${tx},${ty} ${tx - 10},${ty - 5} ${tx - 10},${ty + 5}`}
                fill={accent}
                opacity={draw * 0.7}
              />
            </g>
          )
        })}
      </svg>

      {/* Step nodes */}
      {steps.map((step, i) => {
        const nodeEnter = softSpring(frame, fps, delay + 8 + i * 10)
        const accent = toneColor(step.tone)
        const pos = positions[i]
        const drift = loopSine(frame, 170 + i * 13, i) * 3

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 160,
              minHeight: 76,
              marginLeft: -80,
              marginTop: -38,
              opacity: nodeEnter,
              transform: `translate3d(${pos.x}px, ${pos.y + drift}px, ${-(1 - nodeEnter) * 180}px) scale(${0.86 + nodeEnter * 0.14})`,
              borderRadius: 14,
              padding: "14px 16px",
              background: `linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03)), radial-gradient(circle at 20% 0%, ${accent}28, transparent 50%), rgba(12,12,18,0.66)`,
              border: `1px solid ${accent}40`,
              boxShadow: `0 16px 46px rgba(0,0,0,0.4), 0 0 22px ${accent}18, inset 0 1px 0 rgba(255,255,255,0.14)`,
              backdropFilter: "blur(16px)",
            }}
          >
            <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 17, fontWeight: 800, color: "#fff" }}>{step.title}</div>
            {step.body && <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5, color: "rgba(234,236,239,0.56)" }}>{step.body}</div>}
            <div style={{ position: "absolute", left: 14, top: 14, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: accent, background: `${accent}20`, border: `1px solid ${accent}40` }}>
              {i + 1}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export interface FlowTarget {
  title: string
  value: string
  percentage: number
  tone: CinematicTone
}

export function CapitalFlowDiagram({
  source,
  targets,
  title,
  delay = 0,
}: {
  source: { title: string; value: string }
  targets: FlowTarget[]
  title: string
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const centerEnter = softSpring(frame, fps, delay)
  const count = targets.length

  const targetPositions = targets.map((_, i) => {
    const angle = -Math.PI * 0.7 + (i / Math.max(1, count - 1)) * Math.PI * 1.4
    const radius = 320
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.6 }
  })

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      {/* Title */}
      <div style={{ position: "absolute", left: 80, top: 60, opacity: centerEnter, zIndex: 5 }}>
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 11, letterSpacing: 2.2, color: cinematicTheme.colors.gold }}>{title.toUpperCase()}</div>
      </div>

      {/* Flow lines */}
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id="flow-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {targets.map((target, i) => {
          const lineDelay = delay + 16 + i * 6
          const draw = clampInterpolate(frame, [lineDelay, lineDelay + 24], [0, 1])
          const pos = targetPositions[i]
          const accent = toneColor(target.tone)
          const lineWidth = 1 + (target.percentage / 100) * 4

          return (
            <g key={i} opacity={draw}>
              <line
                x1={960} y1={540}
                x2={960 + pos.x} y2={540 + pos.y}
                stroke={accent}
                strokeWidth={lineWidth}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - draw}
                filter="url(#flow-glow)"
                opacity={0.5}
              />
              {/* Flowing particles */}
              {[0.2, 0.5, 0.8].map((offset) => {
                const t = ((frame * 0.025 + offset) % 1) * draw
                return (
                  <circle
                    key={offset}
                    cx={960 + pos.x * t}
                    cy={540 + pos.y * t}
                    r={2 + lineWidth * 0.5}
                    fill={accent}
                    opacity={0.6 * draw}
                  />
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* Source (center) node */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 180,
          height: 90,
          marginLeft: -90,
          marginTop: -45,
          opacity: centerEnter,
          transform: `scale(${0.7 + centerEnter * 0.3})`,
          borderRadius: 18,
          background: `linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04)), rgba(12,12,18,0.72)`,
          border: `1.5px solid ${cinematicTheme.colors.gold}60`,
          boxShadow: `0 0 50px ${cinematicTheme.colors.gold}28, 0 24px 60px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.18)`,
          backdropFilter: "blur(20px)",
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 20, fontWeight: 800, color: "#fff" }}>{source.title}</div>
        <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: cinematicTheme.colors.gold }}>{source.value}</div>
      </div>

      {/* Target nodes */}
      {targets.map((target, i) => {
        const nodeEnter = softSpring(frame, fps, delay + 20 + i * 6)
        const accent = toneColor(target.tone)
        const pos = targetPositions[i]
        const valueDisplay = clampInterpolate(frame, [delay + 26 + i * 6, delay + 60 + i * 6], [0, target.percentage])

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 150,
              minHeight: 70,
              marginLeft: -75,
              marginTop: -35,
              opacity: nodeEnter,
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${0.84 + nodeEnter * 0.16})`,
              borderRadius: 13,
              padding: "12px 14px",
              background: `linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)), rgba(12,12,18,0.6)`,
              border: `1px solid ${accent}38`,
              boxShadow: `0 14px 40px rgba(0,0,0,0.36), 0 0 20px ${accent}16, inset 0 1px 0 rgba(255,255,255,0.12)`,
              backdropFilter: "blur(14px)",
              textAlign: "center" as const,
            }}
          >
            <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 14, fontWeight: 700, color: "#fff" }}>{target.title}</div>
            <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: accent }}>{Math.round(valueDisplay)}%</div>
            <div style={{ marginTop: 2, fontSize: 11, color: "rgba(234,236,239,0.5)", fontFamily: cinematicTheme.font.mono }}>{target.value}</div>
          </div>
        )
      })}
    </div>
  )
}

export interface ExplanationLayer {
  depth: number
  title: string
  body: string
  tone: CinematicTone
}

export function LayeredExplanation({
  layers,
  title,
  delay = 0,
}: {
  layers: ExplanationLayer[]
  title: string
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const titleEnter = softSpring(frame, fps, delay)
  const sorted = [...layers].sort((a, b) => b.depth - a.depth)

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", perspective: 1400 }}>
      {/* Title */}
      <div style={{ position: "absolute", left: 80, top: 60, opacity: titleEnter, zIndex: 10 }}>
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 11, letterSpacing: 2.2, color: cinematicTheme.colors.gold }}>{title.toUpperCase()}</div>
      </div>

      {sorted.map((layer, i) => {
        const layerDelay = delay + 6 + i * 12
        const enter = softSpring(frame, fps, layerDelay)
        const accent = toneColor(layer.tone)
        const zOffset = -layer.depth * 200
        const blur = layer.depth * 2.5
        const drift = loopSine(frame, 180 + i * 20, i) * 3
        const width = 460 - layer.depth * 40
        const yOffset = -140 + i * 120

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width,
              minHeight: 100,
              marginLeft: -width / 2,
              marginTop: -50,
              opacity: enter * (1 - layer.depth * 0.15),
              transformStyle: "preserve-3d",
              transform: `translate3d(0, ${yOffset + drift}px, ${zOffset - (1 - enter) * 300}px)`,
              filter: `blur(${blur * (1 - enter * 0.5)}px)`,
              borderRadius: 18,
              padding: "20px 22px",
              background: `linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)), radial-gradient(circle at 20% 10%, ${accent}20, transparent 50%), rgba(12,12,18,0.6)`,
              border: `1px solid ${accent}35`,
              boxShadow: `0 20px 56px rgba(0,0,0,0.38), 0 0 24px ${accent}14, inset 0 1px 0 rgba(255,255,255,0.12)`,
              backdropFilter: "blur(14px)",
            }}
          >
            <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 20, fontWeight: 800, color: "#fff" }}>{layer.title}</div>
            <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.7, color: "rgba(234,236,239,0.6)" }}>{layer.body}</div>
            <div style={{ position: "absolute", right: 16, top: 16, fontFamily: cinematicTheme.font.mono, fontSize: 9, color: accent, opacity: 0.6 }}>
              DEPTH / {layer.depth}
            </div>
          </div>
        )
      })}
    </div>
  )
}
