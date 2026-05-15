import type { PresentationStep } from "../../src/types"

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

function formatArg(key: string, value: unknown): string {
  if (typeof value === "number" || typeof value === "boolean") {
    return `${key}=${value}`
  }
  if (typeof value === "string") {
    // Strings with spaces or special chars get double-quoted
    if (/[\s"']/.test(value)) {
      return `${key}="${value}"`
    }
    return `${key}=${value}`
  }
  // Objects and arrays get JSON-wrapped in single quotes
  return `${key}='${JSON.stringify(value)}'`
}
