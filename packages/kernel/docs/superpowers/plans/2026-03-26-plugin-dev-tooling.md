# Plugin Developer Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build plugin developer tooling: SDK package with types + testing utilities, scaffold generator, and dev mode with hot-reload.

**Architecture:** `@viben/plugin-sdk` is a separate package in `packages/plugin-sdk/` (monorepo via pnpm workspace). It re-exports types from the main CLI package and provides testing utilities. `viben plugin create` generates a complete plugin project. `viben dev` loads a local plugin with file watching + hot-reload.

**Tech Stack:** TypeScript strict, ESM-only (.js imports), Vitest, pnpm workspaces, @clack/prompts

---

## File Map

### New Files — Phase 1: SDK Package
| File | Responsibility |
|------|---------------|
| `pnpm-workspace.yaml` | Monorepo workspace definition |
| `packages/plugin-sdk/package.json` | SDK package metadata |
| `packages/plugin-sdk/tsconfig.json` | SDK TypeScript config |
| `packages/plugin-sdk/src/index.ts` | Type + base class re-exports |
| `packages/plugin-sdk/src/testing.ts` | Testing utility barrel export |
| `packages/plugin-sdk/src/testing/test-context.ts` | createTestContext() |
| `packages/plugin-sdk/src/testing/test-install-context.ts` | createTestInstallContext() |
| `packages/plugin-sdk/src/testing/mock-services.ts` | Pre-built service mocks |
| `packages/plugin-sdk/src/__tests__/test-context.test.ts` | Tests |
| `packages/plugin-sdk/src/__tests__/test-install-context.test.ts` | Tests |

### New Files — Phase 2: Scaffold Generator
| File | Responsibility |
|------|---------------|
| `src/cli/commands/plugin-create.ts` | Scaffold CLI command + prompts |
| `src/cli/templates/plugin/` | Template files (inline strings in code) |

### New Files — Phase 3: Dev Mode
| File | Responsibility |
|------|---------------|
| `src/cli/commands/dev.ts` | Dev mode CLI command |
| `src/core/plugin/dev-loader.ts` | DevPluginLoader (watch + reload) |
| `src/core/plugin/__tests__/dev-loader.test.ts` | Tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/core/plugin/plugin-context.ts` | Fix cleanup(): unregister services + commands from registries |
| `src/core/plugin/service-registry.ts` | Add unregisterByPlugin() method |
| `src/cli/commands/index.ts` | Add `create` subcommand + `dev` command routing |

---

## Phase 1: @viben/plugin-sdk

### Task 1: Fix PluginContext cleanup() — Prerequisite

**Files:**
- Modify: `src/core/plugin/service-registry.ts`
- Modify: `src/core/plugin/plugin-context.ts`
- Test: `src/core/plugin/__tests__/plugin-context.test.ts`

- [ ] **Step 1: Add unregisterByPlugin() to ServiceRegistry**

Read `src/core/plugin/service-registry.ts`. Add:

```typescript
unregisterByPlugin(pluginName: string): void {
  for (const [name, entry] of this.services) {
    if (entry.pluginName === pluginName) {
      this.services.delete(name)
    }
  }
}
```

Note: The `register()` method stores `pluginName` as the third parameter. Verify the internal data structure stores it. If it uses a simple Map<string, T>, change to Map<string, { impl: T, pluginName: string }>.

- [ ] **Step 2: Fix cleanup() in plugin-context.ts**

Read `src/core/plugin/plugin-context.ts`. In the `cleanup()` function (around line 174), add service and command cleanup:

```typescript
// After existing middleware cleanup:

// Unregister services registered by this plugin
if (opts.serviceRegistry) {
  opts.serviceRegistry.unregisterByPlugin(opts.pluginName)
}

// Unregister commands from CommandRegistry
const cmdRegistry = opts.serviceRegistry?.get?.('command-registry')
if (cmdRegistry && typeof (cmdRegistry as any).unregisterByPlugin === 'function') {
  (cmdRegistry as any).unregisterByPlugin(opts.pluginName)
}
```

- [ ] **Step 3: Add test for cleanup**

In `src/core/plugin/__tests__/plugin-context.test.ts`, add:

```typescript
it('cleanup unregisters services from ServiceRegistry', () => {
  // Register a service via context, then call cleanup, verify it's gone
})

it('cleanup unregisters commands from CommandRegistry', () => {
  // Register a command via context, then call cleanup, verify it's gone
})
```

- [ ] **Step 4: Verify**

```bash
pnpm build && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add src/core/plugin/service-registry.ts src/core/plugin/plugin-context.ts src/core/plugin/__tests__/plugin-context.test.ts
git commit -m "fix(plugin): cleanup() now unregisters services and commands from global registries"
```

---

### Task 1b: Add unloadPlugin() to LifecycleManager

**Files:**
- Modify: `src/core/plugin/lifecycle-manager.ts`

- [ ] **Step 1: Add unloadPlugin method**

In `src/core/plugin/lifecycle-manager.ts`, add a public method:

```typescript
async unloadPlugin(name: string): Promise<void> {
  if (!this._loaded.has(name)) return

  // Find plugin in loadOrder
  const plugin = this.loadOrder.find(p => p.name === name)

  // Teardown
  if (plugin?.teardown) {
    try {
      await withTimeout(plugin.teardown(), TEARDOWN_TIMEOUT_MS, `${name}.teardown()`)
    } catch {
      // Swallow teardown errors
    }
  }

  // Cleanup context
  const ctx = this.contexts.get(name)
  if (ctx) {
    ctx.cleanup()
    this.contexts.delete(name)
  }

  // Remove from tracking
  this._loaded.delete(name)
  this._failed.delete(name)
  this.loadOrder = this.loadOrder.filter(p => p.name !== name)

  this.eventBus?.emit('plugin:unloaded', { name })
}
```

- [ ] **Step 2: Verify build + existing tests**

```bash
pnpm build && pnpm test src/core/plugin/__tests__/lifecycle-manager.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/core/plugin/lifecycle-manager.ts
git commit -m "feat(plugin): add unloadPlugin() to LifecycleManager for dev mode reload"
```

---

### Task 2: Monorepo Setup

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `packages/plugin-sdk/package.json`
- Create: `packages/plugin-sdk/tsconfig.json`

- [ ] **Step 1: Create pnpm-workspace.yaml**

Create `pnpm-workspace.yaml` at project root:

```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 2: Create SDK package.json**

