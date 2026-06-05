#!/usr/bin/env node

// Server entry point — orchestrates the full startup sequence:
//   1. Instance context resolution (finds the .viben/ workspace root)
//   2. Config load + Zod validation
//   3. Plugin boot in dependency order (services → infrastructure → adapters)
//   4. Adapter wiring from ServiceRegistry into VibenCore
//   5. Signal handlers for graceful shutdown (SIGINT / SIGTERM)

import path from 'node:path'
import { ConfigManager } from './core/config/config.js'
import type { InstanceContext } from './core/instance/instance-context.js'
import { createInstanceContext, getGlobalRoot } from './core/instance/instance-context.js'
import { VibenCore } from './core/core.js'
import { initLogger, shutdownLogger, cleanupOldSessionLogs, log, muteLogger, unmuteLogger } from './core/utils/log.js'
import { corePlugins } from './plugins/core-plugins.js'
import { SettingsManager } from './core/plugin/settings-manager.js'
import { PluginRegistry } from './core/plugin/plugin-registry.js'
import { CommandRegistry } from './core/command-registry.js'
import { registerSystemCommands } from './core/commands/index.js'
import type { IChannelAdapter } from './core/channel.js'
import type { TunnelService } from './plugins/tunnel/tunnel-service.js'
import { InstanceRegistry } from './core/instance/instance-registry.js'
import { PluginFieldRegistry } from './core/plugin/plugin-field-registry.js'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { BusEvent } from './core/events.js'

/** Exit code that signals the process manager (or self-respawn logic) to restart the server. */
export const RESTART_EXIT_CODE = 75

// Module-level guard — prevents re-entrant shutdown if a second signal arrives mid-teardown.
let shuttingDown = false

/**
 * Options for programmatic server startup.
 *
 * All fields are optional: when omitted, startServer() resolves them
 * from the environment (VIBEN_INSTANCE_ROOT or CWD traversal).
 */
export interface StartServerOptions {
  /** Absolute path to a dev plugin directory — enables hot-reload during plugin development. */
  devPluginPath?: string
  /** Disable file-watcher hot-reload for the dev plugin (useful in CI or when watching externally). */
  noWatch?: boolean
  /** Pre-resolved instance context — skip the CWD/env resolution step (used by CLI and daemon child). */
  instanceContext?: InstanceContext
}

/**
 * Starts the Viben server for a given instance.
 *
 * The startup sequence is intentionally ordered:
 *   1. Instance context — must exist before any path resolution
 *   2. SettingsManager + PluginRegistry — needed by setup wizard if config is missing
 *   3. Config load — required before logger init (log level comes from config)
 *   4. Plugin boot — services first, then infrastructure (tunnel, API), then adapters
 *   5. Adapter wiring — adapters register as services during boot; wired after all plugins are up
 *   6. core.start() — begins listening only after all plugins and adapters are ready
 *
 * Can be called programmatically (e.g., from tests or embedded use) by passing
 * a pre-built `instanceContext`. When omitted, resolves from env or CWD.
 */
