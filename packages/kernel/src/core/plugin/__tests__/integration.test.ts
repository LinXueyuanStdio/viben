import { describe, it, expect, vi } from 'vitest'
import { LifecycleManager } from '../lifecycle-manager.js'
import type { VibenPlugin } from '../types.js'

describe('Plugin System Integration', () => {
  it('full lifecycle: boot → middleware → service → shutdown', async () => {
    const serviceUsed = vi.fn()
    const middlewareFired = vi.fn()
    const teardownCalled = vi.fn()

    const providerPlugin: VibenPlugin = {
      name: 'provider',
      version: '1.0.0',
      permissions: ['services:register'],
      async setup(ctx) {
        ctx.registerService('my-service', {
          doWork: () => { serviceUsed(); return 'result' }
        })
      },
      async teardown() { teardownCalled() }
    }

    const consumerPlugin: VibenPlugin = {
      name: 'consumer',
      version: '1.0.0',
      pluginDependencies: { 'provider': '^1.0.0' },
      permissions: ['services:use', 'middleware:register'],
      async setup(ctx) {
        // Use service from provider
        const svc = ctx.getService<{ doWork(): string }>('my-service')
        expect(svc).toBeDefined()
        expect(svc!.doWork()).toBe('result')
        serviceUsed()

        // Register middleware
        ctx.registerMiddleware('message:incoming', {
          handler: async (payload, next) => {
            middlewareFired()
            return next()
          }
        })
      }
    }

    const mgr = new LifecycleManager()
    await mgr.boot([consumerPlugin, providerPlugin])

    // Verify boot
    expect(mgr.loadedPlugins).toContain('provider')
    expect(mgr.loadedPlugins).toContain('consumer')
    expect(serviceUsed).toHaveBeenCalled()

    // Verify middleware registered
    const result = await mgr.middlewareChain.execute(
      'message:incoming',
      { channelId: 'test', threadId: '1', userId: 'u1', text: 'hello' },
      async (p) => p
    )
    expect(middlewareFired).toHaveBeenCalled()
    expect(result).toBeDefined()

    // Shutdown
    await mgr.shutdown()
    expect(teardownCalled).toHaveBeenCalled()
  })

  it('plugin failure does not crash system', async () => {
    const badPlugin: VibenPlugin = {
      name: 'bad',
      version: '1.0.0',
      permissions: [],
      async setup() { throw new Error('boom') }
    }
    const goodPlugin: VibenPlugin = {
      name: 'good',
      version: '1.0.0',
      permissions: [],
      async setup() {}
    }

    const mgr = new LifecycleManager()
    await mgr.boot([badPlugin, goodPlugin])
    expect(mgr.failedPlugins).toContain('bad')
    expect(mgr.loadedPlugins).toContain('good')
  })
})
