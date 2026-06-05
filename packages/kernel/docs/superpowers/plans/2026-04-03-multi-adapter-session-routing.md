# Multi-Adapter Session Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple sessions from single adapter ownership, enabling any adapter to attach/detach from any session with turn-based response routing.

**Architecture:** Per-session multi-bridge fan-out. Each session maintains `Map<adapterId, SessionBridge>`. Incoming messages carry `sourceAdapterId` through `PromptQueue` → `TurnContext` → event tagging. Bridges filter events based on `TurnContext.responseAdapterId`. SSE attaches per-session like any adapter but can observe many/all sessions.

**Tech Stack:** TypeScript, Vitest, Node.js ESM

**Spec:** `docs/superpowers/specs/2026-04-03-multi-adapter-session-routing-design.md`

---

## File Structure

### New Files
- `src/core/sessions/turn-context.ts` — TurnContext type and event classification helpers
- `src/core/sessions/__tests__/turn-context.test.ts` — Unit tests for event classification
- `src/core/sessions/__tests__/multi-bridge-routing.test.ts` — Integration tests for multi-bridge fan-out

### Modified Files
- `src/core/types.ts` — Add `TurnRouting` to `IncomingMessage`, update `SessionRecord` with `attachedAdapters` and `platforms`
- `src/core/sessions/prompt-queue.ts` — Add `TurnRouting` metadata to queued items
- `src/core/sessions/session.ts` — Add `attachedAdapters`, `threadIds`, `activeTurnContext`; modify `enqueuePrompt` and `processPrompt`
- `src/core/sessions/session-bridge.ts` — Add `adapterId`, `shouldForward()`, turn-aware dispatch
- `src/core/sessions/permission-gate.ts` — Already idempotent (line 43: `if (this.settled) return`), no changes needed
- `src/core/sessions/session-store.ts` — Auto-migrate old `platform` → `platforms` format on load
- `src/core/sessions/session-manager.ts` — Update `getSessionByThread()` for multi-adapter `threadIds`
- `src/core/sessions/session-factory.ts` — Resume creates bridges for all `attachedAdapters`
- `src/core/core.ts` — Multi-bridge creation, `attachAdapter()`, `detachAdapter()`, update `createSession()` pipeline
- `src/core/agent-switch-handler.ts` — Reconnect all attached adapter bridges (not just primary)
- `src/core/event-bus.ts` — Add `permission:resolved` event type
- `src/plugins/api-server/routes/sessions.ts` — Attach/detach endpoints, pass `sourceAdapterId`
- `src/plugins/sse-adapter/routes.ts` — Pass `sourceAdapterId: "sse"` on prompt

---

### Task 1: TurnContext Type and Event Classification

**Files:**
- Create: `src/core/sessions/turn-context.ts`
- Create: `src/core/sessions/__tests__/turn-context.test.ts`

- [ ] **Step 1: Write failing tests for event classification**

```typescript
// src/core/sessions/__tests__/turn-context.test.ts
import { describe, it, expect } from "vitest";
import { isSystemEvent, createTurnContext } from "../turn-context.js";

describe("TurnContext", () => {
  describe("createTurnContext", () => {
    it("creates context with unique turnId", () => {
      const ctx = createTurnContext("telegram");
      expect(ctx.turnId).toBeTruthy();
      expect(ctx.sourceAdapterId).toBe("telegram");
      expect(ctx.responseAdapterId).toBeUndefined();
    });

    it("accepts explicit responseAdapterId", () => {
      const ctx = createTurnContext("system", "discord");
      expect(ctx.sourceAdapterId).toBe("system");
      expect(ctx.responseAdapterId).toBe("discord");
    });

    it("accepts null responseAdapterId for silent prompts", () => {
      const ctx = createTurnContext("system", null);
      expect(ctx.responseAdapterId).toBeNull();
    });
  });

  describe("isSystemEvent", () => {
    it("classifies session_end as system event", () => {
      expect(isSystemEvent({ type: "session_end", reason: "done" })).toBe(true);
    });

    it("classifies system_message as system event", () => {
      expect(isSystemEvent({ type: "system_message", message: "hi" })).toBe(true);
    });

    it("classifies config_option_update as system event", () => {
      expect(isSystemEvent({ type: "config_option_update", options: [] })).toBe(true);
    });

    it("classifies session_info_update as system event", () => {
      expect(isSystemEvent({ type: "session_info_update", title: "test" })).toBe(true);
    });

    it("classifies commands_update as system event", () => {
      expect(isSystemEvent({ type: "commands_update", commands: [] })).toBe(true);
    });

    it("classifies text as turn event (not system)", () => {
      expect(isSystemEvent({ type: "text", content: "hi" })).toBe(false);
    });

    it("classifies thought as turn event", () => {
      expect(isSystemEvent({ type: "thought", content: "thinking" })).toBe(false);
    });

    it("classifies tool_call as turn event", () => {
      expect(isSystemEvent({ type: "tool_call", id: "1", name: "read", status: "done" })).toBe(false);
    });

    it("classifies tool_update as turn event", () => {
      expect(isSystemEvent({ type: "tool_update", id: "1", status: "done" })).toBe(false);
    });

    it("classifies usage as turn event", () => {
      expect(isSystemEvent({ type: "usage" })).toBe(false);
    });

    it("classifies plan as turn event", () => {
      expect(isSystemEvent({ type: "plan", entries: [] })).toBe(false);
    });

    it("classifies error as turn event", () => {
      expect(isSystemEvent({ type: "error", message: "fail" })).toBe(false);
    });

    it("classifies image_content as turn event", () => {
      expect(isSystemEvent({ type: "image_content", data: "", mimeType: "image/png" })).toBe(false);
    });

    it("classifies audio_content as turn event", () => {
      expect(isSystemEvent({ type: "audio_content", data: "", mimeType: "audio/mp3" })).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/core/sessions/__tests__/turn-context.test.ts`
