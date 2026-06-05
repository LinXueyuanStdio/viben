# Prompt Queue Cancel & Flush Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the abort race condition in PromptQueue (drainNext fires before cancel reaches agent), add `/clearqueue` and `/flush` commands so users can manage queued prompts, and prevent the "offset response" bug where stale queued messages process out of user expectation.

**Architecture:** Three new Session methods (`clearQueue`, `flushAll`, `abortPrompt` fix) expose queue management. Two new chat commands (`/clearqueue`, `/flush`) surface them to users. The PromptQueue gains a `clearPending()` method that discards queued items without touching the in-flight prompt. The existing `abortPrompt()` is reordered: cancel agent first (with timeout), then abort queue — preventing the orphaned-processPrompt race.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Add `clearPending()` to PromptQueue

**Files:**
- Modify: `src/core/sessions/prompt-queue.ts`
- Test: `src/core/sessions/__tests__/prompt-queue.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/core/sessions/__tests__/prompt-queue.test.ts`:

```typescript
it('clearPending discards queued items without aborting current', async () => {
  let resolveFirst!: () => void
  const firstPromise = new Promise<void>((r) => { resolveFirst = r })
  const calls: string[] = []

  const processor = vi.fn().mockImplementation(async (text: string) => {
    calls.push(text)
    if (text === 'first') await firstPromise
  })

  const queue = new PromptQueue(processor)

  const p1 = queue.enqueue('first')
  const p2 = queue.enqueue('second')
  const p3 = queue.enqueue('third')

  expect(queue.pending).toBe(2)

  // Clear pending — should discard second and third, but NOT abort first
  queue.clearPending()
  expect(queue.pending).toBe(0)
  expect(queue.isProcessing).toBe(true)

  // Resolve first — should complete without processing second/third
  resolveFirst()
  await p1
  // p2 and p3 should also resolve (not hang)
  await p2
  await p3

  expect(calls).toEqual(['first'])
  expect(queue.isProcessing).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/core/sessions/__tests__/prompt-queue.test.ts -t "clearPending"`
Expected: FAIL — `queue.clearPending is not a function`

- [ ] **Step 3: Implement `clearPending()`**

Add to `src/core/sessions/prompt-queue.ts`, after the `clear()` method:

```typescript
/**
 * Discard all queued prompts without aborting the in-flight prompt.
 * The currently processing prompt continues to completion; only pending
 * (not-yet-started) items are removed. Their promises are resolved
 * (not rejected) so callers don't see unhandled rejections.
 */
clearPending(): void {
  for (const item of this.queue) {
    item.resolve()
  }
  this.queue = []
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/core/sessions/__tests__/prompt-queue.test.ts -t "clearPending"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/sessions/prompt-queue.ts src/core/sessions/__tests__/prompt-queue.test.ts && git commit -m "feat(queue): add clearPending() to discard queued prompts without aborting current"
```

---

### Task 2: Fix `abortPrompt()` race condition

**Files:**
- Modify: `src/core/sessions/session.ts`
- Test: `src/core/sessions/__tests__/prompt-queue.test.ts`

The current `abortPrompt()` calls `queue.abortCurrent()` before `agentInstance.cancel()`. Because `abortCurrent()` triggers a synchronous abort signal, the `process()` finally block runs as a microtask and calls `drainNext()` — starting the NEXT queued prompt BEFORE the cancel reaches the agent. This creates concurrent `agentInstance.prompt()` calls.

Fix: cancel agent first (with 5s timeout), then abort queue.

- [ ] **Step 1: Write the failing test for abort ordering**

Add to `src/core/sessions/__tests__/prompt-queue.test.ts`:

```typescript
it('clear() prevents drainNext from picking up items', async () => {
  let resolveFirst!: () => void
  const firstPromise = new Promise<void>((r) => { resolveFirst = r })
  const calls: string[] = []

  const processor = vi.fn().mockImplementation(async (text: string) => {
    calls.push(text)
    if (text === 'first') await firstPromise
  })

  const queue = new PromptQueue(processor)

  queue.enqueue('first')
  queue.enqueue('second')
  queue.enqueue('third')

  expect(queue.pending).toBe(2)

  // clear() should abort current AND discard pending
  queue.clear()

  // After clear, drainNext should find empty queue
  // Wait for microtasks to settle
  await new Promise(r => setTimeout(r, 10))

  // "first" was started but second/third should NOT have been processed
  expect(calls).toEqual(['first'])
  expect(queue.isProcessing).toBe(false)
  expect(queue.pending).toBe(0)
})
```

