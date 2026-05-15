import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import { useCounter } from "../utils/motion"
import type { CounterCommand, Point } from "../types"

// Elastic spring for number entrance
const SPRING_NUMBER = { damping: 12, stiffness: 140, mass: 0.6 } as const
// Softer spring for prefix/suffix
const SPRING_AFFIX = { damping: 16, stiffness: 100, mass: 0.8 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface CounterProps {
  command: CounterCommand
}

/**
 * Counter overlay -- Large number with cinematic entrance and counting pulse.
 *
 * Motion layers:
 *   1. Number: elastic scale 0.8 -> 1.05 -> 1.0
 *   2. Blur: 6px -> 0 as number appears
 *   3. During counting: subtle scale pulse (1 -> 1.01 -> 1) per digit change
 *   4. Prefix/suffix: delayed fade-in with slight translateX
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Counter({ command }: CounterProps) {
  const {
    position: _position,
    value,
    prefix = "",
    suffix = "",
    color = "#FFFFFF",
    fontSize = 32,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ── Number entrance: elastic scale ──
  const numProgress = spring({ frame, fps, config: SPRING_NUMBER })
  const numSettled = numProgress >= 0.999

  // Scale: anticipation -> overshoot -> settle
  const baseScale = numSettled
    ? 1
    : interpolate(numProgress, [0, 0.2, 0.7, 1], [0.8, 0.85, 1.05, 1], CLAMP)

  // Blur: 6px -> 0
  const numBlur = numSettled ? 0 : interpolate(numProgress, [0, 0.6], [6, 0], CLAMP)

  // Opacity: fast in
  const numOpacity = numSettled ? 1 : interpolate(numProgress, [0, 0.3], [0, 1], CLAMP)

  // Container entrance
  const containerOpacity = numSettled ? 1 : interpolate(numProgress, [0, 0.2], [0, 1], CLAMP)

  // ── Counter animation with micro-pulse ──
  const counterDuration = 30
  const rawValue = useCounter(value, 0, counterDuration)
  const displayValue = Math.round(rawValue)
  const formattedValue = displayValue.toLocaleString()

  // Counting progress (0 -> 1)
  const countProgress = frame >= counterDuration ? 1 : Math.max(0, frame / counterDuration)
  // Micro-pulse during counting: gentle scale throb based on digit changes
  const digitPulse = countProgress < 1 && countProgress > 0
    ? 1 + 0.015 * Math.sin(frame * 0.8)
    : 1
  const finalScale = baseScale * digitPulse

  // ── Prefix entrance: delayed, slide from left ──
  const prefixDelay = 8
  const prefixFrame = Math.max(0, frame - prefixDelay)
  const prefixProgress = frame < prefixDelay
    ? 0
    : spring({ frame: prefixFrame, fps, config: SPRING_AFFIX })
  const prefixSettled = prefixProgress >= 0.999
  const prefixOpacity = prefixSettled ? 1 : interpolate(prefixProgress, [0, 0.4], [0, 1], CLAMP)
  const prefixTranslateX = prefixSettled ? 0 : (1 - prefixProgress) * -10

  // ── Suffix entrance: delayed, slide from right ──
  const suffixDelay = 10
  const suffixFrame = Math.max(0, frame - suffixDelay)
  const suffixProgress = frame < suffixDelay
    ? 0
    : spring({ frame: suffixFrame, fps, config: SPRING_AFFIX })
  const suffixSettled = suffixProgress >= 0.999
  const suffixOpacity = suffixSettled ? 1 : interpolate(suffixProgress, [0, 0.4], [0, 1], CLAMP)
  const suffixTranslateX = suffixSettled ? 0 : (1 - suffixProgress) * 10

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        display: "inline-flex",
        alignItems: "baseline",
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.6), rgba(25, 25, 50, 0.45))",
        padding: "8px 16px",
        borderRadius: 10,
        border: "1px solid rgba(255, 255, 255, 0.06)",
        boxShadow:
          "0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.08)",
        backdropFilter: "blur(12px) saturate(150%)",
        WebkitBackdropFilter: "blur(12px) saturate(150%)",
        opacity: containerOpacity,
      }}
    >
      {/* Prefix */}
      {prefix && (
        <span
          style={{
            color,
            fontSize: fontSize * 0.65,
            fontWeight: 500,
            fontFamily: "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif",
            marginRight: 2,
            opacity: prefixOpacity,
            transform: `translateX(${prefixTranslateX}px)`,
            display: "inline-block",
          }}
        >
          {prefix}
        </span>
      )}

      {/* Number */}
      <span
        style={{
          color,
          fontSize,
          fontWeight: 700,
          fontFamily: "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: -0.5,
          whiteSpace: "nowrap",
          textShadow: `0 2px 8px rgba(0, 0, 0, 0.3), 0 0 20px color-mix(in oklch, ${color} 20%, transparent)`,
          backgroundImage: `linear-gradient(180deg, ${color}, color-mix(in oklch, ${color} 75%, rgba(180, 180, 255, 0.8)))`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          opacity: numOpacity,
          transform: `scale(${finalScale})`,
          display: "inline-block",
          filter: numBlur > 0.01 ? `blur(${numBlur}px)` : undefined,
        }}
      >
        {formattedValue}
      </span>

      {/* Suffix */}
      {suffix && (
        <span
          style={{
            color,
            fontSize: fontSize * 0.65,
            fontWeight: 500,
            fontFamily: "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif",
            marginLeft: 2,
            opacity: suffixOpacity,
            transform: `translateX(${suffixTranslateX}px)`,
            display: "inline-block",
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  )
}
