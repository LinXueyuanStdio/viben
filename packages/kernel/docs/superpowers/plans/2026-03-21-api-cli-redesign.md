# API CLI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 11 new API endpoints and CLI commands to `viben api`, plus update help text and assistant system prompt.

**Architecture:** All new endpoints are added to the existing `ApiServer.handleRequest` if/else chain. New CLI commands follow the same pattern in `cmdApi`: parse args → `apiCall()` → format output. A `redactConfig()` utility is added inline in `api-server.ts` for the config endpoint.

**Tech Stack:** Node.js native `http` module, native `fetch()`, vitest for tests.

**Task dependencies:** Task 1 must complete first (server endpoints). Tasks 2+3 modify the same file (`src/cli/commands.ts`) so they are combined into a single task. Task 4 (assistant prompt) can run in parallel after Task 1. Task 5 (verification) and Task 6 (integration) depend on all prior tasks.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/core/api-server.ts` | **Modify:** Add `startedAt` field, `redactConfig()`, 11 new route handlers, update DELETE session regex |
| `src/cli/commands.ts` | **Modify:** Add 11 new subcommands in `cmdApi`, update help text in `printHelp()` |
| `src/adapters/telegram/assistant.ts` | **Modify:** Add new CLI commands to assistant system prompt |
| `src/__tests__/api-server.test.ts` | **Modify:** Add tests for all new endpoints |
| `src/__tests__/cli-api.test.ts` | **Modify:** Add tests for new CLI subcommands (if needed) |

---

### Task 1: Add New HTTP Endpoints to ApiServer

**Files:**
- Modify: `src/core/api-server.ts:1-262`

This is the largest task. We add 11 new routes to `handleRequest` and their handler methods.

- [ ] **Step 1: Write failing tests for the simple read-only endpoints**

Add tests to `src/__tests__/api-server.test.ts`. Update `mockCore` to include new fields needed by the endpoints.

```typescript
// Add to mockCore (inside describe block, after existing mockCore definition):
// Update mockCore to add missing fields:
// Add these properties to mockCore:
//   notificationManager: { notifyAll: vi.fn() },
//   requestRestart: vi.fn(),
//   tunnelService: undefined as any,
//   configManager.get returns a full-enough config for the health/config endpoints
//   configManager.save: vi.fn(),

// --- Tests to add at the end of the describe block ---

it('GET /api/health returns system health', async () => {
  mockCore.sessionManager.listSessions.mockReturnValueOnce([
    { status: 'active' }, { status: 'initializing' },
  ])
  // listRecords for total count
  mockCore.sessionManager.listRecords = vi.fn(() => [
    { status: 'active' }, { status: 'finished' }, { status: 'cancelled' },
  ])
  const port = await startServer()
  const res = await apiFetch(port, '/api/health')
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.status).toBe('ok')
  expect(data.version).toBeDefined()
  expect(data.sessions.active).toBe(2)
  expect(data.sessions.total).toBe(3)
  expect(data.adapters).toEqual([])
  expect(data.memory.rss).toBeGreaterThan(0)
  expect(data.uptime).toBeGreaterThanOrEqual(0)
})

it('GET /api/version returns daemon version', async () => {
  const port = await startServer()
  const res = await apiFetch(port, '/api/version')
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.version).toBeDefined()
})

it('GET /api/adapters returns adapter list', async () => {
  mockCore.adapters.set('telegram', { name: 'telegram' })
  const port = await startServer()
  const res = await apiFetch(port, '/api/adapters')
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.adapters).toEqual([{ name: 'telegram', type: 'built-in' }])
  mockCore.adapters.delete('telegram')
})

it('GET /api/tunnel returns tunnel disabled when no tunnel', async () => {
  const port = await startServer()
  const res = await apiFetch(port, '/api/tunnel')
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.enabled).toBe(false)
})

