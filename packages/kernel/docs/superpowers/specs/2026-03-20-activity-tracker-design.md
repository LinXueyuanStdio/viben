---
status: approved
updated: 2026-03-20
---

# Activity Tracker — Design Spec

## Problem Statement

When an agent handles a task taking 20–60 seconds, users see nothing between sending their message and receiving the response. Telegram's typing indicator disappears after 5 seconds. Additionally:

- Agent `thought` events are silently discarded
- The `plan` event sends a **new message on every update** (bug) — multiple redundant messages accumulate
- The `usage` message is static and never cleaned up between prompts
- No visual progress indicator for plan completion

## Goals

1. Users always know the agent is alive and making progress
2. Plan checklist updates in-place as items complete (with progress bar)
3. Usage shows token progress bar (no cost) and disappears on next prompt
4. Works for 20–60s tasks without spamming or hitting Telegram's 4096-char limit
5. No Cancel button on PlanCard — use `/cancel` command instead

## Non-Goals

- Cancel/Stop button on PlanCard
- ThoughtMessage streaming (thought content is not shown to user)
- Cost tracking in usage display

---

## Architecture

### New file: `src/adapters/telegram/activity.ts`

Contains four classes: `ThinkingIndicator`, `PlanCard`, `UsageMessage`, `ActivityTracker`.

```
ActivityTracker (per session, created lazily on first event)
├── ThinkingIndicator   — sends/deletes "💭 Thinking..."
├── PlanCard            — edit-in-place checklist with progress bar
└── UsageMessage        — rolling usage message (track msgId to delete)
```

### Modified files

- `adapter.ts` — add `sessionTrackers: Map<string, ActivityTracker>`, update `sendMessage()` switch cases
- `formatting.ts` — update `formatUsage()` to remove cost, add progress bar

### Unchanged files

`streaming.ts`, `permissions.ts`, `send-queue.ts`, `topics.ts`, `commands.ts`, `action-detect.ts`, `assistant.ts`

---

## Component Design

### ThinkingIndicator

```typescript
class ThinkingIndicator {
  private msgId?: number

  async show(): Promise<void>    // sends "💭 Thinking..." if not already shown
  async dismiss(): Promise<void> // no-op if msgId not set; otherwise deletes message and clears msgId
}
```

- `show()` guards with `if (this.msgId) return` — safe to call on every `thought` chunk
- `dismiss()` guards with `if (!this.msgId) return` — no Telegram API call if not shown
- `dismiss()` clears `msgId` even if deleteMessage fails (prevents leak)
- Called on first `thought` chunk; dismissed on `tool_call`, `plan`, or `text`

### PlanCard

```typescript
class PlanCard {
  private msgId?: number
  private flushPromise: Promise<void> = Promise.resolve()
  private latestEntries?: PlanEntry[]
  private flushTimer?: ReturnType<typeof setTimeout>

  async update(entries: PlanEntry[]): Promise<void>
  // Stores entries as latestEntries, resets 3.5s debounce timer
  // (above TelegramSendQueue's 3s minimum to avoid queue contention)
  // When timer fires, chains flush onto flushPromise (same pattern as MessageDraft)
  // Only the latest entries are sent — intermediate updates are dropped

  async finalize(): Promise<void>
  // Cancels pending timer
  // Awaits flushPromise to let any in-flight flush complete
  // Then chains a final flush onto flushPromise with current latestEntries

  destroy(): void
  // Cancels pending timer; no API calls
}
```

**Coalescing behavior:** `update()` uses a debounce-style timer: each call stores `latestEntries` and resets a 3.5s timer. When the timer fires, the flush is chained onto `flushPromise` — the same promise-chaining pattern as `MessageDraft._flushPromise`. This ensures flushes are serialized and `finalize()` cannot race with a timer-triggered flush.

**`finalize()` must await `flushPromise`** before executing its own flush to prevent a race where a timer-fired flush (e.g., a `sendMessage` call in-flight) and `finalize()` both attempt to `editMessageText` the same message concurrently.

**Queue routing:** `PlanCard` receives a reference to `TelegramSendQueue` and routes all `sendMessage` / `editMessageText` calls through it using `{ type: 'other' }`. Coalescing happens at the debounce level (only latest entries sent), not at the queue level. Direct calls to `bot.api` bypassing the queue are not allowed.

**Message format:**
```
📋 Plan
▓▓▓▓▓░░░░░ 50% · 2/4
✅ 1. Research topic
🔄 2. Write draft
⬜ 3. Review
⬜ 4. Publish
```

