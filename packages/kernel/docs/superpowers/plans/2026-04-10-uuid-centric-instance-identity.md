# UUID-Centric Instance Identity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store each instance's UUID inside its own `config.json` so every instance knows its own identity without consulting the registry.

**Architecture:** Add `id` field to `ConfigSchema` and `InitInstanceOptions`. All creation paths (`cmdSetup`, `cmdInstancesCreate`, wizard) write `id` into `config.json`. A migration backfills `id` from the registry for existing instances. `resolveInstanceId` reads `config.json` first. `copyInstance` strips `id` so copies never share a UUID.

**Tech Stack:** TypeScript, Node.js ESM, Vitest, Zod

---

## Files Changed

| File | Change |
|---|---|
| `src/core/config/config.ts` | Add `id: z.string().optional()` to `ConfigSchema` |
| `src/core/config/config-migrations.ts` | Add `fs`, `path`, `os` imports + `add-instance-id` migration |
| `src/core/instance/instance-init.ts` | Add `id?` to `InitInstanceOptions`; write `id` in `writeConfig` |
| `src/core/instance/instance-copy.ts` | `delete config.id` in stripped fields |
| `src/cli/resolve-instance-id.ts` | Read `config.json` first; registry as fallback; add `fs` import |
| `src/cli/commands/setup.ts` | Reorder: registry before `initInstanceFiles`; pass `id`; default name; return `{ id, name, directory, configPath }` |
| `src/cli/commands/instances.ts` | Idempotent "already registered"; pass `id` in all create paths; `--from` writes new `id` after copy |
| `src/core/setup/wizard.ts` | Generate UUID before `writeNew`; include `id` in config object |

---

## Task 1: ConfigSchema — add `id` field

**Files:**
- Modify: `src/core/config/config.ts:27` (start of `ConfigSchema`)
- Modify: `src/core/config/__tests__/config-migrations.test.ts` (add schema test)

All other tasks depend on `Config` type having `id?: string`.

- [ ] **Step 1: Add `id` to ConfigSchema**

In `src/core/config/config.ts`, change the start of `ConfigSchema` from:
```typescript
export const ConfigSchema = z.object({
  instanceName: z.string().optional(),
```
to:
```typescript
export const ConfigSchema = z.object({
  id: z.string().optional(),             // instance UUID, written once at creation time
  instanceName: z.string().optional(),
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build
```
Expected: no errors. `Config` type now includes `id?: string`.

- [ ] **Step 3: Commit**

```bash
git add src/core/config/config.ts
git commit -m "feat: add id field to ConfigSchema (optional, backward compat)"
```

---

## Task 2: Migration — `add-instance-id`

**Files:**
- Modify: `src/core/config/config-migrations.ts`
- Modify: `src/core/config/__tests__/config-migrations.test.ts`

Backfills `id` for existing instances that have a registry entry but no `id` in config.

- [ ] **Step 1: Write failing test**

In `src/core/config/__tests__/config-migrations.test.ts`, add:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { applyMigrations } from '../config-migrations.js'

// ... existing tests ...

