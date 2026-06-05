/**
 * Interactive CLI config editor (`viben config`).
 *
 * Provides a menu-driven interface for editing global config and per-plugin
 * settings. Operates in two modes:
 * - **file mode**: collects all changes in a `updates` object as the user
 *   navigates menus, then flushes the batch to config.json on exit. This
 *   accumulate-then-flush approach avoids partial writes if the user cancels
 *   midway through editing multiple fields.
 * - **api mode**: sends each section's changes to the running daemon via REST
 *   API immediately, enabling hot-reload without restart.
 *
 * Global settings (logging, runMode, defaultAgent) are stored in config.json.
 * Plugin-specific settings (bot tokens, ports) are stored in per-plugin
 * settings files via SettingsManager.
 */
import * as path from 'node:path'
import * as clack from '@clack/prompts'
import type { Config, ConfigManager } from './config.js'
import type { SettingsManager } from '../plugin/settings-manager.js'

// Compatibility wrappers — convert @inquirer/prompts API to @clack/prompts
async function select<T extends string>(opts: { message: string; choices: Array<{ name: string; value: T; description?: string }>; default?: T }): Promise<T> {
  const result = await clack.select({
    message: opts.message,
    options: opts.choices.map(ch => ({ label: ch.name, value: ch.value, hint: ch.description })) as any,
    initialValue: opts.default,
  })
  if (clack.isCancel(result)) { clack.cancel('Cancelled.'); process.exit(0) }
  return result as T
}

async function input(opts: { message: string; default?: string; validate?: (val: string) => string | boolean }): Promise<string> {
  const result = await clack.text({
    message: opts.message,
    initialValue: opts.default,
    validate: opts.validate ? (val) => {
      const r = opts.validate!((val ?? "") as string)
      if (r === true || r === undefined) return undefined
      if (typeof r === 'string') return r
      return undefined
    } : undefined,
  })
  if (clack.isCancel(result)) { clack.cancel('Cancelled.'); process.exit(0) }
  return result as string
}
import { installAutoStart, uninstallAutoStart, isAutoStartInstalled, isAutoStartSupported } from '../../cli/autostart.js'
import { resolveInstanceId } from '../../cli/resolve-instance-id.js'
import { expandHome } from './config.js'

// ANSI color helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

const ok = (msg: string) => `${c.green}${c.bold}✓${c.reset} ${c.green}${msg}${c.reset}`
const warn = (msg: string) => `${c.yellow}⚠ ${msg}${c.reset}`
const dim = (msg: string) => `${c.dim}${msg}${c.reset}`
const header = (title: string) => `\n${c.cyan}${c.bold}[${title}]${c.reset}\n`

type ConfigUpdates = Record<string, unknown>

// --- Edit: Telegram ---

async function editTelegram(config: Config, updates: ConfigUpdates, settingsManager?: SettingsManager): Promise<void> {
  const ps = settingsManager ? await settingsManager.loadSettings('@viben/telegram') : {}
  const currentToken = (ps.botToken as string) ?? ''
  const currentChatId = (ps.chatId as number) ?? 0
  const currentEnabled = (ps.enabled as boolean) ?? false

  console.log(header('Telegram'))
  const tokenDisplay = currentToken.length > 12
    ? currentToken.slice(0, 6) + '...' + currentToken.slice(-6)
    : currentToken || dim('(not set)')
  console.log(`  Enabled   : ${currentEnabled ? ok('yes') : dim('no')}`)
  console.log(`  Bot Token : ${tokenDisplay}`)
  console.log(`  Chat ID   : ${currentChatId || dim('(not set)')}`)
  console.log('')

  while (true) {
    const freshSettings = settingsManager ? await settingsManager.loadSettings('@viben/telegram') : ps
    const isEnabled = (freshSettings.enabled as boolean) ?? currentEnabled

    const choice = await select({
      message: 'Telegram settings:',
      choices: [
        { name: isEnabled ? 'Disable Telegram' : 'Enable Telegram', value: 'toggle' },
        { name: 'Change Bot Token', value: 'token' },
        { name: 'Change Chat ID', value: 'chatid' },
        { name: 'Back', value: 'back' },
      ],
    })

    if (choice === 'back') break

    if (choice === 'toggle') {
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/telegram', { enabled: !isEnabled })
        console.log(!isEnabled ? ok('Telegram enabled') : ok('Telegram disabled'))
      }
    }

    if (choice === 'token') {
      const token = await input({
        message: 'New bot token:',
        validate: (val) => val.trim().length > 0 || 'Token cannot be empty',
      })
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/telegram', { botToken: token.trim() })
        console.log(ok('Bot token updated'))
      }
    }

    if (choice === 'chatid') {
      const chatId = await input({
        message: 'New chat ID:',
        validate: (val) => !isNaN(Number(val.trim())) || 'Must be a number',
      })
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/telegram', { chatId: Number(chatId.trim()) })
        console.log(ok(`Chat ID set to ${chatId.trim()}`))
      }
    }
  }
}

