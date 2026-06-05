import { getCurrentVersion, getLatestVersion, compareVersions, runUpdate } from '../version.js'
import { wantsHelp } from './helpers.js'

/**
 * `viben update` — Check for a newer CLI version and install it.
 * Exits with code 1 if the registry cannot be reached or the update fails.
 */
export async function cmdUpdate(args: string[] = []): Promise<void> {
  if (wantsHelp(args)) {
    console.log(`
\x1b[1mviben update\x1b[0m — Update to latest version

\x1b[1mUsage:\x1b[0m
  viben update

Checks npm for the latest version of @viben/kernel and
installs it globally if an update is available.
`)
    return
  }
  const current = getCurrentVersion()
  const latest = await getLatestVersion()
  if (!latest) {
    console.error('Could not check for updates. Check your internet connection.')
    process.exit(1)
  }
  if (compareVersions(current, latest) >= 0) {
    console.log(`Already up to date (v${current})`)
    return
  }
  console.log(`Update available: v${current} → v${latest}`)
  const ok = await runUpdate()
  if (ok) {
    console.log(`\x1b[32m✓ Updated to v${latest}\x1b[0m`)
  } else {
    console.error('Update failed. Try manually: npm install -g @viben/kernel@latest')
    process.exit(1)
  }
}
