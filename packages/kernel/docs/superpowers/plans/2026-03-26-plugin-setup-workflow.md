# Plugin Setup Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement per-plugin settings, lifecycle hooks (install/configure/migrate/uninstall), PluginRegistry, and SettingsManager so plugins fully own their setup and configuration.

**Architecture:** Each plugin gets its own `settings.json` managed via `SettingsAPI`. `PluginRegistry` tracks installed plugins in `plugins.json`. `TerminalIO` wraps `@clack/prompts` for interactive install/configure flows. `LifecycleManager` checks version mismatches and calls `migrate()` on boot. CLI orchestrates built-in plugin setup during first-run.

**Tech Stack:** TypeScript strict, ESM-only (.js imports), Vitest, Zod, @clack/prompts

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/core/plugin/plugin-registry.ts` | Track installed plugins, persist to `plugins.json` |
| `src/core/plugin/settings-manager.ts` | Per-plugin settings I/O, validation, SettingsAPI factory |
| `src/core/plugin/terminal-io.ts` | Wrap @clack/prompts for plugin interactive flows |
| `src/core/plugin/install-context.ts` | Create InstallContext for install/configure/uninstall |
| `src/core/plugin/__tests__/plugin-registry.test.ts` | Registry tests |
| `src/core/plugin/__tests__/settings-manager.test.ts` | Settings tests |
| `src/core/plugin/__tests__/terminal-io.test.ts` | TerminalIO tests |
| `src/core/plugin/__tests__/install-context.test.ts` | InstallContext tests |
| `src/core/plugin/__tests__/lifecycle-migration.test.ts` | Migration flow tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/core/plugin/types.ts` | Add InstallContext, MigrateContext, TerminalIO, SettingsAPI interfaces; add lifecycle hooks + settingsSchema + essential to VibenPlugin |
| `src/core/plugin/lifecycle-manager.ts` | Inject SettingsManager + PluginRegistry; version mismatch → migrate(); read config from settings.json |
| `src/core/plugin/plugin-context.ts` | Read pluginConfig from SettingsManager instead of ConfigManager |
| `src/core/plugin/index.ts` | Re-export new modules |
| `src/cli/commands/plugins.ts` | Add configure, install flow with plugin.install(), uninstall with --purge |

---

## Task 1: Add Type Definitions

**Files:**
- Modify: `src/core/plugin/types.ts`

- [ ] **Step 1: Write the types**

Add these interfaces and extend `VibenPlugin` in `src/core/plugin/types.ts`. Insert after the existing `PluginStorage` interface (around line 85):

```typescript
// ─── Settings API (per-plugin settings.json) ───

export interface SettingsAPI {
  get<T = unknown>(key: string): Promise<T | undefined>
  set<T = unknown>(key: string, value: T): Promise<void>
  getAll(): Promise<Record<string, unknown>>
  setAll(settings: Record<string, unknown>): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  has(key: string): Promise<boolean>
}

// ─── Terminal I/O (interactive CLI for plugins) ───

export interface TerminalIO {
  text(opts: {
    message: string
    placeholder?: string
    defaultValue?: string
    validate?: (value: string) => string | undefined
  }): Promise<string>

  select<T>(opts: {
    message: string
    options: { value: T; label: string; hint?: string }[]
  }): Promise<T>

  confirm(opts: {
    message: string
    initialValue?: boolean
  }): Promise<boolean>

  password(opts: {
    message: string
    validate?: (value: string) => string | undefined
  }): Promise<string>

  multiselect<T>(opts: {
    message: string
    options: { value: T; label: string; hint?: string }[]
    required?: boolean
  }): Promise<T[]>

  log: {
    info(message: string): void
    success(message: string): void
    warning(message: string): void
    error(message: string): void
    step(message: string): void
  }

  spinner(): {
    start(message: string): void
    stop(message?: string): void
    fail(message?: string): void
  }

  note(message: string, title?: string): void
  cancel(message?: string): void
}

// ─── Install Context (for install/configure/uninstall) ───

export interface InstallContext {
  pluginName: string
  terminal: TerminalIO
  settings: SettingsAPI
  legacyConfig?: Record<string, unknown>
  dataDir: string
  log: Logger
}

// ─── Migrate Context (for boot-time migration) ───

export interface MigrateContext {
  pluginName: string
  settings: SettingsAPI
  log: Logger
}
```

Then extend the `VibenPlugin` interface to add the new lifecycle hooks. Find the existing interface and add:

