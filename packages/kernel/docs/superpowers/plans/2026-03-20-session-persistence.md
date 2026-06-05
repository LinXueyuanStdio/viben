# Session Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist session-to-topic mappings so Viben can lazy-resume sessions after restart.

**Architecture:** A `SessionStore` in core persists `SessionRecord` entries (including platform-specific data like Telegram `topicId`) to `~/.viben/sessions.json`. On restart, when a user sends a message to an existing topic, the adapter triggers a lazy resume: spawn agent, call `unstable_resumeSession()`, reconnect to topic. Auto-cleanup removes stale records.

**Tech Stack:** TypeScript, Zod (config validation), Node.js fs (JSON file I/O), `@agentclientprotocol/sdk` (ACP resume API)

**Spec:** `docs/superpowers/specs/2026-03-20-session-persistence-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/core/session-store.ts` | `SessionStore` interface + `JsonFileSessionStore` implementation |
| Modify | `src/core/types.ts:65` | Add `SessionRecord` type |
| Modify | `src/core/config.ts:32-45` | Add `sessionStore.ttlDays` to config schema |
| Modify | `src/core/session.ts:9-22` | Add `agentSessionId` field |
| Modify | `src/core/session-manager.ts:5-48` | Inject `SessionStore`, persist on create/destroy |
| Modify | `src/core/agent-instance.ts:84-174` | Add static `resume()` method |
| Modify | `src/core/core.ts:84-90` | Lazy resume when session not found by threadId |
| Modify | `src/adapters/telegram/commands.ts:110,182` | Save `topicId` in both `handleNew` and `handleNewChat` |
| Modify | `src/core/core.ts:168-189` | Update store status on `session_end` and `error` events |
| Create | `src/__tests__/session-store.test.ts` | Unit tests for `JsonFileSessionStore` |
| Create | `src/__tests__/lazy-resume.test.ts` | Integration tests for lazy resume flow |

---

### Task 1: SessionRecord Type

**Files:**
- Modify: `src/core/types.ts:65`

- [ ] **Step 1: Add SessionRecord type to types.ts**

Add after `SessionStatus` (line 65):

```typescript
export interface SessionRecord<P = Record<string, unknown>> {
  sessionId: string
  agentSessionId: string
  agentName: string
  workingDir: string
  channelId: string
  status: SessionStatus
  createdAt: string
  lastActiveAt: string
  name?: string
  platform: P
}

export interface TelegramPlatformData {
  topicId: number
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(types): add SessionRecord and TelegramPlatformData types"
```

---

### Task 2: SessionStore Interface + JsonFileSessionStore

**Files:**
- Create: `src/core/session-store.ts`
- Create: `src/__tests__/session-store.test.ts`

- [ ] **Step 1: Write failing tests for SessionStore**

