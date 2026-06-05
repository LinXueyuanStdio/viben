/** Timing configuration for the thinking indicator lifecycle. */
export interface ActivityConfig {
  /** How often (ms) to refresh the typing indicator (e.g., re-send "typing..." action). */
  thinkingRefreshInterval: number
  /** Maximum duration (ms) before auto-dismissing the indicator to avoid stale UI. */
  maxThinkingDuration: number
}

/** Platform-specific callbacks for showing/updating/removing typing indicators. */
export interface ActivityCallbacks {
  sendThinkingIndicator(): Promise<void>
  updateThinkingIndicator(): Promise<void>
  removeThinkingIndicator(): Promise<void>
}

interface SessionState {
  callbacks: ActivityCallbacks
  refreshTimer?: ReturnType<typeof setInterval>
  startTime: number
  dismissed: boolean
}

/**
 * Manages typing/thinking indicators across sessions.
 *
 * When the agent starts processing, a typing indicator is shown. It is
 * periodically refreshed (platforms like Telegram expire typing status after
 * ~5 seconds) and auto-dismissed either when text output begins or when
 * the max thinking duration is reached.
 */
export class ActivityTracker {
  private sessions = new Map<string, SessionState>()

  constructor(private config: ActivityConfig) {}

  /** Shows the typing indicator and starts the periodic refresh timer. */
  onThinkingStart(sessionId: string, callbacks: ActivityCallbacks): void {
    this.cleanup(sessionId)

    const state: SessionState = {
      callbacks,
      startTime: Date.now(),
      dismissed: false,
    }
    this.sessions.set(sessionId, state)

    setTimeout(() => {
      if (state.dismissed) return
      callbacks.sendThinkingIndicator().catch(() => {})
      this.startRefresh(sessionId, state)
    }, 0)
  }

  /** Dismisses the typing indicator when the agent starts producing text output. */
  onTextStart(sessionId: string): void {
    const state = this.sessions.get(sessionId)
    if (!state || state.dismissed) return
    state.dismissed = true
    this.stopRefresh(state)
    state.callbacks.removeThinkingIndicator().catch(() => {})
  }

  /** Cleans up the typing indicator when the session ends. */
  onSessionEnd(sessionId: string): void {
    this.cleanup(sessionId)
  }

  /** Cleans up all sessions (e.g., during adapter shutdown). */
  destroy(): void {
    for (const [id] of this.sessions) {
      this.cleanup(id)
    }
  }

  private cleanup(sessionId: string): void {
    const state = this.sessions.get(sessionId)
    if (!state) return
    state.dismissed = true
    this.stopRefresh(state)
    state.callbacks.removeThinkingIndicator().catch(() => {})
    this.sessions.delete(sessionId)
  }

  private startRefresh(sessionId: string, state: SessionState): void {
    state.refreshTimer = setInterval(() => {
      if (state.dismissed) {
        this.stopRefresh(state)
        return
      }
      if (Date.now() - state.startTime >= this.config.maxThinkingDuration) {
        state.dismissed = true
        this.stopRefresh(state)
        state.callbacks.removeThinkingIndicator().catch(() => {})
        return
      }
      state.callbacks.updateThinkingIndicator().catch(() => {})
    }, this.config.thinkingRefreshInterval)
  }

  private stopRefresh(state: SessionState): void {
    if (state.refreshTimer) {
      clearInterval(state.refreshTimer)
      state.refreshTimer = undefined
    }
  }
}
