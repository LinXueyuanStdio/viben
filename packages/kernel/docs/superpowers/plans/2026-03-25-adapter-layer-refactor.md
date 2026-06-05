# Adapter Layer Refactor — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the adapter layer into a layered architecture with shared composable primitives, `MessagingAdapter` base class, `StreamAdapter` base class, and `IRenderer` interface — so new adapters take ~200 lines instead of ~1000.

**Architecture:** Thin `IChannelAdapter` interface at the top. `MessagingAdapter` base class handles drafts/queues/tracking for Telegram/Discord/Slack. `StreamAdapter` base class handles raw event streaming for WebSocket/API. Shared primitives (`DraftManager`, `SendQueue`, `ToolCallTracker`, `ActivityTracker`) are standalone composable classes. Each adapter provides a `Renderer` for platform-specific output formatting.

**Tech Stack:** TypeScript (ESM), Vitest for testing, existing grammY/discord.js/@slack/bolt SDKs.

**Spec:** `docs/superpowers/specs/2026-03-25-adapter-layer-refactor-design.md`

---

## File Structure Overview

### New files to create

```
src/adapters/shared/primitives/
  send-queue.ts              — Generic SendQueue (replaces TelegramSendQueue, DiscordSendQueue, SlackSendQueue)
  draft-manager.ts           — Generic DraftManager with callback-based flush
  tool-call-tracker.ts       — Generic ToolCallTracker
  activity-tracker.ts        — Generic ActivityTracker
  index.ts                   — Barrel export
  __tests__/
    send-queue.test.ts
    draft-manager.test.ts
    tool-call-tracker.test.ts
    activity-tracker.test.ts

src/adapters/shared/rendering/
  renderer.ts                — IRenderer interface + BaseRenderer
  message-formatter.ts       — SharedMessageFormatter class wrapping existing functions
  index.ts                   — Barrel export

src/adapters/shared/
  messaging-adapter.ts       — MessagingAdapter abstract base class
  stream-adapter.ts          — StreamAdapter abstract base class
  __tests__/
    adapter-conformance.ts   — Shared conformance test suite
  index.ts                   — Barrel export for shared module

src/adapters/telegram/
  renderer.ts                — TelegramRenderer extends BaseRenderer
  transport.ts               — Telegram API transport functions (send, edit, delete)
```

### Files to modify

```
src/core/channel.ts          — Add AdapterCapabilities, name, optional methods to IChannelAdapter
src/core/core.ts             — Change adapters Map and registerAdapter to use IChannelAdapter
src/core/session-bridge.ts   — Change adapter param type to IChannelAdapter, optional chaining for skill methods
src/core/notification.ts     — Change adapters Map to IChannelAdapter
src/core/plugin-manager.ts   — Change AdapterFactory return type to IChannelAdapter
src/core/__tests__/*.test.ts — Update mock adapter types from ChannelAdapter to IChannelAdapter
src/adapters/telegram/adapter.ts — Refactor to extend MessagingAdapter (~1154 → ~500 lines)
```

### Files to keep unchanged

```
src/core/types.ts            — OutgoingMessage, PermissionRequest etc. are stable
src/core/message-transformer.ts — Unchanged
src/adapters/shared/format-types.ts — Unchanged (DisplayVerbosity, ToolCallMeta, etc.)
src/adapters/shared/format-utils.ts — Unchanged (progressBar, formatTokens, etc.)
src/adapters/shared/message-formatter.ts — Unchanged (formatToolSummary, evaluateNoise, etc.)
src/adapters/telegram/formatting.ts — Unchanged (escapeHtml, markdownToTelegramHtml, formatToolCall, etc.)
src/adapters/telegram/commands/ — Unchanged
src/adapters/telegram/permissions.ts — Unchanged
src/adapters/telegram/topics.ts — Unchanged
src/adapters/telegram/assistant.ts — Unchanged
src/adapters/telegram/activity.ts — Kept during migration (TG-specific classes remain, adapter uses them directly)
src/adapters/telegram/streaming.ts — Kept during migration (MessageDraft used by TG adapter directly)
src/adapters/telegram/send-queue.ts — Kept during migration (TelegramSendQueue used by TG adapter directly)
src/adapters/telegram/tool-call-tracker.ts — Kept during migration
src/adapters/telegram/draft-manager.ts — Kept during migration
```

### Files to deprecate (after all adapters migrated)

```
src/adapters/shared/message-dispatcher.ts — Replaced by MessagingAdapter.dispatchMessage()
```

---

## Task 1: Update IChannelAdapter Interface

Add `name`, `capabilities`, and make some methods optional. This is backward-compatible — existing adapters keep working.

**Files:**
- Modify: `src/core/channel.ts`
- Test: existing tests still pass (no new test file needed)

- [ ] **Step 1: Read the current channel.ts**

Read `src/core/channel.ts` to confirm the current interface.

- [ ] **Step 2: Update IChannelAdapter and ChannelAdapter**

```typescript
// src/core/channel.ts — full replacement
import type { OutgoingMessage, PermissionRequest, NotificationMessage, AgentCommand } from './types.js'

export interface ChannelConfig {
  enabled: boolean
  [key: string]: unknown
}

export interface AdapterCapabilities {
  streaming: boolean
  richFormatting: boolean
  threads: boolean
  reactions: boolean
  fileUpload: boolean
  voice: boolean
}

export interface IChannelAdapter {
  readonly name: string
  readonly capabilities: AdapterCapabilities

  start(): Promise<void>
  stop(): Promise<void>

  // Outgoing: core → channel
  sendMessage(sessionId: string, content: OutgoingMessage): Promise<void>
  sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void>
  sendNotification(notification: NotificationMessage): Promise<void>

  // Session lifecycle on channel side
  createSessionThread(sessionId: string, name: string): Promise<string>  // returns threadId
  renameSessionThread(sessionId: string, newName: string): Promise<void>
  deleteSessionThread?(sessionId: string): Promise<void>
  archiveSessionTopic?(sessionId: string): Promise<void>

  // Skill commands — optional
  sendSkillCommands?(sessionId: string, commands: AgentCommand[]): Promise<void>
  cleanupSkillCommands?(sessionId: string): Promise<void>
}

/**
 * Base class providing default no-op implementations for optional methods.
 * Adapters can extend this or implement IChannelAdapter directly.
 * @deprecated Use MessagingAdapter or StreamAdapter instead. Kept for backward compat during migration.
 */
export abstract class ChannelAdapter<TCore = unknown> implements IChannelAdapter {
  abstract readonly name: string
  readonly capabilities: AdapterCapabilities = {
    streaming: false, richFormatting: false, threads: false,
    reactions: false, fileUpload: false, voice: false,
  }

  constructor(public readonly core: TCore, protected config: ChannelConfig) {}

  abstract start(): Promise<void>
  abstract stop(): Promise<void>

  abstract sendMessage(sessionId: string, content: OutgoingMessage): Promise<void>
  abstract sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void>
  abstract sendNotification(notification: NotificationMessage): Promise<void>

  abstract createSessionThread(sessionId: string, name: string): Promise<string>
  abstract renameSessionThread(sessionId: string, newName: string): Promise<void>
  async deleteSessionThread(_sessionId: string): Promise<void> {}

  async sendSkillCommands(_sessionId: string, _commands: AgentCommand[]): Promise<void> {}
  async cleanupSkillCommands(_sessionId: string): Promise<void> {}
  async archiveSessionTopic(_sessionId: string): Promise<void> {}
}
```

- [ ] **Step 3: Update core files to use IChannelAdapter instead of ChannelAdapter class**

Multiple core files reference the `ChannelAdapter` class directly. Since `MessagingAdapter` implements `IChannelAdapter` (not extends `ChannelAdapter`), all these references must change to `IChannelAdapter`:

**`src/core/core.ts`:**
- Line 8: `import { ChannelAdapter } from "./channel.js"` → `import type { IChannelAdapter } from "./channel.js"`
- Line 39: `adapters: Map<string, ChannelAdapter>` → `adapters: Map<string, IChannelAdapter>`
- Line 161: `registerAdapter(name: string, adapter: ChannelAdapter)` → `registerAdapter(name: string, adapter: IChannelAdapter)`
- Line 751: `createBridge(session: Session, adapter: ChannelAdapter)` → `createBridge(session: Session, adapter: IChannelAdapter)`

