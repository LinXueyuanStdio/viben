# Phase 2b Part 1: Plugin Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the plugin system infrastructure — ServiceRegistry, MiddlewareChain, PluginStorage, ErrorTracker, PluginLoader, PluginContext, LifecycleManager — so community plugins can load, hook events, register middleware, and provide services. Built-in modules stay hard-wired for now (Plan 2 extracts them).

**Architecture:** New `src/core/plugin/` directory with 8 modules. LifecycleManager orchestrates boot/shutdown. PluginContext is scoped per plugin. MiddlewareChain has 19 typed hook points wired into existing pipeline. Existing core modules auto-register their services in ServiceRegistry so community plugins can call `getService()`.

**Tech Stack:** TypeScript ESM, Vitest for testing. All imports use `.js` extension.

**Spec:** `docs/superpowers/specs/2026-03-26-phase2b-plugin-system.md`

---

## File Structure

### New files to create

```
src/core/plugin/
  types.ts                    — VibenPlugin, PluginContext, MiddlewarePayloadMap, PluginPermission, etc.
  service-registry.ts         — Register/lookup/conflict detection
  middleware-chain.ts         — 19 typed hook points, chain execution, timeout, error handling
  plugin-storage.ts           — KV JSON + dataDir per plugin
  error-tracker.ts            — Per-plugin error budget, auto-disable
  plugin-loader.ts            — Discover built-in + community, validate, topo-sort, checksum
  plugin-context.ts           — PluginContext factory (scoped per plugin)
  lifecycle-manager.ts        — Boot/shutdown orchestration
  index.ts                    — Barrel export
  __tests__/
    service-registry.test.ts
    middleware-chain.test.ts
    plugin-storage.test.ts
    error-tracker.test.ts
    plugin-loader.test.ts
    plugin-context.test.ts
    lifecycle-manager.test.ts
    integration.test.ts
```

### Files to modify

```
src/core/event-bus.ts         — Expand events to match PluginEventMap from spec
src/core/core.ts              — Wire LifecycleManager, auto-register services
src/core/sessions/session-bridge.ts — Insert middleware hooks (agent, message, permission)
src/core/agents/agent-instance.ts   — Insert middleware hooks (fs, terminal)
src/core/sessions/session-factory.ts — Insert middleware hook (session:beforeCreate)
src/core/sessions/session-manager.ts — Insert middleware hook (session:afterDestroy)
src/core/sessions/session.ts  — Insert middleware hooks (mode, model, config, cancel)
src/main.ts                   — Use LifecycleManager for startup
```

---

## Task 1: Plugin Types

All TypeScript types and interfaces for the plugin system. No logic, just types.

**Files:**
- Create: `src/core/plugin/types.ts`
- Create: `src/core/plugin/index.ts`

- [ ] **Step 1: Create types file**

Create `src/core/plugin/types.ts` with ALL types from spec Section 2, 3, 4:
- `VibenPlugin` interface
- `PluginPermission` type
- `PluginContext` interface
- `PluginStorage` interface
- `CommandDef`, `CommandArgs` interfaces
- `MiddlewareHook` type (union of 19 hook names)
- `MiddlewarePayloadMap` interface (typed payloads for each hook)
- `MiddlewareFn<T>` type
- `MiddlewareOptions<T>` interface
- `PluginEventMap` interface (all events with payloads)
- Service contract interfaces: `SecurityService`, `FileServiceInterface`, `NotificationService`, `UsageService`, `SpeechServiceInterface`, `ContextService`, `TunnelServiceInterface`

Import types from `../types.js` (OutgoingMessage, AgentEvent, PermissionRequest, etc.) and `../channel.js` (IChannelAdapter).

- [ ] **Step 2: Create barrel export**

Create `src/core/plugin/index.ts` that re-exports everything from types.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: PASS (types only, no logic)

- [ ] **Step 4: Commit**

```bash
git add src/core/plugin/
git commit -m "feat(plugin): add plugin system types — VibenPlugin, PluginContext, MiddlewarePayloadMap"
```

---

## Task 2: ServiceRegistry

