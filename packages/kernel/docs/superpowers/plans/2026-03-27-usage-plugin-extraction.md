# Usage Plugin Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract usage tracking from core into the standalone plugin at `built-in-plugins/usage-plugin/`, removing all usage-related code from core.

**Architecture:** Core emits `usage:recorded` on EventBus when an agent sends a `usage_update`. The plugin listens, stores records via `ctx.storage` (in-memory cache + debounced flush), checks budget, and calls the notifications service directly for budget alerts. The `/usage` command moves from Telegram-specific code to a plugin-registered command.

**Tech Stack:** TypeScript, Vitest, `@viben/plugin-sdk` for testing helpers

**Spec:** `docs/superpowers/specs/2026-03-27-usage-plugin-extraction-design.md`

---

## File Map

### Files to Create
| File | Responsibility |
|------|---------------|
| `built-in-plugins/usage-plugin/src/usage-store.ts` | In-memory cache + debounced `ctx.storage` flush, month-partitioned keys |
| `built-in-plugins/usage-plugin/src/usage-budget.ts` | Budget checking with de-duplication, status reporting |
| `built-in-plugins/usage-plugin/src/__tests__/usage-store.test.ts` | Store unit tests |
| `built-in-plugins/usage-plugin/src/__tests__/usage-budget.test.ts` | Budget unit tests |

### Files to Modify
| File | Change |
|------|--------|
| `built-in-plugins/usage-plugin/src/index.ts` | Replace scaffold with real plugin implementation |
| `built-in-plugins/usage-plugin/src/__tests__/index.test.ts` | Replace scaffold tests with integration tests |
| `built-in-plugins/usage-plugin/package.json` | Add `nanoid` dependency |
| `src/core/event-bus.ts` | Add `usage:recorded` event to `EventBusEvents` |
| `src/core/types.ts` | Add `UsageRecordEvent` type, keep `UsageRecord` for now |
| `src/core/sessions/session-factory.ts` | Replace direct usage tracking with `eventBus.emit('usage:recorded')` |
| `src/core/core.ts` | Remove `usageStore` and `usageBudget` getters |
| `src/plugins/core-plugins.ts` | Remove `usagePlugin` import and registration |
| `src/core/index.ts` | Remove `UsageStore` and `UsageBudget` re-exports |
| `src/plugins/telegram/commands/session.ts` | Remove `handleUsage` function |
| `src/plugins/telegram/commands/index.ts` | Remove `handleUsage` import, remove `/usage` bot command, remove from `STATIC_COMMANDS` |
| `src/plugins/telegram/formatting.ts` | Remove `formatUsageReport` function |
| `src/core/plugin/types.ts` | Simplify `UsageService` interface |
| `packages/kernel-sdk/src/testing/mock-services.ts` | Update mock usage service |

### Files to Delete
| File | Reason |
|------|--------|
| `src/plugins/usage/index.ts` | Replaced by built-in plugin |
| `src/plugins/usage/usage-store.ts` | Replaced by built-in plugin |
| `src/plugins/usage/usage-budget.ts` | Replaced by built-in plugin |
| `src/__tests__/usage-store.test.ts` | Tests move to built-in plugin |
| `src/__tests__/usage-budget.test.ts` | Tests move to built-in plugin |
| `src/__tests__/usage-formatting.test.ts` | formatUsageReport removed |
| `src/plugins/usage/__tests__/` | Entire directory |

---

## Task 1: Add `usage:recorded` event to EventBus

**Files:**
- Modify: `src/core/event-bus.ts:4-52`
- Modify: `src/core/types.ts:235-252`

- [ ] **Step 1: Add `UsageRecordEvent` type to `types.ts`**

Add after the existing `UsageRecord` interface (line 243):

```typescript
export interface UsageRecordEvent {
  sessionId: string;
  agentName: string;
  timestamp: string;
  tokensUsed: number;
  contextSize: number;
  cost?: { amount: number; currency: string };
}
```

- [ ] **Step 2: Add `usage:recorded` to `EventBusEvents`**

In `src/core/event-bus.ts`, add the import for `UsageRecordEvent` and add the event to the interface. The import line becomes:

```typescript
import type { AgentEvent, PermissionRequest, SessionStatus, UsageRecordEvent } from "./types.js";
```

Add inside `EventBusEvents` (after `"agent:prompt"` block, before the closing `}`):

```typescript
  // Usage
  "usage:recorded": (data: UsageRecordEvent) => void;
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: Clean compile, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/core/event-bus.ts src/core/types.ts
git commit -m "feat(events): add usage:recorded event to EventBus"
```

---

## Task 2: Replace direct usage tracking in SessionFactory with event emission

**Files:**
- Modify: `src/core/sessions/session-factory.ts:1-30,112-144`

- [ ] **Step 1: Update imports**

Replace the current imports at the top of `session-factory.ts`. Remove the usage-specific imports, add EventBus import. The imports become:

