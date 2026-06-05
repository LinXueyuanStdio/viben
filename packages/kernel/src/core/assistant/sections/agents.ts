import type { AssistantSection } from '../assistant-registry.js'

/**
 * Creates the "Agent Management" section for the assistant's system prompt.
 *
 * Injects a live snapshot of installed agents, the default agent, and how
 * many more are available in the ACP Registry — so the assistant can answer
 * questions about agents and help users install new ones.
 */
export function createAgentsSection(core: {
  agentCatalog: { getInstalledEntries(): Record<string, { name: string }>; getAvailable(): Array<{ installed: boolean }> }
  configManager: { get(): { defaultAgent: string } }
}): AssistantSection {
  return {
    id: 'core:agents',
    title: 'Agent Management',
    priority: 20,
    buildContext: () => {
      const installed = Object.keys(core.agentCatalog.getInstalledEntries())
      const available = core.agentCatalog.getAvailable().filter((i) => !i.installed).length
      const defaultAgent = core.configManager.get().defaultAgent
      return (
        `Installed agents: ${installed.join(', ')}\n` +
        `Default agent: ${defaultAgent}\n` +
        `Available in ACP Registry: ${available} more agents`
      )
    },
    commands: [
      { command: 'viben agents', description: 'List all agents' },
      { command: 'viben agents install <name>', description: 'Install agent' },
      { command: 'viben agents info <name>', description: 'Show agent details' },
      { command: 'viben agents run <name> -- <args>', description: 'Run agent CLI (for login etc.)' },
    ],
  }
}
