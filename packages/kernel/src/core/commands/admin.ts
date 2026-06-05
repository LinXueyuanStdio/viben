import type { CommandRegistry } from '../command-registry.js'
import type { CommandResponse } from '../plugin/types.js'
import type { VibenCore } from '../core.js'

/**
 * Register administrative commands: /restart, /update, /doctor, /integrate.
 *
 * These commands manage the server itself — restarting, updating, running
 * diagnostics, and setting up new platform integrations.
 */
export function registerAdminCommands(registry: CommandRegistry, _core: unknown): void {
  const core = _core as VibenCore;
  registry.register({
    name: 'restart',
    description: 'Restart the server',
    category: 'system',
    handler: async (args) => {
      if (!core.requestRestart) {
        return { type: 'error', message: 'Restart is not available (no restart handler registered).' } satisfies CommandResponse
      }
      // Reply first, then restart after a short delay
      setTimeout(async () => {
        await core.requestRestart!()
      }, 500)
      return { type: 'text', text: '🔄 <b>Restarting Viben...</b>\nRebuilding and restarting. Be back shortly.' } satisfies CommandResponse
    },
  })

  registry.register({
    name: 'update',
    description: 'Check for and apply updates',
    category: 'system',
    handler: async (args) => {
      if (!core.requestRestart) {
        return { type: 'error', message: 'Update is not available (no restart handler registered).' } satisfies CommandResponse
      }
      return { type: 'text', text: '⬆️ Checking for updates...\nUse the Telegram /update command for the full update flow.' } satisfies CommandResponse
    },
  })

  registry.register({
    name: 'doctor',
    description: 'Run system diagnostics',
    category: 'system',
    handler: async () => {
      return { type: 'text', text: 'Running diagnostics...' } satisfies CommandResponse
    },
  })

  registry.register({
    name: 'integrate',
    description: 'Set up a new channel integration',
    usage: '[channel]',
    category: 'system',
    handler: async (args) => {
      const channel = args.raw.trim()
      if (!channel) {
        return {
          type: 'menu',
          title: 'Available Integrations',
          options: [
            { label: 'Telegram', command: '/integrate telegram' },
            { label: 'Discord', command: '/integrate discord' },
          ],
        } satisfies CommandResponse
      }
      return { type: 'text', text: `Setting up ${channel} integration...` } satisfies CommandResponse
    },
  })
}