describe('migration: add-instance-id', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-migration-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('adds id from registry when config has none', () => {
    const instanceRoot = path.join(tmpDir, 'workspace', '.viben')
    fs.mkdirSync(instanceRoot, { recursive: true })

    const registryPath = path.join(tmpDir, '.viben', 'instances.json')
    fs.mkdirSync(path.dirname(registryPath), { recursive: true })
    fs.writeFileSync(registryPath, JSON.stringify({
      instances: {
        'abc-123': { root: instanceRoot },
      },
    }))

    // Point migration at our tmp registry via ctx.configDir
    const raw: Record<string, unknown> = { defaultAgent: 'claude' }
    // Temporarily override homedir: mock os.homedir to point to tmpDir
    vi.spyOn(os, 'homedir').mockReturnValue(tmpDir)
    const { changed } = applyMigrations(raw, undefined, { configDir: instanceRoot })
    vi.restoreAllMocks()

    expect(changed).toBe(true)
    expect(raw.id).toBe('abc-123')
  })

  it('skips when config already has id', () => {
    vi.spyOn(os, 'homedir').mockReturnValue('/nonexistent')
    const raw: Record<string, unknown> = { defaultAgent: 'claude', id: 'existing-uuid' }
    const { changed } = applyMigrations(raw, undefined, { configDir: '/any/path' })
    vi.restoreAllMocks()
    expect(changed).toBe(false)
    expect(raw.id).toBe('existing-uuid')
  })

  it('skips gracefully when registry not found', () => {
    vi.spyOn(os, 'homedir').mockReturnValue('/nonexistent-dir')
    const raw: Record<string, unknown> = { defaultAgent: 'claude' }
    const { changed } = applyMigrations(raw, undefined, { configDir: '/some/path' })
    vi.restoreAllMocks()
    expect(changed).toBe(false)
    expect(raw.id).toBeUndefined()
  })

  it('skips when ctx is absent', () => {
    const raw: Record<string, unknown> = { defaultAgent: 'claude' }
    const { changed } = applyMigrations(raw)
    expect(changed).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/core/config/__tests__/config-migrations.test.ts
```
Expected: FAIL — `add-instance-id` migration not found.

- [ ] **Step 3: Add imports and migration**

In `src/core/config/config-migrations.ts`, add at top (after existing import):
```typescript
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
```

Then add to the `migrations` array after `delete-display-verbosity`:
```typescript
  {
    name: 'add-instance-id',
    apply(raw, ctx) {
      // Already has id — nothing to do
      if (raw.id) return false
      // No context means we can't look up the registry
      if (!ctx?.configDir) return false

      // ctx.configDir === instanceRoot (config.json lives at instanceRoot/config.json)
      const instanceRoot = ctx.configDir

      try {
        const registryPath = path.join(os.homedir(), '.viben', 'instances.json')
        const data = JSON.parse(fs.readFileSync(registryPath, 'utf-8'))
        const instances = data?.instances ?? {}
        const entry = Object.values(instances).find(
          (e: any) => e.root === instanceRoot,
        ) as { id?: string } | undefined
        if (entry?.id) {
          raw.id = entry.id
          log.info({ instanceRoot }, 'Migrated: added id to config from registry')
          return true
        }
      } catch {
        // Best-effort — registry may not exist on fresh installs
      }

      return false
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- src/core/config/__tests__/config-migrations.test.ts
```
Expected: all tests pass including the new `add-instance-id` suite.

- [ ] **Step 5: Commit**

```bash
git add src/core/config/config-migrations.ts src/core/config/__tests__/config-migrations.test.ts
git commit -m "feat: add-instance-id migration backfills id from registry"
```

---

## Task 3: `initInstanceFiles` — write `id` to config

**Files:**
- Modify: `src/core/instance/instance-init.ts`
- Create: `src/core/instance/__tests__/instance-init.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/core/instance/__tests__/instance-init.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { initInstanceFiles } from '../instance-init.js'

describe('initInstanceFiles', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-init-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes id to config.json when id option is provided', () => {
    initInstanceFiles(tmpDir, { id: 'test-uuid-1234' })
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'))
    expect(config.id).toBe('test-uuid-1234')
  })

  it('does not write id when id option is absent', () => {
    initInstanceFiles(tmpDir, {})
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'))
    expect(config.id).toBeUndefined()
  })

  it('preserves existing id when mergeExisting is true and no new id provided', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({
      id: 'original-uuid',
      defaultAgent: 'claude',
    }))
    initInstanceFiles(tmpDir, { mergeExisting: true })
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'))
    expect(config.id).toBe('original-uuid')
  })

  it('preserves existing id even when new id is provided with mergeExisting', () => {
    // Once set, id must not be overwritten — UUID is written once at creation
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({
      id: 'original-uuid',
      defaultAgent: 'claude',
    }))
    initInstanceFiles(tmpDir, { mergeExisting: true, id: 'new-uuid' })
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'))
    expect(config.id).toBe('original-uuid')
  })

  it('writes id on fresh instance (no merge)', () => {
    initInstanceFiles(tmpDir, { id: 'fresh-uuid', agents: ['claude'] })
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'))
    expect(config.id).toBe('fresh-uuid')
    expect(config.defaultAgent).toBe('claude')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/core/instance/__tests__/instance-init.test.ts
```
Expected: FAIL — `id` not written.

- [ ] **Step 3: Add `id` to `InitInstanceOptions` and `writeConfig`**

In `src/core/instance/instance-init.ts`, update `InitInstanceOptions`:
```typescript
export interface InitInstanceOptions {
  /** UUID for this instance, written to config.json once at creation time. */
  id?: string
  /** Agent names to register in agents.json. First entry becomes defaultAgent. */
  agents?: string[]
  /** Instance display name written to config.json as instanceName. */
  instanceName?: string
  mergeExisting?: boolean
  runMode?: 'daemon' | 'foreground'
}
```

In `writeConfig`, add `id` logic after the `config` object is built (before `fs.writeFileSync`). The full `writeConfig` function body becomes:

```typescript
function writeConfig(instanceRoot: string, opts: InitInstanceOptions): void {
  const configPath = path.join(instanceRoot, 'config.json')

  let existing: Record<string, unknown> = {}
  if (opts.mergeExisting && fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    } catch {
      // Corrupt config — overwrite with fresh defaults
    }
  }

  const existingChannels = (existing['channels'] as Record<string, unknown>) ?? {}
  const config: Record<string, unknown> = {
    ...existing,
    channels: {
      ...existingChannels,
      sse: { ...(existingChannels['sse'] as Record<string, unknown> ?? {}), enabled: true },
    },
    runMode: opts.runMode ?? existing['runMode'] ?? 'daemon',
    autoStart: existing['autoStart'] ?? false,
  }

  if (opts.agents && opts.agents.length > 0) {
    config['defaultAgent'] = opts.agents[0]
  }

  if (opts.instanceName) {
    config['instanceName'] = opts.instanceName
  }

  // id is written once at creation — preserve existing id, never overwrite it
  const id = (existing['id'] as string | undefined) ?? opts.id
  if (id) config['id'] = id

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/core/instance/__tests__/instance-init.test.ts
```
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/instance/instance-init.ts src/core/instance/__tests__/instance-init.test.ts
git commit -m "feat: initInstanceFiles writes id to config.json, preserves existing id on merge"
```

---

## Task 4: `copyInstance` — strip `id` from copied config

**Files:**
- Modify: `src/core/instance/instance-copy.ts:27`
- Modify: `src/core/instance/__tests__/instance-copy.test.ts`

A copy must never share its source's UUID.

- [ ] **Step 1: Write failing test**

In `src/core/instance/__tests__/instance-copy.test.ts`, add a new test inside the `copyInstance` describe block:
```typescript
  it('strips id from copied config so copies never share a UUID', async () => {
    fs.writeFileSync(path.join(srcDir, 'config.json'), JSON.stringify({
      id: 'source-uuid-1234',
      instanceName: 'Source',
      defaultAgent: 'claude',
    }))
    await copyInstance(srcDir, dstDir, {})
    const config = JSON.parse(fs.readFileSync(path.join(dstDir, 'config.json'), 'utf-8'))
    expect(config.id).toBeUndefined()
    expect(config.defaultAgent).toBe('claude')
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/core/instance/__tests__/instance-copy.test.ts
```
Expected: FAIL — `config.id` is `'source-uuid-1234'`, not `undefined`.

- [ ] **Step 3: Add `delete config.id` to `copyInstance`**

In `src/core/instance/instance-copy.ts`, in the section that removes instance-specific fields (around line 24), add `delete config.id`:
```typescript
    // Remove instance-specific fields
    delete config.instanceName
    delete config.id              // each instance must have its own UUID — never copy it
    if (config.workspace) delete config.workspace.baseDir
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/core/instance/__tests__/instance-copy.test.ts
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/instance/instance-copy.ts src/core/instance/__tests__/instance-copy.test.ts
git commit -m "fix: copyInstance strips id field — copies must not share source UUID"
```

---

## Task 5: `resolveInstanceId` — read `config.json` first

**Files:**
- Modify: `src/cli/resolve-instance-id.ts`
- Create: `src/cli/__tests__/resolve-instance-id.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/cli/__tests__/resolve-instance-id.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { resolveInstanceId } from '../resolve-instance-id.js'

describe('resolveInstanceId', () => {
  let tmpDir: string
  let instanceRoot: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-resolve-'))
    instanceRoot = path.join(tmpDir, 'workspace', '.viben')
    fs.mkdirSync(instanceRoot, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns id from config.json when present', () => {
    fs.writeFileSync(path.join(instanceRoot, 'config.json'), JSON.stringify({
      id: 'config-uuid-5678',
      defaultAgent: 'claude',
    }))
    const result = resolveInstanceId(instanceRoot)
    expect(result).toBe('config-uuid-5678')
  })

  it('falls back to sanitized dir name when config.json has no id and registry is absent', () => {
    fs.writeFileSync(path.join(instanceRoot, 'config.json'), JSON.stringify({
      defaultAgent: 'claude',
    }))
    const result = resolveInstanceId(instanceRoot)
    expect(result).toBe('workspace')
  })

  it('falls back to sanitized dir name when config.json is missing', () => {
    const result = resolveInstanceId(instanceRoot)
    expect(result).toBe('workspace')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/cli/__tests__/resolve-instance-id.test.ts
```
Expected: the first test (reads from config.json) fails — function reads registry, not config.

- [ ] **Step 3: Rewrite `resolveInstanceId`**

Replace the entire content of `src/cli/resolve-instance-id.ts`:
```typescript
import fs from 'node:fs'
import path from 'node:path'
import { getGlobalRoot } from '../core/instance/instance-context.js'
import { InstanceRegistry } from '../core/instance/instance-registry.js'
import { createChildLogger } from '../core/utils/log.js'

const log = createChildLogger({ module: 'resolve-instance-id' })

/**
 * Resolve the stable instance ID for a given instance root.
 *
 * Priority:
 *  1. id field in config.json — preferred, instance knows its own UUID
 *  2. Registry (instances.json) — backward compat for instances without id in config
 *  3. Sanitized parent dir name — last resort
 */
export function resolveInstanceId(instanceRoot: string): string {
  // 1. Read id from config.json (preferred — instance knows its own UUID)
  try {
    const configPath = path.join(instanceRoot, 'config.json')
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (raw.id && typeof raw.id === 'string') return raw.id
  } catch {
    // File missing or corrupt — fall through
  }

  // 2. Fall back to registry (backward compat for instances without id in config yet)
  try {
    const reg = new InstanceRegistry(path.join(getGlobalRoot(), 'instances.json'))
    reg.load()
    const entry = reg.getByRoot(instanceRoot)
    if (entry?.id) return entry.id
  } catch (err) {
    log.debug({ err: (err as Error).message, instanceRoot }, 'Could not read instance registry, using fallback id')
  }

  // 3. Last resort: sanitized parent dir name
  return path.basename(path.dirname(instanceRoot)).replace(/[^a-zA-Z0-9-]/g, '-') || 'default'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/cli/__tests__/resolve-instance-id.test.ts
```
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/cli/resolve-instance-id.ts src/cli/__tests__/resolve-instance-id.test.ts
git commit -m "feat: resolveInstanceId reads config.json first, registry as fallback"
```

---

## Task 6: `cmdSetup` — reorder + full JSON output

**Files:**
- Modify: `src/cli/commands/setup.ts`

Reorder so the registry check happens before `initInstanceFiles`, passing the UUID in. Return `{ id, name, directory, configPath }` in JSON mode.

- [ ] **Step 1: Replace the full `setup.ts` implementation**

Replace the entire content of `src/cli/commands/setup.ts`:
```typescript
import fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import { jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'
import { getGlobalRoot } from '../../core/instance/instance-context.js'
import { InstanceRegistry } from '../../core/instance/instance-registry.js'
import { initInstanceFiles } from '../../core/instance/instance-init.js'

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : undefined
}

/** Read a string field from config.json, returns null if missing/invalid. */
function readConfigField(instanceRoot: string, field: string): string | null {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(instanceRoot, 'config.json'), 'utf-8'))
    return typeof raw[field] === 'string' ? raw[field] : null
  } catch {
    return null
  }
}

