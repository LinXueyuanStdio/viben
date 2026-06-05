# Session List History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `GET /sessions` returns all sessions (live + historical) so the App can show full session history including cancelled and finished sessions.

**Architecture:** Add `SessionSummary` interface and `listAllSessions()` method to `SessionManager` that merges store records (all statuses) with live in-memory session data. Route switches from `listSessions()` to `listAllSessions()`. Historical sessions get `queueDepth: 0`, `promptRunning: false`, `isLive: false`.

**Tech Stack:** TypeScript, Vitest, Fastify

---

## File Map

| File | Change |
|------|--------|
| `src/core/sessions/session-manager.ts` | Add `SessionSummary` interface + `listAllSessions()` method |
| `src/core/sessions/__tests__/session-manager.test.ts` | Add tests for `listAllSessions()` |
| `src/plugins/api-server/routes/sessions.ts` | Update `GET /` to use `listAllSessions()`, add `isLive`/`channelId`/`lastActiveAt` to response |
| `src/plugins/api-server/__tests__/routes-sessions.test.ts` | Add `listAllSessions` to mock, update/add tests |

---

### Task 1: Add `SessionSummary` + `listAllSessions()` to SessionManager (TDD)

**Files:**
- Modify: `src/core/sessions/session-manager.ts`
- Test: `src/core/sessions/__tests__/session-manager.test.ts`

- [ ] **Step 1: Write failing tests for `listAllSessions()`**

Append to `src/core/sessions/__tests__/session-manager.test.ts`:

```typescript
describe('listAllSessions', () => {
  it('returns live session with isLive=true and runtime fields', () => {
    const manager = new SessionManager(null)
    const session = createSession({ id: 'sess-1', channelId: 'telegram' })
    session.activate()
    manager.registerSession(session)

    const summaries = manager.listAllSessions()

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      id: 'sess-1',
      agent: 'claude',
      status: 'active',
      channelId: 'telegram',
      workspace: '/workspace',
      isLive: true,
      promptRunning: false,
      queueDepth: 0,
    })
  })

  it('returns historical session (store only) with isLive=false and zero runtime fields', async () => {
    const store = mockStore()
    const manager = new SessionManager(store)

    await store.save({
      sessionId: 'old-sess',
      agentSessionId: 'agent-old',
      agentName: 'gemini',
      workingDir: '/old',
      channelId: 'telegram',
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00Z',
      lastActiveAt: '2026-01-02T00:00:00Z',
      name: 'Old Session',
      platform: {},
    })

    const summaries = manager.listAllSessions()

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      id: 'old-sess',
      agent: 'gemini',
      status: 'cancelled',
      name: 'Old Session',
      workspace: '/old',
      lastActiveAt: '2026-01-02T00:00:00Z',
      dangerousMode: false,
      queueDepth: 0,
      promptRunning: false,
      capabilities: null,
      isLive: false,
    })
    expect(summaries[0].configOptions).toBeUndefined()
  })

  it('overlays live data onto store record when session is in memory', async () => {
    const store = mockStore()
    const manager = new SessionManager(store)
    const session = createSession({ id: 'live-sess', channelId: 'telegram' })
    session.activate()
    manager.registerSession(session)

    await store.save({
      sessionId: 'live-sess',
      agentSessionId: 'agent-live',
      agentName: 'claude',
      workingDir: '/workspace',
      channelId: 'telegram',
      status: 'active',
      createdAt: session.createdAt.toISOString(),
      lastActiveAt: '2026-04-03T10:00:00Z',
      platform: {},
    })

    const summaries = manager.listAllSessions()

    expect(summaries).toHaveLength(1)
    expect(summaries[0].isLive).toBe(true)
    expect(summaries[0].id).toBe('live-sess')
    // lastActiveAt comes from store record
    expect(summaries[0].lastActiveAt).toBe('2026-04-03T10:00:00Z')
  })

  it('returns both live and historical when mixed', async () => {
    const store = mockStore()
    const manager = new SessionManager(store)

    // Live session registered in memory AND store
    const live = createSession({ id: 'live-sess', channelId: 'telegram' })
    live.activate()
    manager.registerSession(live)
    await store.save({
      sessionId: 'live-sess',
      agentSessionId: 'agent-live',
      agentName: 'claude',
      workingDir: '/workspace',
      channelId: 'telegram',
      status: 'active',
      createdAt: live.createdAt.toISOString(),
      lastActiveAt: '2026-04-03T10:00:00Z',
      platform: {},
    })

    // Historical session only in store
    await store.save({
      sessionId: 'old-sess',
      agentSessionId: 'agent-old',
      agentName: 'gemini',
      workingDir: '/old',
      channelId: 'telegram',
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00Z',
      lastActiveAt: '2026-01-02T00:00:00Z',
      platform: {},
    })

    const summaries = manager.listAllSessions()

    expect(summaries).toHaveLength(2)
    const liveResult = summaries.find(s => s.id === 'live-sess')!
    const histResult = summaries.find(s => s.id === 'old-sess')!
    expect(liveResult.isLive).toBe(true)
    expect(histResult.isLive).toBe(false)
    // No duplicates
    expect(summaries.filter(s => s.id === 'live-sess')).toHaveLength(1)
  })

  it('falls back to live-only when no store', () => {
    const manager = new SessionManager(null)
    const session = createSession({ id: 'sess-1', channelId: 'telegram' })
    session.activate()
    manager.registerSession(session)

    const summaries = manager.listAllSessions()

    expect(summaries).toHaveLength(1)
    expect(summaries[0].isLive).toBe(true)
    expect(summaries[0].id).toBe('sess-1')
  })

  it('filters by channelId', async () => {
    const store = mockStore()
    const manager = new SessionManager(store)

    await store.save({
      sessionId: 'tg-sess',
      agentSessionId: 'a1',
      agentName: 'claude',
      workingDir: '/w',
      channelId: 'telegram',
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00Z',
      lastActiveAt: '2026-01-01T00:00:00Z',
      platform: {},
    })
    await store.save({
      sessionId: 'api-sess',
      agentSessionId: 'a2',
      agentName: 'claude',
      workingDir: '/w',
      channelId: 'api',
      status: 'finished',
      createdAt: '2026-01-01T00:00:00Z',
      lastActiveAt: '2026-01-01T00:00:00Z',
      platform: {},
    })

    const summaries = manager.listAllSessions('telegram')

    expect(summaries).toHaveLength(1)
    expect(summaries[0].id).toBe('tg-sess')
  })

  it('historical session with acpState returns configOptions and capabilities', async () => {
    const store = mockStore()
    const manager = new SessionManager(store)
    const configOptions = [{ id: 'mode', name: 'Mode', category: 'mode', type: 'select' as const, currentValue: 'auto', options: [] }]

    await store.save({
      sessionId: 'sess-acp',
      agentSessionId: 'agent-acp',
      agentName: 'claude',
      workingDir: '/w',
      channelId: 'api',
      status: 'finished',
      createdAt: '2026-01-01T00:00:00Z',
      lastActiveAt: '2026-01-01T00:00:00Z',
      platform: {},
      acpState: { configOptions },
    })

    const summaries = manager.listAllSessions()

    expect(summaries[0].configOptions).toEqual(configOptions)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm test src/core/sessions/__tests__/session-manager.test.ts 2>&1 | tail -20
```

