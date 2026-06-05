# Topic Management & Assistant Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add topic lifecycle management (list, delete, cleanup) exposed via API + CLI, and enhance the AI assistant to execute these commands via bash.

**Architecture:** A `TopicManager` core module owns all topic logic. API endpoints and CLI commands are thin wrappers. The assistant calls CLI commands via its agent subprocess's bash tool. `SessionManager` gets two new methods (`listRecords`, `removeRecord`) to expose store data without breaking encapsulation.

**Tech Stack:** TypeScript, Node.js HTTP, grammY (Telegram), vitest

**Spec:** `docs/superpowers/specs/2026-03-21-topic-management-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/core/channel.ts` | Add `deleteSessionThread` to interface + abstract class |
| Modify | `src/core/session-manager.ts` | Add `listRecords()` and `removeRecord()` methods |
| Create | `src/core/topic-manager.ts` | Core topic lifecycle logic |
| Modify | `src/core/index.ts` | Export TopicManager |
| Modify | `src/adapters/telegram/adapter.ts` | Implement `deleteSessionThread` |
| Modify | `src/core/api-server.ts` | Add topic endpoints |
| Modify | `src/cli/commands.ts` | Add api topic commands |
| Modify | `src/adapters/telegram/assistant.ts` | Enhanced dynamic system prompt |
| Create | `src/__tests__/topic-manager.test.ts` | TopicManager unit tests |
| Modify | `src/__tests__/api-server.test.ts` | Topic endpoint tests |
| Modify | `src/__tests__/cli-api.test.ts` | CLI topic command tests |

---

### Task 1: Add `deleteSessionThread` to ChannelAdapter

**Files:**
- Modify: `src/core/channel.ts:8-48`

- [ ] **Step 1: Add method to IChannelAdapter interface**

In `src/core/channel.ts`, add after `renameSessionThread` (line 19):

```typescript
deleteSessionThread(sessionId: string): Promise<void>
```

- [ ] **Step 2: Add default no-op to ChannelAdapter abstract class**

In `src/core/channel.ts`, add after `renameSessionThread` abstract declaration (line 43):

```typescript
async deleteSessionThread(_sessionId: string): Promise<void> {}
```

- [ ] **Step 3: Implement in TelegramAdapter**

In `src/adapters/telegram/adapter.ts`, add method after `renameSessionThread` (after line 687):

```typescript
async deleteSessionThread(sessionId: string): Promise<void> {
  // Look up topicId from session record platform data
  const record = this.core.sessionManager.getSessionRecord(sessionId);
  const platform = record?.platform as import("../../core/types.js").TelegramPlatformData | undefined;
  const topicId = platform?.topicId;
  if (!topicId) return;

  try {
    await this.bot.api.deleteForumTopic(this.telegramConfig.chatId, topicId);
  } catch (err) {
    log.warn({ err, sessionId, topicId }, "Failed to delete forum topic (may already be deleted)");
  }
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/core/channel.ts src/adapters/telegram/adapter.ts
git commit -m "feat: add deleteSessionThread to ChannelAdapter interface"
```

---

### Task 2: Add `listRecords` and `removeRecord` to SessionManager

**Files:**
- Modify: `src/core/session-manager.ts:6-158`

- [ ] **Step 1: Add `listRecords` method**

In `src/core/session-manager.ts`, add after `listSessions` method (after line 142):

```typescript
listRecords(filter?: { statuses?: string[] }): import("./types.js").SessionRecord[] {
  if (!this.store) return [];
  let records = this.store.list();
  if (filter?.statuses?.length) {
    records = records.filter(r => filter.statuses!.includes(r.status));
  }
  return records;
}
```

- [ ] **Step 2: Add `removeRecord` method**

Add after `listRecords`:

```typescript
async removeRecord(sessionId: string): Promise<void> {
  if (!this.store) return;
  await this.store.remove(sessionId);
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/core/session-manager.ts
git commit -m "feat: add listRecords and removeRecord to SessionManager"
```

---

### Task 3: Create TopicManager core module

**Files:**
- Create: `src/core/topic-manager.ts`
- Create: `src/__tests__/topic-manager.test.ts`

- [ ] **Step 1: Write failing tests for `listTopics`**

