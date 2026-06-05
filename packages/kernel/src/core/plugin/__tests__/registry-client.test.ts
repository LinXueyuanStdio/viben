import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RegistryClient } from '../registry-client.js'

const mockRegistry = {
  version: 1,
  generatedAt: '2026-03-27T00:00:00Z',
  pluginCount: 3,
  plugins: [
    { name: 'translator', displayName: 'Auto Translator', description: 'Translate messages', npm: '@lucas/translator', version: '1.0.0', minCliVersion: '2026.0326.0', category: 'utility', tags: ['i18n', 'translation'], icon: '🌐', author: 'lucas', repository: 'https://github.com/lucas/translator', license: 'MIT', verified: true, featured: false },
    { name: 'whatsapp', displayName: 'WhatsApp Adapter', description: 'WhatsApp messaging', npm: 'viben-whatsapp', version: '0.1.0', minCliVersion: '2026.0326.0', category: 'adapter', tags: ['whatsapp'], icon: '📱', author: 'dev', repository: 'https://github.com/dev/whatsapp', license: 'MIT', verified: false, featured: true },
    { name: 'auto-approve', description: 'Auto approve permissions', npm: 'viben-auto-approve', version: '2.0.0', minCliVersion: '2026.0326.0', category: 'security', tags: ['permissions'], icon: '✅', author: 'dev2', repository: 'https://github.com/dev2/auto-approve', license: 'MIT', verified: false, featured: false },
  ],
  categories: [
    { id: 'utility', name: 'Utilities', icon: '🔧' },
    { id: 'adapter', name: 'Adapters', icon: '🔌' },
    { id: 'security', name: 'Security', icon: '🔒' },
  ],
}

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('RegistryClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockRegistry,
    })
  })

  it('fetches registry', async () => {
    const client = new RegistryClient('https://test.com/registry.json')
    const registry = await client.getRegistry()
    expect(registry.pluginCount).toBe(3)
    expect(mockFetch).toHaveBeenCalledWith('https://test.com/registry.json')
  })

  it('caches registry for 1 minute', async () => {
    const client = new RegistryClient('https://test.com/registry.json')
    await client.getRegistry()
    await client.getRegistry()
    expect(mockFetch).toHaveBeenCalledTimes(1) // only 1 fetch
  })

  it('search by name', async () => {
    const client = new RegistryClient()
    const results = await client.search('translator')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('translator')
  })

  it('search by description', async () => {
    const client = new RegistryClient()
    const results = await client.search('whatsapp')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('whatsapp')
  })

  it('search by tag', async () => {
    const client = new RegistryClient()
    const results = await client.search('i18n')
    expect(results).toHaveLength(1)
  })

  it('search returns empty for no match', async () => {
    const client = new RegistryClient()
    const results = await client.search('nonexistent')
    expect(results).toHaveLength(0)
  })

  it('resolve returns npm name', async () => {
    const client = new RegistryClient()
    const npm = await client.resolve('translator')
    expect(npm).toBe('@lucas/translator')
  })

  it('resolve returns null for unknown', async () => {
    const client = new RegistryClient()
    const npm = await client.resolve('unknown-plugin')
    expect(npm).toBeNull()
  })

  it('throws on fetch failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })
    const client = new RegistryClient()
    await expect(client.getRegistry()).rejects.toThrow('404')
  })

  it('clearCache forces re-fetch', async () => {
    const client = new RegistryClient('https://test.com/registry.json')
    await client.getRegistry()
    client.clearCache()
    await client.getRegistry()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
