# Unified Turn Lifecycle — Core Design Spec

## Problem

The current message flow has multiple inconsistencies:

1. **MESSAGE_QUEUED emitted asymmetrically** — `core.handleMessage()` skips emission for 'sse'/'api' sources, `api-server/routes/sessions.ts` always emits, `core.handleMessageInSession()` never emits
2. **MESSAGE_PROCESSING skips SSE sources** — `session-bridge.ts` has `if (ctx.sourceAdapterId !== 'sse')` with no clear rationale
3. **MESSAGE_PROCESSING lacks prompt text** — payload only has `sessionId`, `turnId`, `sourceAdapterId`, `timestamp`
4. **AGENT_EVENT on EventBus lacks turnId** — clients can't correlate agent events with turns
5. **TurnContext only has routing info** — no prompt text, no sender, no metadata
6. **Three separate prompt paths** — Telegram via `handleMessage`, SSE adapter via `handleMessageInSession`, api-server bypasses core entirely with its own middleware + direct `session.enqueuePrompt()`
7. **userPrompt vs finalPrompt not distinguished** — `agent:beforePrompt` middleware modifies text, but the original is lost. Display shows original, history stores modified — confusing mismatch.
8. **api-server duplicates middleware** — runs `message:incoming` itself instead of delegating to core
9. **turn:start hook missing routing info** — no `sourceAdapterId` or `responseAdapterId`

## Goal

Unify the prompt lifecycle around `turnId` as the single correlation key. All adapters share one code path. All EventBus events carry consistent, complete data. TurnContext holds both the original and processed prompt text.

## Design

### 1. TurnContext — Add Prompt Text + Meta

**File:** `src/core/sessions/turn-context.ts`

```typescript
export interface TurnContext {
  turnId: string;
  sourceAdapterId: string;
  responseAdapterId?: string | null;
  /** Prompt text after message:incoming middleware but before agent:beforePrompt.
   *  This is what the user effectively sent — normalized by incoming middleware
   *  (e.g. @mention enrichment) but without system context injection from beforePrompt plugins.
   *  For assistant sessions, may include prepended system prompt from assistantManager. */
  userPrompt: string;
  /** Prompt text after agent:beforePrompt middleware — what the agent actually receives */
  finalPrompt: string;
  attachments?: Attachment[];
  /** Per-turn metadata bag (includes .identity from auto-register) */
  meta?: TurnMeta;
}
```

`createTurnContext()` gains new parameters:

```typescript
export function createTurnContext(
  sourceAdapterId: string,
  responseAdapterId: string | null | undefined,
  turnId: string | undefined,
  userPrompt: string,
  finalPrompt: string,
  attachments?: Attachment[],
  meta?: TurnMeta,
): TurnContext
```

`TurnRouting` remains unchanged — it's about routing, not prompt content.

### 2. PromptQueue — Carry userPrompt

**File:** `src/core/sessions/prompt-queue.ts`

Queue items and processor signature add `userPrompt`:

```typescript
// Queue item
{ text: string; userPrompt: string; attachments?; routing?; turnId?; meta?; resolve }

// Processor
(text: string, userPrompt: string, attachments?, routing?, turnId?, meta?) => Promise<void>

// enqueue()
enqueue(text: string, userPrompt: string, attachments?, routing?, turnId?, meta?): Promise<void>
```

`text` is the finalPrompt (after middleware). `userPrompt` is the original. Both travel through the queue together.

### 3. Session.enqueuePrompt — Split userPrompt / finalPrompt

**File:** `src/core/sessions/session.ts`

```typescript
async enqueuePrompt(
  text: string,
  attachments?: Attachment[],
  routing?: TurnRouting,
  externalTurnId?: string,
  meta?: TurnMeta,
): Promise<string> {
  const turnId = externalTurnId ?? nanoid(8);
  const turnMeta: TurnMeta = meta ?? { turnId };
  // Save text before agent:beforePrompt middleware modifies it.
  // At this point, text has already been through message:incoming middleware
  // (normalization, @mention enrichment) but NOT agent:beforePrompt (system context injection).
  const userPrompt = text;

  // Hook: agent:beforePrompt — modifiable, can block
  if (this.middlewareChain) {
    const payload = { text, attachments, sessionId: this.id, sourceAdapterId: routing?.sourceAdapterId, meta: turnMeta };
    const result = await this.middlewareChain.execute(Hook.AGENT_BEFORE_PROMPT, payload, async (p) => p);
    if (!result) return turnId;
    text = result.text;
    attachments = result.attachments;
  }

  // text = finalPrompt, userPrompt = original
  await this.queue.enqueue(text, userPrompt, attachments, routing, turnId, turnMeta);
  return turnId;
}
```