export async function cmdSetup(args: string[], instanceRoot: string): Promise<void> {
  const agentRaw = parseFlag(args, '--agent')
  const json = args.includes('--json')
  if (json) await muteForJson()

  if (!agentRaw) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, '--agent is required')
    console.error('  Error: --agent <name> is required')
    process.exit(1)
  }

  const rawRunMode = parseFlag(args, '--run-mode') ?? 'daemon'
  if (rawRunMode !== 'daemon' && rawRunMode !== 'foreground') {
    if (json) jsonError(ErrorCodes.CONFIG_INVALID, `--run-mode must be 'daemon' or 'foreground'`)
    console.error(`  Error: --run-mode must be 'daemon' or 'foreground'`)
    process.exit(1)
  }
  const runMode = rawRunMode as 'daemon' | 'foreground'

  const agents = agentRaw!.split(',').map(a => a.trim())

  // Resolve or create UUID first — must happen before initInstanceFiles so we can pass it in.
  // Idempotent: if already registered, reuse existing id.
  const registryPath = path.join(getGlobalRoot(), 'instances.json')
  const registry = new InstanceRegistry(registryPath)
  registry.load()

  let id: string
  const existingEntry = registry.getByRoot(instanceRoot)
  if (existingEntry) {
    id = existingEntry.id
  } else {
    id = randomUUID()
    registry.register(id, instanceRoot)
    registry.save()
  }

  // Write config.json (merged), agents.json, and plugins.json — id is now included in config
  initInstanceFiles(instanceRoot, { agents, runMode, mergeExisting: true, id })

  // Default instanceName to workspace dirname if not already set
  const existingName = readConfigField(instanceRoot, 'instanceName')
  const name = existingName ?? path.basename(path.dirname(instanceRoot))

  // Persist default name if it wasn't already set
  if (!existingName) {
    try {
      const configPath = path.join(instanceRoot, 'config.json')
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      raw.instanceName = name
      fs.writeFileSync(configPath, JSON.stringify(raw, null, 2))
    } catch { /* best-effort */ }
  }

  const configPath = path.join(instanceRoot, 'config.json')
  if (json) {
    jsonSuccess({ id, name, directory: path.dirname(instanceRoot), configPath })
  } else {
    console.log(`\n  \x1b[32m✓ Setup complete.\x1b[0m Config written to ${configPath}\n`)
  }
}
```

- [ ] **Step 2: Build and verify**

```bash
pnpm build
```
Expected: no TypeScript errors.

- [ ] **Step 3: Smoke test manually**

```bash
# Create temp dir
TMPDIR=$(mktemp -d)
node dist/cli.js setup --dir "$TMPDIR" --agent claude --json
```
Expected output: `{"success":true,"data":{"id":"<uuid>","name":"<dirname>","directory":"<path>","configPath":"<path>/.viben/config.json"}}`

Verify `config.json` has the `id` field:
```bash
cat "$TMPDIR/.viben/config.json" | grep '"id"'
```
Expected: `"id": "<same uuid>"`

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/setup.ts
git commit -m "feat: cmdSetup passes id to initInstanceFiles, returns {id,name,directory,configPath}"
```

