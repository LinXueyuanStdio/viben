import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, softSpring, stagger, loopSine, noiseSeed, smoothStep, particleTrail } from "./motion"

/* ─────────────────────────────────────────────────────────────────────────────
 * ParticleField
 * A field of animated particles with emergent behavior and connecting lines.
 * ────────────────────────────────────────────────────────────────────────── */

export interface ParticleFieldProps {
  count?: number
  behavior?: "drift" | "orbit" | "explode" | "converge"
  colors?: string[]
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function ParticleField({
  count = 80,
  behavior = "drift",
  colors,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 600,
  height = 400,
}: ParticleFieldProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const enter = softSpring(frame, fps, delay)
  const fadeIn = clampInterpolate(frame, [delay, delay + 20], [0, 1], cinematicTheme.easing.cinematic)

  const palette = colors ?? [accent, cinematicTheme.colors.coldWhite, cinematicTheme.colors.purple, cinematicTheme.colors.amber]
  const cx = width / 2
  const cy = height / 2
  const connectionThreshold = 60

  // Generate particle positions based on behavior
  const particles = Array.from({ length: count }, (_, i) => {
    const seed1 = noiseSeed(i, 0)
    const seed2 = noiseSeed(i, 1)
    const seed3 = noiseSeed(i, 2)
    const seed4 = noiseSeed(i, 3)

    // Base random position
    const baseX = seed1 * width
    const baseY = seed2 * height
    const size = 2 + seed3 * 4
    const baseOpacity = 0.3 + seed4 * 0.7

    let px: number
    let py: number

    const f = Math.max(0, frame - delay)

    switch (behavior) {
      case "drift": {
        const driftX = loopSine(f, 80 + seed1 * 60, seed2 * Math.PI * 2) * 30
        const driftY = loopSine(f, 100 + seed2 * 50, seed1 * Math.PI * 2) * 25
        px = baseX + driftX
        py = baseY + driftY
        break
      }
      case "orbit": {
        const angle = (i / count) * Math.PI * 2 + f * (0.01 + seed1 * 0.02)
        const radiusX = 80 + seed2 * (width / 2 - 100)
        const radiusY = 60 + seed3 * (height / 2 - 80)
        px = cx + Math.cos(angle) * radiusX
        py = cy + Math.sin(angle) * radiusY
        break
      }
      case "explode": {
        const progress = softSpring(frame, fps, delay + stagger(i, count, 15))
        const angle = seed1 * Math.PI * 2
        const maxDist = 40 + seed2 * (Math.min(width, height) / 2 - 40)
        px = cx + Math.cos(angle) * maxDist * progress
        py = cy + Math.sin(angle) * maxDist * progress
        break
      }
      case "converge": {
        const progress = softSpring(frame, fps, delay + stagger(i, count, 15))
        const angle = seed1 * Math.PI * 2
        const maxDist = 40 + seed2 * (Math.min(width, height) / 2 - 40)
        px = cx + Math.cos(angle) * maxDist * (1 - progress)
        py = cy + Math.sin(angle) * maxDist * (1 - progress)
        break
      }
    }

    return { px, py, size, opacity: baseOpacity, colorIdx: i % palette.length, seed1 }
  })

  // Find connections between nearby particles
  const connections: Array<{ x1: number; y1: number; x2: number; y2: number; opacity: number }> = []
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].px - particles[j].px
      const dy = particles[i].py - particles[j].py
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < connectionThreshold) {
        connections.push({
          x1: particles[i].px,
          y1: particles[i].py,
          x2: particles[j].px,
          y2: particles[j].py,
          opacity: (1 - dist / connectionThreshold) * 0.4,
        })
      }
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
        opacity: fadeIn,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: "visible" }}
      >
        <defs>
          <filter id={`particle-glow-${delay}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines */}
        {connections.map((conn, i) => (
          <line
            key={`conn-${i}`}
            x1={conn.x1}
            y1={conn.y1}
            x2={conn.x2}
            y2={conn.y2}
            stroke={accent}
            strokeWidth={0.5}
            opacity={conn.opacity * enter}
          />
        ))}

        {/* Particles */}
        {particles.map((p, i) => {
          const glowFilter = p.size > 4 ? `url(#particle-glow-${delay})` : undefined
          return (
            <circle
              key={`p-${i}`}
              cx={p.px}
              cy={p.py}
              r={p.size * enter}
              fill={palette[p.colorIdx]}
              opacity={p.opacity * enter}
              filter={glowFilter}
            />
          )
        })}
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * WaveformVisualizer
 * An audio waveform-style visualization with multiple display modes.
 * ────────────────────────────────────────────────────────────────────────── */

