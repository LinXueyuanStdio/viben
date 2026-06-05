/**
 * Item type determines deduplication behavior:
 * - `"text"` items with the same key replace each other (only latest is sent)
 * - `"other"` items are always queued individually
 */
export type QueueItemType = 'text' | 'other'

/** Configuration for the SendQueue rate limiter. */
export interface SendQueueConfig {
  /** Minimum interval (ms) between consecutive operations. */
  minInterval: number
  /** Per-category interval overrides (e.g., separate limits for edits vs. sends). */
  categoryIntervals?: Record<string, number>
  onRateLimited?: () => void
  onError?: (error: Error) => void
}

/** Options for enqueuing an operation. */
export interface EnqueueOptions {
  type?: QueueItemType
  /** Deduplication key — text items with the same key replace earlier ones. */
  key?: string
  /** Category for per-category rate limiting. */
  category?: string
}

interface QueueItem<T = unknown> {
  fn: () => Promise<T>
  type: QueueItemType
  key?: string
  category?: string
  resolve: (value: T | undefined) => void
  reject: (err: unknown) => void
  promise: Promise<T | undefined>
}

/**
 * Serializes outbound platform API calls to respect rate limits and maintain ordering.
 *
 * Key behaviors:
 * - Enforces a minimum interval between consecutive operations
 * - Supports per-category intervals (e.g., different limits for message edits vs. sends)
 * - Deduplicates text-type items with the same key (only the latest update is sent)
 * - On rate limit, drops all pending text items to reduce backlog
 */
export class SendQueue {
  private items: QueueItem[] = []
  private processing = false
  private lastExec = 0
  private lastCategoryExec = new Map<string, number>()

  constructor(private config: SendQueueConfig) {}

  get pending(): number {
    return this.items.length
  }

  /**
   * Queues an async operation for rate-limited execution.
   *
   * For text-type items with a key, replaces any existing queued item with
   * the same key (deduplication). This is used for streaming draft updates
   * where only the latest content matters.
   */
  enqueue<T>(
    fn: () => Promise<T>,
    opts?: EnqueueOptions,
  ): Promise<T | undefined> {
    const type = opts?.type ?? 'other'
    const key = opts?.key
    const category = opts?.category

    let resolve!: (value: T | undefined) => void
    let reject!: (err: unknown) => void
    const promise = new Promise<T | undefined>((res, rej) => {
      resolve = res
      reject = rej
    })
    // Suppress unhandled rejection — callers are expected to handle via .catch or await
    promise.catch(() => {})

    // Deduplication: replace an existing text item with the same key
    if (type === 'text' && key) {
      const idx = this.items.findIndex(
        (item) => item.type === 'text' && item.key === key,
      )
      if (idx !== -1) {
        this.items[idx].resolve(undefined)
        this.items[idx] = { fn, type, key, category, resolve, reject, promise } as QueueItem
        this.scheduleProcess()
        return promise
      }
    }

    this.items.push({ fn, type, key, category, resolve, reject, promise } as QueueItem)
    this.scheduleProcess()
    return promise
  }

  /**
   * Called when a platform rate limit is hit. Drops all pending text items
   * (draft updates) to reduce backlog, keeping only non-text items that
   * represent important operations (e.g., permission requests).
   */
  onRateLimited(): void {
    this.config.onRateLimited?.()
    const remaining: QueueItem[] = []
    for (const item of this.items) {
      if (item.type === 'text') {
        item.resolve(undefined)
      } else {
        remaining.push(item)
      }
    }
    this.items = remaining
  }

  clear(): void {
    for (const item of this.items) {
      item.resolve(undefined)
    }
    this.items = []
  }

  /**
   * Schedules the next item for processing after the rate-limit delay.
   * Uses per-category timing when available, falling back to the global minInterval.
   */
  private scheduleProcess(): void {
    if (this.processing) return
    if (this.items.length === 0) return

    const item = this.items[0]
    const interval = this.getInterval(item.category)
    const lastExec = item.category
      ? this.lastCategoryExec.get(item.category) ?? 0
      : this.lastExec
    const elapsed = Date.now() - lastExec
    const delay = Math.max(0, interval - elapsed)

    this.processing = true
    setTimeout(() => void this.processNext(), delay)
  }

  private getInterval(category?: string): number {
    if (category && this.config.categoryIntervals?.[category] != null) {
      return this.config.categoryIntervals[category]
    }
    return this.config.minInterval
  }

  private async processNext(): Promise<void> {
    const item = this.items.shift()
    if (!item) {
      this.processing = false
      return
    }

    try {
      const result = await item.fn()
      item.resolve(result)
    } catch (err) {
      // Suppress "message is not modified" errors — harmless duplicate edits
      if (err instanceof Error && 'description' in err &&
          typeof (err as Record<string, unknown>).description === 'string' &&
          ((err as Record<string, unknown>).description as string).includes('message is not modified')) {
        item.resolve(undefined)
      } else {
        this.config.onError?.(err instanceof Error ? err : new Error(String(err)))
        item.reject(err)
      }
    } finally {
      const now = Date.now()
      this.lastExec = now
      if (item.category) {
        this.lastCategoryExec.set(item.category, now)
      }
      this.processing = false
      this.scheduleProcess()
    }
  }
}