```typescript
import { nanoid } from "nanoid";
import type { AgentManager } from "../agents/agent-manager.js";
import type { SessionManager } from "./session-manager.js";
import type { SpeechService } from "../../plugins/speech/exports.js";
import type { EventBus } from "../event-bus.js";
import type { NotificationManager } from "../../plugins/notifications/notification.js";
import type { TunnelService } from "../../plugins/tunnel/tunnel-service.js";
import type { AgentEvent } from "../types.js";
import type { MiddlewareChain } from "../plugin/middleware-chain.js";
import { Session } from "./session.js";
import { createChildLogger } from "../utils/log.js";
```

Note: Removed `import type { UsageStore }`, `import type { UsageBudget }`, and `import type { UsageRecord }`.

- [ ] **Step 2: Update `SideEffectDeps` interface**

Replace the current interface:

```typescript
export interface SideEffectDeps {
  eventBus: EventBus;
  notificationManager: NotificationManager;
  tunnelService?: TunnelService;
}
```

Note: Removed `usageStore` and `usageBudget` fields. Added `eventBus`.

- [ ] **Step 3: Replace usage tracking in `wireSideEffects`**

Replace the usage tracking block (lines 113-144) with:

```typescript
  wireSideEffects(session: Session, deps: SideEffectDeps): void {
    // Wire usage tracking via event bus (consumed by usage plugin)
    session.on("agent_event", (event: AgentEvent) => {
      if (event.type !== "usage") return;
      deps.eventBus.emit("usage:recorded", {
        sessionId: session.id,
        agentName: session.agentName,
        timestamp: new Date().toISOString(),
        tokensUsed: event.tokensUsed ?? 0,
        contextSize: event.contextSize ?? 0,
        cost: event.cost,
      });
    });

    // Clean up user tunnels when session ends
    session.on("status_change", (_from, to) => {
      if ((to === "finished" || to === "cancelled") && deps.tunnelService) {
        deps.tunnelService
```

(Keep the rest of the tunnelService block unchanged.)

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: May fail due to callers still passing `usageStore`/`usageBudget`. That's fine — we fix core.ts in the next task.

- [ ] **Step 5: Commit**

```bash
git add src/core/sessions/session-factory.ts
git commit -m "refactor(session-factory): emit usage:recorded event instead of direct store writes"
```

---

## Task 3: Remove usage getters from core.ts and update wireSideEffects call

**Files:**
- Modify: `src/core/core.ts:70-78,394-400`

- [ ] **Step 1: Remove usage getters from `VibenCore`**

Delete these two getters (lines 70-78):

```typescript
  get usageStore(): UsageStore | null {
    const usage = this.lifecycleManager.serviceRegistry.get<{ store: UsageStore; budget: UsageBudget }>('usage');
    return usage?.store ?? null;
  }

  get usageBudget(): UsageBudget | null {
    const usage = this.lifecycleManager.serviceRegistry.get<{ store: UsageStore; budget: UsageBudget }>('usage');
    return usage?.budget ?? null;
  }
```

Also remove the `UsageStore` and `UsageBudget` imports if they exist at the top of the file.

- [ ] **Step 2: Update wireSideEffects call**

Replace the `wireSideEffects` call (around line 395):

```typescript
    this.sessionFactory.wireSideEffects(session, {
      eventBus: this.eventBus,
      notificationManager: this.notificationManager,
      tunnelService: this._tunnelService,
    });
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: May still fail if Telegram commands reference `core.usageStore`. We fix that next.

- [ ] **Step 4: Commit**

```bash
git add src/core/core.ts
git commit -m "refactor(core): remove usage store/budget getters, pass eventBus to wireSideEffects"
```

---

## Task 4: Remove usage plugin from core-plugins and clean up core exports

**Files:**
- Modify: `src/plugins/core-plugins.ts:9,23`
- Modify: `src/core/index.ts:70-71`
- Delete: `src/plugins/usage/index.ts`
- Delete: `src/plugins/usage/usage-store.ts`
- Delete: `src/plugins/usage/usage-budget.ts`
- Delete: `src/plugins/usage/__tests__/` (entire directory)

- [ ] **Step 1: Remove from core-plugins.ts**

Remove the import line:
```typescript
import usagePlugin from './usage/index.js'
```

Remove `usagePlugin` from the `corePlugins` array:
```typescript
export const corePlugins = [
  // Service plugins (no adapter dependencies)
  securityPlugin,
  fileServicePlugin,
  contextPlugin,
  speechPlugin,
  notificationsPlugin,
  // Infrastructure plugins
  tunnelPlugin,
  apiServerPlugin,
  // Adapter plugins (depend on security, notifications, etc.)
  telegramPlugin,
  discordPlugin,
  slackPlugin,
]
```

- [ ] **Step 2: Remove usage exports from `src/core/index.ts`**

Delete these two lines (around lines 70-71):
```typescript
export { UsageStore } from "../plugins/usage/usage-store.js";
export { UsageBudget } from "../plugins/usage/usage-budget.js";
```

- [ ] **Step 3: Delete old usage plugin files**

```bash
rm -rf src/plugins/usage/
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: May fail if telegram commands still reference `handleUsage` / `core.usageStore`. Fixed in next task.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove usage plugin from core, delete src/plugins/usage/"
```

---

## Task 5: Remove Telegram usage command and formatting

**Files:**
- Modify: `src/plugins/telegram/commands/session.ts:358-385`
- Modify: `src/plugins/telegram/commands/index.ts:7,43,192`
- Modify: `src/plugins/telegram/formatting.ts:208-245`
- Delete: `src/__tests__/usage-store.test.ts`
- Delete: `src/__tests__/usage-budget.test.ts`
- Delete: `src/__tests__/usage-formatting.test.ts`

- [ ] **Step 1: Remove `handleUsage` from session.ts**

Delete the entire `handleUsage` function (lines 358-385):

```typescript
export async function handleUsage(ctx: Context, core: VibenCore): Promise<void> {
  // ... entire function
}
```

Also remove the `formatUsageReport` import from the top of the file if it's imported there.

- [ ] **Step 2: Update commands/index.ts**

Remove `handleUsage` from the import on line 7:
```typescript
import { handleCancel, handleStatus, handleTopics, handleArchive, handleArchiveConfirm, handleSummary, handleSummaryCallback, setupSessionCallbacks } from './session.js'
```

Remove the bot command registration (line 43):
```typescript
  bot.command("usage", (ctx) => handleUsage(ctx, core));
