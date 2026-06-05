import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPluginContext } from '../plugin-context.js'
import { ServiceRegistry } from '../service-registry.js'
import { MiddlewareChain } from '../middleware-chain.js'
import { ErrorTracker } from '../error-tracker.js'
import type { PluginPermission } from '../types.js'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

function makeEventBus() {
  const listeners = new Map<string, Set<Function>>()
  return {
    on: vi.fn((event: string, handler: Function) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(handler)
    }),
    off: vi.fn((event: string, handler: Function) => {
      listeners.get(event)?.delete(handler)
    }),
    emit: vi.fn(),
    _listeners: listeners,
  }
}

function makeContext(permissions: PluginPermission[]) {
  const serviceRegistry = new ServiceRegistry()
  const middlewareChain = new MiddlewareChain()
  const errorTracker = new ErrorTracker()
  const eventBus = makeEventBus()
  const storagePath = mkdtempSync(join(tmpdir(), 'plugin-ctx-test-'))
  const sessions = { list: vi.fn() }
  const config = { get: vi.fn() }

  const ctx = createPluginContext({
    pluginName: 'test-plugin',
    pluginConfig: { foo: 'bar' },
    permissions,
    serviceRegistry,
    middlewareChain,
    errorTracker,
    eventBus: eventBus as any,
    storagePath,
    sessions,
    config,
  })

  return { ctx, serviceRegistry, middlewareChain, eventBus, sessions, config }
}

describe('PluginContext permission enforcement', () => {
  it('throws on registerService without services:register', () => {
    const { ctx } = makeContext([])
    expect(() => ctx.registerService('svc', {})).toThrow(/services:register/)
  })

  it('allows registerService with services:register', () => {
    const { ctx } = makeContext(['services:register'])
    expect(() => ctx.registerService('svc', {})).not.toThrow()
  })

  it('throws on on() without events:read', () => {
    const { ctx } = makeContext([])
    expect(() => ctx.on('test', () => {})).toThrow(/events:read/)
  })

  it('allows on() with events:read', () => {
    const { ctx } = makeContext(['events:read'])
    expect(() => ctx.on('test', () => {})).not.toThrow()
  })

  it('throws on emit() without events:emit', () => {
    const { ctx } = makeContext([])
    expect(() => ctx.emit('test', {})).toThrow(/events:emit/)
  })

  it('allows emit() with events:emit', () => {
    const { ctx, eventBus } = makeContext(['events:emit'])
    ctx.emit('test:event', { data: 1 })
    expect(eventBus.emit).toHaveBeenCalledWith('test:event', { data: 1 })
  })

  it('throws on getService without services:use', () => {
    const { ctx } = makeContext([])
    expect(() => ctx.getService('svc')).toThrow(/services:use/)
  })

  it('throws on registerMiddleware without middleware:register', () => {
    const { ctx } = makeContext([])
    expect(() => ctx.registerMiddleware('message:incoming', { handler: async (p, next) => next() })).toThrow(/middleware:register/)
  })

  it('throws on registerCommand without commands:register', () => {
    const { ctx } = makeContext([])
    expect(() => ctx.registerCommand({ name: 'test', description: 'test', category: 'plugin', handler: async () => {} })).toThrow(/commands:register/)
  })

  it('throws on storage.set without storage:write', () => {
    const { ctx } = makeContext(['storage:read'])
    expect(() => ctx.storage.set('key', 'val')).rejects.toThrow(/storage:write/)
  })

  it('allows storage.get with storage:read', async () => {
    const { ctx } = makeContext(['storage:read'])
    const result = await ctx.storage.get('nonexistent')
    expect(result).toBeUndefined()
  })

  it('throws on sessions access without kernel:access', () => {
    const { ctx } = makeContext([])
    expect(() => ctx.sessions).toThrow(/kernel:access/)
  })

  it('exposes core with kernel:access permission', () => {
    const mockCore = { sessionManager: {} }
    const serviceRegistry = new ServiceRegistry()
    const middlewareChain = new MiddlewareChain()
    const errorTracker = new ErrorTracker()
    const eventBus = makeEventBus()
    const storagePath = mkdtempSync(join(tmpdir(), 'plugin-ctx-test-'))

    const ctx = createPluginContext({
      pluginName: 'test-plugin',
      pluginConfig: {},
      permissions: ['kernel:access'],
      serviceRegistry,
      middlewareChain,
      errorTracker,
      eventBus: eventBus as any,
      storagePath,
      sessions: {},
      config: {},
      core: mockCore,
    })
    expect(ctx.core).toBe(mockCore)
  })

  it('throws when accessing core without kernel:access', () => {
    const { ctx } = makeContext([])
    expect(() => ctx.core).toThrow(/permission/i)
  })
})

