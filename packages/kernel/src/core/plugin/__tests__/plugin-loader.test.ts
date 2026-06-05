import { describe, it, expect } from 'vitest'
import { resolveLoadOrder, computeChecksum, verifyChecksum } from '../plugin-loader.js'
import type { VibenPlugin } from '../types.js'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

function makePlugin(name: string, opts: Partial<VibenPlugin> = {}): VibenPlugin {
  return {
    name,
    version: '1.0.0',
    setup: async () => {},
    ...opts,
  }
}

describe('resolveLoadOrder', () => {
  it('resolves load order with no dependencies', () => {
    const plugins = [makePlugin('a'), makePlugin('b'), makePlugin('c')]
    const order = resolveLoadOrder(plugins)
    expect(order.map((p) => p.name)).toEqual(['a', 'b', 'c'])
  })

  it('deps loaded first', () => {
    const plugins = [
      makePlugin('app', { pluginDependencies: { db: '1.0.0' } }),
      makePlugin('db'),
    ]
    const order = resolveLoadOrder(plugins)
    const names = order.map((p) => p.name)
    expect(names.indexOf('db')).toBeLessThan(names.indexOf('app'))
  })

  it('detects circular dependencies', () => {
    const plugins = [
      makePlugin('a', { pluginDependencies: { b: '1.0.0' } }),
      makePlugin('b', { pluginDependencies: { a: '1.0.0' } }),
    ]
    expect(() => resolveLoadOrder(plugins)).toThrow(/[Cc]ircular/)
  })

  it('handles missing dependencies — skips plugin + dependents', () => {
    const plugins = [
      makePlugin('a', { pluginDependencies: { missing: '1.0.0' } }),
      makePlugin('b', { pluginDependencies: { a: '1.0.0' } }),
      makePlugin('c'),
    ]
    const order = resolveLoadOrder(plugins)
    const names = order.map((p) => p.name)
    expect(names).toEqual(['c'])
  })

  it('override — overridden plugin excluded', () => {
    const plugins = [
      makePlugin('builtin-auth', {}),
      makePlugin('custom-auth', { overrides: 'builtin-auth' }),
    ]
    const order = resolveLoadOrder(plugins)
    const names = order.map((p) => p.name)
    expect(names).toContain('custom-auth')
    expect(names).not.toContain('builtin-auth')
  })

  it('multi-level dependency chain', () => {
    const plugins = [
      makePlugin('d', { pluginDependencies: { c: '1.0.0' } }),
      makePlugin('c', { pluginDependencies: { b: '1.0.0' } }),
      makePlugin('b', { pluginDependencies: { a: '1.0.0' } }),
      makePlugin('a'),
    ]
    const order = resolveLoadOrder(plugins)
    const names = order.map((p) => p.name)
    expect(names).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('computeChecksum', () => {
  const tmpBase = join(tmpdir(), 'plugin-loader-test-' + Date.now())

  it('returns 64-char hex string', () => {
    mkdirSync(tmpBase, { recursive: true })
    const filePath = join(tmpBase, 'test-file.txt')
    writeFileSync(filePath, 'hello world')
    const checksum = computeChecksum(filePath)
    expect(checksum).toMatch(/^[0-9a-f]{64}$/)
    rmSync(tmpBase, { recursive: true, force: true })
  })
})

describe('verifyChecksum', () => {
  it('matches when expected equals actual', () => {
    const hash = 'a'.repeat(64)
    expect(verifyChecksum('test-plugin', hash, hash)).toBe(true)
  })

  it('mismatches when expected differs from actual', () => {
    expect(verifyChecksum('test-plugin', 'a'.repeat(64), 'b'.repeat(64))).toBe(false)
  })
})
