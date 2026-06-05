import { describe, it, expect, afterEach, vi } from 'vitest'
import { createApiServer } from '../server.js'
import { TokenStore } from '../auth/token-store.js'
import { pluginRoutes } from '../routes/plugins.js'
import type { RouteDeps } from '../routes/types.js'
import type { LifecycleManager } from '../../../core/plugin/lifecycle-manager.js'
import type { PluginRegistry, PluginEntry } from '../../../core/plugin/plugin-registry.js'
import type { VibenPlugin } from '../../../core/plugin/types.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// Mock registry-client to avoid real network calls
vi.mock('../../../core/plugin/registry-client.js', () => ({
  RegistryClient: class {
    async getRegistry() {
      return {
        plugins: [
          {
            name: '@viben/translator',
            npm: '@viben/translator',
            displayName: 'Translator',
            description: 'Translation plugin',
            version: '1.0.0',
            minCliVersion: '0.0.0',
            category: 'productivity',
            tags: ['translate'],
            icon: '🌐',
            author: 'Viben',
            verified: true,
            featured: false,
          },
        ],
        categories: [{ id: 'productivity', name: 'Productivity', icon: '⚡' }],
      }
    }
  },
}))

const SECRET = 'b'.repeat(64)
const JWT_SECRET = 'plugin-test-jwt-secret'

function authHeaders() {
  return { authorization: `Bearer ${SECRET}` }
}

function makeRegistry(entries: Record<string, Partial<PluginEntry>>): PluginRegistry {
  return {
    list: () => new Map(Object.entries(entries).map(([name, e]) => [name, {
      version: '1.0.0',
      installedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      source: 'builtin' as const,
      enabled: true,
      settingsPath: '/tmp/settings.json',
      ...e,
    }])),
    get: (name: string) => {
      const e = entries[name]
      if (!e) return undefined
      return {
        version: '1.0.0',
        installedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        source: 'builtin' as const,
        enabled: true,
        settingsPath: '/tmp/settings.json',
        ...e,
      }
    },
    load: async () => {},
    setEnabled: () => {},
    remove: () => {},
    save: async () => {},
    register: () => {},
  } as unknown as PluginRegistry
}

function makeLifecycleManager(opts: {
  registryEntries?: Record<string, Partial<PluginEntry>>
  loadedPlugins?: string[]
  failedPlugins?: string[]
  pluginDefs?: VibenPlugin[]
  instanceRoot?: string
  bootFn?: (plugins: VibenPlugin[]) => Promise<void>
  unloadFn?: (name: string) => Promise<void>
}): LifecycleManager {
  return {
    registry: makeRegistry(opts.registryEntries ?? {}),
    loadedPlugins: opts.loadedPlugins ?? [],
    failedPlugins: opts.failedPlugins ?? [],
    plugins: opts.pluginDefs ?? [],
    instanceRoot: opts.instanceRoot,
    boot: opts.bootFn ?? (async () => {}),
    unloadPlugin: opts.unloadFn ?? (async () => {}),
  } as unknown as LifecycleManager
}

