# Persistent Assistant Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the same assistant session record across bot restarts instead of creating a new one each time, and hide assistant sessions from all session listings.

**Architecture:** Add `isAssistant` flag to `SessionRecord`, persist it on save, query it on startup to find existing assistant sessions, filter it out of all listing APIs. Replace `spawn()`/`respawn()` with `getOrSpawn()` that reuses the existing record ID.

**Tech Stack:** TypeScript, Vitest, existing SessionStore/SessionManager/AssistantManager patterns.

---

### Task 1: Add `isAssistant` to `SessionRecord` type

**Files:**
- Modify: `src/core/types.ts`

- [ ] **Step 1: Add field to `SessionRecord`**

In `src/core/types.ts`, add `isAssistant?: boolean` after `name?: string`:

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
  isAssistant?: boolean;          // ← add this line
  dangerousMode?: boolean;
  // ... rest unchanged
```

- [ ] **Step 2: Build to verify no type errors**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm build
```

Expected: Build succeeds (field is optional, no breakage).

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat: add isAssistant field to SessionRecord type"
```

---

### Task 2: Add `findAssistant()` to `SessionStore` + exempt from TTL cleanup

**Files:**
- Modify: `src/core/sessions/session-store.ts`
- Test: `src/core/sessions/__tests__/session-store-comprehensive.test.ts`

- [ ] **Step 1: Write failing tests**

Open `src/core/sessions/__tests__/session-store-comprehensive.test.ts` and add this test block at the end (before the final closing `}`):

```typescript
describe('findAssistant', () => {
  it('returns the assistant record for a channel', async () => {
    const store = new JsonFileSessionStore(tmpFile(), 30);
    await store.save({
      sessionId: 'sess-1',
      agentSessionId: 'agent-1',
      agentName: 'claude-code',
      workingDir: '/tmp',
      channelId: 'telegram',
      status: 'finished',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isAssistant: true,
      platform: {},
    });
    const result = store.findAssistant('telegram');
    expect(result?.sessionId).toBe('sess-1');
    store.destroy();
  });

  it('returns undefined when no assistant record for channel', async () => {
    const store = new JsonFileSessionStore(tmpFile(), 30);
    await store.save({
      sessionId: 'sess-1',
      agentSessionId: 'agent-1',
      agentName: 'claude-code',
      workingDir: '/tmp',
      channelId: 'telegram',
      status: 'finished',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isAssistant: false,
      platform: {},
    });
    expect(store.findAssistant('telegram')).toBeUndefined();
    store.destroy();
  });

  it('ignores assistant records for other channels', async () => {
    const store = new JsonFileSessionStore(tmpFile(), 30);
    await store.save({
      sessionId: 'sess-1',
      agentSessionId: 'agent-1',
      agentName: 'claude-code',
      workingDir: '/tmp',
      channelId: 'slack',
      status: 'finished',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isAssistant: true,
      platform: {},
    });
    expect(store.findAssistant('telegram')).toBeUndefined();
    store.destroy();
  });
});

