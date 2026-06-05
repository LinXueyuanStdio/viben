import * as pathMod from 'node:path'
import { readApiPort, apiCall } from '../api-client.js'
import { wantsHelp, buildNestedUpdateFromPath } from './helpers.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

/**
 * `viben config` — View and edit the instance configuration.
 *
 * Subcommands:
 * - (bare): opens the interactive TUI config editor
 * - set <key> <value>: non-interactive path-value update
 *
 * When the daemon is running, config set uses the live API (PATCH /api/config)
 * so changes take effect without restart where possible. When stopped, edits
 * config.json directly.
 */
export async function cmdConfig(args: string[] = [], instanceRoot?: string): Promise<void> {
  const subCmd = args[0] // 'set' or undefined

  if (wantsHelp(args) && subCmd === 'set') {
    console.log(`
\x1b[1mviben config set\x1b[0m — Set a config value directly

\x1b[1mUsage:\x1b[0m
  viben config set <key> <value>

\x1b[1mArguments:\x1b[0m
  <key>           Dot-notation config path (e.g. telegram.botToken)
  <value>         New value (JSON-parsed if possible, otherwise string)

\x1b[1mOptions:\x1b[0m
  --json          Output result as JSON
  -h, --help      Show this help message

Works with both running and stopped daemon. When running, uses
the API for live updates. When stopped, edits config file directly.

\x1b[1mExamples:\x1b[0m
  viben config set defaultAgent claude
  viben config set security.maxConcurrentSessions 5
  viben config set telegram.botToken "123:ABC"
`)
    return
  }

  if (wantsHelp(args)) {
    console.log(`
\x1b[1mviben config\x1b[0m — View and edit configuration

\x1b[1mUsage:\x1b[0m
  viben config                       Open interactive config editor
  viben config set <key> <value>     Set a config value directly

\x1b[1mOptions:\x1b[0m
  --json                                 Output result as JSON
  -h, --help                           Show this help message

Works with both running and stopped daemon. When running, uses
the API for live updates. When stopped, edits config file directly.

\x1b[1mExamples:\x1b[0m
  viben config
  viben config set defaultAgent claude

\x1b[2mRun 'viben config set --help' for more info on the set subcommand.\x1b[0m
`)
    return
  }

  if (subCmd === 'set') {
    // Non-interactive: viben config set <key> <value>
    const json = isJsonMode(args)
    if (json) await muteForJson()

    const configPath = args[1]
    const configValue = args[2]
    if (!configPath || configValue === undefined) {
      if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Missing required arguments: <path> and <value>')
      console.error('Usage: viben config set <path> <value>')
      process.exit(1)
    }

    // Validate top-level config key
    const { ConfigSchema } = await import('../../core/config/config.js')
    const topLevelKey = configPath.split('.')[0]
    const validConfigKeys = Object.keys(ConfigSchema.shape)
    if (!validConfigKeys.includes(topLevelKey)) {
      if (json) jsonError(ErrorCodes.CONFIG_INVALID, `Unknown config key: ${topLevelKey}`)
      const { suggestMatch } = await import('../suggest.js')
      const suggestion = suggestMatch(topLevelKey, validConfigKeys)
      console.error(`Unknown config key: ${topLevelKey}`)
      if (suggestion) console.error(`Did you mean: ${suggestion}?`)
      process.exit(1)
    }

    let value: unknown = configValue
    try { value = JSON.parse(configValue) } catch { /* keep as string */ }

    const port = readApiPort(undefined, instanceRoot)
    if (port !== null) {
      // Server running — use API
      const res = await apiCall(port, '/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: configPath, value }),
      }, instanceRoot)
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, `${data.error}`)
        console.error(`Error: ${data.error}`)
        process.exit(1)
      }
      if (json) jsonSuccess({ path: configPath, value, needsRestart: data.needsRestart ?? false })
      console.log(`Config updated: ${configPath} = ${JSON.stringify(value)}`)
      if (data.needsRestart) {
        console.log('Note: restart required for this change to take effect.')
      }
    } else {
      // Server not running — update file directly
      const { ConfigManager } = await import('../../core/config/config.js')
      const cm = new ConfigManager(instanceRoot ? pathMod.join(instanceRoot, 'config.json') : undefined)
      if (!(await cm.exists())) {
        if (json) jsonError(ErrorCodes.CONFIG_NOT_FOUND, 'No config found. Run "viben" first to set up.')
        console.error('No config found. Run "viben" first to set up.')
        process.exit(1)
      }
      await cm.load()
      const updates = buildNestedUpdateFromPath(configPath, value)
      await cm.save(updates)
      if (json) jsonSuccess({ path: configPath, value, needsRestart: false })
      console.log(`Config updated: ${configPath} = ${JSON.stringify(value)}`)
    }
    return
  }

  // Interactive editor
  const { runConfigEditor } = await import('../../core/config/config-editor.js')
  const { ConfigManager } = await import('../../core/config/config.js')
  const { SettingsManager } = await import('../../core/plugin/settings-manager.js')
  const root = instanceRoot!
  const cm = new ConfigManager(pathMod.join(root, 'config.json'))
  if (!(await cm.exists())) {
    console.error('No config found. Run "viben" first to set up.')
    process.exit(1)
  }
  const settingsManager = new SettingsManager(pathMod.join(root, 'plugins', 'data'))

  const port = readApiPort(undefined, instanceRoot)
  if (port !== null) {
    await runConfigEditor(cm, 'api', port, settingsManager)
  } else {
    await runConfigEditor(cm, 'file', undefined, settingsManager)
  }
}
