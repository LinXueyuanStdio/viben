# Tunnel Reconnect on Restart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve tunnel URLs across graceful restarts by reconnecting to existing Cloudflare tunnels instead of creating new ones every time.

**Architecture:** During shutdown, skip deleting the tunnel from the Cloudflare worker and preserve the tunnel state in plugin storage. On restart, the Viben provider's existing `resolveCredentials()` logic already pings the worker and reuses the tunnel if it's still alive (within 24h TTL). The only changes needed are: (1) don't destroy state on shutdown, (2) persist `tunnels.json` before clearing in-memory entries, (3) drop stale `sessionId` on restore.

**Tech Stack:** TypeScript, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/plugins/tunnel/provider.ts` | Modify | Add `preserveState` param to `stop()` interface |
| `src/plugins/tunnel/providers/viben.ts` | Modify | Skip worker deletion and storage cleanup when `preserveState=true` |
| `src/plugins/tunnel/tunnel-registry.ts` | Modify | Pass `preserveState=true` during shutdown, persist entries before clearing, drop sessionId on restore, guard double shutdown |
| `src/plugins/tunnel/__tests__/viben-provider.test.ts` | Modify | Add tests for `stop()` with `preserveState` (file already exists — append to it) |
| `src/plugins/tunnel/__tests__/tunnel-registry.test.ts` | Modify | Add tests for shutdown persistence and restore sessionId behavior |

---

## Callsite Safety Analysis

Before implementing, confirm all `provider.stop()` callsites behave correctly:

| Callsite | Location | Args after change | Behavior | Correct? |
|----------|----------|-------------------|----------|----------|
| `registry.shutdown()` | `tunnel-registry.ts:274` | `stop(true, true)` | Kill process, preserve state for reconnect | Yes — this is the change |
| `registry.stop(port)` | `tunnel-registry.ts:239` | `stop()` → `stop(false, false)` | Full cleanup (delete from worker + storage) | Yes — user-initiated stop |
| Keepalive dead detection | `tunnel-registry.ts:142` | `stop()` → `stop(false, false)` | Full cleanup — tunnel is dead on worker anyway | Yes — correct |
| Other providers (cloudflare, ngrok, bore, tailscale) | various | `preserveState` ignored | No state to preserve | Yes — no change needed |

---

### Task 1: Update TunnelProvider Interface

**Files:**
- Modify: `src/plugins/tunnel/provider.ts`

- [ ] **Step 1: Add `preserveState` parameter to `stop()` in the interface**

```typescript
export interface TunnelProvider {
  start(localPort: number): Promise<string>  // returns public URL
  /** Stop the tunnel. When force=true, skip graceful shutdown and SIGKILL immediately.
   *  When preserveState=true, keep tunnel alive on remote (don't delete from worker/storage) for reconnect on restart. */
  stop(force?: boolean, preserveState?: boolean): Promise<void>
  getPublicUrl(): string
  /** Register a callback invoked when the tunnel process exits unexpectedly after establishment. */
  onExit(callback: (code: number | null) => void): void
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build`
Expected: No errors — existing providers implement `stop(force?)` which is still compatible since `preserveState` is optional.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/tunnel/provider.ts
git commit -m "feat(tunnel): add preserveState param to TunnelProvider.stop() interface"
```

---

### Task 2: Implement `preserveState` in Viben Provider

**Files:**
- Modify: `src/plugins/tunnel/providers/viben.ts`
- Modify: `src/plugins/tunnel/__tests__/viben-provider.test.ts` (existing file)

- [ ] **Step 1: Add the failing test to the existing test file**

Append a new `describe` block at the end of `src/plugins/tunnel/__tests__/viben-provider.test.ts`:

```typescript
describe('VibenTunnelProvider — preserveState', () => {
  let storage: ReturnType<typeof makeStorage>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    storage = makeStorage()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('stop(true, true) kills process but does NOT delete from worker or clear storage', async () => {
    const saved = { '3100': { tunnelId: 'cf-ps', token: 'tok-ps', publicUrl: 'https://ps.tunnel.viben.ai' } }
    storage = makeStorage({ 'viben-tunnels': saved })

    const proc = makeProcess()
    vi.mocked(spawn).mockReturnValue(proc as any)
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    const provider = new VibenTunnelProvider({}, '/mock/bin', storage)
    const startPromise = provider.start(3100)
    await vi.advanceTimersByTimeAsync(15_001)
    await startPromise

    // Stop WITH preserveState
    await provider.stop(true, true)

    // Should have killed the process
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL')

    // Should NOT have called DELETE on worker
    const deleteCalls = fetchMock.mock.calls.filter(
      ([url, init]: [any, any]) => init?.method === 'DELETE'
    )
    expect(deleteCalls.length).toBe(0)

    // Storage should still have the tunnel state
    const state = await storage.get<Record<string, unknown>>('viben-tunnels')
    expect(state).toEqual(saved)
  })

  it('stop(false, false) still deletes from worker and clears storage (default behavior)', async () => {
    const proc = makeProcess()
    vi.mocked(spawn).mockReturnValue(proc as any)

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tunnelId: 'cf-del', token: 'tok-del', publicUrl: 'https://del.tunnel.viben.ai' }) })
      .mockResolvedValue({ ok: true, json: async () => ({}) })

    const provider = new VibenTunnelProvider({}, '/mock/bin', storage)
    const startPromise = provider.start(3100)
    await vi.advanceTimersByTimeAsync(15_001)
    await startPromise

    await provider.stop()

    const deleteCalls = fetchMock.mock.calls.filter(
      ([url, init]: [any, any]) => String(url).includes('/tunnel/cf-del') && init?.method === 'DELETE'
    )
    expect(deleteCalls.length).toBe(1)
    expect(storage.set).toHaveBeenLastCalledWith('viben-tunnels', {})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/plugins/tunnel/__tests__/viben-provider.test.ts`
Expected: First test fails because `stop()` currently always deletes from worker and clears storage regardless of args.

- [ ] **Step 3: Implement `preserveState` logic in `stop()`**

In `src/plugins/tunnel/providers/viben.ts`, change the `stop()` method:

```typescript
  async stop(force = false, preserveState = false): Promise<void> {
    this.stopHeartbeat()

    const child = this.child
    const tunnelId = this.tunnelId
    const localPort = this.localPort

    this.child = null
    this.exitCallback = null

    if (child) {
      child.kill(force ? 'SIGKILL' : 'SIGTERM')

      if (!force) {
        // Escalate to SIGKILL asynchronously if process doesn't exit on its own
        const killTimer = setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL')
        }, SIGKILL_TIMEOUT_MS)
        child.once('exit', () => clearTimeout(killTimer))
      }
    }

    if (tunnelId && !preserveState) {
      this.deleteFromWorker(tunnelId).catch(err => {
        log.warn({ err: (err as Error).message }, 'Failed to delete tunnel from worker')
      })

      const all = await this.loadState()
      delete all[String(localPort)]
      await this.storage.set(STORAGE_KEY, all)
    }

    log.info({ localPort, preserveState }, 'Viben tunnel stopped')
  }
```

The only change is adding `preserveState = false` parameter and wrapping the deletion block with `if (tunnelId && !preserveState)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/plugins/tunnel/__tests__/viben-provider.test.ts`
Expected: All tests pass (both existing and new).

- [ ] **Step 5: Commit**

```bash
git add src/plugins/tunnel/providers/viben.ts src/plugins/tunnel/__tests__/viben-provider.test.ts
git commit -m "feat(tunnel): skip worker deletion when preserveState=true in Viben provider"
```

---

### Task 3: Update TunnelRegistry Shutdown and Restore

**Files:**
- Modify: `src/plugins/tunnel/tunnel-registry.ts`
- Modify: `src/plugins/tunnel/__tests__/tunnel-registry.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/plugins/tunnel/__tests__/tunnel-registry.test.ts`, as a new `describe` block at the end:

```typescript
describe('TunnelRegistry — shutdown persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockProviderInstances = []
    nextMockOverride = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shutdown passes preserveState=true to providers', async () => {
    const registry = new TunnelRegistry()
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })
    await registry.add(3200, { type: 'user', provider: 'cloudflare' })

    await registry.shutdown()

    for (const mock of mockProviderInstances) {
      expect(mock.stop).toHaveBeenCalledWith(true, true)
    }
  })

  it('shutdown persists entries to tunnels.json before clearing', async () => {
    const registry = new TunnelRegistry()
    await registry.add(3100, { type: 'system', provider: 'cloudflare' })
    await registry.add(3200, { type: 'user', provider: 'cloudflare', label: 'my-app' })

    await registry.shutdown()

    // writeFileSync should have been called with the entries (not empty array)
    const writeCalls = vi.mocked(fs.writeFileSync).mock.calls
    const lastWrite = writeCalls[writeCalls.length - 1]
    const persisted = JSON.parse(lastWrite[1] as string) as Array<{ port: number; type: string }>

    expect(persisted).toHaveLength(2)
    expect(persisted.map(e => e.port).sort()).toEqual([3100, 3200])
  })

  it('flush() is a no-op after shutdown (does not overwrite with empty)', async () => {
    const registry = new TunnelRegistry()
    await registry.add(3100, { type: 'user', provider: 'cloudflare' })

    await registry.shutdown()

    const writeCountAfterShutdown = vi.mocked(fs.writeFileSync).mock.calls.length

    // flush() after shutdown should not write again
    registry.flush()

    expect(vi.mocked(fs.writeFileSync).mock.calls.length).toBe(writeCountAfterShutdown)
  })

  it('double shutdown does not overwrite preserved tunnels.json', async () => {
    const registry = new TunnelRegistry()
    await registry.add(3100, { type: 'user', provider: 'cloudflare' })

    await registry.shutdown()

    const writeCountAfterFirst = vi.mocked(fs.writeFileSync).mock.calls.length

    // Second shutdown should be a no-op (entries already cleared, shuttingDown already true)
    await registry.shutdown()

    expect(vi.mocked(fs.writeFileSync).mock.calls.length).toBe(writeCountAfterFirst)
  })
})
```

- [ ] **Step 2: Add restore sessionId test**

Add this test inside the existing `describe('TunnelRegistry — restore', ...)` block:

```typescript
  it('restores user tunnels without sessionId (sessions do not survive restart)', async () => {
    const persisted = [
      { port: 3200, type: 'user', provider: 'cloudflare', label: 'my-app', sessionId: 'sess-old', createdAt: new Date().toISOString() },
    ]
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(persisted))

    const registry = new TunnelRegistry()
    await registry.restore()

    const restored = registry.list(false)
    expect(restored).toHaveLength(1)
    expect(restored[0].label).toBe('my-app')
    expect(restored[0].sessionId).toBeUndefined()
  })
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/plugins/tunnel/__tests__/tunnel-registry.test.ts`
Expected: New tests fail:
- `preserveState=true` — shutdown calls `stop(true)` without second arg
- Persistence — shutdown clears entries before save
- flush no-op — flush still saves after shutdown
- double shutdown — second shutdown overwrites with empty
- restore sessionId — sessionId is currently passed through

- [ ] **Step 4: Implement changes in TunnelRegistry**

In `src/plugins/tunnel/tunnel-registry.ts`, make these changes:

**Change `shutdown()` method:**

```typescript
  async shutdown(): Promise<void> {
    if (this.shuttingDown) return

    this.keepalive.stop()
    this.shuttingDown = true

    // Cancel any pending save timers
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }

    const stopPromises: Promise<void>[] = []
    for (const [, live] of this.entries) {
      if (live.retryTimer) clearTimeout(live.retryTimer)
      if (live.process) {
        stopPromises.push(live.process.stop(true, true).catch(() => { /* ignore */ }))
      }
    }
    await Promise.all(stopPromises)

    // Persist current state so tunnels can reconnect on next startup
    this.save()
    this.entries.clear()
  }
```

**Change `flush()` to skip after shutdown:**

```typescript
  flush(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    if (!this.shuttingDown) {
      this.save()
    }
  }
```

**Change `restore()` to drop sessionId:**

```typescript
  async restore(): Promise<void> {
    if (!fs.existsSync(this.registryPath)) return

    try {
      const raw = JSON.parse(fs.readFileSync(this.registryPath, 'utf-8')) as PersistedEntry[]
      log.info({ count: raw.length }, 'Restoring tunnels')

      // Only restore user tunnels — system tunnel is registered separately by TunnelService.start()
      const userEntries = raw.filter(e => e.type === 'user')
      for (const persisted of userEntries) {
        try {
          await this.add(persisted.port, {
            type: persisted.type,
            provider: persisted.provider,
            label: persisted.label,
            // sessionId intentionally omitted — sessions don't survive restart
          })
        } catch (err) {
          log.warn({ port: persisted.port, err: (err as Error).message }, 'Failed to restore tunnel')
        }
      }
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'Failed to read tunnels.json')
    }
  }
```

Note: `restore()` already omits `sessionId` in the current code — `persisted.sessionId` is passed through.
Check the current code: if `sessionId` IS being passed, remove it. If it's already omitted, no change needed.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/plugins/tunnel/__tests__/tunnel-registry.test.ts`
Expected: All tests pass (both existing and new).

- [ ] **Step 6: Commit**

```bash
git add src/plugins/tunnel/tunnel-registry.ts src/plugins/tunnel/__tests__/tunnel-registry.test.ts
git commit -m "feat(tunnel): preserve state on shutdown, drop sessionId on restore, guard double shutdown"
```

---

### Task 4: Run Full Test Suite and Verify Build

**Files:** None (verification only)

- [ ] **Step 1: Run full tunnel test suite**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/plugins/tunnel/`
Expected: All tests pass.

- [ ] **Step 2: Run full project build**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build`
Expected: No TypeScript errors.

- [ ] **Step 3: Run full test suite**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test`
Expected: All tests pass.

- [ ] **Step 4: Commit (if any fixes were needed)**

Only if test failures required fixes.

---

## Callsite Safety Analysis

All `provider.stop()` and `registry.shutdown()` callsites reviewed:

| Callsite | File:Line | After Change | Safe? |
|----------|-----------|-------------|-------|
| `registry.shutdown()` → `process.stop(true, true)` | `tunnel-registry.ts:274` | Preserves state for reconnect | Yes |
| `registry.stop(port)` → `process.stop()` | `tunnel-registry.ts:239` | Full cleanup (user-initiated) | Yes |
| Keepalive dead → `live.process?.stop()` | `tunnel-registry.ts:142` | Full cleanup (tunnel dead on worker) | Yes |
| `registry.stopBySession()` → `this.stop()` | `tunnel-registry.ts:252` | Full cleanup per tunnel | Yes |
| `registry.stopAllUser()` → `this.stop()` | `tunnel-registry.ts:262` | Full cleanup per tunnel | Yes |
| `TunnelService.stop()` → `registry.shutdown()` + `registry.flush()` | `tunnel-service.ts:91-96` | shutdown preserves, flush is no-op after | Yes |
| Plugin `teardown()` → `service.stop()` | `index.ts:271-275` | Triggers TunnelService.stop() | Yes |

## Edge Cases Handled

| Edge Case | Handling |
|-----------|----------|
| **Double shutdown** | Guard `if (this.shuttingDown) return` at top of `shutdown()` |
| **Restart within 24h** | `resolveCredentials()` pings worker → tunnel alive → reuse same URL |
| **Restart after 24h** | Worker cron expired tunnel → ping fails → creates new tunnel (graceful) |
| **API port change** | No saved state for new port → creates new tunnel. Old state orphaned (minor, harmless) |
| **Provider change** | New provider ignores old viben state. Old state orphaned (minor, harmless) |
| **Crash (SIGKILL)** | `stop()` never ran → state already preserved → reconnect works |
| **Stale sessionId** | Dropped on restore — restored tunnels have no session binding |
| **Non-viben user tunnels** | Restored from tunnels.json → new URL (no state reuse for these providers) but tunnel auto-restarts |
| **flush() after shutdown** | No-op — won't overwrite preserved tunnels.json |

## Summary of Behavior After Changes

| Scenario | Before | After |
|----------|--------|-------|
| **Graceful shutdown** (Ctrl+C) | Deletes tunnel from CF worker, clears storage, saves empty `tunnels.json` | Kills cloudflared only, keeps tunnel alive on worker, preserves storage, saves full `tunnels.json` |
| **User `/tunnel stop`** | Full cleanup (delete from worker + storage) | Same — full cleanup (unchanged) |
| **Restart within 24h** | Always creates new tunnel with new URL | Pings worker → if alive, reuses same tunnel with same URL |
| **Restart after 24h** | Creates new tunnel | Worker cron already expired the tunnel → creates new tunnel (graceful fallback) |
| **Crash (SIGKILL)** | State preserved (stop never ran) → reconnect works | Same — state preserved → reconnect works |
| **User tunnels** | Lost on restart (tunnels.json emptied) | Restored on restart, sessionId dropped, same URL if viben provider |
