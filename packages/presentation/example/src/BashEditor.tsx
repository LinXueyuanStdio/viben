import React, { useMemo, useRef, useCallback, useEffect, useState } from "react"

// ============================================================================
// Types
// ============================================================================

type TokenType =
  | "command"
  | "subcommand"
  | "key"
  | "equals"
  | "string"
  | "number"
  | "boolean"
  | "comment"
  | "text"

interface Token {
  text: string
  type: TokenType
}

interface BashEditorProps {
  value: string
  onChange: (value: string) => void
  /** Array of line numbers (1-based) that are currently "active" during playback */
  activeLines: number[]
  /** Callback when a line number in the gutter is clicked */
  onLineClick?: (lineNumber: number) => void
  /** Read-only mode (when playing) */
  readOnly?: boolean
  style?: React.CSSProperties
}

// ============================================================================
// Token Colors
// ============================================================================

const TOKEN_COLORS: Record<TokenType, string> = {
  command: "#888",
  subcommand: "#76B900",
  key: "#4ECDC4",
  equals: "#666",
  number: "#F59E0B",
  string: "#FBBF24",
  boolean: "#A78BFA",
  comment: "#666",
  text: "#e0e0e0",
}

// ============================================================================
// Tokenizer
// ============================================================================

function tokenizeLine(line: string): Token[] {
  if (line.trim() === "") {
    return [{ text: line, type: "text" }]
  }

  if (line.trimStart().startsWith("#")) {
    return [{ text: line, type: "comment" }]
  }

  const tokens: Token[] = []
  let remaining = line
  let pos = 0

  function consumeWhitespace(): void {
    const match = remaining.match(/^(\s+)/)
    if (match) {
      tokens.push({ text: match[1], type: "text" })
      remaining = remaining.slice(match[1].length)
      pos += match[1].length
    }
  }

  function consumeWord(): string | null {
    const match = remaining.match(/^([^\s=]+)/)
    if (match) {
      const word = match[1]
      remaining = remaining.slice(word.length)
      pos += word.length
      return word
    }
    return null
  }

  function tokenizeValue(): void {
    if (remaining.length === 0) return

    if (remaining.startsWith('"')) {
      const endIdx = findClosingQuote(remaining, '"')
      const str = remaining.slice(0, endIdx + 1)
      tokens.push({ text: str, type: "string" })
      remaining = remaining.slice(str.length)
      pos += str.length
      return
    }

    if (remaining.startsWith("'")) {
      const endIdx = findClosingQuote(remaining, "'")
      const str = remaining.slice(0, endIdx + 1)
      tokens.push({ text: str, type: "string" })
      remaining = remaining.slice(str.length)
      pos += str.length
      return
    }

    const match = remaining.match(/^([^\s]+)/)
    if (match) {
      const val = match[1]
      remaining = remaining.slice(val.length)
      pos += val.length

      if (val === "true" || val === "false") {
        tokens.push({ text: val, type: "boolean" })
      } else if (/^-?\d+(\.\d+)?$/.test(val)) {
        tokens.push({ text: val, type: "number" })
      } else {
        tokens.push({ text: val, type: "text" })
      }
    }
  }

  function parseKeyValuePairs(): void {
    while (remaining.length > 0) {
      consumeWhitespace()
      if (remaining.length === 0) break

      if (remaining.startsWith("#")) {
        tokens.push({ text: remaining, type: "comment" })
        remaining = ""
        break
      }

      const kvMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_.]*)(\s*)(=)(\s*)/)
      if (kvMatch) {
        const [full, key, ws1, eq, ws2] = kvMatch
        tokens.push({ text: key, type: "key" })
        if (ws1) tokens.push({ text: ws1, type: "text" })
        tokens.push({ text: eq, type: "equals" })
        if (ws2) tokens.push({ text: ws2, type: "text" })
        remaining = remaining.slice(full.length)
        pos += full.length
        tokenizeValue()
      } else {
        const word = consumeWord()
        if (word) {
          tokens.push({ text: word, type: "text" })
        } else {
          tokens.push({ text: remaining[0], type: "text" })
          remaining = remaining.slice(1)
          pos += 1
        }
      }
    }
  }

  consumeWhitespace()

  if (remaining.startsWith("presentation")) {
    const keyword = "presentation"
    tokens.push({ text: keyword, type: "command" })
    remaining = remaining.slice(keyword.length)
    pos += keyword.length

    consumeWhitespace()

    if (remaining.length > 0 && !remaining.startsWith("#")) {
      const subcommand = consumeWord()
      if (subcommand) {
        tokens.push({ text: subcommand, type: "subcommand" })
      }
    }

    parseKeyValuePairs()
  } else {
    parseKeyValuePairs()
  }

  return tokens
}

