import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PluginStorageImpl } from '../plugin/plugin-storage.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let tmpDir: string
let storage: PluginStorageImpl

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-storage-test-'))
  storage = new PluginStorageImpl(tmpDir)
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('keys(prefix)', () => {
  it('returns all keys when no prefix given', async () => {
    await storage.set('a', 1)
    await storage.set('b', 2)
    const keys = await storage.keys()
    expect(keys.sort()).toEqual(['a', 'b'])
  })

  it('filters by prefix', async () => {
    await storage.set('users/alice', 1)
    await storage.set('users/bob', 2)
    await storage.set('config', 3)
    const keys = await storage.keys('users/')
    expect(keys.sort()).toEqual(['users/alice', 'users/bob'])
  })
})

describe('clear()', () => {
  it('deletes all keys', async () => {
    await storage.set('a', 1)
    await storage.set('b', 2)
    await storage.clear()
    expect(await storage.list()).toEqual([])
  })
})

describe('forSession(sessionId)', () => {
  it('returns isolated storage for the session', async () => {
    const s1 = storage.forSession('sess-1')
    const s2 = storage.forSession('sess-2')
    await s1.set('key', 'value-1')
    await s2.set('key', 'value-2')
    expect(await s1.get('key')).toBe('value-1')
    expect(await s2.get('key')).toBe('value-2')
    // Global storage unaffected
    expect(await storage.get('key')).toBeUndefined()
  })

  it('clear() on session storage does not affect global or other sessions', async () => {
    await storage.set('global', 'data')
    const s1 = storage.forSession('sess-1')
    const s2 = storage.forSession('sess-2')
    await s1.set('local', 'data')
    await s2.set('local', 'data2')
    await s1.clear()
    expect(await storage.get('global')).toBe('data')
    expect(await s1.get('local')).toBeUndefined()
    expect(await s2.get('local')).toBe('data2')
  })

  it('list() only returns session-scoped keys (without prefix)', async () => {
    const s = storage.forSession('sess-1')
    await s.set('a', 1)
    await s.set('b', 2)
    const keys = await s.list()
    expect(keys.sort()).toEqual(['a', 'b'])
    // Global storage should see prefixed keys
    const globalKeys = await storage.keys('session:sess-1:')
    expect(globalKeys.length).toBe(2)
  })

  it('keys(prefix) works within session scope', async () => {
    const s = storage.forSession('sess-1')
    await s.set('messages/t1', { text: 'hello' })
    await s.set('messages/t2', { text: 'world' })
    await s.set('session', { type: 'solo' })
    const keys = await s.keys('messages/')
    expect(keys.sort()).toEqual(['messages/t1', 'messages/t2'])
  })
})