**Files:**
- Create: `src/core/plugin/service-registry.ts`
- Test: `src/core/plugin/__tests__/service-registry.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest'
import { ServiceRegistry } from '../service-registry.js'

describe('ServiceRegistry', () => {
  it('registers and retrieves a service', () => {
    const reg = new ServiceRegistry()
    reg.register('security', { checkAccess: () => true }, '@viben/security')
    expect(reg.get('security')).toBeDefined()
    expect(reg.has('security')).toBe(true)
  })

  it('returns undefined for unregistered service', () => {
    const reg = new ServiceRegistry()
    expect(reg.get('nonexistent')).toBeUndefined()
    expect(reg.has('nonexistent')).toBe(false)
  })

  it('throws on duplicate registration without override', () => {
    const reg = new ServiceRegistry()
    reg.register('security', {}, '@viben/security')
    expect(() => reg.register('security', {}, '@community/other')).toThrow()
  })

  it('lists all registered services', () => {
    const reg = new ServiceRegistry()
    reg.register('a', {}, 'plugin-a')
    reg.register('b', {}, 'plugin-b')
    const list = reg.list()
    expect(list).toHaveLength(2)
    expect(list.map(s => s.name)).toContain('a')
  })

  it('unregisters a service', () => {
    const reg = new ServiceRegistry()
    reg.register('a', {}, 'plugin-a')
    reg.unregister('a')
    expect(reg.has('a')).toBe(false)
  })

  it('allows override when declared', () => {
    const reg = new ServiceRegistry()
    reg.register('security', { v: 1 }, '@viben/security')
    reg.registerOverride('security', { v: 2 }, '@community/custom-security')
    expect(reg.get<{ v: number }>('security')?.v).toBe(2)
  })
})
```

- [ ] **Step 2: Run test — FAIL**
- [ ] **Step 3: Implement ServiceRegistry**
- [ ] **Step 4: Run test — PASS**
- [ ] **Step 5: Build + full test**
- [ ] **Step 6: Commit**

```bash
git add src/core/plugin/service-registry.ts src/core/plugin/__tests__/service-registry.test.ts
git commit -m "feat(plugin): add ServiceRegistry with conflict detection and override support"
```

---

## Task 3: MiddlewareChain

The most complex infrastructure piece — 19 typed hook points with chain execution.

**Files:**
- Create: `src/core/plugin/middleware-chain.ts`
- Test: `src/core/plugin/__tests__/middleware-chain.test.ts`

- [ ] **Step 1: Write tests**

