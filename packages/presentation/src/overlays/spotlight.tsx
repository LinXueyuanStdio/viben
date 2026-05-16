import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { SpotlightCommand, Rect } from "../types"

// Spring configs
const SPRING_MASK = { damping: 16, stiffness: 100, mass: 1.0 } as const
const SPRING_SHAPE = { damping: 12, stiffness: 120, mass: 0.8 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface SpotlightProps {
  command: SpotlightCommand
}

/**
 * Spotlight overlay -- Premium dimming mask with cinematic entrance.
 *
 * Motion layers:
 *   1. Mask fade: from 0 opacity to target maskOpacity (spring, not instant)
 *   2. Spotlight cutout: animated border-radius (starts more rounded, settles)
 *   3. Feathered edge: subtle radial gradient at spotlight boundary
 *   4. Subtle breathing: spotlight size oscillates +/- 2px after settle
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Spotlight({ command }: SpotlightProps) {
  const { region: _region, maskOpacity = 0.7, borderRadius = 12 } = command
  const region = _region as Rect

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ── Mask fade: spring-based opacity ramp ──
  const maskProgress = spring({ frame, fps, config: SPRING_MASK })
  const maskSettled = maskProgress >= 0.999
  const currentMaskOpacity = maskSettled ? 1 : interpolate(maskProgress, [0, 1], [0, 1], CLAMP)

  // ── Spotlight shape: animated border-radius ──
  const shapeProgress = spring({ frame, fps, config: SPRING_SHAPE })
  const shapeSettled = shapeProgress >= 0.999
  // Start more rounded (pill-like), settle to target borderRadius
  const maxRadius = Math.min(region.width, region.height) * 0.4
  const currentBorderRadius = shapeSettled
    ? borderRadius
    : interpolate(shapeProgress, [0, 1], [maxRadius, borderRadius], CLAMP)

  // Scale: starts slightly smaller, expands to full
  const spotlightScale = shapeSettled
    ? 1
    : interpolate(shapeProgress, [0, 0.6, 1], [0.85, 1.02, 1], CLAMP)

  // ── Breathing: subtle size oscillation after settle ──
  const breathPhase = Math.max(0, frame - 20)
  const breathOffset = maskSettled ? 1.5 * Math.sin(breathPhase * 0.08) : 0

  // Current spotlight dimensions with breathing
  const spotWidth = region.width * spotlightScale + breathOffset * 2
  const spotHeight = region.height * spotlightScale + breathOffset * 2
  const spotX = region.x - (spotWidth - region.width) / 2
  const spotY = region.y - (spotHeight - region.height) / 2

  // Memoize template strings derived from maskOpacity (stable across frames)
  const styles = useMemo(() => {
    const shadowColor = `rgba(0, 0, 0, ${maskOpacity})`
    return {
      boxShadow: [
        `0 0 0 9999px ${shadowColor}`,
        `inset 0 0 30px 8px rgba(255, 255, 255, 0.04)`,
        `inset 0 0 2px 1px rgba(255, 255, 255, 0.12)`,
      ].join(", "),
      border: `2px solid rgba(255, 255, 255, ${maskOpacity * 0.35})`,
    }
  }, [maskOpacity])

  // Border glow pulse after entrance
  const borderGlowPhase = Math.max(0, frame - 15)
  const borderGlow = maskSettled
    ? 0.08 + 0.04 * Math.sin(borderGlowPhase * 0.1)
    : 0

  return (
    <div
      style={{
        position: "absolute",
        left: spotX,
        top: spotY,
        width: spotWidth,
        height: spotHeight,
        borderRadius: currentBorderRadius,
        boxShadow: [
          styles.boxShadow,
          // Animated border glow
          borderGlow > 0
            ? `0 0 ${10 + borderGlow * 40}px rgba(255, 255, 255, ${borderGlow})`
            : "",
        ].filter(Boolean).join(", "),
        border: styles.border,
        opacity: currentMaskOpacity,
        pointerEvents: "none",
        transition: undefined, // no CSS transitions, all frame-driven
      }}
    >
      {/* Radial gradient feathered edge overlay */}
      <div
        style={{
          position: "absolute",
          inset: -8,
          borderRadius: currentBorderRadius + 8,
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(255, 255, 255, 0.04) 75%, transparent 100%)",
          pointerEvents: "none",
          opacity: currentMaskOpacity,
        }}
      />

      {/* Inner luminous edge — subtle ring */}
      <div
        style={{
          position: "absolute",
          inset: 1,
          borderRadius: currentBorderRadius - 1,
          border: `1px solid rgba(255, 255, 255, ${0.06 + borderGlow * 0.5})`,
          pointerEvents: "none",
        }}
      />
    </div>
  )
}
