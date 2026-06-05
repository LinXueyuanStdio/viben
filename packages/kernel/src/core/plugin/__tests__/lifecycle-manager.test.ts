import { describe, it, expect, vi } from 'vitest'
import { LifecycleManager } from '../lifecycle-manager.js'
import type { VibenPlugin } from '../types.js'

function makePlugin(name: string, opts?: Partial<VibenPlugin>): VibenPlugin {
  return {
    name,
    version: '1.0.0',
    permissions: [],
    setup: vi.fn().mockResolvedValue(undefined),
    teardown: vi.fn().mockResolvedValue(undefined),
    ...opts,
  }
}

describe('LifecycleManager', () => {
  it('calls setup on all plugins in dependency order', async () => {
    const order: string[] = []
    const a = makePlugin('a', { setup: vi.fn(async () => { order.push('a') }) })
    const b = makePlugin('b', {
      pluginDependencies: { 'a': '^1.0.0' },
      setup: vi.fn(async () => { order.push('b') }),
    })
    const mgr = new LifecycleManager()
    await mgr.boot([b, a])
    expect(order).toEqual(['a', 'b'])
  })

  it('calls teardown in reverse order', async () => {
    const order: string[] = []
    const a = makePlugin('a', { teardown: vi.fn(async () => { order.push('a') }) })
    const b = makePlugin('b', {
      pluginDependencies: { 'a': '^1.0.0' },
      teardown: vi.fn(async () => { order.push('b') }),
    })
    const mgr = new LifecycleManager()
    await mgr.boot([b, a])
    await mgr.shutdown()
    expect(order).toEqual(['b', 'a'])
  })

  it('skips plugin if setup throws, continues with others', async () => {
    const a = makePlugin('a', { setup: vi.fn().mockRejectedValue(new Error('fail')) })
    const b = makePlugin('b')
    const mgr = new LifecycleManager()
    await mgr.boot([a, b])
    expect(a.setup).toHaveBeenCalled()
    expect(b.setup).toHaveBeenCalled()
  })

  it('skips dependent when required dependency fails', async () => {
    const a = makePlugin('a', { setup: vi.fn().mockRejectedValue(new Error('fail')) })
    const b = makePlugin('b', { pluginDependencies: { 'a': '^1.0.0' } })
    const mgr = new LifecycleManager()
    await mgr.boot([a, b])
    expect(b.setup).not.toHaveBeenCalled()
  })

  it('reports loaded and failed plugins', async () => {
    const a = makePlugin('a', { setup: vi.fn().mockRejectedValue(new Error('fail')) })
    const b = makePlugin('b')
    const mgr = new LifecycleManager()
    await mgr.boot([a, b])
    expect(mgr.loadedPlugins).toContain('b')
    expect(mgr.failedPlugins).toContain('a')
  })

  it('handles teardown errors gracefully', async () => {
    const a = makePlugin('a', { teardown: vi.fn().mockRejectedValue(new Error('teardown fail')) })
    const mgr = new LifecycleManager()
    await mgr.boot([a])
    // Should not throw
    await expect(mgr.shutdown()).resolves.not.toThrow()
  })

  it('creates PluginContext for each plugin', async () => {
    const a = makePlugin('a', {
      permissions: ['services:register'],
      setup: vi.fn(async (ctx) => {
        expect(ctx.pluginName).toBe('a')
        expect(typeof ctx.registerService).toBe('function')
      }),
    })
    const mgr = new LifecycleManager()
    await mgr.boot([a])
    expect(a.setup).toHaveBeenCalled()
  })

  it('resolves plugin config from ConfigManager', async () => {
    const plugin = makePlugin('@viben/speech', {
      permissions: ['services:register'],
      setup: vi.fn(async (ctx) => {
        expect(ctx.pluginConfig).toEqual({ groqApiKey: 'test-key' })
      }),
    })
    const mgr = new LifecycleManager({
      config: { get: () => ({ speech: { groqApiKey: 'test-key' } }) } as any,
    })
    await mgr.boot([plugin])
    expect(plugin.setup).toHaveBeenCalled()
  })

  it('resolves plugin config from new format (plugins.builtin)', async () => {
    const plugin = makePlugin('@viben/speech', {
      permissions: ['services:register'],
      setup: vi.fn(async (ctx) => {
        expect(ctx.pluginConfig).toEqual({ groqApiKey: 'new-key' })
      }),
    })
    const mgr = new LifecycleManager({
      config: {
        get: () => ({
          plugins: {
            builtin: {
              '@viben/speech': { config: { groqApiKey: 'new-key' } },
            },
          },
        }),
      } as any,
    })
    await mgr.boot([plugin])
    expect(plugin.setup).toHaveBeenCalled()
  })

  it('passes core to PluginContext', async () => {
    const mockCore = { sessionManager: {} }
    const plugin = makePlugin('test-core', {
      permissions: ['kernel:access'],
      setup: vi.fn(async (ctx) => {
        expect(ctx.core).toBe(mockCore)
      }),
    })
    const mgr = new LifecycleManager({ core: mockCore })
    await mgr.boot([plugin])
    expect(plugin.setup).toHaveBeenCalled()
  })
})

