# UI Dashboard Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add EventBus, SSE endpoint, API fixes, static file serving, and token auth to support the embedded UI dashboard.

**Architecture:** Create an `EventBus` (using existing `TypedEmitter`) as the global event backbone. `SessionBridge` and `SessionManager` emit events onto it, `ApiServer` subscribes and streams to SSE clients. Static file serving enables the embedded SPA.

**Tech Stack:** Node.js, TypeScript, vitest, existing `http.createServer`

**Spec:** `docs/superpowers/specs/2026-03-23-ui-dashboard-design.md`

---

### Task 1: EventBus

Create the global event bus that bridges session/agent events to SSE consumers.

**Files:**
- Create: `src/core/event-bus.ts`
- Create: `src/core/__tests__/event-bus.test.ts`
- Modify: `src/core/index.ts` (add export)

- [ ] **Step 1: Write the failing test**

```typescript
// src/core/__tests__/event-bus.test.ts
import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../event-bus.js'

describe('EventBus', () => {
  it('emits session:created event to subscribers', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('session:created', handler)
    bus.emit('session:created', { sessionId: 's1', agent: 'claude', status: 'initializing' })
    expect(handler).toHaveBeenCalledWith({ sessionId: 's1', agent: 'claude', status: 'initializing' })
  })

  it('emits session:updated event', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('session:updated', handler)
    bus.emit('session:updated', { sessionId: 's1', status: 'active', name: 'Test' })
    expect(handler).toHaveBeenCalledWith({ sessionId: 's1', status: 'active', name: 'Test' })
  })

  it('emits session:deleted event', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('session:deleted', handler)
    bus.emit('session:deleted', { sessionId: 's1' })
    expect(handler).toHaveBeenCalledWith({ sessionId: 's1' })
  })

  it('emits agent:event with sessionId', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('agent:event', handler)
    bus.emit('agent:event', { sessionId: 's1', event: { type: 'text', content: 'hello' } })
    expect(handler).toHaveBeenCalledWith({ sessionId: 's1', event: { type: 'text', content: 'hello' } })
  })

  it('emits permission:request event', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('permission:request', handler)
    const perm = { id: 'p1', description: 'Write file', options: [{ id: 'allow', label: 'Allow', isAllow: true }] }
    bus.emit('permission:request', { sessionId: 's1', permission: perm })
    expect(handler).toHaveBeenCalledWith({ sessionId: 's1', permission: perm })
  })

  it('removes listener with off()', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('session:created', handler)
    bus.off('session:created', handler)
    bus.emit('session:created', { sessionId: 's1', agent: 'claude', status: 'initializing' })
    expect(handler).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/core/__tests__/event-bus.test.ts`
Expected: FAIL — module `../event-bus.js` not found

- [ ] **Step 3: Implement EventBus**

```typescript
// src/core/event-bus.ts
import { TypedEmitter } from './typed-emitter.js'
import type { AgentEvent, PermissionRequest, SessionStatus } from './types.js'

export interface EventBusEvents {
  'session:created': (data: { sessionId: string; agent: string; status: SessionStatus }) => void
  'session:updated': (data: { sessionId: string; status?: SessionStatus; name?: string; dangerousMode?: boolean }) => void
  'session:deleted': (data: { sessionId: string }) => void
  'agent:event': (data: { sessionId: string; event: AgentEvent }) => void
  'permission:request': (data: { sessionId: string; permission: PermissionRequest }) => void
}

export class EventBus extends TypedEmitter<EventBusEvents> {}
```

- [ ] **Step 4: Add export to index.ts**

Add to `src/core/index.ts`:
```typescript
export { EventBus, type EventBusEvents } from './event-bus.js'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- src/core/__tests__/event-bus.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/event-bus.ts src/core/__tests__/event-bus.test.ts src/core/index.ts
git commit -m "feat(core): add EventBus for system-wide event broadcasting"
```

---

### Task 2: Wire EventBus into VibenCore

Integrate EventBus into the core so SessionBridge and SessionManager can emit events.

