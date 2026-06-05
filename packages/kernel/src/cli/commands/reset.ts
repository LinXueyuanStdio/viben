import { wantsHelp } from './helpers.js'

/**
 * `viben reset` — Destructively delete all instance data and restart fresh.
 *
 * Requires the daemon to be stopped first. Prompts for confirmation before deletion.
 * Also removes the autostart service so the deleted instance doesn't get restarted.
 */
export async function cmdReset(args: string[] = [], instanceRoot?: string): Promise<void> {
  if (wantsHelp(args)) {
    console.log(`
\x1b[1mviben reset\x1b[0m — Re-run setup wizard

\x1b[1mUsage:\x1b[0m
  viben reset

Deletes all Viben data in the instance directory and allows you to
start fresh with the setup wizard. The daemon must be stopped first.

\x1b[1m\x1b[31mThis is destructive\x1b[0m — config, plugins, agent data will be removed.
`)
    return
  }
  const path = await import('node:path')
  const root = instanceRoot!

  const { getStatus, getPidPath } = await import('../daemon.js')
  const status = getStatus(getPidPath(root))
  if (status.running) {
    console.error('Viben is running. Stop it first: viben stop')
    process.exit(1)
  }

  const clack = await import('@clack/prompts')
  const yes = await clack.confirm({
    message: `This will delete all Viben data (${root}). You will need to set up again. Continue?`,
    initialValue: false,
  })
  if (clack.isCancel(yes) || !yes) {
    console.log('Aborted.')
    return
  }

  try {
    const { uninstallAutoStart } = await import('../autostart.js')
    const { resolveInstanceId } = await import('../resolve-instance-id.js')
    uninstallAutoStart(resolveInstanceId(root))
  } catch { /* non-fatal — proceed with deletion even if autostart removal fails */ }

  const fs = await import('node:fs')
  fs.rmSync(root, { recursive: true, force: true })

  console.log('Reset complete. Run `viben` to set up again.')
}
