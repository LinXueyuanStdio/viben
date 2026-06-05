import { describe, it, expect } from 'vitest'
import { PluginFieldRegistry } from '../plugin-field-registry.js'
import type { FieldDef } from '../types.js'

describe('PluginFieldRegistry', () => {
  it('registers fields for a plugin', () => {
    const registry = new PluginFieldRegistry()
    const fields: FieldDef[] = [
      { key: 'botToken', displayName: 'Bot Token', type: 'string', scope: 'sensitive' },
      { key: 'chatId', displayName: 'Chat ID', type: 'number', scope: 'safe' },
    ]
    registry.register('@viben/telegram', fields)
    expect(registry.getForPlugin('@viben/telegram')).toEqual(fields)
  })

  it('returns empty array for unknown plugin', () => {
    const registry = new PluginFieldRegistry()
    expect(registry.getForPlugin('@viben/unknown')).toEqual([])
  })

  it('overwrites previous registration for same plugin', () => {
    const registry = new PluginFieldRegistry()
    registry.register('@viben/test', [{ key: 'a', displayName: 'A', type: 'string', scope: 'safe' }])
    registry.register('@viben/test', [{ key: 'b', displayName: 'B', type: 'toggle', scope: 'safe' }])
    expect(registry.getForPlugin('@viben/test')).toHaveLength(1)
    expect(registry.getForPlugin('@viben/test')[0]!.key).toBe('b')
  })

  it('getAll returns map of all registered plugins', () => {
    const registry = new PluginFieldRegistry()
    registry.register('@viben/a', [{ key: 'x', displayName: 'X', type: 'string', scope: 'safe' }])
    registry.register('@viben/b', [{ key: 'y', displayName: 'Y', type: 'toggle', scope: 'safe' }])
    const all = registry.getAll()
    expect(all.size).toBe(2)
    expect(all.has('@viben/a')).toBe(true)
    expect(all.has('@viben/b')).toBe(true)
  })
})
