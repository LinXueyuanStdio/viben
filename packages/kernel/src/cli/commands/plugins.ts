import { wantsHelp } from './helpers.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

/**
 * `viben plugins` — List all installed plugins.
 * Short alias for `viben plugin list`.
 */
export async function cmdPlugins(args: string[] = [], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  if (!json && wantsHelp(args)) {
    console.log(`
\x1b[1mviben plugins\x1b[0m — List installed plugins

\x1b[1mUsage:\x1b[0m
  viben plugins

\x1b[1mOptions:\x1b[0m
  --json          Output result as JSON
  -h, --help      Show this help message

Shows all plugins registered in the plugin registry.
`)
    return
  }

  const path = await import('node:path')
  const { PluginRegistry } = await import('../../core/plugin/plugin-registry.js')

  const root = instanceRoot!
  const registryPath = path.join(root, 'plugins.json')
  const registry = new PluginRegistry(registryPath)
  await registry.load()

  const plugins = registry.list()

  if (json) {
    const pluginList: Record<string, unknown>[] = []
    for (const [name, entry] of plugins) {
      pluginList.push({
        name,
        version: entry.version,
        enabled: entry.enabled !== false,
        source: entry.source ?? 'unknown',
        description: entry.description ?? '',
      })
    }
    jsonSuccess({ plugins: pluginList })
  }

  if (plugins.size === 0) {
    console.log("No plugins installed.")
  } else {
    console.log("Installed plugins:")
    for (const [name, entry] of plugins) {
      const status = entry.enabled ? '' : ' (disabled)'
      console.log(`  ${name}@${entry.version}${status}`)
    }
  }
}

/**
 * `viben plugin <subcommand>` — Extended plugin management.
 *
 * Subcommands:
 *   list                — List all plugins with status (same as `viben plugins`)
 *   add|install <pkg>   — Install a plugin package
 *   remove|uninstall    — Remove a plugin package (--purge to delete data)
 *   enable <name>       — Enable a plugin
 *   disable <name>      — Disable a plugin
 *   configure <name>    — Run interactive configuration for a plugin
 */
export async function cmdPlugin(args: string[] = [], instanceRoot?: string): Promise<void> {
  const subcommand = args[0]

  if (!subcommand || (wantsHelp(args) && !['create', 'search'].includes(subcommand))) {
    console.log(`
\x1b[1mviben plugin\x1b[0m — Plugin management

\x1b[1mUsage:\x1b[0m
  viben plugin list                    List all plugins with status
  viben plugin search <query>          Search the plugin registry
  viben plugin add <package>[@version]  Install a plugin from npm
  viben plugin add <dir>               Install a plugin from local directory
  viben plugin install <package>       Alias for add
  viben plugin remove <package>        Remove a plugin package
  viben plugin uninstall <package>     Alias for remove (--purge to delete data)
  viben plugin enable <name>           Enable a plugin
  viben plugin disable <name>          Disable a plugin
  viben plugin configure <name>        Run interactive configuration
  viben plugin create                  Scaffold a new plugin project (interactive)
  viben plugin create --name <name>    Scaffold a new plugin project (non-interactive)

\x1b[1mOptions:\x1b[0m
  --json          Output result as JSON
  -h, --help      Show this help message

\x1b[1mExamples:\x1b[0m
  viben plugin list
  viben plugin search telegram
  viben plugin add @viben/discord-adapter
  viben plugin add translator@1.2.0
  viben plugin add ./my-plugin            Install from local directory
  viben plugin enable @viben/discord-adapter
  viben plugin configure @viben/discord-adapter
  viben plugin remove @viben/discord-adapter --purge
`)
    return
  }

  switch (subcommand) {
    case 'list':
      return cmdPlugins(isJsonMode(args) ? ['--json'] : [], instanceRoot)

    case 'search': {
      const { cmdPluginSearch } = await import('./plugin-search.js')
      await cmdPluginSearch(args.slice(1))
      return
    }

    case 'add':
    case 'install': {
      const pkg = args.slice(1).find(a => !a.startsWith('-'))
      if (!pkg) {
        if (isJsonMode(args)) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Package name is required')
        console.error('Error: missing package name. Usage: viben plugin add <package>')
        process.exit(1)
      }
      await installPlugin(pkg, instanceRoot, isJsonMode(args))
      return
    }

    case 'remove':
    case 'uninstall': {
      const pkg = args.slice(1).find(a => !a.startsWith('-'))
      if (!pkg) {
        if (isJsonMode(args)) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Package name is required')
        console.error('Error: missing package name. Usage: viben plugin remove <package> [--purge]')
        process.exit(1)
      }
      const purge = args.includes('--purge')
      await uninstallPlugin(pkg, purge, instanceRoot, isJsonMode(args))
      return
    }

    case 'enable': {
      const name = args[1]
      if (!name) {
        if (isJsonMode(args)) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Plugin name is required')
        console.error('Error: missing plugin name. Usage: viben plugin enable <name>')
        process.exit(1)
      }
      await setPluginEnabled(name, true, instanceRoot, isJsonMode(args))
      return
    }

    case 'disable': {
      const name = args[1]
      if (!name) {
        if (isJsonMode(args)) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Plugin name is required')
        console.error('Error: missing plugin name. Usage: viben plugin disable <name>')
        process.exit(1)
      }
      await setPluginEnabled(name, false, instanceRoot, isJsonMode(args))
      return
    }

    case 'configure': {
      const name = args[1]
      if (!name) {
        console.error('Error: missing plugin name. Usage: viben plugin configure <name>')
        process.exit(1)
      }
      await configurePlugin(name, instanceRoot)
      return
    }

    case 'create': {
      const { cmdPluginCreate } = await import('./plugin-create.js')
      await cmdPluginCreate(args.slice(1))
      return
    }

    default:
      console.error(`Unknown subcommand: ${subcommand}`)
      console.error('Run "viben plugin --help" for usage.')
      process.exit(1)
  }
}

