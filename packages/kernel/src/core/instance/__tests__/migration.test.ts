import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('migrateGlobalInstance', () => {
  let tmpDir: string
  let fakeHome: string
  let globalRoot: string

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `test-migration-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    fakeHome = path.join(tmpDir, 'home')
    globalRoot = path.join(fakeHome, '.viben')
    fs.mkdirSync(globalRoot, { recursive: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function mockHomedir() {
    vi.spyOn(os, 'homedir').mockReturnValue(fakeHome)
  }

  async function runMigration() {
    // Re-import to pick up mocked homedir
    const { migrateGlobalInstance } = await import('../migration.js')
    return migrateGlobalInstance()
  }

  it('returns null when ~/.viben/config.json does not exist', async () => {
    mockHomedir()
    // globalRoot exists but no config.json
    const result = await runMigration()
    expect(result).toBeNull()
  })

  it('migrates instance files to <baseDir>/.viben/', async () => {
    mockHomedir()
    const baseDir = path.join(tmpDir, 'workspace')

    // Create global instance files
    fs.writeFileSync(path.join(globalRoot, 'config.json'), JSON.stringify({
      workspace: { baseDir },
    }))
    fs.writeFileSync(path.join(globalRoot, 'sessions.json'), '[]')
    fs.writeFileSync(path.join(globalRoot, 'agents.json'), '{}')
    fs.writeFileSync(path.join(globalRoot, 'api-secret'), 'secret123')

    const result = await runMigration()
    const targetRoot = path.join(baseDir, '.viben')

    expect(result).toBe(targetRoot)
    expect(fs.existsSync(path.join(targetRoot, 'config.json'))).toBe(true)
    expect(fs.existsSync(path.join(targetRoot, 'sessions.json'))).toBe(true)
    expect(fs.existsSync(path.join(targetRoot, 'agents.json'))).toBe(true)
    expect(fs.existsSync(path.join(targetRoot, 'api-secret'))).toBe(true)
    expect(fs.readFileSync(path.join(targetRoot, 'api-secret'), 'utf-8')).toBe('secret123')

    // Source files should be removed
    expect(fs.existsSync(path.join(globalRoot, 'sessions.json'))).toBe(false)
    expect(fs.existsSync(path.join(globalRoot, 'agents.json'))).toBe(false)
    expect(fs.existsSync(path.join(globalRoot, 'api-secret'))).toBe(false)
  })

  it('uses config.workspace.baseDir as target directory', async () => {
    mockHomedir()
    const customBase = path.join(tmpDir, 'custom-workspace')

    fs.writeFileSync(path.join(globalRoot, 'config.json'), JSON.stringify({
      workspace: { baseDir: customBase },
    }))

    const result = await runMigration()
    expect(result).toBe(path.join(customBase, '.viben'))
    expect(fs.existsSync(path.join(customBase, '.viben', 'config.json'))).toBe(true)
  })

  it('falls back to ~/viben-workspace when baseDir missing in config', async () => {
    mockHomedir()

    fs.writeFileSync(path.join(globalRoot, 'config.json'), JSON.stringify({
      someOtherKey: true,
    }))

    const result = await runMigration()
    const expectedTarget = path.join(fakeHome, 'viben-workspace', '.viben')
    expect(result).toBe(expectedTarget)
    expect(fs.existsSync(path.join(expectedTarget, 'config.json'))).toBe(true)
  })

  it('strips workspace.baseDir from migrated config.json', async () => {
    mockHomedir()
    const baseDir = path.join(tmpDir, 'workspace')

    fs.writeFileSync(path.join(globalRoot, 'config.json'), JSON.stringify({
      workspace: { baseDir, otherSetting: true },
      adapters: { telegram: {} },
    }))

    const result = await runMigration()
    const migratedConfig = JSON.parse(fs.readFileSync(path.join(result!, 'config.json'), 'utf-8'))

    expect(migratedConfig.workspace?.baseDir).toBeUndefined()
    expect(migratedConfig.workspace?.otherSetting).toBe(true)
    expect(migratedConfig.adapters?.telegram).toBeDefined()
  })

  it('updates instances.json registry (old root -> new root)', async () => {
    mockHomedir()
    const baseDir = path.join(tmpDir, 'workspace')
    const registryPath = path.join(globalRoot, 'instances.json')

    // Pre-populate registry with old global entry
    fs.writeFileSync(registryPath, JSON.stringify({
      version: 1,
      instances: {
        'main': { id: 'main', root: globalRoot },
      },
    }))

    fs.writeFileSync(path.join(globalRoot, 'config.json'), JSON.stringify({
      workspace: { baseDir },
    }))

    const result = await runMigration()
    const targetRoot = path.join(baseDir, '.viben')

    // Registry should now point to the new root
    const updatedRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'))
    const entries = Object.values(updatedRegistry.instances) as Array<{ id: string; root: string }>
    expect(entries).toHaveLength(1)
    expect(entries[0]!.id).toBe('main')
    expect(entries[0]!.root).toBe(targetRoot)
  })

  it('keeps shared files (instances.json, bin/, agents/) in ~/.viben', async () => {
    mockHomedir()
    const baseDir = path.join(tmpDir, 'workspace')

    // Create shared files that should NOT be moved
    fs.writeFileSync(path.join(globalRoot, 'instances.json'), '{}')
    fs.mkdirSync(path.join(globalRoot, 'bin'), { recursive: true })
    fs.writeFileSync(path.join(globalRoot, 'bin', 'some-binary'), 'binary')
    fs.mkdirSync(path.join(globalRoot, 'agents'), { recursive: true })
    fs.writeFileSync(path.join(globalRoot, 'agents', 'claude.json'), '{}')

    fs.writeFileSync(path.join(globalRoot, 'config.json'), JSON.stringify({
      workspace: { baseDir },
    }))

    await runMigration()

    // Shared files should still exist in global root
    expect(fs.existsSync(path.join(globalRoot, 'instances.json'))).toBe(true)
    expect(fs.existsSync(path.join(globalRoot, 'bin', 'some-binary'))).toBe(true)
    expect(fs.existsSync(path.join(globalRoot, 'agents', 'claude.json'))).toBe(true)
  })

  it('overwrites existing target files', async () => {
    mockHomedir()
    const baseDir = path.join(tmpDir, 'workspace')
    const targetRoot = path.join(baseDir, '.viben')

    // Create existing target with old data
    fs.mkdirSync(targetRoot, { recursive: true })
    fs.writeFileSync(path.join(targetRoot, 'sessions.json'), '"old-data"')

    // Create source
    fs.writeFileSync(path.join(globalRoot, 'config.json'), JSON.stringify({
      workspace: { baseDir },
    }))
    fs.writeFileSync(path.join(globalRoot, 'sessions.json'), '"new-data"')

    await runMigration()

    // Target should have new data
    expect(fs.readFileSync(path.join(targetRoot, 'sessions.json'), 'utf-8')).toBe('"new-data"')
  })

  it('preserves registry-cache.json in global cache during cache migration', async () => {
    mockHomedir()
    const baseDir = path.join(tmpDir, 'workspace')

    // Create cache with registry-cache.json and other files
    fs.mkdirSync(path.join(globalRoot, 'cache'), { recursive: true })
    fs.writeFileSync(path.join(globalRoot, 'cache', 'registry-cache.json'), '{"cached": true}')
    fs.writeFileSync(path.join(globalRoot, 'cache', 'other-cache.json'), '{"other": true}')

    fs.writeFileSync(path.join(globalRoot, 'config.json'), JSON.stringify({
      workspace: { baseDir },
    }))

    await runMigration()

    const targetRoot = path.join(baseDir, '.viben')

    // registry-cache.json should remain in global cache
    expect(fs.existsSync(path.join(globalRoot, 'cache', 'registry-cache.json'))).toBe(true)
    expect(fs.readFileSync(path.join(globalRoot, 'cache', 'registry-cache.json'), 'utf-8')).toBe('{"cached": true}')

    // other cache files should be moved to target
    expect(fs.existsSync(path.join(targetRoot, 'cache', 'other-cache.json'))).toBe(true)
    expect(fs.readFileSync(path.join(targetRoot, 'cache', 'other-cache.json'), 'utf-8')).toBe('{"other": true}')

    // other cache files should be removed from source
    expect(fs.existsSync(path.join(globalRoot, 'cache', 'other-cache.json'))).toBe(false)
  })

  it('migrates directories (plugins, logs, history, files)', async () => {
    mockHomedir()
    const baseDir = path.join(tmpDir, 'workspace')

    // Create instance directories
    fs.mkdirSync(path.join(globalRoot, 'plugins', 'my-plugin'), { recursive: true })
    fs.writeFileSync(path.join(globalRoot, 'plugins', 'my-plugin', 'index.js'), 'module.exports = {}')
    fs.mkdirSync(path.join(globalRoot, 'logs'), { recursive: true })
    fs.writeFileSync(path.join(globalRoot, 'logs', 'app.log'), 'log data')

    fs.writeFileSync(path.join(globalRoot, 'config.json'), JSON.stringify({
      workspace: { baseDir },
    }))

    await runMigration()

    const targetRoot = path.join(baseDir, '.viben')
    expect(fs.existsSync(path.join(targetRoot, 'plugins', 'my-plugin', 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(targetRoot, 'logs', 'app.log'))).toBe(true)

    // Source dirs should be removed
    expect(fs.existsSync(path.join(globalRoot, 'plugins'))).toBe(false)
    expect(fs.existsSync(path.join(globalRoot, 'logs'))).toBe(false)
  })
})
