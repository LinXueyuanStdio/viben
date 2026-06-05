# Multi-Instance Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow running multiple independent Viben instances on the same machine with separate configs, sessions, ports, and lifecycle.

**Architecture:** Introduce `InstanceContext` object created at CLI entry from flags/auto-detect, passed through the constructor chain to replace all hardcoded `~/.viben` paths. A minimal central registry (`~/.viben/instances.json`) indexes known instances by ID. All instance details are read from each instance's own files.

**Tech Stack:** TypeScript, Node.js, Zod, existing CLI tooling (@clack/prompts)

**Design Spec:** `docs/superpowers/specs/2026-03-30-multi-instance-design.md`

---

## File Structure

### New Files
- `src/core/instance-context.ts` — `InstanceContext` type, `createInstanceContext()`, `resolveInstanceRoot()`, slug generation
- `src/core/instance-registry.ts` — `InstanceRegistry` class (read/write `~/.viben/instances.json`)
- `src/core/instance-copy.ts` — Copy logic with progress display for cloning instances
- `src/core/__tests__/instance-context.test.ts` — Tests for path resolution, slug generation
- `src/core/__tests__/instance-registry.test.ts` — Tests for registry CRUD
- `src/core/__tests__/instance-copy.test.ts` — Tests for copy logic

### Modified Files (by task)
- `src/core/config/config.ts` — Remove module-level path constants, add `instanceName` to schema
- `src/cli.ts` — Parse `--local`, `--global`, `--dir`, `--from`, `--name` flags, create InstanceContext
- `src/main.ts` — Accept InstanceContext in `startServer()`, pass to all subsystems
- `src/core/core.ts` — Accept InstanceContext, pass to SessionStore, LifecycleManager
- `src/core/plugin/lifecycle-manager.ts` — Receive paths from InstanceContext
- `src/core/plugin/settings-manager.ts` — No change needed (already receives basePath)
- `src/core/plugin/plugin-registry.ts` — No change needed (already receives registryPath)
- `src/core/plugin/types.ts` — Add `inheritableKeys` to `VibenPlugin`
- `src/core/agents/agent-store.ts` — No change needed (already receives filePath)
- `src/core/agents/agent-catalog.ts` — Accept cachePath parameter instead of module-level const
- `src/core/agents/agent-installer.ts` — Accept agentsDir parameter instead of module-level const
- `src/core/utils/install-binary.ts` — Accept binDir parameter instead of module-level const
- `src/core/setup/wizard.ts` — Accept InstanceContext, add copy flow, partial setup, name prompt
- `src/cli/daemon.ts` — Accept paths as parameters instead of module-level constants
- `src/cli/api-client.ts` — Accept paths as parameters instead of module-level constants
- `src/cli/commands/default.ts` — Remove module-level constants, pass InstanceContext
- `src/cli/commands/start.ts` — Pass InstanceContext to daemon
- `src/cli/commands/stop.ts` — Pass InstanceContext to daemon
- `src/cli/commands/status.ts` — Add `--all` and `--id` support, read from registry
- `src/cli/commands/plugins.ts` — Use InstanceContext paths
- `src/cli/commands/install.ts` — Use InstanceContext paths
- `src/cli/commands/uninstall.ts` — Use InstanceContext paths
- `src/cli/commands/reset.ts` — Use InstanceContext paths
- `src/plugins/api-server/api-server.ts` — Accept port/secret file paths as constructor params
- `src/plugins/api-server/index.ts` — Pass InstanceContext paths to ApiServer
- `src/plugins/tunnel/tunnel-registry.ts` — Accept registry path as constructor param
- `src/plugins/tunnel/index.ts` — Pass InstanceContext path to TunnelRegistry
- `src/plugins/context/context-manager.ts` — Accept cache path as constructor param
- `src/plugins/file-service/index.ts` — Use InstanceContext paths
- All plugin index.ts files — Add `inheritableKeys` to their definitions

---

## Task 1: InstanceContext Type + Path Resolution + Slug Generation

**Files:**
- Create: `src/core/instance-context.ts`
- Create: `src/core/__tests__/instance-context.test.ts`

- [ ] **Step 1: Write failing tests for slug generation**

```typescript
// src/core/__tests__/instance-context.test.ts
import { describe, it, expect } from 'vitest'
import { generateSlug } from '../instance-context.js'

describe('generateSlug', () => {
  it('converts name to lowercase hyphenated slug', () => {
    expect(generateSlug('My Staging Bot')).toBe('my-staging-bot')
  })

  it('strips special characters', () => {
    expect(generateSlug('Hello World! @#$')).toBe('hello-world')
  })

  it('collapses multiple hyphens', () => {
    expect(generateSlug('foo---bar')).toBe('foo-bar')
  })

  it('trims leading/trailing hyphens', () => {
    expect(generateSlug('--hello--')).toBe('hello')
  })

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('viben')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/__tests__/instance-context.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write failing tests for createInstanceContext**

Add to `src/core/__tests__/instance-context.test.ts`:

```typescript
import { createInstanceContext } from '../instance-context.js'
import path from 'node:path'
import os from 'node:os'

describe('createInstanceContext', () => {
  it('creates global context with correct paths', () => {
    const ctx = createInstanceContext({ id: 'main', root: path.join(os.homedir(), '.viben'), isGlobal: true })
    expect(ctx.id).toBe('main')
    expect(ctx.isGlobal).toBe(true)
    expect(ctx.paths.config).toBe(path.join(ctx.root, 'config.json'))
    expect(ctx.paths.sessions).toBe(path.join(ctx.root, 'sessions.json'))
    expect(ctx.paths.agents).toBe(path.join(ctx.root, 'agents.json'))
    expect(ctx.paths.plugins).toBe(path.join(ctx.root, 'plugins'))
    expect(ctx.paths.pluginsData).toBe(path.join(ctx.root, 'plugins', 'data'))
    expect(ctx.paths.pluginRegistry).toBe(path.join(ctx.root, 'plugins.json'))
    expect(ctx.paths.logs).toBe(path.join(ctx.root, 'logs'))
    expect(ctx.paths.pid).toBe(path.join(ctx.root, 'viben.pid'))
    expect(ctx.paths.running).toBe(path.join(ctx.root, 'running'))
    expect(ctx.paths.apiPort).toBe(path.join(ctx.root, 'api.port'))
    expect(ctx.paths.apiSecret).toBe(path.join(ctx.root, 'api-secret'))
    expect(ctx.paths.bin).toBe(path.join(ctx.root, 'bin'))
    expect(ctx.paths.cache).toBe(path.join(ctx.root, 'cache'))
    expect(ctx.paths.tunnels).toBe(path.join(ctx.root, 'tunnels.json'))
    expect(ctx.paths.agentsDir).toBe(path.join(ctx.root, 'agents'))
    expect(ctx.paths.registryCache).toBe(path.join(ctx.root, 'registry-cache.json'))
  })

  it('creates local context from a project directory', () => {
    const ctx = createInstanceContext({ id: 'my-project', root: '/home/user/project/.viben', isGlobal: false })
    expect(ctx.id).toBe('my-project')
    expect(ctx.isGlobal).toBe(false)
    expect(ctx.paths.config).toBe('/home/user/project/.viben/config.json')
    expect(ctx.paths.pid).toBe('/home/user/project/.viben/viben.pid')
  })
})
```

- [ ] **Step 4: Write failing tests for resolveInstanceRoot**

Add to `src/core/__tests__/instance-context.test.ts`:

```typescript
import { resolveInstanceRoot } from '../instance-context.js'
import fs from 'node:fs'
import { tmpdir } from 'node:os'

