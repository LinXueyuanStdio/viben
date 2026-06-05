import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { TunnelProvider } from '../provider.js'

let mockProviderInstances: Array<TunnelProvider & { _simulateCrash: (code?: number | null) => void }> = []
let nextMockOverride: (() => TunnelProvider & { _simulateCrash: (code?: number | null) => void }) | null = null

function createMockProvider(opts?: { failStart?: boolean; url?: string }): TunnelProvider & { _simulateCrash: (code?: number | null) => void } {
  let exitCb: ((code: number | null) => void) | null = null
  const url = opts?.url ?? 'https://test-tunnel.trycloudflare.com'

  const mock = {
    start: opts?.failStart
      ? vi.fn().mockRejectedValue(new Error('start failed'))
      : vi.fn().mockResolvedValue(url),
    stop: vi.fn().mockResolvedValue(undefined),
    getPublicUrl: vi.fn().mockReturnValue(url),
    onExit(cb: (code: number | null) => void) { exitCb = cb },
    _simulateCrash(code: number | null = 1) { exitCb?.(code) },
  }
  mockProviderInstances.push(mock)
  return mock
}

function createProviderFromOverrideOrDefault(): any {
  if (nextMockOverride) {
    const fn = nextMockOverride
    nextMockOverride = null
    return fn()
  }
  return createMockProvider()
}

// Mock provider modules
vi.mock('../providers/cloudflare.js', () => {
  const Mock = vi.fn(function (this: any) { return createProviderFromOverrideOrDefault() })
  return { CloudflareTunnelProvider: Mock }
})
vi.mock('../providers/ngrok.js', () => {
  const Mock = vi.fn(function (this: any) { return createProviderFromOverrideOrDefault() })
  return { NgrokTunnelProvider: Mock }
})
vi.mock('../providers/bore.js', () => {
  const Mock = vi.fn(function (this: any) { return createProviderFromOverrideOrDefault() })
  return { BoreTunnelProvider: Mock }
})
vi.mock('../providers/tailscale.js', () => {
  const Mock = vi.fn(function (this: any) { return createProviderFromOverrideOrDefault() })
  return { TailscaleTunnelProvider: Mock }
})
vi.mock('../../../core/utils/log.js', () => ({
  createChildLogger: () => ({
    trace: vi.fn(), debug: vi.fn(), info: vi.fn(),
    warn: vi.fn(), error: vi.fn(), fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}))
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(false),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
    },
  }
})

import fs from 'node:fs'
import { TunnelRegistry } from '../tunnel-registry.js'
import { CloudflareTunnelProvider } from '../providers/cloudflare.js'

describe('TunnelRegistry — basic operations', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockProviderInstances = []
    nextMockOverride = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds a tunnel and resolves with active entry', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    const entry = await registry.add(3100, { type: 'system', provider: 'cloudflare' })

    expect(entry.status).toBe('active')
    expect(entry.publicUrl).toBe('https://test-tunnel.trycloudflare.com')
    expect(entry.retryCount).toBe(0)
  })

  it('rejects duplicate active port', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })

    await expect(registry.add(3100, { type: 'user', provider: 'cloudflare' }))
      .rejects.toThrow('already tunneled')
  })

  it('enforces max user tunnels', async () => {
    const registry = new TunnelRegistry({ maxUserTunnels: 1 })
    await registry.add(3100, { type: 'user', provider: 'cloudflare' })

    await expect(registry.add(3101, { type: 'user', provider: 'cloudflare' }))
      .rejects.toThrow('Max user tunnels')
  })

  it('allows re-add after stop', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'user', provider: 'cloudflare' })
    await registry.stop(3100)

    const entry = await registry.add(3100, { type: 'user', provider: 'cloudflare' })
    expect(entry.status).toBe('active')
  })

  it('allows re-add on a failed entry (clears retry timer)', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'user', provider: 'cloudflare' })

    // Crash it
    mockProviderInstances[0]._simulateCrash(1)
    expect(registry.get(3100)?.status).toBe('failed')

    // Re-add should succeed
    const entry = await registry.add(3100, { type: 'user', provider: 'cloudflare' })
    expect(entry.status).toBe('active')
  })

  it('prevents stopping system tunnel', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })

    await expect(registry.stop(3100)).rejects.toThrow('Cannot stop system tunnel')
  })

  it('lists user tunnels only by default', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })
    await registry.add(3200, { type: 'user', provider: 'cloudflare' })

    expect(registry.list(false)).toHaveLength(1)
    expect(registry.list(true)).toHaveLength(2)
  })

  it('gets system entry', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })

    const sys = registry.getSystemEntry()
    expect(sys).not.toBeNull()
    expect(sys!.type).toBe('system')
  })

  it('handles start failure gracefully', async () => {
    nextMockOverride = () => createMockProvider({ failStart: true })

    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await expect(registry.add(3100, { type: 'user', provider: 'cloudflare' }))
      .rejects.toThrow('start failed')
  })

  it('unknown provider falls back to cloudflare', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    const entry = await registry.add(3100, { type: 'user', provider: 'unknown-thing' })
    expect(entry.status).toBe('active')
    expect(CloudflareTunnelProvider).toHaveBeenCalled()
  })

  it('shuts down all tunnels and calls stop on providers', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })
    await registry.add(3200, { type: 'user', provider: 'cloudflare' })

    await registry.shutdown()

    for (const mock of mockProviderInstances) {
      expect(mock.stop).toHaveBeenCalled()
    }
    expect(registry.list(true)).toHaveLength(0)
  })

  it('stopAllUser skips system tunnels', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })
    await registry.add(3200, { type: 'user', provider: 'cloudflare' })
    await registry.add(3300, { type: 'user', provider: 'cloudflare' })

    await registry.stopAllUser()
    expect(registry.list(true)).toHaveLength(1)
    expect(registry.getSystemEntry()).not.toBeNull()
  })
})

