import fs from 'node:fs'
import path from 'node:path'
import { getGlobalRoot } from '../core/instance/instance-context.js'
import { InstanceRegistry } from '../core/instance/instance-registry.js'
import { createChildLogger } from '../core/utils/log.js'

const log = createChildLogger({ module: 'resolve-instance-id' })

/**
 * Resolve the stable instance ID for a given instance root.
 *
 * 1. Read from config.json (preferred — instance knows its own UUID)
 * 2. Fall back to registry for backward compatibility
 * 3. Last resort: sanitized parent directory name
 */
export function resolveInstanceId(instanceRoot: string): string {
  // 1. Read id from config.json (preferred — instance knows its own UUID)
  try {
    const configPath = path.join(instanceRoot, 'config.json')
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (raw.id && typeof raw.id === 'string') return raw.id
  } catch { /* fall through */ }

  // 2. Fall back to registry (backward compat for instances that haven't migrated yet)
  try {
    const reg = new InstanceRegistry(path.join(getGlobalRoot(), 'instances.json'))
    reg.load()
    const entry = reg.getByRoot(instanceRoot)
    if (entry?.id) return entry.id
  } catch (err) {
    log.debug({ err: (err as Error).message, instanceRoot }, 'Could not read instance registry, using fallback id')
  }

  // 3. Last resort: sanitized parent dir name
  return path.basename(path.dirname(instanceRoot)).replace(/[^a-zA-Z0-9-]/g, '-') || 'default'
}
