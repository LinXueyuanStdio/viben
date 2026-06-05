import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { VibenPlugin } from './types.js'

/** Monotonic counter appended to temp dirs to guarantee uniqueness per reload. */
let loadCounter = 0

/**
 * Loads a plugin from a local directory path instead of npm.
 *
 * Used by `viben dev --plugin <path>` for plugin development.
 * Expects the plugin to be pre-built (dist/index.js must exist).
 *
 * Hot-reload strategy: on each `load()`, the plugin's `dist/` is copied to a
 * unique temp directory and imported from there. Because every file has a
 * brand-new URL, Node's ESM cache never returns stale modules — neither for
 * the entry (`index.js`) nor for any transitively imported helper. Appending
 * `?v=...` to just the entry URL does NOT propagate to child imports, which
 * is why earlier attempts sometimes ran old code from helper files.
 *
 * Old temp dirs are deleted on the next reload (best-effort).
 */
export class DevPluginLoader {
  private pluginPath: string
  private lastTempDir: string | null = null

  constructor(pluginPath: string) {
    this.pluginPath = path.resolve(pluginPath)
  }

  async load(): Promise<VibenPlugin> {
    const distPath = path.join(this.pluginPath, 'dist')
    const distIndex = path.join(distPath, 'index.js')
    const srcIndex = path.join(this.pluginPath, 'src', 'index.ts')

    if (!fs.existsSync(distIndex) && !fs.existsSync(srcIndex)) {
      throw new Error(`Plugin not found at ${this.pluginPath}. Expected dist/index.js or src/index.ts`)
    }

    if (!fs.existsSync(distIndex)) {
      throw new Error(`Built plugin not found at ${distIndex}. Run 'npm run build' first.`)
    }

    // Copy the whole dist into a unique temp dir so every module URL is fresh.
    // This bypasses Node's ESM cache for the entry AND all its transitive
    // relative imports — query-string cache-busting only affects the entry.
    const tempDir = path.join(os.tmpdir(), `viben-dev-plugin-${Date.now()}-${++loadCounter}`)
    fs.cpSync(distPath, tempDir, { recursive: true })

    // Best-effort cleanup of the previous load's temp dir. We keep one around
    // in case any in-flight code still holds references from the previous load.
    const previousTempDir = this.lastTempDir
    this.lastTempDir = tempDir

    try {
      const mod = await import(`file://${path.join(tempDir, 'index.js')}`)
      const plugin = mod.default as VibenPlugin

      if (!plugin || !plugin.name || !plugin.setup) {
        throw new Error(`Invalid plugin at ${distIndex}. Must export default VibenPlugin with name and setup().`)
      }

      if (previousTempDir) {
        fs.rm(previousTempDir, { recursive: true, force: true }, () => { /* ignore */ })
      }

      return plugin
    } catch (err) {
      // On failure, clean up our own temp dir and restore the previous reference
      fs.rm(tempDir, { recursive: true, force: true }, () => { /* ignore */ })
      this.lastTempDir = previousTempDir
      throw err
    }
  }

  /** Returns the resolved absolute path to the plugin's root directory. */
  getPluginPath(): string {
    return this.pluginPath
  }

  /** Returns the path to the plugin's dist directory (the source of truth — NOT the temp copy). */
  getDistPath(): string {
    return path.join(this.pluginPath, 'dist')
  }
}
