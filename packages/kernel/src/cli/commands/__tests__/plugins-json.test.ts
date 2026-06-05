import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

describe('plugins --json', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-plugins-test-'))
    fs.writeFileSync(path.join(tmpDir, 'plugins.json'), JSON.stringify({
      installed: {
        'telegram': { version: '1.0.0', enabled: true, source: 'builtin', description: 'Telegram adapter', installedAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', settingsPath: '' },
      },
    }))
    vi.resetModules()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('outputs JSON with plugins array', async () => {
    const { cmdPlugins } = await import('../plugins.js')
    const result = await captureJsonOutput(async () => {
      await cmdPlugins(['--json'], tmpDir)
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('plugins')
    expect(Array.isArray(data.plugins)).toBe(true)
  })

  it('includes all required fields in each plugin entry', async () => {
    const { cmdPlugins } = await import('../plugins.js')
    const result = await captureJsonOutput(async () => {
      await cmdPlugins(['--json'], tmpDir)
    })
    const data = expectValidJsonSuccess(result.stdout)
    const plugins = data.plugins as Record<string, unknown>[]
    expect(plugins.length).toBe(1)
    const plugin = plugins[0]
    expect(plugin).toHaveProperty('name', 'telegram')
    expect(plugin).toHaveProperty('version', '1.0.0')
    expect(plugin).toHaveProperty('enabled', true)
    expect(plugin).toHaveProperty('source', 'builtin')
    expect(plugin).toHaveProperty('description', 'Telegram adapter')
  })

  it('outputs empty array when no plugins installed', async () => {
    fs.writeFileSync(path.join(tmpDir, 'plugins.json'), JSON.stringify({ installed: {} }))
    const { cmdPlugins } = await import('../plugins.js')
    const result = await captureJsonOutput(async () => {
      await cmdPlugins(['--json'], tmpDir)
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data.plugins).toEqual([])
  })
})

describe('plugin enable/disable --json', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-plugin-toggle-'))
    fs.writeFileSync(path.join(tmpDir, 'plugins.json'), JSON.stringify({
      installed: {
        'telegram': { version: '1.0.0', enabled: true, source: 'builtin', description: 'Telegram adapter', installedAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', settingsPath: '' },
      },
    }))
    vi.resetModules()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('outputs JSON when disabling a plugin', async () => {
    const { cmdPlugin } = await import('../plugins.js')
    const result = await captureJsonOutput(async () => {
      await cmdPlugin(['disable', 'telegram', '--json'], tmpDir)
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toEqual({ plugin: 'telegram', enabled: false })
  })

  it('outputs JSON when enabling a plugin', async () => {
    const { cmdPlugin } = await import('../plugins.js')
    const result = await captureJsonOutput(async () => {
      await cmdPlugin(['enable', 'telegram', '--json'], tmpDir)
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toEqual({ plugin: 'telegram', enabled: true })
  })

  it('outputs JSON error for unknown plugin', async () => {
    const { cmdPlugin } = await import('../plugins.js')
    const result = await captureJsonOutput(async () => {
      await cmdPlugin(['enable', 'nonexistent', '--json'], tmpDir)
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'PLUGIN_NOT_FOUND')
  })

  it('outputs JSON error when disabling unknown plugin', async () => {
    const { cmdPlugin } = await import('../plugins.js')
    const result = await captureJsonOutput(async () => {
      await cmdPlugin(['disable', 'nonexistent', '--json'], tmpDir)
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'PLUGIN_NOT_FOUND')
  })
})