Expected: FAIL — `manager.listAllSessions is not a function`

- [ ] **Step 3: Add `SessionSummary` interface and `listAllSessions()` to `session-manager.ts`**

Add import at the top of `src/core/sessions/session-manager.ts` (after existing imports):

```typescript
import type { SessionStatus, ConfigOption, AgentCapabilities } from "../types.js";
```

Add `SessionSummary` interface after the imports, before the class:

```typescript
export interface SessionSummary {
  id: string;
  agent: string;
  status: SessionStatus;
  name: string | null;
  workspace: string;
  channelId: string;
  createdAt: string;
  lastActiveAt: string | null;
  dangerousMode: boolean;
  queueDepth: number;
  promptRunning: boolean;
  configOptions?: ConfigOption[];
  capabilities: AgentCapabilities | null;
  isLive: boolean;
}
```

Add `listAllSessions()` method to the `SessionManager` class, after `listSessions()`:

```typescript
listAllSessions(channelId?: string): SessionSummary[] {
  if (this.store) {
    let records = this.store.list();
    if (channelId) records = records.filter((r) => r.channelId === channelId);
    return records.map((record) => {
      const live = this.sessions.get(record.sessionId);
      if (live) {
        return {
          id: live.id,
          agent: live.agentName,
          status: live.status,
          name: live.name ?? null,
          workspace: live.workingDirectory,
          channelId: live.channelId,
          createdAt: live.createdAt.toISOString(),
          lastActiveAt: record.lastActiveAt ?? null,
          dangerousMode: live.clientOverrides.bypassPermissions ?? false,
          queueDepth: live.queueDepth,
          promptRunning: live.promptRunning,
          configOptions: live.configOptions?.length ? live.configOptions : undefined,
          capabilities: live.agentCapabilities ?? null,
          isLive: true,
        };
      }
      return {
        id: record.sessionId,
        agent: record.agentName,
        status: record.status,
        name: record.name ?? null,
        workspace: record.workingDir,
        channelId: record.channelId,
        createdAt: record.createdAt,
        lastActiveAt: record.lastActiveAt ?? null,
        dangerousMode: record.clientOverrides?.bypassPermissions ?? false,
        queueDepth: 0,
        promptRunning: false,
        configOptions: record.acpState?.configOptions,
        capabilities: record.acpState?.agentCapabilities ?? null,
        isLive: false,
      };
    });
  }

  // Fallback: no store — return live sessions only
  let live = Array.from(this.sessions.values());
  if (channelId) live = live.filter((s) => s.channelId === channelId);
  return live.map((s) => ({
    id: s.id,
    agent: s.agentName,
    status: s.status,
    name: s.name ?? null,
    workspace: s.workingDirectory,
    channelId: s.channelId,
    createdAt: s.createdAt.toISOString(),
    lastActiveAt: null,
    dangerousMode: s.clientOverrides.bypassPermissions ?? false,
    queueDepth: s.queueDepth,
    promptRunning: s.promptRunning,
    configOptions: s.configOptions?.length ? s.configOptions : undefined,
    capabilities: s.agentCapabilities ?? null,
    isLive: true,
  }));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test src/core/sessions/__tests__/session-manager.test.ts 2>&1 | tail -20
```

