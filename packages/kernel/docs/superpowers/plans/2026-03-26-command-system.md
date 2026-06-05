# Command System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement centralized CommandRegistry with structured responses, auto-generated help, namespace conflict resolution, and migrate all adapter commands to use the registry.

**Architecture:** CommandRegistry is a core service. System commands registered by core, plugin commands by plugins in setup(). Adapters dispatch via single generic handler + response-type renderers. Multi-step commands remain adapter-specific but registered through the same registry.

**Tech Stack:** TypeScript strict, ESM-only (.js imports), Vitest, grammY (Telegram), discord.js (Discord)

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/core/command-registry.ts` | CommandRegistry class — register, lookup, execute, namespace |
| `src/core/commands/session.ts` | System commands: /cancel, /status, /sessions, /clear, /summary |
| `src/core/commands/agents.ts` | System commands: /agents |
| `src/core/commands/admin.ts` | System commands: /restart, /update, /doctor, /integrate |
| `src/core/commands/help.ts` | Auto-generated /help command |
| `src/core/commands/menu.ts` | /menu command |
| `src/core/commands/index.ts` | registerSystemCommands() barrel |
| `src/core/command-registry.test.ts` | Registry unit tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/core/plugin/types.ts` | Update CommandDef, CommandArgs, add CommandResponse types |
| `src/core/plugin/plugin-context.ts` | Wire registerCommand() to CommandRegistry service |
| `src/plugins/speech/index.ts` | Register /tts command in setup() |
| `src/plugins/tunnel/index.ts` | Register /tunnel, /tunnels commands in setup() |
| `src/plugins/usage/index.ts` | Register /usage command in setup() |
| `src/plugins/security/index.ts` | Register /dangerous command in setup() |
| `src/plugins/telegram/adapter.ts` | Add generic command dispatch + response renderers |
| `src/plugins/telegram/commands/index.ts` | Register adapter-specific commands via registry |
| `src/plugins/discord/adapter.ts` | Add generic command dispatch + response renderers |
| `src/plugins/discord/commands/index.ts` | Register adapter-specific commands via registry |
| `src/main.ts` | Create CommandRegistry, register system commands before plugin boot |

---

## Task 1: Update Core Types

**Files:**
- Modify: `src/core/plugin/types.ts`

- [ ] **Step 1: Add CommandResponse types and update CommandDef/CommandArgs**

In `src/core/plugin/types.ts`, find the existing `CommandDef` and `CommandArgs` interfaces. Replace them with the spec versions.

Add before `CommandDef`:

```typescript
// ─── Command Response Types ───

export type CommandResponse =
  | { type: 'text'; text: string }
  | { type: 'menu'; title: string; options: MenuOption[] }
  | { type: 'list'; title: string; items: ListItem[] }
  | { type: 'confirm'; question: string; onYes: string; onNo: string }
  | { type: 'error'; message: string }
  | { type: 'silent' }

export interface MenuOption {
  label: string
  command: string
  hint?: string
}

export interface ListItem {
  label: string
  detail?: string
}
```

Update `CommandArgs` to add `options`, `reply`, and `coreAccess`:

```typescript
export interface CommandArgs {
  raw: string
  options?: Record<string, string>
  sessionId: string | null
  channelId: string
  userId: string
  reply(content: string | CommandResponse | OutgoingMessage): Promise<void>  // backward compat with OutgoingMessage
  coreAccess?: CoreAccess  // typed interface from types.ts, not full VibenCore
}
```

Update `CommandDef` to add `category`, `pluginName`, and change handler return type:

```typescript
export interface CommandDef {
  name: string
  description: string
  usage?: string
  category: 'system' | 'plugin'
  pluginName?: string
  handler(args: CommandArgs): Promise<CommandResponse | void>
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`

- [ ] **Step 3: Commit**

```bash
git add src/core/plugin/types.ts
git commit -m "feat(commands): update CommandDef, CommandArgs, add CommandResponse types"
```

---

## Task 2: CommandRegistry

**Files:**
- Create: `src/core/command-registry.ts`
- Test: `src/core/__tests__/command-registry.test.ts`

- [ ] **Step 1: Write tests**