Create `packages/plugin-sdk/package.json`:

```json
{
  "name": "@viben/plugin-sdk",
  "version": "0.6.10",
  "description": "SDK for building Viben plugins — types, base classes, and testing utilities",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./testing": {
      "types": "./dist/testing.d.ts",
      "import": "./dist/testing.js"
    }
  },
  "files": ["dist/"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "peerDependencies": {
    "viben": ">=0.6.0"
  },
  "devDependencies": {
    "viben": "workspace:*",
    "vitest": "^3.0.0"
  },
  "keywords": ["viben", "plugin", "sdk", "testing"],
  "license": "MIT"
}
```

- [ ] **Step 3: Create SDK tsconfig.json**

Create `packages/plugin-sdk/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/__tests__/**"]
}
```

- [ ] **Step 4: Install workspace dependencies**

```bash
pnpm install
```

- [ ] **Step 5: Verify workspace**

```bash
pnpm ls --filter @viben/plugin-sdk
```

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml packages/
git commit -m "chore: setup monorepo with pnpm workspace for @viben/plugin-sdk"
```

---

### Task 3: SDK Type Exports

**Files:**
- Create: `packages/plugin-sdk/src/index.ts`
- Modify: `src/core/index.ts` (add missing adapter primitive exports)

- [ ] **Step 0: Add missing exports to main package**

In `src/core/index.ts`, add exports for adapter primitives and missing types. These are currently NOT exported from the main package but the SDK needs them:

```typescript
// Add to src/core/index.ts:
export { MessagingAdapter, StreamAdapter } from './adapter-primitives/index.js'
export { BaseRenderer } from './adapter-primitives/index.js'
export { SendQueue, DraftManager, ToolCallTracker, ActivityTracker } from './adapter-primitives/index.js'
```

Verify build: `pnpm build`

- [ ] **Step 1: Create SDK index.ts with all re-exports**

Create `packages/plugin-sdk/src/index.ts`:

```typescript
// ─── Plugin interfaces ───
export type {
  VibenPlugin,
  PluginContext,
  PluginPermission,
  PluginStorage,
  InstallContext,
  MigrateContext,
  TerminalIO,
  SettingsAPI,
} from 'viben'

// ─── Command types ───
export type {
  CommandDef,
  CommandArgs,
  CommandResponse,
  MenuOption,
  ListItem,
} from 'viben'

// ─── Service interfaces ───
export type {
  SecurityService,
  FileServiceInterface,
  NotificationService,
  UsageService,
  SpeechServiceInterface,
  TunnelServiceInterface,
  ContextService,
} from 'viben'

// ─── Adapter types ───
export type {
  IChannelAdapter,
  OutgoingMessage,
  PermissionRequest,
  PermissionOption,
  NotificationMessage,
  AgentCommand,
} from 'viben'

// ─── Adapter base classes ───
export {
  MessagingAdapter,
  StreamAdapter,
  BaseRenderer,
} from 'viben'

// ─── Adapter primitives ───
export {
  SendQueue,
  DraftManager,
  ToolCallTracker,
  ActivityTracker,
} from 'viben'
```

Note: These import from `viben` (the workspace package name). TypeScript resolves via `workspace:*`. When published, consumers install `@viben/kernel` as peer dep which provides the same exports.

- [ ] **Step 2: Verify SDK builds**

```bash
cd packages/plugin-sdk && pnpm build
```

If type resolution fails, check that the main `viben` package exports all listed types from `src/index.ts` → `src/core/index.ts` → `src/core/plugin/types.ts` etc. Fix any missing exports in the main package.

- [ ] **Step 3: Commit**

```bash
git add packages/plugin-sdk/src/index.ts
git commit -m "feat(sdk): add type and base class re-exports"
```

---

### Task 4: Testing Utilities — createTestContext

**Files:**
- Create: `packages/plugin-sdk/src/testing/test-context.ts`
- Create: `packages/plugin-sdk/src/testing.ts`
- Test: `packages/plugin-sdk/src/__tests__/test-context.test.ts`

- [ ] **Step 1: Write tests**

Create `packages/plugin-sdk/src/__tests__/test-context.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createTestContext } from '../testing.js'

