import { describe, it, expect } from 'vitest'
import { createTestContext } from '../testing/test-context.js'
import type { CommandDef, CommandResponse } from '@viben/kernel'

describe('createTestContext', () => {
  it('creates context with required fields', () => {
    const ctx = createTestContext({ pluginName: 'test-plugin' })

    expect(ctx.pluginName).toBe('test-plugin')
    expect(ctx.pluginConfig).toEqual({})
    expect(ctx.registeredServices).toBeInstanceOf(Map)
    expect(ctx.registeredCommands).toBeInstanceOf(Map)
    expect(ctx.registeredMiddleware).toEqual([])
    expect(ctx.emittedEvents).toEqual([])
  })

  it('creates context with custom config', () => {
    const ctx = createTestContext({
      pluginName: 'test-plugin',
      pluginConfig: { key: 'value' },
    })

    expect(ctx.pluginConfig).toEqual({ key: 'value' })
  })

  it('registerService tracks services', () => {
    const ctx = createTestContext({ pluginName: 'test-plugin' })
    const svc = { doStuff: () => 'done' }

    ctx.registerService('my-service', svc)

    expect(ctx.registeredServices.get('my-service')).toBe(svc)
  })

  it('registerCommand tracks commands', () => {
    const ctx = createTestContext({ pluginName: 'test-plugin' })
    const cmd: CommandDef = {
      name: 'hello',
      description: 'Says hello',
      category: 'plugin',
      async handler() { return { type: 'text', text: 'Hello!' } },
    }

    ctx.registerCommand(cmd)

    expect(ctx.registeredCommands.get('hello')).toBe(cmd)
  })

  it('executeCommand dispatches to registered command', async () => {
    const ctx = createTestContext({ pluginName: 'test-plugin' })

    ctx.registerCommand({
      name: 'greet',
      description: 'Greet',
      category: 'plugin',
      async handler(args) {
        return { type: 'text', text: `Hello ${args.raw}` }
      },
    })

    const result = await ctx.executeCommand('greet', { raw: 'world' }) as CommandResponse
    expect(result).toEqual({ type: 'text', text: 'Hello world' })
  })

  it('executeCommand throws for unknown command', async () => {
    const ctx = createTestContext({ pluginName: 'test-plugin' })

    await expect(ctx.executeCommand('nonexistent')).rejects.toThrow('Command not found: nonexistent')
  })

  it('getService returns pre-registered services', () => {
    const svc = { check: () => true }
    const ctx = createTestContext({
      pluginName: 'test-plugin',
      services: { security: svc },
    })

    expect(ctx.getService('security')).toBe(svc)
  })

  it('getService returns undefined for unknown service', () => {
    const ctx = createTestContext({ pluginName: 'test-plugin' })

    expect(ctx.getService('unknown')).toBeUndefined()
  })

  it('storage operations work in-memory', async () => {
    const ctx = createTestContext({ pluginName: 'test-plugin' })

    await ctx.storage.set('key1', { data: 42 })
    expect(await ctx.storage.get('key1')).toEqual({ data: 42 })

    await ctx.storage.set('key2', 'value2')
    const keys = await ctx.storage.list()
    expect(keys).toContain('key1')
    expect(keys).toContain('key2')

    await ctx.storage.delete('key1')
    expect(await ctx.storage.get('key1')).toBeUndefined()
  })

  it('on/emit events', () => {
    const ctx = createTestContext({ pluginName: 'test-plugin' })
    const received: unknown[] = []

    ctx.on('test:event', (payload) => received.push(payload))
    ctx.emit('test:event', { msg: 'hello' })
    ctx.emit('test:event', { msg: 'world' })

    expect(received).toEqual([{ msg: 'hello' }, { msg: 'world' }])
    expect(ctx.emittedEvents).toHaveLength(2)
  })

  it('off removes event handler', () => {
    const ctx = createTestContext({ pluginName: 'test-plugin' })
    const received: unknown[] = []
    const handler = (payload: unknown) => received.push(payload)

    ctx.on('test:event', handler)
    ctx.emit('test:event', 'first')
    ctx.off('test:event', handler)
    ctx.emit('test:event', 'second')

    expect(received).toEqual(['first'])
  })

  it('log methods exist and are silent', () => {
    const ctx = createTestContext({ pluginName: 'test-plugin' })

    // Should not throw
    ctx.log.trace('msg')
    ctx.log.debug('msg')
    ctx.log.info('msg')
    ctx.log.warn('msg')
    ctx.log.error('msg')
    ctx.log.fatal('msg')
    const child = ctx.log.child({ module: 'test' })
    child.info('child msg')
  })

  it('registerMiddleware tracks middleware', () => {
    const ctx = createTestContext({ pluginName: 'test-plugin' })
    const handler = async (payload: unknown, next: () => Promise<unknown>) => next()

    ctx.registerMiddleware('message:incoming' as any, { handler } as any)

    expect(ctx.registeredMiddleware).toHaveLength(1)
    expect(ctx.registeredMiddleware[0].hook).toBe('message:incoming')
  })

  it('sendMessage tracks sent messages', async () => {
    const ctx = createTestContext({ pluginName: 'test-plugin' })

    await ctx.sendMessage('session-1', { type: 'text', text: 'hello' })

    expect(ctx.sentMessages).toHaveLength(1)
    expect(ctx.sentMessages[0]).toEqual({
      sessionId: 'session-1',
      content: { type: 'text', text: 'hello' },
    })
  })
})
