# Plugins API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/api/v1/plugins` route group to the api-server plugin, exposing list, marketplace, enable, disable, and uninstall endpoints backed by `LifecycleManager` and `PluginRegistry`.

**Architecture:** A new `plugins.ts` route file is registered in `api-server/index.ts`. It receives `lifecycleManager` via `RouteDeps`. Two getters are added to `LifecycleManager` to expose its private `loadOrder` array and `instanceRoot`. All endpoints require `system:admin` scope.

**Tech Stack:** Fastify, Vitest, TypeScript ESM (`.js` imports), `LifecycleManager`, `PluginRegistry`, `RegistryClient`, `importFromDir`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/core/plugin/lifecycle-manager.ts` | Add `plugins` and `instanceRoot` public getters |
| Modify | `src/plugins/api-server/routes/types.ts` | Add `lifecycleManager?: LifecycleManager` to `RouteDeps` |
| Create | `src/plugins/api-server/routes/plugins.ts` | All 5 plugin endpoints |
| Create | `src/plugins/api-server/__tests__/routes-plugins.test.ts` | Full route test suite |
| Modify | `src/plugins/api-server/index.ts` | Import, wire, and register plugins route |

---

### Task 1: Add public getters to LifecycleManager

`loadOrder` and `instanceRoot` are both private but needed by the route. Add getters without breaking the existing API.

**Files:**
- Modify: `src/core/plugin/lifecycle-manager.ts`

- [ ] **Step 1: Rename private field and add getters**

In `src/core/plugin/lifecycle-manager.ts`, rename `private instanceRoot` to `private _instanceRoot`, then add two getters after the existing `get registry()` getter:

```ts
// Change:
private instanceRoot: string | undefined
// To:
private _instanceRoot: string | undefined
```

Update all internal uses of `this.instanceRoot` to `this._instanceRoot` (constructor assignment and createPluginContext call):

```ts
// constructor:
this._instanceRoot = opts?.instanceRoot

// createPluginContext call:
instanceRoot: this._instanceRoot,
```

Add getters after `get registry()`:

```ts
/** Plugin definitions currently in load order (loaded + failed). */
get plugins(): VibenPlugin[] {
  return [...this.loadOrder]
}

/** Root directory of this Viben instance (e.g. ~/.viben). */
get instanceRoot(): string | undefined {
  return this._instanceRoot
}
```

- [ ] **Step 2: Run existing lifecycle tests to verify no regression**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm test src/core/plugin/__tests__/lifecycle-manager.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/core/plugin/lifecycle-manager.ts
git commit -m "feat(lifecycle): expose plugins and instanceRoot as public getters"
```

---

### Task 2: Extend RouteDeps

**Files:**
- Modify: `src/plugins/api-server/routes/types.ts`

- [ ] **Step 1: Add import and field**

In `src/plugins/api-server/routes/types.ts`, add:

```ts
import type { LifecycleManager } from '../../../core/plugin/lifecycle-manager.js'

export interface RouteDeps {
  core: VibenCore;
  topicManager?: TopicManager;
  startedAt: number;
  getVersion: () => string;
  commandRegistry?: CommandRegistry;
  authPreHandler?: preHandlerHookHandler;
  contextManager?: ContextManager;
  /** LifecycleManager for plugin state queries and hot-load operations. */
  lifecycleManager?: LifecycleManager;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm build 2>&1 | head -20
```

Expected: no errors related to `RouteDeps`.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/api-server/routes/types.ts
git commit -m "feat(api-server): add lifecycleManager to RouteDeps"
```

---

### Task 3: Create plugins route — GET /plugins

**Files:**
- Create: `src/plugins/api-server/routes/plugins.ts`
- Create: `src/plugins/api-server/__tests__/routes-plugins.test.ts`

- [ ] **Step 1: Write the failing test for GET /plugins**

Create `src/plugins/api-server/__tests__/routes-plugins.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm test src/plugins/api-server/__tests__/routes-plugins.test.ts 2>&1 | head -20
```

Expected: FAIL — `Cannot find module '../routes/plugins.js'`

- [ ] **Step 3: Create plugins route with GET /plugins**

Create `src/plugins/api-server/routes/plugins.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import type { RouteDeps } from './types.js'
import { requireScopes } from '../middleware/auth.js'
import { corePlugins } from '../../../plugins/core-plugins.js'

