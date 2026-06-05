import * as path from 'node:path';
import fs from 'node:fs'
import { jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'
import { getGlobalRoot } from '../../core/instance/instance-context.js'
import { InstanceRegistry, readIdFromConfig } from '../../core/instance/instance-registry.js'
import { initInstanceFiles } from '../../core/instance/instance-init.js'

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function readConfigField(instanceRoot: string, field: string): string | null {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(instanceRoot, 'config.json'), 'utf-8'))
    return typeof raw[field] === 'string' ? raw[field] : null
  } catch { return null }
}

/**
 * `viben setup` — Non-interactive instance initialisation for scripted/programmatic use.
 *
 * Writes minimal instance files (config.json with agent and runMode) without running
 * the interactive wizard. Used by the Viben App and CI pipelines to bootstrap instances.
 * The default instanceName is derived from the workspace directory basename if not given.
 */
export async function cmdSetup(args: string[], instanceRoot: string): Promise<void> {
  const agentRaw = parseFlag(args, '--agent');
  const json = args.includes('--json');
  if (json) await muteForJson()

  if (!agentRaw) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, '--agent is required')
    console.error('  Error: --agent <name> is required');
    process.exit(1);
  }

  const rawRunMode = parseFlag(args, '--run-mode') ?? 'daemon';
  if (rawRunMode !== 'daemon' && rawRunMode !== 'foreground') {
    if (json) jsonError(ErrorCodes.CONFIG_INVALID, `--run-mode must be 'daemon' or 'foreground'`)
    console.error(`  Error: --run-mode must be 'daemon' or 'foreground'`);
    process.exit(1);
  }
  const runMode = rawRunMode as 'daemon' | 'foreground';

  const agents = agentRaw.split(',').map(a => a.trim());

  const registryPath = path.join(getGlobalRoot(), 'instances.json')
  const registry = new InstanceRegistry(registryPath)
  registry.load()

  // Resolve id: config.json is source of truth. Reconciles any mismatch with registry.
  const { id, registryUpdated } = registry.resolveId(instanceRoot)

  // Write instance files with id — config.json now carries the UUID.
  // Save registry after init so a crash during init doesn't leave a stale entry.
  initInstanceFiles(instanceRoot, { agents, runMode, mergeExisting: true, id })

  if (registryUpdated) {
    registry.save()
  }

  // Default instanceName to the workspace directory basename if not already set
  const name = readConfigField(instanceRoot, 'instanceName')
             ?? path.basename(path.dirname(instanceRoot))

  // Persist the default name if it wasn't set
  if (!readConfigField(instanceRoot, 'instanceName')) {
    const configPath = path.join(instanceRoot, 'config.json')
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      raw.instanceName = name
      fs.writeFileSync(configPath, JSON.stringify(raw, null, 2))
    } catch { /* best-effort */ }
  }

  if (json) {
    jsonSuccess({ id, name, directory: path.dirname(instanceRoot), configPath: path.join(instanceRoot, 'config.json') })
  } else {
    console.log(`\n  \x1b[32m✓ Setup complete.\x1b[0m Config written to ${path.join(instanceRoot, 'config.json')}\n`)
  }
}
