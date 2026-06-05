import { readApiPort, apiCall } from '../api-client.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

/**
 * `viben tunnel` — Manage port-forwarding tunnels via the running daemon.
 *
 * All operations go through the daemon's REST API; the daemon manages the actual
 * tunnel process (cloudflared, ngrok, etc.). Requires a running daemon.
 *
 * Subcommands: add, list, stop, stop-all
 */
export async function cmdTunnel(args: string[], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const subCmd = args[0]
  const port = readApiPort(undefined, instanceRoot)
  if (port === null) {
    if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, 'Viben is not running.')
    console.error('Viben is not running. Start with `viben start`')
    process.exit(1)
  }

  const call = (urlPath: string, options?: RequestInit) => apiCall(port, urlPath, options, instanceRoot)

  try {
    if (subCmd === 'add') {
      const tunnelPort = args[1]
      if (!tunnelPort) {
        if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Port is required')
        console.error('Usage: viben tunnel add <port> [--label name] [--session id]')
        process.exit(1)
      }
      const labelIdx = args.indexOf('--label')
      const label = labelIdx !== -1 ? args[labelIdx + 1] : undefined
      const sessionIdx = args.indexOf('--session')
      const sessionId = sessionIdx !== -1 ? args[sessionIdx + 1] : undefined

      const body: Record<string, unknown> = { port: parseInt(tunnelPort, 10) }
      if (label) body.label = label
      if (sessionId) body.sessionId = sessionId

      const res = await call('/api/tunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.TUNNEL_ERROR, String(data.error))
        console.error(`Error: ${data.error}`)
        process.exit(1)
      }
      if (json) jsonSuccess({ port: data.port, publicUrl: data.publicUrl })
      console.log(`Tunnel active: port ${data.port} → ${data.publicUrl}`)

    } else if (subCmd === 'list') {
      const res = await call('/api/tunnel/list')
      const data = await res.json() as Array<Record<string, unknown>>
      if (json) {
        jsonSuccess({
          tunnels: data.map(t => ({
            port: t.port,
            label: t.label ?? null,
            publicUrl: t.publicUrl ?? null,
            status: t.status ?? 'unknown',
          })),
        })
      }
      if (data.length === 0) {
        console.log('No active tunnels.')
        return
      }
      console.log('Active tunnels:\n')
      for (const t of data) {
        const label = t.label ? ` (${t.label})` : ''
        const status = t.status === 'active' ? '✅' : t.status === 'starting' ? '⏳' : '❌'
        console.log(`  ${status} Port ${t.port}${label}`)
        if (t.publicUrl) console.log(`     → ${t.publicUrl}`)
      }

    } else if (subCmd === 'stop') {
      const tunnelPort = args[1]
      if (!tunnelPort) {
        if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Port is required')
        console.error('Usage: viben tunnel stop <port>')
        process.exit(1)
      }
      const res = await call(`/api/tunnel/${tunnelPort}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json() as Record<string, unknown>
        if (json) jsonError(ErrorCodes.TUNNEL_ERROR, String(data.error))
        console.error(`Error: ${data.error}`)
        process.exit(1)
      }
      if (json) jsonSuccess({ port: parseInt(tunnelPort, 10), stopped: true })
      console.log(`Tunnel stopped: port ${tunnelPort}`)

    } else if (subCmd === 'stop-all') {
      const res = await call('/api/tunnel', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json() as Record<string, unknown>
        if (json) jsonError(ErrorCodes.TUNNEL_ERROR, String(data.error))
        console.error(`Error: ${data.error}`)
        process.exit(1)
      }
      if (json) jsonSuccess({ stopped: true })
      console.log('All user tunnels stopped.')

    } else {
      console.log(`
Tunnel Management:
  viben tunnel add <port> [--label name] [--session id]
  viben tunnel list
  viben tunnel stop <port>
  viben tunnel stop-all

Options:
  --json          Output result as JSON
`)
    }
  } catch (err) {
    const msg = (err as Error).message
    // Re-throw if already handled by jsonSuccess/jsonError (which call process.exit)
    if (msg?.startsWith('process.exit')) throw err
    if (json) jsonError(ErrorCodes.TUNNEL_ERROR, msg)
    console.error(`Failed to connect to daemon: ${msg}`)
    process.exit(1)
  }
}
