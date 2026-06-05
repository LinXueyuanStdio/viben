import type { AssistantSection } from '../assistant-registry.js'

/**
 * Creates the "Configuration" section for the assistant's system prompt.
 *
 * Injects the workspace base path and speech-to-text availability, so the
 * assistant knows the current environment and can guide config changes.
 */
export function createConfigSection(core: {
  configManager: { resolveWorkspace(): string }
  lifecycleManager?: { serviceRegistry: { get<T>(name: string): T | undefined } }
}): AssistantSection {
  return {
    id: 'core:config',
    title: 'Configuration',
    priority: 30,
    buildContext: () => {
      const workspace = core.configManager.resolveWorkspace()
      const speechSvc = core.lifecycleManager?.serviceRegistry.get<{ isSTTAvailable(): boolean }>('speech')
      const sttActive = speechSvc ? speechSvc.isSTTAvailable() : false
      return (
        `Workspace base: ${workspace}\n` +
        `STT: ${sttActive ? 'configured ✅' : 'Not configured'}`
      )
    },
    commands: [
      { command: 'viben config', description: 'View config' },
      { command: 'viben config set <key> <value>', description: 'Update config value' },
    ],
  }
}
