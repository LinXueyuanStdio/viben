import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { getGlobalRoot } from '../core/instance/instance-context.js'
import { InstanceRegistry } from '../core/instance/instance-registry.js'

/**
 * Prompt user to pick an instance when none was resolved (no flags, no .viben in cwd).
 *
 * For the default command (bare `viben`): offers "use existing" or "create new setup here".
 * For operational commands (start/stop/restart/etc.): only shows existing instances.
 */
export async function promptForInstance(opts: {
  allowCreate?: boolean
}): Promise<string> {
  const globalRoot = getGlobalRoot()
  const globalConfigExists = fs.existsSync(path.join(globalRoot, 'config.json'))
  const cwd = process.cwd()
  const isHomeDir = path.resolve(cwd) === path.resolve(os.homedir())

  // If CWD is home dir, redirect to ~/viben-workspace (home dir conflicts with shared store)
  const defaultWorkspace = path.join(os.homedir(), 'viben-workspace')
  const createRoot = isHomeDir
    ? path.join(defaultWorkspace, '.viben')
    : path.join(cwd, '.viben')

  // Walk up from CWD to find nearest parent .viben/
  const detectedParent = findParentInstance(cwd, globalRoot)

  // Collect existing instances from registry
  const registryPath = path.join(globalRoot, 'instances.json')
  const registry = new InstanceRegistry(registryPath)
  registry.load()
  const instances = registry.list().filter(e => fs.existsSync(e.root))

  // Nothing exists anywhere — no global config, no detected parent
  if (!globalConfigExists && !detectedParent) {
    if (instances.length === 0) {
      if (opts.allowCreate) {
        if (isHomeDir) {
          fs.mkdirSync(defaultWorkspace, { recursive: true })
          console.log(`\n  Home directory cannot be used as workspace.`)
          console.log(`  Created \x1b[1m~/viben-workspace\x1b[0m as default workspace.\n`)
          console.log(`  \x1b[2mTip: cd ~/viben-workspace\x1b[0m\n`)
        }
        return createRoot
      }
      console.error('No Viben instances found. Run `viben` in your workspace directory to set up.')
      process.exit(1)
    }
  }

  // Non-interactive: prefer detected parent, then single instance
  const isTTY = process.stdin.isTTY && process.stdout.isTTY
  if (!isTTY) {
    if (detectedParent) return detectedParent
    if (instances.length === 1) return instances[0]!.root
    console.error('Cannot determine instance in non-interactive mode. Use --dir <path>.')
    process.exit(1)
  }

  // Format labels: "Name (path)"
  const instanceOptions = instances
    // Exclude detected parent — it will be added at the top separately
    .filter(e => !detectedParent || e.root !== detectedParent)
    .map(e => {
      let name = e.id
      try {
        const raw = fs.readFileSync(path.join(e.root, 'config.json'), 'utf-8')
        const parsed = JSON.parse(raw)
        if (parsed.instanceName) name = parsed.instanceName
      } catch { /* use id */ }
      const workspaceDir = path.dirname(e.root)
      const displayPath = workspaceDir.replace(os.homedir(), '~')
      return { value: e.root, label: `${name} (${displayPath})` }
    })

  // Prepend detected parent instance at the top
  if (detectedParent) {
    let name = path.basename(path.dirname(detectedParent))
    try {
      const raw = fs.readFileSync(path.join(detectedParent, 'config.json'), 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed.instanceName) name = parsed.instanceName
    } catch { /* use dir name */ }
    const workspaceDir = path.dirname(detectedParent)
    const displayPath = workspaceDir.replace(os.homedir(), '~')
    instanceOptions.unshift({ value: detectedParent, label: `${name} (${displayPath})` })
  }

  // Operational commands (not allowCreate): auto-select if only 1 instance
  if (!opts.allowCreate && instanceOptions.length === 1) {
    const selected = instanceOptions[0]!
    const displayPath = selected.value.replace(os.homedir(), '~')
    console.log(`  \x1b[2m▸ Using: ${selected.label}\x1b[0m`)
    return selected.value
  }

  // Build prompt options
  const options: { value: string; label: string }[] = instanceOptions.map(o => ({
    value: o.value,
    label: o.label,
  }))

  if (opts.allowCreate) {
    const createDisplay = createRoot.replace(os.homedir(), '~')
    const createLabel = isHomeDir
      ? `New workspace (~/viben-workspace)`
      : `New local workspace (${createDisplay})`
    options.push({ value: createRoot, label: createLabel })
  }

  const clack = await import('@clack/prompts')
  const choice = await clack.select({
    message: 'How would you like to run Viben?',
    options,
  })

  if (clack.isCancel(choice)) {
    process.exit(0)
  }

  if (choice === createRoot) {
    if (isHomeDir) {
      fs.mkdirSync(defaultWorkspace, { recursive: true })
      console.log(`\n  \x1b[2mTip: cd ~/viben-workspace\x1b[0m`)
    } else {
      console.log(`\x1b[2mTip: next time use \`viben --local\`\x1b[0m`)
    }
  }

  return choice as string
}

/**
 * Walk up from `cwd` looking for a parent directory containing `.viben/`.
 * Skips exact CWD (already handled by resolveInstanceRoot) and global root.
 * Returns the `.viben/` path if found, or null.
 */
export function findParentInstance(cwd: string, globalRoot: string): string | null {
  let dir = path.dirname(cwd) // start from parent, not CWD itself
  while (true) {
    const candidate = path.join(dir, '.viben')
    if (candidate !== globalRoot && fs.existsSync(path.join(candidate, 'config.json'))) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}