```

Remove from `STATIC_COMMANDS` array (line 192):
```typescript
  { command: "usage", description: "View token usage and cost report" },
```

- [ ] **Step 3: Remove `formatUsageReport` from formatting.ts**

Delete the `formatUsageReport` function (lines 208-245) and the `PERIOD_LABEL` constant above it (lines 200-206). Also remove the `UsageSummary` import from the top of the file if it exists.

- [ ] **Step 4: Delete old test files**

```bash
rm src/__tests__/usage-store.test.ts
rm src/__tests__/usage-budget.test.ts
rm src/__tests__/usage-formatting.test.ts
```

- [ ] **Step 5: Verify build and tests**

Run: `pnpm build && pnpm test`
Expected: Build succeeds. Tests pass (some tests deleted, remaining tests unaffected).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(telegram): remove usage command and formatting, delete old usage tests"
```

---

## Task 6: Simplify UsageService interface and update mock

**Files:**
- Modify: `src/core/plugin/types.ts:477-481`
- Modify: `src/core/types.ts:245-252`
- Modify: `packages/kernel-sdk/src/testing/mock-services.ts:46-55`

- [ ] **Step 1: Simplify `UsageService` interface**

In `src/core/plugin/types.ts`, replace the current `UsageService` (lines 477-481):

```typescript
export interface UsageService {
  trackUsage(record: UsageRecord): Promise<void>
  checkBudget(sessionId: string): Promise<{ ok: boolean; percent: number; warning?: string }>
}
```

Remove `getSummary` method. Remove the `UsageSummary` import if it's imported in this file.

- [ ] **Step 2: Remove `UsageSummary` from types.ts**

Delete the `UsageSummary` interface (lines 245-252):

```typescript
export interface UsageSummary {
  period: "today" | "week" | "month" | "all";
  totalTokens: number;
  totalCost: number;
  currency: string;
  sessionCount: number;
  recordCount: number;
}
```

- [ ] **Step 3: Update mock services**

In `packages/kernel-sdk/src/testing/mock-services.ts`, replace the usage mock (lines 46-55):

```typescript
  usage(overrides?: Partial<UsageService>): UsageService {
    return {
      async trackUsage() {},
      async checkBudget() { return { ok: true, percent: 0 } },
      ...overrides,
    }
  },
```

Remove the `UsageSummary` import if it exists.

- [ ] **Step 4: Verify build and tests**

