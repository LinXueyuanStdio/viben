# Command System Design

**Date:** 2026-03-26
**Status:** Draft
**Scope:** Chat commands only (Telegram/Discord/Slack). Not CLI commands.

## Overview

Centralized command registry where system commands and plugin commands are registered, dispatched, and rendered across all adapters. Plugins register commands via `ctx.registerCommand()`. Adapters render responses using platform-specific response-type renderers.

### Goals

1. CommandRegistry collects all commands (system + plugin)
2. Plugins register commands in setup() — auto-available on all adapters
3. Handlers return structured responses — adapters render per response type
4. Help auto-generated from registry
5. Namespace conflict resolution (short name + qualified fallback)
6. Full migration — remove all hardcoded command handlers from adapters

### Non-Goals

- CLI commands (`viben start`, `viben plugins install`)
- Command permissions beyond existing security middleware
- Command aliases or abbreviations

---

## 1. Core Types

### CommandDef

```typescript
interface CommandDef {
  name: string                     // 'new', 'tts', 'tunnel'
  description: string              // shown in /help
  usage?: string                   // 'on|off', '<agent-name>'
  category: 'system' | 'plugin'
  pluginName?: string              // '@viben/speech' — auto-set by registry
  // Handler returns CommandResponse OR void (backward compat with existing plugins)
  // If void, handler used reply() for output. If CommandResponse, adapter renders it.
  handler(args: CommandArgs): Promise<CommandResponse | void>
}
```

**Backward compatibility:** Existing plugins using `handler(): Promise<void>` with `args.reply()` continue to work. New commands should prefer returning `CommandResponse` for structured rendering. Registry detects void return and treats as `{ type: 'silent' }`.

### CommandArgs

```typescript
interface CommandArgs {
  raw: string                      // raw text after command name
  options?: Record<string, string> // parsed options (Discord slash commands pass typed options here)
  sessionId: string | null         // null if no active session
  channelId: string                // 'telegram', 'discord', 'slack'
  userId: string
  // Escape hatch for mid-execution feedback (progress messages, message editing)
  reply(content: string | CommandResponse): Promise<void>
  // Restricted core access (not full VibenCore — uses CoreAccess interface)
  coreAccess?: CoreAccess
}
```

**`reply()` escape hatch:** Most commands return a single `CommandResponse`. But some commands need mid-execution feedback (e.g., `/update` sends "Checking..." → "Updating..." → "Restarting..."). These commands call `reply()` during execution for intermediate messages, then return the final response. Adapter provides `reply()` implementation.

### CommandResponse

```typescript
type CommandResponse =
  | { type: 'text'; text: string }
  | { type: 'menu'; title: string; options: MenuOption[] }
  | { type: 'list'; title: string; items: ListItem[] }
  | { type: 'confirm'; question: string; onYes: string; onNo: string }
  | { type: 'error'; message: string }
  | { type: 'silent' }

interface MenuOption {
  label: string
  command: string                  // command to dispatch when selected
  hint?: string
}

interface ListItem {
  label: string
  detail?: string
}
```

---

## 2. Multi-Step Commands & Platform-Specific Flows

Some commands require multi-step interactive flows that cannot be expressed with a single `CommandResponse`:

- `/new` — agent picker → workspace picker → custom path input → confirmation → session creation
- `/resume` — session scanner → session picker → context loading
- `/settings` — multi-level navigation menu with text input fields
- `/update` — progress messages: "Checking..." → "Updating v1 → v2..." → "Restarting..."

### Design: Two-Layer Architecture

Commands are split into **core logic** (portable) and **platform orchestration** (adapter-specific):

```
Layer 1 — Core Logic (in CommandRegistry):
  Handler returns structured CommandResponse
  Portable across all adapters
  Example: /cancel → check session exists → cancel → return { type: 'text', text: 'Cancelled' }

Layer 2 — Platform Orchestration (in adapter, registered via CommandRegistry):
  Handler uses reply() for mid-execution feedback
  Uses platform-specific APIs (forum topics, message editing, slash command options)
  Example: /new on Telegram → create topic → show agent picker keyboard → edit message on selection
```

### Rules:

1. **Simple commands** (no multi-step, no platform API) → registered by core/plugins, return `CommandResponse`. Works on ALL adapters automatically.
2. **Multi-step commands** → adapter registers its own handler via CommandRegistry with `category: 'system'`. Uses `args.reply()` + platform context. Different adapters can have different implementations of the same command.
3. **If adapter doesn't register an override** → falls back to core handler (simple version). User still gets functionality, just simpler UI.

