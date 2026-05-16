import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { CardCommand, Point } from "../types"
import type { SlideDirection } from "../utils/motion"

// Module-level direction map (avoids per-frame object allocation)
const ENTER_FROM_MAP: Record<string, SlideDirection> = {
  left: "left",
  right: "right",
  top: "top",
  bottom: "bottom",
}

// Spring configs for layered timing
const SPRING_CARD = { damping: 14, stiffness: 90, mass: 1.0 } as const
const SPRING_TITLE = { damping: 16, stiffness: 110, mass: 0.7 } as const
const SPRING_TAG = { damping: 10, stiffness: 160, mass: 0.5 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

// Direction unit vectors
const DIR_UNIT: Record<SlideDirection, readonly [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1],
} as const

interface CardProps {
  command: CardCommand
}

/**
 * Card overlay -- Premium glass card with cinematic layered entrance.
 *
 * Motion layers:
 *   1. Card body: clip-path inset reveal + blur clear + translateY
 *   2. Title: delayed slide from left with slight scale
 *   3. Content lines: staggered blur-to-clear reveal
 *   4. Tag badge: elastic bounce-in after card visible
 *   5. Border: animated gradient shimmer sweep after entrance
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Card({ command }: CardProps) {
  const {
    position: _position,
    width = 320,
    title,
    content,
    imageSrc,
    enterFrom = "right",
    background = "rgba(20, 20, 35, 0.85)",
    titleColor = "#FFFFFF",
    contentColor = "rgba(255, 255, 255, 0.8)",
    borderColor = "rgba(255, 255, 255, 0.1)",
    tag,
    tagColor = "#6366F1",
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const direction = ENTER_FROM_MAP[enterFrom] || "right"
  const [ux, uy] = DIR_UNIT[direction]

  // ── Phase 1: Card body entrance (clip-path reveal + blur + translate) ──
  const cardProgress = spring({ frame, fps, config: SPRING_CARD })
  const cardSettled = cardProgress >= 0.999

  // Clip-path: inset rectangle expanding outward from center
  // Starts fully clipped (50% on all sides = invisible), ends at 0% (fully visible)
  const clipInset = cardSettled ? 0 : interpolate(cardProgress, [0, 1], [50, 0], CLAMP)
  // Directional bias: the side we enter from opens faster
  const clipTop = direction === "bottom" ? clipInset * 0.5 : clipInset
  const clipRight = direction === "left" ? clipInset * 0.5 : clipInset
  const clipBottom = direction === "top" ? clipInset * 0.5 : clipInset
  const clipLeft = direction === "right" ? clipInset * 0.5 : clipInset

  // Blur: 8px -> 0 (clears faster than position)
  const cardBlur = cardSettled ? 0 : interpolate(cardProgress, [0, 0.6], [8, 0], CLAMP)

  // Translate with slight overshoot baked into spring
  const cardTranslateX = cardSettled ? 0 : (1 - cardProgress) * ux * 40
  const cardTranslateY = cardSettled ? 0 : (1 - cardProgress) * uy * 40

  // Scale: anticipation pull-back then overshoot
  const cardScale = cardSettled
    ? 1
    : interpolate(cardProgress, [0, 0.3, 0.8, 1], [0.92, 0.96, 1.02, 1], CLAMP)

  // Opacity: fastest layer
  const cardOpacity = cardSettled ? 1 : interpolate(cardProgress, [0, 0.4], [0, 1], CLAMP)

  // ── Phase 2: Title entrance (delayed, slide from left) ──
  const titleDelay = 6
  const titleFrame = Math.max(0, frame - titleDelay)
  const titleProgress = frame < titleDelay ? 0 : spring({ frame: titleFrame, fps, config: SPRING_TITLE })
  const titleSettled = titleProgress >= 0.999
  const titleOpacity = titleSettled ? 1 : interpolate(titleProgress, [0, 0.5], [0, 1], CLAMP)
  const titleTranslateX = titleSettled ? 0 : (1 - titleProgress) * -18
  const titleScale = titleSettled ? 1 : interpolate(titleProgress, [0, 1], [0.95, 1], CLAMP)
  const titleBlur = titleSettled ? 0 : interpolate(titleProgress, [0, 0.7], [3, 0], CLAMP)

  // ── Phase 3: Content lines — staggered blur reveal ──
  const contentDelay = 10
  const contentFrame = Math.max(0, frame - contentDelay)
  const contentProgress = frame < contentDelay
    ? 0
    : spring({ frame: contentFrame, fps, config: SPRING_TITLE })
  const contentSettled = contentProgress >= 0.999
  const contentOpacity = contentSettled ? 1 : interpolate(contentProgress, [0, 0.5], [0, 1], CLAMP)
  const contentTranslateY = contentSettled ? 0 : (1 - contentProgress) * 10
  const contentBlur = contentSettled ? 0 : interpolate(contentProgress, [0, 0.8], [4, 0], CLAMP)

  // ── Phase 4: Tag badge — elastic bounce after card visible ──
  const tagDelay = 14
  const tagFrame = Math.max(0, frame - tagDelay)
  const tagProgress = frame < tagDelay ? 0 : spring({ frame: tagFrame, fps, config: SPRING_TAG })
  const tagSettled = tagProgress >= 0.999
  const tagOpacity = tagSettled ? 1 : interpolate(tagProgress, [0, 0.3], [0, 1], CLAMP)
  // Elastic overshoot: 0.5 -> 1.12 -> 1.0
  const tagScale = tagSettled
    ? 1
    : interpolate(tagProgress, [0, 0.5, 0.8, 1], [0.5, 1.12, 0.97, 1], CLAMP)
  const tagTranslateY = tagSettled ? 0 : (1 - tagProgress) * -8

  // ── Phase 5: Shimmer sweep on border (after entrance settles) ──
  const shimmerStart = 20
  const shimmerDuration = 40
  const shimmerElapsed = frame - shimmerStart
  const shimmerPosition = shimmerElapsed < 0
    ? -100
    : shimmerElapsed >= shimmerDuration
      ? 200
      : interpolate(shimmerElapsed, [0, shimmerDuration], [-20, 120], CLAMP)

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width,
        background: `linear-gradient(135deg, ${background}, color-mix(in oklch, ${background} 85%, rgba(40, 40, 80, 0.6)))`,
        borderRadius: 16,
        border: `1px solid ${borderColor}`,
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.1)",
        overflow: "hidden",
        fontFamily: "'SF Pro Display', 'PingFang SC', 'Inter', -apple-system, sans-serif",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        opacity: cardOpacity,
        transform: `translateX(${cardTranslateX}px) translateY(${cardTranslateY}px) scale(${cardScale})`,
        filter: cardBlur > 0.01 ? `blur(${cardBlur}px)` : undefined,
        clipPath: cardSettled
          ? undefined
          : `inset(${clipTop}% ${clipRight}% ${clipBottom}% ${clipLeft}%)`,
      }}
    >
      {/* Shimmer sweep overlay */}
      {shimmerPosition > -20 && shimmerPosition < 200 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 16,
            background: `linear-gradient(105deg, transparent ${shimmerPosition - 15}%, rgba(255, 255, 255, 0.06) ${shimmerPosition - 5}%, rgba(255, 255, 255, 0.12) ${shimmerPosition}%, rgba(255, 255, 255, 0.06) ${shimmerPosition + 5}%, transparent ${shimmerPosition + 15}%)`,
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}

      {/* Card image */}
      {imageSrc && (
        <div style={{ width: "100%", height: 160, overflow: "hidden" }}>
          <img
            src={imageSrc}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      {/* Card content */}
      <div style={{ padding: "20px 24px" }}>
        {/* Tag — elastic bounce */}
        {tag && (
          <div
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 600,
              color: tagColor,
              background: `linear-gradient(135deg, ${tagColor}22, ${tagColor}14)`,
              padding: "3px 10px",
              borderRadius: 6,
              marginBottom: 10,
              letterSpacing: 0.6,
              border: `1px solid ${tagColor}30`,
              textShadow: `0 0 8px ${tagColor}40`,
              opacity: tagOpacity,
              transform: `translateY(${tagTranslateY}px) scale(${tagScale})`,
            }}
          >
            {tag}
          </div>
        )}

        {/* Title — slide from left with scale */}
        {title && (
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: titleColor,
              marginBottom: content ? 10 : 0,
              lineHeight: 1.35,
              letterSpacing: 0.15,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
              opacity: titleOpacity,
              transform: `translateX(${titleTranslateX}px) scale(${titleScale})`,
              filter: titleBlur > 0.01 ? `blur(${titleBlur}px)` : undefined,
            }}
          >
            {title}
          </div>
        )}

        {/* Body — staggered blur reveal */}
        {content && (
          <div
            style={{
              fontSize: 13,
              color: contentColor,
              lineHeight: 1.65,
              letterSpacing: 0.1,
              whiteSpace: "pre-wrap",
              opacity: contentOpacity,
              transform: `translateY(${contentTranslateY}px)`,
              filter: contentBlur > 0.01 ? `blur(${contentBlur}px)` : undefined,
            }}
          >
            {content}
          </div>
        )}
      </div>
    </div>
  )
}