it('GET /api/config returns redacted config', async () => {
  mockCore.configManager.get.mockReturnValueOnce({
    defaultAgent: 'claude',
    security: { maxConcurrentSessions: 5 },
    channels: { telegram: { botToken: 'secret-token', enabled: true } },
    tunnel: { auth: { token: 'tunnel-secret' } },
  })
  const port = await startServer()
  const res = await apiFetch(port, '/api/config')
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.config.channels.telegram.botToken).toBe('***')
  expect(data.config.tunnel.auth.token).toBe('***')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/__tests__/api-server.test.ts`
Expected: FAIL — routes return 404

- [ ] **Step 3: Add `startedAt` field and `getVersion()` helper to ApiServer**

In `src/core/api-server.ts`:

1. Add `private startedAt = Date.now()` as a class property (after line 21).
2. Add a module-level `getVersion()` helper near the top, after imports:

```typescript
import { fileURLToPath } from 'node:url'

let cachedVersion: string | undefined

function getVersion(): string {
  if (cachedVersion) return cachedVersion
  try {
    const __filename = fileURLToPath(import.meta.url)
    const pkgPath = path.resolve(path.dirname(__filename), '../../package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    cachedVersion = pkg.version ?? '0.0.0-dev'
  } catch {
    cachedVersion = '0.0.0-dev'
  }
  return cachedVersion
}
```

- [ ] **Step 4: Add `redactConfig()` utility**

Add after the `getVersion()` function:

```typescript
const SENSITIVE_KEYS = ['botToken', 'token', 'apiKey', 'secret', 'password', 'webhookSecret']

function redactConfig(config: unknown): unknown {
  const redacted = structuredClone(config)
  redactDeep(redacted as Record<string, unknown>)
  return redacted
}

function redactDeep(obj: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(key) && typeof value === 'string') {
      obj[key] = '***'
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      redactDeep(value as Record<string, unknown>)
    }
  }
}
```

- [ ] **Step 5: Update `handleRequest` route matching — fix DELETE regex and add new routes**

The existing DELETE route uses `.+` which is greedy and would match `/sessions/abc/prompt`. Change it to `[^/]+` and add new routes **before** it.

Update `handleRequest` method. The new if/else chain order for session routes:

```typescript
// In handleRequest, replace the existing session/agent/topic routing with:

if (method === 'POST' && url === '/api/sessions') {
  await this.handleCreateSession(req, res)
} else if (method === 'POST' && url.match(/^\/api\/sessions\/([^/]+)\/prompt$/)) {
  const sessionId = decodeURIComponent(url.match(/^\/api\/sessions\/([^/]+)\/prompt$/)![1])
  await this.handleSendPrompt(sessionId, req, res)
} else if (method === 'PATCH' && url.match(/^\/api\/sessions\/([^/]+)\/dangerous$/)) {
  const sessionId = decodeURIComponent(url.match(/^\/api\/sessions\/([^/]+)\/dangerous$/)![1])
  await this.handleToggleDangerous(sessionId, req, res)
} else if (method === 'GET' && url.match(/^\/api\/sessions\/([^/]+)$/)) {
  const sessionId = decodeURIComponent(url.match(/^\/api\/sessions\/([^/]+)$/)![1])
  await this.handleGetSession(sessionId, res)
} else if (method === 'DELETE' && url.match(/^\/api\/sessions\/([^/]+)$/)) {
  const sessionId = decodeURIComponent(url.match(/^\/api\/sessions\/([^/]+)$/)![1])
  await this.handleCancelSession(sessionId, res)
} else if (method === 'GET' && url === '/api/sessions') {
  await this.handleListSessions(res)
} else if (method === 'GET' && url === '/api/agents') {
  await this.handleListAgents(res)
} else if (method === 'GET' && url === '/api/health') {
  await this.handleHealth(res)
} else if (method === 'GET' && url === '/api/version') {
  this.handleVersion(res)
} else if (method === 'GET' && url === '/api/config') {
  this.handleGetConfig(res)
} else if (method === 'PATCH' && url === '/api/config') {
  await this.handleUpdateConfig(req, res)
} else if (method === 'GET' && url === '/api/adapters') {
  this.handleListAdapters(res)
} else if (method === 'GET' && url === '/api/tunnel') {
  this.handleTunnelStatus(res)
} else if (method === 'POST' && url === '/api/notify') {
  await this.handleNotify(req, res)
} else if (method === 'POST' && url === '/api/restart') {
  await this.handleRestart(res)
} else if (method === 'GET' && url.match(/^\/api\/topics(\?.*)?$/)) {
  await this.handleListTopics(url, res)
} else if (method === 'POST' && url === '/api/topics/cleanup') {
  await this.handleCleanupTopics(req, res)
} else if (method === 'DELETE' && url.match(/^\/api\/topics\/([^/?]+)/)) {
  const match = url.match(/^\/api\/topics\/([^/?]+)/)!
  await this.handleDeleteTopic(decodeURIComponent(match[1]), url, res)
} else {
  this.sendJson(res, 404, { error: 'Not found' })
}
```

- [ ] **Step 6: Implement handler methods for read-only endpoints**

Add these methods to the `ApiServer` class:

```typescript
private async handleHealth(res: http.ServerResponse): Promise<void> {
  const activeSessions = this.core.sessionManager.listSessions()
    .filter(s => s.status === 'active' || s.status === 'initializing')
  const totalRecords = this.core.sessionManager.listRecords()
  const mem = process.memoryUsage()
  const tunnelService = this.core.tunnelService

  this.sendJson(res, 200, {
    status: 'ok',
    uptime: Math.floor((Date.now() - this.startedAt) / 1000),
    version: getVersion(),
    memory: { rss: mem.rss, heapUsed: mem.heapUsed },
    sessions: { active: activeSessions.length, total: totalRecords.length },
    adapters: Array.from(this.core.adapters.keys()),
    tunnel: tunnelService
      ? { enabled: true, url: tunnelService.getPublicUrl() }
      : { enabled: false },
  })
}

