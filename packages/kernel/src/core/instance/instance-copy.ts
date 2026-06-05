// src/core/instance-copy.ts
import fs from 'node:fs'
import path from 'node:path'

export interface CopyOptions {
  /**
   * Per-plugin allowlist of settings keys to copy.
   * Keys: plugin name (e.g. "@viben/telegram"), values: settings keys to inherit.
   * Only listed keys are copied — secrets and instance-specific settings are excluded.
   */
  inheritableKeys?: Record<string, string[]>
  onProgress?: (step: string, status: 'start' | 'done') => void
}

/**
 * Copies an instance's configuration and installed plugins to a new directory.
 *
 * Used by `viben instances create --from <id>` to fork an existing instance.
 * The copy strips instance-specific fields (id, instanceName, workspace.baseDir)
 * and plugin-owned config sections (security, tunnel, api, etc.) that now live
 * in per-plugin settings.json files. Plugin settings are selectively copied
 * based on `inheritableKeys` to avoid leaking secrets.
 */
export async function copyInstance(src: string, dst: string, opts: CopyOptions): Promise<void> {
  const { inheritableKeys = {}, onProgress } = opts
  fs.mkdirSync(dst, { recursive: true })

  // 1. config.json — strip instance-specific fields and migrated plugin sections
  const configSrc = path.join(src, 'config.json')
  if (fs.existsSync(configSrc)) {
    onProgress?.('Configuration', 'start')
    const config = JSON.parse(fs.readFileSync(configSrc, 'utf-8'))
    // Remove instance-specific fields
    delete config.instanceName
    delete config.id              // each copy gets its own UUID via initInstanceFiles
    if (config.workspace) delete config.workspace.baseDir
    // Remove migrated plugin sections — plugins read from settings.json now.
    // Leaving these would cause lifecycle-manager fallback to leak unfiltered settings.
    delete config.security
    delete config.tunnel
    delete config.api
    delete config.speech
    delete config.usage
    // channels: strip plugin-owned fields, keep only core fields (enabled, outputMode, adapter, displayVerbosity)
    if (config.channels && typeof config.channels === 'object') {
      const CORE_CHANNEL_KEYS = new Set(['enabled', 'outputMode', 'adapter', 'displayVerbosity'])
      for (const ch of Object.values(config.channels)) {
        if (ch && typeof ch === 'object') {
          for (const key of Object.keys(ch as Record<string, unknown>)) {
            if (!CORE_CHANNEL_KEYS.has(key)) {
              delete (ch as Record<string, unknown>)[key]
            }
          }
        }
      }
    }
    fs.writeFileSync(path.join(dst, 'config.json'), JSON.stringify(config, null, 2))
    onProgress?.('Configuration', 'done')
  }

  // 2. plugins.json
  const pluginsSrc = path.join(src, 'plugins.json')
  if (fs.existsSync(pluginsSrc)) {
    onProgress?.('Plugin list', 'start')
    fs.copyFileSync(pluginsSrc, path.join(dst, 'plugins.json'))
    onProgress?.('Plugin list', 'done')
  }

  // 3. plugins/ (package.json + node_modules)
  const pluginsDir = path.join(src, 'plugins')
  if (fs.existsSync(pluginsDir)) {
    onProgress?.('Plugins', 'start')
    const dstPlugins = path.join(dst, 'plugins')
    fs.mkdirSync(dstPlugins, { recursive: true })
    const pkgJson = path.join(pluginsDir, 'package.json')
    if (fs.existsSync(pkgJson)) fs.copyFileSync(pkgJson, path.join(dstPlugins, 'package.json'))
    const nodeModules = path.join(pluginsDir, 'node_modules')
    if (fs.existsSync(nodeModules)) fs.cpSync(nodeModules, path.join(dstPlugins, 'node_modules'), { recursive: true })
    onProgress?.('Plugins', 'done')
  }

  // 4. agents.json + agents/
  const agentsJson = path.join(src, 'agents.json')
  if (fs.existsSync(agentsJson)) {
    onProgress?.('Agents', 'start')
    fs.copyFileSync(agentsJson, path.join(dst, 'agents.json'))
    const agentsDir = path.join(src, 'agents')
    if (fs.existsSync(agentsDir)) fs.cpSync(agentsDir, path.join(dst, 'agents'), { recursive: true })
    onProgress?.('Agents', 'done')
  }

  // 5. bin/
  const binDir = path.join(src, 'bin')
  if (fs.existsSync(binDir)) {
    onProgress?.('Tools', 'start')
    fs.cpSync(binDir, path.join(dst, 'bin'), { recursive: true })
    onProgress?.('Tools', 'done')
  }

  // 6. Plugin settings filtered by inheritableKeys
  const pluginDataSrc = path.join(src, 'plugins', 'data')
  if (fs.existsSync(pluginDataSrc)) {
    onProgress?.('Preferences', 'start')
    copyPluginSettings(pluginDataSrc, path.join(dst, 'plugins', 'data'), inheritableKeys)
    onProgress?.('Preferences', 'done')
  }
}

/**
 * Copies only the allowed keys from each plugin's settings.json.
 * This prevents secrets (tokens, API keys) from leaking into the new instance.
 */
function copyPluginSettings(srcData: string, dstData: string, inheritableKeys: Record<string, string[]>): void {
  walkPluginDirs(srcData, (pluginName, settingsPath) => {
    const allowedKeys = inheritableKeys[pluginName]
    if (!allowedKeys || allowedKeys.length === 0) return
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      const filtered: Record<string, unknown> = {}
      for (const key of allowedKeys) {
        if (key in settings) filtered[key] = settings[key]
      }
      if (Object.keys(filtered).length > 0) {
        const relative = path.relative(srcData, path.dirname(settingsPath))
        const dstDir = path.join(dstData, relative)
        fs.mkdirSync(dstDir, { recursive: true })
        fs.writeFileSync(path.join(dstDir, 'settings.json'), JSON.stringify(filtered, null, 2))
      }
    } catch { /* skip invalid */ }
  })
}

/** Walks plugin data directories, handling both scoped (@org/plugin) and unscoped names. */
function walkPluginDirs(base: string, cb: (pluginName: string, settingsPath: string) => void): void {
  if (!fs.existsSync(base)) return
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('@')) {
      const scopeDir = path.join(base, entry.name)
      for (const sub of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue
        const pluginName = `${entry.name}/${sub.name}`
        const settingsPath = path.join(scopeDir, sub.name, 'settings.json')
        if (fs.existsSync(settingsPath)) cb(pluginName, settingsPath)
      }
    } else {
      const settingsPath = path.join(base, entry.name, 'settings.json')
      if (fs.existsSync(settingsPath)) cb(entry.name, settingsPath)
    }
  }
}
