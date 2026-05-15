import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { CodeBlockCommand, Point } from "../types"

// Spring configs
const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_LINE = { damping: 14, stiffness: 140, mass: 0.5 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface CodeBlockProps {
  command: CodeBlockCommand
}

/**
 * CodeBlock overlay -- Animated code snippet with syntax highlighting.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance with header bar
 *   2. Lines: staggered type-in effect (characters reveal left-to-right)
 *   3. Highlighted lines: glow background fade-in after line types
 *   4. Line numbers: subtle fade-in synced with line type
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function CodeBlock({ command }: CodeBlockProps) {
  const {
    position: _position,
    code,
    language = "typescript",
    highlightLines = [],
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ── Container entrance ──
  const containerProgress = spring({ frame, fps, config: SPRING_CONTAINER })
  const containerSettled = containerProgress >= 0.999
  const containerOpacity = containerSettled ? 1 : interpolate(containerProgress, [0, 0.3], [0, 1], CLAMP)
  const containerScale = containerSettled
    ? 1
    : interpolate(containerProgress, [0, 0.3, 0.8, 1], [0.92, 0.95, 1.02, 1], CLAMP)
  const containerTranslateY = containerSettled ? 0 : (1 - containerProgress) * 12
  const containerBlur = containerSettled ? 0 : interpolate(containerProgress, [0, 0.5], [4, 0], CLAMP)

  // Parse lines
  const lines = useMemo(() => code.split("\n"), [code])

  // Determine syntax colors based on language
  const colorize = useMemo(() => createColorizer(language), [language])

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        transform: `translateY(${containerTranslateY}px) scale(${containerScale})`,
        opacity: containerOpacity,
        filter: containerBlur > 0.01 ? `blur(${containerBlur}px)` : undefined,
        willChange: "transform, opacity",
        background: "linear-gradient(135deg, rgba(12, 12, 24, 0.94), rgba(20, 20, 40, 0.90))",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
        overflow: "hidden",
        minWidth: 300,
        maxWidth: 560,
      }}
    >
      {/* Title bar (macOS style) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F57" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FEBC2E" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28C840" }} />
        </div>
        <span
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 10,
            fontWeight: 600,
            color: "rgba(255,255,255,0.35)",
            fontFamily: "SFMono-Regular, Consolas, monospace",
            letterSpacing: 0.3,
          }}
        >
          {language}
        </span>
      </div>

      {/* Code lines */}
      <div style={{ padding: "14px 0", overflow: "hidden" }}>
        {lines.map((line, i) => (
          <CodeLine
            key={i}
            line={line}
            lineNumber={i + 1}
            index={i}
            isHighlighted={highlightLines.includes(i + 1)}
            frame={frame}
            fps={fps}
            colorize={colorize}
          />
        ))}
      </div>
    </div>
  )
}

