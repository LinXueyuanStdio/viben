import { readApiPort } from '../api-client.js'
import { wantsHelp } from './helpers.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'
import { resolveRunningInstance } from '../../core/instance/instance-context.js'

/**
 * `viben adopt` — Transfer an existing external agent session into Viben.
 *
 * Finds the running daemon instance closest to --cwd (via resolveRunningInstance),
 * then calls the daemon's /api/sessions/adopt endpoint. The daemon creates an Viben
 * session wrapping the external session ID, making it visible in the messaging platform.
 *
 * This command is typically called from agent handoff scripts (viben-handoff.sh).
 */
export async function cmdAdopt(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log(`
\x1b[1mviben adopt\x1b[0m — Adopt an external agent session

\x1b[1mUsage:\x1b[0m
  viben adopt <agent> <session_id> [--cwd <path>] [--channel <name>]

\x1b[1mArguments:\x1b[0m
  <agent>         Agent name (e.g. claude)
  <session_id>    External session ID to adopt

\x1b[1mOptions:\x1b[0m
  --cwd <path>       Working directory for the session (default: current dir)
  --channel <name>   Target channel adapter (e.g. telegram, discord). Default: first registered
  --json             Output result as JSON
  -h, --help         Show this help message

Transfers an existing agent session into Viben so it appears
as a messaging thread. Requires a running daemon.

\x1b[1mExamples:\x1b[0m
  viben adopt claude abc123-def456
  viben adopt claude abc123 --cwd /path/to/project
  viben adopt claude abc123 --channel discord
`)
    return
  }

  const json = isJsonMode(args)
  if (json) await muteForJson()

  // Parse positional args — skip known flags and their values
  const skipFlags = new Set(['--json', '-h', '--help'])
  const skipWithValue = new Set(['--cwd', '--channel'])
  const positional: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (skipWithValue.has(args[i]!)) { i++; continue }
    if (skipFlags.has(args[i]!)) continue
    positional.push(args[i]!)
  }
  const agent = positional[0]
  const sessionId = positional[1]

  if (!agent || !sessionId) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Missing required arguments: <agent> and <session_id>')
    console.log("Usage: viben adopt <agent> <session_id> [--cwd <path>] [--channel <name>]");
    console.log("Example: viben adopt claude abc123-def456 --cwd /path/to/project");
    process.exit(1);
  }

  const cwdIdx = args.indexOf("--cwd");
  const cwd = cwdIdx !== -1 && args[cwdIdx + 1] ? args[cwdIdx + 1] : process.cwd();
  const channelIdx = args.indexOf("--channel");
  const channel = channelIdx !== -1 && args[channelIdx + 1] ? args[channelIdx + 1] : undefined;

  const instanceRoot = await resolveRunningInstance(cwd);
  const port = instanceRoot ? readApiPort(undefined, instanceRoot) : null;
  if (!port) {
    if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, 'No running Viben instance found. Start one with: viben start')
    console.log("No running Viben instance found. Start one with: viben start");
    process.exit(1);
  }

  try {
    const { apiCall } = await import('../api-client.js')
    const res = await apiCall(port, '/api/sessions/adopt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, agentSessionId: sessionId, cwd, channel }),
    }, instanceRoot ?? undefined)
    const data = await res.json() as Record<string, unknown>;

    if (data.ok) {
      if (json) jsonSuccess({ sessionId: data.sessionId, threadId: data.threadId, agent, status: data.status ?? 'new' })
      if (data.status === "existing") {
        console.log(`Session already active. Topic pinged.`);
      } else {
        console.log(`Session transferred to messaging platform.`);
      }
      console.log(`  Session ID: ${data.sessionId}`);
      console.log(`  Thread ID:  ${data.threadId}`);
    } else {
      if (json) jsonError(ErrorCodes.API_ERROR, `${(data.message as string) || (data.error as string) || 'Unknown error'}`)
      console.log(`Error: ${(data.message as string) || (data.error as string)}`);
      process.exit(1);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('process.exit')) throw err
    if (json) jsonError(ErrorCodes.API_ERROR, `Failed to connect to Viben: ${err instanceof Error ? err.message : err}`)
    console.log(`Failed to connect to Viben: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
