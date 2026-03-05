/**
 * Async Lock Utility
 *
 * Provides async mutex functionality for protecting concurrent operations
 * in async/await code. While Node.js is single-threaded, async operations
 * can interleave, causing race conditions in read-modify-write patterns.
 *
 * Usage:
 * ```ts
 * const lock = new AsyncLock();
 *
 * // Option 1: Using withLock (recommended)
 * const result = await lock.withLock("resource-key", async () => {
 *   // Critical section - only one execution at a time per key
 *   const data = await readFile(path);
 *   await writeFile(path, modifiedData);
 *   return result;
 * });
 *
 * // Option 2: Manual acquire/release
 * const release = await lock.acquire("resource-key");
 * try {
 *   // Critical section
 * } finally {
 *   release();
 * }
 * ```
 */

type ReleaseFunction = () => void;

interface LockEntry {
  /** Queue of waiters for this lock */
  waiters: Array<() => void>;
  /** Whether the lock is currently held */
  locked: boolean;
}

/**
 * Async mutex lock with key-based granularity
 */
export class AsyncLock {
  private locks = new Map<string, LockEntry>();

  /**
   * Acquire a lock for the given key
   *
   * @param key - Lock identifier (e.g., task directory path)
   * @param timeout - Optional timeout in milliseconds (default: 30000)
   * @returns A release function to call when done
   * @throws Error if timeout is exceeded
   */
  async acquire(key: string, timeout = 30000): Promise<ReleaseFunction> {
    let entry = this.locks.get(key);

    if (!entry) {
      entry = { waiters: [], locked: false };
      this.locks.set(key, entry);
    }

    if (!entry.locked) {
      // Lock is free, acquire it immediately
      entry.locked = true;
      return () => this.release(key);
    }

    // Lock is held, wait in queue
    return new Promise<ReleaseFunction>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove from waiters queue on timeout
        const idx = entry!.waiters.indexOf(waiter);
        if (idx !== -1) {
          entry!.waiters.splice(idx, 1);
        }
        reject(new Error(`Lock acquisition timeout for key: ${key} (${timeout}ms)`));
      }, timeout);

      const waiter = () => {
        clearTimeout(timeoutId);
        resolve(() => this.release(key));
      };

      entry!.waiters.push(waiter);
    });
  }

  /**
   * Release a lock for the given key
   */
  private release(key: string): void {
    const entry = this.locks.get(key);
    if (!entry) return;

    if (entry.waiters.length > 0) {
      // Hand off to next waiter
      const nextWaiter = entry.waiters.shift()!;
      // Schedule on next tick to avoid stack overflow with many waiters
      setImmediate(nextWaiter);
    } else {
      // No waiters, mark as unlocked
      entry.locked = false;

      // Clean up empty entries to prevent memory leak
      if (!entry.locked && entry.waiters.length === 0) {
        this.locks.delete(key);
      }
    }
  }

  /**
   * Execute a function while holding the lock
   *
   * This is the recommended way to use the lock as it ensures
   * proper release even if the function throws.
   *
   * @param key - Lock identifier
   * @param fn - Function to execute while holding the lock
   * @param timeout - Optional timeout in milliseconds
   * @returns The result of the function
   */
  async withLock<T>(key: string, fn: () => Promise<T>, timeout?: number): Promise<T> {
    const release = await this.acquire(key, timeout);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Check if a lock is currently held
   */
  isLocked(key: string): boolean {
    const entry = this.locks.get(key);
    return entry?.locked ?? false;
  }

  /**
   * Get the number of waiters for a lock
   */
  getWaiterCount(key: string): number {
    const entry = this.locks.get(key);
    return entry?.waiters.length ?? 0;
  }

  /**
   * Get statistics about all locks
   */
  getStats(): { totalLocks: number; lockedCount: number; totalWaiters: number } {
    let lockedCount = 0;
    let totalWaiters = 0;

    for (const entry of this.locks.values()) {
      if (entry.locked) lockedCount++;
      totalWaiters += entry.waiters.length;
    }

    return {
      totalLocks: this.locks.size,
      lockedCount,
      totalWaiters,
    };
  }
}

/**
 * Global lock instance for task operations
 *
 * Use this for all task file operations to prevent race conditions
 */
export const taskLock = new AsyncLock();
