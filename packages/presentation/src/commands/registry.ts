import type { StepCommandDef } from "./types"
import { coreCommands } from "./core"
import { datavizCommands } from "./dataviz"
import { narrativeCommands } from "./narrative"
import { effectsCommands } from "./effects"
import { advancedCommands } from "./advanced"

/** All step command definitions (49 total) */
export const ALL_STEP_COMMANDS: StepCommandDef[] = [
  ...coreCommands,
  ...datavizCommands,
  ...narrativeCommands,
  ...effectsCommands,
  ...advancedCommands,
]

/** Lookup by command name */
export const STEP_COMMAND_MAP = new Map<string, StepCommandDef>(
  ALL_STEP_COMMANDS.map(cmd => [cmd.name, cmd]),
)