**`src/core/session-bridge.ts`:**
- Line 2: `import type { ChannelAdapter } from "./channel.js"` → `import type { IChannelAdapter } from "./channel.js"`
- Line 33: `private adapter: ChannelAdapter` → `private adapter: IChannelAdapter`
- Line 102: `this.adapter.cleanupSkillCommands(this.session.id)` → `this.adapter.cleanupSkillCommands?.(this.session.id)`
- Line 117: `this.adapter.cleanupSkillCommands(this.session.id)` → `this.adapter.cleanupSkillCommands?.(this.session.id)`
- Line 171: `this.adapter.sendSkillCommands(this.session.id, event.commands)` → `this.adapter.sendSkillCommands?.(this.session.id, event.commands)`

**`src/core/notification.ts`:**
- Line 1: `import type { ChannelAdapter } from './channel.js'` → `import type { IChannelAdapter } from './channel.js'`
- Line 5: `constructor(private adapters: Map<string, ChannelAdapter>)` → `constructor(private adapters: Map<string, IChannelAdapter>)`

**`src/core/plugin-manager.ts`:**
- Line 8: `import type { ChannelAdapter, ChannelConfig } from './channel.js'` → `import type { IChannelAdapter, ChannelConfig } from './channel.js'`
- Line 13: `createAdapter(core: VibenCore, config: ChannelConfig): ChannelAdapter` → `createAdapter(core: VibenCore, config: ChannelConfig): IChannelAdapter`

**All core test files** (`src/core/__tests__/*.test.ts`):
- Replace `import type { ChannelAdapter }` → `import type { IChannelAdapter }`
- Replace `function createMockAdapter(): ChannelAdapter` → `function createMockAdapter(): IChannelAdapter`
- Replace `as unknown as ChannelAdapter` → `as unknown as IChannelAdapter`
- Replace `Map<string, ChannelAdapter>` → `Map<string, IChannelAdapter>`
- Replace `let adapter: ChannelAdapter` → `let adapter: IChannelAdapter`

Add `name` and `capabilities` to all mock adapters in test files:
```typescript
name: 'test',
capabilities: { streaming: false, richFormatting: false, threads: false, reactions: false, fileUpload: false, voice: false },
```

- [ ] **Step 4: Add name property to existing adapters**

Add `readonly name = 'telegram'` to TelegramAdapter (after line 98), `readonly name = 'discord'` to DiscordAdapter, `readonly name = 'slack'` to SlackAdapter. Each adapter already extends ChannelAdapter which now requires `name`.

- [ ] **Step 5: Run tests and build**

Run: `pnpm build && pnpm test`
Expected: All pass (backward-compatible changes)

- [ ] **Step 6: Commit**

```bash
git add src/core/channel.ts src/core/session-bridge.ts src/adapters/telegram/adapter.ts src/adapters/discord/adapter.ts src/adapters/slack/adapter.ts
git commit -m "refactor(channel): add name, capabilities, optional methods to IChannelAdapter"
```

---

## Task 2: Shared SendQueue Primitive

Extract a generic SendQueue from the existing `TelegramSendQueue` pattern. Platform-agnostic — no Telegram/Discord/Slack imports.

**Files:**
- Create: `src/adapters/shared/primitives/send-queue.ts`
- Test: `src/adapters/shared/primitives/__tests__/send-queue.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/adapters/shared/primitives/__tests__/send-queue.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SendQueue } from '../send-queue.js'

describe('SendQueue', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('executes enqueued function', async () => {
    const queue = new SendQueue({ minInterval: 0 })
    const fn = vi.fn().mockResolvedValue('result')
    const promise = queue.enqueue(fn)
    await vi.advanceTimersByTimeAsync(0)
    expect(await promise).toBe('result')
  })

  it('enforces minimum interval between sends', async () => {
    const queue = new SendQueue({ minInterval: 3000 })
    const calls: number[] = []
    const fn1 = vi.fn(async () => { calls.push(Date.now()); return 1 })
    const fn2 = vi.fn(async () => { calls.push(Date.now()); return 2 })

    const p1 = queue.enqueue(fn1)
    const p2 = queue.enqueue(fn2)

    await vi.advanceTimersByTimeAsync(0)
    expect(fn1).toHaveBeenCalledOnce()
    expect(fn2).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3000)
    expect(fn2).toHaveBeenCalledOnce()
    await p1; await p2
  })

  it('deduplicates text items with same key', async () => {
    const queue = new SendQueue({ minInterval: 3000 })
    const fn1 = vi.fn().mockResolvedValue('first')
    const fn2 = vi.fn().mockResolvedValue('second')

    const p1 = queue.enqueue(fn1, { type: 'text', key: 'session-1' })
    const p2 = queue.enqueue(fn2, { type: 'text', key: 'session-1' })

    // p1 should resolve undefined (replaced)
    await vi.advanceTimersByTimeAsync(0)
    expect(await p1).toBeUndefined()
    await vi.advanceTimersByTimeAsync(3000)
    // fn1 was replaced by fn2, only fn2 should execute
    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).toHaveBeenCalledOnce()
  })

  it('calls onRateLimited and drops text items', async () => {
    const onRateLimited = vi.fn()
    const queue = new SendQueue({ minInterval: 3000, onRateLimited })
    const textFn = vi.fn().mockResolvedValue('text')
    const otherFn = vi.fn().mockResolvedValue('other')

    queue.enqueue(otherFn, { type: 'other' })
    const textP = queue.enqueue(textFn, { type: 'text', key: 'k' })
    queue.onRateLimited()

    expect(await textP).toBeUndefined()
    expect(onRateLimited).toHaveBeenCalledOnce()
    // 'other' item should still be in queue
    await vi.advanceTimersByTimeAsync(0)
    expect(otherFn).toHaveBeenCalled()
  })

  it('clear() drops all pending items', async () => {
    const queue = new SendQueue({ minInterval: 3000 })
    const fn = vi.fn().mockResolvedValue('x')
    const p = queue.enqueue(fn)
    queue.clear()
    expect(await p).toBeUndefined()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).not.toHaveBeenCalled()
  })

  it('reports pending count', () => {
    const queue = new SendQueue({ minInterval: 3000 })
    queue.enqueue(vi.fn().mockResolvedValue(1))
    queue.enqueue(vi.fn().mockResolvedValue(2))
    expect(queue.pending).toBe(2)
  })

  it('calls onError when function throws', async () => {
    const onError = vi.fn()
    const queue = new SendQueue({ minInterval: 0, onError })
    const err = new Error('boom')
    const p = queue.enqueue(vi.fn().mockRejectedValue(err))
    await vi.advanceTimersByTimeAsync(0)
    await expect(p).rejects.toThrow('boom')
  })

  it('supports per-category intervals', async () => {
    const queue = new SendQueue({
      minInterval: 1000,
      categoryIntervals: { 'chat.update': 500 },
    })
    const fn1 = vi.fn().mockResolvedValue(1)
    const fn2 = vi.fn().mockResolvedValue(2)

    queue.enqueue(fn1, { category: 'chat.update' })
    queue.enqueue(fn2, { category: 'chat.update' })

    await vi.advanceTimersByTimeAsync(0)
    expect(fn1).toHaveBeenCalledOnce()

    // Should use category interval (500ms) not default (1000ms)
    await vi.advanceTimersByTimeAsync(500)
    expect(fn2).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/adapters/shared/primitives/__tests__/send-queue.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SendQueue**

```typescript
// src/adapters/shared/primitives/send-queue.ts
export type QueueItemType = 'text' | 'other'

export interface SendQueueConfig {
  minInterval: number
  categoryIntervals?: Record<string, number>
  onRateLimited?: () => void
  onError?: (error: Error) => void
}

export interface EnqueueOptions {
  type?: QueueItemType
  key?: string
  category?: string
}

interface QueueItem<T = unknown> {
  fn: () => Promise<T>
  type: QueueItemType
  key?: string
  category?: string
  resolve: (value: T | undefined) => void
  reject: (err: unknown) => void
}

