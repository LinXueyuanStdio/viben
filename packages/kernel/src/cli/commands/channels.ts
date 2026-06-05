import { readApiPort } from '../api-client.js'
import { wantsHelp } from './helpers.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'
import { resolveRunningInstance } from '../../core/instance/instance-context.js'

/**
 * `viben channels` — List channel adapters currently connected to the daemon.
 *
 * Queries the running daemon instance for its registered adapters (Telegram, Slack, SSE, etc.).
 * Useful for scripting handoffs when you need to know which channels are available before
 * choosing a target.
 *
 * This command uses the same no-instance-root pattern as `viben adopt`: it finds the
 * daemon via CWD traversal and calls the REST API directly.
 */
export async function cmdChannels(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log(`
\x1b[1mviben channels\x1b[0m — List connected channel adapters

\x1b[1mUsage:\x1b[0m
  viben channels [--cwd <path>] [--json]

\x1b[1mOptions:\x1b[0m
  --cwd <path>   Working directory for instance lookup (default: current dir)
  --json         Output result as JSON
  -h, --help     Show this help message

Lists all channel adapters that are currently registered with the running
Viben daemon (e.g. telegram, slack, sse).

\x1b[1mExamples:\x1b[0m
  viben channels
  viben channels --json
`)
    return
  }

  const json = isJsonMode(args)
  if (json) await muteForJson()

  const cwdIdx = args.indexOf('--cwd')
  const cwd = cwdIdx !== -1 && args[cwdIdx + 1] ? args[cwdIdx + 1]! : process.cwd()

  const instanceRoot = await resolveRunningInstance(cwd)
  const port = instanceRoot ? readApiPort(undefined, instanceRoot) : null
  if (!port) {
    if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, 'No running Viben instance found. Start one with: viben start')
    console.log('No running Viben instance found. Start one with: viben start')
    process.exit(1)
  }

  try {
    const { apiCall } = await import('../api-client.js')
    const res = await apiCall(port, '/api/system/adapters', { method: 'GET' }, instanceRoot ?? undefined)
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>
      const msg = (body.error as string) ?? `HTTP ${res.status}`
      if (json) jsonError(ErrorCodes.API_ERROR, `Failed to fetch adapters: ${msg}`)
      console.log(`Failed to fetch adapters: ${msg}`)
      process.exit(1)
    }

    const data = await res.json() as { adapters?: { name: string; type: string }[] }

    const adapters = data.adapters ?? []

    if (json) {
      jsonSuccess({ channels: adapters.map((a) => a.name) })
      return
    }

    if (adapters.length === 0) {
      console.log('No channel adapters connected.')
      return
    }

    console.log('Connected channels:')
    for (const adapter of adapters) {
      console.log(`  ${adapter.name}`)
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('process.exit')) throw err
    if (json) jsonError(ErrorCodes.API_ERROR, `Failed to connect to Viben: ${err instanceof Error ? err.message : err}`)
    console.log(`Failed to connect to Viben: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
}