Test the core chain execution, NOT all 19 hooks (that's wiring, Task 10):

```typescript
import { describe, it, expect, vi } from 'vitest'
import { MiddlewareChain } from '../middleware-chain.js'

describe('MiddlewareChain', () => {
  it('executes handler when no middleware registered', async () => {
    const chain = new MiddlewareChain()
    const result = await chain.execute('message:incoming', { text: 'hello' }, (p) => p)
    expect(result).toEqual({ text: 'hello' })
  })

  it('middleware can modify payload', async () => {
    const chain = new MiddlewareChain()
    chain.add('message:incoming', 'test-plugin', {
      handler: async (payload: any, next) => {
        payload.text = 'modified'
        return next()
      }
    })
    const result = await chain.execute('message:incoming', { text: 'original' }, (p) => p)
    expect(result?.text).toBe('modified')
  })

  it('middleware can block by returning null', async () => {
    const chain = new MiddlewareChain()
    chain.add('message:incoming', 'test-plugin', {
      handler: async () => null
    })
    const result = await chain.execute('message:incoming', { text: 'hello' }, (p) => p)
    expect(result).toBeNull()
  })

  it('executes middleware in registration order', async () => {
    const chain = new MiddlewareChain()
    const order: string[] = []
    chain.add('message:incoming', 'a', {
      handler: async (p, next) => { order.push('a'); return next() }
    })
    chain.add('message:incoming', 'b', {
      handler: async (p, next) => { order.push('b'); return next() }
    })
    await chain.execute('message:incoming', {}, (p) => p)
    expect(order).toEqual(['a', 'b'])
  })

  it('priority overrides registration order within same level', async () => {
    const chain = new MiddlewareChain()
    const order: string[] = []
    chain.add('message:incoming', 'a', {
      priority: 20,
      handler: async (p, next) => { order.push('a'); return next() }
    })
    chain.add('message:incoming', 'b', {
      priority: 10,
      handler: async (p, next) => { order.push('b'); return next() }
    })
    await chain.execute('message:incoming', {}, (p) => p)
    expect(order).toEqual(['b', 'a'])  // lower priority runs first
  })

  it('skips middleware that throws and continues chain', async () => {
    const chain = new MiddlewareChain()
    const onError = vi.fn()
    chain.setErrorHandler(onError)
    chain.add('message:incoming', 'bad', {
      handler: async () => { throw new Error('boom') }
    })
    chain.add('message:incoming', 'good', {
      handler: async (p, next) => next()
    })
    const result = await chain.execute('message:incoming', { text: 'hi' }, (p) => p)
    expect(result?.text).toBe('hi')
    expect(onError).toHaveBeenCalledWith('bad', expect.any(Error))
  })

  it('times out middleware after 5 seconds', async () => {
    vi.useFakeTimers()
    const chain = new MiddlewareChain()
    const onError = vi.fn()
    chain.setErrorHandler(onError)
    chain.add('message:incoming', 'slow', {
      handler: async () => new Promise(() => {})  // never resolves
    })
    const promise = chain.execute('message:incoming', { text: 'hi' }, (p) => p)
    await vi.advanceTimersByTimeAsync(5000)
    const result = await promise
    expect(result?.text).toBe('hi')
    vi.useRealTimers()
  })

  it('removes all middleware for a plugin', () => {
    const chain = new MiddlewareChain()
    chain.add('message:incoming', 'test', { handler: async (p, n) => n() })
    chain.add('message:outgoing', 'test', { handler: async (p, n) => n() })
    chain.removeAll('test')
    // Verify by executing — should have no middleware
  })

  it('double next() call returns cached result', async () => {
    const chain = new MiddlewareChain()
    let nextCallCount = 0
    chain.add('message:incoming', 'test', {
      handler: async (p, next) => {
        const r1 = await next()
        nextCallCount++
        const r2 = await next()
        nextCallCount++
        return r1
      }
    })
    await chain.execute('message:incoming', { text: 'hi' }, (p) => {
      return p
    })
    expect(nextCallCount).toBe(2)  // next called twice but chain only executed once
  })
})
```

- [ ] **Step 2: Run test — FAIL**
- [ ] **Step 3: Implement MiddlewareChain**

The chain maintains a `Map<MiddlewareHook, Array<{ pluginName, handler, priority }>>`. `execute()` builds the chain, runs in order, handles timeout + errors.

- [ ] **Step 4: Run test — PASS**
- [ ] **Step 5: Build + full test**
- [ ] **Step 6: Commit**

```bash
git add src/core/plugin/middleware-chain.ts src/core/plugin/__tests__/middleware-chain.test.ts
git commit -m "feat(plugin): add MiddlewareChain with 19 hooks, timeout, error isolation"
```

---

## Task 4: PluginStorage

**Files:**
- Create: `src/core/plugin/plugin-storage.ts`
- Test: `src/core/plugin/__tests__/plugin-storage.test.ts`

- [ ] **Step 1: Write tests**

Test KV operations + dataDir:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PluginStorage } from '../plugin-storage.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('PluginStorage', () => {
  let tmpDir: string
  let storage: PluginStorage

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-storage-'))
    storage = new PluginStorage(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('get returns undefined for missing key', async () => {
    expect(await storage.get('missing')).toBeUndefined()
  })

  it('set and get round-trip', async () => {
    await storage.set('key', { foo: 'bar' })
    expect(await storage.get('key')).toEqual({ foo: 'bar' })
  })

  it('delete removes key', async () => {
    await storage.set('key', 'value')
    await storage.delete('key')
    expect(await storage.get('key')).toBeUndefined()
  })

  it('list returns all keys', async () => {
    await storage.set('a', 1)
    await storage.set('b', 2)
    const keys = await storage.list()
    expect(keys.sort()).toEqual(['a', 'b'])
  })

  it('getDataDir returns and creates directory', () => {
    const dir = storage.getDataDir()
    expect(fs.existsSync(dir)).toBe(true)
  })

  it('persists across instances', async () => {
    await storage.set('key', 'value')
    const storage2 = new PluginStorage(tmpDir)
    expect(await storage2.get('key')).toBe('value')
  })
})
```

- [ ] **Step 2-6: TDD cycle + commit**

```bash
git commit -m "feat(plugin): add PluginStorage with KV JSON and dataDir"
```

---

## Task 5: ErrorTracker

**Files:**
- Create: `src/core/plugin/error-tracker.ts`
- Test: `src/core/plugin/__tests__/error-tracker.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorTracker } from '../error-tracker.js'