Run: `pnpm build && pnpm test`
Expected: Clean build, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/plugin/types.ts src/core/types.ts packages/kernel-sdk/src/testing/mock-services.ts
git commit -m "refactor(types): simplify UsageService interface, remove UsageSummary"
```

---

## Task 7: Implement UsageStore in built-in plugin

**Files:**
- Create: `built-in-plugins/usage-plugin/src/usage-store.ts`
- Create: `built-in-plugins/usage-plugin/src/__tests__/usage-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `built-in-plugins/usage-plugin/src/__tests__/usage-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { UsageStore } from '../usage-store.js'
import type { PluginStorage } from '@viben/plugin-sdk'

interface UsageRecord {
  id: string
  sessionId: string
  agentName: string
  tokensUsed: number
  contextSize: number
  cost?: { amount: number; currency: string }
  timestamp: string
}

function makeRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    id: 'rec-1',
    sessionId: 'sess-1',
    agentName: 'claude',
    tokensUsed: 1000,
    contextSize: 50000,
    cost: { amount: 0.05, currency: 'USD' },
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

function createMockStorage(): PluginStorage & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    data,
    async get<T>(key: string): Promise<T | undefined> {
      return data.get(key) as T | undefined
    },
    async set<T>(key: string, value: T): Promise<void> {
      data.set(key, value)
    },
    async delete(key: string): Promise<void> {
      data.delete(key)
    },
    async list(): Promise<string[]> {
      return Array.from(data.keys())
    },
    getDataDir(): string {
      return '/tmp/test-data'
    },
  }
}

describe('UsageStore', () => {
  let storage: ReturnType<typeof createMockStorage>
  let store: UsageStore

  beforeEach(() => {
    vi.useFakeTimers()
    storage = createMockStorage()
    store = new UsageStore(storage)
  })

  afterEach(() => {
    store.destroy()
    vi.useRealTimers()
  })

  it('appends record to in-memory cache', async () => {
    const record = makeRecord()
    await store.append(record)

    const total = store.getMonthlyTotal()
    expect(total.totalCost).toBe(0.05)
    expect(total.currency).toBe('USD')
  })

  it('does not flush to storage immediately', async () => {
    await store.append(makeRecord())
    expect(storage.data.size).toBe(0)
  })

  it('flushes to storage after debounce period', async () => {
    await store.append(makeRecord())
    vi.advanceTimersByTime(2000)
    await vi.runAllTimersAsync()

    expect(storage.data.size).toBe(1)
  })

  it('flush() writes all dirty keys immediately', async () => {
    await store.append(makeRecord())
    await store.flush()

    expect(storage.data.size).toBe(1)
    const key = Array.from(storage.data.keys())[0]
    expect(key).toMatch(/^records:\d{4}-\d{2}$/)
    const records = storage.data.get(key) as UsageRecord[]
    expect(records).toHaveLength(1)
  })

  it('accumulates multiple records in same month', async () => {
    await store.append(makeRecord({ id: 'r1', cost: { amount: 0.05, currency: 'USD' } }))
    await store.append(makeRecord({ id: 'r2', cost: { amount: 0.10, currency: 'USD' } }))

    const total = store.getMonthlyTotal()
    expect(total.totalCost).toBe(0.15)
  })

  it('loads existing records from storage on loadFromStorage()', async () => {
    const now = new Date()
    const key = `records:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    storage.data.set(key, [makeRecord({ cost: { amount: 1.00, currency: 'USD' } })])

    await store.loadFromStorage()
    const total = store.getMonthlyTotal()
    expect(total.totalCost).toBe(1.00)
  })

  it('getMonthlyTotal returns 0 when no records', () => {
    const total = store.getMonthlyTotal()
    expect(total.totalCost).toBe(0)
    expect(total.currency).toBe('USD')
  })

  it('getMonthlyTotal handles records without cost', async () => {
    await store.append(makeRecord({ cost: undefined }))
    const total = store.getMonthlyTotal()
    expect(total.totalCost).toBe(0)
  })

  it('cleanupExpired removes old month keys', async () => {
    // Add a record from 6 months ago
    const oldDate = new Date()
    oldDate.setMonth(oldDate.getMonth() - 6)
    const oldKey = `records:${oldDate.getFullYear()}-${String(oldDate.getMonth() + 1).padStart(2, '0')}`
    storage.data.set(oldKey, [makeRecord()])

    // Add a current record
    await store.append(makeRecord())
    await store.flush()

    await store.cleanupExpired(90)

    // Old key should be deleted, current key should remain
    expect(storage.data.has(oldKey)).toBe(false)
    expect(storage.data.size).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd built-in-plugins/usage-plugin && npx vitest run --reporter=verbose`
Expected: FAIL — `usage-store.ts` does not export `UsageStore`.

- [ ] **Step 3: Write the implementation**

Create `built-in-plugins/usage-plugin/src/usage-store.ts`:

```typescript
import type { PluginStorage } from '@viben/plugin-sdk'

export interface UsageRecord {
  id: string
  sessionId: string
  agentName: string
  tokensUsed: number
  contextSize: number
  cost?: { amount: number; currency: string }
  timestamp: string
}

const DEBOUNCE_MS = 2000

export class UsageStore {
  private cache = new Map<string, UsageRecord[]>()
  private dirty = new Set<string>()
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private storage: PluginStorage) {}

  async loadFromStorage(): Promise<void> {
    const key = this.monthKey(new Date().toISOString())
    const records = (await this.storage.get<UsageRecord[]>(key)) ?? []
    this.cache.set(key, records)
  }

  async append(record: UsageRecord): Promise<void> {
    const key = this.monthKey(record.timestamp)
    if (!this.cache.has(key)) {
      const existing = (await this.storage.get<UsageRecord[]>(key)) ?? []
      this.cache.set(key, existing)
    }
    this.cache.get(key)!.push(record)
    this.dirty.add(key)
    this.scheduleFlush()
  }

  getMonthlyTotal(date?: Date): { totalCost: number; currency: string } {
    const key = this.monthKey((date ?? new Date()).toISOString())
    const records = this.cache.get(key) ?? []
    const totalCost = records.reduce((sum, r) => sum + (r.cost?.amount ?? 0), 0)
    const currency = records.find(r => r.cost?.currency)?.cost?.currency ?? 'USD'
    return { totalCost, currency }
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    for (const key of this.dirty) {
      const records = this.cache.get(key)
      if (records) await this.storage.set(key, records)
    }
    this.dirty.clear()
  }

  async cleanupExpired(retentionDays: number): Promise<void> {
    const keys = await this.storage.list()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - retentionDays)
    const cutoffKey = this.monthKey(cutoff.toISOString())

    for (const key of keys) {
      if (key.startsWith('records:') && key < cutoffKey) {
        await this.storage.delete(key)
        this.cache.delete(key)
      }
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      this.flush()
    }, DEBOUNCE_MS)
  }

  private monthKey(timestamp: string): string {
    const d = new Date(timestamp)
    return `records:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd built-in-plugins/usage-plugin && npx vitest run --reporter=verbose`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add built-in-plugins/usage-plugin/src/usage-store.ts built-in-plugins/usage-plugin/src/__tests__/usage-store.test.ts
git commit -m "feat(usage-plugin): implement UsageStore with in-memory cache and debounced flush"
```

---

## Task 8: Implement UsageBudget in built-in plugin

**Files:**
- Create: `built-in-plugins/usage-plugin/src/usage-budget.ts`
- Create: `built-in-plugins/usage-plugin/src/__tests__/usage-budget.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `built-in-plugins/usage-plugin/src/__tests__/usage-budget.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UsageBudget } from '../usage-budget.js'
import type { UsageStore } from '../usage-store.js'

function mockStore(totalCost: number): UsageStore {
  return {
    getMonthlyTotal: () => ({ totalCost, currency: 'USD' }),
  } as unknown as UsageStore
}

describe('UsageBudget', () => {
  describe('check()', () => {
    it('returns ok when no budget configured', () => {
      const budget = new UsageBudget(mockStore(100), {})
      const result = budget.check()
      expect(result.status).toBe('ok')
      expect(result.message).toBeUndefined()
    })

    it('returns ok when under threshold', () => {
      const budget = new UsageBudget(mockStore(5), { monthlyBudget: 100, warningThreshold: 0.8 })
      const result = budget.check()
      expect(result.status).toBe('ok')
    })

    it('returns warning when at threshold', () => {
      const budget = new UsageBudget(mockStore(80), { monthlyBudget: 100, warningThreshold: 0.8 })
      const result = budget.check()
      expect(result.status).toBe('warning')
      expect(result.message).toContain('Budget Warning')
      expect(result.message).toContain('$80.00')
    })

    it('returns exceeded when at budget', () => {
      const budget = new UsageBudget(mockStore(100), { monthlyBudget: 100, warningThreshold: 0.8 })
      const result = budget.check()
      expect(result.status).toBe('exceeded')
      expect(result.message).toContain('Budget Exceeded')
    })

    it('de-duplicates: second call with same status returns no message', () => {
      const budget = new UsageBudget(mockStore(80), { monthlyBudget: 100, warningThreshold: 0.8 })
      budget.check() // first call
      const result = budget.check() // second call
      expect(result.status).toBe('warning')
      expect(result.message).toBeUndefined()
    })

    it('escalates: warning then exceeded emits both messages', () => {
      const store80 = mockStore(80)
      const budget = new UsageBudget(store80, { monthlyBudget: 100, warningThreshold: 0.8 })

      const r1 = budget.check()
      expect(r1.message).toBeDefined()

      // Now cost goes above budget — replace the mock
      ;(budget as any).store = mockStore(110)
      const r2 = budget.check()
      expect(r2.status).toBe('exceeded')
      expect(r2.message).toBeDefined()
    })

    it('resets de-duplication on month boundary', () => {
      const now = new Date(2026, 2, 15) // March
      const budget = new UsageBudget(
        mockStore(80),
        { monthlyBudget: 100, warningThreshold: 0.8 },
        () => now,
      )

      budget.check() // emits warning

      // Advance to April
      now.setMonth(3)
      const result = budget.check()
      expect(result.message).toBeDefined() // re-emits because month changed
    })
  })

  describe('getStatus()', () => {
    it('returns correct status fields', () => {
      const budget = new UsageBudget(mockStore(50), { monthlyBudget: 100, warningThreshold: 0.8 })
      const status = budget.getStatus()
      expect(status).toEqual({
        status: 'ok',
        used: 50,
        budget: 100,
        percent: 50,
      })
    })

    it('returns 0 percent when no budget', () => {
      const budget = new UsageBudget(mockStore(50), {})
      const status = budget.getStatus()
      expect(status.percent).toBe(0)
      expect(status.budget).toBe(0)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd built-in-plugins/usage-plugin && npx vitest run --reporter=verbose`
Expected: FAIL — `usage-budget.ts` does not export `UsageBudget`.

- [ ] **Step 3: Write the implementation**

Create `built-in-plugins/usage-plugin/src/usage-budget.ts`:

```typescript
import type { UsageStore } from './usage-store.js'

export interface UsageBudgetConfig {
  monthlyBudget?: number
  warningThreshold?: number
  retentionDays?: number
}

export class UsageBudget {
  private lastNotifiedStatus: 'ok' | 'warning' | 'exceeded' = 'ok'
  private lastNotifiedMonth: number

  constructor(
    private store: UsageStore,
    private config: UsageBudgetConfig,
    private now: () => Date = () => new Date(),
  ) {
    this.lastNotifiedMonth = this.now().getMonth()
  }

  check(): { status: 'ok' | 'warning' | 'exceeded'; message?: string } {
    if (!this.config.monthlyBudget) {
      return { status: 'ok' }
    }

    const currentMonth = this.now().getMonth()
    if (currentMonth !== this.lastNotifiedMonth) {
      this.lastNotifiedStatus = 'ok'
      this.lastNotifiedMonth = currentMonth
    }

    const { totalCost } = this.store.getMonthlyTotal()
    const budget = this.config.monthlyBudget
    const threshold = this.config.warningThreshold ?? 0.8

    let status: 'ok' | 'warning' | 'exceeded'
    if (totalCost >= budget) {
      status = 'exceeded'
    } else if (totalCost >= threshold * budget) {
      status = 'warning'
    } else {
      status = 'ok'
    }

    let message: string | undefined
    if (status !== 'ok' && status !== this.lastNotifiedStatus) {
      const pct = Math.round((totalCost / budget) * 100)
      const filled = Math.round(Math.min(totalCost / budget, 1) * 10)
      const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled)

      if (status === 'warning') {
        message =
          `⚠️ <b>Budget Warning</b>\n` +
          `Monthly usage: $${totalCost.toFixed(2)} / $${budget.toFixed(2)} (${pct}%)\n` +
          `${bar} ${pct}%`
      } else {
        message =
          `🚨 <b>Budget Exceeded</b>\n` +
          `Monthly usage: $${totalCost.toFixed(2)} / $${budget.toFixed(2)} (${pct}%)\n` +
          `${bar} ${pct}%\n` +
          `Sessions are NOT blocked — this is a warning only.`
      }
    }

    this.lastNotifiedStatus = status
    return { status, message }
  }

  getStatus(): {
    status: 'ok' | 'warning' | 'exceeded'
    used: number
    budget: number
    percent: number
  } {
    const { totalCost } = this.store.getMonthlyTotal()
    const budget = this.config.monthlyBudget ?? 0

    let status: 'ok' | 'warning' | 'exceeded' = 'ok'
    if (budget > 0) {
      if (totalCost >= budget) {
        status = 'exceeded'
      } else if (totalCost >= (this.config.warningThreshold ?? 0.8) * budget) {
        status = 'warning'
      }
    }

    const percent = budget > 0 ? Math.round((totalCost / budget) * 100) : 0
    return { status, used: totalCost, budget, percent }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd built-in-plugins/usage-plugin && npx vitest run --reporter=verbose`
Expected: All budget tests PASS.

- [ ] **Step 5: Commit**

```bash
git add built-in-plugins/usage-plugin/src/usage-budget.ts built-in-plugins/usage-plugin/src/__tests__/usage-budget.test.ts
git commit -m "feat(usage-plugin): implement UsageBudget with de-duplication and month boundary reset"
```

---

## Task 9: Implement plugin entry point

**Files:**
- Modify: `built-in-plugins/usage-plugin/src/index.ts`
- Modify: `built-in-plugins/usage-plugin/src/__tests__/index.test.ts`
- Modify: `built-in-plugins/usage-plugin/package.json`

- [ ] **Step 1: Add nanoid dependency**

In `built-in-plugins/usage-plugin/package.json`, add `nanoid` to dependencies:

```json
{
  "name": "@viben/usage-plugin",
  "version": "0.1.0",
  "description": "Automatically tracks token usage and cost per agent session, supports configurable monthly budgets with warning notifications, and auto-cleans old records based on a retention policy.",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "prepublishOnly": "npm run build"
  },
  "author": "Mr.Peter <0xmrpeter@gmail.com>",
  "license": "MIT",
  "keywords": [
    "viben",
    "viben-plugin"
  ],
  "dependencies": {
    "nanoid": "^5.0.0"
  },
  "peerDependencies": {
    "@viben/kernel": ">=2026.0326.4"
  },
  "devDependencies": {
    "@viben/plugin-sdk": "2026.0326.4",
    "typescript": "^5.4.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Write the integration tests**

Replace `built-in-plugins/usage-plugin/src/__tests__/index.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestContext } from '@viben/plugin-sdk/testing'
import plugin from '../index.js'