export async function startServer(opts?: StartServerOptions) {
  if (!opts?.instanceContext) {
    const { resolveInstanceRoot } = await import('./core/instance/instance-context.js')
    const root = process.env.VIBEN_INSTANCE_ROOT
      ?? resolveInstanceRoot({ cwd: process.cwd() })

    if (!root) {
      console.error(`
  \x1b[31m✗\x1b[0m No Viben instance found.

  startServer() requires an instance context. Options:

    1. cd into a workspace directory:
       cd ~/viben-workspace && node dist/main.js

    2. Set VIBEN_INSTANCE_ROOT:
       VIBEN_INSTANCE_ROOT=~/viben-workspace/.viben node dist/main.js

    3. Use the CLI (recommended):
       viben start --dir ~/viben-workspace
`)
      process.exit(1)
    }

    const globalRoot = getGlobalRoot()
    const reg = new InstanceRegistry(path.join(globalRoot, 'instances.json'))
    reg.load()
    const entry = reg.getByRoot(root)
    opts = { ...opts, instanceContext: createInstanceContext({ id: entry?.id ?? randomUUID(), root }) }
  }
  const ctx = opts.instanceContext!

  // 0. If running as daemon child, check state and write PID file
  if (process.argv.includes('--daemon-child')) {
    const { writePidFile, readPidFile, shouldAutoStart } = await import('./cli/daemon.js')

    console.error(`[startup] Daemon child starting (pid=${process.pid}, root=${ctx.root}, env.VIBEN_INSTANCE_ROOT=${process.env.VIBEN_INSTANCE_ROOT ?? 'unset'})`)

    // Only auto-start if the daemon was previously running (user started it)
    if (!shouldAutoStart(ctx.root)) {
      console.error(`[startup] shouldAutoStart=false, exiting`)
      process.exit(0)
    }

    const pidPath = ctx.paths.pid
    const existingPid = readPidFile(pidPath)
    if (existingPid !== null && existingPid !== process.pid) {
      try {
        process.kill(existingPid, 0)
        // Exit 0 (success) so KeepAlive: SuccessfulExit=false does NOT restart us.
        // "Another instance is running" is not an error — we're simply not needed.
        console.error(`[startup] Another instance running (PID ${existingPid}), exiting`)
        process.exit(0)
      } catch {
        console.error(`[startup] Stale PID file (PID ${existingPid} not running), overwriting`)
      }
    }
    writePidFile(pidPath, process.pid)
    console.error(`[startup] PID file written: ${pidPath}`)
  }

  // Create SettingsManager and PluginRegistry early (needed by wizard + boot)
  const settingsManager = new SettingsManager(ctx.paths.pluginsData)
  const pluginRegistry = new PluginRegistry(ctx.paths.pluginRegistry)
  await pluginRegistry.load()

  // 1. Check config exists, run setup if not
  const configManager = new ConfigManager(ctx.paths.config)
  const configExists = await configManager.exists()

  if (!configExists) {
    const { runSetup } = await import('./core/setup/index.js')
    const shouldStart = await runSetup(configManager, { settingsManager, pluginRegistry })
    if (!shouldStart) process.exit(0)
  }

  // 2. Load config (validates with Zod)
  await configManager.load()
  const config = configManager.get()
  initLogger(config.logging)
  log.debug({ configPath: configManager.getConfigPath() }, 'Config loaded')

  // 2b. Apply env var overrides to plugin settings
  await configManager.applyEnvToPluginSettings(settingsManager)

  // First boot: auto-register built-in plugins if registry is empty
  if (pluginRegistry.list().size === 0) {
    await autoRegisterBuiltinPlugins(settingsManager, pluginRegistry)
  }

  // Show banner in foreground TTY mode (not daemon, not piped)
  const isForegroundTTY = !!(process.stdout.isTTY && !process.env.NO_COLOR && config.runMode !== 'daemon')
  if (isForegroundTTY) {
    const { printStartBanner } = await import('./core/setup/index.js')
    await printStartBanner()
  }

  // Mute pino during startup, show spinner instead
  let spinner: ReturnType<typeof import('ora').default> | undefined
  if (isForegroundTTY) {
    muteLogger()
    const ora = (await import('ora')).default
    spinner = ora({ text: 'Starting Viben...', spinner: 'dots' }).start()
  }

  // Post-upgrade dependency check (blocking — must complete before server start)
  try {
    const { runPostUpgradeChecks } = await import('./cli/post-upgrade.js')
    await runPostUpgradeChecks(config, ctx)
  } catch (err) {
    log.warn({ err }, 'Post-upgrade check failed')
  }

  // Async cleanup of old session logs (non-blocking)
  cleanupOldSessionLogs(config.logging.sessionLogRetentionDays).catch(err =>
    log.warn({ err }, 'Session log cleanup failed')
  )

  // 3. Create core
  const core = new VibenCore(configManager, ctx)

  // 3b. Create CommandRegistry and register as service
  const commandRegistry = new CommandRegistry()
  const serviceRegistry = core.lifecycleManager.serviceRegistry
  serviceRegistry.register('command-registry', commandRegistry, 'core')

  const fieldRegistry = new PluginFieldRegistry()
  serviceRegistry.register('field-registry', fieldRegistry, 'core')

  // 3c. Register system commands
  registerSystemCommands(commandRegistry, core)

  // Track dev plugin info for startup summary (logger is muted during boot, so we show it separately)
  let loadedDevPlugin: { name: string; version: string } | undefined

  // 4. Boot all plugins (services, infrastructure, adapters)
  try {
    // Emit kernel:booted before plugin boot
    core.eventBus.emit(BusEvent.KERNEL_BOOTED)

    // Pass settingsManager and pluginRegistry to LifecycleManager
    ;(core.lifecycleManager as any).settingsManager = settingsManager
    ;(core.lifecycleManager as any).pluginRegistry = pluginRegistry

    // Boot all built-in plugins in dependency order
    await core.lifecycleManager.boot(corePlugins)

    // Load community plugins from registry (npm and local sources)
    try {
      const communityPlugins: import('./core/plugin/types.js').VibenPlugin[] = []
      const npmPlugins = pluginRegistry.listBySource('npm')
      const localPlugins = pluginRegistry.listBySource('local')
      const allCommunityEntries = new Map([...npmPlugins, ...localPlugins])

      for (const [name, entry] of allCommunityEntries) {
        if (!entry.enabled) continue

        try {
          let modulePath: string

          if (name.startsWith('/') || name.startsWith('.')) {
            // Absolute or relative path (local install via `plugin add /path/to/plugin`)
            const resolved = path.resolve(name)
            const pkgPath = path.join(resolved, 'package.json')
            const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'))
            modulePath = path.join(resolved, pkg.main || 'dist/index.js')
          } else {
            // npm package: try direct name first, then scan node_modules for matching plugin name
            const nodeModulesDir = path.join(ctx.paths.plugins, 'node_modules')
            let pkgDir = path.join(nodeModulesDir, name)

            if (!fs.existsSync(path.join(pkgDir, 'package.json'))) {
              // Plugin name doesn't match npm package name — scan installed packages
              // Match by viben.pluginName field in package.json (no code execution)
              let found = false
              const scopes = fs.existsSync(nodeModulesDir)
                ? fs.readdirSync(nodeModulesDir).filter(d => d.startsWith('@'))
                : []
              for (const scope of scopes) {
                const scopeDir = path.join(nodeModulesDir, scope)
                const pkgs = fs.readdirSync(scopeDir)
                for (const pkg of pkgs) {
                  const candidateDir = path.join(scopeDir, pkg)
                  const candidatePkgPath = path.join(candidateDir, 'package.json')
                  if (fs.existsSync(candidatePkgPath)) {
                    try {
                      const candidatePkg = JSON.parse(fs.readFileSync(candidatePkgPath, 'utf-8'))
                      const pluginName = candidatePkg.viben?.pluginName as string | undefined
                      if (pluginName === name) {
                        pkgDir = candidateDir
                        found = true
                        break
                      }
                    } catch { /* skip */ }
                  }
                }
                if (found) break
              }
            }

            const pkgJsonPath = path.join(pkgDir, 'package.json')
            const pkg = JSON.parse(await fs.promises.readFile(pkgJsonPath, 'utf-8'))
            modulePath = path.join(pkgDir, pkg.main || 'dist/index.js')
          }

          log.debug({ plugin: name, modulePath }, 'Loading community plugin')
          const mod = await import(modulePath)
          const plugin = mod.default

          if (!plugin || !plugin.name || !plugin.setup) {
            log.warn({ plugin: name }, 'Community plugin has invalid exports (missing name or setup), skipping')
            continue
          }

          communityPlugins.push(plugin)
        } catch (err) {
          log.warn({ err, plugin: name }, 'Failed to load community plugin, skipping')
        }
      }

      if (communityPlugins.length > 0) {
        log.debug({ plugins: communityPlugins.map(p => p.name) }, 'Booting community plugins')
        await core.lifecycleManager.boot(communityPlugins)
      }
    } catch (err) {
      log.warn({ err }, 'Community plugin loading failed')
    }

    // Load dev plugin if running in dev mode
    if (opts?.devPluginPath) {
      const { DevPluginLoader } = await import('./core/plugin/dev-loader.js')
      const devLoader = new DevPluginLoader(opts.devPluginPath)

      try {
        const devPlugin = await devLoader.load()
        await core.lifecycleManager.boot([devPlugin])
        loadedDevPlugin = { name: devPlugin.name, version: devPlugin.version }
        log.info({ plugin: devPlugin.name, version: devPlugin.version }, 'Dev plugin loaded')

        // Watch dist/ directory for changes and hot-reload
        if (!opts.noWatch) {
          const distPath = devLoader.getDistPath()
          let reloadTimer: ReturnType<typeof setTimeout> | null = null

          fs.watch(distPath, { recursive: true }, (_eventType, filename) => {
            if (!filename?.endsWith('.js')) return

            // Debounce: wait 500ms after last change
            if (reloadTimer) clearTimeout(reloadTimer)
            reloadTimer = setTimeout(async () => {
              try {
                log.info({ filename }, 'Dev plugin changed, reloading...')
                await core.lifecycleManager.unloadPlugin(devPlugin.name)
                const reloaded = await devLoader.load()
                await core.lifecycleManager.boot([reloaded])
                log.info({ plugin: reloaded.name, version: reloaded.version }, 'Dev plugin reloaded')
                // Re-sync command list so Telegram autocomplete and App palette reflect new commands.
                core.eventBus.emit(BusEvent.SYSTEM_COMMANDS_READY, { commands: commandRegistry.getAll() })
              } catch (err) {
                log.error({ err }, 'Dev plugin reload failed')
              }
            }, 500)
          })

          log.info({ distPath }, 'Watching dev plugin for changes')
        }
      } catch (err) {
        log.error({ err, pluginPath: opts.devPluginPath }, 'Failed to load dev plugin')
      }
    }

    // Adapters register themselves into the ServiceRegistry under the key "adapter:<name>"
    // during their plugin setup() hook. We discover them here after all plugins have booted,
    // then wire each one into core so it can route incoming messages and send agent responses.
    for (const { name } of serviceRegistry.list()) {
      if (!name.startsWith('adapter:')) continue
      const adapterName = name.slice('adapter:'.length)
      const adapter = serviceRegistry.get<IChannelAdapter>(name)
      if (adapter) {
        core.registerAdapter(adapterName, adapter)
        log.info({ adapter: adapterName }, 'Adapter registered')
      }
    }

    // Wire tunnel service from service registry into core
    const tunnelSvc = serviceRegistry.get<TunnelService>('tunnel')
    if (tunnelSvc) {
      core.tunnelService = tunnelSvc
    }

    // Emit system:commands-ready with all registered commands
    core.eventBus.emit(BusEvent.SYSTEM_COMMANDS_READY, { commands: commandRegistry.getAll() })

    core.eventBus.emit(BusEvent.SYSTEM_READY)
  } catch (err) {
    if (spinner) {
      spinner.fail('Plugin boot failed')
      spinner = undefined
    }
    unmuteLogger()
    log.error({ err }, 'Plugin boot failed')
  }

  if (core.adapters.size === 0) {
    log.error('No channels enabled. Enable at least one channel in config.')
    process.exit(1)
  }

  // 5. Setup shutdown handler
  // Teardown order mirrors the reverse of boot order:
  //   notifications → sessions → lifecycle (adapters, api-server, tunnel, etc.)
  // Notifications must fire first while the adapter is still connected.
  // Sessions are persisted before the plugin layer tears down (some plugins
  // handle session events during shutdown). core.stop() is intentionally
  // NOT called — lifecycleManager.shutdown() already stops adapters, and
  // calling core.stop() afterwards would double-stop and use already-torn-down plugins.
  const shutdown = async (signal: string, exitCode = 0) => {
    if (shuttingDown) return
    shuttingDown = true
    log.info({ signal, exitCode }, 'Signal received, shutting down')

    try {
      // 1. Send shutdown notification while plugins are still running
      try {
        const nm = serviceRegistry.get<import('./plugins/notifications/notification.js').NotificationManager>('notifications')
        if (nm) {
          await nm.notifyAll({
            sessionId: 'system',
            type: 'error',
            summary: 'Viben is shutting down',
          })
        }
      } catch {
        /* best effort */
      }

      // 2. Destroy any idle warm agent — don't leak the subprocess.
      try { await core.agentManager.destroyWarm(); } catch { /* best effort */ }

      // 3. Persist session state (don't kill agent subprocesses — they exit with parent)
      await core.sessionManager.shutdownAll()

      // 4. Lifecycle teardown stops all plugins (adapters, api-server, tunnel, etc.)
      await core.lifecycleManager.shutdown()
      // Note: do NOT call core.stop() here — it would double-stop adapters and
      // try to use the notification plugin after it has already been torn down.
    } catch (err) {
      log.error({ err }, 'Error during shutdown')
    }

    const isDaemon = process.argv.includes('--daemon-child')

    // Clean up PID file if running as daemon
    if (isDaemon) {
      const { removePidFile } = await import('./cli/daemon.js')
      removePidFile(ctx.paths.pid)
    }

    // Self-respawn on restart
    if (exitCode === RESTART_EXIT_CODE) {
      // Dev loop: persist instance root so the shell script can pass it to the next run
      if (process.env.VIBEN_DEV_LOOP) {
        const fsMod = await import('node:fs')
        const osMod = await import('node:os')
        const pathMod = await import('node:path')
        fsMod.writeFileSync(pathMod.join(osMod.tmpdir(), 'viben-dev-loop-root'), ctx.root, 'utf-8')
      }

      log.info({ isDaemon, isDevLoop: !!process.env.VIBEN_DEV_LOOP, instanceRoot: ctx.root }, 'Restart: preparing respawn')

      if (isDaemon) {
        // Daemon mode: spawn detached child writing to log file
        const { spawn: spawnChild } = await import('node:child_process')
        const { expandHome } = await import('./core/config/config.js')
        const fs = await import('node:fs')
        const pathMod = await import('node:path')

        const cliPath = pathMod.resolve(process.argv[1])
        const resolvedLogDir = expandHome(config.logging.logDir)
        fs.mkdirSync(resolvedLogDir, { recursive: true })
        const logFile = pathMod.join(resolvedLogDir, 'viben.log')
        const out = fs.openSync(logFile, 'a')
        const err = fs.openSync(logFile, 'a')

        log.info({ cliPath, nodePath: process.execPath, instanceRoot: ctx.root }, 'Restart: spawning daemon child')
        const child = spawnChild(process.execPath, [cliPath, '--daemon-child'], {
          detached: true,
          stdio: ['ignore', out, err],
          env: { ...process.env, VIBEN_SKIP_UPDATE_CHECK: '1', VIBEN_INSTANCE_ROOT: ctx.root },
        })
        fs.closeSync(out)
        fs.closeSync(err)
        child.unref()
        log.info({ newPid: child.pid }, 'Respawned daemon for restart')
      } else if (!process.env.VIBEN_DEV_LOOP) {
        // Foreground production mode: spawn replacement process with inherited stdio
        const { spawn: spawnChild } = await import('node:child_process')
        log.info({ args: process.argv.slice(1), instanceRoot: ctx.root }, 'Restart: spawning foreground child')
        const child = spawnChild(process.execPath, process.argv.slice(1), {
          stdio: 'inherit',
          env: { ...process.env, VIBEN_SKIP_UPDATE_CHECK: '1', VIBEN_INSTANCE_ROOT: ctx.root },
        })
        await shutdownLogger()
        child.on('exit', (code) => process.exit(code ?? 0))
        return
      } else {
        log.info('Restart: dev-loop mode, exiting for shell script to respawn')
      }
    }

    await shutdownLogger()
    process.exit(exitCode)
  }

  // Expose restart trigger for adapters (e.g. /restart command)
  core.requestRestart = () => shutdown('restart', RESTART_EXIT_CODE)

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  process.on('uncaughtException', (err) => {
    log.error({ err }, 'Uncaught exception')
  })

  process.on('unhandledRejection', (err) => {
    log.error({ err }, 'Unhandled rejection')
  })

  await core.start()

  // Auto-register this instance in the global instance registry (backward compat for existing installs)
  try {
    const globalRoot = getGlobalRoot()
    const registryPath = path.join(globalRoot, 'instances.json')
    const instanceReg = new InstanceRegistry(registryPath)
    await instanceReg.load()
    if (!instanceReg.getByRoot(ctx.root)) {
      instanceReg.register(ctx.id, ctx.root)
      await instanceReg.save()
    }
  } catch {
    // Non-critical — don't fail startup if registry write fails
  }

  // Agent warm-pool: spawn one instance for the default agent + workspace in the
  // background so the first session-create call only pays for the newSession RPC.
  // The try/catch only covers SYNC errors from reading config + resolveWorkspace
  // (e.g. misconfigured workspace path). prewarm() itself returns void
  // synchronously and runs the actual spawn in the background — async errors
  // there are caught and logged inside AgentManager.
  try {
    const defaultAgent = config.defaultAgent;
    const defaultWorkingDir = configManager.resolveWorkspace();
    const allowedPaths = config.workspace?.security?.allowedPaths ?? [];
    core.agentManager.prewarm(defaultAgent, defaultWorkingDir, allowedPaths);
  } catch (err) {
    log.warn({ err }, "Agent warm-pool prewarm at boot failed");
  }

  // 6. Log ready
  if (isForegroundTTY) {
    if (spinner) spinner.stop()
    const ok = (msg: string) => console.log(`\x1b[32m✓\x1b[0m ${msg}`)
    const warn = (msg: string) => console.log(`\x1b[33m⚠\x1b[0m  ${msg}`)
    const spin = (msg: string) => console.log(`\x1b[36m⟳\x1b[0m ${msg}`)

    ok('Config loaded')
    ok('Dependencies checked')

    const tunnelSvc = core.lifecycleManager.serviceRegistry.get<TunnelService>('tunnel')
    let tunnelUrl: string | null = null
    if (tunnelSvc) {
      const tunnelErr = tunnelSvc.getStartError()
      const url = tunnelSvc.getPublicUrl()
      const isPublic = url && !url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')
      if (tunnelErr && isPublic) {
        // Fallback tunnel is active (e.g. Viben unavailable → Cloudflare)
        warn(`Primary tunnel failed — using fallback: ${tunnelErr}`)
        tunnelUrl = url
      } else if (tunnelErr) {
        warn(`Tunnel failed (${tunnelErr}) — retrying in background`)
      } else if (isPublic) {
        ok('Tunnel ready')
        tunnelUrl = url
      } else {
        spin('Tunnel connecting...')
      }
    }

    for (const [name] of core.adapters) {
      ok(`${name.charAt(0).toUpperCase() + name.slice(1)} connected`)
    }

    if (loadedDevPlugin) {
      ok(`Dev plugin: ${loadedDevPlugin.name} v${loadedDevPlugin.version}`)
    }

    const apiSvc = core.lifecycleManager.serviceRegistry.get<import('./plugins/api-server/service.js').ApiServerService>('api-server')
    let apiPort = apiSvc ? apiSvc.getPort() : 21420
    if (apiSvc && apiPort === 0) {
      // Race condition: the api-server's async SYSTEM_READY handler (which calls server.start())
      // may not have completed yet if all adapters started synchronously (e.g. SSE-only).
      // The port file is written after the server binds — poll it for up to 3 seconds.
      const { waitForPortFile } = await import('./cli/api-client.js')
      apiPort = await waitForPortFile(ctx.paths.apiPort, 3000) ?? 21420
    }
    if (apiSvc) ok(`API server on port ${apiPort}`)

    // Links as plain text — easily copyable
    console.log('')
    console.log(`Local:  http://localhost:${apiPort}`)
    if (tunnelUrl) {
      console.log(`Tunnel: ${tunnelUrl}`)
    }

    console.log(`\nViben is running. Press Ctrl+C to stop.\n`)
    unmuteLogger()
  }
  log.debug('Viben started')
}

