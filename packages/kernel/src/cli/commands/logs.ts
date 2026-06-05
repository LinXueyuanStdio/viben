import { wantsHelp } from './helpers.js'

/**
 * `viben logs` — Tail the daemon log file.
 *
 * Reads the log directory from config (falls back to <root>/logs if config is missing),
 * then spawns `tail -f` to stream the last 50 lines and follow new output.
 */
export async function cmdLogs(args: string[] = [], instanceRoot?: string): Promise<void> {
  if (wantsHelp(args)) {
    console.log(`
\x1b[1mviben logs\x1b[0m — Tail daemon log file

\x1b[1mUsage:\x1b[0m
  viben logs

Streams the last 50 lines of the Viben log file and
follows new output (like tail -f). Press Ctrl+C to stop.

Log file location is configured in config (default: ~/.viben/logs/).
`)
    return
  }
  const { spawn } = await import('node:child_process')
  const { ConfigManager, expandHome } = await import('../../core/config/config.js')
  const pathMod = await import('node:path')
  const configPath = instanceRoot ? pathMod.join(instanceRoot, 'config.json') : undefined
  const cm = new ConfigManager(configPath)
  let logDir = instanceRoot ? pathMod.join(instanceRoot, 'logs') : '~/.viben/logs'
  if (await cm.exists()) {
    await cm.load()
    logDir = cm.get().logging.logDir
  }
  const logFile = pathMod.join(expandHome(logDir), 'viben.log')
  const tail = spawn('tail', ['-f', '-n', '50', logFile], { stdio: 'inherit' })
  tail.on('error', (err: Error) => {
    console.error(`Cannot tail log file: ${err.message}`)
    process.exit(1)
  })
}
