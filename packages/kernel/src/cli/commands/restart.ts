import { wantsHelp } from './helpers.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'
import { printInstanceHint } from '../instance-hint.js'
import { resolveInstanceId } from '../resolve-instance-id.js'
import path from 'node:path'
import { createInstanceContext, getGlobalRoot } from '../../core/instance/instance-context.js'
import { InstanceRegistry } from '../../core/instance/instance-registry.js'
import { randomUUID } from 'node:crypto'

/**
 * `viben restart` — Stop and restart the daemon.
 *
 * Mode selection: explicit --foreground/--daemon flags win; otherwise, if a daemon
 * was running we restart as daemon, else we honour config.runMode. This logic prevents
 * a daemon that was started with `viben start` (runMode='foreground') from accidentally
 * restarting in foreground mode.
 *
 * When restarting as daemon, reinstalls autostart to refresh the node path (handles nvm
 * version changes between restarts).
 */
export async function cmdRestart(args: string[] = [], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const root = instanceRoot!
  if (!json && wantsHelp(args)) {
    console.log(`
\x1b[1mviben restart\x1b[0m — Restart the background daemon

\x1b[1mUsage:\x1b[0m
  viben restart
  viben restart --foreground    Restart in foreground mode
  viben restart --daemon        Restart as background daemon

Stops the running daemon (if any) and starts a new one.

\x1b[1mOptions:\x1b[0m
  --json          Output result as JSON
  -h, --help      Show this help message

\x1b[1mSee also:\x1b[0m
  viben start       Start the daemon
  viben stop        Stop the daemon
  viben status      Check if daemon is running
`)
    return
  }

  const forceForeground = args.includes('--foreground')
  const forceDaemon = args.includes('--daemon')

  const { stopDaemon, startDaemon, getPidPath, markRunning } = await import('../daemon.js')
  const { ConfigManager } = await import('../../core/config/config.js')
  const { checkAndPromptUpdate } = await import('../version.js')

  await checkAndPromptUpdate()

  const pidPath = getPidPath(root)

  // Stop existing daemon (ignore errors — it may not be running)
  if (!json) console.log('Stopping...')
  const stopResult = await stopDaemon(pidPath, root)
  if (!json && stopResult.stopped) {
    console.log(`Stopped daemon (was PID ${stopResult.pid})`)
  }

  const cm = new ConfigManager(path.join(root, 'config.json'))
  if (!(await cm.exists())) {
    if (json) jsonError(ErrorCodes.CONFIG_NOT_FOUND, 'No config found. Run "viben" first to set up.')
    console.error('No config found. Run "viben" first to set up.')
    process.exit(1)
  }

  await cm.load()
  const config = cm.get()

  // Determine mode: explicit flag > was-running-as-daemon > config
  // If a daemon was running (PID exists), restart as daemon to preserve the current mode.
  // `viben start` always starts as daemon regardless of config.runMode, so we must not
  // use config.runMode alone — otherwise a daemon started via `viben start` with
  // runMode:'foreground' would incorrectly restart in foreground.
  const hadDaemon = stopResult.pid !== undefined
  const useForeground = json ? false : (forceForeground || (!forceDaemon && !hadDaemon && config.runMode !== 'daemon'))

  if (useForeground) {
    // Restarting in foreground: remove any stale autostart entry so it doesn't
    // surprise the user by relaunching a daemon on next login
    try {
      const { uninstallAutoStart, isAutoStartInstalled } = await import('../autostart.js')
      const instanceId = resolveInstanceId(root)
      if (isAutoStartInstalled(instanceId)) uninstallAutoStart(instanceId)
    } catch { /* non-fatal */ }

    markRunning(root)
    printInstanceHint(root)
    console.log('Starting in foreground mode...')
    const { startServer } = await import('../../main.js')
    const reg = new InstanceRegistry(path.join(getGlobalRoot(), 'instances.json'))
    reg.load()
    const existingEntry = reg.getByRoot(root)
    const ctx = createInstanceContext({
      id: existingEntry?.id ?? randomUUID(),
      root,
    })
    await startServer({ instanceContext: ctx })
  } else {
    const result = startDaemon(pidPath, config.logging.logDir, root)
    if ('error' in result) {
      if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, result.error)
      console.error(result.error)
      process.exit(1)
    }
    // Reinstall autostart to refresh node path (e.g. after nvm version change),
    // but only if autostart was already installed before this restart
    const instanceId = resolveInstanceId(root)
    try {
      const { installAutoStart, isAutoStartInstalled } = await import('../autostart.js')
      if (isAutoStartInstalled(instanceId)) {
        const autoResult = installAutoStart(config.logging.logDir, root, instanceId)
        if (!autoResult.success) console.warn(`Warning: auto-start not refreshed: ${autoResult.error}`)
      }
    } catch { /* non-fatal */ }

    if (json) jsonSuccess({ pid: result.pid, instanceId, dir: root })
    printInstanceHint(root)
    console.log(`Viben daemon started (PID ${result.pid})`)
  }
}
