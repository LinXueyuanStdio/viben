import React, { useState, useMemo, useRef, useCallback, useEffect } from "react"

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
  if (line.trim() === "") return [{ text: line, type: "text" }]
  if (line.trimStart().startsWith("#")) return [{ text: line, type: "comment" }]

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
      remaining = remaining.slice(match[1].length)
      pos += match[1].length
      return match[1]
    }
    return null
  }

  function tokenizeValue(): void {
    if (remaining.length === 0) return
    if (remaining[0] === '"' || remaining[0] === "'") {
      const quote = remaining[0]
      const endIdx = findClosingQuote(remaining, quote)
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
      if (val === "true" || val === "false") tokens.push({ text: val, type: "boolean" })
      else if (/^-?\d+(\.\d+)?$/.test(val)) tokens.push({ text: val, type: "number" })
      else tokens.push({ text: val, type: "text" })
    }
  }

  function parseKVPairs(): void {
    while (remaining.length > 0) {
      consumeWhitespace()
      if (remaining.length === 0) break
      if (remaining.startsWith("#")) { tokens.push({ text: remaining, type: "comment" }); remaining = ""; break }
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
        if (word) tokens.push({ text: word, type: "text" })
        else { tokens.push({ text: remaining[0], type: "text" }); remaining = remaining.slice(1); pos++ }
      }
    }
  }

  consumeWhitespace()
  if (remaining.startsWith("presentation")) {
    tokens.push({ text: "presentation", type: "command" })
    remaining = remaining.slice(12); pos += 12
    consumeWhitespace()
    if (remaining.length > 0 && !remaining.startsWith("#")) {
      const sub = consumeWord()
      if (sub) tokens.push({ text: sub, type: "subcommand" })
    }
    parseKVPairs()
  } else {
    parseKVPairs()
  }
  return tokens
}

function findClosingQuote(str: string, quote: string): number {
  let i = 1
  while (i < str.length) {
    if (str[i] === "\\" && i + 1 < str.length) { i += 2; continue }
    if (str[i] === quote) return i
    i++
  }
  return str.length - 1
}

// ============================================================================
// Constants
// ============================================================================

const FONT_FAMILY = "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace"
const FONT_SIZE = 11
const LINE_HEIGHT_PX = 17 // fixed pixel value used by ALL layers to avoid sub-pixel drift
const GUTTER_WIDTH = 36
const PADDING_X = 12
const PADDING_Y = 10

// ============================================================================
// Module-level style injection (replaces inline <style> tag)
// ============================================================================

const STYLE_ID = "bash-editor-scrollbar-hide"
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `.bash-editor-textarea::-webkit-scrollbar{display:none}.bash-editor-textarea{scrollbar-width:none;-ms-overflow-style:none}`
  document.head.appendChild(style)
}

// ============================================================================
// Stable Style Objects
// ============================================================================

const WRAPPER_STYLE: React.CSSProperties = {
  position: "relative",
  background: "rgba(0,0,0,0.4)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  overflow: "auto",
}

const GUTTER_BASE_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: GUTTER_WIDTH,
  padding: `${PADDING_Y}px 0`,
  userSelect: "none",
  borderRight: "1px solid rgba(255,255,255,0.06)",
  zIndex: 3,
  background: "rgba(0,0,0,0.2)",
}

const GUTTER_INTERACTIVE_STYLE: React.CSSProperties = {
  ...GUTTER_BASE_STYLE,
  pointerEvents: "auto",
}

const GUTTER_NONINTERACTIVE_STYLE: React.CSSProperties = {
  ...GUTTER_BASE_STYLE,
  pointerEvents: "none",
}

const CONTENT_PADDING = `${PADDING_Y}px ${PADDING_X}px ${PADDING_Y}px ${GUTTER_WIDTH + PADDING_X}px`

const HIGHLIGHT_LAYER_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  padding: CONTENT_PADDING,
  margin: 0,
  border: "none",
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZE,
  lineHeight: `${LINE_HEIGHT_PX}px`,
  whiteSpace: "pre",
  pointerEvents: "none",
  userSelect: "none",
  color: "#e0e0e0",
  zIndex: 1,
}

const TEXTAREA_BASE_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  padding: CONTENT_PADDING,
  margin: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "transparent",
  caretColor: "#fff",
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZE,
  lineHeight: `${LINE_HEIGHT_PX}px`,
  whiteSpace: "pre",
  overflowWrap: "normal",
  wordWrap: "normal",
  resize: "none",
  WebkitTextFillColor: "transparent",
  zIndex: 2,
  overflow: "auto",
}

const TEXTAREA_EDITABLE_STYLE: React.CSSProperties = {
  ...TEXTAREA_BASE_STYLE,
  cursor: "text",
}

const TEXTAREA_READONLY_STYLE: React.CSSProperties = {
  ...TEXTAREA_BASE_STYLE,
  cursor: "default",
}

// ============================================================================
// Sub-Components
// ============================================================================

