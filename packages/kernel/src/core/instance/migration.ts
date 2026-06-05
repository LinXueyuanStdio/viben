import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { getGlobalRoot } from './instance-context.js'
import { InstanceRegistry } from './instance-registry.js'

/**
 * Migrates a global instance from `~/.viben/` to `<workspace>/.viben/`.
 *
 * Early Viben versions stored instance data directly in `~/.viben/`, mixing
 * instance-specific files (config, sessions, plugins) with shared resources
 * (registry cache, agent binaries). This migration separates them:
 *
 * - Instance files move to `<workspace>/.viben/` (workspace from config, or
 *   `~/viben-workspace/` as default)
 * - Shared resources stay in `~/.viben/`
 * - The instance registry is updated to point to the new location
 * - `workspace.baseDir` is stripped from the migrated config (no longer needed
 *   since the instance root is now inside the workspace itself)
 *
 * Called once on first CLI invocation after upgrade. Safe to call multiple times
 * — returns null if no migration is needed.
 */
export async function migrateGlobalInstance(): Promise<string | null> {
  const globalRoot = getGlobalRoot()
  const globalConfig = path.join(globalRoot, 'config.json')

  if (!fs.existsSync(globalConfig)) return null

  // Read old config to find workspace.baseDir
  let baseDir = path.join(os.homedir(), 'viben-workspace')
  try {
    const raw = JSON.parse(fs.readFileSync(globalConfig, 'utf-8'))
    if (raw.workspace?.baseDir) {
      const configured = raw.workspace.baseDir as string
      baseDir = configured.startsWith('~')
        ? path.join(os.homedir(), configured.slice(1))
        : configured
    }
  } catch {
    // Use default
  }

  const targetRoot = path.join(baseDir, '.viben')

  // Guard: don't migrate onto ourselves
  if (path.resolve(targetRoot) === path.resolve(globalRoot)) {
    return null
  }

  // Instance files to move (NOT shared files)
  const instanceFiles = [
    'config.json', 'sessions.json', 'agents.json', 'plugins.json',
    'tunnels.json', 'api-secret',
  ]
  const instanceDirs = ['plugins', 'logs', 'history', 'files']

  // Create target
  fs.mkdirSync(targetRoot, { recursive: true })

  // Move files
  for (const file of instanceFiles) {
    const src = path.join(globalRoot, file)
    const dst = path.join(targetRoot, file)
    if (fs.existsSync(src)) {
      fs.cpSync(src, dst, { force: true })
      fs.rmSync(src)
    }
  }

  // Move directories
  for (const dir of instanceDirs) {
    const src = path.join(globalRoot, dir)
    const dst = path.join(targetRoot, dir)
    if (fs.existsSync(src)) {
      fs.cpSync(src, dst, { recursive: true, force: true })
      fs.rmSync(src, { recursive: true, force: true })
    }
  }

  // Move instance-specific cache entries but leave registry-cache.json in place —
  // it's a shared resource used by all instances for agent registry lookups
  const srcCache = path.join(globalRoot, 'cache')
  const dstCache = path.join(targetRoot, 'cache')
  if (fs.existsSync(srcCache)) {
    fs.mkdirSync(dstCache, { recursive: true })
    for (const entry of fs.readdirSync(srcCache)) {
      if (entry === 'registry-cache.json') continue
      const s = path.join(srcCache, entry)
      const d = path.join(dstCache, entry)
      fs.cpSync(s, d, { recursive: true, force: true })
      fs.rmSync(s, { recursive: true, force: true })
    }
  }

  // Strip workspace.baseDir from migrated config
  const migratedConfigPath = path.join(targetRoot, 'config.json')
  try {
    const config = JSON.parse(fs.readFileSync(migratedConfigPath, 'utf-8'))
    if (config.workspace?.baseDir) {
      delete config.workspace.baseDir
    }
    fs.writeFileSync(migratedConfigPath, JSON.stringify(config, null, 2))
  } catch {
    // Non-critical
  }

  // Update instance registry
  const registryPath = path.join(globalRoot, 'instances.json')
  try {
    const registry = new InstanceRegistry(registryPath)
    registry.load()
    const oldEntry = registry.getByRoot(globalRoot)
    if (oldEntry) {
      registry.remove(oldEntry.id)
      registry.register(oldEntry.id, targetRoot)
    } else {
      registry.register(randomUUID(), targetRoot)
    }
    registry.save()
  } catch {
    // Non-critical
  }

  console.log(`\x1b[32m✓\x1b[0m Migrated global instance → ${baseDir.replace(os.homedir(), '~')}/.viben`)

  return targetRoot
}