**Progress bar formula** (shared with UsageMessage):
`Math.round(ratio * 10)` × `▓`, rest `░`, total 10 chars.

**Status icons:** `✅` completed, `🔄` in_progress, `⬜` pending, `❌` failed.

### UsageMessage

```typescript
class UsageMessage {
  private msgId?: number

  async send(usage: UsageData): Promise<void>
  // If msgId is set → editMessageText; otherwise → sendMessage and store msgId

  async delete(): Promise<void>
  // No-op if msgId not set; otherwise deleteMessage, clear msgId
}
```

**Message format** (no cost):
```
📊 28k / 200k tokens
▓▓░░░░░░░░ 14%
```

Warning at ≥85%:
```
⚠️ 85k / 100k tokens
▓▓▓▓▓▓▓▓▓░ 85%
```

Token display: round to nearest `k` if ≥1000, e.g. `28k`, `200k`.
Progress bar uses the same formula as PlanCard: `Math.round(ratio * 10)` × `▓`, rest `░`.

### ActivityTracker

```typescript
class ActivityTracker {
  private isFirstEvent = true
  private hasPlanCard = false
  private thinking: ThinkingIndicator
  private planCard: PlanCard
  private usage: UsageMessage

  // Called by adapter AFTER finalizeDraft() when user sends a new message
  async onNewPrompt(): Promise<void>
  // Resets: isFirstEvent = true, hasPlanCard = false
  // Defensively calls thinking.dismiss() to clear any stale ThinkingIndicator
  // (guards internally — no-op if not shown)

  // Agent event handlers
  async onThought(): Promise<void>
  // firstEvent guard → thinking.show()

  async onPlan(entries: PlanEntry[]): Promise<void>
  // firstEvent guard → thinking.dismiss() → planCard.update(), hasPlanCard = true

  async onToolCall(): Promise<void>
  // firstEvent guard → thinking.dismiss()
  // (existing tool_call send logic remains in adapter.ts switch)

  async onTextStart(): Promise<void>
  // firstEvent guard → thinking.dismiss()
  // (MessageDraft creation remains in adapter.ts switch)

  async sendUsage(data: UsageData): Promise<void>
  // usage.send()

  async onComplete(): Promise<void>
  // if hasPlanCard → planCard.finalize()
  // else → sendQueue.enqueue(() => bot.api.sendMessage "✅ Done")

  destroy(): void
  // planCard.destroy() to cancel pending timer; no other API calls
}
```

**`firstEvent` guard** (runs once per prompt cycle on the first event of any type):
```
if (isFirstEvent):
  isFirstEvent = false
  await usage.delete()   // remove previous usage message
  // Note: finalizeDraft() is NOT called here — it was already called in setupRoutes
  // before onNewPrompt(), so draft is already clean when agent events arrive
```

---

## Data Flow

### Full prompt lifecycle

```
User sends message (in setupRoutes)
  → finalizeDraft(sessionId)       [existing — flushes and removes previous draft]
  → tracker.onNewPrompt()          [resets isFirstEvent=true, hasPlanCard=false]

Agent responds:
  thought   → onThought()   → [firstEvent guard: delete usage] → thinking.show()
  thought   → onThought()   → thinking.show() is no-op (msgId exists)
  plan      → onPlan()      → [firstEvent guard: delete usage] → thinking.dismiss() → planCard.update()
  plan      → onPlan()      → planCard.update() [coalesced, 3.5s debounce]
  tool_call → onToolCall()  → [firstEvent guard: delete usage] → thinking.dismiss()
                             → existing sendMessage logic in adapter switch
  text      → onTextStart() → [firstEvent guard: delete usage] → thinking.dismiss()
                             → existing MessageDraft logic in adapter switch
  usage     → sendUsage()   → usageMsg.send()
  session_end → onComplete() → planCard.finalize() OR ✅ Done
             → tracker.destroy(), sessionTrackers.delete(sessionId)
```

### Removed `finalizeDraft()` calls in adapter switch

The existing adapter switch calls `finalizeDraft()` inside `tool_call`, `plan`, `usage`, and `session_end` cases. After this change:
- `tool_call` — keep `finalizeDraft()` call (belt-and-suspenders, draft may exist if firstEvent guard already ran but a draft was created between messages)
- `plan` — **remove** the `sendMessage()` call (replaced by `tracker.onPlan()`); keep `finalizeDraft()` only for the first `plan` event — actually, since `firstEvent` guard no longer calls `finalizeDraft()`, the existing call inside the `plan` case should be **removed** and `finalizeDraft()` is handled exclusively in `setupRoutes`. The `tool_call` case keeps its `finalizeDraft()` call because it may receive a draft mid-stream.
- `usage` — replace entire case with `tracker.sendUsage()`
- `session_end` — replace `sendMessage("✅ Done")` with `tracker.onComplete()`

