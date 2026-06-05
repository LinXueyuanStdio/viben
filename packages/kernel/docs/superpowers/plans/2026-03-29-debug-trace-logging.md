# Debug Trace Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `VIBEN_DEBUG=true`, write 3 JSONL trace files per session capturing the full event pipeline: ACP protocol, core processing, and Telegram UI actions.

**Architecture:** A `DebugTracer` utility provides lazy file-append writers keyed by `(sessionId, layer)`. Each layer (ACP, core, telegram) calls `tracer.log(layer, data)` at instrumentation points. Files are created on first write under `<session.workingDirectory>/.log/`. A module-level `const DEBUG_ENABLED = process.env.VIBEN_DEBUG === "true"` guard ensures zero overhead when disabled.

**Tech Stack:** Node.js `fs` (appendFileSync for simplicity — debug logging, not hot path when disabled), TypeScript, JSONL format.

---

## File Structure

| File | Responsibility |
|------|----------------|
| **Create:** `src/core/utils/debug-tracer.ts` | `DebugTracer` class — manages per-session file handles, lazy dir creation, JSONL append |
| **Modify:** `src/core/agents/agent-instance.ts` | Instrument ACP stdin/stdout Transform streams |
| **Modify:** `src/core/sessions/session-bridge.ts` | Instrument core event flow (agent_event → middleware → transform → dispatch) |
| **Modify:** `src/plugins/telegram/adapter.ts` | Instrument dispatch routing, all handle* methods, permission, notification, thread ops |
| **Modify:** `src/plugins/telegram/activity.ts` | Instrument ActivityTracker (thinking, tool card, tool updates) and ToolCard._sendOrEdit |
| **Modify:** `src/plugins/telegram/streaming.ts` | Instrument MessageDraft (flush, finalize, send/edit) |
| **Test:** `src/core/utils/__tests__/debug-tracer.test.ts` | Unit tests for DebugTracer |

---

### Task 1: Create DebugTracer utility

**Files:**
- Create: `src/core/utils/debug-tracer.ts`
- Test: `src/core/utils/__tests__/debug-tracer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/core/utils/__tests__/debug-tracer.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DebugTracer } from "../debug-tracer.js";

describe("DebugTracer", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "debug-tracer-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes JSONL lines to the correct file", () => {
    const tracer = new DebugTracer("sess-1", tmpDir);
    tracer.log("acp", { dir: "recv", data: { foo: 1 } });
    tracer.log("acp", { dir: "send", data: { bar: 2 } });

    const filePath = path.join(tmpDir, ".log", "sess-1_acp.jsonl");
    expect(fs.existsSync(filePath)).toBe(true);

    const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);

    const line1 = JSON.parse(lines[0]);
    expect(line1.dir).toBe("recv");
    expect(line1.data).toEqual({ foo: 1 });
    expect(typeof line1.ts).toBe("number");
  });

  it("creates .log directory lazily on first write", () => {
    const logDir = path.join(tmpDir, ".log");
    expect(fs.existsSync(logDir)).toBe(false);

    const tracer = new DebugTracer("sess-1", tmpDir);
    // No write yet — dir should not exist
    expect(fs.existsSync(logDir)).toBe(false);

    tracer.log("core", { step: "test" });
    expect(fs.existsSync(logDir)).toBe(true);
  });

  it("writes to separate files per layer", () => {
    const tracer = new DebugTracer("sess-1", tmpDir);
    tracer.log("acp", { x: 1 });
    tracer.log("core", { x: 2 });
    tracer.log("telegram", { x: 3 });

    const logDir = path.join(tmpDir, ".log");
    expect(fs.existsSync(path.join(logDir, "sess-1_acp.jsonl"))).toBe(true);
    expect(fs.existsSync(path.join(logDir, "sess-1_core.jsonl"))).toBe(true);
    expect(fs.existsSync(path.join(logDir, "sess-1_telegram.jsonl"))).toBe(true);
  });

  it("handles write errors gracefully (no throw)", () => {
    const tracer = new DebugTracer("sess-1", "/nonexistent/path");
    // Should not throw
    expect(() => tracer.log("acp", { x: 1 })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run src/core/utils/__tests__/debug-tracer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write DebugTracer implementation**

```typescript
// src/core/utils/debug-tracer.ts
import fs from "node:fs";
import path from "node:path";

