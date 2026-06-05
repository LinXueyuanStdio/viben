import path from 'node:path'
import type { InstallContext } from './types.js'
import type { SettingsManager } from './settings-manager.js'
import { createTerminalIO } from './terminal-io.js'
import { log as rootLog } from '../utils/log.js'

/** Options for creating an InstallContext. */
export interface CreateInstallContextOpts {
  pluginName: string
  settingsManager: SettingsManager
  /** Base path for plugin data (typically ~/.viben/plugins/) */
  basePath: string
  instanceRoot?: string
}

/**
 * Factory for InstallContext — the limited context available to plugin
 * install/uninstall/configure hooks.
 *
 * Unlike PluginContext (runtime), InstallContext provides terminal I/O for
 * interactive setup and settings access, but no services, events, or middleware.
 * This keeps install-time logic decoupled from the running system.
 */
export function createInstallContext(opts: CreateInstallContextOpts): InstallContext {
  const { pluginName, settingsManager, basePath, instanceRoot } = opts
  const dataDir = path.join(basePath, pluginName, 'data')

  return {
    pluginName,
    terminal: createTerminalIO(),
    settings: settingsManager.createAPI(pluginName),
    dataDir,
    log: rootLog.child({ plugin: pluginName }),
    instanceRoot,
  }
}
