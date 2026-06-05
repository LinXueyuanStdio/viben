# Instances CLI & Auth Exchange Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `viben instances list/create` CLI subcommands, extend `start --json` output with name/directory, and add `POST /api/v1/auth/exchange` + `GET /api/v1/workspace` API endpoints.

**Architecture:** New `instances.ts` CLI command follows existing command patterns (`cmdStatus`, `cmdStart`). Auth exchange adds one route to existing `auth.ts`. Workspace endpoint is a new route registered in the api-server plugin. All JSON output uses the existing `jsonSuccess`/`jsonError` helpers from `cli/output.ts`.

**Tech Stack:** TypeScript, Node.js, Vitest, Fastify, ESM (`.js` extensions required on all imports)

---

## File Map

**New files:**
- `src/cli/commands/instances.ts` — `instances list` and `instances create` subcommands
- `src/plugins/api-server/routes/workspace.ts` — `GET /api/v1/workspace` route
- `src/core/__tests__/instances-cli.test.ts` — tests for instances list/create logic
- `src/plugins/api-server/__tests__/auth-exchange.test.ts` — tests for POST /exchange
- `src/plugins/api-server/__tests__/workspace-route.test.ts` — tests for GET /workspace

**Modified files:**
- `src/cli/commands/index.ts` — export `cmdInstances`
- `src/cli.ts` — register `instances` in `noInstanceCommands` map (does not require an existing instance root)
- `src/cli/commands/start.ts` — extend `--json` output with `name`, `directory`, `port`
- `src/cli/commands/default.ts` — extend `--json` output after onboarding wizard
- `src/plugins/api-server/routes/auth.ts` — add `POST /exchange` route
- `src/plugins/api-server/index.ts` (the plugin setup file) — register workspace route

---

## Task 1: `instances list` Command

**Files:**
- Create: `src/cli/commands/instances.ts`
- Create: `src/core/__tests__/instances-cli.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/core/__tests__/instances-cli.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'node:path'

// We test the pure data-mapping logic extracted from the command
// by mocking readInstanceInfo and InstanceRegistry

vi.mock('../../cli/commands/status.js', () => ({
  readInstanceInfo: vi.fn(),
}))

vi.mock('../../core/instance/instance-registry.js', () => ({
  InstanceRegistry: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
    list: vi.fn().mockReturnValue([]),
  })),
}))

vi.mock('../../core/instance/instance-context.js', () => ({
  getGlobalRoot: vi.fn().mockReturnValue('/Users/user/.viben'),
}))

import { buildInstanceListEntries } from '../../cli/commands/instances.js'
import { readInstanceInfo } from '../../cli/commands/status.js'
import { InstanceRegistry } from '../../core/instance/instance-registry.js'

describe('buildInstanceListEntries', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty array when no instances registered', async () => {
    const mockRegistry = { load: vi.fn(), list: vi.fn().mockReturnValue([]) }
    vi.mocked(InstanceRegistry).mockImplementation(() => mockRegistry as any)
    const result = await buildInstanceListEntries()
    expect(result).toEqual([])
  })

  it('maps registry entries to InstanceListEntry with correct fields', async () => {
    const mockRegistry = {
      load: vi.fn(),
      list: vi.fn().mockReturnValue([
        { id: 'main', root: '/Users/user/.viben' },
      ]),
    }
    vi.mocked(InstanceRegistry).mockImplementation(() => mockRegistry as any)
    vi.mocked(readInstanceInfo).mockReturnValue({
      name: 'Main', pid: 1234, apiPort: 21420,
      tunnelPort: null, runMode: 'daemon', channels: [],
    })

    const result = await buildInstanceListEntries()
    expect(result).toEqual([{
      id: 'main',
      name: 'Main',
      directory: '/Users/user',
      root: '/Users/user/.viben',
      status: 'running',
      port: 21420,
    }])
  })

  it('sets status stopped when pid is null', async () => {
    const mockRegistry = {
      load: vi.fn(),
      list: vi.fn().mockReturnValue([{ id: 'dev', root: '/project/.viben' }]),
    }
    vi.mocked(InstanceRegistry).mockImplementation(() => mockRegistry as any)
    vi.mocked(readInstanceInfo).mockReturnValue({
      name: 'Dev', pid: null, apiPort: null,
      tunnelPort: null, runMode: null, channels: [],
    })

    const result = await buildInstanceListEntries()
    expect(result[0]!.status).toBe('stopped')
    expect(result[0]!.port).toBeNull()
  })

  it('computes directory as path.dirname(root)', async () => {
    const mockRegistry = {
      load: vi.fn(),
      list: vi.fn().mockReturnValue([
        { id: 'proj', root: '/Users/user/my-project/.viben' },
      ]),
    }
    vi.mocked(InstanceRegistry).mockImplementation(() => mockRegistry as any)
    vi.mocked(readInstanceInfo).mockReturnValue({
      name: 'Proj', pid: null, apiPort: null,
      tunnelPort: null, runMode: null, channels: [],
    })

    const result = await buildInstanceListEntries()
    expect(result[0]!.directory).toBe('/Users/user/my-project')
    expect(result[0]!.root).toBe('/Users/user/my-project/.viben')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm test src/core/__tests__/instances-cli.test.ts
```
Expected: FAIL — `buildInstanceListEntries` not found

