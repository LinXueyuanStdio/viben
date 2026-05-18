import { useCurrentFrame, useVideoConfig, spring } from "remotion"
import type { ListCommand, Point } from "../types"
import { staggerDelay } from "../utils/motion"

const SPRING_CONFIG = { damping: 16, stiffness: 100, mass: 0.9 } as const

interface ListProps {
  command: ListCommand
}

/**
 * List overlay -- Animated bullet list.
 * Each item slides in from left with stagger.
 * Parent computes all spring values to avoid per-item useCurrentFrame subscriptions.
 */
export function List({ command }: ListProps) {
  const {
    position: _position,
    items,
    listStyle = "bullet",
    color = "#FFFFFF",
    fontSize = 14,
    stagger = 4,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Pre-compute all item slide values in parent (no useMemo -- frame changes every render)
  const distance = 30
  const slideValues = items.map((_, index) => {
    const delay = staggerDelay(index, stagger)
    const progress = spring({ frame: frame - delay, fps, config: SPRING_CONFIG })
    const settled = progress >= 0.999
    return {
      opacity: settled ? 1 : progress,
      translateX: settled ? 0 : (1 - progress) * -distance,
    }
  })

  // Marker gradient colors
  const markerColors: Record<string, string[]> = {
    bullet: ["#6366F1", "#8B5CF6"],
    number: ["#6366F1", "#A855F7"],
    check: ["#10B981", "#34D399"],
    arrow: ["#6366F1", "#818CF8"],
  }
  const gradientPair = markerColors[listStyle] ?? markerColors.bullet

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
        padding: 20,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {items.map((item, index) => {
        const slide = slideValues[index]
        const itemColor = item.color || color
        const marker = item.icon || getMarker(listStyle, index)

        return (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              opacity: slide.opacity,
              transform: `translateX(${slide.translateX}px)`,
              willChange: "transform, opacity",
              marginBottom: 10,
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                fontSize: fontSize * 0.9,
                background: `linear-gradient(135deg, ${gradientPair[0]}, ${gradientPair[1]})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 600,
                flexShrink: 0,
                width: fontSize * 1.2,
                textAlign: "center",
                filter: `drop-shadow(0 0 4px ${gradientPair[0]}44)`,
              }}
            >
              {marker}
            </span>
            <span
              style={{
                fontSize,
                color: itemColor,
                lineHeight: 1.5,
                textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                letterSpacing: 0.2,
              }}
            >
              {item.text}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function getMarker(style: "bullet" | "number" | "check" | "arrow", index: number): string {
  switch (style) {
    case "bullet":
      return "\u2022"
    case "number":
      return `${index + 1}.`
    case "check":
      return "\u2713"
    case "arrow":
      return "\u2192"
  }
}
