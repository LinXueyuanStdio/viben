/** Configuration for draft message flushing behavior. */
export interface DraftConfig {
  /** How often (ms) to flush buffered text to the platform. */
  flushInterval: number
  maxLength: number
  /**
   * Called to send or update a message on the platform.
   * Returns the platform message ID on first send (isEdit=false);
   * subsequent calls are edits (isEdit=true).
   */
  onFlush: (sessionId: string, text: string, isEdit: boolean) => Promise<string | undefined>
  onError?: (sessionId: string, error: Error) => void
}

/**
 * Manages a single in-progress (draft) message for streaming text output.
 *
 * As text chunks arrive from the agent, they are appended to an internal buffer.
 * The buffer is flushed to the platform on a timer. The first flush creates the
 * message; subsequent flushes edit it in place. This avoids sending many small
 * messages and instead shows a live-updating message.
 */
export class Draft {
  private buffer = ''
  private _messageId?: string
  /** Guards against concurrent first-flush — ensures only one sendMessage creates the draft. */
  private firstFlushPending = false
  private flushTimer?: ReturnType<typeof setTimeout>
  private flushPromise: Promise<void> = Promise.resolve()

  constructor(
    private sessionId: string,
    private config: DraftConfig,
  ) {}

  get isEmpty(): boolean { return !this.buffer }
  /** Platform message ID, set after the first successful flush. */
  get messageId(): string | undefined { return this._messageId }

  /** Appends streaming text to the buffer and schedules a flush. */
  append(text: string): void {
    if (!text) return
    this.buffer += text
    this.scheduleFlush()
  }

  /**
   * Flushes any remaining buffered text and returns the platform message ID.
   * Called when the streaming response completes.
   */
  async finalize(): Promise<string | undefined> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }
    await this.flushPromise
    if (this.buffer) {
      await this.flush()
    }
    return this._messageId
  }

  /** Discards buffered text and cancels any pending flush. */
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }
    this.buffer = ''
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      this.flushPromise = this.flushPromise
        .then(() => this.flush())
        .catch(() => {})
    }, this.config.flushInterval)
  }

  private async flush(): Promise<void> {
    if (!this.buffer || this.firstFlushPending) return

    // Snapshot the buffer before awaiting — append() can be called
    // concurrently during the async flush operation.
    const snapshot = this.buffer
    const isEdit = !!this._messageId

    if (!this._messageId) {
      this.firstFlushPending = true
    }

    try {
      const result = await this.config.onFlush(this.sessionId, snapshot, isEdit)
      if (!isEdit && result) {
        this._messageId = result
      }
    } catch (err) {
      this.config.onError?.(this.sessionId, err instanceof Error ? err : new Error(String(err)))
    } finally {
      this.firstFlushPending = false
    }

    // Re-flush if buffer changed during the async operation
    if (this.buffer !== snapshot) {
      return this.flush()
    }
  }
}

/**
 * Manages draft messages across multiple sessions.
 *
 * Each session gets at most one active draft. When a session's streaming
 * response completes, the draft is finalized (final flush + cleanup).
 */
export class DraftManager {
  private drafts = new Map<string, Draft>()

  constructor(private config: DraftConfig) {}

  /** Returns the existing draft for a session, or creates a new one. */
  getOrCreate(sessionId: string): Draft {
    let draft = this.drafts.get(sessionId)
    if (!draft) {
      draft = new Draft(sessionId, this.config)
      this.drafts.set(sessionId, draft)
    }
    return draft
  }

  /** Finalizes and removes the draft for a session. */
  async finalize(sessionId: string): Promise<void> {
    const draft = this.drafts.get(sessionId)
    if (!draft) return
    await draft.finalize()
    this.drafts.delete(sessionId)
  }

  /** Finalizes all active drafts (e.g., during adapter shutdown). */
  async finalizeAll(): Promise<void> {
    await Promise.all([...this.drafts.values()].map(d => d.finalize()))
  }

  /** Destroys a draft without flushing (e.g., on session error). */
  destroy(sessionId: string): void {
    const draft = this.drafts.get(sessionId)
    if (draft) {
      draft.destroy()
      this.drafts.delete(sessionId)
    }
  }

  /** Destroys all drafts without flushing. */
  destroyAll(): void {
    for (const draft of this.drafts.values()) {
      draft.destroy()
    }
    this.drafts.clear()
  }
}