### Example: `/new` command

```typescript
// Core registers simple fallback
registry.register({
  name: 'new',
  category: 'system',
  handler: async (args) => {
    if (!args.raw.trim()) {
      const agents = core.agentCatalog.list()
      return { type: 'menu', title: 'Choose agent', options: agents.map(a => ({ label: a.name, command: `/new ${a.id}` })) }
    }
    await core.handleNewSession(args.channelId, args.userId, args.raw.trim())
    return { type: 'silent' }
  },
})

// Telegram adapter overrides with multi-step wizard
registry.register({
  name: 'new',
  category: 'system',
  pluginName: '@viben/telegram',  // override marker
  handler: async (args) => {
    // Full wizard: create topic, agent picker with keyboard, workspace selection, etc.
    // Uses args.reply() for mid-step feedback
    // Uses Telegram-specific APIs
  },
})
```

### Override Priority

When multiple handlers exist for the same command:
1. **Adapter-specific** (matches current channelId) → highest priority
2. **Core handler** → fallback

Registry.execute() checks `channelId` against handler's `pluginName` to pick the right one.

---

## 3. CommandRegistry

```typescript
class CommandRegistry {
  // Registration
  register(def: CommandDef, pluginName?: string): void
  unregister(name: string): void
  unregisterByPlugin(pluginName: string): void

  // Lookup
  get(name: string): CommandDef | undefined
  getAll(): CommandDef[]
  getByCategory(category: 'system' | 'plugin'): CommandDef[]

  // Execution
  async execute(commandString: string, baseArgs: Omit<CommandArgs, 'raw'>): Promise<CommandResponse>

  // Namespace management
  getQualifiedName(name: string, pluginName: string): string  // 'speech:tts'
  getShortName(qualifiedName: string): string | undefined      // 'tts' if no conflict
}
```

### Namespace Conflict Resolution

Every plugin command has two names:
- **Qualified:** `pluginScope:commandName` — always unique (e.g., `speech:tts`, `tunnel:status`)
- **Short:** `commandName` — available if no conflict (e.g., `tts`, `tunnel`)

Rules:
1. System commands always own their short name — plugins cannot override
2. First plugin to register a short name owns it — keeps it even if another plugin registers same name later
3. Later plugins with conflicting short name get qualified name only — first registrant is NOT affected
4. Registry logs warning on conflict for the later plugin
5. `/help` shows short name for winner, qualified name for loser

```
Register 'tts' by @viben/speech:
  → short: /tts ✓ (no conflict)
  → qualified: /speech:tts ✓

Register 'status' by @viben/tunnel:
  → short: /status ✗ (system command owns it)
  → qualified: /tunnel:status ✓
  → log warning: "Plugin command 'status' conflicts with system command, use /tunnel:status"

Register 'check' by @community/plugin-a:
  → short: /check ✓

Register 'check' by @community/plugin-b:
  → short: /check ✗ (already owned by plugin-a)
  → plugin-a KEEPS /check (first wins)
  → plugin-b only accessible via /plugin-b:check
  → log warning: "Plugin command 'check' from @community/plugin-b conflicts with @community/plugin-a, use /plugin-b:check"
```

### execute() Method

```typescript
async execute(commandString: string, baseArgs: Omit<CommandArgs, 'raw'>): Promise<CommandResponse> {
  // Parse: "/tts on" → name="tts", raw="on"
  // Parse: "/speech:tts on" → name="speech:tts", raw="on"
  const [name, ...rest] = commandString.replace(/^\//, '').split(' ')
  const raw = rest.join(' ')

  const def = this.get(name)
  if (!def) {
    return { type: 'error', message: `Unknown command /${name}. Type /help for available commands.` }
  }

  try {
    return await def.handler({ ...baseArgs, raw })
  } catch (err) {
    return { type: 'error', message: `Command /${name} failed: ${String(err)}` }
  }
}
```

---

## 4. System Commands

Registered by core during boot, before plugins load.

