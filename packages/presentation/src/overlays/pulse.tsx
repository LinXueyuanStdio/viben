import type { PulseCommand, Point } from "../types"

interface PulseProps {
  command: PulseCommand
}

/**
 * Pulse overlay -- Multiple concentric rings that expand and fade out.
 * Center dot stays solid; rings animate with staggered delay.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Pulse({ command }: PulseProps) {
  const { center: _center, radius = 20, color = "#6366F1", rings = 3, animate = true } = command
  const center = _center as Point

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {/* Center dot (always visible) */}
      <div
        style={{
          position: "absolute",
          left: center.x,
          top: center.y,
          width: radius * 0.5,
          height: radius * 0.5,
          borderRadius: "50%",
          background: color,
          transform: "translate(-50%, -50%)",
          opacity: animate ? 0 : 1,
          animation: animate ? "presentationFadeIn 300ms ease-out forwards" : undefined,
        }}
      />

      {/* Pulse rings */}
      {Array.from({ length: rings }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: center.x,
            top: center.y,
            width: radius * 2,
            height: radius * 2,
            borderRadius: "50%",
            border: `2px solid ${color}`,
            transform: "translate(-50%, -50%) scale(1)",
            opacity: animate ? 0.8 : 0,
            animation: animate
              ? `presentationPulse 1200ms ease-out ${i * 100}ms infinite`
              : undefined,
          }}
        />
      ))}
    </div>
  )
}
