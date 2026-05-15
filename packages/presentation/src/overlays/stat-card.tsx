import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { StatCardCommand, Point } from "../types"

// Spring configs
const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_VALUE = { damping: 12, stiffness: 130, mass: 0.6 } as const
const SPRING_DELTA = { damping: 8, stiffness: 160, mass: 0.5 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface StatCardProps {
  command: StatCardCommand
}

/**
 * StatCard overlay -- Before vs After comparison card with delta indicator.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance
 *   2. "Before" number: counter animation from 0
 *   3. "After" number: counter animation (staggered)
 *   4. Delta badge: elastic pop-in with color (green up, red down)
 *   5. Connecting arrow: draw between before/after
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function StatCard({ command }: StatCardProps) {
  const {
    position: _position,
    label,
    before,
    after,
    unit = "",
    color = "#6366F1",
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

  // ── Before counter ──
  const beforeDelay = 8
  const counterDuration = 25
  const beforeElapsed = Math.max(0, frame - beforeDelay)
  const beforeProgress = beforeElapsed >= counterDuration
    ? 1
    : beforeElapsed <= 0
      ? 0
      : interpolate(beforeElapsed, [0, counterDuration], [0, 1], CLAMP)
  const beforeEased = 1 - Math.pow(1 - beforeProgress, 3) // ease-out cubic
  const displayBefore = Math.round(before * beforeEased)

  // ── After counter (staggered) ──
  const afterDelay = 14
  const afterElapsed = Math.max(0, frame - afterDelay)
  const afterProgress = afterElapsed >= counterDuration
    ? 1
    : afterElapsed <= 0
      ? 0
      : interpolate(afterElapsed, [0, counterDuration], [0, 1], CLAMP)
  const afterEased = 1 - Math.pow(1 - afterProgress, 3)
  const displayAfter = Math.round(after * afterEased)

  // ── After value entrance spring ──
  const afterSpring = frame < afterDelay ? 0 : spring({ frame: Math.max(0, frame - afterDelay), fps, config: SPRING_VALUE })
  const afterSettled = afterSpring >= 0.999
  const afterValueOpacity = afterSettled ? 1 : interpolate(afterSpring, [0, 0.3], [0, 1], CLAMP)

  // ── Delta badge pop-in ──
  const delta = after - before
  const deltaPercent = before !== 0 ? ((delta / Math.abs(before)) * 100) : 0
  const isPositive = delta >= 0
  const deltaColor = isPositive ? "#10B981" : "#EF4444"

  const deltaDelay = 22
  const deltaFrame = Math.max(0, frame - deltaDelay)
  const deltaSpring = frame < deltaDelay ? 0 : spring({ frame: deltaFrame, fps, config: SPRING_DELTA })
  const deltaSettled = deltaSpring >= 0.999
  const deltaScale = deltaSettled
    ? 1
    : interpolate(deltaSpring, [0, 0.4, 0.7, 1], [0, 1.3, 0.92, 1], CLAMP)
  const deltaOpacity = deltaSettled ? 1 : interpolate(deltaSpring, [0, 0.2], [0, 1], CLAMP)

  // ── Arrow draw ──
  const arrowDelay = 16
  const arrowFrame = Math.max(0, frame - arrowDelay)
  const arrowSpring = frame < arrowDelay ? 0 : spring({ frame: arrowFrame, fps, config: SPRING_VALUE })
  const arrowSettled = arrowSpring >= 0.999
  const arrowProgress = arrowSettled ? 1 : interpolate(arrowSpring, [0, 1], [0, 1], CLAMP)

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
        padding: 24,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
        minWidth: 260,
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          fontFamily: "system-ui, sans-serif",
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginBottom: 16,
        }}
      >
        {label}
      </div>

      {/* Before / After row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        {/* Before */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: "rgba(255,255,255,0.35)",
              fontFamily: "system-ui, sans-serif",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Before
          </span>
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "rgba(255,255,255,0.7)",
              fontFamily: "system-ui, monospace",
              letterSpacing: -1,
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}
          >
            {formatNumber(displayBefore)}{unit}
          </span>
        </div>

        {/* Arrow */}
        <svg width={40} height={20} style={{ flexShrink: 0, overflow: "visible" }}>
          <line
            x1={0}
            y1={10}
            x2={30 * arrowProgress}
            y2={10}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={arrowProgress > 0.01 ? 0.8 : 0}
          />
          {arrowProgress > 0.7 && (
            <polygon
              points={`${26 * arrowProgress + 4},10 ${26 * arrowProgress - 2},6 ${26 * arrowProgress - 2},14`}
              fill={color}
              opacity={interpolate(arrowProgress, [0.7, 1], [0, 1], CLAMP)}
            />
          )}
        </svg>

        {/* After */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, opacity: afterValueOpacity }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: "rgba(255,255,255,0.35)",
              fontFamily: "system-ui, sans-serif",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            After
          </span>
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#fff",
              fontFamily: "system-ui, monospace",
              letterSpacing: -1,
              textShadow: `0 1px 2px rgba(0,0,0,0.3), 0 0 12px ${color}44`,
            }}
          >
            {formatNumber(displayAfter)}{unit}
          </span>
        </div>
      </div>

      {/* Delta badge */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
          transform: `scale(${deltaScale})`,
          opacity: deltaOpacity,
          transformOrigin: "left center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            borderRadius: 6,
            background: `${deltaColor}18`,
            border: `1px solid ${deltaColor}40`,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: deltaColor,
              lineHeight: 1,
            }}
          >
            {isPositive ? "\u2191" : "\u2193"}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: deltaColor,
              fontFamily: "system-ui, monospace",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {isPositive ? "+" : ""}{deltaPercent.toFixed(1)}%
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {isPositive ? "+" : ""}{formatNumber(delta)} {unit}
        </span>
      </div>
    </div>
  )
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + "M"
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "K"
  return n.toString()
}
