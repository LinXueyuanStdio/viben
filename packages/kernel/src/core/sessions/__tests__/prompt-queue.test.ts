import { describe, it, expect, vi } from 'vitest'
import { PromptQueue } from '../prompt-queue.js'

describe('PromptQueue', () => {
  it('processes a single prompt immediately', async () => {
    const processor = vi.fn().mockResolvedValue(undefined)
    const queue = new PromptQueue(processor)

    await queue.enqueue('hello')

    expect(processor).toHaveBeenCalledWith('hello', undefined, undefined, undefined, undefined, undefined)
    expect(queue.pending).toBe(0)
    expect(queue.isProcessing).toBe(false)
  })

  it('processes prompts serially, not concurrently', async () => {
    const callOrder: string[] = []
    let resolveFirst!: () => void
    const firstPromise = new Promise<void>((r) => { resolveFirst = r })

    const processor = vi.fn().mockImplementation(async (text: string) => {
      callOrder.push(`start:${text}`)
      if (text === 'first') await firstPromise
      callOrder.push(`end:${text}`)
    })

    const queue = new PromptQueue(processor)

    const p1 = queue.enqueue('first')
    const p2 = queue.enqueue('second')
    const p3 = queue.enqueue('third')

    // second and third should be queued
    expect(queue.pending).toBe(2)

    resolveFirst()
    await Promise.all([p1, p2, p3])

    expect(callOrder).toEqual([
      'start:first', 'end:first',
      'start:second', 'end:second',
      'start:third', 'end:third',
    ])
  })

  it('enqueue while processing → queued, not dropped', async () => {
    let resolveFirst!: () => void
    const firstPromise = new Promise<void>((r) => { resolveFirst = r })
    const calls: string[] = []

    const processor = vi.fn().mockImplementation(async (text: string) => {
      calls.push(text)
      if (text === 'first') await firstPromise
    })

    const queue = new PromptQueue(processor)

    const p1 = queue.enqueue('first')
    queue.enqueue('second')

    expect(queue.isProcessing).toBe(true)
    expect(queue.pending).toBe(1)

    resolveFirst()
    await p1

    // Wait for second to process
    await vi.waitFor(() => expect(calls).toEqual(['first', 'second']))
  })

  it('clear() removes all pending, does not cancel active', async () => {
    let resolveFirst!: () => void
    const firstPromise = new Promise<void>((r) => { resolveFirst = r })
    const calls: string[] = []

    const processor = vi.fn().mockImplementation(async (text: string) => {
      calls.push(text)
      if (text === 'first') await firstPromise
    })

    const queue = new PromptQueue(processor)
    queue.enqueue('first')
    queue.enqueue('second')
    queue.enqueue('third')

    expect(queue.pending).toBe(2)
    queue.clear()
    expect(queue.pending).toBe(0)

    resolveFirst()
    // Wait for processing to finish
    await vi.waitFor(() => expect(queue.isProcessing).toBe(false))

    // Only first was processed (second/third were cleared)
    expect(calls).toEqual(['first'])
  })

  it('handles processor errors without breaking the queue', async () => {
    const calls: string[] = []
    const onError = vi.fn()
    const processor = vi.fn().mockImplementation(async (text: string) => {
      calls.push(text)
      if (text === 'fail') throw new Error('boom')
    })

    const queue = new PromptQueue(processor, onError)
    await queue.enqueue('fail')
    await queue.enqueue('after-fail')

    expect(calls).toEqual(['fail', 'after-fail'])
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('carries userPrompt distinctly from text (finalPrompt) to the processor', async () => {
    let capturedText: string | undefined
    let capturedUserPrompt: string | undefined

    const processor = vi.fn().mockImplementation(async (text: string, userPrompt: string) => {
      capturedText = text
      capturedUserPrompt = userPrompt
    })

    const queue = new PromptQueue(processor)
    await queue.enqueue('final-prompt', 'original-user-prompt')

    expect(capturedText).toBe('final-prompt')
    expect(capturedUserPrompt).toBe('original-user-prompt')
    // Ensure they are distinct values, not aliased
    expect(capturedText).not.toBe(capturedUserPrompt)
  })

  it('clearPending discards queued items without aborting current', async () => {
    let resolveFirst!: () => void
    const firstPromise = new Promise<void>((r) => { resolveFirst = r })
    const calls: string[] = []

    const processor = vi.fn().mockImplementation(async (text: string) => {
      calls.push(text)
      if (text === 'first') await firstPromise
    })

    const queue = new PromptQueue(processor)

    const p1 = queue.enqueue('first')
    const p2 = queue.enqueue('second')
    const p3 = queue.enqueue('third')

    expect(queue.pending).toBe(2)

    // Clear pending — should discard second and third, but NOT abort first
    queue.clearPending()
    expect(queue.pending).toBe(0)
    expect(queue.isProcessing).toBe(true)

    // Resolve first — should complete without processing second/third
    resolveFirst()
    await p1
    // p2 and p3 should also resolve (not hang)
    await p2
    await p3

    expect(calls).toEqual(['first'])
    expect(queue.isProcessing).toBe(false)
  })

  it('abort + clear prevents offset responses', async () => {
    let resolveFirst!: () => void
    const firstPromise = new Promise<void>((r) => { resolveFirst = r })
    const calls: string[] = []

    const processor = vi.fn().mockImplementation(async (text: string) => {
      calls.push(text)
      if (text === 'stuck') await firstPromise
    })

    const queue = new PromptQueue(processor)

    // Simulate: stuck prompt + queued messages
    queue.enqueue('stuck')
    queue.enqueue('queued-1')
    queue.enqueue('queued-2')

    expect(queue.pending).toBe(2)
    expect(queue.isProcessing).toBe(true)

    // User does /flush: clear everything
    queue.clear()
    expect(queue.pending).toBe(0)

    // Resolve the stuck prompt (simulates agent responding to cancel)
    resolveFirst()
    await new Promise(r => setTimeout(r, 10))

    expect(queue.isProcessing).toBe(false)

    // User sends fresh message — should process immediately, no offset
    const freshPromise = queue.enqueue('fresh')
    await freshPromise

    expect(calls).toEqual(['stuck', 'fresh'])
  })

  it('prioritize promotes target item and discards others', async () => {
    let resolveFirst!: () => void
    const firstPromise = new Promise<void>((r) => { resolveFirst = r })
    const calls: string[] = []

    const processor = vi.fn().mockImplementation(async (text: string) => {
      calls.push(text)
      if (text === 'first') await firstPromise
    })

    const queue = new PromptQueue(processor)

    queue.enqueue('first')
    queue.enqueue('second', 'second', undefined, undefined, 'turn-2')
    queue.enqueue('third', 'third', undefined, undefined, 'turn-3')
    queue.enqueue('fourth', 'fourth', undefined, undefined, 'turn-4')

    expect(queue.pending).toBe(3)

    const found = queue.prioritize('turn-4')
    expect(found).toBe(true)
    expect(queue.pending).toBe(1)

    resolveFirst()
    await new Promise(r => setTimeout(r, 10))

    await vi.waitFor(() => expect(queue.isProcessing).toBe(false))

    expect(calls).toEqual(['first', 'fourth'])
  })

  it('prioritize returns false if turnId not found', () => {
    const processor = vi.fn().mockResolvedValue(undefined)
    const queue = new PromptQueue(processor)
    expect(queue.prioritize('nonexistent')).toBe(false)
  })

  it('pendingItems returns userPrompt (not text) for queued items', async () => {
    let resolveFirst!: () => void
    const firstPromise = new Promise<void>((r) => { resolveFirst = r })

    const processor = vi.fn().mockImplementation(async (text: string) => {
      // Block the first item so the second stays queued
      if (text === 'text-1') await firstPromise
    })

    const queue = new PromptQueue(processor)

    // First item starts processing immediately
    queue.enqueue('text-1', 'user-prompt-1')
    // Second item is queued with distinct text and userPrompt
    queue.enqueue('text-2', 'user-prompt-2')

    expect(queue.pending).toBe(1)

    // pendingItems should expose userPrompt, not text
    expect(queue.pendingItems).toEqual([{ userPrompt: 'user-prompt-2', turnId: undefined }])

    resolveFirst()
    await vi.waitFor(() => expect(queue.isProcessing).toBe(false))
  })
})
