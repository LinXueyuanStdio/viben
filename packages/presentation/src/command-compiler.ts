/**
 * Command Compiler
 *
 * Compiles high-level presentation tool inputs into PresentationCommand sequences.
 * Handles tool name normalization and payload-to-commands translation.
 */

import type { PresentationCommand, PresentationToolName, Rect, Point } from "./types"

/** All known presentation tool names (client-side) */
const PRESENTATION_TOOL_NAMES = new Set<string>([
  "presentation_draw",
  "presentation_spotlight",
  "presentation_callout",
  "presentation_walkthrough",
  "presentation_compare",
  "presentation_clear",
])

/**
 * Normalize a tool name to a known PresentationToolName.
 * Returns null if the tool name is not a presentation tool.
 */
export function normalizePresentationToolName(toolName: string): PresentationToolName | null {
  // Direct match
  if (PRESENTATION_TOOL_NAMES.has(toolName)) {
    return toolName as PresentationToolName
  }
  // Try with prefix
  const withPrefix = `presentation_${toolName}`
  if (PRESENTATION_TOOL_NAMES.has(withPrefix)) {
    return withPrefix as PresentationToolName
  }
  return null
}

/**
 * Check if a tool name is a client-side presentation tool.
 */
export function isClientSidePresentationTool(toolName: string): boolean {
  return PRESENTATION_TOOL_NAMES.has(toolName)
}

/**
 * Compile a presentation tool invocation into PresentationCommand[].
 */
export function compilePresentationCommands(
  toolName: PresentationToolName,
  input: Record<string, unknown>
): PresentationCommand[] {
  switch (toolName) {
    case "presentation_draw":
      return compileDraw(input)
    case "presentation_spotlight":
      return compileSpotlight(input)
    case "presentation_callout":
      return compileCallout(input)
    case "presentation_walkthrough":
      return compileWalkthrough(input)
    case "presentation_compare":
      return compileCompare(input)
    case "presentation_clear":
      return [{ type: "clear" }]
  }
}

function compileDraw(input: Record<string, unknown>): PresentationCommand[] {
  const commands = input.commands
  if (!Array.isArray(commands)) return []
  return commands.filter(isValidCommand) as PresentationCommand[]
}

function compileSpotlight(input: Record<string, unknown>): PresentationCommand[] {
  const target = input.target as Rect | undefined
  if (!target || !isValidRect(target)) return []

  const commands: PresentationCommand[] = [
    {
      type: "spotlight",
      region: target,
      maskOpacity: typeof input.maskOpacity === "number" ? input.maskOpacity : 0.7,
      borderRadius: typeof input.borderRadius === "number" ? input.borderRadius : 8,
      animate: true,
    },
  ]

  // Add title/description as text annotation if provided
  if (typeof input.title === "string" || typeof input.description === "string") {
    const textContent = [input.title, input.description].filter(Boolean).join("\n")
    commands.push({
      type: "text",
      position: {
        x: target.x,
        y: target.y + target.height + 12,
      },
      content: textContent,
      fontSize: 14,
      fontWeight: 600,
      animate: true,
    })
  }

  return commands
}

function compileCallout(input: Record<string, unknown>): PresentationCommand[] {
  const target = input.target as Rect | undefined
  const from = input.from as Point | undefined
  const label = input.label as string | undefined

  if (!target || !isValidRect(target)) return []

  const arrowTo: Point = {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  }

  const arrowFrom: Point = from && isValidPoint(from)
    ? from
    : { x: target.x - 80, y: target.y - 60 }

  const commands: PresentationCommand[] = [
    {
      type: "highlight",
      region: target,
      opacity: 0.15,
      borderRadius: 4,
      animate: true,
    },
    {
      type: "arrow",
      from: arrowFrom,
      to: arrowTo,
      label: label || undefined,
      animate: true,
    },
  ]

  return commands
}

function compileWalkthrough(input: Record<string, unknown>): PresentationCommand[] {
  const steps = input.steps as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(steps)) return []

  const commands: PresentationCommand[] = []

  for (const step of steps) {
    const target = step.target as Rect | undefined
    if (!target || !isValidRect(target)) continue

    commands.push({
      type: "spotlight",
      region: target,
      animate: true,
    })

    if (typeof step.title === "string" || typeof step.description === "string") {
      const textContent = [step.title, step.description].filter(Boolean).join("\n")
      commands.push({
        type: "card",
        position: {
          x: target.x + target.width + 16,
          y: target.y,
        },
        title: typeof step.title === "string" ? step.title : undefined,
        content: typeof step.description === "string" ? step.description : undefined,
        enterFrom: "right",
        animate: true,
      })
      // Use the text content for something if no card title
      void textContent
    }
  }

  return commands
}

function compileCompare(input: Record<string, unknown>): PresentationCommand[] {
  const left = input.left as Record<string, unknown> | undefined
  const right = input.right as Record<string, unknown> | undefined

  const commands: PresentationCommand[] = []

  if (left) {
    const leftTarget = left.target as Rect | undefined
    if (leftTarget && isValidRect(leftTarget)) {
      commands.push({
        type: "highlight",
        region: leftTarget,
        color: "rgba(59, 130, 246, 0.2)",
        animate: true,
      })
      if (typeof left.label === "string") {
        commands.push({
          type: "text",
          position: { x: leftTarget.x, y: leftTarget.y - 24 },
          content: left.label,
          fontSize: 12,
          fontWeight: 600,
          background: "rgba(59, 130, 246, 0.9)",
          animate: true,
        })
      }
    }
  }

  if (right) {
    const rightTarget = right.target as Rect | undefined
    if (rightTarget && isValidRect(rightTarget)) {
      commands.push({
        type: "highlight",
        region: rightTarget,
        color: "rgba(234, 88, 12, 0.2)",
        animate: true,
      })
      if (typeof right.label === "string") {
        commands.push({
          type: "text",
          position: { x: rightTarget.x, y: rightTarget.y - 24 },
          content: right.label,
          fontSize: 12,
          fontWeight: 600,
          background: "rgba(234, 88, 12, 0.9)",
          animate: true,
        })
      }
    }
  }

  return commands
}

// ============================================================================
// Validation helpers
// ============================================================================

function isValidRect(r: unknown): r is Rect {
  if (!r || typeof r !== "object") return false
  const obj = r as Record<string, unknown>
  return (
    typeof obj.x === "number" &&
    typeof obj.y === "number" &&
    typeof obj.width === "number" &&
    typeof obj.height === "number"
  )
}

function isValidPoint(p: unknown): p is Point {
  if (!p || typeof p !== "object") return false
  const obj = p as Record<string, unknown>
  return typeof obj.x === "number" && typeof obj.y === "number"
}

function isValidCommand(cmd: unknown): boolean {
  if (!cmd || typeof cmd !== "object") return false
  const obj = cmd as Record<string, unknown>
  const validTypes = ["spotlight", "arrow", "text", "circle", "highlight", "card", "clear", "wait"]
  return typeof obj.type === "string" && validTypes.includes(obj.type)
}
