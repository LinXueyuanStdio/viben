import type { PresentationStep } from "@viben/presentation"

/**
 * Serialize PresentationStep[] into a bash script string.
 * Each step becomes one line: `presentation <type> [key=value ...]`
 */
export function stepsToBashScript(steps: PresentationStep[]): string {
  return steps.map(step => stepToLine(step)).join("\n")
}

function stepToLine(step: PresentationStep): string {
  const { command, startMs, endMs } = step
  const { type, ...rest } = command as Record<string, unknown> & { type: string }

  const parts: string[] = [`presentation ${type}`]

  // Serialize command fields
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null) continue
    parts.push(formatArg(key, value))
  }

  // Append timing if explicitly set
  if (startMs !== undefined && startMs > 0) {
    parts.push(`startMs=${startMs}`)
  }
  if (endMs !== undefined) {
    parts.push(`endMs=${endMs}`)
  }

  return parts.join(" ")
}

/** Chars that require quoting in bash context */
const BASH_SPECIAL = /[\s"'()$%!;&|<>\\`~#{}[\]*?]/

function formatArg(key: string, value: unknown): string {
  if (typeof value === "number" || typeof value === "boolean") {
    return `${key}=${value}`
  }
  if (typeof value === "string") {
    // Strings with bash-special chars get double-quoted
    if (BASH_SPECIAL.test(value)) {
      // Escape any existing double-quotes inside the value
      const escaped = value.replace(/"/g, '\\"')
      return `${key}="${escaped}"`
    }
    return `${key}=${value}`
  }
  // Objects and arrays: always use double-quote wrapping with escaped inner quotes.
  // Single-quote wrapping breaks if JSON contains literal single quotes (e.g. "Q1'23").
  const json = JSON.stringify(value)
  const escaped = json.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return `${key}="${escaped}"`
}