private handleVersion(res: http.ServerResponse): void {
  this.sendJson(res, 200, { version: getVersion() })
}

private handleGetConfig(res: http.ServerResponse): void {
  const config = this.core.configManager.get()
  this.sendJson(res, 200, { config: redactConfig(config) })
}

private handleListAdapters(res: http.ServerResponse): void {
  const adapters = Array.from(this.core.adapters.entries()).map(([name]) => ({
    name,
    type: 'built-in', // TODO: distinguish plugin adapters when plugin system tracks this
  }))
  this.sendJson(res, 200, { adapters })
}

private handleTunnelStatus(res: http.ServerResponse): void {
  const tunnelService = this.core.tunnelService
  if (tunnelService) {
    this.sendJson(res, 200, {
      enabled: true,
      url: tunnelService.getPublicUrl(),
      provider: this.core.configManager.get().tunnel.provider,
    })
  } else {
    this.sendJson(res, 200, { enabled: false })
  }
}
```

- [ ] **Step 7: Run tests to verify read-only endpoints pass**

Run: `pnpm test src/__tests__/api-server.test.ts`
Expected: New read-only endpoint tests PASS

- [ ] **Step 8: Write failing tests for mutation endpoints**

Add to `src/__tests__/api-server.test.ts`:

```typescript
it('POST /api/sessions/:id/prompt sends prompt to session', async () => {
  const mockSession = {
    id: 'abc123',
    status: 'active',
    enqueuePrompt: vi.fn(),
    queueDepth: 1,
  }
  mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession)
  const port = await startServer()

  const res = await apiFetch(port, '/api/sessions/abc123/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'fix the bug' }),
  })
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.ok).toBe(true)
  expect(mockSession.enqueuePrompt).toHaveBeenCalledWith('fix the bug')
})

it('POST /api/sessions/:id/prompt returns 404 for unknown session', async () => {
  mockCore.sessionManager.getSession.mockReturnValueOnce(undefined)
  const port = await startServer()

  const res = await apiFetch(port, '/api/sessions/unknown/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'hello' }),
  })
  expect(res.status).toBe(404)
})

it('POST /api/sessions/:id/prompt returns 400 for inactive session', async () => {
  const mockSession = { id: 'abc123', status: 'cancelled' }
  mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession)
  const port = await startServer()

  const res = await apiFetch(port, '/api/sessions/abc123/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'hello' }),
  })
  expect(res.status).toBe(400)
})

it('POST /api/sessions/:id/prompt returns 400 when missing prompt', async () => {
  const mockSession = { id: 'abc123', status: 'active' }
  mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession)
  const port = await startServer()

  const res = await apiFetch(port, '/api/sessions/abc123/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  expect(res.status).toBe(400)
})

