/**
 * Command Compiler
 *
 * Compiles high-level presentation tool inputs into PresentationCommand sequences.
 * Handles tool name normalization and payload-to-commands translation.
 */

import type { PresentationCommand, PresentationToolName } from "./types"
import { ALL_STEP_COMMANDS, STEP_COMMAND_MAP } from "./commands"

/** All known presentation tool names (client-side) */
const PRESENTATION_TOOL_NAMES = new Set<string>(
  ALL_STEP_COMMANDS.map((def) => `presentation_${def.name}`),
)

export function getPresentationToolNames(): PresentationToolName[] {
  return ALL_STEP_COMMANDS.map((def) => `presentation_${def.name}` as PresentationToolName)
}

/**
 * Normalize a tool name to a known PresentationToolName.
 * Returns null if the tool name is not a presentation tool.
 */
export function normalizePresentationToolName(toolName: string): PresentationToolName | null {
  const candidate = stripMcpToolPrefix(toolName)
  if (PRESENTATION_TOOL_NAMES.has(candidate)) {
    return candidate as PresentationToolName
  }

  const commandName = candidate.startsWith("presentation_")
    ? candidate.slice("presentation_".length)
    : candidate
  const normalized = `presentation_${commandName}`
  if (PRESENTATION_TOOL_NAMES.has(normalized)) {
    return normalized as PresentationToolName
  }

  return null
}

/**
 * Check if a tool name is a client-side presentation tool.
 */
export function isClientSidePresentationTool(toolName: string): boolean {
  return normalizePresentationToolName(toolName) !== null
}

/**
 * Compile a presentation tool invocation into PresentationCommand[].
 */
export function compilePresentationCommands(
  toolName: PresentationToolName,
  input: Record<string, unknown>
): PresentationCommand[] {
  const commandName = toolName.slice("presentation_".length)
  const def = STEP_COMMAND_MAP.get(commandName)
  return def ? [def.parseArgs(input)] : []
}

function stripMcpToolPrefix(toolName: string): string {
  const parts = toolName.split("__")
  return parts[parts.length - 1] || toolName
}
