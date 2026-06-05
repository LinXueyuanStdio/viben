# Unified Turn Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the prompt lifecycle around `turnId` as the single correlation key — all adapters share one code path, all EventBus events carry complete data, TurnContext holds both userPrompt and finalPrompt.

**Architecture:** Extract `_dispatchToSession()` as the single shared path for MESSAGE_QUEUED emission + enqueuePrompt. Enrich TurnContext with prompt text and metadata. Both `handleMessage` (Telegram) and `handleMessageInSession` (SSE/API) delegate to it. api-server and sse-adapter drop duplicated logic and call `handleMessageInSession` instead.

**Tech Stack:** TypeScript, Vitest, Fastify

**Spec:** `docs/superpowers/specs/2026-04-13-unified-turn-lifecycle-design.md`

---

### Task 1: TurnContext + extractSender

**Files:**
- Modify: `src/core/sessions/turn-context.ts`

- [ ] **Step 1: Add TurnSender interface and extractSender helper**

Add imports and new types after the existing imports in `src/core/sessions/turn-context.ts`:

```typescript
// Add to existing imports at top:
import type { Attachment, TurnMeta } from "../types.js";
```

Add `TurnSender` interface and `extractSender` function before `getEffectiveTarget`:

```typescript
/**
 * Lightweight sender snapshot extracted from TurnMeta.identity.
 * Used in EventBus payloads so consumers don't need to parse raw meta.
 */
export interface TurnSender {
  userId: string;
  identityId: string;
  displayName?: string;
  username?: string;
}

/**
 * Extract sender info from TurnMeta's identity field (injected by auto-register middleware).
 * Returns null if identity info is missing or incomplete.
 */
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

- [ ] **Step 2: Update TurnContext interface**

Replace the existing `TurnContext` interface:

```typescript
export interface TurnContext {
  /** Unique identifier for this turn — shared across all lifecycle events. */
  turnId: string;
  /** The adapter that originated this prompt. */
  sourceAdapterId: string;
  /** Where to send the response: null = silent (suppress), undefined = same as source, string = explicit target. */
  responseAdapterId?: string | null;
  /** Prompt text after message:incoming middleware but before agent:beforePrompt.
   *  Normalized by incoming middleware (e.g. @mention enrichment) but without
   *  system context injection from beforePrompt plugins.
   *  For assistant sessions, may include prepended system prompt from assistantManager. */
  userPrompt: string;
  /** Prompt text after agent:beforePrompt middleware — what the agent actually receives */
  finalPrompt: string;
  /** File attachments associated with this turn */
  attachments?: Attachment[];
  /** Per-turn metadata bag (includes .identity from auto-register middleware) */
  meta?: TurnMeta;
}
```

- [ ] **Step 3: Update createTurnContext function**

Replace the existing `createTurnContext`:

```typescript
export function createTurnContext(
  sourceAdapterId: string,
  responseAdapterId: string | null | undefined,
  turnId: string | undefined,
  userPrompt: string,
  finalPrompt: string,
  attachments?: Attachment[],
  meta?: TurnMeta,
): TurnContext {
  return {
    turnId: turnId ?? nanoid(8),
    sourceAdapterId,
    responseAdapterId,
    userPrompt,
    finalPrompt,
    attachments,
    meta,
  };
}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | head -30`

Expected: Build errors in `session.ts` because `createTurnContext` now requires more args. This confirms the interface change propagated.

- [ ] **Step 5: Commit**

```bash
git add src/core/sessions/turn-context.ts
git commit -m "feat(turn-context): add userPrompt, finalPrompt, meta, attachments to TurnContext

Add TurnSender interface and extractSender helper for EventBus payloads.
Update createTurnContext to accept prompt text and metadata."
```

---

### Task 2: PromptQueue — carry userPrompt

**Files:**
- Modify: `src/core/sessions/prompt-queue.ts`

- [ ] **Step 1: Add userPrompt to queue item type, processor, and all methods**

Replace the full content of `src/core/sessions/prompt-queue.ts`:

```typescript
import type { Attachment, TurnMeta } from '../types.js'
import type { TurnRouting } from './turn-context.js'

/**
 * Serial prompt queue — ensures prompts are processed one at a time.
 *
 * Agents are stateful (each prompt builds on prior context), so concurrent
 * prompts would corrupt the conversation. This queue guarantees that only
 * one prompt is processed at a time; additional prompts are buffered and
 * drained sequentially after the current one completes.
 */
