# Activity Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live activity feedback to the Telegram adapter — ThinkingIndicator, edit-in-place PlanCard with progress bar, rolling UsageMessage — while fixing the existing plan-event bug and MessageDraft finalization bug.

**Architecture:** New `activity.ts` file with four classes (`ThinkingIndicator`, `PlanCard`, `UsageMessage`, `ActivityTracker`). The coordinator is instantiated per session, lazily, and wired into `adapter.ts`'s `sendMessage()` switch and `setupRoutes()`. `formatting.ts` is updated to remove cost from usage display and add a progress bar.

**Tech Stack:** TypeScript (strict, ESM), grammY Bot API, vitest for tests, TelegramSendQueue for rate-limited API calls.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/adapters/telegram/activity.ts` | **Create** | ThinkingIndicator, PlanCard, UsageMessage, ActivityTracker |
| `src/adapters/telegram/activity.test.ts` | **Create** | Unit tests for all four classes |
| `src/adapters/telegram/formatting.ts` | **Modify** | Update `formatUsage()` — remove cost, add progress bar |
| `src/adapters/telegram/formatting.test.ts` | **Create** | Tests for updated formatUsage + progress bar helper |
| `src/adapters/telegram/adapter.ts` | **Modify** | Wire ActivityTracker into sendMessage() and setupRoutes() |

---

## Task 1: Update `formatUsage()` in `formatting.ts`

**Files:**
- Modify: `src/adapters/telegram/formatting.ts:149-155`
- Create: `src/adapters/telegram/formatting.test.ts`

- [ ] **Step 1: Write failing tests for the new formatUsage**

Create `src/adapters/telegram/formatting.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatUsage } from './formatting.js'