describe('TTL cleanup exempts assistant sessions', () => {
  it('does not delete assistant records past TTL', async () => {
    const store = new JsonFileSessionStore(tmpFile(), 1); // 1 day TTL
    const oldDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ago
    await store.save({
      sessionId: 'assistant-sess',
      agentSessionId: 'agent-1',
      agentName: 'claude-code',
      workingDir: '/tmp',
      channelId: 'telegram',
      status: 'finished',
      createdAt: oldDate,
      lastActiveAt: oldDate,
      isAssistant: true,
      platform: {},
    });
    // Trigger cleanup by creating a new store that loads and cleans up
    store.flush();
    const store2 = new JsonFileSessionStore((store as any).filePath, 1);
    expect(store2.get('assistant-sess')).toBeDefined();
    store.destroy();
    store2.destroy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test src/core/sessions/__tests__/session-store-comprehensive.test.ts 2>&1 | tail -20
```

Expected: Tests fail with `store.findAssistant is not a function`.

- [ ] **Step 3: Add `findAssistant` to `SessionStore` interface**

In `src/core/sessions/session-store.ts`, add to the `SessionStore` interface after `findByAgentSessionId`:

```typescript
export interface SessionStore {
  save(record: SessionRecord): Promise<void>;
  flush(): void;
  get(sessionId: string): SessionRecord | undefined;
  findByPlatform(
    channelId: string,
    predicate: (platform: Record<string, unknown>) => boolean,
  ): SessionRecord | undefined;
  findByAgentSessionId(agentSessionId: string): SessionRecord | undefined;
  findAssistant(channelId: string): SessionRecord | undefined;  // ← add this
  list(channelId?: string): SessionRecord[];
  remove(sessionId: string): Promise<void>;
}
```

- [ ] **Step 4: Implement `findAssistant` in `JsonFileSessionStore`**

Add after the `findByAgentSessionId` method:

```typescript
findAssistant(channelId: string): SessionRecord | undefined {
  for (const record of this.records.values()) {
    if (record.isAssistant === true && record.channelId === channelId) {
      return record;
    }
  }
  return undefined;
}
```

- [ ] **Step 5: Exempt assistant sessions from TTL cleanup**

In `JsonFileSessionStore.cleanup()`, modify the skip condition:

```typescript
private cleanup(): void {
  const cutoff = Date.now() - this.ttlDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const [id, record] of this.records) {
    if (record.status === "active" || record.status === "initializing")
      continue;
    if (record.isAssistant === true)   // ← add this line
      continue;
    const raw = record.lastActiveAt;
    if (!raw) continue;
    const lastActive = new Date(raw).getTime();
    if (isNaN(lastActive)) continue;
    if (lastActive < cutoff) {
      this.records.delete(id);
      removed++;
    }
  }
  // ... rest unchanged
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test src/core/sessions/__tests__/session-store-comprehensive.test.ts 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/sessions/session-store.ts src/core/sessions/__tests__/session-store-comprehensive.test.ts
git commit -m "feat: add findAssistant() to SessionStore and exempt assistant records from TTL cleanup"
```

---

### Task 3: Persist `isAssistant` through `core.createSession()`

**Files:**
- Modify: `src/core/core.ts`
- Modify: `src/core/sessions/session-factory.ts`

The persistence path is: `AssistantManager.getOrSpawn()` → `core.createSession()` → `sessionFactory.create()` (creates session in memory) → `patchRecord()` (persists to store). Only `core.createSession()` and `SessionFactory.SessionCreateParams` need to be updated.

- [ ] **Step 1: Add `isAssistant` to `VibenCore.createSession()` signature and persistence**

In `src/core/core.ts`, update `createSession` signature:

```typescript
async createSession(params: {
  channelId: string;
  agentName: string;
  workingDirectory: string;
  resumeAgentSessionId?: string;
  existingSessionId?: string;
  createThread?: boolean;
  initialName?: string;
  threadId?: string;
  isAssistant?: boolean;      // ← add this
}): Promise<Session> {
```

Then in the `patchRecord` call (around line 463), add `isAssistant`:

```typescript
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
  isAssistant: params.isAssistant,   // ← add this
  platform,
  platforms,
  firstAgent: session.firstAgent,
  currentPromptCount: session.promptCount,
  agentSwitchHistory: session.agentSwitchHistory,
  acpState: session.toAcpStateSnapshot(),
}, { immediate: true });
```

Also update `SessionFactory.SessionCreateParams` in `src/core/sessions/session-factory.ts` to add `isAssistant?: boolean` so the type is consistent with the `core.createSession()` params (they share the same type via `createFullSession`):

```typescript
export interface SessionCreateParams {
  channelId: string;
  agentName: string;
  workingDirectory: string;
  resumeAgentSessionId?: string;
  existingSessionId?: string;
  initialName?: string;
  isAssistant?: boolean;   // ← add this
}
```

- [ ] **Step 2: Build to verify no type errors**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | tail -30
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/core/core.ts src/core/sessions/session-factory.ts
git commit -m "feat: persist isAssistant flag through session creation pipeline"
```

---

### Task 4: Filter assistant sessions from all listings

**Files:**
- Modify: `src/core/sessions/session-manager.ts`
- Test: `src/core/sessions/__tests__/session-manager.test.ts`

- [ ] **Step 1: Write failing tests**

Open `src/core/sessions/__tests__/session-manager.test.ts` and add this describe block:

```typescript
describe('assistant session filtering', () => {
  it('listSessions excludes assistant sessions', () => {
    const manager = new SessionManager(null);
    const regularSession = new Session({
      channelId: 'telegram',
      agentName: 'claude-code',
      workingDirectory: '/tmp',
      agentInstance: mockAgentInstance(),
    });
    const assistantSession = new Session({
      channelId: 'telegram',
      agentName: 'claude-code',
      workingDirectory: '/tmp',
      agentInstance: mockAgentInstance(),
      isAssistant: true,
    });
    manager.registerSession(regularSession);
    manager.registerSession(assistantSession);

    const result = manager.listSessions();
    expect(result).toContain(regularSession);
    expect(result).not.toContain(assistantSession);
  });

  it('listAllSessions excludes assistant records', async () => {
    const tmpPath = path.join(os.tmpdir(), `test-store-${Date.now()}.json`);
    const store = new JsonFileSessionStore(tmpPath, 30);
    const manager = new SessionManager(store);

    await store.save({
      sessionId: 'regular-1',
      agentSessionId: 'a1',
      agentName: 'claude-code',
      workingDir: '/tmp',
      channelId: 'telegram',
      status: 'finished',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      platform: {},
    });
    await store.save({
      sessionId: 'assistant-1',
      agentSessionId: 'a2',
      agentName: 'claude-code',
      workingDir: '/tmp',
      channelId: 'telegram',
      status: 'finished',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isAssistant: true,
      platform: {},
    });

    const summaries = manager.listAllSessions();
    expect(summaries.some(s => s.id === 'regular-1')).toBe(true);
    expect(summaries.some(s => s.id === 'assistant-1')).toBe(false);
    store.destroy();
    fs.unlinkSync(tmpPath);
  });

  it('listRecords excludes assistant records', async () => {
    const tmpPath = path.join(os.tmpdir(), `test-store-${Date.now()}.json`);
    const store = new JsonFileSessionStore(tmpPath, 30);
    const manager = new SessionManager(store);

    await store.save({
      sessionId: 'regular-1',
      agentSessionId: 'a1',
      agentName: 'claude-code',
      workingDir: '/tmp',
      channelId: 'telegram',
      status: 'finished',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      platform: {},
    });
    await store.save({
      sessionId: 'assistant-1',
      agentSessionId: 'a2',
      agentName: 'claude-code',
      workingDir: '/tmp',
      channelId: 'telegram',
      status: 'finished',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isAssistant: true,
      platform: {},
    });

    const records = manager.listRecords();
    expect(records.some(r => r.sessionId === 'regular-1')).toBe(true);
    expect(records.some(r => r.sessionId === 'assistant-1')).toBe(false);
    store.destroy();
    fs.unlinkSync(tmpPath);
  });
});
```

Check existing imports at the top of the test file and add any missing ones (`path`, `os`, `fs`, `JsonFileSessionStore`).

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test src/core/sessions/__tests__/session-manager.test.ts 2>&1 | tail -20
```

Expected: New tests fail.

- [ ] **Step 3: Add filter to `listSessions()`**

In `src/core/sessions/session-manager.ts`, update `listSessions`:

```typescript
listSessions(channelId?: string): Session[] {
  const all = Array.from(this.sessions.values()).filter(s => !s.isAssistant);
  if (channelId) return all.filter((s) => s.channelId === channelId);
  return all;
}
```

- [ ] **Step 4: Add filter to `listAllSessions()`**

In `src/core/sessions/session-manager.ts`, update the records variable in `listAllSessions`:

```typescript
listAllSessions(channelId?: string): SessionSummary[] {
  if (this.store) {
    let records = this.store.list().filter(r => !r.isAssistant);   // ← add filter
    if (channelId) records = records.filter((r) => r.channelId === channelId);
    // ... rest unchanged
```

- [ ] **Step 5: Add filter to `listRecords()`**

In `src/core/sessions/session-manager.ts`, update `listRecords`:

```typescript
listRecords(filter?: {
  statuses?: string[];
}): import("../types.js").SessionRecord[] {
  if (!this.store) return [];
  let records = this.store.list().filter(r => !r.isAssistant);   // ← add filter
  if (filter?.statuses?.length) {
    records = records.filter((r) => filter.statuses!.includes(r.status));
  }
  return records;
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test src/core/sessions/__tests__/session-manager.test.ts 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/sessions/session-manager.ts src/core/sessions/__tests__/session-manager.test.ts
git commit -m "feat: filter assistant sessions from all session listings"
```

---

### Task 5: Replace `spawn()`/`respawn()` with `getOrSpawn()` in `AssistantManager`

**Files:**
- Modify: `src/core/assistant/assistant-manager.ts`
- Modify: `src/core/__tests__/assistant-manager.test.ts`

- [ ] **Step 1: Rewrite `assistant-manager.test.ts`**

Replace the entire content of `src/core/__tests__/assistant-manager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssistantManager } from "../assistant/assistant-manager.js";
import { AssistantRegistry } from "../assistant/assistant-registry.js";
import type { SessionRecord } from "../types.js";

function makeRecord(sessionId: string, channelId: string): SessionRecord {
  return {
    sessionId,
    agentSessionId: `agent-${sessionId}`,
    agentName: 'claude-code',
    workingDir: '/tmp',
    channelId,
    status: 'finished',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    isAssistant: true,
    platform: {},
  };
}

function mockCore(existingRecord?: SessionRecord) {
  const session = {
    id: existingRecord?.sessionId ?? "assistant-1",
    threadId: "",
    enqueuePrompt: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
  const sessionStore = {
    findAssistant: vi.fn().mockReturnValue(existingRecord ?? undefined),
  };
  return {
    createSession: vi.fn().mockImplementation(async (params) => {
      if (params.threadId) session.threadId = params.threadId;
      if (params.existingSessionId) session.id = params.existingSessionId;
      return session;
    }),
    connectSessionBridge: vi.fn(),
    configManager: {
      get: () => ({ defaultAgent: "claude-code" }),
      resolveWorkspace: () => "/home/user/code",
    },
    sessionStore,
    _session: session,
  };
}

describe("AssistantManager", () => {
  let registry: AssistantRegistry;

  beforeEach(() => {
    registry = new AssistantRegistry();
  });

  describe("getOrSpawn()", () => {
    it("creates new session when no existing record", async () => {
      const core = mockCore();
      const manager = new AssistantManager(core as any, registry);

      const session = await manager.getOrSpawn("telegram", "12345");

      expect(core.createSession).toHaveBeenCalledWith(expect.objectContaining({
        channelId: "telegram",
        isAssistant: true,
        initialName: "Assistant",
        threadId: "12345",
      }));
      expect(session.threadId).toBe("12345");
      expect(manager.get("telegram")).toBe(session);
    });

    it("reuses existing session ID when record found in store", async () => {
      const existing = makeRecord("old-session-id", "telegram");
      const core = mockCore(existing);
      const manager = new AssistantManager(core as any, registry);

      const session = await manager.getOrSpawn("telegram", "12345");

      expect(core.sessionStore.findAssistant).toHaveBeenCalledWith("telegram");
      expect(core.createSession).toHaveBeenCalledWith(expect.objectContaining({
        existingSessionId: "old-session-id",
        isAssistant: true,
        channelId: "telegram",
        threadId: "12345",
      }));
      expect(session.id).toBe("old-session-id");
    });

    it("second call reuses same session ID", async () => {
      const core = mockCore();
      const manager = new AssistantManager(core as any, registry);

      // First call — no existing record
      await manager.getOrSpawn("telegram", "12345");

      // Now the store has the session ID
      core.sessionStore.findAssistant.mockReturnValue(makeRecord("assistant-1", "telegram"));

      // Second call — should reuse
      await manager.getOrSpawn("telegram", "12345");
      expect(core.createSession).toHaveBeenCalledTimes(2);
      const secondCall = core.createSession.mock.calls[1][0];
      expect(secondCall.existingSessionId).toBe("assistant-1");
    });

    it("stores pending system prompt after spawn", async () => {
      const core = mockCore();
      const manager = new AssistantManager(core as any, registry);

      await manager.getOrSpawn("telegram", "12345");
      const prompt = manager.consumePendingSystemPrompt("telegram");
      expect(typeof prompt).toBe("string");
      expect(prompt!.length).toBeGreaterThan(0);
    });
  });

  it("get returns null for unknown channel", () => {
    const core = mockCore();
    const manager = new AssistantManager(core as any, registry);
    expect(manager.get("discord")).toBeNull();
  });

  it("isAssistant returns true for assistant session", async () => {
    const core = mockCore();
    const manager = new AssistantManager(core as any, registry);
    await manager.getOrSpawn("telegram", "12345");
    expect(manager.isAssistant("assistant-1")).toBe(true);
    expect(manager.isAssistant("other-session")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test src/core/__tests__/assistant-manager.test.ts 2>&1 | tail -20
```

Expected: Tests fail (`getOrSpawn is not a function`).

- [ ] **Step 3: Rewrite `assistant-manager.ts`**

Replace the entire content of `src/core/assistant/assistant-manager.ts`:

```typescript
import type { Session } from '../sessions/session.js'
import type { AssistantRegistry } from './assistant-registry.js'
import type { SessionStore } from '../sessions/session-store.js'
import { createChildLogger } from '../utils/log.js'

const log = createChildLogger({ module: 'assistant-manager' })

interface AssistantManagerCore {
  createSession(params: {
    channelId: string
    agentName: string
    workingDirectory: string
    initialName?: string
    isAssistant?: boolean
    threadId?: string
    existingSessionId?: string
  }): Promise<Session>
  connectSessionBridge(session: Session): void
  configManager: {
    get(): { defaultAgent: string }
    resolveWorkspace(): string
  }
  sessionStore: SessionStore | null
}

export class AssistantManager {
  private sessions = new Map<string, Session>()
  private pendingSystemPrompts = new Map<string, string>()

  constructor(
    private core: AssistantManagerCore,
    private registry: AssistantRegistry,
  ) {}

  async getOrSpawn(channelId: string, threadId: string): Promise<Session> {
    const existing = this.core.sessionStore?.findAssistant(channelId)
    const session = await this.core.createSession({
      channelId,
      agentName: this.core.configManager.get().defaultAgent,
      workingDirectory: this.core.configManager.resolveWorkspace(),
      initialName: 'Assistant',
      isAssistant: true,
      threadId,
      existingSessionId: existing?.sessionId,
    })
    this.sessions.set(channelId, session)

    const systemPrompt = this.registry.buildSystemPrompt(channelId)
    this.pendingSystemPrompts.set(channelId, systemPrompt)
    log.info(
      { sessionId: session.id, channelId, reused: !!existing },
      existing ? 'Assistant session reused (system prompt deferred)' : 'Assistant spawned (system prompt deferred)',
    )

    return session
  }

  get(channelId: string): Session | null {
    return this.sessions.get(channelId) ?? null
  }

  /**
   * Consume and return any pending system prompt for a channel.
   * Should be prepended to the first real user message.
   */
  consumePendingSystemPrompt(channelId: string): string | undefined {
    const prompt = this.pendingSystemPrompts.get(channelId)
    if (prompt) this.pendingSystemPrompts.delete(channelId)
    return prompt
  }

  isAssistant(sessionId: string): boolean {
    for (const s of this.sessions.values()) {
      if (s.id === sessionId) return true
    }
    return false
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test src/core/__tests__/assistant-manager.test.ts 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/assistant/assistant-manager.ts src/core/__tests__/assistant-manager.test.ts
git commit -m "feat: replace spawn/respawn with getOrSpawn in AssistantManager"
```

---

### Task 6: Expose `sessionStore` on `VibenCore` and wire to `AssistantManager`

**Files:**
- Modify: `src/core/core.ts`

- [ ] **Step 1: Make `sessionStore` accessible**

In `src/core/core.ts`, change `private sessionStore` to public:

```typescript
// Before:
private sessionStore: SessionStore | null = null;

// After:
sessionStore: SessionStore | null = null;
```

- [ ] **Step 2: Build to verify no type errors**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | tail -30
```

Expected: Build succeeds. (The `AssistantManagerCore` interface now requires `sessionStore` — since `VibenCore` implements it via `this as any`, TypeScript won't enforce the interface match unless you add `sessionStore` to the interface, which was done in Task 5 step 3.)

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test 2>&1 | tail -30
```

Expected: All tests pass (or pre-existing failures only).

- [ ] **Step 4: Commit**

```bash
git add src/core/core.ts
git commit -m "feat: expose sessionStore publicly on VibenCore for AssistantManager access"
```

---

### Task 7: Update Telegram adapter to use `getOrSpawn()`

**Files:**
- Modify: `src/plugins/telegram/adapter.ts`

- [ ] **Step 1: Replace `spawn` call with `getOrSpawn`**

In `src/plugins/telegram/adapter.ts`, find (around line 688):

```typescript
await this.core.assistantManager.spawn("telegram", String(this.assistantTopicId));
```

Replace with:

```typescript
await this.core.assistantManager.getOrSpawn("telegram", String(this.assistantTopicId));
```

- [ ] **Step 2: Build to verify no type errors**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/telegram/adapter.ts
git commit -m "feat: use getOrSpawn in Telegram adapter for persistent assistant session"
```

---

### Task 8: Remove `/clear` command

**Files:**
- Modify: `src/core/commands/session.ts`

- [ ] **Step 1: Remove the `clear` command block**

In `src/core/commands/session.ts`, remove this entire block (around lines 81-92):

```typescript
registry.register({
  name: 'clear',
  description: 'Clear session history',
  category: 'system',
  handler: async (args) => {
    if (!core.assistantManager) return { type: 'error', message: 'Assistant not available' }
    const assistant = core.assistantManager.get(args.channelId)
    if (!assistant) return { type: 'error', message: 'No assistant session for this channel.' }
    await core.assistantManager.respawn(args.channelId, assistant.threadId)
    return { type: 'text', text: '✅ Assistant history cleared.' }
  },
})
```

- [ ] **Step 2: Build to verify no type errors**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 3: Run commands test to verify**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test src/core/commands/__tests__/commands.test.ts 2>&1 | tail -20
```

Expected: Tests pass (or update any test that checks for `/clear` command).

- [ ] **Step 4: Commit**

```bash
git add src/core/commands/session.ts
git commit -m "feat: remove /clear command for assistant (no longer needed)"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test 2>&1 | tail -40
```

Expected: All tests pass (or only pre-existing failures).

- [ ] **Step 2: Build production bundle**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Final commit (if anything was missed)**

If there are any unstaged changes, commit them.

```bash
git add -p  # review each change
git commit -m "chore: persistent assistant session final cleanup"
```
