import { spawn, type ChildProcess } from 'node:child_process'
import { createChildLogger } from '../../../core/utils/log.js'
import type { TunnelProvider } from '../provider.js'

const log = createChildLogger({ module: 'bore-tunnel' })

const SIGKILL_TIMEOUT_MS = 5_000

/**
 * Tunnel provider that uses the bore CLI (https://github.com/ekzhang/bore).
 *
 * bore must be installed separately (not auto-installed). Connects to `bore.pub`
 * by default, or a custom server via `options.server`. Optionally accepts
 * `options.port` (fixed remote port) and `options.secret` for server auth.
 *
 * URL is extracted from stdout: "listening at <host>:<port>".
 */
export class BoreTunnelProvider implements TunnelProvider {
  private child: ChildProcess | null = null
  private publicUrl = ''
  private options: Record<string, unknown>
  private exitCallback: ((code: number | null) => void) | null = null

  constructor(options: Record<string, unknown> = {}) {
    this.options = options
  }

  onExit(callback: (code: number | null) => void): void {
    this.exitCallback = callback
  }

  async start(localPort: number): Promise<string> {
    const server = String(this.options.server || 'bore.pub')
    const args = ['local', String(localPort), '--to', server]
    if (this.options.port) {
      args.push('--port', String(this.options.port))
    }
    if (this.options.secret) {
      args.push('--secret', String(this.options.secret))
    }

    return new Promise<string>((resolve, reject) => {
      let settled = false
      const settle = (fn: () => void) => { if (!settled) { settled = true; fn() } }

      const timeout = setTimeout(() => {
        this.stop()
        settle(() => reject(new Error('Bore tunnel timed out after 30s. Is bore installed?')))
      }, 30_000)

      try {
        this.child = spawn('bore', args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
      } catch {
        clearTimeout(timeout)
        settle(() => reject(new Error(
          'Failed to start bore. Install it from https://github.com/ekzhang/bore'
        )))
        return
      }

      // Parse bore's "listening at <host>:<port>" line to extract the public URL
      const urlPattern = /listening at ([^\s]+):(\d+)/

      const onData = (data: Buffer) => {
        const line = data.toString()
        log.debug(line.trim())
        const match = line.match(urlPattern)
        if (match) {
          clearTimeout(timeout)
          this.publicUrl = `http://${match[1]}:${match[2]}`
          log.info({ url: this.publicUrl }, 'Bore tunnel ready')
          settle(() => resolve(this.publicUrl))
        }
      }

      this.child.stdout?.on('data', onData)
      this.child.stderr?.on('data', onData)

      this.child.on('error', (err) => {
        clearTimeout(timeout)
        settle(() => reject(new Error(
          `bore failed to start: ${err.message}. Install it from https://github.com/ekzhang/bore`
        )))
      })

      this.child.on('exit', (code) => {
        if (!this.publicUrl) {
          clearTimeout(timeout)
          settle(() => reject(new Error(`bore exited with code ${code} before establishing tunnel`)))
        } else {
          log.error({ code }, 'bore exited unexpectedly after establishment')
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
      log.info('Bore tunnel force-killed')
      return
    }

    child.kill('SIGTERM')

    const exited = await Promise.race([
      new Promise<boolean>((resolve) => child.on('exit', () => resolve(true))),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), SIGKILL_TIMEOUT_MS)),
    ])

    if (!exited) {
      log.warn('bore did not exit after SIGTERM, sending SIGKILL')
      child.kill('SIGKILL')
    }

    log.info('Bore tunnel stopped')
  }

  getPublicUrl(): string {
    return this.publicUrl
  }
}
