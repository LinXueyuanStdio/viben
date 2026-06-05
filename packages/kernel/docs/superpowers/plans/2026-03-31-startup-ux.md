# Startup UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the CLI experience when interacting with a running daemon — rich status display, interactive menu, instance clarity, attach command, and mode-switching restart.

**Architecture:** Add three new modules (`interactive-menu.ts`, `instance-hint.ts`, `attach.ts`) and modify the default/start/restart commands to use them. TTY detection gates interactive behavior; non-TTY gets info-only output.

**Tech Stack:** Node.js readline (raw mode keypress), `process.stdout.isTTY`, existing `readInstanceInfo()` from `status.ts`, existing daemon functions.

**Spec:** `docs/superpowers/specs/2026-03-31-startup-ux-design.md`

---

### Task 1: Instance hint utility

Shared utility that prints which instance is being used and hints about alternatives.

**Files:**
- Create: `src/cli/instance-hint.ts`

- [ ] **Step 1: Create instance-hint.ts**

```typescript
// src/cli/instance-hint.ts
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { getGlobalRoot } from '../core/instance-context.js'

/**
 * Print which instance root is being used.
 * If a local .viben exists in cwd but global is active, show a hint.
 */
export function printInstanceHint(root: string): void {
  const globalRoot = getGlobalRoot()
  const isGlobal = root === globalRoot
  const displayPath = root.replace(os.homedir(), '~')
  const label = isGlobal ? 'global' : 'local'

  console.log(`  Instance: ${displayPath} (${label})`)

  // If using global but local exists in cwd, hint
  if (isGlobal) {
    const localRoot = path.join(process.cwd(), '.viben')
    if (fs.existsSync(localRoot)) {
      const localDisplay = localRoot.replace(os.homedir(), '~')
      console.log(`  \x1b[2mhint: local instance found at ${localDisplay} — use --local to use it\x1b[0m`)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/instance-hint.ts
git commit -m "feat(cli): add instance hint utility for startup clarity"
```

---

### Task 2: Interactive menu utility

TTY-aware keypress menu that shows options and executes on single keypress.

**Files:**
- Create: `src/cli/interactive-menu.ts`

- [ ] **Step 1: Create interactive-menu.ts**

```typescript
// src/cli/interactive-menu.ts
import readline from 'node:readline'

export interface MenuOption {
  key: string
  label: string
  action: () => Promise<void> | void
}

/**
 * Show an interactive single-keypress menu (TTY only).
 * Returns true if a menu was shown, false if non-TTY.
 */
export function showInteractiveMenu(options: MenuOption[]): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.resolve(false)
  }

  // Print options in two columns
  const half = Math.ceil(options.length / 2)
  for (let i = 0; i < half; i++) {
    const left = options[i]!
    const right = options[i + half]
    const leftStr = `  \x1b[1m[${left.key}]\x1b[0m ${left.label}`
    if (right) {
      const rightStr = `\x1b[1m[${right.key}]\x1b[0m ${right.label}`
      console.log(`${leftStr.padEnd(34)}${rightStr}`)
    } else {
      console.log(leftStr)
    }
  }
  console.log('')

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, terminal: false })

    process.stdin.setRawMode(true)
    process.stdin.resume()

    const onData = async (buf: Buffer) => {
      const ch = buf.toString().toLowerCase()

      // Handle Ctrl+C
      if (ch === '\x03') {
        cleanup()
        process.exit(0)
      }

      const option = options.find(o => o.key === ch)
      if (option) {
        cleanup()
        console.log('')
        await option.action()
        resolve(true)
      }
      // Ignore unrecognized keys
    }

    const cleanup = () => {
      process.stdin.removeListener('data', onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      rl.close()
    }

    process.stdin.on('data', onData)
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/interactive-menu.ts
git commit -m "feat(cli): add interactive keypress menu utility"
```

---

### Task 3: Rich status display for running daemon

Extract a shared function that prints rich daemon status info, used by both the default command and attach.

**Files:**
- Modify: `src/cli/commands/status.ts` — export `formatInstanceStatus()`

- [ ] **Step 1: Add formatInstanceStatus to status.ts**

Add this function after the existing `readInstanceInfo` function in `src/cli/commands/status.ts`:

```typescript
export function formatInstanceStatus(root: string): { info: InstanceInfo; lines: string[] } | null {
  const info = readInstanceInfo(root)
  if (!info.pid) return null

  const displayRoot = root.replace(os.homedir(), '~')
  const isGlobal = root === path.join(os.homedir(), '.viben')
  const label = isGlobal ? 'global' : 'local'

  const lines: string[] = []
  lines.push(`  PID:       ${info.pid}`)
  lines.push(`  Instance:  ${displayRoot} (${label})`)
  lines.push(`  Mode:      ${info.runMode ?? 'unknown'}`)
  if (info.channels.length > 0) lines.push(`  Channels:  ${info.channels.join(', ')}`)
  if (info.apiPort) lines.push(`  API:       port ${info.apiPort}`)
  if (info.tunnelPort) lines.push(`  Tunnel:    port ${info.tunnelPort}`)

  return { info, lines }
}
```

Need to add the `path` import at the top of the file (it already imports `os` and `path`).

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/status.ts
git commit -m "feat(cli): add formatInstanceStatus for rich status display"
```

---

### Task 4: Rewrite default command with smart daemon detection + interactive menu

The main change: when `viben` is run and daemon is already running, show rich status + interactive menu instead of an error.

**Files:**
- Modify: `src/cli/commands/default.ts`

- [ ] **Step 1: Rewrite default.ts**

Replace the entire content of `src/cli/commands/default.ts` with:

```typescript
import { checkAndPromptUpdate } from '../version.js'
import { printHelp } from './help.js'
import path from 'node:path'
import os from 'node:os'
import { createInstanceContext, getGlobalRoot } from '../../core/instance-context.js'
import { printInstanceHint } from '../instance-hint.js'

export async function cmdDefault(command: string | undefined, instanceRoot?: string): Promise<void> {
  const root = instanceRoot ?? path.join(os.homedir(), '.viben')
  const pluginsDataDir = path.join(root, 'plugins', 'data')
  const registryPath = path.join(root, 'plugins.json')
  const forceForeground = command === '--foreground'

  // Reject unknown commands
  if (command && !command.startsWith('-')) {
    const { suggestMatch } = await import('../suggest.js')
    const topLevelCommands = [
      'start', 'stop', 'status', 'logs', 'config', 'reset', 'update',
      'install', 'uninstall', 'plugins', 'plugin', 'api', 'adopt', 'integrate', 'doctor', 'agents', 'onboard',
      'attach',
    ]
    const suggestion = suggestMatch(command, topLevelCommands)
    console.error(`Unknown command: ${command}`)
    if (suggestion) console.error(`Did you mean: ${suggestion}?`)
    printHelp()
    process.exit(1)
  }

  await checkAndPromptUpdate()

  const { ConfigManager } = await import('../../core/config/config.js')
  const cm = new ConfigManager()

  // If no config, run setup first
  if (!(await cm.exists())) {
    const { SettingsManager } = await import('../../core/plugin/settings-manager.js')
    const { PluginRegistry } = await import('../../core/plugin/plugin-registry.js')
    const settingsManager = new SettingsManager(pluginsDataDir)
    const pluginRegistry = new PluginRegistry(registryPath)
    await pluginRegistry.load()

    const { runSetup } = await import('../../core/setup/index.js')
    const shouldStart = await runSetup(cm, { settingsManager, pluginRegistry })
    if (!shouldStart) process.exit(0)
  }

  await cm.load()
  const config = cm.get()

  // Check if daemon is already running before trying to start
  if (!forceForeground && config.runMode === 'daemon') {
    const { isProcessRunning, getPidPath, startDaemon } = await import('../daemon.js')
    const pidPath = getPidPath(root)

    if (isProcessRunning(pidPath)) {
      await showAlreadyRunningMenu(root)
      return
    }

    const result = startDaemon(pidPath, config.logging.logDir, root)
    if ('error' in result) {
      console.error(result.error)
      process.exit(1)
    }
    printInstanceHint(root)
    console.log(`Viben daemon started (PID ${result.pid})`)
    return
  }

  const { markRunning } = await import('../daemon.js')
  markRunning(root)
  printInstanceHint(root)
  const { startServer } = await import('../../main.js')
  const ctx = createInstanceContext({
    id: 'default',
    root,
    isGlobal: root === getGlobalRoot(),
  })
  await startServer({ instanceContext: ctx })
}

async function showAlreadyRunningMenu(root: string): Promise<void> {
  const { formatInstanceStatus } = await import('./status.js')

  console.log('')
  console.log('\x1b[1mViben is already running\x1b[0m')
  console.log('')

  const status = formatInstanceStatus(root)
  if (status) {
    for (const line of status.lines) {
      console.log(line)
    }
    console.log('')
  }

  // TTY: interactive menu
  const { showInteractiveMenu } = await import('../interactive-menu.js')

  const shown = await showInteractiveMenu([
    {
      key: 'r', label: 'Restart',
      action: async () => {
        const { cmdRestart } = await import('./restart.js')
        await cmdRestart([], root)
      },
    },
    {
      key: 'f', label: 'Restart in foreground',
      action: async () => {
        const { cmdRestart } = await import('./restart.js')
        await cmdRestart(['--foreground'], root)
      },
    },
    {
      key: 's', label: 'Stop',
      action: async () => {
        const { cmdStop } = await import('./stop.js')
        await cmdStop([], root)
      },
    },
    {
      key: 'l', label: 'View logs',
      action: async () => {
        const { cmdLogs } = await import('./logs.js')
        await cmdLogs([])
      },
    },
    {
      key: 'q', label: 'Quit',
      action: () => { /* exit naturally */ },
    },
  ])

  // Non-TTY: print suggestions and exit
  if (!shown) {
    console.log('  Use: viben restart | viben stop | viben logs')
    console.log('')
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/default.ts
git commit -m "feat(cli): smart default command with rich status menu when daemon running"
```

---

### Task 5: Add --foreground and --daemon flags to restart command

**Files:**
- Modify: `src/cli/commands/restart.ts`

- [ ] **Step 1: Rewrite restart.ts**

Replace entire content of `src/cli/commands/restart.ts`:

```typescript
import { wantsHelp } from './helpers.js'
import { printInstanceHint } from '../instance-hint.js'
import path from 'node:path'
import os from 'node:os'
import { createInstanceContext, getGlobalRoot } from '../../core/instance-context.js'

export async function cmdRestart(args: string[] = [], instanceRoot?: string): Promise<void> {
  const root = instanceRoot ?? path.join(os.homedir(), '.viben')
  if (wantsHelp(args)) {
    console.log(`
\x1b[1mviben restart\x1b[0m — Restart the background daemon

\x1b[1mUsage:\x1b[0m
  viben restart
  viben restart --foreground    Restart in foreground mode
  viben restart --daemon        Restart as background daemon

Stops the running daemon (if any) and starts a new one.

\x1b[1mSee also:\x1b[0m
  viben start       Start the daemon
  viben stop        Stop the daemon
  viben status      Check if daemon is running
`)
    return
  }

  const forceForeground = args.includes('--foreground')
  const forceDaemon = args.includes('--daemon')

  const { stopDaemon, startDaemon, getPidPath, markRunning } = await import('../daemon.js')
  const { ConfigManager } = await import('../../core/config/config.js')
  const { checkAndPromptUpdate } = await import('../version.js')

  await checkAndPromptUpdate()

  const pidPath = getPidPath(root)

  // Stop existing daemon (ignore errors — it may not be running)
  const stopResult = await stopDaemon(pidPath, root)
  if (stopResult.stopped) {
    console.log(`Stopped daemon (was PID ${stopResult.pid})`)
  }

  const cm = new ConfigManager()
  if (!(await cm.exists())) {
    console.error('No config found. Run "viben" first to set up.')
    process.exit(1)
  }

  await cm.load()
  const config = cm.get()

  // Determine mode: explicit flag > config
  const useForeground = forceForeground || (!forceDaemon && config.runMode !== 'daemon')

  if (useForeground) {
    markRunning(root)
    printInstanceHint(root)
    console.log('Starting in foreground mode...')
    const { startServer } = await import('../../main.js')
    const ctx = createInstanceContext({
      id: 'default',
      root,
      isGlobal: root === getGlobalRoot(),
    })
    await startServer({ instanceContext: ctx })
  } else {
    const result = startDaemon(pidPath, config.logging.logDir, root)
    if ('error' in result) {
      console.error(result.error)
      process.exit(1)
    }
    printInstanceHint(root)
    console.log(`Viben daemon started (PID ${result.pid})`)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/restart.ts
git commit -m "feat(cli): add --foreground and --daemon flags to restart command"
```

---

### Task 6: Add instance hint to start command

**Files:**
- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Add instance hint to start.ts**

Replace content of `src/cli/commands/start.ts`:

```typescript
import { checkAndPromptUpdate } from '../version.js'
import { wantsHelp } from './helpers.js'
import { printInstanceHint } from '../instance-hint.js'
import path from 'node:path'
import os from 'node:os'

export async function cmdStart(args: string[] = [], instanceRoot?: string): Promise<void> {
  const root = instanceRoot ?? path.join(os.homedir(), '.viben')
  if (wantsHelp(args)) {
    console.log(`
\x1b[1mviben start\x1b[0m — Start Viben as a background daemon

\x1b[1mUsage:\x1b[0m
  viben start

Starts the server as a background process (daemon mode).
Requires an existing config — run 'viben' first to set up.

\x1b[1mSee also:\x1b[0m
  viben stop       Stop the daemon
  viben restart    Restart the daemon
  viben status     Check if daemon is running
  viben logs       Tail daemon log file
`)
    return
  }
  await checkAndPromptUpdate()
  const { startDaemon, getPidPath } = await import('../daemon.js')
  const { ConfigManager } = await import('../../core/config/config.js')
  const cm = new ConfigManager()
  if (await cm.exists()) {
    await cm.load()
    const config = cm.get()
    const result = startDaemon(getPidPath(root), config.logging.logDir, root)
    if ('error' in result) {
      console.error(result.error)
      process.exit(1)
    }
    printInstanceHint(root)
    console.log(`Viben daemon started (PID ${result.pid})`)
  } else {
    console.error('No config found. Run "viben" first to set up.')
    process.exit(1)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/start.ts
git commit -m "feat(cli): show instance hint on start command"
```

---

### Task 7: Create attach command

**Files:**
- Create: `src/cli/commands/attach.ts`
- Modify: `src/cli/commands/index.ts` — add export
- Modify: `src/cli.ts` — add route

- [ ] **Step 1: Create attach.ts**

```typescript
// src/cli/commands/attach.ts
import { wantsHelp } from './helpers.js'
import path from 'node:path'
import os from 'node:os'

export async function cmdAttach(args: string[] = [], instanceRoot?: string): Promise<void> {
  const root = instanceRoot ?? path.join(os.homedir(), '.viben')
  if (wantsHelp(args)) {
    console.log(`
\x1b[1mviben attach\x1b[0m — Attach to a running daemon

\x1b[1mUsage:\x1b[0m
  viben attach

Shows the daemon status and streams log output.
Press Ctrl+C to detach.

\x1b[1mSee also:\x1b[0m
  viben logs       Tail daemon log file only
  viben status     Show daemon status only
`)
    return
  }

  const { formatInstanceStatus } = await import('./status.js')

  const status = formatInstanceStatus(root)
  if (!status) {
    console.log('Viben is not running.')
    process.exit(1)
  }

  console.log('')
  console.log(`\x1b[1mViben is running\x1b[0m (PID ${status.info.pid})`)
  console.log('')
  for (const line of status.lines) {
    // Skip PID line since we already show it above
    if (!line.includes('PID:')) console.log(line)
  }
  console.log('')
  console.log('--- logs (Ctrl+C to detach) ---')
  console.log('')

  // Tail logs
  const { spawn } = await import('node:child_process')
  const { ConfigManager, expandHome } = await import('../../core/config/config.js')

  const cm = new ConfigManager()
  let logDir = '~/.viben/logs'
  if (await cm.exists()) {
    await cm.load()
    logDir = cm.get().logging.logDir
  }
  const logFile = path.join(expandHome(logDir), 'viben.log')
  const tail = spawn('tail', ['-f', '-n', '50', logFile], { stdio: 'inherit' })
  tail.on('error', (err: Error) => {
    console.error(`Cannot tail log file: ${err.message}`)
    process.exit(1)
  })
}
```

- [ ] **Step 2: Add export to index.ts**

In `src/cli/commands/index.ts`, add:
```typescript
export { cmdAttach } from './attach.js'
```

- [ ] **Step 3: Add route in cli.ts**

In `src/cli.ts`, add `cmdAttach` to the import and add the route in the commands record:
```typescript
// In import line, add cmdAttach
import {
  // ... existing imports ...
  cmdAttach,
} from './cli/commands/index.js'

// In commands record, add:
  'attach': () => cmdAttach(args, root),
```

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/attach.ts src/cli/commands/index.ts src/cli.ts
git commit -m "feat(cli): add attach command to connect to running daemon"
```

---

### Task 8: Update help text

**Files:**
- Modify: `src/cli/commands/help.ts`

- [ ] **Step 1: Update help.ts**

In the Server section of `printHelp()`, add the attach command and document new restart flags:

Replace the Server section:
```
\x1b[1mServer:\x1b[0m
  viben                              Start (mode from config)
  viben start                        Start as background daemon
  viben stop                         Stop background daemon
  viben restart                      Restart background daemon
  viben status                       Show daemon status
  viben logs                         Tail daemon log file
  viben --foreground                 Force foreground mode
```

With:
```
\x1b[1mServer:\x1b[0m
  viben                              Start (mode from config)
  viben start                        Start as background daemon
  viben stop                         Stop background daemon
  viben restart                      Restart (same mode)
  viben restart --foreground         Restart in foreground mode
  viben restart --daemon             Restart as background daemon
  viben attach                       Attach to running daemon
  viben status                       Show daemon status
  viben logs                         Tail daemon log file
  viben --foreground                 Force foreground mode
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/help.ts
git commit -m "docs(cli): update help text with attach command and restart flags"
```

---

### Task 9: Build and manual verification

- [ ] **Step 1: Build the project**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: Clean compilation with no errors

- [ ] **Step 2: Verify new files compile**

Check that `dist/cli/instance-hint.js`, `dist/cli/interactive-menu.js`, and `dist/cli/commands/attach.js` exist.

- [ ] **Step 3: Commit any fixes if needed**

---

### Task 10: Final commit with all changes

- [ ] **Step 1: Verify git status is clean**

Run: `git status`
Expected: All changes committed across tasks 1-9.