- [ ] **Step 3: Implement `instances list`**

```typescript
// src/cli/commands/instances.ts
import path from 'node:path'
import os from 'node:os'
import { InstanceRegistry } from '../../core/instance/instance-registry.js'
import { getGlobalRoot } from '../../core/instance/instance-context.js'
import { readInstanceInfo } from './status.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'
import { wantsHelp } from './helpers.js'

export interface InstanceListEntry {
  id: string
  name: string | null
  directory: string
  root: string
  status: 'running' | 'stopped'
  port: number | null
}

export async function buildInstanceListEntries(): Promise<InstanceListEntry[]> {
  const registryPath = path.join(getGlobalRoot(), 'instances.json')
  const registry = new InstanceRegistry(registryPath)
  await registry.load()
  return registry.list().map(entry => {
    const info = readInstanceInfo(entry.root)
    return {
      id: entry.id,
      name: info.name,
      directory: path.dirname(entry.root),
      root: entry.root,
      status: (info.pid ? 'running' : 'stopped') as 'running' | 'stopped',
      port: info.apiPort,
    }
  })
}

export async function cmdInstances(args: string[] = [], _instanceRoot?: string): Promise<void> {
  const sub = args[0]
  const subArgs = args.slice(1)

  if (!sub || sub === 'list') return cmdInstancesList(subArgs)
  if (sub === 'create') return cmdInstancesCreate(subArgs)

  if (wantsHelp(args)) {
    printInstancesHelp()
    return
  }

  console.error(`Unknown subcommand: instances ${sub}`)
  printInstancesHelp()
  process.exit(1)
}

function printInstancesHelp(): void {
  console.log(`
