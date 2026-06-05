import { checkAndPromptUpdate } from '../version.js'
import { printHelp } from './help.js'
import path from 'node:path'
import { createInstanceContext, getGlobalRoot } from '../../core/instance/instance-context.js'
import { InstanceRegistry } from '../../core/instance/instance-registry.js'
import { randomUUID } from 'node:crypto'
import { printInstanceHint } from '../instance-hint.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'
import { resolveInstanceId } from '../resolve-instance-id.js'

/**
 * The default command — runs when no recognized subcommand is given.
 *
 * Behavior:
 * - If no config exists: runs the setup wizard, then starts the server.
 * - If config exists and runMode is 'daemon': starts the daemon. If daemon is already
 *   running, shows an interactive menu (restart, stop, logs, etc.).
 * - If config exists and runMode is 'foreground' (or --foreground flag): starts the
 *   server in-process and blocks until shutdown.
 *
 * Also handles unknown command detection (typos) before reaching this path.
 */
export async function cmdDefault(command: string | undefined, instanceRoot?: string): Promise<void> {
  const args = command ? [command] : []
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const root = instanceRoot!
  const pluginsDataDir = path.join(root, 'plugins', 'data')
  const registryPath = path.join(root, 'plugins.json')
  const forceForeground = command === '--foreground'

  // Reject unknown commands
  if (command && !command.startsWith('-')) {
    const { suggestMatch } = await import('../suggest.js')
    const topLevelCommands = [
      'start', 'stop', 'status', 'logs', 'config', 'reset', 'update',
      'install', 'uninstall', 'plugins', 'plugin', 'api', 'adopt', 'integrate', 'doctor', 'agents', 'onboard',
      'attach',
    ]
    const suggestion = suggestMatch(command, topLevelCommands)
    console.error(`Unknown command: ${command}`)
    if (suggestion) console.error(`Did you mean: ${suggestion}?`)
    printHelp()
    process.exit(1)
  }

  await checkAndPromptUpdate()

  const { ConfigManager } = await import('../../core/config/config.js')
  const configPath = path.join(root, 'config.json')
  const cm = new ConfigManager(configPath)

  // If no config, run setup first
  if (!(await cm.exists())) {
    const { SettingsManager } = await import('../../core/plugin/settings-manager.js')
    const { PluginRegistry } = await import('../../core/plugin/plugin-registry.js')
    const settingsManager = new SettingsManager(pluginsDataDir)
    const pluginRegistry = new PluginRegistry(registryPath)
    await pluginRegistry.load()

    const { runSetup } = await import('../../core/setup/index.js')
    const shouldStart = await runSetup(cm, { settingsManager, pluginRegistry, instanceRoot: root })
    if (!shouldStart) process.exit(0)
  }

  await cm.load()
  const config = cm.get()

  // Check if daemon is already running before trying to start
  if (!forceForeground && config.runMode === 'daemon') {
    const { isProcessRunning, getPidPath, startDaemon } = await import('../daemon.js')
    const pidPath = getPidPath(root)

    if (isProcessRunning(pidPath)) {
      await showAlreadyRunningMenu(root)
      return
    }

    const result = startDaemon(pidPath, config.logging.logDir, root)
    if ('error' in result) {
      if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, result.error)
      console.error(result.error)
      process.exit(1)
    }
    // Install autostart before JSON output (jsonSuccess exits)
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
    return
  }

  const { markRunning } = await import('../daemon.js')
  markRunning(root)
  printInstanceHint(root)
  const { startServer } = await import('../../main.js')
  const reg = new InstanceRegistry(path.join(getGlobalRoot(), 'instances.json'))
  reg.load()
  const existingEntry = reg.getByRoot(root)
  const instanceId = existingEntry?.id ?? randomUUID()
  const ctx = createInstanceContext({
    id: instanceId,
    root,
  })

  if (json) {
    // For foreground mode, JSON is output before startServer() so the actual bound port
    // is not yet known. Callers should poll api.port for the real value after startup.
    const port = 21420
    jsonSuccess({
      pid: process.pid,
      instanceId,
      name: config.instanceName ?? null,
      directory: path.dirname(root),
      dir: root,
      port,
    })
  }

  await startServer({ instanceContext: ctx })
}

/**
 * Show an interactive menu when the user runs `viben` and the daemon is already running.
 * Falls back to a plain text suggestion on non-TTY (scripts, CI).
 */
async function showAlreadyRunningMenu(root: string): Promise<void> {
  const { formatInstanceStatus } = await import('./status.js')

  console.log('')
  console.log('\x1b[1mViben is already running\x1b[0m')
  console.log('')

  const status = formatInstanceStatus(root)
  if (status) {
    for (const line of status.lines) {
      console.log(line)
    }
    console.log('')
  }

  // TTY: interactive menu
  const { showInteractiveMenu } = await import('../interactive-menu.js')

  // Options ordered for two-column layout: r/f, s/l, q
  const shown = await showInteractiveMenu([
    {
      key: 'r', label: 'Restart',
      action: async () => {
        const { cmdRestart } = await import('./restart.js')
        await cmdRestart([], root)
      },
    },
    {
      key: 's', label: 'Stop',
      action: async () => {
        const { cmdStop } = await import('./stop.js')
        await cmdStop([], root)
      },
    },
    {
      key: 'q', label: 'Quit',
      action: () => { /* exit naturally */ },
    },
    {
      key: 'f', label: 'Restart in foreground',
      action: async () => {
        const { cmdRestart } = await import('./restart.js')
        await cmdRestart(['--foreground'], root)
      },
    },
    {
      key: 'l', label: 'View logs',
      action: async () => {
        const { cmdLogs } = await import('./logs.js')
        await cmdLogs([], root)
      },
    },
  ])

  // Non-TTY: print suggestions and exit
  if (!shown) {
    console.log('  Use: viben restart | viben stop | viben logs')
    console.log('')
  }
}