Create `src/__tests__/topic-manager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('TopicManager', () => {
  let topicManager: any
  let mockSessionManager: any
  let mockAdapter: any

  const systemTopicIds = { notificationTopicId: 100, assistantTopicId: 200 }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockSessionManager = {
      listRecords: vi.fn(() => []),
      getSession: vi.fn(),
      cancelSession: vi.fn(),
      removeRecord: vi.fn(),
    }
    mockAdapter = {
      deleteSessionThread: vi.fn(),
    }
    const { TopicManager } = await import('../core/topic-manager.js')
    topicManager = new TopicManager(mockSessionManager, mockAdapter, systemTopicIds)
  })

  describe('listTopics', () => {
    it('returns topics from session records', () => {
      mockSessionManager.listRecords.mockReturnValue([
        { sessionId: 'a', agentName: 'claude', status: 'finished', name: 'Fix bug', lastActiveAt: '2026-03-21', platform: { topicId: 42 } },
        { sessionId: 'b', agentName: 'codex', status: 'active', name: null, lastActiveAt: '2026-03-21', platform: { topicId: 58 } },
      ])

      const topics = topicManager.listTopics()
      expect(topics).toHaveLength(2)
      expect(topics[0]).toEqual({
        sessionId: 'a', topicId: 42, name: 'Fix bug', status: 'finished', agentName: 'claude', lastActiveAt: '2026-03-21',
      })
    })

    it('excludes system topics', () => {
      mockSessionManager.listRecords.mockReturnValue([
        { sessionId: 'sys', agentName: 'claude', status: 'active', name: 'Assistant', lastActiveAt: '2026-03-21', platform: { topicId: 200 } },
        { sessionId: 'user', agentName: 'claude', status: 'finished', name: 'Task', lastActiveAt: '2026-03-21', platform: { topicId: 42 } },
      ])

      const topics = topicManager.listTopics()
      expect(topics).toHaveLength(1)
      expect(topics[0].sessionId).toBe('user')
    })

    it('includes headless sessions with topicId null', () => {
      mockSessionManager.listRecords.mockReturnValue([
        { sessionId: 'h', agentName: 'claude', status: 'finished', name: 'API', lastActiveAt: '2026-03-21', platform: {} },
      ])

      const topics = topicManager.listTopics()
      expect(topics).toHaveLength(1)
      expect(topics[0].topicId).toBeNull()
    })

    it('filters by status', () => {
      mockSessionManager.listRecords.mockReturnValue([
        { sessionId: 'a', agentName: 'claude', status: 'finished', name: null, lastActiveAt: '2026-03-21', platform: { topicId: 1 } },
        { sessionId: 'b', agentName: 'claude', status: 'active', name: null, lastActiveAt: '2026-03-21', platform: { topicId: 2 } },
      ])

      const topics = topicManager.listTopics({ statuses: ['finished'] })
      expect(topics).toHaveLength(1)
      expect(topics[0].sessionId).toBe('a')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/__tests__/topic-manager.test.ts`
Expected: FAIL — `topic-manager.js` module not found

- [ ] **Step 3: Implement `TopicManager` with `listTopics`**

Create `src/core/topic-manager.ts`:

```typescript
import type { SessionManager } from './session-manager.js'
import type { IChannelAdapter } from './channel.js'
import type { SessionRecord } from './types.js'
import { createChildLogger } from './log.js'

const log = createChildLogger({ module: 'topic-manager' })

export interface TopicInfo {
  sessionId: string
  topicId: number | null
  name: string | null
  status: string
  agentName: string
  lastActiveAt: string
}

export interface DeleteTopicResult {
  ok: boolean
  needsConfirmation?: boolean
  topicId?: number | null
  session?: { id: string; name: string | null; status: string }
  error?: string
}

export interface CleanupResult {
  deleted: string[]
  failed: { sessionId: string; error: string }[]
}

interface SystemTopicIds {
  notificationTopicId: number | null
  assistantTopicId: number | null
}

export class TopicManager {
  constructor(
    private sessionManager: SessionManager,
    private adapter: IChannelAdapter | null,
    private systemTopicIds: SystemTopicIds,
  ) {}

  listTopics(filter?: { statuses?: string[] }): TopicInfo[] {
    const records = this.sessionManager.listRecords(filter)
    return records
      .filter(r => !this.isSystemTopic(r))
      .map(r => ({
        sessionId: r.sessionId,
        topicId: (r.platform as Record<string, unknown>)?.topicId as number ?? null,
        name: r.name ?? null,
        status: r.status,
        agentName: r.agentName,
        lastActiveAt: r.lastActiveAt,
      }))
  }

  private isSystemTopic(record: SessionRecord): boolean {
    const topicId = (record.platform as Record<string, unknown>)?.topicId as number | undefined
    if (!topicId) return false
    return topicId === this.systemTopicIds.notificationTopicId
      || topicId === this.systemTopicIds.assistantTopicId
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/__tests__/topic-manager.test.ts`
Expected: All 4 `listTopics` tests PASS

