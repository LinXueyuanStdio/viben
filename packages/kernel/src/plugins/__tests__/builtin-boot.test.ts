import { describe, it, expect, vi } from 'vitest'
import { LifecycleManager } from '../../core/plugin/lifecycle-manager.js'
import { builtInPlugins } from '../index.js'

describe('Built-in plugin boot', () => {
  it('loads non-adapter plugins with empty config', async () => {
    // Only test plugins that don't require external connections (bot tokens, etc.)
    const safePlugins = builtInPlugins.filter(p =>
      !['@viben/telegram', '@viben/discord-adapter', '@viben/slack-adapter',
        '@viben/tunnel', '@viben/api-server'].includes(p.name)
    )

    const mockCore = {
      configManager: { get: () => ({ security: { allowedUserIds: [], maxConcurrentSessions: 5 } }) },
      sessionManager: { listSessions: () => [] },
      adapters: new Map(),
    }

    const mgr = new LifecycleManager({
      core: mockCore,
      config: mockCore.configManager as any,
      instanceRoot: '/tmp/test-viben',
    })

    await mgr.boot(safePlugins)

    // Should load: security, file-service, notifications, usage, speech, context
    expect(mgr.loadedPlugins.length).toBeGreaterThanOrEqual(4)
    expect(mgr.failedPlugins.length).toBe(0)

    // Verify services registered
    expect(mgr.serviceRegistry.has('security')).toBe(true)
    expect(mgr.serviceRegistry.has('file-service')).toBe(true)
    expect(mgr.serviceRegistry.has('context')).toBe(true)
  })

  it('resolves dependencies correctly — notifications after security', async () => {
    const order: string[] = []

    // Create simple plugins that just track order
    const trackingPlugins = [
      {
        name: '@viben/security',
        version: '1.0.0',
        permissions: ['services:register'] as any,
        async setup() { order.push('security') },
      },
      {
        name: '@viben/notifications',
        version: '1.0.0',
        pluginDependencies: { '@viben/security': '^1.0.0' },
        permissions: ['services:register'] as any,
        async setup() { order.push('notifications') },
      },
    ]

    const mgr = new LifecycleManager()
    await mgr.boot(trackingPlugins)

    expect(order).toEqual(['security', 'notifications'])
  })
})
