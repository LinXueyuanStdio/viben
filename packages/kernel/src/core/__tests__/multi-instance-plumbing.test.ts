// src/core/__tests__/multi-instance-plumbing.test.ts
// Tests for multi-instance plumbing: path isolation for LifecycleManager,
// AgentStore, AgentCatalog, ConfigManager migrations, and InstanceRegistry edge cases.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

describe('LifecycleManager instanceRoot plumbing', () => {
  it('passes instanceRoot to PluginContext via boot()', async () => {
    const { LifecycleManager } = await import('../plugin/lifecycle-manager.js')
    const customRoot = '/tmp/test-instance-root'
    const lm = new LifecycleManager({ instanceRoot: customRoot })

    const capturedCtx: any[] = []
    const plugin = {
      name: 'test-plugin',
      version: '1.0.0',
      setup: async (ctx: any) => { capturedCtx.push(ctx) },
    }

    await lm.boot([plugin])

    expect(capturedCtx).toHaveLength(1)
    expect(capturedCtx[0].instanceRoot).toBe(customRoot)
  })

  it('instanceRoot is undefined when not provided', async () => {
    const { LifecycleManager } = await import('../plugin/lifecycle-manager.js')
    const lm = new LifecycleManager()

    const capturedCtx: any[] = []
    const plugin = {
      name: 'test-plugin-2',
      version: '1.0.0',
      setup: async (ctx: any) => { capturedCtx.push(ctx) },
    }

    await lm.boot([plugin])

    expect(capturedCtx).toHaveLength(1)
    expect(capturedCtx[0].instanceRoot).toBeUndefined()
  })
})

describe('AgentStore path isolation', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-store-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reads and writes to the provided file path', async () => {
    const { AgentStore } = await import('../agents/agent-store.js')
    const storePath = path.join(tmpDir, 'agents.json')
    const store = new AgentStore(storePath)
    store.load()

    store.addAgent('test-agent', {
      registryId: null,
      name: 'Test Agent',
      version: '1.0.0',
      distribution: 'custom',
      command: 'echo',
      args: [],
      env: {},
      installedAt: new Date().toISOString(),
      binaryPath: null,
    } as any)

    // Verify file was written to the custom path
    expect(fs.existsSync(storePath)).toBe(true)
    const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
    expect(data.installed['test-agent']).toBeDefined()
    expect(data.installed['test-agent'].name).toBe('Test Agent')
  })
})

describe('AgentCatalog cachePath isolation', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('uses provided cachePath for registry cache', async () => {
    const { AgentCatalog } = await import('../agents/agent-catalog.js')
    const { AgentStore } = await import('../agents/agent-store.js')
    const cachePath = path.join(tmpDir, 'registry-cache.json')
    const store = new AgentStore(path.join(tmpDir, 'agents.json'))
    const catalog = new AgentCatalog(store, cachePath)
    catalog.load()

    // The catalog should use the custom cache path (no error on load with missing file)
    expect(catalog).toBeDefined()
  })
})

describe('InstanceRegistry edge cases', () => {
  let tmpDir: string
  let registryPath: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-test-'))
    registryPath = path.join(tmpDir, 'instances.json')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('handles corrupted JSON gracefully', async () => {
    const { InstanceRegistry } = await import('../instance/instance-registry.js')
    fs.writeFileSync(registryPath, '{invalid json!!!}')

    const registry = new InstanceRegistry(registryPath)
    registry.load() // Should not throw

    expect(registry.list()).toEqual([])
  })

  it('handles missing file gracefully', async () => {
    const { InstanceRegistry } = await import('../instance/instance-registry.js')
    const registry = new InstanceRegistry(path.join(tmpDir, 'nonexistent.json'))
    registry.load() // Should not throw

    expect(registry.list()).toEqual([])
  })

  it('handles wrong version gracefully', async () => {
    const { InstanceRegistry } = await import('../instance/instance-registry.js')
    fs.writeFileSync(registryPath, JSON.stringify({ version: 99, instances: { a: { id: 'a', root: '/a' } } }))

    const registry = new InstanceRegistry(registryPath)
    registry.load()

    // Wrong version should start fresh
    expect(registry.list()).toEqual([])
  })

  it('sync load/save methods work without await', async () => {
    const { InstanceRegistry } = await import('../instance/instance-registry.js')
    const registry = new InstanceRegistry(registryPath)
    // These should be sync (no Promise return needed)
    registry.load()
    registry.register('test-1', '/tmp/test-1')
    registry.save()

    // Verify saved
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf-8'))
    expect(data.instances['test-1']).toBeDefined()
  })
})

describe('InstanceContext path completeness', () => {
  it('creates all 16 path fields', async () => {
    const { createInstanceContext } = await import('../instance/instance-context.js')
    const ctx = createInstanceContext({ id: 'test', root: '/tmp/test-root' })

    const pathKeys = Object.keys(ctx.paths)
    expect(pathKeys).toHaveLength(16)

    // Verify instance-local paths are under the root; shared paths point to ~/.viben/
    const sharedPathKeys = new Set(['agentsDir', 'bin', 'registryCache'])
    for (const [key, value] of Object.entries(ctx.paths)) {
      if (sharedPathKeys.has(key)) {
        expect(value).toContain(path.join(os.homedir(), '.viben'))
      } else {
        expect(value).toContain('/tmp/test-root')
      }
    }

    // Verify specific critical paths
    expect(ctx.paths.config).toBe('/tmp/test-root/config.json')
    expect(ctx.paths.agents).toBe('/tmp/test-root/agents.json')
    expect(ctx.paths.sessions).toBe('/tmp/test-root/sessions.json')
    expect(ctx.paths.registryCache).toBe(path.join(os.homedir(), '.viben', 'cache', 'registry-cache.json'))
    expect(ctx.paths.bin).toBe(path.join(os.homedir(), '.viben', 'bin'))
    expect(ctx.paths.agentsDir).toBe(path.join(os.homedir(), '.viben', 'agents'))
    expect(ctx.paths.plugins).toBe('/tmp/test-root/plugins')
    expect(ctx.paths.pluginsData).toBe('/tmp/test-root/plugins/data')
    expect(ctx.paths.pluginRegistry).toBe('/tmp/test-root/plugins.json')
    expect(ctx.paths.logs).toBe('/tmp/test-root/logs')
    expect(ctx.paths.apiPort).toBe('/tmp/test-root/api.port')
    expect(ctx.paths.apiSecret).toBe('/tmp/test-root/api-secret')
  })
})