// --- Edit: Discord (delegates to plugin's configure()) ---

const DISCORD_PACKAGE = '@viben/discord-adapter'

async function ensureDiscordPlugin(): Promise<any | null> {
  try {
    return await import(DISCORD_PACKAGE)
  } catch {
    const shouldInstall = await select({
      message: `${DISCORD_PACKAGE} is not installed. Install it now?`,
      choices: [
        { name: 'Yes, install now', value: 'yes' },
        { name: 'No, skip', value: 'no' },
      ],
    })
    if (shouldInstall === 'no') {
      console.log(warn(`Install later with: viben plugin add ${DISCORD_PACKAGE}`))
      return null
    }
    try {
      console.log(dim(`Installing ${DISCORD_PACKAGE}...`))
      const { installNpmPlugin } = await import('../plugin/plugin-installer.js')
      const mod = await installNpmPlugin(DISCORD_PACKAGE)
      console.log(ok(`${DISCORD_PACKAGE} installed`))
      return mod
    } catch (err) {
      console.log(warn(`Failed to install: ${(err as Error).message}`))
      return null
    }
  }
}

async function editDiscord(_config: Config, _updates: ConfigUpdates, settingsManager?: SettingsManager, instanceRoot?: string): Promise<void> {
  const pluginModule = await ensureDiscordPlugin()
  if (!pluginModule) return

  const plugin = pluginModule.default
  if (plugin?.configure) {
    if (!settingsManager || !instanceRoot) {
      console.log(warn('Cannot configure Discord — instance context not available.'))
      return
    }
    const { createInstallContext } = await import('../plugin/install-context.js')
    const ctx = createInstallContext({
      pluginName: plugin.name,
      settingsManager,
      basePath: settingsManager.getBasePath(),
      instanceRoot,
    })
    await plugin.configure(ctx)
  } else {
    console.log(warn('This plugin does not have a configure() method yet.'))
  }
}

// --- Edit: Channels (parent menu) ---

async function editChannels(config: Config, updates: ConfigUpdates, settingsManager?: SettingsManager, instanceRoot?: string): Promise<void> {
  // channels migrated out of config.json — read from plugin settings only
  let tgConfigured = false
  let dcConfigured = false

  if (settingsManager) {
    const tgPs = await settingsManager.loadSettings('@viben/telegram')
    if (tgPs.botToken && tgPs.chatId) tgConfigured = true

    const dcPs = await settingsManager.loadSettings('@viben/discord-adapter')
    if (dcPs.guildId || dcPs.token) dcConfigured = true
  }

  console.log(header('Channels'))
  console.log(`  Telegram : ${tgConfigured ? ok('configured') : dim('not configured')}`)
  console.log(`  Discord  : ${dcConfigured ? ok('configured') : dim('not configured')}`)
  console.log('')

  while (true) {
    const choice = await select({
      message: 'Channel settings:',
      choices: [
        { name: 'Telegram', value: 'telegram' },
        { name: 'Discord', value: 'discord' },
        { name: 'Back', value: 'back' },
      ],
    })

    if (choice === 'back') break

    if (choice === 'telegram') await editTelegram(config, updates, settingsManager)
    if (choice === 'discord') await editDiscord(config, updates, settingsManager, instanceRoot)
  }
}

