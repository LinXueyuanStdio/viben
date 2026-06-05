import type { CommandRegistry } from '../command-registry.js'
import type { CommandResponse } from '../plugin/types.js'
import type { VibenCore } from '../core.js'

/**
 * Register agent management commands: /agents and /install.
 *
 * /agents lists installed and available agents from the catalog.
 * /install triggers agent installation, delegating to the assistant for guided flow
 * or showing a CLI command as fallback.
 */
export function registerAgentCommands(registry: CommandRegistry, _core: unknown): void {
  const core = _core as VibenCore

  registry.register({
    name: 'agents',
    description: 'List available agents',
    category: 'system',
    handler: async (args) => {
      const catalog = core.agentCatalog
      const items = catalog.getAvailable()

      const installed = items.filter((i) => i.installed)
      const available = items.filter((i) => !i.installed)

      if (installed.length === 0 && available.length === 0) {
        return { type: 'text', text: 'No agents configured.' } satisfies CommandResponse
      }

      const lines: string[] = []

      if (installed.length > 0) {
        lines.push('Installed:')
        for (const a of installed) {
          lines.push(`  ✅ ${a.name}${a.version ? ` (${a.version})` : ''}`)
        }
      }

      if (available.length > 0) {
        if (lines.length > 0) lines.push('')
        lines.push('Available to install:')
        for (const a of available) {
          lines.push(`  📦 ${a.name}${a.version ? ` (${a.version})` : ''} — /install ${a.key}`)
        }
      }

      return { type: 'text', text: lines.join('\n') } satisfies CommandResponse
    },
  })

  registry.register({
    name: 'install',
    description: 'Install an agent',
    usage: '[agent-name]',
    category: 'system',
    handler: async (args) => {
      const agentName = args.raw.trim()
      if (!agentName) {
        // No args — show installable agents as menu
        const catalog = core.agentCatalog
        const available = catalog.getAvailable().filter((i) => !i.installed)
        if (available.length === 0) {
          return { type: 'text', text: 'All available agents are already installed.' } satisfies CommandResponse
        }
        return {
          type: 'menu',
          title: '📦 Select an agent to install:',
          options: available.map((a) => ({
            label: `${a.name}${a.version ? ` (${a.version})` : ''}`,
            command: `/install ${a.key}`,
          })),
        } satisfies CommandResponse
      }

      // Delegate to assistant for guided install flow
      const assistant = core.assistantManager?.get(args.channelId)
      if (assistant) {
        await assistant.enqueuePrompt(`User wants to install agent "${agentName}". Guide them through the installation.`)
        return { type: 'delegated' }
      }

      return { type: 'text', text: `To install "${agentName}", run in terminal:\n\nviben agents install ${agentName}` } satisfies CommandResponse
    },
  })
}
