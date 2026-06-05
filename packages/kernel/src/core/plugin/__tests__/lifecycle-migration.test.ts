import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { LifecycleManager } from '../lifecycle-manager.js'
import type { VibenPlugin, MigrateContext } from '../types.js'
import type { SettingsManager } from '../settings-manager.js'
import type { PluginRegistry, PluginEntry } from '../plugin-registry.js'

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

function mockSettingsManager(settings: Record<string, Record<string, unknown>> = {}): SettingsManager {
  const stored: Record<string, Record<string, unknown>> = { ...settings }
  return {
    basePath: '/tmp/test',
    loadSettings: vi.fn(async (name: string) => stored[name] ?? {}),
    createAPI: vi.fn((name: string) => ({
      get: vi.fn(async (key: string) => (stored[name] ?? {})[key]),
      set: vi.fn(async (key: string, value: unknown) => {
        if (!stored[name]) stored[name] = {}
        stored[name][key] = value
      }),
      getAll: vi.fn(async () => stored[name] ?? {}),
      setAll: vi.fn(async (s: Record<string, unknown>) => { stored[name] = { ...s } }),
      delete: vi.fn(),
      clear: vi.fn(),
      has: vi.fn(),
    })),
    validateSettings: vi.fn(() => ({ valid: true })),
    getSettingsPath: vi.fn((name: string) => `/tmp/test/${name}/settings.json`),
    getPluginSettings: vi.fn(async (name: string) => stored[name] ?? {}),
    updatePluginSettings: vi.fn(),
  } as unknown as SettingsManager
}

function mockPluginRegistry(entries: Record<string, Partial<PluginEntry>> = {}): PluginRegistry {
  const data: Record<string, PluginEntry> = {}
  for (const [name, partial] of Object.entries(entries)) {
    data[name] = {
      version: '1.0.0',
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'builtin',
      enabled: true,
      settingsPath: `/tmp/${name}/settings.json`,
      ...partial,
    }
  }
  return {
    get: vi.fn((name: string) => data[name]),
    list: vi.fn(() => new Map(Object.entries(data))),
    register: vi.fn(),
    remove: vi.fn(),
    setEnabled: vi.fn(),
    updateVersion: vi.fn((name: string, version: string) => {
      if (data[name]) data[name].version = version
    }),
    listEnabled: vi.fn(),
    listBySource: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
  } as unknown as PluginRegistry
}

