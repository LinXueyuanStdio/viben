# Command System

Viben has a centralized command system for chat commands (`/new`, `/cancel`, `/tts`, etc.). Commands are registered by core and plugins, dispatched by adapters, and rendered using platform-specific renderers.

This system covers **chat commands only** (Telegram, Discord, Slack), not CLI commands (`viben start`, `viben plugins install`).

---

## How It Works

```
User types /tts on
      |
      v
Adapter receives text
      |
      v
CommandRegistry.execute('/tts on', { channelId, userId, sessionId })
      |
      v
Find handler for 'tts'
      |
      v
Handler runs, returns CommandResponse
      |
      v
Adapter renders response (inline keyboard, embed, block kit, etc.)
```

---

## Core Types

### CommandDef

```typescript
interface CommandDef {
  name: string              // 'new', 'tts', 'tunnel'
  description: string       // shown in /help
  usage?: string            // 'on|off', '<agent-name>'
  category: 'system' | 'plugin'
  pluginName?: string       // auto-set by registry
  handler(args: CommandArgs): Promise<CommandResponse | void>
}
```

### CommandArgs

```typescript
interface CommandArgs {
  raw: string               // text after command name
  options?: Record<string, string>  // Discord slash command options
  sessionId: string | null  // null if no active session
  channelId: string         // 'telegram', 'discord', 'slack'
  userId: string
  reply(content: string | CommandResponse): Promise<void>  // mid-execution feedback
  coreAccess?: CoreAccess   // restricted core access
}
```

The `reply()` method is an escape hatch for commands that need mid-execution feedback (e.g., `/update` sends "Checking..." then "Updating..." then "Done"). Most commands just return a `CommandResponse`.

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
  command: string    // command to dispatch when selected
  hint?: string
}

interface ListItem {
  label: string
  detail?: string
}
```

---

## CommandRegistry

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

  // Namespace
  getQualifiedName(name: string, pluginName: string): string
  getShortName(qualifiedName: string): string | undefined
}
```

---

## System Commands vs Plugin Commands

### System commands

Registered by core during boot, before plugins load. These handle fundamental operations:

| Command | Description |
|---------|-------------|
| `/new` | Create new session |
| `/newchat` | New chat in same agent |
| `/cancel` | Cancel current session |
| `/status` | Show session status |
| `/sessions` | List all sessions |
| `/resume` | Resume a session |
| `/agents` | List available agents |
| `/install` | Install new agent |
| `/help` | Show all commands (auto-generated) |
| `/menu` | Show main menu |
| `/restart` | Restart Viben |
| `/update` | Update and restart |
| `/doctor` | System diagnostics |
| `/clear` | Clear session history |

### Plugin commands

Registered by plugins in their `setup()` via `ctx.registerCommand()`:

| Command | Plugin | Description |
|---------|--------|-------------|
| `/tts` | `@viben/speech` | Toggle text-to-speech |
| `/tunnel` | `@viben/tunnel` | Manage tunnels |
| `/tunnels` | `@viben/tunnel` | List active tunnels |
| `/usage` | `@viben/usage` | View usage and cost |
| `/bypass` | `@viben/security` | Toggle auto-approve mode |

---

## Namespace Conflict Resolution

Every plugin command has two names:

- **Qualified**: `pluginScope:commandName` -- always unique (e.g., `speech:tts`)
- **Short**: `commandName` -- available if no conflict (e.g., `tts`)

### Rules

1. **System commands always win** -- plugins cannot override system command short names
2. **First plugin wins** -- first plugin to register a short name keeps it
3. **Later conflicts get qualified name only** -- the first registrant is not affected
4. **Warning logged** on conflict

### Example

```
Register 'tts' by @viben/speech:
  -> short: /tts (no conflict)
  -> qualified: /speech:tts

Register 'status' by @viben/tunnel:
  -> short: /status (conflict with system command)
  -> qualified: /tunnel:status
  -> warning: "Plugin command 'status' conflicts with system command"

Register 'check' by @community/plugin-a:
  -> short: /check (no conflict)

Register 'check' by @community/plugin-b:
  -> short: /check (conflict with plugin-a)
  -> plugin-a KEEPS /check
  -> plugin-b only accessible via /plugin-b:check
```

---

## Adapter Dispatch and Rendering

### Generic dispatch

Each adapter adds ONE generic dispatch handler that replaces all hardcoded command handlers:

