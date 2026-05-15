import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { TextCommand, Point } from "../types"

// Spring for background plate wipe
const SPRING_PLATE = { damping: 16, stiffness: 100, mass: 0.9 } as const
// Spring for text content
const SPRING_TEXT = { damping: 14, stiffness: 120, mass: 0.7 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface TextAnnotationProps {
  command: TextCommand
}

/**
 * Text annotation overlay -- Glass card with cinematic clip-path wipe reveal.
 *
 * Motion layers:
 *   1. Background plate: clip-path wipe (left -> right)
 *   2. Text: delayed fade + translateY inside the plate
 *   3. Blur clear: 3px -> 0 on text
 *   4. Shimmer sweep after full reveal
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function TextAnnotation({ command }: TextAnnotationProps) {
  const {
    position: _position,
    content,
    color = "#FFFFFF",
    fontSize = 18,
    fontWeight = 600,
    background = "rgba(99, 102, 241, 0.9)",
    textAlign = "left",
  } = command
  const position = _position as Point
  const isCentered = textAlign === "center"

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ── Phase 1: Background plate clip-path wipe (left -> right) ──
  const plateProgress = spring({ frame, fps, config: SPRING_PLATE })
  const plateSettled = plateProgress >= 0.999

  // Clip-path: inset from right side, wiping open left-to-right
  // inset(top right bottom left) — right value goes 100% -> 0%
  const clipRight = plateSettled ? 0 : interpolate(plateProgress, [0, 1], [100, 0], CLAMP)
  // Slight vertical clip for dramatic feel
  const clipVertical = plateSettled ? 0 : interpolate(plateProgress, [0, 0.3], [5, 0], CLAMP)

  // Plate opacity: instant to avoid seeing the clip boundary on transparent bg
  const plateOpacity = plateSettled ? 1 : interpolate(plateProgress, [0, 0.1], [0, 1], CLAMP)

  // Scale: subtle anticipation
  const plateScale = plateSettled
    ? 1
    : interpolate(plateProgress, [0, 0.2, 0.8, 1], [0.97, 0.98, 1.01, 1], CLAMP)

  // ── Phase 2: Text content (delayed, fade + translateY + blur) ──
  const textDelay = 6
  const textFrame = Math.max(0, frame - textDelay)
  const textProgress = frame < textDelay
    ? 0
    : spring({ frame: textFrame, fps, config: SPRING_TEXT })
  const textSettled = textProgress >= 0.999

  const textOpacity = textSettled ? 1 : interpolate(textProgress, [0, 0.4], [0, 1], CLAMP)
  const textTranslateY = textSettled ? 0 : (1 - textProgress) * 8
  const textBlur = textSettled ? 0 : interpolate(textProgress, [0, 0.6], [3, 0], CLAMP)

  // ── Phase 3: Shimmer sweep after reveal ──
  const shimmerStart = 18
  const shimmerDuration = 35
  const shimmerElapsed = frame - shimmerStart
  const shimmerPosition = shimmerElapsed < 0
    ? -100
    : shimmerElapsed >= shimmerDuration
      ? 200
      : interpolate(shimmerElapsed, [0, shimmerDuration], [-20, 120], CLAMP)

  const translateX = isCentered ? "-50%" : "0px"

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        color,
        fontSize,
        fontWeight,
        fontFamily: "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif",
        letterSpacing: 0.2,
        background: `linear-gradient(135deg, ${background}, color-mix(in oklch, ${background} 75%, rgba(0, 0, 0, 0.3)))`,
        padding: "10px 20px",
        borderRadius: 10,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 -1px 0 rgba(0, 0, 0, 0.08)",
        textShadow: "0 1px 3px rgba(0, 0, 0, 0.25)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        whiteSpace: "pre-wrap",
        maxWidth: 400,
        lineHeight: 1.5,
        overflow: "hidden",
        opacity: plateOpacity,
        transform: `translateX(${translateX}) scale(${plateScale})`,
        clipPath: plateSettled
          ? undefined
          : `inset(${clipVertical}% ${clipRight}% ${clipVertical}% 0%)`,
      }}
    >
      {/* Shimmer sweep */}
      {shimmerPosition > -20 && shimmerPosition < 200 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 10,
            background: `linear-gradient(105deg, transparent ${shimmerPosition - 12}%, rgba(255, 255, 255, 0.08) ${shimmerPosition - 4}%, rgba(255, 255, 255, 0.15) ${shimmerPosition}%, rgba(255, 255, 255, 0.08) ${shimmerPosition + 4}%, transparent ${shimmerPosition + 12}%)`,
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}

      {/* Text content — delayed fade + translateY + blur */}
      <div
        style={{
          position: "relative",
          opacity: textOpacity,
          transform: `translateY(${textTranslateY}px)`,
          filter: textBlur > 0.01 ? `blur(${textBlur}px)` : undefined,
        }}
      >
        {content}
      </div>
    </div>
  )
}
