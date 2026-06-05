/** A single buffered SSE event with its ID and serialized wire data. */
export interface BufferedEvent {
  id: string;
  data: unknown;
}

/**
 * Per-session ring buffer of recent SSE events, used to replay missed events on reconnect.
 *
 * SSE clients that drop and reconnect send the `Last-Event-ID` header with the ID of
 * the last event they received. The buffer uses this ID to find the resume point and
 * replay everything after it — bridging the gap without re-running any agent logic.
 *
 * Eviction strategy: when the buffer exceeds `maxSize`, the oldest event is dropped
 * (FIFO). This means very long disconnections may cause gaps; the route handler signals
 * this to the client with an `EVENTS_EXPIRED` error event so it can recover gracefully.
 */
export class EventBuffer {
  private buffers = new Map<string, BufferedEvent[]>();

  /**
   * @param maxSize Maximum events retained per session. Older events are evicted when
   *   this limit is exceeded. Defaults to 100.
   */
  constructor(private maxSize: number = 100) {}

  /** Append an event to the session's buffer, evicting the oldest entry if at capacity. */
  push(sessionId: string, event: BufferedEvent): void {
    let buffer = this.buffers.get(sessionId);
    if (!buffer) {
      buffer = [];
      this.buffers.set(sessionId, buffer);
    }
    buffer.push(event);
    // Drop oldest events once the ring is full to bound memory per session
    while (buffer.length > this.maxSize) {
      buffer.shift();
    }
  }

  /**
   * Returns events that occurred after `lastEventId`.
   *
   * - If `lastEventId` is `undefined`, returns all buffered events (fresh connection).
   * - If `lastEventId` is not found in the buffer, returns `null` — the event has been
   *   evicted and the client must be informed that a gap may exist.
   * - Otherwise returns the slice after the matching event.
   */
  getSince(sessionId: string, lastEventId: string | undefined): BufferedEvent[] | null {
    const buffer = this.buffers.get(sessionId);
    if (!buffer || buffer.length === 0) return [];
    if (lastEventId === undefined) return [...buffer];
    const index = buffer.findIndex((e) => e.id === lastEventId);
    if (index === -1) return null;
    return buffer.slice(index + 1);
  }

  /** Remove the buffer for a session — called when the session ends to free memory. */
  cleanup(sessionId: string): void {
    this.buffers.delete(sessionId);
  }
}