---

## Task 7: `cmdInstancesCreate` — idempotent + pass `id` everywhere

**Files:**
- Modify: `src/cli/commands/instances.ts`
- Modify: `src/core/__tests__/instances-cli.test.ts`

Three cases to fix: (1) "already registered" becomes idempotent success, (2) ".viben exists but not registered" passes id to initInstanceFiles, (3) "create new" passes id.

- [ ] **Step 1: Update existing test that will break**

The test file has `vi.mock('node:fs')` — all fs calls are mocked. `initInstanceFiles` runs against mocked fs (no-op writes, read errors caught gracefully).

**Update** the existing test at line 114 (`'errors when .viben already exists and is registered'`). This behavior changes from error to idempotent success — rename and rewrite it:

```typescript
  it('returns existing instance idempotently when .viben exists and is registered', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const existingId = 'existing-uuid-001'
    const mockRegistry = {
      load: vi.fn(),
      list: vi.fn().mockReturnValue([]),
      getByRoot: vi.fn().mockReturnValue({ id: existingId, root: '/path/.viben' }),
      register: vi.fn(),
      save: vi.fn(),
    }
    vi.mocked(InstanceRegistry).mockImplementation(function() { return mockRegistry } as any)
    vi.mocked(readInstanceInfo).mockReturnValue({
      name: 'My Project', pid: null, apiPort: null,
      tunnelPort: null, runMode: null, channels: [],
    })

    const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    // Must NOT throw / call process.exit
    await cmdInstancesCreate(['--dir', '/path', '--no-interactive'])

    // Idempotent: no new registration in registry
    expect(mockRegistry.register).not.toHaveBeenCalled()
    expect(mockRegistry.save).not.toHaveBeenCalled()
    // outputInstance ran: readInstanceInfo was called to build output
    expect(readInstanceInfo).toHaveBeenCalledWith('/path/.viben')
    mockLog.mockRestore()
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/core/__tests__/instances-cli.test.ts
```
Expected: the updated test fails — currently the "already registered" case calls `jsonError` and exits instead of returning.

