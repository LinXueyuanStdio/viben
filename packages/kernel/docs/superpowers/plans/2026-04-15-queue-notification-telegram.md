# Queue Notification for Telegram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user sends a message that gets queued (agent busy), show an inline notification in Telegram with queue position and action buttons: Process Now (skip queue), Clear Queue, Flush All.

**Architecture:** PromptQueue gains `prioritize(turnId)` to promote a specific item to front. Session gains `prioritizePrompt(turnId)`. Telegram adapter subscribes to `MESSAGE_QUEUED` / `MESSAGE_PROCESSING` on EventBus — when a message is queued behind others, sends a notification message with inline keyboard. Button callbacks dispatch to the corresponding Session methods. Notifications are auto-dismissed when the message starts processing.

**Tech Stack:** TypeScript, grammY (InlineKeyboard), Vitest

---

### Task 1: Add `prioritize(turnId)` to PromptQueue

**Files:**
- Modify: `src/core/sessions/prompt-queue.ts`
- Test: `src/core/sessions/__tests__/prompt-queue.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/core/sessions/__tests__/prompt-queue.test.ts`:

```typescript
it('prioritize promotes target item and discards others', async () => {
  let resolveFirst!: () => void
  const firstPromise = new Promise<void>((r) => { resolveFirst = r })
  const calls: string[] = []

  const processor = vi.fn().mockImplementation(async (text: string, _userPrompt: string) => {
    calls.push(text)
    if (text === 'first') await firstPromise
  })

  const queue = new PromptQueue(processor)

  queue.enqueue('first', 'first')
  queue.enqueue('second', 'second', undefined, undefined, 'turn-2')
  queue.enqueue('third', 'third', undefined, undefined, 'turn-3')
  queue.enqueue('fourth', 'fourth', undefined, undefined, 'turn-4')

  expect(queue.pending).toBe(3)

  // Prioritize turn-4 — should discard turn-2 and turn-3, keep only turn-4
  const found = queue.prioritize('turn-4')
  expect(found).toBe(true)
  expect(queue.pending).toBe(1)

  // Resolve first (simulates agent responding to cancel)
  resolveFirst()
  await new Promise(r => setTimeout(r, 10))

  // drainNext should pick up turn-4
  // Wait for processing to complete
  await vi.waitFor(() => expect(queue.isProcessing).toBe(false))

  expect(calls).toEqual(['first', 'fourth'])
})

it('prioritize returns false if turnId not found', () => {
  const processor = vi.fn().mockResolvedValue(undefined)
  const queue = new PromptQueue(processor)
  expect(queue.prioritize('nonexistent')).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/core/sessions/__tests__/prompt-queue.test.ts -t "prioritize"`
Expected: FAIL — `queue.prioritize is not a function`

- [ ] **Step 3: Implement `prioritize()`**

Add to `src/core/sessions/prompt-queue.ts`, after the `clearPending()` method:

```typescript
/**
 * Promote a specific queued item to the front and discard all others.
 *
 * Finds the item with the matching turnId, removes every other pending item
 * (resolving their promises), and leaves only the target in the queue.
 * Does NOT abort the in-flight prompt — caller handles that separately.
 *
 * @returns true if the item was found and promoted, false if not in queue
 */
prioritize(turnId: string): boolean {
  const idx = this.queue.findIndex(item => item.turnId === turnId)
  if (idx === -1) return false
  const target = this.queue[idx]
  for (let i = 0; i < this.queue.length; i++) {
    if (i !== idx) this.queue[i].resolve()
  }
  this.queue = [target]
  return true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/core/sessions/__tests__/prompt-queue.test.ts -t "prioritize"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/sessions/prompt-queue.ts src/core/sessions/__tests__/prompt-queue.test.ts && git commit -m "feat(queue): add prioritize(turnId) to promote queued item to front"
```

---

### Task 2: Add `prioritizePrompt(turnId)` to Session

**Files:**
- Modify: `src/core/sessions/session.ts`

- [ ] **Step 1: Add method after `flushAll()`**

Add to `src/core/sessions/session.ts`, right after the `flushAll()` method:

```typescript
/**
 * Skip the queue: cancel the in-flight prompt, discard all other queued
 * items, and promote the specified turn to process next.
 *
 * Used when the user clicks "Process Now" on a queued message — they want
 * THIS message handled immediately, discarding everything else in the pipeline.
 *
 * @returns true if the turn was found and promoted, false if already processed
 */
async prioritizePrompt(turnId: string): Promise<boolean> {
  // Rearrange queue: keep only the target item
  const found = this.queue.prioritize(turnId);
  if (!found) return false;

  // Cancel agent so the current processPrompt resolves and drainNext
  // picks up the promoted item. Timeout fallback if agent is unresponsive.
  await Promise.race([
    this.agentInstance.cancel().catch(() => {}),
    new Promise<void>((r) => setTimeout(r, 5000)),
  ]);

  // If the process didn't settle naturally (timeout), force abort
  if (this.queue.isProcessing) {
    this.queue.abortCurrent();
  }

  this.log.info({ turnId }, "Prompt prioritized");
  return true;
}
```