```typescript
// Add to VibenPlugin interface, after teardown:
  install?(ctx: InstallContext): Promise<void>
  uninstall?(ctx: InstallContext, opts: { purge: boolean }): Promise<void>
  configure?(ctx: InstallContext): Promise<void>
  migrate?(ctx: MigrateContext, oldSettings: unknown, oldVersion: string): Promise<unknown>
  settingsSchema?: import('zod').ZodSchema
  essential?: boolean
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: PASS (types only, no runtime changes)

- [ ] **Step 3: Commit**

```bash
git add src/core/plugin/types.ts
git commit -m "feat(plugin): add InstallContext, MigrateContext, SettingsAPI, TerminalIO type definitions"
```

---

## Task 2: SettingsManager + SettingsAPI

**Files:**
- Create: `src/core/plugin/settings-manager.ts`
- Test: `src/core/plugin/__tests__/settings-manager.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/core/plugin/__tests__/settings-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SettingsManager } from '../settings-manager.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('SettingsManager', () => {
  let tmpDir: string
  let manager: SettingsManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-test-'))
    manager = new SettingsManager(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('createAPI', () => {
    it('returns a SettingsAPI scoped to plugin name', () => {
      const api = manager.createAPI('@viben/telegram')
      expect(api).toBeDefined()
      expect(api.get).toBeTypeOf('function')
      expect(api.set).toBeTypeOf('function')
      expect(api.getAll).toBeTypeOf('function')
      expect(api.setAll).toBeTypeOf('function')
      expect(api.delete).toBeTypeOf('function')
      expect(api.clear).toBeTypeOf('function')
      expect(api.has).toBeTypeOf('function')
    })
  })

  describe('SettingsAPI operations', () => {
    it('get returns undefined for missing key', async () => {
      const api = manager.createAPI('@viben/test')
      expect(await api.get('missing')).toBeUndefined()
    })

    it('set and get round-trip', async () => {
      const api = manager.createAPI('@viben/test')
      await api.set('botToken', '123:ABC')
      expect(await api.get('botToken')).toBe('123:ABC')
    })

    it('setAll replaces all settings', async () => {
      const api = manager.createAPI('@viben/test')
      await api.set('old', 'value')
      await api.setAll({ new1: 'a', new2: 'b' })
      expect(await api.get('old')).toBeUndefined()
      expect(await api.get('new1')).toBe('a')
      expect(await api.get('new2')).toBe('b')
    })

    it('getAll returns all settings', async () => {
      const api = manager.createAPI('@viben/test')
      await api.setAll({ a: 1, b: 'two' })
      expect(await api.getAll()).toEqual({ a: 1, b: 'two' })
    })

    it('getAll returns empty object when no settings', async () => {
      const api = manager.createAPI('@viben/test')
      expect(await api.getAll()).toEqual({})
    })

    it('delete removes a key', async () => {
      const api = manager.createAPI('@viben/test')
      await api.setAll({ a: 1, b: 2 })
      await api.delete('a')
      expect(await api.has('a')).toBe(false)
      expect(await api.has('b')).toBe(true)
    })

    it('clear removes all settings', async () => {
      const api = manager.createAPI('@viben/test')
      await api.setAll({ a: 1, b: 2 })
      await api.clear()
      expect(await api.getAll()).toEqual({})
    })

    it('has returns true for existing key', async () => {
      const api = manager.createAPI('@viben/test')
      await api.set('key', 'value')
      expect(await api.has('key')).toBe(true)
      expect(await api.has('missing')).toBe(false)
    })

    it('persists to disk', async () => {
      const api = manager.createAPI('@viben/test')
      await api.setAll({ token: 'secret' })

      // Create new manager reading same directory
      const manager2 = new SettingsManager(tmpDir)
      const api2 = manager2.createAPI('@viben/test')
      expect(await api2.get('token')).toBe('secret')
    })

    it('isolates settings between plugins', async () => {
      const api1 = manager.createAPI('@viben/telegram')
      const api2 = manager.createAPI('@viben/discord')

      await api1.set('token', 'tg-token')
      await api2.set('token', 'dc-token')

      expect(await api1.get('token')).toBe('tg-token')
      expect(await api2.get('token')).toBe('dc-token')
    })
  })

  describe('loadSettings', () => {
    it('returns empty object when no settings file', async () => {
      expect(await manager.loadSettings('@viben/test')).toEqual({})
    })

    it('returns saved settings', async () => {
      const api = manager.createAPI('@viben/test')
      await api.setAll({ a: 1 })
      expect(await manager.loadSettings('@viben/test')).toEqual({ a: 1 })
    })
  })

  describe('validateSettings', () => {
    it('returns valid for correct settings', () => {
      const { z } = require('zod')
      const schema = z.object({ token: z.string() })
      const result = manager.validateSettings('@viben/test', { token: 'abc' }, schema)
      expect(result.valid).toBe(true)
    })

    it('returns invalid for incorrect settings', () => {
      const { z } = require('zod')
      const schema = z.object({ token: z.string() })
      const result = manager.validateSettings('@viben/test', { token: 123 }, schema)
      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('returns valid when no schema provided', () => {
      const result = manager.validateSettings('@viben/test', { anything: true })
      expect(result.valid).toBe(true)
    })
  })

  describe('getSettingsPath', () => {
    it('returns correct path for scoped package', () => {
      const p = manager.getSettingsPath('@viben/telegram')
      expect(p).toContain('@viben')
      expect(p).toContain('telegram')
      expect(p).toEndWith('settings.json')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/core/plugin/__tests__/settings-manager.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SettingsManager**

Create `src/core/plugin/settings-manager.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import type { SettingsAPI } from './types.js'
import type { ZodSchema } from 'zod'

export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

export class SettingsManager {
  constructor(private basePath: string) {}

  createAPI(pluginName: string): SettingsAPI {
    const settingsPath = this.getSettingsPath(pluginName)
    return new SettingsAPIImpl(settingsPath)
  }

  async loadSettings(pluginName: string): Promise<Record<string, unknown>> {
    const settingsPath = this.getSettingsPath(pluginName)
    try {
      const content = fs.readFileSync(settingsPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return {}
    }
  }

  validateSettings(
    _pluginName: string,
    settings: unknown,
    schema?: ZodSchema,
  ): ValidationResult {
    if (!schema) return { valid: true }

    const result = schema.safeParse(settings)
    if (result.success) return { valid: true }

    return {
      valid: false,
      errors: result.error.errors.map(
        (e: { path: (string | number)[]; message: string }) =>
          `${e.path.join('.')}: ${e.message}`,
      ),
    }
  }

  getSettingsPath(pluginName: string): string {
    // @viben/telegram → @viben/telegram/settings.json
    return path.join(this.basePath, pluginName, 'settings.json')
  }

  async getPluginSettings(pluginName: string): Promise<Record<string, unknown>> {
    return this.loadSettings(pluginName)
  }

  async updatePluginSettings(
    pluginName: string,
    updates: Record<string, unknown>,
  ): Promise<void> {
    const api = this.createAPI(pluginName)
    const current = await api.getAll()
    await api.setAll({ ...current, ...updates })
  }
}

class SettingsAPIImpl implements SettingsAPI {
  private cache: Record<string, unknown> | null = null

  constructor(private settingsPath: string) {}

  private readFile(): Record<string, unknown> {
    if (this.cache !== null) return this.cache
    try {
      const content = fs.readFileSync(this.settingsPath, 'utf-8')
      this.cache = JSON.parse(content)
      return this.cache!
    } catch {
      this.cache = {}
      return this.cache
    }
  }

  private writeFile(data: Record<string, unknown>): void {
    const dir = path.dirname(this.settingsPath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.settingsPath, JSON.stringify(data, null, 2))
    this.cache = data
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const data = this.readFile()
    return data[key] as T | undefined
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const data = this.readFile()
    data[key] = value
    this.writeFile(data)
  }

  async getAll(): Promise<Record<string, unknown>> {
    return { ...this.readFile() }
  }

  async setAll(settings: Record<string, unknown>): Promise<void> {
    this.writeFile({ ...settings })
  }

  async delete(key: string): Promise<void> {
    const data = this.readFile()
    delete data[key]
    this.writeFile(data)
  }

  async clear(): Promise<void> {
    this.writeFile({})
  }

  async has(key: string): Promise<boolean> {
    const data = this.readFile()
    return key in data
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/core/plugin/__tests__/settings-manager.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/plugin/settings-manager.ts src/core/plugin/__tests__/settings-manager.test.ts
git commit -m "feat(plugin): add SettingsManager with per-plugin settings.json persistence"
```

---

## Task 3: PluginRegistry

**Files:**
- Create: `src/core/plugin/plugin-registry.ts`
- Test: `src/core/plugin/__tests__/plugin-registry.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/core/plugin/__tests__/plugin-registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PluginRegistry } from '../plugin-registry.js'
import type { PluginEntry } from '../plugin-registry.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('PluginRegistry', () => {
  let tmpDir: string
  let registryPath: string
  let registry: PluginRegistry

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-test-'))
    registryPath = path.join(tmpDir, 'plugins.json')
    registry = new PluginRegistry(registryPath)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('register', () => {
    it('registers a new plugin', () => {
      registry.register('@viben/telegram', {
        version: '1.0.0',
        source: 'builtin',
        enabled: true,
        settingsPath: '/path/to/settings.json',
        description: 'Telegram adapter',
      })

      const entry = registry.get('@viben/telegram')
      expect(entry).toBeDefined()
      expect(entry!.version).toBe('1.0.0')
      expect(entry!.source).toBe('builtin')
      expect(entry!.enabled).toBe(true)
      expect(entry!.installedAt).toBeDefined()
      expect(entry!.updatedAt).toBeDefined()
    })
  })

  describe('remove', () => {
    it('removes an existing plugin', () => {
      registry.register('@viben/test', {
        version: '1.0.0',
        source: 'npm',
        enabled: true,
        settingsPath: '/path/settings.json',
      })
      registry.remove('@viben/test')
      expect(registry.get('@viben/test')).toBeUndefined()
    })

    it('no-ops for non-existent plugin', () => {
      expect(() => registry.remove('@viben/missing')).not.toThrow()
    })
  })

  describe('setEnabled', () => {
    it('toggles enabled state', () => {
      registry.register('@viben/test', {
        version: '1.0.0',
        source: 'builtin',
        enabled: true,
        settingsPath: '/path/settings.json',
      })
      registry.setEnabled('@viben/test', false)
      expect(registry.get('@viben/test')!.enabled).toBe(false)

      registry.setEnabled('@viben/test', true)
      expect(registry.get('@viben/test')!.enabled).toBe(true)
    })

    it('updates updatedAt timestamp', () => {
      registry.register('@viben/test', {
        version: '1.0.0',
        source: 'builtin',
        enabled: true,
        settingsPath: '/path/settings.json',
      })
      const before = registry.get('@viben/test')!.updatedAt

      // Small delay to ensure timestamp differs
      registry.setEnabled('@viben/test', false)
      const after = registry.get('@viben/test')!.updatedAt
      expect(after).toBeDefined()
    })
  })

  describe('updateVersion', () => {
    it('updates version and updatedAt', () => {
      registry.register('@viben/test', {
        version: '1.0.0',
        source: 'builtin',
        enabled: true,
        settingsPath: '/path/settings.json',
      })
      registry.updateVersion('@viben/test', '2.0.0')
      expect(registry.get('@viben/test')!.version).toBe('2.0.0')
    })
  })

  describe('list', () => {
    it('returns all registered plugins', () => {
      registry.register('@viben/a', { version: '1.0.0', source: 'builtin', enabled: true, settingsPath: '/a' })
      registry.register('@viben/b', { version: '2.0.0', source: 'npm', enabled: false, settingsPath: '/b' })

      const list = registry.list()
      expect(list.size).toBe(2)
      expect(list.has('@viben/a')).toBe(true)
      expect(list.has('@viben/b')).toBe(true)
    })
  })

  describe('listEnabled', () => {
    it('returns only enabled plugins', () => {
      registry.register('@viben/a', { version: '1.0.0', source: 'builtin', enabled: true, settingsPath: '/a' })
      registry.register('@viben/b', { version: '2.0.0', source: 'npm', enabled: false, settingsPath: '/b' })

      const enabled = registry.listEnabled()
      expect(enabled.size).toBe(1)
      expect(enabled.has('@viben/a')).toBe(true)
    })
  })

  describe('listBySource', () => {
    it('filters by source type', () => {
      registry.register('@viben/a', { version: '1.0.0', source: 'builtin', enabled: true, settingsPath: '/a' })
      registry.register('@community/b', { version: '1.0.0', source: 'npm', enabled: true, settingsPath: '/b' })

      const builtins = registry.listBySource('builtin')
      expect(builtins.size).toBe(1)
      expect(builtins.has('@viben/a')).toBe(true)
    })
  })

  describe('persistence', () => {
    it('save and load round-trip', async () => {
      registry.register('@viben/test', {
        version: '1.0.0',
        source: 'builtin',
        enabled: true,
        settingsPath: '/path/settings.json',
        description: 'Test plugin',
      })
      await registry.save()

      const registry2 = new PluginRegistry(registryPath)
      await registry2.load()

      const entry = registry2.get('@viben/test')
      expect(entry).toBeDefined()
      expect(entry!.version).toBe('1.0.0')
      expect(entry!.description).toBe('Test plugin')
    })

    it('load with no file returns empty', async () => {
      await registry.load()
      expect(registry.list().size).toBe(0)
    })

    it('load with corrupted file returns empty', async () => {
      fs.writeFileSync(registryPath, 'not json{{{')
      await registry.load()
      expect(registry.list().size).toBe(0)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/core/plugin/__tests__/plugin-registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PluginRegistry**

Create `src/core/plugin/plugin-registry.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'

export interface PluginEntry {
  version: string
  installedAt: string
  updatedAt: string
  source: 'builtin' | 'npm' | 'local'
  enabled: boolean
  settingsPath: string
  description?: string
}

type RegisterInput = Omit<PluginEntry, 'installedAt' | 'updatedAt'>

interface RegistryData {
  installed: Record<string, PluginEntry>
}

export class PluginRegistry {
  private data: RegistryData = { installed: {} }

  constructor(private registryPath: string) {}

  list(): Map<string, PluginEntry> {
    return new Map(Object.entries(this.data.installed))
  }

  get(name: string): PluginEntry | undefined {
    return this.data.installed[name]
  }

  register(name: string, entry: RegisterInput): void {
    const now = new Date().toISOString()
    this.data.installed[name] = {
      ...entry,
      installedAt: now,
      updatedAt: now,
    }
  }

  remove(name: string): void {
    delete this.data.installed[name]
  }

  setEnabled(name: string, enabled: boolean): void {
    const entry = this.data.installed[name]
    if (!entry) return
    entry.enabled = enabled
    entry.updatedAt = new Date().toISOString()
  }

  updateVersion(name: string, version: string): void {
    const entry = this.data.installed[name]
    if (!entry) return
    entry.version = version
    entry.updatedAt = new Date().toISOString()
  }

  listEnabled(): Map<string, PluginEntry> {
    return new Map(
      Object.entries(this.data.installed).filter(([, e]) => e.enabled),
    )
  }

  listBySource(source: PluginEntry['source']): Map<string, PluginEntry> {
    return new Map(
      Object.entries(this.data.installed).filter(([, e]) => e.source === source),
    )
  }

  async load(): Promise<void> {
    try {
      const content = fs.readFileSync(this.registryPath, 'utf-8')
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed.installed === 'object') {
        this.data = parsed
      }
    } catch {
      this.data = { installed: {} }
    }
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.registryPath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.registryPath, JSON.stringify(this.data, null, 2))
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/core/plugin/__tests__/plugin-registry.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/plugin/plugin-registry.ts src/core/plugin/__tests__/plugin-registry.test.ts
git commit -m "feat(plugin): add PluginRegistry for tracking installed plugins"
```

---

## Task 4: TerminalIO

**Files:**
- Create: `src/core/plugin/terminal-io.ts`
- Test: `src/core/plugin/__tests__/terminal-io.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/core/plugin/__tests__/terminal-io.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTerminalIO } from '../terminal-io.js'

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  password: vi.fn(),
  multiselect: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  log: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: '',
  })),
}))

