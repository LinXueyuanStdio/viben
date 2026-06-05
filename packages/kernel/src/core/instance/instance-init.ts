/**
 * Shared instance initialization logic.
 *
 * Both `viben setup` and `viben instances create` call this to ensure
 * a consistent set of files is written for every new instance, regardless
 * of which entry point was used.
 */

import fs from 'node:fs'
import path from 'node:path'

export interface InitInstanceOptions {
  /** UUID for this instance, written to config.json. Once set, never overwritten. */
  id?: string
  /** Agent names to register in agents.json. First entry becomes defaultAgent. */
  agents?: string[]
  /** Instance display name written to config.json as instanceName. */
  instanceName?: string
  /**
   * When true, read existing config.json and merge — preserves fields that
   * neither setup nor instances create should overwrite (e.g. channel tokens).
   * When false, write a fresh config with only the known defaults.
   */
  mergeExisting?: boolean
  /**
   * Explicit run mode. When provided, overrides any value in existing config.
   * When omitted, preserves existing config value or defaults to 'daemon'.
   */
  runMode?: 'daemon' | 'foreground'
}

/**
 * Creates the required instance files inside `instanceRoot` (.viben dir).
 *
 * Always writes: config.json
 * Writes if missing: agents.json (only when agents are provided), plugins.json
 *
 * Safe to call on an existing instance — config is merged when mergeExisting
 * is true, and agents.json/plugins.json are skipped if already present.
 */
export function initInstanceFiles(instanceRoot: string, opts: InitInstanceOptions = {}): void {
  fs.mkdirSync(instanceRoot, { recursive: true })

  writeConfig(instanceRoot, opts)

  if (opts.agents && opts.agents.length > 0) {
    writeAgentsIfMissing(instanceRoot, opts.agents)
  }

  writePluginsIfMissing(instanceRoot)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function writeConfig(instanceRoot: string, opts: InitInstanceOptions): void {
  const configPath = path.join(instanceRoot, 'config.json')

  let existing: Record<string, unknown> = {}
  if (opts.mergeExisting && fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    } catch {
      // Corrupt config — overwrite with fresh defaults
    }
  }

  const existingChannels = (existing['channels'] as Record<string, unknown>) ?? {}
  const config: Record<string, unknown> = {
    ...existing,
    // Always ensure SSE is enabled — the desktop app depends on it
    channels: {
      ...existingChannels,
      sse: { ...(existingChannels['sse'] as Record<string, unknown> ?? {}), enabled: true },
    },
    runMode: opts.runMode ?? existing['runMode'] ?? 'daemon',
    autoStart: existing['autoStart'] ?? false,
  }

  // id is written once at creation — preserve existing id, never overwrite it
  const id = (existing['id'] as string | undefined) ?? opts.id
  if (id) config['id'] = id

  if (opts.agents && opts.agents.length > 0) {
    config['defaultAgent'] = opts.agents[0]
  }

  if (opts.instanceName) {
    config['instanceName'] = opts.instanceName
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

function writeAgentsIfMissing(instanceRoot: string, agents: string[]): void {
  const agentsPath = path.join(instanceRoot, 'agents.json')
  if (fs.existsSync(agentsPath)) return

  const installed: Record<string, unknown> = {}
  for (const agentName of agents) {
    installed[agentName] = {
      registryId: null,
      name: agentName.charAt(0).toUpperCase() + agentName.slice(1),
      version: 'unknown',
      distribution: 'custom',
      command: agentName,
      args: [],
      env: {},
      installedAt: new Date().toISOString(),
      binaryPath: null,
    }
  }

  fs.writeFileSync(agentsPath, JSON.stringify({ version: 1, installed }, null, 2))
}

function writePluginsIfMissing(instanceRoot: string): void {
  const pluginsPath = path.join(instanceRoot, 'plugins.json')
  if (!fs.existsSync(pluginsPath)) {
    fs.writeFileSync(pluginsPath, JSON.stringify({ version: 1, installed: {} }, null, 2))
  }
}