describe('ErrorTracker', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('is not disabled initially', () => {
    const tracker = new ErrorTracker()
    expect(tracker.isDisabled('plugin')).toBe(false)
  })

  it('disables after exceeding error budget', () => {
    const tracker = new ErrorTracker({ maxErrors: 3, windowMs: 60000 })
    tracker.increment('plugin')
    tracker.increment('plugin')
    expect(tracker.isDisabled('plugin')).toBe(false)
    tracker.increment('plugin')
    expect(tracker.isDisabled('plugin')).toBe(true)
  })

  it('resets error count after window expires', () => {
    const tracker = new ErrorTracker({ maxErrors: 3, windowMs: 60000 })
    tracker.increment('plugin')
    tracker.increment('plugin')
    vi.advanceTimersByTime(60001)
    tracker.increment('plugin')
    expect(tracker.isDisabled('plugin')).toBe(false)  // window reset
  })

  it('reset clears disabled state', () => {
    const tracker = new ErrorTracker({ maxErrors: 1, windowMs: 60000 })
    tracker.increment('plugin')
    expect(tracker.isDisabled('plugin')).toBe(true)
    tracker.reset('plugin')
    expect(tracker.isDisabled('plugin')).toBe(false)
  })

  it('exempt plugins are never disabled', () => {
    const tracker = new ErrorTracker({ maxErrors: 1, windowMs: 60000 })
    tracker.setExempt('builtin')
    tracker.increment('builtin')
    tracker.increment('builtin')
    tracker.increment('builtin')
    expect(tracker.isDisabled('builtin')).toBe(false)
  })

  it('emits disabled event', () => {
    const onDisabled = vi.fn()
    const tracker = new ErrorTracker({ maxErrors: 1, windowMs: 60000 })
    tracker.onDisabled = onDisabled
    tracker.increment('plugin')
    expect(onDisabled).toHaveBeenCalledWith('plugin', expect.any(String))
  })
})
```

- [ ] **Step 2-6: TDD cycle + commit**

```bash
git commit -m "feat(plugin): add ErrorTracker with per-plugin error budget and auto-disable"
```

---

## Task 6: PluginLoader

**Files:**
- Create: `src/core/plugin/plugin-loader.ts`
- Test: `src/core/plugin/__tests__/plugin-loader.test.ts`

- [ ] **Step 1: Write tests**

Test dependency resolution, topo-sort, cycle detection, override resolution:

```typescript
import { describe, it, expect } from 'vitest'
import { PluginLoader } from '../plugin-loader.js'
import type { VibenPlugin } from '../types.js'

function fakePlugin(name: string, deps?: Record<string, string>): VibenPlugin {
  return {
    name,
    version: '1.0.0',
    pluginDependencies: deps,
    permissions: [],
    setup: async () => {},
  }
}