| Command | Description | Category | Handler location |
|---------|-------------|----------|-----------------|
| `/new` | Create new session | system | `src/core/commands/session.ts` |
| `/newchat` | New chat in same agent | system | `src/core/commands/session.ts` |
| `/cancel` | Cancel current session | system | `src/core/commands/session.ts` |
| `/status` | Show session status | system | `src/core/commands/session.ts` |
| `/sessions` | List all sessions | system | `src/core/commands/session.ts` |
| `/resume` | Resume a session | system | `src/core/commands/session.ts` |
| `/agents` | List available agents | system | `src/core/commands/agents.ts` |
| `/install` | Install new agent | system | `src/core/commands/agents.ts` |
| `/help` | Show all commands | system | `src/core/commands/help.ts` |
| `/menu` | Show main menu | system | `src/core/commands/menu.ts` |
| `/restart` | Restart Viben | system | `src/core/commands/admin.ts` |
| `/update` | Update and restart | system | `src/core/commands/admin.ts` |
| `/doctor` | System diagnostics | system | `src/core/commands/admin.ts` |
| `/clear` | Clear session history | system | `src/core/commands/session.ts` |

### Example System Command Handler

```typescript
// src/core/commands/session.ts
export function registerSessionCommands(registry: CommandRegistry, core: VibenCore) {
  registry.register({
    name: 'new',
    description: 'Create new session',
    usage: '[agent-name]',
    category: 'system',
    handler: async (args) => {
      const agentName = args.raw.trim() || undefined
      if (!args.sessionId && !agentName) {
        // Show agent selection menu
        const agents = core.agentCatalog.list()
        return {
          type: 'menu',
          title: 'Choose an agent',
          options: agents.map(a => ({
            label: a.name,
            command: `/new ${a.id}`,
            hint: a.description,
          })),
        }
      }
      // Create session
      await core.handleNewSession(args.channelId, args.userId, agentName)
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
      await core.cancelSession(args.sessionId)
      return { type: 'text', text: 'Session cancelled.' }
    },
  })

  registry.register({
    name: 'sessions',
    description: 'List all sessions',
    category: 'system',
    handler: async (args) => {
      const sessions = core.sessionManager.listActive()
      if (sessions.length === 0) {
        return { type: 'text', text: 'No active sessions.' }
      }
      return {
        type: 'list',
        title: 'Active Sessions',
        items: sessions.map(s => ({
          label: s.name || s.id,
          detail: `${s.agentName} — ${s.state}`,
        })),
      }
    },
  })
}
```

---

## 5. Plugin Commands

Plugins register commands in their `setup()` via `ctx.registerCommand()`.

### Example: Speech Plugin