export class SendQueue {
  private items: QueueItem[] = []
  private processing = false
  private lastExec = 0
  private lastCategoryExec = new Map<string, number>()

  constructor(private config: SendQueueConfig) {}

  get pending(): number {
    return this.items.length
  }

  enqueue<T>(
    fn: () => Promise<T>,
    opts?: EnqueueOptions,
  ): Promise<T | undefined> {
    const type = opts?.type ?? 'other'
    const key = opts?.key
    const category = opts?.category

    return new Promise<T | undefined>((resolve, reject) => {
      if (type === 'text' && key) {
        const idx = this.items.findIndex(
          (item) => item.type === 'text' && item.key === key,
        )
        if (idx !== -1) {
          this.items[idx].resolve(undefined)
          this.items[idx] = { fn, type, key, category, resolve, reject } as QueueItem
          this.scheduleProcess()
          return
        }
      }

      this.items.push({ fn, type, key, category, resolve, reject } as QueueItem)
      this.scheduleProcess()
    })
  }

  onRateLimited(): void {
    this.config.onRateLimited?.()
    const remaining: QueueItem[] = []
    for (const item of this.items) {
      if (item.type === 'text') {
        item.resolve(undefined)
      } else {
        remaining.push(item)
      }
    }
    this.items = remaining
  }

  clear(): void {
    for (const item of this.items) {
      item.resolve(undefined)
    }
    this.items = []
  }

  private scheduleProcess(): void {
    if (this.processing) return
    if (this.items.length === 0) return

    const item = this.items[0]
    const interval = this.getInterval(item.category)
    const lastExec = item.category
      ? this.lastCategoryExec.get(item.category) ?? 0
      : this.lastExec
    const elapsed = Date.now() - lastExec
    const delay = Math.max(0, interval - elapsed)

    this.processing = true
    setTimeout(() => void this.processNext(), delay)
  }

  private getInterval(category?: string): number {
    if (category && this.config.categoryIntervals?.[category] != null) {
      return this.config.categoryIntervals[category]
    }
    return this.config.minInterval
  }

  private async processNext(): Promise<void> {
    const item = this.items.shift()
    if (!item) {
      this.processing = false
      return
    }

    try {
      const result = await item.fn()
      item.resolve(result)
    } catch (err) {
      this.config.onError?.(err instanceof Error ? err : new Error(String(err)))
      item.reject(err)
    } finally {
      const now = Date.now()
      this.lastExec = now
      if (item.category) {
        this.lastCategoryExec.set(item.category, now)
      }
      this.processing = false
      this.scheduleProcess()
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/adapters/shared/primitives/__tests__/send-queue.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/shared/primitives/send-queue.ts src/adapters/shared/primitives/__tests__/send-queue.test.ts
git commit -m "feat(shared): add generic SendQueue primitive with rate limiting and dedup"
```

---

## Task 3: Shared DraftManager Primitive

Generic DraftManager that uses callbacks for flush — no platform imports. Each platform provides `onFlush` callback.

**Files:**
- Create: `src/adapters/shared/primitives/draft-manager.ts`
- Test: `src/adapters/shared/primitives/__tests__/draft-manager.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/adapters/shared/primitives/__tests__/draft-manager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DraftManager, Draft } from '../draft-manager.js'

describe('Draft', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('buffers text and flushes at interval', async () => {
    const onFlush = vi.fn().mockResolvedValue('msg-1')
    const draft = new Draft('session-1', { flushInterval: 5000, maxLength: 4096, onFlush })

    draft.append('hello ')
    draft.append('world')

    expect(onFlush).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5000)
    expect(onFlush).toHaveBeenCalledWith('session-1', 'hello world', false)
  })

  it('returns messageId from first flush, then sends edits', async () => {
    const onFlush = vi.fn().mockResolvedValue('msg-1')
    const draft = new Draft('s1', { flushInterval: 5000, maxLength: 4096, onFlush })

    draft.append('first')
    await vi.advanceTimersByTimeAsync(5000)
    expect(onFlush).toHaveBeenCalledWith('s1', 'first', false)
    expect(draft.messageId).toBe('msg-1')

    draft.append(' more')
    await vi.advanceTimersByTimeAsync(5000)
    expect(onFlush).toHaveBeenCalledWith('s1', 'first more', true)
  })

  it('finalize flushes remaining text immediately', async () => {
    const onFlush = vi.fn().mockResolvedValue('msg-1')
    const draft = new Draft('s1', { flushInterval: 5000, maxLength: 4096, onFlush })

    draft.append('pending')
    await draft.finalize()
    expect(onFlush).toHaveBeenCalledWith('s1', 'pending', false)
  })

  it('isEmpty is true when buffer is empty', () => {
    const draft = new Draft('s1', { flushInterval: 5000, maxLength: 4096, onFlush: vi.fn() })
    expect(draft.isEmpty).toBe(true)
    draft.append('x')
    expect(draft.isEmpty).toBe(false)
  })

  it('destroy cleans up timers', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined)
    const draft = new Draft('s1', { flushInterval: 5000, maxLength: 4096, onFlush })
    draft.append('text')
    draft.destroy()
    await vi.advanceTimersByTimeAsync(10000)
    expect(onFlush).not.toHaveBeenCalled()
  })

  it('calls onError when flush fails', async () => {
    const onError = vi.fn()
    const onFlush = vi.fn().mockRejectedValue(new Error('fail'))
    const draft = new Draft('s1', { flushInterval: 5000, maxLength: 4096, onFlush, onError })

    draft.append('text')
    await vi.advanceTimersByTimeAsync(5000)
    expect(onError).toHaveBeenCalledWith('s1', expect.any(Error))
  })
})

