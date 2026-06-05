import fs from 'node:fs'
import path from 'node:path'

/**
 * Persisted metadata about an installed plugin.
 *
 * This is the registry's view of a plugin — install state, version, source.
 * Distinct from `VibenPlugin` which is the runtime instance with setup/teardown hooks.
 */
export interface PluginEntry {
  version: string
  installedAt: string
  updatedAt: string
  /** How the plugin was installed: bundled with core, from npm, or from a local path */
  source: 'builtin' | 'npm' | 'local'
  enabled: boolean
  settingsPath: string
  description?: string
}

type RegisterInput = Omit<PluginEntry, 'installedAt' | 'updatedAt'>

interface RegistryData {
  installed: Record<string, PluginEntry>
}

/**
 * Tracks which plugins are installed, their versions, and enabled state.
 * Persisted as JSON at `~/.viben/plugins/registry.json`.
 *
 * Used by LifecycleManager to detect version changes (triggering migration)
 * and to skip disabled plugins at boot time.
 */
export class PluginRegistry {
  private data: RegistryData = { installed: {} }

  constructor(private registryPath: string) {}

  /** Return all installed plugins as a Map. */
  list(): Map<string, PluginEntry> {
    return new Map(Object.entries(this.data.installed))
  }

  /** Look up a plugin by name. Returns undefined if not installed. */
  get(name: string): PluginEntry | undefined {
    return this.data.installed[name]
  }

  /** Record a newly installed plugin. Timestamps are set automatically. */
  register(name: string, entry: RegisterInput): void {
    const now = new Date().toISOString()
    this.data.installed[name] = { ...entry, installedAt: now, updatedAt: now }
  }

  /** Remove a plugin from the registry. */
  remove(name: string): void {
    delete this.data.installed[name]
  }

  /** Enable or disable a plugin. Disabled plugins are skipped at boot. */
  setEnabled(name: string, enabled: boolean): void {
    const entry = this.data.installed[name]
    if (!entry) return
    entry.enabled = enabled
    entry.updatedAt = new Date().toISOString()
  }

  /** Update the stored version (called after successful migration). */
  updateVersion(name: string, version: string): void {
    const entry = this.data.installed[name]
    if (!entry) return
    entry.version = version
    entry.updatedAt = new Date().toISOString()
  }

  /** Return only enabled plugins. */
  listEnabled(): Map<string, PluginEntry> {
    return new Map(Object.entries(this.data.installed).filter(([, e]) => e.enabled))
  }

  /** Filter plugins by installation source. */
  listBySource(source: PluginEntry['source']): Map<string, PluginEntry> {
    return new Map(Object.entries(this.data.installed).filter(([, e]) => e.source === source))
  }

  /** Load registry data from disk. Silently starts empty if file doesn't exist. */
  async load(): Promise<void> {
    try {
      const content = fs.readFileSync(this.registryPath, 'utf-8')
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed.installed === 'object') {
        this.data = parsed
      }
    } catch {
      this.data = { installed: {} }
    }
  }

  /** Persist registry data to disk. */
  async save(): Promise<void> {
    const dir = path.dirname(this.registryPath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.registryPath, JSON.stringify(this.data, null, 2))
  }
}