Create `src/__tests__/session-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { JsonFileSessionStore } from '../core/session-store.js'
import type { SessionRecord } from '../core/types.js'

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    sessionId: 'sess-1',
    agentSessionId: 'agent-uuid-1',
    agentName: 'claude',
    workingDir: '/tmp/workspace',
    channelId: 'telegram',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    platform: { topicId: 123 },
    ...overrides,
  }
}

describe('JsonFileSessionStore', () => {
  let tmpDir: string
  let filePath: string
  let store: JsonFileSessionStore

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-test-'))
    filePath = path.join(tmpDir, 'sessions.json')
    store = new JsonFileSessionStore(filePath, 30)
  })

  afterEach(() => {
    store.destroy()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('saves and retrieves a record', async () => {
    const record = makeRecord()
    await store.save(record)
    expect(store.get('sess-1')).toEqual(record)
  })

  it('returns undefined for unknown sessionId', () => {
    expect(store.get('nonexistent')).toBeUndefined()
  })

  it('finds record by platform predicate', async () => {
    await store.save(makeRecord())
    const found = store.findByPlatform('telegram', (p) => p.topicId === 123)
    expect(found?.sessionId).toBe('sess-1')
  })

  it('returns undefined when predicate does not match', async () => {
    await store.save(makeRecord())
    const found = store.findByPlatform('telegram', (p) => p.topicId === 999)
    expect(found).toBeUndefined()
  })

  it('lists records filtered by channelId', async () => {
    await store.save(makeRecord({ sessionId: 's1', channelId: 'telegram' }))
    await store.save(makeRecord({ sessionId: 's2', channelId: 'discord' }))
    expect(store.list('telegram')).toHaveLength(1)
    expect(store.list()).toHaveLength(2)
  })

  it('removes a record', async () => {
    await store.save(makeRecord())
    await store.remove('sess-1')
    expect(store.get('sess-1')).toBeUndefined()
  })

  it('persists to disk on flush', async () => {
    await store.save(makeRecord())
    store.flushSync()
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    expect(raw.version).toBe(1)
    expect(raw.sessions['sess-1']).toBeDefined()
  })

  it('loads from existing file on construction', async () => {
    await store.save(makeRecord())
    store.flushSync()
    store.destroy()

    const store2 = new JsonFileSessionStore(filePath, 30)
    expect(store2.get('sess-1')).toBeDefined()
    store2.destroy()
  })

  it('auto-cleans records older than TTL', async () => {
    const old = makeRecord({
      sessionId: 'old',
      status: 'finished',
      lastActiveAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const recent = makeRecord({ sessionId: 'new' })
    const data = { version: 1, sessions: { old, new: recent } }
    fs.writeFileSync(filePath, JSON.stringify(data))

    const store2 = new JsonFileSessionStore(filePath, 30)
    expect(store2.get('old')).toBeUndefined()
    expect(store2.get('new')).toBeDefined()
    store2.destroy()
  })

  it('does not clean active records even if old', async () => {
    const old = makeRecord({
      sessionId: 'old-active',
      status: 'active',
      lastActiveAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const data = { version: 1, sessions: { 'old-active': old } }
    fs.writeFileSync(filePath, JSON.stringify(data))

    const store2 = new JsonFileSessionStore(filePath, 30)
    expect(store2.get('old-active')).toBeDefined()
    store2.destroy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/session-store.test.ts`
Expected: FAIL — module `../core/session-store.js` not found

- [ ] **Step 3: Implement JsonFileSessionStore**

Create `src/core/session-store.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import type { SessionRecord } from './types.js'
import { createChildLogger } from './log.js'

const log = createChildLogger({ module: 'session-store' })

export interface SessionStore {
  save(record: SessionRecord): Promise<void>
  get(sessionId: string): SessionRecord | undefined
  findByPlatform(
    channelId: string,
    predicate: (platform: Record<string, unknown>) => boolean,
  ): SessionRecord | undefined
  list(channelId?: string): SessionRecord[]
  remove(sessionId: string): Promise<void>
}

interface StoreFile {
  version: number
  sessions: Record<string, SessionRecord>
}

const DEBOUNCE_MS = 2000

export class JsonFileSessionStore implements SessionStore {
  private records: Map<string, SessionRecord> = new Map()
  private filePath: string
  private ttlDays: number
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(filePath: string, ttlDays: number) {
    this.filePath = filePath
    this.ttlDays = ttlDays
    this.load()
    this.cleanup()

    // Daily cleanup for long-running instances
    this.cleanupInterval = setInterval(() => this.cleanup(), 24 * 60 * 60 * 1000)

    // Force flush on shutdown
    const flush = () => this.flushSync()
    process.on('SIGTERM', flush)
    process.on('SIGINT', flush)
    process.on('exit', flush)
  }

  async save(record: SessionRecord): Promise<void> {
    this.records.set(record.sessionId, { ...record })
    this.scheduleDiskWrite()
  }

  get(sessionId: string): SessionRecord | undefined {
    return this.records.get(sessionId)
  }

  findByPlatform(
    channelId: string,
    predicate: (platform: Record<string, unknown>) => boolean,
  ): SessionRecord | undefined {
    for (const record of this.records.values()) {
      if (record.channelId === channelId && predicate(record.platform)) {
        return record
      }
    }
    return undefined
  }

  list(channelId?: string): SessionRecord[] {
    const all = [...this.records.values()]
    if (channelId) return all.filter((r) => r.channelId === channelId)
    return all
  }

  async remove(sessionId: string): Promise<void> {
    this.records.delete(sessionId)
    this.scheduleDiskWrite()
  }

  flushSync(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    const data: StoreFile = {
      version: 1,
      sessions: Object.fromEntries(this.records),
    }
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2))
  }

  destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (this.cleanupInterval) clearInterval(this.cleanupInterval)
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) return
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as StoreFile
      if (raw.version !== 1) {
        log.warn({ version: raw.version }, 'Unknown session store version, skipping load')
        return
      }
      for (const [id, record] of Object.entries(raw.sessions)) {
        this.records.set(id, record)
      }
      log.info({ count: this.records.size }, 'Loaded session records')
    } catch (err) {
      log.error({ err }, 'Failed to load session store')
    }
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.ttlDays * 24 * 60 * 60 * 1000
    let removed = 0
    for (const [id, record] of this.records) {
      if (record.status === 'active' || record.status === 'initializing') continue
      const lastActive = new Date(record.lastActiveAt).getTime()
      if (lastActive < cutoff) {
        this.records.delete(id)
        removed++
      }
    }
    if (removed > 0) {
      log.info({ removed }, 'Cleaned up expired session records')
      this.scheduleDiskWrite()
    }
  }

  private scheduleDiskWrite(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.flushSync()
    }, DEBOUNCE_MS)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/session-store.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/session-store.ts src/__tests__/session-store.test.ts
git commit -m "feat(session-store): add JsonFileSessionStore with auto-cleanup"
```

