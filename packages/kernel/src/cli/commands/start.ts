import { checkAndPromptUpdate } from '../version.js'
import { wantsHelp } from './helpers.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'
import { printInstanceHint } from '../instance-hint.js'
import { resolveInstanceId } from '../resolve-instance-id.js'
import path from 'node:path'

/**
 * `viben start` — Start the daemon in the background.
 *
 * Forks a detached child process via startDaemon(), installs the login-time autostart
 * service, then returns immediately. In JSON mode, waits for the daemon to write api.port
 * before outputting the result so callers get the actual bound port.
 */
export async function cmdStart(args: string[] = [], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const root = instanceRoot!
  if (!json && wantsHelp(args)) {
    console.log(`
\x1b[1mviben start\x1b[0m — Start Viben as a background daemon

\x1b[1mUsage:\x1b[0m
  viben start

Starts the server as a background process (daemon mode).
Requires an existing config — run 'viben' first to set up.

\x1b[1mOptions:\x1b[0m
  --json          Output result as JSON
  -h, --help      Show this help message

\x1b[1mSee also:\x1b[0m
  viben stop       Stop the daemon
  viben restart    Restart the daemon
  viben status     Check if daemon is running
  viben logs       Tail daemon log file
`)
    return
  }
  await checkAndPromptUpdate()
  const { startDaemon, getPidPath, isProcessRunning } = await import('../daemon.js')
  const { ConfigManager } = await import('../../core/config/config.js')
  const cm = new ConfigManager(path.join(root, 'config.json'))
  if (await cm.exists()) {
    await cm.load()
    const config = cm.get()
    const pidPath = getPidPath(root)
    if (isProcessRunning(pidPath)) {
      if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, 'Daemon is already running. Use "viben restart" to restart it.')
      console.error('Viben daemon is already running. Use "viben restart" to restart it.')
      process.exit(1)
    }
    const result = startDaemon(pidPath, config.logging.logDir, root)
    if ('error' in result) {
      if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, result.error)
      console.error(result.error)
      process.exit(1)
    }
    // Install autostart before JSON output (jsonSuccess exits)
    // instanceId is resolved here so installAutoStart can use it for per-instance
    // service naming — each workspace gets its own launchd/systemd service entry.
    const instanceId = resolveInstanceId(root)
    try {
      const { installAutoStart } = await import('../autostart.js')
      const autoResult = installAutoStart(config.logging.logDir, root, instanceId)
      if (!autoResult.success) console.warn(`Warning: auto-start not enabled: ${autoResult.error}`)
    } catch (e) { console.warn(`Warning: auto-start not enabled: ${(e as Error).message}`) }

    if (json) {
      // Wait for the daemon to write api.port (up to 5 seconds)
      const { waitForPortFile } = await import('../api-client.js')
      const port = await waitForPortFile(path.join(root, 'api.port')) ?? 21420
      jsonSuccess({
        pid: result.pid,
        instanceId,
        name: config.instanceName ?? null,
        directory: path.dirname(root),
        dir: root,
        port,
      })
    }
    printInstanceHint(root)
    console.log(`Viben daemon started (PID ${result.pid})`)
  } else {
    if (json) jsonError(ErrorCodes.CONFIG_NOT_FOUND, 'No config found. Run "viben" first to set up.')
    console.error('No config found. Run "viben" first to set up.')
    process.exit(1)
  }
}
