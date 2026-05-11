import { useState, useEffect, useRef } from "react"
import type { TypewriterCommand, Point } from "../types"

interface TypewriterProps {
  command: TypewriterCommand
}

const SPEED_MAP: Record<string, number> = {
  slow: 80,
  normal: 45,
  fast: 25,
}

/**
 * Typewriter overlay -- Text revealed character by character.
 * Uses useState + setInterval to progressively show characters.
 * Includes a blinking cursor at the end during typing.
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
    animate = true,
  } = command
  const position = _position as Point

  const [charCount, setCharCount] = useState(animate ? 0 : content.length)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!animate) {
      setCharCount(content.length)
      return
    }

    setCharCount(0)
    const ms = SPEED_MAP[speed] ?? SPEED_MAP.normal

    intervalRef.current = setInterval(() => {
      setCharCount((prev) => {
        if (prev >= content.length) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          return content.length
        }
        return prev + 1
      })
    }, ms)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [animate, content, speed])

  const isTyping = charCount < content.length
  const displayText = content.slice(0, charCount)

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
          background: background || undefined,
          padding: background ? "6px 12px" : undefined,
          borderRadius: background ? 6 : undefined,
          whiteSpace: "pre-wrap",
          lineHeight: 1.5,
          fontFamily: "inherit",
        }}
      >
        {displayText}
        {/* Blinking cursor while typing */}
        {isTyping && (
          <span
            style={{
              display: "inline-block",
              width: "2px",
              height: `${fontSize}px`,
              background: color,
              marginLeft: 1,
              verticalAlign: "text-bottom",
              animation: "presentationTypewriterCursor 600ms step-end infinite",
            }}
          />
        )}
      </div>
    </div>
  )
}
