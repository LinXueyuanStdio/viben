import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring } from "remotion"
import type { ZoomCommand, Rect } from "../types"

const ENTRANCE_CONFIG = { damping: 14, stiffness: 150, mass: 0.7 } as const
const GLOW_CONFIG = { damping: 20, stiffness: 80, mass: 1 } as const

interface ZoomProps {
  command: ZoomCommand
}

/**
 * Zoom overlay -- Magnifying lens effect on a region.
 * Renders a circular lens shape that appears with a spring animation.
 * Premium visual: double-ring border, frosted glass gap, scan-lines, corner markers, glass label.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Zoom({ command }: ZoomProps) {
  const {
    region: _region,
    scale = 2,
    borderColor = "#6366F1",
  } = command
  const region = _region as Rect

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Spring entrance animation
  const entranceProgress = spring({
    frame,
    fps,
    config: ENTRANCE_CONFIG,
  })

  // Lens dimensions: circular based on the smaller dimension of the region
  const diameter = Math.min(region.width, region.height)
  const centerX = region.x + region.width / 2
  const centerY = region.y + region.height / 2

  // Glow opacity (animated)
  const glowOpacity = spring({
    frame: frame - 15,
    fps,
    config: GLOW_CONFIG,
  })

  // Ring dimensions
  const innerRingWidth = 2
  const gapWidth = 6
  const outerRingWidth = 3
  const totalBorderWidth = innerRingWidth + gapWidth + outerRingWidth
  const outerDiameter = diameter + totalBorderWidth * 2

  // Memoize borderColor-derived template strings
  const colorStyles = useMemo(() => ({
    innerBorder: `${innerRingWidth}px solid ${borderColor}`,
    outerBorder: `${outerRingWidth}px solid ${borderColor}66`,
    background: `radial-gradient(circle, ${borderColor}06 0%, ${borderColor}10 100%)`,
    boxShadow: `0 0 30px 12px ${borderColor}30, inset 0 0 25px ${borderColor}15, 0 4px 20px rgba(0,0,0,0.4)`,
    textShadow: `0 0 12px ${borderColor}80, 0 2px 4px rgba(0,0,0,0.5)`,
    labelBg: `linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 100%)`,
    labelBorder: `1px solid ${borderColor}44`,
  }), [borderColor])

  // Corner marker size
  const cornerSize = diameter * 0.12
  const cornerInset = 8

  return (
    <div
      style={{
        position: "absolute",
        left: centerX,
        top: centerY,
        width: outerDiameter,
        height: outerDiameter,
        borderRadius: "50%",
        transform: `translate(-50%, -50%) scale(${entranceProgress})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      {/* Outer ring */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: colorStyles.outerBorder,
          boxShadow: `0 0 20px 4px ${borderColor}20`,
        }}
      />

      {/* Frosted glass gap between rings */}
      <div
        style={{
          position: "absolute",
          inset: outerRingWidth,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      {/* Inner ring + main lens area */}
      <div
        style={{
          position: "absolute",
          inset: totalBorderWidth,
          borderRadius: "50%",
          border: colorStyles.innerBorder,
          overflow: "hidden",
          background: colorStyles.background,
        }}
      >
        {/* Subtle scan-line effect inside the lens */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(255,255,255,0.02) 3px, rgba(255,255,255,0.02) 4px)",
            opacity: 0.8,
            pointerEvents: "none",
          }}
        />

        {/* Corner markers (technical "L" shapes) */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: entranceProgress * 0.7,
          }}
          viewBox={`0 0 ${diameter} ${diameter}`}
        >
          {/* Top-left corner */}
          <polyline
            points={`${cornerInset},${cornerInset + cornerSize} ${cornerInset},${cornerInset} ${cornerInset + cornerSize},${cornerInset}`}
            fill="none"
            stroke={borderColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Top-right corner */}
          <polyline
            points={`${diameter - cornerInset - cornerSize},${cornerInset} ${diameter - cornerInset},${cornerInset} ${diameter - cornerInset},${cornerInset + cornerSize}`}
            fill="none"
            stroke={borderColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Bottom-left corner */}
          <polyline
            points={`${cornerInset},${diameter - cornerInset - cornerSize} ${cornerInset},${diameter - cornerInset} ${cornerInset + cornerSize},${diameter - cornerInset}`}
            fill="none"
            stroke={borderColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Bottom-right corner */}
          <polyline
            points={`${diameter - cornerInset - cornerSize},${diameter - cornerInset} ${diameter - cornerInset},${diameter - cornerInset} ${diameter - cornerInset},${diameter - cornerInset - cornerSize}`}
            fill="none"
            stroke={borderColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Crosshair lines */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: entranceProgress * 0.5,
          }}
        >
          <line x1="15%" y1="50%" x2="30%" y2="50%" stroke={borderColor} strokeWidth={1} strokeLinecap="round" opacity={0.6} />
          <line x1="70%" y1="50%" x2="85%" y2="50%" stroke={borderColor} strokeWidth={1} strokeLinecap="round" opacity={0.6} />
          <line x1="50%" y1="15%" x2="50%" y2="30%" stroke={borderColor} strokeWidth={1} strokeLinecap="round" opacity={0.6} />
          <line x1="50%" y1="70%" x2="50%" y2="85%" stroke={borderColor} strokeWidth={1} strokeLinecap="round" opacity={0.6} />
        </svg>
      </div>

      {/* Glow layer */}
      <div
        style={{
          position: "absolute",
          inset: -10,
          borderRadius: "50%",
          boxShadow: colorStyles.boxShadow,
          opacity: glowOpacity,
          pointerEvents: "none",
        }}
      />

      {/* Label with glass plate background */}
      <div
        style={{
          position: "absolute",
          bottom: -totalBorderWidth - 6,
          transform: "translateY(100%)",
          background: colorStyles.labelBg,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: colorStyles.labelBorder,
          borderRadius: 6,
          padding: "4px 10px",
          opacity: entranceProgress,
        }}
      >
        <span
          style={{
            color: borderColor,
            fontSize: Math.max(12, diameter * 0.1),
            fontWeight: 800,
            fontFamily: "system-ui, -apple-system, sans-serif",
            textShadow: colorStyles.textShadow,
            letterSpacing: 1,
          }}
        >
          {scale}x
        </span>
      </div>
    </div>
  )
}
