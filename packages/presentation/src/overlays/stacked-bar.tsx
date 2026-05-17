import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { StackedBarCommand, Point } from "../types"
import { useCardSize } from "../hooks/use-card-size"
import { getCardLayout } from "../utils/card-layout"

// Spring configs for layered timing
const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_BAR = { damping: 12, stiffness: 110, mass: 0.7 } as const
const SPRING_LABEL = { damping: 14, stiffness: 130, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface StackedBarProps {
  command: StackedBarCommand
}

/**
 * StackedBar overlay -- Horizontal stacked bar chart with labels.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance
 *   2. Bar segments: grow from left with staggered spring
 *   3. Labels: fade in after bar segments settle
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function StackedBar({ command }: StackedBarProps) {
  const {
    position: _position,
    bars,
    width: _width = 320,
    barHeight = 32,
    gap = 12,
    cardSize: _cardSize,
  } = command
  const position = _position as Point

  const cardSizeResult = useCardSize({ width: _width, cardSize: _cardSize })
  const width = cardSizeResult?.width ?? _width
  const mode = cardSizeResult?.mode ?? "md"
  const totalHeight = bars.length * (barHeight + gap) - gap + 40
  const cardLayout = useMemo(() => getCardLayout(mode, width, totalHeight), [mode, width, totalHeight])

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

  // Layout computation
  const layout = useMemo(() => {
    return bars.map((bar) => {
      const totalValue = bar.segments.reduce((s, seg) => s + seg.value, 0)
      let offsetX = 0
      const segLayouts = bar.segments.map((seg) => {
        const segWidth = totalValue > 0 ? (seg.value / totalValue) * width : 0
        const layout = { x: offsetX, width: segWidth, ...seg }
        offsetX += segWidth
        return layout
      })
      return { label: bar.label, segments: segLayouts }
    })
  }, [bars, width])

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
        padding: cardLayout.padding,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      <svg width={width + 80} height={totalHeight} style={{ overflow: "visible" }}>
        {layout.map((bar, barIdx) => {
          const barY = barIdx * (barHeight + gap)
          const barDelay = 6 + barIdx * 6

          // Label animation
          const labelFrame = Math.max(0, frame - barDelay)
          const labelSpring = frame < barDelay ? 0 : spring({ frame: labelFrame, fps, config: SPRING_LABEL })
          const labelSettled = labelSpring >= 0.999
          const labelOpacity = labelSettled ? 1 : interpolate(labelSpring, [0, 0.4], [0, 1], CLAMP)

          return (
            <g key={barIdx}>
              {/* Bar label */}
              <text
                x={0}
                y={barY + barHeight / 2 + 1}
                textAnchor="start"
                dominantBaseline="central"
                fill="rgba(255,255,255,0.7)"
                fontSize={cardLayout.fontSize.label}
                fontFamily="system-ui, sans-serif"
                fontWeight={600}
                opacity={labelOpacity}
              >
                {bar.label}
              </text>

              {/* Segments */}
              {bar.segments.map((seg, segIdx) => {
                const segDelay = barDelay + 4 + segIdx * 3
                const segFrame = Math.max(0, frame - segDelay)
                const segSpring = frame < segDelay ? 0 : spring({ frame: segFrame, fps, config: SPRING_BAR })
                const segSettled = segSpring >= 0.999
                const segWidth = segSettled
                  ? seg.width
                  : seg.width * interpolate(segSpring, [0, 0.7, 1], [0, 0.9, 1], CLAMP)
                const segOpacity = segSettled ? 1 : interpolate(segSpring, [0, 0.2], [0, 1], CLAMP)

                return (
                  <g key={segIdx}>
                    <rect
                      x={80 + seg.x}
                      y={barY}
                      width={Math.max(0, segWidth)}
                      height={barHeight}
                      rx={segIdx === 0 ? 4 : 0}
                      ry={segIdx === 0 ? 4 : 0}
                      fill={seg.color}
                      opacity={segOpacity}
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth={0.5}
                    />
                    {/* Segment value label */}
                    {segWidth > 30 && (
                      <text
                        x={80 + seg.x + segWidth / 2}
                        y={barY + barHeight / 2 + 1}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="rgba(255,255,255,0.9)"
                        fontSize={cardLayout.fontSize.axis}
                        fontFamily="system-ui, monospace"
                        fontWeight={700}
                        opacity={segOpacity}
                      >
                        {seg.value}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
