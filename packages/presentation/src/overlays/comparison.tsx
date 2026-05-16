import { useMemo } from "react"
import type { ComparisonCommand, Point } from "../types"
import { useFadeIn, useCounter } from "../utils/motion"
import { useCurrentFrame, interpolate } from "remotion"

interface ComparisonProps {
  command: ComparisonCommand
}

/**
 * Comparison overlay -- Glass card container, gradient bars with inner shine, refined typography.
 * Dual horizontal bar that grows from center outward.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Comparison({ command }: ComparisonProps) {
  const {
    position: _position,
    width,
    leftLabel,
    rightLabel,
    leftValue,
    rightValue,
    leftColor,
    rightColor,
    unit = "",
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()

  // Remotion animations
  const containerOpacity = useFadeIn(0, 9)
  // Bar width grows with spring after a short delay (~9 frames)
  const barProgress = interpolate(frame - 9, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  // Ease-out cubic for bar width
  const easedBarProgress = 1 - Math.pow(1 - barProgress, 3)

  // Counter animation for values (delay 9 frames, duration 24 frames)
  const displayLeft = useCounter(leftValue, 9, 24)
  const displayRight = useCounter(rightValue, 9, 24)

  // Value label opacity (appears after bars start growing)
  const valueLabelOpacity = useFadeIn(18, 9)

  const barHeight = 32
  const labelFontSize = 12
  const valueFontSize = 13

  // Memoize borderRadius strings derived from barHeight (stable constant)
  const radiusStyles = useMemo(() => ({
    left: `${barHeight / 2}px 0 0 ${barHeight / 2}px`,
    right: `0 ${barHeight / 2}px ${barHeight / 2}px 0`,
    container: barHeight / 2,
  }), [barHeight])

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width,
        pointerEvents: "none",
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.5), rgba(25, 25, 50, 0.35))",
        padding: "16px 20px",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.06)",
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04), inset 0 -1px 0 rgba(0, 0, 0, 0.08)",
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        opacity: containerOpacity,
      }}
    >
      {/* Labels row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: labelFontSize,
            fontWeight: 600,
            fontFamily: "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif",
            letterSpacing: 0.4,
            color: leftColor,
            textShadow: `0 0 8px color-mix(in oklch, ${leftColor} 30%, transparent)`,
            whiteSpace: "nowrap",
          }}
        >
          {leftLabel}
        </div>
        <div
          style={{
            fontSize: labelFontSize,
            fontWeight: 600,
            fontFamily: "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif",
            letterSpacing: 0.4,
            color: rightColor,
            textShadow: `0 0 8px color-mix(in oklch, ${rightColor} 30%, transparent)`,
            whiteSpace: "nowrap",
          }}
        >
          {rightLabel}
        </div>
      </div>

      {/* Bars container */}
      <div
        style={{
          display: "flex",
          width: "100%",
          height: barHeight,
          borderRadius: radiusStyles.container,
          overflow: "hidden",
          background: "linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.08))",
          boxShadow:
            "inset 0 1px 3px rgba(0, 0, 0, 0.25), inset 0 -1px 1px rgba(255, 255, 255, 0.03), 0 1px 2px rgba(0, 0, 0, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.04)",
        }}
      >
        {/* Left bar - grows from right edge to left */}
        <div
          style={{
            width: "50%",
            height: "100%",
            display: "flex",
            justifyContent: "flex-end",
            position: "relative",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "100%",
              background: `linear-gradient(180deg, color-mix(in oklch, ${leftColor} 85%, #fff) 0%, ${leftColor} 50%, color-mix(in oklch, ${leftColor} 80%, #000) 100%)`,
              borderRadius: radiusStyles.left,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 10px color-mix(in oklch, ${leftColor} 25%, transparent)`,
              transformOrigin: "right center",
              transform: `scaleX(${Math.min(1, Math.max(0, leftValue / 100)) * easedBarProgress})`,
            }}
          >
            <span
              style={{
                fontSize: valueFontSize,
                fontWeight: 700,
                fontFamily: "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif",
                color: "#fff",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: 0.2,
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
                whiteSpace: "nowrap",
                opacity: valueLabelOpacity,
              }}
            >
              {Math.round(displayLeft)}{unit}
            </span>
          </div>
        </div>

        {/* Center divider */}
        <div
          style={{
            width: 2,
            height: "100%",
            background: "linear-gradient(180deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.15))",
            boxShadow: "0 0 4px rgba(255, 255, 255, 0.1)",
            flexShrink: 0,
          }}
        />

        {/* Right bar - grows from left edge to right */}
        <div
          style={{
            width: "50%",
            height: "100%",
            display: "flex",
            justifyContent: "flex-start",
            position: "relative",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "100%",
              background: `linear-gradient(180deg, color-mix(in oklch, ${rightColor} 85%, #fff) 0%, ${rightColor} 50%, color-mix(in oklch, ${rightColor} 80%, #000) 100%)`,
              borderRadius: radiusStyles.right,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 10px color-mix(in oklch, ${rightColor} 25%, transparent)`,
              transformOrigin: "left center",
              transform: `scaleX(${Math.min(1, Math.max(0, rightValue / 100)) * easedBarProgress})`,
            }}
          >
            <span
              style={{
                fontSize: valueFontSize,
                fontWeight: 700,
                fontFamily: "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif",
                color: "#fff",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: 0.2,
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
                whiteSpace: "nowrap",
                opacity: valueLabelOpacity,
              }}
            >
              {Math.round(displayRight)}{unit}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
