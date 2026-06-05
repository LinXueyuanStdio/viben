import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { SessionManager } from '../session-manager.js'
import { Session } from '../session.js'
import type { SessionStore } from '../session-store.js'
import { JsonFileSessionStore } from '../session-store.js'
import type { SessionRecord } from '../../types.js'
import { TypedEmitter } from '../../utils/typed-emitter.js'

function mockAgentInstance(sessionId = 'agent-sess-1') {
  const emitter = new TypedEmitter()
  return Object.assign(emitter, {
    sessionId,
    prompt: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onSessionUpdate: vi.fn(),
    onPermissionRequest: vi.fn(),
  }) as any
}

function createSession(overrides: Partial<{ id: string; channelId: string; threadId: string; agentName: string; agentSessionId: string }> = {}): Session {
  const session = new Session({
    id: overrides.id,
    channelId: overrides.channelId || 'telegram',
    agentName: overrides.agentName || 'claude',
    workingDirectory: '/workspace',
    agentInstance: mockAgentInstance(overrides.agentSessionId),
  })
  if (overrides.threadId) session.threadId = overrides.threadId
  if (overrides.agentSessionId) session.agentSessionId = overrides.agentSessionId
  return session
}

function mockStore(): SessionStore {
  const records = new Map<string, SessionRecord>()
  return {
    save: vi.fn(async (record: SessionRecord) => { records.set(record.sessionId, record) }),
    get: vi.fn((id: string) => records.get(id)),
    findByPlatform: vi.fn((channelId: string, pred: (p: any) => boolean) => {
      for (const r of records.values()) {
        if (r.channelId === channelId && pred(r.platform)) return r
      }
      return undefined
    }),
    findByAgentSessionId: vi.fn((agentSessionId: string) => {
      for (const r of records.values()) {
        if (r.agentSessionId === agentSessionId) return r
      }
      return undefined
    }),
    list: vi.fn((channelId?: string) => {
      const all = Array.from(records.values())
      if (channelId) return all.filter(r => r.channelId === channelId)
      return all
    }),
    remove: vi.fn(async (id: string) => { records.delete(id) }),
    flush: vi.fn(),
    findAssistant: vi.fn().mockReturnValue(undefined),
  } as unknown as SessionStore
}

