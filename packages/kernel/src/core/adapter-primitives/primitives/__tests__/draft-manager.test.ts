import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DraftManager, Draft } from '../draft-manager.js'

describe('Draft', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('buffers text and flushes at interval', async () => {
    const onFlush = vi.fn().mockResolvedValue('msg-1')
    const draft = new Draft('session-1', { flushInterval: 5000, maxLength: 4096, onFlush })

    draft.append('hello ')
    draft.append('world')

    expect(onFlush).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5000)
    expect(onFlush).toHaveBeenCalledWith('session-1', 'hello world', false)
  })

  it('returns messageId from first flush, then sends edits', async () => {
    const onFlush = vi.fn().mockResolvedValue('msg-1')
    const draft = new Draft('s1', { flushInterval: 5000, maxLength: 4096, onFlush })

    draft.append('first')
    await vi.advanceTimersByTimeAsync(5000)
    expect(onFlush).toHaveBeenCalledWith('s1', 'first', false)
    expect(draft.messageId).toBe('msg-1')

    draft.append(' more')
    await vi.advanceTimersByTimeAsync(5000)
    expect(onFlush).toHaveBeenCalledWith('s1', 'first more', true)
  })

  it('finalize flushes remaining text immediately', async () => {
    const onFlush = vi.fn().mockResolvedValue('msg-1')
    const draft = new Draft('s1', { flushInterval: 5000, maxLength: 4096, onFlush })

    draft.append('pending')
    await draft.finalize()
    expect(onFlush).toHaveBeenCalledWith('s1', 'pending', false)
  })

  it('isEmpty is true when buffer is empty', () => {
    const draft = new Draft('s1', { flushInterval: 5000, maxLength: 4096, onFlush: vi.fn() })
    expect(draft.isEmpty).toBe(true)
    draft.append('x')
    expect(draft.isEmpty).toBe(false)
  })

  it('destroy cleans up timers', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined)
    const draft = new Draft('s1', { flushInterval: 5000, maxLength: 4096, onFlush })
    draft.append('text')
    draft.destroy()
    await vi.advanceTimersByTimeAsync(10000)
    expect(onFlush).not.toHaveBeenCalled()
  })

  it('calls onError when flush fails', async () => {
    const onError = vi.fn()
    const onFlush = vi.fn().mockRejectedValue(new Error('fail'))
    const draft = new Draft('s1', { flushInterval: 5000, maxLength: 4096, onFlush, onError })

    draft.append('text')
    await vi.advanceTimersByTimeAsync(5000)
    expect(onError).toHaveBeenCalledWith('s1', expect.any(Error))
  })
})

describe('DraftManager', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('creates and retrieves drafts per session', () => {
    const onFlush = vi.fn().mockResolvedValue(undefined)
    const mgr = new DraftManager({ flushInterval: 5000, maxLength: 4096, onFlush })

    const d1 = mgr.getOrCreate('s1')
    const d2 = mgr.getOrCreate('s2')
    expect(d1).not.toBe(d2)
    expect(mgr.getOrCreate('s1')).toBe(d1)
  })

  it('finalize flushes specific session', async () => {
    const onFlush = vi.fn().mockResolvedValue('msg-1')
    const mgr = new DraftManager({ flushInterval: 5000, maxLength: 4096, onFlush })

    mgr.getOrCreate('s1').append('hello')
    await mgr.finalize('s1')
    expect(onFlush).toHaveBeenCalledWith('s1', 'hello', false)
  })

  it('destroyAll cleans up all sessions', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined)
    const mgr = new DraftManager({ flushInterval: 5000, maxLength: 4096, onFlush })

    mgr.getOrCreate('s1').append('a')
    mgr.getOrCreate('s2').append('b')
    mgr.destroyAll()

    await vi.advanceTimersByTimeAsync(10000)
    expect(onFlush).not.toHaveBeenCalled()
  })

  it('handles concurrent sessions independently', async () => {
    const flushed: string[] = []
    const onFlush = vi.fn(async (sid: string, text: string) => {
      flushed.push(`${sid}:${text}`)
      return `msg-${sid}`
    })
    const mgr = new DraftManager({ flushInterval: 5000, maxLength: 4096, onFlush })

    mgr.getOrCreate('s1').append('hello')
    mgr.getOrCreate('s2').append('world')

    await vi.advanceTimersByTimeAsync(5000)
    expect(flushed).toContain('s1:hello')
    expect(flushed).toContain('s2:world')
  })
})
