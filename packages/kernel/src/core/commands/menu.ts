import type { CommandRegistry } from '../command-registry.js'
import type { CommandResponse } from '../plugin/types.js'

/**
 * Register the /menu command, which presents a static main menu of common actions.
 *
 * Adapters render this as an inline keyboard (Telegram) or interactive message (Slack).
 * Each option maps to another command via the `c/` callback prefix routing.
 */
export function registerMenuCommand(registry: CommandRegistry, _core: unknown): void {
  registry.register({
    name: 'menu',
    description: 'Show the main menu',
    category: 'system',
    handler: async () => {
      return {
        type: 'menu',
        title: 'Main Menu',
        options: [
          { label: 'New Session', command: '/new' },
          { label: 'Active Sessions', command: '/sessions' },
          { label: 'Available Agents', command: '/agents' },
          { label: 'Usage', command: '/usage' },
          { label: 'Help', command: '/help' },
        ],
      } satisfies CommandResponse
    },
  })
}
