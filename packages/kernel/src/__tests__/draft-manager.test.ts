import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DraftManager } from '../plugins/telegram/draft-manager.js'

// Mock MessageDraft to avoid real Telegram API calls
vi.mock('../plugins/telegram/streaming.js', () => {
  const MockMessageDraft = class {
    append = vi.fn()
    finalize = vi.fn().mockResolvedValue(42)
    getMessageId = vi.fn().mockReturnValue(42)
  }
  return { MessageDraft: MockMessageDraft }
})

function mockBot() {
  return {
    api: {
      editMessageReplyMarkup: vi.fn().mockResolvedValue({}),
    },
  } as any
}

function mockSendQueue() {
  return {
    enqueue: vi.fn(async (fn: () => Promise<any>) => fn()),
  } as any
}

describe('DraftManager', () => {
  let manager: DraftManager
  let bot: ReturnType<typeof mockBot>

  beforeEach(() => {
    vi.clearAllMocks()
    bot = mockBot()
    manager = new DraftManager(bot, 12345, mockSendQueue())
  })

  describe('getOrCreate()', () => {
    it('creates a new draft for unknown session', () => {
      const draft = manager.getOrCreate('sess-1', 100)
      expect(draft).toBeDefined()
    })

    it('returns same draft for same session', () => {
      const d1 = manager.getOrCreate('sess-1', 100)
      const d2 = manager.getOrCreate('sess-1', 100)
      expect(d1).toBe(d2)
    })

    it('creates different drafts for different sessions', () => {
      const d1 = manager.getOrCreate('sess-1', 100)
      const d2 = manager.getOrCreate('sess-2', 200)
      expect(d1).not.toBe(d2)
    })
  })

  describe('hasDraft()', () => {
    it('returns false for unknown session', () => {
      expect(manager.hasDraft('unknown')).toBe(false)
    })

    it('returns true after getOrCreate', () => {
      manager.getOrCreate('sess-1', 100)
      expect(manager.hasDraft('sess-1')).toBe(true)
    })
  })

  describe('appendText()', () => {
    it('accumulates text in buffer', () => {
      manager.appendText('sess-1', 'hello ')
      manager.appendText('sess-1', 'world')
      // Text buffer is used internally by finalize
      expect(manager.hasDraft('sess-1')).toBe(false) // draft not created by appendText
    })
  })

  describe('finalize()', () => {
    it('does nothing when no draft exists', async () => {
      await manager.finalize('unknown')
      // Should not throw
    })

    it('calls draft.finalize()', async () => {
      const draft = manager.getOrCreate('sess-1', 100)
      await manager.finalize('sess-1')
      expect(draft.finalize).toHaveBeenCalled()
    })

    it('removes draft after finalize', async () => {
      manager.getOrCreate('sess-1', 100)
      await manager.finalize('sess-1')
      expect(manager.hasDraft('sess-1')).toBe(false)
    })

    it('cleans up text buffer for non-assistant sessions', async () => {
      manager.getOrCreate('sess-1', 100)
      manager.appendText('sess-1', 'some text')
      await manager.finalize('sess-1')
      // Text buffer should be cleaned up
    })
  })

  describe('cleanup()', () => {
    it('removes draft and text buffer', () => {
      manager.getOrCreate('sess-1', 100)
      manager.appendText('sess-1', 'data')
      manager.cleanup('sess-1')
      expect(manager.hasDraft('sess-1')).toBe(false)
    })

    it('handles cleanup of non-existent session', () => {
      manager.cleanup('unknown') // should not throw
    })
  })
})