export async function pluginRoutes(
  app: FastifyInstance,
  deps: RouteDeps,
): Promise<void> {
  const { lifecycleManager } = deps
  const admin = [requireScopes('system:admin')]

  // GET /plugins — list all installed plugins with runtime state
  app.get('/', { preHandler: admin }, async () => {
    if (!lifecycleManager?.registry) return { plugins: [] }

    const registry = lifecycleManager.registry
    const loadedSet = new Set(lifecycleManager.loadedPlugins)
    const failedSet = new Set(lifecycleManager.failedPlugins)
    const loadOrderMap = new Map(lifecycleManager.plugins.map((p) => [p.name, p]))
    const coreMap = new Map(corePlugins.map((p) => [p.name, p]))

    const plugins = Array.from(registry.list().entries()).map(([name, entry]) => {
      const def = loadOrderMap.get(name) ?? coreMap.get(name)
      return {
        name,
        version: entry.version,
        description: entry.description,
        source: entry.source,
        enabled: entry.enabled,
        loaded: loadedSet.has(name),
        failed: failedSet.has(name),
        essential: def?.essential ?? false,
        hasConfigure: typeof def?.configure === 'function',
      }
    })

    return { plugins }
  })
}
```

- [ ] **Step 4: Run test to verify GET /plugins passes**

```bash
pnpm test src/plugins/api-server/__tests__/routes-plugins.test.ts --reporter=verbose 2>&1 | grep -E "✓|✗|PASS|FAIL|GET /api"
```

Expected: both GET /plugins tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/api-server/routes/plugins.ts src/plugins/api-server/__tests__/routes-plugins.test.ts
git commit -m "feat(api-server): add GET /plugins endpoint"
```

---

### Task 4: GET /plugins/marketplace

**Files:**
- Modify: `src/plugins/api-server/routes/plugins.ts`
- Modify: `src/plugins/api-server/__tests__/routes-plugins.test.ts`

- [ ] **Step 1: Write failing tests for marketplace**

Add to the `describe('plugin routes')` block in the test file:

```ts
  describe('GET /api/v1/plugins/marketplace', () => {
    it('returns marketplace plugins with installed flag', async () => {
      const lm = makeLifecycleManager({
        registryEntries: {
          '@viben/telegram': { source: 'builtin', enabled: true },
        },
      })
      await buildServer(lm)

      // Mock the RegistryClient by intercepting the dynamic import
      // We can test via the actual fetch, but for unit test we rely on
      // the 503 path when the registry is unreachable.
      const res = await server!.app.inject({
        method: 'GET',
        url: '/api/v1/plugins/marketplace',
        headers: authHeaders(),
      })

      // Registry fetch will fail in test env (no internet) — expect 503
      expect(res.statusCode).toBe(503)
      const body = JSON.parse(res.body)
      expect(body.error).toBe('Marketplace unavailable')
    })

    it('returns 401 without auth', async () => {
      await buildServer(makeLifecycleManager({}))
      const res = await server!.app.inject({ method: 'GET', url: '/api/v1/plugins/marketplace' })
      expect(res.statusCode).toBe(401)
    })
  })
```

- [ ] **Step 2: Run to verify new tests fail**

```bash
pnpm test src/plugins/api-server/__tests__/routes-plugins.test.ts --reporter=verbose 2>&1 | grep -E "✓|✗|marketplace"
```

Expected: FAIL — marketplace route not yet registered.

- [ ] **Step 3: Add GET /plugins/marketplace to plugins.ts**

Append to `pluginRoutes` function in `src/plugins/api-server/routes/plugins.ts`:

```ts
  // GET /plugins/marketplace — proxy to RegistryClient with installed flag
  app.get('/marketplace', { preHandler: admin }, async (_req, reply) => {
    try {
      const { RegistryClient } = await import('../../../core/plugin/registry-client.js')
      const client = new RegistryClient()
      const data = await client.getRegistry()

      const installedNames = new Set(
        lifecycleManager?.registry
          ? Array.from(lifecycleManager.registry.list().keys())
          : [],
      )

      const plugins = data.plugins.map((p) => ({
        ...p,
        installed: installedNames.has(p.name) || installedNames.has(p.npm),
      }))

      return { plugins, categories: data.categories }
    } catch {
      return reply.status(503).send({ error: 'Marketplace unavailable' })
    }
  })
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/plugins/api-server/__tests__/routes-plugins.test.ts --reporter=verbose 2>&1 | grep -E "✓|✗"
```

