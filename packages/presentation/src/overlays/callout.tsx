import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { CalloutCommand, Point } from "../types"

const SPRING_CONTAINER = { damping: 12, stiffness: 140, mass: 0.7 } as const
const SPRING_CONTENT = { damping: 14, stiffness: 120, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface CalloutProps {
  command: CalloutCommand
}

/**
 * Callout overlay -- Speech bubble with triangle pointer and cinematic entrance.
 *
 * Motion layers:
 *   1. Container: elastic scale entrance from arrow direction with blur
 *   2. Content text: staggered fade-in after container settles
 *   3. Arrow: pointer draws in with slight overshoot
 *   4. Glass morphism: frosted background, gradient border glow
 *   5. Subtle breathing pulse on border after settle
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Callout({ command }: CalloutProps) {
  const {
    position: _position,
    content,
    arrowDirection = "bottom",
    background: _background = "rgba(0, 0, 0, 0.9)",
    color = "#FFFFFF",
    maxWidth = 240,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ── Container entrance from arrow direction ──
  const containerProgress = spring({ frame, fps, config: SPRING_CONTAINER })
  const containerSettled = containerProgress >= 0.999
  const containerOpacity = containerSettled ? 1 : interpolate(containerProgress, [0, 0.2], [0, 1], CLAMP)
  const containerScale = containerSettled
    ? 1
    : interpolate(containerProgress, [0, 0.4, 0.75, 1], [0.7, 0.95, 1.04, 1], CLAMP)
  const containerBlur = containerSettled ? 0 : interpolate(containerProgress, [0, 0.4], [5, 0], CLAMP)

  // Direction-based entrance offset
  const entranceOffset = useMemo(() => {
    const distance = 15
    switch (arrowDirection) {
      case "bottom": return { x: 0, y: distance }
      case "top": return { x: 0, y: -distance }
      case "left": return { x: -distance, y: 0 }
      case "right": return { x: distance, y: 0 }
    }
  }, [arrowDirection])

  const translateX = containerSettled ? 0 : entranceOffset.x * (1 - containerProgress)
  const translateY = containerSettled ? 0 : entranceOffset.y * (1 - containerProgress)

  // ── Content text entrance (delayed) ──
  const contentDelay = 6
  const contentFrame = Math.max(0, frame - contentDelay)
  const contentSpring = frame < contentDelay ? 0 : spring({ frame: contentFrame, fps, config: SPRING_CONTENT })
  const contentSettled = contentSpring >= 0.999
  const contentOpacity = contentSettled ? 1 : interpolate(contentSpring, [0, 0.4], [0, 1], CLAMP)

  // ── Breathing border glow after settle ──
  const breathePhase = containerSettled ? (frame - 20) * 0.06 : 0
  const breatheIntensity = containerSettled ? 0.08 + 0.04 * Math.sin(breathePhase) : 0.08

  const triangleSize = 8

  // Memoize triangle style
  const triangleStyle = useMemo(
    () => getTriangleStyle(arrowDirection, triangleSize),
    [arrowDirection, triangleSize],
  )

  // Transform origin based on arrow direction
  const transformOrigin = useMemo(() => {
    switch (arrowDirection) {
      case "bottom": return "50% 100%"
      case "top": return "50% 0%"
      case "left": return "0% 50%"
      case "right": return "100% 50%"
    }
  }, [arrowDirection])

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        opacity: containerOpacity,
        transform: `translate(${translateX}px, ${translateY}px) scale(${containerScale})`,
        transformOrigin,
        filter: containerBlur > 0.01 ? `blur(${containerBlur}px)` : undefined,
        willChange: "transform, opacity",
      }}
    >
      {/* Bubble with glass morphism */}
      <div
        style={{
          position: "relative",
          maxWidth,
          background: "linear-gradient(135deg, rgba(15, 15, 30, 0.92), rgba(25, 25, 50, 0.88))",
          borderRadius: 12,
          border: `1px solid rgba(255, 255, 255, ${breatheIntensity})`,
          boxShadow: [
            "0 8px 32px rgba(0, 0, 0, 0.35)",
            "0 4px 12px rgba(0, 0, 0, 0.2)",
            "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
            "0 0 0 0.5px rgba(255, 255, 255, 0.04)",
          ].join(", "),
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          padding: 16,
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 14,
          lineHeight: 1.5,
          color,
          whiteSpace: "pre-wrap",
        }}
      >
        {/* Noise texture overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            opacity: 0.03,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            pointerEvents: "none",
          }}
        />

        {/* Subtle top-edge highlight for glass effect */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 12,
            right: 12,
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent)",
            borderRadius: "1px",
            pointerEvents: "none",
          }}
        />

        {/* Content with delayed entrance */}
        <div style={{ opacity: contentOpacity, position: "relative" }}>
          {content}
        </div>

        {/* Triangle pointer */}
        <div
          style={{
            position: "absolute",
            width: 0,
            height: 0,
            ...triangleStyle,
          }}
        />
      </div>
    </div>
  )
}

function getTriangleStyle(
  direction: "top" | "bottom" | "left" | "right",
  size: number,
): React.CSSProperties {
  const transparent = "transparent"
  // Use glass bg tone for the triangle to match the glass bubble
  const triangleColor = "rgba(20, 20, 40, 0.9)"

  switch (direction) {
    case "bottom":
      return {
        bottom: -size,
        left: "50%",
        marginLeft: -size,
        borderLeft: `${size}px solid ${transparent}`,
        borderRight: `${size}px solid ${transparent}`,
        borderTop: `${size}px solid ${triangleColor}`,
      }
    case "top":
      return {
        top: -size,
        left: "50%",
        marginLeft: -size,
        borderLeft: `${size}px solid ${transparent}`,
        borderRight: `${size}px solid ${transparent}`,
        borderBottom: `${size}px solid ${triangleColor}`,
      }
    case "left":
      return {
        left: -size,
        top: "50%",
        marginTop: -size,
        borderTop: `${size}px solid ${transparent}`,
        borderBottom: `${size}px solid ${transparent}`,
        borderRight: `${size}px solid ${triangleColor}`,
      }
    case "right":
      return {
        right: -size,
        top: "50%",
        marginTop: -size,
        borderTop: `${size}px solid ${transparent}`,
        borderBottom: `${size}px solid ${transparent}`,
        borderLeft: `${size}px solid ${triangleColor}`,
      }
  }
}