describe('PluginLoader', () => {
  it('resolves load order with no dependencies', () => {
    const loader = new PluginLoader()
    const order = loader.resolveLoadOrder([
      fakePlugin('a'),
      fakePlugin('b'),
      fakePlugin('c'),
    ])
    expect(order).toHaveLength(3)
  })

  it('resolves dependencies — deps loaded first', () => {
    const loader = new PluginLoader()
    const order = loader.resolveLoadOrder([
      fakePlugin('telegram', { 'security': '^1.0.0' }),
      fakePlugin('security'),
    ])
    expect(order.map(p => p.name)).toEqual(['security', 'telegram'])
  })

  it('detects circular dependencies', () => {
    const loader = new PluginLoader()
    expect(() => loader.resolveLoadOrder([
      fakePlugin('a', { 'b': '^1.0.0' }),
      fakePlugin('b', { 'a': '^1.0.0' }),
    ])).toThrow(/circular/i)
  })

  it('detects missing dependencies', () => {
    const loader = new PluginLoader()
    const result = loader.resolveLoadOrder([
      fakePlugin('telegram', { 'security': '^1.0.0' }),
    ])
    // telegram should be skipped (missing dep)
    expect(result).toHaveLength(0)
  })

  it('handles override — overridden plugin excluded', () => {
    const loader = new PluginLoader()
    const overrider = { ...fakePlugin('custom-security'), overrides: 'security' }
    const order = loader.resolveLoadOrder([
      fakePlugin('security'),
      overrider,
    ])
    expect(order.map(p => p.name)).not.toContain('security')
    expect(order.map(p => p.name)).toContain('custom-security')
  })

  it('multi-level dependency chain', () => {
    const loader = new PluginLoader()
    const order = loader.resolveLoadOrder([
      fakePlugin('c', { 'b': '^1.0.0' }),
      fakePlugin('b', { 'a': '^1.0.0' }),
      fakePlugin('a'),
    ])
    const names = order.map(p => p.name)
    expect(names.indexOf('a')).toBeLessThan(names.indexOf('b'))
    expect(names.indexOf('b')).toBeLessThan(names.indexOf('c'))
  })

  // Checksum verification
  it('computes and stores checksum on register', () => {
    const loader = new PluginLoader()
    const checksum = loader.computeChecksum('/path/to/plugin/index.js')
    expect(typeof checksum).toBe('string')
    expect(checksum.length).toBe(64)  // SHA-256 hex
  })

  it('verifies checksum matches on load', () => {
    const loader = new PluginLoader()
    // Valid checksum → load succeeds
    expect(loader.verifyChecksum('plugin', 'abc123', 'abc123')).toBe(true)
    // Mismatch → load fails
    expect(loader.verifyChecksum('plugin', 'abc123', 'xyz789')).toBe(false)
  })
})
```

- [ ] **Step 2-6: TDD cycle + commit**

```bash
git commit -m "feat(plugin): add PluginLoader with topo-sort, cycle detection, override resolution"
```

---

## Task 7: PluginContext Factory

**Files:**
- Create: `src/core/plugin/plugin-context.ts`
- Test: `src/core/plugin/__tests__/plugin-context.test.ts`

- [ ] **Step 1: Write tests**

Test permission enforcement, event subscription, service access:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createPluginContext } from '../plugin-context.js'
import { ServiceRegistry } from '../service-registry.js'
import { MiddlewareChain } from '../middleware-chain.js'
import { ErrorTracker } from '../error-tracker.js'
import { EventBus } from '../../event-bus.js'

describe('PluginContext', () => {
  function makeCtx(permissions: string[] = []) {
    return createPluginContext({
      pluginName: 'test-plugin',
      pluginConfig: {},
      permissions: permissions as any,
      serviceRegistry: new ServiceRegistry(),
      middlewareChain: new MiddlewareChain(),
      errorTracker: new ErrorTracker(),
      eventBus: new EventBus() as any,
      storagePath: '/tmp/test-plugin-storage',
      sessions: {} as any,
      config: {} as any,
    })
  }

  it('throws when calling registerService without permission', () => {
    const ctx = makeCtx([])
    expect(() => ctx.registerService('test', {})).toThrow(/permission/i)
  })

  it('allows registerService with services:register permission', () => {
    const ctx = makeCtx(['services:register'])
    expect(() => ctx.registerService('test', {})).not.toThrow()
  })

  it('throws when calling on() without events:read permission', () => {
    const ctx = makeCtx([])
    expect(() => ctx.on('session:created', () => {})).toThrow(/permission/i)
  })

  it('allows on() with events:read permission', () => {
    const ctx = makeCtx(['events:read'])
    expect(() => ctx.on('session:created', () => {})).not.toThrow()
  })

  it('exposes pluginName and pluginConfig', () => {
    const ctx = makeCtx([])
    expect(ctx.pluginName).toBe('test-plugin')
    expect(ctx.pluginConfig).toEqual({})
  })

  it('log is always available', () => {
    const ctx = makeCtx([])
    expect(ctx.log).toBeDefined()
    expect(typeof ctx.log.info).toBe('function')
  })

  it('throws when accessing sessions without kernel:access', () => {
    const ctx = makeCtx([])
    expect(() => ctx.sessions).toThrow(/permission/i)
  })

  it('allows emit with events:emit permission', () => {
    const ctx = makeCtx(['events:emit'])
    expect(() => ctx.emit('test-plugin:custom', {})).not.toThrow()
  })

  it('throws on emit without events:emit permission', () => {
    const ctx = makeCtx([])
    expect(() => ctx.emit('test-plugin:custom', {})).toThrow(/permission/i)
  })

  it('throws on getService without services:use permission', () => {
    const ctx = makeCtx([])
    expect(() => ctx.getService('test')).toThrow(/permission/i)
  })

  it('throws on registerMiddleware without middleware:register permission', () => {
    const ctx = makeCtx([])
    expect(() => ctx.registerMiddleware('message:incoming', { handler: async (p, n) => n() })).toThrow(/permission/i)
  })

  it('throws on registerCommand without commands:register permission', () => {
    const ctx = makeCtx([])
    expect(() => ctx.registerCommand({ name: 'test', description: 'test', handler: async () => {} })).toThrow(/permission/i)
  })

  it('throws on storage.set without storage:write permission', async () => {
    const ctx = makeCtx(['storage:read'])
    await expect(ctx.storage.set('key', 'val')).rejects.toThrow(/permission/i)
  })

  it('allows storage.get with storage:read permission', async () => {
    const ctx = makeCtx(['storage:read'])
    await expect(ctx.storage.get('key')).resolves.not.toThrow()
  })

  it('tests sendMessage requires services:use permission', async () => {
    const ctx = makeCtx([])
    await expect(ctx.sendMessage('session-1', { type: 'text', text: 'hi' })).rejects.toThrow(/permission/i)
  })
})
```

- [ ] **Step 2-6: TDD cycle + commit**

```bash
git commit -m "feat(plugin): add PluginContext factory with permission enforcement"
```

---

## Task 8: LifecycleManager

**Files:**
- Create: `src/core/plugin/lifecycle-manager.ts`
- Test: `src/core/plugin/__tests__/lifecycle-manager.test.ts`

- [ ] **Step 1: Write tests**

Test boot sequence, shutdown sequence, plugin failure handling:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { LifecycleManager } from '../lifecycle-manager.js'
import type { VibenPlugin } from '../types.js'