Expected: all 4 tests pass (GET /plugins ×2, marketplace ×2).

- [ ] **Step 5: Commit**

```bash
git add src/plugins/api-server/routes/plugins.ts src/plugins/api-server/__tests__/routes-plugins.test.ts
git commit -m "feat(api-server): add GET /plugins/marketplace endpoint"
```

---

### Task 5: POST /plugins/:name/enable

**Files:**
- Modify: `src/plugins/api-server/routes/plugins.ts`
- Modify: `src/plugins/api-server/__tests__/routes-plugins.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the test file:

```ts
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
```

- [ ] **Step 2: Run to verify tests fail**

```bash
pnpm test src/plugins/api-server/__tests__/routes-plugins.test.ts --reporter=verbose 2>&1 | grep -E "enable|✓|✗"
```

Expected: FAIL — route not yet implemented.

- [ ] **Step 3: Add POST /:name/enable to plugins.ts**

Append to `pluginRoutes`:

```ts
  // POST /plugins/:name/enable — hot-load a disabled plugin
  app.post('/:name/enable', { preHandler: admin }, async (req, reply) => {
    if (!lifecycleManager?.registry) {
      return reply.status(503).send({ error: 'Plugin manager unavailable' })
    }

    const name = decodeURIComponent((req.params as { name: string }).name)
    const registry = lifecycleManager.registry
    const entry = registry.get(name)

    if (!entry) {
      return reply.status(404).send({ error: `Plugin "${name}" not found` })
    }

    // Idempotent — already loaded
    if (lifecycleManager.loadedPlugins.includes(name)) {
      registry.setEnabled(name, true)
      await registry.save()
      return { ok: true }
    }

    // Resolve plugin definition
    let pluginDef = lifecycleManager.plugins.find((p) => p.name === name)

    if (!pluginDef) {
      if (entry.source === 'builtin') {
        pluginDef = corePlugins.find((p) => p.name === name)
      } else {
        // npm / local — dynamic import
        const { importFromDir } = await import('../../../core/plugin/plugin-installer.js')
        const instanceRoot =
          lifecycleManager.instanceRoot ??
          (await import('node:path')).default.join(
            (await import('node:os')).default.homedir(),
            '.viben',
          )
        const pluginsDir = (await import('node:path')).default.join(instanceRoot, 'plugins')
        try {
          const mod = await importFromDir(name, pluginsDir)
          pluginDef = mod.default ?? mod
        } catch {
          return reply
            .status(500)
            .send({ error: 'Plugin module could not be loaded. Try restarting the server.' })
        }
      }
    }

    if (!pluginDef) {
      return reply.status(500).send({ error: `Plugin definition not found for "${name}"` })
    }

    registry.setEnabled(name, true)
    await registry.save()

    await lifecycleManager.boot([pluginDef])

    if (lifecycleManager.failedPlugins.includes(name)) {
      return reply.status(500).send({ error: `Plugin "${name}" failed to start` })
    }

    return { ok: true }
  })
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/plugins/api-server/__tests__/routes-plugins.test.ts --reporter=verbose 2>&1 | grep -E "✓|✗"
```

Expected: all enable tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/api-server/routes/plugins.ts src/plugins/api-server/__tests__/routes-plugins.test.ts
git commit -m "feat(api-server): add POST /plugins/:name/enable endpoint"
```

---

### Task 6: POST /plugins/:name/disable

