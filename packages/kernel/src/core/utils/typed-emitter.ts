/**
 * Type-safe event emitter where the event map is enforced at compile time.
 *
 * Unlike Node's EventEmitter, event names and listener signatures are
 * validated by TypeScript — no stringly-typed events. Supports pause/resume
 * with buffering, used by Session and EventBus to defer events during
 * initialization or agent switches.
 *
 * Usage:
 *   interface MyEvents {
 *     data: (payload: string) => void
 *     error: (err: Error) => void
 *   }
 *   const emitter = new TypedEmitter<MyEvents>()
 *   emitter.on('data', (payload) => { ... })
 *   emitter.emit('data', 'hello')
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TypedEmitter<T extends Record<string & keyof T, (...args: any[]) => void>> {
  private static readonly MAX_BUFFER_SIZE = 10000

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners = new Map<keyof T, Set<(...args: any[]) => void>>()
  private paused = false
  private buffer: Array<{ event: keyof T; args: unknown[] }> = []

  /** Register a listener for the given event. Returns `this` for chaining. */
  on<K extends keyof T>(event: K, listener: T[K]): this {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(listener)
    return this
  }

  /** Remove a specific listener for the given event. */
  off<K extends keyof T>(event: K, listener: T[K]): this {
    this.listeners.get(event)?.delete(listener)
    return this
  }

  /**
   * Emit an event to all registered listeners.
   *
   * When paused, events are buffered (up to MAX_BUFFER_SIZE) unless
   * the passthrough filter allows them through immediately.
   */
  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): void {
    if (this.paused) {
      // Check passthrough filter — some events may bypass the pause
      if (this.passthroughFn?.(event, args)) {
        this.deliver(event, args)
      } else {
        this.buffer.push({ event, args })
        if (this.buffer.length > TypedEmitter.MAX_BUFFER_SIZE) {
          console.warn(`[TypedEmitter] Buffer exceeded ${TypedEmitter.MAX_BUFFER_SIZE} events, dropping oldest`)
          this.buffer.shift()
        }
      }
      return
    }
    this.deliver(event, args)
  }

  /**
   * Pause event delivery. Events emitted while paused are buffered.
   * Optionally pass a filter to allow specific events through even while paused.
   */
  pause(passthrough?: (event: keyof T, args: unknown[]) => boolean): void {
    this.paused = true
    this.passthroughFn = passthrough
  }
  private passthroughFn?: (event: keyof T, args: unknown[]) => boolean

  /** Resume event delivery and replay buffered events in order. */
  resume(): void {
    this.paused = false
    this.passthroughFn = undefined
    const buffered = this.buffer.splice(0)
    for (const { event, args } of buffered) {
      this.deliver(event, args)
    }
  }

  /** Discard all buffered events without delivering them. */
  clearBuffer(): void {
    this.buffer.length = 0
  }

  get isPaused(): boolean {
    return this.paused
  }

  get bufferSize(): number {
    return this.buffer.length
  }

  /** Remove all listeners for a specific event, or all events if none specified. */
  removeAllListeners(event?: keyof T): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  /** Deliver an event to listeners, isolating errors so one broken listener doesn't break others. */
  private deliver(event: keyof T, args: unknown[]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const listener of set) {
      try {
        (listener as (...a: unknown[]) => void)(...args)
      } catch (err) {
        // Don't let one listener break others
        console.error(`[EventBus] Listener error on "${String(event)}":`, err)
      }
    }
  }
}
