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
    const { TopicManager } = await import('../plugins/telegram/topic-manager.js')
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
})