describe('@viben/usage-plugin', () => {
  it('has correct metadata', () => {
    expect(plugin.name).toBe('@viben/usage-plugin')
    expect(plugin.version).toBeDefined()
    expect(plugin.permissions).toContain('events:read')
    expect(plugin.permissions).toContain('services:use')
    expect(plugin.permissions).toContain('services:register')
    expect(plugin.permissions).toContain('commands:register')
    expect(plugin.permissions).toContain('storage:read')
    expect(plugin.permissions).toContain('storage:write')
  })

  describe('setup', () => {
    it('registers usage service', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/usage-plugin',
        pluginConfig: {},
        permissions: plugin.permissions,
      })
      await plugin.setup(ctx)

      expect(ctx.registeredServices.has('usage')).toBe(true)
    })

    it('registers /usage command', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/usage-plugin',
        pluginConfig: {},
        permissions: plugin.permissions,
      })
      await plugin.setup(ctx)

      expect(ctx.registeredCommands.has('usage')).toBe(true)
    })

    it('tracks usage on usage:recorded event', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/usage-plugin',
        pluginConfig: { monthlyBudget: 100, warningThreshold: 0.8 },
        permissions: plugin.permissions,
      })
      await plugin.setup(ctx)

      // Emit a usage event
      ctx.emit('usage:recorded', {
        sessionId: 'sess-1',
        agentName: 'claude',
        timestamp: new Date().toISOString(),
        tokensUsed: 1000,
        contextSize: 50000,
        cost: { amount: 0.05, currency: 'USD' },
      })

      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify via /usage command
      const response = await ctx.executeCommand('usage')
      expect(response).toBeDefined()
      expect((response as any).text).toContain('$0.05')
    })

    it('calls notification service when budget warning triggered', async () => {
      const notifyAllCalls: unknown[] = []
      const ctx = createTestContext({
        pluginName: '@viben/usage-plugin',
        pluginConfig: { monthlyBudget: 0.10, warningThreshold: 0.8 },
        permissions: plugin.permissions,
        services: {
          notifications: {
            notifyAll: async (msg: unknown) => { notifyAllCalls.push(msg) },
            notify: async () => {},
          },
        },
      })
      await plugin.setup(ctx)

      // Emit usage that triggers warning (80% of $0.10 = $0.08)
      ctx.emit('usage:recorded', {
        sessionId: 'sess-1',
        agentName: 'claude',
        timestamp: new Date().toISOString(),
        tokensUsed: 5000,
        contextSize: 50000,
        cost: { amount: 0.09, currency: 'USD' },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(notifyAllCalls).toHaveLength(1)
      expect((notifyAllCalls[0] as any).type).toBe('budget_warning')
      expect((notifyAllCalls[0] as any).summary).toContain('Budget Warning')
    })
  })

  describe('/usage command', () => {
    it('shows no budget when not configured', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/usage-plugin',
        pluginConfig: {},
        permissions: plugin.permissions,
      })
      await plugin.setup(ctx)

      const response = await ctx.executeCommand('usage')
      expect(response).toBeDefined()
      expect((response as any).text).toContain('$0.00')
      expect((response as any).text).toContain('not set')
    })
  })
})
```

- [ ] **Step 3: Write the plugin entry point**

Replace `built-in-plugins/usage-plugin/src/index.ts`:

```typescript
import type { VibenPlugin, PluginContext, InstallContext, MigrateContext } from '@viben/plugin-sdk'
import { nanoid } from 'nanoid'
import { UsageStore } from './usage-store.js'
import { UsageBudget } from './usage-budget.js'
import type { UsageRecord } from './usage-store.js'

