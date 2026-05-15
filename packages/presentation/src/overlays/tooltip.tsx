import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { TooltipCommand, Point } from "../types"

// Spring configs for layered timing
const SPRING_CONTAINER = { damping: 10, stiffness: 140, mass: 0.6 } as const
const SPRING_ARROW = { damping: 8, stiffness: 160, mass: 0.5 } as const
const SPRING_TEXT = { damping: 14, stiffness: 130, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface TooltipProps {
  command: TooltipCommand
}

/**
 * Tooltip overlay -- A contextual tooltip pointing at a target element.
 *
 * Motion layers:
 *   1. Container: elastic pop-in from pointer direction
 *   2. Arrow/pointer: scale in
 *   3. Text content: fade with slight blur clear
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Tooltip({ command }: TooltipProps) {
  const {
    position: _position,
    content,
    direction = "top",
    background = "rgba(15, 15, 30, 0.95)",
    color = "#FFFFFF",
    maxWidth = 200,
    fontSize = 12,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ── Container entrance with elastic spring ──
  const containerProgress = spring({ frame, fps, config: SPRING_CONTAINER })
  const containerSettled = containerProgress >= 0.999
  const containerOpacity = containerSettled ? 1 : interpolate(containerProgress, [0, 0.2], [0, 1], CLAMP)
  const containerScale = containerSettled
    ? 1
    : interpolate(containerProgress, [0, 0.4, 0.7, 1], [0, 1.12, 0.96, 1], CLAMP)

  // Directional offset for entrance
  const dirOffset = containerSettled ? 0 : (1 - containerProgress) * 8
  let translateX = 0
  let translateY = 0
  switch (direction) {
    case "top": translateY = dirOffset; break
    case "bottom": translateY = -dirOffset; break
    case "left": translateX = dirOffset; break
    case "right": translateX = -dirOffset; break
  }

  // ── Arrow entrance ──
  const arrowDelay = 4
  const arrowFrame = Math.max(0, frame - arrowDelay)
  const arrowSpring = frame < arrowDelay ? 0 : spring({ frame: arrowFrame, fps, config: SPRING_ARROW })
  const arrowSettled = arrowSpring >= 0.999
  const arrowScale = arrowSettled ? 1 : interpolate(arrowSpring, [0, 0.5, 1], [0, 1.2, 1], CLAMP)

  // ── Text entrance ──
  const textDelay = 6
  const textFrame = Math.max(0, frame - textDelay)
  const textSpring = frame < textDelay ? 0 : spring({ frame: textFrame, fps, config: SPRING_TEXT })
  const textSettled = textSpring >= 0.999
  const textOpacity = textSettled ? 1 : interpolate(textSpring, [0, 0.4], [0, 1], CLAMP)
  const textBlur = textSettled ? 0 : interpolate(textSpring, [0, 0.6], [3, 0], CLAMP)

  // Arrow SVG positioning
  const arrowSize = 8
  const arrowStyle = getArrowStyle(direction, arrowSize)

  // Tooltip offset relative to position based on direction
  const tooltipOffset = getTooltipOffset(direction)

  return (
    <div
      style={{
        position: "absolute",
        left: position.x + tooltipOffset.x,
        top: position.y + tooltipOffset.y,
        transform: `translate(${translateX}px, ${translateY}px) scale(${containerScale})`,
        transformOrigin: getTransformOrigin(direction),
        opacity: containerOpacity,
        willChange: "transform, opacity",
      }}
    >
      {/* Tooltip body */}
      <div
        style={{
          background,
          borderRadius: 8,
          padding: "8px 12px",
          maxWidth,
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)",
          backdropFilter: "blur(12px) saturate(150%)",
          position: "relative",
        }}
      >
        {/* Text content */}
        <div
          style={{
            fontSize,
            fontWeight: 500,
            color,
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1.4,
            opacity: textOpacity,
            filter: textBlur > 0.01 ? `blur(${textBlur}px)` : undefined,
          }}
        >
          {content}
        </div>

        {/* Arrow/pointer */}
        <div
          style={{
            position: "absolute",
            ...arrowStyle.container,
            transform: `scale(${arrowScale})`,
            transformOrigin: "center",
          }}
        >
          <svg
            width={arrowSize * 2}
            height={arrowSize}
            style={{ display: "block", ...arrowStyle.svg }}
          >
            <polygon
              points={arrowStyle.points}
              fill={background}
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

function getTooltipOffset(direction: string): { x: number; y: number } {
  switch (direction) {
    case "top": return { x: -100, y: -50 }
    case "bottom": return { x: -100, y: 12 }
    case "left": return { x: -220, y: -20 }
    case "right": return { x: 12, y: -20 }
    default: return { x: -100, y: -50 }
  }
}

function getTransformOrigin(direction: string): string {
  switch (direction) {
    case "top": return "bottom center"
    case "bottom": return "top center"
    case "left": return "right center"
    case "right": return "left center"
    default: return "bottom center"
  }
}

function getArrowStyle(direction: string, size: number): {
  container: React.CSSProperties
  svg: React.CSSProperties
  points: string
} {
  switch (direction) {
    case "top":
      return {
        container: { bottom: -size + 1, left: "50%", marginLeft: -size },
        svg: {},
        points: `0,0 ${size},${size} ${size * 2},0`,
      }
    case "bottom":
      return {
        container: { top: -size + 1, left: "50%", marginLeft: -size },
        svg: { transform: "rotate(180deg)" },
        points: `0,0 ${size},${size} ${size * 2},0`,
      }
    case "left":
      return {
        container: { right: -size + 1, top: "50%", marginTop: -size / 2 },
        svg: { transform: "rotate(-90deg)" },
        points: `0,0 ${size},${size} ${size * 2},0`,
      }
    case "right":
      return {
        container: { left: -size + 1, top: "50%", marginTop: -size / 2 },
        svg: { transform: "rotate(90deg)" },
        points: `0,0 ${size},${size} ${size * 2},0`,
      }
    default:
      return {
        container: { bottom: -size + 1, left: "50%", marginLeft: -size },
        svg: {},
        points: `0,0 ${size},${size} ${size * 2},0`,
      }
  }
}