describe('createTestContext', () => {
  it('creates context with required fields', () => {
    const ctx = createTestContext({ pluginConfig: { enabled: true } })
    expect(ctx.pluginName).toBeDefined()
    expect(ctx.pluginConfig).toEqual({ enabled: true })
    expect(ctx.registeredCommands).toEqual([])
    expect(ctx.registeredServices.size).toBe(0)
  })

  it('registerService tracks services', () => {
    const ctx = createTestContext({})
    ctx.registerService('my-svc', { hello: 'world' })
    expect(ctx.registeredServices.has('my-svc')).toBe(true)
    expect(ctx.getService('my-svc')).toEqual({ hello: 'world' })
  })

  it('registerCommand tracks commands', () => {
    const ctx = createTestContext({ permissions: ['commands:register'] })
    ctx.registerCommand({
      name: 'test',
      description: 'test cmd',
      category: 'plugin',
      handler: async () => ({ type: 'text', text: 'ok' }),
    })
    expect(ctx.registeredCommands).toHaveLength(1)
    expect(ctx.registeredCommands[0].name).toBe('test')
  })

  it('executeCommand dispatches to registered command', async () => {
    const ctx = createTestContext({ permissions: ['commands:register'] })
    ctx.registerCommand({
      name: 'greet',
      description: 'greet',
      category: 'plugin',
      handler: async (args) => ({ type: 'text', text: `hello ${args.raw}` }),
    })
    const response = await ctx.executeCommand('/greet world')
    expect(response).toEqual({ type: 'text', text: 'hello world' })
  })

  it('getService returns pre-registered services', () => {
    const mockSecurity = { checkAccess: () => true }
    const ctx = createTestContext({
      services: { security: mockSecurity },
    })
    expect(ctx.getService('security')).toBe(mockSecurity)
  })

  it('storage operations work in-memory', async () => {
    const ctx = createTestContext({})
    await ctx.storage.set('key', 'value')
    expect(await ctx.storage.get('key')).toBe('value')
    await ctx.storage.delete('key')
    expect(await ctx.storage.get('key')).toBeUndefined()
  })

  it('on/emit events work', () => {
    const ctx = createTestContext({})
    const calls: unknown[] = []
    ctx.on('test:event', (data: unknown) => calls.push(data))
    ctx.emit('test:event', { foo: 'bar' })
    expect(calls).toEqual([{ foo: 'bar' }])
  })

  it('log methods exist and are silent', () => {
    const ctx = createTestContext({})
    expect(() => ctx.log.info('test')).not.toThrow()
    expect(() => ctx.log.error('test')).not.toThrow()
  })
})
```

- [ ] **Step 2: Implement createTestContext**

Create `packages/plugin-sdk/src/testing/test-context.ts`:

```typescript
import type { PluginContext, CommandDef, CommandArgs, CommandResponse } from '../index.js'

export interface TestContextOpts {
  pluginName?: string
  pluginConfig?: Record<string, unknown>
  permissions?: string[]
  services?: Record<string, unknown>
}

export interface TestPluginContext extends PluginContext {
  registeredServices: Map<string, unknown>
  registeredCommands: CommandDef[]
  registeredMiddleware: Array<{ hook: string; handler: Function }>
  emittedEvents: Array<{ event: string; payload: unknown }>
  executeCommand(commandString: string): Promise<CommandResponse>
}

export function createTestContext(opts: TestContextOpts): TestPluginContext {
  const registeredServices = new Map<string, unknown>()
  const registeredCommands: CommandDef[] = []
  const registeredMiddleware: Array<{ hook: string; handler: Function }> = []
  const emittedEvents: Array<{ event: string; payload: unknown }> = []
  const storage = new Map<string, unknown>()
  const eventListeners = new Map<string, Function[]>()

  // Pre-populate services
  if (opts.services) {
    for (const [name, impl] of Object.entries(opts.services)) {
      registeredServices.set(name, impl)
    }
  }

  const silentLog = {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
    child: () => silentLog,
  }

  const ctx: TestPluginContext = {
    pluginName: opts.pluginName ?? '@test/plugin',
    pluginConfig: opts.pluginConfig ?? {},

    on(event: string, handler: Function) {
      const handlers = eventListeners.get(event) ?? []
      handlers.push(handler)
      eventListeners.set(event, handlers)
    },
    off(event: string, handler: Function) {
      const handlers = eventListeners.get(event) ?? []
      eventListeners.set(event, handlers.filter(h => h !== handler))
    },
    emit(event: string, payload: unknown) {
      emittedEvents.push({ event, payload })
      eventListeners.get(event)?.forEach(h => h(payload))
    },

    registerService(name: string, impl: unknown) {
      registeredServices.set(name, impl)
    },
    getService(name: string) {
      return registeredServices.get(name)
    },

    registerCommand(def: CommandDef) {
      registeredCommands.push(def)
    },

    registerMiddleware(hook: string, mwOpts: any) {
      registeredMiddleware.push({ hook, handler: mwOpts.handler })
    },

    storage: {
      get: async (k: string) => storage.get(k),
      set: async (k: string, v: unknown) => { storage.set(k, v) },
      delete: async (k: string) => { storage.delete(k) },
      list: async () => [...storage.keys()],
      getDataDir: () => '/tmp/test-plugin-data',
    },

    log: silentLog as any,

    // Not available in test context
    sessions: undefined as any,
    config: undefined as any,
    eventBus: undefined as any,
    core: undefined as any,
    sendMessage: async () => {},

    // Test helpers
    registeredServices,
    registeredCommands,
    registeredMiddleware,
    emittedEvents,

    async executeCommand(commandString: string): Promise<CommandResponse> {
      const cleaned = commandString.replace(/^\//, '')
      const spaceIdx = cleaned.indexOf(' ')
      const name = spaceIdx === -1 ? cleaned : cleaned.slice(0, spaceIdx)
      const raw = spaceIdx === -1 ? '' : cleaned.slice(spaceIdx + 1)

      const cmd = registeredCommands.find(c => c.name === name)
      if (!cmd) throw new Error(`Command /${name} not registered`)

      const result = await cmd.handler({
        raw,
        sessionId: null,
        channelId: 'test',
        userId: 'test-user',
        reply: async () => {},
      } as CommandArgs)

      return result ?? { type: 'silent' as const }
    },
  }

  return ctx
}
```

- [ ] **Step 3: Create testing barrel export (partial — complete in Task 5)**

Create `packages/plugin-sdk/src/testing.ts` with only what's available now:

```typescript
export { createTestContext } from './testing/test-context.js'
export type { TestPluginContext, TestContextOpts } from './testing/test-context.js'
```

Note: `createTestInstallContext` and `mockServices` exports added in Task 5 after those files are created.

- [ ] **Step 4: Run tests**

```bash
cd packages/plugin-sdk && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-sdk/
git commit -m "feat(sdk): add createTestContext testing utility"
```

---

### Task 5: Testing Utilities — createTestInstallContext + mockServices

**Files:**
- Create: `packages/plugin-sdk/src/testing/test-install-context.ts`
- Create: `packages/plugin-sdk/src/testing/mock-services.ts`
- Test: `packages/plugin-sdk/src/__tests__/test-install-context.test.ts`

- [ ] **Step 1: Write tests**

Create `packages/plugin-sdk/src/__tests__/test-install-context.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createTestInstallContext } from '../testing.js'

