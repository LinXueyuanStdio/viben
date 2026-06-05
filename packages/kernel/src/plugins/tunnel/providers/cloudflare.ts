import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createChildLogger } from '../../../core/utils/log.js'
import { commandExists } from '../../../core/agents/agent-dependencies.js'
import type { TunnelProvider } from '../provider.js'

const log = createChildLogger({ module: 'cloudflare-tunnel' })

const SIGKILL_TIMEOUT_MS = 5_000

/**
 * Tunnel provider using Cloudflare quick tunnels (no account required).
 *
 * Runs `cloudflared tunnel --url http://localhost:<port>` and extracts the
 * randomly assigned `*.trycloudflare.com` URL from stderr. The binary is
 * located from PATH first, then from `binDir` (installed by post-upgrade step),
 * and finally auto-downloaded as a last resort.
 *
 * Quick tunnels are rate-limited and assign a new random URL on each start.
 * Prefer VibenTunnelProvider for a stable URL.
 */
export class CloudflareTunnelProvider implements TunnelProvider {
  private child: ChildProcess | null = null
  private publicUrl = ''
  private options: Record<string, unknown>
  private binDir: string
  private exitCallback: ((code: number | null) => void) | null = null

  constructor(options: Record<string, unknown> = {}, binDir?: string) {
    this.options = options
    this.binDir = binDir!
  }

  onExit(callback: (code: number | null) => void): void {
    this.exitCallback = callback
  }

  async start(localPort: number): Promise<string> {
    // Find binary — post-upgrade should have installed it, but fallback to ensureCloudflared() as safety net
    let binaryPath = this.findBinary()
    if (!binaryPath) {
      log.warn('cloudflared not found locally, attempting auto-install as fallback...')
      try {
        const { ensureCloudflared } = await import('./install-cloudflared.js')
        binaryPath = await ensureCloudflared()
      } catch (err) {
        throw new Error(`cloudflared is not installed and auto-install failed: ${(err as Error).message}`)
      }
    }

    const args = ['tunnel', '--url', `http://localhost:${localPort}`]
    if (this.options.domain) {
      args.push('--hostname', String(this.options.domain))
    }

    return new Promise<string>((resolve, reject) => {
      let settled = false
      const settle = (fn: () => void) => { if (!settled) { settled = true; fn() } }

      const timeout = setTimeout(() => {
        this.stop()
        settle(() => reject(new Error('Cloudflare tunnel timed out after 30s')))
      }, 30_000)

      try {
        this.child = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
      } catch {
        clearTimeout(timeout)
        settle(() => reject(new Error(`Failed to start cloudflared at ${binaryPath}`)))
        return
      }

      const urlPattern = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/

      const onData = (data: Buffer) => {
        const line = data.toString()
        log.debug(line.trim())
        const match = line.match(urlPattern)
        if (match) {
          clearTimeout(timeout)
          this.publicUrl = match[0]
          log.info({ url: this.publicUrl }, 'Cloudflare tunnel ready')
          settle(() => resolve(this.publicUrl))
        }
      }

      this.child.stdout?.on('data', onData)
      this.child.stderr?.on('data', onData)

      this.child.on('error', (err) => {
        clearTimeout(timeout)
        settle(() => reject(new Error(`cloudflared failed to start: ${err.message}`)))
      })

      this.child.on('exit', (code) => {
        if (!this.publicUrl) {
          clearTimeout(timeout)
          settle(() => reject(new Error(`cloudflared exited with code ${code} before establishing tunnel`)))
        } else {
          // Post-establishment crash
          log.error({ code }, 'cloudflared exited unexpectedly after establishment')
          this.child = null
          this.exitCallback?.(code)
        }
      })
    })
  }

  async stop(force = false): Promise<void> {
    const child = this.child
    if (!child) return
    this.child = null
    this.exitCallback = null

    if (force) {
      child.kill('SIGKILL')
      log.info('Cloudflare tunnel force-killed')
      return
    }

    child.kill('SIGTERM')

    // Wait for graceful exit, then SIGKILL if still alive
    const exited = await Promise.race([
      new Promise<boolean>((resolve) => child.on('exit', () => resolve(true))),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), SIGKILL_TIMEOUT_MS)),
    ])

    if (!exited) {
      log.warn('cloudflared did not exit after SIGTERM, sending SIGKILL')
      child.kill('SIGKILL')
    }

    log.info('Cloudflare tunnel stopped')
  }

  getPublicUrl(): string {
    return this.publicUrl
  }

  private findBinary(): string | null {
    // 1. Check PATH first (respects user's system install)
    if (commandExists('cloudflared')) return 'cloudflared'

    // 2. Check binDir (installed by post-upgrade)
    const binPath = path.join(this.binDir, 'cloudflared')
    if (fs.existsSync(binPath)) return binPath

    // 3. Not found
    return null
  }
}
