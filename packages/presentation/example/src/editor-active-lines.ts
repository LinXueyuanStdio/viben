/**
 * Bidirectional mapping between script line numbers and step indices.
 */
export interface LineStepMapping {
  /** lineNumber (1-based) → stepIndex */
  lineToStep: Map<number, number>
  /** stepIndex → lineNumber (1-based) */
  stepToLine: Map<number, number>
}

/**
 * Determine if a script line is a "command line" (not empty, not a comment).
 * Comment lines start with `#` (optionally preceded by whitespace).
 */
function isCommandLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.length > 0 && !trimmed.startsWith("#")
}

/**
 * Build a bidirectional mapping between script lines and step indices.
 *
 * Only non-empty, non-comment lines are considered "command lines".
 * The nth command line (0-indexed) maps to `steps[n]`.
 *
 * @param scriptText - The full script text (newline-separated)
 * @returns An object with `lineToStep` and `stepToLine` maps
 */
export function buildLineStepMapping(scriptText: string): LineStepMapping {
  const lines = scriptText.split("\n")
  const lineToStep = new Map<number, number>()
  const stepToLine = new Map<number, number>()

  let commandIndex = 0
  for (let i = 0; i < lines.length; i++) {
    if (isCommandLine(lines[i])) {
      const lineNumber = i + 1 // 1-based
      lineToStep.set(lineNumber, commandIndex)
      stepToLine.set(commandIndex, lineNumber)
      commandIndex++
    }
  }

  return { lineToStep, stepToLine }
}
