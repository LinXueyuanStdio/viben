import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MiddlewareChain } from '../middleware-chain.js'
import { ErrorTracker } from '../error-tracker.js'

type NextFn<T = unknown> = (payload?: T) => Promise<T | null>

describe('MiddlewareChain', () => {
  let chain: MiddlewareChain

  beforeEach(() => {
    chain = new MiddlewareChain()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('executes handler when no middleware registered', async () => {
    const coreHandler = vi.fn().mockImplementation((p: { value: number }) => ({ value: p.value * 2 }))
    const result = await chain.execute('message:incoming', { value: 5 } as any, coreHandler)
    expect(coreHandler).toHaveBeenCalledWith({ value: 5 })
    expect(result).toEqual({ value: 10 })
  })

  it('middleware can modify payload', async () => {
    chain.add('message:incoming', 'plugin-a', {
      handler: async (payload: { value: number }, next: NextFn<{ value: number }>) => {
        return next({ ...payload, value: payload.value + 1 })
      },
    })
    const coreHandler = vi.fn().mockImplementation((p: { value: number }) => ({ value: p.value * 2 }))
    const result = await chain.execute('message:incoming', { value: 5 } as any, coreHandler)
    // payload modified from 5 to 6 before coreHandler, then doubled to 12
    expect(result).toEqual({ value: 12 })
  })

  it('middleware can block by returning null', async () => {
    chain.add('message:incoming', 'plugin-blocker', {
      handler: async (_payload: unknown, _next: NextFn) => {
        return null
      },
    })
    const coreHandler = vi.fn().mockResolvedValue({ value: 99 })
    const result = await chain.execute('message:incoming', { value: 5 } as any, coreHandler)
    expect(result).toBeNull()
    expect(coreHandler).not.toHaveBeenCalled()
  })

  it('executes middleware in registration order', async () => {
    const order: string[] = []
    chain.add('agent:beforePrompt', 'plugin-a', {
      handler: async (_payload: unknown, next: NextFn) => {
        order.push('a')
        return next()
      },
    })
    chain.add('agent:beforePrompt', 'plugin-b', {
      handler: async (_payload: unknown, next: NextFn) => {
        order.push('b')
        return next()
      },
    })
    const coreHandler = vi.fn().mockImplementation((p: unknown) => p)
    await chain.execute('agent:beforePrompt', { sessionId: 's1', text: 'hi', attachments: [] }, coreHandler)
    expect(order).toEqual(['a', 'b'])
  })

  it('priority overrides registration order (lower priority = earlier)', async () => {
    const order: string[] = []
    chain.add('agent:beforePrompt', 'plugin-late', {
      priority: 10,
      handler: async (_payload: unknown, next: NextFn) => {
        order.push('late')
        return next()
      },
    })
    chain.add('agent:beforePrompt', 'plugin-early', {
      priority: 1,
      handler: async (_payload: unknown, next: NextFn) => {
        order.push('early')
        return next()
      },
    })
    const coreHandler = vi.fn().mockImplementation((p: unknown) => p)
    await chain.execute('agent:beforePrompt', { sessionId: 's1', text: 'hi' }, coreHandler)
    expect(order).toEqual(['early', 'late'])
  })

  it('skips middleware that throws and continues chain', async () => {
    const errorHandler = vi.fn()
    chain.setErrorHandler(errorHandler)

    chain.add('agent:beforePrompt', 'plugin-bad', {
      handler: async (_payload: unknown, _next: NextFn) => {
        throw new Error('boom')
      },
    })
    chain.add('agent:beforePrompt', 'plugin-good', {
      handler: async (_payload: unknown, next: NextFn) => {
        return next()
      },
    })
    const coreHandler = vi.fn().mockImplementation((p: unknown) => p)
    const result = await chain.execute('agent:beforePrompt', { sessionId: 's1', text: 'hi' }, coreHandler)
    // chain continues with original payload, coreHandler is called
    expect(coreHandler).toHaveBeenCalled()
    expect(result).not.toBeNull()
    expect(errorHandler).toHaveBeenCalledWith('plugin-bad', expect.any(Error))
  })

  it('times out middleware after 5 seconds', async () => {
    vi.useFakeTimers()

    chain.add('agent:beforePrompt', 'plugin-slow', {
      handler: async (_payload: unknown, _next: NextFn) => {
        // never resolves
        return new Promise<never>(() => {})
      },
    })
    const coreHandler = vi.fn().mockImplementation((p: unknown) => p)

    const executePromise = chain.execute('agent:beforePrompt', { sessionId: 's1', text: 'hi' }, coreHandler)

    // advance past 5s timeout
    await vi.advanceTimersByTimeAsync(5001)

    const result = await executePromise
    // timed-out middleware is skipped, core handler still runs
    expect(coreHandler).toHaveBeenCalled()
    expect(result).not.toBeNull()
  })

  it('removes all middleware for a plugin', async () => {
    const order: string[] = []
    chain.add('agent:beforePrompt', 'plugin-a', {
      handler: async (_payload: unknown, next: NextFn) => {
        order.push('a')
        return next()
      },
    })
    chain.add('agent:beforeEvent', 'plugin-a', {
      handler: async (_payload: unknown, next: NextFn) => {
        order.push('a-event')
        return next()
      },
    })
    chain.add('agent:beforePrompt', 'plugin-b', {
      handler: async (_payload: unknown, next: NextFn) => {
        order.push('b')
        return next()
      },
    })

    chain.removeAll('plugin-a')

    const coreHandler = vi.fn().mockImplementation((p: unknown) => p)
    await chain.execute('agent:beforePrompt', { sessionId: 's1', text: 'hi' }, coreHandler)
    await chain.execute('agent:beforeEvent', { sessionId: 's1', event: {} as any }, coreHandler)

    expect(order).toEqual(['b'])
  })

  it('double next() call returns cached result', async () => {
    let nextCallCount = 0
    chain.add('agent:beforePrompt', 'plugin-double', {
      handler: async (_payload: unknown, next: NextFn) => {
        // call next twice
        const r1 = await next()
        nextCallCount++
        const r2 = await next()
        nextCallCount++
        // both calls should return the same result
        expect(r1).toBe(r2)
        return r1
      },
    })
    const coreHandler = vi.fn().mockImplementation((p: unknown) => ({ ...(p as object), processed: true }))
    await chain.execute('agent:beforePrompt', { sessionId: 's1', text: 'hi' }, coreHandler)
    // coreHandler should only be called once despite double next()
    expect(coreHandler).toHaveBeenCalledTimes(1)
    expect(nextCallCount).toBe(2)
  })

  it('skips disabled plugin middleware', async () => {
    const tracker = new ErrorTracker({ maxErrors: 1, windowMs: 60000 })
    chain.setErrorTracker(tracker)

    const handler = vi.fn(async (_p: unknown, next: NextFn) => next())
    chain.add('message:incoming', 'bad-plugin', { handler })

    // Disable the plugin by exceeding error budget
    tracker.increment('bad-plugin')
    expect(tracker.isDisabled('bad-plugin')).toBe(true)

    // Execute — handler should NOT be called
    const coreHandler = vi.fn().mockImplementation((p: unknown) => p)
    await chain.execute('message:incoming', { text: 'hi' }, coreHandler)
    expect(handler).not.toHaveBeenCalled()
    // Core handler should still be called
    expect(coreHandler).toHaveBeenCalled()
  })

  it('increments error tracker when middleware throws', async () => {
    const tracker = new ErrorTracker({ maxErrors: 5, windowMs: 60000 })
    chain.setErrorTracker(tracker)
    chain.setErrorHandler(() => {}) // suppress error logging

    chain.add('message:incoming', 'flaky-plugin', {
      handler: async () => { throw new Error('oops') },
    })

    await chain.execute('message:incoming', { text: 'hi' }, (p) => p)

    // Error should have been tracked
    const entry = tracker as unknown as { errors: Map<string, { count: number }> }
    // Use isDisabled as indirect check — not disabled yet (need 5)
    expect(tracker.isDisabled('flaky-plugin')).toBe(false)

    // Trigger 4 more to reach the threshold
    for (let i = 0; i < 4; i++) {
      await chain.execute('message:incoming', { text: 'hi' }, (p) => p)
    }
    expect(tracker.isDisabled('flaky-plugin')).toBe(true)
  })

  it('allows non-disabled plugins to still execute', async () => {
    const tracker = new ErrorTracker({ maxErrors: 1, windowMs: 60000 })
    chain.setErrorTracker(tracker)

    const goodHandler = vi.fn(async (_p: unknown, next: NextFn) => next())
    const badHandler = vi.fn(async (_p: unknown, next: NextFn) => next())

    chain.add('message:incoming', 'good-plugin', { handler: goodHandler })
    chain.add('message:incoming', 'bad-plugin', { handler: badHandler })

    // Disable only bad-plugin
    tracker.increment('bad-plugin')

    const coreHandler = vi.fn().mockImplementation((p: unknown) => p)
    await chain.execute('message:incoming', { text: 'hi' }, coreHandler)

    expect(goodHandler).toHaveBeenCalled()
    expect(badHandler).not.toHaveBeenCalled()
    expect(coreHandler).toHaveBeenCalled()
  })

  it('handlers added out of priority order are still executed in priority order', async () => {
    const order: string[] = []

    // Register in reverse priority order
    chain.add('test:hook', 'plugin-c', {
      priority: 300,
      handler: async (_p: unknown, next: NextFn) => { order.push('c'); return next() },
    })
    chain.add('test:hook', 'plugin-a', {
      priority: 100,
      handler: async (_p: unknown, next: NextFn) => { order.push('a'); return next() },
    })
    chain.add('test:hook', 'plugin-b', {
      priority: 200,
      handler: async (_p: unknown, next: NextFn) => { order.push('b'); return next() },
    })

    await chain.execute('test:hook', {}, (p) => p)

    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('adding handler to existing hook re-sorts all handlers', async () => {
    const order: string[] = []

    chain.add('test:hook', 'plugin-b', {
      priority: 200,
      handler: async (_p: unknown, next: NextFn) => { order.push('b'); return next() },
    })

    await chain.execute('test:hook', {}, (p) => p)
    expect(order).toEqual(['b'])

    order.length = 0

    // Add higher-priority handler after initial registration
    chain.add('test:hook', 'plugin-a', {
      priority: 50,
      handler: async (_p: unknown, next: NextFn) => { order.push('a'); return next() },
    })

    await chain.execute('test:hook', {}, (p) => p)
    expect(order).toEqual(['a', 'b'])
  })
})