describe('LifecycleManager — Migration Support', () => {
  it('calls migrate() when version mismatch detected', async () => {
    const migrateFn = vi.fn(async (_ctx: MigrateContext, _old: unknown, _oldVer: string) => ({ migrated: true }))
    const plugin = makePlugin('test-plugin', {
      version: '2.0.0',
      migrate: migrateFn,
    })

    const registry = mockPluginRegistry({ 'test-plugin': { version: '1.0.0' } })
    const settingsMgr = mockSettingsManager({ 'test-plugin': { oldKey: 'oldValue' } })

    const mgr = new LifecycleManager({
      pluginRegistry: registry,
      settingsManager: settingsMgr,
    })
    await mgr.boot([plugin])

    expect(migrateFn).toHaveBeenCalledOnce()
    expect(migrateFn).toHaveBeenCalledWith(
      expect.objectContaining({ pluginName: 'test-plugin' }),
      { oldKey: 'oldValue' },
      '1.0.0',
    )
    expect(registry.updateVersion).toHaveBeenCalledWith('test-plugin', '2.0.0')
    expect(registry.save).toHaveBeenCalled()
    expect(plugin.setup).toHaveBeenCalled()
  })

  it('skips migrate() when no version mismatch', async () => {
    const migrateFn = vi.fn()
    const plugin = makePlugin('test-plugin', {
      version: '1.0.0',
      migrate: migrateFn,
    })

    const registry = mockPluginRegistry({ 'test-plugin': { version: '1.0.0' } })
    const settingsMgr = mockSettingsManager()

    const mgr = new LifecycleManager({
      pluginRegistry: registry,
      settingsManager: settingsMgr,
    })
    await mgr.boot([plugin])

    expect(migrateFn).not.toHaveBeenCalled()
    expect(plugin.setup).toHaveBeenCalled()
  })

  it('skips migrate() when plugin not in registry', async () => {
    const migrateFn = vi.fn()
    const plugin = makePlugin('unknown-plugin', {
      version: '2.0.0',
      migrate: migrateFn,
    })

    const registry = mockPluginRegistry({})
    const settingsMgr = mockSettingsManager()

    const mgr = new LifecycleManager({
      pluginRegistry: registry,
      settingsManager: settingsMgr,
    })
    await mgr.boot([plugin])

    expect(migrateFn).not.toHaveBeenCalled()
    expect(plugin.setup).toHaveBeenCalled()
  })

  it('continues boot if migrate() throws (graceful degradation)', async () => {
    const migrateFn = vi.fn().mockRejectedValue(new Error('migration exploded'))
    const plugin = makePlugin('test-plugin', {
      version: '2.0.0',
      migrate: migrateFn,
    })

    const registry = mockPluginRegistry({ 'test-plugin': { version: '1.0.0' } })
    const settingsMgr = mockSettingsManager()

    const mgr = new LifecycleManager({
      pluginRegistry: registry,
      settingsManager: settingsMgr,
    })
    await mgr.boot([plugin])

    expect(migrateFn).toHaveBeenCalled()
    // setup should still be called despite migration failure
    expect(plugin.setup).toHaveBeenCalled()
    expect(mgr.loadedPlugins).toContain('test-plugin')
  })

  it('reads pluginConfig from settings.json instead of config.json', async () => {
    const plugin = makePlugin('test-plugin', {
      setup: vi.fn(async (ctx) => {
        expect(ctx.pluginConfig).toEqual({ fromSettings: true })
      }),
    })

    const settingsMgr = mockSettingsManager({ 'test-plugin': { fromSettings: true } })

    const mgr = new LifecycleManager({
      settingsManager: settingsMgr,
      config: { get: () => ({ speech: { fromConfig: true } }) } as any,
    })
    await mgr.boot([plugin])

    expect(plugin.setup).toHaveBeenCalled()
  })

  it('skips disabled plugins (setup not called)', async () => {
    const plugin = makePlugin('disabled-plugin')
    const emitEvents: Array<{ event: string; payload: unknown }> = []

    const registry = mockPluginRegistry({ 'disabled-plugin': { enabled: false } })

    const mgr = new LifecycleManager({
      pluginRegistry: registry,
      eventBus: {
        on() {},
        off() {},
        emit(event: string, payload: unknown) { emitEvents.push({ event, payload }) },
      },
    })
    await mgr.boot([plugin])

    expect(plugin.setup).not.toHaveBeenCalled()
    expect(mgr.loadedPlugins).not.toContain('disabled-plugin')
    expect(emitEvents.some(e => e.event === 'plugin:disabled')).toBe(true)
  })
})