describe('LifecycleManager — circular dependency handling', () => {
  it('marks all plugins as failed and calls log.error on circular dependency', async () => {
    const a = makePlugin('a', { pluginDependencies: { 'b': '^1.0.0' } })
    const b = makePlugin('b', { pluginDependencies: { 'a': '^1.0.0' } })

    const errorSpy = vi.fn()
    const mockLog = {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: errorSpy,
      fatal: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as any

    const mgr = new LifecycleManager({ log: mockLog })
    await mgr.boot([a, b])

    expect(mgr.failedPlugins).toContain('a')
    expect(mgr.failedPlugins).toContain('b')
    expect(errorSpy).toHaveBeenCalled()
  })
})

describe('LifecycleManager.unloadPlugin', () => {
  it('unloads a loaded plugin and calls teardown', async () => {
    const plugin = makePlugin('a')
    const mgr = new LifecycleManager()
    await mgr.boot([plugin])
    expect(mgr.loadedPlugins).toContain('a')

    await mgr.unloadPlugin('a')
    expect(mgr.loadedPlugins).not.toContain('a')
    expect(plugin.teardown).toHaveBeenCalled()
  })

  it('is a no-op for unknown plugin names', async () => {
    const mgr = new LifecycleManager()
    await expect(mgr.unloadPlugin('nonexistent')).resolves.not.toThrow()
  })

  it('removes plugin from loadOrder', async () => {
    const a = makePlugin('a')
    const b = makePlugin('b')
    const mgr = new LifecycleManager()
    await mgr.boot([a, b])
    expect(mgr.loadedPlugins).toEqual(['a', 'b'])

    await mgr.unloadPlugin('a')
    expect(mgr.loadedPlugins).toEqual(['b'])
  })

  it('swallows teardown errors gracefully', async () => {
    const plugin = makePlugin('a', {
      teardown: vi.fn().mockRejectedValue(new Error('teardown boom')),
    })
    const mgr = new LifecycleManager()
    await mgr.boot([plugin])

    await expect(mgr.unloadPlugin('a')).resolves.not.toThrow()
    expect(mgr.loadedPlugins).not.toContain('a')
  })

  it('emits plugin:unloaded event', async () => {
    const emitSpy = vi.fn()
    const eventBus = { on: vi.fn(), off: vi.fn(), emit: emitSpy }
    const plugin = makePlugin('a')
    const mgr = new LifecycleManager({ eventBus })
    await mgr.boot([plugin])

    await mgr.unloadPlugin('a')
    expect(emitSpy).toHaveBeenCalledWith('plugin:unloaded', { name: 'a' })
  })

  it('handles plugin with no teardown function', async () => {
    const plugin = makePlugin('a', { teardown: undefined })
    const mgr = new LifecycleManager()
    await mgr.boot([plugin])

    await expect(mgr.unloadPlugin('a')).resolves.not.toThrow()
    expect(mgr.loadedPlugins).not.toContain('a')
  })
})
