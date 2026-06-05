import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CommandRegistry } from '../command-registry.js'
import type { CommandDef, CommandArgs, CommandResponse } from '../plugin/types.js'

function makeDef(overrides: Partial<CommandDef> = {}): CommandDef {
  return {
    name: overrides.name ?? 'test',
    description: overrides.description ?? 'A test command',
    category: overrides.category ?? 'plugin',
    pluginName: overrides.pluginName,
    handler: overrides.handler ?? vi.fn(async () => ({ type: 'text' as const, text: 'ok' })),
  }
}

function makeArgs(overrides: Partial<CommandArgs> = {}): CommandArgs {
  return {
    raw: overrides.raw ?? '',
    sessionId: overrides.sessionId ?? 'sess-1',
    channelId: overrides.channelId ?? 'telegram',
    userId: overrides.userId ?? 'user-1',
    reply: overrides.reply ?? vi.fn(async () => {}),
    options: overrides.options,
    coreAccess: overrides.coreAccess,
  }
}

describe('CommandRegistry', () => {
  let registry: CommandRegistry

  beforeEach(() => {
    registry = new CommandRegistry()
  })

  // 1. register and get
  it('registers and retrieves a command', () => {
    const def = makeDef({ name: 'hello', category: 'system' })
    registry.register(def)
    const found = registry.get('hello')
    expect(found).toBeDefined()
    expect(found!.name).toBe('hello')
    expect(found!.category).toBe('system')
  })

  // 2. get returns undefined for unregistered
  it('returns undefined for unregistered command', () => {
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  // 3. unregister
  it('unregister removes a command', () => {
    registry.register(makeDef({ name: 'bye' }))
    expect(registry.get('bye')).toBeDefined()
    registry.unregister('bye')
    expect(registry.get('bye')).toBeUndefined()
  })

  // 4. unregisterByPlugin
  it('unregisterByPlugin removes all commands from a plugin', () => {
    registry.register(makeDef({ name: 'cmd1', pluginName: '@viben/foo' }), '@viben/foo')
    registry.register(makeDef({ name: 'cmd2', pluginName: '@viben/foo' }), '@viben/foo')
    registry.register(makeDef({ name: 'cmd3', pluginName: '@viben/bar' }), '@viben/bar')

    registry.unregisterByPlugin('@viben/foo')

    expect(registry.get('cmd1')).toBeUndefined()
    expect(registry.get('cmd2')).toBeUndefined()
    expect(registry.get('cmd3')).toBeDefined()
  })

  // 5. getAll returns all commands (deduplicated)
  it('getAll returns all commands deduplicated', () => {
    registry.register(makeDef({ name: 'alpha', category: 'system' }))
    registry.register(makeDef({ name: 'beta', pluginName: '@viben/plug' }), '@viben/plug')

    const all = registry.getAll()
    const names = all.map((c) => c.name)
    // Should contain each unique command once
    expect(names).toContain('alpha')
    expect(names).toContain('beta')
    // No duplicates: even though qualified name also exists in map, getAll deduplicates
    const uniqueNames = new Set(all.map((c) => c.name))
    expect(uniqueNames.size).toBe(all.length)
  })

  // 6. getByCategory
  it('getByCategory filters by system/plugin', () => {
    registry.register(makeDef({ name: 'sys1', category: 'system' }))
    registry.register(makeDef({ name: 'plug1', category: 'plugin', pluginName: '@viben/x' }), '@viben/x')

    const systemCmds = registry.getByCategory('system')
    const pluginCmds = registry.getByCategory('plugin')

    expect(systemCmds.every((c) => c.category === 'system')).toBe(true)
    expect(pluginCmds.every((c) => c.category === 'plugin')).toBe(true)
    expect(systemCmds.map((c) => c.name)).toContain('sys1')
    expect(pluginCmds.map((c) => c.name)).toContain('plug1')
  })

  // 7. Namespace: system commands own short name — plugin with same name gets qualified only
  it('system commands own short name; plugin with same name gets qualified only', () => {
    registry.register(makeDef({ name: 'help', category: 'system' }))
    registry.register(makeDef({ name: 'help', category: 'plugin', pluginName: '@viben/helper' }), '@viben/helper')

    // Short name resolves to system command
    const short = registry.get('help')
    expect(short).toBeDefined()
    expect(short!.category).toBe('system')

    // Plugin command reachable via qualified name
    const qualified = registry.get('helper:help')
    expect(qualified).toBeDefined()
    expect(qualified!.pluginName).toBe('@viben/helper')
  })

  // 8. Namespace: first plugin wins short name
  it('first plugin wins short name', () => {
    registry.register(makeDef({ name: 'stats', pluginName: '@viben/usage' }), '@viben/usage')
    registry.register(makeDef({ name: 'stats', pluginName: '@viben/analytics' }), '@viben/analytics')

    // Short name goes to first registrant
    const short = registry.get('stats')
    expect(short).toBeDefined()
    expect(short!.pluginName).toBe('@viben/usage')

    // Second plugin only via qualified name
    const qualified = registry.get('analytics:stats')
    expect(qualified).toBeDefined()
    expect(qualified!.pluginName).toBe('@viben/analytics')
  })

  // 9. Namespace: qualified names always work
  it('qualified names always work', () => {
    registry.register(makeDef({ name: 'info', pluginName: '@viben/speech' }), '@viben/speech')

    expect(registry.get('speech:info')).toBeDefined()
    // Short name also works when no conflict
    expect(registry.get('info')).toBeDefined()
  })

  // 10. execute: dispatches command and returns response
  it('execute dispatches command and returns response', async () => {
    const handler = vi.fn(async () => ({ type: 'text' as const, text: 'hello world' }))
    registry.register(makeDef({ name: 'greet', handler }))

    const result = await registry.execute('/greet some args', makeArgs({ raw: 'some args' }))

    expect(result).toEqual({ type: 'text', text: 'hello world' })
    expect(handler).toHaveBeenCalledOnce()
    // The args passed to handler should have raw = 'some args'
    const callArgs = handler.mock.calls[0] as unknown as [CommandArgs]
    expect(callArgs[0].raw).toBe('some args')
  })

  // 11. execute: returns error for unknown command
  it('execute returns error for unknown command', async () => {
    const result = await registry.execute('/unknown', makeArgs())

    expect(result).toEqual({ type: 'error', message: expect.stringContaining('unknown') })
  })

  // 12. execute: returns error when handler throws
  it('execute returns error when handler throws', async () => {
    const handler = vi.fn(async () => {
      throw new Error('boom')
    })
    registry.register(makeDef({ name: 'fail', handler }))

    const result = await registry.execute('/fail', makeArgs())

    expect(result.type).toBe('error')
    expect((result as { type: 'error'; message: string }).message).toContain('boom')
  })

  // 13. execute: treats void return as delegated
  it('execute treats void return as delegated', async () => {
    const handler = vi.fn(async () => {
      // returns void
    })
    registry.register(makeDef({ name: 'quiet', handler }))

    const result = await registry.execute('/quiet', makeArgs())

    expect(result).toEqual({ type: 'delegated' })
  })

  // 13b. unregister by qualified name removes both qualified and short name
  it('unregister by qualified name removes both qualified and short name', () => {
    registry.register(makeDef({ name: 'notify', pluginName: '@viben/alerts' }), '@viben/alerts')

    // Both short and qualified should be resolvable before unregister
    expect(registry.get('notify')).toBeDefined()
    expect(registry.get('alerts:notify')).toBeDefined()

    // Unregister using the qualified name
    registry.unregister('alerts:notify')

    // Both should now be gone
    expect(registry.get('alerts:notify')).toBeUndefined()
    expect(registry.get('notify')).toBeUndefined()
  })

  // 14. execute: prefers adapter-specific handler when channelId matches pluginName
  it('execute prefers adapter-specific handler when channelId matches pluginName', async () => {
    const defaultHandler = vi.fn(async () => ({ type: 'text' as const, text: 'default' }))
    const telegramHandler = vi.fn(async () => ({ type: 'text' as const, text: 'telegram-specific' }))

    registry.register(makeDef({ name: 'menu', handler: defaultHandler }))
    registry.register(
      makeDef({ name: 'menu', handler: telegramHandler, pluginName: '@viben/telegram' }),
      '@viben/telegram',
    )

    // When channelId is 'telegram', the adapter override should be used
    const result = await registry.execute('/menu', makeArgs({ channelId: 'telegram' }))
    expect(result).toEqual({ type: 'text', text: 'telegram-specific' })
    expect(telegramHandler).toHaveBeenCalledOnce()
    expect(defaultHandler).not.toHaveBeenCalled()

    // When channelId is 'discord', the default should be used
    const result2 = await registry.execute('/menu', makeArgs({ channelId: 'discord' }))
    expect(result2).toEqual({ type: 'text', text: 'default' })
  })
})
