import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { DonutCommand, Point } from "../types"

// Spring configs
const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_ARC = { damping: 10, stiffness: 120, mass: 0.7 } as const
const SPRING_LABEL = { damping: 14, stiffness: 130, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface DonutProps {
  command: DonutCommand
}

interface ArcSegment {
  startAngle: number
  endAngle: number
  color: string
  label: string
  value: number
  percentage: number
}

/**
 * Donut overlay -- Donut/ring chart with animated arc drawing.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance
 *   2. Arcs: draw clockwise with stagger (each segment draws independently)
 *   3. Labels: fade in after arcs settle
 *   4. Center text: scale + blur clear
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Donut({ command }: DonutProps) {
  const {
    position: _position,
    segments,
    size = 180,
    innerRatio = 0.6,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ── Container entrance ──
  const containerProgress = spring({ frame, fps, config: SPRING_CONTAINER })
  const containerSettled = containerProgress >= 0.999
  const containerOpacity = containerSettled ? 1 : interpolate(containerProgress, [0, 0.3], [0, 1], CLAMP)
  const containerScale = containerSettled
    ? 1
    : interpolate(containerProgress, [0, 0.3, 0.8, 1], [0.9, 0.93, 1.02, 1], CLAMP)
  const containerTranslateY = containerSettled ? 0 : (1 - containerProgress) * 12
  const containerBlur = containerSettled ? 0 : interpolate(containerProgress, [0, 0.5], [4, 0], CLAMP)

  // Compute arc segments
  const arcs = useMemo(() => {
    const total = segments.reduce((s, seg) => s + seg.value, 0)
    if (total <= 0) return []

    let currentAngle = -90 // Start from top
    const result: ArcSegment[] = []

    for (const seg of segments) {
      const sweep = (seg.value / total) * 360
      result.push({
        startAngle: currentAngle,
        endAngle: currentAngle + sweep,
        color: seg.color,
        label: seg.label,
        value: seg.value,
        percentage: (seg.value / total) * 100,
      })
      currentAngle += sweep
    }

    return result
  }, [segments])

  const radius = size / 2
  const innerRadius = radius * innerRatio
  const strokeWidth = radius - innerRadius
  const arcRadius = innerRadius + strokeWidth / 2
  const svgSize = size + 20 // Extra padding for glow
  const center = svgSize / 2

  const uid = `donut-${position.x}-${position.y}`

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        transform: `translateY(${containerTranslateY}px) scale(${containerScale})`,
        opacity: containerOpacity,
        filter: containerBlur > 0.01 ? `blur(${containerBlur}px)` : undefined,
        willChange: "transform, opacity",
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ position: "relative" }}>
        <svg width={svgSize} height={svgSize} style={{ overflow: "visible" }}>
          <defs>
            <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track ring */}
          <circle
            cx={center}
            cy={center}
            r={arcRadius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
          />

          {/* Animated arc segments */}
          {arcs.map((arc, i) => (
            <DonutArc
              key={i}
              arc={arc}
              index={i}
              center={center}
              arcRadius={arcRadius}
              strokeWidth={strokeWidth}
              frame={frame}
              fps={fps}
              uid={uid}
            />
          ))}
        </svg>

        {/* Center total label */}
        <CenterLabel
          segments={segments}
          size={size}
          svgSize={svgSize}
          frame={frame}
          fps={fps}
        />
      </div>

      {/* Legend */}
      <Legend arcs={arcs} frame={frame} fps={fps} />
    </div>
  )
}

