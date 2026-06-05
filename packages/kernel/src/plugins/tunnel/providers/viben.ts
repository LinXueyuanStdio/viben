import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createChildLogger } from '../../../core/utils/log.js'
import { commandExists } from '../../../core/agents/agent-dependencies.js'
import type { TunnelProvider } from '../provider.js'
import type { PluginStorage } from '../../../core/plugin/types.js'

const log = createChildLogger({ module: 'viben-tunnel' })

export const DEFAULT_WORKER_URL = 'https://tunnel-worker.viben.ai'
export const DEFAULT_API_KEY = 'saG87sc26gZKbA24tQm0tqsJ0jo3z'

// Periodically ping the worker to keep the tunnel registration alive.
// Workers may expire idle tunnels, so we heartbeat every 10 minutes.
const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000
// 15s instead of the spec's suggested 10s: cloudflared can take a few seconds to
// connect on slower machines or cold starts. If it hasn't crashed by 15s we assume
// the tunnel is up — the public URL is already known from the worker response anyway.
const STARTUP_TIMEOUT_MS = 15_000
const SIGKILL_TIMEOUT_MS = 5_000
// Plugin storage key for persisted tunnel state (tunnelId + token + publicUrl)
const STORAGE_KEY = 'viben-tunnels'

interface TunnelState {
  tunnelId: string
  token: string
  publicUrl: string
}

type TunnelStateMap = Record<string, TunnelState>

/**
 * Viben managed tunnel provider.
 *
 * Flow:
 * 1. Request a tunnel from the Viben worker (POST /tunnel/create) — gets back a
 *    Cloudflare tunnel token and a stable public URL.
 * 2. Spawn cloudflared with that token to connect the tunnel.
 * 3. Run a heartbeat to keep the tunnel registration alive on the worker.
 * 4. On stop, DELETE the tunnel from the worker (unless preserveState=true for restart).
 *
 * Tunnel state (id + token + URL) is persisted in plugin storage so restarts can
 * reuse existing tunnels instead of creating new ones (stable URL survives restarts).
 */
export class VibenTunnelProvider implements TunnelProvider {
  private child: ChildProcess | null = null
  private publicUrl = ''
  private tunnelId = ''
  private localPort = 0
  private heartbeat: NodeJS.Timeout | null = null
  private exitCallback: ((code: number | null) => void) | null = null

  private readonly storage: PluginStorage
  private readonly workerUrl: string
  private readonly apiKey: string
  private readonly binDir: string

  constructor(options: Record<string, unknown>, binDir: string, storage: PluginStorage) {
    this.storage = storage
    this.binDir = binDir
    this.workerUrl = (options.workerUrl as string | undefined) ?? DEFAULT_WORKER_URL
    this.apiKey = (options.apiKey as string | undefined) ?? DEFAULT_API_KEY
  }

  onExit(callback: (code: number | null) => void): void {
    this.exitCallback = callback
  }

  start(localPort: number): Promise<string> {
    const promise = this._startAsync(localPort)
    // Attach a no-op catch so Node.js does not flag this as an unhandled rejection
    // if the process exits during fake-timer advancement in tests before the
    // caller's await/catch is reached. The original `promise` still rejects normally.
    promise.catch(() => {})
    return promise
  }

  private async _startAsync(localPort: number): Promise<string> {
    this.localPort = localPort

    const binaryPath = await this.resolveBinary()
    const all = await this.loadState()
    const saved = all[String(localPort)]

    const state = await this.resolveCredentials(saved, all, localPort)
    this.tunnelId = state.tunnelId
    this.publicUrl = state.publicUrl

    await this.spawnCloudflared(binaryPath, state.token, localPort)
    this.startHeartbeat()

    return this.publicUrl
  }