const HighlightedLine = React.memo(
  function HighlightedLine({ tokens, isActive, isCurrent }: { tokens: Token[]; isActive: boolean; isCurrent: boolean }) {
    return (
      <div style={{
        height: LINE_HEIGHT_PX,
        lineHeight: `${LINE_HEIGHT_PX}px`,
        borderLeft: isActive ? "3px solid #76B900" : "3px solid transparent",
        paddingLeft: 4,
        marginLeft: -7,
        background: isActive ? "rgba(118,185,0,0.08)" : isCurrent ? "rgba(255,255,255,0.03)" : "transparent",
        borderRadius: isActive ? 2 : 0,
      }}>
        {tokens.map((token, idx) => (
          <span key={idx} style={{
            color: TOKEN_COLORS[token.type],
            fontStyle: token.type === "comment" ? "italic" : "normal",
          }}>{token.text}</span>
        ))}
      </div>
    )
  },
  (prev, next) => prev.tokens === next.tokens && prev.isActive === next.isActive && prev.isCurrent === next.isCurrent,
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
      >{lineNum}</span>
    )
  },
  (prev, next) => prev.isActive === next.isActive && prev.lineNum === next.lineNum && prev.onClick === next.onClick,
)

// ============================================================================
// Main Component
//
// Layout: wrapper div (overflow:auto) -> sizer div (height = content) ->
//   - gutter (absolute left)
//   - pre (absolute, highlight layer, pointer-events:none)
//   - textarea (absolute, on top, transparent text, white caret)
//
// All layers share the same scroll parent (wrapper). No sync needed.
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
  const prevFirstActiveRef = useRef<number | null>(null)

  // -- Cursor line tracking --
  const [cursorLine, setCursorLine] = useState(1)

  const handleSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    const pos = ta.selectionStart
    const line = value.slice(0, pos).split("\n").length
    setCursorLine(line)
  }, [value])

  // -- Incremental tokenization --
  const prevLinesRef = useRef<string[]>([])
  const prevTokensRef = useRef<Token[][]>([])

  const tokenizedLines = useMemo(() => {
    const newLines = value.split("\n")
    const prevLines = prevLinesRef.current
    const prevTokens = prevTokensRef.current

    // If same content, skip
    if (
      newLines.length === prevLines.length &&
      newLines.every((l, i) => l === prevLines[i])
    ) {
      return prevTokens
    }

    // Incremental: reuse tokens for unchanged lines
    const result: Token[][] = new Array(newLines.length)
    for (let i = 0; i < newLines.length; i++) {
      if (i < prevLines.length && newLines[i] === prevLines[i]) {
        result[i] = prevTokens[i] // same reference -> React.memo skips re-render
      } else {
        result[i] = tokenizeLine(newLines[i])
      }
    }

    prevLinesRef.current = newLines
    prevTokensRef.current = result
    return result
  }, [value])

  const activeLineSet = useMemo(() => new Set(activeLines), [activeLines])

  const contentHeight = tokenizedLines.length * LINE_HEIGHT_PX + PADDING_Y * 2

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => { if (!readOnly) onChange(e.target.value) },
    [onChange, readOnly],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return
      if (e.key === "Tab") {
        e.preventDefault()
        const ta = e.currentTarget
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const newValue = value.slice(0, start) + "  " + value.slice(end)
        onChange(newValue)
        requestAnimationFrame(() => { ta.selectionStart = start + 2; ta.selectionEnd = start + 2 })
      }
    },
    [value, onChange, readOnly],
  )

  // Auto-scroll to first active line
  useEffect(() => {
    if (activeLines.length === 0) { prevFirstActiveRef.current = null; return }
    const firstActive = activeLines[0]
    if (firstActive === prevFirstActiveRef.current) return
    prevFirstActiveRef.current = firstActive
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const lineTop = (firstActive - 1) * LINE_HEIGHT_PX + PADDING_Y
    const lineBottom = lineTop + LINE_HEIGHT_PX
    const vTop = wrapper.scrollTop
    const vBottom = vTop + wrapper.clientHeight
    if (lineTop < vTop || lineBottom > vBottom) {
      wrapper.scrollTo({ top: Math.max(0, lineTop - wrapper.clientHeight / 2 + LINE_HEIGHT_PX / 2), behavior: "smooth" })
    }
  }, [activeLines])

  // Merge wrapper style with user-supplied style
  const mergedWrapperStyle = useMemo(
    () => style ? { ...WRAPPER_STYLE, ...style } : WRAPPER_STYLE,
    [style],
  )

  const gutterStyle = onLineClick ? GUTTER_INTERACTIVE_STYLE : GUTTER_NONINTERACTIVE_STYLE
  const textareaStyle = readOnly ? TEXTAREA_READONLY_STYLE : TEXTAREA_EDITABLE_STYLE

  return (
    <div
      ref={wrapperRef}
      style={mergedWrapperStyle}
    >
      {/* Sizer: establishes scroll dimensions */}
      <div style={{ position: "relative", height: contentHeight }}>

        {/* Gutter (absolute left) */}
        <div style={gutterStyle}>
          {tokenizedLines.map((_, i) => (
            <GutterLine key={i} lineNum={i + 1} isActive={activeLineSet.has(i + 1)} onClick={onLineClick} />
          ))}
        </div>

        {/* Highlight layer (absolute, behind textarea) */}
        <pre style={HIGHLIGHT_LAYER_STYLE}>
          <code>
            {tokenizedLines.map((tokens, i) => (
              <HighlightedLine
                key={i}
                tokens={tokens}
                isActive={activeLineSet.has(i + 1)}
                isCurrent={cursorLine === i + 1}
              />
            ))}
          </code>
        </pre>

        {/* Textarea: on top, transparent text, visible caret */}
        <textarea
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onClick={handleSelect}
          readOnly={readOnly}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          style={textareaStyle}
          className="bash-editor-textarea"
          aria-label="Bash script editor"
        />
      </div>
    </div>
  )
})

export type { BashEditorProps, Token, TokenType }