describe('LifecycleManager — Settings Validation', () => {
  it('skips plugin when settingsSchema validation fails (setup not called)', async () => {
    const schema = z.object({
      apiKey: z.string().min(1),
      port: z.number().int().positive(),
    })

    const plugin = makePlugin('validated-plugin', {
      settingsSchema: schema,
    })

    // Invalid settings: missing apiKey, port is a string
    const settingsMgr = mockSettingsManager({ 'validated-plugin': { port: 'not-a-number' } })
    // Make validateSettings actually validate against the schema
    ;(settingsMgr.validateSettings as ReturnType<typeof vi.fn>).mockImplementation(
      (_name: string, settings: unknown, s?: z.ZodSchema) => {
        if (!s) return { valid: true }
        const result = s.safeParse(settings)
        if (result.success) return { valid: true }
        return {
          valid: false,
          errors: result.error.errors.map(
            (e: { path: (string | number)[]; message: string }) => `${e.path.join('.')}: ${e.message}`,
          ),
        }
      },
    )

    const emitEvents: Array<{ event: string; payload: unknown }> = []

    const mgr = new LifecycleManager({
      settingsManager: settingsMgr,
      eventBus: {
        on() {},
        off() {},
        emit(event: string, payload: unknown) { emitEvents.push({ event, payload }) },
      },
    })
    await mgr.boot([plugin])

    expect(plugin.setup).not.toHaveBeenCalled()
    expect(mgr.loadedPlugins).not.toContain('validated-plugin')
    expect(mgr.failedPlugins).toContain('validated-plugin')
    expect(emitEvents.some(e => e.event === 'plugin:failed')).toBe(true)
  })

  it('proceeds with setup when settingsSchema validation passes', async () => {
    const schema = z.object({
      apiKey: z.string().min(1),
      port: z.number().int().positive(),
    })

    const plugin = makePlugin('validated-plugin', {
      settingsSchema: schema,
    })

    const settingsMgr = mockSettingsManager({ 'validated-plugin': { apiKey: 'abc123', port: 8080 } })
    ;(settingsMgr.validateSettings as ReturnType<typeof vi.fn>).mockImplementation(
      (_name: string, settings: unknown, s?: z.ZodSchema) => {
        if (!s) return { valid: true }
        const result = s.safeParse(settings)
        if (result.success) return { valid: true }
        return {
          valid: false,
          errors: result.error.errors.map(
            (e: { path: (string | number)[]; message: string }) => `${e.path.join('.')}: ${e.message}`,
          ),
        }
      },
    )

    const mgr = new LifecycleManager({
      settingsManager: settingsMgr,
    })
    await mgr.boot([plugin])

    expect(plugin.setup).toHaveBeenCalled()
    expect(mgr.loadedPlugins).toContain('validated-plugin')
  })

  it('skips validation when plugin has no settingsSchema', async () => {
    const plugin = makePlugin('no-schema-plugin')

    const settingsMgr = mockSettingsManager({ 'no-schema-plugin': { anything: 'goes' } })

    const mgr = new LifecycleManager({
      settingsManager: settingsMgr,
    })
    await mgr.boot([plugin])

    expect(settingsMgr.validateSettings).not.toHaveBeenCalled()
    expect(plugin.setup).toHaveBeenCalled()
    expect(mgr.loadedPlugins).toContain('no-schema-plugin')
  })

  it('skips validation when no settingsManager is available', async () => {
    const schema = z.object({ key: z.string() })
    const plugin = makePlugin('no-mgr-plugin', { settingsSchema: schema })

    const mgr = new LifecycleManager({})
    await mgr.boot([plugin])

    expect(plugin.setup).toHaveBeenCalled()
    expect(mgr.loadedPlugins).toContain('no-mgr-plugin')
  })

  it('validates settings after migration completes', async () => {
    const schema = z.object({
      apiKey: z.string().min(1),
    })

    const migrateFn = vi.fn(async (_ctx: MigrateContext, _old: unknown, _oldVer: string) => ({
      apiKey: '', // Returns invalid settings after migration
    }))

    const plugin = makePlugin('migrate-validate-plugin', {
      version: '2.0.0',
      migrate: migrateFn,
      settingsSchema: schema,
    })

    const registry = mockPluginRegistry({ 'migrate-validate-plugin': { version: '1.0.0' } })
    const settingsMgr = mockSettingsManager({ 'migrate-validate-plugin': { apiKey: '' } })
    ;(settingsMgr.validateSettings as ReturnType<typeof vi.fn>).mockImplementation(
      (_name: string, settings: unknown, s?: z.ZodSchema) => {
        if (!s) return { valid: true }
        const result = s.safeParse(settings)
        if (result.success) return { valid: true }
        return {
          valid: false,
          errors: result.error.errors.map(
            (e: { path: (string | number)[]; message: string }) => `${e.path.join('.')}: ${e.message}`,
          ),
        }
      },
    )

    const mgr = new LifecycleManager({
      pluginRegistry: registry,
      settingsManager: settingsMgr,
    })
    await mgr.boot([plugin])

    expect(migrateFn).toHaveBeenCalled()
    expect(plugin.setup).not.toHaveBeenCalled()
    expect(mgr.failedPlugins).toContain('migrate-validate-plugin')
  })
})