function makePlugin(name: string, opts?: Partial<VibenPlugin>): VibenPlugin {
  return {
    name,
    version: '1.0.0',
    permissions: [],
    setup: vi.fn().mockResolvedValue(undefined),
    teardown: vi.fn().mockResolvedValue(undefined),
    ...opts,
  }
}

describe('LifecycleManager', () => {
  it('calls setup on all plugins in order', async () => {
    const order: string[] = []
    const a = makePlugin('a', { setup: vi.fn(async () => { order.push('a') }) })
    const b = makePlugin('b', {
      pluginDependencies: { 'a': '^1.0.0' },
      setup: vi.fn(async () => { order.push('b') }),
    })
    const mgr = new LifecycleManager({ plugins: [b, a] })
    await mgr.boot()
    expect(order).toEqual(['a', 'b'])
  })

  it('calls teardown in reverse order', async () => {
    const order: string[] = []
    const a = makePlugin('a', { teardown: vi.fn(async () => { order.push('a') }) })
    const b = makePlugin('b', {
      pluginDependencies: { 'a': '^1.0.0' },
      teardown: vi.fn(async () => { order.push('b') }),
    })
    const mgr = new LifecycleManager({ plugins: [b, a] })
    await mgr.boot()
    await mgr.shutdown()
    expect(order).toEqual(['b', 'a'])
  })

  it('skips plugin if setup throws', async () => {
    const a = makePlugin('a', { setup: vi.fn().mockRejectedValue(new Error('fail')) })
    const b = makePlugin('b')
    const mgr = new LifecycleManager({ plugins: [a, b] })
    await mgr.boot()
    expect(a.setup).toHaveBeenCalled()
    expect(b.setup).toHaveBeenCalled()  // b still loads
  })

  it('skips dependent when dependency fails', async () => {
    const a = makePlugin('a', { setup: vi.fn().mockRejectedValue(new Error('fail')) })
    const b = makePlugin('b', { pluginDependencies: { 'a': '^1.0.0' } })
    const mgr = new LifecycleManager({ plugins: [a, b] })
    await mgr.boot()
    expect(b.setup).not.toHaveBeenCalled()
  })

  it('reports loaded and failed plugins', async () => {
    const a = makePlugin('a', { setup: vi.fn().mockRejectedValue(new Error('fail')) })
    const b = makePlugin('b')
    const mgr = new LifecycleManager({ plugins: [a, b] })
    await mgr.boot()
    expect(mgr.loaded).toContain('b')
    expect(mgr.failed).toContain('a')
  })
})
```

- [ ] **Step 2-6: TDD cycle + commit**

NOTE: LifecycleManager needs ServiceRegistry, MiddlewareChain, ErrorTracker, PluginLoader, PluginContext factory as dependencies. Pass them in constructor or create internally.

```bash
git commit -m "feat(plugin): add LifecycleManager with boot/shutdown orchestration"
```

---

## Task 9: Expand EventBus

Add new events to match spec Section 8 PluginEventMap.

**Files:**
- Modify: `src/core/event-bus.ts`

- [ ] **Step 1: Add new events**

Current EventBusEvents has 5 events. Add:
- `session:ended`, `session:named`
- `agent:prompt`
- `permission:resolved`
- `system:ready`, `system:shutdown`, `system:commands-ready`
- `plugin:loaded`, `plugin:failed`, `plugin:disabled`, `plugin:unloaded`
- `kernel:booted`

- [ ] **Step 2: Build + test**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(events): expand EventBus with plugin lifecycle and system events"
```

---

## Task 10: Wire into core.ts + auto-register services

Connect LifecycleManager to VibenCore. Auto-register hard-wired modules as services.

**Files:**
- Modify: `src/core/core.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add LifecycleManager to core**

In `core.ts` constructor:
1. Import LifecycleManager
2. Create instance after existing module init
3. Auto-register existing services: `serviceRegistry.register('security', this.securityGuard, '@viben/security')` etc.
4. Expose for main.ts: `this.lifecycleManager`

In `main.ts`:
1. After adapter registration, call `core.lifecycleManager.boot()` to load community plugins
2. Before `core.start()`, emit `system:ready`

- [ ] **Step 2: Build + full test**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(core): wire LifecycleManager and auto-register built-in services"
```

---

## Task 11: Wire middleware hooks into pipeline

Split into sub-tasks. Each specifies EXACT file + function to modify.

### Task 11a: Message hooks

**Files + functions:**
- `src/core/core.ts` → `handleMessage()` method (~line 315): Wrap the function body with `middlewareChain.execute('message:incoming', incomingMessage, async (msg) => { /* existing handleMessage logic */ })`
- `src/core/sessions/session-bridge.ts` → `wireSessionToAdapter()` method, inside the `sessionEventHandler`: Before calling `this.adapter.sendMessage()`, wrap with `middlewareChain.execute('message:outgoing', { sessionId, message: outgoingMsg }, async (payload) => { this.adapter.sendMessage(payload.sessionId, payload.message) })`

