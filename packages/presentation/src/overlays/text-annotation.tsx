import type { TextCommand, Point } from "../types"

interface TextAnnotationProps {
  command: TextCommand
}

/**
 * Text annotation overlay -- Div with CSS slideUp + fadeIn animation.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function TextAnnotation({ command }: TextAnnotationProps) {
  const {
    position: _position,
    content,
    color = "#FFFFFF",
    fontSize = 18,
    fontWeight = 600,
    background = "rgba(99, 102, 241, 0.9)",
    textAlign = "left",
    animate = true,
  } = command
  const position = _position as Point
  const isCentered = textAlign === "center"

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        color,
        fontSize,
        fontWeight,
        background,
        padding: "8px 16px",
        borderRadius: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        whiteSpace: "pre-wrap",
        maxWidth: 400,
        lineHeight: 1.5,
        opacity: animate ? 0 : 1,
        transform: animate
          ? `${isCentered ? "translateX(-50%) " : ""}translateY(20px) scale(0.9)`
          : isCentered ? "translateX(-50%)" : undefined,
        animation: animate
          ? `${isCentered ? "presentationSlideUpCentered" : "presentationSlideUp"} 500ms ease-out forwards`
          : undefined,
        willChange: "opacity, transform",
      }}
    >
      {content}
    </div>
  )
}
