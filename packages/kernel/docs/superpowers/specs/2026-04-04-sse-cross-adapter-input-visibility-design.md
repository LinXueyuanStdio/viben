# SSE Cross-Adapter Input Visibility

**Date:** 2026-04-04
**Status:** Approved

## Problem

The SSE `/events` stream already receives all agent response events from any adapter (Telegram, Discord, etc.) via the EventBus `agent:event`. However, it does not see the *input* messages that trigger those responses. When a user sends a message from Telegram, the app (SSE client) only sees the AI response — not the original message text, who sent it, or its lifecycle (queued vs actively processing).

## Goals

- SSE receives cross-adapter input messages with text, metadata, and queue lifecycle state
- App can display full conversation history including messages from other adapters
- App can show accurate typing indicators by knowing when processing starts

## Non-Goals

- Input visibility for messages sent by the SSE/API adapter itself (app already knows)
- `done` state — already covered by existing `session_end` / agent event stream

## Design

### New EventBus Events

Two new events added to `EventBusEvents`:

```typescript
"message:queued": {
  sessionId: string;
  turnId: string;       // generated at enqueue time
  text: string;
  sourceAdapterId: string;
  attachments?: Attachment[];
  timestamp: string;    // ISO — time of enqueue
  queueDepth: number;   // position in queue at time of enqueue
}

"message:processing": {
  sessionId: string;
  turnId: string;       // same ID as message:queued — allows pairing
  sourceAdapterId: string;
  timestamp: string;    // ISO — time dequeue started
}
```

### turnId Lifecycle

`turnId` is generated at `enqueuePrompt()` time (not at dequeue), stored in the queue item, and passed into `createTurnContext()` when dequeued. This allows `message:queued` and `message:processing` to share the same `turnId` for client-side pairing.

### Filter: Which Adapters Emit

Only adapters that are "external" (have a registered adapter instance) emit these events. The filter: `sourceAdapterId !== 'sse' && sourceAdapterId !== 'api'`. This excludes the app's own messages; only Telegram, Discord, and other platform adapters trigger the events.

### Implementation Flow

```
[Telegram sends message]
  → core.handleMessage()
    → session.enqueuePrompt(text, attachments, { sourceAdapterId: 'telegram' })
       → generates turnId = nanoid()
       → stores { text, routing: { sourceAdapterId, turnId }, ... } in queue
    → core emits EventBus "message:queued" { sessionId, turnId, text, ... }

[Queue processes next item]
  → session.processPrompt()
    → dequeues item with pre-generated turnId
    → session.activeTurnContext = createTurnContext(sourceAdapterId, responseAdapterId, turnId)
    → session.emit("turn_started", activeTurnContext)

[SessionBridge receives turn_started]
  → if sourceAdapterId not in ['sse', 'api']
    → eventBus.emit("message:processing", { sessionId, turnId, sourceAdapterId, ... })

[SSEManager receives both events]
  → broadcasts to all SSE clients filtered by sessionId
```

### File Changes

| File | Change |
|------|--------|
| `src/core/event-bus.ts` | Add `"message:queued"` and `"message:processing"` to `EventBusEvents` |
| `src/core/sessions/prompt-queue.ts` | Add `turnId: string` to queue item type |
| `src/core/sessions/turn-context.ts` | `createTurnContext()` accepts optional `turnId` param; generates if not provided |
| `src/core/sessions/session.ts` | `enqueuePrompt()` generates `turnId`, stores in queue item; `processPrompt()` passes `turnId` to `createTurnContext()`; emits `turn_started` after `activeTurnContext` set |
| `src/core/core.ts` | After `session.enqueuePrompt()` in `handleMessage()`: emit `message:queued` if sourceAdapterId is external |
| `src/core/sessions/session-bridge.ts` | Listen to `turn_started` session event → emit `message:processing` on EventBus |
| `src/plugins/api-server/sse-manager.ts` | Subscribe to `message:queued` + `message:processing`; add both to sessionId-filtered event list |

### Backward Compatibility

- `turnId` in queue item is new; no existing queue items are persisted across restarts (in-memory only)
- `createTurnContext()` signature change is additive (optional param with default)
- New EventBus events are additive — no existing listeners affected

## Testing

- `message:queued` emitted for Telegram/Discord messages but NOT for 'sse'/'api' sources
- `message:processing` emitted when dequeued with matching `turnId`
- Both events filtered by `sessionId` in SSEManager
- `turnId` matches between `message:queued` and `message:processing` for same turn
- Queue depth reflects position at enqueue time
