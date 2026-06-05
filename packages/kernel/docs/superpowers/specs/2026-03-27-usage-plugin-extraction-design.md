# Usage Plugin Extraction Design

**Date:** 2026-03-27
**Status:** Draft
**Goal:** Extract usage tracking from core into a fully standalone plugin (`built-in-plugins/usage-plugin`), removing all usage-related code from core.

## Decisions

| Question | Decision |
|----------|----------|
| Plugin ownership | Plugin owns everything — core has zero usage knowledge |
| Storage | Plugin manages own storage via `ctx.storage` API, no legacy `usage.json` |
| Event source | Core emits `usage:recorded` on event bus (added to `EventBusEvents`); plugin listens |
| Notifications | Plugin calls `ctx.getService('notifications').notifyAll()` directly |
| Plugin name | `@viben/usage-plugin` |

## Architecture

```
Core (SessionFactory)            Event Bus               Usage Plugin
─────────────────────           ─────────               ────────────
agent_event (type=usage) ──→  emit('usage:recorded')  ──→ on('usage:recorded')
                                                           │
                                                           ├─ buffer in memory
                                                           ├─ debounced flush to ctx.storage
                                                           ├─ async budget check
                                                           │
                                                           └─ getService('notifications').notifyAll(...)
```

## Plugin Permissions

```typescript
permissions: ['events:read', 'services:register', 'services:use', 'commands:register', 'storage:read', 'storage:write']
```

No `kernel:access` required. No `events:emit` needed (uses service call for notifications).

## Core Changes

### 1. Add `usage:recorded` to `EventBusEvents`

In `src/core/event-bus.ts`, add to the `EventBusEvents` interface:

```typescript
'usage:recorded': (record: UsageRecordEvent) => void;
```

Where `UsageRecordEvent`:
```typescript
interface UsageRecordEvent {
  sessionId: string
  agentName: string
  timestamp: string           // ISO 8601
  tokensUsed: number          // from ACP usage_update.used
  contextSize: number         // from ACP usage_update.size
  cost?: { amount: number; currency: string }  // from ACP usage_update.cost
}
```

### 2. SessionFactory — Emit `usage:recorded` event

In `SessionFactory.wireSideEffects()`, replace the direct `usageStore.append()` + `usageBudget.check()` block with:

```typescript
session.on("agent_event", (event: AgentEvent) => {
  if (event.type !== "usage") return;
  this.eventBus.emit("usage:recorded", {
    sessionId: session.id,
    agentName: session.agentName,
    timestamp: new Date().toISOString(),
    tokensUsed: event.tokensUsed ?? 0,
    contextSize: event.contextSize ?? 0,
    cost: event.cost,
  });
});
```

### 3. Remove from VibenCore

- Delete `usageStore` lazy getter
- Delete `usageBudget` lazy getter
- Remove usage-related imports
- Remove usage from `wireSideEffects` dependency parameter type

### 4. Remove `src/plugins/usage/`

Delete entirely:
- `src/plugins/usage/index.ts`
- `src/plugins/usage/usage-store.ts`
- `src/plugins/usage/usage-budget.ts`
- `src/plugins/usage/__tests__/`

### 5. Remove from `core-plugins.ts`

Remove `usagePlugin` from the core plugins array.

### 6. Remove usage query from Telegram commands