- [ ] **Step 3: Update `cmdInstancesCreate`**

Replace the body of `cmdInstancesCreate` in `src/cli/commands/instances.ts`. The key changes:

**Case 1 — already registered** (was: error → now: idempotent success, also write id to config):
```typescript
  // Case: .viben already exists
  if (fs.existsSync(instanceRoot)) {
    const existing = registry.getByRoot(instanceRoot)
    if (existing) {
      // Idempotent: return existing instance. Also write id to config.json in case
      // this instance was created before uuid-centric identity was introduced.
      initInstanceFiles(instanceRoot, { mergeExisting: true, id: existing.id })
      if (!json) console.warn(`Warning: Instance already registered at ${resolvedDir} (id: ${existing.id})`)
      await outputInstance(json, { id: existing.id, root: instanceRoot })
      return
    }
    // .viben exists but not registered — register it with a new id
    const id = randomUUID()
    initInstanceFiles(instanceRoot, { mergeExisting: true, id })
    registry.register(id, instanceRoot)
    registry.save()
    await outputInstance(json, { id, root: instanceRoot })
    return
  }
```

**Case 2 — create new** (non-`--from`):
```typescript
    const agents = agent ? [agent] : undefined
    initInstanceFiles(instanceRoot, { agents, instanceName: name, id })
```

