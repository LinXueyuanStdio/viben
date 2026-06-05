import type { Attachment, TurnMeta } from '../types.js'
import type { TurnRouting } from './turn-context.js'

/**
 * Serial prompt queue — ensures prompts are processed one at a time.
 *
 * Agents are stateful (each prompt builds on prior context), so concurrent
 * prompts would corrupt the conversation. This queue guarantees that only
 * one prompt is processed at a time; additional prompts are buffered and
 * drained sequentially after the current one completes.
 */
export class PromptQueue {
  private queue: Array<{ text: string; userPrompt: string; attachments?: Attachment[]; routing?: TurnRouting; turnId?: string; meta?: TurnMeta; resolve: () => void }> = []
  private processing = false
  private abortController: AbortController | null = null
  /** Set when abort is triggered; drainNext waits for the current processor to settle before starting the next item. */
  private processorSettled: Promise<void> | null = null

  constructor(
    private processor: (text: string, userPrompt: string, attachments?: Attachment[], routing?: TurnRouting, turnId?: string, meta?: TurnMeta) => Promise<void>,
    private onError?: (err: unknown) => void,
    // Fires synchronously when an item is placed behind a running prompt — before it's pushed
    // to the pending list. Called with accurate queue depth so callers can emit notifications
    // without a race condition on promptRunning state.
    private onActuallyQueued?: (turnId: string | undefined, position: number, routing: TurnRouting | undefined) => void,
  ) {}

  /**
   * Add a prompt to the queue. If no prompt is currently processing, it runs
   * immediately. Otherwise, it's buffered and the returned promise resolves
   * only after the prompt finishes processing.
   */
  async enqueue(text: string, userPrompt: string, attachments?: Attachment[], routing?: TurnRouting, turnId?: string, meta?: TurnMeta): Promise<void> {
    if (this.processing) {
      // Fire synchronously BEFORE pushing so the caller sees accurate position and promptRunning state.
      // This eliminates the race condition where multiple concurrent enqueue() calls all observe
      // processing=false before any of them sets it to true.
      const position = this.queue.length + 1;
      this.onActuallyQueued?.(turnId, position, routing);
      return new Promise<void>((resolve) => {
        this.queue.push({ text, userPrompt, attachments, routing, turnId, meta, resolve })
      })
    }
    await this.process(text, userPrompt, attachments, routing, turnId, meta)
  }

  /** Run a single prompt through the processor, then drain the next queued item. */
  private async process(text: string, userPrompt: string, attachments?: Attachment[], routing?: TurnRouting, turnId?: string, meta?: TurnMeta): Promise<void> {
    this.processing = true
    this.abortController = new AbortController()
    const { signal } = this.abortController
    let settledResolve: () => void
    this.processorSettled = new Promise<void>((r) => { settledResolve = r })
    try {
      await Promise.race([
        this.processor(text, userPrompt, attachments, routing, turnId, meta),
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Prompt aborted')), { once: true })
        }),
      ])
    } catch (err) {
      // Only forward non-abort errors to onError handler
      if (!(err instanceof Error && err.message === 'Prompt aborted')) {
        this.onError?.(err)
      }
    } finally {
      this.abortController = null
      this.processing = false
      settledResolve!()
      this.processorSettled = null
      this.drainNext()
    }
  }

  /** Dequeue and process the next pending prompt, if any. Called after each prompt completes. */
  private drainNext(): void {
    const next = this.queue.shift()
    if (next) {
      this.process(next.text, next.userPrompt, next.attachments, next.routing, next.turnId, next.meta).then(next.resolve)
    }
  }

  /**
   * Abort only the in-flight prompt, keeping queued prompts intact.
   * The queue will automatically drain to the next item via `drainNext()`
   * in the `process()` finally block.
   */
  abortCurrent(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
  }

  /**
   * Abort the in-flight prompt and discard all queued prompts.
   * Pending promises are resolved (not rejected) so callers don't see unhandled rejections.
   */
  clear(): void {
    this.abortCurrent()
    // Resolve pending promises so callers don't hang
    for (const item of this.queue) {
      item.resolve()
    }
    this.queue = []
  }

  /**
   * Discard all queued prompts without aborting the in-flight prompt.
   * The currently processing prompt continues to completion; only pending
   * (not-yet-started) items are removed. Their promises are resolved
   * (not rejected) so callers don't see unhandled rejections.
   */
  clearPending(): void {
    for (const item of this.queue) {
      item.resolve()
    }
    this.queue = []
  }

  /**
   * Promote a specific queued item to the front and discard all others.
   *
   * Finds the item with the matching turnId, removes every other pending item
   * (resolving their promises), and leaves only the target in the queue.
   * Does NOT abort the in-flight prompt — caller handles that separately.
   *
   * @returns true if the item was found and promoted, false if not in queue
   */
  prioritize(turnId: string): boolean {
    const idx = this.queue.findIndex(item => item.turnId === turnId)
    if (idx === -1) return false
    const target = this.queue[idx]
    for (let i = 0; i < this.queue.length; i++) {
      if (i !== idx) this.queue[i].resolve()
    }
    this.queue = [target]
    return true
  }

  get pending(): number {
    return this.queue.length
  }

  get isProcessing(): boolean {
    return this.processing
  }

  /** Snapshot of queued (not yet processing) items — used for queue inspection by callers. */
  get pendingItems(): Array<{ userPrompt: string; turnId?: string }> {
    return this.queue.map(item => ({
      userPrompt: item.userPrompt,
      turnId: item.turnId,
    }))
  }
}