In `src/plugins/telegram/commands/session.ts`:
- Remove `handleUsage()` function (the plugin's `/usage` command replaces it)
- Remove `formatUsageReport()` from `formatting.ts` if no longer used
- Remove related tests (`usage-store.test.ts`, `usage-formatting.test.ts`)

### 7. Clean up types

- Remove `UsageSummary` interface from `types.ts` (no longer needed)
- Remove `UsageService.getSummary()` from plugin types (simplify to just `trackUsage` + `checkBudget`)
- Keep `UsageRecord` type in core for the event contract
- Remove `UsageStore` and `UsageBudget` from public exports in `src/core/index.ts`
- Update mock service in `packages/plugin-sdk/src/testing/mock-services.ts`

## Plugin Structure

```
built-in-plugins/usage-plugin/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts            — Plugin entry
│   ├── usage-store.ts      — In-memory cache + debounced ctx.storage flush
│   ├── usage-budget.ts     — Async budget checking + status
│   └── __tests__/
│       ├── index.test.ts
│       ├── usage-store.test.ts
│       └── usage-budget.test.ts
```

## Plugin Implementation

### `index.ts` — Plugin Entry

```typescript
const plugin: VibenPlugin = {
  name: '@viben/usage-plugin',
  version: '1.0.0',
  description: 'Token usage tracking and budget enforcement',
  permissions: ['events:read', 'services:use', 'services:register', 'commands:register', 'storage:read', 'storage:write'],

  async setup(ctx: PluginContext) {
    const store = new UsageStore(ctx.storage)
    const config = ctx.pluginConfig as UsagePluginConfig
    const budget = new UsageBudget(store, config)

    // Load existing records into memory cache
    await store.loadFromStorage()

    // Clean old records on startup
    await store.cleanupExpired(config.retentionDays ?? 90)

    // Listen to usage events from core
    ctx.on('usage:recorded', async (record: UsageRecordEvent) => {
      const usageRecord: UsageRecord = {
        id: nanoid(),
        ...record,
      }
      await store.append(usageRecord)

      const result = await budget.check()
      if (result.message) {
        const notifications = ctx.getService<NotificationManager>('notifications')
        if (notifications) {
          await notifications.notifyAll({
            sessionId: record.sessionId,
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
        const status = await budget.getStatus()
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

  async teardown(ctx: PluginContext) {
    // Flush any pending writes
    const usage = ctx.getService<{ store: UsageStore }>('usage')
    if (usage) await usage.store.flush()
  },

  async install(ctx: InstallContext) {
    const budget = await ctx.terminal.text({
      message: 'Monthly budget in USD (0 = no limit):',
      defaultValue: '0',
      validate: (v) => {
        const n = Number(v.trim())
        if (isNaN(n) || n < 0) return 'Must be a non-negative number'
        return undefined
      },
    })

    const threshold = await ctx.terminal.text({
      message: 'Warning threshold (0-1, e.g. 0.8 = warn at 80%):',
      defaultValue: '0.8',
      validate: (v) => {
        const n = Number(v.trim())
        if (isNaN(n) || n < 0 || n > 1) return 'Must be between 0 and 1'
        return undefined
      },
    })

    const retention = await ctx.terminal.text({
      message: 'Retention days:',
      defaultValue: '90',
      validate: (v) => {
        const n = Number(v.trim())
        if (isNaN(n) || n < 1) return 'Must be a positive number'
        return undefined
      },
    })

    await ctx.settings.setAll({
      monthlyBudget: Number(budget.trim()),
      warningThreshold: Number(threshold.trim()),
      retentionDays: Number(retention.trim()),
    })

    ctx.terminal.log.success('Usage plugin configured')
  },

  async configure(ctx: InstallContext) {
    const current = await ctx.settings.getAll()
    // Same as install but with current values as defaults
    // ... (similar flow with pre-filled defaults)
  },

  async uninstall(ctx: InstallContext, opts: { purge: boolean }) {
    if (opts.purge) {
      await ctx.settings.clear()
    }
    ctx.terminal.log.success('Usage plugin removed')
  },
}
```

### `usage-store.ts` — Storage Layer (with in-memory cache + debounce)

Uses `ctx.storage` with month-partitioned keys. Maintains an in-memory cache for fast reads and debounces writes to avoid excessive I/O.

```typescript
const DEBOUNCE_MS = 2000

export class UsageStore {
  private cache = new Map<string, UsageRecord[]>()
  private dirty = new Set<string>()
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private storage: PluginStorage) {}

  /** Load current month's records into memory on startup */
  async loadFromStorage(): Promise<void> {
    const key = this.monthKey(new Date().toISOString())
    const records = (await this.storage.get(key)) as UsageRecord[] ?? []
    this.cache.set(key, records)
  }

  /** Append a record (in-memory, schedules debounced flush) */
  async append(record: UsageRecord): Promise<void> {
    const key = this.monthKey(record.timestamp)
    if (!this.cache.has(key)) {
      const existing = (await this.storage.get(key)) as UsageRecord[] ?? []
      this.cache.set(key, existing)
    }
    this.cache.get(key)!.push(record)
    this.dirty.add(key)
    this.scheduleFlush()
  }

  /** Get monthly cost total (reads from cache) */
  getMonthlyTotal(date?: Date): { totalCost: number; currency: string } {
    const key = this.monthKey((date ?? new Date()).toISOString())
    const records = this.cache.get(key) ?? []
    const totalCost = records.reduce((sum, r) => sum + (r.cost?.amount ?? 0), 0)
    const currency = records.find(r => r.cost?.currency)?.cost?.currency ?? 'USD'
    return { totalCost, currency }
  }

  /** Flush all dirty keys to storage immediately */
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

  /** Delete records older than retention period */
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

  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flush()
    }, DEBOUNCE_MS)
  }

  private monthKey(timestamp: string): string {
    const d = new Date(timestamp)
    return `records:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
}
```

### `usage-budget.ts` — Budget Logic (async)

```typescript
export class UsageBudget {
  private lastNotifiedStatus: 'ok' | 'warning' | 'exceeded' = 'ok'
  private lastNotifiedMonth: number

