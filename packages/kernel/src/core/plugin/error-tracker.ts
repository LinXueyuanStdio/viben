/** Configuration for the sliding-window error budget. */
export interface ErrorBudgetConfig {
  /** Maximum errors allowed within the window before disabling the plugin. Default: 10. */
  maxErrors: number
  /** Sliding window duration in milliseconds. Default: 3600000 (1 hour). */
  windowMs: number
}

/**
 * Circuit breaker for misbehaving plugins.
 *
 * Tracks errors per plugin within a sliding time window. When a plugin exceeds
 * its error budget (default: 10 errors in 1 hour), it is auto-disabled —
 * its middleware handlers are skipped by MiddlewareChain. This prevents a
 * single broken plugin from degrading the entire system.
 *
 * Essential plugins can be marked exempt via `setExempt()`.
 */
export class ErrorTracker {
  private errors = new Map<string, { count: number; windowStart: number }>()
  private disabled = new Set<string>()
  private exempt = new Set<string>()
  private config: ErrorBudgetConfig

  /** Callback fired when a plugin is auto-disabled due to error budget exhaustion. */
  onDisabled?: (pluginName: string, reason: string) => void

  constructor(config?: Partial<ErrorBudgetConfig>) {
    this.config = { maxErrors: config?.maxErrors ?? 10, windowMs: config?.windowMs ?? 3600000 }
  }

  /**
   * Record an error for a plugin. If the error budget is exceeded,
   * the plugin is disabled and the `onDisabled` callback fires.
   */
  increment(pluginName: string): void {
    if (this.exempt.has(pluginName)) return

    const now = Date.now()
    const entry = this.errors.get(pluginName)

    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      this.errors.set(pluginName, { count: 1, windowStart: now })
    } else {
      entry.count += 1
    }

    const current = this.errors.get(pluginName)!
    if (current.count >= this.config.maxErrors && !this.disabled.has(pluginName)) {
      this.disabled.add(pluginName)
      const reason = `Error budget exceeded: ${current.count} errors within ${this.config.windowMs}ms window`
      this.onDisabled?.(pluginName, reason)
    }
  }

  /** Check if a plugin has been disabled due to errors. */
  isDisabled(pluginName: string): boolean {
    return this.disabled.has(pluginName)
  }

  /** Re-enable a plugin and clear its error history. */
  reset(pluginName: string): void {
    this.disabled.delete(pluginName)
    this.errors.delete(pluginName)
  }

  /** Mark a plugin as exempt from circuit-breaking (e.g., essential plugins). */
  setExempt(pluginName: string): void {
    this.exempt.add(pluginName)
  }
}
