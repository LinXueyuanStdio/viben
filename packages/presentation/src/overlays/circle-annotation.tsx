import type { CircleCommand, Point } from "../types"

interface CircleAnnotationProps {
  command: CircleCommand
}

/**
 * Circle annotation overlay -- SVG circle with CSS stroke-dashoffset animation.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function CircleAnnotation({ command }: CircleAnnotationProps) {
  const { center: _center, radius, color = "#FF6B6B", strokeWidth = 3, animate = true } = command
  const center = _center as Point

  const circumference = 2 * Math.PI * radius

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <circle
          cx={center.x}
          cy={center.y}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animate ? circumference : 0}
          style={{
            animation: animate
              ? "presentationCircleDraw 500ms ease-out forwards"
              : undefined,
            // Use custom property for the circumference value
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ["--circumference" as any]: circumference,
          }}
        />
      </svg>
    </div>
  )
}
