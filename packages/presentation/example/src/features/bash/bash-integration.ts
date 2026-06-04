import { Bash, defineCommand } from "just-bash"
import type { PresentationStep } from "../../../../src/types.ts"
import { ALL_STEP_COMMANDS, createPresentationTools } from "../../../../src/commands/index.ts"
import type { PresentationToolDef } from "../../../../src/commands/index.ts"

export interface PresentationBashOptions {
  /** Called when a new step is produced */
  onStep: (step: PresentationStep) => void
  /** Get current timeline cursor in ms */
  getCursorMs: () => number
  /** Set the cursor position */
  setCursorMs: (ms: number) => void
}

/**
 * Parse bash args string "key=value key2='json'" into a Record.
 * Bare tokens without `=` are treated as boolean flags (value = true).
 */
function parseArgs(args: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const token of args) {
    const eqIdx = token.indexOf("=")

    // Bare flag without `=` → treat as boolean true
    if (eqIdx === -1) {
      result[token] = true
      continue
    }

    const key = token.slice(0, eqIdx)
    const raw = token.slice(eqIdx + 1)

    // Strip outer quotes if present (must be at least 2 chars for open+close)
    const isDoubleQuoted = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')
    const isSingleQuoted = raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")
    let unquoted = (isDoubleQuoted || isSingleQuoted) ? raw.slice(1, -1) : raw

    // Double-quoted values need backslash unescape (\" → ", \\ → \)
    if (isDoubleQuoted) {
      unquoted = unquoted.replace(/\\"/g, '"').replace(/\\\\/g, "\\")
    }

    // Try JSON parse for complex values
    try {
      result[key] = JSON.parse(unquoted)
    } catch {
      // Try number
      const n = Number(unquoted)
      if (!Number.isNaN(n) && unquoted !== "") {
        result[key] = n
      } else if (unquoted === "true") {
        result[key] = true
      } else if (unquoted === "false") {
        result[key] = false
      } else {
        // Decode \\n escape sequences back to real newlines
        result[key] = unquoted.replace(/\\n/g, "\n")
      }
    }
  }
  return result
}

/**
 * Pre-process script to fix single-quoted JSON values that contain literal single quotes.
 * In bash, single-quoted strings cannot contain single quotes at all.
 * This detects `key='<JSON>'` where the JSON contains `'` and re-wraps with double quotes.
 *
 * Example: `data='[{"name":"Q1'23"}]'` → `data="[{\"name\":\"Q1'23\"}]"`
 */
export function fixJsonQuoting(script: string): string {
  return script.split("\n").map(fixLineJsonQuoting).join("\n")
}

function fixLineJsonQuoting(line: string): string {
  // Match pattern: key='<something starting with [ or {>
  // We look for all occurrences of `='{` or `='[` and try to find the real JSON end
  return line.replace(/(\w+)='(\[.*|\{.*)/g, (match, key, rest) => {
    // rest starts after the opening single quote
    // Find the balanced JSON end by counting brackets/braces
    const jsonEnd = findJsonEnd(rest)
    if (jsonEnd === -1) return match // Can't fix, return as-is

    const json = rest.slice(0, jsonEnd)
    const afterJson = rest.slice(jsonEnd)

    // Check if the character after JSON is the closing single quote
    if (afterJson[0] !== "'") return match // Not the expected pattern

    // Check if the JSON actually contains single quotes (otherwise no fix needed)
    if (!json.includes("'")) return match

    // Re-wrap with double quotes, escaping inner backslashes and double quotes
    const escaped = json.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    const remainder = afterJson.slice(1) // skip the closing '
    return `${key}="${escaped}"${remainder}`
  })
}

/** Find the end index of a balanced JSON value (array or object) in text */
function findJsonEnd(text: string): number {
  if (text[0] !== "[" && text[0] !== "{") return -1

  let depth = 0
  let inStr = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (ch === "\\") { i++; continue }
      if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === "[" || ch === "{") depth++
    else if (ch === "]" || ch === "}") {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return -1
}