describe('plugin routes', () => {
  let server: Awaited<ReturnType<typeof createApiServer>> | null = null
  let tokenStore: TokenStore
  let tmpDir: string

  async function buildServer(lm: LifecycleManager) {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-routes-test-'))
    const tokensFile = path.join(tmpDir, 'tokens.json')
    tokenStore = new TokenStore(tokensFile)
    await tokenStore.load()

    server = await createApiServer({
      port: 0,
      host: '127.0.0.1',
      getSecret: () => SECRET,
      getJwtSecret: () => JWT_SECRET,
      tokenStore,
    })

    const deps: Partial<RouteDeps> = {
      lifecycleManager: lm,
    }

    server.registerPlugin('/api/v1/plugins', async (app) => {
      await pluginRoutes(app, deps as RouteDeps)
    })

    await server.app.ready()
  }

  afterEach(async () => {
    if (server) {
      await server.app.close()
      server = null
    }
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('GET /api/v1/plugins', () => {
    it('returns installed plugins with runtime state', async () => {
      const lm = makeLifecycleManager({
        registryEntries: {
          '@viben/telegram': { source: 'builtin', enabled: true },
          '@viben/translator': { source: 'npm', enabled: false },
        },
        loadedPlugins: ['@viben/telegram'],
        failedPlugins: [],
        pluginDefs: [
          { name: '@viben/telegram', version: '1.0.0', essential: true, configure: async () => {}, setup: async () => {} } as unknown as VibenPlugin,
        ],
      })
      await buildServer(lm)

      const res = await server!.app.inject({
        method: 'GET',
        url: '/api/v1/plugins',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.plugins).toHaveLength(2)

      const telegram = body.plugins.find((p: any) => p.name === '@viben/telegram')
      expect(telegram).toMatchObject({
        name: '@viben/telegram',
        source: 'builtin',
        enabled: true,
        loaded: true,
        failed: false,
        essential: true,
        hasConfigure: true,
      })

      const translator = body.plugins.find((p: any) => p.name === '@viben/translator')
      expect(translator).toMatchObject({
        name: '@viben/translator',
        source: 'npm',
        enabled: false,
        loaded: false,
        failed: false,
        essential: false,
        hasConfigure: false,
      })
    })

    it('returns 401 without auth', async () => {
      await buildServer(makeLifecycleManager({}))
      const res = await server!.app.inject({ method: 'GET', url: '/api/v1/plugins' })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /api/v1/plugins/:name/enable', () => {
    it('enables and boots a disabled builtin plugin', async () => {
      let booted: string[] = []
      let registryEnabled: Record<string, boolean> = {}

      const lm = makeLifecycleManager({
        registryEntries: {
          '@viben/context': { source: 'builtin', enabled: false },
        },
        loadedPlugins: [],
        pluginDefs: [],
        bootFn: async (plugins) => { booted = plugins.map(p => p.name) },
      })
      ;(lm.registry as any).setEnabled = (name: string, val: boolean) => { registryEnabled[name] = val }

      await buildServer(lm)

      const res = await server!.app.inject({
        method: 'POST',
        url: '/api/v1/plugins/@viben%2Fcontext/enable',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ ok: true })
      expect(booted).toContain('@viben/context')
      expect(registryEnabled['@viben/context']).toBe(true)
    })

    it('is idempotent when plugin is already loaded', async () => {
      const lm = makeLifecycleManager({
        registryEntries: {
          '@viben/context': { source: 'builtin', enabled: true },
        },
        loadedPlugins: ['@viben/context'],
      })

      await buildServer(lm)

      const res = await server!.app.inject({
        method: 'POST',
        url: '/api/v1/plugins/@viben%2Fcontext/enable',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(200)
    })

    it('returns 404 for unknown plugin', async () => {
      await buildServer(makeLifecycleManager({}))

      const res = await server!.app.inject({
        method: 'POST',
        url: '/api/v1/plugins/@viben%2Funknown/enable',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('POST /api/v1/plugins/:name/disable', () => {
    it('unloads and disables a loaded plugin', async () => {
      let unloaded: string[] = []

      const lm = makeLifecycleManager({
        registryEntries: {
          '@viben/context': { source: 'builtin', enabled: true },
        },
        loadedPlugins: ['@viben/context'],
        pluginDefs: [
          { name: '@viben/context', version: '1.0.0', essential: false, setup: async () => {} } as unknown as VibenPlugin,
        ],
        unloadFn: async (name) => { unloaded.push(name) },
      })

      await buildServer(lm)

      const res = await server!.app.inject({
        method: 'POST',
        url: '/api/v1/plugins/@viben%2Fcontext/disable',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ ok: true })
      expect(unloaded).toContain('@viben/context')
    })

    it('returns 409 for essential plugin', async () => {
      const lm = makeLifecycleManager({
        registryEntries: {
          '@viben/telegram': { source: 'builtin', enabled: true },
        },
        loadedPlugins: ['@viben/telegram'],
        pluginDefs: [
          { name: '@viben/telegram', version: '1.0.0', essential: true, setup: async () => {} } as unknown as VibenPlugin,
        ],
      })

      await buildServer(lm)

      const res = await server!.app.inject({
        method: 'POST',
        url: '/api/v1/plugins/@viben%2Ftelegram/disable',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(409)
      expect(JSON.parse(res.body).error).toContain('Essential')
    })

    it('returns 404 for unknown plugin', async () => {
      await buildServer(makeLifecycleManager({}))

      const res = await server!.app.inject({
        method: 'POST',
        url: '/api/v1/plugins/@viben%2Funknown/disable',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/v1/plugins/:name', () => {
    it('unloads and removes an npm plugin', async () => {
      let unloaded: string[] = []
      let removed: string[] = []

      const lm = makeLifecycleManager({
        registryEntries: {
          '@viben/translator': { source: 'npm', enabled: true },
        },
        loadedPlugins: ['@viben/translator'],
        unloadFn: async (name) => { unloaded.push(name) },
      })
      ;(lm.registry as any).remove = (name: string) => { removed.push(name) }

      await buildServer(lm)

      const res = await server!.app.inject({
        method: 'DELETE',
        url: '/api/v1/plugins/@viben%2Ftranslator',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ ok: true })
      expect(unloaded).toContain('@viben/translator')
      expect(removed).toContain('@viben/translator')
    })

    it('returns 400 for builtin plugin', async () => {
      const lm = makeLifecycleManager({
        registryEntries: {
          '@viben/telegram': { source: 'builtin', enabled: true },
        },
      })

      await buildServer(lm)

      const res = await server!.app.inject({
        method: 'DELETE',
        url: '/api/v1/plugins/@viben%2Ftelegram',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toContain('Builtin')
    })

    it('returns 404 for unknown plugin', async () => {
      await buildServer(makeLifecycleManager({}))

      const res = await server!.app.inject({
        method: 'DELETE',
        url: '/api/v1/plugins/@viben%2Funknown',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('GET /api/v1/plugins/marketplace', () => {
    it('returns marketplace plugins with installed flag', async () => {
      const lm = makeLifecycleManager({
        registryEntries: {
          '@viben/telegram': { source: 'builtin', enabled: true },
        },
      })
      await buildServer(lm)

      const res = await server!.app.inject({
        method: 'GET',
        url: '/api/v1/plugins/marketplace',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.plugins).toHaveLength(1)
      expect(body.plugins[0]).toMatchObject({
        name: '@viben/translator',
        installed: false,  // not in registry
      })
      expect(body.categories).toHaveLength(1)
    })

    it('returns 503 when registry fetch fails', async () => {
      // Override the mock for this specific test to throw
      const { RegistryClient } = await import('../../../core/plugin/registry-client.js')
      vi.spyOn(RegistryClient.prototype, 'getRegistry').mockRejectedValueOnce(new Error('Network error'))

      const lm = makeLifecycleManager({})
      await buildServer(lm)

      const res = await server!.app.inject({
        method: 'GET',
        url: '/api/v1/plugins/marketplace',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(503)
      expect(JSON.parse(res.body)).toMatchObject({ error: 'Marketplace unavailable' })
    })

    it('returns 401 without auth', async () => {
      await buildServer(makeLifecycleManager({}))
      const res = await server!.app.inject({ method: 'GET', url: '/api/v1/plugins/marketplace' })
      expect(res.statusCode).toBe(401)
    })
  })
})
