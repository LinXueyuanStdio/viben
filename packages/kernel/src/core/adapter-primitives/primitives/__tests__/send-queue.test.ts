import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SendQueue } from '../send-queue.js'

describe('SendQueue', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('executes enqueued function', async () => {
    const queue = new SendQueue({ minInterval: 0 })
    const fn = vi.fn().mockResolvedValue('result')
    const promise = queue.enqueue(fn)
    await vi.advanceTimersByTimeAsync(0)
    expect(await promise).toBe('result')
  })

  it('enforces minimum interval between sends', async () => {
    const queue = new SendQueue({ minInterval: 3000 })
    const fn1 = vi.fn(async () => 1)
    const fn2 = vi.fn(async () => 2)

    const p1 = queue.enqueue(fn1)
    const p2 = queue.enqueue(fn2)

    await vi.advanceTimersByTimeAsync(0)
    expect(fn1).toHaveBeenCalledOnce()
    expect(fn2).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3000)
    expect(fn2).toHaveBeenCalledOnce()
    await p1; await p2
  })

  it('deduplicates text items with same key', async () => {
    const queue = new SendQueue({ minInterval: 3000 })
    const fn1 = vi.fn().mockResolvedValue('first')
    const fn2 = vi.fn().mockResolvedValue('second')

    const p1 = queue.enqueue(fn1, { type: 'text', key: 'session-1' })
    const p2 = queue.enqueue(fn2, { type: 'text', key: 'session-1' })

    await vi.advanceTimersByTimeAsync(0)
    expect(await p1).toBeUndefined()
    await vi.advanceTimersByTimeAsync(3000)
    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).toHaveBeenCalledOnce()
  })

  it('calls onRateLimited and drops text items', async () => {
    const onRateLimited = vi.fn()
    const queue = new SendQueue({ minInterval: 3000, onRateLimited })
    const textFn = vi.fn().mockResolvedValue('text')
    const otherFn = vi.fn().mockResolvedValue('other')

    queue.enqueue(otherFn, { type: 'other' })
    const textP = queue.enqueue(textFn, { type: 'text', key: 'k' })
    queue.onRateLimited()

    expect(await textP).toBeUndefined()
    expect(onRateLimited).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(0)
    expect(otherFn).toHaveBeenCalled()
  })

  it('clear() drops all pending items', async () => {
    const queue = new SendQueue({ minInterval: 3000 })
    const fn = vi.fn().mockResolvedValue('x')
    const p = queue.enqueue(fn)
    queue.clear()
    expect(await p).toBeUndefined()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).not.toHaveBeenCalled()
  })

  it('reports pending count', () => {
    const queue = new SendQueue({ minInterval: 3000 })
    queue.enqueue(vi.fn().mockResolvedValue(1))
    queue.enqueue(vi.fn().mockResolvedValue(2))
    expect(queue.pending).toBe(2)
  })

  it('calls onError when function throws', async () => {
    const onError = vi.fn()
    const queue = new SendQueue({ minInterval: 0, onError })
    const p = queue.enqueue(vi.fn().mockRejectedValue(new Error('boom')))
    await vi.advanceTimersByTimeAsync(0)
    await expect(p).rejects.toThrow('boom')
  })

  it('supports per-category intervals', async () => {
    const queue = new SendQueue({
      minInterval: 1000,
      categoryIntervals: { 'chat.update': 500 },
    })
    const fn1 = vi.fn().mockResolvedValue(1)
    const fn2 = vi.fn().mockResolvedValue(2)

    queue.enqueue(fn1, { category: 'chat.update' })
    queue.enqueue(fn2, { category: 'chat.update' })

    await vi.advanceTimersByTimeAsync(0)
    expect(fn1).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(500)
    expect(fn2).toHaveBeenCalledOnce()
  })
})