/**
 * Auto-register all built-in plugins when the registry is empty (first boot with new plugin system).
 * For each plugin that has an install() hook and no existing settings, run install() silently.
 */
async function autoRegisterBuiltinPlugins(
  settingsManager: SettingsManager,
  pluginRegistry: PluginRegistry,
): Promise<void> {
  const allPlugins = [
    { name: '@viben/security', version: '1.0.0', description: 'User access control and session limits' },
    { name: '@viben/file-service', version: '1.0.0', description: 'File storage and management' },
    { name: '@viben/context', version: '1.0.0', description: 'Conversation context management' },
    { name: '@viben/speech', version: '1.0.0', description: 'Text-to-speech and speech-to-text' },
    { name: '@viben/notifications', version: '1.0.0', description: 'Cross-session notification routing' },
    { name: '@viben/tunnel', version: '1.0.0', description: 'Expose local services via tunnel' },
    { name: '@viben/api-server', version: '1.0.0', description: 'REST API + SSE streaming server' },
    { name: '@viben/sse-adapter', version: '1.0.0', description: 'SSE-based messaging adapter for app clients' },
    { name: '@viben/telegram', version: '1.0.0', description: 'Telegram adapter with forum topics' },
  ]

  // Run install() for each plugin that has no existing settings
  const pluginModules = await Promise.allSettled([
    import('./plugins/security/index.js'),
    import('./plugins/file-service/index.js'),
    import('./plugins/context/index.js'),
    import('./plugins/speech/index.js'),
    import('./plugins/notifications/index.js'),
    import('./plugins/tunnel/index.js'),
    import('./plugins/api-server/index.js'),
    import('./plugins/sse-adapter/index.js'),
    import('./plugins/telegram/index.js'),
  ])

  for (const result of pluginModules) {
    if (result.status !== 'fulfilled') continue
    const plugin = result.value.default
    if (plugin?.install) {
      try {
        // Check if settings already exist
        const existing = await settingsManager.loadSettings(plugin.name)
        if (Object.keys(existing).length > 0) continue

        // Create a silent install context
        const { createInstallContext } = await import('./core/plugin/install-context.js')
        const ctx = createInstallContext({
          pluginName: plugin.name,
          settingsManager,
          basePath: settingsManager.getBasePath(),
        })
        // Override terminal to be silent
        ctx.terminal = createSilentTerminal()
        await plugin.install(ctx)
      } catch {
        // Silently skip — install is best-effort
      }
    }
  }

  for (const p of allPlugins) {
    pluginRegistry.register(p.name, {
      version: p.version,
      source: 'builtin',
      enabled: true,
      settingsPath: settingsManager.getSettingsPath(p.name),
      description: p.description,
    })
  }
  await pluginRegistry.save()
  log.info('Built-in plugins registered in plugin registry')
}

/**
 * Create a no-op terminal for silent migration (no user interaction).
 */
function createSilentTerminal(): import('./core/plugin/types.js').TerminalIO {
  const noop = () => {}
  // Throw on interactive prompts — silent migration should only use log/spinner/note.
  // If a plugin enters interactive mode (no legacy config to migrate), this aborts it
  // so the try-catch in autoRegisterBuiltinPlugins skips it gracefully.
  const abort = () => { throw new Error('Silent migration: no interactive input available') }
  return {
    text: async () => abort() as never,
    select: async () => abort() as never,
    confirm: async () => abort() as never,
    password: async () => abort() as never,
    multiselect: async () => abort() as never,
    log: { info: noop, success: noop, warning: noop, error: noop, step: noop },
    spinner: () => ({ start: noop, stop: noop, fail: noop }),
    note: noop,
    cancel: noop,
  }
}

// Direct execution for dev (node dist/main.js)
const isDirectExecution = process.argv[1]?.endsWith('main.js')
if (isDirectExecution) {
  startServer().catch((err) => {
    log.error({ err }, 'Fatal error')
    process.exit(1)
  })
}