**Files:**
- Modify: `src/core/core.ts:33-56` (constructor — create EventBus)
- Modify: `src/core/session-bridge.ts:11-15` (BridgeDeps — add eventBus)
- Modify: `src/core/session-bridge.ts:64-123` (wireSessionToAdapter — emit agent:event)
- Modify: `src/core/session-bridge.ts:125-140` (wirePermissions — emit permission:request)
- Modify: `src/core/session-bridge.ts:142-164` (wireLifecycle — emit session:updated)
- Modify: `src/core/core.ts:176-256` (createSession — emit session:created)
- Modify: `src/core/session-manager.ts:133-136` (removeRecord — emit session:deleted)

- [ ] **Step 1: Add EventBus to BridgeDeps**

In `src/core/session-bridge.ts`, add to import and interface:
```typescript
// Add to imports
import type { EventBus } from './event-bus.js'

// Update BridgeDeps
export interface BridgeDeps {
  messageTransformer: MessageTransformer;
  notificationManager: NotificationManager;
  sessionManager: SessionManager;
  eventBus?: EventBus;
}
```

- [ ] **Step 2: Emit events from SessionBridge**

In `src/core/session-bridge.ts`:

In `wireSessionToAdapter()` — add `eventBus` emit after the existing `agent_event` handler setup (inside the handler, after the switch statement on line 72):
```typescript
// At the end of the agentEventHandler function, after the switch block:
this.deps.eventBus?.emit('agent:event', { sessionId: this.session.id, event });
```

In `wirePermissions()` — add emit after `session.emit("permission_request")` on line 129:
```typescript
this.deps.eventBus?.emit('permission:request', {
  sessionId: this.session.id,
  permission: request,
});
```

In `wireLifecycle()` — add emit in `statusChangeHandler` after `patchRecord` call on line 145-148:
```typescript
this.deps.eventBus?.emit('session:updated', {
  sessionId: this.session.id,
  status: to,
});
```

Add emit in `namedHandler` after `patchRecord` call on line 160:
```typescript
this.deps.eventBus?.emit('session:updated', {
  sessionId: this.session.id,
  name,
});
```

- [ ] **Step 3: Create and expose EventBus in VibenCore**

In `src/core/core.ts`:

Add import:
```typescript
import { EventBus } from './event-bus.js'
```

Add property (after line 31):
```typescript
eventBus: EventBus;
```

In constructor (after line 46, `this.messageTransformer = ...`):
```typescript
this.eventBus = new EventBus();
```

- [ ] **Step 4: Pass EventBus to SessionBridge via createBridge**

In `src/core/core.ts`, find `createBridge` method (around line 482-488). Add `eventBus` to the deps object (keep existing visibility — no `private`/`public` modifier):
```typescript
createBridge(session: Session, adapter: ChannelAdapter): SessionBridge {
  return new SessionBridge(session, adapter, {
    messageTransformer: this.messageTransformer,
    notificationManager: this.notificationManager,
    sessionManager: this.sessionManager,
    eventBus: this.eventBus,
  });
}
```

- [ ] **Step 5: Emit session:created in createSession**

In `src/core/core.ts`, in `createSession()` method, after `registerSession` call (around line 211):
```typescript
this.eventBus.emit('session:created', {
  sessionId: session.id,
  agent: session.agentName,
  status: session.status,
});
```

- [ ] **Step 6: Emit session:deleted from SessionManager**

In `src/core/session-manager.ts`:

Add import and optional eventBus property:
```typescript
import type { EventBus } from './event-bus.js'
```

Add to class:
```typescript
private eventBus?: EventBus;

setEventBus(eventBus: EventBus): void {
  this.eventBus = eventBus;
}
```

In `removeRecord()` (lines 133-136), emit after removal:
```typescript
async removeRecord(sessionId: string): Promise<void> {
  if (!this.store) return;
  await this.store.remove(sessionId);
  this.eventBus?.emit('session:deleted', { sessionId });
}
```

In `src/core/core.ts` constructor, after creating `this.eventBus`:
```typescript
this.sessionManager.setEventBus(this.eventBus);
```