it('GET /api/sessions/:id returns session detail', async () => {
  const mockSession = {
    id: 'abc123', agentName: 'claude', status: 'active',
    name: 'Fix bug', workingDirectory: '/tmp/ws',
    createdAt: new Date('2026-03-21T14:30:00Z'),
    dangerousMode: false, queueDepth: 0, promptRunning: false,
    threadId: '42', channelId: 'telegram', agentSessionId: 'agent-xyz',
  }
  mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession)
  const port = await startServer()

  const res = await apiFetch(port, '/api/sessions/abc123')
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.session.id).toBe('abc123')
  expect(data.session.agent).toBe('claude')
  expect(data.session.status).toBe('active')
  expect(data.session.dangerousMode).toBe(false)
})

it('GET /api/sessions/:id returns 404 for unknown', async () => {
  mockCore.sessionManager.getSession.mockReturnValueOnce(undefined)
  const port = await startServer()

  const res = await apiFetch(port, '/api/sessions/unknown')
  expect(res.status).toBe(404)
})

it('PATCH /api/sessions/:id/dangerous toggles dangerous mode', async () => {
  const mockSession = { id: 'abc123', dangerousMode: false }
  mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession)
  mockCore.sessionManager.updateSessionDangerousMode = vi.fn()
  const port = await startServer()

  const res = await apiFetch(port, '/api/sessions/abc123/dangerous', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  })
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.ok).toBe(true)
  expect(data.dangerousMode).toBe(true)
  expect(mockSession.dangerousMode).toBe(true)
})

it('PATCH /api/sessions/:id/dangerous returns 400 when missing enabled field', async () => {
  const mockSession = { id: 'abc123', dangerousMode: false }
  mockCore.sessionManager.getSession.mockReturnValueOnce(mockSession)
  const port = await startServer()

  const res = await apiFetch(port, '/api/sessions/abc123/dangerous', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  expect(res.status).toBe(400)
})

it('POST /api/notify sends notification', async () => {
  mockCore.notificationManager = { notifyAll: vi.fn() }
  const port = await startServer()

  const res = await apiFetch(port, '/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Deploy done!' }),
  })
  expect(res.status).toBe(200)
  expect(mockCore.notificationManager.notifyAll).toHaveBeenCalled()
})

it('POST /api/notify returns 400 when missing message', async () => {
  const port = await startServer()
  const res = await apiFetch(port, '/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  expect(res.status).toBe(400)
})

it('POST /api/restart triggers restart', async () => {
  mockCore.requestRestart = vi.fn()
  const port = await startServer()

  const res = await apiFetch(port, '/api/restart', { method: 'POST' })
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.ok).toBe(true)
  // requestRestart is called via setImmediate — wait for it
  await new Promise(resolve => setImmediate(resolve))
  expect(mockCore.requestRestart).toHaveBeenCalled()
})

it('POST /api/restart returns 501 when restart not available', async () => {
  mockCore.requestRestart = null
  const port = await startServer()

  const res = await apiFetch(port, '/api/restart', { method: 'POST' })
  expect(res.status).toBe(501)
})

it('PATCH /api/config updates config value', async () => {
  mockCore.configManager.save = vi.fn()
  mockCore.configManager.get.mockReturnValue({
    defaultAgent: 'claude',
    security: { maxConcurrentSessions: 10 },
  })
  const port = await startServer()

  const res = await apiFetch(port, '/api/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'security.maxConcurrentSessions', value: 10 }),
  })
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.ok).toBe(true)
  expect(mockCore.configManager.save).toHaveBeenCalled()
})

it('PATCH /api/config returns 400 for missing path', async () => {
  const port = await startServer()
  const res = await apiFetch(port, '/api/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 10 }),
  })
  expect(res.status).toBe(400)
})
```

- [ ] **Step 9: Run tests to verify they fail**

Run: `pnpm test src/__tests__/api-server.test.ts`
Expected: FAIL — new mutation routes return 404

- [ ] **Step 10: Implement mutation handler methods**

Add to `ApiServer` class:

```typescript
private async handleSendPrompt(sessionId: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const session = this.core.sessionManager.getSession(sessionId)
  if (!session) {
    this.sendJson(res, 404, { error: 'Session not found' })
    return
  }
  const inactiveStatuses = ['cancelled', 'finished', 'error']
  if (inactiveStatuses.includes(session.status)) {
    this.sendJson(res, 400, { error: 'Session is not active' })
    return
  }
  const body = await this.readBody(req)
  let prompt: string | undefined
  if (body) {
    try { prompt = JSON.parse(body).prompt } catch {
      this.sendJson(res, 400, { error: 'Invalid JSON body' })
      return
    }
  }
  if (!prompt) {
    this.sendJson(res, 400, { error: 'Missing prompt' })
    return
  }
  session.enqueuePrompt(prompt)
  this.sendJson(res, 200, { ok: true, sessionId, queueDepth: session.queueDepth })
}

