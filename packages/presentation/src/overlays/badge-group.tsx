import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { BadgeGroupCommand, Point } from "../types"

// Spring configs
const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_BADGE = { damping: 8, stiffness: 150, mass: 0.5 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface BadgeGroupProps {
  command: BadgeGroupCommand
}

/**
 * BadgeGroup overlay -- Multiple animated badges arranged in a grid/flow layout.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance
 *   2. Individual badges: staggered pop-in with elastic spring
 *   3. Idle: subtle breathing scale on each badge
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function BadgeGroup({ command }: BadgeGroupProps) {
  const {
    position: _position,
    badges,
    layout = "flow",
    gap = 8,
    columns = 3,
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

  const isGrid = layout === "grid"

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
        padding: 16,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
        display: "flex",
        flexWrap: "wrap",
        gap,
        ...(isGrid ? { maxWidth: columns * 100 + (columns - 1) * gap } : {}),
      }}
    >
      {badges.map((badge, i) => (
        <BadgeItem
          key={i}
          badge={badge}
          index={i}
          frame={frame}
          fps={fps}
        />
      ))}
    </div>
  )
}

interface BadgeItemData {
  text: string
  color?: string
  background?: string
  icon?: string
}

function BadgeItem({
  badge,
  index,
  frame,
  fps,
}: {
  badge: BadgeItemData
  index: number
  frame: number
  fps: number
}) {
  const staggerDelay = 6 + index * 3
  const badgeFrame = Math.max(0, frame - staggerDelay)
  const badgeSpring = frame < staggerDelay ? 0 : spring({ frame: badgeFrame, fps, config: SPRING_BADGE })
  const badgeSettled = badgeSpring >= 0.999

  // Elastic pop-in
  const badgeScale = badgeSettled
    ? 1
    : interpolate(badgeSpring, [0, 0.3, 0.6, 0.85, 1], [0, 1.2, 0.9, 1.05, 1], CLAMP)
  const badgeOpacity = badgeSettled ? 1 : interpolate(badgeSpring, [0, 0.15], [0, 1], CLAMP)

  // Subtle idle breathing after settle
  const breathPhase = badgeSettled ? Math.sin((frame - staggerDelay) * 0.08 + index * 0.5) * 0.015 : 0
  const finalScale = badgeScale + breathPhase

  const bg = badge.background ?? "#6366F1"
  const color = badge.color ?? "#FFFFFF"

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 10px",
        borderRadius: 6,
        background: `linear-gradient(135deg, ${bg}ee, ${bg}cc)`,
        border: `1px solid ${bg}66`,
        boxShadow: `0 2px 8px ${bg}33`,
        transform: `scale(${finalScale})`,
        opacity: badgeOpacity,
        transformOrigin: "center center",
      }}
    >
      {badge.icon && (
        <span style={{ fontSize: 12 }}>{badge.icon}</span>
      )}
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color,
          fontFamily: "system-ui, sans-serif",
          whiteSpace: "nowrap",
          letterSpacing: 0.2,
        }}
      >
        {badge.text}
      </span>
    </div>
  )
}
