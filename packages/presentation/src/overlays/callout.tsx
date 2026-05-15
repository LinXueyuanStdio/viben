import { useMemo } from "react"
import type { CalloutCommand, Point } from "../types"
import { useEntrance } from "../utils/motion"

interface CalloutProps {
  command: CalloutCommand
}

/**
 * Callout overlay -- Speech bubble with triangle pointer.
 * Spring entrance (scale from 0.8 + opacity).
 * Premium: frosted glass background, soft shadow, gradient border, refined arrow.
 */
export function Callout({ command }: CalloutProps) {
  const {
    position: _position,
    content,
    arrowDirection = "bottom",
    background = "rgba(0, 0, 0, 0.9)",
    color = "#FFFFFF",
    maxWidth = 240,
  } = command
  const position = _position as Point

  const entrance = useEntrance(0, 12)

  const triangleSize = 8

  // Memoize triangle style -- builds 3 border template strings per call
  const triangleStyle = useMemo(
    () => getTriangleStyle(arrowDirection, triangleSize, background),
    [arrowDirection, triangleSize, background],
  )

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        opacity: entrance.opacity,
        transform: `translateY(${entrance.translateY}px) scale(${entrance.scale})`,
        willChange: "transform, opacity",
      }}
    >
      {/* Bubble with glass morphism */}
      <div
        style={{
          position: "relative",
          maxWidth,
          background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
          borderRadius: 12,
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: [
            "0 8px 32px rgba(0, 0, 0, 0.3)",
            "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
            "0 0 0 0.5px rgba(255, 255, 255, 0.04)",
          ].join(", "),
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          padding: 16,
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 14,
          lineHeight: 1.5,
          color,
          whiteSpace: "pre-wrap",
        }}
      >
        {/* Subtle top-edge highlight for glass effect */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 12,
            right: 12,
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12), transparent)",
            borderRadius: "1px",
            pointerEvents: "none",
          }}
        />

        {content}

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
  _color: string,
): React.CSSProperties {
  const transparent = "transparent"
  // Use glass bg tone for the triangle to match the glass bubble
  const triangleColor = "rgba(20, 20, 40, 0.85)"

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