```typescript
// src/plugins/speech/index.ts — setup()
ctx.registerCommand({
  name: 'tts',
  description: 'Toggle text-to-speech',
  usage: 'on|off',
  category: 'plugin',
  handler: async (args) => {
    const speechService = ctx.getService<SpeechServiceInterface>('speech')
    if (!speechService) {
      return { type: 'error', message: 'Speech service not available.' }
    }

    const mode = args.raw.trim().toLowerCase()
    if (mode === 'on') {
      // Enable TTS for session
      return { type: 'text', text: '🔊 Text-to-speech enabled' }
    }
    if (mode === 'off') {
      return { type: 'text', text: '🔇 Text-to-speech disabled' }
    }
    // No args — show menu
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

### Example: Tunnel Plugin

```typescript
ctx.registerCommand({
  name: 'tunnel',
  description: 'Manage tunnels',
  usage: 'start|stop|status',
  category: 'plugin',
  handler: async (args) => {
    const tunnel = ctx.getService<TunnelServiceInterface>('tunnel')
    if (!tunnel) return { type: 'error', message: 'Tunnel service not available.' }

    const sub = args.raw.trim().toLowerCase()
    if (sub === 'status') {
      const url = tunnel.getPublicUrl()
      return { type: 'text', text: url ? `Tunnel active: ${url}` : 'No tunnel active.' }
    }
    if (sub === 'start') {
      await tunnel.start()
      return { type: 'text', text: `Tunnel started: ${tunnel.getPublicUrl()}` }
    }
    if (sub === 'stop') {
      await tunnel.stop()
      return { type: 'text', text: 'Tunnel stopped.' }
    }
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

ctx.registerCommand({
  name: 'tunnels',
  description: 'List active tunnels',
  category: 'plugin',
  handler: async (args) => {
    const tunnel = ctx.getService<TunnelServiceInterface>('tunnel')
    if (!tunnel) return { type: 'error', message: 'Tunnel service not available.' }
    // Return list of active tunnels
    return { type: 'text', text: tunnel.isConnected() ? `Active: ${tunnel.getPublicUrl()}` : 'No active tunnels.' }
  },
})
```

### Example: Usage Plugin

```typescript
ctx.registerCommand({
  name: 'usage',
  description: 'View usage and cost',
  category: 'plugin',
  handler: async (args) => {
    const usage = ctx.getService<UsageService>('usage')
    if (!usage) return { type: 'error', message: 'Usage tracking not enabled.' }
    const summary = await usage.getSummary()
    return {
      type: 'list',
      title: 'Usage Summary',
      items: [
        { label: 'This month', detail: `$${summary.monthlySpend.toFixed(2)}` },
        { label: 'Budget', detail: `$${summary.monthlyBudget.toFixed(2)}` },
        { label: 'Sessions', detail: String(summary.sessionCount) },
      ],
    }
  },
})
```

### Example: Security Plugin

```typescript
ctx.registerCommand({
  name: 'dangerous',
  description: 'Toggle auto-approve mode',
  usage: 'on|off',
  category: 'plugin',
  handler: async (args) => {
    const mode = args.raw.trim().toLowerCase()
    if (mode === 'on') {
      // Enable dangerous mode
      return { type: 'confirm', question: '⚠️ Enable auto-approve for ALL permissions?', onYes: '/dangerous confirm', onNo: '' }
    }
    if (mode === 'confirm') {
      // Actually enable
      return { type: 'text', text: '⚠️ Dangerous mode enabled. All permissions auto-approved.' }
    }
    if (mode === 'off') {
      return { type: 'text', text: '✅ Dangerous mode disabled. Permissions require approval.' }
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

---

## 6. Adapter Integration

### Boot Flow

```
1. Core creates CommandRegistry, registers as service 'command-registry'
2. Core registers system commands (session, agents, admin, help, menu)
3. LifecycleManager.boot(plugins)
   → Each plugin setup() → ctx.registerCommand() → CommandRegistry.register()
4. After all plugins booted:
   → Emit 'system:commands-ready' with registry.getAll()
5. Adapter plugins receive event → register platform UI:
   Telegram: bot.setMyCommands(commands) + setup dispatch handler
   Discord: registerSlashCommands(commands) + sync guild
   Slack: register message listener with command parsing
```

### Adapter Command Dispatch

Each adapter adds ONE generic dispatch handler (replaces all hardcoded `bot.command()` calls):

```typescript
// Telegram adapter — in setup or start()
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text
  if (!text.startsWith('/')) return  // not a command

  const registry = core.serviceRegistry.get<CommandRegistry>('command-registry')
  if (!registry) return

  const response = await registry.execute(text, {
    sessionId: getSessionIdFromTopic(ctx),
    channelId: 'telegram',
    userId: String(ctx.from.id),
    core,
  })

  await this.renderResponse(response, ctx)
})

// Telegram — button callback dispatch
bot.callbackQuery(/^c\//, async (ctx) => {
  const command = ctx.callbackQuery.data.slice(2)  // remove 'c/'
  const registry = core.serviceRegistry.get<CommandRegistry>('command-registry')
  const response = await registry.execute(command, { ... })
  await this.renderResponse(response, ctx)
})
```

### Response Renderers

Adapters register renderer per response type. Default renderers in MessagingAdapter base class (plain text fallback).

```typescript
// Default renderer (MessagingAdapter base)
protected responseRenderers: Map<string, ResponseRenderer> = new Map([
  ['text', async (r, ctx) => ctx.reply(r.text)],
  ['error', async (r, ctx) => ctx.reply(`⚠️ ${r.message}`)],
  ['menu', async (r, ctx) => {
    const lines = r.options.map(o => `• ${o.label} → ${o.command}`)
    ctx.reply(`${r.title}\n${lines.join('\n')}`)
  }],
  ['list', async (r, ctx) => {
    const lines = r.items.map(i => `• ${i.label}${i.detail ? ` — ${i.detail}` : ''}`)
    ctx.reply(`${r.title}\n${lines.join('\n')}`)
  }],
  ['confirm', async (r, ctx) => ctx.reply(`${r.question} (yes/no)`)],
  ['silent', async () => {}],
])

// Telegram override
this.responseRenderers.set('menu', async (response, ctx) => {
  const keyboard = response.options.map(opt => [{
    text: `${opt.label}${opt.hint ? ` — ${opt.hint}` : ''}`,
    callback_data: toCallbackData(opt.command),
  }])
  await ctx.reply(response.title, {
    reply_markup: { inline_keyboard: keyboard },
  })
})

this.responseRenderers.set('confirm', async (response, ctx) => {
  await ctx.reply(response.question, {
    reply_markup: { inline_keyboard: [[
      { text: 'Yes', callback_data: toCallbackData(response.onYes) },
      { text: 'No', callback_data: toCallbackData(response.onNo || '/noop') },
    ]]}
  })
})

// Discord override
this.responseRenderers.set('menu', async (response, interaction) => {
  const embed = new EmbedBuilder().setTitle(response.title)
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('cmd-select')
    .addOptions(response.options.map(o => ({
      label: o.label, value: o.command, description: o.hint,
    })))
  await interaction.reply({ embeds: [embed], components: [selectRow] })
})
```

### Button Callback Data

```typescript
// Short-lived cache for callback data that exceeds 64 bytes
const callbackCache = new Map<string, string>()  // id → full command string
let callbackCounter = 0

function toCallbackData(command: string): string {
  const data = `c/${command}`
  if (data.length <= 64) return data

  // Exceeded 64 bytes — store in cache, use short ID
  const id = String(++callbackCounter)
  callbackCache.set(id, command)
  // Clean old entries (keep last 1000)
  if (callbackCache.size > 1000) {
    const firstKey = callbackCache.keys().next().value
    callbackCache.delete(firstKey)
  }
  return `c/#${id}`  // 'c/#42' — always < 64 bytes
}

function fromCallbackData(data: string): string {
  if (data.startsWith('c/#')) {
    const id = data.slice(3)
    return callbackCache.get(id) ?? data.slice(2)
  }
  return data.slice(2)  // remove 'c/' prefix
}
```

**Prefix scope clarification:**
- `c/` — NEW: command dispatch from CommandRegistry (menu buttons, confirm buttons)
- `p:` — EXISTING: permission request buttons (unchanged)
- Other existing prefixes (`d:`, `v:`, `tn:`, `s:`, `ar:`, `sm:`, `ag:`, `na:`, `vb:`) — these are adapter-specific stateful UI interactions. They remain UNCHANGED and are NOT migrated to `c/`. They handle message editing, keyboard state updates, and multi-step UI flows that are not command dispatches.

---

## 7. Help System

Auto-generated from CommandRegistry.

```typescript
// src/core/commands/help.ts
registry.register({
  name: 'help',
  description: 'Show available commands',
  category: 'system',
  handler: async (args) => {
    const systemCmds = registry.getByCategory('system')
    const pluginCmds = registry.getByCategory('plugin')

    const options: MenuOption[] = []

    // System commands section
    for (const cmd of systemCmds) {
      options.push({
        label: `/${cmd.name}`,
        command: `/${cmd.name}`,
        hint: cmd.description,
      })
    }

    // Plugin commands section
    for (const cmd of pluginCmds) {
      const displayName = registry.getShortName(cmd.name) ?? cmd.name
      options.push({
        label: `/${displayName}`,
        command: `/${displayName}`,
        hint: `${cmd.description}${cmd.pluginName ? ` (${cmd.pluginName})` : ''}`,
      })
    }

    return { type: 'menu', title: 'Available Commands', options }
  },
})
```

Adapters override 'menu' renderer → help rendered as:
- Telegram: categorized inline keyboard
- Discord: embed with fields grouped by category
- Slack: block kit sections

---

## 8. Migration — Remove Hardcoded Commands

### What gets removed from adapters

**Telegram adapter:**
- Remove `STATIC_COMMANDS` constant
- Remove all `bot.command('xxx', handler)` registrations
- Remove all hardcoded callback query handlers for command-like actions
- Keep: permission callback handlers (`p:` prefix), streaming logic, draft management
- Replace with: ONE generic dispatch handler + response renderers

**Discord adapter:**
- Remove `SLASH_COMMANDS` array
- Remove `registerSlashCommands()` with hardcoded SlashCommandBuilder
- Remove `handleSlashCommand()` switch statement
- Replace with: dynamic slash command registration from registry + generic dispatch

**Slack adapter:**
- Remove hardcoded command handlers (if any)
- Add: generic dispatch handler

### What gets extracted from adapters into core/commands/

| Current location | New location | Commands |
|-----------------|-------------|----------|
| `plugins/telegram/commands/session.ts` | `src/core/commands/session.ts` | /new, /newchat, /cancel, /status, /sessions, /resume, /clear |
| `plugins/telegram/commands/agents.ts` | `src/core/commands/agents.ts` | /agents, /install |
| `plugins/telegram/commands/admin.ts` | `src/core/commands/admin.ts` | /restart, /update, /doctor |
| `plugins/telegram/commands/menu.ts` | `src/core/commands/menu.ts` | /menu |
| `plugins/telegram/commands/tts.ts` | `src/plugins/speech/index.ts` | /tts (registered in plugin setup) |
| `plugins/telegram/commands/tunnel.ts` | `src/plugins/tunnel/index.ts` | /tunnel, /tunnels |
| `plugins/telegram/commands/usage.ts` | `src/plugins/usage/index.ts` | /usage |
| `plugins/telegram/commands/dangerous.ts` | `src/plugins/security/index.ts` | /dangerous |
| `plugins/telegram/commands/integrate.ts` | `src/core/commands/admin.ts` | /integrate |
| `plugins/telegram/commands/verbosity.ts` | adapter-specific | /verbosity |
| `plugins/telegram/commands/settings.ts` | adapter-specific (multi-step wizard) | /settings |
| `plugins/telegram/commands/resume.ts` | adapter override (multi-step) | /resume |
| `plugins/telegram/commands/archive.ts` | adapter-specific (Telegram topics) | /archive |
| `plugins/telegram/commands/summary.ts` | `src/core/commands/session.ts` | /summary |
| `plugins/telegram/commands/new-session.ts` | adapter override (multi-step wizard) | /new |
| `plugins/telegram/commands/handoff.ts` | `src/core/commands/session.ts` | /handoff |

### Command Name Migration

| Old name | New name | Note |
|----------|----------|------|
| `/enable_dangerous` | `/dangerous on` | Consolidated into subcommand |
| `/disable_dangerous` | `/dangerous off` | Consolidated into subcommand |
| `/text_to_speech` | `/tts` | Shortened, old name kept as alias |

### Commands that stay adapter-specific

Registered by adapter plugin in its setup() via CommandRegistry (not by core). Different adapters can have completely different implementations:

- `/verbosity` — each adapter has different display settings
- `/archive` — Telegram topic archiving (Telegram-specific)
- `/settings` — multi-level navigation UI (platform-specific)
- `/new` override — Telegram uses multi-step wizard with forum topics, Discord uses slash command options
- `/resume` override — workspace picker flow (platform-specific UI)

---

## 9. New File Structure

```
src/core/
  commands/                      ← NEW: system command handlers
    session.ts                   ← /new, /newchat, /cancel, /status, /sessions, /resume, /clear
    agents.ts                    ← /agents, /install
    admin.ts                     ← /restart, /update, /doctor
    help.ts                      ← /help (auto-generated)
    menu.ts                      ← /menu
    index.ts                     ← registerSystemCommands(registry, core)
  command-registry.ts            ← NEW: CommandRegistry class
  plugin/types.ts                ← Update: CommandDef, CommandArgs, CommandResponse types
```

```
src/plugins/
  telegram/
    commands/                    ← REDUCED: only adapter-specific commands
      verbosity.ts               ← /verbosity (Telegram-specific)
      archive.ts                 ← /archive (Telegram-specific)
    adapter.ts                   ← SIMPLIFIED: generic dispatch + response renderers
  discord/
    commands/                    ← REDUCED
      verbosity.ts
    adapter.ts                   ← SIMPLIFIED
  speech/index.ts                ← registers /tts command in setup()
  tunnel/index.ts                ← registers /tunnel, /tunnels in setup()
  usage/index.ts                 ← registers /usage in setup()
  security/index.ts              ← registers /dangerous in setup()
```

---

## 10. Testing Strategy

### Unit Tests

- **CommandRegistry:** register, unregister, get, getByCategory, execute, namespace conflict resolution
- **System command handlers:** each handler tested with mock core, verify CommandResponse
- **Namespace conflicts:** system vs plugin, plugin vs plugin, qualified name fallback

### Integration Tests

- **Full dispatch flow:** register command → dispatch text → handler executes → response returned
- **Button dispatch:** callback data parsed → command executed → response
- **Plugin command lifecycle:** plugin boot → registerCommand → available in registry → shutdown → removed
- **Help generation:** registry with mixed system+plugin commands → help response includes all

### Adapter Tests

- **Response renderers:** each type (text, menu, list, confirm, error, silent) renders correctly
- **Telegram callback data:** toCallbackData handles long strings, prefix correct
- **Discord slash command sync:** commands from registry mapped to SlashCommandBuilder
