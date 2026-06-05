import type { CommandRegistry } from '../command-registry.js'
import type { CommandResponse } from '../plugin/types.js'
import type { VibenCore } from '../core.js'

/**
 * Register the /switch command for hot-swapping agents mid-session.
 *
 * - `/switch` (no args): shows a menu of available agents (excluding current)
 * - `/switch <agent>`: aborts any running prompt and delegates to AgentSwitchHandler
 * - `/switch label on|off`: toggles agent attribution labels in conversation history
 *   (used by the context plugin when building history for the new agent)
 */
export function registerSwitchCommands(registry: CommandRegistry, _core: unknown): void {
  const core = _core as VibenCore;

  registry.register({
    name: 'switch',
    description: 'Switch to a different agent',
    usage: '[agent-name | label on|off]',
    category: 'system',
    handler: async (args) => {
      const raw = args.raw.trim()

      // /switch label on|off
      if (raw.startsWith('label ')) {
        const value = raw.slice(6).trim().toLowerCase()
        if (value !== 'on' && value !== 'off') {
          return { type: 'error', message: 'Usage: /switch label on|off' } satisfies CommandResponse
        }
        await core.configManager.save(
          { agentSwitch: { labelHistory: value === 'on' } },
          'agentSwitch.labelHistory',
        )
        return { type: 'text', text: `Agent label in history: ${value}` } satisfies CommandResponse
      }

      // Resolve session from context
      const session = args.sessionId
        ? core.sessionManager.getSession(args.sessionId)
        : null
      if (!session) {
        return { type: 'error', message: 'No active session in this topic.' } satisfies CommandResponse
      }

      // /switch <agentName> → direct switch
      if (raw) {
        const droppedCount = session.queueDepth
        if (session.promptRunning) {
          await session.abortPrompt()
        }

        try {
          const { resumed } = await core.switchSessionAgent(session.id, raw)
          const status = resumed ? 'resumed' : 'new session'
          const droppedNote = droppedCount > 0 ? ` (${droppedCount} queued prompt${droppedCount > 1 ? 's' : ''} cleared)` : ''
          return { type: 'text', text: `✅ Switched to ${raw} (${status})${droppedNote}` } satisfies CommandResponse
        } catch (err: any) {
          return { type: 'error', message: `Failed to switch agent: ${err.message || err}` } satisfies CommandResponse
        }
      }

      // /switch (no args) → show agent menu
      const agents = core.agentManager.getAvailableAgents()
      const currentAgent = session.agentName
      const options = agents.filter((a) => a.name !== currentAgent)

      if (options.length === 0) {
        return { type: 'text', text: 'No other agents available.' } satisfies CommandResponse
      }

      return {
        type: 'menu',
        title: `Switch Agent\nCurrent: ${currentAgent}\n\nSelect an agent:`,
        options: options.map((a) => ({
          label: a.name,
          command: `/switch ${a.name}`,
        })),
      } satisfies CommandResponse
    },
  })
}