Create `src/core/__tests__/command-registry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { CommandRegistry } from '../command-registry.js'
import type { CommandDef, CommandArgs, CommandResponse } from '../plugin/types.js'

function makeHandler(response: CommandResponse) {
  return vi.fn(async () => response)
}

function makeCommand(overrides: Partial<CommandDef> = {}): CommandDef {
  return {
    name: 'test',
    description: 'Test command',
    category: 'system',
    handler: makeHandler({ type: 'text', text: 'ok' }),
    ...overrides,
  }
}

function makeArgs(overrides: Partial<CommandArgs> = {}): Omit<CommandArgs, 'raw'> {
  return {
    sessionId: null,
    channelId: 'telegram',
    userId: '123',
    reply: vi.fn(),
    ...overrides,
  }
}

describe('CommandRegistry', () => {
  describe('register and get', () => {
    it('registers and retrieves a command', () => {
      const registry = new CommandRegistry()
      registry.register(makeCommand({ name: 'cancel' }))
      expect(registry.get('cancel')).toBeDefined()
      expect(registry.get('cancel')!.name).toBe('cancel')
    })

    it('returns undefined for unregistered command', () => {
      const registry = new CommandRegistry()
      expect(registry.get('missing')).toBeUndefined()
    })
  })

  describe('unregister', () => {
    it('removes a command', () => {
      const registry = new CommandRegistry()
      registry.register(makeCommand({ name: 'cancel' }))
      registry.unregister('cancel')
      expect(registry.get('cancel')).toBeUndefined()
    })
  })

  describe('unregisterByPlugin', () => {
    it('removes all commands from a plugin', () => {
      const registry = new CommandRegistry()
      registry.register(makeCommand({ name: 'tts', category: 'plugin' }), '@viben/speech')
      registry.register(makeCommand({ name: 'voice', category: 'plugin' }), '@viben/speech')
      registry.register(makeCommand({ name: 'tunnel', category: 'plugin' }), '@viben/tunnel')

      registry.unregisterByPlugin('@viben/speech')

      expect(registry.get('tts')).toBeUndefined()
      expect(registry.get('voice')).toBeUndefined()
      expect(registry.get('tunnel')).toBeDefined()
    })
  })

  describe('getAll and getByCategory', () => {
    it('returns all commands', () => {
      const registry = new CommandRegistry()
      registry.register(makeCommand({ name: 'new', category: 'system' }))
      registry.register(makeCommand({ name: 'tts', category: 'plugin' }), '@viben/speech')
      expect(registry.getAll()).toHaveLength(2)
    })

    it('filters by category', () => {
      const registry = new CommandRegistry()
      registry.register(makeCommand({ name: 'new', category: 'system' }))
      registry.register(makeCommand({ name: 'tts', category: 'plugin' }), '@viben/speech')
      expect(registry.getByCategory('system')).toHaveLength(1)
      expect(registry.getByCategory('plugin')).toHaveLength(1)
    })
  })

  describe('namespace conflict resolution', () => {
    it('system commands always own short name', () => {
      const registry = new CommandRegistry()
      registry.register(makeCommand({ name: 'status', category: 'system' }))
      registry.register(makeCommand({ name: 'status', category: 'plugin' }), '@viben/tunnel')

      // System keeps short name
      const cmd = registry.get('status')
      expect(cmd!.category).toBe('system')

      // Plugin accessible via qualified name
      expect(registry.get('tunnel:status')).toBeDefined()
    })

    it('first plugin wins short name', () => {
      const registry = new CommandRegistry()
      registry.register(makeCommand({ name: 'check', category: 'plugin' }), '@community/plugin-a')
      registry.register(makeCommand({ name: 'check', category: 'plugin' }), '@community/plugin-b')

      // First plugin keeps short name
      const cmd = registry.get('check')
      expect(cmd!.pluginName).toBe('@community/plugin-a')

      // Second plugin only via qualified
      expect(registry.get('plugin-b:check')).toBeDefined()
    })

    it('qualified names always work', () => {
      const registry = new CommandRegistry()
      registry.register(makeCommand({ name: 'tts', category: 'plugin' }), '@viben/speech')
      expect(registry.get('speech:tts')).toBeDefined()
      expect(registry.get('tts')).toBeDefined() // short also works
    })
  })

  describe('execute', () => {
    it('dispatches command and returns response', async () => {
      const registry = new CommandRegistry()
      const handler = makeHandler({ type: 'text', text: 'cancelled' })
      registry.register(makeCommand({ name: 'cancel', handler }))

      const response = await registry.execute('/cancel session1', makeArgs())
      expect(response).toEqual({ type: 'text', text: 'cancelled' })
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ raw: 'session1' }))
    })

    it('returns error for unknown command', async () => {
      const registry = new CommandRegistry()
      const response = await registry.execute('/xyz', makeArgs())
      expect(response.type).toBe('error')
    })

    it('returns error when handler throws', async () => {
      const registry = new CommandRegistry()
      registry.register(makeCommand({
        name: 'fail',
        handler: async () => { throw new Error('boom') },
      }))

      const response = await registry.execute('/fail', makeArgs())
      expect(response.type).toBe('error')
      expect((response as any).message).toContain('boom')
    })

    it('treats void return as silent', async () => {
      const registry = new CommandRegistry()
      registry.register(makeCommand({
        name: 'quiet',
        handler: async (args) => { await args.reply('done'); /* returns void */ },
      }))

      const response = await registry.execute('/quiet', makeArgs())
      expect(response).toEqual({ type: 'silent' })
    })

    it('prefers adapter-specific handler when channelId matches', async () => {
      const registry = new CommandRegistry()
      const coreHandler = makeHandler({ type: 'text', text: 'core' })
      const tgHandler = makeHandler({ type: 'text', text: 'telegram' })

      registry.register(makeCommand({ name: 'new', handler: coreHandler }))
      registry.register(makeCommand({ name: 'new', handler: tgHandler, pluginName: '@viben/telegram' }), '@viben/telegram')

      // Telegram channelId → adapter handler
      const tgResponse = await registry.execute('/new', makeArgs({ channelId: 'telegram' }))
      expect(tgResponse).toEqual({ type: 'text', text: 'telegram' })

      // Discord channelId → core handler
      const dcResponse = await registry.execute('/new', makeArgs({ channelId: 'discord' }))
      expect(dcResponse).toEqual({ type: 'text', text: 'core' })
    })
  })
})
```