async function setPluginEnabled(name: string, enabled: boolean, instanceRoot?: string, json = false): Promise<void> {
  if (json) await muteForJson()

  const path = await import('node:path')
  const { PluginRegistry } = await import('../../core/plugin/plugin-registry.js')

  const root = instanceRoot!
  const registryPath = path.join(root, 'plugins.json')
  const registry = new PluginRegistry(registryPath)
  await registry.load()

  const entry = registry.get(name)
  if (!entry) {
    if (json) jsonError(ErrorCodes.PLUGIN_NOT_FOUND, `Plugin "${name}" not found.`)
    console.error(`Plugin "${name}" not found. Run "viben plugin list" to see installed plugins.`)
    process.exit(1)
  }

  registry.setEnabled(name, enabled)
  await registry.save()
  if (json) jsonSuccess({ plugin: name, enabled })
  console.log(`Plugin ${name} ${enabled ? 'enabled' : 'disabled'}. Restart to apply.`)
}

async function configurePlugin(name: string, instanceRoot?: string): Promise<void> {
  const path = await import('node:path')
  const { corePlugins } = await import('../../plugins/core-plugins.js')
  const { SettingsManager } = await import('../../core/plugin/settings-manager.js')
  const { createInstallContext } = await import('../../core/plugin/install-context.js')

  const plugin = corePlugins.find(p => p.name === name)
  if (!plugin) {
    console.error(`Plugin "${name}" not found.`)
    process.exit(1)
  }

  const root = instanceRoot!
  const basePath = path.join(root, 'plugins', 'data')
  const settingsManager = new SettingsManager(basePath)
  const ctx = createInstallContext({ pluginName: name, settingsManager, basePath })

  if (plugin.configure) {
    await plugin.configure(ctx)
  } else if (plugin.install) {
    await plugin.install(ctx)
  } else {
    console.log(`Plugin ${name} has no configure or install hook.`)
  }
}

