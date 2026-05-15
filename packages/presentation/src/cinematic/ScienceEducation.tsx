import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import {
  clampInterpolate,
  softSpring,
  stagger,
  loopSine,
  noiseSeed,
  smoothStep,
  particleTrail,
} from "./motion"

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. MoleculeStructure
 * ─────────────────────────────────────────────────────────────────────────── */

export interface MoleculeAtom {
  id: string
  element: string
  x: number
  y: number
  color?: string
  radius?: number
}

export interface MoleculeBond {
  from: string
  to: string
  type?: "single" | "double" | "triple"
}

export interface MoleculeStructureProps {
  atoms: MoleculeAtom[]
  bonds: MoleculeBond[]
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function MoleculeStructure({
  atoms,
  bonds,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 400,
  height = 400,
}: MoleculeStructureProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)

  const containerEnter = softSpring(frame, fps, delay)
  const atomMap = new Map(atoms.map((a) => [a.id, a]))

  // Hexagonal grid background pattern
  const hexSize = 28
  const hexRows = Math.ceil(height / (hexSize * 1.5)) + 1
  const hexCols = Math.ceil(width / (hexSize * Math.sqrt(3))) + 1

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
        opacity: containerEnter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${0.88 + containerEnter * 0.12})`,
        borderRadius: 20,
        background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), rgba(10,10,15,0.58)`,
        border: `1px solid ${accent}40`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 38px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.16)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      {/* Hexagonal grid background */}
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, opacity: 0.06 }}
      >
        {Array.from({ length: hexRows }, (_, row) =>
          Array.from({ length: hexCols }, (_, col) => {
            const cx = col * hexSize * Math.sqrt(3) + (row % 2 === 1 ? hexSize * Math.sqrt(3) / 2 : 0)
            const cy = row * hexSize * 1.5
            return (
              <polygon
                key={`hex-${row}-${col}`}
                points={Array.from({ length: 6 }, (_, i) => {
                  const angle = (Math.PI / 3) * i + Math.PI / 6
                  return `${cx + hexSize * Math.cos(angle)},${cy + hexSize * Math.sin(angle)}`
                }).join(" ")}
                fill="none"
                stroke={accent}
                strokeWidth={0.5}
              />
            )
          })
        )}
      </svg>

      {/* Main molecule SVG */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <filter id="mol-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {atoms.map((atom) => {
            const atomColor = atom.color ?? accent
            return (
              <radialGradient key={`grad-${atom.id}`} id={`atom-grad-${atom.id}`} cx="35%" cy="35%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.6} />
                <stop offset="40%" stopColor={atomColor} stopOpacity={0.9} />
                <stop offset="100%" stopColor={atomColor} stopOpacity={0.4} />
              </radialGradient>
            )
          })}
        </defs>

        {/* Bonds */}
        {bonds.map((bond, bondIdx) => {
          const fromAtom = atomMap.get(bond.from)
          const toAtom = atomMap.get(bond.to)
          if (!fromAtom || !toAtom) return null

          const bondDelay = delay + 12 + bondIdx * 4
          const draw = clampInterpolate(frame, [bondDelay, bondDelay + 24], [0, 1])

          const dx = toAtom.x - fromAtom.x
          const dy = toAtom.y - fromAtom.y
          const len = Math.sqrt(dx * dx + dy * dy)
          const nx = -dy / len
          const ny = dx / len

          const lineCount = bond.type === "triple" ? 3 : bond.type === "double" ? 2 : 1
          const gap = 4

          return (
            <g key={`bond-${bond.from}-${bond.to}`} opacity={draw}>
              {Array.from({ length: lineCount }, (_, li) => {
                const offset = (li - (lineCount - 1) / 2) * gap
                const x1 = fromAtom.x + nx * offset
                const y1 = fromAtom.y + ny * offset
                const x2 = toAtom.x + nx * offset
                const y2 = toAtom.y + ny * offset
                return (
                  <line
                    key={li}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={accent}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={1 - draw}
                    opacity={0.75}
                    filter="url(#mol-glow)"
                  />
                )
              })}
            </g>
          )
        })}

        {/* Atoms */}
        {atoms.map((atom, atomIdx) => {
          const atomDelay = delay + stagger(atomIdx, atoms.length, 30)
          const enter = softSpring(frame, fps, atomDelay)
          const radius = atom.radius ?? 22
          const atomColor = atom.color ?? accent
          const glowOsc = loopSine(frame, 120 + atomIdx * 13, atomIdx * 2.3) * 0.3 + 0.7
          // Subtle deterministic jitter per atom (organic feel)
          const jitterX = (noiseSeed(atomIdx, frame * 0.02) - 0.5) * 2.5
          const jitterY = (noiseSeed(atomIdx + 100, frame * 0.02) - 0.5) * 2.5
          const ax = atom.x + jitterX * smoothStep(enter)
          const ay = atom.y + jitterY * smoothStep(enter)

          return (
            <g key={`atom-${atom.id}`} opacity={enter}>
              {/* Orbital glow ring */}
              <circle
                cx={ax}
                cy={ay}
                r={radius + 8 + loopSine(frame, 90 + atomIdx * 7, atomIdx) * 3}
                fill="none"
                stroke={atomColor}
                strokeWidth={1.2}
                opacity={glowOsc * 0.35 * enter}
                strokeDasharray="3 5"
              />
              {/* Shadow */}
              <ellipse
                cx={ax + 3}
                cy={ay + radius + 8}
                rx={radius * 0.7}
                ry={4}
                fill="rgba(0,0,0,0.25)"
                opacity={enter}
              />
              {/* Atom sphere */}
              <circle
                cx={ax}
                cy={ay}
                r={radius * enter}
                fill={`url(#atom-grad-${atom.id})`}
                stroke={atomColor}
                strokeWidth={1}
                strokeOpacity={0.5}
                style={{
                  filter: `drop-shadow(0 0 ${8 * glowOsc}px ${atomColor}66)`,
                }}
              />
              {/* Element label */}
              <text
                x={ax}
                y={ay + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                fontSize={radius > 18 ? 14 : 11}
                fontFamily={cinematicTheme.font.en}
                fontWeight={700}
                opacity={enter}
              >
                {atom.element}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. DNAHelix
 * ─────────────────────────────────────────────────────────────────────────── */

export interface DNAHelixLabel {
  position: number
  text: string
}

export interface DNAHelixProps {
  basePairs?: number
  labels?: DNAHelixLabel[]
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  height?: number
  width?: number
}

export function DNAHelix({
  basePairs = 12,
  labels = [],
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  height = 400,
  width = 200,
}: DNAHelixProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const complementary = tone === "gold" ? toneColor("purple") : tone === "purple" ? toneColor("magenta") : toneColor("gold")

  const containerEnter = softSpring(frame, fps, delay)
  const phaseOffset = frame * 0.04 // continuous rotation

  // Helix geometry
  const helixAmplitude = width * 0.28
  const verticalSpacing = height / (basePairs + 1)
  const svgW = width
  const svgH = height

  // Generate strand points
  const strandPoints = Array.from({ length: basePairs * 4 }, (_, i) => {
    const t = i / (basePairs * 4 - 1)
    const yPos = t * svgH
    const phase = t * Math.PI * 2 * (basePairs / 4) + phaseOffset
    const x1 = svgW / 2 + Math.sin(phase) * helixAmplitude
    const x2 = svgW / 2 + Math.sin(phase + Math.PI) * helixAmplitude
    const depth1 = Math.cos(phase)
    const depth2 = Math.cos(phase + Math.PI)
    return { yPos, x1, x2, depth1, depth2, phase }
  })

  // Base pair positions (at regular intervals)
  const basePairPositions = Array.from({ length: basePairs }, (_, i) => {
    const t = (i + 1) / (basePairs + 1)
    const yPos = t * svgH
    const phase = t * Math.PI * 2 * (basePairs / 4) + phaseOffset
    const x1 = svgW / 2 + Math.sin(phase) * helixAmplitude
    const x2 = svgW / 2 + Math.sin(phase + Math.PI) * helixAmplitude
    const depth = Math.cos(phase)
    return { yPos, x1, x2, depth, index: i }
  })

  // Base pair color alternation (A-T / G-C)
  const pairColors = [
    { c1: "#4FC3F7", c2: "#FF8A65" }, // A-T
    { c1: "#81C784", c2: "#FFD54F" }, // G-C
  ]

  // Build strand paths
  const strand1Path = strandPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x1.toFixed(1)} ${p.yPos.toFixed(1)}`).join(" ")
  const strand2Path = strandPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x2.toFixed(1)} ${p.yPos.toFixed(1)}`).join(" ")

  // Particle trail along strands
  const particles = particleTrail(frame, 8, { spread: 60, speed: 0.8, decay: 0.9, phase: delay * 0.1 })

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
        opacity: containerEnter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${0.9 + containerEnter * 0.1})`,
        borderRadius: 20,
        background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), rgba(10,10,15,0.58)`,
        border: `1px solid ${accent}40`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 38px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.16)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <filter id="dna-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="strand1-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity={0.9} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id="strand2-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={complementary} stopOpacity={0.9} />
            <stop offset="100%" stopColor={complementary} stopOpacity={0.5} />
          </linearGradient>
        </defs>

        {/* Volumetric glow along backbone */}
        <path
          d={strand1Path}
          fill="none"
          stroke={accent}
          strokeWidth={6}
          strokeOpacity={0.15}
          strokeLinecap="round"
          filter="url(#dna-glow)"
        />
        <path
          d={strand2Path}
          fill="none"
          stroke={complementary}
          strokeWidth={6}
          strokeOpacity={0.15}
          strokeLinecap="round"
          filter="url(#dna-glow)"
        />

        {/* Base pair rungs (draw behind or in front based on depth) */}
        {basePairPositions
          .filter((bp) => bp.depth < 0)
          .map((bp) => {
            const bpEnter = clampInterpolate(frame, [delay + 8 + bp.index * 3, delay + 24 + bp.index * 3], [0, 1])
            const colors = pairColors[bp.index % 2]
            return (
              <g key={`bp-back-${bp.index}`} opacity={bpEnter * 0.5}>
                <line
                  x1={bp.x1}
                  y1={bp.yPos}
                  x2={bp.x2}
                  y2={bp.yPos}
                  stroke={colors.c1}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - bpEnter}
                />
              </g>
            )
          })}

        {/* Strand 1 (main path) */}
        <path
          d={strand1Path}
          fill="none"
          stroke="url(#strand1-grad)"
          strokeWidth={3}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - clampInterpolate(frame, [delay + 4, delay + 40], [0, 1])}
        />

        {/* Strand 2 (offset path) */}
        <path
          d={strand2Path}
          fill="none"
          stroke="url(#strand2-grad)"
          strokeWidth={3}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - clampInterpolate(frame, [delay + 8, delay + 44], [0, 1])}
        />

        {/* Base pair rungs (front) */}
        {basePairPositions
          .filter((bp) => bp.depth >= 0)
          .map((bp) => {
            const bpEnter = clampInterpolate(frame, [delay + 8 + bp.index * 3, delay + 24 + bp.index * 3], [0, 1])
            const colors = pairColors[bp.index % 2]
            return (
              <g key={`bp-front-${bp.index}`} opacity={bpEnter}>
                <line
                  x1={bp.x1}
                  y1={bp.yPos}
                  x2={bp.x2}
                  y2={bp.yPos}
                  stroke={colors.c1}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - bpEnter}
                />
                {/* Node dots at connections */}
                <circle cx={bp.x1} cy={bp.yPos} r={3.5} fill={colors.c1} opacity={bpEnter} />
                <circle cx={bp.x2} cy={bp.yPos} r={3.5} fill={colors.c2} opacity={bpEnter} />
              </g>
            )
          })}

        {/* Particles flowing along strands */}
        {particles.map((p, i) => {
          const t = ((frame * 0.02 + i * 0.12) % 1)
          const strandIdx = i % 2
          const pointIndex = Math.floor(t * (strandPoints.length - 1))
          const point = strandPoints[pointIndex]
          if (!point) return null
          const px = strandIdx === 0 ? point.x1 : point.x2
          const py = point.yPos
          return (
            <circle
              key={`particle-${i}`}
              cx={px}
              cy={py}
              r={p.size * 0.8}
              fill={strandIdx === 0 ? accent : complementary}
              opacity={p.opacity * containerEnter * 0.7}
            />
          )
        })}

        {/* Labels */}
        {labels.map((label, li) => {
          const labelEnter = softSpring(frame, fps, delay + 30 + li * 8)
          const bp = basePairPositions[Math.min(label.position, basePairPositions.length - 1)]
          if (!bp) return null
          const labelX = svgW - 20
          const labelY = bp.yPos
          return (
            <g key={`label-${li}`} opacity={labelEnter}>
              {/* Connector line */}
              <line
                x1={Math.max(bp.x1, bp.x2) + 8}
                y1={labelY}
                x2={labelX - 4}
                y2={labelY}
                stroke={accent}
                strokeWidth={1}
                strokeOpacity={0.5}
                strokeDasharray="2 3"
              />
              {/* Label text */}
              <text
                x={labelX}
                y={labelY + 1}
                textAnchor="end"
                dominantBaseline="central"
                fill={cinematicTheme.colors.coldWhite}
                fontSize={10}
                fontFamily={cinematicTheme.font.zh}
                fontWeight={500}
                opacity={labelEnter}
              >
                {label.text}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. FormulaDisplay
 * ─────────────────────────────────────────────────────────────────────────── */

export interface FormulaVariable {
  symbol: string
  value?: string
  color?: string
  description?: string
}

export interface FormulaDisplayProps {
  formula: string
  variables?: FormulaVariable[]
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  fontSize?: number
}

export function FormulaDisplay({
  formula,
  variables = [],
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  fontSize = 48,
}: FormulaDisplayProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)

  const containerEnter = softSpring(frame, fps, delay)

  // Typewriter reveal for formula characters
  const chars = formula.split("")
  const charRevealSpeed = 2 // frames per character
  const totalRevealFrames = chars.length * charRevealSpeed

  // Variable symbol set for highlighting
  const variableSymbols = new Set(variables.map((v) => v.symbol))

  // Grid background dimensions
  const cardWidth = Math.max(480, fontSize * chars.length * 0.7)
  const cardHeight = variables.length > 0 ? 280 : 180

  // Grid line spacing
  const gridSpacing = 24

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: cardWidth,
        height: cardHeight,
        marginLeft: -cardWidth / 2,
        marginTop: -cardHeight / 2,
        opacity: containerEnter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${0.9 + containerEnter * 0.1})`,
        borderRadius: 20,
        background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), rgba(10,10,15,0.58)`,
        border: `1px solid ${accent}40`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 38px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.16)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 40px",
      }}
    >
      {/* Equation-paper grid background */}
      <svg
        width={cardWidth}
        height={cardHeight}
        style={{ position: "absolute", inset: 0, opacity: 0.05 }}
      >
        {Array.from({ length: Math.ceil(cardWidth / gridSpacing) + 1 }, (_, i) => (
          <line
            key={`v-${i}`}
            x1={i * gridSpacing}
            y1={0}
            x2={i * gridSpacing}
            y2={cardHeight}
            stroke={accent}
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: Math.ceil(cardHeight / gridSpacing) + 1 }, (_, i) => (
          <line
            key={`h-${i}`}
            x1={0}
            y1={i * gridSpacing}
            x2={cardWidth}
            y2={i * gridSpacing}
            stroke={accent}
            strokeWidth={0.5}
          />
        ))}
      </svg>

      {/* Formula text with typewriter + variable highlighting */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 0,
          zIndex: 1,
        }}
      >
        {chars.map((char, ci) => {
          const charDelay = delay + ci * charRevealSpeed
          const charEnter = clampInterpolate(frame, [charDelay, charDelay + 6], [0, 1])
          const isVariable = variableSymbols.has(char)
          const varData = variables.find((v) => v.symbol === char)
          const charColor = isVariable ? (varData?.color ?? accent) : cinematicTheme.colors.coldWhite
          const isOperator = "=+-×÷·".includes(char)
          const glowPulse = isVariable ? loopSine(frame, 100, ci) * 0.2 + 0.8 : 1

          return (
            <span
              key={ci}
              style={{
                display: "inline-block",
                fontFamily: cinematicTheme.font.mono,
                fontSize: isOperator ? fontSize * 0.9 : fontSize,
                fontWeight: isVariable ? 700 : 400,
                color: isOperator ? accent : charColor,
                opacity: charEnter,
                transform: `translateY(${(1 - charEnter) * 12}px)`,
                textShadow: isVariable
                  ? `0 0 ${12 * glowPulse}px ${charColor}88, 0 0 ${24 * glowPulse}px ${charColor}44`
                  : isOperator
                    ? `0 0 8px ${accent}66`
                    : "none",
                letterSpacing: char === " " ? "0.3em" : "0.02em",
                minWidth: char === " " ? "0.4em" : undefined,
                position: "relative",
              }}
            >
              {char}
              {/* Variable underline */}
              {isVariable && charEnter > 0.8 && (
                <span
                  style={{
                    position: "absolute",
                    bottom: -4,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: `linear-gradient(90deg, transparent, ${charColor}, transparent)`,
                    opacity: glowPulse,
                    borderRadius: 1,
                  }}
                />
              )}
            </span>
          )
        })}
      </div>

      {/* Variable legend (appears after formula completes) */}
      {variables.length > 0 && (
        <div
          style={{
            marginTop: 28,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "flex-start",
            width: "100%",
            zIndex: 1,
          }}
        >
          {variables.map((v, vi) => {
            const legendDelay = delay + totalRevealFrames + 12 + vi * 8
            const legendEnter = softSpring(frame, fps, legendDelay)
            const varColor = v.color ?? accent
            return (
              <div
                key={v.symbol}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  opacity: legendEnter,
                  transform: `translateX(${(1 - legendEnter) * 20}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: cinematicTheme.font.mono,
                    fontSize: 18,
                    fontWeight: 700,
                    color: varColor,
                    minWidth: 24,
                    textAlign: "center",
                    textShadow: `0 0 8px ${varColor}66`,
                  }}
                >
                  {v.symbol}
                </span>
                {v.value && (
                  <span
                    style={{
                      fontFamily: cinematicTheme.font.mono,
                      fontSize: 13,
                      color: cinematicTheme.colors.muted,
                    }}
                  >
                    = {v.value}
                  </span>
                )}
                {v.description && (
                  <span
                    style={{
                      fontFamily: cinematicTheme.font.zh,
                      fontSize: 12,
                      color: cinematicTheme.colors.dim,
                      marginLeft: 4,
                    }}
                  >
                    {v.description}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. PeriodicHighlight
 * ─────────────────────────────────────────────────────────────────────────── */

export interface PeriodicElement {
  symbol: string
  number: number
  name: string
  group?: string
  color?: string
  highlighted?: boolean
}

export interface PeriodicHighlightProps {
  elements: PeriodicElement[]
  title?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function PeriodicHighlight({
  elements,
  title,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 560,
  height = 360,
}: PeriodicHighlightProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)

  const containerEnter = softSpring(frame, fps, delay)

  // Group elements by their group property
  const groups = new Map<string, PeriodicElement[]>()
  elements.forEach((el) => {
    const g = el.group ?? ""
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(el)
  })

  // Layout: grid of element cells
  const cellSize = 72
  const cellGap = 6
  const cols = Math.min(8, Math.ceil(Math.sqrt(elements.length * 1.6)))
  const rows = Math.ceil(elements.length / cols)

  // Calculate grid dimensions
  const gridWidth = cols * (cellSize + cellGap) - cellGap
  const gridHeight = rows * (cellSize + cellGap) - cellGap
  const offsetX = (width - gridWidth) / 2
  const offsetY = title ? (height - gridHeight) / 2 + 16 : (height - gridHeight) / 2

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
        opacity: containerEnter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${0.88 + containerEnter * 0.12})`,
        borderRadius: 20,
        background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), rgba(10,10,15,0.58)`,
        border: `1px solid ${accent}40`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 38px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.16)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      {/* Title */}
      {title && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: cinematicTheme.font.zh,
            fontSize: 16,
            fontWeight: 700,
            color: cinematicTheme.colors.coldWhite,
            letterSpacing: 2,
            opacity: containerEnter,
          }}
        >
          {title}
        </div>
      )}

      {/* Group labels */}
      {Array.from(groups.entries()).map(([groupName, groupElements]) => {
        if (!groupName) return null
        const firstIdx = elements.indexOf(groupElements[0])
        const col = firstIdx % cols
        const row = Math.floor(firstIdx / cols)
        const labelX = offsetX + col * (cellSize + cellGap)
        const labelY = offsetY + row * (cellSize + cellGap) - 16
        const labelEnter = softSpring(frame, fps, delay + 6)
        return (
          <div
            key={`group-${groupName}`}
            style={{
              position: "absolute",
              left: labelX,
              top: labelY,
              fontFamily: cinematicTheme.font.zh,
              fontSize: 10,
              fontWeight: 600,
              color: accent,
              letterSpacing: 1.5,
              opacity: labelEnter * 0.7,
              textTransform: "uppercase",
            }}
          >
            {groupName}
          </div>
        )
      })}

      {/* Element cells */}
      {elements.map((el, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const cellX = offsetX + col * (cellSize + cellGap)
        const cellY = offsetY + row * (cellSize + cellGap)

        // Stagger from top-left (manhattan distance)
        const manhattan = col + row
        const cellDelay = delay + stagger(manhattan, cols + rows - 2, 24) + 6
        const cellEnter = softSpring(frame, fps, cellDelay)

        const isHighlighted = el.highlighted ?? false
        const elColor = el.color ?? accent
        const pulseGlow = isHighlighted ? loopSine(frame, 80 + i * 5, i * 1.7) * 0.3 + 0.7 : 0

        // Scan-line effect for highlighted cells
        const scanY = isHighlighted ? ((frame * 1.5 + i * 20) % (cellSize * 2)) - cellSize * 0.5 : -100

        return (
          <div
            key={`cell-${el.symbol}-${i}`}
            style={{
              position: "absolute",
              left: cellX,
              top: cellY,
              width: cellSize,
              height: cellSize,
              opacity: cellEnter * (isHighlighted ? 1 : 0.3),
              transform: `scale(${0.85 + cellEnter * 0.15}) translateZ(${isHighlighted ? 10 : 0}px)`,
              borderRadius: 10,
              background: isHighlighted
                ? `linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04)), ${elColor}18`
                : `linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01)), rgba(10,10,15,0.4)`,
              border: `1px solid ${isHighlighted ? `${elColor}70` : "rgba(234,236,239,0.1)"}`,
              boxShadow: isHighlighted
                ? `0 8px 28px rgba(0,0,0,0.3), 0 0 ${20 * pulseGlow}px ${elColor}40, inset 0 1px 0 rgba(255,255,255,0.14)`
                : "0 4px 12px rgba(0,0,0,0.15)",
              backdropFilter: "blur(8px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* Scan-line effect */}
            {isHighlighted && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: scanY,
                  height: 2,
                  background: `linear-gradient(90deg, transparent, ${elColor}80, transparent)`,
                  opacity: 0.6,
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Atomic number */}
            <span
              style={{
                position: "absolute",
                top: 5,
                left: 7,
                fontFamily: cinematicTheme.font.mono,
                fontSize: 9,
                fontWeight: 500,
                color: isHighlighted ? cinematicTheme.colors.muted : cinematicTheme.colors.dim,
              }}
            >
              {el.number}
            </span>

            {/* Symbol */}
            <span
              style={{
                fontFamily: cinematicTheme.font.en,
                fontSize: 22,
                fontWeight: 800,
                color: isHighlighted ? "#fff" : cinematicTheme.colors.dim,
                textShadow: isHighlighted ? `0 0 10px ${elColor}66` : "none",
              }}
            >
              {el.symbol}
            </span>

            {/* Name */}
            <span
              style={{
                fontFamily: cinematicTheme.font.zh,
                fontSize: 9,
                fontWeight: 400,
                color: isHighlighted ? cinematicTheme.colors.muted : cinematicTheme.colors.dim,
                marginTop: 2,
              }}
            >
              {el.name}
            </span>
          </div>
        )
      })}

      {/* Connection lines between adjacent highlighted elements */}
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {elements.map((el, i) => {
          if (!el.highlighted) return null
          // Check right neighbor
          const rightIdx = i + 1
          if (rightIdx < elements.length && rightIdx % cols !== 0 && elements[rightIdx].highlighted) {
            const fromX = offsetX + (i % cols) * (cellSize + cellGap) + cellSize
            const fromY = offsetY + Math.floor(i / cols) * (cellSize + cellGap) + cellSize / 2
            const toX = offsetX + (rightIdx % cols) * (cellSize + cellGap)
            const toY = fromY
            const lineEnter = clampInterpolate(frame, [delay + 30, delay + 46], [0, 1])
            return (
              <line
                key={`conn-r-${i}`}
                x1={fromX}
                y1={fromY}
                x2={toX}
                y2={toY}
                stroke={accent}
                strokeWidth={1.5}
                opacity={lineEnter * 0.6}
                strokeDasharray="3 2"
              />
            )
          }
          // Check bottom neighbor
          const bottomIdx = i + cols
          if (bottomIdx < elements.length && elements[bottomIdx].highlighted) {
            const fromX = offsetX + (i % cols) * (cellSize + cellGap) + cellSize / 2
            const fromY = offsetY + Math.floor(i / cols) * (cellSize + cellGap) + cellSize
            const toX = fromX
            const toY = offsetY + Math.floor(bottomIdx / cols) * (cellSize + cellGap)
            const lineEnter = clampInterpolate(frame, [delay + 30, delay + 46], [0, 1])
            return (
              <line
                key={`conn-b-${i}`}
                x1={fromX}
                y1={fromY}
                x2={toX}
                y2={toY}
                stroke={accent}
                strokeWidth={1.5}
                opacity={lineEnter * 0.6}
                strokeDasharray="3 2"
              />
            )
          }
          return null
        })}
      </svg>
    </div>
  )
}