**Case 3 — `--from`** (after copyInstance, write new id over copied source):
```typescript
    const { copyInstance } = await import('../../core/instance/instance-copy.js')
    await copyInstance(fromRoot, instanceRoot, {})
    // copyInstance strips id — write the new id now
    initInstanceFiles(instanceRoot, { mergeExisting: true, id })
    // Update config for new instance name
    const configPath = path.join(instanceRoot, 'config.json')
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      config.instanceName = name
      delete config.workspace
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    } catch {}
```

Full updated `cmdInstancesCreate` function:
```typescript
export async function cmdInstancesCreate(args: string[]): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const dirIdx = args.indexOf('--dir')
  const rawDir = dirIdx !== -1 ? args[dirIdx + 1] : undefined
  if (!rawDir) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, '--dir is required')
    console.error('Error: --dir is required')
    process.exit(1)
  }

  const fromIdx = args.indexOf('--from')
  const rawFrom = fromIdx !== -1 ? args[fromIdx + 1] : undefined
  const nameIdx = args.indexOf('--name')
  const instanceName = nameIdx !== -1 ? args[nameIdx + 1] : undefined
  const agentIdx = args.indexOf('--agent')
  const agent = agentIdx !== -1 ? args[agentIdx + 1] : undefined
  const noInteractive = args.includes('--no-interactive')

  const resolvedDir = path.resolve(rawDir!.replace(/^~/, os.homedir()))
  const instanceRoot = path.join(resolvedDir, '.viben')

  const registryPath = path.join(getGlobalRoot(), 'instances.json')
  const registry = new InstanceRegistry(registryPath)
  registry.load()

  // Case: .viben already exists
  if (fs.existsSync(instanceRoot)) {
    const existing = registry.getByRoot(instanceRoot)
    if (existing) {
      // Idempotent: return existing instance. Write id to config in case instance
      // was created before uuid-centric identity was introduced.
      initInstanceFiles(instanceRoot, { mergeExisting: true, id: existing.id })
      if (!json) console.warn(`Warning: Instance already registered at ${resolvedDir} (id: ${existing.id})`)
      await outputInstance(json, { id: existing.id, root: instanceRoot })
      return
    }
    // .viben exists but not registered — register with a fresh id
    const id = randomUUID()
    initInstanceFiles(instanceRoot, { mergeExisting: true, id })
    registry.register(id, instanceRoot)
    registry.save()
    await outputInstance(json, { id, root: instanceRoot })
    return
  }

  // Case: create new
  const name = instanceName ?? `viben-${registry.list().length + 1}`
  const id = randomUUID()

  if (rawFrom) {
    const fromRoot = path.join(path.resolve(rawFrom.replace(/^~/, os.homedir())), '.viben')
    if (!fs.existsSync(path.join(fromRoot, 'config.json'))) {
      console.error(`Error: No Viben instance found at ${rawFrom}`)
      process.exit(1)
    }
    fs.mkdirSync(instanceRoot, { recursive: true })
    const { copyInstance } = await import('../../core/instance/instance-copy.js')
    await copyInstance(fromRoot, instanceRoot, {})
    // copyInstance strips id — write the new id and update instance name
    initInstanceFiles(instanceRoot, { mergeExisting: true, id })
    const configPath = path.join(instanceRoot, 'config.json')
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      config.instanceName = name
      delete config.workspace
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    } catch {}
  } else {
    const agents = agent ? [agent] : undefined
    initInstanceFiles(instanceRoot, { agents, instanceName: name, id })
    if (!noInteractive && process.stdin.isTTY) {
      console.log(`Instance created at ${resolvedDir}. Run 'viben setup' inside that directory to configure it.`)
    }
  }

  registry.register(id, instanceRoot)
  registry.save()
  await outputInstance(json, { id, root: instanceRoot })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/core/__tests__/instances-cli.test.ts
```
Expected: all tests pass.

