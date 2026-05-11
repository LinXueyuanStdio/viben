import { useState, useEffect, useRef } from "react"
import type { CounterCommand, Point } from "../types"

interface CounterProps {
  command: CounterCommand
}

/**
 * Counter overlay -- Animated number counting from 0 to target value.
 * Uses requestAnimationFrame with ease-out for smooth counting.
 * Does NOT use CSS animation for the counting (uses JS animation via useEffect).
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
    animate = true,
  } = command
  const position = _position as Point

  const [displayValue, setDisplayValue] = useState(animate ? 0 : value)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!animate) {
      setDisplayValue(value)
      return
    }

    const duration = 1000
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease-out: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3)

      setDisplayValue(Math.round(eased * value))

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
  }, [animate, value])

  // Format number with locale string for thousands separators
  const formattedValue = Number.isInteger(value)
    ? displayValue.toLocaleString()
    : displayValue.toLocaleString()

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        color,
        fontSize,
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        opacity: animate ? 0 : 1,
        animation: animate ? "presentationFadeIn 200ms ease-out forwards" : undefined,
      }}
    >
      {prefix}{formattedValue}{suffix}
    </div>
  )
}
