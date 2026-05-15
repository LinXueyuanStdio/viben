import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { SparklineCommand, Point } from "../types"

// Spring configs
const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_DOT = { damping: 8, stiffness: 160, mass: 0.5 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface SparklineProps {
  command: SparklineCommand
}

/**
 * Sparkline overlay -- Compact inline line chart with cinematic draw reveal.
 *
 * Motion layers:
 *   1. Line: draw from left to right with acceleration (ease-in-out)
 *   2. Area fill: fades in after line is 60% drawn
 *   3. End dot: elastic pop-in after line reaches end
 *   4. After complete: dot has subtle glow pulse
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Sparkline({ command }: SparklineProps) {
  const {
    position: _position,
    data,
    width = 160,
    height = 48,
    color = "#6366F1",
    fill = false,
    showEndDot = true,
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
    : interpolate(containerProgress, [0, 0.3, 0.8, 1], [0.92, 0.95, 1.02, 1], CLAMP)
  const containerTranslateY = containerSettled ? 0 : (1 - containerProgress) * 12
  const containerBlur = containerSettled ? 0 : interpolate(containerProgress, [0, 0.5], [3, 0], CLAMP)

  // ── Line draw progress: ease-in-out with acceleration ──
  const drawDelay = 8
  const drawDuration = 30
  const drawElapsed = Math.max(0, frame - drawDelay)
  const rawDrawProgress = drawElapsed >= drawDuration
    ? 1
    : drawElapsed <= 0
      ? 0
      : interpolate(drawElapsed, [0, drawDuration], [0, 1], CLAMP)
  // Ease-in-out cubic for acceleration feel
  const drawProgress = rawDrawProgress < 0.5
    ? 4 * rawDrawProgress * rawDrawProgress * rawDrawProgress
    : 1 - Math.pow(-2 * rawDrawProgress + 2, 3) / 2

  // ── Area fill: fades in after 60% drawn ──
  const fillOpacity = fill
    ? drawProgress < 0.6
      ? 0
      : interpolate(drawProgress, [0.6, 1], [0, 1], CLAMP)
    : 0

  // ── End dot: elastic pop-in after line reaches end ──
  const dotDelay = drawDelay + drawDuration - 2
  const dotFrame = Math.max(0, frame - dotDelay)
  const dotSpring = frame < dotDelay ? 0 : spring({ frame: dotFrame, fps, config: SPRING_DOT })
  const dotSettled = dotSpring >= 0.999
  const dotScale = dotSettled
    ? 1
    : interpolate(dotSpring, [0, 0.4, 0.7, 1], [0, 1.4, 0.9, 1], CLAMP)
  const dotOpacity = dotSettled ? 1 : interpolate(dotSpring, [0, 0.2], [0, 1], CLAMP)

  // ── Glow pulse on dot after settle ──
  const glowPhase = Math.max(0, frame - (dotDelay + 12))
  const pulseScale = dotSettled ? 1 + 1.5 * (0.5 + 0.5 * Math.sin(glowPhase * 0.15)) : 0
  const pulseOpacity = dotSettled ? 0.4 + 0.3 * Math.sin(glowPhase * 0.15 + Math.PI) : 0

  // Memoize all static geometry
  const geometry = useMemo(() => {
    if (data.length < 2) return null

    const padding = 4
    const chartW = width - padding * 2
    const chartH = height - padding * 2

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const points = data.map((v, i) => ({
      x: padding + (i / (data.length - 1)) * chartW,
      y: padding + chartH - ((v - min) / range) * chartH,
    }))

    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ")

    let totalLength = 0
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x
      const dy = points[i].y - points[i - 1].y
      totalLength += Math.sqrt(dx * dx + dy * dy)
    }

    const fillPath = fill
      ? `M ${points[0].x},${points[0].y} ` +
        points.slice(1).map((p) => `L ${p.x},${p.y}`).join(" ") +
        ` L ${points[points.length - 1].x},${chartH + padding} L ${points[0].x},${chartH + padding} Z`
      : ""

    const lastPoint = points[points.length - 1]

    return { points, polylinePoints, totalLength, fillPath, lastPoint }
  }, [data, width, height, fill])

  if (!geometry) return null

  const { polylinePoints, totalLength, fillPath, lastPoint } = geometry
  const dashOffset = totalLength * (1 - drawProgress)
  const uid = `sparkline-${position.x}-${position.y}`

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
      }}
    >
      <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
        <defs>
          {/* Gradient for line stroke */}
          <linearGradient id={`${uid}-line-grad`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity={0.7} />
            <stop offset="50%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={adjustColor(color, 50)} stopOpacity={1} />
          </linearGradient>
          {/* Multi-stop fill gradient */}
          <linearGradient id={`${uid}-fill-grad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="40%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
          {/* Glow filter for end dot */}
          <filter id={`${uid}-dot-glow`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Fill area — fades in after 60% drawn */}
        {fill && fillOpacity > 0 && (
          <path
            d={fillPath}
            fill={`url(#${uid}-fill-grad)`}
            opacity={fillOpacity}
          />
        )}

        {/* Line with gradient stroke — draw animation */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={`url(#${uid}-line-grad)`}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={totalLength}
          strokeDashoffset={dashOffset}
        />

        {/* End dot — elastic pop-in + glow pulse */}
        {showEndDot && dotSpring > 0 && (
          <>
            {/* Outer glow ring — pulsing */}
            {dotSettled && (
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r={3 * pulseScale}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                opacity={pulseOpacity}
                filter={`url(#${uid}-dot-glow)`}
              />
            )}
            {/* Solid dot with elastic entrance */}
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={3.5 * dotScale}
              fill={color}
              stroke="rgba(15, 15, 30, 0.9)"
              strokeWidth={1.5}
              opacity={dotOpacity}
              filter={`url(#${uid}-dot-glow)`}
            />
          </>
        )}
      </svg>
    </div>
  )
}

/** Lighten/shift a hex color for gradient end stop */
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16)
  const r = Math.min(255, ((num >> 16) & 0xff) + amount)
  const g = Math.min(255, ((num >> 8) & 0xff) + amount)
  const b = Math.min(255, (num & 0xff) + amount)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}