describe('createTestInstallContext', () => {
  it('creates context with required fields', () => {
    const ctx = createTestInstallContext({ pluginName: '@test/plugin' })
    expect(ctx.pluginName).toBe('@test/plugin')
    expect(ctx.terminal).toBeDefined()
    expect(ctx.settings).toBeDefined()
    expect(ctx.dataDir).toBeDefined()
    expect(ctx.log).toBeDefined()
  })

  it('auto-answers terminal prompts', async () => {
    const ctx = createTestInstallContext({
      terminalResponses: {
        text: 'hello',
        password: 'secret',
        confirm: true,
        select: 'option1',
      },
    })

    expect(await ctx.terminal.text({ message: 'Name?' })).toBe('hello')
    expect(await ctx.terminal.password({ message: 'Token?' })).toBe('secret')
    expect(await ctx.terminal.confirm({ message: 'Sure?' })).toBe(true)
    expect(await ctx.terminal.select({ message: 'Pick', options: [{ value: 'option1', label: 'One' }] })).toBe('option1')
  })

  it('sequential answers for multiple calls', async () => {
    const ctx = createTestInstallContext({
      terminalResponses: { text: ['first', 'second', 'third'] },
    })

    expect(await ctx.terminal.text({ message: '1' })).toBe('first')
    expect(await ctx.terminal.text({ message: '2' })).toBe('second')
    expect(await ctx.terminal.text({ message: '3' })).toBe('third')
  })

  it('settings persist in memory', async () => {
    const ctx = createTestInstallContext({})
    await ctx.settings.setAll({ token: 'abc', enabled: true })
    expect(await ctx.settings.get('token')).toBe('abc')
    expect(await ctx.settings.getAll()).toEqual({ token: 'abc', enabled: true })
  })

  it('passes legacyConfig', () => {
    const ctx = createTestInstallContext({
      legacyConfig: { oldToken: '123' },
    })
    expect(ctx.legacyConfig).toEqual({ oldToken: '123' })
  })

  it('tracks terminal calls', async () => {
    const ctx = createTestInstallContext({
      terminalResponses: { text: 'answer' },
    })
    await ctx.terminal.text({ message: 'Question?' })
    expect(ctx.terminalCalls).toContainEqual(
      expect.objectContaining({ method: 'text' })
    )
  })
})
```

- [ ] **Step 2: Implement createTestInstallContext**

Create `packages/plugin-sdk/src/testing/test-install-context.ts`:

```typescript
import type { InstallContext, SettingsAPI, TerminalIO } from '../index.js'

export interface TestInstallContextOpts {
  pluginName?: string
  legacyConfig?: Record<string, unknown>
  terminalResponses?: {
    text?: string | string[]
    password?: string | string[]
    select?: unknown | unknown[]
    confirm?: boolean | boolean[]
    multiselect?: unknown[] | unknown[][]
  }
}

export interface TestInstallContext extends InstallContext {
  terminalCalls: Array<{ method: string; opts: unknown; response: unknown }>
}

function makeSequentialGetter<T>(values: T | T[] | undefined, fallback: T): () => T {
  if (values === undefined) return () => fallback
  if (!Array.isArray(values)) return () => values
  let index = 0
  return () => values[index++] ?? values[values.length - 1]
}

