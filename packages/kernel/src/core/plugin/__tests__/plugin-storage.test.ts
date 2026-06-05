import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PluginStorageImpl } from '../plugin-storage.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('PluginStorage', () => {
  let tmpDir: string
  let storage: PluginStorageImpl

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-storage-'))
    storage = new PluginStorageImpl(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('get returns undefined for missing key', async () => {
    expect(await storage.get('missing')).toBeUndefined()
  })

  it('set and get round-trip', async () => {
    await storage.set('key', { foo: 'bar' })
    expect(await storage.get('key')).toEqual({ foo: 'bar' })
  })

  it('delete removes key', async () => {
    await storage.set('key', 'value')
    await storage.delete('key')
    expect(await storage.get('key')).toBeUndefined()
  })

  it('list returns all keys', async () => {
    await storage.set('a', 1)
    await storage.set('b', 2)
    const keys = await storage.list()
    expect(keys.sort()).toEqual(['a', 'b'])
  })

  it('getDataDir returns and creates directory', () => {
    const dir = storage.getDataDir()
    expect(fs.existsSync(dir)).toBe(true)
  })

  it('persists across instances', async () => {
    await storage.set('key', 'value')
    const storage2 = new PluginStorageImpl(tmpDir)
    expect(await storage2.get('key')).toBe('value')
  })

  it('handles concurrent writes safely', async () => {
    await Promise.all([
      storage.set('a', 1),
      storage.set('b', 2),
      storage.set('c', 3),
    ])
    expect(await storage.get('a')).toBe(1)
    expect(await storage.get('b')).toBe(2)
    expect(await storage.get('c')).toBe(3)
  })

  it('creates base directory if it does not exist, allowing set() without ENOENT', async () => {
    const nonExistentDir = path.join(os.tmpdir(), `plugin-storage-new-${Date.now()}`)
    try {
      const s = new PluginStorageImpl(nonExistentDir)
      await expect(s.set('key', 'value')).resolves.not.toThrow()
      expect(await s.get('key')).toBe('value')
    } finally {
      fs.rmSync(nonExistentDir, { recursive: true, force: true })
    }
  })
})