- [ ] **Step 2: Run test to verify it passes (existing clear() already works)**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/core/sessions/__tests__/prompt-queue.test.ts -t "clear\\(\\) prevents"`
Expected: PASS — this validates the existing `clear()` behavior.

- [ ] **Step 3: Fix `abortPrompt()` in session.ts**

In `src/core/sessions/session.ts`, replace the `abortPrompt()` method:

```typescript
/** Cancel the current prompt. Queued prompts continue processing. Stays in active state. */
async abortPrompt(): Promise<void> {
  // Hook: agent:beforeCancel — modifiable, can block
  if (this.middlewareChain) {
    const result = await this.middlewareChain.execute(Hook.AGENT_BEFORE_CANCEL, { sessionId: this.id }, async (p) => p);
    if (!result) return; // blocked by middleware
  }
  const turnId = this.activeTurnContext?.turnId;
  if (turnId) this._abortedTurnIds.add(turnId);

  // Cancel agent FIRST so the orphaned processPrompt resolves before
  // drainNext starts the next item. Timeout prevents hanging if agent
  // is unresponsive — queue abort proceeds regardless after 5 seconds.
  await Promise.race([
    this.agentInstance.cancel().catch(() => {}),
    new Promise<void>((r) => setTimeout(r, 5000)),
  ]);

  this.queue.abortCurrent();
  this.log.info("Prompt aborted (queue preserved, %d pending)", this.queue.pending);
}
```

- [ ] **Step 4: Run existing session tests to verify nothing breaks**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/core/sessions/__tests__/ --reporter=verbose 2>&1 | tail -30`
Expected: all existing tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/sessions/session.ts src/core/sessions/__tests__/prompt-queue.test.ts && git commit -m "fix(session): cancel agent before aborting queue to prevent orphaned processPrompt race"
```

---

### Task 3: Add `clearQueue()` and `flushAll()` to Session

**Files:**
- Modify: `src/core/sessions/session.ts`

- [ ] **Step 1: Add `clearQueue()` method**

Add to `src/core/sessions/session.ts`, after the `abortPrompt()` method:

```typescript
/** Discard all queued prompts without interrupting the in-flight prompt. */
clearQueue(): void {
  const dropped = this.queue.pending;
  this.queue.clearPending();
  this.log.info("Queue cleared (%d pending prompts discarded)", dropped);
}
```

- [ ] **Step 2: Add `flushAll()` method**

Add right after `clearQueue()`:

```typescript
/**
 * Cancel the in-flight prompt AND discard all queued prompts.
 * Full reset — nothing remains in the pipeline after this call.
 */
async flushAll(): Promise<void> {
  // Hook: agent:beforeCancel — modifiable, can block
  if (this.middlewareChain) {
    const result = await this.middlewareChain.execute(Hook.AGENT_BEFORE_CANCEL, { sessionId: this.id }, async (p) => p);
    if (!result) return; // blocked by middleware
  }
  const turnId = this.activeTurnContext?.turnId;
  if (turnId) this._abortedTurnIds.add(turnId);

  // Cancel agent first, then clear everything
  await Promise.race([
    this.agentInstance.cancel().catch(() => {}),
    new Promise<void>((r) => setTimeout(r, 5000)),
  ]);

  this.queue.clear();
  this.log.info("Session flushed (prompt cancelled, queue cleared)");
}
```

- [ ] **Step 3: Run existing tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/core/sessions/__tests__/ --reporter=verbose 2>&1 | tail -20`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/sessions/session.ts && git commit -m "feat(session): add clearQueue() and flushAll() methods for queue management"
```

---

### Task 4: Register `/clearqueue` and `/flush` commands

**Files:**
- Modify: `src/core/commands/session.ts`

- [ ] **Step 1: Add `/clearqueue` command**

In `src/core/commands/session.ts`, add after the `/cancel` registration block (after line 55):

```typescript
registry.register({
  name: 'clearqueue',
  description: 'Discard all queued prompts (keeps current prompt running)',
  category: 'system',
  handler: async (args) => {
    if (args.sessionId) {
      const session = core.sessionManager.getSession(args.sessionId)
      if (session) {
        const dropped = session.queueDepth
        if (dropped === 0) {
          return { type: 'text', text: 'Queue is already empty.' }
        }
        session.clearQueue()
        return { type: 'text', text: `🗑️ Cleared ${dropped} queued prompt${dropped > 1 ? 's' : ''}.` }
      }
    }
    return { type: 'error', message: 'No active session in this topic.' }
  },
})
```

- [ ] **Step 2: Add `/flush` command**

Add right after the `/clearqueue` block:

```typescript
registry.register({
  name: 'flush',
  description: 'Cancel current prompt and clear all queued prompts',
  category: 'system',
  handler: async (args) => {
    if (args.sessionId) {
      const session = core.sessionManager.getSession(args.sessionId)
      if (session) {
        await session.flushAll()
        session.markCancelled()
        return { type: 'text', text: '🔄 Session flushed — prompt cancelled, queue cleared.' }
      }
    }
    return { type: 'error', message: 'No active session in this topic.' }
  },
})
```

- [ ] **Step 3: Build to check for compile errors**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | tail -10`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/commands/session.ts && git commit -m "feat(commands): add /clearqueue and /flush commands for queue management"
```

---

### Task 5: Add `/clearqueue` and `/flush` to API routes

**Files:**
- Modify: `src/plugins/api-server/routes/sessions.ts`

- [ ] **Step 1: Find the existing cancel endpoint and add queue operations**

In `src/plugins/api-server/routes/sessions.ts`, find the `POST /:sessionId/cancel` endpoint (or the PATCH endpoint that calls `abortPrompt`). Add `clearQueue` and `flush` as action options in the existing cancel/action endpoint.

Search for the cancel-related route:

```bash
cd /Users/lucas/code/viben-workspace/Viben && grep -n "cancel\|abort\|action" src/plugins/api-server/routes/sessions.ts | head -20
```

Add `clearQueue` and `flushAll` as supported actions alongside the existing cancel action. The exact integration depends on the existing route structure — check if there's a `POST /:sessionId/cancel` or a generic action endpoint.

If the API uses a `POST /:sessionId/cancel` pattern, add parallel routes:

```typescript
// POST /sessions/:sessionId/clear-queue — discard queued prompts
app.post<{ Params: { sessionId: string } }>(
  '/:sessionId/clear-queue',
  { preHandler: requireScopes('sessions:write') },
  async (request) => {
    const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
    const sessionId = decodeURIComponent(rawId);
    const session = await deps.core.getOrResumeSessionById(sessionId);
    if (!session) {
      throw new NotFoundError('SESSION_NOT_FOUND', `Session "${sessionId}" not found`);
    }
    const dropped = session.queueDepth;
    session.clearQueue();
    return { ok: true, dropped };
  },
);