interface UsageRecordEvent {
  sessionId: string
  agentName: string
  timestamp: string
  tokensUsed: number
  contextSize: number
  cost?: { amount: number; currency: string }
}

interface NotificationService {
  notifyAll(notification: {
    sessionId: string
    sessionName?: string
    type: string
    summary: string
  }): Promise<void>
}

let _store: UsageStore | null = null

const plugin: VibenPlugin = {
  name: '@viben/usage-plugin',
  version: '0.1.0',
  description: 'Automatically tracks token usage and cost per agent session, supports configurable monthly budgets with warning notifications, and auto-cleans old records based on a retention policy.',
  permissions: ['events:read', 'services:use', 'services:register', 'commands:register', 'storage:read', 'storage:write'],

  async setup(ctx: PluginContext): Promise<void> {
    const config = ctx.pluginConfig as Record<string, unknown>
    _store = new UsageStore(ctx.storage)
    const store = _store
    const budget = new UsageBudget(store, {
      monthlyBudget: config.monthlyBudget as number | undefined,
      warningThreshold: config.warningThreshold as number | undefined,
      retentionDays: config.retentionDays as number | undefined,
    })

    // Load existing records into memory
    await store.loadFromStorage()

    // Clean old records
    const retentionDays = (config.retentionDays as number) ?? 90
    await store.cleanupExpired(retentionDays)

    // Listen to usage events from core
    ctx.on('usage:recorded', async (event: UsageRecordEvent) => {
      const record: UsageRecord = {
        id: nanoid(),
        ...event,
      }
      await store.append(record)

      const result = budget.check()
      if (result.message) {
        const notifications = ctx.getService<NotificationService>('notifications')
        if (notifications) {
          await notifications.notifyAll({
            sessionId: event.sessionId,
            type: 'budget_warning',
            summary: result.message,
          })
        }
      }
    })

    // Register /usage command
    ctx.registerCommand({
      name: 'usage',
      description: 'Show usage summary for current month',
      category: 'plugin',
      handler: async () => {
        const status = budget.getStatus()
        const lines = [
          'Usage (this month):',
          `  Spent: $${status.used.toFixed(2)}`,
          `  Budget: ${status.budget > 0 ? `$${status.budget.toFixed(2)}` : 'not set'}`,
          `  Status: ${status.status} (${status.percent}%)`,
        ]
        return { type: 'text', text: lines.join('\n') }
      },
    })

    // Expose service for other plugins
    ctx.registerService('usage', { store, budget })

    ctx.log.info('Usage tracking ready')
  },

  async teardown(): Promise<void> {
    if (_store) {
      await _store.flush()
      _store.destroy()
      _store = null
    }
  },

  async install(ctx: InstallContext): Promise<void> {
    const { settings, legacyConfig, terminal } = ctx

    // Migrate from legacy config if present
    if (legacyConfig) {
      const usageCfg = legacyConfig.usage as Record<string, unknown> | undefined
      if (usageCfg) {
        await settings.setAll({
          enabled: usageCfg.enabled ?? true,
          monthlyBudget: usageCfg.monthlyBudget ?? 0,
          warningThreshold: usageCfg.warningThreshold ?? 0.8,
          retentionDays: usageCfg.retentionDays ?? 90,
        })
        terminal.log.success('Usage settings migrated from legacy config')
        return
      }
    }

    await settings.setAll({
      enabled: true,
      monthlyBudget: 0,
      warningThreshold: 0.8,
      retentionDays: 90,
    })
    terminal.log.success('Usage defaults saved')
  },

  async configure(ctx: InstallContext): Promise<void> {
    const { terminal, settings } = ctx
    const current = await settings.getAll()

    const choice = await terminal.select({
      message: 'What to configure?',
      options: [
        { value: 'budget', label: `Monthly budget (current: $${current.monthlyBudget ?? 0})` },
        { value: 'threshold', label: `Warning threshold (current: ${current.warningThreshold ?? 0.8})` },
        { value: 'retention', label: `Retention days (current: ${current.retentionDays ?? 90})` },
        { value: 'done', label: 'Done' },
      ],
    })

    if (choice === 'budget') {
      const val = await terminal.text({
        message: 'Monthly budget in USD (0 = no limit):',
        defaultValue: String(current.monthlyBudget ?? 0),
        validate: (v) => {
          const n = Number(v.trim())
          if (isNaN(n) || n < 0) return 'Must be a non-negative number'
          return undefined
        },
      })
      await settings.set('monthlyBudget', Number(val.trim()))
      terminal.log.success('Monthly budget updated')
    } else if (choice === 'threshold') {
      const val = await terminal.text({
        message: 'Warning threshold (0-1):',
        defaultValue: String(current.warningThreshold ?? 0.8),
        validate: (v) => {
          const n = Number(v.trim())
          if (isNaN(n) || n < 0 || n > 1) return 'Must be between 0 and 1'
          return undefined
        },
      })
      await settings.set('warningThreshold', Number(val.trim()))
      terminal.log.success('Warning threshold updated')
    } else if (choice === 'retention') {
      const val = await terminal.text({
        message: 'Retention days:',
        defaultValue: String(current.retentionDays ?? 90),
        validate: (v) => {
          const n = Number(v.trim())
          if (isNaN(n) || n < 1) return 'Must be a positive number'
          return undefined
        },
      })
      await settings.set('retentionDays', Number(val.trim()))
      terminal.log.success('Retention days updated')
    }
  },

  async migrate(_ctx: MigrateContext, oldSettings: unknown, _oldVersion: string): Promise<unknown> {
    return oldSettings
  },

  async uninstall(ctx: InstallContext, opts: { purge: boolean }): Promise<void> {
    if (opts.purge) {
      await ctx.settings.clear()
    }
    ctx.terminal.log.success('Usage plugin removed')
  },
}

