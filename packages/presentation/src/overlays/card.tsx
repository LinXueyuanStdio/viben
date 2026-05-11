import type { CardCommand, Point } from "../types"

interface CardProps {
  command: CardCommand
}

/**
 * Card overlay -- Div with CSS slide-in animation + backdrop-filter for glass effect.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Card({ command }: CardProps) {
  const {
    position: _position,
    width = 320,
    title,
    content,
    imageSrc,
    enterFrom = "right",
    background = "rgba(20, 20, 35, 0.85)",
    titleColor = "#FFFFFF",
    contentColor = "rgba(255, 255, 255, 0.8)",
    borderColor = "rgba(255, 255, 255, 0.1)",
    tag,
    tagColor = "#6366F1",
    animate = true,
  } = command
  const position = _position as Point

  const animationName = animate ? getSlideAnimation(enterFrom) : undefined

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width,
        background,
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)",
        overflow: "hidden",
        fontFamily: "'PingFang SC', 'SF Pro Display', -apple-system, sans-serif",
        opacity: animate ? 0 : 1,
        transform: animate ? getInitialTransform(enterFrom) : undefined,
        animation: animationName
          ? `${animationName} 500ms ease-out forwards`
          : undefined,
      }}
    >
      {/* Card image */}
      {imageSrc && (
        <div style={{ width: "100%", height: 160, overflow: "hidden" }}>
          <img
            src={imageSrc}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      {/* Card content */}
      <div style={{ padding: "16px 20px" }}>
        {/* Tag */}
        {tag && (
          <div
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 600,
              color: tagColor,
              background: `${tagColor}20`,
              padding: "2px 8px",
              borderRadius: 4,
              marginBottom: 8,
              letterSpacing: 0.5,
            }}
          >
            {tag}
          </div>
        )}

        {/* Title */}
        {title && (
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: titleColor,
              marginBottom: content ? 8 : 0,
              lineHeight: 1.3,
            }}
          >
            {title}
          </div>
        )}

        {/* Body */}
        {content && (
          <div
            style={{
              fontSize: 13,
              color: contentColor,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {content}
          </div>
        )}
      </div>
    </div>
  )
}

function getSlideAnimation(enterFrom: "left" | "right" | "bottom" | "top"): string {
  switch (enterFrom) {
    case "left":
      return "presentationSlideInLeft"
    case "right":
      return "presentationSlideInRight"
    case "top":
      return "presentationSlideInUp"
    case "bottom":
      return "presentationSlideInDown"
  }
}

function getInitialTransform(enterFrom: "left" | "right" | "bottom" | "top"): string {
  switch (enterFrom) {
    case "left":
      return "translateX(-60px) scale(0.95)"
    case "right":
      return "translateX(60px) scale(0.95)"
    case "top":
      return "translateY(-60px) scale(0.95)"
    case "bottom":
      return "translateY(60px) scale(0.95)"
  }
}