---

### Task 3: Add sessionStore config option

**Files:**
- Modify: `src/core/config.ts:32-45`

- [ ] **Step 1: Add sessionStore to ConfigSchema**

In `src/core/config.ts`, add to the `ConfigSchema` z.object (around line 42, before the closing `)`):

```typescript
sessionStore: z.object({
  ttlDays: z.number().default(30),
}).default({}),
```

- [ ] **Step 2: Update DEFAULT_CONFIG**

Add to `DEFAULT_CONFIG` (around line 72):

```typescript
sessionStore: { ttlDays: 30 },
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/core/config.ts
git commit -m "feat(config): add sessionStore.ttlDays option (default 30)"
```

---

### Task 4: Add agentSessionId to Session

**Files:**
- Modify: `src/core/session.ts:9-22`

- [ ] **Step 1: Add agentSessionId field**

After `agentInstance` field (line 14), add:

```typescript
agentSessionId: string = ''
```

- [ ] **Step 2: Set agentSessionId after spawn in SessionManager**

In `src/core/session-manager.ts`, inside `createSession()` (after line 14 where session is created), add:

```typescript
session.agentSessionId = session.agentInstance.sessionId
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/core/session.ts src/core/session-manager.ts
git commit -m "feat(session): add agentSessionId field for resume support"
```

---

### Task 5: Integrate SessionStore into SessionManager

**Files:**
- Modify: `src/core/session-manager.ts:5-48`
- Modify: `src/core/core.ts` (pass store to SessionManager)

- [ ] **Step 1: Inject SessionStore into SessionManager**

In `src/core/session-manager.ts`, modify the class:

```typescript
import type { SessionStore } from './session-store.js'

export class SessionManager {
  private sessions: Map<string, Session> = new Map()
  private store: SessionStore | null

  constructor(store: SessionStore | null = null) {
    this.store = store
  }
```

- [ ] **Step 2: Persist on createSession**

At the end of `createSession()` (before `return session`), add:

```typescript
if (this.store) {
  await this.store.save({
    sessionId: session.id,
    agentSessionId: session.agentInstance.sessionId,
    agentName: session.agentName,
    workingDir: session.workingDirectory,
    channelId,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    lastActiveAt: new Date().toISOString(),
    name: session.name,
    platform: {},
  })
}
```

Note: `platform` is set to `{}` here — the adapter will update it with platform-specific data (e.g., `topicId`) after session creation.

- [ ] **Step 3: Add updatePlatform method**

Add to SessionManager:

```typescript
async updateSessionPlatform(sessionId: string, platform: Record<string, unknown>): Promise<void> {
  if (!this.store) return
  const record = this.store.get(sessionId)
  if (record) {
    await this.store.save({ ...record, platform })
  }
}

async updateSessionActivity(sessionId: string): Promise<void> {
  if (!this.store) return
  const record = this.store.get(sessionId)
  if (record) {
    await this.store.save({ ...record, lastActiveAt: new Date().toISOString() })
  }
}
```

- [ ] **Step 4: Remove from store on cancelSession/destroyAll**

In `cancelSession()`, add after `session.cancel()`:

```typescript
if (this.store) {
  const record = this.store.get(sessionId)
  if (record) {
    await this.store.save({ ...record, status: 'cancelled' })
  }
}
```

In `destroyAll()`, update status for all:

```typescript
if (this.store) {
  for (const session of this.sessions.values()) {
    const record = this.store.get(session.id)
    if (record) {
      await this.store.save({ ...record, status: 'finished' })
    }
  }
}
```