export default plugin
```

- [ ] **Step 4: Install dependencies**

```bash
cd built-in-plugins/usage-plugin && npm install
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd built-in-plugins/usage-plugin && npx vitest run --reporter=verbose`
Expected: All integration tests and unit tests PASS.

- [ ] **Step 6: Commit**

```bash
git add built-in-plugins/usage-plugin/
git commit -m "feat(usage-plugin): implement plugin entry point with event handling, commands, and notifications"
```

---

## Task 10: Full build and test verification

**Files:** None (verification only)

- [ ] **Step 1: Build the entire project**

Run: `pnpm build`
Expected: Clean compile, no errors.

- [ ] **Step 2: Run all core tests**

Run: `pnpm test`
Expected: All tests pass. No references to deleted usage files.

- [ ] **Step 3: Run plugin tests**

Run: `cd built-in-plugins/usage-plugin && npx vitest run --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 4: Verify no dangling imports**

Search for any remaining references to the deleted files:

```bash
grep -r "plugins/usage/" src/ --include="*.ts" | grep -v "node_modules"
```

Expected: No matches (all references removed).

- [ ] **Step 5: Commit if any fixups were needed**

If any fixes were required, commit them:
```bash
git add -A
git commit -m "fix: resolve remaining references after usage plugin extraction"
```