describe('resolveInstanceRoot', () => {
  it('--dir flag resolves to <path>/.viben', () => {
    const result = resolveInstanceRoot({ dir: '/tmp/mydir' })
    expect(result).toBe('/tmp/mydir/.viben')
  })

  it('--local flag resolves to cwd/.viben', () => {
    const result = resolveInstanceRoot({ local: true, cwd: '/home/user/project' })
    expect(result).toBe('/home/user/project/.viben')
  })

  it('--global flag resolves to ~/.viben', () => {
    const result = resolveInstanceRoot({ global: true })
    expect(result).toBe(path.join(os.homedir(), '.viben'))
  })

  it('--dir takes priority over --local', () => {
    const result = resolveInstanceRoot({ dir: '/tmp/custom', local: true, cwd: '/home/user' })
    expect(result).toBe('/tmp/custom/.viben')
  })

  it('auto-detects .viben in cwd', () => {
    const dir = path.join(tmpdir(), `test-viben-${Date.now()}`)
    const dotDir = path.join(dir, '.viben')
    fs.mkdirSync(dotDir, { recursive: true })
    try {
      const result = resolveInstanceRoot({ cwd: dir })
      expect(result).toBe(dotDir)
    } finally {
      fs.rmSync(dir, { recursive: true })
    }
  })

  it('returns null when no flag and no .viben in cwd (needs prompt)', () => {
    const result = resolveInstanceRoot({ cwd: tmpdir() })
    expect(result).toBeNull()
  })

  it('expands ~ in --dir path', () => {
    const result = resolveInstanceRoot({ dir: '~/my-project' })
    expect(result).toBe(path.join(os.homedir(), 'my-project', '.viben'))
  })
})
```

- [ ] **Step 5: Implement instance-context.ts**

```typescript
// src/core/instance-context.ts
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

export interface InstanceContext {
  id: string
  root: string
  isGlobal: boolean
  paths: {
    config: string
    sessions: string
    agents: string
    registryCache: string
    plugins: string
    pluginsData: string
    pluginRegistry: string
    logs: string
    pid: string
    running: string
    apiPort: string
    apiSecret: string
    bin: string
    cache: string
    tunnels: string
    agentsDir: string
  }
}

export interface CreateInstanceContextOpts {
  id: string
  root: string
  isGlobal: boolean
}

export function createInstanceContext(opts: CreateInstanceContextOpts): InstanceContext {
  const { id, root, isGlobal } = opts
  return {
    id,
    root,
    isGlobal,
    paths: {
      config: path.join(root, 'config.json'),
      sessions: path.join(root, 'sessions.json'),
      agents: path.join(root, 'agents.json'),
      registryCache: path.join(root, 'registry-cache.json'),
      plugins: path.join(root, 'plugins'),
      pluginsData: path.join(root, 'plugins', 'data'),
      pluginRegistry: path.join(root, 'plugins.json'),
      logs: path.join(root, 'logs'),
      pid: path.join(root, 'viben.pid'),
      running: path.join(root, 'running'),
      apiPort: path.join(root, 'api.port'),
      apiSecret: path.join(root, 'api-secret'),
      bin: path.join(root, 'bin'),
      cache: path.join(root, 'cache'),
      tunnels: path.join(root, 'tunnels.json'),
      agentsDir: path.join(root, 'agents'),
    },
  }
}

export function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'viben'
}

function expandHome(p: string): string {
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1))
  return p
}

export interface ResolveOpts {
  dir?: string
  local?: boolean
  global?: boolean
  cwd?: string
}

/** Returns the resolved .viben root path, or null if user prompt is needed. */
export function resolveInstanceRoot(opts: ResolveOpts): string | null {
  const cwd = opts.cwd ?? process.cwd()

  // Priority 1: --dir
  if (opts.dir) {
    return path.join(expandHome(opts.dir), '.viben')
  }

  // Priority 2: --local
  if (opts.local) {
    return path.join(cwd, '.viben')
  }

  // Priority 3: --global
  if (opts.global) {
    return path.join(os.homedir(), '.viben')
  }

  // Priority 4: auto-detect .viben in cwd
  const localRoot = path.join(cwd, '.viben')
  if (fs.existsSync(localRoot)) {
    return localRoot
  }

  // Priority 5: needs prompt (return null)
  return null
}

/** The global instance root — always ~/.viben */
export function getGlobalRoot(): string {
  return path.join(os.homedir(), '.viben')
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/__tests__/instance-context.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/lucas/viben-workspace/Viben
git add src/core/instance-context.ts src/core/__tests__/instance-context.test.ts
git commit -m "feat: add InstanceContext type, path resolution, and slug generation"
```

---

## Task 2: Instance Registry

**Files:**
- Create: `src/core/instance-registry.ts`
- Create: `src/core/__tests__/instance-registry.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/core/__tests__/instance-registry.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InstanceRegistry } from '../instance-registry.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('InstanceRegistry', () => {
  let tmpDir: string
  let registryPath: string
  let registry: InstanceRegistry

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `test-registry-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    registryPath = path.join(tmpDir, 'instances.json')
    registry = new InstanceRegistry(registryPath)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('starts empty when no file exists', async () => {
    await registry.load()
    expect(registry.list()).toEqual([])
  })

  it('registers and lists instances', async () => {
    await registry.load()
    registry.register('main', '/home/user/.viben')
    registry.register('my-project', '/home/user/project/.viben')
    expect(registry.list()).toEqual([
      { id: 'main', root: '/home/user/.viben' },
      { id: 'my-project', root: '/home/user/project/.viben' },
    ])
  })

  it('persists to disk and reloads', async () => {
    await registry.load()
    registry.register('main', '/home/user/.viben')
    await registry.save()

    const registry2 = new InstanceRegistry(registryPath)
    await registry2.load()
    expect(registry2.list()).toEqual([
      { id: 'main', root: '/home/user/.viben' },
    ])
  })

  it('removes an instance by id', async () => {
    await registry.load()
    registry.register('main', '/home/user/.viben')
    registry.register('other', '/tmp/.viben')
    registry.remove('other')
    expect(registry.list()).toEqual([
      { id: 'main', root: '/home/user/.viben' },
    ])
  })

  it('finds instance by id', async () => {
    await registry.load()
    registry.register('main', '/home/user/.viben')
    expect(registry.get('main')).toEqual({ id: 'main', root: '/home/user/.viben' })
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('finds instance by root path', async () => {
    await registry.load()
    registry.register('main', '/home/user/.viben')
    expect(registry.getByRoot('/home/user/.viben')).toEqual({ id: 'main', root: '/home/user/.viben' })
    expect(registry.getByRoot('/nonexistent')).toBeUndefined()
  })

  it('generates unique id when collision exists', async () => {
    await registry.load()
    registry.register('main', '/a/.viben')
    const uniqueId = registry.uniqueId('main')
    expect(uniqueId).toBe('main-2')
  })

  it('increments suffix until unique', async () => {
    await registry.load()
    registry.register('main', '/a/.viben')
    registry.register('main-2', '/b/.viben')
    expect(registry.uniqueId('main')).toBe('main-3')
  })

  it('returns id as-is when no collision', async () => {
    await registry.load()
    expect(registry.uniqueId('my-project')).toBe('my-project')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/__tests__/instance-registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement instance-registry.ts**

```typescript
// src/core/instance-registry.ts
import fs from 'node:fs'
import path from 'node:path'

export interface InstanceRegistryEntry {
  id: string
  root: string
}

interface RegistryData {
  version: 1
  instances: Record<string, InstanceRegistryEntry>
}

export class InstanceRegistry {
  private data: RegistryData = { version: 1, instances: {} }

  constructor(private registryPath: string) {}