- [ ] **Step 5: Pass SessionStore to SessionManager in core.ts**

In `src/core/core.ts`:

1. Add field declaration to `VibenCore`:
```typescript
private sessionStore: SessionStore | null = null
```

2. In the constructor or `start()` method, create the store and pass it:
```typescript
import { JsonFileSessionStore, type SessionStore } from './session-store.js'
import path from 'node:path'
import os from 'node:os'

// In constructor or start():
const config = this.configManager.get()
const storePath = path.join(os.homedir(), '.viben', 'sessions.json')
this.sessionStore = new JsonFileSessionStore(storePath, config.sessionStore.ttlDays)
this.sessionManager = new SessionManager(this.sessionStore)
```

- [ ] **Step 6: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/core/session-manager.ts src/core/core.ts
git commit -m "feat(session-manager): integrate SessionStore for persistence"
```

---

### Task 6: AgentInstance.resume() Method

**Files:**
- Modify: `src/core/agent-instance.ts:84-174`

- [ ] **Step 1: Add static resume() method**

Add after the `spawn()` method (after line 174). This method reuses most of `spawn()` logic but calls `unstable_resumeSession` instead of `newSession`:

```typescript
static async resume(
  agentDef: AgentDefinition,
  workingDirectory: string,
  agentSessionId: string,
): Promise<AgentInstance> {
  const instance = new AgentInstance(agentDef.name)

  // Steps 1-3: same as spawn() — resolve command, spawn subprocess, capture stderr
  const resolved = resolveAgentCommand(agentDef.command)
  log.debug({ agentName: agentDef.name, command: resolved.command, agentSessionId }, 'Resuming agent')
  const spawnStart = Date.now()

  instance.child = spawn(resolved.command, [...resolved.args, ...agentDef.args], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: workingDirectory,
    env: { ...process.env, ...agentDef.env },
  })

  await new Promise<void>((resolve, reject) => {
    instance.child.on('error', (err) => {
      reject(new Error(`Failed to spawn agent "${agentDef.name}": ${err.message}. Is "${agentDef.command}" installed?`))
    })
    instance.child.on('spawn', () => resolve())
  })

  instance.stderrCapture = new StderrCapture(50)
  instance.child.stderr!.on('data', (chunk: Buffer) => {
    instance.stderrCapture.append(chunk.toString())
  })

  // Step 4: Create ACP stream (same as spawn)
  const stdinLogger = new Transform({
    transform(chunk, _enc, cb) {
      log.debug({ direction: 'send', raw: chunk.toString().trimEnd() }, 'ACP raw')
      cb(null, chunk)
    },
  })
  stdinLogger.pipe(instance.child.stdin!)

  const stdoutLogger = new Transform({
    transform(chunk, _enc, cb) {
      log.debug({ direction: 'recv', raw: chunk.toString().trimEnd() }, 'ACP raw')
      cb(null, chunk)
    },
  })
  instance.child.stdout!.pipe(stdoutLogger)

  const toAgent = nodeToWebWritable(stdinLogger)
  const fromAgent = nodeToWebReadable(stdoutLogger)
  const stream = ndJsonStream(toAgent, fromAgent)

  // Step 5: ACP connection + handshake
  instance.connection = new ClientSideConnection(
    (_agent: Agent): Client => instance.createClient(_agent),
    stream,
  )

  await instance.connection.initialize({
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: true,
    },
  })

  // Step 6: Resume session (with fallback to newSession)
  try {
    const response = await instance.connection.unstable_resumeSession({
      sessionId: agentSessionId,
      cwd: workingDirectory,
    })
    instance.sessionId = response.sessionId
    log.info({ sessionId: response.sessionId, durationMs: Date.now() - spawnStart }, 'Agent resume complete')
  } catch (err) {
    log.warn({ err, agentSessionId }, 'Resume failed, falling back to new session')
    const response = await instance.connection.newSession({
      cwd: workingDirectory,
      mcpServers: [],
    })
    instance.sessionId = response.sessionId
    log.info({ sessionId: response.sessionId, durationMs: Date.now() - spawnStart }, 'Agent fallback spawn complete')
  }

  // Step 7: Crash detection (same as spawn)
  instance.child.on('exit', (code, signal) => {
    log.info({ sessionId: instance.sessionId, exitCode: code, signal }, 'Agent process exited')
    if (code !== 0 && code !== null) {
      const stderr = instance.stderrCapture.getLastLines()
      instance.onSessionUpdate({
        type: 'error',
        message: `Agent crashed (exit code ${code})\n${stderr}`,
      })
    }
  })

  instance.connection.closed.then(() => {
    log.debug({ sessionId: instance.sessionId }, 'ACP connection closed')
  })

  return instance
}
```

- [ ] **Step 2: Add resume to AgentManager**

Check `src/core/agent-manager.ts` for the `spawn()` wrapper. Add a `resume()` method that mirrors it:

```typescript
async resume(agentName: string, workingDirectory: string, agentSessionId: string): Promise<AgentInstance> {
  const agentDef = this.getAgentDef(agentName)
  return AgentInstance.resume(agentDef, workingDirectory, agentSessionId)
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: No errors. Note: `unstable_resumeSession` must exist in `@agentclientprotocol/sdk`. If type error occurs, check SDK version and method name.

- [ ] **Step 4: Commit**

```bash
git add src/core/agent-instance.ts src/core/agent-manager.ts
git commit -m "feat(agent-instance): add resume() method with fallback to newSession"
```

---

### Task 7: Lazy Resume in Core

**Files:**
- Modify: `src/core/core.ts:84-90`

- [ ] **Step 1: Add resume lock map**

Add field to `VibenCore`:

```typescript
private resumeLocks: Map<string, Promise<Session | null>> = new Map()
```

- [ ] **Step 2: Add lazyResume method**

Add to `VibenCore`:

```typescript
private async lazyResume(message: IncomingMessage): Promise<Session | null> {
  if (!this.sessionStore) return null

  const lockKey = `${message.channelId}:${message.threadId}`

  // Check for existing resume in progress
  const existing = this.resumeLocks.get(lockKey)
  if (existing) return existing

  const record = this.sessionStore.findByPlatform(
    message.channelId,
    (p) => String(p.topicId) === message.threadId,
  )
  if (!record) return null

  // Don't resume cancelled/error sessions
  if (record.status === 'cancelled' || record.status === 'error') return null

  const resumePromise = (async (): Promise<Session | null> => {
    try {
      const agentInstance = await this.agentManager.resume(
        record.agentName,
        record.workingDir,
        record.agentSessionId,
      )

      const session = new Session({
        id: record.sessionId,
        channelId: record.channelId,
        agentName: record.agentName,
        workingDirectory: record.workingDir,
        agentInstance,
      })
      session.threadId = message.threadId
      session.agentSessionId = agentInstance.sessionId
      session.status = 'active'
      session.name = record.name

      this.sessionManager.registerSession(session)

      const adapter = this.adapters.get(message.channelId)
      if (adapter) {
        this.wireSessionEvents(session, adapter)
      }

      // Update store with new agentSessionId (may differ after resume)
      await this.sessionStore.save({
        ...record,
        agentSessionId: agentInstance.sessionId,
        status: 'active',
        lastActiveAt: new Date().toISOString(),
      })

      log.info({ sessionId: session.id, threadId: message.threadId }, 'Lazy resume successful')
      return session
    } catch (err) {
      log.error({ err, record }, 'Lazy resume failed')
      return null
    } finally {
      this.resumeLocks.delete(lockKey)
    }
  })()

  this.resumeLocks.set(lockKey, resumePromise)
  return resumePromise
}
```

- [ ] **Step 3: Add registerSession to SessionManager**

In `src/core/session-manager.ts`, add:

```typescript
registerSession(session: Session): void {
  this.sessions.set(session.id, session)
}
```

- [ ] **Step 4: Modify handleMessage to use lazyResume**

In `src/core/core.ts`, replace lines 84-90:

```typescript
// Find session by thread
let session = this.sessionManager.getSessionByThread(message.channelId, message.threadId)

// Lazy resume: try to restore session from store
if (!session) {
  session = await this.lazyResume(message) ?? undefined
}

if (!session) return

// Update activity timestamp
this.sessionManager.updateSessionActivity(session.id)

// Forward to session
await session.enqueuePrompt(message.text)
```

- [ ] **Step 5: Update store on session_end and error events**

In `src/core/core.ts`, in `wireSessionEvents()` (lines 168-189):

After `session.status = 'finished'` (line 169), add:
```typescript
this.sessionManager.updateSessionStatus(session.id, 'finished')
```

After `case 'error':` handler (line 180), add:
```typescript
this.sessionManager.updateSessionStatus(session.id, 'error')
```

Add `updateSessionStatus` to `SessionManager`:
```typescript
async updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  if (!this.store) return
  const record = this.store.get(sessionId)
  if (record) {
    await this.store.save({ ...record, status })
  }
}
```

- [ ] **Step 6: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/core/core.ts src/core/session-manager.ts
git commit -m "feat(core): add lazy resume with store status updates on session_end/error"
```

---

### Task 8: Telegram Adapter — Save topicId to Store

**Files:**
- Modify: `src/adapters/telegram/commands.ts` (handleNew and handleNewChat)

- [ ] **Step 1: Save platform data in handleNew**

In `src/adapters/telegram/commands.ts`, in `handleNew()` after `session.threadId` is set (around line 110), add:

```typescript
// Persist platform mapping
await core.sessionManager.updateSessionPlatform(session.id, { topicId: threadId })
```

Note: `core` is already passed as parameter to `handleNew(ctx, core, chatId)`, no casting needed.

- [ ] **Step 2: Save platform data in handleNewChat**

In `src/adapters/telegram/commands.ts`, in `handleNewChat()` after `session.threadId` is set (around line 182), add:

```typescript
// Persist platform mapping for new chat
await core.sessionManager.updateSessionPlatform(session.id, { topicId: newThreadId })
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 4: Manual test**

Run: `VIBEN_CONFIG_PATH=~/.viben/config2.json pnpm start`
1. Create a new session via `/new`
2. Check `~/.viben/sessions.json` — should contain the session record with `topicId`
3. Create another session via `/newchat` in the topic — should also have `topicId`
4. Stop and restart the server
5. Send a message in the same topic — should lazy-resume

- [ ] **Step 5: Commit**

```bash
git add src/adapters/telegram/commands.ts
git commit -m "feat(telegram): persist topicId in session store for lazy resume"
```

---

### Task 9: Integration Tests

**Files:**
- Create: `src/__tests__/lazy-resume.test.ts`

- [ ] **Step 1: Write integration tests**

Create `src/__tests__/lazy-resume.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { JsonFileSessionStore } from '../core/session-store.js'
import type { SessionRecord } from '../core/types.js'

describe('Lazy Resume Integration', () => {
  let tmpDir: string
  let filePath: string
  let store: JsonFileSessionStore

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-resume-'))
    filePath = path.join(tmpDir, 'sessions.json')
    store = new JsonFileSessionStore(filePath, 30)
  })

  afterEach(() => {
    store.destroy()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('survives restart: save, destroy, reload, find', async () => {
    const record: SessionRecord = {
      sessionId: 'sess-resume-1',
      agentSessionId: 'agent-uuid-abc',
      agentName: 'claude',
      workingDir: '/tmp/ws',
      channelId: 'telegram',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      platform: { topicId: 456 },
    }
    await store.save(record)
    store.flushSync()
    store.destroy()

    // Simulate restart
    const store2 = new JsonFileSessionStore(filePath, 30)
    const found = store2.findByPlatform('telegram', (p) => p.topicId === 456)
    expect(found).toBeDefined()
    expect(found!.sessionId).toBe('sess-resume-1')
    expect(found!.agentSessionId).toBe('agent-uuid-abc')
    store2.destroy()
  })

  it('cancelled sessions are not resumable by lookup convention', async () => {
    const record: SessionRecord = {
      sessionId: 'sess-cancelled',
      agentSessionId: 'agent-uuid-cancel',
      agentName: 'claude',
      workingDir: '/tmp/ws',
      channelId: 'telegram',
      status: 'cancelled',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      platform: { topicId: 789 },
    }
    await store.save(record)
    const found = store.findByPlatform('telegram', (p) => p.topicId === 789)
    // Record exists, but caller should check status before resuming
    expect(found?.status).toBe('cancelled')
  })
})
```

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/lazy-resume.test.ts
git commit -m "test: add integration tests for session persistence and lazy resume"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All pass

- [ ] **Step 3: End-to-end manual test**

1. Start: `VIBEN_CONFIG_PATH=~/.viben/config2.json pnpm start`
2. Create session via Telegram `/new`
3. Send a few messages, verify conversation works
4. Stop server (Ctrl+C)
5. Check `~/.viben/sessions.json` has the record
6. Start server again
7. Send message in same topic — verify lazy resume works and agent remembers context
8. Create another session, cancel it via `/cancel`
9. Stop and restart, send message in cancelled topic — should NOT resume

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: session persistence with lazy resume support"
```