export function createTestInstallContext(opts: TestInstallContextOpts): TestInstallContext {
  const settings = new Map<string, unknown>()
  const terminalCalls: Array<{ method: string; opts: unknown; response: unknown }> = []
  const responses = opts.terminalResponses ?? {}

  const getText = makeSequentialGetter(responses.text, '')
  const getPassword = makeSequentialGetter(responses.password, '')
  const getSelect = makeSequentialGetter(responses.select, undefined)
  const getConfirm = makeSequentialGetter(responses.confirm, false)
  const getMultiselect = makeSequentialGetter(responses.multiselect, [])

  const terminal: TerminalIO = {
    async text(o) { const r = getText(); terminalCalls.push({ method: 'text', opts: o, response: r }); return r },
    async select(o) { const r = getSelect(); terminalCalls.push({ method: 'select', opts: o, response: r }); return r as any },
    async confirm(o) { const r = getConfirm(); terminalCalls.push({ method: 'confirm', opts: o, response: r }); return r },
    async password(o) { const r = getPassword(); terminalCalls.push({ method: 'password', opts: o, response: r }); return r },
    async multiselect(o) { const r = getMultiselect(); terminalCalls.push({ method: 'multiselect', opts: o, response: r }); return r as any },
    log: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
      step: () => {},
    },
    spinner: () => ({ start: () => {}, stop: () => {}, fail: () => {} }),
    note: () => {},
    cancel: () => {},
  }

  const settingsApi: SettingsAPI = {
    async get(k) { return settings.get(k) },
    async set(k, v) { settings.set(k, v) },
    async getAll() { return Object.fromEntries(settings) },
    async setAll(s) { settings.clear(); for (const [k, v] of Object.entries(s)) settings.set(k, v) },
    async delete(k) { settings.delete(k) },
    async clear() { settings.clear() },
    async has(k) { return settings.has(k) },
  }

  return {
    pluginName: opts.pluginName ?? '@test/plugin',
    terminal,
    settings: settingsApi,
    legacyConfig: opts.legacyConfig,
    dataDir: '/tmp/test-plugin-data',
    log: { trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) } as any,
    terminalCalls,
  }
}
```

- [ ] **Step 3: Implement mockServices**

Create `packages/plugin-sdk/src/testing/mock-services.ts`:

```typescript
import type {
  SecurityService,
  FileServiceInterface,
  NotificationService,
  UsageService,
  SpeechServiceInterface,
  TunnelServiceInterface,
  ContextService,
} from '../index.js'

export const mockServices = {
  security(opts?: { allowAll?: boolean }): SecurityService {
    return {
      checkAccess: () => opts?.allowAll ?? true,
      checkSessionLimit: () => true,
      getUserRole: () => 'user',
    } as SecurityService
  },

  fileService(): FileServiceInterface {
    return {
      saveFile: async () => '/tmp/mock-file',
      resolveFile: async () => '/tmp/mock-file',
      readTextFileWithRange: async () => 'mock content',
      convertOggToWav: async () => Buffer.from(''),
      extensionFromMime: () => '.txt',
    } as FileServiceInterface
  },

  notifications(): NotificationService {
    return {
      notify: async () => {},
      notifyAll: async () => {},
    } as NotificationService
  },

  usage(opts?: { budget?: number }): UsageService {
    return {
      trackUsage: async () => {},
      checkBudget: async () => ({ allowed: true, remaining: opts?.budget ?? 100 }),
      getSummary: async () => ({ monthlySpend: 0, monthlyBudget: opts?.budget ?? 100, sessionCount: 0 }),
    } as UsageService
  },

  speech(): SpeechServiceInterface {
    return {
      textToSpeech: async () => Buffer.from(''),
      speechToText: async () => 'mock transcript',
    } as SpeechServiceInterface
  },

  tunnel(opts?: { publicUrl?: string }): TunnelServiceInterface {
    return {
      getPublicUrl: () => opts?.publicUrl ?? 'https://mock.tunnel.dev',
      isConnected: () => !!opts?.publicUrl,
      start: async () => {},
      stop: async () => {},
    } as TunnelServiceInterface
  },

  context(): ContextService {
    return {
      buildContext: async () => ({ text: 'mock context', tokens: 100 }),
      registerProvider: () => {},
    } as ContextService
  },
}
```

- [ ] **Step 4: Run SDK tests**

```bash
cd packages/plugin-sdk && pnpm test
```

- [ ] **Step 5: Build SDK**

```bash
cd packages/plugin-sdk && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-sdk/
git commit -m "feat(sdk): add createTestInstallContext + mockServices testing utilities"
```

---

## Phase 2: Scaffold Generator

### Task 6: `viben plugin create` Command

**Files:**
- Create: `src/cli/commands/plugin-create.ts`
- Modify: `src/cli/commands/plugins.ts` (add 'create' subcommand)

- [ ] **Step 1: Implement scaffold command**

Create `src/cli/commands/plugin-create.ts`:

```typescript
import * as clack from '@clack/prompts'
import fs from 'node:fs'
import path from 'node:path'

