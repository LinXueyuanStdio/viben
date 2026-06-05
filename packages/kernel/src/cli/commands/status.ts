import { InstanceRegistry } from '../../core/instance/instance-registry.js'
import { getGlobalRoot } from '../../core/instance/instance-context.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/**
 * `viben status` — Show daemon status for one or all instances.
 *
 * Supports:
 * - Default: status of the resolved instance root
 * - --all: table listing all registry entries
 * - --id <id>: status of a specific instance by ID
 */
export async function cmdStatus(args: string[] = [], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  // Handle --all flag
  if (args.includes('--all')) {
    await showAllInstances(json)
    return
  }

  // Handle --id flag
  const idIdx = args.indexOf('--id')
  if (idIdx !== -1 && args[idIdx + 1]) {
    await showInstanceById(args[idIdx + 1]!, json)
    return
  }

  // Default: show status of current/specified instance
  const root = instanceRoot!
  await showSingleInstance(root, json)
}

async function showAllInstances(json = false): Promise<void> {
  const registryPath = path.join(getGlobalRoot(), 'instances.json')
  const registry = new InstanceRegistry(registryPath)
  await registry.load()
  const instances = registry.list()

  if (json) {
    jsonSuccess({
      instances: instances.map(entry => {
        const info = readInstanceInfo(entry.root)
        return {
          id: entry.id,
          name: info.name,
          status: info.pid ? 'online' : 'offline',
          pid: info.pid,
          dir: entry.root,
          mode: info.runMode,
          channels: info.channels,
          apiPort: info.apiPort,
          tunnelPort: info.tunnelPort,
        }
      }),
    })
  }

  if (instances.length === 0) {
    console.log('No workspaces registered.')
    return
  }

  // Print table header
  console.log('')
  console.log('  Status     ID               Name             Directory            Mode     Channels   API    Tunnel')
  console.log('  ' + '─'.repeat(100))

  for (const entry of instances) {
    const info = readInstanceInfo(entry.root)
    const status = info.pid ? '● online' : '○ offline'
    const mode = info.pid ? (info.runMode === 'daemon' ? 'daemon' : 'fg') : '—'
    const api = info.apiPort ? String(info.apiPort) : '—'
    const tunnel = info.tunnelPort ? String(info.tunnelPort) : '—'
    const dir = entry.root.replace(/\/.viben$/, '').replace(os.homedir(), '~')
    const channels = info.channels.join(', ') || '—'
    const name = info.name ?? entry.id

    console.log(`  ${status.padEnd(10)} ${entry.id.padEnd(16)} ${name.padEnd(16)} ${dir.padEnd(20)} ${mode.padEnd(8)} ${channels.padEnd(10)} ${api.padEnd(6)} ${tunnel}`)
  }
  console.log('')
}

async function showInstanceById(id: string, json = false): Promise<void> {
  const registryPath = path.join(getGlobalRoot(), 'instances.json')
  const registry = new InstanceRegistry(registryPath)
  await registry.load()
  const entry = registry.get(id)
  if (!entry) {
    if (json) jsonError(ErrorCodes.INSTANCE_NOT_FOUND, `Workspace "${id}" not found.`)
    console.error(`Workspace "${id}" not found.`)
    process.exit(1)
  }
  await showSingleInstance(entry.root, json)
}

async function showSingleInstance(root: string, json = false): Promise<void> {
  // Read PID and check if running
  const info = readInstanceInfo(root)

  if (json) {
    jsonSuccess({
      id: path.basename(root),
      name: info.name,
      status: info.pid ? 'online' : 'offline',
      pid: info.pid,
      dir: root,
      mode: info.runMode,
      channels: info.channels,
      apiPort: info.apiPort,
      tunnelPort: info.tunnelPort,
    })
  }

  if (info.pid) {
    console.log(`Viben is running (PID ${info.pid})`)
    if (info.name) console.log(`  Name: ${info.name}`)
    if (info.apiPort) console.log(`  API: port ${info.apiPort}`)
    if (info.tunnelPort) console.log(`  Tunnel: port ${info.tunnelPort}`)
    if (info.channels.length > 0) console.log(`  Channels: ${info.channels.join(', ')}`)
  } else {
    console.log('Viben is not running.')
  }
}

