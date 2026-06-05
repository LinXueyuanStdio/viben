import { describe, it, expect } from 'vitest'
import { CommandRegistry } from '../../command-registry.js'
import { registerSystemCommands } from '../index.js'

describe('System Commands', () => {
  function createRegistry() {
    const registry = new CommandRegistry()
    const mockCore = {
      agentCatalog: { getAvailable: () => [{ name: 'claude', key: 'claude', installed: true }] },
    }
    registerSystemCommands(registry, mockCore)
    return registry
  }

  it('registers all system commands', () => {
    const registry = createRegistry()
    const all = registry.getByCategory('system')
    expect(all.length).toBeGreaterThanOrEqual(10)

    const names = all.map((c) => c.name)
    expect(names).toContain('new')
    expect(names).toContain('cancel')
    expect(names).toContain('status')
    expect(names).toContain('sessions')
    expect(names).toContain('help')
    expect(names).toContain('menu')
    expect(names).toContain('agents')
    expect(names).toContain('restart')
    expect(names).toContain('doctor')
  })

  it('/help returns text with all commands listed', async () => {
    const registry = createRegistry()
    const response = await registry.execute('/help', {
      sessionId: null,
      channelId: 'test',
      userId: '1',
      raw: '',
      reply: async () => {},
    })
    expect(response.type).toBe('text')
    if (response.type === 'text') {
      // Should contain references to system commands
      expect(response.text).toContain('/new')
      expect(response.text).toContain('/cancel')
      expect(response.text).toContain('/status')
      expect(response.text).toContain('/menu')
      expect(response.text).toContain('/agents')
    }
  })

  it('/menu returns menu', async () => {
    const registry = createRegistry()
    const response = await registry.execute('/menu', {
      sessionId: null,
      channelId: 'test',
      userId: '1',
      raw: '',
      reply: async () => {},
    })
    expect(response.type).toBe('menu')
    if (response.type === 'menu') {
      expect(response.options.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('/cancel returns error when no core access', async () => {
    const registry = createRegistry()
    const response = await registry.execute('/cancel', {
      sessionId: null,
      channelId: 'test',
      userId: '1',
      raw: '',
      reply: async () => {},
    })
    expect(response.type).toBe('error')
  })

  it('/status returns error when no core access', async () => {
    const registry = createRegistry()
    const response = await registry.execute('/status', {
      sessionId: null,
      channelId: 'test',
      userId: '1',
      raw: '',
      reply: async () => {},
    })
    expect(response.type).toBe('error')
  })

  it('/agents returns text', async () => {
    const registry = createRegistry()
    const response = await registry.execute('/agents', {
      sessionId: null,
      channelId: 'test',
      userId: '1',
      raw: '',
      reply: async () => {},
    })
    expect(response.type).toBe('text')
  })

  it('/help with unknown command returns error', async () => {
    const registry = createRegistry()
    const response = await registry.execute('/help nonexistent', {
      sessionId: null,
      channelId: 'test',
      userId: '1',
      raw: '',
      reply: async () => {},
    })
    expect(response.type).toBe('error')
  })

  it('unknown command returns error', async () => {
    const registry = createRegistry()
    const response = await registry.execute('/doesnotexist', {
      sessionId: null,
      channelId: 'test',
      userId: '1',
      raw: '',
      reply: async () => {},
    })
    expect(response.type).toBe('error')
    if (response.type === 'error') {
      expect(response.message).toContain('doesnotexist')
    }
  })
})