  async stop(force = false, preserveState = false): Promise<void> {
    this.stopHeartbeat()

    const child = this.child
    const tunnelId = this.tunnelId
    const localPort = this.localPort

    this.child = null
    this.exitCallback = null

    if (child) {
      child.kill(force ? 'SIGKILL' : 'SIGTERM')

      if (!force) {
        // Escalate to SIGKILL asynchronously if process doesn't exit on its own
        const killTimer = setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL')
        }, SIGKILL_TIMEOUT_MS)
        child.once('exit', () => clearTimeout(killTimer))
      }
    }

    if (tunnelId && !preserveState) {
      this.deleteFromWorker(tunnelId).catch(err => {
        log.warn({ err: (err as Error).message }, 'Failed to delete tunnel from worker')
      })

      const all = await this.loadState()
      delete all[String(localPort)]
      await this.storage.set(STORAGE_KEY, all)
    }

    log.info({ localPort, preserveState }, 'Viben tunnel stopped')
  }

  getPublicUrl(): string {
    return this.publicUrl
  }

  // Try to reuse a persisted tunnel (stable URL across restarts).
  // If the saved tunnel is no longer alive on the worker, create a fresh one.
  private async resolveCredentials(
    saved: TunnelState | undefined,
    all: TunnelStateMap,
    localPort: number,
  ): Promise<TunnelState> {
    if (saved) {
      const alive = await this.pingWorker(saved.tunnelId)
      if (alive) {
        log.info({ publicUrl: saved.publicUrl }, 'Reusing existing tunnel')
        return saved
      }
      log.info({ tunnelId: saved.tunnelId }, 'Saved tunnel expired, creating new one')
      delete all[String(localPort)]
    }

    const fresh = await this.createTunnel()
    all[String(localPort)] = fresh
    await this.storage.set(STORAGE_KEY, all)
    return fresh
  }

  private async spawnCloudflared(binaryPath: string, token: string, port: number): Promise<void> {
    // `--url` with `--token` is a documented cloudflared shorthand: it sets up a
    // simple HTTP proxy to the given local service without requiring ingress rules
    // to be configured on the Cloudflare dashboard side.
    const args = ['tunnel', 'run', '--url', `http://localhost:${port}`, '--token', token]

    return new Promise<void>((resolve, reject) => {
      let settled = false
      const settle = (fn: () => void): void => {
        if (!settled) { settled = true; fn() }
      }

      const timeout = setTimeout(() => {
        log.info({ port }, 'cloudflared still running after startup window — assuming tunnel active')
        settle(resolve)
      }, STARTUP_TIMEOUT_MS)

      let child: ChildProcess
      try {
        child = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
      } catch (err) {
        clearTimeout(timeout)
        settle(() => reject(new Error(`Failed to start cloudflared at ${binaryPath}`)))
        return
      }

      this.child = child

      const onData = (data: Buffer): void => {
        const line = data.toString()
        if (/Registered tunnel connection/.test(line)) {
          clearTimeout(timeout)
          log.info({ port }, 'cloudflared connection registered')
          settle(resolve)
        }
      }
      child.stdout?.on('data', onData)
      child.stderr?.on('data', onData)

      child.on('error', (err) => {
        clearTimeout(timeout)
        settle(() => reject(new Error(`cloudflared failed to start: ${err.message}`)))
      })

      child.on('exit', (code) => {
        clearTimeout(timeout)
        if (!settled) {
          settle(() => reject(new Error(`cloudflared exited with code ${code} before establishing tunnel`)))
        } else {
          log.error({ code }, 'cloudflared exited unexpectedly after establishment')
          this.stopHeartbeat()
          this.child = null
          this.exitCallback?.(code)
        }
      })
    })
  }

  private async createTunnel(): Promise<TunnelState> {
    const res = await fetch(`${this.workerUrl}/tunnel/create`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Worker /tunnel/create failed: ${res.status} ${body}`)
    }
    return res.json() as Promise<TunnelState>
  }

  private async pingWorker(tunnelId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.workerUrl}/tunnel/${tunnelId}/ping`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5_000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  private async deleteFromWorker(tunnelId: string): Promise<void> {
    const res = await fetch(`${this.workerUrl}/tunnel/${tunnelId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })
    if (!res.ok) throw new Error(`DELETE /tunnel/${tunnelId} returned ${res.status}`)
    const body = await res.json() as { ok: boolean; warnings?: string[] }
    if (body.warnings?.length) {
      log.warn({ tunnelId, warnings: body.warnings }, 'Tunnel deletion had partial CF API failures — cron will clean up')
    }
  }

  private startHeartbeat(): void {
    this.heartbeat = setInterval(async () => {
      if (!this.tunnelId) return
      const alive = await this.pingWorker(this.tunnelId)
      if (!alive) {
        log.warn({ tunnelId: this.tunnelId }, 'Heartbeat ping failed — tunnel may have expired on worker')
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
  }

  private async loadState(): Promise<TunnelStateMap> {
    return (await this.storage.get<TunnelStateMap>(STORAGE_KEY)) ?? {}
  }

  private async resolveBinary(): Promise<string> {
    if (commandExists('cloudflared')) return 'cloudflared'

    const binPath = path.join(this.binDir, 'cloudflared')
    if (fs.existsSync(binPath)) return binPath

    log.warn('cloudflared not found, attempting auto-install...')
    const { ensureCloudflared } = await import('./install-cloudflared.js')
    return ensureCloudflared()
  }
}
