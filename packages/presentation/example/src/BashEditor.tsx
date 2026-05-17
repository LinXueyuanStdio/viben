import React, { useRef, useEffect, useCallback } from "react"
import Editor from "@monaco-editor/react"
import type { OnMount, BeforeMount } from "@monaco-editor/react"
import type { editor as MonacoEditor } from "monaco-editor"
import { registerPresentationLanguage } from "./monaco-presentation-lang"
import "./bash-editor.css"

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

interface BashEditorProps {
  value: string
  onChange: (value: string) => void
  /** 1-based line numbers currently "active" during playback */
  activeLines: number[]
  /** Callback when a line number in the gutter is clicked */
  onLineClick?: (lineNumber: number) => void
  /** Read-only mode */
  readOnly?: boolean
  /** Lines with errors: lineNumber -> error message */
  errorLines?: Map<number, string>
  /** Steps array for timing annotations */
  steps?: Array<{ startMs: number; endMs?: number }>
  /** Callback to run the script (for Cmd+Enter keybinding) */
  onRun?: () => void
  style?: React.CSSProperties
}

export const BashEditor = React.memo(function BashEditor({
  value,
  onChange,
  activeLines,
  onLineClick,
  readOnly = false,
  errorLines,
  steps,
  onRun,
  style,
}: BashEditorProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null)
  const decorationsRef = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null)
  const timingDecorationsRef = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null)
  const prevFirstActiveRef = useRef<number | null>(null)
  const onRunRef = useRef(onRun)
  onRunRef.current = onRun

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    registerPresentationLanguage(monaco)
  }, [])

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Create decorations collections
    decorationsRef.current = editor.createDecorationsCollection([])
    timingDecorationsRef.current = editor.createDecorationsCollection([])

    // Register Cmd+Enter to run script
    editor.addAction({
      id: "presentation.runScript",
      label: "Run Script",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => { onRunRef.current?.() },
    })

    // Line click handler via mouse down on gutter
    if (onLineClick) {
      editor.onMouseDown((e) => {
        if (
          e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
          e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS
        ) {
          const lineNumber = e.target.position?.lineNumber
          if (lineNumber) onLineClick(lineNumber)
        }
      })
    }
  }, [onLineClick])

  // Update decorations when activeLines or errorLines change
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco || !decorationsRef.current) return

    const newDecorations: MonacoEditor.IModelDeltaDecoration[] = []

    // Active line decorations (green)
    for (const lineNum of activeLines) {
      newDecorations.push({
        range: new monaco.Range(lineNum, 1, lineNum, 1),
        options: {
          isWholeLine: true,
          className: "bash-editor-active-line",
          glyphMarginClassName: "bash-editor-active-glyph",
        },
      })
    }

    // Error line decorations (red)
    if (errorLines) {
      for (const [lineNum, msg] of errorLines) {
        newDecorations.push({
          range: new monaco.Range(lineNum, 1, lineNum, 1),
          options: {
            isWholeLine: true,
            className: "bash-editor-error-line",
            glyphMarginClassName: "bash-editor-error-glyph",
            hoverMessage: { value: msg },
          },
        })
      }
    }

    decorationsRef.current.set(newDecorations)
  }, [activeLines, errorLines])

  // Auto-scroll to first active line
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (activeLines.length === 0) {
      prevFirstActiveRef.current = null
      return
    }
    const firstActive = activeLines[0]
    if (firstActive === prevFirstActiveRef.current) return
    prevFirstActiveRef.current = firstActive
    editor.revealLineInCenterIfOutsideViewport(firstActive)
  }, [activeLines])

  // Inline timing annotations
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco || !steps || steps.length === 0) {
      timingDecorationsRef.current?.set([])
      return
    }

    // Build line-to-step mapping from current value
    const lines = value.split("\n")
    let cmdIdx = 0
    const timingDecorations: MonacoEditor.IModelDeltaDecoration[] = []

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (trimmed === "" || trimmed.startsWith("#")) continue

      if (cmdIdx < steps.length) {
        const step = steps[cmdIdx]
        const startMs = step.startMs
        const endMs = step.endMs
        const timeStr = endMs !== undefined
          ? `${formatMs(startMs)} \u2192 ${formatMs(endMs)}`
          : `${formatMs(startMs)} \u2192`

        timingDecorations.push({
          range: new monaco.Range(i + 1, 1, i + 1, 1),
          options: {
            after: {
              content: `  // ${timeStr}`,
              inlineClassName: "bash-editor-timing-annotation",
            },
          },
        })
      }
      cmdIdx++
    }

    timingDecorationsRef.current?.set(timingDecorations)
  }, [steps, value])

  const handleChange = useCallback(
    (val: string | undefined) => {
      if (val !== undefined) onChange(val)
    },
    [onChange],
  )

  return (
    <div
      style={{
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.1)",
        ...style,
      }}
    >
      <Editor
        height="100%"
        language="presentation-script"
        value={value}
        theme="presentation-dark"
        onChange={readOnly ? undefined : handleChange}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        loading={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
            }}
          >
            Loading editor...
          </div>
        }
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 11,
          lineNumbers: "on",
          renderLineHighlight: readOnly ? "none" : "line",
          wordWrap: "off",
          folding: false,
          automaticLayout: true,
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          glyphMargin: true,
          lineNumbersMinChars: 3,
          padding: { top: 8, bottom: 8 },
          tabSize: 2,
          insertSpaces: true,
          contextmenu: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          renderWhitespace: "none",
        }}
      />
    </div>
  )
})

export type { BashEditorProps }
