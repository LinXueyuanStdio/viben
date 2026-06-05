import { describe, it, expect } from 'vitest'
import { builtInPlugins } from '../index.js'

describe('Built-in plugin wrappers', () => {
  it('exports all 8 built-in plugins', () => {
    expect(builtInPlugins).toHaveLength(8)
  })

  it('all plugins have name, version, setup', () => {
    for (const plugin of builtInPlugins) {
      expect(typeof plugin.name).toBe('string')
      expect(plugin.name.startsWith('@viben/')).toBe(true)
      expect(typeof plugin.version).toBe('string')
      expect(typeof plugin.setup).toBe('function')
    }
  })

  it('all plugins have permissions array', () => {
    for (const plugin of builtInPlugins) {
      expect(Array.isArray(plugin.permissions)).toBe(true)
    }
  })

  it('has expected plugin names', () => {
    const names = builtInPlugins.map(p => p.name)
    expect(names).toContain('@viben/security')
    expect(names).toContain('@viben/file-service')
    expect(names).toContain('@viben/notifications')
    expect(names).toContain('@viben/speech')
    expect(names).toContain('@viben/context')
    expect(names).toContain('@viben/tunnel')
    expect(names).toContain('@viben/api-server')
    expect(names).toContain('@viben/telegram')
  })

  it('adapter plugins depend on security and notifications', () => {
    const adapters = builtInPlugins.filter(p =>
      ['@viben/telegram'].includes(p.name)
    )
    for (const adapter of adapters) {
      expect(adapter.pluginDependencies).toBeDefined()
      expect(adapter.pluginDependencies?.['@viben/security']).toBeDefined()
      expect(adapter.pluginDependencies?.['@viben/notifications']).toBeDefined()
    }
  })

  it('notifications depends on security', () => {
    const notif = builtInPlugins.find(p => p.name === '@viben/notifications')
    expect(notif?.pluginDependencies?.['@viben/security']).toBeDefined()
  })
})
