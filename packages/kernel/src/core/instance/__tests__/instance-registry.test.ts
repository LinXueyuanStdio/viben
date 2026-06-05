import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InstanceRegistry } from '../instance-registry.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('InstanceRegistry', () => {
  let tmpDir: string
  let registryPath: string
  let registry: InstanceRegistry

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `test-registry-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    registryPath = path.join(tmpDir, 'instances.json')
    registry = new InstanceRegistry(registryPath)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('starts empty when no file exists', async () => {
    await registry.load()
    expect(registry.list()).toEqual([])
  })

  it('registers and lists instances', async () => {
    await registry.load()
    registry.register('main', '/home/user/.viben')
    registry.register('my-project', '/home/user/project/.viben')
    expect(registry.list()).toEqual([
      { id: 'main', root: '/home/user/.viben' },
      { id: 'my-project', root: '/home/user/project/.viben' },
    ])
  })

  it('persists to disk and reloads', async () => {
    await registry.load()
    registry.register('main', '/home/user/.viben')
    await registry.save()
    const registry2 = new InstanceRegistry(registryPath)
    await registry2.load()
    expect(registry2.list()).toEqual([
      { id: 'main', root: '/home/user/.viben' },
    ])
  })

  it('removes an instance by id', async () => {
    await registry.load()
    registry.register('main', '/home/user/.viben')
    registry.register('other', '/tmp/.viben')
    registry.remove('other')
    expect(registry.list()).toEqual([
      { id: 'main', root: '/home/user/.viben' },
    ])
  })

  it('finds instance by id', async () => {
    await registry.load()
    registry.register('main', '/home/user/.viben')
    expect(registry.get('main')).toEqual({ id: 'main', root: '/home/user/.viben' })
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('finds instance by root path', async () => {
    await registry.load()
    registry.register('main', '/home/user/.viben')
    expect(registry.getByRoot('/home/user/.viben')).toEqual({ id: 'main', root: '/home/user/.viben' })
    expect(registry.getByRoot('/nonexistent')).toBeUndefined()
  })

  it('generates unique id when collision exists', async () => {
    await registry.load()
    registry.register('main', '/a/.viben')
    const uniqueId = registry.uniqueId('main')
    expect(uniqueId).toBe('main-2')
  })

  it('increments suffix until unique', async () => {
    await registry.load()
    registry.register('main', '/a/.viben')
    registry.register('main-2', '/b/.viben')
    expect(registry.uniqueId('main')).toBe('main-3')
  })

  it('returns id as-is when no collision', async () => {
    await registry.load()
    expect(registry.uniqueId('my-project')).toBe('my-project')
  })
})
