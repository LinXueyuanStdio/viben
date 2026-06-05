import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

/**
 * Describes a single Viben instance and all its filesystem paths.
 *
 * An "instance" is one running Viben server process, identified by a
 * unique ID. Multiple instances can run on the same machine with different
 * configs, ports, and data directories. The instance root is typically
 * `<workspace>/.viben/`.
 */
export interface InstanceContext {
  /** Unique identifier for this instance (UUID). */
  id: string
  /** Absolute path to the instance root directory (e.g. `~/my-project/.viben/`). */
  root: string
  /** Pre-resolved paths to all instance files and directories. */
  paths: {
    config: string
    sessions: string
    agents: string
    /** Shared across all instances — lives under ~/.viben/cache/. */
    registryCache: string
    plugins: string
    pluginsData: string
    pluginRegistry: string
    logs: string
    /** PID file written by the daemon process to track the running server. */
    pid: string
    /** Marker file that indicates the daemon was intentionally started. */
    running: string
    /** Written at startup with the API server's port number. */
    apiPort: string
    apiSecret: string
    /** Shared across all instances — lives under ~/.viben/bin/. */
    bin: string
    cache: string
    tunnels: string
    /** Shared across all instances — lives under ~/.viben/agents/. */
    agentsDir: string
  }
}

export interface CreateInstanceContextOpts {
  id: string
  root: string
}

/**
 * Creates an InstanceContext with all filesystem paths pre-resolved.
 *
 * Some paths (registryCache, bin, agentsDir) point to the global root
 * (`~/.viben/`) because they are shared across all instances.
 */
export function createInstanceContext(opts: CreateInstanceContextOpts): InstanceContext {
  const { id, root } = opts
  const globalRoot = getGlobalRoot()
  return {
    id, root,
    paths: {
      config: path.join(root, 'config.json'),
      sessions: path.join(root, 'sessions.json'),
      agents: path.join(root, 'agents.json'),
      registryCache: path.join(globalRoot, 'cache', 'registry-cache.json'),
      plugins: path.join(root, 'plugins'),
      pluginsData: path.join(root, 'plugins', 'data'),
      pluginRegistry: path.join(root, 'plugins.json'),
      logs: path.join(root, 'logs'),
      pid: path.join(root, 'viben.pid'),
      running: path.join(root, 'running'),
      apiPort: path.join(root, 'api.port'),
      apiSecret: path.join(root, 'api-secret'),
      bin: path.join(globalRoot, 'bin'),
      cache: path.join(root, 'cache'),
      tunnels: path.join(root, 'tunnels.json'),
      agentsDir: path.join(globalRoot, 'agents'),
    },
  }
}

/** Converts a display name to a URL/filesystem-safe slug (lowercase, hyphens only). */
export function generateSlug(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return slug || 'viben'
}

function expandHome(p: string): string {
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1))
  return p
}

export interface ResolveOpts {
  /** Explicit directory flag (`--dir`). */
  dir?: string
  /** Use CWD as instance root (`--local`). */
  local?: boolean
  cwd?: string
}

/**
 * Resolves the instance root directory using a priority chain:
 *
 * 1. `--dir` flag (explicit)
 * 2. `--local` flag (CWD)
 * 3. CWD contains `.viben/config.json`
 * 4. Walk up parent directories (stop at $HOME, skip ~/.viben)
 * 5. Home directory fallback: `~/viben-workspace/.viben/`
 * 6. `VIBEN_INSTANCE_ROOT` env var
 *
 * Returns null if no instance root is found via any of the above steps.
 *
 * `~/.viben` is always skipped because it's the shared global store
 * (registry, cache, bin), not an instance directory.
 */
export function resolveInstanceRoot(opts: ResolveOpts): string | null {
  const cwd = opts.cwd ?? process.cwd()
  const home = os.homedir()
  const globalRoot = getGlobalRoot()

  // 1. --dir flag → return <dir>/.viben
  if (opts.dir) return path.join(expandHome(opts.dir), '.viben')

  // 2. --local flag → return cwd/.viben
  if (opts.local) return path.join(cwd, '.viben')

  // 3. CWD has .viben/config.json → return it
  const cwdRoot = path.join(cwd, '.viben')
  if (fs.existsSync(path.join(cwdRoot, 'config.json'))) return cwdRoot

  // 4. Walk-up parent dirs (stop at $HOME inclusive)
  let dir = path.resolve(cwd)
  while (true) {
    const parent = path.dirname(dir)
    if (parent === dir) break // filesystem root
    dir = parent
    const candidate = path.join(dir, '.viben')
    // Skip ~/.viben (shared store, not an instance)
    if (candidate === globalRoot) {
      // If we've reached $HOME, stop after checking (skip it)
      if (dir === home) break
      continue
    }
    if (fs.existsSync(path.join(candidate, 'config.json'))) return candidate
    // Stop at $HOME (inclusive — we checked it above)
    if (dir === home) break
  }

  // 5. Home directory fallback: check ~/viben-workspace/.viben/config.json
  if (path.resolve(cwd) === path.resolve(home)) {
    const defaultWs = path.join(home, 'viben-workspace', '.viben')
    if (fs.existsSync(path.join(defaultWs, 'config.json'))) return defaultWs
  }

  // 6. Check VIBEN_INSTANCE_ROOT env
  if (process.env.VIBEN_INSTANCE_ROOT) return process.env.VIBEN_INSTANCE_ROOT

  // 7. return null
  return null
}

/** Returns the global shared root (`~/.viben/`) used for cross-instance resources. */
export function getGlobalRoot(): string {
  return path.join(os.homedir(), '.viben')
}

/**
 * Walk up directory tree from `cwd` looking for a running `.viben/` instance.
 * Skips instances that exist but aren't running (dead daemon).
 * Skips `~/.viben` (shared store, not an instance).
 * Stops at $HOME (inclusive). Returns null if nothing is running.
 */
export async function resolveRunningInstance(cwd: string): Promise<string | null> {
  const globalRoot = getGlobalRoot()
  const home = os.homedir()
  let dir = path.resolve(cwd)

  while (true) {
    const candidate = path.join(dir, '.viben')
    // Skip ~/.viben (shared store, not an instance)
    if (candidate !== globalRoot && fs.existsSync(candidate)) {
      if (await isInstanceRunning(candidate)) return candidate
    }
    const parent = path.dirname(dir)
    if (parent === dir) break // filesystem root
    // Stop at $HOME (inclusive — we already checked it)
    if (dir === home) break
    dir = parent
  }

  return null
}

/** Checks if an instance is running by reading its api.port file and hitting the health endpoint. */
async function isInstanceRunning(instanceRoot: string): Promise<boolean> {
  const portFile = path.join(instanceRoot, 'api.port')
  try {
    const content = fs.readFileSync(portFile, 'utf-8').trim()
    const port = parseInt(content, 10)
    if (isNaN(port)) return false
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/system/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}
