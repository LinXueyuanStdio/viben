import { readApiPort, removeStalePortFile, apiCall } from '../api-client.js'
import { wantsHelp } from './helpers.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

/**
 * Extract a human-readable error message from an API response body.
 *
 * The API can return errors in two shapes:
 *   - Structured: `{ error: { message: "...", code: "...", statusCode: N } }` (from globalErrorHandler)
 *   - Plain string: `{ error: "..." }` (from inline reply.send())
 *
 * Without this helper, `String(data.error)` produces "[object Object]" for structured errors.
 */
function extractApiError(data: Record<string, unknown>, fallback = 'API request failed'): string {
  const err = data.error
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as Record<string, unknown>).message)
  }
  return fallback
}

function printApiHelp(): void {
  console.log(`
\x1b[1mviben api\x1b[0m — Interact with the running Viben daemon

\x1b[1mUsage:\x1b[0m
  viben api <command> [options]

\x1b[1mRequires a running daemon.\x1b[0m Start with: viben start

\x1b[1mSession Commands:\x1b[0m
  viben api status                       Show active sessions
  viben api session <id>                 Show session details
  viben api new [agent] [workspace]      Create a new session
                                           [--channel <id>]
  viben api send <id> <prompt>           Send prompt to session
  viben api cancel <id>                  Cancel a session
  viben api bypass <id> on|off           Toggle bypass permissions

\x1b[1mSession Config Commands:\x1b[0m
  viben api session-config <id>                    List all config options
  viben api session-config <id> set <opt> <value>  Set a config option
  viben api session-config <id> overrides          Show clientOverrides
  viben api session-config <id> dangerous [on|off] Toggle bypassPermissions

\x1b[1mTopic Commands:\x1b[0m
  viben api topics [--status s1,s2]      List topics
  viben api delete-topic <id> [--force]  Delete a topic
  viben api cleanup [--status s1,s2]     Cleanup finished topics

\x1b[1mSystem Commands:\x1b[0m
  viben api health                       Show system health
  viben api agents                       List available agents
  viben api adapters                     List registered adapters
  viben api tunnel                       Show tunnel status
  viben api config                       Show runtime config
  viben api config set <key> <value>     Update config value
  viben api notify <message>             Send notification to all channels
  viben api restart                      Restart daemon
  viben api version                      Show daemon version

\x1b[1mOptions:\x1b[0m
  --json                                   Output result as JSON
  -h, --help                               Show this help message
`)
}

/**
 * `viben api` — Interact with the running daemon via its REST API.
 *
 * All subcommands require a running daemon. Reads the port from api.port and
 * sends authenticated HTTP requests. Removes stale port files on connection
 * failure so subsequent checks correctly report the daemon as offline.
 *
 * Subcommands: status, session, new, send, cancel, bypass, session-config,
 *              topics, delete-topic, cleanup, health, agents, adapters,
 *              tunnel, config, config set, notify, restart, version
 */