describe('formatUsage', () => {
  it('shows progress bar with tokens and contextSize', () => {
    // 28k/200k = 14%, Math.round(0.14 * 10) = 1 filled block
    const result = formatUsage({ tokensUsed: 28000, contextSize: 200000 })
    expect(result).toBe('📊 28k / 200k tokens\n▓░░░░░░░░░ 14%')
  })

  it('shows warning emoji when usage >= 85%', () => {
    const result = formatUsage({ tokensUsed: 85000, contextSize: 100000 })
    expect(result).toBe('⚠️ 85k / 100k tokens\n▓▓▓▓▓▓▓▓▓░ 85%')
  })

  it('shows warning emoji at exactly 85%', () => {
    const result = formatUsage({ tokensUsed: 8500, contextSize: 10000 })
    expect(result).toContain('⚠️')
  })

  it('shows 100% with full bar', () => {
    const result = formatUsage({ tokensUsed: 100000, contextSize: 100000 })
    expect(result).toBe('⚠️ 100k / 100k tokens\n▓▓▓▓▓▓▓▓▓▓ 100%')
  })

  it('shows only tokens when no contextSize', () => {
    const result = formatUsage({ tokensUsed: 5000 })
    expect(result).toBe('📊 5k tokens')
  })

  it('shows placeholder when no data', () => {
    const result = formatUsage({})
    expect(result).toBe('📊 Usage data unavailable')
  })

  it('displays small numbers without k suffix', () => {
    const result = formatUsage({ tokensUsed: 500, contextSize: 1000 })
    expect(result).toBe('📊 500 / 1k tokens\n▓▓▓▓▓░░░░░ 50%')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/lucas/code/Viben && pnpm test -- --reporter=verbose formatting.test.ts
```

Expected: FAIL — current `formatUsage` doesn't match new format.

- [ ] **Step 3: Update `formatUsage()` in `formatting.ts`**

Replace lines 149–155 in `src/adapters/telegram/formatting.ts`:

```typescript
function formatTokens(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

function progressBar(ratio: number): string {
  const filled = Math.round(Math.min(ratio, 1) * 10)
  return '▓'.repeat(filled) + '░'.repeat(10 - filled)
}

export function formatUsage(usage: { tokensUsed?: number; contextSize?: number }): string {
  const { tokensUsed, contextSize } = usage
  if (tokensUsed == null) return '📊 Usage data unavailable'
  if (contextSize == null) return `📊 ${formatTokens(tokensUsed)} tokens`

  const ratio = tokensUsed / contextSize
  const pct = Math.round(ratio * 100)
  const bar = progressBar(ratio)
  const emoji = pct >= 85 ? '⚠️' : '📊'
  return `${emoji} ${formatTokens(tokensUsed)} / ${formatTokens(contextSize)} tokens\n${bar} ${pct}%`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/lucas/code/Viben && pnpm test -- --reporter=verbose formatting.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Build to verify TypeScript**

```bash
cd /Users/lucas/code/Viben && pnpm build
```

Expected: No errors. Note: adapter.ts still imports `formatUsage` with a `cost` field — it will warn at runtime but won't fail build since `cost` is just ignored now.

- [ ] **Step 6: Commit**

```bash
cd /Users/lucas/code/Viben && git add src/adapters/telegram/formatting.ts src/adapters/telegram/formatting.test.ts && git commit -m "feat(telegram): update formatUsage — remove cost, add token progress bar"
```

---

## Task 2: ThinkingIndicator and UsageMessage classes

**Files:**
- Create: `src/adapters/telegram/activity.ts` (initial)
- Create: `src/adapters/telegram/activity.test.ts` (initial)

These two classes are simpler (no debounce/timer logic), so implement them first.

- [ ] **Step 1: Write failing tests for ThinkingIndicator and UsageMessage**

Create `src/adapters/telegram/activity.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ThinkingIndicator, UsageMessage } from './activity.js'
import type { TelegramSendQueue } from './send-queue.js'

// Minimal mock for TelegramSendQueue: runs the fn immediately, returns result
function makeMockQueue(): TelegramSendQueue {
  return {
    enqueue: vi.fn(async (fn: () => Promise<unknown>) => fn()),
    onRateLimited: vi.fn(),
  } as unknown as TelegramSendQueue
}

// Minimal mock for bot.api
function makeMockApi() {
  return {
    sendMessage: vi.fn().mockResolvedValue({ message_id: 42 }),
    deleteMessage: vi.fn().mockResolvedValue(true),
    editMessageText: vi.fn().mockResolvedValue(true),
  }
}

describe('ThinkingIndicator', () => {
  let api: ReturnType<typeof makeMockApi>
  let queue: TelegramSendQueue
  let indicator: ThinkingIndicator

  beforeEach(() => {
    api = makeMockApi()
    queue = makeMockQueue()
    indicator = new ThinkingIndicator(api as never, 100, 200, queue)
  })

  it('sends thinking message on first show()', async () => {
    await indicator.show()
    expect(api.sendMessage).toHaveBeenCalledOnce()
    expect(api.sendMessage).toHaveBeenCalledWith(
      100,
      '💭 <i>Thinking...</i>',
      expect.objectContaining({ message_thread_id: 200 }),
    )
  })

  it('does not send again on subsequent show() calls', async () => {
    await indicator.show()
    await indicator.show()
    await indicator.show()
    expect(api.sendMessage).toHaveBeenCalledOnce()
  })

  it('dismiss() is no-op when not shown', async () => {
    await indicator.dismiss()
    expect(api.deleteMessage).not.toHaveBeenCalled()
  })

  it('dismiss() deletes the message after show()', async () => {
    await indicator.show()
    await indicator.dismiss()
    expect(api.deleteMessage).toHaveBeenCalledWith(100, 42)
  })

  it('dismiss() clears msgId even if deleteMessage fails', async () => {
    api.deleteMessage.mockRejectedValue(new Error('not found'))
    await indicator.show()
    await indicator.dismiss()
    // Should not throw; subsequent dismiss() is a no-op
    await indicator.dismiss()
    expect(api.deleteMessage).toHaveBeenCalledOnce()
  })

  it('show() works again after dismiss()', async () => {
    await indicator.show()
    await indicator.dismiss()
    await indicator.show()
    expect(api.sendMessage).toHaveBeenCalledTimes(2)
  })
})

describe('UsageMessage', () => {
  let api: ReturnType<typeof makeMockApi>
  let queue: TelegramSendQueue
  let usage: UsageMessage

  beforeEach(() => {
    api = makeMockApi()
    queue = makeMockQueue()
    usage = new UsageMessage(api as never, 100, 200, queue)
  })

  it('sends new message on first send()', async () => {
    await usage.send({ tokensUsed: 10000, contextSize: 100000 })
    expect(api.sendMessage).toHaveBeenCalledOnce()
  })

  it('edits existing message on second send()', async () => {
    await usage.send({ tokensUsed: 10000, contextSize: 100000 })
    await usage.send({ tokensUsed: 20000, contextSize: 100000 })
    expect(api.sendMessage).toHaveBeenCalledOnce()
    expect(api.editMessageText).toHaveBeenCalledOnce()
    expect(api.editMessageText).toHaveBeenCalledWith(100, 42, expect.any(String), expect.any(Object))
  })

  it('delete() is no-op when nothing was sent', async () => {
    await usage.delete()
    expect(api.deleteMessage).not.toHaveBeenCalled()
  })

  it('delete() removes the message and clears msgId', async () => {
    await usage.send({ tokensUsed: 5000, contextSize: 50000 })
    await usage.delete()
    expect(api.deleteMessage).toHaveBeenCalledWith(100, 42)
  })

  it('delete() clears msgId even if deleteMessage fails', async () => {
    api.deleteMessage.mockRejectedValue(new Error('gone'))
    await usage.send({ tokensUsed: 5000, contextSize: 50000 })
    await usage.delete()
    // Second delete should be a no-op
    await usage.delete()
    expect(api.deleteMessage).toHaveBeenCalledOnce()
  })

  it('send() works after delete()', async () => {
    await usage.send({ tokensUsed: 5000, contextSize: 50000 })
    await usage.delete()
    await usage.send({ tokensUsed: 8000, contextSize: 50000 })
    expect(api.sendMessage).toHaveBeenCalledTimes(2)
    expect(api.editMessageText).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/lucas/code/Viben && pnpm test -- --reporter=verbose activity.test.ts
```

Expected: FAIL — `activity.ts` doesn't exist yet.

- [ ] **Step 3: Create `activity.ts` with ThinkingIndicator and UsageMessage**

Create `src/adapters/telegram/activity.ts`:

```typescript
import type { Bot } from 'grammy'
import { createChildLogger } from '../../core/log.js'
import { formatUsage } from './formatting.js'
import type { TelegramSendQueue } from './send-queue.js'
import type { PlanEntry } from '../../core/types.js'

const log = createChildLogger({ module: 'telegram:activity' })

// ─── ThinkingIndicator ────────────────────────────────────────────────────────

export class ThinkingIndicator {
  private msgId?: number

  constructor(
    private api: Bot['api'],
    private chatId: number,
    private threadId: number,
    private sendQueue: TelegramSendQueue,
  ) {}

  async show(): Promise<void> {
    if (this.msgId) return
    try {
      const result = await this.sendQueue.enqueue(() =>
        this.api.sendMessage(this.chatId, '💭 <i>Thinking...</i>', {
          message_thread_id: this.threadId,
          parse_mode: 'HTML',
          disable_notification: true,
        }),
      )
      if (result) this.msgId = result.message_id
    } catch (err) {
      log.warn({ err }, 'ThinkingIndicator.show() failed')
    }
  }

  async dismiss(): Promise<void> {
    if (!this.msgId) return
    const id = this.msgId
    this.msgId = undefined
    try {
      await this.sendQueue.enqueue(() => this.api.deleteMessage(this.chatId, id))
    } catch (err) {
      log.warn({ err }, 'ThinkingIndicator.dismiss() failed')
    }
  }
}

// ─── UsageMessage ─────────────────────────────────────────────────────────────

export class UsageMessage {
  private msgId?: number

  constructor(
    private api: Bot['api'],
    private chatId: number,
    private threadId: number,
    private sendQueue: TelegramSendQueue,
  ) {}

  async send(usage: { tokensUsed?: number; contextSize?: number }): Promise<void> {
    const text = formatUsage(usage)
    try {
      if (this.msgId) {
        await this.sendQueue.enqueue(() =>
          this.api.editMessageText(this.chatId, this.msgId!, text, {
            parse_mode: 'HTML',
          }),
        )
      } else {
        const result = await this.sendQueue.enqueue(() =>
          this.api.sendMessage(this.chatId, text, {
            message_thread_id: this.threadId,
            parse_mode: 'HTML',
            disable_notification: true,
          }),
        )
        if (result) this.msgId = result.message_id
      }
    } catch (err) {
      log.warn({ err }, 'UsageMessage.send() failed')
    }
  }

  async delete(): Promise<void> {
    if (!this.msgId) return
    const id = this.msgId
    this.msgId = undefined
    try {
      await this.sendQueue.enqueue(() => this.api.deleteMessage(this.chatId, id))
    } catch (err) {
      log.warn({ err }, 'UsageMessage.delete() failed')
    }
  }
}

// ─── PlanCard placeholder (implemented in Task 3) ────────────────────────────

export class PlanCard {
  constructor(
    _api: Bot['api'],
    _chatId: number,
    _threadId: number,
    _sendQueue: TelegramSendQueue,
  ) {}
  update(_entries: PlanEntry[]): void {}
  async finalize(): Promise<void> {}
  destroy(): void {}
}

// ─── ActivityTracker placeholder (implemented in Task 4) ─────────────────────

export class ActivityTracker {
  constructor(
    _api: Bot['api'],
    _chatId: number,
    _threadId: number,
    _sendQueue: TelegramSendQueue,
  ) {}
  async onNewPrompt(): Promise<void> {}
  async onThought(): Promise<void> {}
  async onPlan(_entries: PlanEntry[]): Promise<void> {}
  async onToolCall(): Promise<void> {}
  async onTextStart(): Promise<void> {}
  async sendUsage(_data: { tokensUsed?: number; contextSize?: number }): Promise<void> {}
  async onComplete(): Promise<void> {}
  destroy(): void {}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/lucas/code/Viben && pnpm test -- --reporter=verbose activity.test.ts
```

Expected: All ThinkingIndicator and UsageMessage tests PASS.

- [ ] **Step 5: Build**

```bash
cd /Users/lucas/code/Viben && pnpm build
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/lucas/code/Viben && git add src/adapters/telegram/activity.ts src/adapters/telegram/activity.test.ts && git commit -m "feat(telegram): add ThinkingIndicator and UsageMessage classes"
```

---

## Task 3: PlanCard class

**Files:**
- Modify: `src/adapters/telegram/activity.ts` — replace PlanCard placeholder
- Modify: `src/adapters/telegram/activity.test.ts` — add PlanCard tests

- [ ] **Step 1: Add failing PlanCard tests**

Append to `src/adapters/telegram/activity.test.ts`:

```typescript
describe('PlanCard', () => {
  let api: ReturnType<typeof makeMockApi>
  let queue: TelegramSendQueue
  let card: PlanCard

  const entries: import('../../core/types.js').PlanEntry[] = [
    { content: 'Research', status: 'completed', priority: 'high' },
    { content: 'Write', status: 'in_progress', priority: 'high' },
    { content: 'Review', status: 'pending', priority: 'low' },
  ]

  beforeEach(() => {
    api = makeMockApi()
    queue = makeMockQueue()
    card = new PlanCard(api as never, 100, 200, queue)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    card.destroy()
  })

  it('sends message on first flush after 3.5s', async () => {
    await card.update(entries)
    expect(api.sendMessage).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(3500)
    expect(api.sendMessage).toHaveBeenCalledOnce()
    const text: string = api.sendMessage.mock.calls[0][1]
    expect(text).toContain('📋')
    expect(text).toContain('✅')
    expect(text).toContain('🔄')
    expect(text).toContain('⬜')
  })

  it('coalesces multiple updates — only sends latest', async () => {
    await card.update([{ content: 'Step 1', status: 'pending', priority: 'high' }])
    await card.update(entries)
    await vi.advanceTimersByTimeAsync(3500)
    expect(api.sendMessage).toHaveBeenCalledOnce()
    const text: string = api.sendMessage.mock.calls[0][1]
    expect(text).toContain('Research')
  })

  it('edits existing message on second flush', async () => {
    await card.update(entries)
    await vi.advanceTimersByTimeAsync(3500)
    const updatedEntries = entries.map(e => ({ ...e, status: 'completed' as const }))
    await card.update(updatedEntries)
    await vi.advanceTimersByTimeAsync(3500)
    expect(api.sendMessage).toHaveBeenCalledOnce()
    expect(api.editMessageText).toHaveBeenCalledOnce()
  })

  it('finalize() flushes immediately without waiting for timer', async () => {
    await card.update(entries)
    expect(api.sendMessage).not.toHaveBeenCalled()
    await card.finalize()
    expect(api.sendMessage).toHaveBeenCalledOnce()
  })

  it('finalize() after timer-flush edits (does not double-send)', async () => {
    await card.update(entries)
    await vi.advanceTimersByTimeAsync(3500)
    expect(api.sendMessage).toHaveBeenCalledOnce()
    await card.finalize()
    // finalize awaits flushPromise, then does one final edit
    expect(api.editMessageText).toHaveBeenCalledOnce()
  })

  it('finalize() is no-op when no updates were made', async () => {
    await card.finalize()
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it('shows correct progress bar format', async () => {
    await card.finalize() // no-op
    const singleDone: import('../../core/types.js').PlanEntry[] = [
      { content: 'Task A', status: 'completed', priority: 'high' },
      { content: 'Task B', status: 'completed', priority: 'high' },
      { content: 'Task C', status: 'pending', priority: 'low' },
    ]
    const card2 = new PlanCard(api as never, 100, 200, queue)
    await card2.update(singleDone)
    await card2.finalize()
    const text: string = api.sendMessage.mock.calls[0][1]
    // 2/3 ≈ 67%, Math.round(0.667 * 10) = 7 filled
    expect(text).toContain('▓▓▓▓▓▓▓░░░')
    expect(text).toContain('67%')
    expect(text).toContain('2/3')
    card2.destroy()
  })

  it('destroy() cancels pending timer', async () => {
    await card.update(entries)
    card.destroy()
    await vi.advanceTimersByTimeAsync(3500)
    expect(api.sendMessage).not.toHaveBeenCalled()
  })
})
```

Also add the import for `PlanCard` at the top of the test file:

```typescript
import { ThinkingIndicator, UsageMessage, PlanCard } from './activity.js'
```

(Replace the existing import line that only had ThinkingIndicator and UsageMessage.)

- [ ] **Step 2: Run tests to verify PlanCard tests fail**

```bash
cd /Users/lucas/code/Viben && pnpm test -- --reporter=verbose activity.test.ts
```

Expected: PlanCard tests FAIL (placeholder does nothing).

- [ ] **Step 3: Implement PlanCard — replace the placeholder in `activity.ts`**

Add a `formatPlanCard` helper and replace the PlanCard placeholder:

```typescript
// Add this helper function before the PlanCard class:
function formatPlanCard(entries: PlanEntry[]): string {
  const statusIcon: Record<string, string> = {
    completed: '✅',
    in_progress: '🔄',
    pending: '⬜',
    failed: '❌',
  }
  const total = entries.length
  const done = entries.filter(e => e.status === 'completed').length
  const ratio = total > 0 ? done / total : 0
  const filled = Math.round(ratio * 10)
  const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled)
  const pct = Math.round(ratio * 100)
  const header = `📋 <b>Plan</b>\n${bar} ${pct}% · ${done}/${total}`
  const lines = entries.map((e, i) => {
    const icon = statusIcon[e.status] ?? '⬜'
    return `${icon} ${i + 1}. ${e.content}`
  })
  return [header, ...lines].join('\n')
}

export class PlanCard {
  private msgId?: number
  private flushPromise: Promise<void> = Promise.resolve()
  private latestEntries?: PlanEntry[]
  private flushTimer?: ReturnType<typeof setTimeout>

  constructor(
    private api: Bot['api'],
    private chatId: number,
    private threadId: number,
    private sendQueue: TelegramSendQueue,
  ) {}

  update(entries: PlanEntry[]): void {
    this.latestEntries = entries
    // Reset debounce timer
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      this.flushPromise = this.flushPromise
        .then(() => this._flush())
        .catch(() => {})
    }, 3500)
  }

  async finalize(): Promise<void> {
    if (!this.latestEntries) return
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }
    // Wait for any in-flight flush, then do final flush
    await this.flushPromise
    this.flushPromise = this.flushPromise
      .then(() => this._flush())
      .catch(() => {})
    await this.flushPromise
  }

  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }
  }

  private async _flush(): Promise<void> {
    if (!this.latestEntries) return
    const text = formatPlanCard(this.latestEntries)
    try {
      if (this.msgId) {
        await this.sendQueue.enqueue(() =>
          this.api.editMessageText(this.chatId, this.msgId!, text, {
            parse_mode: 'HTML',
          }),
        )
      } else {
        const result = await this.sendQueue.enqueue(() =>
          this.api.sendMessage(this.chatId, text, {
            message_thread_id: this.threadId,
            parse_mode: 'HTML',
            disable_notification: true,
          }),
        )
        if (result) this.msgId = result.message_id
      }
    } catch (err) {
      log.warn({ err }, 'PlanCard flush failed')
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/lucas/code/Viben && pnpm test -- --reporter=verbose activity.test.ts
```

Expected: All ThinkingIndicator, UsageMessage, and PlanCard tests PASS.

- [ ] **Step 5: Build**

```bash
cd /Users/lucas/code/Viben && pnpm build
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/lucas/code/Viben && git add src/adapters/telegram/activity.ts src/adapters/telegram/activity.test.ts && git commit -m "feat(telegram): implement PlanCard with debounce and progress bar"
```

---

## Task 4: ActivityTracker coordinator

**Files:**
- Modify: `src/adapters/telegram/activity.ts` — replace ActivityTracker placeholder
- Modify: `src/adapters/telegram/activity.test.ts` — add ActivityTracker tests

- [ ] **Step 1: Add failing ActivityTracker tests**

Append to `src/adapters/telegram/activity.test.ts`:

```typescript
describe('ActivityTracker', () => {
  let api: ReturnType<typeof makeMockApi>
  let queue: TelegramSendQueue
  let tracker: ActivityTracker

  beforeEach(() => {
    api = makeMockApi()
    queue = makeMockQueue()
    tracker = new ActivityTracker(api as never, 100, 200, queue)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    tracker.destroy()
  })

  it('onThought() shows thinking indicator', async () => {
    await tracker.onThought()
    expect(api.sendMessage).toHaveBeenCalledWith(
      100,
      '💭 <i>Thinking...</i>',
      expect.anything(),
    )
  })

  it('onThought() called multiple times only sends one message', async () => {
    await tracker.onThought()
    await tracker.onThought()
    await tracker.onThought()
    expect(api.sendMessage).toHaveBeenCalledOnce()
  })

  it('onToolCall() dismisses thinking indicator', async () => {
    await tracker.onThought()
    await tracker.onToolCall()
    expect(api.deleteMessage).toHaveBeenCalledOnce()
  })

  it('onTextStart() dismisses thinking indicator', async () => {
    await tracker.onThought()
    await tracker.onTextStart()
    expect(api.deleteMessage).toHaveBeenCalledOnce()
  })

  it('firstEvent guard: deletes usage message on first event', async () => {
    // Simulate a previous usage message existing
    await tracker.sendUsage({ tokensUsed: 1000, contextSize: 10000 })
    expect(api.sendMessage).toHaveBeenCalledOnce() // usage sent

    // Simulate new prompt cycle
    await tracker.onNewPrompt()
    expect(api.deleteMessage).not.toHaveBeenCalled() // not deleted yet

    // First event of new cycle triggers deletion
    await tracker.onThought()
    expect(api.deleteMessage).toHaveBeenCalledOnce() // usage deleted
  })

  it('firstEvent guard only runs once per prompt cycle', async () => {
    await tracker.sendUsage({ tokensUsed: 1000, contextSize: 10000 })
    await tracker.onNewPrompt()
    await tracker.onThought()
    await tracker.onThought()
    await tracker.onToolCall()
    // deleteMessage called once for usage, once for thinking indicator
    expect(api.deleteMessage).toHaveBeenCalledTimes(2)
  })

  it('onNewPrompt() resets hasPlanCard', async () => {
    // Trigger a plan → hasPlanCard = true
    const entries: import('../../core/types.js').PlanEntry[] = [
      { content: 'Task', status: 'pending', priority: 'high' },
    ]
    await tracker.onPlan(entries)
    await vi.advanceTimersByTimeAsync(3500)

    // Reset for new prompt
    await tracker.onNewPrompt()

    // onComplete() should send ✅ Done (not try to finalize plan)
    await tracker.onComplete()
    const calls = (api.sendMessage as ReturnType<typeof vi.fn>).mock.calls
    const doneCall = calls.find((c: unknown[]) => String(c[1]).includes('Done'))
    expect(doneCall).toBeDefined()
  })

  it('onComplete() sends Done when no plan', async () => {
    await tracker.onComplete()
    expect(api.sendMessage).toHaveBeenCalledWith(
      100,
      '✅ <b>Done</b>',
      expect.anything(),
    )
  })

  it('onComplete() finalizes plan when hasPlanCard is true', async () => {
    const entries: import('../../core/types.js').PlanEntry[] = [
      { content: 'Task', status: 'completed', priority: 'high' },
    ]
    await tracker.onPlan(entries)
    // Timer not fired yet — finalize() should handle it
    await tracker.onComplete()
    // Should have sent the plan message (via finalize)
    const calls = (api.sendMessage as ReturnType<typeof vi.fn>).mock.calls
    const planCall = calls.find((c: unknown[]) => String(c[1]).includes('📋'))
    expect(planCall).toBeDefined()
    // Should NOT send Done
    const doneCall = calls.find((c: unknown[]) => String(c[1]).includes('Done'))
    expect(doneCall).toBeUndefined()
  })

  it('onNewPrompt() defensively dismisses stale ThinkingIndicator', async () => {
    await tracker.onThought()
    expect(api.sendMessage).toHaveBeenCalledOnce()
    await tracker.onNewPrompt()
    expect(api.deleteMessage).toHaveBeenCalledOnce()
  })
})
```

Also update the import at the top of the test file to include `ActivityTracker`:

```typescript
import { ThinkingIndicator, UsageMessage, PlanCard, ActivityTracker } from './activity.js'
```

- [ ] **Step 2: Run tests to verify ActivityTracker tests fail**

```bash
cd /Users/lucas/code/Viben && pnpm test -- --reporter=verbose activity.test.ts
```

Expected: ActivityTracker tests FAIL (placeholder does nothing).

- [ ] **Step 3: Implement ActivityTracker — replace placeholder in `activity.ts`**

```typescript
export class ActivityTracker {
  private isFirstEvent = true
  private hasPlanCard = false
  private thinking: ThinkingIndicator
  private planCard: PlanCard
  private usage: UsageMessage

  constructor(
    private api: Bot['api'],
    private chatId: number,
    private threadId: number,
    private sendQueue: TelegramSendQueue,
  ) {
    this.thinking = new ThinkingIndicator(api, chatId, threadId, sendQueue)
    this.planCard = new PlanCard(api, chatId, threadId, sendQueue)
    this.usage = new UsageMessage(api, chatId, threadId, sendQueue)
  }

  async onNewPrompt(): Promise<void> {
    this.isFirstEvent = true
    this.hasPlanCard = false
    await this.thinking.dismiss()
  }

  async onThought(): Promise<void> {
    await this._firstEventGuard()
    await this.thinking.show()
  }

  async onPlan(entries: PlanEntry[]): Promise<void> {
    await this._firstEventGuard()
    await this.thinking.dismiss()
    this.hasPlanCard = true
    this.planCard.update(entries)
  }

  async onToolCall(): Promise<void> {
    await this._firstEventGuard()
    await this.thinking.dismiss()
  }

  async onTextStart(): Promise<void> {
    await this._firstEventGuard()
    await this.thinking.dismiss()
  }

  async sendUsage(data: { tokensUsed?: number; contextSize?: number }): Promise<void> {
    await this.usage.send(data)
  }

  async onComplete(): Promise<void> {
    if (this.hasPlanCard) {
      await this.planCard.finalize()
    } else {
      try {
        await this.sendQueue.enqueue(() =>
          this.api.sendMessage(this.chatId, '✅ <b>Done</b>', {
            message_thread_id: this.threadId,
            parse_mode: 'HTML',
            disable_notification: true,
          }),
        )
      } catch (err) {
        log.warn({ err }, 'ActivityTracker.onComplete() Done send failed')
      }
    }
  }

  destroy(): void {
    this.planCard.destroy()
  }

  private async _firstEventGuard(): Promise<void> {
    if (!this.isFirstEvent) return
    this.isFirstEvent = false
    await this.usage.delete()
  }
}
```

- [ ] **Step 4: Run all tests**

```bash
cd /Users/lucas/code/Viben && pnpm test -- --reporter=verbose activity.test.ts
```

Expected: ALL tests PASS (ThinkingIndicator + UsageMessage + PlanCard + ActivityTracker).

- [ ] **Step 5: Build**

```bash
cd /Users/lucas/code/Viben && pnpm build
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/lucas/code/Viben && git add src/adapters/telegram/activity.ts src/adapters/telegram/activity.test.ts && git commit -m "feat(telegram): implement ActivityTracker coordinator"
```

---

## Task 5: Wire ActivityTracker into `adapter.ts`

**Files:**
- Modify: `src/adapters/telegram/adapter.ts`

No unit tests for this task — the adapter wires Telegram Bot API calls that require integration testing. Verify via manual testing or bot startup.

- [ ] **Step 1: Add import for ActivityTracker**

At the top of `src/adapters/telegram/adapter.ts`, add:

```typescript
import { ActivityTracker } from './activity.js'
```

Remove `formatUsage` from the existing formatting import (it's now used only inside `ActivityTracker`):

```typescript
// Change:
import {
  escapeHtml,
  formatToolCall,
  formatToolUpdate,
  formatPlan,
  formatUsage,
} from './formatting.js'

// To:
import {
  escapeHtml,
  formatToolCall,
  formatToolUpdate,
  formatPlan,
} from './formatting.js'
```

- [ ] **Step 2: Add `sessionTrackers` field and `getOrCreateTracker()` helper**

In the `TelegramAdapter` class, after the existing `sendQueue` field (line ~100):

```typescript
private sessionTrackers: Map<string, ActivityTracker> = new Map()

private getOrCreateTracker(sessionId: string, threadId: number): ActivityTracker {
  let tracker = this.sessionTrackers.get(sessionId)
  if (!tracker) {
    tracker = new ActivityTracker(
      this.bot.api,
      this.telegramConfig.chatId,
      threadId,
      this.sendQueue,
    )
    this.sessionTrackers.set(sessionId, tracker)
  }
  return tracker
}
```

- [ ] **Step 3: Update `setupRoutes()` to call `onNewPrompt()` after `finalizeDraft()`**

In `setupRoutes()`, find the session topic handler (around line 326). After the `finalizeDraft(sessionId)` call and before the `handleMessage` call, add:

```typescript
// Existing:
const sessionId = (this.core as VibenCore).sessionManager.getSessionByThread("telegram", String(threadId))?.id;
if (sessionId) await this.finalizeDraft(sessionId);
// ADD after finalizeDraft:
if (sessionId) {
  const tracker = this.sessionTrackers.get(sessionId)
  if (tracker) await tracker.onNewPrompt()
}
ctx.replyWithChatAction("typing").catch(() => {});
```

- [ ] **Step 4: Update `sendMessage()` switch — `thought` case**

Replace:
```typescript
case "thought": {
  // Skip thought/thinking content — it's internal agent reasoning
  // Users don't need to see it
  break;
}
```

With:
```typescript
case "thought": {
  const tracker = this.getOrCreateTracker(sessionId, threadId)
  await tracker.onThought()
  break;
}
```

- [ ] **Step 5: Update `sendMessage()` switch — `plan` case**

Replace the entire `plan` case:
```typescript
case "plan": {
  await this.finalizeDraft(sessionId);
  await this.sendQueue.enqueue(() =>
    this.bot.api.sendMessage(
      this.telegramConfig.chatId,
      formatPlan(
        content.metadata as never as {
          entries: Array<{ content: string; status: string }>;
        },
      ),
      {
        message_thread_id: threadId,
        parse_mode: "HTML",
        disable_notification: true,
      },
    ),
  );
  break;
}
```

With:
```typescript
case "plan": {
  const meta = content.metadata as never as {
    entries: Array<{ content: string; status: string; priority: string }>
  }
  const tracker = this.getOrCreateTracker(sessionId, threadId)
  await tracker.onPlan(
    meta.entries.map(e => ({
      content: e.content,
      status: e.status as 'pending' | 'in_progress' | 'completed',
      priority: (e.priority ?? 'medium') as 'high' | 'medium' | 'low',
    })),
  )
  break;
}
```

Note: `formatPlan` import can now be removed if unused elsewhere. Check with `grep -n 'formatPlan' src/adapters/telegram/adapter.ts` — if the only usage was the plan case, remove it from the import.

- [ ] **Step 6: Update `sendMessage()` switch — `tool_call` case**

Add `tracker.onToolCall()` call at the start of the tool_call case, before the existing `finalizeDraft` call:

```typescript
case "tool_call": {
  const tracker = this.getOrCreateTracker(sessionId, threadId)
  await tracker.onToolCall()
  await this.finalizeDraft(sessionId);
  // ... rest of existing tool_call logic unchanged ...
```

- [ ] **Step 7: Update `sendMessage()` switch — `text` case**

Add `tracker.onTextStart()` when creating a new draft:

```typescript
case "text": {
  let draft = this.sessionDrafts.get(sessionId);
  if (!draft) {
    const tracker = this.getOrCreateTracker(sessionId, threadId)
    await tracker.onTextStart()
    draft = new MessageDraft(
      this.bot,
      this.telegramConfig.chatId,
      threadId,
      this.sendQueue,
      sessionId,
    );
    this.sessionDrafts.set(sessionId, draft);
  }
  draft.append(content.text);
  // ... rest unchanged ...
```

- [ ] **Step 8: Update `sendMessage()` switch — `usage` case**

Replace the entire `usage` case:
```typescript
case "usage": {
  await this.finalizeDraft(sessionId);
  await this.sendQueue.enqueue(() =>
    this.bot.api.sendMessage(...)
  );
  break;
}
```

With:
```typescript
case "usage": {
  const meta = content.metadata as never as {
    tokensUsed?: number;
    contextSize?: number;
  }
  const tracker = this.getOrCreateTracker(sessionId, threadId)
  await tracker.sendUsage(meta)
  break;
}
```

- [ ] **Step 9: Update `sendMessage()` switch — `session_end` case**

> **Note on `finalizeDraft` in session_end:** The spec's "definitive rule" says `finalizeDraft` is only in `setupRoutes` and `tool_call`. However, keeping `finalizeDraft` in `session_end` is an intentional belt-and-suspenders safety net: if the session ends without a `tool_call` (text-only or direct `session_end`), the draft is still guaranteed to be flushed. This is the correct behavior and the call stays.

Replace the `sendMessage("✅ Done")` call and add tracker cleanup:

```typescript
case "session_end": {
  await this.finalizeDraft(sessionId);
  this.sessionDrafts.delete(sessionId);
  this.toolCallMessages.delete(sessionId);
  await this.cleanupSkillCommands(sessionId);
  // Replace the sendMessage("✅ Done") with tracker.onComplete():
  const tracker = this.sessionTrackers.get(sessionId)
  if (tracker) {
    await tracker.onComplete()
    tracker.destroy()
    this.sessionTrackers.delete(sessionId)
  } else {
    // Fallback: no tracker means no plan card, send Done directly
    await this.sendQueue.enqueue(() =>
      this.bot.api.sendMessage(
        this.telegramConfig.chatId,
        `✅ <b>Done</b>`,
        {
          message_thread_id: threadId,
          parse_mode: "HTML",
          disable_notification: true,
        },
      ),
    )
  }
  break;
}
```

- [ ] **Step 10: Update `sendMessage()` switch — `error` case**

Add tracker cleanup at the start of the error case:

```typescript
case "error": {
  await this.finalizeDraft(sessionId);
  const tracker = this.sessionTrackers.get(sessionId)
  if (tracker) {
    tracker.destroy()
    this.sessionTrackers.delete(sessionId)
  }
  await this.sendQueue.enqueue(() =>
    this.bot.api.sendMessage(
      this.telegramConfig.chatId,
      `❌ <b>Error:</b> ${escapeHtml(content.text)}`,
      // ... unchanged ...
    ),
  );
  break;
}
```

- [ ] **Step 11: Remove unused `formatPlan` and `formatUsage` imports**

```bash
grep -n 'formatPlan\|formatUsage' /Users/lucas/code/Viben/src/adapters/telegram/adapter.ts
```

Remove any that are no longer used in the file.

- [ ] **Step 12: Build**

```bash
cd /Users/lucas/code/Viben && pnpm build
```

Expected: No TypeScript errors. Fix any type errors before continuing.

- [ ] **Step 13: Run full test suite**

```bash
cd /Users/lucas/code/Viben && pnpm test
```

Expected: All tests PASS.

- [ ] **Step 14: Commit**

```bash
cd /Users/lucas/code/Viben && git add src/adapters/telegram/adapter.ts && git commit -m "feat(telegram): wire ActivityTracker into adapter — fix plan bug, add ThinkingIndicator and rolling usage"
```

---

## Manual Verification Checklist

After all tasks are committed, verify the following behaviors with a running bot:

- [ ] Send a message that triggers agent thinking → `💭 Thinking...` appears, disappears when tool starts
- [ ] Send a message that produces a plan → plan message appears once, updates in-place as steps complete
- [ ] Send two text-only messages → second response is a separate message (not appended to first)
- [ ] Check usage message → no cost shown, shows `28k / 200k tokens` style with progress bar
- [ ] Usage message from previous prompt is deleted when new prompt starts
- [ ] Session end with plan → plan shows as final state, no `✅ Done`
- [ ] Session end without plan → `✅ Done` appears