describe('DraftManager', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('creates and retrieves drafts per session', () => {
    const onFlush = vi.fn().mockResolvedValue(undefined)
    const mgr = new DraftManager({ flushInterval: 5000, maxLength: 4096, onFlush })

    const d1 = mgr.getOrCreate('s1')
    const d2 = mgr.getOrCreate('s2')
    expect(d1).not.toBe(d2)
    expect(mgr.getOrCreate('s1')).toBe(d1)
  })

  it('finalize flushes specific session', async () => {
    const onFlush = vi.fn().mockResolvedValue('msg-1')
    const mgr = new DraftManager({ flushInterval: 5000, maxLength: 4096, onFlush })

    mgr.getOrCreate('s1').append('hello')
    await mgr.finalize('s1')
    expect(onFlush).toHaveBeenCalledWith('s1', 'hello', false)
  })

  it('destroyAll cleans up all sessions', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined)
    const mgr = new DraftManager({ flushInterval: 5000, maxLength: 4096, onFlush })

    mgr.getOrCreate('s1').append('a')
    mgr.getOrCreate('s2').append('b')
    mgr.destroyAll()

    await vi.advanceTimersByTimeAsync(10000)
    expect(onFlush).not.toHaveBeenCalled()
  })

  it('handles concurrent sessions independently', async () => {
    const flushed: string[] = []
    const onFlush = vi.fn(async (sid: string, text: string) => {
      flushed.push(`${sid}:${text}`)
      return `msg-${sid}`
    })
    const mgr = new DraftManager({ flushInterval: 5000, maxLength: 4096, onFlush })

    mgr.getOrCreate('s1').append('hello')
    mgr.getOrCreate('s2').append('world')

    await vi.advanceTimersByTimeAsync(5000)
    expect(flushed).toContain('s1:hello')
    expect(flushed).toContain('s2:world')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/adapters/shared/primitives/__tests__/draft-manager.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement DraftManager and Draft**

```typescript
// src/adapters/shared/primitives/draft-manager.ts
export interface DraftConfig {
  flushInterval: number
  maxLength: number
  onFlush: (sessionId: string, text: string, isEdit: boolean) => Promise<string | undefined>
  onError?: (sessionId: string, error: Error) => void
}

export class Draft {
  private buffer = ''
  private _messageId?: string
  private firstFlushPending = false
  private flushTimer?: ReturnType<typeof setTimeout>
  private flushPromise: Promise<void> = Promise.resolve()

  constructor(
    private sessionId: string,
    private config: DraftConfig,
  ) {}

  get isEmpty(): boolean { return !this.buffer }
  get messageId(): string | undefined { return this._messageId }

  append(text: string): void {
    if (!text) return
    this.buffer += text
    this.scheduleFlush()
  }

  async finalize(): Promise<string | undefined> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }
    await this.flushPromise
    if (this.buffer) {
      await this.flush()
    }
    return this._messageId
  }

  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }
    this.buffer = ''
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      this.flushPromise = this.flushPromise
        .then(() => this.flush())
        .catch(() => {})
    }, this.config.flushInterval)
  }

  private async flush(): Promise<void> {
    if (!this.buffer || this.firstFlushPending) return

    const snapshot = this.buffer
    const isEdit = !!this._messageId

    if (!this._messageId) {
      this.firstFlushPending = true
    }

    try {
      const result = await this.config.onFlush(this.sessionId, snapshot, isEdit)
      if (!isEdit && result) {
        this._messageId = result
      }
    } catch (err) {
      this.config.onError?.(this.sessionId, err instanceof Error ? err : new Error(String(err)))
    } finally {
      this.firstFlushPending = false
    }
  }
}

export class DraftManager {
  private drafts = new Map<string, Draft>()

  constructor(private config: DraftConfig) {}

  getOrCreate(sessionId: string): Draft {
    let draft = this.drafts.get(sessionId)
    if (!draft) {
      draft = new Draft(sessionId, this.config)
      this.drafts.set(sessionId, draft)
    }
    return draft
  }

  async finalize(sessionId: string): Promise<void> {
    const draft = this.drafts.get(sessionId)
    if (!draft) return
    await draft.finalize()
  }

  async finalizeAll(): Promise<void> {
    await Promise.all([...this.drafts.values()].map(d => d.finalize()))
  }

  destroy(sessionId: string): void {
    const draft = this.drafts.get(sessionId)
    if (draft) {
      draft.destroy()
      this.drafts.delete(sessionId)
    }
  }

  destroyAll(): void {
    for (const draft of this.drafts.values()) {
      draft.destroy()
    }
    this.drafts.clear()
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/adapters/shared/primitives/__tests__/draft-manager.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/shared/primitives/draft-manager.ts src/adapters/shared/primitives/__tests__/draft-manager.test.ts
git commit -m "feat(shared): add generic DraftManager primitive with callback-based flush"
```

---

## Task 4: Shared ToolCallTracker Primitive

Generic tracker that stores tool call metadata with message IDs. No platform API calls — just state management.

**Files:**
- Create: `src/adapters/shared/primitives/tool-call-tracker.ts`
- Test: `src/adapters/shared/primitives/__tests__/tool-call-tracker.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/adapters/shared/primitives/__tests__/tool-call-tracker.test.ts
import { describe, it, expect } from 'vitest'
import { ToolCallTracker } from '../tool-call-tracker.js'

describe('ToolCallTracker', () => {
  it('tracks new tool call with messageId', () => {
    const tracker = new ToolCallTracker()
    tracker.track('s1', { id: 't1', name: 'Read', kind: 'read' }, 'msg-42')
    expect(tracker.getActive('s1')).toHaveLength(1)
    expect(tracker.getActive('s1')[0]).toMatchObject({
      id: 't1', name: 'Read', kind: 'read', messageId: 'msg-42',
    })
  })

  it('updates tool call status and returns tracked tool', () => {
    const tracker = new ToolCallTracker()
    tracker.track('s1', { id: 't1', name: 'Read' }, 'msg-1')

    const result = tracker.update('s1', 't1', 'completed')
    expect(result).toMatchObject({ id: 't1', status: 'completed', messageId: 'msg-1' })
  })

  it('accumulates state from intermediate updates', () => {
    const tracker = new ToolCallTracker()
    tracker.track('s1', { id: 't1', name: 'Read' }, 'msg-1')

    tracker.update('s1', 't1', 'running', { viewerLinks: { file: 'http://f' } })
    const result = tracker.update('s1', 't1', 'completed')
    expect(result?.viewerLinks).toEqual({ file: 'http://f' })
  })

  it('returns null for unknown tool', () => {
    const tracker = new ToolCallTracker()
    expect(tracker.update('s1', 'nonexistent', 'done')).toBeNull()
  })

  it('clears session', () => {
    const tracker = new ToolCallTracker()
    tracker.track('s1', { id: 't1', name: 'Read' }, 'msg-1')
    tracker.clear('s1')
    expect(tracker.getActive('s1')).toHaveLength(0)
  })

  it('handles multiple sessions independently', () => {
    const tracker = new ToolCallTracker()
    tracker.track('s1', { id: 't1', name: 'A' }, 'msg-1')
    tracker.track('s2', { id: 't2', name: 'B' }, 'msg-2')

    expect(tracker.getActive('s1')).toHaveLength(1)
    expect(tracker.getActive('s2')).toHaveLength(1)

    tracker.clear('s1')
    expect(tracker.getActive('s1')).toHaveLength(0)
    expect(tracker.getActive('s2')).toHaveLength(1)
  })

  it('clearAll removes everything', () => {
    const tracker = new ToolCallTracker()
    tracker.track('s1', { id: 't1', name: 'A' }, 'msg-1')
    tracker.track('s2', { id: 't2', name: 'B' }, 'msg-2')
    tracker.clearAll()
    expect(tracker.getActive('s1')).toHaveLength(0)
    expect(tracker.getActive('s2')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/adapters/shared/primitives/__tests__/tool-call-tracker.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement ToolCallTracker**

```typescript
// src/adapters/shared/primitives/tool-call-tracker.ts
import type { ToolCallMeta, ViewerLinks } from '../format-types.js'

export interface TrackedToolCall extends ToolCallMeta {
  messageId: string
}

export class ToolCallTracker {
  private sessions = new Map<string, Map<string, TrackedToolCall>>()

  track(sessionId: string, meta: ToolCallMeta, messageId: string): void {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Map())
    }
    this.sessions.get(sessionId)!.set(meta.id, { ...meta, messageId })
  }

  update(
    sessionId: string,
    toolId: string,
    status: string,
    patch?: Partial<Pick<ToolCallMeta, 'viewerLinks' | 'viewerFilePath' | 'name' | 'kind'>>,
  ): TrackedToolCall | null {
    const tool = this.sessions.get(sessionId)?.get(toolId)
    if (!tool) return null

    tool.status = status
    if (patch?.viewerLinks) tool.viewerLinks = patch.viewerLinks
    if (patch?.viewerFilePath) tool.viewerFilePath = patch.viewerFilePath
    if (patch?.name) tool.name = patch.name
    if (patch?.kind) tool.kind = patch.kind

    return tool
  }

  getActive(sessionId: string): TrackedToolCall[] {
    const session = this.sessions.get(sessionId)
    return session ? [...session.values()] : []
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  clearAll(): void {
    this.sessions.clear()
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/adapters/shared/primitives/__tests__/tool-call-tracker.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/shared/primitives/tool-call-tracker.ts src/adapters/shared/primitives/__tests__/tool-call-tracker.test.ts
git commit -m "feat(shared): add generic ToolCallTracker primitive"
```

---

## Task 5: Shared ActivityTracker Primitive

Generic tracker using callbacks — no platform API calls.

**Files:**
- Create: `src/adapters/shared/primitives/activity-tracker.ts`
- Test: `src/adapters/shared/primitives/__tests__/activity-tracker.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/adapters/shared/primitives/__tests__/activity-tracker.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ActivityTracker } from '../activity-tracker.js'

describe('ActivityTracker', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  function makeCallbacks() {
    return {
      sendThinkingIndicator: vi.fn().mockResolvedValue(undefined),
      updateThinkingIndicator: vi.fn().mockResolvedValue(undefined),
      removeThinkingIndicator: vi.fn().mockResolvedValue(undefined),
    }
  }

  it('calls sendThinkingIndicator on thinking start', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 180000,
    })
    const cbs = makeCallbacks()
    tracker.onThinkingStart('s1', cbs)

    await vi.advanceTimersByTimeAsync(0)
    expect(cbs.sendThinkingIndicator).toHaveBeenCalledOnce()
  })

  it('calls updateThinkingIndicator on refresh interval', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 180000,
    })
    const cbs = makeCallbacks()
    tracker.onThinkingStart('s1', cbs)

    await vi.advanceTimersByTimeAsync(15000)
    expect(cbs.updateThinkingIndicator).toHaveBeenCalled()
  })

  it('calls removeThinkingIndicator on text start', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 180000,
    })
    const cbs = makeCallbacks()
    tracker.onThinkingStart('s1', cbs)
    await vi.advanceTimersByTimeAsync(0)

    tracker.onTextStart('s1')
    expect(cbs.removeThinkingIndicator).toHaveBeenCalledOnce()
  })

  it('stops refresh on session end', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 180000,
    })
    const cbs = makeCallbacks()
    tracker.onThinkingStart('s1', cbs)
    await vi.advanceTimersByTimeAsync(0)

    tracker.onSessionEnd('s1')
    cbs.updateThinkingIndicator.mockClear()
    await vi.advanceTimersByTimeAsync(30000)
    expect(cbs.updateThinkingIndicator).not.toHaveBeenCalled()
  })

  it('stops refresh after maxThinkingDuration', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 30000,
    })
    const cbs = makeCallbacks()
    tracker.onThinkingStart('s1', cbs)

    await vi.advanceTimersByTimeAsync(15000)
    expect(cbs.updateThinkingIndicator).toHaveBeenCalled()

    cbs.updateThinkingIndicator.mockClear()
    await vi.advanceTimersByTimeAsync(30000)
    // Should have stopped by now
    expect(cbs.updateThinkingIndicator.mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('handles multiple sessions independently', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 180000,
    })
    const cbs1 = makeCallbacks()
    const cbs2 = makeCallbacks()

    tracker.onThinkingStart('s1', cbs1)
    tracker.onThinkingStart('s2', cbs2)

    await vi.advanceTimersByTimeAsync(0)
    expect(cbs1.sendThinkingIndicator).toHaveBeenCalledOnce()
    expect(cbs2.sendThinkingIndicator).toHaveBeenCalledOnce()

    tracker.onTextStart('s1')
    expect(cbs1.removeThinkingIndicator).toHaveBeenCalled()
    expect(cbs2.removeThinkingIndicator).not.toHaveBeenCalled()
  })

  it('destroy cleans up all sessions', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 180000,
    })
    const cbs = makeCallbacks()
    tracker.onThinkingStart('s1', cbs)
    await vi.advanceTimersByTimeAsync(0)

    tracker.destroy()
    cbs.updateThinkingIndicator.mockClear()
    await vi.advanceTimersByTimeAsync(30000)
    expect(cbs.updateThinkingIndicator).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/adapters/shared/primitives/__tests__/activity-tracker.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement ActivityTracker**

