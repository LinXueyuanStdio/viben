import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { SettingsManager } from '../settings-manager.js'

vi.mock('../terminal-io.js', () => ({
  createTerminalIO: vi.fn(() => ({
    text: vi.fn(),
    select: vi.fn(),
    confirm: vi.fn(),
    password: vi.fn(),
    multiselect: vi.fn(),
    log: {
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      step: vi.fn(),
    },
    spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), fail: vi.fn() })),
    note: vi.fn(),
    cancel: vi.fn(),
  })),
}))

describe('createInstallContext', () => {
  let tmpDir: string
  let settingsManager: SettingsManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-context-'))
    settingsManager = new SettingsManager(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('creates context with all required fields', async () => {
    const { createInstallContext } = await import('../install-context.js')

    const ctx = createInstallContext({
      pluginName: '@viben/test-plugin',
      settingsManager,
      basePath: tmpDir,
    })

    expect(ctx.pluginName).toBe('@viben/test-plugin')
    expect(ctx.terminal).toBeDefined()
    expect(ctx.terminal.text).toBeTypeOf('function')
    expect(ctx.terminal.select).toBeTypeOf('function')
    expect(ctx.settings).toBeDefined()
    expect(ctx.settings.get).toBeTypeOf('function')
    expect(ctx.settings.set).toBeTypeOf('function')
    expect(ctx.dataDir).toBeTypeOf('string')
    expect(ctx.log).toBeDefined()
    expect(ctx.log.info).toBeTypeOf('function')
    expect(ctx.log.child).toBeTypeOf('function')
  })

  it('settings API is scoped to the plugin', async () => {
    const { createInstallContext } = await import('../install-context.js')

    const ctx = createInstallContext({
      pluginName: 'scoped-plugin',
      settingsManager,
      basePath: tmpDir,
    })

    // Write via the context's settings API
    await ctx.settings.set('key1', 'value1')
    await ctx.settings.set('key2', 42)

    // Verify via settingsManager.loadSettings (reads from disk)
    const loaded = await settingsManager.loadSettings('scoped-plugin')
    expect(loaded.key1).toBe('value1')
    expect(loaded.key2).toBe(42)
  })

  it('dataDir path includes plugin name and data', async () => {
    const { createInstallContext } = await import('../install-context.js')

    const ctx = createInstallContext({
      pluginName: 'my-plugin',
      settingsManager,
      basePath: tmpDir,
    })

    expect(ctx.dataDir).toBe(path.join(tmpDir, 'my-plugin', 'data'))
  })

  it('does not expose legacyConfig on the context', async () => {
    const { createInstallContext } = await import('../install-context.js')

    const ctx = createInstallContext({
      pluginName: '@viben/test-plugin',
      settingsManager,
      basePath: tmpDir,
    })

    expect('legacyConfig' in ctx).toBe(false)
  })
})
