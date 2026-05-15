import { Bash, defineCommand } from "just-bash"
import type { PresentationStep } from "../../src/types.ts"
import { ALL_STEP_COMMANDS, createPresentationTools } from "../../src/commands/index.ts"
import type { PresentationToolDef } from "../../src/commands/index.ts"

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
    const unquoted = raw.length >= 2
      && ((raw.startsWith("'") && raw.endsWith("'"))
        || (raw.startsWith('"') && raw.endsWith('"')))
      ? raw.slice(1, -1)
      : raw

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
        result[key] = unquoted
      }
    }
  }
  return result
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
