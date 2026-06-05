/**
 * Abstract interface for tunnel provider implementations.
 *
 * Each provider wraps a specific tunneling tool (Cloudflare, ngrok, bore, etc.).
 * `start()` spawns the subprocess and resolves once the public URL is known.
 * After establishment, unexpected exits are signalled via `onExit()` so the
 * TunnelRegistry can schedule retries.
 */
export interface TunnelProvider {
  /** Spawn the tunnel subprocess and return the public URL once established. */
  start(localPort: number): Promise<string>
  /** Stop the tunnel. When force=true, skip graceful shutdown and SIGKILL immediately.
   *  When preserveState=true, keep tunnel alive on remote (don't delete from worker/storage) for reconnect on restart. */
  stop(force?: boolean, preserveState?: boolean): Promise<void>
  getPublicUrl(): string
  /** Register a callback invoked when the tunnel process exits unexpectedly after establishment. */
  onExit(callback: (code: number | null) => void): void
}