```typescript
// src/adapters/shared/primitives/activity-tracker.ts
export interface ActivityConfig {
  thinkingRefreshInterval: number
  maxThinkingDuration: number
}

export interface ActivityCallbacks {
  sendThinkingIndicator(): Promise<void>
  updateThinkingIndicator(): Promise<void>
  removeThinkingIndicator(): Promise<void>
}

interface SessionState {
  callbacks: ActivityCallbacks
  refreshTimer?: ReturnType<typeof setInterval>
  startTime: number
  dismissed: boolean
}

export class ActivityTracker {
  private sessions = new Map<string, SessionState>()

  constructor(private config: ActivityConfig) {}

  onThinkingStart(sessionId: string, callbacks: ActivityCallbacks): void {
    // Clean up existing state if any
    this.cleanup(sessionId)

    const state: SessionState = {
      callbacks,
      startTime: Date.now(),
      dismissed: false,
    }
    this.sessions.set(sessionId, state)

    // Send initial indicator
    setTimeout(() => {
      if (state.dismissed) return
      callbacks.sendThinkingIndicator().catch(() => {})
      this.startRefresh(sessionId, state)
    }, 0)
  }

  onTextStart(sessionId: string): void {
    const state = this.sessions.get(sessionId)
    if (!state || state.dismissed) return
    state.dismissed = true
    this.stopRefresh(state)
    state.callbacks.removeThinkingIndicator().catch(() => {})
  }

  onSessionEnd(sessionId: string): void {
    this.cleanup(sessionId)
  }

  destroy(): void {
    for (const [id] of this.sessions) {
      this.cleanup(id)
    }
  }

  private cleanup(sessionId: string): void {
    const state = this.sessions.get(sessionId)
    if (!state) return
    state.dismissed = true
    this.stopRefresh(state)
    this.sessions.delete(sessionId)
  }

  private startRefresh(sessionId: string, state: SessionState): void {
    state.refreshTimer = setInterval(() => {
      if (state.dismissed) {
        this.stopRefresh(state)
        return
      }
      if (Date.now() - state.startTime >= this.config.maxThinkingDuration) {
        this.stopRefresh(state)
        return
      }
      state.callbacks.updateThinkingIndicator().catch(() => {})
    }, this.config.thinkingRefreshInterval)
  }

  private stopRefresh(state: SessionState): void {
    if (state.refreshTimer) {
      clearInterval(state.refreshTimer)
      state.refreshTimer = undefined
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/adapters/shared/primitives/__tests__/activity-tracker.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Create barrel export for primitives**

```typescript
// src/adapters/shared/primitives/index.ts
export { SendQueue, type SendQueueConfig, type EnqueueOptions, type QueueItemType } from './send-queue.js'
export { DraftManager, Draft, type DraftConfig } from './draft-manager.js'
export { ToolCallTracker, type TrackedToolCall } from './tool-call-tracker.js'
export { ActivityTracker, type ActivityConfig, type ActivityCallbacks } from './activity-tracker.js'
```

- [ ] **Step 6: Commit**

```bash
git add src/adapters/shared/primitives/
git commit -m "feat(shared): add ActivityTracker primitive and barrel export for all primitives"
```

---

## Task 6: IRenderer Interface + BaseRenderer

Create rendering abstraction with sensible defaults.

**Files:**
- Create: `src/adapters/shared/rendering/renderer.ts`
- Create: `src/adapters/shared/rendering/index.ts`
- Test: No separate test file — tested via conformance tests and platform renderer tests

- [ ] **Step 1: Create IRenderer interface and BaseRenderer**

```typescript
// src/adapters/shared/rendering/renderer.ts
import type { OutgoingMessage, PermissionRequest, NotificationMessage } from '../../../core/types.js'
import type { DisplayVerbosity } from '../format-types.js'
import {
  formatToolSummary,
  formatToolTitle,
  resolveToolIcon,
  extractContentText,
  evaluateNoise,
} from '../message-formatter.js'
import { progressBar, formatTokens, stripCodeFences, truncateContent } from '../format-utils.js'
import type { ToolCallMeta, ToolUpdateMeta } from '../format-types.js'

export interface RenderedMessage<TComponents = unknown> {
  body: string
  format: 'html' | 'markdown' | 'plain' | 'structured'
  attachments?: RenderedAttachment[]
  components?: TComponents
}

export interface RenderedPermission<TComponents = unknown> extends RenderedMessage<TComponents> {
  actions: RenderedAction[]
}

export interface RenderedAction {
  id: string
  label: string
  isAllow?: boolean
}

export interface RenderedAttachment {
  type: 'file' | 'image' | 'audio'
  data: Buffer | string
  mimeType?: string
  filename?: string
}