- [ ] **Step 5: Write failing tests for `deleteTopic`**

Add to `src/__tests__/topic-manager.test.ts`:

```typescript
describe('deleteTopic', () => {
  it('deletes a finished session topic', async () => {
    mockSessionManager.listRecords.mockReturnValue([
      { sessionId: 'a', agentName: 'claude', status: 'finished', name: 'Task', lastActiveAt: '2026-03-21', platform: { topicId: 42 } },
    ])

    const result = await topicManager.deleteTopic('a')
    expect(result).toEqual({ ok: true, topicId: 42 })
    expect(mockAdapter.deleteSessionThread).toHaveBeenCalledWith('a')
    expect(mockSessionManager.removeRecord).toHaveBeenCalledWith('a')
  })

  it('requires confirmation for active session', async () => {
    mockSessionManager.listRecords.mockReturnValue([
      { sessionId: 'a', agentName: 'claude', status: 'active', name: 'Active Task', lastActiveAt: '2026-03-21', platform: { topicId: 42 } },
    ])

    const result = await topicManager.deleteTopic('a')
    expect(result).toEqual({
      ok: false,
      needsConfirmation: true,
      session: { id: 'a', name: 'Active Task', status: 'active' },
    })
    expect(mockAdapter.deleteSessionThread).not.toHaveBeenCalled()
  })

  it('requires confirmation for initializing session', async () => {
    mockSessionManager.listRecords.mockReturnValue([
      { sessionId: 'a', agentName: 'claude', status: 'initializing', name: null, lastActiveAt: '2026-03-21', platform: { topicId: 42 } },
    ])

    const result = await topicManager.deleteTopic('a')
    expect(result.needsConfirmation).toBe(true)
  })

  it('force deletes active session when confirmed', async () => {
    mockSessionManager.listRecords.mockReturnValue([
      { sessionId: 'a', agentName: 'claude', status: 'active', name: 'Task', lastActiveAt: '2026-03-21', platform: { topicId: 42 } },
    ])

    const result = await topicManager.deleteTopic('a', { confirmed: true })
    expect(result).toEqual({ ok: true, topicId: 42 })
    expect(mockSessionManager.cancelSession).toHaveBeenCalledWith('a')
    expect(mockAdapter.deleteSessionThread).toHaveBeenCalledWith('a')
    expect(mockSessionManager.removeRecord).toHaveBeenCalledWith('a')
  })

  it('rejects deletion of system topics', async () => {
    mockSessionManager.listRecords.mockReturnValue([
      { sessionId: 'sys', agentName: 'claude', status: 'active', name: 'Assistant', lastActiveAt: '2026-03-21', platform: { topicId: 200 } },
    ])

    const result = await topicManager.deleteTopic('sys')
    expect(result).toEqual({ ok: false, error: 'Cannot delete system topic' })
  })

  it('returns not found for unknown session', async () => {
    mockSessionManager.listRecords.mockReturnValue([])

    const result = await topicManager.deleteTopic('unknown')
    expect(result).toEqual({ ok: false, error: 'Session not found' })
  })

  it('deletes headless session (no topicId)', async () => {
    mockSessionManager.listRecords.mockReturnValue([
      { sessionId: 'h', agentName: 'claude', status: 'finished', name: 'API Task', lastActiveAt: '2026-03-21', platform: {} },
    ])

    const result = await topicManager.deleteTopic('h')
    expect(result).toEqual({ ok: true, topicId: null })
    expect(mockAdapter.deleteSessionThread).not.toHaveBeenCalled()
    expect(mockSessionManager.removeRecord).toHaveBeenCalledWith('h')
  })

  it('handles Telegram deletion failure gracefully', async () => {
    mockSessionManager.listRecords.mockReturnValue([
      { sessionId: 'a', agentName: 'claude', status: 'finished', name: 'Task', lastActiveAt: '2026-03-21', platform: { topicId: 42 } },
    ])
    mockAdapter.deleteSessionThread.mockRejectedValue(new Error('Telegram error'))

    const result = await topicManager.deleteTopic('a')
    expect(result).toEqual({ ok: true, topicId: 42 })
    expect(mockSessionManager.removeRecord).toHaveBeenCalledWith('a')
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm test -- src/__tests__/topic-manager.test.ts`
Expected: FAIL — `deleteTopic` not defined

- [ ] **Step 7: Implement `deleteTopic`**

