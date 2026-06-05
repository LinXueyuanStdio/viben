import fs from 'node:fs'
import path from 'node:path'
import { createChildLogger } from '../../core/utils/log.js'
import type { TunnelProvider } from './provider.js'
import { TunnelKeepAlive } from './keepalive.js'
import { CloudflareTunnelProvider } from './providers/cloudflare.js'
import { NgrokTunnelProvider } from './providers/ngrok.js'
import { BoreTunnelProvider } from './providers/bore.js'
import { TailscaleTunnelProvider } from './providers/tailscale.js'
import type { PluginStorage } from '../../core/plugin/types.js'
import { VibenTunnelProvider } from './providers/viben.js'

const log = createChildLogger({ module: 'tunnel-registry' })

export const MAX_RETRIES = 5
// Exponential backoff base: 2s, 4s, 8s, 16s, 32s
const BASE_RETRY_DELAY_MS = 2_000

/**
 * Represents a single running (or recently failed) tunnel.
 * `type: "system"` is the main Viben tunnel; `type: "user"` are agent-created tunnels.
 * `status` transitions: starting → active | failed. Failed entries may auto-retry.
 */
export interface TunnelEntry {
  port: number
  type: 'system' | 'user'
  provider: string
  label?: string
  publicUrl?: string
  sessionId?: string
  status: 'stopped' | 'starting' | 'active' | 'failed'
  retryCount: number
  createdAt: string
}

interface PersistedEntry {
  port: number
  type: 'system' | 'user'
  provider: string
  label?: string
  sessionId?: string
  createdAt: string
}

interface LiveEntry {
  entry: TunnelEntry
  process: TunnelProvider | null
  spawnPromise: Promise<string> | null
  retryTimer: ReturnType<typeof setTimeout> | null
}

/**
 * Manages the lifecycle of all active tunnel processes.
 *
 * Responsibilities:
 * - Spawn/stop tunnel provider subprocesses via the TunnelProvider interface
 * - Exponential backoff retry (up to MAX_RETRIES) on crash or start failure
 * - Keepalive polling for the system tunnel to detect silent drops
 * - Persist user tunnel state to `tunnels.json` so they survive restarts
 * - Enforce the per-user tunnel limit
 *
 * System tunnels (one per instance, pointing to the API server) are managed
 * separately from user tunnels (agent-created, per-session).
 */
export class TunnelRegistry {
  private entries: Map<number, LiveEntry> = new Map()
  private saveTimeout: ReturnType<typeof setTimeout> | null = null
  private maxUserTunnels: number
  private keepalive = new TunnelKeepAlive()
  private providerOptions: Record<string, unknown>
  private registryPath: string
  private shuttingDown = false

  private binDir: string | undefined
  private storage: PluginStorage | null

  constructor(opts: { maxUserTunnels?: number; providerOptions?: Record<string, unknown>; registryPath?: string; binDir?: string; storage?: PluginStorage } = {}) {
    this.maxUserTunnels = opts.maxUserTunnels ?? 5
    this.providerOptions = opts.providerOptions ?? {}
    this.registryPath = opts.registryPath!
    this.binDir = opts.binDir
    this.storage = opts.storage ?? null
  }

  /**
   * Spawn a new tunnel process for the given port and register it.
   *
   * Persists the entry to `tunnels.json` once the tunnel reaches `active` status.
   * Throws if the port is already in use by an active or starting tunnel, or if the
   * user tunnel limit is reached.
   */
  async add(port: number, opts: {
    type: 'system' | 'user'
    provider: string
    label?: string
    sessionId?: string
  }, _autoRetry = true): Promise<TunnelEntry> {
    // Check if port already registered
    if (this.entries.has(port)) {
      const existing = this.entries.get(port)!
      if (existing.entry.status === 'active' || existing.entry.status === 'starting') {
        throw new Error(`Port ${port} is already tunneled → ${existing.entry.publicUrl || 'starting...'}`)
      }
      // Stopped/failed entry — clean up retry timer and re-add
      if (existing.retryTimer) clearTimeout(existing.retryTimer)
      this.entries.delete(port)
    }

    // Check max user tunnels
    if (opts.type === 'user') {
      const userCount = this.list(false).filter(e => e.status === 'active' || e.status === 'starting').length
      if (userCount >= this.maxUserTunnels) {
        throw new Error(`Max user tunnels (${this.maxUserTunnels}) reached. Stop a tunnel first.`)
      }
    }

    const entry: TunnelEntry = {
      port,
      type: opts.type,
      provider: opts.provider,
      label: opts.label,
      sessionId: opts.sessionId,
      status: 'starting',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    }

    const provider = this.createProvider(opts.provider)

    // Wire up post-establishment crash detection with auto-retry
    provider.onExit((code) => {
      if (this.shuttingDown) return
      const live = this.entries.get(port)
      if (!live) return

      if (entry.type === 'system') {
        this.keepalive.stop()
      }

      live.entry.status = 'failed'
      live.process = null
      this.scheduleSave()

      if (live.entry.retryCount < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, live.entry.retryCount)
        log.warn({ port, code, retry: live.entry.retryCount + 1, maxRetries: MAX_RETRIES, delayMs: delay },
          'Tunnel crashed, scheduling retry')
        live.retryTimer = setTimeout(() => this.retry(port, opts), delay)
      } else {
        log.error({ port, code }, `Tunnel crashed and exhausted all ${MAX_RETRIES} retries`)
      }
    })

