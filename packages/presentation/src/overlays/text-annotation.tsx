import type { TextCommand } from "../types"

interface TextAnnotationProps {
  command: TextCommand
}

/**
 * Text annotation overlay -- Div with CSS slideUp + fadeIn animation.
 */
export function TextAnnotation({ command }: TextAnnotationProps) {
  const {
    position,
    content,
    color = "#FFFFFF",
    fontSize = 18,
    fontWeight = 600,
    background = "rgba(99, 102, 241, 0.9)",
    animate = true,
  } = command

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
        transform: animate ? "translateY(20px) scale(0.9)" : undefined,
        animation: animate ? "presentationSlideUp 500ms ease-out forwards" : undefined,
      }}
    >
      {content}
    </div>
  )
}