export async function cmdPluginCreate(): Promise<void> {
  clack.intro('Create a new Viben plugin')

  const name = String(await clack.text({
    message: 'Plugin name:',
    placeholder: 'my-awesome-plugin',
    validate: (v) => v.trim() ? undefined : 'Name is required',
  }))
  if (typeof name === 'symbol') return

  const description = String(await clack.text({
    message: 'Description:',
    placeholder: 'What does your plugin do?',
  }))
  if (typeof description === 'symbol') return

  const author = String(await clack.text({
    message: 'Author:',
    placeholder: 'yourname',
  }))
  if (typeof author === 'symbol') return

  const license = String(await clack.text({
    message: 'License:',
    initialValue: 'MIT',
  }))
  if (typeof license === 'symbol') return

  const dirName = name.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const packageName = author ? `@${author}/viben-plugin-${dirName}` : `viben-plugin-${dirName}`
  const targetDir = path.resolve(dirName)

  if (fs.existsSync(targetDir)) {
    clack.log.error(`Directory ${dirName}/ already exists`)
    return
  }

  const spinner = clack.spinner()
  spinner.start('Creating plugin...')

  // Create directories
  fs.mkdirSync(path.join(targetDir, 'src', '__tests__'), { recursive: true })

  // Write files
  const files: Record<string, string> = {
    'src/index.ts': generatePluginTemplate(packageName, description),
    'src/__tests__/index.test.ts': generateTestTemplate(packageName),
    'package.json': generatePackageJson(packageName, description, author, license),
    'tsconfig.json': generateTsConfig(),
    '.gitignore': 'node_modules/\ndist/\n*.tsbuildinfo\n.DS_Store\n.env\n.env.*\n*.log\n',
    '.npmignore': 'src/\n__tests__/\ntsconfig.json\n.gitignore\n.editorconfig\n.DS_Store\n*.tsbuildinfo\n.env\n.env.*\n',
    '.editorconfig': 'root = true\n\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf\ncharset = utf-8\ntrim_trailing_whitespace = true\ninsert_final_newline = true\n',
    'README.md': generateReadme(packageName, description, license),
  }

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(targetDir, filePath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content)
  }

  spinner.stop('Plugin created!')

  clack.note(
    `cd ${dirName}\nnpm install\nnpm run dev`,
    'Next steps',
  )

  clack.outro(`Plugin ${packageName} ready!`)
}

function generatePluginTemplate(packageName: string, description: string): string {
  // Return the full template from the spec Section 2
  // (inline string with all hooks commented)
  return `import type { VibenPlugin, InstallContext, MigrateContext } from '@viben/plugin-sdk'
import { z } from 'zod'

const settingsSchema = z.object({
  apiKey: z.string().optional(),
  enabled: z.boolean().default(true),
})

const plugin: VibenPlugin = {
  name: '${packageName}',
  version: '1.0.0',
  description: '${description}',
  essential: false,
  permissions: ['services:register', 'events:read', 'commands:register'],
  settingsSchema,

  async install(ctx: InstallContext) {
    if (ctx.legacyConfig) {
      await ctx.settings.setAll(ctx.legacyConfig as Record<string, unknown>)
      ctx.terminal.log.success('Settings migrated')
      return
    }
    const apiKey = await ctx.terminal.password({ message: 'Enter API key (optional):' })
    await ctx.settings.setAll({ apiKey: apiKey || undefined, enabled: true })
    ctx.terminal.log.success('Plugin installed!')
  },

  async configure(ctx: InstallContext) {
    const current = await ctx.settings.getAll()
    const action = await ctx.terminal.select({
      message: 'What to configure?',
      options: [
        { value: 'apiKey', label: 'API Key', hint: current.apiKey ? 'Set' : 'Not set' },
        { value: 'enabled', label: 'Enabled', hint: String(current.enabled ?? true) },
      ],
    })
    if (action === 'apiKey') {
      const key = await ctx.terminal.password({ message: 'New API key:' })
      await ctx.settings.set('apiKey', key)
    } else if (action === 'enabled') {
      const enabled = await ctx.terminal.confirm({ message: 'Enable plugin?' })
      await ctx.settings.set('enabled', enabled)
    }
    ctx.terminal.log.success('Settings updated! Restart to apply.')
  },

  async migrate(_ctx: MigrateContext, oldSettings: unknown, _oldVersion: string) {
    return oldSettings
  },

  async setup(ctx) {
    const config = ctx.pluginConfig as z.infer<typeof settingsSchema>
    if (!config.enabled) return

    ctx.registerCommand({
      name: 'example',
      description: 'Example command',
      usage: '<arg>',
      category: 'plugin',
      handler: async (args) => {
        if (!args.raw.trim()) {
          return { type: 'menu', title: 'Example Plugin', options: [
            { label: 'Option A', command: '/example a' },
            { label: 'Option B', command: '/example b' },
          ]}
        }
        return { type: 'text', text: \`You said: \${args.raw}\` }
      },
    })

    ctx.log.info('Plugin loaded')
  },

  async teardown() {},

  async uninstall(ctx: InstallContext, { purge }) {
    if (purge) await ctx.settings.clear()
    ctx.terminal.log.success('Plugin uninstalled')
  },
}

export default plugin
`
}

function generateTestTemplate(packageName: string): string {
  return `import { describe, it, expect } from 'vitest'
import { createTestContext } from '@viben/plugin-sdk/testing'
import plugin from '../index.js'

describe('${packageName}', () => {
  it('loads successfully', async () => {
    const ctx = createTestContext({
      pluginConfig: { enabled: true },
      permissions: plugin.permissions,
    })
    await plugin.setup(ctx)
    expect(ctx.registeredCommands).toContainEqual(
      expect.objectContaining({ name: 'example' })
    )
  })

  it('skips when disabled', async () => {
    const ctx = createTestContext({ pluginConfig: { enabled: false } })
    await plugin.setup(ctx)
    expect(ctx.registeredCommands).toHaveLength(0)
  })

  it('/example returns menu when no args', async () => {
    const ctx = createTestContext({
      pluginConfig: { enabled: true },
      permissions: plugin.permissions,
    })
    await plugin.setup(ctx)
    const response = await ctx.executeCommand('/example')
    expect(response.type).toBe('menu')
  })

  it('/example echoes args', async () => {
    const ctx = createTestContext({
      pluginConfig: { enabled: true },
      permissions: plugin.permissions,
    })
    await plugin.setup(ctx)
    const response = await ctx.executeCommand('/example hello world')
    expect(response).toEqual({ type: 'text', text: 'You said: hello world' })
  })
})
`
}

