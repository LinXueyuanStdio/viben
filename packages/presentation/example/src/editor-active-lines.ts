import type { PresentationStep } from "../../src/types"

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
 *
 * @example
 * ```ts
 * const mapping = buildLineStepMapping(script)
 * // mapping.lineToStep.get(3) → 1  (line 3 is the 2nd command → step index 1)
 * // mapping.stepToLine.get(0) → 1  (step 0 corresponds to line 1)
 * ```
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

/**
 * Given script text and current playback time, return 1-based line numbers
 * of lines that are "active" (their corresponding step is currently playing).
 *
 * A step is active when `startMs <= currentMs < endMs`.
 * If a step has no `endMs`, it is considered active from `startMs` until
 * the end of the presentation.
 *
 * @param scriptText - The full bash editor script text
 * @param steps - The array of PresentationSteps (ordered by index)
 * @param currentMs - Current playback position in milliseconds
 * @returns Array of 1-based line numbers that are currently active
 *
 * @remarks
 * If the number of command lines in `scriptText` does not match `steps.length`,
 * returns an empty array (script and steps are out of sync).
 *
 * Consumers should memoize `buildLineStepMapping` since `scriptText` changes rarely.
 *
 * @example
 * ```ts
 * const activeLines = getActiveLines(scriptText, steps, 1500)
 * // → [3, 5]  means lines 3 and 5 have steps active at t=1500ms
 * ```
 */
export function getActiveLines(
  scriptText: string,
  steps: PresentationStep[],
  currentMs: number,
): number[] {
  const mapping = buildLineStepMapping(scriptText)

  // If command line count doesn't match steps length, script is out of sync
  if (mapping.stepToLine.size !== steps.length) {
    return []
  }

  const activeLines: number[] = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const startMs = step.startMs
    const endMs = step.endMs

    // Step is active if startMs <= currentMs < endMs
    // If endMs is undefined, the step persists indefinitely once started
    const isActive =
      currentMs >= startMs && (endMs === undefined || currentMs < endMs)

    if (isActive) {
      const lineNumber = mapping.stepToLine.get(i)
      if (lineNumber !== undefined) {
        activeLines.push(lineNumber)
      }
    }
  }

  return activeLines
}