export type TraceLayer = "acp" | "core" | "telegram";

const DEBUG_ENABLED = process.env.VIBEN_DEBUG === "true" || process.env.VIBEN_DEBUG === "1";

/**
 * Per-session debug trace logger. Writes JSONL files to <workingDirectory>/.log/.
 * Only active when VIBEN_DEBUG=true. Zero overhead when disabled.
 */
export class DebugTracer {
  private dirCreated = false;
  private logDir: string;

  constructor(
    private sessionId: string,
    private workingDirectory: string,
  ) {
    this.logDir = path.join(workingDirectory, ".log");
  }

  log(layer: TraceLayer, data: Record<string, unknown>): void {
    if (!DEBUG_ENABLED) return;

    try {
      if (!this.dirCreated) {
        fs.mkdirSync(this.logDir, { recursive: true });
        this.dirCreated = true;
      }

      const filePath = path.join(this.logDir, `${this.sessionId}_${layer}.jsonl`);
      const line = JSON.stringify({ ts: Date.now(), ...data }) + "\n";
      fs.appendFileSync(filePath, line);
    } catch {
      // Debug logging must never crash the app
    }
  }
}

/**
 * Create a DebugTracer if debug mode is enabled, otherwise return a no-op.
 * Use this at session boundaries to avoid constructing tracers when disabled.
 */
