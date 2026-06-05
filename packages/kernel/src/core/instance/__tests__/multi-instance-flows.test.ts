// src/core/__tests__/multi-instance-flows.test.ts
// Comprehensive flow tests for the multi-instance feature.
// Each test reads like a user story — create, copy, query, manage instances.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  resolveInstanceRoot,
  createInstanceContext,
  generateSlug,
  getGlobalRoot,
} from '../instance-context.js'
import { InstanceRegistry } from '../instance-registry.js'
import { copyInstance } from '../instance-copy.js'
import { readInstanceInfo } from '../../../cli/commands/status.js'
import { applyMigrations, migrations } from '../../config/config-migrations.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(label: string): string {
  const dir = path.join(os.tmpdir(), `test-multi-instance-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// ---------------------------------------------------------------------------
// 1. CLI Flag Resolution Flow
// ---------------------------------------------------------------------------

describe('CLI flag resolution flow', () => {
  it('--local in a project dir resolves to project/.viben', () => {
    const root = resolveInstanceRoot({ local: true, cwd: '/home/user/project' })
    expect(root).toBe('/home/user/project/.viben')
  })

  it('--dir overrides --local', () => {
    const root = resolveInstanceRoot({ dir: '/srv/viben', local: true, cwd: '/home/user' })
    expect(root).toBe('/srv/viben/.viben')
  })

  it('no flags + no .viben in cwd returns null (needs prompt)', () => {
    const saved = process.env.VIBEN_INSTANCE_ROOT
    delete process.env.VIBEN_INSTANCE_ROOT
    // Use a temp dir that definitely has no .viben
    const tmp = makeTmpDir('empty')
    try {
      const root = resolveInstanceRoot({ cwd: tmp })
      expect(root).toBeNull()
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
      if (saved !== undefined) process.env.VIBEN_INSTANCE_ROOT = saved
    }
  })

  it('auto-detects existing .viben/config.json in cwd', () => {
    const tmp = makeTmpDir('auto-detect')
    const dotDir = path.join(tmp, '.viben')
    fs.mkdirSync(dotDir, { recursive: true })
    fs.writeFileSync(path.join(dotDir, 'config.json'), '{}')
    try {
      const root = resolveInstanceRoot({ cwd: tmp })
      expect(root).toBe(dotDir)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('--dir with ~ expands to home directory', () => {
    const root = resolveInstanceRoot({ dir: '~/my-project' })
    expect(root).toBe(path.join(os.homedir(), 'my-project', '.viben'))
  })
})

// ---------------------------------------------------------------------------
// 2. Full Instance Lifecycle Flow
// ---------------------------------------------------------------------------

describe('instance lifecycle: create, register, query, remove', () => {
  let tmpDir: string
  let registryPath: string
  let registry: InstanceRegistry

  beforeEach(() => {
    tmpDir = makeTmpDir('lifecycle')
    registryPath = path.join(tmpDir, 'instances.json')
    registry = new InstanceRegistry(registryPath)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates a new local instance from scratch', async () => {
    const projectDir = path.join(tmpDir, 'my-project')
    fs.mkdirSync(projectDir, { recursive: true })

    // Resolve root for a --local flag
    const root = resolveInstanceRoot({ local: true, cwd: projectDir })
    expect(root).toBe(path.join(projectDir, '.viben'))

    // Create context
    const ctx = createInstanceContext({ id: 'my-project', root: root! })
    expect(ctx.id).toBe('my-project')
    // Instance-local paths are under the local root (shared paths point to ~/.viben/)
    const sharedPathKeys = new Set(['agentsDir', 'bin', 'registryCache'])
    for (const [key, p] of Object.entries(ctx.paths)) {
      if (!sharedPathKeys.has(key)) {
        expect(p.startsWith(root!)).toBe(true)
      }
    }

    // Register
    await registry.load()
    registry.register(ctx.id, ctx.root)
    await registry.save()

    // Query by id
    expect(registry.get('my-project')).toEqual({ id: 'my-project', root: root })

    // List all
    const all = registry.list()
    expect(all).toHaveLength(1)
    expect(all[0]!.id).toBe('my-project')

    // Remove
    registry.remove('my-project')
    expect(registry.list()).toHaveLength(0)
    expect(registry.get('my-project')).toBeUndefined()
  })

  it('two instances can coexist with different roots', async () => {
    const dir1 = path.join(tmpDir, 'project-a', '.viben')
    const dir2 = path.join(tmpDir, 'project-b', '.viben')

    const ctx1 = createInstanceContext({ id: 'project-a', root: dir1 })
    const ctx2 = createInstanceContext({ id: 'project-b', root: dir2 })

    await registry.load()
    registry.register(ctx1.id, ctx1.root)
    registry.register(ctx2.id, ctx2.root)

    // List contains both
    expect(registry.list()).toHaveLength(2)

    // Get by id returns correct root
    expect(registry.get('project-a')!.root).toBe(dir1)
    expect(registry.get('project-b')!.root).toBe(dir2)

    // Get by root returns correct id
    expect(registry.getByRoot(dir1)!.id).toBe('project-a')
    expect(registry.getByRoot(dir2)!.id).toBe('project-b')
  })

  it('instance ID is unique — collision appends suffix', async () => {
    await registry.load()

    // Register first instance
    registry.register('my-project', '/a/.viben')

    // generateSlug for the same name collides
    const slug = generateSlug('My Project')
    expect(slug).toBe('my-project')

    // uniqueId deconflicts
    const id2 = registry.uniqueId(slug)
    expect(id2).toBe('my-project-2')
    registry.register(id2, '/b/.viben')

    // Third collision increments further
    const id3 = registry.uniqueId(slug)
    expect(id3).toBe('my-project-3')
  })

  it('registry persists across load/save cycles', async () => {
    await registry.load()
    registry.register('alpha', '/alpha/.viben')
    registry.register('beta', '/beta/.viben')
    await registry.save()

    // Reload from disk
    const registry2 = new InstanceRegistry(registryPath)
    await registry2.load()
    expect(registry2.list()).toHaveLength(2)
    expect(registry2.get('alpha')!.root).toBe('/alpha/.viben')
    expect(registry2.get('beta')!.root).toBe('/beta/.viben')
  })
})

// ---------------------------------------------------------------------------
// 3. Instance Copy Flow
// ---------------------------------------------------------------------------

describe('instance copy flow: create new from existing', () => {
  let baseDir: string
  let srcDir: string
  let dstDir: string

  beforeEach(() => {
    baseDir = makeTmpDir('copy')
    srcDir = path.join(baseDir, 'src', '.viben')
    dstDir = path.join(baseDir, 'dst', '.viben')

    // Build a realistic source instance
    fs.mkdirSync(path.join(srcDir, 'plugins', 'data', '@viben', 'tunnel'), { recursive: true })
    fs.mkdirSync(path.join(srcDir, 'plugins', 'data', '@viben', 'telegram'), { recursive: true })
    fs.mkdirSync(path.join(srcDir, 'plugins', 'node_modules', 'some-plugin'), { recursive: true })
    fs.mkdirSync(path.join(srcDir, 'agents', 'claude-acp'), { recursive: true })
    fs.mkdirSync(path.join(srcDir, 'bin'), { recursive: true })
    fs.mkdirSync(path.join(srcDir, 'logs'), { recursive: true })

    fs.writeFileSync(path.join(srcDir, 'config.json'), JSON.stringify({
      instanceName: 'Main',
      channels: { telegram: { botToken: 'secret-token' } },
      api: { port: 21420, secret: 'abc' },
      tunnel: { port: 3100, provider: 'cloudflare' },
      agents: {},
    }))
    fs.writeFileSync(path.join(srcDir, 'plugins.json'), JSON.stringify({
      installed: { '@viben/telegram': { enabled: true }, '@viben/tunnel': { enabled: true } },
    }))
    fs.writeFileSync(path.join(srcDir, 'plugins', 'package.json'), '{"dependencies":{}}')
    fs.writeFileSync(path.join(srcDir, 'plugins', 'node_modules', 'some-plugin', 'index.js'), 'module.exports = {}')
    fs.writeFileSync(path.join(srcDir, 'agents.json'), JSON.stringify({ version: 1, installed: { 'claude-acp': {} } }))
    fs.writeFileSync(path.join(srcDir, 'agents', 'claude-acp', 'run.sh'), '#!/bin/sh')
    fs.writeFileSync(path.join(srcDir, 'bin', 'cloudflared'), 'binary-stub')
    fs.writeFileSync(path.join(srcDir, 'sessions.json'), '{"sessions":[]}')
    fs.writeFileSync(path.join(srcDir, 'viben.pid'), '12345')
    fs.writeFileSync(path.join(srcDir, 'api.port'), '21420')
    fs.writeFileSync(path.join(srcDir, 'logs', 'viben.log'), 'log line')
    fs.writeFileSync(
      path.join(srcDir, 'plugins', 'data', '@viben', 'tunnel', 'settings.json'),
      JSON.stringify({ provider: 'cloudflare', port: 3100, maxUserTunnels: 5 }),
    )
    fs.writeFileSync(
      path.join(srcDir, 'plugins', 'data', '@viben', 'telegram', 'settings.json'),
      JSON.stringify({ botToken: 'secret', chatId: '123' }),
    )
  })

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true })
  })

  it('copies config but strips instanceName and migrated plugin sections', async () => {
    await copyInstance(srcDir, dstDir, {})
    const config = JSON.parse(fs.readFileSync(path.join(dstDir, 'config.json'), 'utf-8'))

    // Stripped fields (instanceName + migrated plugin sections)
    expect(config.instanceName).toBeUndefined()
    expect(config.api).toBeUndefined()
    expect(config.tunnel).toBeUndefined()

    // Plugin-owned channel fields stripped
    expect(config.channels.telegram.botToken).toBeUndefined()
  })

  it('copies installed plugins and agents but not runtime files', async () => {
    await copyInstance(srcDir, dstDir, {})

    // Copied
    expect(fs.existsSync(path.join(dstDir, 'plugins', 'node_modules', 'some-plugin', 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(dstDir, 'plugins', 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(dstDir, 'agents', 'claude-acp', 'run.sh'))).toBe(true)
    expect(fs.existsSync(path.join(dstDir, 'agents.json'))).toBe(true)
    expect(fs.existsSync(path.join(dstDir, 'bin', 'cloudflared'))).toBe(true)
    expect(fs.existsSync(path.join(dstDir, 'plugins.json'))).toBe(true)

    // NOT copied (runtime files)
    expect(fs.existsSync(path.join(dstDir, 'sessions.json'))).toBe(false)
    expect(fs.existsSync(path.join(dstDir, 'viben.pid'))).toBe(false)
    expect(fs.existsSync(path.join(dstDir, 'api.port'))).toBe(false)
    expect(fs.existsSync(path.join(dstDir, 'logs'))).toBe(false)
  })

  it('inherits only allowed plugin settings', async () => {
    await copyInstance(srcDir, dstDir, {
      inheritableKeys: { '@viben/tunnel': ['provider', 'maxUserTunnels'] },
    })

    const settings = JSON.parse(fs.readFileSync(
      path.join(dstDir, 'plugins', 'data', '@viben', 'tunnel', 'settings.json'), 'utf-8',
    ))
    expect(settings.provider).toBe('cloudflare')
    expect(settings.maxUserTunnels).toBe(5)
    expect(settings.port).toBeUndefined()
  })

  it('does not inherit anything for plugins with no inheritableKeys', async () => {
    await copyInstance(srcDir, dstDir, {
      inheritableKeys: { '@viben/tunnel': ['provider'] },
      // telegram is NOT listed — should not be copied
    })

    expect(fs.existsSync(
      path.join(dstDir, 'plugins', 'data', '@viben', 'telegram', 'settings.json'),
    )).toBe(false)
  })

  it('copies nothing for plugins when inheritableKeys is empty', async () => {
    await copyInstance(srcDir, dstDir, { inheritableKeys: {} })

    // Neither plugin's settings should be copied
    expect(fs.existsSync(
      path.join(dstDir, 'plugins', 'data', '@viben', 'tunnel', 'settings.json'),
    )).toBe(false)
    expect(fs.existsSync(
      path.join(dstDir, 'plugins', 'data', '@viben', 'telegram', 'settings.json'),
    )).toBe(false)
  })

  it('reports progress during copy', async () => {
    const progress: Array<{ step: string; status: string }> = []
    await copyInstance(srcDir, dstDir, {
      inheritableKeys: { '@viben/tunnel': ['provider'] },
      onProgress: (step, status) => progress.push({ step, status }),
    })

    // Every step should have a start/done pair
    const steps = [...new Set(progress.map((p) => p.step))]
    for (const step of steps) {
      expect(progress.some((p) => p.step === step && p.status === 'start')).toBe(true)
      expect(progress.some((p) => p.step === step && p.status === 'done')).toBe(true)
    }

    // Verify expected steps are present and in order
    const startOrder = progress.filter((p) => p.status === 'start').map((p) => p.step)
    expect(startOrder).toEqual(['Configuration', 'Plugin list', 'Plugins', 'Agents', 'Tools', 'Preferences'])
  })
})

// ---------------------------------------------------------------------------
// 4. Status Reading Flow
// ---------------------------------------------------------------------------

describe('status reads instance info from files', () => {
  let root: string

  beforeEach(() => {
    root = makeTmpDir('status')
    fs.mkdirSync(root, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('reads instance name from config.json', () => {
    fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ instanceName: 'Test Bot' }))
    const info = readInstanceInfo(root)
    expect(info.name).toBe('Test Bot')
  })

  it('detects online instance from PID file with a live process', () => {
    // Use the current process PID — it is alive
    fs.writeFileSync(path.join(root, 'viben.pid'), String(process.pid))
    const info = readInstanceInfo(root)
    expect(info.pid).toBe(process.pid)
  })

  it('detects offline instance from stale PID', () => {
    // A very high PID that almost certainly does not exist
    fs.writeFileSync(path.join(root, 'viben.pid'), '4000000')
    const info = readInstanceInfo(root)
    expect(info.pid).toBeNull()
  })

  it('reads API port from api.port file', () => {
    fs.writeFileSync(path.join(root, 'api.port'), '21421')
    const info = readInstanceInfo(root)
    expect(info.apiPort).toBe(21421)
  })

  it('reads enabled channels from plugins.json', () => {
    fs.writeFileSync(path.join(root, 'plugins.json'), JSON.stringify({
      installed: {
        '@viben/telegram': { enabled: true },
        '@viben/discord-adapter': { enabled: true },
        '@viben/slack-adapter': { enabled: false },
      },
    }))
    const info = readInstanceInfo(root)
    expect(info.channels).toContain('telegram')
    expect(info.channels).toContain('discord')
    expect(info.channels).not.toContain('slack')
  })

  it('reads tunnel port from tunnels.json', () => {
    fs.writeFileSync(path.join(root, 'tunnels.json'), JSON.stringify({
      system: { type: 'system', port: 3100, url: 'https://example.com' },
    }))
    const info = readInstanceInfo(root)
    expect(info.tunnelPort).toBe(3100)
  })

  it('reads runMode from config.json', () => {
    fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ runMode: 'daemon' }))
    const info = readInstanceInfo(root)
    expect(info.runMode).toBe('daemon')
  })

  it('handles missing files gracefully — no crash, all null/empty', () => {
    // Empty directory, no files at all
    const info = readInstanceInfo(root)
    expect(info.name).toBeNull()
    expect(info.pid).toBeNull()
    expect(info.apiPort).toBeNull()
    expect(info.tunnelPort).toBeNull()
    expect(info.runMode).toBeNull()
    expect(info.channels).toEqual([])
  })

  it('handles malformed JSON gracefully', () => {
    fs.writeFileSync(path.join(root, 'config.json'), 'not json at all')
    fs.writeFileSync(path.join(root, 'plugins.json'), '{broken')
    fs.writeFileSync(path.join(root, 'tunnels.json'), '')
    const info = readInstanceInfo(root)
    expect(info.name).toBeNull()
    expect(info.channels).toEqual([])
    expect(info.tunnelPort).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5. Config Migration Flow
// ---------------------------------------------------------------------------

describe('config migration adds instanceName', () => {
  // Only run the add-instance-name migration to isolate the test
  const instanceNameMigration = migrations.filter((m) => m.name === 'add-instance-name')

  it('adds instanceName "Main" to old config without it', () => {
    const raw: Record<string, unknown> = {
      channels: { telegram: {} },
    }
    const { changed } = applyMigrations(raw, instanceNameMigration)
    expect(changed).toBe(true)
    expect(raw.instanceName).toBe('Main')
  })

  it('does not overwrite existing instanceName', () => {
    const raw: Record<string, unknown> = {
      instanceName: 'My Bot',
      channels: {},
    }
    const { changed } = applyMigrations(raw, instanceNameMigration)
    expect(changed).toBe(false)
    expect(raw.instanceName).toBe('My Bot')
  })

  it('applyMigrations returns changed=false when nothing to migrate', () => {
    const raw: Record<string, unknown> = { instanceName: 'Already Set' }
    const { changed } = applyMigrations(raw, instanceNameMigration)
    expect(changed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 6. Naming and Slug Flow
// ---------------------------------------------------------------------------

describe('instance naming flow', () => {
  it('generates a slug from a user-provided name', () => {
    expect(generateSlug('My Staging Bot')).toBe('my-staging-bot')
  })

  it('handles unicode and special characters', () => {
    const slug = generateSlug('Cafe Bot !')
    expect(slug).toBe('cafe-bot')
  })

  it('collapses consecutive hyphens into one', () => {
    expect(generateSlug('foo---bar')).toBe('foo-bar')
  })

  it('strips leading and trailing hyphens', () => {
    expect(generateSlug('--hello--')).toBe('hello')
  })

  it('falls back to "viben" for empty input', () => {
    expect(generateSlug('')).toBe('viben')
    expect(generateSlug('!!!')).toBe('viben')
  })

  it('two instances have separate local paths but share global paths', () => {
    const rootA = '/home/user/project-a/.viben'
    const rootB = '/home/user/project-b/.viben'
    const globalRoot = getGlobalRoot()

    const ctxA = createInstanceContext({ id: 'project-a', root: rootA })
    const ctxB = createInstanceContext({ id: 'project-b', root: rootB })

    // Instance-local paths differ
    expect(ctxA.paths.config).not.toBe(ctxB.paths.config)
    expect(ctxA.paths.sessions).not.toBe(ctxB.paths.sessions)
    expect(ctxA.paths.plugins).not.toBe(ctxB.paths.plugins)

    // Shared paths are identical and point to ~/.viben/
    expect(ctxA.paths.agentsDir).toBe(ctxB.paths.agentsDir)
    expect(ctxA.paths.agentsDir).toBe(path.join(globalRoot, 'agents'))
    expect(ctxA.paths.bin).toBe(ctxB.paths.bin)
    expect(ctxA.paths.bin).toBe(path.join(globalRoot, 'bin'))
    expect(ctxA.paths.registryCache).toBe(ctxB.paths.registryCache)
    expect(ctxA.paths.registryCache).toBe(path.join(globalRoot, 'cache', 'registry-cache.json'))
  })
})