describe('TunnelRegistry — session tunnels', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockProviderInstances = []
    nextMockOverride = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stopBySession stops only tunnels matching that sessionId', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'user', provider: 'cloudflare', sessionId: 'sess-a' })
    await registry.add(3200, { type: 'user', provider: 'cloudflare', sessionId: 'sess-b' })
    await registry.add(3300, { type: 'user', provider: 'cloudflare', sessionId: 'sess-a' })

    const stopped = await registry.stopBySession('sess-a')
    expect(stopped).toHaveLength(2)
    expect(registry.list(false)).toHaveLength(1)
    expect(registry.list(false)[0].sessionId).toBe('sess-b')
  })

  it('stopBySession returns empty array when no tunnels match', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'user', provider: 'cloudflare', sessionId: 'sess-a' })

    const stopped = await registry.stopBySession('sess-nonexistent')
    expect(stopped).toHaveLength(0)
    expect(registry.list(false)).toHaveLength(1)
  })

  it('getBySession excludes system tunnels', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })
    await registry.add(3200, { type: 'user', provider: 'cloudflare', sessionId: 'sess-a' })

    const result = registry.getBySession('sess-a')
    expect(result).toHaveLength(1)
    expect(result[0].port).toBe(3200)
  })
})

describe('TunnelRegistry — retry logic', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockProviderInstances = []
    nextMockOverride = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks entry as failed on post-establishment crash', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })

    mockProviderInstances[0]._simulateCrash(1)

    const entry = registry.get(3100)
    expect(entry?.status).toBe('failed')
  })

  it('retries on crash and reconnects with new URL', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })

    const crashed = mockProviderInstances[0]

    nextMockOverride = () => createMockProvider({ url: 'https://retry.trycloudflare.com' })
    crashed._simulateCrash(1)

    // Advance past first retry delay (2s)
    await vi.advanceTimersByTimeAsync(3_000)

    const entry = registry.get(3100)
    expect(entry?.status).toBe('active')
    expect(entry?.publicUrl).toBe('https://retry.trycloudflare.com')
  })

  it('preserves retryCount after successful retry', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })

    nextMockOverride = () => createMockProvider({ url: 'https://r1.trycloudflare.com' })
    mockProviderInstances[0]._simulateCrash(1)
    await vi.advanceTimersByTimeAsync(3_000)

    const entry = registry.get(3100)
    expect(entry?.status).toBe('active')
    // retryCount should reflect the attempt number, not be reset
    expect(entry?.retryCount).toBe(1)
  })

  it('exhausts all 5 retries then stays failed', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })

    // Each retry will also fail on start
    for (let i = 0; i < 5; i++) {
      nextMockOverride = () => createMockProvider({ failStart: true })

      if (i === 0) {
        mockProviderInstances[0]._simulateCrash(1)
      }

      // Advance past the exponential delay: 2s, 4s, 8s, 16s, 32s
      const delay = 2000 * Math.pow(2, i)
      await vi.advanceTimersByTimeAsync(delay + 500)
    }

    const entry = registry.get(3100)
    expect(entry?.status).toBe('failed')
    expect(entry?.retryCount).toBe(5)

    // No more retries scheduled — advance a long time and verify no new providers
    const countBefore = mockProviderInstances.length
    await vi.advanceTimersByTimeAsync(100_000)
    expect(mockProviderInstances.length).toBe(countBefore)
  })

  it('respects exponential backoff: second retry waits 4s not 2s', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })

    // First crash → schedules retry at 2s
    mockProviderInstances[0]._simulateCrash(1)

    // First retry succeeds but then crashes again
    await vi.advanceTimersByTimeAsync(2_500)
    expect(registry.get(3100)?.status).toBe('active')

    // Get the new provider and crash it
    const secondProvider = mockProviderInstances[mockProviderInstances.length - 1]
    secondProvider._simulateCrash(1)
    expect(registry.get(3100)?.status).toBe('failed')

    // At 3.5s after second crash (less than 4s), should still be failed
    await vi.advanceTimersByTimeAsync(3_500)
    expect(registry.get(3100)?.status).toBe('failed')

    // At 4.5s, should have retried
    await vi.advanceTimersByTimeAsync(1_000)
    expect(registry.get(3100)?.status).toBe('active')
  })

  it('stop() cancels a pending retry', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'user', provider: 'cloudflare' })

    mockProviderInstances[0]._simulateCrash(1)
    expect(registry.get(3100)?.status).toBe('failed')

    // Stop before retry fires
    await registry.stop(3100)
    expect(registry.get(3100)).toBeNull()

    // Advance past retry delay — no new provider
    const countBefore = mockProviderInstances.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(mockProviderInstances.length).toBe(countBefore)
  })

  it('stop() during mid-flight retry removes the tunnel', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'user', provider: 'cloudflare' })

    // Slow mock for the retry — start() hangs until we resolve
    let resolveRetry!: (url: string) => void
    nextMockOverride = () => {
      const mock = createMockProvider()
      mock.start = vi.fn().mockReturnValue(
        new Promise<string>(resolve => { resolveRetry = resolve })
      )
      return mock
    }

    // Crash → schedules retry at 2s
    mockProviderInstances[0]._simulateCrash(1)
    expect(registry.get(3100)?.status).toBe('failed')

    // Fire retry timer synchronously — retry() starts but hangs inside add() (slow mock)
    vi.advanceTimersByTime(2_500)

    // Entry was deleted by retry(); stop() currently finds nothing and returns early (bug)
    const stopPromise = registry.stop(3100)

    // Resolve the slow add while stop() is pending
    resolveRetry('https://retry.trycloudflare.com')

    await stopPromise

    // Tunnel must be gone — not re-added by the racing retry
    expect(registry.get(3100)).toBeNull()
  })

  it('retries on initial start failure (e.g. rate limiting)', async () => {
    // First attempt fails (simulates 429 rate limit)
    nextMockOverride = () => createMockProvider({ failStart: true })

    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await expect(registry.add(3100, { type: 'system', provider: 'cloudflare' }))
      .rejects.toThrow('start failed')

    // Entry should be failed but retry scheduled
    expect(registry.get(3100)?.status).toBe('failed')

    // Second attempt succeeds after retry delay (2s)
    await vi.advanceTimersByTimeAsync(2_500)

    const entry = registry.get(3100)
    expect(entry?.status).toBe('active')
    expect(entry?.publicUrl).toBe('https://test-tunnel.trycloudflare.com')
  })

  it('does not retry during shutdown', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })

    const provider = mockProviderInstances[0]
    await registry.shutdown()

    const countBefore = mockProviderInstances.length
    provider._simulateCrash(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(mockProviderInstances.length).toBe(countBefore)
  })
})