function findClosingQuote(str: string, quote: string): number {
  let i = 1
  while (i < str.length) {
    if (str[i] === "\\" && i + 1 < str.length) {
      i += 2
      continue
    }
    if (str[i] === quote) {
      return i
    }
    i++
  }
  return str.length - 1
}

function tokenizeScript(value: string): Token[][] {
  return value.split("\n").map(tokenizeLine)
}

// ============================================================================
// Constants
// ============================================================================

const FONT_FAMILY = "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace"
const FONT_SIZE = 11
const LINE_HEIGHT = 1.5
const LINE_HEIGHT_PX = Math.round(FONT_SIZE * LINE_HEIGHT)
const GUTTER_WIDTH = 36
const PADDING_X = 12
const PADDING_Y = 10

// ============================================================================
// Memoized Sub-Components
// ============================================================================

const HighlightedLine = React.memo(
  function HighlightedLine({ tokens, isActive }: { tokens: Token[]; isActive: boolean }) {
    return (
      <div
        style={{
          height: LINE_HEIGHT_PX,
          lineHeight: `${LINE_HEIGHT_PX}px`,
          borderLeft: isActive ? "3px solid #76B900" : "3px solid transparent",
          paddingLeft: 4,
          marginLeft: -7,
          background: isActive ? "rgba(118,185,0,0.08)" : "transparent",
          borderRadius: isActive ? 2 : 0,
        }}
      >
        {tokens.map((token, idx) => (
          <span
            key={idx}
            style={{
              color: TOKEN_COLORS[token.type],
              fontStyle: token.type === "comment" ? "italic" : "normal",
            }}
          >
            {token.text}
          </span>
        ))}
      </div>
    )
  },
  (prev, next) => prev.tokens === next.tokens && prev.isActive === next.isActive,
)

const GutterLine = React.memo(
  function GutterLine({ lineNum, isActive, onClick }: { lineNum: number; isActive: boolean; onClick?: (n: number) => void }) {
    return (
      <span
        onClick={onClick ? () => onClick(lineNum) : undefined}
        style={{
          display: "block",
          height: LINE_HEIGHT_PX,
          lineHeight: `${LINE_HEIGHT_PX}px`,
          textAlign: "right",
          paddingRight: 6,
          fontFamily: FONT_FAMILY,
          fontSize: FONT_SIZE,
          color: isActive ? "#76B900" : "rgba(255,255,255,0.25)",
          fontWeight: isActive ? 700 : 400,
          cursor: onClick ? "pointer" : undefined,
        }}
      >
        {lineNum}
      </span>
    )
  },
  (prev, next) => prev.isActive === next.isActive && prev.lineNum === next.lineNum && prev.onClick === next.onClick,
)

// ============================================================================
// Main Component
//
// Architecture: A single scrollable wrapper div. Inside it:
//   1. A "sizer" div with min-height = content height (drives scroll range)
//   2. The gutter (position: sticky left for line numbers)
//   3. The pre/code overlay (position: absolute, pointer-events: none)
//   4. A textarea (position: absolute, transparent, captures input)
//
// The WRAPPER is the scroll source. All layers are inside it and scroll together.
// ============================================================================