- [ ] **Step 2: Run tests — verify fail**

Run: `pnpm test src/core/__tests__/command-registry.test.ts`

- [ ] **Step 3: Implement CommandRegistry**

Create `src/core/command-registry.ts`:

```typescript
import type { CommandDef, CommandArgs, CommandResponse } from './plugin/types.js'

interface RegisteredCommand {
  def: CommandDef
  pluginName?: string
  qualifiedName?: string
}

export class CommandRegistry {
  private commands = new Map<string, RegisteredCommand>()
  private overrides = new Map<string, RegisteredCommand>() // channelId-specific overrides

  register(def: CommandDef, pluginName?: string): void {
    const command: RegisteredCommand = {
      def: { ...def, pluginName: pluginName ?? def.pluginName },
      pluginName,
    }

    // Adapter-specific override (pluginName contains adapter name)
    if (pluginName && this.isAdapterPlugin(pluginName) && this.commands.has(def.name)) {
      const channelId = this.extractChannelId(pluginName)
      if (channelId) {
        this.overrides.set(`${channelId}:${def.name}`, command)
        return
      }
    }

    if (def.category === 'plugin' && pluginName) {
      const scope = this.extractScope(pluginName)
      command.qualifiedName = `${scope}:${def.name}`

      // Check short name conflict
      if (this.commands.has(def.name)) {
        // Conflict — only register qualified name
        this.commands.set(command.qualifiedName, command)
        return
      }
    }

    this.commands.set(def.name, command)

    // Also register qualified name for plugins
    if (command.qualifiedName) {
      this.commands.set(command.qualifiedName, command)
    }
  }

  unregister(name: string): void {
    const cmd = this.commands.get(name)
    if (cmd) {
      this.commands.delete(name)
      if (cmd.qualifiedName) this.commands.delete(cmd.qualifiedName)
    }
  }

  unregisterByPlugin(pluginName: string): void {
    for (const [key, cmd] of this.commands) {
      if (cmd.pluginName === pluginName) {
        this.commands.delete(key)
      }
    }
    for (const [key, cmd] of this.overrides) {
      if (cmd.pluginName === pluginName) {
        this.overrides.delete(key)
      }
    }
  }

  get(name: string): CommandDef | undefined {
    return this.commands.get(name)?.def
  }

  getAll(): CommandDef[] {
    // Deduplicate (qualified and short point to same command)
    const seen = new Set<CommandDef>()
    const result: CommandDef[] = []
    for (const cmd of this.commands.values()) {
      if (!seen.has(cmd.def)) {
        seen.add(cmd.def)
        result.push(cmd.def)
      }
    }
    return result
  }

  getByCategory(category: 'system' | 'plugin'): CommandDef[] {
    return this.getAll().filter(c => c.category === category)
  }

  async execute(
    commandString: string,
    baseArgs: Omit<CommandArgs, 'raw'>,
  ): Promise<CommandResponse> {
    const cleaned = commandString.replace(/^\//, '')
    const spaceIdx = cleaned.indexOf(' ')
    const name = spaceIdx === -1 ? cleaned : cleaned.slice(0, spaceIdx)
    const raw = spaceIdx === -1 ? '' : cleaned.slice(spaceIdx + 1)

    // Check adapter override first
    const overrideKey = `${baseArgs.channelId}:${name}`
    const override = this.overrides.get(overrideKey)
    const def = override?.def ?? this.get(name)

    if (!def) {
      return { type: 'error', message: `Unknown command /${name}. Type /help for available commands.` }
    }

    try {
      const result = await def.handler({ ...baseArgs, raw } as CommandArgs)
      return result ?? { type: 'silent' }
    } catch (err) {
      return { type: 'error', message: `Command /${name} failed: ${String(err)}` }
    }
  }

  getQualifiedName(name: string, pluginName: string): string {
    return `${this.extractScope(pluginName)}:${name}`
  }

  getShortName(qualifiedName: string): string | undefined {
    const parts = qualifiedName.split(':')
    if (parts.length !== 2) return undefined
    const shortName = parts[1]
    const cmd = this.commands.get(shortName)
    if (cmd?.qualifiedName === qualifiedName) return shortName
    return undefined
  }

  private extractScope(pluginName: string): string {
    // '@viben/speech' → 'speech', '@community/plugin-a' → 'plugin-a'
    const parts = pluginName.split('/')
    return parts[parts.length - 1]
  }

  private isAdapterPlugin(pluginName: string): boolean {
    return ['@viben/telegram', '@viben/discord', '@viben/slack'].includes(pluginName)
  }

  private extractChannelId(pluginName: string): string | undefined {
    const map: Record<string, string> = {
      '@viben/telegram': 'telegram',
      '@viben/discord': 'discord',
      '@viben/slack': 'slack',
    }
    return map[pluginName]
  }
}
```