async function installPlugin(input: string, instanceRoot?: string, json = false): Promise<void> {
  if (json) await muteForJson()

  const path = await import('node:path')
  const { execFileSync } = await import('node:child_process')
  const { getCurrentVersion } = await import('../version.js')
  const { SettingsManager } = await import('../../core/plugin/settings-manager.js')
  const { createInstallContext } = await import('../../core/plugin/install-context.js')
  const { PluginRegistry } = await import('../../core/plugin/plugin-registry.js')

  const root = instanceRoot!

  // Parse input: "translator", "translator@1.2.0", "@lucas/pkg@2.0.0"
  // Scoped packages require special handling because the first '@' is the scope prefix,
  // not a version separator — the version '@' comes after the package name.
  let pkgName: string
  let pkgVersion: string | undefined

  // Handle scoped packages: @scope/name@version
  if (input.startsWith('@')) {
    const afterScope = input.indexOf('/', 1)
    if (afterScope === -1) {
      pkgName = input
    } else {
      const rest = input.slice(afterScope + 1)
      const atIdx = rest.indexOf('@')
      if (atIdx !== -1) {
        pkgName = input.slice(0, afterScope + 1 + atIdx)
        pkgVersion = rest.slice(atIdx + 1)
      } else {
        pkgName = input
      }
    }
  } else {
    const atIdx = input.lastIndexOf('@')
    if (atIdx > 0) {
      pkgName = input.slice(0, atIdx)
      pkgVersion = input.slice(atIdx + 1)
    } else {
      pkgName = input
    }
  }

  // Try resolve from registry
  const { RegistryClient } = await import('../../core/plugin/registry-client.js')
  const client = new RegistryClient()
  let registryPlugin: any = null
  try {
    const registry = await client.getRegistry()
    registryPlugin = registry.plugins.find(p => p.name === pkgName || p.npm === pkgName)
    if (registryPlugin) {
      if (!json) console.log(`Resolved from registry: ${pkgName} → ${registryPlugin.npm}`)
      pkgName = registryPlugin.npm

      if (!json && !registryPlugin.verified) {
        console.log('⚠️  This plugin is not verified by the Viben team.')
      }
    }
  } catch {
    // Registry unavailable
  }

  const installSpec = pkgVersion ? `${pkgName}@${pkgVersion}` : pkgName
  if (!json) console.log(`Installing ${installSpec}...`)

  // Check if built-in plugin
  const { corePlugins } = await import('../../plugins/core-plugins.js')
  const builtinPlugin = corePlugins.find(p => p.name === pkgName)

  const basePath = path.join(root, 'plugins', 'data')
  const settingsManager = new SettingsManager(basePath)
  const registryPath = path.join(root, 'plugins.json')
  const pluginRegistry = new PluginRegistry(registryPath)
  await pluginRegistry.load()

  if (builtinPlugin) {
    // Built-in plugin — run install hook directly
    if (builtinPlugin.install) {
      const ctx = createInstallContext({ pluginName: builtinPlugin.name, settingsManager, basePath })
      await builtinPlugin.install(ctx)
    }

    pluginRegistry.register(builtinPlugin.name, {
      version: builtinPlugin.version,
      source: 'builtin',
      enabled: true,
      settingsPath: settingsManager.getSettingsPath(builtinPlugin.name),
      description: builtinPlugin.description,
    })
    await pluginRegistry.save()
    if (json) jsonSuccess({ plugin: builtinPlugin.name, version: builtinPlugin.version, installed: true })
    console.log(`✓ ${builtinPlugin.name} installed! Restart to activate.`)
    return
  }

  // Community plugin — npm install to plugins/
  const pluginsDir = path.join(root, 'plugins')
  const nodeModulesDir = path.join(pluginsDir, 'node_modules')

  try {
    execFileSync('npm', ['install', installSpec, '--prefix', pluginsDir, '--save'], {
      stdio: json ? 'pipe' : 'inherit',
      timeout: 60000,
    })
  } catch {
    if (json) jsonError(ErrorCodes.INSTALL_FAILED, `Failed to install ${installSpec}`)
    console.error(`Failed to install ${installSpec}. Check the package name and try again.`)
    process.exit(1)
  }

  // Read installed plugin's package.json for compatibility check
  const cliVersion = getCurrentVersion()
  const isLocalPath = pkgName.startsWith('/') || pkgName.startsWith('.')
  try {
    const pluginRoot = isLocalPath ? path.resolve(pkgName) : path.join(nodeModulesDir, pkgName)
    const installedPkgPath = path.join(pluginRoot, 'package.json')
    const { readFileSync } = await import('node:fs')
    const installedPkg = JSON.parse(readFileSync(installedPkgPath, 'utf-8'))

    // Check engines.viben compatibility
    const minVersion = installedPkg.engines?.viben?.replace(/[>=^~\s]/g, '')
    if (minVersion) {
      const { compareVersions } = await import('../version.js')
      if (compareVersions(cliVersion, minVersion) < 0) {
        if (!json) {
          console.log(`\n⚠️  This plugin requires Viben >= ${minVersion}. You have ${cliVersion}.`)
          console.log(`   Run 'viben update' to get the latest version.\n`)
        }
      }
    }

    // Try to load and run install hook
    const pluginModule = await import(path.join(pluginRoot, installedPkg.main ?? 'dist/index.js'))
    const plugin = pluginModule.default

    if (plugin?.install) {
      const ctx = createInstallContext({ pluginName: plugin.name ?? pkgName, settingsManager, basePath })
      await plugin.install(ctx)
    }

    pluginRegistry.register(plugin?.name ?? pkgName, {
      version: installedPkg.version,
      source: 'npm',
      enabled: true,
      settingsPath: settingsManager.getSettingsPath(plugin?.name ?? pkgName),
      description: plugin?.description ?? installedPkg.description,
    })
    await pluginRegistry.save()

    if (json) jsonSuccess({ plugin: plugin?.name ?? pkgName, version: installedPkg.version, installed: true })
    console.log(`✓ ${plugin?.name ?? pkgName} installed! Restart to activate.`)
  } catch (err) {
    // Plugin installed via npm but no install hook or failed to load — still register
    pluginRegistry.register(pkgName, {
      version: pkgVersion ?? 'unknown',
      source: 'npm',
      enabled: true,
      settingsPath: settingsManager.getSettingsPath(pkgName),
    })
    await pluginRegistry.save()
    if (json) jsonSuccess({ plugin: pkgName, version: pkgVersion ?? 'unknown', installed: true })
    console.log(`✓ ${pkgName} installed (npm only). Restart to activate.`)
  }
}