// POST /sessions/:sessionId/flush — cancel + clear queue
app.post<{ Params: { sessionId: string } }>(
  '/:sessionId/flush',
  { preHandler: requireScopes('sessions:write') },
  async (request) => {
    const { sessionId: rawId } = SessionIdParamSchema.parse(request.params);
    const sessionId = decodeURIComponent(rawId);
    const session = await deps.core.getOrResumeSessionById(sessionId);
    if (!session) {
      throw new NotFoundError('SESSION_NOT_FOUND', `Session "${sessionId}" not found`);
    }
    await session.flushAll();
    return { ok: true };
  },
);
```

- [ ] **Step 2: Build to check for compile errors**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | tail -10`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/plugins/api-server/routes/sessions.ts && git commit -m "feat(api): add clear-queue and flush endpoints for queue management"
```

---

### Task 6: Full integration test

**Files:**
- Test: `src/core/sessions/__tests__/prompt-queue.test.ts`

- [ ] **Step 1: Add integration test for abort-then-enqueue flow**

Add to `src/core/sessions/__tests__/prompt-queue.test.ts`:

```typescript
it('abort + clear prevents offset responses', async () => {
  let resolveFirst!: () => void
  const firstPromise = new Promise<void>((r) => { resolveFirst = r })
  const calls: string[] = []

  const processor = vi.fn().mockImplementation(async (text: string) => {
    calls.push(text)
    if (text === 'stuck') await firstPromise
  })

  const queue = new PromptQueue(processor)

  // Simulate: stuck prompt + queued messages
  queue.enqueue('stuck')
  queue.enqueue('queued-1')
  queue.enqueue('queued-2')

  expect(queue.pending).toBe(2)
  expect(queue.isProcessing).toBe(true)

  // User does /flush: clear everything
  queue.clear()
  expect(queue.pending).toBe(0)

  // Resolve the stuck prompt (simulates agent responding to cancel)
  resolveFirst()
  await new Promise(r => setTimeout(r, 10))

  expect(queue.isProcessing).toBe(false)

  // User sends fresh message — should process immediately, no offset
  const freshPromise = queue.enqueue('fresh')
  await freshPromise

  expect(calls).toEqual(['stuck', 'fresh'])
})
```

- [ ] **Step 2: Run the test**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/core/sessions/__tests__/prompt-queue.test.ts -t "offset"`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test 2>&1 | tail -20`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/sessions/__tests__/prompt-queue.test.ts && git commit -m "test(queue): add integration test for abort+clear preventing offset responses"
```
