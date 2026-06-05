import { describe, it, expect } from 'vitest'
import { createTestInstallContext } from '../testing/test-install-context.js'
import { mockServices } from '../testing/mock-services.js'

describe('createTestInstallContext', () => {
  it('creates context with required fields', () => {
    const ctx = createTestInstallContext({ pluginName: 'test-plugin' })

    expect(ctx.pluginName).toBe('test-plugin')
    expect(ctx.terminal).toBeDefined()
    expect(ctx.settings).toBeDefined()
    expect(ctx.dataDir).toBeTruthy()
    expect(ctx.log).toBeDefined()
  })

  it('auto-answers terminal prompts', async () => {
    const ctx = createTestInstallContext({
      pluginName: 'test-plugin',
      terminalResponses: {
        text: ['my-token'],
        confirm: [true],
        select: ['option-a'],
      },
    })

    const text = await ctx.terminal.text({ message: 'Enter token:' })
    expect(text).toBe('my-token')

    const confirmed = await ctx.terminal.confirm({ message: 'Continue?' })
    expect(confirmed).toBe(true)

    const selected = await ctx.terminal.select({
      message: 'Pick one',
      options: [{ value: 'option-a', label: 'A' }],
    })
    expect(selected).toBe('option-a')
  })

  it('sequential answers for multiple calls', async () => {
    const ctx = createTestInstallContext({
      pluginName: 'test-plugin',
      terminalResponses: {
        text: ['first', 'second', 'third'],
      },
    })

    expect(await ctx.terminal.text({ message: 'Q1' })).toBe('first')
    expect(await ctx.terminal.text({ message: 'Q2' })).toBe('second')
    expect(await ctx.terminal.text({ message: 'Q3' })).toBe('third')
    // After exhaustion, returns default
    expect(await ctx.terminal.text({ message: 'Q4' })).toBe('')
  })

  it('settings persist in memory', async () => {
    const ctx = createTestInstallContext({ pluginName: 'test-plugin' })

    await ctx.settings.set('key1', 'value1')
    await ctx.settings.set('key2', 42)

    expect(await ctx.settings.get('key1')).toBe('value1')
    expect(await ctx.settings.get('key2')).toBe(42)
    expect(await ctx.settings.has('key1')).toBe(true)
    expect(await ctx.settings.has('nonexistent')).toBe(false)

    const all = await ctx.settings.getAll()
    expect(all).toEqual({ key1: 'value1', key2: 42 })

    await ctx.settings.delete('key1')
    expect(await ctx.settings.has('key1')).toBe(false)

    await ctx.settings.clear()
    expect(await ctx.settings.getAll()).toEqual({})
  })

  it('passes legacyConfig', () => {
    const legacy = { botToken: 'old-token', chatId: '123' }
    const ctx = createTestInstallContext({
      pluginName: 'test-plugin',
      legacyConfig: legacy,
    })

    expect(ctx.legacyConfig).toBe(legacy)
  })

  it('legacyConfig is undefined when not provided', () => {
    const ctx = createTestInstallContext({ pluginName: 'test-plugin' })
    expect(ctx.legacyConfig).toBeUndefined()
  })

  it('tracks terminal calls', async () => {
    const ctx = createTestInstallContext({
      pluginName: 'test-plugin',
      terminalResponses: {
        text: ['answer'],
        confirm: [true],
      },
    })

    await ctx.terminal.text({ message: 'Name?' })
    await ctx.terminal.confirm({ message: 'Sure?' })

    expect(ctx.terminalCalls).toHaveLength(2)
    expect(ctx.terminalCalls[0].method).toBe('text')
    expect(ctx.terminalCalls[0].args).toEqual({ message: 'Name?' })
    expect(ctx.terminalCalls[1].method).toBe('confirm')
    expect(ctx.terminalCalls[1].args).toEqual({ message: 'Sure?' })
  })

  it('terminal log methods are silent', () => {
    const ctx = createTestInstallContext({ pluginName: 'test-plugin' })

    // Should not throw
    ctx.terminal.log.info('info')
    ctx.terminal.log.success('success')
    ctx.terminal.log.warning('warning')
    ctx.terminal.log.error('error')
    ctx.terminal.log.step('step')
  })

  it('terminal spinner is silent', () => {
    const ctx = createTestInstallContext({ pluginName: 'test-plugin' })
    const spinner = ctx.terminal.spinner()

    // Should not throw
    spinner.start('loading...')
    spinner.stop('done')
    spinner.fail('oops')
  })

  it('settings setAll replaces all data', async () => {
    const ctx = createTestInstallContext({ pluginName: 'test-plugin' })

    await ctx.settings.set('old', 'value')
    await ctx.settings.setAll({ new1: 'a', new2: 'b' })

    expect(await ctx.settings.has('old')).toBe(false)
    expect(await ctx.settings.get('new1')).toBe('a')
    expect(await ctx.settings.get('new2')).toBe('b')
  })
})

describe('mockServices', () => {
  it('security returns sensible defaults', async () => {
    const svc = mockServices.security()
    const result = await svc.checkAccess('user-1')
    expect(result.allowed).toBe(true)
    expect(await svc.getUserRole('user-1')).toBe('user')
  })

  it('security accepts overrides', async () => {
    const svc = mockServices.security({
      async checkAccess() { return { allowed: false, reason: 'blocked' } },
    })
    const result = await svc.checkAccess('user-1')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('blocked')
  })

  it('fileService returns mock attachment', async () => {
    const svc = mockServices.fileService()
    const att = await svc.saveFile('s1', 'test.txt', Buffer.from('hi'), 'text/plain')
    expect(att.fileName).toBe('test.txt')
    expect(att.mimeType).toBe('text/plain')
  })

  it('notifications has callable methods', async () => {
    const svc = mockServices.notifications()
    // Should not throw
    await svc.notify('ch1', { sessionId: 's1', type: 'completed', summary: 'done' })
    await svc.notifyAll({ sessionId: 's1', type: 'error', summary: 'oops' })
  })

  it('usage returns ok budget by default', async () => {
    const svc = mockServices.usage()
    const budget = await svc.checkBudget('s1')
    expect(budget.ok).toBe(true)
  })

  it('speech has callable methods', async () => {
    const svc = mockServices.speech()
    const buf = await svc.textToSpeech('hello')
    expect(buf).toBeInstanceOf(Buffer)
    const text = await svc.speechToText(Buffer.alloc(0))
    expect(text).toBe('')
  })

  it('tunnel returns localhost URLs', () => {
    const svc = mockServices.tunnel()
    expect(svc.getPublicUrl()).toContain('localhost')
    expect(svc.fileUrl('abc')).toContain('abc')
    expect(svc.diffUrl('abc')).toContain('abc')
  })

  it('context returns empty string', async () => {
    const svc = mockServices.context()
    const result = await svc.buildContext('s1')
    expect(result).toBe('')
  })
})
