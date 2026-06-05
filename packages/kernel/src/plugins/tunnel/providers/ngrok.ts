import { spawn, type ChildProcess } from 'node:child_process'
import { createChildLogger } from '../../../core/utils/log.js'
import type { TunnelProvider } from '../provider.js'

const log = createChildLogger({ module: 'ngrok-tunnel' })

const SIGKILL_TIMEOUT_MS = 5_000

/**
 * Tunnel provider using ngrok (https://ngrok.com).
 *
 * Requires ngrok to be installed and an auth token configured via `options.authtoken`.
 * Auth token is passed via the `NGROK_AUTHTOKEN` environment variable (not CLI args)
 * to avoid leaking it in `ps aux` output. Supports v2 (*.ngrok.io) and v3
 * (*.ngrok-free.app, *.ngrok.app) URL formats.
 */
export class NgrokTunnelProvider implements TunnelProvider {
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
    const args = ['http', String(localPort), '--log', 'stdout', '--log-format', 'json']
    // authtoken passed via env var, not CLI args (ps aux safe)
    const providerEnv: Record<string, string> = {};
    if (this.options.authtoken) {
      providerEnv.NGROK_AUTHTOKEN = String(this.options.authtoken);
    }
    if (this.options.domain) {
      args.push('--domain', String(this.options.domain))
    }
    if (this.options.region) {
      args.push('--region', String(this.options.region))
    }

    return new Promise<string>((resolve, reject) => {
      let settled = false
      const settle = (fn: () => void) => { if (!settled) { settled = true; fn() } }

      const timeout = setTimeout(() => {
        this.stop()
        settle(() => reject(new Error('ngrok tunnel timed out after 30s. Is ngrok installed?')))
      }, 30_000)

      try {
        this.child = spawn('ngrok', args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, ...providerEnv } })
      } catch {
        clearTimeout(timeout)
        settle(() => reject(new Error(
          'Failed to start ngrok. Install it from https://ngrok.com/download'
        )))
        return
      }

      // Match both v2 (*.ngrok.io) and v3 (*.ngrok-free.app, *.ngrok.app) domains
      const urlPattern = /https:\/\/[a-zA-Z0-9-]+\.(?:ngrok(?:-free)?\.app|ngrok\.io)/

      const onData = (data: Buffer) => {
        const line = data.toString()
        log.debug(line.trim())
        const match = line.match(urlPattern)
        if (match) {
          clearTimeout(timeout)
          this.publicUrl = match[0]
          log.info({ url: this.publicUrl }, 'ngrok tunnel ready')
          settle(() => resolve(this.publicUrl))
        }
      }

      this.child.stdout?.on('data', onData)
      this.child.stderr?.on('data', onData)

      this.child.on('error', (err) => {
        clearTimeout(timeout)
        settle(() => reject(new Error(
          `ngrok failed to start: ${err.message}. Install it from https://ngrok.com/download`
        )))
      })

      this.child.on('exit', (code) => {
        if (!this.publicUrl) {
          clearTimeout(timeout)
          settle(() => reject(new Error(`ngrok exited with code ${code} before establishing tunnel`)))
        } else {
          log.error({ code }, 'ngrok exited unexpectedly after establishment')
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
      log.info('ngrok tunnel force-killed')
      return
    }

    child.kill('SIGTERM')

    const exited = await Promise.race([
      new Promise<boolean>((resolve) => child.on('exit', () => resolve(true))),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), SIGKILL_TIMEOUT_MS)),
    ])

    if (!exited) {
      log.warn('ngrok did not exit after SIGTERM, sending SIGKILL')
      child.kill('SIGKILL')
    }

    log.info('ngrok tunnel stopped')
  }

  getPublicUrl(): string {
    return this.publicUrl
  }
}