function generatePackageJson(name: string, description: string, author: string, license: string): string {
  return JSON.stringify({
    name,
    version: '1.0.0',
    description,
    type: 'module',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    files: ['dist/'],
    scripts: {
      build: 'tsc',
      dev: 'viben dev .',
      test: 'vitest run',
      'test:watch': 'vitest',
      prepublishOnly: 'npm run build',
    },
    keywords: ['viben', 'viben-plugin'],
    author,
    license,
    peerDependencies: { '@viben/kernel': '>=0.6.0' },
    devDependencies: {
      '@viben/plugin-sdk': '0.6.10',
      typescript: '^5.7.0',
      vitest: '^3.0.0',
      zod: '^3.24.0',
    },
  }, null, 2) + '\n'
}

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      declaration: true,
      outDir: 'dist',
      rootDir: 'src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['src/**/*.ts'],
    exclude: ['src/**/__tests__/**'],
  }, null, 2) + '\n'
}

function generateReadme(name: string, description: string, license: string): string {
  return `# ${name}

${description}

## Installation

\`\`\`bash
viben plugin install ${name}
\`\`\`

## Configuration

\`\`\`bash
viben plugin configure ${name}
\`\`\`

## Commands

- \`/example <arg>\` — Example command

## Development

\`\`\`bash
npm install
npm run dev          # Start Viben with this plugin in dev mode
npm test             # Run tests
npm run build        # Build for publishing
\`\`\`

## License

${license}
`
}
```

- [ ] **Step 2: Wire into CLI**

In `src/cli/commands/plugins.ts`, add 'create' case to the `cmdPlugin()` switch:

```typescript
case 'create': {
  const { cmdPluginCreate } = await import('./plugin-create.js')
  await cmdPluginCreate()
  return
}
```

Also update help text to include `create`.

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/plugin-create.ts src/cli/commands/plugins.ts
git commit -m "feat(cli): add viben plugin create scaffold generator"
```

---

## Phase 3: Dev Mode

### Task 7: DevPluginLoader

**Files:**
- Create: `src/core/plugin/dev-loader.ts`
- Test: `src/core/plugin/__tests__/dev-loader.test.ts`

- [ ] **Step 1: Write tests**

Create `src/core/plugin/__tests__/dev-loader.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DevPluginLoader } from '../dev-loader.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('DevPluginLoader', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-loader-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('validates plugin path exists', async () => {
    const loader = new DevPluginLoader('/nonexistent/path')
    await expect(loader.load()).rejects.toThrow(/not found/)
  })

  it('loads plugin from valid path', async () => {
    // Create a mock plugin file
    const pluginCode = `export default { name: '@test/dev', version: '1.0.0', permissions: [], setup: async () => {} }`
    const distDir = path.join(tmpDir, 'dist')
    fs.mkdirSync(distDir, { recursive: true })
    fs.writeFileSync(path.join(distDir, 'index.js'), pluginCode)

    const loader = new DevPluginLoader(tmpDir)
    const plugin = await loader.load()
    expect(plugin.name).toBe('@test/dev')
  })

  it('reloads plugin with new module', async () => {
    const distDir = path.join(tmpDir, 'dist')
    fs.mkdirSync(distDir, { recursive: true })

    // Write v1
    fs.writeFileSync(path.join(distDir, 'index.js'), `export default { name: '@test/v1', version: '1.0.0', permissions: [], setup: async () => {} }`)

    const loader = new DevPluginLoader(tmpDir)
    const v1 = await loader.load()
    expect(v1.name).toBe('@test/v1')

    // Write v2
    fs.writeFileSync(path.join(distDir, 'index.js'), `export default { name: '@test/v2', version: '2.0.0', permissions: [], setup: async () => {} }`)

    const v2 = await loader.load()
    expect(v2.name).toBe('@test/v2')
  })
})
```

- [ ] **Step 2: Implement DevPluginLoader**

Create `src/core/plugin/dev-loader.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import type { VibenPlugin } from './types.js'

export class DevPluginLoader {
  private pluginPath: string

  constructor(pluginPath: string) {
    this.pluginPath = path.resolve(pluginPath)
  }

  async load(): Promise<VibenPlugin> {
    const distIndex = path.join(this.pluginPath, 'dist', 'index.js')
    const srcIndex = path.join(this.pluginPath, 'src', 'index.ts')

    if (!fs.existsSync(distIndex) && !fs.existsSync(srcIndex)) {
      throw new Error(`Plugin not found at ${this.pluginPath}. Expected dist/index.js or src/index.ts`)
    }

    if (!fs.existsSync(distIndex)) {
      throw new Error(`Built plugin not found at ${distIndex}. Run 'npm run build' first or use TypeScript compilation.`)
    }

    // Cache-bust: append timestamp to force re-import
    const url = new URL(`file://${distIndex}?t=${Date.now()}`).href
    const mod = await import(url)
    const plugin = mod.default as VibenPlugin

    if (!plugin || !plugin.name || !plugin.setup) {
      throw new Error(`Invalid plugin at ${distIndex}. Must export default VibenPlugin with name and setup().`)
    }

    return plugin
  }

  getPluginPath(): string {
    return this.pluginPath
  }

  getDistPath(): string {
    return path.join(this.pluginPath, 'dist')
  }
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm test src/core/plugin/__tests__/dev-loader.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/core/plugin/dev-loader.ts src/core/plugin/__tests__/dev-loader.test.ts
git commit -m "feat(plugin): add DevPluginLoader for loading local plugins"
```

---

### Task 8: `viben dev` CLI Command

**Files:**
- Create: `src/cli/commands/dev.ts`
- Modify: `src/cli/commands/index.ts` (add dev command routing)

- [ ] **Step 1: Implement dev command**

Create `src/cli/commands/dev.ts`:

```typescript
import path from 'node:path'
import fs from 'node:fs'
import { DevPluginLoader } from '../../core/plugin/dev-loader.js'
import type { VibenPlugin } from '../../core/plugin/types.js'

