import type { MenuRegistry } from '../menu-registry.js'

/**
 * Register the default menu items that appear in the interactive menu.
 *
 * Items are grouped by function (session, info, config, system, help) and
 * sorted by priority (lower = higher position). Each item maps to either
 * a command (`/sessions`), a delegate prompt (assistant-guided new session),
 * or a callback data string (settings panel).
 */
export function registerCoreMenuItems(registry: MenuRegistry): void {
  registry.register({
    id: 'core:new',
    label: '🆕 New Session',
    priority: 10,
    group: 'session',
    action: { type: 'delegate', prompt: 'User wants new session. Guide them through agent and workspace selection.' },
  })
  registry.register({
    id: 'core:sessions',
    label: '📋 Sessions',
    priority: 11,
    group: 'session',
    action: { type: 'command', command: '/sessions' },
  })
  registry.register({
    id: 'core:status',
    label: '📊 Status',
    priority: 20,
    group: 'info',
    action: { type: 'command', command: '/status' },
  })
  registry.register({
    id: 'core:agents',
    label: '🤖 Agents',
    priority: 21,
    group: 'info',
    action: { type: 'command', command: '/agents' },
  })
  registry.register({
    id: 'core:settings',
    label: '⚙️ Settings',
    priority: 30,
    group: 'config',
    action: { type: 'callback', callbackData: 's:settings' },
  })
  registry.register({
    id: 'core:integrate',
    label: '🔗 Integrate',
    priority: 31,
    group: 'config',
    action: { type: 'command', command: '/integrate' },
  })
  registry.register({
    id: 'core:restart',
    label: '🔄 Restart',
    priority: 40,
    group: 'system',
    action: { type: 'command', command: '/restart' },
  })
  registry.register({
    id: 'core:update',
    label: '⬆️ Update',
    priority: 41,
    group: 'system',
    action: { type: 'command', command: '/update' },
  })
  registry.register({
    id: 'core:help',
    label: '❓ Help',
    priority: 50,
    group: 'help',
    action: { type: 'command', command: '/help' },
  })
  registry.register({
    id: 'core:doctor',
    label: '🩺 Doctor',
    priority: 51,
    group: 'help',
    action: { type: 'command', command: '/doctor' },
  })
}