// --- Edit: Agent ---

async function editAgent(config: Config, updates: ConfigUpdates): Promise<void> {
  // agents migrated out of config.json — read from agents.json
  const agentNames: string[] = []
  const currentDefault = config.defaultAgent

  console.log(header('Agent'))
  console.log(`  Default agent : ${c.bold}${currentDefault}${c.reset}`)
  console.log(`  Available     : ${agentNames.join(', ') || dim('(none)')}`)
  console.log('')

  while (true) {
    const choice = await select({
      message: 'Agent settings:',
      choices: [
        { name: 'Change default agent', value: 'default' },
        { name: 'Back', value: 'back' },
      ],
    })

    if (choice === 'back') break

    if (choice === 'default') {
      if (agentNames.length === 0) {
        console.log(warn('No agents configured.'))
        continue
      }

      const chosen = await select({
        message: 'Select default agent:',
        choices: agentNames.map((name) => ({ name, value: name })),
      })

      updates.defaultAgent = chosen
      console.log(ok(`Default agent set to ${chosen}`))
    }
  }
}

// --- Edit: Security ---

async function editSecurity(config: Config, updates: ConfigUpdates, settingsManager?: SettingsManager): Promise<void> {
  const ps = settingsManager ? await settingsManager.loadSettings('@viben/security') : {}
  const sec = {
    allowedUserIds: (ps.allowedUserIds as string[]) ?? [],
    maxConcurrentSessions: (ps.maxConcurrentSessions as number) ?? 20,
    sessionTimeoutMinutes: (ps.sessionTimeoutMinutes as number) ?? 60,
  }

  console.log(header('Security'))
  console.log(`  Allowed user IDs        : ${sec.allowedUserIds?.length ? sec.allowedUserIds.join(', ') : dim('(all users allowed)')}`)
  console.log(`  Max concurrent sessions : ${sec.maxConcurrentSessions}`)
  console.log(`  Session timeout (min)   : ${sec.sessionTimeoutMinutes}`)
  console.log('')

  while (true) {
    const choice = await select({
      message: 'Security settings:',
      choices: [
        { name: 'Max concurrent sessions', value: 'maxSessions' },
        { name: 'Session timeout (minutes)', value: 'timeout' },
        { name: 'Back', value: 'back' },
      ],
    })

    if (choice === 'back') break

    if (choice === 'maxSessions') {
      const val = await input({
        message: 'Max concurrent sessions:',
        default: String(sec.maxConcurrentSessions),
        validate: (v) => {
          const n = Number(v.trim())
          if (!Number.isInteger(n) || n < 1) return 'Must be a positive integer'
          return true
        },
      })
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/security', { maxConcurrentSessions: Number(val.trim()) })
      }
      console.log(ok(`Max concurrent sessions set to ${val.trim()}`))
    }

    if (choice === 'timeout') {
      const val = await input({
        message: 'Session timeout in minutes:',
        default: String(sec.sessionTimeoutMinutes),
        validate: (v) => {
          const n = Number(v.trim())
          if (!Number.isInteger(n) || n < 1) return 'Must be a positive integer'
          return true
        },
      })
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/security', { sessionTimeoutMinutes: Number(val.trim()) })
      }
      console.log(ok(`Session timeout set to ${val.trim()} minutes`))
    }
  }
}

// --- Edit: Logging ---

