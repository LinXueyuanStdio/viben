import type * as Monaco from "monaco-editor"
import { ALL_STEP_COMMANDS, STEP_COMMAND_MAP } from "../../../../src/commands/index"

/** Regex that matches any known subcommand name */
const SUBCOMMAND_REGEX = new RegExp(
  "^(" +
    ALL_STEP_COMMANDS.map((c) => c.name.replace(/-/g, "\\-")).join("|") +
    ")$",
)

/**
 * Register a custom Monaco language for the presentation DSL.
 * Call once in `beforeMount`.
 */
export function registerPresentationLanguage(
  monaco: typeof Monaco,
): void {
  // 1. Register the language id
  monaco.languages.register({ id: "presentation-script" })

  // 2. Monarch tokenizer
  monaco.languages.setMonarchTokensProvider("presentation-script", {
    subcommandRegex: SUBCOMMAND_REGEX,

    tokenizer: {
      root: [
        // Comments
        [/#.*$/, "comment"],
        // "presentation" keyword at start of meaningful content
        [/presentation(?=\s)/, "keyword", "@subcommand"],
        // Anything else is just source text (don't mark invalid during typing)
        [/./, "source"],
      ],

      subcommand: [
        // Whitespace
        [/\s+/, "white"],
        // Known command names
        [/@subcommandRegex/, "type.identifier", "@params"],
        // Unknown words (partial typing)
        [/[\w-]+/, "identifier", "@params"],
      ],

      params: [
        // Whitespace
        [/\s+/, "white"],
        // Parameter key with lookahead for =
        [/[a-zA-Z_]\w*(?==)/, "variable"],
        // Delimiter =
        [/=/, "delimiter"],
        // Double-quoted string
        [/"([^"\\]|\\.)*"/, "string.double"],
        // Single-quoted string
        [/'([^'\\]|\\.)*'/, "string.single"],
        // Numbers
        [/\d+(\.\d+)?/, "number"],
        // Boolean literals
        [/true|false/, "keyword.boolean"],
        // Bare words (unquoted values)
        [/[\w./#%:,;!?@&*^~<>[\]{}()-]+/, "string"],
        // End of line pops back to root
        [/$/, "", "@popall"],
      ],
    },
  })

  // 3. Custom dark theme
  monaco.editor.defineTheme("presentation-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "76B900", fontStyle: "bold" },
      { token: "type.identifier", foreground: "4ECDC4" },
      { token: "variable", foreground: "F59E0B" },
      { token: "delimiter", foreground: "9CA3AF" },
      { token: "string.double", foreground: "FBBF24" },
      { token: "string.single", foreground: "FBBF24" },
      { token: "string", foreground: "FBBF24" },
      { token: "number", foreground: "A78BFA" },
      { token: "keyword.boolean", foreground: "A78BFA" },
      { token: "comment", foreground: "6B7280", fontStyle: "italic" },
      { token: "identifier", foreground: "E5E7EB" },
      { token: "source", foreground: "E5E7EB" },
    ],
    colors: {
      "editor.background": "#111318",
      "editor.foreground": "#E5E7EB",
      "editor.lineHighlightBackground": "#1A1F2E",
      "editor.selectionBackground": "#374151",
      "editorLineNumber.foreground": "#4B5563",
      "editorLineNumber.activeForeground": "#76B900",
      "editorGutter.background": "#0F1115",
      "editorCursor.foreground": "#76B900",
      "editor.selectionHighlightBackground": "#37415180",
    },
  })

  // 4. Completion provider
  monaco.languages.registerCompletionItemProvider("presentation-script", {
    triggerCharacters: [" "],
    provideCompletionItems(model, position) {
      const lineContent = model.getLineContent(position.lineNumber)
      const textUntilPos = lineContent.substring(0, position.column - 1)

      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      // After "presentation " -> suggest command names
      if (/^presentation\s+\w*$/.test(textUntilPos)) {
        return {
          suggestions: ALL_STEP_COMMANDS.map((cmd) => ({
            label: cmd.name,
            kind: monaco.languages.CompletionItemKind.Function,
            detail: `[${cmd.category}] ${cmd.defaultDurationMs}ms`,
            documentation: cmd.description,
            insertText: cmd.name + " ",
            range,
          })),
        }
      }

      // After subcommand -> suggest parameter names
      const cmdMatch = textUntilPos.match(/^presentation\s+([\w-]+)\s+/)
      if (cmdMatch) {
        const cmdName = cmdMatch[1]
        const def = STEP_COMMAND_MAP.get(cmdName)
        if (def) {
          try {
            const demoResult = def.parseArgs({})
            const paramNames = Object.keys(demoResult).filter(
              (k) => k !== "type",
            )
            // Add timing params
            const allParams = [
              ...paramNames,
              "startMs",
              "endMs",
              "durationMs",
            ]
            return {
              suggestions: allParams.map((name) => ({
                label: name,
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: name + "=",
                range,
              })),
            }
          } catch {
            /* ignore parse errors with empty args */
          }
        }
      }

      // Empty/start of line -> suggest "presentation"
      if (/^\s*\w*$/.test(textUntilPos)) {
        return {
          suggestions: [
            {
              label: "presentation",
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: "presentation ",
              range,
            },
            {
              label: "# comment",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "# ",
              range,
            },
          ],
        }
      }

      return { suggestions: [] }
    },
  })

  // 5. Hover provider
  monaco.languages.registerHoverProvider("presentation-script", {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position)
      if (!word) return null

      const hoveredWord = word.word
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      // "presentation" keyword
      if (hoveredWord === "presentation") {
        return {
          range,
          contents: [
            { value: "**presentation** -- overlay annotation engine" },
            {
              value: `${ALL_STEP_COMMANDS.length} commands across 5 categories`,
            },
          ],
        }
      }

      // Subcommand name
      const def = STEP_COMMAND_MAP.get(hoveredWord)
      if (def) {
        let params: string[] = []
        try {
          const demoResult = def.parseArgs({})
          params = Object.keys(demoResult).filter((k) => k !== "type")
        } catch {
          /* ignore */
        }

        const contents: { value: string }[] = [
          { value: `**${def.name}** _(${def.category})_` },
          { value: def.description },
          { value: `Duration: ${def.defaultDurationMs}ms` },
        ]
        if (params.length > 0) {
          contents.push({
            value: `Params: \`${params.join("`, `")}\``,
          })
        }
        return { range, contents }
      }

      return null
    },
  })
}
