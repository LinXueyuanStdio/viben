import type { BadgeCommand, Point } from "../types"

interface BadgeProps {
  command: BadgeCommand
}

const FONT_SIZES = {
  sm: 11,
  md: 13,
  lg: 15,
} as const

/**
 * Badge overlay -- Small rounded-full div with text, animated with slideUp.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Badge({ command }: BadgeProps) {
  const {
    position: _position,
    text,
    color = "#FFFFFF",
    background = "#6366F1",
    size = "md",
    animate = true,
  } = command
  const position = _position as Point

  const fontSize = FONT_SIZES[size]
  const padding = size === "sm" ? "3px 8px" : size === "lg" ? "5px 14px" : "4px 10px"

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        color,
        background,
        fontSize,
        fontWeight: 600,
        padding,
        borderRadius: 999,
        whiteSpace: "nowrap",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        lineHeight: 1.4,
        opacity: animate ? 0 : 1,
        transform: animate ? "translateY(20px) scale(0.9)" : undefined,
        animation: animate ? "presentationSlideUp 400ms ease-out forwards" : undefined,
      }}
    >
      {text}
    </div>
  )
}
