import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { VibenPlugin } from './types.js'

/**
 * Resolve plugin load order via topological sort (DFS-based).
 *
 * Plugins must boot in dependency order so that services and middleware from
 * dependencies are available when a plugin's setup() runs. This function:
 *
 * 1. Removes overridden plugins (a plugin with `overrides: 'X'` replaces X)
 * 2. Cascade-skips plugins whose required dependencies are missing
 * 3. Detects circular dependencies (throws)
 * 4. Returns plugins in safe boot order (dependencies before dependents)
 */
export function resolveLoadOrder(plugins: VibenPlugin[]): VibenPlugin[] {
  // Phase 1: Apply overrides — remove overridden plugins
  const overrideTargets = new Set<string>()
  for (const p of plugins) {
    if (p.overrides) {
      overrideTargets.add(p.overrides)
    }
  }
  let remaining = plugins.filter((p) => !overrideTargets.has(p.name))

  // Phase 2: Build name→plugin map
  const byName = new Map<string, VibenPlugin>()
  for (const p of remaining) {
    byName.set(p.name, p)
  }

  // Phase 3: Find missing deps and cascade-skip
  const skipped = new Set<string>()

  function cascadeSkip(name: string): void {
    if (skipped.has(name)) return
    skipped.add(name)
    // Skip all plugins that depend on this one
    for (const p of remaining) {
      if (p.pluginDependencies && name in p.pluginDependencies) {
        cascadeSkip(p.name)
      }
    }
  }

  for (const p of remaining) {
    if (p.pluginDependencies) {
      for (const dep of Object.keys(p.pluginDependencies)) {
        if (!byName.has(dep)) {
          cascadeSkip(p.name)
        }
      }
    }
  }

  remaining = remaining.filter((p) => !skipped.has(p.name))

  // Rebuild map after skipping
  byName.clear()
  for (const p of remaining) {
    byName.set(p.name, p)
  }

  // Phase 4: Topological sort with cycle detection (DFS)
  const visited = new Set<string>()
  const inStack = new Set<string>()
  const order: VibenPlugin[] = []

  function visit(name: string): void {
    if (visited.has(name)) return
    if (inStack.has(name)) {
      throw new Error(`Circular dependency detected: ${name}`)
    }

    inStack.add(name)
    const plugin = byName.get(name)!
    if (plugin.pluginDependencies) {
      for (const dep of Object.keys(plugin.pluginDependencies)) {
        visit(dep)
      }
    }
    inStack.delete(name)
    visited.add(name)
    order.push(plugin)
  }

  for (const p of remaining) {
    visit(p.name)
  }

  return order
}

/**
 * Compute SHA-256 checksum of a file, returned as 64-char hex string.
 */
export function computeChecksum(filePath: string): string {
  const data = readFileSync(filePath)
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Verify that actual checksum matches expected.
 */
export function verifyChecksum(_name: string, expected: string, actual: string): boolean {
  return expected === actual
}