/**
 * Pre-process script text to join multi-line quoted strings into single lines.
 * just-bash doesn't support multi-line quoted strings, so we collapse them
 * by replacing literal newlines within unclosed quotes with \\n escape sequences.
 */
export function joinMultilineQuotes(script: string): string {
  const lines = script.split("\n")
  const result: string[] = []
  let accumulator = ""
  let openQuote: '"' | "'" | null = null

  for (const line of lines) {
    if (openQuote) {
      // We're inside an unclosed quote — append with \n escape
      accumulator += "\\n" + line
      // Check if this line closes the quote
      if (closesQuote(line, openQuote)) {
        openQuote = null
        result.push(accumulator)
        accumulator = ""
      }
    } else {
      // Check if this line opens an unclosed quote
      const unclosed = findUnclosedQuote(line)
      if (unclosed) {
        openQuote = unclosed
        accumulator = line
      } else {
        result.push(line)
      }
    }
  }

  // Flush any remaining accumulator (unclosed quote at EOF)
  if (accumulator) result.push(accumulator)

  return result.join("\n")
}

/** Check if a line has an unclosed quote (odd number of unescaped quotes) */
function findUnclosedQuote(line: string): '"' | "'" | null {
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "\\" && (inSingle || inDouble)) { i++; continue }
    if (ch === "'" && !inDouble) inSingle = !inSingle
    else if (ch === '"' && !inSingle) inDouble = !inDouble
  }
  if (inDouble) return '"'
  if (inSingle) return "'"
  return null
}

/** Check if a continuation line closes the given quote type */
function closesQuote(line: string, quoteType: '"' | "'"): boolean {
  let open = true // We enter already inside a quote
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "\\" && open) { i++; continue }
    if (ch === quoteType) open = !open
  }
  return !open // Closed if we ended outside the quote
}

/**
 * Create a just-bash instance with all presentation commands registered.
 *
 * Registers a single `presentation` command that dispatches to subcommands:
 * ```bash
 * presentation spotlight region='{"x":100,"y":100,"width":200,"height":50}'
 * presentation arrow from='{"x":0,"y":0}' to='{"x":100,"y":100}' color=red
 * presentation clear
 * presentation --help
 * ```
 */
export function createPresentationBash(opts: PresentationBashOptions) {
  let idCounter = 0

  const tools = createPresentationTools({
    onStep: opts.onStep,
    getCursorMs: opts.getCursorMs,
    advanceCursor: (ms) => opts.setCursorMs(opts.getCursorMs() + ms),
    nextId: () => `bash-step-${++idCounter}`,
  })

  // Build tool lookup
  const toolMap = new Map<string, PresentationToolDef>()
  for (const [key, def] of Object.entries(tools)) {
    // key is "presentation.spotlight" -> subcommand is "spotlight"
    const sub = key.replace("presentation.", "")
    toolMap.set(sub, def)
  }

  // Register a single "presentation" dispatcher command
  const presentationCmd = defineCommand("presentation", async (args) => {
    const subcommand = args[0]

    if (!subcommand || subcommand === "--help") {
      const help = ALL_STEP_COMMANDS
        .map(c => `  ${c.name.padEnd(18)} ${c.description}`)
        .join("\n")
      return {
        stdout: `presentation - ${ALL_STEP_COMMANDS.length} overlay commands\n\nUsage: presentation <command> [key=value ...]\n\nCommands:\n${help}\n`,
        stderr: "",
        exitCode: 0,
      }
    }

    const tool = toolMap.get(subcommand)
    if (!tool) {
      return {
        stdout: "",
        stderr: `presentation: unknown subcommand '${subcommand}'\n`,
        exitCode: 1,
      }
    }

    try {
      const parsedArgs = parseArgs(args.slice(1))
      const result = tool.execute(parsedArgs)
      return {
        stdout: `${result.summary}\n`,
        stderr: "",
        exitCode: 0,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        stdout: "",
        stderr: `presentation ${subcommand}: ${msg}\n`,
        exitCode: 1,
      }
    }
  })

  const bash = new Bash({
    customCommands: [presentationCmd],
  })

  return bash
}