export const BashEditor = React.memo(function BashEditor({
  value,
  onChange,
  activeLines,
  onLineClick,
  readOnly = false,
  style,
}: BashEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevFirstActiveRef = useRef<number | null>(null)
  const [, forceUpdate] = useState(0)

  const tokenizedLines = useMemo(() => tokenizeScript(value), [value])
  const activeLineSet = useMemo(() => new Set(activeLines), [activeLines])

  const contentHeight = tokenizedLines.length * LINE_HEIGHT_PX + PADDING_Y * 2

  // Keep textarea size in sync with content
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = `${contentHeight}px`
    }
  }, [contentHeight])

  // Handle input changes
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!readOnly) {
        onChange(e.target.value)
      }
    },
    [onChange, readOnly],
  )

  // Handle tab key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return
      if (e.key === "Tab") {
        e.preventDefault()
        const textarea = e.currentTarget
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = value.slice(0, start) + "  " + value.slice(end)
        onChange(newValue)
        requestAnimationFrame(() => {
          textarea.selectionStart = start + 2
          textarea.selectionEnd = start + 2
        })
      }
    },
    [value, onChange, readOnly],
  )

  // Auto-scroll to first active line
  useEffect(() => {
    if (activeLines.length === 0) {
      prevFirstActiveRef.current = null
      return
    }

    const firstActive = activeLines[0]
    if (firstActive === prevFirstActiveRef.current) return
    prevFirstActiveRef.current = firstActive

    const wrapper = wrapperRef.current
    if (!wrapper) return

    const lineTop = (firstActive - 1) * LINE_HEIGHT_PX + PADDING_Y
    const lineBottom = lineTop + LINE_HEIGHT_PX
    const viewportTop = wrapper.scrollTop
    const viewportBottom = viewportTop + wrapper.clientHeight

    if (lineTop < viewportTop || lineBottom > viewportBottom) {
      const targetScroll = lineTop - wrapper.clientHeight / 2 + LINE_HEIGHT_PX / 2
      wrapper.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" })
    }
  }, [activeLines])

  // Force re-render on scroll to update nothing (scroll is CSS-driven)
  // Actually we don't need this since all layers share the same scroll container.

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        background: "rgba(0,0,0,0.4)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8,
        overflow: "auto",
        ...style,
      }}
    >
      {/* Content sizer - establishes the scroll height */}
      <div style={{ position: "relative", minHeight: contentHeight, minWidth: "fit-content" }}>
        {/* Gutter - sticky to left edge */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: GUTTER_WIDTH,
            padding: `${PADDING_Y}px 0`,
            pointerEvents: onLineClick ? "auto" : "none",
            userSelect: "none",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            zIndex: 3,
            background: "rgba(0,0,0,0.2)",
          }}
        >
          {tokenizedLines.map((_, i) => {
            const lineNum = i + 1
            return (
              <GutterLine
                key={i}
                lineNum={lineNum}
                isActive={activeLineSet.has(lineNum)}
                onClick={onLineClick}
              />
            )
          })}
        </div>

        {/* Syntax-highlighted overlay */}
        <pre
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: `${PADDING_Y}px ${PADDING_X}px ${PADDING_Y}px ${GUTTER_WIDTH + PADDING_X}px`,
            margin: 0,
            border: "none",
            fontFamily: FONT_FAMILY,
            fontSize: FONT_SIZE,
            lineHeight: LINE_HEIGHT,
            whiteSpace: "pre",
            overflowWrap: "normal",
            wordWrap: "normal",
            pointerEvents: "none",
            userSelect: "none",
            color: "#e0e0e0",
            zIndex: 1,
          }}
        >
          <code>
            {tokenizedLines.map((tokens, lineIdx) => (
              <HighlightedLine
                key={lineIdx}
                tokens={tokens}
                isActive={activeLineSet.has(lineIdx + 1)}
              />
            ))}
          </code>
        </pre>

        {/* Textarea - transparent, captures input. Same positioning as the pre overlay */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          style={{
            position: "relative",
            display: "block",
            width: "100%",
            minHeight: contentHeight,
            padding: `${PADDING_Y}px ${PADDING_X}px ${PADDING_Y}px ${GUTTER_WIDTH + PADDING_X}px`,
            margin: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "transparent",
            caretColor: "#fff",
            fontFamily: FONT_FAMILY,
            fontSize: FONT_SIZE,
            lineHeight: LINE_HEIGHT,
            whiteSpace: "pre",
            overflowWrap: "normal",
            wordWrap: "normal",
            resize: "none",
            WebkitTextFillColor: "transparent",
            cursor: readOnly ? "default" : "text",
            zIndex: 2,
            overflow: "hidden",
          }}
          aria-label="Bash script editor"
        />
      </div>
    </div>
  )
})

export type { BashEditorProps, Token, TokenType }