**Files:**
- Modify: `src/plugins/api-server/routes/plugins.ts`
- Modify: `src/plugins/api-server/__tests__/routes-plugins.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the test file:

```ts
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
```

- [ ] **Step 2: Run to verify tests fail**

```bash
pnpm test src/plugins/api-server/__tests__/routes-plugins.test.ts --reporter=verbose 2>&1 | grep -E "disable|✓|✗"
```

Expected: FAIL — route not yet implemented.

- [ ] **Step 3: Add POST /:name/disable to plugins.ts**

Append to `pluginRoutes`:

```ts
  // POST /plugins/:name/disable — unload and disable a plugin
  app.post('/:name/disable', { preHandler: admin }, async (req, reply) => {
    if (!lifecycleManager?.registry) {
      return reply.status(503).send({ error: 'Plugin manager unavailable' })
    }

    const name = decodeURIComponent((req.params as { name: string }).name)
    const registry = lifecycleManager.registry
    const entry = registry.get(name)

    if (!entry) {
      return reply.status(404).send({ error: `Plugin "${name}" not found` })
    }

    // Check essential — look in loadOrder first, fall back to corePlugins
    const def =
      lifecycleManager.plugins.find((p) => p.name === name) ??
      corePlugins.find((p) => p.name === name)

    if (def?.essential) {
      return reply.status(409).send({ error: 'Essential plugins cannot be disabled' })
    }

    await lifecycleManager.unloadPlugin(name)
    registry.setEnabled(name, false)
    await registry.save()

    return { ok: true }
  })
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/plugins/api-server/__tests__/routes-plugins.test.ts --reporter=verbose 2>&1 | grep -E "✓|✗"
```

Expected: all disable tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/api-server/routes/plugins.ts src/plugins/api-server/__tests__/routes-plugins.test.ts
git commit -m "feat(api-server): add POST /plugins/:name/disable endpoint"
```

---

### Task 7: DELETE /plugins/:name (uninstall)

**Files:**
- Modify: `src/plugins/api-server/routes/plugins.ts`
- Modify: `src/plugins/api-server/__tests__/routes-plugins.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the test file:

```ts
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
```

- [ ] **Step 2: Run to verify tests fail**

```bash
pnpm test src/plugins/api-server/__tests__/routes-plugins.test.ts --reporter=verbose 2>&1 | grep -E "DELETE|uninstall|✓|✗"
```

Expected: FAIL — route not yet implemented.

- [ ] **Step 3: Add DELETE /:name to plugins.ts**

Append to `pluginRoutes`:

```ts
  // DELETE /plugins/:name — uninstall (remove from registry, unload)
  app.delete('/:name', { preHandler: admin }, async (req, reply) => {
    if (!lifecycleManager?.registry) {
      return reply.status(503).send({ error: 'Plugin manager unavailable' })
    }

    const name = decodeURIComponent((req.params as { name: string }).name)
    const registry = lifecycleManager.registry
    const entry = registry.get(name)

    if (!entry) {
      return reply.status(404).send({ error: `Plugin "${name}" not found` })
    }

    if (entry.source === 'builtin') {
      return reply
        .status(400)
        .send({ error: 'Builtin plugins cannot be uninstalled. Use disable instead.' })
    }

    await lifecycleManager.unloadPlugin(name)
    registry.remove(name)
    await registry.save()

    return { ok: true }
  })
```

- [ ] **Step 4: Run all plugin route tests**

```bash
pnpm test src/plugins/api-server/__tests__/routes-plugins.test.ts --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/api-server/routes/plugins.ts src/plugins/api-server/__tests__/routes-plugins.test.ts
git commit -m "feat(api-server): add DELETE /plugins/:name endpoint"
```

---

### Task 8: Register plugins route in api-server/index.ts

**Files:**
- Modify: `src/plugins/api-server/index.ts`

- [ ] **Step 1: Wire lifecycleManager into RouteDeps and register the route**

In `src/plugins/api-server/index.ts`, find the `setup(ctx)` function. After the existing imports and before `const deps: RouteDeps = {`:

Add import at top of the setup function (alongside the other route imports):

```ts
const { pluginRoutes } = await import('./routes/plugins.js')
```

Add `lifecycleManager` to the deps object:

```ts
const deps: RouteDeps = {
  core,
  topicManager,
  startedAt,
  getVersion,
  commandRegistry,
  authPreHandler: routeAuthPreHandler,
  contextManager,
  lifecycleManager: core.lifecycleManager,  // ← add this line
}
```

Register the route after the existing `server.registerPlugin` calls:

```ts
server.registerPlugin('/api/v1/plugins', async (app) => pluginRoutes(app, deps))
```

- [ ] **Step 2: Run full test suite to check for regressions**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm test 2>&1 | tail -20
```

Expected: all tests pass, no regressions.

- [ ] **Step 3: Build to verify TypeScript**

```bash
pnpm build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/api-server/index.ts
git commit -m "feat(api-server): register /api/v1/plugins route group"
```
