import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

const execFileAsync = promisify(execFile)

/**
 * Import a package resolved from a specific directory (not the project root).
 *
 * We can't use bare `import('packageName')` because Node resolves from the
 * project root's node_modules. Plugins are installed to a separate directory
 * (~/.viben/plugins/node_modules), so we manually resolve the ESM entry point
 * from the package's package.json and import by absolute file:// URL.
 */
export async function importFromDir(packageName: string, dir: string): Promise<any> {
  const pkgDir = path.join(dir, 'node_modules', ...packageName.split('/'))
  const pkgJsonPath = path.join(pkgDir, 'package.json')

  let pkgJson: Record<string, any>
  try {
    pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'))
  } catch (err) {
    throw new Error(`Cannot read package.json for "${packageName}" at ${pkgJsonPath}: ${(err as Error).message}`)
  }

  // Resolve entry: exports["."].import > main > index.js
  let entry: string
  const exportsMain = pkgJson.exports?.['.']
  if (typeof exportsMain === 'string') {
    entry = exportsMain
  } else if (exportsMain?.import) {
    entry = exportsMain.import
  } else {
    entry = pkgJson.main ?? 'index.js'
  }

  const entryPath = path.join(pkgDir, entry)
  try {
    await fs.access(entryPath)
  } catch {
    throw new Error(`Entry point "${entry}" not found for "${packageName}" at ${entryPath}`)
  }

  return import(pathToFileURL(entryPath).href)
}

/** Valid npm package name: optional @scope/, alphanumeric/hyphens/dots, optional @version */
const VALID_NPM_NAME = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(@[\w.^~>=<|-]+)?$/i;

/**
 * Install an npm package to the isolated plugins directory and return the loaded module.
 *
 * Plugins are installed to `~/.viben/plugins/` (separate from the project's node_modules)
 * to avoid version conflicts with core dependencies. Uses `--ignore-scripts` for security.
 * Tries to import first (already installed case) before running npm install.
 */
export async function installNpmPlugin(packageName: string, pluginsDir?: string): Promise<any> {
  if (!VALID_NPM_NAME.test(packageName)) {
    throw new Error(`Invalid package name: "${packageName}". Must be a valid npm package name.`);
  }

  const dir = pluginsDir!

  // Try import from plugins dir first — already installed
  try {
    return await importFromDir(packageName, dir)
  } catch {
    // Not installed, proceed with install
  }

  await execFileAsync('npm', ['install', packageName, '--prefix', dir, '--save', '--ignore-scripts'], {
    timeout: 60000,
  })

  return await importFromDir(packageName, dir)
}