describe('SessionManager', () => {
  let manager: SessionManager
  let store: SessionStore

  beforeEach(() => {
    store = mockStore()
    manager = new SessionManager(store)
  })

  describe('registerSession()', () => {
    it('adds session to in-memory map', () => {
      const session = createSession({ id: 'test-1' })
      manager.registerSession(session)
      expect(manager.getSession('test-1')).toBe(session)
    })

    it('overwrites existing session with same id', () => {
      const s1 = createSession({ id: 'test-1' })
      const s2 = createSession({ id: 'test-1' })
      manager.registerSession(s1)
      manager.registerSession(s2)
      expect(manager.getSession('test-1')).toBe(s2)
    })
  })

  describe('getSession()', () => {
    it('returns undefined for unknown id', () => {
      expect(manager.getSession('unknown')).toBeUndefined()
    })
  })

  describe('getSessionByThread()', () => {
    it('finds session by channelId and threadId', () => {
      const session = createSession({ channelId: 'telegram', threadId: '123' })
      manager.registerSession(session)

      const found = manager.getSessionByThread('telegram', '123')
      expect(found).toBe(session)
    })

    it('returns undefined when no match', () => {
      const session = createSession({ channelId: 'telegram', threadId: '123' })
      manager.registerSession(session)

      expect(manager.getSessionByThread('telegram', '999')).toBeUndefined()
      expect(manager.getSessionByThread('discord', '123')).toBeUndefined()
    })
  })

  describe('getSessionByAgentSessionId()', () => {
    it('finds session by agent session id', () => {
      const session = createSession({ agentSessionId: 'agent-abc' })
      manager.registerSession(session)

      const found = manager.getSessionByAgentSessionId('agent-abc')
      expect(found).toBe(session)
    })

    it('returns undefined for unknown agent session id', () => {
      expect(manager.getSessionByAgentSessionId('unknown')).toBeUndefined()
    })
  })

  describe('getRecordByAgentSessionId()', () => {
    it('delegates to store.findByAgentSessionId', () => {
      manager.getRecordByAgentSessionId('agent-123')
      expect(store.findByAgentSessionId).toHaveBeenCalledWith('agent-123')
    })
  })

  describe('getRecordByThread()', () => {
    it('delegates to store.findByPlatform with topicId predicate', () => {
      manager.getRecordByThread('telegram', '456')
      expect(store.findByPlatform).toHaveBeenCalledWith('telegram', expect.any(Function))
    })
  })

  describe('patchRecord()', () => {
    it('merges patch with existing record', async () => {
      const record: SessionRecord = {
        sessionId: 'sess-1',
        agentSessionId: 'agent-1',
        agentName: 'claude',
        workingDir: '/workspace',
        channelId: 'telegram',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        clientOverrides: {},
        platform: {},
      }
      await store.save(record)

      await manager.patchRecord('sess-1', { status: 'finished' })
      expect(store.save).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'sess-1',
        status: 'finished',
      }))
    })

    it('saves full record when no existing record but patch has sessionId', async () => {
      await manager.patchRecord('new-sess', {
        sessionId: 'new-sess',
        agentSessionId: 'agent-2',
        agentName: 'claude',
        workingDir: '/ws',
        channelId: 'tg',
        status: 'initializing',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        clientOverrides: {},
        platform: {},
      })
      expect(store.save).toHaveBeenCalled()
    })

    it('does nothing when no record exists and patch has no sessionId', async () => {
      const saveCalls = (store.save as any).mock.calls.length
      await manager.patchRecord('nonexistent', { status: 'active' })
      expect((store.save as any).mock.calls.length).toBe(saveCalls)
    })

    it('does nothing when no store', async () => {
      const noStoreManager = new SessionManager(null)
      // Should not throw
      await noStoreManager.patchRecord('any', { status: 'active' })
    })
  })

  describe('cancelSession()', () => {
    it('aborts prompt and marks session cancelled', async () => {
      const session = createSession({ id: 'sess-cancel' })
      session.activate()
      manager.registerSession(session)
      // Save record to store so patchRecord works
      await store.save({
        sessionId: 'sess-cancel',
        agentSessionId: 'a1',
        agentName: 'claude',
        workingDir: '/ws',
        channelId: 'tg',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        clientOverrides: {},
        platform: {},
      })

      await manager.cancelSession('sess-cancel')

      // No active turn context — agent.cancel is not called when cancelling an idle session
      expect(session.agentInstance.cancel).not.toHaveBeenCalled()
      expect(session.status).toBe('cancelled')
    })

    it('updates store record status to cancelled', async () => {
      const session = createSession({ id: 'sess-cancel-2' })
      session.activate()
      manager.registerSession(session)
      await store.save({
        sessionId: 'sess-cancel-2',
        agentSessionId: 'a2',
        agentName: 'claude',
        workingDir: '/ws',
        channelId: 'tg',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        clientOverrides: {},
        platform: {},
      })

      await manager.cancelSession('sess-cancel-2')

      expect(store.save).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'sess-cancel-2',
        status: 'cancelled',
      }))
    })

    it('handles unknown session gracefully', async () => {
      // Should not throw
      await manager.cancelSession('nonexistent')
    })

    it('removes cancelled session from in-memory map', async () => {
      const session = createSession({ id: 'sess-cancel-mem' })
      session.activate()
      manager.registerSession(session)

      expect(manager.listSessions()).toHaveLength(1)
      await manager.cancelSession('sess-cancel-mem')
      expect(manager.listSessions()).toHaveLength(0)
      expect(manager.getSession('sess-cancel-mem')).toBeUndefined()
    })

    it('completes cleanup even if abortPrompt throws', async () => {
      const session = createSession({ id: 'sess-dead-agent' })
      session.activate()
      session.agentInstance.cancel = vi.fn().mockRejectedValue(new Error('agent dead'))
      manager.registerSession(session)

      await manager.cancelSession('sess-dead-agent')

      expect(session.status).toBe('cancelled')
      expect(manager.getSession('sess-dead-agent')).toBeUndefined()
    })

    it('does not re-save if already cancelled', async () => {
      await store.save({
        sessionId: 'already-cancelled',
        agentSessionId: 'a3',
        agentName: 'claude',
        workingDir: '/ws',
        channelId: 'tg',
        status: 'cancelled',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        clientOverrides: {},
        platform: {},
      })
      const callCount = (store.save as any).mock.calls.length

      await manager.cancelSession('already-cancelled')

      // save was not called again since already cancelled
      expect((store.save as any).mock.calls.length).toBe(callCount)
    })
  })

  describe('listSessions()', () => {
    it('returns all sessions when no filter', () => {
      const s1 = createSession({ channelId: 'telegram' })
      const s2 = createSession({ channelId: 'discord' })
      manager.registerSession(s1)
      manager.registerSession(s2)

      expect(manager.listSessions()).toHaveLength(2)
    })

    it('filters by channelId', () => {
      const s1 = createSession({ channelId: 'telegram' })
      const s2 = createSession({ channelId: 'discord' })
      manager.registerSession(s1)
      manager.registerSession(s2)

      const result = manager.listSessions('telegram')
      expect(result).toHaveLength(1)
      expect(result[0].channelId).toBe('telegram')
    })

    it('returns empty array when no sessions', () => {
      expect(manager.listSessions()).toEqual([])
    })
  })

  describe('listRecords()', () => {
    it('returns all records from store', async () => {
      await store.save({
        sessionId: 'r1', agentSessionId: 'a1', agentName: 'claude',
        workingDir: '/ws', channelId: 'tg', status: 'active',
        createdAt: '', lastActiveAt: '', clientOverrides: {}, platform: {},
      })
      await store.save({
        sessionId: 'r2', agentSessionId: 'a2', agentName: 'claude',
        workingDir: '/ws', channelId: 'tg', status: 'finished',
        createdAt: '', lastActiveAt: '', clientOverrides: {}, platform: {},
      })

      expect(manager.listRecords()).toHaveLength(2)
    })

    it('filters by statuses', async () => {
      await store.save({
        sessionId: 'r1', agentSessionId: 'a1', agentName: 'claude',
        workingDir: '/ws', channelId: 'tg', status: 'active',
        createdAt: '', lastActiveAt: '', clientOverrides: {}, platform: {},
      })
      await store.save({
        sessionId: 'r2', agentSessionId: 'a2', agentName: 'claude',
        workingDir: '/ws', channelId: 'tg', status: 'finished',
        createdAt: '', lastActiveAt: '', clientOverrides: {}, platform: {},
      })

      const result = manager.listRecords({ statuses: ['active'] })
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('active')
    })

    it('returns empty when no store', () => {
      const noStoreManager = new SessionManager(null)
      expect(noStoreManager.listRecords()).toEqual([])
    })
  })

  describe('removeRecord()', () => {
    it('removes record from store', async () => {
      await store.save({
        sessionId: 'to-remove', agentSessionId: 'a1', agentName: 'claude',
        workingDir: '/ws', channelId: 'tg', status: 'finished',
        createdAt: '', lastActiveAt: '', clientOverrides: {}, platform: {},
      })

      await manager.removeRecord('to-remove')
      expect(store.remove).toHaveBeenCalledWith('to-remove')
    })

    it('does nothing when no store', async () => {
      const noStoreManager = new SessionManager(null)
      await noStoreManager.removeRecord('any') // should not throw
    })
  })

  describe('destroyAll()', () => {
    it('marks all sessions as finished and destroys them', async () => {
      const s1 = createSession({ id: 'ds-1' })
      const s2 = createSession({ id: 'ds-2' })
      manager.registerSession(s1)
      manager.registerSession(s2)

      // Save records
      await store.save({
        sessionId: 'ds-1', agentSessionId: 'a1', agentName: 'claude',
        workingDir: '/ws', channelId: 'tg', status: 'active',
        createdAt: '', lastActiveAt: '', clientOverrides: {}, platform: {},
      })
      await store.save({
        sessionId: 'ds-2', agentSessionId: 'a2', agentName: 'claude',
        workingDir: '/ws', channelId: 'tg', status: 'active',
        createdAt: '', lastActiveAt: '', clientOverrides: {}, platform: {},
      })

      await manager.destroyAll()

      expect(s1.agentInstance.destroy).toHaveBeenCalled()
      expect(s2.agentInstance.destroy).toHaveBeenCalled()
      expect(manager.listSessions()).toHaveLength(0)
    })

    it('works with no sessions registered', async () => {
      await manager.destroyAll() // should not throw
    })
  })

  describe('getSessionRecord()', () => {
    it('delegates to store.get', async () => {
      await store.save({
        sessionId: 'rec-1', agentSessionId: 'a1', agentName: 'claude',
        workingDir: '/ws', channelId: 'tg', status: 'active',
        createdAt: '', lastActiveAt: '', clientOverrides: {}, platform: {},
      })

      const record = manager.getSessionRecord('rec-1')
      expect(record?.sessionId).toBe('rec-1')
    })

    it('returns undefined when no store', () => {
      const noStoreManager = new SessionManager(null)
      expect(noStoreManager.getSessionRecord('any')).toBeUndefined()
    })
  })

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
      store.flush();
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
      store.flush();
      store.destroy();
      fs.unlinkSync(tmpPath);
    });
  });

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
})