```typescript
// Telegram adapter
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text
  if (!text.startsWith('/')) return

  const registry = core.serviceRegistry.get<CommandRegistry>('command-registry')
  if (!registry) return

  const response = await registry.execute(text, {
    sessionId: getSessionIdFromTopic(ctx),
    channelId: 'telegram',
    userId: String(ctx.from.id),
  })

  await this.renderResponse(response, ctx)
})
```

### Response renderers

Adapters provide platform-specific renderers for each response type. Default renderers in the `MessagingAdapter` base class provide plain text fallback.

**Telegram** renders `menu` as inline keyboards, `confirm` as Yes/No buttons:

```typescript
// menu -> inline keyboard
this.responseRenderers.set('menu', async (response, ctx) => {
  const keyboard = response.options.map(opt => [{
    text: `${opt.label}${opt.hint ? ' -- ' + opt.hint : ''}`,
    callback_data: toCallbackData(opt.command),
  }])
  await ctx.reply(response.title, {
    reply_markup: { inline_keyboard: keyboard },
  })
})
```

**Discord** renders `menu` as select menus, `list` as embeds.

**Slack** renders using Block Kit sections.

### Button callback data

Commands triggered by button clicks use the `c/` prefix:

```
c/tts on        -> dispatch /tts on
c/#42           -> lookup cached command (for commands > 64 bytes)
```

Other callback prefixes remain unchanged: `p:` for permission buttons, etc.

---

## Two-Layer Architecture for Complex Commands

Some commands need multi-step interactive flows that vary by platform:

- `/new` on Telegram: create forum topic, show agent picker keyboard, workspace selection
- `/new` on Discord: use slash command options, channel creation
- `/resume`: session scanner, session picker UI

### How it works

**Layer 1 -- Core logic** (portable): handler returns a simple `CommandResponse`. Works on all adapters.

**Layer 2 -- Platform orchestration** (adapter-specific): adapter registers its own handler for the same command, using `reply()` for multi-step feedback and platform-specific APIs.

### Override priority

1. **Adapter-specific handler** (matches current `channelId`) -> highest priority
2. **Core handler** -> fallback

If Telegram registers its own `/new` handler, Telegram users get the rich wizard. Discord users (without an override) get the simpler core handler with a menu response.

---

## Writing a Plugin Command

Here's a complete example of a plugin that registers a command:

```typescript
import type { VibenPlugin, PluginContext } from '@viben/kernel'

export default {
  name: '@community/weather',
  version: '1.0.0',
  description: 'Check weather in chat',
  permissions: ['commands:register', 'services:use'],

  async setup(ctx: PluginContext) {
    ctx.registerCommand({
      name: 'weather',
      description: 'Check weather for a city',
      usage: '<city>',
      category: 'plugin',

      handler: async (args) => {
        const city = args.raw.trim()
        if (!city) {
          return {
            type: 'text',
            text: 'Usage: /weather <city>',
          }
        }

        try {
          const weather = await fetchWeather(city)
          return {
            type: 'list',
            title: `Weather in ${city}`,
            items: [
              { label: 'Temperature', detail: `${weather.temp}C` },
              { label: 'Conditions', detail: weather.conditions },
              { label: 'Wind', detail: `${weather.wind} km/h` },
            ],
          }
        } catch {
          return {
            type: 'error',
            message: `Could not fetch weather for "${city}"`,
          }
        }
      },
    })
  },
} satisfies VibenPlugin
```

This command will:
- Be available as `/weather` on all adapters (short name, no conflict)
- Also available as `/weather:weather` (qualified name)
- Appear in `/help` under "Plugin" category
- Render as a list on Telegram (plain text), Discord (embed), and Slack (blocks)

---

## Boot Flow

```
1. Core creates CommandRegistry, registers as service 'command-registry'
2. Core registers system commands (/new, /cancel, /help, etc.)
3. LifecycleManager boots plugins in dependency order
   -> Each plugin's setup() calls ctx.registerCommand()
4. After all plugins booted:
   -> Emit 'system:commands-ready' with registry.getAll()
5. Adapter plugins receive event -> sync with platform:
   - Telegram: bot.setMyCommands()
   - Discord: registerSlashCommands()
   - Slack: register message listener
```

---

## Further Reading

- [Architecture Overview](README.md) -- high-level picture
- [Plugin System](plugin-system.md) -- plugin infrastructure
- [Built-in Plugins](built-in-plugins.md) -- commands each plugin provides
- [Writing Plugins](writing-plugins.md) -- how to create plugins with commands