async function uninstallPlugin(name: string, purge: boolean, instanceRoot?: string, json = false): Promise<void> {
  if (json) await muteForJson()

  const path = await import('node:path')
  const fs = await import('node:fs')
  const { PluginRegistry } = await import('../../core/plugin/plugin-registry.js')

  const root = instanceRoot!
  const registryPath = path.join(root, 'plugins.json')
  const registry = new PluginRegistry(registryPath)
  await registry.load()

  const entry = registry.get(name)
  if (!entry) {
    if (json) jsonError(ErrorCodes.PLUGIN_NOT_FOUND, `Plugin "${name}" not installed.`)
    console.error(`Plugin "${name}" not installed.`)
    process.exit(1)
  }

  if (entry.source === 'builtin') {
    if (json) jsonError(ErrorCodes.UNINSTALL_FAILED, `Cannot uninstall built-in plugin "${name}". Use "viben plugin disable ${name}" instead.`)
    console.error(`Cannot uninstall built-in plugin. Use "viben plugin disable ${name}" instead.`)
    process.exit(1)
  }

  // Try to call uninstall hook
  try {
    const { corePlugins } = await import('../../plugins/core-plugins.js')
    const plugin = corePlugins.find(p => p.name === name)
    if (plugin?.uninstall) {
      const { SettingsManager } = await import('../../core/plugin/settings-manager.js')
      const { createInstallContext } = await import('../../core/plugin/install-context.js')
      const basePath = path.join(root, 'plugins', 'data')
      const settingsManager = new SettingsManager(basePath)
      const ctx = createInstallContext({ pluginName: name, settingsManager, basePath })
      await plugin.uninstall(ctx, { purge })
    }
  } catch {
    // Plugin module might not be loadable, continue
  }

  if (purge) {
    const pluginDir = path.join(root, 'plugins', name)
    fs.rmSync(pluginDir, { recursive: true, force: true })
  }

  registry.remove(name)
  await registry.save()
  if (json) jsonSuccess({ plugin: name, uninstalled: true })
  console.log(`Plugin ${name} uninstalled${purge ? ' (purged)' : ''}.`)
}