Add to `TopicManager` class in `src/core/topic-manager.ts`:

```typescript
async deleteTopic(sessionId: string, options?: { confirmed?: boolean }): Promise<DeleteTopicResult> {
  const records = this.sessionManager.listRecords()
  const record = records.find(r => r.sessionId === sessionId)
  if (!record) return { ok: false, error: 'Session not found' }

  if (this.isSystemTopic(record)) return { ok: false, error: 'Cannot delete system topic' }

  const isActive = record.status === 'active' || record.status === 'initializing'
  if (isActive && !options?.confirmed) {
    return {
      ok: false,
      needsConfirmation: true,
      session: { id: record.sessionId, name: record.name ?? null, status: record.status },
    }
  }

  if (isActive) {
    await this.sessionManager.cancelSession(sessionId)
  }

  const topicId = (record.platform as Record<string, unknown>)?.topicId as number ?? null
  if (this.adapter && topicId) {
    try {
      await this.adapter.deleteSessionThread(sessionId)
    } catch (err) {
      log.warn({ err, sessionId, topicId }, 'Failed to delete platform thread, removing record anyway')
    }
  }

  await this.sessionManager.removeRecord(sessionId)
  return { ok: true, topicId }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm test -- src/__tests__/topic-manager.test.ts`
Expected: All `deleteTopic` tests PASS

- [ ] **Step 9: Write failing tests for `cleanup`**

Add to `src/__tests__/topic-manager.test.ts`:

```typescript
describe('cleanup', () => {
  it('deletes all topics matching statuses', async () => {
    mockSessionManager.listRecords.mockReturnValue([
      { sessionId: 'a', agentName: 'claude', status: 'finished', name: 'Done', lastActiveAt: '2026-03-21', platform: { topicId: 1 } },
      { sessionId: 'b', agentName: 'claude', status: 'error', name: 'Err', lastActiveAt: '2026-03-21', platform: { topicId: 2 } },
      { sessionId: 'c', agentName: 'claude', status: 'active', name: 'Live', lastActiveAt: '2026-03-21', platform: { topicId: 3 } },
    ])

    const result = await topicManager.cleanup(['finished', 'error'])
    expect(result.deleted).toEqual(['a', 'b'])
    expect(result.failed).toHaveLength(0)
    expect(mockAdapter.deleteSessionThread).toHaveBeenCalledTimes(2)
    expect(mockSessionManager.removeRecord).toHaveBeenCalledTimes(2)
  })

  it('uses default statuses when none provided', async () => {
    mockSessionManager.listRecords.mockReturnValue([
      { sessionId: 'a', agentName: 'claude', status: 'finished', name: null, lastActiveAt: '2026-03-21', platform: { topicId: 1 } },
      { sessionId: 'b', agentName: 'claude', status: 'cancelled', name: null, lastActiveAt: '2026-03-21', platform: { topicId: 2 } },
    ])

    const result = await topicManager.cleanup()
    expect(result.deleted).toEqual(['a', 'b'])
  })

  it('excludes system topics from cleanup', async () => {
    mockSessionManager.listRecords.mockReturnValue([
      { sessionId: 'sys', agentName: 'claude', status: 'finished', name: 'Assistant', lastActiveAt: '2026-03-21', platform: { topicId: 200 } },
      { sessionId: 'user', agentName: 'claude', status: 'finished', name: 'Task', lastActiveAt: '2026-03-21', platform: { topicId: 42 } },
    ])

    const result = await topicManager.cleanup(['finished'])
    expect(result.deleted).toEqual(['user'])
  })

  it('cancels active sessions before removing during cleanup', async () => {
    mockSessionManager.listRecords.mockReturnValue([
      { sessionId: 'a', agentName: 'claude', status: 'active', name: 'Live', lastActiveAt: '2026-03-21', platform: { topicId: 1 } },
    ])

    const result = await topicManager.cleanup(['active'])
    expect(result.deleted).toEqual(['a'])
    expect(mockSessionManager.cancelSession).toHaveBeenCalledWith('a')
    expect(mockAdapter.deleteSessionThread).toHaveBeenCalledWith('a')
  })

  it('handles headless sessions in cleanup (no topicId)', async () => {
    mockSessionManager.listRecords.mockReturnValue([
      { sessionId: 'h', agentName: 'claude', status: 'finished', name: null, lastActiveAt: '2026-03-21', platform: {} },
    ])

    const result = await topicManager.cleanup(['finished'])
    expect(result.deleted).toEqual(['h'])
    expect(mockAdapter.deleteSessionThread).not.toHaveBeenCalled()
    expect(mockSessionManager.removeRecord).toHaveBeenCalledWith('h')
  })

  it('reports failures without stopping', async () => {
    mockSessionManager.listRecords.mockReturnValue([
      { sessionId: 'a', agentName: 'claude', status: 'finished', name: null, lastActiveAt: '2026-03-21', platform: { topicId: 1 } },
      { sessionId: 'b', agentName: 'claude', status: 'finished', name: null, lastActiveAt: '2026-03-21', platform: { topicId: 2 } },
    ])
    mockSessionManager.removeRecord
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('disk error'))

    const result = await topicManager.cleanup(['finished'])
    expect(result.deleted).toEqual(['a'])
    expect(result.failed).toEqual([{ sessionId: 'b', error: 'disk error' }])
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `pnpm test -- src/__tests__/topic-manager.test.ts`
Expected: FAIL — `cleanup` not defined

- [ ] **Step 11: Implement `cleanup`**

Add to `TopicManager` class in `src/core/topic-manager.ts`:

```typescript
async cleanup(statuses?: string[]): Promise<CleanupResult> {
  const targetStatuses = statuses?.length ? statuses : ['finished', 'error', 'cancelled']
  const records = this.sessionManager.listRecords({ statuses: targetStatuses })
  const targets = records.filter(r => !this.isSystemTopic(r))

  const deleted: string[] = []
  const failed: { sessionId: string; error: string }[] = []

  for (const record of targets) {
    try {
      // Cancel active/initializing sessions to prevent orphaned agent processes
      const isActive = record.status === 'active' || record.status === 'initializing'
      if (isActive) {
        await this.sessionManager.cancelSession(record.sessionId)
      }

      const topicId = (record.platform as Record<string, unknown>)?.topicId as number | undefined
      if (this.adapter && topicId) {
        try {
          await this.adapter.deleteSessionThread(record.sessionId)
        } catch (err) {
          log.warn({ err, sessionId: record.sessionId }, 'Failed to delete platform thread during cleanup')
        }
      }
      await this.sessionManager.removeRecord(record.sessionId)
      deleted.push(record.sessionId)
    } catch (err) {
      failed.push({ sessionId: record.sessionId, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return { deleted, failed }
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `pnpm test -- src/__tests__/topic-manager.test.ts`
Expected: All tests PASS

- [ ] **Step 13: Export TopicManager from core/index.ts**

Add to `src/core/index.ts`:

```typescript
export { TopicManager, type TopicInfo, type DeleteTopicResult, type CleanupResult } from './topic-manager.js'
```

- [ ] **Step 14: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 15: Commit**

```bash
git add src/core/topic-manager.ts src/core/index.ts src/core/session-manager.ts src/__tests__/topic-manager.test.ts
git commit -m "feat: add TopicManager core module with list, delete, cleanup"
```

---

### Task 4: Add API endpoints for topics

**Files:**
- Modify: `src/core/api-server.ts`
- Modify: `src/__tests__/api-server.test.ts`

- [ ] **Step 1: Write failing tests for topic API endpoints**

Add to `src/__tests__/api-server.test.ts`, inside the existing `describe('ApiServer')` block. First update `mockCore` to include the new dependencies:

```typescript
// Add to mockCore:
const mockTopicManager = {
  listTopics: vi.fn(() => []),
  deleteTopic: vi.fn(),
  cleanup: vi.fn(),
}
```

Then add these test cases:

```typescript
it('GET /api/topics returns topic list', async () => {
  mockTopicManager.listTopics.mockReturnValueOnce([
    { sessionId: 'abc', topicId: 42, name: 'Fix bug', status: 'finished', agentName: 'claude', lastActiveAt: '2026-03-21' },
  ])
  const port = await startServer()

  const res = await apiFetch(port, '/api/topics')
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.topics).toHaveLength(1)
  expect(data.topics[0].sessionId).toBe('abc')
})

it('GET /api/topics filters by status', async () => {
  mockTopicManager.listTopics.mockReturnValueOnce([])
  const port = await startServer()

  await apiFetch(port, '/api/topics?status=finished,error')
  expect(mockTopicManager.listTopics).toHaveBeenCalledWith({ statuses: ['finished', 'error'] })
})

it('DELETE /api/topics/:sessionId deletes topic', async () => {
  mockTopicManager.deleteTopic.mockResolvedValueOnce({ ok: true, topicId: 42 })
  const port = await startServer()

  const res = await apiFetch(port, '/api/topics/abc123', { method: 'DELETE' })
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.ok).toBe(true)
  expect(data.topicId).toBe(42)
})

it('DELETE /api/topics/:sessionId returns 409 for active session', async () => {
  mockTopicManager.deleteTopic.mockResolvedValueOnce({
    ok: false, needsConfirmation: true,
    session: { id: 'abc', name: 'Task', status: 'active' },
  })
  const port = await startServer()

  const res = await apiFetch(port, '/api/topics/abc', { method: 'DELETE' })
  expect(res.status).toBe(409)
  const data = await res.json()
  expect(data.needsConfirmation).toBe(true)
})

it('DELETE /api/topics/:sessionId with force=true deletes active session', async () => {
  mockTopicManager.deleteTopic.mockResolvedValueOnce({ ok: true, topicId: 42 })
  const port = await startServer()

  const res = await apiFetch(port, '/api/topics/abc?force=true', { method: 'DELETE' })
  expect(res.status).toBe(200)
  expect(mockTopicManager.deleteTopic).toHaveBeenCalledWith('abc', { confirmed: true })
})

it('DELETE /api/topics/:sessionId returns 403 for system topic', async () => {
  mockTopicManager.deleteTopic.mockResolvedValueOnce({ ok: false, error: 'Cannot delete system topic' })
  const port = await startServer()

  const res = await apiFetch(port, '/api/topics/sys', { method: 'DELETE' })
  expect(res.status).toBe(403)
})

it('POST /api/topics/cleanup cleans up topics', async () => {
  mockTopicManager.cleanup.mockResolvedValueOnce({ deleted: ['a', 'b'], failed: [] })
  const port = await startServer()

  const res = await apiFetch(port, '/api/topics/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statuses: ['finished', 'error'] }),
  })
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.deleted).toEqual(['a', 'b'])
  expect(data.failed).toHaveLength(0)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/api-server.test.ts`
Expected: FAIL — new endpoints return 404

- [ ] **Step 3: Add TopicManager to ApiServer and implement endpoints**

Modify `src/core/api-server.ts`:

Add import at top:
```typescript
import type { TopicManager } from './topic-manager.js'
```

Add `topicManager` field to `ApiServer` class and update constructor:
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

Add routing in `handleRequest` method (before the 404 fallback):
```typescript
} else if (method === 'GET' && url.match(/^\/api\/topics(\?.*)?$/)) {
  await this.handleListTopics(url, res)
} else if (method === 'DELETE' && url.match(/^\/api\/topics\/([^/?]+)/)) {
  const match = url.match(/^\/api\/topics\/([^/?]+)/)!
  await this.handleDeleteTopic(decodeURIComponent(match[1]), url, res)
} else if (method === 'POST' && url === '/api/topics/cleanup') {
  await this.handleCleanupTopics(req, res)
}
```

Add handler methods:
```typescript
private async handleListTopics(url: string, res: http.ServerResponse): Promise<void> {
  if (!this.topicManager) { this.sendJson(res, 501, { error: 'Topic management not available' }); return }
  const params = new URL(url, 'http://localhost').searchParams
  const statusParam = params.get('status')
  const filter = statusParam ? { statuses: statusParam.split(',') } : undefined
  const topics = this.topicManager.listTopics(filter)
  this.sendJson(res, 200, { topics })
}

private async handleDeleteTopic(sessionId: string, url: string, res: http.ServerResponse): Promise<void> {
  if (!this.topicManager) { this.sendJson(res, 501, { error: 'Topic management not available' }); return }
  const params = new URL(url, 'http://localhost').searchParams
  const force = params.get('force') === 'true'
  const result = await this.topicManager.deleteTopic(sessionId, force ? { confirmed: true } : undefined)
  if (result.ok) {
    this.sendJson(res, 200, result)
  } else if (result.needsConfirmation) {
    this.sendJson(res, 409, { error: 'Session is active', needsConfirmation: true, session: result.session })
  } else if (result.error === 'Cannot delete system topic') {
    this.sendJson(res, 403, { error: result.error })
  } else {
    this.sendJson(res, 404, { error: result.error ?? 'Not found' })
  }
}

private async handleCleanupTopics(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!this.topicManager) { this.sendJson(res, 501, { error: 'Topic management not available' }); return }
  const body = await this.readBody(req)
  let statuses: string[] | undefined
  if (body) {
    try { statuses = JSON.parse(body).statuses } catch { /* use defaults */ }
  }
  const result = await this.topicManager.cleanup(statuses)
  this.sendJson(res, 200, result)
}
```

- [ ] **Step 4: Update test setup to inject topicManager**

In `src/__tests__/api-server.test.ts`, update the `startServer` function to pass topicManager:

```typescript
async function startServer(portOverride?: number) {
  const { ApiServer } = await import('../core/api-server.js')
  server = new ApiServer(mockCore as any, { port: portOverride ?? 0, host: '127.0.0.1' }, portFilePath, mockTopicManager as any)
  await server.start()
  return server.getPort()
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/api-server.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Wire TopicManager in main.ts**

Find where `ApiServer` is instantiated in `src/main.ts` and pass `topicManager`. The TopicManager must be created **after** `await core.start()` (which calls `adapter.start()` → `ensureTopics()` that populates system topic IDs in config). Instantiate between `core.start()` and `api.start()`:

```typescript
import { TopicManager } from './core/topic-manager.js'

// After await core.start(), before api.start():
// Re-read config since ensureTopics() may have updated system topic IDs
const updatedConfig = core.configManager.get()
const telegramAdapter = core.adapters.get('telegram') ?? null
const telegramCfg = updatedConfig.channels?.telegram as any
const topicManager = new TopicManager(
  core.sessionManager,
  telegramAdapter,
  {
    notificationTopicId: telegramCfg?.notificationTopicId ?? null,
    assistantTopicId: telegramCfg?.assistantTopicId ?? null,
  },
)
// Pass topicManager to ApiServer constructor
```

- [ ] **Step 7: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/core/api-server.ts src/__tests__/api-server.test.ts src/main.ts
git commit -m "feat: add topic management API endpoints"
```

---

### Task 5: Add CLI api commands for topics

**Files:**
- Modify: `src/cli/commands.ts`

- [ ] **Step 1: Add `topics` subcommand to `cmdApi`**

In `src/cli/commands.ts`, inside the `cmdApi` function, add new branches after the `agents` handler (before the `else` at line 158):

```typescript
} else if (subCmd === 'topics') {
  const statusIdx = args.indexOf('--status')
  const statusParam = statusIdx !== -1 ? args[statusIdx + 1] : undefined
  const query = statusParam ? `?status=${encodeURIComponent(statusParam)}` : ''
  const res = await apiCall(port, `/api/topics${query}`)
  const data = await res.json() as { topics: Array<{ sessionId: string; topicId: number | null; name: string | null; status: string; agentName: string; lastActiveAt: string }> }
  if (data.topics.length === 0) {
    console.log('No topics found.')
  } else {
    console.log(`Topics: ${data.topics.length}\n`)
    for (const t of data.topics) {
      const name = t.name ? `  "${t.name}"` : ''
      const topic = t.topicId ? `Topic #${t.topicId}` : 'headless'
      console.log(`  ${t.sessionId}  ${t.agentName}  ${t.status}${name}      ${topic}`)
    }
  }

} else if (subCmd === 'delete-topic') {
  const sessionId = args[2]
  if (!sessionId) {
    console.error('Usage: viben api delete-topic <session-id> [--force]')
    process.exit(1)
  }
  const force = args.includes('--force')
  const query = force ? '?force=true' : ''
  const res = await apiCall(port, `/api/topics/${encodeURIComponent(sessionId)}${query}`, { method: 'DELETE' })
  const data = await res.json() as Record<string, unknown>
  if (res.status === 409) {
    console.error(`Session "${sessionId}" is active (${(data.session as any)?.status}). Use --force to delete.`)
    process.exit(1)
  }
  if (!res.ok) {
    console.error(`Error: ${data.error}`)
    process.exit(1)
  }
  const topicLabel = data.topicId ? `Topic #${data.topicId}` : 'headless session'
  console.log(`${topicLabel} deleted (session ${sessionId})`)

} else if (subCmd === 'cleanup') {
  const statusIdx = args.indexOf('--status')
  const statusParam = statusIdx !== -1 ? args[statusIdx + 1] : undefined
  const body: Record<string, unknown> = {}
  if (statusParam) body.statuses = statusParam.split(',')
  const res = await apiCall(port, '/api/topics/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json() as { deleted: string[]; failed: Array<{ sessionId: string; error: string }> }
  if (data.deleted.length === 0 && data.failed.length === 0) {
    console.log('Nothing to clean up.')
  } else {
    console.log(`Cleaned up ${data.deleted.length} topics${data.deleted.length ? ': ' + data.deleted.join(', ') : ''} (${data.failed.length} failed)`)
    for (const f of data.failed) {
      console.error(`  Failed: ${f.sessionId} — ${f.error}`)
    }
  }
```

- [ ] **Step 2: Update help text**

In `printHelp()`, add to the Runtime section:

```
  viben api topics [--status s1,s2]     List topics
  viben api delete-topic <id> [--force]  Delete a topic
  viben api cleanup [--status s1,s2]     Cleanup finished topics
```

And update the existing api usage in the else block to include the new commands.

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands.ts
git commit -m "feat: add CLI api commands for topic management"
```

---

### Task 6: Enhance assistant system prompt

**Files:**
- Modify: `src/adapters/telegram/assistant.ts`

- [ ] **Step 1: Update `buildAssistantSystemPrompt` signature and implementation**

Replace the current `buildAssistantSystemPrompt` function in `src/adapters/telegram/assistant.ts`:

```typescript
export interface AssistantContext {
  config: Config
  activeSessionCount: number
  totalSessionCount: number
  topicSummary: { status: string; count: number }[]
}

export function buildAssistantSystemPrompt(ctx: AssistantContext): string {
  const { config, activeSessionCount, totalSessionCount, topicSummary } = ctx
  const agentNames = Object.keys(config.agents).join(", ")
  const topicBreakdown = topicSummary.map(s => `${s.status}: ${s.count}`).join(', ') || 'none'

  return `You are the Viben Assistant. Help users manage their AI coding sessions and topics.

## Current State
- Active sessions: ${activeSessionCount} / ${totalSessionCount} total
- Topics by status: ${topicBreakdown}
- Available agents: ${agentNames}
- Default agent: ${config.defaultAgent}
- Workspace base: ${config.workspace.baseDir}

## Session Management Commands
These are Telegram bot commands (type directly in chat):
- /new [agent] [workspace] — Create new session
- /newchat — New chat with same agent & workspace
- /cancel — Cancel current session
- /status — Show status
- /agents — List agents
- /help — Show help

## Topic Management (via CLI)
You have access to bash. Use these commands to manage topics:

### List topics
\`\`\`bash
viben api topics
viben api topics --status finished,error
\`\`\`

### Delete a specific topic
\`\`\`bash
viben api delete-topic <session-id>
viben api delete-topic <session-id> --force  # for active sessions
\`\`\`

### Cleanup multiple topics
\`\`\`bash
viben api cleanup
viben api cleanup --status finished,error
\`\`\`

## Guidelines
- When a user asks about sessions or topics, run \`viben api topics\` to get current data.
- When deleting: if the session is active/initializing, warn the user first. Only use --force if they confirm.
- Format responses nicely for Telegram (use bold, code blocks).
- Be concise and helpful. Respond in the same language the user uses.
- When creating sessions, guide through: agent selection → workspace → confirm.`
}
```

- [ ] **Step 2: Update `spawnAssistant` to build context**

Update the import and the `spawnAssistant` function to build `AssistantContext`:

```typescript
export async function spawnAssistant(
  core: VibenCore,
  adapter: ChannelAdapter,
  assistantTopicId: number,
): Promise<SpawnAssistantResult> {
  const config = core.configManager.get();

  log.info({ agent: config.defaultAgent }, "Creating assistant session...");
  const session = await core.sessionManager.createSession(
    "telegram",
    config.defaultAgent,
    core.configManager.resolveWorkspace(),
    core.agentManager,
  );
  session.threadId = String(assistantTopicId);
  session.name = "Assistant";
  log.info({ sessionId: session.id }, "Assistant agent spawned");

  core.wireSessionEvents(session, adapter);

  // Build dynamic context for system prompt
  const allRecords = core.sessionManager.listRecords();
  const activeCount = allRecords.filter(r => r.status === 'active' || r.status === 'initializing').length;
  const statusCounts = new Map<string, number>();
  for (const r of allRecords) {
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
  }
  const topicSummary = Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count }));

  const ctx: AssistantContext = {
    config,
    activeSessionCount: activeCount,
    totalSessionCount: allRecords.length,
    topicSummary,
  };

  const systemPrompt = buildAssistantSystemPrompt(ctx);
  const ready = session.enqueuePrompt(systemPrompt)
    .then(() => { log.info({ sessionId: session.id }, "Assistant system prompt completed"); })
    .catch((err) => { log.warn({ err }, "Assistant system prompt failed"); });

  return { session, ready };
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 4: Run all tests**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/telegram/assistant.ts
git commit -m "feat: enhance assistant with dynamic prompt and topic management commands"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 3: Final commit if needed**

If any fixes were needed, commit them.