- [ ] **Write tests** verifying both hooks fire with correct payloads
- [ ] **Implement**
- [ ] **Commit:** `feat(plugin): wire message:incoming and message:outgoing hooks`

### Task 11b: Agent hooks

**Files + functions:**
- `src/core/sessions/session-bridge.ts` → `wireSessionToAdapter()`, the `sessionEventHandler` callback: Before processing the event, wrap with `middlewareChain.execute('agent:beforeEvent', { sessionId, event }, ...)`. After processing, call `middlewareChain.execute('agent:afterEvent', { sessionId, event, outgoingMessage }, ...)` (read-only, no await needed).
- `src/core/sessions/session.ts` → `enqueuePrompt()` method: Before calling `this.agentInstance.prompt()`, wrap with `middlewareChain.execute('agent:beforePrompt', { sessionId, text, attachments }, ...)`. Emit `turn:start` before prompt, `turn:end` after PromptResponse received.

- [ ] **Write tests**
- [ ] **Implement**
- [ ] **Commit:** `feat(plugin): wire agent:beforePrompt, agent:beforeEvent, agent:afterEvent, turn hooks`

### Task 11c: FS hooks

**Files + functions:**
- `src/core/agents/agent-instance.ts` → `createClient()` method, `readTextFile` callback (~line 476): Wrap with `middlewareChain.execute('fs:beforeRead', { sessionId, path, line, limit }, ...)`
- Same file, `writeTextFile` callback (~line 492): Wrap with `middlewareChain.execute('fs:beforeWrite', { sessionId, path, content }, ...)`

- [ ] **Write tests**
- [ ] **Implement**
- [ ] **Commit:** `feat(plugin): wire fs:beforeRead and fs:beforeWrite hooks`

### Task 11d: Terminal hooks

**Files + functions:**
- `src/core/agents/agent-instance.ts` → `createClient()` method, `createTerminal` callback (~line 500): Wrap with `middlewareChain.execute('terminal:beforeCreate', { sessionId, command, args, env, cwd }, ...)`
- Same file, after terminal process exits (in `waitForTerminalExit` or process close handler): Call `middlewareChain.execute('terminal:afterExit', { sessionId, terminalId, command, exitCode, durationMs }, ...)` (read-only).

- [ ] **Write tests**
- [ ] **Implement**
- [ ] **Commit:** `feat(plugin): wire terminal:beforeCreate and terminal:afterExit hooks`

### Task 11e: Permission hooks

**Files + functions:**
- `src/core/sessions/session-bridge.ts` → `wirePermissions()` method, the `onPermissionRequest` callback (~line 191): Before calling `permissionGate.setPending()`, wrap with `middlewareChain.execute('permission:beforeRequest', { sessionId, request, autoResolve: undefined }, ...)`. If `payload.autoResolve` is set after middleware, skip UI and return that optionId.
- After permission is resolved (user clicked allow/deny), call `middlewareChain.execute('permission:afterResolve', { sessionId, requestId, decision, userId, durationMs }, ...)` (read-only).

- [ ] **Write tests**
- [ ] **Implement**
- [ ] **Commit:** `feat(plugin): wire permission:beforeRequest and permission:afterResolve hooks`

### Task 11f: Session hooks

**Files + functions:**
- `src/core/sessions/session-factory.ts` → `create()` method (~line 55): Before creating Session, wrap with `middlewareChain.execute('session:beforeCreate', { agentName, workingDir, userId, channelId, threadId }, ...)`. If null → reject session creation.
- `src/core/sessions/session-manager.ts` → wherever session is removed/destroyed (check for `removeSession` or equivalent method): Call `middlewareChain.execute('session:afterDestroy', { sessionId, reason, durationMs, promptCount }, ...)` (read-only).

- [ ] **Write tests**
- [ ] **Implement**
- [ ] **Commit:** `feat(plugin): wire session:beforeCreate and session:afterDestroy hooks`

### Task 11g: Control hooks

**Files + functions:**
- `src/core/sessions/session.ts` → `setMode()` method (if exists, or create wrapper): Wrap with `middlewareChain.execute('mode:beforeChange', { sessionId, fromMode, toMode }, ...)`
- Same file → `setModel()` (or wrapper): Wrap with `middlewareChain.execute('model:beforeChange', { sessionId, fromModel, toModel }, ...)`
- Same file → `setConfigOption()` (or wrapper): Wrap with `middlewareChain.execute('config:beforeChange', { sessionId, configId, oldValue, newValue }, ...)`
- Same file → `cancel()` method: Wrap with `middlewareChain.execute('agent:beforeCancel', { sessionId, reason }, ...)`

