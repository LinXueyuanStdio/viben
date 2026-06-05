import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const NPM_PACKAGE = '@viben/kernel'

// Walk up from the current module's directory to find package.json.
// Necessary because the compiled output lives in dist/ but package.json is at the root.
function findPackageJson(): string | null {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) return candidate
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return null
}

/**
 * Return the installed CLI version from package.json.
 * Returns '0.0.0-dev' when running from source (no package.json found or parseable).
 */
export function getCurrentVersion(): string {
  try {
    const pkgPath = findPackageJson()
    if (!pkgPath) return '0.0.0-dev'
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg.version as string
  } catch {
    return '0.0.0-dev'
  }
}

/**
 * Fetch the latest published version from the npm registry.
 * Returns null on any error (network failure, rate limit, etc.) — callers treat null as "unknown".
 * Timeout is 5 seconds to avoid blocking the CLI on slow connections.
 */
export async function getLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${NPM_PACKAGE}/latest`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: string }
    return data.version ?? null
  } catch {
    return null
  }
}

/**
 * Numerically compare two semver strings (major.minor.patch).
 * Returns -1 if current < latest, 0 if equal, 1 if current > latest.
 */
export function compareVersions(current: string, latest: string): -1 | 0 | 1 {
  const a = current.split('.').map(Number)
  const b = latest.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) < (b[i] ?? 0)) return -1
    if ((a[i] ?? 0) > (b[i] ?? 0)) return 1
  }
  return 0
}

/**
 * Run `npm install -g @viben/kernel@latest` as a child process.
 * Forwards signals to the child so Ctrl+C during update cancels cleanly.
 */
export async function runUpdate(): Promise<boolean> {
  const { spawn } = await import('node:child_process')
  return new Promise((resolve) => {
    const child = spawn('npm', ['install', '-g', `${NPM_PACKAGE}@latest`], {
      stdio: 'inherit',
      shell: true,
    })
    const onSignal = () => {
      child.kill('SIGTERM')
      resolve(false)
    }
    process.on('SIGINT', onSignal)
    process.on('SIGTERM', onSignal)
    child.on('close', (code) => {
      process.off('SIGINT', onSignal)
      process.off('SIGTERM', onSignal)
      resolve(code === 0)
    })
  })
}

/**
 * Check for a newer CLI version and interactively offer to update before continuing.
 *
 * Skipped in dev mode, CI, non-TTY environments, and when VIBEN_SKIP_UPDATE_CHECK is set.
 * After a successful update the process exits with 0 — the user must re-run their command
 * against the newly installed binary.
 */
export async function checkAndPromptUpdate(): Promise<void> {
  if (process.env.VIBEN_DEV_LOOP || process.env.VIBEN_SKIP_UPDATE_CHECK || !process.stdin.isTTY) return

  const current = getCurrentVersion()
  if (current === '0.0.0-dev') return

  const latest = await getLatestVersion()
  if (!latest || compareVersions(current, latest) >= 0) return

  console.log(`\x1b[33mUpdate available: v${current} → v${latest}\x1b[0m`)
  const clack = await import('@clack/prompts')
  const yes = await clack.confirm({
    message: 'Update now before starting?',
  })
  if (clack.isCancel(yes) || !yes) {
    return
  }
  const ok = await runUpdate()
  if (ok) {
    console.log(`\x1b[32m✓ Updated to v${latest}. Please re-run your command.\x1b[0m`)
    process.exit(0)
  } else {
    console.error('\x1b[31mUpdate failed. Continuing with current version.\x1b[0m')
  }
}