Expected: All `listAllSessions` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/sessions/session-manager.ts src/core/sessions/__tests__/session-manager.test.ts
git commit -m "feat: add SessionSummary + listAllSessions() to SessionManager"
```

---

### Task 2: Update `GET /sessions` route

**Files:**
- Modify: `src/plugins/api-server/routes/sessions.ts`
- Test: `src/plugins/api-server/__tests__/routes-sessions.test.ts`

- [ ] **Step 1: Write failing route test**

In `src/plugins/api-server/__tests__/routes-sessions.test.ts`, update `createMockDeps` to add `listAllSessions` to the mock:

```typescript
// In createMockDeps, add to sessionManager mock:
listAllSessions: vi.fn().mockReturnValue([
  {
    id: 'sess-1',
    agent: 'claude',
    status: 'active',
    name: 'Test Session',
    workspace: '/tmp/test',
    channelId: 'api',
    createdAt: '2026-01-01T00:00:00Z',
    lastActiveAt: '2026-01-01T00:00:00Z',
    dangerousMode: false,
    queueDepth: 0,
    promptRunning: false,
    configOptions: undefined,
    capabilities: null,
    isLive: true,
  },
]),
```

Update the existing `GET /api/v1/sessions` test to verify new fields:

```typescript
describe('GET /api/v1/sessions', () => {
  it('returns list of sessions with isLive and lastActiveAt', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/sessions',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].id).toBe('sess-1');
    expect(body.sessions[0].agent).toBe('claude');
    expect(body.sessions[0].status).toBe('active');
    expect(body.sessions[0].isLive).toBe(true);
    expect(body.sessions[0].lastActiveAt).toBe('2026-01-01T00:00:00Z');
    expect(body.sessions[0].channelId).toBe('api');
  });

  it('returns historical (non-live) sessions', async () => {
    (deps.core.sessionManager.listAllSessions as any).mockReturnValue([
      {
        id: 'old-sess',
        agent: 'claude',
        status: 'cancelled',
        name: 'Old Session',
        workspace: '/tmp/old',
        channelId: 'telegram',
        createdAt: '2026-01-01T00:00:00Z',
        lastActiveAt: '2026-01-02T00:00:00Z',
        dangerousMode: false,
        queueDepth: 0,
        promptRunning: false,
        configOptions: undefined,
        capabilities: null,
        isLive: false,
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/sessions',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.sessions[0].id).toBe('old-sess');
    expect(body.sessions[0].status).toBe('cancelled');
    expect(body.sessions[0].isLive).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test src/plugins/api-server/__tests__/routes-sessions.test.ts 2>&1 | tail -20
```

Expected: FAIL — `listAllSessions is not a function` / missing fields in response.

- [ ] **Step 3: Update `GET /sessions` handler in `routes/sessions.ts`**

Replace the `GET /` handler (currently lines 24–44) with:

```typescript
// GET /sessions — list all sessions (live + historical)
app.get('/', { preHandler: requireScopes('sessions:read') }, async () => {
  const summaries = deps.core.sessionManager.listAllSessions();
  return {
    sessions: summaries.map((s) => ({
      id: s.id,
      agent: s.agent,
      status: s.status,
      name: s.name,
      workspace: s.workspace,
      channelId: s.channelId,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      dangerousMode: s.dangerousMode,
      queueDepth: s.queueDepth,
      promptRunning: s.promptRunning,
      configOptions: s.configOptions,
      capabilities: s.capabilities,
      isLive: s.isLive,
    })),
  };
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test src/plugins/api-server/__tests__/routes-sessions.test.ts 2>&1 | tail -20
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite to catch regressions**

```bash
pnpm test 2>&1 | tail -30
```

Expected: All tests pass. If any test fails due to missing `listAllSessions` in a mock, add it to that mock with `vi.fn().mockReturnValue([])`.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/api-server/routes/sessions.ts src/plugins/api-server/__tests__/routes-sessions.test.ts
git commit -m "feat: GET /sessions returns full session history via listAllSessions"
```