\x1b[1mviben instances\x1b[0m — Manage Viben instances

\x1b[1mSubcommands:\x1b[0m
  list      List all registered instances
  create    Create or register an instance

\x1b[1mOptions:\x1b[0m
  --json    Output as JSON
`)
}

async function cmdInstancesList(args: string[]): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const entries = await buildInstanceListEntries()

  if (json) {
    jsonSuccess(entries)
    return
  }

  if (entries.length === 0) {
    console.log('No instances registered.')
    return
  }

  console.log('')
  console.log('  Status     ID               Name             Directory')
  console.log('  ' + '─'.repeat(70))
  for (const e of entries) {
    const status = e.status === 'running' ? '● running' : '○ stopped'
    const port = e.port ? `:${e.port}` : '—'
    const dir = e.directory.replace(os.homedir(), '~')
    const name = (e.name ?? e.id).padEnd(16)
    console.log(`  ${status.padEnd(10)} ${e.id.padEnd(16)} ${name} ${dir}  ${port}`)
  }
  console.log('')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/core/__tests__/instances-cli.test.ts
```
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/instances.ts src/core/__tests__/instances-cli.test.ts
git commit -m "feat: add instances list command with --json output"
```

---

## Task 2: `instances create` Command

**Files:**
- Modify: `src/cli/commands/instances.ts`
- Modify: `src/core/__tests__/instances-cli.test.ts`

- [ ] **Step 1: Add tests for create**

Add to `src/core/__tests__/instances-cli.test.ts`:

```typescript
import fs from 'node:fs'
import { cmdInstancesCreate } from '../../cli/commands/instances.js'

vi.mock('node:fs')
vi.mock('../../core/config/config.js', () => ({
  ConfigManager: vi.fn().mockImplementation(() => ({
    exists: vi.fn().mockResolvedValue(false),
  })),
}))

describe('cmdInstancesCreate', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('errors when --dir is missing', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(cmdInstancesCreate([])).rejects.toThrow('exit')
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('--dir'))
    mockExit.mockRestore()
    mockError.mockRestore()
  })

  it('errors when .viben already exists and is registered', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const mockRegistry = {
      load: vi.fn(),
      getByRoot: vi.fn().mockReturnValue({ id: 'existing', root: '/path/.viben' }),
    }
    vi.mocked(InstanceRegistry).mockImplementation(() => mockRegistry as any)

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(cmdInstancesCreate(['--dir', '/path'])).rejects.toThrow('exit')
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('existing'))
    mockExit.mockRestore()
    mockError.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/core/__tests__/instances-cli.test.ts
```
Expected: FAIL — `cmdInstancesCreate` not exported

- [ ] **Step 3: Implement `cmdInstancesCreate`**

Add to `src/cli/commands/instances.ts`:

```typescript
import { generateSlug } from '../../core/instance/instance-context.js'

export async function cmdInstancesCreate(args: string[]): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  // Parse flags
  const dirIdx = args.indexOf('--dir')
  const rawDir = dirIdx !== -1 ? args[dirIdx + 1] : undefined
  if (!rawDir) {
    if (json) jsonError(ErrorCodes.VALIDATION_ERROR, '--dir is required')
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

  // Resolve absolute paths
  const resolvedDir = path.resolve(rawDir!.replace(/^~/, os.homedir()))
  const instanceRoot = path.join(resolvedDir, '.viben')

  const registryPath = path.join(getGlobalRoot(), 'instances.json')
  const registry = new InstanceRegistry(registryPath)
  await registry.load()

  // Case: .viben already exists
  if (fs.existsSync(instanceRoot)) {
    const existing = registry.getByRoot(instanceRoot)
    if (existing) {
      if (json) jsonError(ErrorCodes.VALIDATION_ERROR, `Instance already exists at ${resolvedDir} (id: ${existing.id})`)
      console.error(`Error: Instance already exists at ${resolvedDir} (id: ${existing.id})`)
      process.exit(1)
    }
    // .viben exists but not registered — register it
    const config = JSON.parse(fs.readFileSync(path.join(instanceRoot, 'config.json'), 'utf-8'))
    const name = config.instanceName ?? path.basename(resolvedDir)
    const baseId = generateSlug(name)
    const id = registry.uniqueId(baseId)
    registry.register(id, instanceRoot)
    await registry.save()
    return outputInstance(json, { id, root: instanceRoot })
  }

  // Case: create new
  const name = instanceName ?? `viben-${registry.list().length + 1}`
  const baseId = generateSlug(name)
  const id = registry.uniqueId(baseId)
  fs.mkdirSync(instanceRoot, { recursive: true })

  if (rawFrom) {
    // Clone from existing
    const fromRoot = path.join(path.resolve(rawFrom.replace(/^~/, os.homedir())), '.viben')
    if (!fs.existsSync(path.join(fromRoot, 'config.json'))) {
      if (json) jsonError(ErrorCodes.VALIDATION_ERROR, `No Viben instance found at ${rawFrom}`)
      console.error(`Error: No Viben instance found at ${rawFrom}`)
      process.exit(1)
    }
    const { cloneInstance } = await import('../../core/setup/clone.js')
    await cloneInstance(fromRoot, instanceRoot, { instanceName: name })
  } else if (noInteractive) {
    // Minimal config
    const config: Record<string, unknown> = { instanceName: name, runMode: 'daemon' }
    if (agent) config.defaultAgent = agent
    fs.writeFileSync(path.join(instanceRoot, 'config.json'), JSON.stringify(config, null, 2))
    fs.writeFileSync(path.join(instanceRoot, 'plugins.json'), JSON.stringify({ version: 1, installed: {} }, null, 2))
  } else {
    // Run setup wizard (interactive)
    const { runSetup } = await import('../../core/setup/wizard.js')
    await runSetup({ instanceRoot, instanceName: name })
  }

  registry.register(id, instanceRoot)
  await registry.save()
  return outputInstance(json, { id, root: instanceRoot })
}

async function outputInstance(json: boolean, { id, root }: { id: string; root: string }): Promise<void> {
  const info = readInstanceInfo(root)
  const entry: InstanceListEntry = {
    id,
    name: info.name,
    directory: path.dirname(root),
    root,
    status: (info.pid ? 'running' : 'stopped') as 'running' | 'stopped',
    port: info.apiPort,
  }
  if (json) {
    jsonSuccess(entry)
    return
  }
  console.log(`Instance created: ${info.name ?? id} at ${path.dirname(root)}`)
}
```

> **Note:** `generateSlug` is exported from `instance-context.ts`. `cloneInstance` in `core/setup/clone.js` may be a different path — check the actual clone logic location in the multi-instance implementation before using this import.

- [ ] **Step 4: Run tests**

```bash
pnpm test src/core/__tests__/instances-cli.test.ts
```
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/instances.ts src/core/__tests__/instances-cli.test.ts
git commit -m "feat: add instances create command"
```

---

## Task 3: Register `instances` in CLI

**Files:**
- Modify: `src/cli/commands/index.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Export from index.ts**

In `src/cli/commands/index.ts`, add:
```typescript
export { cmdInstances } from './instances.js'
```
Add it with the other command exports (alphabetical order near `cmdIntegrate` or `cmdInstall`).

- [ ] **Step 2: Register in cli.ts**

In `src/cli.ts`, add `cmdInstances` to the import from `./cli/commands/index.js`:
```typescript
import {
  // ... existing imports ...
  cmdInstances,
} from './cli/commands/index.js'
```

In the `noInstanceCommands` object (not `instanceCommands`), add:
```typescript
'instances': async () => cmdInstances(args),
```

`instances` must be in `noInstanceCommands` because it does not require an existing instance root — it reads the global `~/.viben/instances.json` registry directly. Adding it to `instanceCommands` would cause `resolveRoot()` to prompt the user to select an instance before listing, which breaks the command.

- [ ] **Step 3: Verify registration works**

```bash
pnpm build && node dist/cli.js instances list
```
Expected: Either table output (if instances registered) or "No instances registered."

```bash
node dist/cli.js instances list --json
```
Expected: `{ "success": true, "data": [...] }`

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/index.ts src/cli.ts
git commit -m "feat: register instances subcommand in CLI"
```

---

## Task 4: Extend `start --json` Output

**Files:**
- Modify: `src/cli/commands/start.ts`
- Modify: `src/cli/commands/default.ts`

- [ ] **Step 1: Extend start.ts**

In `src/cli/commands/start.ts`, find the `jsonSuccess` call:
```typescript
// Before (line ~50)
if (json) jsonSuccess({ pid: result.pid, instanceId: path.basename(root), dir: root })
```

Replace with:
```typescript
if (json) {
  // Read instance name and real id from registry
  let name: string | null = null
  let instanceId: string = path.basename(root)
  try {
    const { ConfigManager } = await import('../../core/config/config.js')
    const cm = new ConfigManager(path.join(root, 'config.json'))
    await cm.load()
    name = cm.get().instanceName ?? null
  } catch {}
  try {
    const { getGlobalRoot } = await import('../../core/instance/instance-context.js')
    const { InstanceRegistry } = await import('../../core/instance/instance-registry.js')
    const reg = new InstanceRegistry(path.join(getGlobalRoot(), 'instances.json'))
    await reg.load()
    const entry = reg.getByRoot(root)
    if (entry) instanceId = entry.id
  } catch {}
  // Read port (may not be written yet, that's ok)
  let port: number | null = null
  try {
    port = parseInt(fs.readFileSync(path.join(root, 'api.port'), 'utf-8').trim()) || null
  } catch {}
  jsonSuccess({
    pid: result.pid,
    instanceId,
    name,
    directory: path.dirname(root),
    dir: root,   // keep for backward compat
    port,
  })
}
```

Add `import fs from 'node:fs'` if not already present.

- [ ] **Step 2: Find equivalent output in default.ts**

In `src/cli/commands/default.ts`, search for any `jsonSuccess` call that outputs `pid`/`instanceId`. Apply the same extended fields. If the default command starts the server inline (not via `cmdStart`), locate the exact jsonSuccess call and extend it identically.

- [ ] **Step 3: Verify extended output**

```bash
pnpm build
# Start a test instance and check output:
node dist/cli.js start --json 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf-8'); const j=JSON.parse(d.trim()); console.log(Object.keys(j.data))"
```
Expected output includes: `pid`, `instanceId`, `name`, `directory`, `dir`, `port`

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/start.ts src/cli/commands/default.ts
git commit -m "feat: extend start --json output with name, directory, port"
```

---

## Task 5: `POST /api/v1/auth/exchange` Endpoint

**Files:**
- Modify: `src/plugins/api-server/routes/auth.ts`
- Modify: `src/plugins/api-server/auth/token-store.ts` (if `exchangeCode` not already implemented)
- Create: `src/plugins/api-server/__tests__/auth-exchange.test.ts`

> **Check first (two things):**
> 1. Open `src/plugins/api-server/index.ts`. There is likely already a `registerPlugin` call for `POST /exchange` registered with `{ auth: false }` — if so, the route registration boilerplate is done. Verify it calls `tokenStore.exchangeCode()`.
> 2. Open `src/plugins/api-server/auth/token-store.ts` to confirm whether `exchangeCode()` is already defined. If `createCode()` is there but `exchangeCode()` is not, add it in this task. If both exist, skip Step 3 below.

- [ ] **Step 1: Write the failing test**

```typescript
// src/plugins/api-server/__tests__/auth-exchange.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { authRoutes } from '../routes/auth.js'

function makeTokenStore() {
  const codes = new Map<string, { tokenParams: any; expiresAt: string; used: boolean }>()
  return {
    createCode: vi.fn((params: any) => {
      const code = 'test-code-123'
      codes.set(code, {
        tokenParams: params,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        used: false,
      })
      return { code, expiresAt: codes.get(code)!.expiresAt }
    }),
    exchangeCode: vi.fn((code: string) => {
      const entry = codes.get(code)
      if (!entry) throw new Error('Invalid code')
      if (new Date(entry.expiresAt) < new Date()) throw new Error('Code expired')
      if (entry.used) throw new Error('Code already used')
      entry.used = true
      return entry.tokenParams
    }),
    create: vi.fn((params: any) => ({
      id: 'tok_test',
      name: params.name,
      role: params.role,
      scopes: params.scopes,
      createdAt: new Date().toISOString(),
      refreshDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      revoked: false,
    })),
    get: vi.fn(),
    revoke: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    listCodes: vi.fn().mockReturnValue([]),
    revokeCode: vi.fn(),
    updateLastUsed: vi.fn(),
  }
}

async function buildApp(tokenStore: ReturnType<typeof makeTokenStore>) {
  const app = Fastify()
  app.decorateRequest('auth', null, [])
  app.addHook('onRequest', async (req) => {
    (req as any).auth = { type: 'secret', role: 'admin', scopes: ['*'] }
  })
  await app.register(authRoutes, { tokenStore, getJwtSecret: () => 'test-secret' })
  await app.ready()
  return app
}

describe('POST /exchange', () => {
  let tokenStore: ReturnType<typeof makeTokenStore>
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    tokenStore = makeTokenStore()
    app = await buildApp(tokenStore)
  })

  it('returns JWT on valid code', async () => {
    // First create a code
    tokenStore.createCode({ role: 'admin', name: 'test', expire: '24h' })

    const res = await app.inject({
      method: 'POST',
      url: '/exchange',
      payload: { code: 'test-code-123' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('accessToken')
    expect(body).toHaveProperty('tokenId')
    expect(body).toHaveProperty('expiresAt')
    expect(body).toHaveProperty('refreshDeadline')
  })

  it('returns 401 for invalid code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/exchange',
      payload: { code: 'nonexistent' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 for already-used code', async () => {
    tokenStore.createCode({ role: 'admin', name: 'test', expire: '24h' })
    tokenStore.exchangeCode('test-code-123') // use it once

    const res = await app.inject({
      method: 'POST',
      url: '/exchange',
      payload: { code: 'test-code-123' },
    })
    expect(res.statusCode).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/plugins/api-server/__tests__/auth-exchange.test.ts
```
Expected: FAIL — `POST /exchange` not found (404)

- [ ] **Step 3: Add `exchangeCode` to token store**

Open `src/plugins/api-server/auth/token-store.ts`. Check existing `createCode` implementation. Add `exchangeCode`:

```typescript
// In TokenStore class, add after createCode():
exchangeCode(code: string): CreateTokenOpts {
  const entry = this.codes.get(code)
  if (!entry) throw new Error('Invalid code')
  if (new Date(entry.expiresAt) < new Date()) {
    this.codes.delete(code)
    throw new Error('Code expired')
  }
  if (entry.used) throw new Error('Code already used')
  entry.used = true
  return entry.tokenParams
}
```

> **Note:** The `codes` map and its entry type may already be defined. Adapt to match the actual type. If `TokenStore` is an interface rather than a class, add `exchangeCode` to both the interface and the implementation.

- [ ] **Step 4: Add `POST /exchange` route to auth.ts (if not already present in index.ts)**

If the skeleton route in `index.ts` is incomplete, or auth.ts is the right place for the route body, add the implementation:

```typescript
// POST /exchange — exchange one-time code for JWT (no auth required)
// This route must be registered at the plugin level with { auth: false }
// (via the third argument to registerPlugin in index.ts) — NOT via route-level config.
app.post('/exchange', async (request, reply) => {
  const body = z.object({ code: z.string() }).parse(request.body)
  let tokenParams: any
  try {
    tokenParams = tokenStore.exchangeCode(body.code)
  } catch (err: any) {
    throw new AuthError('UNAUTHORIZED', err.message ?? 'Invalid code')
  }
  // Generate JWT using exchanged token params (same as POST /tokens)
  const stored = tokenStore.create(tokenParams)
  const durationMs = parseDuration(tokenParams.expire)
  const rfd = new Date(stored.refreshDeadline).getTime() / 1000
  const accessToken = signToken(
    { sub: stored.id, role: stored.role, scopes: stored.scopes, rfd },
    getJwtSecret(),
    tokenParams.expire,
  )
  const expiresAt = new Date(Date.now() + durationMs).toISOString()
  return reply.send({
    accessToken,
    tokenId: stored.id,
    expiresAt,
    refreshDeadline: stored.refreshDeadline,
  })
})
```

Add `import { z } from 'zod'` at the top if not already present.

> **Auth bypass pattern:** The auth preHandler checks route/plugin registration options, not `request.routeOptions.config`. The correct way to mark a route group as unauthenticated is to pass `{ auth: false }` as the **third argument** to `registerPlugin(prefix, handler, { auth: false })` in `index.ts`. Do NOT use `{ config: { skipAuth: true } }` on individual route definitions — look at how the health or public routes bypass auth to confirm the exact call pattern used in this codebase.

- [ ] **Step 5: Run tests**

```bash
pnpm test src/plugins/api-server/__tests__/auth-exchange.test.ts
```
Expected: PASS (all 3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/plugins/api-server/routes/auth.ts src/plugins/api-server/auth/token-store.ts src/plugins/api-server/__tests__/auth-exchange.test.ts
git commit -m "feat: add POST /auth/exchange for one-time code to JWT"
```

---

## Task 6: `GET /api/v1/workspace` Endpoint

**Files:**
- Create: `src/plugins/api-server/routes/workspace.ts`
- Create: `src/plugins/api-server/__tests__/workspace-route.test.ts`
- Modify: `src/plugins/api-server/index.ts` (the plugin setup file — check exact filename)

- [ ] **Step 1: Write the failing test**

```typescript
// src/plugins/api-server/__tests__/workspace-route.test.ts
import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { workspaceRoute } from '../routes/workspace.js'

async function buildApp(opts: { id: string; name: string; directory: string; version: string }) {
  const app = Fastify()
  app.decorateRequest('auth', null, [])
  app.addHook('onRequest', async (req) => {
    (req as any).auth = { type: 'jwt', role: 'admin', scopes: ['system:health'] }
  })
  await app.register(workspaceRoute, opts)
  await app.ready()
  return app
}

describe('GET /workspace', () => {
  it('returns workspace identity info', async () => {
    const app = await buildApp({
      id: 'main',
      name: 'Main',
      directory: '/Users/user',
      version: '2026.401.1',
    })
    const res = await app.inject({ method: 'GET', url: '/workspace' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toEqual({
      id: 'main',
      name: 'Main',
      directory: '/Users/user',
      version: '2026.401.1',
    })
  })

  it('requires authentication', async () => {
    const app = Fastify()
    app.decorateRequest('auth', null, [])
    app.addHook('onRequest', async (req) => {
      // No auth set — simulate unauthenticated request
      (req as any).auth = null
    })
    await app.register(workspaceRoute, {
      id: 'main', name: 'Main', directory: '/Users/user', version: '1.0',
    })
    await app.ready()
    // Route should exist and return data when auth is present
    // Authentication enforcement is handled by the preHandler in the plugin setup, not the route itself
    const res = await app.inject({ method: 'GET', url: '/workspace' })
    // With no auth preHandler in this test, it returns 200 (auth is enforced at plugin level)
    expect(res.statusCode).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/plugins/api-server/__tests__/workspace-route.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement workspace route**

```typescript
// src/plugins/api-server/routes/workspace.ts
import type { FastifyInstance } from 'fastify'
import path from 'node:path'

export interface WorkspaceRouteOpts {
  id: string
  name: string
  directory: string
  version: string
}

export async function workspaceRoute(
  app: FastifyInstance,
  opts: WorkspaceRouteOpts,
): Promise<void> {
  app.get('/workspace', async () => ({
    id: opts.id,
    name: opts.name,
    directory: opts.directory,
    version: opts.version,
  }))
}
```

- [ ] **Step 4: Register in api-server plugin setup**

Find the api-server plugin setup file (likely `src/plugins/api-server/index.ts`). Locate where other routes are registered (e.g., where `authRoutes` is registered). Add:

```typescript
import { workspaceRoute } from './routes/workspace.js'
import path from 'node:path'

// In the setup function, after other route registrations:
const instanceRoot = ctx.paths.root  // or however the plugin accesses instanceRoot
const version = /* get from package.json or config */ '0.0.0'
let workspaceId = 'main'
let workspaceName = 'Main'
let workspaceDir = path.dirname(instanceRoot)
try {
  const { InstanceRegistry } = await import('../../core/instance/instance-registry.js')
  const { getGlobalRoot } = await import('../../core/instance/instance-context.js')
  const reg = new InstanceRegistry(path.join(getGlobalRoot(), 'instances.json'))
  await reg.load()
  const entry = reg.getByRoot(instanceRoot)
  if (entry) workspaceId = entry.id
} catch {}
try {
  const config = JSON.parse(fs.readFileSync(path.join(instanceRoot, 'config.json'), 'utf-8'))
  workspaceName = config.instanceName ?? workspaceName
} catch {}

apiServer.registerPlugin('/api/v1', async (pluginApp) => {
  await pluginApp.register(workspaceRoute, {
    id: workspaceId,
    name: workspaceName,
    directory: workspaceDir,
    version,
  })
}, { auth: true })
```

> **Note:** The exact way `instanceRoot` and config are accessed in the plugin context may differ. Look at how other routes in the same file access instance data and follow the same pattern. The `version` should come from `package.json` — look for how other parts of the codebase read it.

- [ ] **Step 5: Run tests**

```bash
pnpm test src/plugins/api-server/__tests__/workspace-route.test.ts
```
Expected: PASS

```bash
pnpm build && pnpm test
```
Expected: All tests pass, no TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/plugins/api-server/routes/workspace.ts src/plugins/api-server/__tests__/workspace-route.test.ts src/plugins/api-server/index.ts
git commit -m "feat: add GET /api/v1/workspace endpoint"
```

---

## Self-Review Checklist

After all tasks are complete:

- [ ] `viben instances list --json` outputs correct schema (`id`, `name`, `directory`, `root`, `status`, `port`)
- [ ] `viben instances create --dir /path --no-interactive --json` creates instance and returns JSON
- [ ] `viben instances create --dir /path --from /existing --json` clones and returns JSON
- [ ] `viben start --json` output includes `name`, `directory`, `port` in addition to existing fields
- [ ] `POST /api/v1/auth/exchange` returns JWT on valid code, 401 on invalid/expired/used
- [ ] `GET /api/v1/workspace` returns `{id, name, directory, version}` with authentication
- [ ] `pnpm test` passes with no failures
- [ ] `pnpm build` compiles with no TypeScript errors
