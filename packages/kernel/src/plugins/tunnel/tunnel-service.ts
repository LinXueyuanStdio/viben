// TunnelConfig was removed from config.ts (migrated to plugin settings)

/**
 * Tunnel plugin settings shape.
 * `port` is deprecated — the tunnel now always points to the API server port.
 * `auth` is deprecated — viewer routes are public; authentication was removed.
 */
export interface TunnelConfig {
  enabled: boolean
  port: number
  provider: string
  options: Record<string, unknown>
  storeTtlMinutes: number
  maxUserTunnels?: number
  auth: { enabled: boolean; token?: string }
}
import { createChildLogger } from '../../core/utils/log.js'
import { TunnelRegistry, type TunnelEntry } from './tunnel-registry.js'
import { ViewerStore } from './viewer-store.js'
import type { PluginStorage } from '../../core/plugin/types.js'

const log = createChildLogger({ module: 'tunnel' })

/**
 * High-level facade over TunnelRegistry and ViewerStore.
 *
 * Owns the system tunnel (started in `start()` once the API server port is known),
 * user tunnel management (add/stop/list), and viewer URL generation.
 * Registered as the `"tunnel"` service so other plugins can call `fileUrl()`,
 * `diffUrl()`, etc. to share content via the public tunnel URL.
 */
export class TunnelService {
  private registry: TunnelRegistry
  private store: ViewerStore
  private config: TunnelConfig
  private apiPort: number = 0
  private startError: string | undefined
  private onEvent: (event: string, data: unknown) => void

  constructor(
    config: TunnelConfig,
    registryPath?: string,
    binDir?: string,
    storage?: PluginStorage,
    onEvent?: (event: string, data: unknown) => void,
  ) {
    this.config = config
    this.store = new ViewerStore(config.storeTtlMinutes)
    this.registry = new TunnelRegistry({
      maxUserTunnels: config.maxUserTunnels ?? 5,
      providerOptions: config.options,
      registryPath,
      binDir,
      storage,
    })
    this.onEvent = onEvent ?? (() => {})
  }

  async start(apiPort: number): Promise<string> {
    this.apiPort = apiPort

    // ViewerStore already initialized in constructor — no change needed there

    // Restore persisted user tunnels
    await this.registry.restore()

    // Register system tunnel pointing to API server port
    if (this.config.provider) {
      try {
        const entry = await this.registry.add(apiPort, {
          type: 'system',
          provider: this.config.provider,
          label: 'system',
        })
        const publicUrl = entry.publicUrl || `http://localhost:${apiPort}`
        this.onEvent('tunnel:started', { url: publicUrl })
        return publicUrl
      } catch (err) {
        // If the Viben worker is unreachable (service down, rate-limited, etc.),
        // fall back to Cloudflare quick tunnel so the user is never left without a URL.
        // This intentionally bypasses TunnelRegistry's retry backoff — we want an
        // immediate provider switch rather than repeated retries against a down service.
        if (this.config.provider === 'viben') {
          const reason = (err as Error).message ?? String(err)
          log.error({ err: reason }, '[tunnel] Viben tunnel failed — falling back to Cloudflare quick tunnel')
          try {
            const fallbackEntry = await this.registry.add(apiPort, {
              type: 'system',
              provider: 'cloudflare',
              label: 'system',
            })
            const fallbackUrl = fallbackEntry.publicUrl || `http://localhost:${apiPort}`
            log.warn({ url: fallbackUrl, reason }, '[tunnel] Cloudflare fallback tunnel active')
            this.startError = `Viben tunnel unavailable (${reason}) — using Cloudflare quick tunnel`
            return fallbackUrl
          } catch (fallbackErr) {
            log.error({ err: (fallbackErr as Error).message }, '[tunnel] Cloudflare fallback also failed — no public URL')
            this.startError = (fallbackErr as Error).message
            return `http://localhost:${apiPort}`
          }
        }
        this.startError = (err as Error).message
        return `http://localhost:${apiPort}`
      }
    }

    return `http://localhost:${apiPort}`
  }

  async stop(): Promise<void> {
    await this.registry.shutdown()
    this.registry.flush()
    this.store.destroy()
    this.onEvent('tunnel:stopped', {})
    log.info('Tunnel service stopped')
  }

  // --- User tunnel management ---

  async addTunnel(port: number, opts?: { label?: string; sessionId?: string }): Promise<TunnelEntry> {
    return this.registry.add(port, {
      type: 'user',
      provider: this.config.provider,
      label: opts?.label,
      sessionId: opts?.sessionId,
    })
  }

  async stopTunnel(port: number): Promise<void> {
    return this.registry.stop(port)
  }

  async stopAllUser(): Promise<void> {
    return this.registry.stopAllUser()
  }

  async stopBySession(sessionId: string): Promise<TunnelEntry[]> {
    return this.registry.stopBySession(sessionId)
  }

  listTunnels(): TunnelEntry[] {
    return this.registry.list(false)  // user only
  }

  getTunnel(port: number): TunnelEntry | null {
    return this.registry.get(port)
  }

  // --- Viewer (system tunnel) ---

  getPublicUrl(): string {
    if (!this.apiPort) return ''
    const system = this.registry.getSystemEntry()
    return system?.publicUrl || `http://localhost:${this.apiPort}`
  }

  getStartError(): string | undefined {
    return this.startError
  }

  getStore(): ViewerStore {
    return this.store
  }

  fileUrl(entryId: string): string {
    const base = this.getPublicUrl()
    return base ? `${base}/view/${entryId}` : ''
  }

  diffUrl(entryId: string): string {
    const base = this.getPublicUrl()
    return base ? `${base}/diff/${entryId}` : ''
  }

  outputUrl(entryId: string): string {
    const base = this.getPublicUrl()
    return base ? `${base}/output/${entryId}` : ''
  }
}