    const spawnPromise = provider.start(port).then(url => {
      entry.publicUrl = url
      entry.status = 'active'
      log.info({ port, url, label: opts.label }, 'Tunnel active')
      this.scheduleSave()
      if (opts.type === 'system' && entry.publicUrl) {
        const live = this.entries.get(port)
        this.keepalive.start(entry.publicUrl, () => {
          log.warn('Tunnel keepalive detected dead tunnel, restarting...')
          // Clear publicUrl so getPublicUrl() falls back to localhost
          entry.publicUrl = undefined
          entry.status = 'failed'
          // Kill process to trigger onExit → retry
          if (live) live.process?.stop()
        })
      }
      return url
    }).catch(err => {
      entry.status = 'failed'
      log.error({ port, err: (err as Error).message }, 'Tunnel failed to start')
      this.scheduleSave()

      // Schedule retry for initial start failures (e.g. rate limiting, transient errors)
      // Skip when called from retry() — it manages its own retry scheduling
      const live = this.entries.get(port)
      if (_autoRetry && live && !this.shuttingDown && live.entry.retryCount < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, live.entry.retryCount)
        log.warn({ port, retry: live.entry.retryCount + 1, maxRetries: MAX_RETRIES, delayMs: delay },
          'Scheduling retry after initial start failure')
        live.retryTimer = setTimeout(() => this.retry(port, opts), delay)
      }

      throw err
    })

    this.entries.set(port, { entry, process: provider, spawnPromise, retryTimer: null })
    this.scheduleSave()

    // Await spawn — caller gets the URL or error
    await spawnPromise
    return entry
  }

  private async retry(port: number, opts: {
    type: 'system' | 'user'
    provider: string
    label?: string
    sessionId?: string
  }): Promise<void> {
    if (this.shuttingDown) return
    const live = this.entries.get(port)
    if (!live) return

    const retryCount = live.entry.retryCount + 1
    log.info({ port, retry: retryCount, maxRetries: MAX_RETRIES }, 'Retrying tunnel')

    // Remove old entry so add() doesn't reject
    if (live.retryTimer) clearTimeout(live.retryTimer)
    this.entries.delete(port)

    try {
      const entry = await this.add(port, opts, false)
      entry.retryCount = retryCount
    } catch (err) {
      if (this.shuttingDown) return

      log.error({ port, err: (err as Error).message, retry: retryCount }, 'Tunnel retry failed')

      // Re-insert as failed with incremented retry count for next onExit cycle
      const failedEntry: TunnelEntry = {
        port,
        type: opts.type,
        provider: opts.provider,
        label: opts.label,
        sessionId: opts.sessionId,
        status: 'failed',
        retryCount,
        createdAt: live.entry.createdAt,
      }

      if (retryCount < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount)
        const retryTimer = setTimeout(() => this.retry(port, opts), delay)
        this.entries.set(port, { entry: failedEntry, process: null, spawnPromise: null, retryTimer })
        log.warn({ port, retry: retryCount + 1, delayMs: delay }, 'Scheduling next retry')
      } else {
        this.entries.set(port, { entry: failedEntry, process: null, spawnPromise: null, retryTimer: null })
        log.error({ port }, `Tunnel exhausted all ${MAX_RETRIES} retries`)
      }
      this.scheduleSave()
    }
  }

  /**
   * Stop a user tunnel by port and remove it from the registry.
   *
   * Cancels any pending retry timer and waits for an in-progress spawn to settle
   * before terminating the process. Throws if the port is a system tunnel.
   */
  async stop(port: number): Promise<void> {
    const live = this.entries.get(port)
    if (!live) return

    if (live.entry.type === 'system') {
      throw new Error('Cannot stop system tunnel')
    }

    // Cancel any pending retry
    if (live.retryTimer) clearTimeout(live.retryTimer)

    // Wait for spawn to finish if still starting
    if (live.spawnPromise) {
      try { await live.spawnPromise } catch { /* ignore spawn error */ }
    }

    if (live.process) {
      await live.process.stop()
    }

    this.entries.delete(port)
    this.scheduleSave()
    log.info({ port, label: live.entry.label }, 'Tunnel stopped')
  }

  async stopBySession(sessionId: string): Promise<TunnelEntry[]> {
    const stopped: TunnelEntry[] = []
    const toStop = this.getBySession(sessionId)
    for (const entry of toStop) {
      try {
        await this.stop(entry.port)
        stopped.push(entry)
      } catch { /* ignore */ }
    }
    return stopped
  }

  /** Stop all user tunnels. Errors from individual stops are silently ignored. */
  async stopAllUser(): Promise<void> {
    const userEntries = this.list(false)
    for (const entry of userEntries) {
      try { await this.stop(entry.port) } catch { /* ignore */ }
    }
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return

    this.keepalive.stop()
    this.shuttingDown = true

    // Cancel any pending save timers
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }

    const stopPromises: Promise<void>[] = []
    for (const [, live] of this.entries) {
      if (live.retryTimer) clearTimeout(live.retryTimer)
      if (live.process) {
        stopPromises.push(live.process.stop(true, true).catch(() => { /* ignore */ }))
      }
    }
    await Promise.all(stopPromises)

    // Persist current state so tunnels can reconnect on next startup
    this.save()
    this.entries.clear()
  }

  /**
   * Return all current tunnel entries.
   *
   * Pass `includeSystem = true` to include the system tunnel in the result;
   * by default only user tunnels are returned.
   */
  list(includeSystem = false): TunnelEntry[] {
    const entries = Array.from(this.entries.values()).map(l => l.entry)
    if (includeSystem) return entries
    return entries.filter(e => e.type === 'user')
  }

  get(port: number): TunnelEntry | null {
    return this.entries.get(port)?.entry ?? null
  }

  getBySession(sessionId: string): TunnelEntry[] {
    return this.list(false).filter(e => e.sessionId === sessionId)
  }

  /**
   * Return the system tunnel entry, or null if it hasn't been registered yet
   * (e.g. `TunnelService.start()` hasn't been called, or the tunnel failed to start).
   */
  getSystemEntry(): TunnelEntry | null {
    for (const live of this.entries.values()) {
      if (live.entry.type === 'system') return live.entry
    }
    return null
  }

  /**
   * Re-launch tunnels persisted from a previous run.
   *
   * Only user tunnels are restored — the system tunnel is registered separately by
   * `TunnelService.start()`. `sessionId` is intentionally dropped: sessions do not
   * survive a restart, so restored tunnels are session-less until an agent claims them.
   */
  async restore(): Promise<void> {
    if (!fs.existsSync(this.registryPath)) return

    try {
      const raw = JSON.parse(fs.readFileSync(this.registryPath, 'utf-8')) as PersistedEntry[]
      log.info({ count: raw.length }, 'Restoring tunnels')

      // Only restore user tunnels — system tunnel is registered separately by TunnelService.start().
      // sessionId is intentionally omitted on restore: sessions don't survive a restart.
      const userEntries = raw.filter(e => e.type === 'user')
      const results = await Promise.allSettled(
        userEntries.map(persisted =>
          this.add(persisted.port, {
            type: persisted.type,
            provider: persisted.provider,
            label: persisted.label,
          })
        )
      )

      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'rejected') {
          const reason = (results[i] as PromiseRejectedResult).reason as Error
          log.warn({ port: userEntries[i].port, err: reason.message }, 'Failed to restore tunnel')
        }
      }
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'Failed to read tunnels.json')
    }
  }

  private createProvider(name: string): TunnelProvider {
    switch (name) {
      case 'viben': {
        if (!this.storage) {
          throw new Error('VibenTunnelProvider requires storage — ensure tunnel plugin has storage:read and storage:write permissions')
        }
        return new VibenTunnelProvider(this.providerOptions, this.binDir ?? '', this.storage)
      }
      case 'cloudflare':
        return new CloudflareTunnelProvider(this.providerOptions, this.binDir)
      case 'ngrok':
        return new NgrokTunnelProvider(this.providerOptions)
      case 'bore':
        return new BoreTunnelProvider(this.providerOptions)
      case 'tailscale':
        return new TailscaleTunnelProvider(this.providerOptions)
      default:
        log.warn({ provider: name }, 'Unknown provider, falling back to viben')
        if (!this.storage) {
          log.warn('No storage available for viben fallback, using cloudflare quick tunnel')
          return new CloudflareTunnelProvider(this.providerOptions, this.binDir)
        }
        return new VibenTunnelProvider(this.providerOptions, this.binDir ?? '', this.storage)
    }
  }

  // Debounce disk writes — multiple tunnel state changes may occur in rapid succession
  // (e.g. status update + URL assignment). Coalesce them into a single write after 2s.
  private scheduleSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    this.saveTimeout = setTimeout(() => this.save(), 2000)
  }

  private save(): void {
    const data: PersistedEntry[] = Array.from(this.entries.values()).map(l => ({
      port: l.entry.port,
      type: l.entry.type,
      provider: l.entry.provider,
      label: l.entry.label,
      sessionId: l.entry.sessionId,
      createdAt: l.entry.createdAt,
    }))

    try {
      const dir = path.dirname(this.registryPath)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.registryPath, JSON.stringify(data, null, 2))
    } catch (err) {
      log.error({ err: (err as Error).message }, 'Failed to save tunnels.json')
    }
  }

  flush(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    if (!this.shuttingDown) {
      this.save()
    }
  }
}