### 4. Session.processPrompt — Seal Full TurnContext

**File:** `src/core/sessions/session.ts`

`processPrompt` receives `userPrompt` from the queue and passes it into `createTurnContext`:

```typescript
private async processPrompt(
  text: string,           // finalPrompt
  userPrompt: string,     // original
  attachments?: Attachment[],
  routing?: TurnRouting,
  turnId?: string,
  meta?: TurnMeta,
): Promise<void> {
  if (this._status === "finished") return;

  this.activeTurnContext = createTurnContext(
    routing?.sourceAdapterId ?? this.channelId,
    routing?.responseAdapterId,
    turnId,
    userPrompt,
    text,      // finalPrompt
    attachments,
    meta,
  );

  this.emit(SessionEv.TURN_STARTED, this.activeTurnContext);
  // ... rest unchanged
}
```

### 5. EventBus Payloads — Enrich

**File:** `src/core/event-bus.ts`

#### message:queued — add sender

```typescript
"message:queued": (data: {
  sessionId: string;
  turnId: string;
  text: string;              // userPrompt (original text)
  sourceAdapterId: string;
  attachments?: unknown[];
  timestamp: string;
  queueDepth: number;
  sender?: {                 // NEW — from meta.identity
    userId: string;
    identityId: string;
    displayName?: string;
    username?: string;
  } | null;
}) => void;
```

#### message:processing — add prompts + sender

```typescript
"message:processing": (data: {
  sessionId: string;
  turnId: string;
  sourceAdapterId: string;
  userPrompt: string;        // NEW — original text
  finalPrompt: string;       // NEW — after middleware
  attachments?: unknown[];   // NEW
  sender?: {                 // NEW — from meta.identity
    userId: string;
    identityId: string;
    displayName?: string;
    username?: string;
  } | null;
  timestamp: string;
}) => void;
```

#### agent:event — add turnId

```typescript
"agent:event": (data: {
  sessionId: string;
  turnId: string;            // NEW
  event: AgentEvent;
}) => void;
```

### 6. SessionBridge — Remove Source-Specific Conditions

**File:** `src/core/sessions/session-bridge.ts`

#### TURN_STARTED handler — always emit, read from TurnContext

Remove the `if (ctx.sourceAdapterId !== 'sse')` condition. Read prompt text and meta from the enriched TurnContext:

```typescript
this.listen(this.session, SessionEv.TURN_STARTED, (ctx: TurnContext) => {
  // No source filtering — always emit for all adapters
  this.deps.eventBus?.emit(BusEvent.MESSAGE_PROCESSING, {
    sessionId: this.session.id,
    turnId: ctx.turnId,
    sourceAdapterId: ctx.sourceAdapterId,
    userPrompt: ctx.userPrompt,
    finalPrompt: ctx.finalPrompt,
    attachments: ctx.attachments,
    sender: extractSender(ctx.meta),
    timestamp: new Date().toISOString(),
  });
});
```

`extractSender` is a small helper that reads `meta?.identity` and returns the sender shape or null.

#### handleAgentEvent — include turnId in EventBus emission

```typescript
this.deps.eventBus?.emit(BusEvent.AGENT_EVENT, {
  sessionId: this.session.id,
  turnId: this.session.activeTurnContext?.turnId ?? '',
  event,
});
```

### 7. Unified Message Dispatch — Single Shared Path

**File:** `src/core/core.ts`

#### `_dispatchToSession` — shared private method

The final steps of sending a prompt to a session are extracted into one place. Both `handleMessage` and `handleMessageInSession` call this after their respective middleware/enrichment:

```typescript
private async _dispatchToSession(
  session: Session,
  text: string,
  attachments: Attachment[] | undefined,
  routing: TurnRouting,
  turnId: string,
  meta: TurnMeta,
): Promise<void> {
  // Update activity timestamp for all sources (previously only handleMessage did this)
  this.sessionManager.patchRecord(session.id, {
    lastActiveAt: new Date().toISOString(),
  });

  // Emit MESSAGE_QUEUED — always, for all sources, no adapter-specific conditions
  this.eventBus.emit(BusEvent.MESSAGE_QUEUED, {
    sessionId: session.id,
    turnId,
    text,
    sourceAdapterId: routing.sourceAdapterId,
    attachments,
    timestamp: new Date().toISOString(),
    queueDepth: session.queueDepth + 1,
    sender: extractSender(meta),
  });

  await session.enqueuePrompt(text, attachments, routing, turnId, meta);
}
```