- [ ] **Step 5: Build**

```bash
pnpm build
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/instances.ts src/core/__tests__/instances-cli.test.ts
git commit -m "feat: cmdInstancesCreate idempotent on existing instance, passes id to all create paths"
```

---

## Task 8: `wizard.ts` — generate UUID before writing config

**Files:**
- Modify: `src/core/setup/wizard.ts:420-458`

The wizard currently generates a UUID at line 456 (after `writeNew` at line 439). The config written by the wizard never includes `id`. Fix: generate UUID before building the config object, include `id` in config.

- [ ] **Step 1: Move UUID generation before config write**

In `src/core/setup/wizard.ts`, locate the section starting around line 413 (after `autoStart` is set) and replace the config write + registry block:

**Before** (lines ~414–458):
```typescript
    const config: Config = {
      instanceName,
      defaultAgent,
      workspace: { allowExternalWorkspaces: true, security: { allowedPaths: [], envWhitelist: [] } },
      logging: {
        level: "info",
        logDir: path.join(instanceRoot, "logs"),
        maxFileSize: "10m",
        maxFiles: 7,
        sessionLogRetentionDays: 30,
      },
      runMode,
      autoStart,
      sessionStore: { ttlDays: 30 },
      integrations: {},
      agentSwitch: { labelHistory: true },
    };

    try {
      await configManager.writeNew(config);
    } catch (writeErr) {
      console.log(fail(`Could not save config: ${(writeErr as Error).message}`));
      return false;
    }

    // Auto-register remaining built-in plugins in the registry
    if (settingsManager && pluginRegistry) {
      await registerBuiltinPlugins(settingsManager, pluginRegistry);
      await pluginRegistry.save();
    }

    // Register instance in the global registry (skip if this root is already registered)
    const existingEntry = instanceRegistry.getByRoot(instanceRoot);
    if (!existingEntry) {
      const id = randomUUID();
      instanceRegistry.register(id, instanceRoot);
      await instanceRegistry.save();
    }
```

