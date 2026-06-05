#!/usr/bin/env node

// CLI entry point — resolves instance-level flags, then dispatches to subcommands.
//
// Flow:
//   1. Global flags (--dir, --local, --from, --name) are stripped from argv before
//      Commander sees them, so they work uniformly across all subcommands.
//   2. Instance root is resolved from flags, CWD traversal, or env var.
//   3. Global instance migration runs once (backward compat for pre-multi-instance setups).
//   4. Commands that don't need an instance (update, adopt, instances, dev, -v, -h) run immediately.
//   5. All other commands get the resolved instance root via a prompt if it wasn't auto-detected.

import { setDefaultAutoSelectFamily } from "node:net";
// Disable Happy Eyeballs (RFC 6555) — the dual-stack connection racing strategy that node:net
// enables by default. It causes flaky behaviour in local/containerised environments where
// IPv6 is advertised but not actually routable, leading to 300ms connection delays.
setDefaultAutoSelectFamily(false);

import path from 'node:path'
import {
  printHelp,
  cmdVersion,
  cmdInstall,
  cmdUninstall,
  cmdPlugins,
  cmdPlugin,
  cmdApi,
  cmdStart,
  cmdStop,
  cmdRestart,
  cmdStatus,
  cmdLogs,
  cmdConfig,
  cmdReset,
  cmdUpdate,
  cmdDefault,
  cmdAdopt,
  cmdInstances,
  cmdIntegrate,
  cmdDoctor,
  cmdAgents,
  cmdTunnel,
  cmdOnboard,
  cmdDev,
  cmdAttach,
  cmdRemote,
  cmdSetup,
  cmdAutostart,
  cmdChannels,
} from './cli/commands/index.js'
import { resolveInstanceRoot } from './core/instance/instance-context.js'

/**
 * Global instance-targeting flags accepted by every CLI command.
 *
 * These are extracted from argv before Commander parses the command,
 * so they are available uniformly without each subcommand declaring them.
 */
export interface InstanceFlags {
  /** Use the instance in the current working directory (`.viben/` in CWD). */
  local: boolean
  /** Explicit path to the workspace directory (parent of `.viben/`). */
  dir?: string
  /** Clone a new instance from this source path. */
  from?: string
  /** Human-readable label for the instance. */
  name?: string
}

function extractInstanceFlags(args: string[]): { flags: InstanceFlags; remaining: string[] } {
  const flags: InstanceFlags = { local: false }
  const remaining: string[] = []
  let i = 0
  while (i < args.length) {
    if (args[i] === '--local') { flags.local = true; i++ }
    else if (args[i] === '--dir' && args[i + 1]) { flags.dir = args[i + 1]; i += 2 }
    else if (args[i] === '--from' && args[i + 1]) { flags.from = args[i + 1]; i += 2 }
    else if (args[i] === '--name' && args[i + 1]) { flags.name = args[i + 1]; i += 2 }
    else if (args[i] === '--global') {
      console.warn('Warning: --global is deprecated. Viben no longer has a global instance. Use --dir <path> instead.')
      i++
    }
    else { remaining.push(args[i]!); i++ }
  }
  return { flags, remaining }
}

let resolvedInstanceRoot: string | null = null
let instanceFlags: InstanceFlags = { local: false }

/**
 * Returns the instance root resolved during CLI startup.
 *
 * Available to subcommands that need the resolved path without re-resolving it.
 * May be null if the command does not require an instance (e.g., `update`, `adopt`).
 */
export function getResolvedInstanceRoot(): string | null {
  return resolvedInstanceRoot
}

/**
 * Returns the global instance-targeting flags parsed from argv.
 *
 * Useful for subcommands that need to inspect raw flags (e.g., to read `--name`).
 */
export function getInstanceFlags(): InstanceFlags {
  return instanceFlags
}

const allArgs = process.argv.slice(2)
const { flags, remaining } = extractInstanceFlags(allArgs)
instanceFlags = flags
const [command, ...args] = remaining

// Resolve instance root from flags
resolvedInstanceRoot = resolveInstanceRoot({
  dir: flags.dir,
  local: flags.local,
  cwd: process.cwd(),
})

