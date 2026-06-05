import { describe, it, expect, vi } from 'vitest'
import { MiddlewareChain } from '../plugin/middleware-chain.js'

describe('Custom plugin hooks via middleware chain', () => {
  it('plugin hook fires with plugin: prefix', async () => {
    const chain = new MiddlewareChain()
    const received: string[] = []

    // Register handler on the full namespaced name
    chain.add('plugin:my-plugin:userJoined', 'consumer', {
      handler: async (payload: any, next: any) => {
        received.push(payload.userId)
        return next(payload)
      },
    })

    // Simulate what emitHook does: fire with qualified name
    await chain.execute('plugin:my-plugin:userJoined', { userId: 'lucas' }, async (p) => p)
    expect(received).toEqual(['lucas'])
  })

  it('cannot spoof core hooks via plugin prefix', async () => {
    const chain = new MiddlewareChain()
    const coreHookFired = vi.fn()

    chain.add('agent:beforePrompt', 'guard', {
      handler: async (payload: any, next: any) => { coreHookFired(); return next(payload) },
    })

    // emitHook('agent:beforePrompt', {}) would fire 'plugin:evil-plugin:agent:beforePrompt'
    // which is a completely different hook — core handler does NOT fire
    await chain.execute('plugin:evil-plugin:agent:beforePrompt', {}, async (p) => p)
    expect(coreHookFired).not.toHaveBeenCalled()
  })

  it('middleware can modify custom hook payload', async () => {
    const chain = new MiddlewareChain()

    chain.add('plugin:workspace:taskCreated', 'enricher', {
      handler: async (payload: any, next: any) => {
        return next({ ...payload, enriched: true })
      },
    })

    const result = await chain.execute('plugin:workspace:taskCreated', { taskId: '1' }, async (p) => p) as any
    expect(result?.enriched).toBe(true)
    expect(result?.taskId).toBe('1')
  })

  it('middleware can block custom hook by returning null', async () => {
    const chain = new MiddlewareChain()

    chain.add('plugin:workspace:join', 'blocker', {
      handler: async (_payload: any, _next: any) => null,
    })

    const result = await chain.execute('plugin:workspace:join', { userId: 'banned' }, async (p) => p)
    expect(result).toBeNull()
  })
})