private async handleGetSession(sessionId: string, res: http.ServerResponse): Promise<void> {
  const session = this.core.sessionManager.getSession(sessionId)
  if (!session) {
    this.sendJson(res, 404, { error: 'Session not found' })
    return
  }
  this.sendJson(res, 200, {
    session: {
      id: session.id,
      agent: session.agentName,
      status: session.status,
      name: session.name ?? null,
      workspace: session.workingDirectory,
      createdAt: session.createdAt.toISOString(),
      dangerousMode: session.dangerousMode,
      queueDepth: session.queueDepth,
      promptRunning: session.promptRunning,
      threadId: session.threadId,
      channelId: session.channelId,
      agentSessionId: session.agentSessionId,
    },
  })
}

private async handleToggleDangerous(sessionId: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const session = this.core.sessionManager.getSession(sessionId)
  if (!session) {
    this.sendJson(res, 404, { error: 'Session not found' })
    return
  }
  const body = await this.readBody(req)
  let enabled: boolean | undefined
  if (body) {
    try { enabled = JSON.parse(body).enabled } catch {
      this.sendJson(res, 400, { error: 'Invalid JSON body' })
      return
    }
  }
  if (typeof enabled !== 'boolean') {
    this.sendJson(res, 400, { error: 'Missing "enabled" boolean field' })
    return
  }
  session.dangerousMode = enabled
  await this.core.sessionManager.updateSessionDangerousMode(sessionId, enabled)
  this.sendJson(res, 200, { ok: true, dangerousMode: enabled })
}

private async handleNotify(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = await this.readBody(req)
  let message: string | undefined
  if (body) {
    try { message = JSON.parse(body).message } catch {
      this.sendJson(res, 400, { error: 'Invalid JSON body' })
      return
    }
  }
  if (!message) {
    this.sendJson(res, 400, { error: 'Missing message' })
    return
  }
  await this.core.notificationManager.notifyAll({
    sessionId: 'api',
    type: 'completed',
    summary: message,
  })
  this.sendJson(res, 200, { ok: true })
}

private async handleRestart(res: http.ServerResponse): Promise<void> {
  if (!this.core.requestRestart) {
    this.sendJson(res, 501, { error: 'Restart not available' })
    return
  }
  this.sendJson(res, 200, { ok: true, message: 'Restarting...' })
  // Trigger restart after response is written — sendJson is sync so response
  // is fully queued before this call. Use setImmediate to let the response
  // flush before the process starts shutting down.
  setImmediate(() => this.core.requestRestart!())
}