async function editLogging(config: Config, updates: ConfigUpdates): Promise<void> {
  const logging = config.logging ?? { level: 'info', logDir: '~/.viben/logs', maxFileSize: '10m', maxFiles: 7, sessionLogRetentionDays: 30 }

  console.log(header('Logging'))
  console.log(`  Log level : ${logging.level}`)
  console.log(`  Log dir   : ${logging.logDir}`)
  console.log('')

  while (true) {
    const choice = await select({
      message: 'Logging settings:',
      choices: [
        { name: 'Log level', value: 'level' },
        { name: 'Log directory', value: 'logDir' },
        { name: 'Back', value: 'back' },
      ],
    })

    if (choice === 'back') break

    if (choice === 'level') {
      const level = await select({
        message: 'Select log level:',
        choices: [
          { name: 'silent', value: 'silent' },
          { name: 'debug', value: 'debug' },
          { name: 'info', value: 'info' },
          { name: 'warn', value: 'warn' },
          { name: 'error', value: 'error' },
          { name: 'fatal', value: 'fatal' },
        ],
      })

      if (!updates.logging) updates.logging = {}
      ;(updates.logging as Record<string, unknown>).level = level
      console.log(ok(`Log level set to ${level}`))
    }

    if (choice === 'logDir') {
      const dir = await input({
        message: 'Log directory:',
        default: logging.logDir,
        validate: (val) => val.trim().length > 0 || 'Path cannot be empty',
      })

      if (!updates.logging) updates.logging = {}
      ;(updates.logging as Record<string, unknown>).logDir = dir.trim()
      console.log(ok(`Log directory set to ${dir.trim()}`))
    }
  }
}

// --- Edit: Run Mode ---

async function editRunMode(config: Config, updates: ConfigUpdates, instanceRoot?: string): Promise<void> {
  const currentMode = config.runMode ?? 'foreground'
  const currentAutoStart = config.autoStart ?? false
  const instanceId = instanceRoot ? resolveInstanceId(instanceRoot) : 'default'
  const autoStartInstalled = isAutoStartInstalled(instanceId)
  const autoStartSupported = isAutoStartSupported()

  console.log(header('Run Mode'))
  console.log(`  Current mode : ${c.bold}${currentMode}${c.reset}`)
  console.log(`  Auto-start   : ${currentAutoStart ? ok('enabled') : dim('disabled')}${autoStartInstalled ? ` ${dim('(installed)')}` : ''}`)
  console.log('')

  while (true) {
    const isDaemon = (() => {
      if ('runMode' in updates) return updates.runMode === 'daemon'
      return currentMode === 'daemon'
    })()

    const choices = [
      isDaemon
        ? { name: 'Switch to foreground mode', value: 'foreground' }
        : { name: 'Switch to daemon mode', value: 'daemon' },
    ]

    if (autoStartSupported) {
      const autoStartCurrent = (() => {
        if ('autoStart' in updates) return updates.autoStart as boolean
        return currentAutoStart
      })()
      choices.push({
        name: autoStartCurrent ? 'Disable auto-start' : 'Enable auto-start',
        value: 'toggleAutoStart',
      })
    }

    choices.push({ name: 'Back', value: 'back' })

    const choice = await select({
      message: 'Run mode settings:',
      choices,
    })

    if (choice === 'back') break

    if (choice === 'daemon') {
      updates.runMode = 'daemon'
      const logDir = (config.logging?.logDir) ?? '~/.viben/logs'
      const result = installAutoStart(expandHome(logDir), instanceRoot!, instanceId)
      if (result.success) {
        updates.autoStart = true
        console.log(ok('Switched to daemon mode with auto-start'))
      } else {
        console.log(warn(`Switched to daemon mode (auto-start failed: ${result.error})`))
      }
    }

    if (choice === 'foreground') {
      updates.runMode = 'foreground'
      updates.autoStart = false
      uninstallAutoStart(instanceId)
      console.log(ok('Switched to foreground mode'))
    }

    if (choice === 'toggleAutoStart') {
      const autoStartCurrent = (() => {
        if ('autoStart' in updates) return updates.autoStart as boolean
        return currentAutoStart
      })()

      if (autoStartCurrent) {
        const result = uninstallAutoStart(instanceId)
        updates.autoStart = false
        if (result.success) {
          console.log(ok('Auto-start disabled'))
        } else {
          console.log(warn(`Auto-start uninstall failed: ${result.error}`))
        }
      } else {
        const logDir = (config.logging?.logDir) ?? '~/.viben/logs'
        const result = installAutoStart(expandHome(logDir), instanceRoot!, instanceId)
        updates.autoStart = result.success
        if (result.success) {
          console.log(ok('Auto-start enabled'))
        } else {
          console.log(warn(`Auto-start install failed: ${result.error}`))
        }
      }
    }
  }
}