- [ ] **Step 7: Run existing tests to verify no regressions**

Run: `pnpm test`
Expected: All existing tests PASS (EventBus is optional via `?` so no mock changes needed)

- [ ] **Step 8: Commit**

```bash
git add src/core/core.ts src/core/session-bridge.ts src/core/session-manager.ts
git commit -m "feat(core): wire EventBus into SessionBridge, SessionManager, and VibenCore"
```

---

### Task 3: Fix API — Cancel Session & Extend List Response

Fix the cancel endpoint to properly transition session status, and extend the list endpoint response.

**Files:**
- Modify: `src/core/api-server.ts:508-516` (handleCancelSession)
- Modify: `src/core/api-server.ts:518-529` (handleListSessions)
- Modify: `src/__tests__/api-server.test.ts` (add/update tests)

- [ ] **Step 1: Write failing test for cancel fix**

Add to `src/__tests__/api-server.test.ts`:
```typescript
it('DELETE /api/sessions/:id calls sessionManager.cancelSession', async () => {
  const mockSession = { id: 'abc', abortPrompt: vi.fn() }
  mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession)
  mockCore.sessionManager.cancelSession = vi.fn()
  const port = await startServer()

  const res = await apiFetch(port, '/api/sessions/abc', { method: 'DELETE' })
  expect(res.status).toBe(200)
  expect(mockCore.sessionManager.cancelSession).toHaveBeenCalledWith('abc')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/__tests__/api-server.test.ts`
Expected: FAIL — `cancelSession` not called (current code calls `session.abortPrompt()`)

- [ ] **Step 3: Update existing cancel test and fix handleCancelSession**

First, find the existing test `DELETE /api/sessions/:id cancels a session` that asserts `session.abortPrompt` was called. Update it to assert `sessionManager.cancelSession` instead, since the handler will no longer call `abortPrompt` directly.

Then fix the handler:

In `src/core/api-server.ts`, replace `handleCancelSession` (lines 508-516):
```typescript
private async handleCancelSession(sessionId: string, res: http.ServerResponse): Promise<void> {
  const session = this.core.sessionManager.getSession(sessionId)
  if (!session) {
    this.sendJson(res, 404, { error: `Session "${sessionId}" not found` })
    return
  }
  await this.core.sessionManager.cancelSession(sessionId)
  this.sendJson(res, 200, { ok: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/__tests__/api-server.test.ts`
Expected: PASS

- [ ] **Step 5: Write test for extended list response**

Add to `src/__tests__/api-server.test.ts`:
```typescript
it('GET /api/sessions returns extended fields', async () => {
  const created = new Date('2026-01-01T00:00:00Z')
  mockCore.sessionManager.listSessions.mockReturnValueOnce([
    {
      id: 'abc',
      agentName: 'claude',
      status: 'active',
      name: 'Test',
      workingDirectory: '/tmp',
      createdAt: created,
      dangerousMode: true,
      queueDepth: 2,
      promptRunning: true,
    },
  ])
  const port = await startServer()

  const res = await apiFetch(port, '/api/sessions')
  const body = await res.json()
  expect(body.sessions[0]).toEqual({
    id: 'abc',
    agent: 'claude',
    status: 'active',
    name: 'Test',
    workspace: '/tmp',
    createdAt: created.toISOString(),
    dangerousMode: true,
    queueDepth: 2,
    promptRunning: true,
  })
})
```

- [ ] **Step 6: Fix handleListSessions**

In `src/core/api-server.ts`, replace `handleListSessions` (lines 518-529):
```typescript
private async handleListSessions(res: http.ServerResponse): Promise<void> {
  const sessions = this.core.sessionManager.listSessions()
  this.sendJson(res, 200, {
    sessions: sessions.map(s => ({
      id: s.id,
      agent: s.agentName,
      status: s.status,
      name: s.name ?? null,
      workspace: s.workingDirectory,
      createdAt: s.createdAt.toISOString(),
      dangerousMode: s.dangerousMode,
      queueDepth: s.queueDepth,
      promptRunning: s.promptRunning,
      lastActiveAt: this.core.sessionManager.getSessionRecord(s.id)?.lastActiveAt ?? null,
    })),
  })
}
```