  async load(): Promise<void> {
    try {
      const raw = fs.readFileSync(this.registryPath, 'utf-8')
      const parsed = JSON.parse(raw) as RegistryData
      if (parsed.version === 1 && parsed.instances) {
        this.data = parsed
      }
    } catch {
      // File doesn't exist or invalid — start fresh
    }
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.registryPath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.registryPath, JSON.stringify(this.data, null, 2))
  }

  register(id: string, root: string): void {
    this.data.instances[id] = { id, root }
  }

  remove(id: string): void {
    delete this.data.instances[id]
  }

  get(id: string): InstanceRegistryEntry | undefined {
    return this.data.instances[id]
  }

  getByRoot(root: string): InstanceRegistryEntry | undefined {
    return Object.values(this.data.instances).find((e) => e.root === root)
  }

  list(): InstanceRegistryEntry[] {
    return Object.values(this.data.instances)
  }

  /** Returns a unique version of the given id, appending -2, -3, etc. if needed */
  uniqueId(baseId: string): string {
    if (!this.data.instances[baseId]) return baseId
    let n = 2
    while (this.data.instances[`${baseId}-${n}`]) n++
    return `${baseId}-${n}`
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/__tests__/instance-registry.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/viben-workspace/Viben
git add src/core/instance-registry.ts src/core/__tests__/instance-registry.test.ts
git commit -m "feat: add InstanceRegistry for tracking known instances"
```

---

## Task 3: Add instanceName to Config Schema + Remove Module-Level Path Constants

**Files:**
- Modify: `src/core/config/config.ts`

- [ ] **Step 1: Add instanceName field to config schema**

In `src/core/config/config.ts`, find the `ConfigSchema` Zod object (around line 109) and add `instanceName` as an optional field with a default:

```typescript
// Add to ConfigSchema, alongside existing top-level fields like defaultAgent, workspace, etc.
instanceName: z.string().optional(),
```

- [ ] **Step 2: Update ConfigManager constructor to accept configPath parameter**

Change the ConfigManager constructor from hardcoded path to accepting an optional parameter:

```typescript
// Old (line ~213-216):
constructor() {
  super();
  this.configPath =
    process.env.VIBEN_CONFIG_PATH || expandHome("~/.viben/config.json");
}

// New:
constructor(configPath?: string) {
  super();
  this.configPath =
    process.env.VIBEN_CONFIG_PATH || configPath || expandHome("~/.viben/config.json");
}
```

This is backward-compatible: existing code that calls `new ConfigManager()` still works with the default.

- [ ] **Step 3: Remove exported module-level path constants**

In `src/core/config/config.ts`, remove lines 22-25:

```typescript
// DELETE these lines:
export const VIBEN_DIR = path.join(os.homedir(), ".viben");
export const PLUGINS_DIR = path.join(VIBEN_DIR, "plugins");
export const PLUGINS_DATA_DIR = path.join(VIBEN_DIR, "plugins", "data");
export const REGISTRY_PATH = path.join(VIBEN_DIR, "plugins.json");
```

These will be replaced by `InstanceContext.paths` everywhere they're used. Keep the `expandHome` utility function — it's still useful.

- [ ] **Step 4: Run build to find all import breakages**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build 2>&1 | head -60`
Expected: Compilation errors in files that import `VIBEN_DIR`, `PLUGINS_DIR`, `PLUGINS_DATA_DIR`, `REGISTRY_PATH`

Note which files break — these will be fixed in subsequent tasks.

- [ ] **Step 5: Fix imports in main.ts**

In `src/main.ts`, remove the import of `VIBEN_DIR`, `PLUGINS_DATA_DIR`, `REGISTRY_PATH` from config.ts (line 4). These will be replaced with InstanceContext values when we refactor startServer in Task 5.

For now, to keep build passing, add local fallbacks:

```typescript
import path from 'node:path'
import os from 'node:os'

// Temporary — will be replaced by InstanceContext in Task 5
const VIBEN_DIR = path.join(os.homedir(), '.viben')
const PLUGINS_DATA_DIR = path.join(VIBEN_DIR, 'plugins', 'data')
const REGISTRY_PATH = path.join(VIBEN_DIR, 'plugins.json')
```

- [ ] **Step 6: Fix imports in all other files that imported the removed constants**

Files to fix (same pattern — add local fallback const):
- `src/cli/commands/install.ts` — imported `PLUGINS_DIR`
- `src/cli/commands/uninstall.ts` — imported `PLUGINS_DIR`

`src/cli/commands/default.ts` already has its own local constants (lines 6-8) — no change needed.

- [ ] **Step 7: Run build to verify it passes**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: BUILD SUCCESS

- [ ] **Step 8: Run tests to verify nothing broke**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
cd /Users/lucas/viben-workspace/Viben
git add src/core/config/config.ts src/main.ts src/cli/commands/install.ts src/cli/commands/uninstall.ts
git commit -m "feat: add instanceName to config schema, remove global path constants"
```

---

## Task 4: CLI Flag Parsing + Instance Resolution

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Add flag parsing for --local, --global, --dir, --from, --name**

In `src/cli.ts`, add a flag extraction function before the command dispatch:

```typescript
import { resolveInstanceRoot, createInstanceContext, getGlobalRoot, generateSlug } from './core/instance-context.js'
import { InstanceRegistry } from './core/instance-registry.js'
import path from 'node:path'
import fs from 'node:fs'

interface InstanceFlags {
  local: boolean
  global: boolean
  dir?: string
  from?: string
  name?: string
}

function extractInstanceFlags(args: string[]): { flags: InstanceFlags; remaining: string[] } {
  const flags: InstanceFlags = { local: false, global: false }
  const remaining: string[] = []
  let i = 0
  while (i < args.length) {
    if (args[i] === '--local') { flags.local = true; i++ }
    else if (args[i] === '--global') { flags.global = true; i++ }
    else if (args[i] === '--dir' && args[i + 1]) { flags.dir = args[i + 1]; i += 2 }
    else if (args[i] === '--from' && args[i + 1]) { flags.from = args[i + 1]; i += 2 }
    else if (args[i] === '--name' && args[i + 1]) { flags.name = args[i + 1]; i += 2 }
    else { remaining.push(args[i]!); i++ }
  }
  return { flags, remaining }
}
```

- [ ] **Step 2: Integrate flag parsing into main() and pass resolved root to commands**

Update the `main()` function in `src/cli.ts` to extract instance flags first, resolve the root, and pass the context through. For now, resolve the root and store it as a module-level variable that commands can access:

```typescript
// At top of cli.ts after imports
let resolvedInstanceRoot: string | null = null

export function getResolvedInstanceRoot(): string | null {
  return resolvedInstanceRoot
}

// In main():
const allArgs = process.argv.slice(2)
const { flags: instanceFlags, remaining } = extractInstanceFlags(allArgs)
const [command, ...args] = remaining

// Resolve instance root from flags
resolvedInstanceRoot = resolveInstanceRoot({
  dir: instanceFlags.dir,
  local: instanceFlags.local,
  global: instanceFlags.global,
  cwd: process.cwd(),
})
```

Note: When `resolvedInstanceRoot` is null (no flag, no auto-detect), the `default` command will handle prompting. This is done in Task 6.

- [ ] **Step 3: Update --help output to show new flags**

In the `printHelp()` function, add the instance flags to the help text:

```typescript
// Add to the flags section:
console.log('  --local              Use setup in current directory')
console.log('  --global             Use main setup (~/.viben)')
console.log('  --dir <path>         Use setup in specified directory')
console.log('  --from <path>        Copy settings from existing setup (on create)')
console.log('  --name <name>        Set instance name (on create)')
```

- [ ] **Step 4: Run build to verify**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/viben-workspace/Viben
git add src/cli.ts
git commit -m "feat: parse --local, --global, --dir, --from, --name CLI flags"
```

---

## Task 5: Refactor startServer to Accept InstanceContext

**Files:**
- Modify: `src/main.ts`
- Modify: `src/core/core.ts`

- [ ] **Step 1: Update StartServerOptions to include InstanceContext**

In `src/main.ts`, update the interface:

```typescript
import { InstanceContext, createInstanceContext, getGlobalRoot } from './core/instance-context.js'

export interface StartServerOptions {
  devPluginPath?: string
  noWatch?: boolean
  instanceContext?: InstanceContext
}
```

- [ ] **Step 2: Use InstanceContext paths throughout startServer**

At the top of `startServer()`, resolve the context:

```typescript
export async function startServer(opts?: StartServerOptions) {
  const ctx = opts?.instanceContext ?? createInstanceContext({
    id: 'main',
    root: getGlobalRoot(),
    isGlobal: true,
  })

  // Replace hardcoded paths:
  const settingsManager = new SettingsManager(ctx.paths.pluginsData)
  const pluginRegistry = new PluginRegistry(ctx.paths.pluginRegistry)
```

Replace all `path.join(os.homedir(), '.viben', ...)` references in main.ts with `ctx.paths.*`:
- PID file path → `ctx.paths.pid`
- Log dir → `ctx.paths.logs`
- Plugin storage path → `ctx.paths.pluginsData`

Remove the temporary local constants added in Task 3.

- [ ] **Step 3: Update VibenCore to accept InstanceContext**

In `src/core/core.ts`, update the constructor:

```typescript
import { InstanceContext } from './instance-context.js'

// In the constructor, add ctx parameter:
constructor(configManager: ConfigManager, ctx: InstanceContext) {
  // ...
  const storePath = ctx.paths.sessions  // was: path.join(os.homedir(), ".viben", "sessions.json")
  this.sessionStore = new JsonFileSessionStore(storePath, config.sessionStore.ttlDays)
  // ...
  // LifecycleManager storagePath:
  storagePath: ctx.paths.pluginsData,  // was: path.join(os.homedir(), ".viben", "plugins", "data")
}
```

- [ ] **Step 4: Update startServer to pass ctx to VibenCore**

```typescript
const core = new VibenCore(configManager, ctx)
```

- [ ] **Step 5: Pass ConfigManager the config path from ctx**

```typescript
const configManager = new ConfigManager(ctx.paths.config)
```

- [ ] **Step 6: Run build to verify**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: BUILD SUCCESS

- [ ] **Step 7: Run tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test`
Expected: ALL PASS (existing tests still use default paths)

- [ ] **Step 8: Commit**

```bash
cd /Users/lucas/viben-workspace/Viben
git add src/main.ts src/core/core.ts
git commit -m "feat: pass InstanceContext through startServer → VibenCore"
```

---

## Task 6: Refactor CLI Commands to Use InstanceContext

**Files:**
- Modify: `src/cli/daemon.ts`
- Modify: `src/cli/api-client.ts`
- Modify: `src/cli/commands/default.ts`
- Modify: `src/cli/commands/start.ts`
- Modify: `src/cli/commands/stop.ts`
- Modify: `src/cli/commands/plugins.ts`
- Modify: `src/cli/commands/install.ts`
- Modify: `src/cli/commands/uninstall.ts`
- Modify: `src/cli/commands/reset.ts`

- [ ] **Step 1: Refactor daemon.ts — accept paths as parameters**

Remove module-level constants (lines 7-9). Update all functions to accept path parameters:

```typescript
// Old:
const DEFAULT_PID_PATH = path.join(os.homedir(), '.viben', 'viben.pid')
const DEFAULT_LOG_DIR = path.join(os.homedir(), '.viben', 'logs')
const RUNNING_MARKER = path.join(os.homedir(), '.viben', 'running')

// New: Remove these constants. Update function signatures:
export function getPidPath(root?: string): string {
  const base = root ?? path.join(os.homedir(), '.viben')
  return path.join(base, 'viben.pid')
}

export function getLogDir(root?: string): string {
  const base = root ?? path.join(os.homedir(), '.viben')
  return path.join(base, 'logs')
}

export function getRunningMarker(root?: string): string {
  const base = root ?? path.join(os.homedir(), '.viben')
  return path.join(base, 'running')
}
```

Update `startDaemon`, `stopDaemon`, `getStatus`, `markRunning`, `clearRunning`, `shouldAutoStart` to use these functions with an optional `root` parameter.

For `startDaemon`: pass the instance root as an environment variable to the child process so the daemon child knows which instance to run:

```typescript
export function startDaemon(pidPath: string, logDir: string, instanceRoot?: string) {
  // ... existing logic ...
  const child = spawn(process.execPath, [cliPath, '--daemon-child'], {
    // ... existing options ...
    env: {
      ...process.env,
      ...(instanceRoot ? { VIBEN_INSTANCE_ROOT: instanceRoot } : {}),
    },
  })
}
```

- [ ] **Step 2: Refactor api-client.ts — accept paths as parameters**

Remove module-level constants (lines 5-6). Update functions:

```typescript
// Old:
const DEFAULT_PORT_FILE = path.join(os.homedir(), '.viben', 'api.port')
const DEFAULT_SECRET_FILE = path.join(os.homedir(), '.viben', 'api-secret')

// New: Add optional root parameter to each function
export async function readApiPort(portFile?: string): Promise<number | null> {
  const file = portFile ?? path.join(os.homedir(), '.viben', 'api.port')
  // ... rest unchanged
}

export async function readApiSecret(secretFile?: string): Promise<string | null> {
  const file = secretFile ?? path.join(os.homedir(), '.viben', 'api-secret')
  // ... rest unchanged
}
```

- [ ] **Step 3: Refactor default.ts — use InstanceContext**

Remove module-level constants (lines 6-8). Update `cmdDefault` to accept and use the resolved instance root:

```typescript
import { createInstanceContext, getGlobalRoot, resolveInstanceRoot } from '../../core/instance-context.js'
import { InstanceRegistry } from '../../core/instance-registry.js'
import type { InstanceContext } from '../../core/instance-context.js'

export async function cmdDefault(command?: string, instanceRoot?: string | null, instanceFlags?: { from?: string; name?: string }): Promise<void> {
  // ... existing command validation ...

  // If instanceRoot is null, we need to prompt
  let root: string
  if (instanceRoot === null) {
    const globalRoot = getGlobalRoot()
    const globalExists = fs.existsSync(path.join(globalRoot, 'config.json'))

    if (!globalExists) {
      // No global setup exists — create it (same as current behavior)
      root = globalRoot
    } else {
      // Prompt: use existing or create new here
      const { select } = await import('@clack/prompts')
      const choice = await select({
        message: 'How would you like to run Viben?',
        options: [
          { value: 'global', label: `Use existing setup (${globalRoot})` },
          { value: 'local', label: `Create a new setup here (${process.cwd()})` },
        ],
      })
      if (choice === 'local') {
        root = path.join(process.cwd(), '.viben')
      } else {
        root = globalRoot
      }
    }
  } else {
    root = instanceRoot
  }

  // Create InstanceContext
  // ... load or create registry entry, resolve id ...
  // ... rest of startup logic using ctx ...
}
```

- [ ] **Step 4: Update start.ts to pass instance root to daemon**

```typescript
export async function cmdStart(args: string[] = [], instanceRoot?: string): Promise<void> {
  // ... existing logic ...
  const root = instanceRoot ?? path.join(os.homedir(), '.viben')
  const result = startDaemon(getPidPath(root), getLogDir(root), root)
  // ...
}
```

- [ ] **Step 5: Update stop.ts to use instance root**

```typescript
export async function cmdStop(args: string[] = [], instanceRoot?: string): Promise<void> {
  // ... existing logic ...
  const root = instanceRoot ?? path.join(os.homedir(), '.viben')
  const result = await stopDaemon(getPidPath(root))
  // ...
}
```

- [ ] **Step 6: Update plugins.ts, install.ts, uninstall.ts, reset.ts**

Replace all `path.join(os.homedir(), '.viben', ...)` with paths derived from the instance root. These functions should accept an optional `instanceRoot` parameter, defaulting to `~/.viben`.

- [ ] **Step 7: Update cli.ts to pass resolved root to command handlers**

In `src/cli.ts`, pass the resolved root and instance flags to each command:

```typescript
const commands: Record<string, () => Promise<void>> = {
  'start': () => cmdStart(args, resolvedInstanceRoot ?? getGlobalRoot()),
  'stop': () => cmdStop(args, resolvedInstanceRoot ?? getGlobalRoot()),
  'status': () => cmdStatus(args, resolvedInstanceRoot),
  'plugins': () => cmdPlugins(args, resolvedInstanceRoot ?? getGlobalRoot()),
  'install': () => cmdInstall(args, resolvedInstanceRoot ?? getGlobalRoot()),
  'uninstall': () => cmdUninstall(args, resolvedInstanceRoot ?? getGlobalRoot()),
  'reset': () => cmdReset(args, resolvedInstanceRoot ?? getGlobalRoot()),
  // ... etc
  '--daemon-child': async () => {
    const { startServer } = await import('./main.js')
    // Read instance root from env (set by startDaemon)
    const envRoot = process.env.VIBEN_INSTANCE_ROOT
    const ctx = envRoot
      ? createInstanceContext({ id: 'unknown', root: envRoot, isGlobal: envRoot === getGlobalRoot() })
      : undefined
    await startServer(ctx ? { instanceContext: ctx } : undefined)
  },
}
```

- [ ] **Step 8: Run build and tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build && pnpm test`
Expected: BUILD SUCCESS, ALL PASS

- [ ] **Step 9: Commit**

```bash
cd /Users/lucas/viben-workspace/Viben
git add src/cli.ts src/cli/daemon.ts src/cli/api-client.ts src/cli/commands/
git commit -m "feat: refactor CLI commands to accept instance root parameter"
```

---

## Task 7: Refactor Plugins to Accept Paths from Context

**Files:**
- Modify: `src/plugins/api-server/api-server.ts`
- Modify: `src/plugins/api-server/index.ts`
- Modify: `src/plugins/tunnel/tunnel-registry.ts`
- Modify: `src/plugins/tunnel/index.ts`
- Modify: `src/plugins/context/context-manager.ts`
- Modify: `src/plugins/file-service/index.ts`
- Modify: `src/core/agents/agent-catalog.ts`
- Modify: `src/core/agents/agent-installer.ts`
- Modify: `src/core/utils/install-binary.ts`
- Modify: `src/core/plugin/types.ts`

- [ ] **Step 1: Add InstanceContext to PluginContext**

In `src/core/plugin/lifecycle-manager.ts`, store the instance context and pass it through to each plugin's `PluginContext`. The `PluginContext` already receives `storagePath` — add `instanceRoot` so plugins that need non-standard paths can access them:

Find where PluginContext is created (in `boot()` method, around line 246) and add:

```typescript
// In LifecycleManagerOpts, add:
instanceContext?: InstanceContext

// In PluginContext creation:
instanceRoot: this.opts.instanceContext?.root ?? path.join(os.homedir(), '.viben'),
```

- [ ] **Step 2: Refactor api-server to receive port/secret paths**

In `src/plugins/api-server/api-server.ts`, remove module-level constant (line 23):

```typescript
// DELETE:
const DEFAULT_PORT_FILE = path.join(os.homedir(), ".viben", "api.port");

// Update ApiServer constructor to accept portFilePath and secretFilePath:
// Already accepts these as optional params — just need to update the default
constructor(core: VibenCore, config: ApiConfig, portFilePath?: string, secretFilePath?: string) {
  this.portFilePath = portFilePath ?? path.join(os.homedir(), '.viben', 'api.port')
  this.secretFilePath = secretFilePath ?? path.join(os.homedir(), '.viben', 'api-secret')
}
```

In `src/plugins/api-server/index.ts`, pass paths from PluginContext:

```typescript
// In setup():
const instanceRoot = ctx.instanceRoot ?? path.join(os.homedir(), '.viben')
server = new ApiServer(ctx.core, apiConfig,
  path.join(instanceRoot, 'api.port'),
  path.join(instanceRoot, 'api-secret'),
)
```

- [ ] **Step 3: Add API server port auto-detect**

In `src/plugins/api-server/api-server.ts`, in the `start()` method, add retry logic similar to tunnel service:

```typescript
async start(): Promise<void> {
  let actualPort = this.config.port
  const isPinned = this.config.port !== 0 // 0 means auto-detect

  if (!isPinned) {
    // Auto-detect: try default port, then increment
    const basePort = 21420
    const maxRetries = 10
    for (let i = 0; i < maxRetries; i++) {
      const port = basePort + i
      try {
        // attempt to listen on port
        await this.tryListen(port)
        actualPort = port
        break
      } catch {
        if (i === maxRetries - 1) throw new Error(`Could not find available port (tried ${basePort}-${basePort + maxRetries - 1})`)
      }
    }
  }

  // Write actual port to file
  fs.writeFileSync(this.portFilePath, String(actualPort))
  // ... existing listen logic ...
}
```

- [ ] **Step 4: Refactor tunnel-registry.ts**

Remove module-level constant (line 39):

```typescript
// DELETE:
const REGISTRY_PATH = path.join(os.homedir(), '.viben', 'tunnels.json')

// Update TunnelRegistry constructor to accept path:
constructor(registryPath?: string) {
  this.registryPath = registryPath ?? path.join(os.homedir(), '.viben', 'tunnels.json')
}
```

In `src/plugins/tunnel/index.ts`, pass the path:

```typescript
// In setup():
const instanceRoot = ctx.instanceRoot ?? path.join(os.homedir(), '.viben')
const registry = new TunnelRegistry(path.join(instanceRoot, 'tunnels.json'))
```

- [ ] **Step 5: Refactor agent-catalog.ts, agent-installer.ts, install-binary.ts**

Same pattern — remove module-level constants, accept as parameters:

`src/core/agents/agent-catalog.ts`:
```typescript
// DELETE: const CACHE_PATH = path.join(os.homedir(), ".viben", "registry-cache.json");
// Update constructor/function to accept cachePath parameter
```

`src/core/agents/agent-installer.ts`:
```typescript
// DELETE: const AGENTS_DIR = path.join(os.homedir(), ".viben", "agents");
// Update to accept agentsDir parameter
```

`src/core/utils/install-binary.ts`:
```typescript
// DELETE: const BIN_DIR = path.join(os.homedir(), '.viben', 'bin')
// Update ensureBinary to accept binDir parameter
```

Pass these from `VibenCore` or `LifecycleManager` using `ctx.paths.*`.

- [ ] **Step 6: Add inheritableKeys to VibenPlugin type**

In `src/core/plugin/types.ts`, add to the `VibenPlugin` interface:

```typescript
/** Settings keys that can be copied when creating a new instance from this one */
inheritableKeys?: string[]
```

- [ ] **Step 7: Add inheritableKeys to each built-in plugin**

Update each plugin's definition object:

- `src/plugins/telegram/index.ts`: `inheritableKeys: []` (nothing inheritable — bot tokens are per-instance)
- `src/plugins/tunnel/index.ts`: `inheritableKeys: ['provider', 'maxUserTunnels', 'auth']`
- `src/plugins/api-server/index.ts`: `inheritableKeys: ['host']`
- `src/plugins/security/index.ts`: `inheritableKeys: ['allowedUsers', 'maxSessionsPerUser', 'rateLimits']`
- `src/plugins/usage/index.ts`: `inheritableKeys: ['budget']`
- `src/plugins/speech/index.ts`: `inheritableKeys: ['tts']`
- Discord and Slack: `inheritableKeys: []`

- [ ] **Step 8: Run build and tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build && pnpm test`
Expected: BUILD SUCCESS, ALL PASS

- [ ] **Step 9: Commit**

```bash
cd /Users/lucas/viben-workspace/Viben
git add src/plugins/ src/core/agents/ src/core/utils/ src/core/plugin/
git commit -m "feat: refactor plugins and agents to accept paths from InstanceContext"
```

---

## Task 8: Instance Copy Logic with Progress

**Files:**
- Create: `src/core/instance-copy.ts`
- Create: `src/core/__tests__/instance-copy.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/core/__tests__/instance-copy.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { copyInstance } from '../instance-copy.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('copyInstance', () => {
  let srcDir: string
  let dstDir: string

  beforeEach(() => {
    const base = path.join(os.tmpdir(), `test-copy-${Date.now()}`)
    srcDir = path.join(base, 'src', '.viben')
    dstDir = path.join(base, 'dst', '.viben')

    // Create source structure
    fs.mkdirSync(path.join(srcDir, 'plugins', 'data', '@viben', 'tunnel'), { recursive: true })
    fs.mkdirSync(path.join(srcDir, 'plugins', 'node_modules', 'some-plugin'), { recursive: true })
    fs.mkdirSync(path.join(srcDir, 'agents', 'cline'), { recursive: true })
    fs.mkdirSync(path.join(srcDir, 'bin'), { recursive: true })

    fs.writeFileSync(path.join(srcDir, 'config.json'), JSON.stringify({
      instanceName: 'Main',
      channels: { telegram: { botToken: 'secret' } },
      api: { port: 21420 },
    }))
    fs.writeFileSync(path.join(srcDir, 'plugins.json'), JSON.stringify({ installed: { '@viben/tunnel': {} } }))
    fs.writeFileSync(path.join(srcDir, 'plugins', 'package.json'), '{}')
    fs.writeFileSync(path.join(srcDir, 'plugins', 'node_modules', 'some-plugin', 'index.js'), 'module.exports = {}')
    fs.writeFileSync(path.join(srcDir, 'agents.json'), JSON.stringify({ version: 1, installed: {} }))
    fs.writeFileSync(path.join(srcDir, 'agents', 'cline', 'binary'), 'fake-binary')
    fs.writeFileSync(path.join(srcDir, 'bin', 'cloudflared'), 'fake-binary')
    fs.writeFileSync(path.join(srcDir, 'plugins', 'data', '@viben', 'tunnel', 'settings.json'),
      JSON.stringify({ provider: 'cloudflare', port: 3100, maxUserTunnels: 5 }))
  })

  afterEach(() => {
    const base = path.dirname(path.dirname(srcDir))
    fs.rmSync(base, { recursive: true, force: true })
  })

  it('copies config.json with port fields reset', async () => {
    await copyInstance(srcDir, dstDir, {})
    const config = JSON.parse(fs.readFileSync(path.join(dstDir, 'config.json'), 'utf-8'))
    expect(config.instanceName).toBeUndefined() // Name should be removed — set during setup
    expect(config.api?.port).toBeUndefined() // Port reset
  })

  it('copies plugins.json', async () => {
    await copyInstance(srcDir, dstDir, {})
    expect(fs.existsSync(path.join(dstDir, 'plugins.json'))).toBe(true)
  })

  it('copies plugins/node_modules', async () => {
    await copyInstance(srcDir, dstDir, {})
    expect(fs.existsSync(path.join(dstDir, 'plugins', 'node_modules', 'some-plugin', 'index.js'))).toBe(true)
  })

  it('copies agents directory', async () => {
    await copyInstance(srcDir, dstDir, {})
    expect(fs.existsSync(path.join(dstDir, 'agents', 'cline', 'binary'))).toBe(true)
  })

  it('copies bin directory', async () => {
    await copyInstance(srcDir, dstDir, {})
    expect(fs.existsSync(path.join(dstDir, 'bin', 'cloudflared'))).toBe(true)
  })

  it('filters plugin settings by inheritableKeys', async () => {
    const inheritableMap = { '@viben/tunnel': ['provider', 'maxUserTunnels'] }
    await copyInstance(srcDir, dstDir, { inheritableKeys: inheritableMap })
    const settings = JSON.parse(fs.readFileSync(
      path.join(dstDir, 'plugins', 'data', '@viben', 'tunnel', 'settings.json'), 'utf-8'
    ))
    expect(settings.provider).toBe('cloudflare')
    expect(settings.maxUserTunnels).toBe(5)
    expect(settings.port).toBeUndefined() // Not in inheritableKeys
  })

  it('does not copy sessions, logs, cache, PID, or runtime files', async () => {
    fs.writeFileSync(path.join(srcDir, 'sessions.json'), '{}')
    fs.mkdirSync(path.join(srcDir, 'logs'), { recursive: true })
    fs.writeFileSync(path.join(srcDir, 'viben.pid'), '12345')
    fs.writeFileSync(path.join(srcDir, 'api.port'), '21420')

    await copyInstance(srcDir, dstDir, {})
    expect(fs.existsSync(path.join(dstDir, 'sessions.json'))).toBe(false)
    expect(fs.existsSync(path.join(dstDir, 'logs'))).toBe(false)
    expect(fs.existsSync(path.join(dstDir, 'viben.pid'))).toBe(false)
    expect(fs.existsSync(path.join(dstDir, 'api.port'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/__tests__/instance-copy.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement instance-copy.ts**

```typescript
// src/core/instance-copy.ts
import fs from 'node:fs'
import path from 'node:path'

export interface CopyOptions {
  inheritableKeys?: Record<string, string[]>  // pluginName → allowed keys
  onProgress?: (step: string, status: 'start' | 'done') => void
}

export async function copyInstance(src: string, dst: string, opts: CopyOptions): Promise<void> {
  const { inheritableKeys = {}, onProgress } = opts

  fs.mkdirSync(dst, { recursive: true })

  // 1. config.json — copy with port fields and instanceName removed
  const configSrc = path.join(src, 'config.json')
  if (fs.existsSync(configSrc)) {
    onProgress?.('Configuration', 'start')
    const config = JSON.parse(fs.readFileSync(configSrc, 'utf-8'))
    delete config.instanceName
    if (config.api) delete config.api.port
    if (config.tunnel) delete config.tunnel.port
    fs.writeFileSync(path.join(dst, 'config.json'), JSON.stringify(config, null, 2))
    onProgress?.('Configuration', 'done')
  }

  // 2. plugins.json
  const pluginsSrc = path.join(src, 'plugins.json')
  if (fs.existsSync(pluginsSrc)) {
    onProgress?.('Plugin list', 'start')
    fs.copyFileSync(pluginsSrc, path.join(dst, 'plugins.json'))
    onProgress?.('Plugin list', 'done')
  }

  // 3. plugins/ (package.json + node_modules)
  const pluginsDir = path.join(src, 'plugins')
  if (fs.existsSync(pluginsDir)) {
    onProgress?.('Plugins', 'start')
    const dstPlugins = path.join(dst, 'plugins')
    fs.mkdirSync(dstPlugins, { recursive: true })

    const pkgJson = path.join(pluginsDir, 'package.json')
    if (fs.existsSync(pkgJson)) {
      fs.copyFileSync(pkgJson, path.join(dstPlugins, 'package.json'))
    }

    const nodeModules = path.join(pluginsDir, 'node_modules')
    if (fs.existsSync(nodeModules)) {
      cpRecursive(nodeModules, path.join(dstPlugins, 'node_modules'))
    }
    onProgress?.('Plugins', 'done')
  }

  // 4. agents.json + agents/
  const agentsJson = path.join(src, 'agents.json')
  if (fs.existsSync(agentsJson)) {
    onProgress?.('Agents', 'start')
    fs.copyFileSync(agentsJson, path.join(dst, 'agents.json'))
    const agentsDir = path.join(src, 'agents')
    if (fs.existsSync(agentsDir)) {
      cpRecursive(agentsDir, path.join(dst, 'agents'))
    }
    onProgress?.('Agents', 'done')
  }

  // 5. bin/
  const binDir = path.join(src, 'bin')
  if (fs.existsSync(binDir)) {
    onProgress?.('Tools', 'start')
    cpRecursive(binDir, path.join(dst, 'bin'))
    onProgress?.('Tools', 'done')
  }

  // 6. Plugin settings — filter by inheritableKeys
  const pluginDataSrc = path.join(src, 'plugins', 'data')
  if (fs.existsSync(pluginDataSrc)) {
    onProgress?.('Preferences', 'start')
    copyPluginSettings(pluginDataSrc, path.join(dst, 'plugins', 'data'), inheritableKeys)
    onProgress?.('Preferences', 'done')
  }
}

function copyPluginSettings(srcData: string, dstData: string, inheritableKeys: Record<string, string[]>): void {
  // Walk plugin data directories looking for settings.json
  walkPluginDirs(srcData, (pluginName, settingsPath) => {
    const allowedKeys = inheritableKeys[pluginName]
    if (!allowedKeys || allowedKeys.length === 0) return

    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      const filtered: Record<string, unknown> = {}
      for (const key of allowedKeys) {
        if (key in settings) filtered[key] = settings[key]
      }
      if (Object.keys(filtered).length > 0) {
        const relative = path.relative(srcData, path.dirname(settingsPath))
        const dstDir = path.join(dstData, relative)
        fs.mkdirSync(dstDir, { recursive: true })
        fs.writeFileSync(path.join(dstDir, 'settings.json'), JSON.stringify(filtered, null, 2))
      }
    } catch {
      // Skip invalid settings files
    }
  })
}

function walkPluginDirs(base: string, cb: (pluginName: string, settingsPath: string) => void): void {
  if (!fs.existsSync(base)) return
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('@')) {
        // Scoped package — go one level deeper
        const scopeDir = path.join(base, entry.name)
        for (const sub of fs.readdirSync(scopeDir, { withFileTypes: true })) {
          if (sub.isDirectory()) {
            const pluginName = `${entry.name}/${sub.name}`
            const settingsPath = path.join(scopeDir, sub.name, 'settings.json')
            if (fs.existsSync(settingsPath)) cb(pluginName, settingsPath)
          }
        }
      } else {
        const pluginName = entry.name
        const settingsPath = path.join(base, entry.name, 'settings.json')
        if (fs.existsSync(settingsPath)) cb(pluginName, settingsPath)
      }
    }
  }
}

function cpRecursive(src: string, dst: string): void {
  fs.cpSync(src, dst, { recursive: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/__tests__/instance-copy.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/viben-workspace/Viben
git add src/core/instance-copy.ts src/core/__tests__/instance-copy.test.ts
git commit -m "feat: add instance copy logic with progress callback"
```

---

## Task 9: Setup Wizard — Name Prompt, Copy Flow, Partial Setup

**Files:**
- Modify: `src/core/setup/wizard.ts`

- [ ] **Step 1: Add instance name prompt to setup flow**

In `runSetup()`, before channel configuration, add a name prompt:

```typescript
import { InstanceRegistry } from '../instance-registry.js'
import { generateSlug, getGlobalRoot } from '../instance-context.js'
import { copyInstance } from '../instance-copy.js'

// At the start of runSetup, after the banner:
let instanceName: string | undefined = opts?.instanceName

if (!instanceName) {
  const isGlobal = configManager.getConfigPath() === path.join(getGlobalRoot(), 'config.json')
  const defaultName = isGlobal ? 'Main' : `viben-${nextInstanceNumber(registry)}`
  const nameResult = await terminal.text({
    message: 'Give this setup a name',
    defaultValue: defaultName,
    validate: (v) => (!v.trim() ? 'Name cannot be empty' : undefined),
  })
  if (typeof nameResult === 'symbol') return false
  instanceName = nameResult.trim()
}
```

- [ ] **Step 2: Add copy-from flow**

After the name prompt, check if there are existing instances to copy from:

```typescript
// Load instance registry
const registryPath = path.join(getGlobalRoot(), 'instances.json')
const registry = new InstanceRegistry(registryPath)
await registry.load()

const existingInstances = registry.list().filter(e => fs.existsSync(path.join(e.root, 'config.json')))

if (existingInstances.length > 0 && !opts?.from) {
  const shouldCopy = await terminal.confirm({
    message: 'Use settings from an existing setup as a starting point?',
    initialValue: true,
  })

  if (shouldCopy === true) {
    let sourceRoot: string
    if (existingInstances.length === 1) {
      sourceRoot = existingInstances[0]!.root
    } else {
      const choice = await terminal.select({
        message: 'Which setup to copy from?',
        options: existingInstances.map(e => {
          const name = readInstanceName(e.root) ?? e.id
          return { value: e.root, label: `${name} (${e.root})` }
        }),
      })
      if (typeof choice === 'symbol') return false
      sourceRoot = choice
    }

    // Build inheritableKeys map from loaded plugins
    const inheritableMap = buildInheritableKeysMap(pluginRegistry)

    // Copy with progress
    const spinner = terminal.spinner()
    await copyInstance(sourceRoot, configManager.getDir(), {
      inheritableKeys: inheritableMap,
      onProgress: (step, status) => {
        if (status === 'start') spinner.start(step)
        else spinner.stop(`${step}`)
      },
    })
  }
}
```

- [ ] **Step 3: Add --from flag support**

If `opts.from` is provided, validate and copy from it directly:

```typescript
if (opts?.from) {
  const fromRoot = path.join(opts.from, '.viben')
  if (!fs.existsSync(path.join(fromRoot, 'config.json'))) {
    console.error(`Error: No Viben setup found at ${fromRoot}`)
    return false
  }
  const inheritableMap = buildInheritableKeysMap(pluginRegistry)
  await copyInstance(fromRoot, configManager.getDir(), { inheritableKeys: inheritableMap })
}
```

- [ ] **Step 4: Detect partial setup and skip configured fields**

After copying, the wizard should detect which channels already have valid config and skip asking for their tokens:

```typescript
// After copy, reload config to see what was copied
if (await configManager.exists()) {
  await configManager.load()
  const config = configManager.get()
  // Skip channel setup for channels that already have tokens
  // Only ask for channels where botToken is missing
}
```

- [ ] **Step 5: Set instanceName in final config**

Before writing config, set the instance name:

```typescript
// In the config object construction:
const configObj = {
  ...existingConfig,
  instanceName,
  // ... rest of config
}
```

- [ ] **Step 6: Register new instance in registry**

After setup completes:

```typescript
const id = registry.uniqueId(generateSlug(instanceName))
const instanceRoot = configManager.getDir()  // The .viben directory
registry.register(id, instanceRoot)
await registry.save()
```

- [ ] **Step 7: Update runSetup signature**

```typescript
export async function runSetup(
  configManager: ConfigManager,
  opts?: {
    skipRunMode?: boolean
    settingsManager?: SettingsManager
    pluginRegistry?: PluginRegistry
    instanceName?: string
    from?: string
  },
): Promise<boolean>
```

- [ ] **Step 8: Run build and tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build && pnpm test`
Expected: BUILD SUCCESS, ALL PASS

- [ ] **Step 9: Commit**

```bash
cd /Users/lucas/viben-workspace/Viben
git add src/core/setup/wizard.ts
git commit -m "feat: add instance naming, copy flow, and partial setup to wizard"
```

---

## Task 10: Status --all and --id Commands

**Files:**
- Modify: `src/cli/commands/status.ts`

- [ ] **Step 1: Implement status --all**

Rewrite `cmdStatus` to support `--all` and `--id` flags:

```typescript
import { InstanceRegistry } from '../../core/instance-registry.js'
import { getGlobalRoot } from '../../core/instance-context.js'
import fs from 'node:fs'
import path from 'node:path'

export async function cmdStatus(args: string[] = [], instanceRoot?: string | null): Promise<void> {
  if (args.includes('--all')) {
    await showAllInstances()
    return
  }

  const idFlag = args.indexOf('--id')
  if (idFlag !== -1 && args[idFlag + 1]) {
    await showInstanceById(args[idFlag + 1]!)
    return
  }

  // Default: show status of current instance
  const root = instanceRoot ?? getGlobalRoot()
  await showInstanceStatus(root)
}

async function showAllInstances(): Promise<void> {
  const registryPath = path.join(getGlobalRoot(), 'instances.json')
  const registry = new InstanceRegistry(registryPath)
  await registry.load()

  const instances = registry.list()
  if (instances.length === 0) {
    console.log('No instances registered.')
    return
  }

  // Table header
  console.log('')
  console.log('  Status     ID               Name             Directory            Mode     Channels   API    Tunnel')
  console.log('  ' + '─'.repeat(95))

  for (const entry of instances) {
    const info = readInstanceInfo(entry.root)
    const status = info.pid ? '● online' : '○ offline'
    const mode = info.pid ? (info.runMode === 'daemon' ? 'daemon' : 'fg') : '—'
    const api = info.apiPort ? String(info.apiPort) : '—'
    const tunnel = info.tunnelPort ? String(info.tunnelPort) : '—'
    const dir = entry.root.replace(/\/.viben$/, '').replace(os.homedir(), '~')
    const channels = info.channels.join(', ') || '—'

    console.log(`  ${status.padEnd(10)} ${entry.id.padEnd(16)} ${(info.name ?? entry.id).padEnd(16)} ${dir.padEnd(20)} ${mode.padEnd(8)} ${channels.padEnd(10)} ${api.padEnd(6)} ${tunnel}`)
  }
  console.log('')
}

function readInstanceInfo(root: string): {
  name: string | null; pid: number | null; apiPort: number | null;
  tunnelPort: number | null; runMode: string | null; channels: string[]
} {
  const result = { name: null as string | null, pid: null as number | null, apiPort: null as number | null, tunnelPort: null as number | null, runMode: null as string | null, channels: [] as string[] }

  // Read name from config
  try {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf-8'))
    result.name = config.instanceName ?? null
    result.runMode = config.runMode ?? null
  } catch {}

  // Read PID and check if alive
  try {
    const pid = parseInt(fs.readFileSync(path.join(root, 'viben.pid'), 'utf-8').trim())
    process.kill(pid, 0) // Check if alive (throws if dead)
    result.pid = pid
  } catch {}

  // Read API port
  try {
    result.apiPort = parseInt(fs.readFileSync(path.join(root, 'api.port'), 'utf-8').trim())
  } catch {}

  // Read tunnel port from tunnels.json
  try {
    const tunnels = JSON.parse(fs.readFileSync(path.join(root, 'tunnels.json'), 'utf-8'))
    const systemEntry = Object.values(tunnels).find((t: any) => t.type === 'system') as any
    if (systemEntry) result.tunnelPort = systemEntry.port
  } catch {}

  // Read channels from plugins.json
  try {
    const plugins = JSON.parse(fs.readFileSync(path.join(root, 'plugins.json'), 'utf-8'))
    const adapters = ['@viben/telegram', '@viben/discord', '@viben/slack']
    for (const name of adapters) {
      if (plugins.installed?.[name]?.enabled !== false) {
        result.channels.push(name.replace('@viben/', ''))
      }
    }
  } catch {}

  return result
}
```

- [ ] **Step 2: Run build**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
cd /Users/lucas/viben-workspace/Viben
git add src/cli/commands/status.ts
git commit -m "feat: add status --all and --id for multi-instance overview"
```

---

## Task 11: Auto-Register Global Instance on First Run + Migration

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Auto-register global instance in registry**

At the end of `startServer()`, after successful boot, register the current instance:

```typescript
import { InstanceRegistry } from './core/instance-registry.js'

// After core.start():
const registry = new InstanceRegistry(path.join(getGlobalRoot(), 'instances.json'))
await registry.load()

if (!registry.getByRoot(ctx.root)) {
  registry.register(ctx.id, ctx.root)
  await registry.save()
}
```

This ensures existing users who upgrade get their global instance registered automatically.

- [ ] **Step 2: Add instanceName migration**

In config migrations, add a migration that sets `instanceName: "Main"` for existing global configs that don't have it:

```typescript
// In config-migrations.ts, add a new migration:
{
  name: 'add-instance-name',
  test: (config: any) => !config.instanceName,
  migrate: (config: any) => {
    config.instanceName = 'Main'
    return config
  },
}
```

- [ ] **Step 3: Run build and tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build && pnpm test`
Expected: BUILD SUCCESS, ALL PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/lucas/viben-workspace/Viben
git add src/main.ts src/core/config/config-migrations.ts
git commit -m "feat: auto-register global instance and migrate instanceName"
```

---

## Task 12: Remaining Plugin Path References Cleanup

**Files:**
- Modify: `src/plugins/context/context-manager.ts`
- Modify: `src/plugins/context/index.ts`
- Modify: `src/plugins/file-service/index.ts`
- Modify: `src/plugins/tunnel/providers/cloudflare.ts`
- Modify: `src/core/doctor/checks/tunnel.ts`
- Modify: `src/cli/commands/plugins.ts`
- Modify: `src/core/config/config-editor.ts`
- Modify: `src/core/config/config-registry.ts`
- Modify: `src/core/setup/setup-channels.ts`
- Modify: `src/core/plugin/plugin-installer.ts`
- Modify: `src/core/doctor/index.ts`
- Modify: `src/cli/autostart.ts`

- [ ] **Step 1: Search for all remaining os.homedir + .viben references**

Run: `cd /Users/lucas/viben-workspace/Viben && grep -rn "\.viben" src/ --include="*.ts" | grep -v "__tests__" | grep -v "node_modules" | grep -v ".test.ts"`

For each file found that still has a hardcoded `~/.viben` path used at runtime:
- If inside a function that has access to PluginContext → use `ctx.instanceRoot` or `ctx.storage`
- If inside a function that receives parameters → add optional parameter with default fallback
- If in a CLI command → use the instance root parameter from Task 6

- [ ] **Step 2: Fix context plugin**

`src/plugins/context/context-manager.ts` — uses `path.join(os.homedir(), ".viben", "cache", "entire")` in constructor. Use `ctx.storage.getDataDir()` or accept path param.

`src/plugins/context/index.ts` — uses `path.join(os.homedir(), '.viben', 'history')`. Use storage from PluginContext.

- [ ] **Step 3: Fix file-service plugin**

Uses `os.homedir()` + `.viben` in multiple places. These should use `ctx.instanceRoot` via PluginContext.

- [ ] **Step 4: Fix cloudflare provider**

`src/plugins/tunnel/providers/cloudflare.ts` — uses `path.join(os.homedir(), '.viben', 'bin', 'cloudflared')`. Should use `binDir` passed from tunnel plugin setup.

- [ ] **Step 5: Fix remaining CLI and core files**

- `src/cli/commands/plugins.ts` — many hardcoded paths inside functions. Pass instance root.
- `src/core/config/config-editor.ts` — hardcoded paths inside functions.
- `src/core/doctor/` — hardcoded paths.
- `src/core/plugin/plugin-installer.ts` — hardcoded plugin install dir.
- `src/cli/autostart.ts` — launchd/systemd paths are system-level, should stay global.

- [ ] **Step 6: Run full grep to confirm no remaining hardcoded paths**

Run: `cd /Users/lucas/viben-workspace/Viben && grep -rn "os.homedir().*\.viben" src/ --include="*.ts" | grep -v "__tests__" | grep -v ".test.ts"`
Expected: Only `autostart.ts` and possibly template/documentation files.

- [ ] **Step 7: Run build and full test suite**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build && pnpm test`
Expected: BUILD SUCCESS, ALL PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/lucas/viben-workspace/Viben
git add src/
git commit -m "feat: remove all remaining hardcoded ~/.viben paths"
```

---

## Task 13: End-to-End Verification

- [ ] **Step 1: Manual test — default behavior unchanged**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build && node dist/cli.js --help`
Expected: Help text shows new flags (--local, --global, --dir, --from, --name)

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Build for publish**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build:publish`
Expected: BUILD SUCCESS

- [ ] **Step 4: Final commit if any remaining changes**

```bash
cd /Users/lucas/viben-workspace/Viben
git status
# If clean, nothing to do. If changes, add and commit.
```