// --- Edit: API ---

async function editApi(config: Config, updates: ConfigUpdates, settingsManager?: SettingsManager): Promise<void> {
  const ps = settingsManager ? await settingsManager.loadSettings('@viben/api-server') : {}
  const currentPort = (ps.port as number) ?? 21420
  const currentHost = (ps.host as string) ?? '127.0.0.1'

  console.log(header('API'))
  console.log(`  Port : ${currentPort}`)
  console.log(`  Host : ${currentHost} ${dim('(localhost only)')}`)
  console.log('')

  const newPort = await input({
    message: 'API port:',
    default: String(currentPort),
    validate: (v) => {
      const n = Number(v.trim())
      if (!Number.isInteger(n) || n < 1 || n > 65535) return 'Must be a valid port (1-65535)'
      return true
    },
  })

  if (settingsManager) {
    await settingsManager.updatePluginSettings('@viben/api-server', { port: Number(newPort.trim()) })
  }
  console.log(ok(`API port set to ${newPort.trim()}`))
}

// --- Edit: Tunnel ---

async function editTunnel(config: Config, updates: ConfigUpdates, settingsManager?: SettingsManager): Promise<void> {
  const ps = settingsManager ? await settingsManager.loadSettings('@viben/tunnel') : {}
  const tunnel = {
    enabled: (ps.enabled as boolean) ?? false,
    port: (ps.port as number) ?? 3100,
    provider: (ps.provider as string) ?? 'viben',
    options: (ps.options as Record<string, unknown>) ?? {},
    storeTtlMinutes: (ps.storeTtlMinutes as number) ?? 60,
    auth: (ps.auth as { enabled: boolean; token?: string }) ?? { enabled: false },
  }

  // Local display state (not persisted to config.json — tunnel removed from schema)
  const tun: Record<string, unknown> = { ...tunnel }

  const getVal = <T>(key: string, fallback: T): T =>
    (key in tun ? tun[key] : (tunnel as Record<string, unknown>)[key] ?? fallback) as T

  console.log(header('Tunnel'))
  console.log(`  Enabled  : ${getVal('enabled', false) ? ok('yes') : dim('no')}`)
  console.log(`  Provider : ${getVal('provider', 'viben')}`)
  console.log(`  Port     : ${getVal('port', 3100)}`)
  const authEnabled = (getVal('auth', { enabled: false }) as { enabled: boolean }).enabled
  console.log(`  Auth     : ${authEnabled ? ok('enabled') : dim('disabled')}`)
  console.log('')

  while (true) {
    const choice = await select({
      message: 'Tunnel settings:',
      choices: [
        { name: getVal('enabled', false) ? 'Disable tunnel' : 'Enable tunnel', value: 'toggle' },
        { name: 'Change provider', value: 'provider' },
        { name: 'Change port', value: 'port' },
        { name: 'Provider options', value: 'options' },
        { name: authEnabled ? 'Disable auth' : 'Enable auth', value: 'auth' },
        { name: 'Back', value: 'back' },
      ],
    })

    if (choice === 'back') break

    if (choice === 'toggle') {
      const current = getVal('enabled', false)
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/tunnel', { enabled: !current })
      }
      tun.enabled = !current
      console.log(!current ? ok('Tunnel enabled') : ok('Tunnel disabled'))
    }

    if (choice === 'provider') {
      const provider = await select({
        message: 'Select tunnel provider:',
        choices: [
          { name: 'Viben (managed)', value: 'viben' },
          { name: 'Cloudflare', value: 'cloudflare' },
          { name: 'ngrok', value: 'ngrok' },
          { name: 'bore', value: 'bore' },
          { name: 'Tailscale Funnel', value: 'tailscale' },
        ],
      })
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/tunnel', { provider, options: {} })
      }
      tun.provider = provider
      tun.options = {}
      console.log(ok(`Provider set to ${provider}`))
    }

    if (choice === 'port') {
      const val = await input({
        message: 'Tunnel port:',
        default: String(getVal('port', 3100)),
        validate: (v) => {
          const n = Number(v.trim())
          if (!Number.isInteger(n) || n < 1 || n > 65535) return 'Must be a valid port (1-65535)'
          return true
        },
      })
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/tunnel', { port: Number(val.trim()) })
      }
      tun.port = Number(val.trim())
      console.log(ok(`Tunnel port set to ${val.trim()}`))
    }

    if (choice === 'options') {
      const provider = getVal('provider', 'viben')
      const currentOptions = getVal('options', {}) as Record<string, unknown>
      await editProviderOptions(provider, currentOptions, tun)
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/tunnel', { options: tun.options })
      }
    }

    if (choice === 'auth') {
      const currentAuth = getVal('auth', { enabled: false }) as { enabled: boolean; token?: string }
      if (currentAuth.enabled) {
        if (settingsManager) {
          await settingsManager.updatePluginSettings('@viben/tunnel', { auth: { enabled: false } })
        }
        tun.auth = { enabled: false }
        console.log(ok('Tunnel auth disabled'))
      } else {
        const token = await input({
          message: 'Auth token (leave empty to auto-generate):',
          default: '',
        })
        const newAuth = token.trim() ? { enabled: true, token: token.trim() } : { enabled: true }
        if (settingsManager) {
          await settingsManager.updatePluginSettings('@viben/tunnel', { auth: newAuth })
        }
        tun.auth = newAuth
        console.log(ok('Tunnel auth enabled'))
      }
    }
  }
}

