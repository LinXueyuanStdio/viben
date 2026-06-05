import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { SettingsManager } from '../settings-manager.js'
import { PluginRegistry } from '../plugin-registry.js'
import type { VibenPlugin, InstallContext, MigrateContext } from '../types.js'

vi.mock('../terminal-io.js', () => ({
  createTerminalIO: vi.fn(() => ({
    text: vi.fn().mockResolvedValue('test-value'),
    select: vi.fn().mockResolvedValue('option1'),
    confirm: vi.fn().mockResolvedValue(true),
    password: vi.fn().mockResolvedValue('secret-token'),
    multiselect: vi.fn().mockResolvedValue(['a']),
    log: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn(), step: vi.fn() },
    spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), fail: vi.fn() })),
    note: vi.fn(),
    cancel: vi.fn(),
  })),
}))

function createTestPlugin(overrides?: Partial<VibenPlugin>): VibenPlugin {
  return {
    name: '@viben/test-integration',
    version: '1.0.0',
    permissions: [],

    async setup(_ctx) {
      // no-op for integration test
    },

    async install(ctx: InstallContext) {
      await ctx.settings.set('apiKey', 'key-from-install')
      await ctx.settings.set('region', 'us-east')
    },

    async configure(ctx: InstallContext) {
      await ctx.settings.set('region', 'eu-west')
    },

    async migrate(_ctx: MigrateContext, oldSettings: unknown, _oldVersion: string) {
      const old = oldSettings as Record<string, unknown>
      const migrated: Record<string, unknown> = { ...old }
      // Rename apiKey → apiKeyV2
      if ('apiKey' in migrated) {
        migrated.apiKeyV2 = migrated.apiKey
        delete migrated.apiKey
      }
      // Add newField
      migrated.newField = 'added-by-migration'
      return migrated
    },

    async uninstall(ctx: InstallContext, opts: { purge: boolean }) {
      if (opts.purge) {
        await ctx.settings.clear()
      }
    },

    ...overrides,
  }
}

describe('Plugin Setup Integration — full lifecycle', () => {
  let tmpDir: string
  let settingsManager: SettingsManager
  let registry: PluginRegistry

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-setup-int-'))
    settingsManager = new SettingsManager(tmpDir)
    registry = new PluginRegistry(path.join(tmpDir, 'registry.json'))
    await registry.load()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('full install → configure → migrate → uninstall cycle', async () => {
    const { createInstallContext } = await import('../install-context.js')
    const plugin = createTestPlugin()
    const pluginName = plugin.name

    // Step 1: Install — verify settings saved
    const installCtx = createInstallContext({
      pluginName,
      settingsManager,
      basePath: tmpDir,
    })
    await plugin.install!(installCtx)

    const afterInstall = await settingsManager.loadSettings(pluginName)
    expect(afterInstall).toEqual({ apiKey: 'key-from-install', region: 'us-east' })

    // Step 2: Register in PluginRegistry — verify
    registry.register(pluginName, {
      version: plugin.version,
      source: 'npm',
      enabled: true,
      settingsPath: settingsManager.getSettingsPath(pluginName),
    })
    await registry.save()

    const entry = registry.get(pluginName)
    expect(entry).toBeDefined()
    expect(entry!.version).toBe('1.0.0')
    expect(entry!.enabled).toBe(true)
    expect(entry!.source).toBe('npm')

    // Reload registry from disk to verify persistence
    const reloadedRegistry = new PluginRegistry(path.join(tmpDir, 'registry.json'))
    await reloadedRegistry.load()
    expect(reloadedRegistry.get(pluginName)).toBeDefined()
    expect(reloadedRegistry.get(pluginName)!.version).toBe('1.0.0')

    // Step 3: Configure — verify settings modified
    const configureCtx = createInstallContext({
      pluginName,
      settingsManager,
      basePath: tmpDir,
    })
    await plugin.configure!(configureCtx)

    const afterConfigure = await settingsManager.loadSettings(pluginName)
    expect(afterConfigure.apiKey).toBe('key-from-install')
    expect(afterConfigure.region).toBe('eu-west')

    // Step 4: Simulate migration (version bump)
    // Old settings before migration
    const oldSettings = await settingsManager.loadSettings(pluginName)
    const oldVersion = '1.0.0'

    const migrateSettingsApi = settingsManager.createAPI(pluginName)
    const migrateCtx: MigrateContext = {
      pluginName,
      settings: migrateSettingsApi,
      log: installCtx.log,
    }

    const migrated = await plugin.migrate!(migrateCtx, oldSettings, oldVersion)
    // Write migrated settings back
    await migrateSettingsApi.setAll(migrated as Record<string, unknown>)

    const afterMigrate = await settingsManager.loadSettings(pluginName)
    expect(afterMigrate.apiKey).toBeUndefined()
    expect(afterMigrate.apiKeyV2).toBe('key-from-install')
    expect(afterMigrate.region).toBe('eu-west')
    expect(afterMigrate.newField).toBe('added-by-migration')

    // Update registry version
    registry.updateVersion(pluginName, '2.0.0')
    await registry.save()
    expect(registry.get(pluginName)!.version).toBe('2.0.0')

    // Step 5: Uninstall (purge: false) — settings still exist
    const uninstallCtx = createInstallContext({
      pluginName,
      settingsManager,
      basePath: tmpDir,
    })
    await plugin.uninstall!(uninstallCtx, { purge: false })

    const afterSoftUninstall = await settingsManager.loadSettings(pluginName)
    expect(Object.keys(afterSoftUninstall).length).toBeGreaterThan(0)
    expect(afterSoftUninstall.apiKeyV2).toBe('key-from-install')

    // Step 6: Uninstall (purge: true) — settings cleared
    const purgeCtx = createInstallContext({
      pluginName,
      settingsManager,
      basePath: tmpDir,
    })
    await plugin.uninstall!(purgeCtx, { purge: true })

    const afterPurge = await settingsManager.loadSettings(pluginName)
    expect(afterPurge).toEqual({})

    // Remove from registry
    registry.remove(pluginName)
    await registry.save()
    expect(registry.get(pluginName)).toBeUndefined()
  })

})