- [ ] **Step 4: Run tests — verify pass**

Run: `pnpm test src/core/__tests__/command-registry.test.ts`

- [ ] **Step 5: Run build**

Run: `pnpm build`

- [ ] **Step 6: Commit**

```bash
git add src/core/command-registry.ts src/core/__tests__/command-registry.test.ts
git commit -m "feat(commands): implement CommandRegistry with namespace resolution and adapter overrides"
```

---

## Task 3: System Commands — Simple Handlers

**Files:**
- Create: `src/core/commands/session.ts`
- Create: `src/core/commands/agents.ts`
- Create: `src/core/commands/admin.ts`
- Create: `src/core/commands/help.ts`
- Create: `src/core/commands/menu.ts`
- Create: `src/core/commands/index.ts`

These are the **core logic layer** — simple handlers returning CommandResponse. Adapters can override with multi-step versions.

- [ ] **Step 1: Create session commands**

Create `src/core/commands/session.ts`:

```typescript
import type { CommandRegistry } from '../command-registry.js'
import type { CommandResponse } from '../plugin/types.js'

export function registerSessionCommands(registry: CommandRegistry, core: unknown): void {
  registry.register({
    name: 'new',
    description: 'Create new session',
    usage: '[agent-name]',
    category: 'system',
    handler: async (args) => {
      const agentName = args.raw.trim() || undefined
      if (!agentName) {
        // List agents as menu
        try {
          const catalog = core.agentCatalog ?? (core as any).agents
          const agents = catalog?.list?.() ?? []
          if (agents.length === 0) {
            return { type: 'error', message: 'No agents available. Run /install to add one.' }
          }
          return {
            type: 'menu',
            title: 'Choose an agent',
            options: agents.map((a: any) => ({
              label: a.title ?? a.name ?? a.id,
              command: `/new ${a.id ?? a.name}`,
              hint: a.description,
            })),
          }
        } catch {
          return { type: 'error', message: 'Failed to list agents.' }
        }
      }
      // Delegate to core — adapter override handles topic creation etc.
      return { type: 'silent' }
    },
  })

  registry.register({
    name: 'cancel',
    description: 'Cancel current session',
    category: 'system',
    handler: async (args) => {
      if (!args.sessionId) {
        return { type: 'error', message: 'No active session to cancel.' }
      }
      return { type: 'text', text: 'Session cancelled.' }
    },
  })

  registry.register({
    name: 'status',
    description: 'Show session status',
    category: 'system',
    handler: async (args) => {
      if (!args.sessionId) {
        return { type: 'text', text: 'No active session.' }
      }
      return { type: 'text', text: `Session active: ${args.sessionId}` }
    },
  })

  registry.register({
    name: 'sessions',
    description: 'List all sessions',
    category: 'system',
    handler: async () => {
      return { type: 'text', text: 'Use adapter-specific /sessions for full UI.' }
    },
  })

  registry.register({
    name: 'clear',
    description: 'Clear session history',
    category: 'system',
    handler: async (args) => {
      if (!args.sessionId) {
        return { type: 'error', message: 'No active session.' }
      }
      return { type: 'text', text: 'Session history cleared.' }
    },
  })

  registry.register({
    name: 'newchat',
    description: 'New chat in same agent',
    category: 'system',
    handler: async () => {
      return { type: 'silent' } // Adapter override handles this
    },
  })

  registry.register({
    name: 'resume',
    description: 'Resume a session',
    category: 'system',
    handler: async () => {
      return { type: 'text', text: 'Use adapter-specific /resume for full UI.' }
    },
  })

  registry.register({
    name: 'summary',
    description: 'Summarize current session',
    category: 'system',
    handler: async (args) => {
      if (!args.sessionId) {
        return { type: 'error', message: 'No active session.' }
      }
      return { type: 'silent' } // Adapter override
    },
  })

  registry.register({
    name: 'handoff',
    description: 'Handoff session to another platform',
    category: 'system',
    handler: async () => {
      return { type: 'text', text: 'Handoff not available in this adapter.' }
    },
  })
}
```

- [ ] **Step 2: Create agents commands**

Create `src/core/commands/agents.ts`:

```typescript
import type { CommandRegistry } from '../command-registry.js'

export function registerAgentCommands(registry: CommandRegistry, core: unknown): void {
  registry.register({
    name: 'agents',
    description: 'List available agents',
    category: 'system',
    handler: async () => {
      try {
        const catalog = core.agentCatalog ?? (core as any).agents
        const agents = catalog?.list?.() ?? []
        if (agents.length === 0) {
          return { type: 'text', text: 'No agents installed. Run /install to add one.' }
        }
        return {
          type: 'list',
          title: 'Available Agents',
          items: agents.map((a: any) => ({
            label: a.title ?? a.name ?? a.id,
            detail: a.description,
          })),
        }
      } catch {
        return { type: 'error', message: 'Failed to list agents.' }
      }
    },
  })

  registry.register({
    name: 'install',
    description: 'Install a new agent',
    usage: '[agent-name]',
    category: 'system',
    handler: async (args) => {
      if (!args.raw.trim()) {
        return { type: 'text', text: 'Usage: /install <agent-name>' }
      }
      return { type: 'silent' } // Adapter override handles interactive install
    },
  })
}
```

- [ ] **Step 3: Create admin commands**

Create `src/core/commands/admin.ts`:

```typescript
import type { CommandRegistry } from '../command-registry.js'

export function registerAdminCommands(registry: CommandRegistry, _core: unknown): void {
  registry.register({
    name: 'restart',
    description: 'Restart Viben',
    category: 'system',
    handler: async (args) => {
      return { type: 'confirm', question: 'Restart Viben?', onYes: '/restart --confirm', onNo: '' }
    },
  })

  registry.register({
    name: 'update',
    description: 'Update and restart',
    category: 'system',
    handler: async () => {
      return { type: 'silent' } // Adapter override handles progress feedback
    },
  })

  registry.register({
    name: 'doctor',
    description: 'System diagnostics',
    category: 'system',
    handler: async () => {
      return { type: 'silent' } // Adapter override handles diagnostic UI
    },
  })

  registry.register({
    name: 'integrate',
    description: 'Manage integrations',
    category: 'system',
    handler: async () => {
      return { type: 'silent' } // Adapter override
    },
  })
}
```

- [ ] **Step 4: Create help command**

Create `src/core/commands/help.ts`:

```typescript
import type { CommandRegistry } from '../command-registry.js'

export function registerHelpCommand(registry: CommandRegistry): void {
  registry.register({
    name: 'help',
    description: 'Show available commands',
    category: 'system',
    handler: async () => {
      const systemCmds = registry.getByCategory('system')
      const pluginCmds = registry.getByCategory('plugin')

      const options = [
        ...systemCmds.map(c => ({
          label: `/${c.name}`,
          command: `/${c.name}`,
          hint: c.description,
        })),
        ...pluginCmds.map(c => ({
          label: `/${c.name}`,
          command: `/${c.name}`,
          hint: `${c.description}${c.pluginName ? ` (${c.pluginName})` : ''}`,
        })),
      ]

      return { type: 'menu', title: 'Available Commands', options }
    },
  })
}
```

- [ ] **Step 5: Create menu command**

Create `src/core/commands/menu.ts`:

```typescript
import type { CommandRegistry } from '../command-registry.js'

export function registerMenuCommand(registry: CommandRegistry): void {
  registry.register({
    name: 'menu',
    description: 'Show main menu',
    category: 'system',
    handler: async () => {
      return {
        type: 'menu',
        title: 'Main Menu',
        options: [
          { label: 'New Session', command: '/new' },
          { label: 'Sessions', command: '/sessions' },
          { label: 'Agents', command: '/agents' },
          { label: 'Usage', command: '/usage' },
          { label: 'Settings', command: '/settings' },
          { label: 'Help', command: '/help' },
        ],
      }
    },
  })
}
```

- [ ] **Step 6: Create barrel export**

Create `src/core/commands/index.ts`:

```typescript
import type { CommandRegistry } from '../command-registry.js'
import { registerSessionCommands } from './session.js'
import { registerAgentCommands } from './agents.js'
import { registerAdminCommands } from './admin.js'
import { registerHelpCommand } from './help.js'
import { registerMenuCommand } from './menu.js'

export function registerSystemCommands(registry: CommandRegistry, core: unknown): void {
  registerSessionCommands(registry, core)
  registerAgentCommands(registry, core)
  registerAdminCommands(registry, core)
  registerHelpCommand(registry)
  registerMenuCommand(registry)
}
```

- [ ] **Step 7: Verify build + test**

Run: `pnpm build && pnpm test`

- [ ] **Step 8: Commit**

```bash
git add src/core/commands/
git commit -m "feat(commands): add system command handlers (session, agents, admin, help, menu)"
```

---

## Task 4: Plugin Commands Registration

**Files:**
- Modify: `src/plugins/speech/index.ts`
- Modify: `src/plugins/tunnel/index.ts`
- Modify: `src/plugins/usage/index.ts`
- Modify: `src/plugins/security/index.ts`

- [ ] **Step 1: Add /tts command to speech plugin**

