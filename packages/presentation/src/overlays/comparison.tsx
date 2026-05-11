import { useState, useEffect, useRef } from "react"
import type { ComparisonCommand, Point } from "../types"

interface ComparisonProps {
  command: ComparisonCommand
}

/**
 * Comparison overlay -- Dual horizontal bar that grows from center outward.
 * Left bar extends leftward, right bar extends rightward.
 * Uses CSS width transitions and rAF counter animation for values.
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
    animate = true,
  } = command
  const position = _position as Point

  const [started, setStarted] = useState(!animate)
  const [displayLeft, setDisplayLeft] = useState(animate ? 0 : leftValue)
  const [displayRight, setDisplayRight] = useState(animate ? 0 : rightValue)
  const rafRef = useRef<number>(0)

  // Trigger animation after a short delay
  useEffect(() => {
    if (!animate) return
    const timer = setTimeout(() => setStarted(true), 300)
    return () => clearTimeout(timer)
  }, [animate])

  // Counter animation for displayed values
  useEffect(() => {
    if (!animate || !started) return

    const duration = 800
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)

      setDisplayLeft(Math.round(eased * leftValue))
      setDisplayRight(Math.round(eased * rightValue))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [animate, started, leftValue, rightValue])

  const barHeight = 28
  const labelFontSize = 12
  const valueFontSize = 13

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width,
        pointerEvents: "none",
        opacity: animate ? 0 : 1,
        animation: animate ? "presentationFadeIn 300ms ease-out forwards" : undefined,
      }}
    >
      {/* Labels row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: labelFontSize,
            fontWeight: 600,
            color: leftColor,
            whiteSpace: "nowrap",
          }}
        >
          {leftLabel}
        </div>
        <div
          style={{
            fontSize: labelFontSize,
            fontWeight: 600,
            color: rightColor,
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
          borderRadius: barHeight / 2,
          overflow: "hidden",
          background: "rgba(255,255,255,0.08)",
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
              width: started ? `${Math.min(100, Math.max(0, leftValue))}%` : "0%",
              background: leftColor,
              borderRadius: `${barHeight / 2}px 0 0 ${barHeight / 2}px`,
              transition: animate ? "width 800ms cubic-bezier(0.4, 0, 0.2, 1)" : undefined,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              minWidth: started ? 32 : 0,
            }}
          >
            <span
              style={{
                fontSize: valueFontSize,
                fontWeight: 700,
                color: "#fff",
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
                opacity: started ? 1 : 0,
                transition: "opacity 300ms ease-out 400ms",
              }}
            >
              {displayLeft}{unit}
            </span>
          </div>
        </div>

        {/* Center divider */}
        <div
          style={{
            width: 2,
            height: "100%",
            background: "rgba(255,255,255,0.3)",
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
              width: started ? `${Math.min(100, Math.max(0, rightValue))}%` : "0%",
              background: rightColor,
              borderRadius: `0 ${barHeight / 2}px ${barHeight / 2}px 0`,
              transition: animate ? "width 800ms cubic-bezier(0.4, 0, 0.2, 1)" : undefined,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              minWidth: started ? 32 : 0,
            }}
          >
            <span
              style={{
                fontSize: valueFontSize,
                fontWeight: 700,
                color: "#fff",
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
                opacity: started ? 1 : 0,
                transition: "opacity 300ms ease-out 400ms",
              }}
            >
              {displayRight}{unit}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