describe('PluginContext identity and log', () => {
  it('exposes pluginName and pluginConfig', () => {
    const { ctx } = makeContext([])
    expect(ctx.pluginName).toBe('test-plugin')
    expect(ctx.pluginConfig).toEqual({ foo: 'bar' })
  })

  it('log is always available', () => {
    const { ctx } = makeContext([])
    expect(ctx.log).toBeDefined()
    expect(() => ctx.log.info('test')).not.toThrow()
    expect(() => ctx.log.error('test')).not.toThrow()
  })
})

describe('PluginContext sendMessage', () => {
  it('sendMessage requires services:use', async () => {
    const { ctx } = makeContext([])
    await expect(ctx.sendMessage('sess-1', { type: 'text', text: 'hi' } as any)).rejects.toThrow(/services:use/)
  })
})

describe('registerEditableFields', () => {
  it('throws without commands:register permission', () => {
    const { ctx } = makeContext([])
    expect(() => ctx.registerEditableFields([
      { key: 'token', displayName: 'Token', type: 'string', scope: 'sensitive' },
    ])).toThrow(/commands:register/)
  })

  it('registers fields into the field-registry service', () => {
    const { ctx, serviceRegistry } = makeContext(['commands:register'])
    const mockRegistry = { register: vi.fn() }
    serviceRegistry.register('field-registry', mockRegistry, 'system')

    ctx.registerEditableFields([
      { key: 'botToken', displayName: 'Bot Token', type: 'string', scope: 'sensitive' },
    ])

    expect(mockRegistry.register).toHaveBeenCalledWith(
      expect.any(String), // pluginName
      [{ key: 'botToken', displayName: 'Bot Token', type: 'string', scope: 'sensitive' }],
    )
  })

  it('is a no-op when field-registry service is not registered', () => {
    const { ctx } = makeContext(['commands:register'])
    expect(() => ctx.registerEditableFields([
      { key: 'x', displayName: 'X', type: 'string', scope: 'safe' },
    ])).not.toThrow()
  })
})

describe('PluginContext cleanup', () => {
  it('auto-cleans event listeners on cleanup()', () => {
    const { ctx, eventBus } = makeContext(['events:read'])
    const handler = vi.fn()
    ctx.on('session:created', handler)
    expect(eventBus.on).toHaveBeenCalledTimes(1)

    ctx.cleanup()
    expect(eventBus.off).toHaveBeenCalledWith('session:created', handler)
  })

  it('unregisters services from ServiceRegistry on cleanup()', () => {
    const { ctx, serviceRegistry } = makeContext(['services:register'])
    ctx.registerService('my-svc', { hello: true })
    expect(serviceRegistry.has('my-svc')).toBe(true)

    ctx.cleanup()
    expect(serviceRegistry.has('my-svc')).toBe(false)
  })

  it('unregisters commands from CommandRegistry on cleanup()', () => {
    const { ctx, serviceRegistry } = makeContext(['services:register', 'services:use', 'commands:register'])

    // Register a mock CommandRegistry as a service
    const mockCmdRegistry = {
      register: vi.fn(),
      unregisterByPlugin: vi.fn(),
    }
    serviceRegistry.register('command-registry', mockCmdRegistry, 'system')

    ctx.registerCommand({ name: 'greet', description: 'Greet', category: 'plugin', handler: async () => ({ type: 'silent' as const }) })
    expect(mockCmdRegistry.register).toHaveBeenCalled()

    ctx.cleanup()
    expect(mockCmdRegistry.unregisterByPlugin).toHaveBeenCalledWith('test-plugin')
  })

  it('does not fail if no CommandRegistry is registered', () => {
    const { ctx, serviceRegistry } = makeContext(['services:register'])
    ctx.registerService('some-svc', {})

    // cleanup should not throw even without command-registry
    expect(() => ctx.cleanup()).not.toThrow()
    expect(serviceRegistry.has('some-svc')).toBe(false)
  })
})
