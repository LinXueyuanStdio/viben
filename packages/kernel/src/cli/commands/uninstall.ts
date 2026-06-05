import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { wantsHelp } from './helpers.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

/**
 * `viben uninstall` — Remove an adapter plugin from the instance's plugins directory.
 *
 * Delegates to `npm uninstall` to remove the package from the plugins directory.
 */
export async function cmdUninstall(args: string[], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const root = instanceRoot!
  const pluginsDir = path.join(root, 'plugins')

  if (!json && wantsHelp(args)) {
    console.log(`
\x1b[1mviben uninstall\x1b[0m — Remove a plugin adapter

\x1b[1mUsage:\x1b[0m
  viben uninstall <package>

\x1b[1mArguments:\x1b[0m
  <package>       npm package name to remove

\x1b[1mOptions:\x1b[0m
  --json          Output result as JSON
  -h, --help      Show this help message

\x1b[1mExamples:\x1b[0m
  viben uninstall @viben/discord-adapter
`)
    return
  }

  const pkg = args.filter(a => a !== '--json')[0]
  if (!pkg) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Package name is required')
    console.error("Usage: viben uninstall <package>")
    process.exit(1)
  }

  fs.mkdirSync(pluginsDir, { recursive: true })
  const pkgPath = path.join(pluginsDir, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'viben-plugins', private: true, dependencies: {} }, null, 2))
  }

  if (!json) console.log(`Uninstalling ${pkg}...`)
  try {
    execSync(`npm uninstall ${pkg} --prefix "${pluginsDir}"`, { stdio: json ? 'pipe' : 'inherit' })
  } catch (err) {
    if (json) jsonError(ErrorCodes.UNINSTALL_FAILED, `Failed to uninstall ${pkg}`)
    process.exit(1)
  }
  if (json) jsonSuccess({ plugin: pkg, uninstalled: true })
  console.log(`Plugin ${pkg} uninstalled.`)
}
