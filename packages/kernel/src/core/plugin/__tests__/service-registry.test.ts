import { describe, it, expect } from 'vitest'
import { ServiceRegistry } from '../service-registry.js'

describe('ServiceRegistry', () => {
  it('registers and retrieves a service', () => {
    const reg = new ServiceRegistry()
    reg.register('security', { checkAccess: () => true }, '@viben/security')
    expect(reg.get('security')).toBeDefined()
    expect(reg.has('security')).toBe(true)
  })

  it('returns undefined for unregistered service', () => {
    const reg = new ServiceRegistry()
    expect(reg.get('nonexistent')).toBeUndefined()
    expect(reg.has('nonexistent')).toBe(false)
  })

  it('throws on duplicate registration without override', () => {
    const reg = new ServiceRegistry()
    reg.register('security', {}, '@viben/security')
    expect(() => reg.register('security', {}, '@community/other')).toThrow()
  })

  it('lists all registered services', () => {
    const reg = new ServiceRegistry()
    reg.register('a', {}, 'plugin-a')
    reg.register('b', {}, 'plugin-b')
    const list = reg.list()
    expect(list).toHaveLength(2)
    expect(list.map(s => s.name)).toContain('a')
  })

  it('unregisters a service', () => {
    const reg = new ServiceRegistry()
    reg.register('a', {}, 'plugin-a')
    reg.unregister('a')
    expect(reg.has('a')).toBe(false)
  })

  it('allows override when using registerOverride', () => {
    const reg = new ServiceRegistry()
    reg.register('security', { v: 1 }, '@viben/security')
    reg.registerOverride('security', { v: 2 }, '@community/custom-security')
    expect(reg.get<{ v: number }>('security')?.v).toBe(2)
  })

  it('unregister on non-existent is no-op', () => {
    const reg = new ServiceRegistry()
    expect(() => reg.unregister('nonexistent')).not.toThrow()
  })
})