async function editProviderOptions(
  provider: string,
  currentOptions: Record<string, unknown>,
  tun: Record<string, unknown>,
): Promise<void> {
  if (provider === 'cloudflare') {
    const domain = await input({
      message: 'Custom domain (leave empty for random):',
      default: (currentOptions.domain as string) ?? '',
    })
    tun.options = domain.trim() ? { domain: domain.trim() } : {}
    if (domain.trim()) console.log(ok(`Domain set to ${domain.trim()}`))
    else console.log(dim('Using random cloudflare domain'))
  } else if (provider === 'ngrok') {
    const authtoken = await input({
      message: 'ngrok authtoken (leave empty to skip):',
      default: (currentOptions.authtoken as string) ?? '',
    })
    const domain = await input({
      message: 'ngrok domain (leave empty for random):',
      default: (currentOptions.domain as string) ?? '',
    })
    const region = await input({
      message: 'ngrok region (us, eu, ap — leave empty for default):',
      default: (currentOptions.region as string) ?? '',
    })
    const opts: Record<string, string> = {}
    if (authtoken.trim()) opts.authtoken = authtoken.trim()
    if (domain.trim()) opts.domain = domain.trim()
    if (region.trim()) opts.region = region.trim()
    tun.options = opts
    console.log(ok('ngrok options saved'))
  } else if (provider === 'bore') {
    const server = await input({
      message: 'bore server:',
      default: (currentOptions.server as string) ?? 'bore.pub',
    })
    const port = await input({
      message: 'bore port (leave empty for auto):',
      default: currentOptions.port ? String(currentOptions.port) : '',
    })
    const secret = await input({
      message: 'bore secret (leave empty to skip):',
      default: (currentOptions.secret as string) ?? '',
    })
    const opts: Record<string, unknown> = { server: server.trim() }
    if (port.trim()) opts.port = Number(port.trim())
    if (secret.trim()) opts.secret = secret.trim()
    tun.options = opts
    console.log(ok('bore options saved'))
  } else if (provider === 'tailscale') {
    const bg = await select({
      message: 'Run Tailscale Funnel in background?',
      choices: [
        { name: 'No', value: 'no' },
        { name: 'Yes', value: 'yes' },
      ],
    })
    tun.options = bg === 'yes' ? { bg: true } : {}
    console.log(ok('Tailscale options saved'))
  } else {
    console.log(dim(`No configurable options for provider "${provider}"`))
  }
}

// --- Main Config Editor ---