// Auto-migrate global instance on first run after upgrade
const { migrateGlobalInstance } = await import('./core/instance/migration.js')
const migrated = await migrateGlobalInstance()
if (migrated && !resolvedInstanceRoot) {
  resolvedInstanceRoot = migrated
}

// --workspace is a deprecated alias for --dir, specific to the setup command.
// It cannot be extracted globally (conflicts with `api` command's --workspace).
if (command === 'setup' && !resolvedInstanceRoot) {
  const wsIdx = args.indexOf('--workspace')
  if (wsIdx !== -1 && args[wsIdx + 1]) {
    if (!args.includes('--json')) console.warn('Warning: --workspace is deprecated. Use --dir instead.')
    resolvedInstanceRoot = resolveInstanceRoot({ dir: args[wsIdx + 1], cwd: process.cwd() })
  }
}

// Commands that don't need an instance root
const noInstanceCommands: Record<string, () => Promise<void>> = {
  '--help': async () => printHelp(),
  '-h': async () => printHelp(),
  '--version': () => cmdVersion(args),
  '-v': () => cmdVersion(args),
  'update': () => cmdUpdate(args),
  'adopt': () => cmdAdopt(args),
  'channels': () => cmdChannels(args),
  'instances': async () => cmdInstances(args, flags),
  'integrate': () => cmdIntegrate(args),
  'dev': () => cmdDev(args),
}

/**
 * Resolve instance root, prompting interactively when needed.
 * - If flags or auto-detect resolved it → use that
 * - If null + operational command → prompt with existing instances only
 * - If null + cmdDefault → prompt with existing + "create new here"
 */
async function resolveRoot(allowCreate: boolean): Promise<string> {
  if (resolvedInstanceRoot) return resolvedInstanceRoot
  const { promptForInstance } = await import('./cli/instance-prompt.js')
  return promptForInstance({ allowCreate })
}

async function main() {
  // No-instance commands
  const noInstance = command ? noInstanceCommands[command] : undefined
  if (noInstance) {
    await noInstance()
    return
  }

  // Daemon child (special: reads root from env)
  if (command === '--daemon-child') {
    const { startServer } = await import('./main.js')
    const envRoot = process.env.VIBEN_INSTANCE_ROOT
    if (envRoot) {
      const { createInstanceContext, getGlobalRoot: getGlobal } = await import('./core/instance/instance-context.js')
      const { InstanceRegistry } = await import('./core/instance/instance-registry.js')
      const registry = new InstanceRegistry(path.join(getGlobal(), 'instances.json'))
      await registry.load()
      const entry = registry.getByRoot(envRoot)
      const { randomUUID } = await import('node:crypto')
      const id = entry?.id ?? randomUUID()
      const ctx = createInstanceContext({
        id,
        root: envRoot,
      })
      await startServer({ instanceContext: ctx })
    } else {
      await startServer()
    }
    return
  }

  // Instance-aware commands (resolve root with prompt if needed)
  const instanceCommands: Record<string, (root: string) => Promise<void>> = {
    'install': (r) => cmdInstall(args, r),
    'uninstall': (r) => cmdUninstall(args, r),
    'plugins': (r) => cmdPlugins(args, r),
    'plugin': (r) => cmdPlugin(args, r),
    'api': (r) => cmdApi(args, r),
    'start': (r) => cmdStart(args, r),
    'stop': (r) => cmdStop(args, r),
    'restart': (r) => cmdRestart(args, r),
    'status': (r) => cmdStatus(args, r),
    'logs': (r) => cmdLogs(args, r),
    'config': (r) => cmdConfig(args, r),
    'reset': (r) => cmdReset(args, r),
    'doctor': (r) => cmdDoctor(args, r),
    'agents': (r) => cmdAgents(args, r),
    'tunnel': (r) => cmdTunnel(args, r),
    'onboard': (r) => cmdOnboard(r),
    'attach': (r) => cmdAttach(args, r),
    'remote': (r) => cmdRemote(args, r),
    'setup': (r) => cmdSetup(args, r),
    'autostart': (r) => cmdAutostart(args, r),
  }

  const handler = command ? instanceCommands[command] : undefined
  if (handler) {
    const root = await resolveRoot(false)
    await handler(root)
  } else {
    // cmdDefault: allow "create new here" option
    const root = await resolveRoot(true)
    await cmdDefault(command, root)
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
