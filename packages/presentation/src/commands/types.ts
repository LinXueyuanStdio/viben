import type { PresentationCommand } from "../types"

/** Category for command grouping */
export type CommandCategory = "core" | "dataviz" | "narrative" | "effects" | "advanced"

/**
 * Self-contained definition for a single presentation step command.
 * Each of the 44 command types has one of these.
 */
export interface StepCommandDef {
  /** Subcommand name (e.g., "spotlight", "arrow") — matches PresentationCommand.type */
  name: string
  /** Human-readable description for --help output */
  description: string
  /** Grouping category */
  category: CommandCategory
  /** Default duration in ms when not explicitly specified */
  defaultDurationMs: number
  /**
   * Parse args into a PresentationCommand.
   * When called with empty object, produces a demo command with sensible defaults.
   */
  parseArgs: (args: Record<string, unknown>) => PresentationCommand
}