export interface WaveformVisualizerProps {
  bars?: number
  mode?: "bars" | "wave" | "circular"
  amplitude?: number
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function WaveformVisualizer({
  bars = 32,
  mode = "bars",
  amplitude = 0.7,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 480,
  height = 200,
}: WaveformVisualizerProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const enter = softSpring(frame, fps, delay)

  const f = Math.max(0, frame - delay)
  const barWidth = mode === "circular" ? 3 : (width / bars) * 0.7
  const barGap = mode === "circular" ? 0 : (width / bars) * 0.3

  // Generate bar heights from noise/sine
  const barHeights = Array.from({ length: bars }, (_, i) => {
    const period = 20 + noiseSeed(i, 7) * 40
    const phase = noiseSeed(i, 13) * Math.PI * 2
    const h = (loopSine(f, period, phase) * 0.5 + 0.5) * amplitude
    // Add a secondary frequency for complexity
    const period2 = 35 + noiseSeed(i, 19) * 30
    const h2 = (loopSine(f, period2, phase + 1.5) * 0.5 + 0.5) * amplitude * 0.4
    return Math.min(1, h + h2)
  })

  // Color interpolation: low = cold, high = warm
  const barColor = (index: number, barHeight: number) => {
    const t = index / bars
    if (t < 0.33) return cinematicTheme.colors.purple
    if (t < 0.66) return accent
    return cinematicTheme.colors.magenta
  }

  const renderBars = () => {
    const maxBarHeight = height * 0.75
    return (
      <>
        {barHeights.map((h, i) => {
          const barH = h * maxBarHeight * enter
          const staggerDelay = stagger(Math.abs(i - bars / 2), bars / 2, 12)
          const barEnter = softSpring(frame, fps, delay + staggerDelay)
          const bx = i * (barWidth + barGap) + barGap / 2
          const by = height / 2 - barH / 2
          const color = barColor(i, h)
          const isPeak = h > 0.75
          return (
            <g key={`bar-${i}`}>
              {/* Main bar */}
              <rect
                x={bx}
                y={by}
                width={barWidth}
                height={barH * barEnter}
                rx={barWidth / 2}
                fill={color}
                opacity={0.85 * enter}
                filter={isPeak ? `url(#waveform-glow-${delay})` : undefined}
              />
              {/* Mirror reflection */}
              <rect
                x={bx}
                y={height / 2 + barH / 2}
                width={barWidth}
                height={barH * barEnter * 0.4}
                rx={barWidth / 2}
                fill={color}
                opacity={0.25 * enter}
              />
            </g>
          )
        })}
      </>
    )
  }

  const renderWave = () => {
    const midY = height / 2
    const maxAmp = height * 0.35 * amplitude
    const points = barHeights.map((h, i) => {
      const px = (i / (bars - 1)) * width
      const py = midY - (h - 0.5) * 2 * maxAmp * enter
      return `${px},${py}`
    })
    const pathD = `M ${points[0]} ` + points.slice(1).map((p) => `L ${p}`).join(" ")

    // Mirror path
    const mirrorPoints = barHeights.map((h, i) => {
      const px = (i / (bars - 1)) * width
      const py = midY + (h - 0.5) * 2 * maxAmp * enter * 0.4
      return `${px},${py}`
    })
    const mirrorD = `M ${mirrorPoints[0]} ` + mirrorPoints.slice(1).map((p) => `L ${p}`).join(" ")

    return (
      <>
        <path
          d={pathD}
          fill="none"
          stroke={accent}
          strokeWidth={2.5}
          opacity={0.9 * enter}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={mirrorD}
          fill="none"
          stroke={accent}
          strokeWidth={1.5}
          opacity={0.25 * enter}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    )
  }

  const renderCircular = () => {
    const centerX = width / 2
    const centerY = height / 2
    const baseRadius = Math.min(width, height) * 0.25
    const maxBarH = Math.min(width, height) * 0.2

    return (
      <>
        {barHeights.map((h, i) => {
          const angle = (i / bars) * Math.PI * 2 - Math.PI / 2
          const barH = h * maxBarH * enter
          const staggerDelay = stagger(i, bars, 12)
          const barEnter = softSpring(frame, fps, delay + staggerDelay)
          const innerR = baseRadius
          const outerR = baseRadius + barH * barEnter
          const x1 = centerX + Math.cos(angle) * innerR
          const y1 = centerY + Math.sin(angle) * innerR
          const x2 = centerX + Math.cos(angle) * outerR
          const y2 = centerY + Math.sin(angle) * outerR
          const color = barColor(i, h)
          const isPeak = h > 0.75
          return (
            <line
              key={`cbar-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={barWidth}
              strokeLinecap="round"
              opacity={0.85 * enter}
              filter={isPeak ? `url(#waveform-glow-${delay})` : undefined}
            />
          )
        })}
      </>
    )
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
        opacity: enter,
      }}
    >
      {/* Glassmorphism background */}
      <div
        style={{
          position: "absolute",
          inset: -16,
          borderRadius: 18,
          background: cinematicTheme.colors.glass,
          backdropFilter: "blur(18px)",
          border: `1px solid ${cinematicTheme.colors.line}`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
      />
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "relative", overflow: "visible" }}
      >
        <defs>
          <filter id={`waveform-glow-${delay}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {mode === "bars" && renderBars()}
        {mode === "wave" && renderWave()}
        {mode === "circular" && renderCircular()}
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * GradientMesh
 * An animated gradient mesh creating organic flowing color fields.
 * ────────────────────────────────────────────────────────────────────────── */

export interface GradientMeshProps {
  colors?: string[]
  complexity?: number
  speed?: number
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function GradientMesh({
  colors,
  complexity = 4,
  speed = 1,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 500,
  height = 400,
}: GradientMeshProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const enter = softSpring(frame, fps, delay)

  const f = Math.max(0, frame - delay) * speed

  const palette = colors ?? [
    accent,
    cinematicTheme.colors.purple,
    cinematicTheme.colors.magenta,
    cinematicTheme.colors.amber,
    cinematicTheme.colors.coldWhite,
  ].slice(0, Math.max(complexity, 2))

  // Generate gradient point positions using Lissajous curves
  const points = Array.from({ length: complexity }, (_, i) => {
    const seed1 = noiseSeed(i, 5)
    const seed2 = noiseSeed(i, 11)
    const periodX = 60 + seed1 * 80
    const periodY = 70 + seed2 * 90
    const phaseX = seed1 * Math.PI * 2
    const phaseY = seed2 * Math.PI * 2

    const px = 0.2 + (loopSine(f, periodX, phaseX) * 0.5 + 0.5) * 0.6
    const py = 0.2 + (loopSine(f, periodY, phaseY) * 0.5 + 0.5) * 0.6
    const radius = 0.3 + seed1 * 0.3

    return { px, py, radius, color: palette[i % palette.length] }
  })

  const filterId = `gradient-mesh-blur-${delay}`

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
        opacity: enter,
      }}
    >
      {/* Glassmorphism border frame */}
      <div
        style={{
          position: "absolute",
          inset: -2,
          borderRadius: 20,
          border: `1px solid ${cinematicTheme.colors.line}`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.3)`,
          pointerEvents: "none",
        }}
      />
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ borderRadius: 18, overflow: "hidden" }}
      >
        <defs>
          <filter id={filterId}>
            <feGaussianBlur stdDeviation="40" />
          </filter>
          {points.map((pt, i) => (
            <radialGradient
              key={`grad-${i}`}
              id={`mesh-grad-${delay}-${i}`}
              cx={pt.px}
              cy={pt.py}
              r={pt.radius}
            >
              <stop offset="0%" stopColor={pt.color} stopOpacity={0.8} />
              <stop offset="70%" stopColor={pt.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={pt.color} stopOpacity={0} />
            </radialGradient>
          ))}
        </defs>

        {/* Dark background */}
        <rect width={width} height={height} fill={cinematicTheme.colors.graphite} />

        {/* Gradient blobs — blurred circles */}
        <g filter={`url(#${filterId})`}>
          {points.map((pt, i) => (
            <ellipse
              key={`blob-${i}`}
              cx={pt.px * width}
              cy={pt.py * height}
              rx={pt.radius * width * 0.8}
              ry={pt.radius * height * 0.8}
              fill={`url(#mesh-grad-${delay}-${i})`}
              opacity={0.7}
            />
          ))}
        </g>

        {/* Subtle noise overlay for texture */}
        <rect
          width={width}
          height={height}
          fill={cinematicTheme.colors.black}
          opacity={0.15}
        />
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * GeometricPattern
 * A tessellating geometric pattern with animated reveals.
 * ────────────────────────────────────────────────────────────────────────── */

export interface GeometricPatternProps {
  pattern?: "hexagon" | "triangle" | "diamond" | "circle"
  rows?: number
  cols?: number
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function GeometricPattern({
  pattern = "hexagon",
  rows = 5,
  cols = 7,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 560,
  height = 400,
}: GeometricPatternProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const enter = softSpring(frame, fps, delay)

  // Scale entrance
  const scaleEnter = clampInterpolate(frame, [delay, delay + 30], [0.8, 1], cinematicTheme.easing.outExpo)

  const cellWidth = width / cols
  const cellHeight = height / rows
  const centerCol = (cols - 1) / 2
  const centerRow = (rows - 1) / 2

  // Accent color variations
  const toneShades = [
    accent,
    cinematicTheme.colors.coldWhite,
    cinematicTheme.colors.dim,
  ]

  // Generate cells
  const cells: Array<{
    cx: number
    cy: number
    col: number
    row: number
    distFromCenter: number
    shapePoints: string
    shapeType: string
  }> = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let cx: number
      let cy: number

      switch (pattern) {
        case "hexagon": {
          const hexW = cellWidth
          const hexH = cellHeight
          cx = c * hexW * 0.75 + hexW / 2
          cy = r * hexH + (c % 2 === 0 ? 0 : hexH / 2) + hexH / 2
          break
        }
        default: {
          cx = c * cellWidth + cellWidth / 2
          cy = r * cellHeight + cellHeight / 2
          break
        }
      }

      const distFromCenter = Math.sqrt(
        Math.pow((c - centerCol) / cols, 2) + Math.pow((r - centerRow) / rows, 2)
      )

      cells.push({ cx, cy, col: c, row: r, distFromCenter, shapePoints: "", shapeType: pattern })
    }
  }

  // Shape path generators
  const hexagonPath = (cx: number, cy: number, size: number) => {
    const points = Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 6
      return `${cx + Math.cos(angle) * size},${cy + Math.sin(angle) * size}`
    })
    return `M ${points.join(" L ")} Z`
  }

  const trianglePath = (cx: number, cy: number, size: number, flipped: boolean) => {
    if (flipped) {
      return `M ${cx},${cy + size * 0.7} L ${cx - size * 0.7},${cy - size * 0.5} L ${cx + size * 0.7},${cy - size * 0.5} Z`
    }
    return `M ${cx},${cy - size * 0.7} L ${cx - size * 0.7},${cy + size * 0.5} L ${cx + size * 0.7},${cy + size * 0.5} Z`
  }

  const diamondPath = (cx: number, cy: number, size: number) => {
    return `M ${cx},${cy - size} L ${cx + size * 0.7},${cy} L ${cx},${cy + size} L ${cx - size * 0.7},${cy} Z`
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${scaleEnter})`,
        opacity: enter,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: "visible" }}
      >
        <defs>
          <filter id={`geo-glow-${delay}`}>
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {cells.map((cell, i) => {
          const { cx, cy, col, row, distFromCenter } = cell
          // Stagger from center outward
          const revealDelay = delay + Math.round(distFromCenter * 40)
          const cellEnter = softSpring(frame, fps, revealDelay)

          // Noise-based opacity variation
          const opacityNoise = noiseSeed(col, row)
          const cellOpacity = (0.4 + opacityNoise * 0.6) * cellEnter

          // Color selection
          const colorIdx = Math.floor(noiseSeed(col * 3, row * 7) * toneShades.length)
          const color = toneShades[colorIdx]

          // Subtle scale pulse on select cells
          const shouldPulse = noiseSeed(col * 11, row * 13) > 0.7
          const pulsePeriod = 80 + noiseSeed(col, row * 5) * 60
          const pulsePhase = noiseSeed(col * 2, row * 3) * Math.PI * 2
          const pulse = shouldPulse ? 1 + loopSine(frame, pulsePeriod, pulsePhase) * 0.08 : 1

          // Glow on cells near center
          const isNearCenter = distFromCenter < 0.25
          const filter = isNearCenter ? `url(#geo-glow-${delay})` : undefined

          // Shape size
          const size = Math.min(cellWidth, cellHeight) * 0.38 * pulse

          let pathD: string
          switch (pattern) {
            case "hexagon":
              pathD = hexagonPath(cx, cy, size)
              break
            case "triangle":
              pathD = trianglePath(cx, cy, size, (col + row) % 2 === 0)
              break
            case "diamond":
              pathD = diamondPath(cx, cy, size)
              break
            case "circle":
              // Circle is handled separately
              pathD = ""
              break
          }

          if (pattern === "circle") {
            const circleSize = size * (0.6 + noiseSeed(col * 5, row * 9) * 0.4)
            return (
              <circle
                key={`cell-${i}`}
                cx={cx}
                cy={cy}
                r={circleSize * cellEnter}
                fill={color}
                opacity={cellOpacity * enter}
                filter={filter}
              />
            )
          }

          return (
            <path
              key={`cell-${i}`}
              d={pathD}
              fill={color}
              opacity={cellOpacity * enter}
              filter={filter}
              transform={`translate(${cx - cx},${cy - cy}) scale(${cellEnter})`}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
          )
        })}
      </svg>
    </div>
  )
}