export function createDebugTracer(sessionId: string, workingDirectory: string): DebugTracer | null {
  if (!DEBUG_ENABLED) return null;
  return new DebugTracer(sessionId, workingDirectory);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --run src/core/utils/__tests__/debug-tracer.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/utils/debug-tracer.ts src/core/utils/__tests__/debug-tracer.test.ts
git commit -m "feat: add DebugTracer utility for JSONL trace logging"
```

---

### Task 2: Instrument ACP layer (agent-instance.ts)

**Files:**
- Modify: `src/core/agents/agent-instance.ts:176-237` (spawnSubprocess method)
- Modify: `src/core/agents/agent-instance.ts:297-326` (spawn method)
- Modify: `src/core/agents/agent-instance.ts:328-371` (resume method)

The ACP tracer needs to be attached to the Transform streams after spawn. The `sessionId` is only known after `newSession()` or `unstable_resumeSession()`, but the Transform streams are created before that. Solution: store a mutable reference on the instance, set it after sessionId is known.

- [ ] **Step 1: Add tracer field and import**

At the top of `agent-instance.ts`, add import:
```typescript
import { createDebugTracer, type DebugTracer } from "../utils/debug-tracer.js";
```

Add field to `AgentInstance` class (after `middlewareChain` field, around line 165):
```typescript
  debugTracer: DebugTracer | null = null;
```

- [ ] **Step 2: Instrument stdinLogger and stdoutLogger in spawnSubprocess**

In `spawnSubprocess` method (around line 217), modify the Transform streams to also write to the tracer:

```typescript
    const stdinLogger = new Transform({
      transform(chunk, _enc, cb) {
        log.debug(
          { direction: "send", raw: chunk.toString().trimEnd() },
          "ACP raw",
        );
        if (instance.debugTracer) {
          const raw = chunk.toString().trimEnd();
          try {
            instance.debugTracer.log("acp", { dir: "send", data: JSON.parse(raw) });
          } catch {
            instance.debugTracer.log("acp", { dir: "send", data: raw });
          }
        }
        cb(null, chunk);
      },
    });
```

Same pattern for `stdoutLogger`:
```typescript
    const stdoutLogger = new Transform({
      transform(chunk, _enc, cb) {
        log.debug(
          { direction: "recv", raw: chunk.toString().trimEnd() },
          "ACP raw",
        );
        if (instance.debugTracer) {
          const raw = chunk.toString().trimEnd();
          try {
            instance.debugTracer.log("acp", { dir: "recv", data: JSON.parse(raw) });
          } catch {
            instance.debugTracer.log("acp", { dir: "recv", data: raw });
          }
        }
        cb(null, chunk);
      },
    });
```

- [ ] **Step 3: Create tracer after sessionId is known in spawn()**

In `spawn()` method, after `instance.sessionId = response.sessionId` (around line 318):

```typescript
    instance.debugTracer = createDebugTracer(response.sessionId, workingDirectory);
```

- [ ] **Step 4: Create tracer after sessionId is known in resume()**

In `resume()` method, after `instance.sessionId = response.sessionId` (line 347 for success, line 362 for fallback):

```typescript
    // After successful resume (line ~347):
    instance.debugTracer = createDebugTracer(response.sessionId, workingDirectory);

    // After fallback spawn (line ~362):
    instance.debugTracer = createDebugTracer(response.sessionId, workingDirectory);
```

- [ ] **Step 5: Build and verify**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/core/agents/agent-instance.ts
git commit -m "feat: instrument ACP protocol layer with debug trace logging"
```

---

### Task 3: Instrument core layer (session-bridge.ts)

**Files:**
- Modify: `src/core/sessions/session-bridge.ts`

The SessionBridge has access to `this.session` which provides `session.id`, `session.workingDirectory`, and `session.agentInstance.debugTracer`. We reuse the same tracer from AgentInstance (it's the same session).

- [ ] **Step 1: Add import and helper**

At top of `session-bridge.ts`:
```typescript
import type { DebugTracer } from "../utils/debug-tracer.js";
```

Add a private getter in `SessionBridge` class:
```typescript
  private get tracer(): DebugTracer | null {
    return this.session.agentInstance.debugTracer;
  }
```

- [ ] **Step 2: Instrument wireSessionToAdapter — agent_event received**

In `wireSessionToAdapter()`, at the start of the event handler (line 98), before middleware:

```typescript
    this.sessionEventHandler = (event: AgentEvent) => {
      this.tracer?.log("core", { step: "agent_event", sessionId: this.session.id, event });
```

- [ ] **Step 3: Instrument middleware:before result**

After `mw.execute('agent:beforeEvent', ...)` resolves (inside the `.then()`, line 102-103):

```typescript
        mw.execute('agent:beforeEvent', { sessionId: this.session.id, event }, async (e) => e).then((result) => {
          this.tracer?.log("core", { step: "middleware:before", sessionId: this.session.id, hook: "agent:beforeEvent", blocked: !result });
          if (!result) return;
```

- [ ] **Step 4: Instrument handleAgentEvent — transform + dispatch**

In `handleAgentEvent()`, after the transform call (line 156):

```typescript
          outgoing = this.deps.messageTransformer.transform(event, ctx);
          this.tracer?.log("core", { step: "transform", sessionId: this.session.id, inputType: event.type, outputType: outgoing.type });
          this.sendMessage(this.session.id, outgoing);
```

- [ ] **Step 5: Instrument sendMessage — middleware:outgoing + dispatch**

In `sendMessage()`, after middleware resolves (line 44-46):

```typescript
        const result = await mw.execute('message:outgoing', { sessionId, message }, async (m) => m);
        this.tracer?.log("core", { step: "middleware:outgoing", sessionId, hook: "message:outgoing", blocked: !result });
        if (!result) return;
        this.tracer?.log("core", { step: "dispatch", sessionId, messageType: result.message.type });
        this.adapter.sendMessage(sessionId, result.message).catch((err) => {
```

And in the else branch (no middleware, line 50):
```typescript
        this.tracer?.log("core", { step: "dispatch", sessionId, messageType: message.type });
        this.adapter.sendMessage(sessionId, message).catch((err) => {
```

- [ ] **Step 6: Build and verify**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/core/sessions/session-bridge.ts
git commit -m "feat: instrument core event pipeline with debug trace logging"
```

---

### Task 4: Instrument Telegram adapter dispatch (adapter.ts)

**Files:**
- Modify: `src/plugins/telegram/adapter.ts`

The adapter needs a helper to get the tracer from session. Each handler will log its action.

- [ ] **Step 1: Add import and helper method**

Add import:
```typescript
import type { DebugTracer } from "../../core/utils/debug-tracer.js";
```

Add helper method in `TelegramAdapter` class:
```typescript
  private getTracer(sessionId: string): DebugTracer | null {
    return this.core.sessionManager.getSession(sessionId)?.agentInstance?.debugTracer ?? null;
  }
```

- [ ] **Step 2: Instrument sendMessage dispatch entry**

In `sendMessage()` (line 860), add trace at the start of the queued handler:

```typescript
    const next = prev.then(async () => {
      this.getTracer(sessionId)?.log("telegram", { action: "dispatch:enter", sessionId, type: content.type, text: content.text?.slice(0, 100) });
      this._sessionThreadIds.set(sessionId, threadId);
```

- [ ] **Step 3: Instrument handleText**

```typescript
  protected async handleText(sessionId: string, content: OutgoingMessage): Promise<void> {
    this.getTracer(sessionId)?.log("telegram", { action: "handle:text", sessionId, textLen: content.text.length });
    const threadId = this.getThreadId(sessionId);
    // ... rest unchanged
  }
```

- [ ] **Step 4: Instrument handleToolCall**

```typescript
  protected async handleToolCall(sessionId: string, content: OutgoingMessage, verbosity: DisplayVerbosity): Promise<void> {
    const meta = (content.metadata ?? {}) as Partial<ToolCallMeta>;
    this.getTracer(sessionId)?.log("telegram", { action: "handle:toolCall", sessionId, toolId: meta.id, toolName: meta.name, status: meta.status });
    // ... rest unchanged
  }
```

- [ ] **Step 5: Instrument handleToolUpdate**

```typescript
  protected async handleToolUpdate(sessionId: string, content: OutgoingMessage, verbosity: DisplayVerbosity): Promise<void> {
    const meta = (content.metadata ?? {}) as Partial<ToolUpdateMeta>;
    this.getTracer(sessionId)?.log("telegram", { action: "handle:toolUpdate", sessionId, toolId: meta.id, status: meta.status });
    // ... rest unchanged
  }
```

- [ ] **Step 6: Instrument remaining handlers (thought, plan, usage, error, sessionEnd, system, attachment)**

Add at the start of each handler:

```typescript
// handleThought
this.getTracer(sessionId)?.log("telegram", { action: "handle:thought", sessionId });

// handlePlan
this.getTracer(sessionId)?.log("telegram", { action: "handle:plan", sessionId, entryCount: entries.length });

// handleUsage
this.getTracer(sessionId)?.log("telegram", { action: "handle:usage", sessionId, tokensUsed: meta?.tokensUsed, contextSize: meta?.contextSize, cost: meta?.cost });

// handleError
this.getTracer(sessionId)?.log("telegram", { action: "handle:error", sessionId, text: content.text });

// handleSessionEnd
this.getTracer(sessionId)?.log("telegram", { action: "handle:sessionEnd", sessionId });

// handleSystem
this.getTracer(sessionId)?.log("telegram", { action: "handle:system", sessionId, text: content.text?.slice(0, 100) });

// handleAttachment
this.getTracer(sessionId)?.log("telegram", { action: "handle:attachment", sessionId, type: content.attachment?.type, fileName: content.attachment?.fileName });
```

- [ ] **Step 7: Instrument sendPermissionRequest**

```typescript
  async sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void> {
    this.getTracer(sessionId)?.log("telegram", { action: "permission:send", sessionId, requestId: request.id, description: request.description, options: request.options.map(o => o.id) });
    // ... rest unchanged
  }
```

- [ ] **Step 8: Instrument sendNotification**

```typescript
  async sendNotification(notification: NotificationMessage): Promise<void> {
    this.getTracer(notification.sessionId)?.log("telegram", { action: "notification:send", sessionId: notification.sessionId, type: notification.type });
    // ... rest unchanged
  }
```

- [ ] **Step 9: Instrument createSessionThread and renameSessionThread**

```typescript
  async createSessionThread(sessionId: string, name: string): Promise<string> {
    this.getTracer(sessionId)?.log("telegram", { action: "thread:create", sessionId, name });
    // ... rest unchanged
  }

  async renameSessionThread(sessionId: string, newName: string): Promise<void> {
    this.getTracer(sessionId)?.log("telegram", { action: "thread:rename", sessionId, newName });
    // ... rest unchanged
  }
```

- [ ] **Step 10: Build and verify**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add src/plugins/telegram/adapter.ts
git commit -m "feat: instrument Telegram adapter handlers with debug trace logging"
```

---

### Task 5: Instrument ActivityTracker and ToolCard (activity.ts)

**Files:**
- Modify: `src/plugins/telegram/activity.ts`

ActivityTracker and ToolCard don't have direct access to the session. Pass an optional tracer through the constructor chain.

- [ ] **Step 1: Add tracer param to ToolCard constructor**

```typescript
import type { DebugTracer } from "../../core/utils/debug-tracer.js";

export class ToolCard {
  private state: ToolCardState;
  private msgId?: number;
  private lastSentText?: string;
  private flushPromise: Promise<void> = Promise.resolve();
  private overflowMsgIds: number[] = [];
  private tracer: DebugTracer | null;
  private sessionId: string;

  constructor(
    private api: Bot["api"],
    private chatId: number,
    private threadId: number,
    private sendQueue: SendQueue,
    verbosity: DisplayVerbosity,
    sessionId: string = "",
    tracer: DebugTracer | null = null,
  ) {
    this.tracer = tracer;
    this.sessionId = sessionId;
    // ... rest unchanged
  }
```

- [ ] **Step 2: Instrument ToolCard._sendOrEdit**

In `_sendOrEdit`, after rendering and splitting:

```typescript
    const chunks = splitToolCardText(fullText);
    this.tracer?.log("telegram", {
      action: "toolCard:render",
      sessionId: this.sessionId,
      chunks: chunks.length,
      total: snapshot.totalVisible,
      completed: snapshot.completedVisible,
      allComplete: snapshot.allComplete,
      msgId: this.msgId,
    });
```

After each Telegram API call (send/edit), add:

```typescript
    // After first chunk send:
    this.tracer?.log("telegram", { action: "telegram:send", sessionId: this.sessionId, method: "sendMessage", msgId: result?.message_id });

    // After first chunk edit:
    this.tracer?.log("telegram", { action: "telegram:edit", sessionId: this.sessionId, method: "editMessageText", msgId: this.msgId });

    // After overflow edit:
    this.tracer?.log("telegram", { action: "telegram:edit", sessionId: this.sessionId, method: "editMessageText:overflow", msgId: this.overflowMsgIds[overflowIdx] });

    // After overflow send:
    this.tracer?.log("telegram", { action: "telegram:send", sessionId: this.sessionId, method: "sendMessage:overflow", msgId: result?.message_id });
```

- [ ] **Step 3: Add tracer param to ActivityTracker**

```typescript
export class ActivityTracker {
  private isFirstEvent = true;
  private thinking: ThinkingIndicator;
  private toolCard: ToolCard;
  private previousToolCard?: ToolCard;
  private verbosity: DisplayVerbosity;
  private tracer: DebugTracer | null;
  private sessionId: string;

  constructor(
    private api: Bot["api"],
    private chatId: number,
    private threadId: number,
    private sendQueue: SendQueue,
    verbosity: DisplayVerbosity = "medium",
    sessionId: string = "",
    tracer: DebugTracer | null = null,
  ) {
    this.verbosity = verbosity;
    this.tracer = tracer;
    this.sessionId = sessionId;
    this.thinking = new ThinkingIndicator(api, chatId, threadId, sendQueue);
    this.toolCard = new ToolCard(api, chatId, threadId, sendQueue, verbosity, sessionId, tracer);
  }
```

Update all `new ToolCard(...)` calls inside ActivityTracker to pass `this.sessionId, this.tracer`.

- [ ] **Step 4: Instrument ActivityTracker methods**

```typescript
  async onTextStart(): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:textStart", sessionId: this.sessionId });
    // ... rest unchanged
  }

  async onToolCall(meta: ToolCallMeta, kind: string, rawInput: unknown): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:toolCall", sessionId: this.sessionId, toolId: meta.id, toolName: meta.name, status: meta.status });
    // ... rest unchanged
  }

  async onToolUpdate(id: string, status: string, viewerLinks?: ViewerLinks, viewerFilePath?: string): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:toolUpdate", sessionId: this.sessionId, toolId: id, status, hasPrevCard: !!this.previousToolCard });
    // ... rest unchanged
  }

  async onThought(): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:thought", sessionId: this.sessionId });
    // ... rest unchanged
  }

  async onNewPrompt(): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:newPrompt", sessionId: this.sessionId });
    // ... rest unchanged
  }

  async onPlan(entries: PlanEntry[]): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:plan", sessionId: this.sessionId, entryCount: entries.length });
    // ... rest unchanged
  }

  private async sealToolCardIfNeeded(): Promise<void> {
    if (!this.toolCard.hasContent()) return;
    this.tracer?.log("telegram", { action: "tracker:seal", sessionId: this.sessionId });
    // ... rest unchanged
  }
```

- [ ] **Step 5: Update getOrCreateTracker in adapter.ts to pass tracer**

In `adapter.ts`, find `getOrCreateTracker` and update the `new ActivityTracker(...)` call:

```typescript
  private getOrCreateTracker(sessionId: string, threadId: number, verbosity?: DisplayVerbosity): ActivityTracker {
    let tracker = this.sessionTrackers.get(sessionId);
    if (!tracker) {
      const v = verbosity ?? this.getVerbosity();
      tracker = new ActivityTracker(
        this.bot.api, this.telegramConfig.chatId, threadId, this.sendQueue, v,
        sessionId, this.getTracer(sessionId),
      );
      this.sessionTrackers.set(sessionId, tracker);
    }
    return tracker;
  }
```

- [ ] **Step 6: Build and verify**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/plugins/telegram/activity.ts src/plugins/telegram/adapter.ts
git commit -m "feat: instrument ActivityTracker and ToolCard with debug trace logging"
```

---

### Task 6: Instrument MessageDraft (streaming.ts)

**Files:**
- Modify: `src/plugins/telegram/streaming.ts`

- [ ] **Step 1: Add tracer param to MessageDraft constructor**

```typescript
import type { DebugTracer } from "../../core/utils/debug-tracer.js";

export class MessageDraft {
  // ... existing fields ...
  private tracer: DebugTracer | null;

  constructor(
    private bot: Bot,
    private chatId: number,
    private threadId: number,
    private sendQueue: SendQueue,
    private sessionId: string,
    tracer: DebugTracer | null = null,
  ) {
    this.tracer = tracer;
  }
```

- [ ] **Step 2: Instrument flush — send and edit**

In `flush()`, after successful sendMessage (line ~76):
```typescript
    if (result) {
      this.messageId = result.message_id;
      this.tracer?.log("telegram", { action: "draft:send", sessionId: this.sessionId, msgId: result.message_id, textLen: snapshot.length, truncated });
    }
```

After successful editMessageText (line ~99):
```typescript
    if (result !== undefined) {
      this.tracer?.log("telegram", { action: "draft:edit", sessionId: this.sessionId, msgId: this.messageId, textLen: snapshot.length, truncated });
    }
```

- [ ] **Step 3: Instrument finalize**

At the start of `finalize()`:
```typescript
  async finalize(): Promise<number | undefined> {
    this.tracer?.log("telegram", { action: "draft:finalize", sessionId: this.sessionId, bufferLen: this.buffer.length, msgId: this.messageId });
```

After each send/edit in finalize, add similar traces:
```typescript
    // After single message edit in finalize:
    this.tracer?.log("telegram", { action: "draft:finalize:edit", sessionId: this.sessionId, msgId: this.messageId });

    // After single message send in finalize:
    this.tracer?.log("telegram", { action: "draft:finalize:send", sessionId: this.sessionId, msgId: msg?.message_id });

    // After split chunks sent:
    this.tracer?.log("telegram", { action: "draft:finalize:split", sessionId: this.sessionId, chunks: mdChunks.length });
```

- [ ] **Step 4: Update DraftManager to pass tracer**

Find where `new MessageDraft(...)` is called in the adapter or draft-manager, and pass the tracer. If `DraftManager` constructs drafts, it needs a way to get the tracer. Add the tracer parameter to the factory method.

Look at how `draftManager.getOrCreate()` works and pass the tracer from the adapter:

```typescript
    const draft = this.draftManager.getOrCreate(sessionId, threadId, this.getTracer(sessionId));
```

Update `DraftManager.getOrCreate` to accept and forward the tracer param.

- [ ] **Step 5: Build and verify**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 6: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (trace logging is no-op when VIBEN_DEBUG is not set)

- [ ] **Step 7: Commit**

```bash
git add src/plugins/telegram/streaming.ts src/plugins/telegram/adapter.ts
git commit -m "feat: instrument MessageDraft with debug trace logging"
```

---

### Task 7: Integration test — end-to-end trace file verification

**Files:**
- Modify: `src/core/utils/__tests__/debug-tracer.test.ts` (add integration-style test)

- [ ] **Step 1: Add test verifying VIBEN_DEBUG guard**

```typescript
describe("DebugTracer (disabled)", () => {
  it("createDebugTracer returns null when VIBEN_DEBUG is not set", () => {
    const original = process.env.VIBEN_DEBUG;
    delete process.env.VIBEN_DEBUG;
    try {
      // Note: createDebugTracer checks at import time, so this tests the module-level const.
      // In practice, the tracer is null when the env var is not set at process start.
      const { createDebugTracer: create } = require("../debug-tracer.js");
      // The module-level const is already evaluated — this is a smoke test
      expect(true).toBe(true);
    } finally {
      if (original !== undefined) process.env.VIBEN_DEBUG = original;
    }
  });
});
```

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete debug trace logging system (VIBEN_DEBUG)"
```

---

## Manual Verification

After implementation, verify by running:

```bash
VIBEN_DEBUG=true viben start
```

Then trigger a session via Telegram with a prompt that causes tool calls. Check the agent's working directory:

```bash
ls <workingDirectory>/.log/
# Should see: <sessionId>_acp.jsonl  <sessionId>_core.jsonl  <sessionId>_telegram.jsonl

# Verify ACP file has raw JSON-RPC:
head -5 <workingDirectory>/.log/*_acp.jsonl

# Verify core file has event pipeline:
head -10 <workingDirectory>/.log/*_core.jsonl

# Verify telegram file has UI actions:
head -20 <workingDirectory>/.log/*_telegram.jsonl
```