export async function cmdApi(args: string[], instanceRoot?: string): Promise<void> {
  const subCmd = args[0]

  if (wantsHelp(args) && (!subCmd || subCmd === '--help' || subCmd === '-h')) {
    printApiHelp()
    return
  }

  // Handle --help for individual api subcommands (before port check)
  if (wantsHelp(args) && subCmd) {
    const apiSubHelp: Record<string, string> = {
      'status': `
\x1b[1mviben api status\x1b[0m — Show active sessions

\x1b[1mUsage:\x1b[0m
  viben api status

Lists all active sessions with their ID, agent, status, and name.
`,
      'session': `
\x1b[1mviben api session\x1b[0m — Show session details

\x1b[1mUsage:\x1b[0m
  viben api session <id>

\x1b[1mArguments:\x1b[0m
  <id>            Session ID

Shows detailed info: agent, status, name, workspace, creation time,
bypass permissions, queue depth, and channel/thread IDs.
`,
      'new': `
\x1b[1mviben api new\x1b[0m — Create a new session

\x1b[1mUsage:\x1b[0m
  viben api new [agent] [workspace]
  viben api new [agent] --workspace <path> [--channel <id>]

\x1b[1mArguments:\x1b[0m
  [agent]         Agent name (uses default if omitted)
  [workspace]     Working directory for the session

\x1b[1mOptions:\x1b[0m
  --channel <id>  Target adapter (e.g. telegram, discord). Defaults to first registered adapter.

\x1b[1mExamples:\x1b[0m
  viben api new
  viben api new claude /path/to/project
  viben api new claude /path/to/project --channel discord
`,
      'send': `
\x1b[1mviben api send\x1b[0m — Send prompt to a session

\x1b[1mUsage:\x1b[0m
  viben api send <id> <prompt>

\x1b[1mArguments:\x1b[0m
  <id>            Session ID
  <prompt>        Prompt text (all remaining arguments are joined)

\x1b[1mExamples:\x1b[0m
  viben api send abc123 "Fix the login bug"
  viben api send abc123 refactor the auth module
`,
      'cancel': `
\x1b[1mviben api cancel\x1b[0m — Cancel a session

\x1b[1mUsage:\x1b[0m
  viben api cancel <id>

\x1b[1mArguments:\x1b[0m
  <id>            Session ID to cancel
`,
      'bypass': `
\x1b[1mviben api bypass\x1b[0m — Toggle bypass permissions for a session

\x1b[1mUsage:\x1b[0m
  viben api bypass <id> on|off

\x1b[1mArguments:\x1b[0m
  <id>            Session ID
  on|off          Enable or disable bypass permissions

Bypass permissions allows the agent to run destructive commands
without confirmation prompts.
`,
      'topics': `
\x1b[1mviben api topics\x1b[0m — List topics

\x1b[1mUsage:\x1b[0m
  viben api topics [--status <statuses>]

\x1b[1mOptions:\x1b[0m
  --status <s1,s2>  Filter by status (comma-separated)

\x1b[1mExamples:\x1b[0m
  viben api topics
  viben api topics --status active,finished
`,
      'delete-topic': `
\x1b[1mviben api delete-topic\x1b[0m — Delete a topic

\x1b[1mUsage:\x1b[0m
  viben api delete-topic <id> [--force]

\x1b[1mArguments:\x1b[0m
  <id>            Session ID of the topic to delete

\x1b[1mOptions:\x1b[0m
  --force         Delete even if session is active
`,
      'cleanup': `
\x1b[1mviben api cleanup\x1b[0m — Cleanup finished topics

\x1b[1mUsage:\x1b[0m
  viben api cleanup [--status <statuses>]

\x1b[1mOptions:\x1b[0m
  --status <s1,s2>  Filter by status (comma-separated, default: finished topics)

\x1b[1mExamples:\x1b[0m
  viben api cleanup
  viben api cleanup --status finished,error
`,
      'health': `
\x1b[1mviben api health\x1b[0m — Show system health

\x1b[1mUsage:\x1b[0m
  viben api health

Shows status, uptime, version, memory usage, session counts,
registered adapters, and tunnel status.
`,
      'agents': `
\x1b[1mviben api agents\x1b[0m — List available agents from running daemon

\x1b[1mUsage:\x1b[0m
  viben api agents

Lists agents configured in the running daemon with their names
and which one is the default.
`,
      'adapters': `
\x1b[1mviben api adapters\x1b[0m — List registered adapters

\x1b[1mUsage:\x1b[0m
  viben api adapters

Shows all channel adapters registered with the running daemon.
`,
      'tunnel': `
\x1b[1mviben api tunnel\x1b[0m — Show tunnel status

\x1b[1mUsage:\x1b[0m
  viben api tunnel

Shows whether a tunnel is enabled, the provider, and the URL.
`,
      'config': `
\x1b[1mviben api config\x1b[0m — Show or update runtime config

\x1b[1mUsage:\x1b[0m
  viben api config                       Show current runtime config
  viben api config set <key> <value>     Update a config value

\x1b[2mNote: Prefer 'viben config' instead — it works whether daemon is running or not.\x1b[0m
`,
      'restart': `
\x1b[1mviben api restart\x1b[0m — Restart the daemon

\x1b[1mUsage:\x1b[0m
  viben api restart

Sends a restart signal to the running daemon.
`,
      'notify': `
\x1b[1mviben api notify\x1b[0m — Send notification to all channels

\x1b[1mUsage:\x1b[0m
  viben api notify <message>

\x1b[1mArguments:\x1b[0m
  <message>       Notification text (all remaining arguments are joined)

\x1b[1mExamples:\x1b[0m
  viben api notify "Deployment complete"
`,
      'version': `
\x1b[1mviben api version\x1b[0m — Show daemon version

\x1b[1mUsage:\x1b[0m
  viben api version

Shows the version of the currently running daemon process.
`,
      'session-config': `
\x1b[1mviben api session-config\x1b[0m — Manage session config options

\x1b[1mUsage:\x1b[0m
  viben api session-config <id>                    List all config options
  viben api session-config <id> set <opt> <value>  Set a config option
  viben api session-config <id> overrides          Show clientOverrides
  viben api session-config <id> dangerous [on|off] Toggle bypassPermissions

\x1b[1mArguments:\x1b[0m
  <id>            Session ID
  <opt>           Config option ID (from list)
  <value>         New value for the config option

\x1b[1mExamples:\x1b[0m
  viben api session-config abc123
  viben api session-config abc123 set model claude-opus-4-5
  viben api session-config abc123 overrides
  viben api session-config abc123 dangerous on
`,
    }
    const help = apiSubHelp[subCmd]
    if (help) {
      console.log(help)
      return
    }
    // Unknown subcommand with --help, show general help
    printApiHelp()
    return
  }

  const json = isJsonMode(args)
  if (json) await muteForJson()

  const port = readApiPort(undefined, instanceRoot)
  if (port === null) {
    if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, 'Viben is not running.')
    console.error('Viben is not running. Start with `viben start`')
    process.exit(1)
  }

  const call = (urlPath: string, options?: RequestInit) => apiCall(port, urlPath, options, instanceRoot)

  try {
    if (subCmd === 'new') {
      const agent = args[1]
      const workspaceIdx = args.indexOf('--workspace')
      const workspace = workspaceIdx !== -1 ? args[workspaceIdx + 1] : args[2]
      const channelIdx = args.indexOf('--channel')
      const channel = channelIdx !== -1 ? args[channelIdx + 1] : undefined
      const body: Record<string, string> = {}
      if (agent) body.agent = agent
      if (workspace) body.workspace = workspace
      if (channel) body.channel = channel

      const res = await call('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
        console.error(`Error: ${extractApiError(data)}`)
        process.exit(1)
      }
      if (json) jsonSuccess(data)
      console.log('Session created')
      console.log(`  ID        : ${data.sessionId}`)
      console.log(`  Agent     : ${data.agent}`)
      console.log(`  Workspace : ${data.workspace}`)
      console.log(`  Status    : ${data.status}`)
      console.log(`  Channel   : ${data.channelId ?? '(headless)'}`)
      if (data.threadId) console.log(`  Thread    : ${data.threadId}`)

    } else if (subCmd === 'cancel') {
      const sessionId = args[1]
      if (!sessionId) {
        if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Session ID is required')
        console.error('Usage: viben api cancel <session-id>')
        process.exit(1)
      }
      const res = await call(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
        console.error(`Error: ${extractApiError(data)}`)
        process.exit(1)
      }
      if (json) jsonSuccess({ cancelled: true, sessionId })
      console.log(`Session ${sessionId} cancelled`)

    } else if (subCmd === 'status') {
      const res = await call('/api/sessions')
      const data = await res.json() as { sessions: Array<{ id: string; agent: string; status: string; name: string | null }> }
      if (json) jsonSuccess(data)
      if (data.sessions.length === 0) {
        console.log('No active sessions.')
      } else {
        console.log(`Active sessions: ${data.sessions.length}\n`)
        for (const s of data.sessions) {
          const name = s.name ? `  "${s.name}"` : ''
          console.log(`  ${s.id}  ${s.agent}  ${s.status}${name}`)
        }
      }

    } else if (subCmd === 'agents') {
      const res = await call('/api/agents')
      const data = await res.json() as { agents: Array<{ name: string; command: string; args: string[] }>; default: string }
      if (json) jsonSuccess(data)
      console.log('Available agents:')
      for (const a of data.agents) {
        const isDefault = a.name === data.default ? ' (default)' : ''
        console.log(`  ${a.name}${isDefault}`)
      }

    } else if (subCmd === 'topics') {
      const statusIdx = args.indexOf('--status')
      const statusParam = statusIdx !== -1 ? args[statusIdx + 1] : undefined
      const query = statusParam ? `?status=${encodeURIComponent(statusParam)}` : ''
      const res = await call(`/api/topics${query}`)
      const data = await res.json() as { topics: Array<{ sessionId: string; topicId: number | null; name: string | null; status: string; agentName: string; lastActiveAt: string }> }
      if (json) jsonSuccess(data)
      if (data.topics.length === 0) {
        console.log('No topics found.')
      } else {
        console.log(`Topics: ${data.topics.length}\n`)
        for (const t of data.topics) {
          const name = t.name ? `  "${t.name}"` : ''
          const topic = t.topicId ? `Topic #${t.topicId}` : 'headless'
          console.log(`  ${t.sessionId}  ${t.agentName}  ${t.status}${name}      ${topic}`)
        }
      }

    } else if (subCmd === 'delete-topic') {
      const sessionId = args[1]
      if (!sessionId) {
        if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Session ID is required')
        console.error('Usage: viben api delete-topic <session-id> [--force]')
        process.exit(1)
      }
      const force = args.includes('--force')
      const query = force ? '?force=true' : ''
      const res = await call(`/api/topics/${encodeURIComponent(sessionId)}${query}`, { method: 'DELETE' })
      const data = await res.json() as Record<string, unknown>
      if (res.status === 409) {
        const session = data.session as Record<string, unknown> | undefined
        if (json) jsonError(ErrorCodes.API_ERROR, `Session "${sessionId}" is active (${session?.status}). Use --force to delete.`)
        console.error(`Session "${sessionId}" is active (${session?.status}). Use --force to delete.`)
        process.exit(1)
      }
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
        console.error(`Error: ${extractApiError(data)}`)
        process.exit(1)
      }
      if (json) jsonSuccess(data)
      const topicLabel = data.topicId ? `Topic #${data.topicId}` : 'headless session'
      console.log(`${topicLabel} deleted (session ${sessionId})`)

    } else if (subCmd === 'cleanup') {
      const statusIdx = args.indexOf('--status')
      const statusParam = statusIdx !== -1 ? args[statusIdx + 1] : undefined
      const body: Record<string, unknown> = {}
      if (statusParam) body.statuses = statusParam.split(',')
      const res = await call('/api/topics/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { deleted: string[]; failed: Array<{ sessionId: string; error: string }> }
      if (json) jsonSuccess(data)
      if (data.deleted.length === 0 && data.failed.length === 0) {
        console.log('Nothing to clean up.')
      } else {
        console.log(`Cleaned up ${data.deleted.length} topics${data.deleted.length ? ': ' + data.deleted.join(', ') : ''} (${data.failed.length} failed)`)
        for (const f of data.failed) {
          console.error(`  Failed: ${f.sessionId} — ${f.error}`)
        }
      }

    } else if (subCmd === 'send') {
      const sessionId = args[1]
      if (!sessionId) {
        if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Session ID is required')
        console.error('Usage: viben api send <session-id> <prompt>')
        process.exit(1)
      }
      const prompt = args.slice(2).join(' ')
      if (!prompt) {
        if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Prompt is required')
        console.error('Usage: viben api send <session-id> <prompt>')
        process.exit(1)
      }
      const res = await call(`/api/sessions/${encodeURIComponent(sessionId)}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
        console.error(`Error: ${extractApiError(data)}`)
        process.exit(1)
      }
      if (json) jsonSuccess(data)
      console.log(`Prompt sent to session ${sessionId} (queue depth: ${data.queueDepth})`)

    } else if (subCmd === 'session') {
      const sessionId = args[1]
      if (!sessionId) {
        if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Session ID is required')
        console.error('Usage: viben api session <session-id>')
        process.exit(1)
      }
      const res = await call(`/api/sessions/${encodeURIComponent(sessionId)}`)
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
        console.error(`Error: ${extractApiError(data)}`)
        process.exit(1)
      }
      if (json) jsonSuccess(data)
      const s = (data.session ?? data) as Record<string, unknown>
      console.log(`Session details:`)
      console.log(`  ID             : ${s.id}`)
      console.log(`  Agent          : ${s.agent}`)
      console.log(`  Status         : ${s.status}`)
      console.log(`  Name           : ${s.name ?? '(none)'}`)
      console.log(`  Workspace      : ${s.workspace}`)
      console.log(`  Created        : ${s.createdAt}`)
      console.log(`  Dangerous      : ${s.dangerousMode}`)
      console.log(`  Queue depth    : ${s.queueDepth}`)
      console.log(`  Prompt active  : ${s.promptRunning}`)
      console.log(`  Channel        : ${s.channelId ?? '(none)'}`)
      console.log(`  Thread         : ${s.threadId ?? '(none)'}`)

    } else if (subCmd === 'dangerous' || subCmd === 'bypass') {
      const sessionId = args[1]
      if (!sessionId) {
        if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Session ID is required')
        console.error('Usage: viben api bypass <session-id> [on|off]')
        process.exit(1)
      }
      const toggle = args[2]
      if (!toggle || (toggle !== 'on' && toggle !== 'off')) {
        if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Toggle value (on|off) is required')
        console.error('Usage: viben api bypass <session-id> [on|off]')
        process.exit(1)
      }
      const res = await call(`/api/sessions/${encodeURIComponent(sessionId)}/dangerous`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: toggle === 'on' }),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
        console.error(`Error: ${extractApiError(data)}`)
        process.exit(1)
      }
      if (json) jsonSuccess(data)
      const state = toggle === 'on' ? 'enabled' : 'disabled'
      console.log(`Bypass permissions ${state} for session ${sessionId}`)

    } else if (subCmd === 'health') {
      const res = await call('/api/health')
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
        console.error(`Error: ${extractApiError(data)}`)
        process.exit(1)
      }
      if (json) jsonSuccess(data)
      const uptimeMs = typeof data.uptime === 'number' ? data.uptime : 0
      const uptimeSeconds = Math.floor(uptimeMs / 1000)
      const hours = Math.floor(uptimeSeconds / 3600)
      const minutes = Math.floor((uptimeSeconds % 3600) / 60)
      const mem = data.memory as Record<string, number> | undefined
      const memoryMB = mem ? (mem.rss / 1024 / 1024).toFixed(1) : '0.0'
      const sessions = data.sessions as Record<string, unknown> ?? {}
      const tunnel = data.tunnel as Record<string, unknown> | undefined
      const tunnelStr = tunnel?.enabled ? `${tunnel.url}` : 'disabled'
      const adapters = Array.isArray(data.adapters) ? data.adapters.join(', ') : String(data.adapters ?? 'none')
      console.log(`Status   : ${data.status}`)
      console.log(`Uptime   : ${hours}h ${minutes}m`)
      console.log(`Version  : ${data.version}`)
      console.log(`Memory   : ${memoryMB} MB`)
      console.log(`Sessions : ${sessions.active ?? 0} active / ${sessions.total ?? 0} total`)
      console.log(`Adapters : ${adapters}`)
      console.log(`Tunnel   : ${tunnelStr}`)

    } else if (subCmd === 'restart') {
      const res = await call('/api/restart', { method: 'POST' })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
        console.error(`Error: ${extractApiError(data)}`)
        process.exit(1)
      }
      if (json) jsonSuccess({ restarted: true })
      console.log('Restart signal sent. Viben is restarting...')

    } else if (subCmd === 'config') {
      console.warn('⚠️  Deprecated: use "viben config" or "viben config set" instead.')
      const subSubCmd = args[1]
      if (!subSubCmd) {
        const res = await call('/api/config')
        const data = await res.json() as Record<string, unknown>
        if (!res.ok) {
          if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
          console.error(`Error: ${extractApiError(data)}`)
          process.exit(1)
        }
        if (json) jsonSuccess(data)
        console.log(JSON.stringify(data.config, null, 2))
      } else if (subSubCmd === 'set') {
        const configPath = args[2]
        const configValue = args[3]
        if (!configPath || configValue === undefined) {
          if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Config path and value are required')
          console.error('Usage: viben api config set <path> <value>')
          process.exit(1)
        }
        let value: unknown = configValue
        try {
          value = JSON.parse(configValue)
        } catch {
          // keep as string
        }
        const res = await call('/api/config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: configPath, value }),
        })
        const data = await res.json() as Record<string, unknown>
        if (!res.ok) {
          if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
          console.error(`Error: ${extractApiError(data)}`)
          process.exit(1)
        }
        if (json) jsonSuccess(data)
        console.log(`Config updated: ${configPath} = ${JSON.stringify(value)}`)
        if (data.needsRestart) {
          console.log('Note: restart required for this change to take effect.')
        }
      } else {
        if (json) jsonError(ErrorCodes.UNKNOWN_COMMAND, `Unknown config subcommand: ${subSubCmd}`)
        console.error(`Unknown config subcommand: ${subSubCmd}`)
        console.log('  viben api config                       Show runtime config')
        console.log('  viben api config set <key> <value>     Update config value')
        process.exit(1)
      }

    } else if (subCmd === 'adapters') {
      const res = await call('/api/adapters')
      const data = await res.json() as { adapters: Array<{ name: string; type: string }> }
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, String((data as Record<string, unknown>).error ?? 'API request failed'))
        console.error(`Error: ${(data as Record<string, unknown>).error}`)
        process.exit(1)
      }
      if (json) jsonSuccess(data)
      console.log('Registered adapters:')
      for (const a of data.adapters) {
        console.log(`  ${a.name}  (${a.type})`)
      }

    } else if (subCmd === 'tunnel') {
      const res = await call('/api/tunnel')
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
        console.error(`Error: ${extractApiError(data)}`)
        process.exit(1)
      }
      if (json) jsonSuccess(data)
      if (data.enabled) {
        console.log(`Tunnel provider : ${data.provider}`)
        console.log(`Tunnel URL      : ${data.url}`)
      } else {
        console.log('Tunnel: not enabled')
      }

    } else if (subCmd === 'notify') {
      const message = args.slice(1).join(' ')
      if (!message) {
        if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Message is required')
        console.error('Usage: viben api notify <message>')
        process.exit(1)
      }
      const res = await call('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
        console.error(`Error: ${extractApiError(data)}`)
        process.exit(1)
      }
      if (json) jsonSuccess({ sent: true })
      console.log('Notification sent to all channels.')

    } else if (subCmd === 'version') {
      const res = await call('/api/version')
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
        console.error(`Error: ${extractApiError(data)}`)
        process.exit(1)
      }
      if (json) jsonSuccess(data)
      console.log(`Daemon version: ${data.version}`)

    } else if (subCmd === 'session-config') {
      const sessionId = args[1]
      if (!sessionId) {
        if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Session ID is required')
        console.error('Usage: viben api session-config <session-id> [set <opt> <value> | overrides | dangerous [on|off]]')
        process.exit(1)
      }
      const configSubCmd = args[2]

      if (!configSubCmd || configSubCmd === 'list') {
        // List all config options
        const res = await call(`/api/sessions/${encodeURIComponent(sessionId)}/config`)
        const data = await res.json() as Record<string, unknown>
        if (!res.ok) {
          if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
          console.error(`Error: ${extractApiError(data)}`)
          process.exit(1)
        }
        if (json) jsonSuccess(data)
        const configOptions = data.configOptions as Array<Record<string, unknown>> | undefined
        const clientOverrides = data.clientOverrides as Record<string, unknown> | undefined
        if (!configOptions || configOptions.length === 0) {
          console.log('No config options available for this session.')
        } else {
          console.log(`Config options for session ${sessionId}:\n`)
          for (const opt of configOptions) {
            const desc = opt.description ? `  ${opt.description}` : ''
            console.log(`  [${opt.id}]  ${opt.name}  (${opt.type})  current: ${opt.currentValue}${desc}`)
            if (opt.type === 'select') {
              const options = opt.options as Array<Record<string, unknown>> | undefined
              if (options && options.length > 0) {
                const choices = options.flatMap((o) => {
                  if ('group' in o) {
                    const groupOpts = o.options as Array<{ value: string; name: string }> | undefined
                    return groupOpts?.map((c) => `${c.value} (${c.name})`) ?? []
                  }
                  return [`${o.value} (${o.name})`]
                })
                console.log(`    choices: ${choices.join(', ')}`)
              }
            }
          }
        }
        if (clientOverrides && Object.keys(clientOverrides).length > 0) {
          console.log(`\nClient overrides: ${JSON.stringify(clientOverrides)}`)
        }

      } else if (configSubCmd === 'set') {
        const configId = args[3]
        const value = args[4]
        if (!configId || value === undefined) {
          if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Config ID and value are required')
          console.error('Usage: viben api session-config <session-id> set <config-id> <value>')
          process.exit(1)
        }
        const res = await call(`/api/sessions/${encodeURIComponent(sessionId)}/config/${encodeURIComponent(configId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        })
        const data = await res.json() as Record<string, unknown>
        if (!res.ok) {
          if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
          console.error(`Error: ${extractApiError(data)}`)
          process.exit(1)
        }
        if (json) jsonSuccess(data)
        console.log(`Config option "${configId}" updated to "${value}"`)
        const configOptions = data.configOptions as Array<Record<string, unknown>> | undefined
        const updated = configOptions?.find((o) => o.id === configId)
        if (updated) {
          console.log(`  Current value: ${updated.currentValue}`)
        }

      } else if (configSubCmd === 'overrides') {
        // Show clientOverrides
        const res = await call(`/api/sessions/${encodeURIComponent(sessionId)}/config/overrides`)
        const data = await res.json() as Record<string, unknown>
        if (!res.ok) {
          if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
          console.error(`Error: ${extractApiError(data)}`)
          process.exit(1)
        }
        if (json) jsonSuccess(data)
        const overrides = data.clientOverrides as Record<string, unknown> | undefined
        if (!overrides || Object.keys(overrides).length === 0) {
          console.log('No client overrides set.')
        } else {
          console.log(`Client overrides for session ${sessionId}:`)
          for (const [key, val] of Object.entries(overrides)) {
            console.log(`  ${key}: ${val}`)
          }
        }

      } else if (configSubCmd === 'dangerous') {
        const toggle = args[3]
        if (toggle && toggle !== 'on' && toggle !== 'off') {
          if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Toggle value must be on or off')
          console.error('Usage: viben api session-config <session-id> dangerous [on|off]')
          process.exit(1)
        }
        if (toggle) {
          // Set bypassPermissions
          const res = await call(`/api/sessions/${encodeURIComponent(sessionId)}/config/overrides`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bypassPermissions: toggle === 'on' }),
          })
          const data = await res.json() as Record<string, unknown>
          if (!res.ok) {
            if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
            console.error(`Error: ${extractApiError(data)}`)
            process.exit(1)
          }
          if (json) jsonSuccess(data)
          const state = toggle === 'on' ? 'enabled' : 'disabled'
          console.log(`bypassPermissions ${state} for session ${sessionId}`)
        } else {
          // Show current state
          const res = await call(`/api/sessions/${encodeURIComponent(sessionId)}/config/overrides`)
          const data = await res.json() as Record<string, unknown>
          if (!res.ok) {
            if (json) jsonError(ErrorCodes.API_ERROR, extractApiError(data))
            console.error(`Error: ${extractApiError(data)}`)
            process.exit(1)
          }
          if (json) jsonSuccess(data)
          const overrides = data.clientOverrides as Record<string, unknown> | undefined
          const bypass = overrides?.bypassPermissions
          console.log(`bypassPermissions: ${bypass ?? false}`)
        }

      } else {
        if (json) jsonError(ErrorCodes.UNKNOWN_COMMAND, `Unknown session-config subcommand: ${configSubCmd}`)
        console.error(`Unknown session-config subcommand: ${configSubCmd}`)
        console.log('  viben api session-config <id>                    List config options')
        console.log('  viben api session-config <id> set <opt> <value>  Set a config option')
        console.log('  viben api session-config <id> overrides          Show clientOverrides')
        console.log('  viben api session-config <id> dangerous [on|off] Toggle bypassPermissions')
        process.exit(1)
      }

    } else {
      const { suggestMatch } = await import('../suggest.js')
      const apiSubcommands = [
        'new', 'cancel', 'status', 'agents', 'topics', 'delete-topic',
        'cleanup', 'send', 'session', 'bypass', 'dangerous', 'health', 'restart',
        'config', 'adapters', 'tunnel', 'notify', 'version', 'session-config',
      ]
      const suggestion = suggestMatch(subCmd ?? '', apiSubcommands)
      if (json) jsonError(ErrorCodes.UNKNOWN_COMMAND, `Unknown api command: ${subCmd || '(none)'}`)
      console.error(`Unknown api command: ${subCmd || '(none)'}\n`)
      if (suggestion) console.error(`Did you mean: ${suggestion}?\n`)
      printApiHelp()
      process.exit(1)
    }
  } catch (err) {
    // jsonSuccess/jsonError call process.exit which may throw in certain environments
    if (err instanceof Error && err.message.startsWith('process.exit')) throw err
    // Node.js wraps low-level TCP errors from fetch() as TypeError with a cause.code —
    // ECONNREFUSED means the port file exists but nothing is listening on that port (stale).
    // Remove the port file so the next `viben start` doesn't refuse to launch.
    if (err instanceof TypeError && (err.cause as Record<string, unknown> | undefined)?.code === 'ECONNREFUSED') {
      if (json) jsonError(ErrorCodes.API_ERROR, 'Viben is not running (stale port file)')
      console.error('Viben is not running (stale port file)')
      removeStalePortFile(undefined, instanceRoot)
      process.exit(1)
    }
    if (json) jsonError(ErrorCodes.API_ERROR, (err as Error).message)
    throw err
  }
}