- [ ] **Step 7: Run all tests**

Run: `pnpm test`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/api-server.ts src/__tests__/api-server.test.ts
git commit -m "fix(api): cancel session properly and extend list response"
```

---

### Task 4: Permission API Endpoint

Add `POST /api/sessions/:id/permission` for resolving permissions from the dashboard.

**Files:**
- Modify: `src/core/api-server.ts:119-176` (handleRequest — add route)
- Modify: `src/core/api-server.ts` (add handleResolvePermission method)
- Modify: `src/__tests__/api-server.test.ts` (add tests)

- [ ] **Step 1: Write failing tests**

Add to `src/__tests__/api-server.test.ts`:
```typescript
it('POST /api/sessions/:id/permission resolves pending permission', async () => {
  const mockGate = { isPending: true, requestId: 'perm1', resolve: vi.fn() }
  const mockSession = { id: 'abc', permissionGate: mockGate }
  mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession)
  const port = await startServer()

  const res = await apiFetch(port, '/api/sessions/abc/permission', {
    method: 'POST',
    body: JSON.stringify({ permissionId: 'perm1', optionId: 'allow' }),
  })
  expect(res.status).toBe(200)
  expect(mockGate.resolve).toHaveBeenCalledWith('allow')
})

it('POST /api/sessions/:id/permission returns 404 for unknown session', async () => {
  mockCore.sessionManager.getSession.mockReturnValueOnce(undefined)
  const port = await startServer()

  const res = await apiFetch(port, '/api/sessions/unknown/permission', {
    method: 'POST',
    body: JSON.stringify({ permissionId: 'p1', optionId: 'allow' }),
  })
  expect(res.status).toBe(404)
})