/**
 * Launches the interactive config editor.
 *
 * In `file` mode, changes accumulate and are written to disk on exit.
 * In `api` mode, each section's changes are sent to the running daemon
 * via the REST API, enabling hot-reload without restart.
 */
export async function runConfigEditor(
  configManager: ConfigManager,
  mode: 'file' | 'api' = 'file',
  apiPort?: number,
  settingsManager?: SettingsManager,
): Promise<void> {
  await configManager.load()
  const config = configManager.get()
  const updates: ConfigUpdates = {}

  // Derive instance root from config path: /x/y/.viben/config.json → /x/y/.viben
  const instanceRoot = path.dirname(configManager.getConfigPath())

  console.log(`\n${c.cyan}${c.bold}Viben Config Editor${c.reset}`)
  console.log(dim(`Config: ${configManager.getConfigPath()}`))
  console.log('')

  try {
    while (true) {
      const hasChanges = mode === 'file' ? Object.keys(updates).length > 0 : false
      const choice = await select({
        message: `What would you like to edit?${hasChanges ? ` ${c.yellow}(unsaved changes)${c.reset}` : ''}`,
        choices: [
          { name: 'Channels', value: 'channels' },
          { name: 'Agent', value: 'agent' },
          { name: 'Security', value: 'security' },
          { name: 'Logging', value: 'logging' },
          { name: 'Run Mode', value: 'runMode' },
          { name: 'API', value: 'api' },
          { name: 'Tunnel', value: 'tunnel' },
          { name: hasChanges ? 'Save & Exit' : 'Exit', value: 'exit' },
        ],
      })

      if (choice === 'exit') {
        if (mode === 'file' && hasChanges) {
          await configManager.save(updates)
          console.log(ok(`Config saved to ${configManager.getConfigPath()}`))
        } else if (mode === 'file') {
          console.log(dim('No changes made.'))
        }
        break
      }

      const sectionUpdates: ConfigUpdates = {}

      if (choice === 'channels') await editChannels(config, sectionUpdates, settingsManager, instanceRoot)
      else if (choice === 'agent') await editAgent(config, sectionUpdates)
      else if (choice === 'security') await editSecurity(config, sectionUpdates, settingsManager)
      else if (choice === 'logging') await editLogging(config, sectionUpdates)
      else if (choice === 'runMode') await editRunMode(config, sectionUpdates, instanceRoot)
      else if (choice === 'api') await editApi(config, sectionUpdates, settingsManager)
      else if (choice === 'tunnel') await editTunnel(config, sectionUpdates, settingsManager)

      if (mode === 'api' && Object.keys(sectionUpdates).length > 0) {
        await sendConfigViaApi(apiPort!, sectionUpdates)
        // Refresh in-memory config
        await configManager.load()
        Object.assign(config, configManager.get())
      } else {
        // Accumulate for file mode
        Object.assign(updates, sectionUpdates)
      }
    }
  } catch (err) {
    if ((err as Error).name === 'ExitPromptError') {
      console.log(dim('\nConfig editor cancelled. Changes discarded.'))
      return
    }
    throw err
  }
}

/** Sends config updates to a running daemon via the REST API, one field path at a time. */
async function sendConfigViaApi(port: number, updates: ConfigUpdates): Promise<void> {
  const { apiCall: call } = await import('../../cli/api-client.js')

  const paths = flattenToPaths(updates)
  for (const { path, value } of paths) {
    const res = await call(port, '/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, value }),
    })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) {
      console.log(warn(`Failed to update ${path}: ${data.error}`))
    } else if (data.needsRestart) {
      console.log(warn(`${path} updated — restart required`))
    }
  }
}

/** Flattens a nested object into dot-path/value pairs for the config PATCH API. */
function flattenToPaths(obj: Record<string, unknown>, prefix = ''): Array<{ path: string; value: unknown }> {
  const result: Array<{ path: string; value: unknown }> = []
  for (const [key, val] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result.push(...flattenToPaths(val as Record<string, unknown>, fullPath))
    } else {
      result.push({ path: fullPath, value: val })
    }
  }
  return result
}
