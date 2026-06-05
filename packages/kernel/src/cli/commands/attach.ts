import { wantsHelp } from './helpers.js'
import path from 'node:path'

/**
 * `viben attach` — Attach to a running daemon: show status then stream logs.
 *
 * Combines `viben status` output with `tail -f` on the log file.
 * Exits if the daemon is not running. Press Ctrl+C to detach.
 */
export async function cmdAttach(args: string[] = [], instanceRoot?: string): Promise<void> {
  const root = instanceRoot!
  if (wantsHelp(args)) {
    console.log(`
\x1b[1mviben attach\x1b[0m — Attach to a running daemon

\x1b[1mUsage:\x1b[0m
  viben attach

Shows the daemon status and streams log output.
Press Ctrl+C to detach.

\x1b[1mSee also:\x1b[0m
  viben logs       Tail daemon log file only
  viben status     Show daemon status only
`)
    return
  }

  const { formatInstanceStatus } = await import('./status.js')

  const status = formatInstanceStatus(root)
  if (!status) {
    console.log('Viben is not running.')
    process.exit(1)
  }

  console.log('')
  console.log(`\x1b[1mViben is running\x1b[0m (PID ${status.info.pid})`)
  console.log('')
  for (const line of status.lines) {
    // Skip PID line since we already show it above
    if (!line.includes('PID:')) console.log(line)
  }
  console.log('')
  console.log('--- logs (Ctrl+C to detach) ---')
  console.log('')

  // Tail logs — derive log path from instance root
  const { spawn } = await import('node:child_process')
  const { expandHome } = await import('../../core/config/config.js')

  // Try to read logDir from config, fallback to <root>/logs
  let logDir = path.join(root, 'logs')
  try {
    const configPath = path.join(root, 'config.json')
    const { readFileSync } = await import('node:fs')
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    if (config.logging?.logDir) logDir = expandHome(config.logging.logDir)
  } catch { /* use default */ }
  const logFile = path.join(logDir, 'viben.log')
  const tail = spawn('tail', ['-f', '-n', '50', logFile], { stdio: 'inherit' })
  tail.on('error', (err: Error) => {
    console.error(`Cannot tail log file: ${err.message}`)
    process.exit(1)
  })
}