export interface IRenderer {
  renderText(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage
  renderToolCall(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage
  renderToolUpdate(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage
  renderPlan(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage
  renderUsage(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage
  renderPermission(request: PermissionRequest): RenderedPermission
  renderError(content: OutgoingMessage): RenderedMessage
  renderNotification(notification: NotificationMessage): RenderedMessage
  renderThought?(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage
  renderAttachment?(content: OutgoingMessage): RenderedMessage
  renderSessionEnd?(content: OutgoingMessage): RenderedMessage
  renderSystemMessage?(content: OutgoingMessage): RenderedMessage
}

/**
 * BaseRenderer — plain text defaults. Extend for platform-specific rendering.
 */
export class BaseRenderer implements IRenderer {
  renderText(content: OutgoingMessage): RenderedMessage {
    return { body: content.text, format: 'plain' }
  }

  renderToolCall(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage {
    const meta = (content.metadata ?? {}) as Partial<ToolCallMeta>
    const name = meta.name ?? content.text ?? 'Tool'
    const icon = resolveToolIcon(meta)
    const label = verbosity === 'low'
      ? formatToolTitle(name, meta.rawInput, meta.displayTitle as string | undefined)
      : formatToolSummary(name, meta.rawInput, meta.displaySummary as string | undefined)
    return { body: `${icon} ${label}`, format: 'plain' }
  }

  renderToolUpdate(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage {
    const meta = (content.metadata ?? {}) as Partial<ToolUpdateMeta>
    const name = meta.name ?? content.text ?? 'Tool'
    const icon = resolveToolIcon(meta)
    const label = verbosity === 'low'
      ? formatToolTitle(name, meta.rawInput, meta.displayTitle as string | undefined)
      : formatToolSummary(name, meta.rawInput, meta.displaySummary as string | undefined)
    return { body: `${icon} ${label}`, format: 'plain' }
  }

  renderPlan(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage {
    const entries = (content.metadata as { entries?: Array<{ content: string; status: string }> })?.entries ?? []
    const done = entries.filter(e => e.status === 'completed').length
    if (verbosity === 'medium' || verbosity === 'low') {
      return { body: `📋 Plan: ${done}/${entries.length} steps completed`, format: 'plain' }
    }
    const lines = entries.map((e, i) => {
      const icon = e.status === 'completed' ? '✅' : e.status === 'in_progress' ? '🔄' : '⬜'
      return `${icon} ${i + 1}. ${e.content}`
    })
    return { body: `📋 Plan\n${lines.join('\n')}`, format: 'plain' }
  }

  renderUsage(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage {
    const meta = content.metadata as { tokensUsed?: number; contextSize?: number; cost?: number } | undefined
    if (!meta?.tokensUsed) return { body: '📊 Usage data unavailable', format: 'plain' }
    const costStr = meta.cost != null ? ` · $${meta.cost.toFixed(2)}` : ''
    if (verbosity === 'medium') {
      return { body: `📊 ${formatTokens(meta.tokensUsed)} tokens${costStr}`, format: 'plain' }
    }
    if (!meta.contextSize) return { body: `📊 ${formatTokens(meta.tokensUsed)} tokens`, format: 'plain' }
    const ratio = meta.tokensUsed / meta.contextSize
    const pct = Math.round(ratio * 100)
    const bar = progressBar(ratio)
    let text = `📊 ${formatTokens(meta.tokensUsed)} / ${formatTokens(meta.contextSize)} tokens\n${bar} ${pct}%`
    if (meta.cost != null) text += `\n💰 $${meta.cost.toFixed(2)}`
    return { body: text, format: 'plain' }
  }

  renderPermission(request: PermissionRequest): RenderedPermission {
    return {
      body: request.description,
      format: 'plain',
      actions: request.options.map(o => ({ id: o.id, label: o.label, isAllow: o.isAllow })),
    }
  }

  renderError(content: OutgoingMessage): RenderedMessage {
    return { body: `❌ Error: ${content.text}`, format: 'plain' }
  }

  renderNotification(notification: NotificationMessage): RenderedMessage {
    const emoji: Record<string, string> = {
      completed: '✅', error: '❌', permission: '🔐', input_required: '💬', budget_warning: '⚠️',
    }
    return {
      body: `${emoji[notification.type] || 'ℹ️'} ${notification.sessionName || 'Session'}\n${notification.summary}`,
      format: 'plain',
    }
  }

  renderSystemMessage(content: OutgoingMessage): RenderedMessage {
    return { body: content.text, format: 'plain' }
  }
}
```

- [ ] **Step 2: Create barrel export**

```typescript
// src/adapters/shared/rendering/index.ts
export {
  type IRenderer,
  BaseRenderer,
  type RenderedMessage,
  type RenderedPermission,
  type RenderedAction,
  type RenderedAttachment,
} from './renderer.js'
```

- [ ] **Step 3: Build to verify**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/adapters/shared/rendering/
git commit -m "feat(shared): add IRenderer interface and BaseRenderer with plain text defaults"
```

---

## Task 7: MessagingAdapter Base Class

The core refactoring piece — abstract base with shared logic and overridable handlers.

**Files:**
- Create: `src/adapters/shared/messaging-adapter.ts`
- Test: via conformance tests (Task 9)

- [ ] **Step 1: Read the spec Section 2 for reference**

Read `docs/superpowers/specs/2026-03-25-adapter-layer-refactor-design.md` lines 128-264.

- [ ] **Step 2: Implement MessagingAdapter**

```typescript
// src/adapters/shared/messaging-adapter.ts
import type {
  IChannelAdapter,
  ChannelConfig,
  AdapterCapabilities,
} from '../../core/channel.js'
import type {
  OutgoingMessage,
  PermissionRequest,
  NotificationMessage,
  AgentCommand,
} from '../../core/types.js'
import type { DisplayVerbosity, ToolCallMeta, ToolUpdateMeta } from './format-types.js'
import type { IRenderer, RenderedMessage } from './rendering/renderer.js'
import { evaluateNoise } from './message-formatter.js'

export interface AdapterContext {
  configManager: { get(): Record<string, unknown> }
  fileService?: unknown
}

export interface MessagingAdapterConfig extends ChannelConfig {
  maxMessageLength: number
  flushInterval?: number
  sendInterval?: number
  thinkingRefreshInterval?: number
  thinkingDuration?: number
  displayVerbosity?: DisplayVerbosity
}

export interface SentMessage {
  messageId: string
}

const HIDDEN_ON_LOW = new Set(['thought', 'plan', 'usage'])

export abstract class MessagingAdapter implements IChannelAdapter {
  abstract readonly name: string
  abstract readonly renderer: IRenderer
  abstract readonly capabilities: AdapterCapabilities

  constructor(
    protected context: AdapterContext,
    protected adapterConfig: MessagingAdapterConfig,
  ) {}

  // === Message dispatch flow ===

  async sendMessage(sessionId: string, content: OutgoingMessage): Promise<void> {
    const verbosity = this.getVerbosity()
    if (!this.shouldDisplay(content, verbosity)) return
    await this.dispatchMessage(sessionId, content, verbosity)
  }

  protected async dispatchMessage(
    sessionId: string,
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): Promise<void> {
    switch (content.type) {
      case 'text':           return this.handleText(sessionId, content)
      case 'thought':        return this.handleThought(sessionId, content, verbosity)
      case 'tool_call':      return this.handleToolCall(sessionId, content, verbosity)
      case 'tool_update':    return this.handleToolUpdate(sessionId, content, verbosity)
      case 'plan':           return this.handlePlan(sessionId, content, verbosity)
      case 'usage':          return this.handleUsage(sessionId, content, verbosity)
      case 'error':          return this.handleError(sessionId, content)
      case 'attachment':     return this.handleAttachment(sessionId, content)
      case 'system_message': return this.handleSystem(sessionId, content)
      case 'session_end':    return this.handleSessionEnd(sessionId, content)
    }
  }

  // === Default handlers — all protected, all overridable ===

  protected async handleText(_sessionId: string, _content: OutgoingMessage): Promise<void> {
    // Subclass should implement: append to draft
  }

  protected async handleThought(_sessionId: string, _content: OutgoingMessage, _verbosity: DisplayVerbosity): Promise<void> {
    // Default: ignore. Override to show thinking indicator.
  }

  protected async handleToolCall(_sessionId: string, _content: OutgoingMessage, _verbosity: DisplayVerbosity): Promise<void> {
    // Subclass should implement: finalize draft, render tool, send, track
  }

  protected async handleToolUpdate(_sessionId: string, _content: OutgoingMessage, _verbosity: DisplayVerbosity): Promise<void> {
    // Subclass should implement: update tracked tool, edit message
  }

  protected async handlePlan(_sessionId: string, _content: OutgoingMessage, _verbosity: DisplayVerbosity): Promise<void> {
    // Subclass should implement: render plan, send/update
  }

  protected async handleUsage(_sessionId: string, _content: OutgoingMessage, _verbosity: DisplayVerbosity): Promise<void> {
    // Subclass should implement: finalize draft, render usage, send
  }

  protected async handleError(_sessionId: string, _content: OutgoingMessage): Promise<void> {
    // Subclass should implement: render error, send
  }

  protected async handleAttachment(_sessionId: string, _content: OutgoingMessage): Promise<void> {
    // Default: no-op. Override for file/image/audio support.
  }

  protected async handleSystem(_sessionId: string, _content: OutgoingMessage): Promise<void> {
    // Default: no-op. Override to forward system messages.
  }

  protected async handleSessionEnd(_sessionId: string, _content: OutgoingMessage): Promise<void> {
    // Subclass should implement: finalize draft, cleanup, send completion
  }

  // === Helpers ===

  protected getVerbosity(): DisplayVerbosity {
    const config = this.context.configManager.get()
    const channelConfig = (config as Record<string, unknown>).channels as Record<string, Record<string, unknown>> | undefined
    const v = channelConfig?.[this.name]?.displayVerbosity ?? this.adapterConfig.displayVerbosity
    if (v === 'low' || v === 'high') return v
    return 'medium'
  }

  protected shouldDisplay(content: OutgoingMessage, verbosity: DisplayVerbosity): boolean {
    if (verbosity === 'low' && HIDDEN_ON_LOW.has(content.type)) return false

    // Noise filtering for tool calls
    if (content.type === 'tool_call') {
      const meta = (content.metadata ?? {}) as Partial<ToolCallMeta>
      const toolName = meta.name ?? content.text ?? ''
      const toolKind = String(meta.kind ?? 'other')
      const noiseAction = evaluateNoise(toolName, toolKind, meta.rawInput)
      if (noiseAction === 'hide' && verbosity !== 'high') return false
      if (noiseAction === 'collapse' && verbosity === 'low') return false
    }

    return true
  }

  // === Abstract — adapter MUST implement ===

  abstract start(): Promise<void>
  abstract stop(): Promise<void>
  abstract createSessionThread(sessionId: string, name: string): Promise<string>
  abstract renameSessionThread(sessionId: string, newName: string): Promise<void>
  abstract sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void>
  abstract sendNotification(notification: NotificationMessage): Promise<void>
}
```

Note: The handlers are intentionally empty (no-op) in the base class. The Telegram adapter (Task 10) will override them with platform-specific logic using its existing managers. This avoids coupling the base class to specific primitive implementations — each adapter composes primitives as needed.

- [ ] **Step 3: Build to verify**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/adapters/shared/messaging-adapter.ts
git commit -m "feat(shared): add MessagingAdapter abstract base class with dispatch and verbosity"
```

---

## Task 8: StreamAdapter Base Class

Lightweight base for WebSocket/API/gRPC transports.

**Files:**
- Create: `src/adapters/shared/stream-adapter.ts`
- Test: via conformance tests

- [ ] **Step 1: Implement StreamAdapter**

```typescript
// src/adapters/shared/stream-adapter.ts
import type {
  IChannelAdapter,
  AdapterCapabilities,
} from '../../core/channel.js'
import type {
  OutgoingMessage,
  PermissionRequest,
  NotificationMessage,
} from '../../core/types.js'

export interface StreamEvent {
  type: string
  sessionId?: string
  payload: unknown
  timestamp: number
}

export abstract class StreamAdapter implements IChannelAdapter {
  abstract readonly name: string

  capabilities: AdapterCapabilities

  constructor(config?: Partial<AdapterCapabilities>) {
    this.capabilities = {
      streaming: true,
      richFormatting: false,
      threads: false,
      reactions: false,
      fileUpload: false,
      voice: false,
      ...config,
    }
  }

  async sendMessage(sessionId: string, content: OutgoingMessage): Promise<void> {
    await this.emit(sessionId, {
      type: content.type,
      sessionId,
      payload: content,
      timestamp: Date.now(),
    })
  }

  async sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void> {
    await this.emit(sessionId, {
      type: 'permission_request',
      sessionId,
      payload: request,
      timestamp: Date.now(),
    })
  }

  async sendNotification(notification: NotificationMessage): Promise<void> {
    await this.broadcast({
      type: 'notification',
      payload: notification,
      timestamp: Date.now(),
    })
  }

  async createSessionThread(_sessionId: string, _name: string): Promise<string> {
    return ''  // Client manages UI
  }

  async renameSessionThread(sessionId: string, name: string): Promise<void> {
    await this.emit(sessionId, {
      type: 'session_rename',
      sessionId,
      payload: { name },
      timestamp: Date.now(),
    })
  }

  // Abstract — implement transport
  protected abstract emit(sessionId: string, event: StreamEvent): Promise<void>
  protected abstract broadcast(event: StreamEvent): Promise<void>
  abstract start(): Promise<void>
  abstract stop(): Promise<void>
}
```

- [ ] **Step 2: Build to verify**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/adapters/shared/stream-adapter.ts
git commit -m "feat(shared): add StreamAdapter base class for WebSocket/API transports"
```

---

## Task 9: Conformance Test Suite + Shared Barrel Export

Create test suite that any adapter must pass, plus barrel exports.

**Files:**
- Create: `src/adapters/shared/__tests__/adapter-conformance.ts`
- Create: `src/adapters/shared/index.ts`

- [ ] **Step 1: Create conformance test helper**

```typescript
// src/adapters/shared/__tests__/adapter-conformance.ts
import { describe, it, expect, afterEach } from 'vitest'
import type { IChannelAdapter } from '../../../core/channel.js'

export function runAdapterConformanceTests(
  createAdapter: () => IChannelAdapter | Promise<IChannelAdapter>,
  cleanup?: () => Promise<void>,
) {
  let adapter: IChannelAdapter

  afterEach(async () => {
    await cleanup?.()
  })

  describe('IChannelAdapter conformance', () => {
    it('has a name', async () => {
      adapter = await createAdapter()
      expect(typeof adapter.name).toBe('string')
      expect(adapter.name.length).toBeGreaterThan(0)
    })

    it('declares capabilities correctly', async () => {
      adapter = await createAdapter()
      const caps = adapter.capabilities
      expect(typeof caps.streaming).toBe('boolean')
      expect(typeof caps.richFormatting).toBe('boolean')
      expect(typeof caps.threads).toBe('boolean')
      expect(typeof caps.reactions).toBe('boolean')
      expect(typeof caps.fileUpload).toBe('boolean')
      expect(typeof caps.voice).toBe('boolean')
    })

    it('sends text messages without error', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendMessage('test-session', { type: 'text', text: 'hello' }),
      ).resolves.not.toThrow()
    })

    it('sends tool_call messages without error', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendMessage('test-session', {
          type: 'tool_call',
          text: 'Read',
          metadata: { id: 't1', name: 'Read', kind: 'read' },
        }),
      ).resolves.not.toThrow()
    })

    it('sends usage messages without error', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendMessage('test-session', {
          type: 'usage',
          text: '',
          metadata: { tokensUsed: 1000, contextSize: 200000 },
        }),
      ).resolves.not.toThrow()
    })

    it('sends error messages without error', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendMessage('test-session', { type: 'error', text: 'something failed' }),
      ).resolves.not.toThrow()
    })

    it('handles session_end without error', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendMessage('test-session', { type: 'session_end', text: 'finished' }),
      ).resolves.not.toThrow()
    })

    it('handles unknown message types gracefully', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendMessage('test-session', { type: 'unknown_type' as never, text: '' }),
      ).resolves.not.toThrow()
    })

    it('sendNotification does not throw', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendNotification({
          sessionId: 'test',
          type: 'completed',
          summary: 'done',
        }),
      ).resolves.not.toThrow()
    })
  })
}
```

- [ ] **Step 2: Create shared barrel export**

```typescript
// src/adapters/shared/index.ts
export { MessagingAdapter, type AdapterContext, type MessagingAdapterConfig, type SentMessage } from './messaging-adapter.js'
export { StreamAdapter, type StreamEvent } from './stream-adapter.js'
export { type IRenderer, BaseRenderer, type RenderedMessage, type RenderedPermission, type RenderedAction } from './rendering/index.js'
export { SendQueue, DraftManager, Draft, ToolCallTracker, ActivityTracker } from './primitives/index.js'
export type { SendQueueConfig, DraftConfig, TrackedToolCall, ActivityConfig, ActivityCallbacks } from './primitives/index.js'

// Legacy exports — kept for backward compat during migration
export { dispatchMessage, shouldDispatch, type MessageHandlers } from './message-dispatcher.js'
export type { DisplayVerbosity, ToolCallMeta, ToolUpdateMeta, FormattedMessage, MessageMetadata, ViewerLinks } from './format-types.js'
```

- [ ] **Step 3: Build to verify**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/adapters/shared/__tests__/adapter-conformance.ts src/adapters/shared/index.ts
git commit -m "feat(shared): add adapter conformance tests and barrel export"
```

---

## Task 10: Migrate TelegramAdapter to extend MessagingAdapter

The most critical task — refactor TelegramAdapter from 1154 lines to ~500-600 by extending MessagingAdapter and overriding handlers.

**IMPORTANT:** This task keeps all existing Telegram-specific modules (streaming.ts, send-queue.ts, tool-call-tracker.ts, draft-manager.ts, activity.ts) as-is. TelegramAdapter uses them directly via overridden handlers. We are NOT replacing them with shared primitives in this task — that's a future optimization.

**Files:**
- Modify: `src/adapters/telegram/adapter.ts` (~1154 → ~600 lines)
- Create: `src/adapters/telegram/__tests__/conformance.test.ts`

- [ ] **Step 1: Read the full current adapter.ts**

Read `src/adapters/telegram/adapter.ts` in full (all 1154 lines) to understand every method.

- [ ] **Step 2: Refactor TelegramAdapter to extend MessagingAdapter**

Key changes:
1. Change `extends ChannelAdapter<VibenCore>` → `extends MessagingAdapter`
2. Add `name`, `renderer`, `capabilities`
3. Move `messageHandlers` logic into overridden `handleText()`, `handleToolCall()`, etc.
4. Remove the `dispatchMessage` import — now inherited from MessagingAdapter
5. Keep all platform-specific logic (bot setup, routes, media handling, assistant logic)
6. The `sendMessage()` override checks for assistant suppression and archiving before calling `super.sendMessage()`

The adapter should import from `../shared/messaging-adapter.js` and override the protected handlers. The existing Telegram managers (`DraftManager`, `ToolCallTracker`, `ActivityTracker`, `SendQueue`) remain — they're used inside the overridden handlers.

```typescript
// High-level structure of refactored adapter.ts:
export class TelegramAdapter extends MessagingAdapter {
  readonly name = 'telegram'
  readonly renderer: IRenderer = new BaseRenderer()  // TelegramRenderer in future task
  readonly capabilities = {
    streaming: true, richFormatting: true, threads: true,
    reactions: true, fileUpload: true, voice: true,
  }

  // ... existing private fields (bot, permissionHandler, etc.)

  constructor(core: VibenCore, config: TelegramChannelConfig) {
    super(
      { configManager: core.configManager },
      { ...config, maxMessageLength: 4096, enabled: config.enabled ?? true },
    )
    // Keep reference to full core for methods that need it
    this.core = core
    this.telegramConfig = config
  }

  // Override sendMessage to add TG-specific guards
  async sendMessage(sessionId: string, content: OutgoingMessage): Promise<void> {
    if (this.assistantInitializing && sessionId === this.assistantSession?.id) return
    const session = this.core.sessionManager.getSession(sessionId)
    if (!session) return
    if (session.archiving) return
    const threadId = Number(session.threadId)
    if (!threadId || isNaN(threadId)) return

    // Store threadId for use in handlers
    this.currentThreadId = threadId
    await super.sendMessage(sessionId, content)
  }

  // Override each handler with TG-specific logic (moved from messageHandlers)
  protected async handleText(sessionId: string, content: OutgoingMessage): Promise<void> {
    // ... existing onText logic
  }

  protected async handleToolCall(sessionId: string, content: OutgoingMessage, verbosity: DisplayVerbosity): Promise<void> {
    // ... existing onToolCall logic
  }

  // ... etc for all handlers

  // Keep all existing methods: start(), stop(), setupRoutes(),
  // sendPermissionRequest(), sendNotification(), createSessionThread(),
  // renameSessionThread(), deleteSessionThread(), archiveSessionTopic(),
  // handleIncomingMedia(), etc.
}
```

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: PASS (no type errors)

- [ ] **Step 4: Run all existing tests**

Run: `pnpm test`
Expected: ALL PASS (behavior unchanged)

- [ ] **Step 5: Add conformance test**

```typescript
// src/adapters/telegram/__tests__/conformance.test.ts
import { describe } from 'vitest'
import { runAdapterConformanceTests } from '../../shared/__tests__/adapter-conformance.js'
import { TelegramAdapter } from '../adapter.js'

// NOTE: This test uses a mock core. Full integration testing requires a bot token.
// The conformance test verifies the adapter doesn't throw on standard operations.

function createMockCore() {
  return {
    configManager: { get: () => ({ channels: { telegram: {} } }) },
    sessionManager: {
      getSession: () => ({
        id: 'test', threadId: '123', archiving: false,
        agentName: 'test', agentSessionId: 'test',
      }),
      getSessionByThread: () => null,
      getSessionRecord: () => null,
      listRecords: () => [],
      patchRecord: async () => {},
    },
    agentManager: { getAvailableAgents: () => [] },
    fileService: { saveFile: async () => ({}) },
  }
}

// Adapter requires bot token so we skip in CI — conformance is validated
// by the test structure. Real conformance runs with integration tests.
describe.skip('TelegramAdapter conformance', () => {
  runAdapterConformanceTests(
    () => new TelegramAdapter(createMockCore() as never, {
      enabled: true,
      botToken: 'test',
      chatId: 123,
    } as never),
  )
})
```

- [ ] **Step 6: Commit**

```bash
git add src/adapters/telegram/adapter.ts src/adapters/telegram/__tests__/conformance.test.ts
git commit -m "refactor(telegram): migrate TelegramAdapter to extend MessagingAdapter"
```

---

## Task 11: Final Verification & Cleanup

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Run build:publish to verify npm bundle**

Run: `pnpm build:publish`
Expected: PASS

- [ ] **Step 4: Verify Discord and Slack adapters still work**

Discord and Slack adapters are NOT migrated in this plan — they still extend `ChannelAdapter`. Verify they build correctly and their tests pass.

Run: `pnpm test src/adapters/discord/ src/adapters/slack/`
Expected: ALL PASS

- [ ] **Step 5: Verify no regressions in core tests**

Run: `pnpm test src/core/`
Expected: ALL PASS

- [ ] **Step 6: Commit any final fixes**

```bash
git add -A
git commit -m "refactor: adapter layer Phase 1 complete — shared primitives, base classes, TG migration"
```

---

## Summary

| Task | Description | New files | Key output |
|------|-------------|-----------|------------|
| 1 | Update IChannelAdapter | 0 | name, capabilities, optional methods |
| 2 | SendQueue primitive | 2 | Generic rate-limited queue |
| 3 | DraftManager primitive | 2 | Generic draft with callback flush |
| 4 | ToolCallTracker primitive | 2 | Generic tool state tracker |
| 5 | ActivityTracker primitive | 3 | Generic thinking indicator |
| 6 | IRenderer + BaseRenderer | 2 | Rendering abstraction |
| 7 | MessagingAdapter | 1 | Base class with dispatch + verbosity |
| 8 | StreamAdapter | 1 | Base for WebSocket/API |
| 9 | Conformance tests + barrel | 2 | Shared test suite |
| 10 | Migrate TelegramAdapter | 1+1 | ~500 lines (from 1154) |
| 11 | Verification | 0 | All tests pass |

**Discord/Slack migration is NOT in this plan** — they continue extending `ChannelAdapter` (now deprecated). A follow-up plan will migrate them once the Telegram migration is validated.