- [ ] **Write tests**
- [ ] **Implement**
- [ ] **Commit:** `feat(plugin): wire mode, model, config, cancel control hooks`

---

## Task 12: Config Migration

Add auto-migration from old config format (flat) to new plugin config format.

**Files:**
- Create: `src/core/config/plugin-config-migration.ts`
- Test: `src/core/config/__tests__/plugin-config-migration.test.ts`

- [ ] **Step 1: Write tests**

```typescript
describe('PluginConfigMigration', () => {
  it('detects old config format (no plugins field)', () => { ... })
  it('maps channels.telegram.* to plugins.builtin.@viben/telegram.config.*', () => { ... })
  it('maps security.* to plugins.builtin.@viben/security.config.*', () => { ... })
  it('maps speech.* to plugins.builtin.@viben/speech.config.*', () => { ... })
  it('maps tunnel.* to plugins.builtin.@viben/tunnel.*', () => { ... })
  it('maps usage.* to plugins.builtin.@viben/usage.config.*', () => { ... })
  it('maps api.* to plugins.builtin.@viben/api-server.config.*', () => { ... })
  it('preserves top-level fields (defaultAgent, workingDirectory, debug)', () => { ... })
  it('is idempotent — already-migrated config unchanged', () => { ... })
  it('creates backup of old config', () => { ... })
  it('handles env var overrides after migration', () => { ... })
})
```

- [ ] **Step 2: Implement** following spec Section 10 mapping table
- [ ] **Step 3: Wire into ConfigManager — auto-migrate on load**
- [ ] **Step 4: Build + test + commit**

```bash
git commit -m "feat(config): add plugin config auto-migration from old format"
```

---

## Task 13: CLI plugin commands

**Files:**
- Modify: `src/cli/commands/plugins.ts` — extend existing `cmdPlugins` to handle subcommands
- Modify: `src/cli/commands/index.ts`

NOTE: `src/cli/commands/plugins.ts` already exists with `cmdPlugins` function (handles `viben plugins` = list). Extend it to support:
- `viben plugin add <package>` — install community plugin (npm install + checksum + config)
- `viben plugin remove <package>` — uninstall
- `viben plugin list` — list all (built-in + community) with status
- `viben plugin enable <name>` — set enabled=true in config
- `viben plugin disable <name>` — set enabled=false in config

Keep backward compat: `viben plugins` (plural, no subcommand) still works as alias for `viben plugin list`.

- [ ] **Step 1: Implement subcommands**
- [ ] **Step 2: Build + test**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(cli): extend plugin commands with add/remove/enable/disable"
```

---

## Task 14: Integration test

**Files:**
- Create: `src/core/plugin/__tests__/integration.test.ts`

End-to-end test: boot with mock plugins → verify middleware fires → verify services accessible → shutdown in correct order.

- [ ] **Step 1: Write integration test**

```typescript
describe('Plugin system integration', () => {
  it('boots, loads plugins, fires middleware, shuts down', async () => {
    // Create LifecycleManager with 2 mock plugins
    // Plugin A registers service + middleware
    // Plugin B depends on A, uses service
    // Boot → verify order
    // Execute middleware → verify fires
    // Shutdown → verify reverse order
  })
})
```

- [ ] **Step 2: Implement**
- [ ] **Step 3: Build + full test suite**
- [ ] **Step 4: Commit + push**

```bash
git commit -m "test(plugin): add integration test for full plugin lifecycle"
git push
```

---

## Summary

| Task | Description | Files | Tests |
|------|-------------|-------|-------|
| 1 | Plugin types | 2 create | 0 (types only) |
| 2 | ServiceRegistry | 1 create | 6+ tests |
| 3 | MiddlewareChain | 1 create | 9+ tests |
| 4 | PluginStorage | 1 create | 6+ tests |
| 5 | ErrorTracker | 1 create | 6+ tests |
| 6 | PluginLoader + checksum | 1 create | 8+ tests |
| 7 | PluginContext (all 9 permissions) | 1 create | 16+ tests |
| 8 | LifecycleManager | 1 create | 5+ tests |
| 9 | EventBus expand | 1 modify | build verify |
| 10 | Wire into core | 2 modify | build + existing |
| 11a-g | Wire 19 hooks (exact functions specified) | 6 modify | 19+ tests |
| 12 | Config migration | 2 create | 11+ tests |
| 13 | CLI plugin commands | 1 modify | 3+ tests |
| 14 | Integration test | 1 create | 1 e2e test |