describe('TunnelRegistry — restore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockProviderInstances = []
    nextMockOverride = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('restores only user tunnels from persisted data', async () => {
    const persisted = [
      { port: 3100, type: 'system', provider: 'cloudflare', createdAt: new Date().toISOString() },
      { port: 3200, type: 'user', provider: 'cloudflare', label: 'my-app', createdAt: new Date().toISOString() },
    ]
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(persisted))

    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.restore()

    // Only user tunnel restored, not system
    expect(registry.list(true)).toHaveLength(1)
    expect(registry.list(true)[0].port).toBe(3200)
  })

  it('handles malformed JSON gracefully', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('not valid json{{{')

    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    // Should not throw
    await registry.restore()
    expect(registry.list(true)).toHaveLength(0)
  })

  it('handles individual tunnel restore failure', async () => {
    const persisted = [
      { port: 3200, type: 'user', provider: 'cloudflare', createdAt: new Date().toISOString() },
      { port: 3300, type: 'user', provider: 'cloudflare', createdAt: new Date().toISOString() },
    ]
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(persisted))

    // First tunnel fails, second succeeds
    let callNum = 0
    const originalMock = vi.mocked(CloudflareTunnelProvider).getMockImplementation()
    vi.mocked(CloudflareTunnelProvider).mockImplementation(function (this: any) {
      if (callNum++ === 0) return createMockProvider({ failStart: true }) as any
      return createMockProvider() as any
    })

    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.restore()

    // Only second tunnel should be active
    const active = registry.list(true).filter(e => e.status === 'active')
    expect(active).toHaveLength(1)
    expect(active[0].port).toBe(3300)
  })

  it('skips restore when tunnels.json does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.restore()
    expect(registry.list(true)).toHaveLength(0)
  })

  it('restores multiple user tunnels in parallel (not sequentially)', async () => {
    const persisted = [
      { port: 3200, type: 'user', provider: 'cloudflare', label: 'app-a', createdAt: new Date().toISOString() },
      { port: 3300, type: 'user', provider: 'cloudflare', label: 'app-b', createdAt: new Date().toISOString() },
      { port: 3400, type: 'user', provider: 'cloudflare', label: 'app-c', createdAt: new Date().toISOString() },
    ]
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(persisted))

    // Track the order of start() calls — all should be called before any resolves
    const startOrder: number[] = []
    let resolvers: Array<(url: string) => void> = []

    vi.mocked(CloudflareTunnelProvider).mockImplementation(function (this: any) {
      const mock = createMockProvider()
      mock.start = vi.fn().mockImplementation((port: number) => {
        startOrder.push(port)
        return new Promise<string>(resolve => { resolvers.push(resolve) })
      })
      return mock as any
    })

    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    const restorePromise = registry.restore()

    // All 3 starts should have been called concurrently
    await vi.advanceTimersByTimeAsync(0)
    expect(startOrder).toHaveLength(3)
    expect(startOrder).toEqual([3200, 3300, 3400])

    // Resolve them
    resolvers.forEach(r => r('https://test.trycloudflare.com'))
    await restorePromise

    expect(registry.list(false)).toHaveLength(3)

    // Restore default mock so subsequent tests aren't affected
    vi.mocked(CloudflareTunnelProvider).mockImplementation(function (this: any) {
      return createProviderFromOverrideOrDefault()
    })
  })

  it('restores user tunnels without sessionId (sessions do not survive restart)', async () => {
    const persisted = [
      { port: 3200, type: 'user', provider: 'cloudflare', label: 'my-app', sessionId: 'sess-old', createdAt: new Date().toISOString() },
    ]
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(persisted))

    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.restore()

    const restored = registry.list(false)
    expect(restored).toHaveLength(1)
    expect(restored[0].label).toBe('my-app')
    expect(restored[0].sessionId).toBeUndefined()
  })
})

