import { readApiPort, readApiSecret, apiCall } from '../api-client.js'
import { InstanceRegistry } from '../../core/instance/instance-registry.js'
import path from 'node:path'
import os from 'node:os'
import qrcode from 'qrcode-terminal'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

/**
 * `viben remote` — Generate a one-time access code for remote login.
 *
 * Creates a short-lived auth code via the daemon's /api/v1/auth/codes endpoint,
 * then outputs local and tunnel URLs with a QR code for quick scanning on mobile.
 * The code is single-use and expires after 30 minutes (enforced server-side).
 *
 * Requires a running daemon with the API server enabled.
 */
export async function cmdRemote(args: string[], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  // Parse flags
  const role = extractFlag(args, '--role') ?? 'admin'
  const expire = extractFlag(args, '--expire') ?? '24h'
  const scopesRaw = extractFlag(args, '--scopes')
  const name = extractFlag(args, '--name')
  const instanceId = extractFlag(args, '--instance')
  const noTunnel = args.includes('--no-tunnel')
  const noQr = args.includes('--no-qr')

  const scopes = scopesRaw ? scopesRaw.split(',').map((s) => s.trim()) : undefined

  // Resolve instance root from --instance flag
  let resolvedInstanceRoot = instanceRoot
  if (instanceId) {
    const registryPath = path.join(os.homedir(), '.viben', 'instances.json')
    const registry = new InstanceRegistry(registryPath)
    await registry.load()
    const entry = registry.get(instanceId)
    if (!entry) {
      if (json) jsonError(ErrorCodes.INSTANCE_NOT_FOUND, `Workspace "${instanceId}" not found. Run "viben status" to see workspaces.`)
      console.error(`Workspace "${instanceId}" not found. Run "viben status" to see workspaces.`)
      process.exit(1)
    }
    resolvedInstanceRoot = entry.root
  }

  // Check if API server is running
  const port = readApiPort(undefined, resolvedInstanceRoot)
  if (port === null) {
    if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, 'Viben is not running. Start with `viben start`')
    console.error('Viben is not running. Start with `viben start`')
    process.exit(1)
  }

  // Verify health
  try {
    const healthRes = await apiCall(port, '/api/v1/system/health', undefined, resolvedInstanceRoot)
    if (!healthRes.ok) {
      if (json) jsonError(ErrorCodes.API_ERROR, 'API server is not responding. Try restarting with `viben restart`')
      console.error('API server is not responding. Try restarting with `viben restart`')
      process.exit(1)
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('process.exit')) throw err
    if (json) jsonError(ErrorCodes.API_ERROR, 'Cannot connect to API server. Is Viben running?')
    console.error('Cannot connect to API server. Is Viben running?')
    process.exit(1)
  }

  // Read api-secret for auth
  const secret = readApiSecret(undefined, resolvedInstanceRoot)
  if (!secret) {
    if (json) jsonError(ErrorCodes.API_ERROR, 'Cannot read API secret. Make sure Viben is running with the API server enabled.')
    console.error('Cannot read API secret. Make sure Viben is running with the API server enabled.')
    process.exit(1)
  }

  // Generate token name
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  const tokenName = name ?? `remote-${hh}h${mm}-${dd}-${mo}-${yyyy}`

  // Generate one-time code via API
  let codeData: { code: string; expiresAt: string }
  try {
    const body: Record<string, unknown> = { role, name: tokenName, expire }
    if (scopes) body.scopes = scopes

    const res = await apiCall(port, '/api/v1/auth/codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, resolvedInstanceRoot)

    if (!res.ok) {
      const err = await res.json() as Record<string, unknown>
      if (json) jsonError(ErrorCodes.API_ERROR, `Failed to generate code: ${err.error ?? err.message ?? 'Unknown error'}`)
      console.error(`Failed to generate code: ${err.error ?? err.message ?? 'Unknown error'}`)
      process.exit(1)
    }

    codeData = await res.json() as typeof codeData
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('process.exit')) throw err
    if (json) jsonError(ErrorCodes.API_ERROR, `Failed to generate code: ${(err as Error).message}`)
    console.error(`Failed to generate code: ${(err as Error).message}`)
    process.exit(1)
  }

  const { code, expiresAt } = codeData

  // Try to get tunnel URL
  let tunnelUrl: string | null = null
  if (!noTunnel) {
    try {
      const tunnelRes = await apiCall(port, '/api/v1/tunnel', undefined, resolvedInstanceRoot)
      if (tunnelRes.ok) {
        const data = await tunnelRes.json() as { enabled: boolean; url?: string }
        if (data.enabled && data.url) {
          tunnelUrl = data.url
        }
      }
    } catch {
      // Tunnel not available, that's fine
    }
  }

  // Build URLs
  const localUrl = `http://127.0.0.1:${port}?code=${code}`
  const tunnelLink = tunnelUrl ? `${tunnelUrl}?code=${code}` : null
  const appLink = tunnelUrl
    ? `viben://connect?host=${new URL(tunnelUrl).host}&code=${code}`
    : null

  // Format expiry for display
  const expireDisplay = expiresAt

  if (json) {
    jsonSuccess({
      code,
      name: tokenName,
      role,
      expiresAt,
      urls: {
        local: localUrl,
        tunnel: tunnelLink ?? undefined,
        app: appLink ?? undefined,
      },
    })
  }

  // Display output — metadata in box, links outside as plain text
  const W = 64
  const line = '─'.repeat(W - 4)

  console.log('')
  console.log(`  ┌${line}┐`)
  console.log(`  │  Remote Access${' '.repeat(W - 4 - 15)}│`)
  console.log(`  ├${line}┤`)
  console.log(`  │  Token:   ${tokenName}${' '.repeat(Math.max(0, W - 4 - 11 - tokenName.length))}│`)
  console.log(`  │  Role:    ${role}${' '.repeat(Math.max(0, W - 4 - 11 - role.length))}│`)
  console.log(`  │  Expires: ${expireDisplay}${' '.repeat(Math.max(0, W - 4 - 11 - expireDisplay.length))}│`)
  console.log(`  └${line}┘`)

  // Links as plain text — copyable
  console.log('')
  console.log('Local:')
  console.log(localUrl)

  if (tunnelLink) {
    console.log('')
    console.log('Tunnel:')
    console.log(tunnelLink)
  }

  if (appLink) {
    console.log('')
    console.log('App:')
    console.log(appLink)
  }

  // QR code
  if (!noQr && (tunnelLink || localUrl)) {
    console.log('')
    qrcode.generate(tunnelLink || localUrl, { small: true })
  }

  // Warning
  console.log('')
  console.log('\x1b[33m⚠\x1b[0m  Code expires in 30 minutes and can only be used once.')
  if (!tunnelLink) {
    console.log('\x1b[33m⚠\x1b[0m  No tunnel available — local link only works on same machine.')
  }
}

function extractFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag)
  if (idx === -1 || idx + 1 >= args.length) return undefined
  return args[idx + 1]
}
