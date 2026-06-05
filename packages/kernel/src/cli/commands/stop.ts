import { wantsHelp } from './helpers.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'
import { resolveInstanceId } from '../resolve-instance-id.js'

/**
 * `viben stop` — Stop the running daemon.
 *
 * Sends SIGTERM and waits for the process to exit. Also uninstalls the autostart
 * service so the daemon stays stopped after the next login/reboot.
 */
export async function cmdStop(args: string[] = [], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const root = instanceRoot!
  if (!json && wantsHelp(args)) {
    console.log(`
\x1b[1mviben stop\x1b[0m — Stop the background daemon

\x1b[1mUsage:\x1b[0m
  viben stop

Sends a stop signal to the running Viben daemon process.

\x1b[1mOptions:\x1b[0m
  --json          Output result as JSON
  -h, --help      Show this help message
`)
    return
  }
  const { stopDaemon, getPidPath } = await import('../daemon.js')
  const result = await stopDaemon(getPidPath(root), root)
  if (result.stopped) {
    // Remove autostart so daemon stays stopped after reboot
    try {
      const { uninstallAutoStart } = await import('../autostart.js')
      uninstallAutoStart(resolveInstanceId(root))
    } catch { /* non-fatal */ }

    if (json) jsonSuccess({ stopped: true, pid: result.pid })
    console.log(`Viben daemon stopped (was PID ${result.pid})`)
  } else {
    if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, result.error ?? 'Daemon is not running.')
    console.error(result.error)
    process.exit(1)
  }
}