describe('TunnelRegistry — shutdown persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockProviderInstances = []
    nextMockOverride = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shutdown passes preserveState=true to providers', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })
    await registry.add(3200, { type: 'user', provider: 'cloudflare' })

    await registry.shutdown()

    for (const mock of mockProviderInstances) {
      expect(mock.stop).toHaveBeenCalledWith(true, true)
    }
  })

  it('shutdown persists entries to tunnels.json before clearing', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })
    await registry.add(3200, { type: 'user', provider: 'cloudflare', label: 'my-app' })

    await registry.shutdown()

    const writeCalls = vi.mocked(fs.writeFileSync).mock.calls
    const lastWrite = writeCalls[writeCalls.length - 1]
    const persisted = JSON.parse(lastWrite[1] as string) as Array<{ port: number; type: string }>

    expect(persisted).toHaveLength(2)
    expect(persisted.map(e => e.port).sort()).toEqual([3100, 3200])
  })

  it('flush() is a no-op after shutdown (does not overwrite with empty)', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'user', provider: 'cloudflare' })

    await registry.shutdown()

    const writeCountAfterShutdown = vi.mocked(fs.writeFileSync).mock.calls.length

    registry.flush()

    expect(vi.mocked(fs.writeFileSync).mock.calls.length).toBe(writeCountAfterShutdown)
  })

  it('double shutdown does not overwrite preserved tunnels.json', async () => {
    const registry = new TunnelRegistry({ registryPath: '/tmp/test-tunnels.json' })
    await registry.add(3100, { type: 'user', provider: 'cloudflare' })

    await registry.shutdown()

    const writeCountAfterFirst = vi.mocked(fs.writeFileSync).mock.calls.length

    await registry.shutdown()

    expect(vi.mocked(fs.writeFileSync).mock.calls.length).toBe(writeCountAfterFirst)
  })
})
