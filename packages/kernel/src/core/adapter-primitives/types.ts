/**
 * Accumulates text chunks from a streaming agent response and flushes
 * the buffered content to the platform as a single message.
 *
 * Implementations handle platform-specific message creation/editing
 * (e.g., Telegram message edits, SSE event writes).
 */
export interface ITextBuffer {
  /** Appends a partial text chunk to the internal buffer. */
  append(text: string): void;
  /** Flushes all buffered text to the platform (send or edit). */
  flush(): Promise<void>;
  /** Discards any buffered text and releases resources. */
  destroy(): void;
}

/**
 * Serializes async operations to respect platform rate limits and
 * maintain message ordering within a session.
 */
export interface ISendQueue<T = unknown> {
  /** Queues an async operation for sequential execution. */
  enqueue<R>(fn: () => Promise<R>): Promise<R>;
}