import * as clack from '@clack/prompts'

describe('TerminalIO', () => {
  let terminal: ReturnType<typeof createTerminalIO>

  beforeEach(() => {
    vi.clearAllMocks()
    terminal = createTerminalIO()
  })

  it('delegates text() to clack.text', async () => {
    vi.mocked(clack.text).mockResolvedValue('hello')
    const result = await terminal.text({ message: 'Enter name' })
    expect(result).toBe('hello')
    expect(clack.text).toHaveBeenCalledWith(expect.objectContaining({ message: 'Enter name' }))
  })

  it('delegates select() to clack.select', async () => {
    vi.mocked(clack.select).mockResolvedValue('option1')
    const result = await terminal.select({
      message: 'Choose',
      options: [{ value: 'option1', label: 'Option 1' }],
    })
    expect(result).toBe('option1')
  })

  it('delegates confirm() to clack.confirm', async () => {
    vi.mocked(clack.confirm).mockResolvedValue(true)
    const result = await terminal.confirm({ message: 'Sure?' })
    expect(result).toBe(true)
  })

  it('delegates password() to clack.password', async () => {
    vi.mocked(clack.password).mockResolvedValue('secret')
    const result = await terminal.password({ message: 'Token:' })
    expect(result).toBe('secret')
  })

  it('delegates multiselect() to clack.multiselect', async () => {
    vi.mocked(clack.multiselect).mockResolvedValue(['a', 'b'])
    const result = await terminal.multiselect({
      message: 'Pick',
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    })
    expect(result).toEqual(['a', 'b'])
  })

  it('handles clack cancel symbol by throwing', async () => {
    vi.mocked(clack.text).mockResolvedValue(Symbol.for('cancel'))
    await expect(terminal.text({ message: 'Enter' })).rejects.toThrow('cancelled')
  })

  it('delegates log methods to clack.log', () => {
    terminal.log.info('hello')
    expect(clack.log.info).toHaveBeenCalledWith('hello')

    terminal.log.success('done')
    expect(clack.log.success).toHaveBeenCalledWith('done')

    terminal.log.warning('warn')
    expect(clack.log.warning).toHaveBeenCalledWith('warn')

    terminal.log.error('err')
    expect(clack.log.error).toHaveBeenCalledWith('err')

    terminal.log.step('step')
    expect(clack.log.step).toHaveBeenCalledWith('step')
  })

  it('delegates note() to clack.note', () => {
    terminal.note('message', 'title')
    expect(clack.note).toHaveBeenCalledWith('message', 'title')
  })

  it('delegates cancel() to clack.cancel', () => {
    terminal.cancel('bye')
    expect(clack.cancel).toHaveBeenCalledWith('bye')
  })

  it('creates spinner that delegates to clack.spinner', () => {
    const mockSpinner = { start: vi.fn(), stop: vi.fn(), message: '' }
    vi.mocked(clack.spinner).mockReturnValue(mockSpinner)

    const s = terminal.spinner()
    s.start('loading')
    expect(mockSpinner.start).toHaveBeenCalledWith('loading')

    s.stop('done')
    expect(mockSpinner.stop).toHaveBeenCalledWith('done')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/core/plugin/__tests__/terminal-io.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement TerminalIO**

Create `src/core/plugin/terminal-io.ts`:

```typescript
import * as clack from '@clack/prompts'
import type { TerminalIO } from './types.js'

function isCancel(value: unknown): value is symbol {
  return typeof value === 'symbol'
}

function guardCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    throw new Error('cancelled')
  }
  return value as T
}

export function createTerminalIO(): TerminalIO {
  return {
    async text(opts) {
      const result = await clack.text(opts)
      return guardCancel(result)
    },

    async select(opts) {
      const result = await clack.select(opts)
      return guardCancel(result)
    },

    async confirm(opts) {
      const result = await clack.confirm(opts)
      return guardCancel(result)
    },

    async password(opts) {
      const result = await clack.password(opts)
      return guardCancel(result)
    },

    async multiselect(opts) {
      const result = await clack.multiselect(opts)
      return guardCancel(result)
    },

    log: {
      info: (msg) => clack.log.info(msg),
      success: (msg) => clack.log.success(msg),
      warning: (msg) => clack.log.warning(msg),
      error: (msg) => clack.log.error(msg),
      step: (msg) => clack.log.step(msg),
    },

    spinner() {
      const s = clack.spinner()
      return {
        start: (msg: string) => s.start(msg),
        stop: (msg?: string) => s.stop(msg),
        fail: (msg?: string) => s.stop(msg ?? 'Failed'),
      }
    },

    note: (msg, title) => clack.note(msg, title),
    cancel: (msg) => clack.cancel(msg),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/core/plugin/__tests__/terminal-io.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/plugin/terminal-io.ts src/core/plugin/__tests__/terminal-io.test.ts
git commit -m "feat(plugin): add TerminalIO wrapping @clack/prompts for plugin interactive flows"
```

---

## Task 5: InstallContext Factory

**Files:**
- Create: `src/core/plugin/install-context.ts`
- Test: `src/core/plugin/__tests__/install-context.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/core/plugin/__tests__/install-context.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createInstallContext } from '../install-context.js'
import { SettingsManager } from '../settings-manager.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Mock terminal-io
vi.mock('../terminal-io.js', () => ({
  createTerminalIO: vi.fn(() => ({
    text: vi.fn(),
    select: vi.fn(),
    confirm: vi.fn(),
    password: vi.fn(),
    multiselect: vi.fn(),
    log: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn(), step: vi.fn() },
    spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), fail: vi.fn() })),
    note: vi.fn(),
    cancel: vi.fn(),
  })),
}))

describe('createInstallContext', () => {
  let tmpDir: string
  let settingsManager: SettingsManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-ctx-test-'))
    settingsManager = new SettingsManager(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates context with all required fields', () => {
    const ctx = createInstallContext({
      pluginName: '@viben/telegram',
      settingsManager,
      basePath: tmpDir,
    })

    expect(ctx.pluginName).toBe('@viben/telegram')
    expect(ctx.terminal).toBeDefined()
    expect(ctx.settings).toBeDefined()
    expect(ctx.dataDir).toContain('@viben/telegram')
    expect(ctx.log).toBeDefined()
  })

  it('passes legacyConfig when provided', () => {
    const legacy = { botToken: '123', chatId: '-100xxx' }
    const ctx = createInstallContext({
      pluginName: '@viben/telegram',
      settingsManager,
      basePath: tmpDir,
      legacyConfig: legacy,
    })

    expect(ctx.legacyConfig).toEqual(legacy)
  })

  it('legacyConfig is undefined when not provided', () => {
    const ctx = createInstallContext({
      pluginName: '@viben/telegram',
      settingsManager,
      basePath: tmpDir,
    })

    expect(ctx.legacyConfig).toBeUndefined()
  })

  it('settings API is scoped to the plugin', async () => {
    const ctx = createInstallContext({
      pluginName: '@viben/telegram',
      settingsManager,
      basePath: tmpDir,
    })

    await ctx.settings.set('token', 'abc')
    expect(await ctx.settings.get('token')).toBe('abc')

    // Verify it's persisted in the right location
    const loaded = await settingsManager.loadSettings('@viben/telegram')
    expect(loaded.token).toBe('abc')
  })

  it('dataDir path includes plugin name', () => {
    const ctx = createInstallContext({
      pluginName: '@community/translator',
      settingsManager,
      basePath: tmpDir,
    })

    expect(ctx.dataDir).toContain('@community/translator')
    expect(ctx.dataDir).toContain('data')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/core/plugin/__tests__/install-context.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement InstallContext factory**

Create `src/core/plugin/install-context.ts`:

```typescript
import path from 'node:path'
import type { InstallContext } from './types.js'
import type { SettingsManager } from './settings-manager.js'
import { createTerminalIO } from './terminal-io.js'
import { log as rootLog } from '../utils/log.js'

export interface CreateInstallContextOpts {
  pluginName: string
  settingsManager: SettingsManager
  basePath: string
  legacyConfig?: Record<string, unknown>
}

export function createInstallContext(opts: CreateInstallContextOpts): InstallContext {
  const { pluginName, settingsManager, basePath, legacyConfig } = opts
  const dataDir = path.join(basePath, pluginName, 'data')

  return {
    pluginName,
    terminal: createTerminalIO(),
    settings: settingsManager.createAPI(pluginName),
    legacyConfig,
    dataDir,
    log: rootLog.child({ plugin: pluginName }),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/core/plugin/__tests__/install-context.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/plugin/install-context.ts src/core/plugin/__tests__/install-context.test.ts
git commit -m "feat(plugin): add InstallContext factory for plugin lifecycle hooks"
```

---

## Task 6: LifecycleManager — Migration Support

**Files:**
- Modify: `src/core/plugin/lifecycle-manager.ts`
- Test: `src/core/plugin/__tests__/lifecycle-migration.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/core/plugin/__tests__/lifecycle-migration.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LifecycleManager } from '../lifecycle-manager.js'
import { SettingsManager } from '../settings-manager.js'
import { PluginRegistry } from '../plugin-registry.js'
import { ServiceRegistry } from '../service-registry.js'
import { MiddlewareChain } from '../middleware-chain.js'
import { ErrorTracker } from '../error-tracker.js'
import type { VibenPlugin } from '../types.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

function createMockPlugin(overrides: Partial<VibenPlugin> = {}): VibenPlugin {
  return {
    name: '@viben/test',
    version: '1.0.0',
    permissions: [],
    setup: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('LifecycleManager — Migration', () => {
  let tmpDir: string
  let settingsManager: SettingsManager
  let pluginRegistry: PluginRegistry
  let lifecycle: LifecycleManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-migration-'))
    settingsManager = new SettingsManager(path.join(tmpDir, 'plugins'))
    pluginRegistry = new PluginRegistry(path.join(tmpDir, 'plugins.json'))

    lifecycle = new LifecycleManager({
      serviceRegistry: new ServiceRegistry(),
      middlewareChain: new MiddlewareChain(),
      errorTracker: new ErrorTracker(),
      eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as any,
      storagePath: path.join(tmpDir, 'storage'),
      sessions: {} as any,
      config: { get: vi.fn().mockReturnValue({}) } as any,
      core: {} as any,
      log: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) } as any,
      settingsManager,
      pluginRegistry,
    })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('calls migrate() when version mismatch detected', async () => {
    const migrate = vi.fn().mockResolvedValue({ token: 'migrated' })
    const plugin = createMockPlugin({
      name: '@viben/test',
      version: '2.0.0',
      migrate,
    })

    // Register old version in registry
    pluginRegistry.register('@viben/test', {
      version: '1.0.0',
      source: 'builtin',
      enabled: true,
      settingsPath: settingsManager.getSettingsPath('@viben/test'),
    })

    // Write old settings
    const api = settingsManager.createAPI('@viben/test')
    await api.setAll({ token: 'old' })

    await lifecycle.boot([plugin])

    expect(migrate).toHaveBeenCalledWith(
      expect.objectContaining({ pluginName: '@viben/test' }),
      { token: 'old' },
      '1.0.0',
    )

    // Settings should be updated with migrated data
    const newSettings = await settingsManager.loadSettings('@viben/test')
    expect(newSettings.token).toBe('migrated')

    // Registry version should be updated
    expect(pluginRegistry.get('@viben/test')!.version).toBe('2.0.0')
  })

  it('skips migrate() when no version mismatch', async () => {
    const migrate = vi.fn()
    const plugin = createMockPlugin({
      name: '@viben/test',
      version: '1.0.0',
      migrate,
    })

    pluginRegistry.register('@viben/test', {
      version: '1.0.0',
      source: 'builtin',
      enabled: true,
      settingsPath: settingsManager.getSettingsPath('@viben/test'),
    })

    await lifecycle.boot([plugin])

    expect(migrate).not.toHaveBeenCalled()
  })

  it('skips migrate() when plugin not in registry', async () => {
    const migrate = vi.fn()
    const plugin = createMockPlugin({ migrate })

    await lifecycle.boot([plugin])

    expect(migrate).not.toHaveBeenCalled()
  })

  it('continues boot if migrate() throws', async () => {
    const plugin = createMockPlugin({
      name: '@viben/test',
      version: '2.0.0',
      migrate: vi.fn().mockRejectedValue(new Error('migration failed')),
    })

    pluginRegistry.register('@viben/test', {
      version: '1.0.0',
      source: 'builtin',
      enabled: true,
      settingsPath: settingsManager.getSettingsPath('@viben/test'),
    })

    // Should not throw — migration error is caught
    await lifecycle.boot([plugin])

    // setup() should still be called (graceful degradation)
    expect(plugin.setup).toHaveBeenCalled()
  })

  it('reads pluginConfig from settings.json instead of config.json', async () => {
    const plugin = createMockPlugin({ name: '@viben/test' })

    // Write settings to settings.json
    const api = settingsManager.createAPI('@viben/test')
    await api.setAll({ botToken: 'from-settings' })

    pluginRegistry.register('@viben/test', {
      version: '1.0.0',
      source: 'builtin',
      enabled: true,
      settingsPath: settingsManager.getSettingsPath('@viben/test'),
    })

    await lifecycle.boot([plugin])

    // setup() should receive config from settings.json
    expect(plugin.setup).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginConfig: expect.objectContaining({ botToken: 'from-settings' }),
      }),
    )
  })

  it('skips disabled plugins', async () => {
    const plugin = createMockPlugin({ name: '@viben/test' })

    pluginRegistry.register('@viben/test', {
      version: '1.0.0',
      source: 'builtin',
      enabled: false,
      settingsPath: settingsManager.getSettingsPath('@viben/test'),
    })

    await lifecycle.boot([plugin])

    expect(plugin.setup).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/core/plugin/__tests__/lifecycle-migration.test.ts`
Expected: FAIL — LifecycleManager constructor doesn't accept settingsManager/pluginRegistry

- [ ] **Step 3: Update LifecycleManager implementation**

Modify `src/core/plugin/lifecycle-manager.ts`:

1. Add `settingsManager` and `pluginRegistry` to constructor options
2. Before calling `setup()`, check registry for version mismatch → call `migrate()`
3. Read plugin config from `settingsManager.loadSettings()` instead of `resolvePluginConfig()`
4. Check `pluginRegistry.get(name)?.enabled === false` → skip plugin

The key changes are in the `boot()` method:

```typescript
// In boot(), after resolveLoadOrder, for each plugin:

// 1. Check if disabled in registry
const entry = this.pluginRegistry?.get(plugin.name)
if (entry && entry.enabled === false) {
  this.opts.eventBus.emit('plugin:disabled', { name: plugin.name, reason: 'disabled in registry' })
  continue
}

// 2. Check version mismatch → migrate
if (entry && plugin.migrate && entry.version !== plugin.version) {
  try {
    const oldSettings = await this.opts.settingsManager!.loadSettings(plugin.name)
    const migrateCtx: MigrateContext = {
      pluginName: plugin.name,
      settings: this.opts.settingsManager!.createAPI(plugin.name),
      log: this.opts.log.child({ plugin: plugin.name }),
    }
    const newSettings = await plugin.migrate(migrateCtx, oldSettings, entry.version)
    if (newSettings && typeof newSettings === 'object') {
      await migrateCtx.settings.setAll(newSettings as Record<string, unknown>)
    }
    this.opts.pluginRegistry!.updateVersion(plugin.name, plugin.version)
    await this.opts.pluginRegistry!.save()
  } catch (err) {
    this.opts.log.child({ plugin: plugin.name }).warn({ err }, 'Migration failed, continuing with old settings')
  }
}

// 3. Resolve config from settings.json if available
let pluginConfig: Record<string, unknown>
if (this.opts.settingsManager) {
  pluginConfig = await this.opts.settingsManager.loadSettings(plugin.name)
  // Fallback to legacy config resolution if no settings.json
  if (Object.keys(pluginConfig).length === 0) {
    pluginConfig = resolvePluginConfig(plugin.name, this.opts.config)
  }
} else {
  pluginConfig = resolvePluginConfig(plugin.name, this.opts.config)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/core/plugin/__tests__/lifecycle-migration.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run all existing lifecycle-manager tests to verify no regressions**

Run: `pnpm test src/core/plugin/__tests__/lifecycle-manager.test.ts`
Expected: ALL PASS (existing tests should still work since settingsManager/pluginRegistry are optional)

- [ ] **Step 6: Commit**

```bash
git add src/core/plugin/lifecycle-manager.ts src/core/plugin/__tests__/lifecycle-migration.test.ts
git commit -m "feat(plugin): add migration support and settings-based config to LifecycleManager"
```

---

## Task 7: CLI Commands — Configure, Install Flow, Uninstall

**Files:**
- Modify: `src/cli/commands/plugins.ts`

- [ ] **Step 1: Add `configure` subcommand**

In `src/cli/commands/plugins.ts`, add a `configure` case to `cmdPlugin()`:

```typescript
case 'configure': {
  const pluginName = args[1]
  if (!pluginName) {
    console.error('Usage: viben plugins configure <plugin-name>')
    return
  }
  await configurePlugin(pluginName)
  break
}
```

Implement `configurePlugin()`:

```typescript
async function configurePlugin(pluginName: string): Promise<void> {
  // Load plugin module
  const { corePlugins } = await import('../../plugins/core-plugins.js')
  const plugin = corePlugins.find(p => p.name === pluginName)

  if (!plugin) {
    console.error(`Plugin not found: ${pluginName}`)
    return
  }

  const { SettingsManager } = await import('../../core/plugin/settings-manager.js')
  const { createInstallContext } = await import('../../core/plugin/install-context.js')

  const basePath = path.join(os.homedir(), '.viben', 'plugins')
  const settingsManager = new SettingsManager(basePath)

  const ctx = createInstallContext({
    pluginName,
    settingsManager,
    basePath,
  })

  if (plugin.configure) {
    await plugin.configure(ctx)
  } else if (plugin.install) {
    // Fallback: re-run install with pre-filled settings
    await plugin.install(ctx)
  } else {
    console.log(`Plugin ${pluginName} has no configure or install hook`)
  }
}
```

- [ ] **Step 2: Update `install` flow to call plugin.install()**

Update the existing install logic to call `plugin.install()` after npm install:

```typescript
// After successful npm install, if plugin has install hook:
if (plugin.install) {
  const ctx = createInstallContext({ pluginName, settingsManager, basePath })
  await plugin.install(ctx)
}

// Register in plugins.json
registry.register(pluginName, {
  version: plugin.version,
  source: 'npm',
  enabled: true,
  settingsPath: settingsManager.getSettingsPath(pluginName),
  description: plugin.description,
})
await registry.save()
```

- [ ] **Step 3: Update `uninstall` to support `--purge`**

```typescript
case 'remove':
case 'uninstall': {
  const pluginName = args[1]
  const purge = args.includes('--purge')
  if (!pluginName) {
    console.error('Usage: viben plugins uninstall <plugin-name> [--purge]')
    return
  }
  await uninstallPlugin(pluginName, purge)
  break
}
```

Implement `uninstallPlugin()`:

```typescript
async function uninstallPlugin(pluginName: string, purge: boolean): Promise<void> {
  const registryPath = path.join(os.homedir(), '.viben', 'plugins.json')
  const registry = new PluginRegistry(registryPath)
  await registry.load()

  const entry = registry.get(pluginName)
  if (!entry) {
    console.error(`Plugin not installed: ${pluginName}`)
    return
  }

  if (entry.source === 'builtin') {
    console.error(`Cannot uninstall built-in plugin. Use 'viben plugins disable ${pluginName}' instead.`)
    return
  }

  // Load plugin and call uninstall hook if exists
  try {
    const plugin = await loadPluginModule(pluginName)
    if (plugin?.uninstall) {
      const basePath = path.join(os.homedir(), '.viben', 'plugins')
      const settingsManager = new SettingsManager(basePath)
      const ctx = createInstallContext({ pluginName, settingsManager, basePath })
      await plugin.uninstall(ctx, { purge })
    }
  } catch {
    // Plugin module might not be loadable, continue with cleanup
  }

  // If purge, delete plugin directory
  if (purge) {
    const pluginDir = path.join(os.homedir(), '.viben', 'plugins', pluginName)
    fs.rmSync(pluginDir, { recursive: true, force: true })
  }

  // Remove from registry
  registry.remove(pluginName)
  await registry.save()

  console.log(`Plugin ${pluginName} uninstalled${purge ? ' (purged)' : ''}`)
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/plugins.ts
git commit -m "feat(cli): add plugins configure, install flow, and uninstall --purge commands"
```

---

## Task 8: Update Exports & Integration

**Files:**
- Modify: `src/core/plugin/index.ts`
- Modify: `src/index.ts` (if public API exports needed)

- [ ] **Step 1: Update plugin index exports**

Add to `src/core/plugin/index.ts`:

```typescript
export { PluginRegistry } from './plugin-registry.js'
export type { PluginEntry } from './plugin-registry.js'
export { SettingsManager } from './settings-manager.js'
export type { ValidationResult } from './settings-manager.js'
export { createTerminalIO } from './terminal-io.js'
export { createInstallContext } from './install-context.js'
export type { CreateInstallContextOpts } from './install-context.js'
```

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Run build**

Run: `pnpm build && pnpm build:publish`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/plugin/index.ts
git commit -m "feat(plugin): export PluginRegistry, SettingsManager, TerminalIO, InstallContext"
```

---

## Task 9: Final Integration Test

**Files:**
- Create: `src/core/plugin/__tests__/plugin-setup-integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SettingsManager } from '../settings-manager.js'
import { PluginRegistry } from '../plugin-registry.js'
import { createInstallContext } from '../install-context.js'
import type { VibenPlugin, InstallContext, MigrateContext } from '../types.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Mock terminal-io for non-interactive tests
vi.mock('../terminal-io.js', () => ({
  createTerminalIO: vi.fn(() => ({
    text: vi.fn().mockResolvedValue('test-value'),
    select: vi.fn().mockResolvedValue('option1'),
    confirm: vi.fn().mockResolvedValue(true),
    password: vi.fn().mockResolvedValue('secret-token'),
    multiselect: vi.fn().mockResolvedValue(['a']),
    log: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn(), step: vi.fn() },
    spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), fail: vi.fn() })),
    note: vi.fn(),
    cancel: vi.fn(),
  })),
}))

describe('Plugin Setup Integration', () => {
  let tmpDir: string
  let settingsManager: SettingsManager
  let registry: PluginRegistry

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-setup-int-'))
    settingsManager = new SettingsManager(path.join(tmpDir, 'plugins'))
    registry = new PluginRegistry(path.join(tmpDir, 'plugins.json'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('full install → configure → migrate → uninstall cycle', async () => {
    // Define a test plugin
    const plugin: VibenPlugin = {
      name: '@test/example',
      version: '1.0.0',
      permissions: [],

      async install(ctx: InstallContext) {
        await ctx.settings.setAll({
          apiKey: 'key-from-install',
          region: 'us-east',
        })
      },

      async configure(ctx: InstallContext) {
        const current = await ctx.settings.getAll()
        await ctx.settings.set('region', 'eu-west')
      },

      async migrate(ctx: MigrateContext, oldSettings: unknown, oldVersion: string) {
        const old = oldSettings as Record<string, unknown>
        return {
          ...old,
          apiKeyV2: old.apiKey,  // renamed field
          region: old.region,
          newField: 'default',
        }
      },

      async uninstall(ctx: InstallContext, opts: { purge: boolean }) {
        if (opts.purge) {
          await ctx.settings.clear()
        }
      },

      setup: vi.fn().mockResolvedValue(undefined),
    }

    // 1. Install
    const installCtx = createInstallContext({
      pluginName: plugin.name,
      settingsManager,
      basePath: path.join(tmpDir, 'plugins'),
    })
    await plugin.install!(installCtx)

    // Verify settings saved
    const afterInstall = await settingsManager.loadSettings(plugin.name)
    expect(afterInstall.apiKey).toBe('key-from-install')
    expect(afterInstall.region).toBe('us-east')

    // Register
    registry.register(plugin.name, {
      version: '1.0.0',
      source: 'npm',
      enabled: true,
      settingsPath: settingsManager.getSettingsPath(plugin.name),
    })
    await registry.save()

    // 2. Configure
    const configCtx = createInstallContext({
      pluginName: plugin.name,
      settingsManager,
      basePath: path.join(tmpDir, 'plugins'),
    })
    await plugin.configure!(configCtx)

    const afterConfig = await settingsManager.loadSettings(plugin.name)
    expect(afterConfig.region).toBe('eu-west')

    // 3. Migrate (simulate version bump)
    const migrateCtx = {
      pluginName: plugin.name,
      settings: settingsManager.createAPI(plugin.name),
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    }
    const oldSettings = await settingsManager.loadSettings(plugin.name)
    const migrated = await plugin.migrate!(migrateCtx, oldSettings, '1.0.0')
    await migrateCtx.settings.setAll(migrated as Record<string, unknown>)

    const afterMigrate = await settingsManager.loadSettings(plugin.name)
    expect(afterMigrate.apiKeyV2).toBe('key-from-install')
    expect(afterMigrate.newField).toBe('default')

    // 4. Uninstall (no purge — settings kept)
    const uninstallCtx = createInstallContext({
      pluginName: plugin.name,
      settingsManager,
      basePath: path.join(tmpDir, 'plugins'),
    })
    await plugin.uninstall!(uninstallCtx, { purge: false })

    const afterUninstall = await settingsManager.loadSettings(plugin.name)
    expect(Object.keys(afterUninstall).length).toBeGreaterThan(0)

    // 5. Uninstall with purge — settings cleared
    await plugin.uninstall!(uninstallCtx, { purge: true })
    const afterPurge = await settingsManager.loadSettings(plugin.name)
    expect(afterPurge).toEqual({})
  })

  it('legacy config migration during install', async () => {
    const plugin: VibenPlugin = {
      name: '@viben/telegram',
      version: '1.0.0',
      permissions: [],

      async install(ctx: InstallContext) {
        if (ctx.legacyConfig?.botToken) {
          await ctx.settings.setAll({
            botToken: ctx.legacyConfig.botToken as string,
            chatId: ctx.legacyConfig.chatId as string,
            displayVerbosity: (ctx.legacyConfig.displayVerbosity as string) ?? 'medium',
          })
          return
        }
        // Would normally prompt user here
      },

      setup: vi.fn().mockResolvedValue(undefined),
    }

    const legacy = { botToken: '123:ABC', chatId: '-100xxx', displayVerbosity: 'high' }

    const ctx = createInstallContext({
      pluginName: plugin.name,
      settingsManager,
      basePath: path.join(tmpDir, 'plugins'),
      legacyConfig: legacy,
    })

    await plugin.install!(ctx)

    const settings = await settingsManager.loadSettings(plugin.name)
    expect(settings.botToken).toBe('123:ABC')
    expect(settings.chatId).toBe('-100xxx')
    expect(settings.displayVerbosity).toBe('high')
  })
})
```

- [ ] **Step 2: Run integration test**

Run: `pnpm test src/core/plugin/__tests__/plugin-setup-integration.test.ts`
Expected: ALL PASS

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 4: Run build + build:publish**

Run: `pnpm build && pnpm build:publish`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/plugin/__tests__/plugin-setup-integration.test.ts
git commit -m "test(plugin): add full lifecycle integration test for plugin setup workflow"
```

---

## Task 10: Push

- [ ] **Step 1: Push branch**

```bash
git push
```