Expected: FAIL — module `../turn-context.js` not found

- [ ] **Step 3: Implement TurnContext module**

```typescript
// src/core/sessions/turn-context.ts
import { nanoid } from "nanoid";
import type { AgentEvent } from "../types.js";

export interface TurnContext {
  turnId: string;
  sourceAdapterId: string;
  responseAdapterId?: string | null; // null = silent, undefined = use sourceAdapterId
}

export interface TurnRouting {
  sourceAdapterId: string;
  responseAdapterId?: string | null;
}

/**
 * Create a new TurnContext. Called when a prompt is dequeued from the queue.
 */
export function createTurnContext(
  sourceAdapterId: string,
  responseAdapterId?: string | null,
): TurnContext {
  return {
    turnId: nanoid(8),
    sourceAdapterId,
    responseAdapterId,
  };
}

/**
 * Get the effective response adapter for a turn.
 * - null → silent (no adapter renders)
 * - undefined → fallback to sourceAdapterId
 * - string → explicit target
 */
export function getEffectiveTarget(ctx: TurnContext): string | null {
  if (ctx.responseAdapterId === null) return null;
  return ctx.responseAdapterId ?? ctx.sourceAdapterId;
}

/**
 * System events are broadcast to ALL attached adapters.
 * Turn events are routed only to the response adapter.
 */
const SYSTEM_EVENT_TYPES = new Set([
  "session_end",
  "system_message",
  "session_info_update",
  "config_option_update",
  "commands_update",
  "tts_strip",
]);

export function isSystemEvent(event: AgentEvent): boolean {
  return SYSTEM_EVENT_TYPES.has(event.type);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/core/sessions/__tests__/turn-context.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/sessions/turn-context.ts src/core/sessions/__tests__/turn-context.test.ts
git commit -m "feat: add TurnContext type and event classification"
```

---

### Task 2: Add TurnRouting to PromptQueue

**Files:**
- Modify: `src/core/sessions/prompt-queue.ts`
- Modify: `src/core/types.ts`

- [ ] **Step 1: Update types — add TurnRouting to IncomingMessage**

In `src/core/types.ts`, add the import and update `IncomingMessage` (around line 1):

```typescript
import type { TurnRouting } from "./sessions/turn-context.js";
export type { TurnRouting };
```

Add `routing?: TurnRouting` to `IncomingMessage`:

```typescript
export interface IncomingMessage {
  channelId: string;
  threadId: string;
  userId: string;
  text: string;
  attachments?: Attachment[];
  routing?: TurnRouting;
}
```

- [ ] **Step 2: Add routing to PromptQueue items**

Modify `src/core/sessions/prompt-queue.ts`:

```typescript
import type { Attachment } from '../types.js'
import type { TurnRouting } from './turn-context.js'

/**
 * Serial prompt queue — ensures prompts are processed one at a time.
 */
export class PromptQueue {
  private queue: Array<{ text: string; attachments?: Attachment[]; routing?: TurnRouting; resolve: () => void }> = []
  private processing = false
  private abortController: AbortController | null = null

  constructor(
    private processor: (text: string, attachments?: Attachment[], routing?: TurnRouting) => Promise<void>,
    private onError?: (err: unknown) => void,
  ) {}

  async enqueue(text: string, attachments?: Attachment[], routing?: TurnRouting): Promise<void> {
    if (this.processing) {
      return new Promise<void>((resolve) => {
        this.queue.push({ text, attachments, routing, resolve })
      })
    }
    await this.process(text, attachments, routing)
  }

  private async process(text: string, attachments?: Attachment[], routing?: TurnRouting): Promise<void> {
    this.processing = true
    this.abortController = new AbortController()
    const { signal } = this.abortController
    try {
      await Promise.race([
        this.processor(text, attachments, routing),
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
      this.drainNext()
    }
  }

  private drainNext(): void {
    const next = this.queue.shift()
    if (next) {
      this.process(next.text, next.attachments, next.routing).then(next.resolve)
    }
  }

  clear(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
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
}
```

- [ ] **Step 3: Build to verify no type errors**