**Definitive rule:** `finalizeDraft()` is called in exactly two places:
1. `setupRoutes` — when user sends a new message (before `onNewPrompt()`)
2. `sendMessage()` `tool_call` case — when a tool starts (agent may have sent partial text before tool)

All other `finalizeDraft()` calls in the existing switch are removed.

### Bug fix: plan event

**Before:** `plan` event → always `sendMessage()` → multiple plan messages accumulate.
**After:** `plan` event → `planCard.update()` → first flush creates message, subsequent flushes edit in-place.

### Bug fix: MessageDraft not finalized between prompts

**Before:** If agent responds with text-only twice in a row, second response appends to first draft.
**After:** `finalizeDraft()` called in `setupRoutes` when user sends a new message, ensuring previous draft is flushed before any new agent events arrive.

---

## Error Handling

| Error | Handling |
|-------|----------|
| `thinking.show()` fails | `log.warn`, continue (non-critical) |
| `thinking.dismiss()` fails | `log.warn`, clear `msgId` anyway to prevent leak |
| `planCard.update()` editMessageText fails | `log.warn`, will retry on next `plan` event |
| `planCard.finalize()` fails | `log.warn`, continue — session still ends cleanly |
| `usageMsg.delete()` fails | `log.warn`, clear `msgId` anyway |
| `usageMsg.send()` fails | `log.warn`, continue (non-critical) |
| Session crash mid-task | `tracker.destroy()` + `sessionTrackers.delete()` in both `error` and `session_end` handlers |

---

## Changes to `formatting.ts`

`formatUsage()` updated — remove `cost` param, add progress bar:

```typescript
// Before:
formatUsage({ tokensUsed?, contextSize?, cost? })
// "📊 Tokens: 12,000 | Context: 42,000 | Cost: $0.0300"

// After:
formatUsage({ tokensUsed?, contextSize? })
// "📊 28k / 200k tokens\n▓▓░░░░░░░░ 14%"
// "⚠️ 85k / 100k tokens\n▓▓▓▓▓▓▓▓▓░ 85%"  (≥85% warning)
```

The `cost` field is removed from the type signature. Progress bar uses `Math.round((tokensUsed / contextSize) * 10)` filled blocks.

---

## Changes to `adapter.ts`

```typescript
// New field
private sessionTrackers: Map<string, ActivityTracker> = new Map()

// New helper (synchronous, lazy init)
private getOrCreateTracker(sessionId: string): ActivityTracker { ... }

// sendMessage() switch changes:
// thought     → tracker.onThought()
//               (no other logic — thought was previously a no-op)
//
// plan        → tracker.onPlan(entries)
//               REMOVE: existing sendMessage() + finalizeDraft() calls
//
// tool_call   → tracker.onToolCall() THEN existing logic
//               KEEP: existing finalizeDraft() call (only finalizeDraft kept here)
//
// text        → tracker.onTextStart() when !sessionDrafts.has(sessionId)
//               KEEP: existing MessageDraft logic unchanged
//
// usage       → tracker.sendUsage(data)
//               REMOVE: existing sendMessage() call
//
// session_end → tracker.onComplete() THEN existing cleanup
//               REMOVE: existing sendMessage("✅ Done")
//               ADD: tracker.destroy(), sessionTrackers.delete(sessionId)
//
// error       → ADD: tracker.destroy(), sessionTrackers.delete(sessionId)
//               KEEP: existing sendMessage() call

// setupRoutes() change:
// When user sends message to session topic:
//   KEEP: finalizeDraft(sessionId)  [already there]
//   ADD:  getOrCreateTracker(sessionId).onNewPrompt()  [after finalizeDraft]
```

---

## `✅ Done` fallback

```typescript
// in ActivityTracker.onComplete()
if (this.hasPlanCard) {
  await this.planCard.finalize()
  // PlanCard itself serves as completion signal — no separate Done message
} else {
  await sendQueue.enqueue(() =>
    bot.api.sendMessage(chatId, '✅ <b>Done</b>', {
      message_thread_id: threadId,
      parse_mode: 'HTML',
      disable_notification: true,
    })
  )
}
```
