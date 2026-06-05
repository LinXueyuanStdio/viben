import path from 'node:path'
import { wantsHelp } from './helpers.js'

/**
 * `viben autostart` — Manage OS-level auto-start for the daemon.
 *
 * Subcommands:
 * - install: registers a LaunchAgent (macOS) or systemd user unit (Linux)
 * - uninstall: removes the service registration
 * - status: checks whether the service is currently installed
 */
export async function cmdAutostart(args: string[] = [], instanceRoot?: string): Promise<void> {
  const subcommand = args[0]

  if (!subcommand || wantsHelp(args)) {
    console.log(`
\x1b[1mviben autostart\x1b[0m — Manage auto-start on login

\x1b[1mUsage:\x1b[0m
  viben autostart install     Install LaunchAgent (macOS) or systemd unit (Linux)
  viben autostart uninstall   Remove auto-start service
  viben autostart status      Show whether auto-start is installed

\x1b[1mOptions:\x1b[0m
  -h, --help      Show this help message
`)
    return
  }

  const { installAutoStart, uninstallAutoStart, isAutoStartInstalled, isAutoStartSupported } = await import('../autostart.js')
  const { resolveInstanceId } = await import('../resolve-instance-id.js')
  const instanceId = resolveInstanceId(instanceRoot!)

  if (subcommand === 'status') {
    if (!isAutoStartSupported()) {
      console.log('Auto-start is not supported on this platform.')
      return
    }
    const installed = isAutoStartInstalled(instanceId)
    console.log(`Auto-start: ${installed ? '\x1b[32minstalled\x1b[0m' : '\x1b[33mnot installed\x1b[0m'}`)
    return
  }

  if (subcommand === 'install') {
    if (!isAutoStartSupported()) {
      console.error('Auto-start is not supported on this platform.')
      process.exit(1)
    }
    const root = instanceRoot!
    // Read logDir from config; fall back to default if config missing
    let logDir = `${root}/logs`
    try {
      const { ConfigManager } = await import('../../core/config/config.js')
      const cm = new ConfigManager(path.join(root, 'config.json'))
      if (await cm.exists()) {
        await cm.load()
        logDir = cm.get().logging?.logDir ?? logDir
      }
    } catch { /* ignore — use default */ }
    const result = installAutoStart(logDir, root, instanceId)
    if (result.success) {
      console.log('\x1b[32m✓\x1b[0m Auto-start installed.')
    } else {
      console.error(`\x1b[31m✗\x1b[0m Failed to install auto-start: ${result.error}`)
      process.exit(1)
    }
    return
  }

  if (subcommand === 'uninstall') {
    const result = uninstallAutoStart(instanceId)
    if (result.success) {
      console.log('\x1b[32m✓\x1b[0m Auto-start uninstalled.')
    } else {
      console.error(`\x1b[31m✗\x1b[0m Failed to uninstall auto-start: ${result.error}`)
      process.exit(1)
    }
    return
  }

  console.error(`Unknown subcommand: ${subcommand}. Run \`viben autostart --help\` for usage.`)
  process.exit(1)
}