- [ ] **Step 2: Build to verify**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | tail -10`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/sessions/session.ts && git commit -m "feat(session): add prioritizePrompt(turnId) to skip queue for a specific message"
```

---

### Task 3: Telegram queue notification — listen to EventBus and send notification

**Files:**
- Modify: `src/plugins/telegram/adapter.ts`

This task adds the EventBus listener and notification sending. The callback handlers come in Task 4.

- [ ] **Step 1: Add notification tracking map**

In the `TelegramAdapter` class, add a private field near the other maps (around the `_dispatchQueues`, `_sessionThreadIds` area):

```typescript
/** Tracks queue notification message IDs per turnId so they can be dismissed */
private _queueNotifications = new Map<string, number>();
```

- [ ] **Step 2: Subscribe to MESSAGE_QUEUED in `start()` method**

In the `start()` method, after the existing `eventBus.on` subscriptions (around where `BusEvent.SESSION_THREAD_READY` is subscribed), add:

```typescript
// Queue notification: when a message is queued behind others, show inline buttons
this.core.eventBus.on(BusEvent.MESSAGE_QUEUED, async (data) => {
  if (data.sourceAdapterId !== 'telegram') return;

  const session = this.core.sessionManager.getSession(data.sessionId);
  if (!session || !session.promptRunning) return;

  const threadId = Number(session.threadId);
  if (!threadId) return;

  const position = data.queueDepth;
  const keyboard = new InlineKeyboard()
    .text('⏭ Process Now', `q:now:${data.sessionId}:${data.turnId}`)
    .text('🗑 Clear Queue', `q:clear:${data.sessionId}`)
    .row()
    .text('⛔ Cancel Current', `q:cancel:${data.sessionId}`)
    .text('🔄 Flush All', `q:flush:${data.sessionId}`);

  const text = [
    `📋 <b>Message queued</b> (#${position} in line)`,
    '',
    '<i>Agent is processing another prompt.</i>',
    '',
    '<b>⏭ Process Now</b> — Skip queue, process this message immediately',
    '<b>🗑 Clear Queue</b> — Remove all queued messages',
    '<b>⛔ Cancel Current</b> — Stop current prompt, queue continues',
    '<b>🔄 Flush All</b> — Cancel everything, start fresh',
  ].join('\n');

  try {
    const result = await this.sendQueue.enqueue(() =>
      this.bot.api.sendMessage(this.telegramConfig.chatId, text, {
        message_thread_id: threadId,
        parse_mode: 'HTML',
        reply_markup: keyboard,
        disable_notification: true,
      }),
    );
    if (result) {
      this._queueNotifications.set(data.turnId, result.message_id);
    }
  } catch (err) {
    log.warn({ err }, 'Failed to send queue notification');
  }
});
```

Note: `InlineKeyboard` is already imported from `grammy` at the top of the file. Verify it's imported; if not, add it to the existing import.

- [ ] **Step 3: Subscribe to MESSAGE_PROCESSING to dismiss notification**

Right after the MESSAGE_QUEUED subscription, add:

```typescript
// Dismiss queue notification when message starts processing
this.core.eventBus.on(BusEvent.MESSAGE_PROCESSING, async (data) => {
  const msgId = this._queueNotifications.get(data.turnId);
  if (!msgId) return;
  this._queueNotifications.delete(data.turnId);
  this.bot.api.deleteMessage(this.telegramConfig.chatId, msgId).catch(() => {});
});
```

- [ ] **Step 4: Verify `InlineKeyboard` import exists**

Check that `InlineKeyboard` is in the grammY import at the top of `adapter.ts`. The file currently has:
```typescript
import { Bot, InputFile } from "grammy";
```
Add `InlineKeyboard` to this import:
```typescript
import { Bot, InlineKeyboard, InputFile } from "grammy";
```

- [ ] **Step 5: Build to verify**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | tail -15`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/plugins/telegram/adapter.ts && git commit -m "feat(telegram): show queue notification with action buttons when message is queued"
```

---

### Task 4: Telegram callback handlers for queue buttons

**Files:**
- Modify: `src/plugins/telegram/adapter.ts`

- [ ] **Step 1: Register callback handler for `q:` prefix**

In the `setupRoutes()` method (or wherever other callback handlers are registered — near `callbackQuery(/^c\//, ...)` handler), add:

```typescript
// Queue notification button callbacks
this.bot.callbackQuery(/^q:/, async (ctx) => {
  const data = ctx.callbackQuery.data!;
  const parts = data.split(':');
  // Format: q:<action>:<sessionId> or q:now:<sessionId>:<turnId>
  const action = parts[1];

  if (action === 'now') {
    const sessionId = parts[2];
    const turnId = parts[3];
    const session = this.core.sessionManager.getSession(sessionId);
    if (!session) {
      await ctx.answerCallbackQuery({ text: 'Session not found.' });
      return;
    }
    const found = await session.prioritizePrompt(turnId);
    if (found) {
      await ctx.answerCallbackQuery({ text: '⏭ Processing now!' });
    } else {
      await ctx.answerCallbackQuery({ text: 'Message already processed or not in queue.' });
    }
  } else if (action === 'clear') {
    const sessionId = parts[2];
    const session = this.core.sessionManager.getSession(sessionId);
    if (!session) {
      await ctx.answerCallbackQuery({ text: 'Session not found.' });
      return;
    }
    session.clearQueue();
    await ctx.answerCallbackQuery({ text: '🗑 Queue cleared.' });
  } else if (action === 'cancel') {
    const sessionId = parts[2];
    const session = this.core.sessionManager.getSession(sessionId);
    if (!session) {
      await ctx.answerCallbackQuery({ text: 'Session not found.' });
      return;
    }
    await session.abortPrompt();
    await ctx.answerCallbackQuery({ text: '⛔ Current prompt cancelled.' });
  } else if (action === 'flush') {
    const sessionId = parts[2];
    const session = this.core.sessionManager.getSession(sessionId);
    if (!session) {
      await ctx.answerCallbackQuery({ text: 'Session not found.' });
      return;
    }
    await session.flushAll();
    session.markCancelled();
    await ctx.answerCallbackQuery({ text: '🔄 Session flushed.' });
  }

  // Delete the notification message after any action
  try {
    await ctx.deleteMessage();
  } catch {
    // Message may already be deleted
  }

  // Clean up notification tracking
  for (const [turnId, msgId] of this._queueNotifications) {
    if (msgId === ctx.callbackQuery.message?.message_id) {
      this._queueNotifications.delete(turnId);
      break;
    }
  }
});
```

- [ ] **Step 2: Build to verify**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | tail -15`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/plugins/telegram/adapter.ts && git commit -m "feat(telegram): add callback handlers for queue notification buttons"
```

---

### Task 5: Cleanup — dismiss all session notifications on flush/clear

**Files:**
- Modify: `src/plugins/telegram/adapter.ts`

When `/flush`, `/clearqueue`, or `/cancel` is used via commands (not buttons), the queue notifications should also be dismissed.

- [ ] **Step 1: Add helper method to dismiss all queue notifications for a session**

Add a private method to the `TelegramAdapter` class:

```typescript
/** Delete all queue notification messages for a session */
private dismissQueueNotifications(sessionId: string): void {
  const session = this.core.sessionManager.getSession(sessionId);
  if (!session) return;

  for (const [turnId, msgId] of this._queueNotifications) {
    // Check if this notification belongs to this session by checking queue items
    // Since we can't easily map turnId→sessionId, delete all and let Telegram
    // silently fail for non-matching chat/message combos
    this.bot.api.deleteMessage(this.telegramConfig.chatId, msgId).catch(() => {});
    this._queueNotifications.delete(turnId);
  }
}
```

Actually, a simpler approach: in the `MESSAGE_PROCESSING` listener and in the queue button callbacks, we already handle cleanup. For command-based actions (`/flush`, `/clearqueue`), the queued messages' promises get resolved, and when they eventually trigger `MESSAGE_PROCESSING` (or not, since they were discarded), the notifications would be stale.

Better approach: clean up notifications when the queue is cleared. Listen for when `session.queueDepth` changes to 0 — but there's no event for this.

Simplest: after any `q:` callback action, delete ALL queue notifications. The callback handler already deletes its own message. For OTHER notifications (from the same session), we should also clean them up.

- [ ] **Step 2: Update the callback handler to clean up all notifications after clear/flush actions**

In the callback handler (from Task 4), after the action-specific handling but before the final cleanup, add for `clear` and `flush` actions:

```typescript
// For actions that affect the whole queue, dismiss all notifications
if (action === 'clear' || action === 'flush') {
  for (const [turnId, msgId] of this._queueNotifications) {
    this.bot.api.deleteMessage(this.telegramConfig.chatId, msgId).catch(() => {});
  }
  this._queueNotifications.clear();
}
```

Place this BEFORE the existing `ctx.deleteMessage()` call (which handles the current notification). The `clear()` at the end ensures all tracking is cleaned up.

- [ ] **Step 3: Build and run tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | tail -10`
Expected: no errors

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test 2>&1 | tail -5`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/plugins/telegram/adapter.ts && git commit -m "feat(telegram): dismiss all queue notifications on clear/flush actions"
```
