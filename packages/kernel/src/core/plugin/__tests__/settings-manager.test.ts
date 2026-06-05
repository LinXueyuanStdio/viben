import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { SettingsManager } from '../settings-manager.js'

describe('SettingsManager', () => {
  let tmpDir: string
  let manager: SettingsManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-manager-'))
    manager = new SettingsManager(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('createAPI returns a SettingsAPI scoped to plugin name', () => {
    const api = manager.createAPI('my-plugin')
    expect(api).toBeDefined()
    expect(api.get).toBeTypeOf('function')
    expect(api.set).toBeTypeOf('function')
    expect(api.getAll).toBeTypeOf('function')
    expect(api.setAll).toBeTypeOf('function')
    expect(api.delete).toBeTypeOf('function')
    expect(api.clear).toBeTypeOf('function')
    expect(api.has).toBeTypeOf('function')
  })

  it('get returns undefined for missing key', async () => {
    const api = manager.createAPI('my-plugin')
    expect(await api.get('missing')).toBeUndefined()
  })

  it('set and get round-trip', async () => {
    const api = manager.createAPI('my-plugin')
    await api.set('theme', 'dark')
    expect(await api.get('theme')).toBe('dark')
  })

  it('setAll replaces all settings', async () => {
    const api = manager.createAPI('my-plugin')
    await api.set('a', 1)
    await api.set('b', 2)
    await api.setAll({ c: 3 })
    expect(await api.get('a')).toBeUndefined()
    expect(await api.get('b')).toBeUndefined()
    expect(await api.get('c')).toBe(3)
  })

  it('getAll returns all settings', async () => {
    const api = manager.createAPI('my-plugin')
    await api.set('x', 10)
    await api.set('y', 20)
    expect(await api.getAll()).toEqual({ x: 10, y: 20 })
  })

  it('getAll returns empty object when no settings', async () => {
    const api = manager.createAPI('my-plugin')
    expect(await api.getAll()).toEqual({})
  })

  it('delete removes a key', async () => {
    const api = manager.createAPI('my-plugin')
    await api.set('key', 'value')
    await api.delete('key')
    expect(await api.get('key')).toBeUndefined()
  })

  it('clear removes all settings', async () => {
    const api = manager.createAPI('my-plugin')
    await api.set('a', 1)
    await api.set('b', 2)
    await api.clear()
    expect(await api.getAll()).toEqual({})
  })

  it('has returns true for existing key, false for missing', async () => {
    const api = manager.createAPI('my-plugin')
    await api.set('exists', true)
    expect(await api.has('exists')).toBe(true)
    expect(await api.has('missing')).toBe(false)
  })

  it('persists to disk across manager instances', async () => {
    const api = manager.createAPI('my-plugin')
    await api.set('persist', 'yes')

    const manager2 = new SettingsManager(tmpDir)
    const api2 = manager2.createAPI('my-plugin')
    expect(await api2.get('persist')).toBe('yes')
  })

  it('isolates settings between plugins', async () => {
    const apiA = manager.createAPI('plugin-a')
    const apiB = manager.createAPI('plugin-b')

    await apiA.set('key', 'from-a')
    await apiB.set('key', 'from-b')

    expect(await apiA.get('key')).toBe('from-a')
    expect(await apiB.get('key')).toBe('from-b')
  })

  it('loadSettings returns empty object when no file', async () => {
    const settings = await manager.loadSettings('nonexistent')
    expect(settings).toEqual({})
  })

  it('loadSettings returns saved settings', async () => {
    const api = manager.createAPI('my-plugin')
    await api.set('loaded', true)

    const settings = await manager.loadSettings('my-plugin')
    expect(settings).toEqual({ loaded: true })
  })

  it('validateSettings returns valid for correct settings', () => {
    const schema = z.object({
      port: z.number(),
      host: z.string(),
    })
    const result = manager.validateSettings('my-plugin', { port: 3000, host: 'localhost' }, schema)
    expect(result.valid).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('validateSettings returns invalid for incorrect settings', () => {
    const schema = z.object({
      port: z.number(),
      host: z.string(),
    })
    const result = manager.validateSettings('my-plugin', { port: 'not-a-number', host: 123 }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors!.length).toBeGreaterThan(0)
  })

  it('validateSettings returns valid when no schema', () => {
    const result = manager.validateSettings('my-plugin', { anything: 'goes' })
    expect(result.valid).toBe(true)
  })

  it('getSettingsPath returns correct path for scoped package', () => {
    const settingsPath = manager.getSettingsPath('@viben/adapter-discord')
    expect(settingsPath).toBe(path.join(tmpDir, '@viben/adapter-discord', 'settings.json'))
  })
})