export class PromptQueue {
  private queue: Array<{ text: string; userPrompt: string; attachments?: Attachment[]; routing?: TurnRouting; turnId?: string; meta?: TurnMeta; resolve: () => void }> = []
  private processing = false
  private abortController: AbortController | null = null
  /** Set when abort is triggered; drainNext waits for the current processor to settle before starting the next item. */
  private processorSettled: Promise<void> | null = null

  constructor(
    private processor: (text: string, userPrompt: string, attachments?: Attachment[], routing?: TurnRouting, turnId?: string, meta?: TurnMeta) => Promise<void>,
    private onError?: (err: unknown) => void,
  ) {}

  /**
   * Add a prompt to the queue. If no prompt is currently processing, it runs
   * immediately. Otherwise, it's buffered and the returned promise resolves
   * only after the prompt finishes processing.
   */
  async enqueue(text: string, userPrompt: string, attachments?: Attachment[], routing?: TurnRouting, turnId?: string, meta?: TurnMeta): Promise<void> {
    if (this.processing) {
      return new Promise<void>((resolve) => {
        this.queue.push({ text, userPrompt, attachments, routing, turnId, meta, resolve })
      })
    }
    await this.process(text, userPrompt, attachments, routing, turnId, meta)
  }

  /** Run a single prompt through the processor, then drain the next queued item. */
  private async process(text: string, userPrompt: string, attachments?: Attachment[], routing?: TurnRouting, turnId?: string, meta?: TurnMeta): Promise<void> {
    this.processing = true
    this.abortController = new AbortController()
    const { signal } = this.abortController
    let settledResolve: () => void
    this.processorSettled = new Promise<void>((r) => { settledResolve = r })
    try {
      await Promise.race([
        this.processor(text, userPrompt, attachments, routing, turnId, meta),
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Prompt aborted')), { once: true })
        }),
      ])
    } catch (err) {
      // Only forward non-abort errors to onError handler
      if (!(err instanceof Error && err.message === 'Prompt aborted')) {
        this.onError?.(err)
      }
    } finally {
      this.abortController = null
      this.processing = false
      settledResolve!()
      this.processorSettled = null
      this.drainNext()
    }
  }

  /** Dequeue and process the next pending prompt, if any. Called after each prompt completes. */
  private drainNext(): void {
    const next = this.queue.shift()
    if (next) {
      this.process(next.text, next.userPrompt, next.attachments, next.routing, next.turnId, next.meta).then(next.resolve)
    }
  }

  /**
   * Abort the in-flight prompt and discard all queued prompts.
   * Pending promises are resolved (not rejected) so callers don't see unhandled rejections.
   */
  clear(): void {
    // Abort the currently running prompt so the queue can drain
    if (this.abortController) {
      this.abortController.abort()
    }
    // Resolve pending promises so callers don't hang
    for (const item of this.queue) {
      item.resolve()
    }
    this.queue = []
  }

  get pending(): number {
    return this.queue.length
  }

  get isProcessing(): boolean {
    return this.processing
  }

  /** Return a snapshot of pending queue items (not the currently-processing one). */
  get pendingItems(): Array<{ userPrompt: string; turnId?: string }> {
    return this.queue.map(item => ({
      userPrompt: item.userPrompt,
      turnId: item.turnId,
    }))
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | head -30`

Expected: Build errors in `session.ts` because processor callback and queue.enqueue calls don't match new signature. This is expected — fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/core/sessions/prompt-queue.ts
git commit -m "feat(prompt-queue): add userPrompt to queue items and processor signature

All queue methods now carry both finalPrompt (text) and userPrompt through
the queue. Add pendingItems getter for queue state API."
```

---

### Task 3: Session — split userPrompt/finalPrompt + queueItems

**Files:**
- Modify: `src/core/sessions/session.ts`

- [ ] **Step 1: Update queue constructor processor callback**

In the constructor (around line 141), update the processor callback to include `userPrompt`:

```typescript
// Old:
    this.queue = new PromptQueue(
      (text, attachments, routing, turnId, meta) => this.processPrompt(text, attachments, routing, turnId, meta),

// New:
    this.queue = new PromptQueue(
      (text, userPrompt, attachments, routing, turnId, meta) => this.processPrompt(text, userPrompt, attachments, routing, turnId, meta),
```

- [ ] **Step 2: Update enqueuePrompt to save userPrompt before middleware**

Replace the `enqueuePrompt` method (around line 261-275):

```typescript
  async enqueuePrompt(text: string, attachments?: Attachment[], routing?: TurnRouting, externalTurnId?: string, meta?: TurnMeta): Promise<string> {
    // Use pre-generated turnId if provided (so callers can emit events before awaiting the queue)
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
      if (!result) return turnId; // blocked by middleware
      text = result.text;
      attachments = result.attachments;
    }
    // text = finalPrompt (after middleware), userPrompt = original (before middleware)
    await this.queue.enqueue(text, userPrompt, attachments, routing, turnId, turnMeta);
    return turnId;
  }
```

- [ ] **Step 3: Update processPrompt to receive userPrompt and seal enriched TurnContext**

Replace the `processPrompt` signature and the TurnContext creation block (around line 277-290):

```typescript
  private async processPrompt(text: string, userPrompt: string, attachments?: Attachment[], routing?: TurnRouting, turnId?: string, meta?: TurnMeta): Promise<void> {
    // Don't process prompts for finished sessions (queue may still drain)
    if (this._status === "finished") return;

    // Seal turn context — bridges use this to decide routing for every emitted event
    // Pass the pre-generated turnId so message:queued and message:processing share the same ID
    this.activeTurnContext = createTurnContext(
      routing?.sourceAdapterId ?? this.channelId,
      routing?.responseAdapterId,
      turnId,
      userPrompt,
      text,      // finalPrompt
      attachments,
      meta,
    );

    // Emit turn_started so SessionBridge can emit message:processing on EventBus
    this.emit(SessionEv.TURN_STARTED, this.activeTurnContext);
```

The rest of `processPrompt` remains unchanged.

- [ ] **Step 4: Update turn:start hook payload**

In `processPrompt` (around line 360-362), update the turn:start hook execution to include routing info:

```typescript
    // Hook: turn:start — read-only, fire-and-forget
    if (this.middlewareChain) {
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
    }
```

- [ ] **Step 5: Add queueItems getter**

After the `promptRunning` getter (around line 234), add:

```typescript
  /** Snapshot of pending queue items — for queue state API */
  get queueItems() {
    return this.queue.pendingItems;
  }
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | head -30`

Expected: Should compile successfully (or errors only in unrelated files).

- [ ] **Step 7: Commit**

```bash
git add src/core/sessions/session.ts
git commit -m "feat(session): split userPrompt/finalPrompt in enqueue and process pipeline

enqueuePrompt saves original text before agent:beforePrompt middleware runs.
processPrompt receives both and seals them into enriched TurnContext.
turn:start hook payload now includes routing info."
```

---

### Task 4: EventBus payloads — enrich

**Files:**
- Modify: `src/core/event-bus.ts`

- [ ] **Step 1: Add TurnSender import and update event payloads**

Add import at top of `src/core/event-bus.ts`:

```typescript
import type { TurnSender } from "./sessions/turn-context.js";
```

Replace the `message:queued`, `message:processing`, and `agent:event` entries:

```typescript
  // Cross-adapter input visibility (SSE clients see messages from other adapters)
  "message:queued": (data: {
    sessionId: string;
    turnId: string;
    text: string;
    sourceAdapterId: string;
    attachments?: unknown[];
    timestamp: string;
    queueDepth: number;
    /** Sender identity — null if identity plugin not loaded or user not registered */
    sender?: TurnSender | null;
  }) => void;
  "message:processing": (data: {
    sessionId: string;
    turnId: string;
    sourceAdapterId: string;
    /** Original prompt text (after message:incoming, before agent:beforePrompt) */
    userPrompt: string;
    /** Processed prompt text (after agent:beforePrompt middleware) */
    finalPrompt: string;
    attachments?: unknown[];
    /** Sender identity — null if identity plugin not loaded or user not registered */
    sender?: TurnSender | null;
    timestamp: string;
  }) => void;
```

Replace the `agent:event` entry:

```typescript
  "agent:event": (data: { sessionId: string; turnId: string; event: AgentEvent }) => void;
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | head -30`

Expected: Build errors in `session-bridge.ts` and `core.ts` because their emit calls don't match the new required fields. This is expected — fixed in Tasks 5 and 6.

- [ ] **Step 3: Commit**

```bash
git add src/core/event-bus.ts
git commit -m "feat(event-bus): enrich message:queued, message:processing, and agent:event payloads

message:queued gains sender field. message:processing gains userPrompt,
finalPrompt, attachments, sender. agent:event gains turnId."
```

---

### Task 5: SessionBridge — remove source conditions + enrich payloads

**Files:**
- Modify: `src/core/sessions/session-bridge.ts`

- [ ] **Step 1: Add extractSender import**

Add to the imports at top of `src/core/sessions/session-bridge.ts`:

```typescript
import { extractSender } from "./turn-context.js";
```

(If `turn-context.js` is already imported, just add `extractSender` to the existing import.)

- [ ] **Step 2: Update TURN_STARTED handler — remove SSE condition, enrich payload**

Replace the TURN_STARTED handler block (around line 205-216):

```typescript
    // Wire turn_started: emit message:processing on EventBus so all clients
    // (including other connected App windows) can show the streaming assistant stub.
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

- [ ] **Step 3: Update handleAgentEvent — add turnId to AGENT_EVENT**

In `handleAgentEvent` (around line 406-409), update the EventBus emission:

```typescript
      this.deps.eventBus?.emit(BusEvent.AGENT_EVENT, {
        sessionId: this.session.id,
        turnId: this.session.activeTurnContext?.turnId ?? '',
        event,
      });
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | head -30`

Expected: Build errors in `core.ts` because MESSAGE_QUEUED emission doesn't include `sender`. Fixed in Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/core/sessions/session-bridge.ts
git commit -m "feat(session-bridge): remove SSE source condition, enrich MESSAGE_PROCESSING and AGENT_EVENT

MESSAGE_PROCESSING now emitted for all sources with userPrompt, finalPrompt,
attachments, and sender. AGENT_EVENT includes turnId for client correlation."
```

---

### Task 6: MiddlewarePayloadMap — add optional fields to turn:start

**Files:**
- Modify: `src/core/plugin/types.ts`

- [ ] **Step 1: Update turn:start payload type**

Find the `'turn:start'` entry in `MiddlewarePayloadMap` (around line 544-550) and add the new optional fields:

```typescript
  'turn:start': {
    sessionId: string
    promptText: string
    promptNumber: number
    turnId: string
    meta?: TurnMeta
    /** Original prompt text before agent:beforePrompt middleware */
    userPrompt?: string
    /** Adapter that originated this prompt */
    sourceAdapterId?: string
    /** Where the response is routed */
    responseAdapterId?: string | null
  }
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | head -30`

Expected: Passes or only errors in core.ts (MESSAGE_QUEUED missing sender — Task 7).

- [ ] **Step 3: Commit**

```bash
git add src/core/plugin/types.ts
git commit -m "feat(plugin-types): add optional routing fields to turn:start hook payload

New optional fields: userPrompt, sourceAdapterId, responseAdapterId.
Backward compatible — existing plugins unaffected."
```

---

### Task 7: core.ts — unified _dispatchToSession + refactor handleMessage/handleMessageInSession

**Files:**
- Modify: `src/core/core.ts`

This is the largest task. The engineer must read the existing `handleMessage` (line 383) and `handleMessageInSession` (line 500) methods carefully before editing.

- [ ] **Step 1: Add extractSender import**

Add to the imports at top of `src/core/core.ts`:

```typescript
import { extractSender } from "./sessions/turn-context.js";
```

(If `turn-context.js` is already imported from the sessions directory, add `extractSender` to the existing import.)

- [ ] **Step 2: Add _dispatchToSession private method**

Add this method to the `VibenCore` class, just before `handleMessageInSession`:

```typescript
  /**
   * Shared dispatch path for sending a prompt to a session.
   * Called by both handleMessage (Telegram) and handleMessageInSession (SSE/API)
   * after their respective middleware/enrichment steps.
   */
  private async _dispatchToSession(
    session: Session,
    text: string,
    attachments: Attachment[] | undefined,
    routing: TurnRouting,
    turnId: string,
    meta: TurnMeta,
  ): Promise<void> {
    // Update activity timestamp for all sources
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

- [ ] **Step 3: Refactor handleMessage — use _dispatchToSession**

In `handleMessage` (starting around line 383), make these changes:

1. **Remove** the `lastActiveAt` patch block (around line 444-447):
```typescript
// DELETE these lines:
    // Update activity timestamp
    this.sessionManager.patchRecord(session.id, {
      lastActiveAt: new Date().toISOString(),
    });
```

2. **Replace** the entire MESSAGE_QUEUED + enqueuePrompt block (around line 458-485) with a single `_dispatchToSession` call:
```typescript
    // Replace the old skip-for-sse/api conditional + enqueuePrompt with:
    await this._dispatchToSession(session, text, message.attachments, {
      sourceAdapterId: message.routing?.sourceAdapterId ?? message.channelId,
      responseAdapterId: message.routing?.responseAdapterId,
    }, turnId, enrichedMeta);
```

Remove the old code that had `if (sourceAdapterId && sourceAdapterId !== 'sse' && sourceAdapterId !== 'api')` and the duplicated `await session.enqueuePrompt(...)` calls.

Also remove the now-unused `sourceAdapterId` and `routing` local variables that were only used for the old conditional block.

- [ ] **Step 4: Refactor handleMessageInSession — return {turnId, queueDepth}, use _dispatchToSession**

Replace the entire `handleMessageInSession` method (starting around line 500):

```typescript
  /**
   * Send a message to a known session, running the full message:incoming → agent:beforePrompt
   * middleware chain (same as handleMessage) but without the threadId-based session lookup.
   *
   * Used by channels that already hold a direct session reference (e.g. SSE adapter, api-server),
   * where looking up by channelId+threadId is unreliable (API sessions may have no threadId).
   *
   * @param session  The target session — caller is responsible for validating its status.
   * @param message  Sender context and message content.
   * @param initialMeta  Optional adapter-specific context to seed the TurnMeta bag
   *                     (e.g. channelUser with display name/username).
   * @param options  Optional turnId override and response routing.
   */
  async handleMessageInSession(
    session: Session,
    message: { channelId: string; userId: string; text: string; attachments?: Attachment[] },
    initialMeta?: Record<string, unknown>,
    options?: { externalTurnId?: string; responseAdapterId?: string | null },
  ): Promise<{ turnId: string; queueDepth: number }> {
    const turnId = options?.externalTurnId ?? nanoid(8);
    const meta: TurnMeta = { turnId, ...initialMeta };

    // Run message:incoming middleware so plugins can enrich meta (sender identity, @mentions, etc.)
    let text = message.text;
    let { attachments } = message;
    let enrichedMeta: TurnMeta = meta;
    if (this.lifecycleManager?.middlewareChain) {
      const payload = {
        channelId: message.channelId,
        threadId: session.id,
        userId: message.userId,
        text,
        attachments,
        meta,
      };
      const result = await this.lifecycleManager.middlewareChain.execute(
        Hook.MESSAGE_INCOMING,
        payload,
        async (p) => p,
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

- [ ] **Step 5: Verify build**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | head -30`

Expected: Build errors in `api-server/routes/sessions.ts` and `sse-adapter/routes.ts` because `handleMessageInSession` return type changed from `void` to `{ turnId, queueDepth }` and signature has new `options` parameter. Fixed in Tasks 8 and 9.

- [ ] **Step 6: Commit**

```bash
git add src/core/core.ts
git commit -m "feat(core): unify message dispatch via _dispatchToSession

Extract shared _dispatchToSession method. handleMessage and handleMessageInSession
both delegate to it. Remove source-specific MESSAGE_QUEUED skip conditions.
handleMessageInSession now returns { turnId, queueDepth } and accepts options."
```

---

### Task 8: api-server route — delegate to core

**Files:**
- Modify: `src/plugins/api-server/routes/sessions.ts`

- [ ] **Step 1: Replace POST /prompt handler body**

Find the POST /prompt handler (around line 218). Replace the section from `const sourceAdapterId` through the `return` statement (approximately lines 257-296). Remove the inline `message:incoming` middleware execution and `MESSAGE_QUEUED` emission. Replace with delegation to core:

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

Remove the now-unused imports/variables: `Hook`, `nanoid`, `BusEvent` (if only used here), and the `meta`, `turnId` locals that were previously declared.

**Important:** Keep the session lookup, status check, and attachment resolution code above this block unchanged.

- [ ] **Step 2: Add GET /queue route**

Add this route handler after the POST /prompt handler:

```typescript
  // GET /sessions/:sessionId/queue — get pending queue state
  app.get<{ Params: { sessionId: string } }>(
    '/:sessionId/queue',
    { preHandler: requireScopes('sessions:read') },
    async (request) => {
      const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
      const sessionId = decodeURIComponent(rawId);
      const session = await deps.core.getOrResumeSessionById(sessionId);
      if (!session) {
        throw new NotFoundError(
          'SESSION_NOT_FOUND',
          `Session "${sessionId}" not found`,
        );
      }
      return {
        pending: session.queueItems,
        processing: session.promptRunning,
        queueDepth: session.queueDepth,
      };
    },
  );
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | head -30`

Expected: Build errors only in `sse-adapter/routes.ts` (fixed in Task 9), or clean build.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/api-server/routes/sessions.ts
git commit -m "feat(api-server): delegate POST /prompt to core, add GET /queue endpoint

POST /prompt no longer runs message:incoming middleware or emits MESSAGE_QUEUED
directly — delegates to core.handleMessageInSession for unified flow.
New GET /queue endpoint returns pending queue state."
```

---

### Task 9: SSE adapter route — use return value

**Files:**
- Modify: `src/plugins/sse-adapter/routes.ts`

- [ ] **Step 1: Update POST /prompt handler**

Find the POST /prompt handler (around line 106). Replace the section from `const queueDepth` through the return statement (approximately lines 139-152):

```typescript
      const userId = (request as any).auth?.tokenId ?? 'api';
      const { turnId, queueDepth } = await deps.core.handleMessageInSession(
        session,
        { channelId: 'sse', userId, text: body.prompt, attachments },
        { channelUser: { channelId: 'sse', userId } },
      );

      return { ok: true, sessionId, queueDepth, turnId };
```

Remove the now-unused `queueDepth` snapshot line that was before the `handleMessageInSession` call.

- [ ] **Step 2: Verify full build**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build`

Expected: Clean build — all compile errors resolved.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/sse-adapter/routes.ts
git commit -m "feat(sse-adapter): use handleMessageInSession return value, include turnId in response"
```

---

### Task 10: Update existing tests

**Files:**
- Modify: `src/plugins/api-server/__tests__/routes-sessions.test.ts`
- Modify: `src/plugins/sse-adapter/__tests__/routes.test.ts`

- [ ] **Step 1: Update api-server test mocks**

In `src/plugins/api-server/__tests__/routes-sessions.test.ts`, the mock for `deps.core` needs `handleMessageInSession` to return `{ turnId, queueDepth }` instead of `void`. Find the mock setup and update:

```typescript
// Find the handleMessageInSession mock and update it:
handleMessageInSession: vi.fn().mockResolvedValue({ turnId: 'test-turn', queueDepth: 0 }),
```

Also update any test that checks the POST /prompt response to expect `turnId` in the response body.

Remove any test assertions about `deps.lifecycleManager.middlewareChain.execute` being called from the POST /prompt handler (this middleware is now executed inside core, not in the route).

Remove any test assertions about `BusEvent.MESSAGE_QUEUED` being emitted from the POST /prompt handler (now emitted from core).

- [ ] **Step 2: Update sse-adapter test mocks**

In `src/plugins/sse-adapter/__tests__/routes.test.ts`, update the mock for `handleMessageInSession`:

```typescript
// Find the handleMessageInSession mock and update it:
handleMessageInSession: vi.fn().mockResolvedValue({ turnId: 'test-turn', queueDepth: 0 }),
```

Update tests to check that the response now includes `turnId`.

- [ ] **Step 3: Run tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- --run 2>&1 | tail -30`

Expected: All tests pass, or only unrelated tests fail.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/api-server/__tests__/routes-sessions.test.ts src/plugins/sse-adapter/__tests__/routes.test.ts
git commit -m "test: update api-server and sse-adapter tests for unified dispatch flow

Update mocks for handleMessageInSession return type change.
Remove assertions about inline middleware/event emission (now in core)."
```

---

### Task 11: Run full test suite + manual verification

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- --run`

Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build`

Expected: Clean build.

- [ ] **Step 3: Verify key behaviors with a quick read-through**

Read through these files to confirm the unified flow:
1. `src/core/core.ts` — `_dispatchToSession` called from both `handleMessage` and `handleMessageInSession`
2. `src/core/sessions/session.ts` — `enqueuePrompt` saves `userPrompt` before middleware
3. `src/core/sessions/session-bridge.ts` — no 'sse' condition on MESSAGE_PROCESSING
4. `src/plugins/api-server/routes/sessions.ts` — no inline middleware or MESSAGE_QUEUED emission
5. `src/plugins/sse-adapter/routes.ts` — returns `turnId` in response

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: address test/build issues from unified turn lifecycle"
```
