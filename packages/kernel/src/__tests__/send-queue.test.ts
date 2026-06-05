import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SendQueue } from '../core/adapter-primitives/primitives/send-queue.js'

describe('SendQueue', () => {
  let queue: SendQueue

  beforeEach(() => {
    vi.useFakeTimers()
    queue = new SendQueue({ minInterval: 100 }) // 100ms for fast tests
  })

  it('executes items in FIFO order', async () => {
    const order: number[] = []
    const p1 = queue.enqueue(async () => { order.push(1); return 'a' })
    const p2 = queue.enqueue(async () => { order.push(2); return 'b' })
    const p3 = queue.enqueue(async () => { order.push(3); return 'c' })
    await vi.advanceTimersByTimeAsync(500)
    expect(await p1).toBe('a')
    expect(await p2).toBe('b')
    expect(await p3).toBe('c')
    expect(order).toEqual([1, 2, 3])
  })

  it('enforces minimum interval between executions', async () => {
    const timestamps: number[] = []
    queue.enqueue(async () => { timestamps.push(Date.now()) })
    queue.enqueue(async () => { timestamps.push(Date.now()) })
    queue.enqueue(async () => { timestamps.push(Date.now()) })
    await vi.advanceTimersByTimeAsync(500)
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i] - timestamps[i - 1]).toBeGreaterThanOrEqual(100)
    }
  })

  it('coalesces text items with same key', async () => {
    const calls: string[] = []
    queue.enqueue(async () => { calls.push('other-1') }, { type: 'other' })
    const p1 = queue.enqueue(async () => { calls.push('text-v1'); return 'v1' }, { type: 'text', key: 's1' })
    const p2 = queue.enqueue(async () => { calls.push('text-v2'); return 'v2' }, { type: 'text', key: 's1' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(await p1).toBeUndefined()
    expect(await p2).toBe('v2')
    expect(calls).toEqual(['other-1', 'text-v2'])
  })

  it('does not coalesce text items with different keys', async () => {
    const calls: string[] = []
    const p1 = queue.enqueue(async () => { calls.push('s1'); return 'a' }, { type: 'text', key: 's1' })
    const p2 = queue.enqueue(async () => { calls.push('s2'); return 'b' }, { type: 'text', key: 's2' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(await p1).toBe('a')
    expect(await p2).toBe('b')
    expect(calls).toEqual(['s1', 's2'])
  })

  it('never coalesces other items', async () => {
    const calls: string[] = []
    queue.enqueue(async () => { calls.push('a') }, { type: 'other' })
    queue.enqueue(async () => { calls.push('b') }, { type: 'other' })
    queue.enqueue(async () => { calls.push('c') }, { type: 'other' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toEqual(['a', 'b', 'c'])
  })

  it('onRateLimited drops all pending text items', async () => {
    const calls: string[] = []
    // First item executes immediately (lastExec is 0), rest are queued
    queue.enqueue(async () => { calls.push('other-1') }, { type: 'other' })
    const pText1 = queue.enqueue(async () => { calls.push('text-1'); return 't1' }, { type: 'text', key: 's1' })
    queue.enqueue(async () => { calls.push('other-2') }, { type: 'other' })
    const pText2 = queue.enqueue(async () => { calls.push('text-2'); return 't2' }, { type: 'text', key: 's2' })
    // Let the first item execute but not the rest
    await vi.advanceTimersByTimeAsync(1)
    // Now drop all pending text items
    queue.onRateLimited()
    await vi.advanceTimersByTimeAsync(1000)
    expect(await pText1).toBeUndefined()
    expect(await pText2).toBeUndefined()
    expect(calls).toContain('other-1')
    expect(calls).toContain('other-2')
    expect(calls).not.toContain('text-1')
    expect(calls).not.toContain('text-2')
  })

  it('propagates errors from fn to caller', async () => {
    const p = queue.enqueue(async () => { throw new Error('boom') })
    // Attach rejection handler before advancing timers to avoid unhandled rejection
    const resultP = p.catch((err: Error) => err)
    await vi.advanceTimersByTimeAsync(200)
    const err = await resultP
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('boom')
  })

  it('onRateLimited does not affect currently executing item', async () => {
    let resolveFirst!: (v: string) => void
    const p1 = queue.enqueue(
      () => new Promise<string>(r => { resolveFirst = r }),
      { type: 'text', key: 's1' },
    )
    const p2 = queue.enqueue(async () => 'second', { type: 'text', key: 's2' })
    await vi.advanceTimersByTimeAsync(100)
    queue.onRateLimited()
    expect(await p2).toBeUndefined()
    resolveFirst('first')
    await vi.advanceTimersByTimeAsync(100)
    expect(await p1).toBe('first')
  })
})