function CodeLine({
  line,
  lineNumber,
  index,
  isHighlighted,
  frame,
  fps,
  colorize,
}: {
  line: string
  lineNumber: number
  index: number
  isHighlighted: boolean
  frame: number
  fps: number
  colorize: (text: string) => Array<{ text: string; color: string }>
}) {
  // Stagger line entrance
  const lineDelay = 6 + index * 3
  const lineFrame = Math.max(0, frame - lineDelay)
  const lineSpring = frame < lineDelay ? 0 : spring({ frame: lineFrame, fps, config: SPRING_LINE })
  const lineSettled = lineSpring >= 0.999

  // Type-in: reveal characters based on progress
  const typeProgress = lineSettled ? 1 : interpolate(lineSpring, [0, 1], [0, 1], CLAMP)
  const visibleChars = Math.floor(line.length * typeProgress)

  // Line opacity
  const lineOpacity = lineSettled ? 1 : interpolate(lineSpring, [0, 0.1], [0, 1], CLAMP)

  // Highlight glow (after line settles)
  const glowDelay = lineDelay + 10
  const glowFrame = Math.max(0, frame - glowDelay)
  const glowSpring = frame < glowDelay ? 0 : spring({ frame: glowFrame, fps, config: SPRING_CONTAINER })
  const glowSettled = glowSpring >= 0.999
  const glowOpacity = isHighlighted ? (glowSettled ? 1 : interpolate(glowSpring, [0, 0.5], [0, 1], CLAMP)) : 0

  // Colorize the visible text
  const tokens = useMemo(() => colorize(line), [line, colorize])

  // Compute visible portion of tokens
  const visibleTokens = useMemo(() => {
    let charsRemaining = visibleChars
    const result: Array<{ text: string; color: string }> = []

    for (const token of tokens) {
      if (charsRemaining <= 0) break
      if (charsRemaining >= token.text.length) {
        result.push(token)
        charsRemaining -= token.text.length
      } else {
        result.push({ text: token.text.slice(0, charsRemaining), color: token.color })
        charsRemaining = 0
      }
    }

    return result
  }, [tokens, visibleChars])

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        minHeight: 22,
        opacity: lineOpacity,
        position: "relative",
      }}
    >
      {/* Highlight background */}
      {isHighlighted && glowOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(99, 102, 241, 0.08)",
            borderLeft: "2px solid rgba(99, 102, 241, 0.6)",
            opacity: glowOpacity,
            boxShadow: "inset 0 0 20px rgba(99, 102, 241, 0.05)",
          }}
        />
      )}

      {/* Line number */}
      <span
        style={{
          width: 40,
          flexShrink: 0,
          textAlign: "right",
          paddingRight: 12,
          fontSize: 11,
          fontWeight: 500,
          color: isHighlighted && glowOpacity > 0.5
            ? "rgba(129, 140, 248, 0.7)"
            : "rgba(255,255,255,0.2)",
          fontFamily: "SFMono-Regular, Consolas, monospace",
          lineHeight: "22px",
          userSelect: "none",
        }}
      >
        {lineNumber}
      </span>

      {/* Code content */}
      <span
        style={{
          flex: 1,
          fontSize: 12,
          fontFamily: "SFMono-Regular, Consolas, 'Courier New', monospace",
          lineHeight: "22px",
          whiteSpace: "pre",
          paddingRight: 14,
          position: "relative",
        }}
      >
        {visibleTokens.map((token, ti) => (
          <span key={ti} style={{ color: token.color }}>
            {token.text}
          </span>
        ))}
        {/* Cursor blink at typing position */}
        {!lineSettled && typeProgress > 0 && typeProgress < 1 && (
          <span
            style={{
              display: "inline-block",
              width: 1.5,
              height: 14,
              background: "rgba(255,255,255,0.7)",
              marginLeft: 1,
              verticalAlign: "middle",
              boxShadow: "0 0 4px rgba(255,255,255,0.4)",
            }}
          />
        )}
      </span>
    </div>
  )
}

/**
 * Simple token-based colorizer.
 * Returns an array of {text, color} segments.
 */
function createColorizer(_language: string): (text: string) => Array<{ text: string; color: string }> {
  // Keywords for common languages
  const keywords = new Set([
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "import", "export", "from", "default", "class", "extends", "new", "this",
    "async", "await", "try", "catch", "throw", "typeof", "interface", "type",
    "def", "self", "print", "True", "False", "None", "in", "not", "and", "or",
    "fn", "pub", "mut", "impl", "struct", "enum", "use", "mod", "trait",
  ])

  const types = new Set([
    "string", "number", "boolean", "void", "null", "undefined", "any",
    "int", "float", "str", "bool", "list", "dict", "tuple",
    "i32", "u32", "i64", "u64", "f32", "f64", "usize", "Vec", "String",
  ])

  return (text: string): Array<{ text: string; color: string }> => {
    if (!text) return [{ text: "", color: "rgba(255,255,255,0.85)" }]

    const result: Array<{ text: string; color: string }> = []
    // Simple regex-based tokenizer
    const tokenRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/.*$|\/\*[\s\S]*?\*\/|#.*$|\d+\.?\d*|[a-zA-Z_$][\w$]*|[^\s\w]+|\s+)/gm
    let match: RegExpExecArray | null

    while ((match = tokenRegex.exec(text)) !== null) {
      const token = match[0]

      // String literals
      if (/^["'`]/.test(token)) {
        result.push({ text: token, color: "#A5D6A7" }) // green
      }
      // Comments
      else if (/^(\/\/|\/\*|#)/.test(token)) {
        result.push({ text: token, color: "rgba(255,255,255,0.35)" }) // dimmed
      }
      // Numbers
      else if (/^\d/.test(token)) {
        result.push({ text: token, color: "#FFAB91" }) // orange
      }
      // Keywords
      else if (keywords.has(token)) {
        result.push({ text: token, color: "#C792EA" }) // purple
      }
      // Types
      else if (types.has(token)) {
        result.push({ text: token, color: "#82AAFF" }) // blue
      }
      // Operators/punctuation
      else if (/^[^\s\w]+$/.test(token)) {
        result.push({ text: token, color: "#89DDFF" }) // cyan
      }
      // Default (identifiers, whitespace)
      else {
        result.push({ text: token, color: "rgba(255,255,255,0.85)" })
      }
    }

    if (result.length === 0) {
      result.push({ text, color: "rgba(255,255,255,0.85)" })
    }

    return result
  }
}