function DonutArc({
  arc,
  index,
  center,
  arcRadius,
  strokeWidth,
  frame,
  fps,
  uid,
}: {
  arc: ArcSegment
  index: number
  center: number
  arcRadius: number
  strokeWidth: number
  frame: number
  fps: number
  uid: string
}) {
  const staggerDelay = 8 + index * 5
  const arcFrame = Math.max(0, frame - staggerDelay)
  const arcSpring = frame < staggerDelay ? 0 : spring({ frame: arcFrame, fps, config: SPRING_ARC })
  const arcSettled = arcSpring >= 0.999

  const drawProgress = arcSettled
    ? 1
    : interpolate(arcSpring, [0, 0.6, 0.85, 1], [0, 0.7, 1.04, 1], CLAMP)
  const clampedProgress = Math.min(1, drawProgress)

  // Calculate arc path using stroke-dasharray technique
  const sweepAngle = arc.endAngle - arc.startAngle
  const circumference = 2 * Math.PI * arcRadius
  const arcLength = (sweepAngle / 360) * circumference
  const drawnLength = arcLength * clampedProgress
  const gapSize = circumference - arcLength
  // Offset to start at the right angle
  const rotateOffset = ((arc.startAngle + 90) / 360) * circumference

  if (arcSpring <= 0) return null

  return (
    <circle
      cx={center}
      cy={center}
      r={arcRadius}
      fill="none"
      stroke={arc.color}
      strokeWidth={strokeWidth - 2}
      strokeLinecap="round"
      strokeDasharray={`${drawnLength} ${circumference - drawnLength}`}
      strokeDashoffset={-rotateOffset}
      filter={`url(#${uid}-glow)`}
      opacity={interpolate(arcSpring, [0, 0.15], [0, 1], CLAMP)}
    />
  )
}

function CenterLabel({
  segments,
  size,
  svgSize,
  frame,
  fps,
}: {
  segments: Array<{ label: string; value: number; color: string }>
  size: number
  svgSize: number
  frame: number
  fps: number
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  const labelDelay = 12
  const labelFrame = Math.max(0, frame - labelDelay)
  const labelSpring = frame < labelDelay ? 0 : spring({ frame: labelFrame, fps, config: SPRING_LABEL })
  const labelSettled = labelSpring >= 0.999
  const labelOpacity = labelSettled ? 1 : interpolate(labelSpring, [0, 0.3], [0, 1], CLAMP)
  const labelScale = labelSettled
    ? 1
    : interpolate(labelSpring, [0, 0.6, 1], [0.85, 1.03, 1], CLAMP)
  const labelBlur = labelSettled ? 0 : interpolate(labelSpring, [0, 0.6], [4, 0], CLAMP)

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) scale(${labelScale})`,
        opacity: labelOpacity,
        filter: labelBlur > 0.01 ? `blur(${labelBlur}px)` : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        width: size * 0.4,
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontSize: size * 0.12,
          fontWeight: 800,
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          letterSpacing: -0.5,
          textShadow: "0 1px 2px rgba(0,0,0,0.3)",
        }}
      >
        {total}
      </span>
      <span
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.5)",
          fontFamily: "system-ui, sans-serif",
          letterSpacing: 0.3,
        }}
      >
        TOTAL
      </span>
    </div>
  )
}

function Legend({
  arcs,
  frame,
  fps,
}: {
  arcs: ArcSegment[]
  frame: number
  fps: number
}) {
  const legendDelay = 18
  const legendFrame = Math.max(0, frame - legendDelay)
  const legendSpring = frame < legendDelay ? 0 : spring({ frame: legendFrame, fps, config: SPRING_LABEL })
  const legendSettled = legendSpring >= 0.999
  const legendOpacity = legendSettled ? 1 : interpolate(legendSpring, [0, 0.4], [0, 1], CLAMP)
  const legendTranslateY = legendSettled ? 0 : (1 - legendSpring) * 6

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "center",
        opacity: legendOpacity,
        transform: `translateY(${legendTranslateY}px)`,
      }}
    >
      {arcs.map((arc, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: arc.color,
              boxShadow: `0 0 4px ${arc.color}66`,
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.65)",
              fontFamily: "system-ui, sans-serif",
              fontWeight: 500,
            }}
          >
            {arc.label} ({arc.percentage.toFixed(0)}%)
          </span>
        </div>
      ))}
    </div>
  )
}