In `src/plugins/speech/index.ts`, inside `setup()`, add after service registration:

```typescript
ctx.registerCommand({
  name: 'tts',
  description: 'Toggle text-to-speech',
  usage: 'on|off',
  category: 'plugin',
  handler: async (args) => {
    const mode = args.raw.trim().toLowerCase()
    if (mode === 'on') return { type: 'text', text: '🔊 Text-to-speech enabled' }
    if (mode === 'off') return { type: 'text', text: '🔇 Text-to-speech disabled' }
    return {
      type: 'menu',
      title: 'Text to Speech',
      options: [
        { label: '🔊 Enable', command: '/tts on' },
        { label: '🔇 Disable', command: '/tts off' },
      ],
    }
  },
})
```

Also add `'commands:register'` to the plugin's permissions array.

- [ ] **Step 2: Add /tunnel, /tunnels to tunnel plugin**

In `src/plugins/tunnel/index.ts`, inside `setup()`:

```typescript
ctx.registerCommand({
  name: 'tunnel',
  description: 'Manage tunnels',
  usage: 'start|stop|status',
  category: 'plugin',
  handler: async (args) => {
    const sub = args.raw.trim().toLowerCase()
    if (sub === 'status') {
      const url = tunnelService.getPublicUrl?.()
      return { type: 'text', text: url ? `Tunnel active: ${url}` : 'No tunnel active.' }
    }
    if (sub === 'start') return { type: 'silent' } // complex, adapter override
    if (sub === 'stop') return { type: 'silent' }
    return {
      type: 'menu',
      title: 'Tunnel',
      options: [
        { label: 'Start', command: '/tunnel start' },
        { label: 'Stop', command: '/tunnel stop' },
        { label: 'Status', command: '/tunnel status' },
      ],
    }
  },
})
```

Add `'commands:register'` permission.

- [ ] **Step 3: Add /usage to usage plugin**

In `src/plugins/usage/index.ts`, inside `setup()`:

```typescript
ctx.registerCommand({
  name: 'usage',
  description: 'View usage and cost',
  category: 'plugin',
  handler: async () => {
    return { type: 'silent' } // Adapter override handles detailed UI
  },
})
```

Add `'commands:register'` permission.

- [ ] **Step 4: Add /dangerous to security plugin**

In `src/plugins/security/index.ts`, inside `setup()`:

```typescript
ctx.registerCommand({
  name: 'dangerous',
  description: 'Toggle auto-approve mode',
  usage: 'on|off',
  category: 'plugin',
  handler: async (args) => {
    const mode = args.raw.trim().toLowerCase()
    if (mode === 'on') {
      return { type: 'confirm', question: '⚠️ Enable auto-approve for ALL permissions?', onYes: '/dangerous confirm', onNo: '' }
    }
    if (mode === 'off') {
      return { type: 'text', text: '✅ Dangerous mode disabled.' }
    }
    return {
      type: 'menu',
      title: 'Dangerous Mode',
      options: [
        { label: '⚠️ Enable', command: '/dangerous on' },
        { label: '✅ Disable', command: '/dangerous off' },
      ],
    }
  },
})
```

Add `'commands:register'` permission.

- [ ] **Step 5: Verify build + test**

Run: `pnpm build && pnpm test`

- [ ] **Step 6: Commit**

```bash
git add src/plugins/speech/index.ts src/plugins/tunnel/index.ts src/plugins/usage/index.ts src/plugins/security/index.ts
git commit -m "feat(commands): register plugin commands (/tts, /tunnel, /usage, /dangerous) in setup()"
```

---

## Task 5: Wire CommandRegistry into Boot Flow

**Files:**
- Modify: `src/main.ts`
- Modify: `src/core/plugin/plugin-context.ts`

- [ ] **Step 1: Create and register CommandRegistry in main.ts**

In `src/main.ts`, after creating ServiceRegistry and before booting plugins:

```typescript
import { CommandRegistry } from './core/command-registry.js'
import { registerSystemCommands } from './core/commands/index.js'

// After creating serviceRegistry:
const commandRegistry = new CommandRegistry()
serviceRegistry.register('command-registry', commandRegistry, 'core')

// After creating core:
registerSystemCommands(commandRegistry, core)
```

- [ ] **Step 2: Wire registerCommand() in plugin-context.ts**

In `src/core/plugin/plugin-context.ts`, update the `registerCommand` implementation to delegate to CommandRegistry:

```typescript
registerCommand(def: CommandDef): void {
  requirePermission(permissions, 'commands:register', 'registerCommand()')
  registeredCommands.push(def)

  // Also register with CommandRegistry service
  const registry = opts.serviceRegistry?.get?.('command-registry')
  if (registry && typeof (registry as any).register === 'function') {
    (registry as any).register(def, opts.pluginName)
  }
}
```

- [ ] **Step 3: Update `system:commands-ready` emission**

In `src/main.ts`, find the existing `system:commands-ready` emission (around line 131-132). Replace it to use CommandRegistry:

```typescript
// BEFORE (old — uses registered-commands service)
const registeredCommands = serviceRegistry.get('registered-commands') ?? []
eventBus.emit('system:commands-ready', { commands: registeredCommands })

// AFTER (new — uses CommandRegistry)
eventBus.emit('system:commands-ready', { commands: commandRegistry.getAll() })
```

- [ ] **Step 4: Verify build + test**

Run: `pnpm build && pnpm test`

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/core/plugin/plugin-context.ts
git commit -m "feat(commands): wire CommandRegistry into boot flow and plugin context"
```

---

## Task 6: Adapter Response Renderers + Generic Dispatch

**Files:**
- Modify: `src/plugins/telegram/adapter.ts`
- Modify: `src/plugins/telegram/commands/index.ts`

This is the biggest task — integrating CommandRegistry dispatch into Telegram adapter.

**Middleware ordering:** The generic dispatch handler MUST be placed BEFORE existing `bot.command()` handlers. When registry finds a matching command, it handles it and does NOT call `next()`. When registry has no match, it calls `next()` to let existing handlers run. This means: once a command is in the registry, the old hardcoded handler becomes dead code. After all commands are migrated, old handlers can be removed in a follow-up task.

- [ ] **Step 1: Add response renderer infrastructure to Telegram adapter**

Add to adapter class a method for rendering CommandResponse:

```typescript
private async renderCommandResponse(
  response: CommandResponse,
  chatId: number,
  topicId?: number,
): Promise<void> {
  switch (response.type) {
    case 'text':
      await this.bot.api.sendMessage(chatId, response.text, { message_thread_id: topicId })
      break
    case 'error':
      await this.bot.api.sendMessage(chatId, `⚠️ ${response.message}`, { message_thread_id: topicId })
      break
    case 'menu': {
      const keyboard = response.options.map(opt => [{
        text: `${opt.label}${opt.hint ? ` — ${opt.hint}` : ''}`,
        callback_data: this.toCallbackData(opt.command),
      }])
      await this.bot.api.sendMessage(chatId, response.title, {
        message_thread_id: topicId,
        reply_markup: { inline_keyboard: keyboard },
      })
      break
    }
    case 'list': {
      const lines = response.items.map(i => `• ${i.label}${i.detail ? ` — ${i.detail}` : ''}`)
      await this.bot.api.sendMessage(chatId, `${response.title}\n${lines.join('\n')}`, { message_thread_id: topicId })
      break
    }
    case 'confirm': {
      const buttons = [
        [{ text: '✅ Yes', callback_data: this.toCallbackData(response.onYes) }],
      ]
      if (response.onNo) {
        buttons[0].push({ text: '❌ No', callback_data: this.toCallbackData(response.onNo) })
      }
      await this.bot.api.sendMessage(chatId, response.question, {
        message_thread_id: topicId,
        reply_markup: { inline_keyboard: buttons },
      })
      break
    }
    case 'silent':
      break
  }
}

private callbackCache = new Map<string, string>()
private callbackCounter = 0

private toCallbackData(command: string): string {
  const data = `c/${command}`
  if (data.length <= 64) return data
  // Cache long commands with short ID
  const id = String(++this.callbackCounter)
  this.callbackCache.set(id, command)
  if (this.callbackCache.size > 1000) {
    const first = this.callbackCache.keys().next().value
    if (first) this.callbackCache.delete(first)
  }
  return `c/#${id}`
}

private fromCallbackData(data: string): string {
  if (data.startsWith('c/#')) {
    return this.callbackCache.get(data.slice(3)) ?? data.slice(2)
  }
  return data.slice(2)
}
```

- [ ] **Step 2: Add generic command dispatch handler**

In the adapter's bot setup, add a generic handler that checks CommandRegistry BEFORE falling through to existing handlers:

```typescript
// Add early in middleware chain — before other handlers
bot.on('message:text', async (ctx, next) => {
  const text = ctx.message.text
  if (!text?.startsWith('/')) return next()

  const registry = this.core.lifecycleManager?.serviceRegistry?.get?.('command-registry') as CommandRegistry | undefined
  if (!registry) return next()

  const commandName = text.split(' ')[0].slice(1).split('@')[0]  // remove / and @botname
  const def = registry.get(commandName)
  if (!def) return next()  // fall through to existing handlers

  const chatId = ctx.chat.id
  const topicId = ctx.message.message_thread_id

  const response = await registry.execute(text, {
    sessionId: this.getSessionIdFromTopic(topicId),
    channelId: 'telegram',
    userId: String(ctx.from.id),
    reply: async (content) => {
      if (typeof content === 'string') {
        await ctx.reply(content)
      } else {
        await this.renderCommandResponse(content, chatId, topicId)
      }
    },
  })

  await this.renderCommandResponse(response, chatId, topicId)
})