Run: `pnpm build`
Expected: Build succeeds (Session.ts will have a type error because processor signature changed — that's expected, fixed in Task 3)

- [ ] **Step 4: Commit**

```bash
git add src/core/types.ts src/core/sessions/prompt-queue.ts
git commit -m "feat: add TurnRouting to PromptQueue and IncomingMessage"
```

---

### Task 3: Update Session — Multi-Adapter Fields and Turn-Aware Enqueue

**Files:**
- Modify: `src/core/sessions/session.ts`

- [ ] **Step 1: Add imports and new fields to Session**

At top of `src/core/sessions/session.ts`, add import:

```typescript
import type { TurnRouting } from "./turn-context.js";
import { createTurnContext, type TurnContext } from "./turn-context.js";
```

Add new fields to Session class (after `latestCommands` around line 61):

```typescript
  /** Adapters currently attached to this session (including primary) */
  attachedAdapters: string[] = [];
  /** Per-adapter thread IDs: adapterId → threadId */
  threadIds: Map<string, string> = new Map();
  /** Active turn context — sealed on prompt dequeue, cleared on turn end */
  activeTurnContext: TurnContext | null = null;
```

- [ ] **Step 2: Add threadId backward-compat getter/setter**

Replace the `threadId` field (line 41) with a getter/setter that delegates to `threadIds`:

```typescript
  /** @deprecated Use threadIds map directly. Getter returns primary adapter's threadId. */
  get threadId(): string {
    return this.threadIds.get(this.channelId) ?? "";
  }
  set threadId(value: string) {
    if (value) {
      this.threadIds.set(this.channelId, value);
    }
  }
```

- [ ] **Step 3: Update enqueuePrompt to accept routing**

Change `enqueuePrompt` signature (line 184):

```typescript
  async enqueuePrompt(text: string, attachments?: Attachment[], routing?: TurnRouting): Promise<void> {
    // Hook: agent:beforePrompt — modifiable, can block
    if (this.middlewareChain) {
      const payload = { text, attachments, sessionId: this.id };
      const result = await this.middlewareChain.execute('agent:beforePrompt', payload, async (p) => p);
      if (!result) return; // blocked by middleware
      text = result.text;
      attachments = result.attachments;
    }
    await this.queue.enqueue(text, attachments, routing);
  }
```

- [ ] **Step 4: Update processPrompt to seal TurnContext**

Change `processPrompt` signature and add turn context sealing (line 196):

```typescript
  private async processPrompt(text: string, attachments?: Attachment[], routing?: TurnRouting): Promise<void> {
    // Don't process prompts for finished sessions (queue may still drain)
    if (this._status === "finished") return;

    // Seal turn context — bridges use this to decide routing
    this.activeTurnContext = createTurnContext(
      routing?.sourceAdapterId ?? this.channelId,
      routing?.responseAdapterId,
    );

    this.promptCount++;
    this.emit('prompt_count_changed', this.promptCount);
```

At the end of `processPrompt`, after TTS processing and before `autoName()`, clear the turn context:

```typescript
    // Clear turn context at end of turn
    this.activeTurnContext = null;

    if (!this.name) {
      await this.autoName();
    }
  }
```

- [ ] **Step 5: Update PromptQueue constructor call**

Update the PromptQueue constructor in Session constructor (line 89):

```typescript
    this.queue = new PromptQueue(
      (text, attachments, routing) => this.processPrompt(text, attachments, routing),
      (err) => {
        this.log.error({ err }, "Prompt execution failed");
        const message = err instanceof Error ? err.message : String(err);
        this.fail(message);
        this.emit("agent_event", { type: "error", message: `Prompt execution failed: ${message}` });
      },
    );
```

- [ ] **Step 6: Initialize attachedAdapters in constructor**

In the Session constructor, after setting `channelId` (around line 79):

```typescript
    this.channelId = opts.channelId;
    this.attachedAdapters = [opts.channelId];
```

- [ ] **Step 7: Build to verify compilation**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 8: Run existing session tests**

Run: `pnpm test src/core/__tests__/`
Expected: All existing tests pass (backward compat via threadId getter/setter)

- [ ] **Step 9: Commit**

```bash
git add src/core/sessions/session.ts
git commit -m "feat: add multi-adapter fields and turn-aware enqueue to Session"
```

---

### Task 4: Turn-Aware SessionBridge Routing

**Files:**
- Modify: `src/core/sessions/session-bridge.ts`
- Create: `src/core/sessions/__tests__/multi-bridge-routing.test.ts`

- [ ] **Step 1: Write failing tests for bridge routing**

```typescript
// src/core/sessions/__tests__/multi-bridge-routing.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionBridge } from "../session-bridge.js";
import { Session } from "../session.js";
import { TypedEmitter } from "../../utils/typed-emitter.js";
import type { AgentEvent, PermissionRequest } from "../../types.js";
import type { TurnContext } from "../turn-context.js";

function mockAgentInstance() {
  const emitter = new TypedEmitter<{ agent_event: (event: AgentEvent) => void }>();
  return Object.assign(emitter, {
    sessionId: "agent-sess-1",
    prompt: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
    debugTracer: null,
    agentCapabilities: undefined,
    initialSessionResponse: undefined,
    promptCapabilities: undefined,
    addAllowedPath: vi.fn(),
  }) as any;
}

function mockAdapter(name: string) {
  return {
    name,
    capabilities: { streaming: false, richFormatting: false, threads: false, reactions: false, fileUpload: false, voice: false },
    start: vi.fn(),
    stop: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendPermissionRequest: vi.fn().mockResolvedValue(undefined),
    sendNotification: vi.fn(),
    createSessionThread: vi.fn().mockResolvedValue("thread-1"),
    renameSessionThread: vi.fn(),
  } as any;
}

function createTestSession(channelId = "telegram") {
  const agent = mockAgentInstance();
  const session = new Session({
    channelId,
    agentName: "test-agent",
    workingDirectory: "/tmp",
    agentInstance: agent,
  });
  return { session, agent };
}

function mockBridgeDeps() {
  return {
    messageTransformer: { transform: vi.fn((event: any) => ({ type: "text", text: event.content ?? event.message ?? "" })) },
    notificationManager: { notify: vi.fn(), notifyAll: vi.fn() },
    sessionManager: { patchRecord: vi.fn(), getSessionRecord: vi.fn() },
    eventBus: { emit: vi.fn() },
  } as any;
}

describe("Multi-Bridge Routing", () => {
  it("forwards turn events only to target adapter", async () => {
    const { session, agent } = createTestSession("telegram");
    const telegramAdapter = mockAdapter("telegram");
    const sseAdapter = mockAdapter("sse");
    const deps = mockBridgeDeps();

    const telegramBridge = new SessionBridge(session, telegramAdapter, deps, "telegram");
    const sseBridge = new SessionBridge(session, sseAdapter, deps, "sse");
    telegramBridge.connect();
    sseBridge.connect();

    // Set turn context: message from telegram
    session.activeTurnContext = {
      turnId: "turn-1",
      sourceAdapterId: "telegram",
    };

    // Emit a text event (turn event)
    agent.emit("agent_event", { type: "text", content: "hello" });

    await vi.waitFor(() => {
      // Telegram should receive (it's the source adapter)
      expect(telegramAdapter.sendMessage).toHaveBeenCalled();
      // SSE should NOT receive turn events (not the target)
      expect(sseAdapter.sendMessage).not.toHaveBeenCalled();
    });

    telegramBridge.disconnect();
    sseBridge.disconnect();
  });

  it("forwards system events to all attached adapters", async () => {
    const { session, agent } = createTestSession("telegram");
    const telegramAdapter = mockAdapter("telegram");
    const sseAdapter = mockAdapter("sse");
    const deps = mockBridgeDeps();

    const telegramBridge = new SessionBridge(session, telegramAdapter, deps, "telegram");
    const sseBridge = new SessionBridge(session, sseAdapter, deps, "sse");
    telegramBridge.connect();
    sseBridge.connect();

    // Set turn context: message from telegram
    session.activeTurnContext = {
      turnId: "turn-1",
      sourceAdapterId: "telegram",
    };

    // Emit a system event
    agent.emit("agent_event", { type: "system_message", message: "switched" });

    await vi.waitFor(() => {
      expect(telegramAdapter.sendMessage).toHaveBeenCalled();
      expect(sseAdapter.sendMessage).toHaveBeenCalled();
    });

    telegramBridge.disconnect();
    sseBridge.disconnect();
  });

  it("routes to explicit responseAdapterId", async () => {
    const { session, agent } = createTestSession("telegram");
    const telegramAdapter = mockAdapter("telegram");
    const discordAdapter = mockAdapter("discord");
    const deps = mockBridgeDeps();

    const telegramBridge = new SessionBridge(session, telegramAdapter, deps, "telegram");
    const discordBridge = new SessionBridge(session, discordAdapter, deps, "discord");
    telegramBridge.connect();
    discordBridge.connect();

    // System-sent prompt targeting discord
    session.activeTurnContext = {
      turnId: "turn-1",
      sourceAdapterId: "system",
      responseAdapterId: "discord",
    };

    agent.emit("agent_event", { type: "text", content: "result" });

    await vi.waitFor(() => {
      expect(discordAdapter.sendMessage).toHaveBeenCalled();
      expect(telegramAdapter.sendMessage).not.toHaveBeenCalled();
    });

    telegramBridge.disconnect();
    discordBridge.disconnect();
  });

  it("suppresses turn events for silent prompts (responseAdapterId=null)", async () => {
    const { session, agent } = createTestSession("telegram");
    const telegramAdapter = mockAdapter("telegram");
    const deps = mockBridgeDeps();

    const telegramBridge = new SessionBridge(session, telegramAdapter, deps, "telegram");
    telegramBridge.connect();

    session.activeTurnContext = {
      turnId: "turn-1",
      sourceAdapterId: "system",
      responseAdapterId: null,
    };

    agent.emit("agent_event", { type: "text", content: "auto-name" });

    // Wait a tick to ensure event would have been processed
    await new Promise(r => setTimeout(r, 10));
    expect(telegramAdapter.sendMessage).not.toHaveBeenCalled();

    telegramBridge.disconnect();
  });

  it("forwards system events even during silent prompts", async () => {
    const { session, agent } = createTestSession("telegram");
    const telegramAdapter = mockAdapter("telegram");
    const deps = mockBridgeDeps();

    const telegramBridge = new SessionBridge(session, telegramAdapter, deps, "telegram");
    telegramBridge.connect();

    session.activeTurnContext = {
      turnId: "turn-1",
      sourceAdapterId: "system",
      responseAdapterId: null,
    };

    agent.emit("agent_event", { type: "system_message", message: "info" });

    await vi.waitFor(() => {
      expect(telegramAdapter.sendMessage).toHaveBeenCalled();
    });

    telegramBridge.disconnect();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/core/sessions/__tests__/multi-bridge-routing.test.ts`
Expected: FAIL — SessionBridge constructor doesn't accept 4th argument

- [ ] **Step 3: Add adapterId and shouldForward to SessionBridge**

Modify `src/core/sessions/session-bridge.ts`:

Add import at top:

```typescript
import { isSystemEvent, getEffectiveTarget } from "./turn-context.js";
```

Update constructor to accept `adapterId`:

```typescript
export class SessionBridge {
  private connected = false;
  private cleanupFns: Array<() => void> = [];
  readonly adapterId: string;

  constructor(
    private session: Session,
    private adapter: IChannelAdapter,
    private deps: BridgeDeps,
    adapterId?: string,
  ) {
    this.adapterId = adapterId ?? adapter.name;
  }
```

Add `shouldForward` method:

```typescript
  /** Determine if this bridge should forward the given event based on turn routing. */
  shouldForward(event: AgentEvent): boolean {
    // System events → always forward to all bridges
    if (isSystemEvent(event)) return true;

    // No active turn context → forward (backward compat, e.g. events outside turns)
    const ctx = this.session.activeTurnContext;
    if (!ctx) return true;

    // Silent turn → suppress turn events
    const target = getEffectiveTarget(ctx);
    if (target === null) return false;

    // Turn events → only forward to target adapter
    return this.adapterId === target;
  }
```

Update the `agent_event` listener in `connect()` to use routing (the session-level listener, around line 78):

```typescript
    // Wire session events to adapter (session → adapter dispatch)
    this.listen(this.session, "agent_event", (event: AgentEvent) => {
      if (this.shouldForward(event)) {
        this.dispatchAgentEvent(event);
      }
    });
```

- [ ] **Step 4: Run tests**

Run: `pnpm test src/core/sessions/__tests__/multi-bridge-routing.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run all existing tests**

Run: `pnpm test`
Expected: All tests pass (existing tests create bridge without adapterId — defaults to `adapter.name`)

- [ ] **Step 6: Commit**

```bash
git add src/core/sessions/session-bridge.ts src/core/sessions/__tests__/multi-bridge-routing.test.ts
git commit -m "feat: turn-aware multi-bridge routing in SessionBridge"
```

---

### Task 5: SessionRecord Migration and Store Update

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/sessions/session-store.ts`

- [ ] **Step 1: Update SessionRecord type**

In `src/core/types.ts`, update `SessionRecord` (around line 223):

```typescript
export interface SessionRecord<P = Record<string, unknown>> {
  sessionId: string;
  agentSessionId: string;
  originalAgentSessionId?: string;
  agentName: string;
  workingDir: string;
  channelId: string;
  status: SessionStatus;
  createdAt: string;
  lastActiveAt: string;
  name?: string;
  dangerousMode?: boolean;
  clientOverrides?: { bypassPermissions?: boolean };
  outputMode?: OutputMode;
  /** @deprecated Use platforms instead. Kept for backward compat migration. */
  platform: P;
  /** Per-adapter platform data. Key = adapterId, value = adapter-specific data. */
  platforms?: Record<string, Record<string, unknown>>;
  /** Adapters currently attached to this session. Defaults to [channelId] for old records. */
  attachedAdapters?: string[];
  firstAgent?: string;
  currentPromptCount?: number;
  agentSwitchHistory?: AgentSwitchEntry[];
  acpState?: {
    configOptions?: ConfigOption[];
    agentCapabilities?: AgentCapabilities;
    currentMode?: string;
    availableModes?: SessionMode[];
    currentModel?: string;
    availableModels?: ModelInfo[];
  };
}
```

- [ ] **Step 2: Add migration logic to SessionStore load**

In `src/core/sessions/session-store.ts`, add a migration helper and call it in `load()`:

After the class declaration, add the migration function:

```typescript
  /**
   * Migrate old SessionRecord format to new multi-adapter format.
   * - platform: { topicId: 123 } → platforms: { telegram: { topicId: 123 } }
   * - Missing attachedAdapters → [channelId]
   */
  private migrateRecord(record: SessionRecord): SessionRecord {
    // Migrate platform → platforms
    if (!record.platforms && record.platform && typeof record.platform === "object") {
      const platformData = record.platform as Record<string, unknown>;
      if (Object.keys(platformData).length > 0) {
        record.platforms = { [record.channelId]: platformData };
      }
    }

    // Default attachedAdapters
    if (!record.attachedAdapters) {
      record.attachedAdapters = [record.channelId];
    }

    return record;
  }
```

In the `load()` method, call `migrateRecord` when loading each record (around line 146):

```typescript
      for (const [id, record] of Object.entries(raw.sessions)) {
        this.records.set(id, this.migrateRecord(record));
      }
```

- [ ] **Step 3: Build and run existing tests**

Run: `pnpm build && pnpm test`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/core/types.ts src/core/sessions/session-store.ts
git commit -m "feat: add platforms and attachedAdapters to SessionRecord with auto-migration"
```

---

### Task 6: Update SessionManager Thread Lookup

**Files:**
- Modify: `src/core/sessions/session-manager.ts`

- [ ] **Step 1: Update getSessionByThread to check threadIds map**

In `src/core/sessions/session-manager.ts`, update `getSessionByThread` (line 60):

```typescript
  getSessionByThread(channelId: string, threadId: string): Session | undefined {
    for (const session of this.sessions.values()) {
      // New: check per-adapter threadIds map
      const adapterThread = session.threadIds.get(channelId);
      if (adapterThread === threadId) return session;
      // Backward compat: check legacy channelId + threadId
      if (session.channelId === channelId && session.threadId === threadId) {
        return session;
      }
    }
    return undefined;
  }
```

- [ ] **Step 2: Update findByPlatform in SessionStore for multi-adapter lookup**

In `src/core/sessions/session-store.ts`, update `findByPlatform` to also check `platforms` (line 65):

```typescript
  findByPlatform(
    channelId: string,
    predicate: (platform: Record<string, unknown>) => boolean,
  ): SessionRecord | undefined {
    for (const record of this.records.values()) {
      // Check new platforms format first
      if (record.platforms?.[channelId]) {
        if (predicate(record.platforms[channelId])) return record;
      }
      // Fallback to legacy platform field
      if (record.channelId === channelId && predicate(record.platform)) {
        return record;
      }
    }
    return undefined;
  }
```

- [ ] **Step 3: Build and test**

Run: `pnpm build && pnpm test`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/core/sessions/session-manager.ts src/core/sessions/session-store.ts
git commit -m "feat: update session thread lookup for multi-adapter threadIds"
```

---

### Task 7: Multi-Bridge Core Pipeline

**Files:**
- Modify: `src/core/core.ts`

- [ ] **Step 1: Change bridges from single to multi-bridge map**

In `src/core/core.ts`, update the bridges map type (line 45):

```typescript
  /** adapterId:sessionId → SessionBridge — tracks all bridges for disconnect/reconnect */
  private bridges: Map<string, SessionBridge> = new Map();
```

Add helper methods for bridge key management:

```typescript
  /** Bridge key: "adapterId:sessionId" */
  private bridgeKey(adapterId: string, sessionId: string): string {
    return `${adapterId}:${sessionId}`;
  }

  /** Get all bridges for a session */
  private getSessionBridges(sessionId: string): Array<{ adapterId: string; bridge: SessionBridge }> {
    const results: Array<{ adapterId: string; bridge: SessionBridge }> = [];
    for (const [key, bridge] of this.bridges) {
      if (key.endsWith(`:${sessionId}`)) {
        results.push({ adapterId: key.split(":")[0], bridge });
      }
    }
    return results;
  }
```

- [ ] **Step 2: Update createBridge to use composite key**

Replace the existing `createBridge` method (line 683):

```typescript
  createBridge(session: Session, adapter: IChannelAdapter, adapterId?: string): SessionBridge {
    const id = adapterId ?? adapter.name;
    const key = this.bridgeKey(id, session.id);
    const existing = this.bridges.get(key);
    if (existing) {
      existing.disconnect();
    }
    const bridge = new SessionBridge(session, adapter, {
      messageTransformer: this.messageTransformer,
      notificationManager: this.notificationManager,
      sessionManager: this.sessionManager,
      eventBus: this.eventBus,
      fileService: this.fileService,
      middlewareChain: this.lifecycleManager?.middlewareChain,
    }, id);
    this.bridges.set(key, bridge);
    return bridge;
  }
```

- [ ] **Step 3: Update createSession to set attachedAdapters and create bridge with adapterId**

In `createSession()` method (line 390), after creating the session, update the pipeline:

After `session.threadId = threadId;` (line 415), add:

```typescript
    // Initialize attachedAdapters from session
    session.attachedAdapters = [params.channelId];
```

Update the bridge creation (around line 452):

```typescript
    if (adapter) {
      const bridge = this.createBridge(session, adapter, params.channelId);
      bridge.connect();
```

Update the platform persistence (around line 422) to use new `platforms` format:

```typescript
    const platforms: Record<string, Record<string, unknown>> = {};
    if (session.threadId) {
      if (params.channelId === "telegram") {
        platforms.telegram = { topicId: Number(session.threadId) };
      } else {
        platforms[params.channelId] = { threadId: session.threadId };
      }
    }
    // Keep legacy platform field for backward compat
    const legacyPlatform: Record<string, unknown> = {
      ...(existingRecord?.platform ?? {}),
    };
    if (session.threadId) {
      if (params.channelId === "telegram") {
        legacyPlatform.topicId = Number(session.threadId);
      } else {
        legacyPlatform.threadId = session.threadId;
      }
    }
    await this.sessionManager.patchRecord(session.id, {
      sessionId: session.id,
      agentSessionId: session.agentSessionId,
      agentName: params.agentName,
      workingDir: params.workingDirectory,
      channelId: params.channelId,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      lastActiveAt: new Date().toISOString(),
      name: session.name,
      platform: legacyPlatform,
      platforms,
      attachedAdapters: session.attachedAdapters,
      firstAgent: session.firstAgent,
      currentPromptCount: session.promptCount,
      agentSwitchHistory: session.agentSwitchHistory,
      acpState: session.toAcpStateSnapshot(),
    }, { immediate: true });
```

- [ ] **Step 4: Add attachAdapter and detachAdapter methods**

Add these methods to `VibenCore` after `createSession`:

```typescript
  async attachAdapter(sessionId: string, adapterId: string): Promise<{ threadId: string }> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const adapter = this.adapters.get(adapterId);
    if (!adapter) throw new Error(`Adapter "${adapterId}" not found`);

    if (session.attachedAdapters.includes(adapterId)) {
      const existingThread = session.threadIds.get(adapterId) ?? session.id;
      return { threadId: existingThread };
    }

    // Create thread on the target adapter
    const threadId = await adapter.createSessionThread(session.id, session.name ?? `Session ${session.id.slice(0, 6)}`);
    session.threadIds.set(adapterId, threadId);
    session.attachedAdapters.push(adapterId);

    // Create and connect bridge
    const bridge = this.createBridge(session, adapter, adapterId);
    bridge.connect();

    // Persist
    const platforms = this.buildPlatforms(session);
    await this.sessionManager.patchRecord(session.id, {
      attachedAdapters: session.attachedAdapters,
      platforms,
    });

    log.info({ sessionId, adapterId, threadId }, "Adapter attached to session");
    return { threadId };
  }

  async detachAdapter(sessionId: string, adapterId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    if (adapterId === session.channelId) {
      throw new Error("Cannot detach primary adapter");
    }

    if (!session.attachedAdapters.includes(adapterId)) {
      return; // Already detached
    }

    // Send detach message before disconnecting
    const adapter = this.adapters.get(adapterId);
    if (adapter) {
      try {
        await adapter.sendMessage(session.id, {
          type: "system_message",
          text: "Session detached from this adapter.",
        });
      } catch { /* best effort */ }
    }

    // Disconnect bridge
    const key = this.bridgeKey(adapterId, session.id);
    const bridge = this.bridges.get(key);
    if (bridge) {
      bridge.disconnect();
      this.bridges.delete(key);
    }

    // Update session
    session.attachedAdapters = session.attachedAdapters.filter(a => a !== adapterId);
    session.threadIds.delete(adapterId);

    // Persist
    const platforms = this.buildPlatforms(session);
    await this.sessionManager.patchRecord(session.id, {
      attachedAdapters: session.attachedAdapters,
      platforms,
    });

    log.info({ sessionId, adapterId }, "Adapter detached from session");
  }

  /** Build platforms map from session threadIds */
  private buildPlatforms(session: Session): Record<string, Record<string, unknown>> {
    const platforms: Record<string, Record<string, unknown>> = {};
    for (const [adapterId, threadId] of session.threadIds) {
      if (adapterId === "telegram") {
        platforms.telegram = { topicId: Number(threadId) };
      } else {
        platforms[adapterId] = { threadId };
      }
    }
    return platforms;
  }
```

- [ ] **Step 5: Update handleMessage to pass routing**

In `handleMessage()` (line 315), when forwarding to session, pass routing info:

```typescript
    // Forward to session
    await session.enqueuePrompt(text, message.attachments, message.routing);
```

- [ ] **Step 6: Build and test**

Run: `pnpm build && pnpm test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add src/core/core.ts
git commit -m "feat: multi-bridge pipeline with attach/detach in VibenCore"
```

---

### Task 8: Update AgentSwitchHandler for Multi-Bridge

**Files:**
- Modify: `src/core/agent-switch-handler.ts`

- [ ] **Step 1: Update bridge disconnect to handle all bridges**

In `doSwitch()`, replace the single bridge disconnect (around line 86-91):

```typescript
    // 3. Disconnect ALL bridges for this session
    const sessionBridgeKeys: string[] = [];
    for (const [key, bridge] of this.deps.bridges) {
      if (key.endsWith(`:${sessionId}`)) {
        sessionBridgeKeys.push(key);
        bridge.disconnect();
      }
    }
    for (const key of sessionBridgeKeys) {
      this.deps.bridges.delete(key);
    }

    const switchAdapter = adapters.get(session.channelId);
```

- [ ] **Step 2: Update bridge reconnect on success**

Replace the single bridge reconnect (around line 191-198):

```typescript
    // 5. Reconnect bridges for ALL attached adapters
    if (sessionBridgeKeys.length > 0) {
      for (const adapterId of session.attachedAdapters) {
        const adapter = adapters.get(adapterId);
        if (adapter) {
          createBridge(session, adapter).connect();
        } else {
          log.warn({ sessionId, adapterId }, "Adapter disconnected during switch, cannot reconnect bridge");
        }
      }
    }
```

- [ ] **Step 3: Update rollback bridge reconnect**

In the rollback section (around line 179-182):

```typescript
        // Reconnect all bridges on rollback
        for (const adapterId of session.attachedAdapters) {
          const adapter = adapters.get(adapterId);
          if (adapter) {
            createBridge(session, adapter).connect();
          }
        }
```

- [ ] **Step 4: Build and test**

Run: `pnpm build && pnpm test`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/core/agent-switch-handler.ts
git commit -m "feat: agent switch reconnects all attached adapter bridges"
```

---

### Task 9: Update SessionFactory for Multi-Adapter Resume

**Files:**
- Modify: `src/core/sessions/session-factory.ts`

- [ ] **Step 1: Update lazyResume to restore attachedAdapters**

In `lazyResume()`, after restoring session state from record (around line 267):

```typescript
        if (record.agentSwitchHistory) session.agentSwitchHistory = record.agentSwitchHistory;
        if (record.currentPromptCount != null) session.promptCount = record.currentPromptCount;

        // Restore multi-adapter state
        if (record.attachedAdapters) {
          session.attachedAdapters = record.attachedAdapters;
        }
        if (record.platforms) {
          for (const [adapterId, platformData] of Object.entries(record.platforms)) {
            const tid = adapterId === "telegram"
              ? String((platformData as any).topicId)
              : (platformData as any).threadId;
            if (tid) session.threadIds.set(adapterId, tid);
          }
        }
```

Note: The `createFullSession` callback (which calls `core.createSession`) already creates a bridge for the triggering adapter. We do NOT create bridges for other adapters during lazy resume — they will create their own bridges when they next send a message or explicitly re-attach. This avoids waking up adapters that may not have active listeners.

- [ ] **Step 2: Build and test**

Run: `pnpm build && pnpm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/core/sessions/session-factory.ts
git commit -m "feat: restore multi-adapter state on lazy resume"
```

---

### Task 10: API Server — Attach/Detach Endpoints and Routing

**Files:**
- Modify: `src/plugins/api-server/routes/sessions.ts`

- [ ] **Step 1: Add attach endpoint**

Add after the existing `archive` endpoint:

```typescript
  // Attach adapter to session
  server.post<{ Params: { sessionId: string }; Body: { adapterId: string } }>(
    "/sessions/:sessionId/attach",
    { preHandler: [deps.authPreHandler] },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { adapterId } = request.body ?? {};
      if (!adapterId) return reply.code(400).send({ error: "adapterId is required" });

      try {
        const result = await deps.core.attachAdapter(sessionId, adapterId);
        return { ok: true, threadId: result.threadId };
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    },
  );
```

- [ ] **Step 2: Add detach endpoint**

```typescript
  // Detach adapter from session
  server.post<{ Params: { sessionId: string }; Body: { adapterId: string } }>(
    "/sessions/:sessionId/detach",
    { preHandler: [deps.authPreHandler] },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { adapterId } = request.body ?? {};
      if (!adapterId) return reply.code(400).send({ error: "adapterId is required" });

      try {
        await deps.core.detachAdapter(sessionId, adapterId);
        return { ok: true };
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    },
  );
```

- [ ] **Step 3: Pass sourceAdapterId on prompt endpoint**

Find the existing `POST /sessions/:sessionId/prompt` handler and add routing:

```typescript
      // Inside the prompt handler, when calling enqueuePrompt:
      await session.enqueuePrompt(text, undefined, {
        sourceAdapterId: request.body?.sourceAdapterId ?? "api",
        responseAdapterId: request.body?.responseAdapterId,
      });
```

- [ ] **Step 4: Add attachedAdapters to session list/detail responses**

In the GET `/sessions` and GET `/sessions/:sessionId` handlers, include `attachedAdapters` in the response:

```typescript
      // In the session serialization, add:
      attachedAdapters: session.attachedAdapters,
```

- [ ] **Step 5: Build and test**

Run: `pnpm build && pnpm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/plugins/api-server/routes/sessions.ts
git commit -m "feat: add attach/detach API endpoints with sourceAdapterId routing"
```

---

### Task 11: SSE Adapter — Pass sourceAdapterId

**Files:**
- Modify: `src/plugins/sse-adapter/routes.ts`

- [ ] **Step 1: Pass sourceAdapterId on SSE prompt**

In `src/plugins/sse-adapter/routes.ts`, find the `POST /sessions/:sessionId/prompt` handler and add routing:

```typescript
      // When calling enqueuePrompt:
      await session.enqueuePrompt(text, undefined, {
        sourceAdapterId: "sse",
      });
```

- [ ] **Step 2: Build and test**

Run: `pnpm build && pnpm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/plugins/sse-adapter/routes.ts
git commit -m "feat: SSE adapter passes sourceAdapterId on prompt"
```

---

### Task 12: Permission Resolved Broadcast

**Files:**
- Modify: `src/core/sessions/session-bridge.ts`
- Modify: `src/core/event-bus.ts` (if typed events exist)

- [ ] **Step 1: Emit permission:resolved event after gate resolution**

In `SessionBridge.resolvePermission()` (around line 364), after the gate resolves, emit a broadcast event:

```typescript
    const optionId = await promise;

    // Broadcast permission:resolved so other adapters can update their UI
    this.deps.eventBus?.emit("permission:resolved", {
      sessionId: this.session.id,
      requestId: permReq.id,
      optionId,
      resolvedBy: this.adapterId,
    });

    this.emitAfterResolve(mw, permReq.id, optionId, 'user', startTime);
    return optionId;
```

- [ ] **Step 2: Build and test**

Run: `pnpm build && pnpm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/core/sessions/session-bridge.ts
git commit -m "feat: broadcast permission:resolved event for multi-adapter UI cleanup"
```

---

### Task 13: Export TurnContext Types

**Files:**
- Modify: `src/core/sessions/index.ts` (or wherever sessions are exported)
- Modify: `src/core/index.ts`

- [ ] **Step 1: Export turn-context from session module**

Find the sessions index file and add export:

```typescript
export { type TurnContext, type TurnRouting, createTurnContext, getEffectiveTarget, isSystemEvent } from "./sessions/turn-context.js";
```

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/core/sessions/index.ts src/core/index.ts
git commit -m "feat: export TurnContext types from core"
```

---

### Task 14: Final Integration Verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Clean build with no errors

- [ ] **Step 3: Verify backward compatibility by inspecting key flows**

Manually verify these scenarios compile and have correct logic:
1. Session created with single adapter (channelId only) — `attachedAdapters` defaults to `[channelId]`
2. Old session records without `platforms` or `attachedAdapters` — auto-migrated on load
3. `session.threadId` getter returns correct value for primary adapter
4. Bridge without explicit `adapterId` falls back to `adapter.name`

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix: integration fixes for multi-adapter session routing"
```

---

## Follow-Up (Out of Scope)

These spec items are deferred to a separate plan:

1. **Conversation History Enhancement**: Add `sourceAdapterId` to context plugin's `ConversationEntry`. This is a display-only enhancement for SSE dashboard — core routing works without it.
2. **Telegram adapter**: Listen for `permission:resolved` events and update inline keyboards.
3. **Discord adapter**: Listen for `permission:resolved` events and update buttons.
