import { useState, useEffect } from "react"
import type { ProgressCommand, Point } from "../types"

interface ProgressProps {
  command: ProgressCommand
}

/**
 * Progress overlay -- Horizontal bar with animated fill width.
 * Uses CSS transition with 300ms delay, then animates width over 800ms.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Progress({ command }: ProgressProps) {
  const {
    position: _position,
    width = 200,
    value,
    color = "#6366F1",
    trackColor = "rgba(255,255,255,0.15)",
    showLabel = false,
    label,
    animate = true,
  } = command
  const position = _position as Point

  const [started, setStarted] = useState(!animate)

  useEffect(() => {
    if (!animate) return
    const timer = setTimeout(() => setStarted(true), 300)
    return () => clearTimeout(timer)
  }, [animate])

  const barHeight = 8
  const displayLabel = label ?? `${Math.round(value)}%`

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width,
        opacity: animate ? 0 : 1,
        animation: animate ? "presentationFadeIn 300ms ease-out forwards" : undefined,
      }}
    >
      {/* Track */}
      <div
        style={{
          width: "100%",
          height: barHeight,
          borderRadius: barHeight / 2,
          background: trackColor,
          overflow: "hidden",
        }}
      >
        {/* Fill */}
        <div
          style={{
            height: "100%",
            width: started ? `${Math.min(100, Math.max(0, value))}%` : "0%",
            borderRadius: barHeight / 2,
            background: color,
            transition: animate ? "width 800ms cubic-bezier(0.4, 0, 0.2, 1)" : undefined,
          }}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            fontWeight: 600,
            color: color,
            textAlign: "right",
            opacity: started ? 1 : 0,
            transition: "opacity 300ms ease-out",
          }}
        >
          {displayLabel}
        </div>
      )}
    </div>
  )
}
