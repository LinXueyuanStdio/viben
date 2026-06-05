import type { CommandRegistry } from '../command-registry.js'
import { registerSessionCommands } from './session.js'
import { registerAgentCommands } from './agents.js'
import { registerAdminCommands } from './admin.js'
import { registerHelpCommand } from './help.js'
import { registerMenuCommand } from './menu.js'
import { registerSwitchCommands } from './switch.js'
import { registerConfigCommands } from './config.js'

/**
 * Register all built-in system commands with the command registry.
 *
 * Called once during startup (from main.ts). System commands always own the
 * short name — plugin commands cannot override them, only add qualified alternatives.
 */
export function registerSystemCommands(registry: CommandRegistry, core: unknown): void {
  registerSessionCommands(registry, core)
  registerAgentCommands(registry, core)
  registerAdminCommands(registry, core)
  registerHelpCommand(registry, core)
  registerMenuCommand(registry, core)
  registerSwitchCommands(registry, core)
  registerConfigCommands(registry, core)
}