private async handleUpdateConfig(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = await this.readBody(req)
  let configPath: string | undefined
  let value: unknown
  if (body) {
    try {
      const parsed = JSON.parse(body)
      configPath = parsed.path
      value = parsed.value
    } catch {
      this.sendJson(res, 400, { error: 'Invalid JSON body' })
      return
    }
  }
  if (!configPath) {
    this.sendJson(res, 400, { error: 'Missing "path" field' })
    return
  }

  // Convert dot-path to nested object
  const parts = configPath.split('.')
  let updates: Record<string, unknown> = {}
  let current = updates
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = {}
    current = current[parts[i]] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value

  const RESTART_PATHS = ['api.port', 'api.host', 'runMode']
  const needsRestart = RESTART_PATHS.some(rp => configPath!.startsWith(rp))
    || configPath!.startsWith('channels.')
    || configPath!.startsWith('tunnel.')
    || (configPath!.startsWith('agents.') && (configPath!.endsWith('.command') || configPath!.endsWith('.args')))

  // Pre-validate: merge updates into current raw config and check with Zod
  // (ConfigManager.save() silently ignores validation failures, so we must validate first)
  try {
    const { ConfigSchema } = await import('./config.js')
    const currentRaw = structuredClone(this.core.configManager.get())
    // Apply dot-path update to a clone
    let target = currentRaw as Record<string, any>
    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]] || typeof target[parts[i]] !== 'object') {
        this.sendJson(res, 400, { error: `Invalid config path: "${configPath}"` })
        return
      }
      target = target[parts[i]]
    }
    const lastKey = parts[parts.length - 1]
    if (!(lastKey in target)) {
      this.sendJson(res, 400, { error: `Invalid config path: "${configPath}"` })
      return
    }
    target[lastKey] = value

    const validation = ConfigSchema.safeParse(currentRaw)
    if (!validation.success) {
      const issues = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      this.sendJson(res, 400, { error: `Validation failed: ${issues}` })
      return
    }

    await this.core.configManager.save(updates)
    this.sendJson(res, 200, {
      ok: true,
      needsRestart,
      config: redactConfig(this.core.configManager.get()),
    })
  } catch (err) {
    this.sendJson(res, 400, { error: `Config update failed: ${err}` })
  }
}
```

- [ ] **Step 11: Run tests to verify all endpoint tests pass**

Run: `pnpm test src/__tests__/api-server.test.ts`
Expected: ALL PASS

- [ ] **Step 12: Commit**

```bash
git add src/core/api-server.ts src/__tests__/api-server.test.ts
git commit -m "feat: add 11 new API endpoints (health, version, config, restart, send, session detail, dangerous, adapters, tunnel, notify, config update)"
```

---

### Task 2: Add New CLI Subcommands + Update Help Text

**Files:**
- Modify: `src/cli/commands.ts:89-239` (subcommands)
- Modify: `src/cli/commands.ts:5-45` (help text)

- [ ] **Step 1: Add new subcommands to `cmdApi` function**

In `src/cli/commands.ts`, add new `else if` branches inside the `cmdApi` function, before the final `else` block. Each command follows the existing pattern: parse args → `apiCall()` → format output.

```typescript
// Add after the 'cleanup' branch and before the final 'else':

} else if (subCmd === 'send') {
  const sessionId = args[2]
  const prompt = args.slice(3).join(' ')
  if (!sessionId || !prompt) {
    console.error('Usage: viben api send <session-id> <prompt>')
    process.exit(1)
  }
  const res = await apiCall(port, `/api/sessions/${encodeURIComponent(sessionId)}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  const data = await res.json() as Record<string, unknown>
  if (!res.ok) {
    console.error(`Error: ${data.error}`)
    process.exit(1)
  }
  console.log(`Prompt sent to session ${sessionId} (queue depth: ${data.queueDepth})`)

} else if (subCmd === 'session') {
  const sessionId = args[2]
  if (!sessionId) {
    console.error('Usage: viben api session <session-id>')
    process.exit(1)
  }
  const res = await apiCall(port, `/api/sessions/${encodeURIComponent(sessionId)}`)
  const data = await res.json() as Record<string, unknown>
  if (!res.ok) {
    console.error(`Error: ${data.error}`)
    process.exit(1)
  }
  const s = data.session as Record<string, unknown>
  console.log(`Session ${s.id}`)
  console.log(`  Agent        : ${s.agent}`)
  console.log(`  Status       : ${s.status}`)
  console.log(`  Name         : ${s.name ? `"${s.name}"` : '(unnamed)'}`)
  console.log(`  Workspace    : ${s.workspace}`)
  console.log(`  Created      : ${s.createdAt}`)
  console.log(`  Dangerous    : ${s.dangerousMode ? 'on' : 'off'}`)
  console.log(`  Queue depth  : ${s.queueDepth}`)
  console.log(`  Prompt active: ${s.promptRunning ? 'yes' : 'no'}`)
  console.log(`  Channel      : ${s.channelId}`)
  console.log(`  Thread       : ${s.threadId || '(none)'}`)

} else if (subCmd === 'dangerous') {
  const sessionId = args[2]
  const toggle = args[3]
  if (!sessionId || !['on', 'off'].includes(toggle)) {
    console.error('Usage: viben api dangerous <session-id> [on|off]')
    process.exit(1)
  }
  const enabled = toggle === 'on'
  const res = await apiCall(port, `/api/sessions/${encodeURIComponent(sessionId)}/dangerous`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  const data = await res.json() as Record<string, unknown>
  if (!res.ok) {
    console.error(`Error: ${data.error}`)
    process.exit(1)
  }
  console.log(`Dangerous mode ${enabled ? 'enabled' : 'disabled'} for session ${sessionId}`)

} else if (subCmd === 'health') {
  const res = await apiCall(port, '/api/health')
  const data = await res.json() as Record<string, unknown>
  const sessions = data.sessions as Record<string, number>
  const memory = data.memory as Record<string, number>
  const uptimeSec = data.uptime as number
  const hours = Math.floor(uptimeSec / 3600)
  const minutes = Math.floor((uptimeSec % 3600) / 60)
  const uptimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  const tunnel = data.tunnel as Record<string, unknown>
  console.log('Viben Health')
  console.log(`  Status   : ${data.status}`)
  console.log(`  Uptime   : ${uptimeStr}`)
  console.log(`  Version  : ${data.version}`)
  console.log(`  Memory   : ${Math.round(memory.rss / 1024 / 1024)} MB RSS, ${Math.round(memory.heapUsed / 1024 / 1024)} MB heap`)
  console.log(`  Sessions : ${sessions.active} active / ${sessions.total} total`)
  console.log(`  Adapters : ${(data.adapters as string[]).join(', ') || '(none)'}`)
  console.log(`  Tunnel   : ${tunnel.enabled ? tunnel.url : 'not enabled'}`)

} else if (subCmd === 'restart') {
  const res = await apiCall(port, '/api/restart', { method: 'POST' })
  const data = await res.json() as Record<string, unknown>
  if (!res.ok) {
    console.error(`Error: ${data.error}`)
    process.exit(1)
  }
  console.log('Restart signal sent. Viben is restarting...')

} else if (subCmd === 'config') {
  if (args[2] === 'set') {
    const configPath = args[3]
    let valueStr = args[4]
    if (!configPath || valueStr === undefined) {
      console.error('Usage: viben api config set <path> <value>')
      process.exit(1)
    }
    // Parse value as JSON if possible, otherwise treat as string
    let value: unknown = valueStr
    try { value = JSON.parse(valueStr) } catch { /* keep as string */ }
    const res = await apiCall(port, '/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: configPath, value }),
    })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) {
      console.error(`Error: ${data.error}`)
      process.exit(1)
    }
    console.log(`Config updated: ${configPath} = ${JSON.stringify(value)}`)
    if (data.needsRestart) {
      console.log('Note: This change requires a daemon restart to take effect.')
    }
  } else {
    // Show config
    const res = await apiCall(port, '/api/config')
    const data = await res.json() as Record<string, unknown>
    console.log(JSON.stringify(data.config, null, 2))
  }

} else if (subCmd === 'adapters') {
  const res = await apiCall(port, '/api/adapters')
  const data = await res.json() as { adapters: Array<{ name: string; type: string }> }
  console.log('Registered adapters:')
  for (const a of data.adapters) {
    console.log(`  ${a.name}  (${a.type})`)
  }

} else if (subCmd === 'tunnel') {
  const res = await apiCall(port, '/api/tunnel')
  const data = await res.json() as Record<string, unknown>
  if (data.enabled) {
    console.log('Tunnel: active')
    console.log(`  Provider : ${data.provider}`)
    console.log(`  URL      : ${data.url}`)
  } else {
    console.log('Tunnel: not enabled')
  }

} else if (subCmd === 'notify') {
  const message = args.slice(2).join(' ')
  if (!message) {
    console.error('Usage: viben api notify <message>')
    process.exit(1)
  }
  const res = await apiCall(port, '/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  const data = await res.json() as Record<string, unknown>
  if (!res.ok) {
    console.error(`Error: ${data.error}`)
    process.exit(1)
  }
  console.log('Notification sent to all channels.')

} else if (subCmd === 'version') {
  const res = await apiCall(port, '/api/version')
  const data = await res.json() as Record<string, unknown>
  console.log(`Daemon version: ${data.version}`)
```

- [ ] **Step 2: Update the unknown-command help text in the `else` block**

Replace the existing else block's usage text with the full list of api commands:

```typescript
} else {
  console.error(`Unknown api command: ${subCmd || '(none)'}\n`)
  console.log('Usage:')
  console.log('  viben api status                       Show active sessions')
  console.log('  viben api session <id>                 Show session details')
  console.log('  viben api new [agent] [workspace]      Create a new session')
  console.log('  viben api send <id> <prompt>           Send prompt to session')
  console.log('  viben api cancel <id>                  Cancel a session')
  console.log('  viben api dangerous <id> [on|off]      Toggle dangerous mode')
  console.log('  viben api agents                       List available agents')
  console.log('  viben api topics [--status s1,s2]      List topics')
  console.log('  viben api delete-topic <id> [--force]  Delete a topic')
  console.log('  viben api cleanup [--status s1,s2]     Cleanup finished topics')
  console.log('  viben api health                       Show system health')
  console.log('  viben api adapters                     List registered adapters')
  console.log('  viben api tunnel                       Show tunnel status')
  console.log('  viben api config                       Show runtime config')
  console.log('  viben api config set <key> <value>     Update config value')
  console.log('  viben api restart                      Restart daemon')
  console.log('  viben api notify <message>             Send notification')
  console.log('  viben api version                      Show daemon version')
  process.exit(1)
}
```

- [ ] **Step 3: Update `printHelp()` with the full API command list**

Replace the API section in `printHelp()` with the spec's help text (see spec section 4 for the full text). Key additions: `session`, `send`, `dangerous`, `health`, `adapters`, `tunnel`, `config`, `config set`, `restart`, `notify`, `version`. Also add the clarification notes about `status` vs `api status` and `--version` vs `api version`.

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands.ts
git commit -m "feat: add 11 new CLI subcommands and update help text for viben api"
```

---

### Task 3: Update Assistant System Prompt

**Files:**
- Modify: `src/adapters/telegram/assistant.ts:67-117`

- [ ] **Step 1: Add new CLI commands to assistant system prompt**

In `buildAssistantSystemPrompt()`, add the new commands to the "Topic Management (via CLI)" section. Rename the section to "Management Commands (via CLI)" and include all api commands:

```typescript
// Replace the "## Topic Management (via CLI)" section:

## Management Commands (via CLI)
You have access to bash. Use these commands to manage Viben:

### Session management
\`\`\`bash
viben api status                       # List active sessions
viben api session <id>                 # Session detail
viben api send <id> "prompt text"      # Send prompt to session
viben api cancel <id>                  # Cancel session
viben api dangerous <id> on|off        # Toggle dangerous mode
\`\`\`

### Topic management
\`\`\`bash
viben api topics                       # List topics
viben api topics --status finished,error
viben api delete-topic <id>            # Delete topic
viben api delete-topic <id> --force    # Force delete active
viben api cleanup                      # Cleanup finished topics
viben api cleanup --status finished,error
\`\`\`

### System
\`\`\`bash
viben api health                       # System health
viben api config                       # Show config
viben api config set <key> <value>     # Update config
viben api adapters                     # List adapters
viben api tunnel                       # Tunnel status
viben api notify "message"             # Send notification
viben api version                      # Daemon version
viben api restart                      # Restart daemon
\`\`\`
```

- [ ] **Step 2: Update the guidelines section**

Update the guidelines to reference the new commands:

```typescript
## Guidelines
- When a user asks about sessions or topics, run \`viben api topics\` or \`viben api status\` to get current data.
- When deleting: if the session is active/initializing, warn the user first. Only use --force if they confirm.
- Use \`viben api health\` to check system status.
- Use \`viben api config\` to check configuration, \`viben api config set\` to update values.
- Format responses nicely for Telegram (use bold, code blocks).
- Be concise and helpful. Respond in the same language the user uses.
- When creating sessions, guide through: agent selection → workspace → confirm.
```

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/adapters/telegram/assistant.ts
git commit -m "docs: update assistant system prompt with new api commands"
```

---

### Task 4: Verify `listRecords` Access

**Files:**
- Modify: `src/core/api-server.ts` (already done in Task 1, but verify)

The health endpoint calls `this.core.sessionManager.listRecords()` which already exists on `SessionManager` (session-manager.ts:144-151). No new code needed — just verify the mock is set up correctly in tests.

- [ ] **Step 1: Verify `listRecords` is accessible**

Check that `SessionManager.listRecords()` is public (it is — line 144). No changes needed.

- [ ] **Step 2: Mark complete**

This task is a verification step only.

---

### Task 5: Final Integration Test

**Files:**
- All modified files

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds with no type errors

- [ ] **Step 3: Verify help text**

Run: `node dist/cli.js --help`
Expected: Shows updated help text with all API commands

- [ ] **Step 4: Final commit (if any remaining changes)**

```bash
git status
# If changes remain:
git add -A && git commit -m "chore: final integration cleanup for api cli redesign"
```