  constructor(
    private store: UsageStore,
    private config: UsagePluginConfig,
  ) {
    this.lastNotifiedMonth = new Date().getMonth()
  }

  /** Check budget and return notification if status changed (async) */
  async check(): Promise<{ status: 'ok' | 'warning' | 'exceeded'; message?: string }> {
    const budget = this.config.monthlyBudget ?? 0
    if (budget <= 0) return { status: 'ok' }

    const { totalCost } = this.store.getMonthlyTotal()
    const percent = totalCost / budget
    const threshold = this.config.warningThreshold ?? 0.8
    const currentMonth = new Date().getMonth()

    // Reset notification tracking on month change
    if (currentMonth !== this.lastNotifiedMonth) {
      this.lastNotifiedStatus = 'ok'
      this.lastNotifiedMonth = currentMonth
    }

    let status: 'ok' | 'warning' | 'exceeded' = 'ok'
    if (percent >= 1) status = 'exceeded'
    else if (percent >= threshold) status = 'warning'

    // Only notify on status escalation (ok → warning → exceeded)
    let message: string | undefined
    if (status !== 'ok' && status !== this.lastNotifiedStatus) {
      const bar = this.progressBar(percent)
      message = status === 'exceeded'
        ? `Budget exceeded! ${bar} $${totalCost.toFixed(2)} / $${budget.toFixed(2)}`
        : `Budget warning: ${bar} $${totalCost.toFixed(2)} / $${budget.toFixed(2)} (${(percent * 100).toFixed(0)}%)`
      this.lastNotifiedStatus = status
    }

    return { status, message }
  }

  /** Get current budget status for /usage command */
  async getStatus(): Promise<{ status: string; used: number; budget: number; percent: number }> {
    const { totalCost } = this.store.getMonthlyTotal()
    const budget = this.config.monthlyBudget ?? 0
    const percent = budget > 0 ? Math.round((totalCost / budget) * 100) : 0
    let status = 'ok'
    if (budget > 0) {
      if (totalCost >= budget) status = 'exceeded'
      else if (totalCost >= budget * (this.config.warningThreshold ?? 0.8)) status = 'warning'
    }
    return { status, used: totalCost, budget, percent }
  }

  private progressBar(percent: number): string {
    const filled = Math.min(Math.round(percent * 10), 10)
    return '█'.repeat(filled) + '░'.repeat(10 - filled)
  }
}
```

## Types

### UsageRecord (stored by plugin)

```typescript
interface UsageRecord {
  id: string                // nanoid, generated by plugin
  sessionId: string
  agentName: string
  tokensUsed: number
  contextSize: number
  cost?: { amount: number; currency: string }
  timestamp: string         // ISO 8601
}
```

### UsageRecordEvent (emitted by core on event bus)

```typescript
interface UsageRecordEvent {
  sessionId: string
  agentName: string
  timestamp: string
  tokensUsed: number
  contextSize: number
  cost?: { amount: number; currency: string }
}
```

Same as `UsageRecord` minus `id` (plugin generates the id).

### UsagePluginConfig

```typescript
interface UsagePluginConfig {
  monthlyBudget?: number      // 0 or undefined = no limit
  warningThreshold?: number   // 0-1, default 0.8
  retentionDays?: number      // default 90
}
```

### NotificationMessage (existing core type, used as-is)

```typescript
interface NotificationMessage {
  sessionId: string
  sessionName?: string
  type: "completed" | "error" | "permission" | "input_required" | "budget_warning"
  summary: string
  deepLink?: string
}
```

## Migration & Backward Compatibility

- Old `~/.viben/usage.json` is abandoned. Users lose historical usage data (accepted).
- The `usage` service name stays the same for plugin interop.
- `UsageService` interface simplified: drops `getSummary(period)`, keeps `trackUsage` + `checkBudget`.
- Telegram `/usage` command handler removed from core; plugin provides `/usage` via command registration.

## Testing Strategy

- **usage-store.test.ts**: Test append, in-memory cache, debounced flush, monthly totals, cleanup, month-partitioned keys
- **usage-budget.test.ts**: Test async budget check with warning/exceeded thresholds, month boundary reset, notification de-duplication, progress bar
- **index.test.ts**: Integration test — mock PluginContext, emit `usage:recorded`, verify storage writes + `notifyAll()` calls via notification service
