import type { TypewriterCommand, Point } from "../types"
import { useTypewriter } from "../utils/motion"
import { useCurrentFrame } from "remotion"

interface TypewriterProps {
  command: TypewriterCommand
}

/**
 * Typewriter overlay -- Glass plate bg, cursor with subtle glow, premium text rendering.
 * Text revealed character by character using Remotion frame-based animation.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Typewriter({ command }: TypewriterProps) {
  const {
    position: _position,
    content,
    fontSize = 16,
    fontWeight = 600,
    color = "#fff",
    background,
    speed = "normal",
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()

  // Remotion typewriter: characters revealed based on frame count
  const charCount = useTypewriter(content.length, speed as "slow" | "normal" | "fast", 0)

  const isTyping = charCount < content.length
  const displayText = content.slice(0, charCount)

  // Blinking cursor: toggle every 18 frames (~600ms at 30fps)
  const cursorVisible = isTyping && Math.floor(frame / 18) % 2 === 0

  const hasBackground = !!background

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize,
          fontWeight,
          color,
          fontFamily: "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif",
          letterSpacing: 0.15,
          background: hasBackground
            ? `linear-gradient(135deg, ${background}, color-mix(in oklch, ${background} 80%, rgba(0, 0, 0, 0.2)))`
            : undefined,
          padding: hasBackground ? "10px 18px" : undefined,
          borderRadius: hasBackground ? 10 : undefined,
          border: hasBackground ? "1px solid rgba(255, 255, 255, 0.08)" : undefined,
          boxShadow: hasBackground
            ? "0 6px 24px rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 -1px 0 rgba(0, 0, 0, 0.08)"
            : undefined,
          backdropFilter: hasBackground ? "blur(16px) saturate(170%)" : undefined,
          WebkitBackdropFilter: hasBackground ? "blur(16px) saturate(170%)" : undefined,
          textShadow: hasBackground
            ? "0 1px 3px rgba(0, 0, 0, 0.3)"
            : "0 1px 4px rgba(0, 0, 0, 0.4), 0 0 12px rgba(0, 0, 0, 0.15)",
          whiteSpace: "pre-wrap",
          lineHeight: 1.55,
        }}
      >
        {displayText}
        {/* Blinking cursor with glow */}
        {isTyping && (
          <span
            style={{
              display: "inline-block",
              width: "2px",
              height: `${fontSize}px`,
              background: color,
              marginLeft: 1,
              verticalAlign: "text-bottom",
              borderRadius: 1,
              boxShadow: `0 0 6px ${color}, 0 0 12px color-mix(in oklch, ${color} 40%, transparent)`,
              opacity: cursorVisible ? 1 : 0,
            }}
          />
        )}
      </div>
    </div>
  )
}