it('POST /api/sessions/:id/permission returns 400 when no pending permission', async () => {
  const mockGate = { isPending: false, requestId: undefined }
  const mockSession = { id: 'abc', permissionGate: mockGate }
  mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession)
  const port = await startServer()

  const res = await apiFetch(port, '/api/sessions/abc/permission', {
    method: 'POST',
    body: JSON.stringify({ permissionId: 'perm1', optionId: 'allow' }),
  })
  expect(res.status).toBe(400)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/api-server.test.ts`
Expected: FAIL — 404 Not found (route doesn't exist)

- [ ] **Step 3: Add route and handler**

In `src/core/api-server.ts`, add route in `handleRequest()` — after the `POST /api/sessions/:id/prompt` route (around line 128):
```typescript
} else if (method === 'POST' && url.match(/^\/api\/sessions\/([^/]+)\/permission$/)) {
  const sessionId = decodeURIComponent(url.match(/^\/api\/sessions\/([^/]+)\/permission$/)![1])
  await this.handleResolvePermission(sessionId, req, res)
```

Add handler method:
```typescript
private async handleResolvePermission(sessionId: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const session = this.core.sessionManager.getSession(sessionId)
  if (!session) {
    this.sendJson(res, 404, { error: `Session "${sessionId}" not found` })
    return
  }

  const body = await this.readBody(req)
  let permissionId: string | undefined
  let optionId: string | undefined
  if (body) {
    try {
      const parsed = JSON.parse(body)
      permissionId = parsed.permissionId
      optionId = parsed.optionId
    } catch {
      this.sendJson(res, 400, { error: 'Invalid JSON body' })
      return
    }
  }

  if (!permissionId || !optionId) {
    this.sendJson(res, 400, { error: 'Missing permissionId or optionId' })
    return
  }

  if (!session.permissionGate.isPending || session.permissionGate.requestId !== permissionId) {
    this.sendJson(res, 400, { error: 'No matching pending permission request' })
    return
  }

  session.permissionGate.resolve(optionId)
  this.sendJson(res, 200, { ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/api-server.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/api-server.ts src/__tests__/api-server.test.ts
git commit -m "feat(api): add permission resolution endpoint"
```

---

### Task 5: SSE Endpoint

Add `GET /api/events` for Server-Sent Events streaming.

**Files:**
- Modify: `src/core/api-server.ts` (constructor, handleRequest, add handleSSE + broadcast methods)
- Modify: `src/__tests__/api-server.test.ts` (add SSE tests)

- [ ] **Step 1: Write failing tests**

Add to `src/__tests__/api-server.test.ts`:
```typescript
import { EventBus } from '../core/event-bus.js'

// Add eventBus to mockCore (in the existing mockCore object):
// eventBus: new EventBus(),

it('GET /api/events returns SSE headers', async () => {
  mockCore.eventBus = new EventBus()
  const port = await startServer()

  const controller = new AbortController()
  const res = await apiFetch(port, '/api/events', { signal: controller.signal })
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toBe('text/event-stream')
  expect(res.headers.get('cache-control')).toBe('no-cache')
  controller.abort()
})

it('GET /api/events streams session:created events', async () => {
  const eventBus = new EventBus()
  mockCore.eventBus = eventBus
  const port = await startServer()

  const controller = new AbortController()
  const res = await apiFetch(port, '/api/events', { signal: controller.signal })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  // Wait for SSE connection to be registered
  await new Promise(r => setTimeout(r, 50))

  // Emit event after connection
  eventBus.emit('session:created', { sessionId: 's1', agent: 'claude', status: 'initializing' })

  // Read SSE data
  const { value } = await reader.read()
  const text = decoder.decode(value)
  expect(text).toContain('event: session:created')
  expect(text).toContain('"sessionId":"s1"')
  controller.abort()
})

it('GET /api/events supports sessionId filter for agent:event', async () => {
  const eventBus = new EventBus()
  mockCore.eventBus = eventBus
  const port = await startServer()

  const controller = new AbortController()
  const res = await apiFetch(port, '/api/events?sessionId=s1', { signal: controller.signal })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  // Wait for SSE connection to be registered
  await new Promise(r => setTimeout(r, 50))

  // Emit event for target session — should be received
  eventBus.emit('agent:event', { sessionId: 's1', event: { type: 'text', content: 'right' } })

  const { value } = await reader.read()
  const text = decoder.decode(value)
  expect(text).toContain('"sessionId":"s1"')
  expect(text).toContain('right')
  controller.abort()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/api-server.test.ts`
Expected: FAIL — 404 Not found

- [ ] **Step 3: Implement SSE endpoint**

In `src/core/api-server.ts`:

Add import:
```typescript
import type { EventBus, EventBusEvents } from './event-bus.js'
```

Add SSE connection tracking to class (after `private startedAt`):
```typescript
private sseConnections = new Set<http.ServerResponse>()
private sseCleanupHandlers = new Map<http.ServerResponse, () => void>()
private healthInterval?: ReturnType<typeof setInterval>
```

Update constructor to accept optional eventBus and start health heartbeat:
```typescript
constructor(
  private core: VibenCore,
  private config: ApiConfig,
  portFilePath?: string,
  private topicManager?: TopicManager,
) {
  this.portFilePath = portFilePath ?? DEFAULT_PORT_FILE
}
```

Add methods:
```typescript
private setupSSE(): void {
  const eventBus = this.core.eventBus
  if (!eventBus) return

  const events: Array<keyof EventBusEvents> = [
    'session:created', 'session:updated', 'session:deleted',
    'agent:event', 'permission:request',
  ]

  for (const eventName of events) {
    eventBus.on(eventName, (data: unknown) => {
      this.broadcastSSE(eventName, data)
    })
  }

  // Health heartbeat every 30s
  this.healthInterval = setInterval(() => {
    const mem = process.memoryUsage()
    const sessions = this.core.sessionManager.listSessions()
    this.broadcastSSE('health', {
      uptime: Date.now() - this.startedAt,
      memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
      sessions: {
        active: sessions.filter(s => s.status === 'active' || s.status === 'initializing').length,
        total: sessions.length,
      },
    })
  }, 30_000)
}

private handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(req.url || '', 'http://localhost')
  const sessionFilter = url.searchParams.get('sessionId')

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  // Store filter metadata on the response for broadcastSSE
  ;(res as SSEResponse).sessionFilter = sessionFilter ?? undefined

  this.sseConnections.add(res)

  const cleanup = () => {
    this.sseConnections.delete(res)
    this.sseCleanupHandlers.delete(res)
  }
  this.sseCleanupHandlers.set(res, cleanup)
  req.on('close', cleanup)
}

private broadcastSSE(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  // Events that carry sessionId and should be filtered
  const sessionEvents = ['agent:event', 'permission:request', 'session:updated']
  for (const res of this.sseConnections) {
    const filter = (res as SSEResponse).sessionFilter
    if (filter && sessionEvents.includes(event)) {
      const eventData = data as { sessionId: string }
      if (eventData.sessionId !== filter) continue
    }
    res.write(payload)
  }
}
```

Add type at the top of the file:
```typescript
interface SSEResponse extends http.ServerResponse {
  sessionFilter?: string
}
```

Add route in `handleRequest()` — before the catch-all 404:
```typescript
} else if (method === 'GET' && url === '/api/events') {
  this.handleSSE(req, res)
  return // Don't end the response
```

Call `setupSSE()` at the end of the `start()` method, after the server is listening.

Update `stop()` to clean up:
```typescript
async stop(): Promise<void> {
  if (this.healthInterval) clearInterval(this.healthInterval)
  for (const [res, cleanup] of this.sseCleanupHandlers) {
    res.end()
    cleanup()
  }
  this.removePortFile()
  if (this.server) {
    await new Promise<void>((resolve) => {
      this.server!.close(() => resolve())
    })
    this.server = null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/api-server.test.ts`
Expected: All PASS

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/api-server.ts src/__tests__/api-server.test.ts
git commit -m "feat(api): add SSE endpoint for real-time event streaming"
```

---

### Task 6: Token Authentication

Add optional token-based auth with localhost bypass.

**Files:**
- Modify: `src/core/config.ts` (add `token` to api schema)
- Modify: `src/core/api-server.ts` (add auth check)
- Modify: `src/__tests__/api-server.test.ts` (add auth tests)

- [ ] **Step 1: Write failing tests**

Add to `src/__tests__/api-server.test.ts`:
```typescript
describe('token auth', () => {
  it('rejects requests without token when configured', async () => {
    mockCore.configManager.get.mockReturnValue({
      ...mockCore.configManager.get(),
      api: { port: 21420, host: '0.0.0.0', token: 'secret123' },
    })
    const port = await startServer()

    const res = await apiFetch(port, '/api/health')
    expect(res.status).toBe(401)
  })

  it('accepts requests with valid Bearer token', async () => {
    mockCore.configManager.get.mockReturnValue({
      ...mockCore.configManager.get(),
      api: { port: 21420, host: '0.0.0.0', token: 'secret123' },
    })
    const port = await startServer()

    const res = await apiFetch(port, '/api/health', {
      headers: { 'Authorization': 'Bearer secret123' },
    })
    expect(res.status).toBe(200)
  })

  it('bypasses auth for localhost when host is 127.0.0.1', async () => {
    mockCore.configManager.get.mockReturnValue({
      ...mockCore.configManager.get(),
      api: { port: 21420, host: '127.0.0.1', token: 'secret123' },
    })
    const port = await startServer()

    const res = await apiFetch(port, '/api/health')
    expect(res.status).toBe(200)
  })

  it('accepts SSE with token query param', async () => {
    mockCore.eventBus = new EventBus()
    mockCore.configManager.get.mockReturnValue({
      ...mockCore.configManager.get(),
      api: { port: 21420, host: '0.0.0.0', token: 'secret123' },
    })
    const port = await startServer()

    const controller = new AbortController()
    const res = await apiFetch(port, '/api/events?token=secret123', { signal: controller.signal })
    expect(res.status).toBe(200)
    controller.abort()
  })

  it('allows all requests when no token configured', async () => {
    const port = await startServer()
    const res = await apiFetch(port, '/api/health')
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/api-server.test.ts`
Expected: FAIL — requests succeed without auth

- [ ] **Step 3: Add token field to config schema**

In `src/core/config.ts`, update the `api` section of `ConfigSchema`:
```typescript
api: z.object({
  port: z.number().default(21420),
  host: z.string().default('127.0.0.1'),
  token: z.string().optional(),
}).default({}),
```

- [ ] **Step 4: Add auth middleware to ApiServer**

In `src/core/api-server.ts`, add auth check method:
```typescript
private checkAuth(req: http.IncomingMessage, res: http.ServerResponse, url: string): boolean {
  const config = this.core.configManager.get()
  const token = config.api.token
  if (!token) return true // No token configured — allow all

  // Localhost bypass
  const host = config.api.host
  if (host === '127.0.0.1' || host === 'localhost') return true

  // Check Authorization header
  const authHeader = req.headers['authorization']
  if (authHeader === `Bearer ${token}`) return true

  // Check query param (for SSE EventSource which can't set headers)
  const urlObj = new URL(url, 'http://localhost')
  if (urlObj.searchParams.get('token') === token) return true

  this.sendJson(res, 401, { error: 'Unauthorized' })
  return false
}
```

Add auth check in `handleRequest()`, only for `/api/*` routes (so static UI files load without auth):
```typescript
// After const url = req.url || ''
if (url.startsWith('/api/') && !this.checkAuth(req, res, url)) return
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/api-server.test.ts`
Expected: All PASS

- [ ] **Step 6: Run full test suite**

Run: `pnpm test`
Expected: All PASS (config default is `.optional()` so existing tests unaffected)

- [ ] **Step 7: Commit**

```bash
git add src/core/config.ts src/core/api-server.ts src/__tests__/api-server.test.ts
git commit -m "feat(api): add optional token authentication with localhost bypass"
```

---

### Task 7: Static File Serving

Serve the UI SPA from the API server for non-API routes.

**Files:**
- Modify: `src/core/api-server.ts` (add static file serving in handleRequest)
- Modify: `src/__tests__/api-server.test.ts` (add tests)

- [ ] **Step 1: Write failing tests**

Add to `src/__tests__/api-server.test.ts`:
```typescript
describe('static file serving', () => {
  let uiDir: string

  beforeEach(() => {
    uiDir = path.join(tmpDir, 'ui')
    fs.mkdirSync(uiDir, { recursive: true })
    fs.writeFileSync(path.join(uiDir, 'index.html'), '<html><body>Dashboard</body></html>')
    fs.mkdirSync(path.join(uiDir, 'assets'), { recursive: true })
    fs.writeFileSync(path.join(uiDir, 'assets', 'app.js'), 'console.log("app")')
    fs.writeFileSync(path.join(uiDir, 'assets', 'style.css'), 'body { color: red }')
  })

  it('serves index.html for root path', async () => {
    const { ApiServer } = await import('../core/api-server.js')
    server = new ApiServer(mockCore as any, { port: 0, host: '127.0.0.1' }, portFilePath, mockTopicManager as any, uiDir)
    await server.start()
    const port = server.getPort()

    const res = await apiFetch(port, '/')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const body = await res.text()
    expect(body).toContain('Dashboard')
  })

  it('serves static assets with correct content-type', async () => {
    const { ApiServer } = await import('../core/api-server.js')
    server = new ApiServer(mockCore as any, { port: 0, host: '127.0.0.1' }, portFilePath, mockTopicManager as any, uiDir)
    await server.start()
    const port = server.getPort()

    const jsRes = await apiFetch(port, '/assets/app.js')
    expect(jsRes.status).toBe(200)
    expect(jsRes.headers.get('content-type')).toContain('javascript')

    const cssRes = await apiFetch(port, '/assets/style.css')
    expect(cssRes.status).toBe(200)
    expect(cssRes.headers.get('content-type')).toContain('text/css')
  })

  it('falls back to index.html for SPA routes', async () => {
    const { ApiServer } = await import('../core/api-server.js')
    server = new ApiServer(mockCore as any, { port: 0, host: '127.0.0.1' }, portFilePath, mockTopicManager as any, uiDir)
    await server.start()
    const port = server.getPort()

    const res = await apiFetch(port, '/sessions/abc')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const body = await res.text()
    expect(body).toContain('Dashboard')
  })

  it('API routes still work when UI is enabled', async () => {
    const { ApiServer } = await import('../core/api-server.js')
    server = new ApiServer(mockCore as any, { port: 0, host: '127.0.0.1' }, portFilePath, mockTopicManager as any, uiDir)
    await server.start()
    const port = server.getPort()

    const res = await apiFetch(port, '/api/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('returns 404 for non-API routes when UI not available', async () => {
    const port = await startServer()
    const res = await apiFetch(port, '/nonexistent')
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/api-server.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement static file serving**

In `src/core/api-server.ts`:

Update constructor to accept optional `uiDir`:
```typescript
constructor(
  private core: VibenCore,
  private config: ApiConfig,
  portFilePath?: string,
  private topicManager?: TopicManager,
  private uiDir?: string,
) {
  this.portFilePath = portFilePath ?? DEFAULT_PORT_FILE
  // Auto-detect UI directory if not provided
  if (!this.uiDir) {
    const __filename = fileURLToPath(import.meta.url)
    const candidate = path.resolve(path.dirname(__filename), '../../ui/dist')
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      this.uiDir = candidate
    }
    // Also check dist-publish layout
    if (!this.uiDir) {
      const publishCandidate = path.resolve(path.dirname(__filename), '../ui')
      if (fs.existsSync(path.join(publishCandidate, 'index.html'))) {
        this.uiDir = publishCandidate
      }
    }
  }
}
```

Add MIME type map and static handler:
```typescript
private static MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

private serveStatic(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (!this.uiDir) return false

  const urlPath = (req.url || '/').split('?')[0]
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '')

  // Try exact file match
  const filePath = path.join(this.uiDir, safePath)
  if (!filePath.startsWith(this.uiDir)) return false // path traversal guard

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath)
    const contentType = ApiServer.MIME_TYPES[ext] ?? 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': contentType })
    fs.createReadStream(filePath).pipe(res)
    return true
  }

  // SPA fallback — serve index.html
  const indexPath = path.join(this.uiDir, 'index.html')
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    fs.createReadStream(indexPath).pipe(res)
    return true
  }

  return false
}
```

In `handleRequest()`, replace the catch-all 404 block:
```typescript
} else {
  // Try static file serving (UI dashboard)
  if (!this.serveStatic(req, res)) {
    this.sendJson(res, 404, { error: 'Not found' })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/api-server.test.ts`
Expected: All PASS

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/api-server.ts src/__tests__/api-server.test.ts
git commit -m "feat(api): serve embedded UI dashboard as static files"
```

---

### Task 8: Update ApiServer instantiation in main.ts

Wire the new constructor params where ApiServer is created.

**Files:**
- Modify: `src/main.ts` (update ApiServer creation)

- [ ] **Step 1: Check current ApiServer creation in main.ts**

Read `src/main.ts` and find where `new ApiServer(...)` is called.

- [ ] **Step 2: Update instantiation**

Ensure `topicManager` and no explicit `uiDir` are passed (auto-detection will handle it):
```typescript
// The constructor auto-detects uiDir, so no change needed beyond ensuring
// the existing call compiles with the updated constructor signature.
```

- [ ] **Step 3: Run full test suite and build**

Run: `pnpm test && pnpm build`
Expected: All PASS, build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "chore: update ApiServer instantiation for new constructor"
```

---

### Task 9: Integration Smoke Test

Manual verification that all backend changes work together.

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 2: Build project**

Run: `pnpm build`
Expected: No TypeScript errors

- [ ] **Step 3: Verify exports**

Check `src/core/index.ts` exports `EventBus` and all new types compile correctly:
Run: `pnpm build`

- [ ] **Step 4: Final commit if any remaining changes**

```bash
git add -A
git commit -m "chore: finalize backend changes for UI dashboard"
```