export async function cmdDev(args: string[]): Promise<void> {
  const pluginPath = args[0]
  if (!pluginPath) {
    console.error('Usage: viben dev <plugin-path> [--no-watch] [--verbose]')
    process.exit(1)
  }

  const noWatch = args.includes('--no-watch')
  const verbose = args.includes('--verbose')
  const resolvedPath = path.resolve(pluginPath)

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Plugin path not found: ${resolvedPath}`)
    process.exit(1)
  }

  console.log(`\n  🔧 Viben Dev Mode\n  Plugin: ${resolvedPath}\n`)

  // Check for TypeScript — compile first if needed
  const tsconfigPath = path.join(resolvedPath, 'tsconfig.json')
  let tscProcess: import('node:child_process').ChildProcess | undefined

  if (fs.existsSync(tsconfigPath)) {
    console.log('  Compiling TypeScript...')
    const { spawn } = await import('node:child_process')

    // Initial compile
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('npx', ['tsc', '--project', tsconfigPath], {
        cwd: resolvedPath,
        stdio: verbose ? 'inherit' : 'pipe',
      })
      proc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`TypeScript compilation failed (exit code ${code})`))
      })
    })

    // Start watch mode if not --no-watch
    if (!noWatch) {
      tscProcess = spawn('npx', ['tsc', '--watch', '--project', tsconfigPath], {
        cwd: resolvedPath,
        stdio: verbose ? 'inherit' : 'pipe',
      })
      console.log('  TypeScript watch mode started')
    }
  }

  // Start Viben with dev plugin option
  const { startServer } = await import('../../main.js')

  try {
    await startServer({ devPlugin: { path: resolvedPath, noWatch, verbose } })
  } finally {
    tscProcess?.kill()
  }
}
```

Note: `startServer()` must be updated to accept an optional `devPlugin` parameter. If `main.ts` doesn't export `startServer`, refactor it to do so. Check `src/main.ts` — it likely already exports `startServer()`.

```

- [ ] **Step 2: Wire into CLI routing**

Read `src/cli.ts` (or `src/cli/index.ts`) to find where CLI commands are routed (the main switch/if-else that dispatches 'start', 'plugins', etc.). Add a 'dev' case:

```typescript
case 'dev': {
  const { cmdDev } = await import('./commands/dev.js')
  await cmdDev(args.slice(1))
  return
}
```

Note: The exact routing location may be in `src/cli.ts`, `src/cli/commands/index.ts`, or another router file. Read the file first to find the right place.

- [ ] **Step 3: Add dev plugin loading to main.ts**

In `src/main.ts`, after `lifecycle.boot(corePlugins)`, add:

```typescript
// Load dev plugin if running in dev mode (passed via startServer options)
if (opts?.devPlugin) {
  const { DevPluginLoader } = await import('./core/plugin/dev-loader.js')
  const loader = new DevPluginLoader(opts.devPlugin.path)

  const loadDevPlugin = async () => {
    try {
      const plugin = await loader.load()
      // Unload previous version if exists
      await lifecycle.unloadPlugin(plugin.name)
      // Boot the dev plugin
      await lifecycle.boot([plugin])
      log.info({ plugin: plugin.name }, 'Dev plugin loaded')
    } catch (err) {
      log.error({ err }, 'Failed to load dev plugin')
    }
  }

  await loadDevPlugin()

  // Watch for changes using fs.watch
  if (!opts.devPlugin.noWatch) {
    const nodeFs = await import('node:fs')
    const distPath = loader.getDistPath()

    let debounceTimer: NodeJS.Timeout | undefined
    nodeFs.watch(distPath, { recursive: true }, () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        log.info('Dev plugin changed, reloading...')
        await loadDevPlugin()
      }, 500)
    })
  }
}
```

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/dev.ts src/cli/commands/index.ts src/main.ts
git commit -m "feat(cli): add viben dev command with hot-reload for local plugins"
```

---

### Task 9: Final Verification + Push

- [ ] **Step 1: Full build + test**

```bash
pnpm build && pnpm test
cd packages/plugin-sdk && pnpm build && pnpm test
```

- [ ] **Step 2: Verify all phases work**

```bash
# Phase 1: SDK builds
cd packages/plugin-sdk && pnpm build

# Phase 2: scaffold generates a project (manual test)
# viben plugin create (interactive — skip in CI)

# Phase 3: dev mode starts (manual test — needs running Viben)
# viben dev ./test-plugin/ (skip in CI)
```

- [ ] **Step 3: Push**

```bash
git push
```