**After**:
```typescript
    // Resolve or create UUID before writing config — id must be in config.json from the start
    const existingEntry = instanceRegistry.getByRoot(instanceRoot);
    const instanceId = existingEntry?.id ?? randomUUID();

    const config: Config = {
      id: instanceId,
      instanceName,
      defaultAgent,
      workspace: { allowExternalWorkspaces: true, security: { allowedPaths: [], envWhitelist: [] } },
      logging: {
        level: "info",
        logDir: path.join(instanceRoot, "logs"),
        maxFileSize: "10m",
        maxFiles: 7,
        sessionLogRetentionDays: 30,
      },
      runMode,
      autoStart,
      sessionStore: { ttlDays: 30 },
      integrations: {},
      agentSwitch: { labelHistory: true },
    };

    try {
      await configManager.writeNew(config);
    } catch (writeErr) {
      console.log(fail(`Could not save config: ${(writeErr as Error).message}`));
      return false;
    }

    // Auto-register remaining built-in plugins in the registry
    if (settingsManager && pluginRegistry) {
      await registerBuiltinPlugins(settingsManager, pluginRegistry);
      await pluginRegistry.save();
    }

    // Register instance in the global registry (now after config write; UUID already decided above)
    if (!existingEntry) {
      instanceRegistry.register(instanceId, instanceRoot);
      await instanceRegistry.save();
    }
```

- [ ] **Step 2: Build and verify**

```bash
pnpm build
```
Expected: no errors. The `Config` type now includes `id?: string` from Task 1, so `id: instanceId` compiles cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/core/setup/wizard.ts
git commit -m "fix: wizard generates UUID before writing config — id is now included in initial config.json"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```
Expected: all tests pass. No regressions.

- [ ] **Step 2: End-to-end smoke test**

```bash
TMPDIR=$(mktemp -d)

# Fresh setup — should return id, name, directory, configPath
node dist/cli.js setup --dir "$TMPDIR" --agent claude --json

# Verify id in config.json
cat "$TMPDIR/.viben/config.json" | python3 -c "import sys,json; d=json.load(sys.stdin); print('id:', d.get('id','MISSING'))"

# Second setup on same dir — should be idempotent (same id)
node dist/cli.js setup --dir "$TMPDIR" --agent claude --json

# instances create on same dir — should be idempotent (return existing id, not error)
node dist/cli.js instances create --dir "$TMPDIR" --no-interactive --json

# Clone instance — new dir should have different id
TMPDIR2=$(mktemp -d)
node dist/cli.js instances create --dir "$TMPDIR2" --from "$TMPDIR" --no-interactive --json
cat "$TMPDIR2/.viben/config.json" | python3 -c "import sys,json; d=json.load(sys.stdin); print('clone id:', d.get('id','MISSING'))"
```

Expected:
- Each `setup` and `instances create` call returns `{"success":true,"data":{"id":"<uuid>",...}}`
- Second `setup` returns same UUID as first
- `instances create` on existing dir also returns same UUID
- Clone dir has a **different** UUID from the source

- [ ] **Step 3: Final commit if any loose ends**

```bash
pnpm test
git status
```
If all clean, the implementation is complete.