/** Runtime information about a single instance, read directly from its data files. */
export interface InstanceInfo {
  name: string | null
  /** PID of the running daemon, or null if not running. */
  pid: number | null
  apiPort: number | null
  /** Port of the system-level tunnel (from tunnels.json), or null if not active. */
  tunnelPort: number | null
  runMode: string | null
  /** IDs of enabled messaging channel adapters (e.g. ['telegram', 'discord']). */
  channels: string[]
}

/**
 * Read instance runtime information directly from the instance root's data files.
 *
 * Does not require the daemon to be running — reads config.json, viben.pid,
 * api.port, tunnels.json, and plugins.json from disk. Uses `process.kill(pid, 0)`
 * as a liveness check for the recorded PID.
 */
export function readInstanceInfo(root: string): InstanceInfo {
  const result: InstanceInfo = {
    name: null, pid: null, apiPort: null,
    tunnelPort: null, runMode: null, channels: [],
  }

  // Read name and runMode from config
  try {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf-8'))
    result.name = config.instanceName ?? null
    result.runMode = config.runMode ?? null
  } catch {}

  // Read PID and check if alive
  try {
    const pid = parseInt(fs.readFileSync(path.join(root, 'viben.pid'), 'utf-8').trim())
    if (!isNaN(pid)) {
      process.kill(pid, 0) // throws if process doesn't exist
      result.pid = pid
    }
  } catch {}

  // Read API port
  try {
    const port = parseInt(fs.readFileSync(path.join(root, 'api.port'), 'utf-8').trim())
    if (!isNaN(port)) result.apiPort = port
  } catch {}

  // Read tunnel port from tunnels.json
  try {
    const tunnels = JSON.parse(fs.readFileSync(path.join(root, 'tunnels.json'), 'utf-8'))
    const entries = Object.values(tunnels) as any[]
    const systemEntry = entries.find((t: any) => t.type === 'system')
    if (systemEntry?.port) result.tunnelPort = systemEntry.port
  } catch {}

  // Read enabled channels from plugins.json
  try {
    const plugins = JSON.parse(fs.readFileSync(path.join(root, 'plugins.json'), 'utf-8'))
    const adapterMap: Array<{ pluginName: string; channelId: string }> = [
      { pluginName: '@viben/telegram', channelId: 'telegram' },
      { pluginName: '@viben/discord-adapter', channelId: 'discord' },
      { pluginName: '@viben/slack-adapter', channelId: 'slack' },
    ]
    for (const { pluginName, channelId } of adapterMap) {
      if (plugins.installed?.[pluginName] && plugins.installed[pluginName].enabled !== false) {
        result.channels.push(channelId)
      }
    }
  } catch {}

  return result
}

/**
 * Format instance status as display lines for use in `viben attach` and `cmdDefault`.
 * Returns null if the daemon is not running (nothing to show).
 */
export function formatInstanceStatus(root: string): { info: InstanceInfo; lines: string[] } | null {
  const info = readInstanceInfo(root)
  if (!info.pid) return null

  const workspaceDir = path.dirname(root)
  const displayPath = workspaceDir.replace(os.homedir(), '~')

  const lines: string[] = []
  lines.push(`  PID:       ${info.pid}`)
  lines.push(`  Workspace: ${info.name ?? 'unknown'} (${displayPath})`)
  lines.push(`  Mode:      ${info.runMode ?? 'unknown'}`)
  if (info.channels.length > 0) lines.push(`  Channels:  ${info.channels.join(', ')}`)
  if (info.apiPort) lines.push(`  API:       port ${info.apiPort}`)
  if (info.tunnelPort) lines.push(`  Tunnel:    port ${info.tunnelPort}`)

  return { info, lines }
}