#### `handleMessageInSession` — entry point for SSE/API callers

Runs `message:incoming` middleware, then delegates to `_dispatchToSession`. Returns `{ turnId, queueDepth }`:

```typescript
async handleMessageInSession(
  session: Session,
  message: { channelId: string; userId: string; text: string; attachments?: Attachment[] },
  initialMeta?: Record<string, unknown>,
  options?: { externalTurnId?: string; responseAdapterId?: string | null },
): Promise<{ turnId: string; queueDepth: number }> {
  const turnId = options?.externalTurnId ?? nanoid(8);
  const meta: TurnMeta = { turnId, ...initialMeta };

  // Run message:incoming middleware
  let text = message.text;
  let { attachments } = message;
  let enrichedMeta: TurnMeta = meta;
  if (this.lifecycleManager?.middlewareChain) {
    const payload = {
      channelId: message.channelId,
      threadId: session.id,
      userId: message.userId,
      text, attachments, meta,
    };
    const result = await this.lifecycleManager.middlewareChain.execute(
      Hook.MESSAGE_INCOMING, payload, async (p) => p,
    );
    if (!result) return { turnId, queueDepth: session.queueDepth };
    text = result.text;
    attachments = result.attachments;
    enrichedMeta = (result as any).meta as TurnMeta ?? meta;
  }

  const routing: TurnRouting = {
    sourceAdapterId: message.channelId,
    responseAdapterId: options?.responseAdapterId,
  };
  await this._dispatchToSession(session, text, attachments, routing, turnId, enrichedMeta);

  return { turnId, queueDepth: session.queueDepth };
}
```

#### `handleMessage` — refactor to use shared path

Keeps Telegram-specific logic (session lookup, security check, assistant system prompt injection) but replaces inline emit + enqueuePrompt with `_dispatchToSession()`. Remove the `lastActiveAt` patch from handleMessage (now in `_dispatchToSession`):

```typescript
async handleMessage(message: IncomingMessage, initialMeta?: Record<string, unknown>): Promise<void> {
  const turnId = nanoid(8);
  const meta: TurnMeta = { turnId, ...initialMeta };

  // Hook: message:incoming middleware
  // ... (unchanged)

  // Security check
  // ... (unchanged)

  // Session lookup
  // ... (unchanged)

  // Remove: lastActiveAt patch (moved to _dispatchToSession)

  // Assistant system prompt injection
  // ... (unchanged)

  // Dispatch via shared path
  await this._dispatchToSession(session, text, message.attachments, {
    sourceAdapterId: message.routing?.sourceAdapterId ?? message.channelId,
    responseAdapterId: message.routing?.responseAdapterId,
  }, turnId, enrichedMeta);
}
```

### 8. api-server Route — Delegate to Core

**File:** `src/plugins/api-server/routes/sessions.ts`

POST /prompt drops its own `message:incoming` middleware execution and `MESSAGE_QUEUED` emission. Instead delegates to `core.handleMessageInSession()`:

```typescript
const sourceAdapterId = body.sourceAdapterId ?? 'sse';
const userId = (request as any).auth?.tokenId ?? 'api';

const { turnId, queueDepth } = await deps.core.handleMessageInSession(
  session,
  { channelId: sourceAdapterId, userId, text: body.prompt, attachments },
  { channelUser: { channelId: 'sse', userId } },
  { externalTurnId: body.turnId, responseAdapterId: body.responseAdapterId },
);

return { ok: true, sessionId, queueDepth, turnId };
```

### 9. SSE Adapter Route — Use Return Value

**File:** `src/plugins/sse-adapter/routes.ts`

POST /prompt uses the return value from `handleMessageInSession`:

```typescript
const { turnId, queueDepth } = await deps.core.handleMessageInSession(
  session,
  { channelId: 'sse', userId, text: body.prompt, attachments },
  { channelUser: { channelId: 'sse', userId } },
);

return { ok: true, sessionId, queueDepth, turnId };
```

### 10. turn:start Hook — Add Routing Info

**File:** `src/core/plugin/types.ts` + `src/core/sessions/session.ts`

Add optional fields to `turn:start` payload (backward compatible):

```typescript
'turn:start': {
  sessionId: string;
  promptText: string;
  promptNumber: number;
  turnId: string;
  meta?: TurnMeta;
  userPrompt?: string;           // NEW
  sourceAdapterId?: string;      // NEW
  responseAdapterId?: string | null;  // NEW
}
```