// Add callback handler for command buttons
bot.callbackQuery(/^c\//, async (ctx) => {
  const data = ctx.callbackQuery.data
  const command = this.fromCallbackData(data)  // handles both 'c/cmd' and 'c/#id'

  const registry = this.core.lifecycleManager?.serviceRegistry?.get?.('command-registry') as CommandRegistry | undefined
  if (!registry) return

  const chatId = ctx.chat!.id
  const topicId = ctx.callbackQuery.message?.message_thread_id

  const response = await registry.execute(command, {
    sessionId: this.getSessionIdFromTopic(topicId),
    channelId: 'telegram',
    userId: String(ctx.from.id),
    reply: async (content) => {
      if (typeof content === 'string') {
        await ctx.editMessageText(content).catch(() => ctx.reply(content))
      }
    },
  })

  await ctx.answerCallbackQuery()
  if (response.type !== 'silent') {
    await this.renderCommandResponse(response, chatId, topicId)
  }
})
```

- [ ] **Step 3: Register adapter-specific command overrides**

In `src/plugins/telegram/commands/index.ts`, existing handlers register via CommandRegistry as adapter overrides. The complex handlers (/new, /resume, /settings, etc.) keep their existing Telegram-specific logic.

This is a large file — read the existing `setupAllCommands()` or equivalent function. For each command that has complex Telegram-specific logic, register it as an adapter override:

```typescript
export function registerTelegramCommands(registry: CommandRegistry, adapter: TelegramAdapter): void {
  // Adapter-specific overrides for multi-step commands
  registry.register({
    name: 'new',
    description: 'Create new session',
    category: 'system',
    pluginName: '@viben/telegram',
    handler: async (args) => {
      // Keep existing Telegram-specific new session logic
      // Uses adapter for topic creation, inline keyboards, etc.
      // ... (delegating to existing handleNew function)
    },
  }, '@viben/telegram')

  // Register verbosity (Telegram-specific)
  registry.register({
    name: 'verbosity',
    description: 'Change display verbosity',
    usage: 'low|medium|high',
    category: 'plugin',
    handler: async (args) => {
      // Telegram-specific verbosity UI
    },
  }, '@viben/telegram')

  // ... other adapter-specific commands
}
```

- [ ] **Step 4: Verify build + test**

Run: `pnpm build && pnpm test`

- [ ] **Step 5: Commit**

```bash
git add src/plugins/telegram/
git commit -m "feat(telegram): add CommandRegistry dispatch + response renderers"
```

---

## Task 7: Discord Adapter Integration

**Files:**
- Modify: `src/plugins/discord/adapter.ts`
- Modify: `src/plugins/discord/commands/index.ts`

Same pattern as Telegram — add generic dispatch + response renderers, register adapter-specific overrides.

- [ ] **Step 1: Add response renderer to Discord adapter**

Similar to Telegram but using Discord.js embeds, buttons, and select menus:

```typescript
private async renderCommandResponse(
  response: CommandResponse,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<void> {
  const reply = interaction.deferred ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction)

  switch (response.type) {
    case 'text':
      await reply({ content: response.text })
      break
    case 'error':
      await reply({ content: `⚠️ ${response.message}`, ephemeral: true })
      break
    case 'menu': {
      const embed = new EmbedBuilder().setTitle(response.title)
      // Build action rows with buttons
      const rows = this.buildMenuButtons(response.options)
      await reply({ embeds: [embed], components: rows })
      break
    }
    case 'list': {
      const embed = new EmbedBuilder()
        .setTitle(response.title)
        .setDescription(response.items.map(i => `• **${i.label}**${i.detail ? ` — ${i.detail}` : ''}`).join('\n'))
      await reply({ embeds: [embed] })
      break
    }
    case 'confirm': {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`c/${response.onYes}`).setLabel('Yes').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`c/${response.onNo || 'noop'}`).setLabel('No').setStyle(ButtonStyle.Secondary),
      )
      await reply({ content: response.question, components: [row] })
      break
    }
    case 'silent':
      break
  }
}
```

- [ ] **Step 2: Add generic slash command dispatch**

Register dynamic slash commands from CommandRegistry and route to handlers.

- [ ] **Step 3: Register Discord-specific overrides**

Same as Telegram — multi-step commands get adapter-specific handlers.

- [ ] **Step 4: Verify build + test**

Run: `pnpm build && pnpm test`

- [ ] **Step 5: Commit**

```bash
git add src/plugins/discord/
git commit -m "feat(discord): add CommandRegistry dispatch + response renderers"
```

---

## Task 8: Final Integration + Push

- [ ] **Step 1: Run full verification**

```bash
pnpm build && pnpm build:publish && pnpm test
```

All tests must pass.

- [ ] **Step 2: Verify CommandRegistry is populated**

Add a quick check — after plugins boot, log registered commands count:

```typescript
// In main.ts after lifecycle.boot()
const cmdCount = commandRegistry.getAll().length
log.info({ commands: cmdCount }, 'Command registry ready')
```

- [ ] **Step 3: Push**

```bash
git push
```
