/**
 * Periodically pings the tunnel URL to detect silent failures.
 *
 * Some tunnel providers (notably Cloudflare quick tunnels) can silently drop
 * without triggering a process exit event. This keepalive polls the Viben
 * health endpoint every 30 seconds and calls `onDead()` after 3 consecutive
 * failures, which causes TunnelRegistry to kill and restart the tunnel process.
 *
 * Only used for the system tunnel — user tunnels are managed independently.
 */
export class TunnelKeepAlive {
  private interval: NodeJS.Timeout | null = null
  private consecutiveFails = 0

  static readonly PING_INTERVAL = 30_000
  static readonly FAIL_THRESHOLD = 3
  static readonly PING_TIMEOUT = 5_000

  /**
   * Start polling. Replaces any existing interval.
   * `onDead` is called once when the failure threshold is reached.
   */
  start(tunnelUrl: string, onDead: () => void): void {
    this.stop()

    this.interval = setInterval(async () => {
      try {
        const res = await fetch(`${tunnelUrl}/api/v1/system/health`, {
          signal: AbortSignal.timeout(TunnelKeepAlive.PING_TIMEOUT),
        })
        if (res.ok) {
          this.consecutiveFails = 0
        } else {
          this.consecutiveFails++
        }
      } catch {
        this.consecutiveFails++
      }

      if (this.consecutiveFails >= TunnelKeepAlive.FAIL_THRESHOLD) {
        this.stop()
        onDead()
      }
    }, TunnelKeepAlive.PING_INTERVAL)
  }

  /**
   * Stop the keepalive interval and reset the failure counter.
   * Resetting ensures a clean slate if the keepalive is restarted after stopping.
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.consecutiveFails = 0
  }
}