In `processPrompt`, populate from `activeTurnContext`:

```typescript
this.middlewareChain.execute(Hook.TURN_START, {
  sessionId: this.id,
  promptText: processed.text,
  promptNumber: this.promptCount,
  turnId: this.activeTurnContext?.turnId ?? turnId ?? '',
  meta,
  userPrompt: this.activeTurnContext?.userPrompt,
  sourceAdapterId: this.activeTurnContext?.sourceAdapterId,
  responseAdapterId: this.activeTurnContext?.responseAdapterId,
}, async (p) => p).catch(() => {});
```

### 11. Queue State API

**File:** `src/core/sessions/prompt-queue.ts` + `src/plugins/api-server/routes/sessions.ts`

#### PromptQueue — expose queue snapshot

Note: `text` is the finalPrompt (after `agent:beforePrompt` middleware) and may contain injected system instructions. Clients SHOULD display `userPrompt` to users, not `text`. `text` is included for debugging only.

```typescript
/** Return a snapshot of pending queue items (not the currently-processing one). */
get pendingItems(): Array<{ userPrompt: string; turnId?: string }> {
  return this.queue.map(item => ({
    userPrompt: item.userPrompt,
    turnId: item.turnId,
  }));
}
```

#### Session — expose queue items

```typescript
get queueItems() {
  return this.queue.pendingItems;
}
```

#### API route — GET /sessions/:id/queue

```typescript
app.get<{ Params: { sessionId: string } }>(
  '/:sessionId/queue',
  { preHandler: requireScopes('sessions:read') },
  async (request) => {
    const session = /* lookup */;
    return {
      pending: session.queueItems,
      processing: session.isPromptRunning,
      queueDepth: session.queueDepth,
    };
  },
);
```

### 12. Helper: extractSender

**File:** `src/core/sessions/turn-context.ts` (colocate with TurnContext)

```typescript
export interface TurnSender {
  userId: string;
  identityId: string;
  displayName?: string;
  username?: string;
}

export function extractSender(meta?: TurnMeta): TurnSender | null {
  const identity = (meta as any)?.identity;
  if (!identity || !identity.userId || !identity.identityId) return null;
  return {
    userId: identity.userId,
    identityId: identity.identityId,
    displayName: identity.displayName,
    username: identity.username,
  };
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/core/sessions/turn-context.ts` | Add fields to TurnContext, update createTurnContext, add extractSender + TurnSender |
| `src/core/sessions/prompt-queue.ts` | Add userPrompt to queue item, processor, enqueue, pendingItems getter |
| `src/core/sessions/session.ts` | Split userPrompt/finalPrompt in enqueuePrompt, update processPrompt signature, update turn:start hook payload, add queueItems getter |
| `src/core/sessions/session-bridge.ts` | Remove 'sse' condition, enrich MESSAGE_PROCESSING payload, add turnId to AGENT_EVENT emission |
| `src/core/event-bus.ts` | Enrich message:queued (sender), message:processing (prompts + sender), agent:event (turnId) |
| `src/core/core.ts` | Refactor handleMessage to use _dispatchToSession, update handleMessageInSession to return {turnId, queueDepth} + always emit MESSAGE_QUEUED |
| `src/core/plugin/types.ts` | Add optional fields to turn:start payload |
| `src/plugins/api-server/routes/sessions.ts` | Delegate POST /prompt to core.handleMessageInSession, add GET /queue |
| `src/plugins/sse-adapter/routes.ts` | Use return value from handleMessageInSession, return turnId |
| `src/plugins/api-server/sse-manager.ts` | No changes needed — already broadcasts MESSAGE_QUEUED and MESSAGE_PROCESSING |

## Backward Compatibility

- **Hook payloads**: `turn:start` new fields are optional — existing plugins unaffected
- **EventBus**: `message:queued.sender` and `message:processing.*` new fields — existing listeners ignore unknown fields
- **API**: POST /prompt response adds `turnId` for sse-adapter (api-server already had it)
- **PromptQueue**: Internal class, not part of plugin API
- **TurnContext**: Internal type used by session/bridge, not exposed to plugins directly

## Not In Scope

- App UI changes (separate spec after Core is implemented)
- Error routing improvements (Option B — emit error in finally block) — deferred to avoid scope creep
- Dual `afterEventListener` path refactor — works correctly, just fragile
- History recorder changes — it hooks into `agent:beforePrompt` at priority 200, which already receives `finalPrompt` via middleware chain. No change needed.
