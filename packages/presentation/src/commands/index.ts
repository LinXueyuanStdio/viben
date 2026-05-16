import type { PresentationStep } from "../types"
import { describeCommand } from "../types"
import type { StepCommandDef } from "./types"
import { ALL_STEP_COMMANDS } from "./registry"

export type { StepCommandDef, CommandCategory } from "./types"
export { ALL_STEP_COMMANDS, STEP_COMMAND_MAP } from "./registry"

/**
 * Options for creating executor-compatible presentation tools.
 */
export interface CreatePresentationToolsOptions {
  /** Called when a new step is created */
  onStep: (step: PresentationStep) => void
  /** Get current timeline cursor position in ms */
  getCursorMs: () => number
  /** Advance cursor by given ms */
  advanceCursor: (ms: number) => void
  /** Generate a unique step ID */
  nextId: () => string
}

export interface PresentationToolDef {
  description: string
  execute: (args: Record<string, unknown>) => { step: PresentationStep; summary: string }
}

/**
 * Create a map of executor-compatible tools for all presentation commands.
 * Keys are "presentation.{name}" (e.g., "presentation.spotlight").
 *
 * Usage with @just-bash/executor:
 * ```ts
 * const tools = createPresentationTools({ ... })
 * const executor = await createExecutor({ tools })
 * ```
 */
export function createPresentationTools(
  opts: CreatePresentationToolsOptions,
): Record<string, PresentationToolDef> {
  const tools: Record<string, PresentationToolDef> = {}

  for (const def of ALL_STEP_COMMANDS) {
    tools[`presentation.${def.name}`] = {
      description: def.description,
      execute: (args: Record<string, unknown>) => executeCommand(def, args, opts),
    }
  }

  return tools
}

function executeCommand(
  def: StepCommandDef,
  args: Record<string, unknown>,
  opts: CreatePresentationToolsOptions,
): { step: PresentationStep; summary: string } {
  // Parse timing overrides
  const startMs = args.startMs !== undefined ? Number(args.startMs) : opts.getCursorMs()
  const durationMs = args.durationMs !== undefined ? Number(args.durationMs) : def.defaultDurationMs
  const endMs = args.endMs !== undefined ? Number(args.endMs) : startMs + durationMs

  // Remove timing args before passing to parseArgs
  const { startMs: _s, endMs: _e, durationMs: _d, ...commandArgs } = args

  // Build the command
  const command = def.parseArgs(commandArgs)

  // Build the step
  const id = opts.nextId()
  const step: PresentationStep = {
    id,
    toolUseId: `bash-${id}`,
    toolName: `presentation.${def.name}`,
    toolInput: args,
    command,
    description: describeCommand(command),
    status: "done",
    startMs,
    endMs,
  }

  // Emit step
  opts.onStep(step)

  // Auto-advance cursor
  opts.advanceCursor(durationMs)

  return {
    step,
    summary: `[${def.name}] ${step.description} @${startMs}ms-${endMs}ms`,
  }
}
