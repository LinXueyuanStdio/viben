import type { TemplateParams } from './package-json.js'

/**
 * Generate CLAUDE.md — the AI agent context file embedded in every plugin.
 *
 * This file is the primary reference for AI coding agents (Claude Code, Cursor, etc.)
 * working on a plugin. It covers: plugin lifecycle, PluginContext API, event types,
 * middleware hooks, service registry, testing patterns, and links to external docs.
 *
 * Must stay in sync with the actual Viben plugin API (see CLAUDE.md in repo root
 * for the update rule). Outdated content here leads AI agents to generate incorrect code.
 */
export function generateClaudeMd(params: TemplateParams): string {
  return `# CLAUDE.md

This file provides context for AI coding agents (Claude, Cursor, etc.) working on this plugin.

## What is Viben?

Viben is an open-source platform that bridges AI coding agents (Claude Code, Codex, etc.) to messaging platforms (Telegram, Discord, Slack) and custom UIs via the Agent Client Protocol (ACP). It features a microkernel plugin architecture where all features — adapters, services, commands — are plugins.

- **Website & Docs**: https://viben.gitbook.io/docs
- **GitHub**: https://github.com/LinXueyuanStdio/viben
- **Plugin Registry**: https://github.com/Viben/plugin-registry

Key documentation pages:
- [Getting Started](https://viben.gitbook.io/docs/getting-started) — What is Viben, quickstart
- [Plugin Development](https://viben.gitbook.io/docs/extending/building-plugins) — How to build plugins
- [Architecture](https://viben.gitbook.io/docs/extending/architecture) — System design, plugin lifecycle
- [Dev Mode](https://viben.gitbook.io/docs/extending/dev-mode) — Hot-reload development workflow
- [CLI Commands](https://viben.gitbook.io/docs/api-reference/cli-commands) — Full CLI reference
- [Platform Setup](https://viben.gitbook.io/docs/platform-setup) — Telegram, Discord, Slack guides
- [Configuration](https://viben.gitbook.io/docs/self-hosting/configuration) — Config and settings reference

## Project Overview

This is an Viben plugin. Plugins extend Viben with new adapters, services, commands, and middleware.

- **Package**: ${params.pluginName}
- **SDK**: \`@viben/plugin-sdk\` (types, base classes, testing utilities)
- **Entry point**: \`src/index.ts\` (default export of \`VibenPlugin\` object)

## Build & Run

\`\`\`bash
npm install           # Install dependencies
npm run build         # Compile TypeScript (tsc)
npm run dev           # Watch mode (tsc --watch)
npm test              # Run tests (vitest)
\`\`\`

### Development with hot-reload

\`\`\`bash
viben dev .         # Compiles, watches, and reloads plugin on changes
\`\`\`

## File Structure

\`\`\`
src/
  index.ts              — Plugin entry point (exports VibenPlugin)
  __tests__/
    index.test.ts       — Tests using @viben/plugin-sdk/testing
package.json            — engines.viben declares minimum CLI version
tsconfig.json           — ES2022, NodeNext, strict mode
CLAUDE.md               — This file (AI agent context)
PLUGIN_GUIDE.md         — Human-readable developer guide
\`\`\`

## Architecture: How Viben Plugins Work

### Plugin Lifecycle

\`\`\`
install ──> [reboot] ──> migrate? ──> setup ──> [running] ──> teardown ──> uninstall
\`\`\`

| Hook | Trigger | Interactive? | Has Services? |
|------|---------|-------------|---------------|
| \`install(ctx)\` | \`viben plugin add <name>\` | Yes | No |
| \`migrate(ctx, oldSettings, oldVersion)\` | Boot — stored version differs from plugin version | No | No |
| \`configure(ctx)\` | \`viben plugin configure <name>\` | Yes | No |
| \`setup(ctx)\` | Every boot, after migrate | No | Yes |
| \`teardown()\` | Shutdown (10s timeout) | No | Yes |
| \`uninstall(ctx, opts)\` | \`viben plugin remove <name>\` | Yes | No |

### VibenPlugin Interface

\`\`\`typescript
interface VibenPlugin {
  name: string                    // unique identifier, e.g. '@myorg/my-plugin'
  version: string                 // semver
  description?: string
  permissions?: PluginPermission[]
  pluginDependencies?: Record<string, string>          // name -> semver range
  optionalPluginDependencies?: Record<string, string>  // used if available
  overrides?: string              // replace a built-in plugin entirely
  settingsSchema?: ZodSchema      // Zod validation for settings
  essential?: boolean             // true = needs setup before system can run

  setup(ctx: PluginContext): Promise<void>
  teardown?(): Promise<void>
  install?(ctx: InstallContext): Promise<void>
  configure?(ctx: InstallContext): Promise<void>
  migrate?(ctx: MigrateContext, oldSettings: unknown, oldVersion: string): Promise<unknown>
  uninstall?(ctx: InstallContext, opts: { purge: boolean }): Promise<void>
}
\`\`\`

### PluginContext API (available in setup)

\`\`\`typescript
interface PluginContext {
  pluginName: string
  pluginConfig: Record<string, unknown>   // from settings.json

  // Events (requires 'events:read' / 'events:emit')
  on(event: string, handler: (...args: unknown[]) => void): void
  off(event: string, handler: (...args: unknown[]) => void): void
  emit(event: string, payload: unknown): void

  // Services (requires 'services:register' / 'services:use')
  registerService<T>(name: string, implementation: T): void
  getService<T>(name: string): T | undefined

  // Middleware (requires 'middleware:register')
  registerMiddleware<H extends MiddlewareHook>(hook: H, opts: MiddlewareOptions<MiddlewarePayloadMap[H]>): void

  // Commands (requires 'commands:register')
  registerCommand(def: CommandDef): void

  // Menu items (requires 'commands:register')
  registerMenuItem(item: MenuItem): void
  unregisterMenuItem(id: string): void

  // Assistant context sections (requires 'commands:register')
  registerAssistantSection(section: AssistantSection): void
  unregisterAssistantSection(id: string): void

  // Storage (requires 'storage:read' / 'storage:write')
  storage: PluginStorage  // get, set, delete, list, getDataDir

  // Messaging (requires 'services:use')
  sendMessage(sessionId: string, content: OutgoingMessage): Promise<void>

  // Kernel access (requires 'kernel:access')
  sessions: SessionManager
  config: ConfigManager
  eventBus: EventBus

  // Always available
  log: Logger  // trace, debug, info, warn, error, fatal, child
}
\`\`\`

### CommandDef and CommandResponse

\`\`\`typescript
interface CommandDef {
  name: string              // command name without slash
  description: string       // shown in /help
  usage?: string            // e.g. '<city>' or 'on|off'
  category: 'system' | 'plugin'
  handler(args: CommandArgs): Promise<CommandResponse | void>
}

interface CommandArgs {
  raw: string               // text after command name
  sessionId: string | null
  channelId: string         // 'telegram', 'discord', 'slack'
  userId: string
  reply(content: string | CommandResponse): Promise<void>
}

type CommandResponse =
  | { type: 'text'; text: string }
  | { type: 'menu'; title: string; options: MenuOption[] }
  | { type: 'list'; title: string; items: ListItem[] }
  | { type: 'confirm'; question: string; onYes: string; onNo: string }
  | { type: 'error'; message: string }
  | { type: 'silent' }
  | { type: 'delegated' }
\`\`\`

### Settings System

- \`settingsSchema\`: Zod schema for validation
- \`SettingsAPI\` (in InstallContext): get, set, getAll, setAll, delete, clear, has
- Settings stored at \`~/.viben/plugins/@scope/name/settings.json\`
- \`PluginStorage\` (in PluginContext): key-value store at \`~/.viben/plugins/data/@scope/name/kv.json\`
- \`storage.getDataDir()\`: returns path for large files, databases, caches

### InstallContext (for install/configure/uninstall)

\`\`\`typescript
interface InstallContext {
  pluginName: string
  terminal: TerminalIO        // text, select, confirm, password, multiselect, log, spinner, note
  settings: SettingsAPI
  dataDir: string
  log: Logger
}
\`\`\`

### Service Interfaces (available via ctx.getService)

| Service name | Interface | Description |
|---|---|---|
| \`security\` | \`SecurityService\` | Access control, session limits, user roles |
| \`file-service\` | \`FileServiceInterface\` | File saving, resolving, format conversion |
| \`notifications\` | \`NotificationService\` | Send notifications to users |
| \`usage\` | \`UsageService\` | Token/cost tracking and budget checking |
| \`speech\` | \`SpeechServiceInterface\` | Text-to-speech and speech-to-text |
| \`tunnel\` | \`TunnelServiceInterface\` | Port tunneling and public URL management |
| \`context\` | \`ContextService\` | Context building for agent sessions |

## Plugin Permissions

Declare in \`permissions\` array. Only request what you need.

| Permission | Allows |
|---|---|
| \`events:read\` | \`ctx.on()\` — subscribe to events |
| \`events:emit\` | \`ctx.emit()\` — emit custom events (must prefix with plugin name) |
| \`services:register\` | \`ctx.registerService()\` — provide services to other plugins |
| \`services:use\` | \`ctx.getService()\`, \`ctx.sendMessage()\` — consume services |
| \`middleware:register\` | \`ctx.registerMiddleware()\` — intercept and modify flows |
| \`commands:register\` | \`ctx.registerCommand()\` — add chat commands |
| \`storage:read\` | \`ctx.storage.get()\`, \`ctx.storage.list()\` |
| \`storage:write\` | \`ctx.storage.set()\`, \`ctx.storage.delete()\` |
| \`kernel:access\` | \`ctx.sessions\`, \`ctx.config\`, \`ctx.eventBus\`, \`ctx.core\` |

Calling a method without the required permission throws \`PluginPermissionError\`.

## Middleware Hooks (19 total)

Register with \`ctx.registerMiddleware(hook, { priority?, handler })\`. Return \`null\` to block the flow, call \`next()\` to continue.

### Message flow
- \`message:incoming\` — incoming user message (channelId, threadId, userId, text, attachments)
- \`message:outgoing\` — outgoing message to user (sessionId, message)

### Agent flow
- \`agent:beforePrompt\` — before prompt is sent to agent (sessionId, text, attachments)
- \`agent:beforeEvent\` — before agent event is processed (sessionId, event)
- \`agent:afterEvent\` — after agent event, before delivery (sessionId, event, outgoingMessage)

### Turn lifecycle
- \`turn:start\` — agent turn begins (sessionId, promptText, promptNumber)
- \`turn:end\` — agent turn ends (sessionId, stopReason, durationMs)

### File system
- \`fs:beforeRead\` — before file read (sessionId, path, line, limit)
- \`fs:beforeWrite\` — before file write (sessionId, path, content)

### Terminal
- \`terminal:beforeCreate\` — before terminal process spawned (sessionId, command, args, env, cwd)
- \`terminal:afterExit\` — after terminal process exits (sessionId, terminalId, command, exitCode, durationMs)

### Permission
- \`permission:beforeRequest\` — before permission prompt (sessionId, request, autoResolve)
- \`permission:afterResolve\` — after permission resolved (sessionId, requestId, decision, userId, durationMs)

### Session
- \`session:beforeCreate\` — before session creation (agentName, workingDir, userId, channelId, threadId)
- \`session:afterDestroy\` — after session destroyed (sessionId, reason, durationMs, promptCount)

### Control
- \`config:beforeChange\` — before config change (sessionId, configId, oldValue, newValue)
- \`agent:beforeCancel\` — before agent cancellation (sessionId, reason)
- \`agent:beforeSwitch\` — **blocking** before agent switch (sessionId, fromAgent, toAgent). Return null/false to block.
- \`agent:afterSwitch\` — **fire-and-forget** after agent switch (sessionId, fromAgent, toAgent, resumed). Observational only.

## Plugin Events (subscribe with ctx.on)

### System
- \`kernel:booted\`, \`system:ready\`, \`system:shutdown\`, \`system:commands-ready\`

### Plugin lifecycle
- \`plugin:loaded\`, \`plugin:failed\`, \`plugin:disabled\`, \`plugin:unloaded\`

### Session
- \`session:created\`, \`session:ended\`, \`session:named\`, \`session:updated\`

### Agent
- \`agent:event\`, \`agent:prompt\`

### Permission
- \`permission:request\`, \`permission:resolved\`

## Testing

Use \`@viben/plugin-sdk/testing\`:

\`\`\`typescript
import { createTestContext, createTestInstallContext, mockServices } from '@viben/plugin-sdk/testing'
\`\`\`

### createTestContext(opts)

Creates a test \`PluginContext\`. All state is in-memory.

\`\`\`typescript
const ctx = createTestContext({
  pluginName: '${params.pluginName}',
  pluginConfig: { enabled: true },
  permissions: plugin.permissions,
  services: { security: mockServices.security() },
})
await plugin.setup(ctx)
expect(ctx.registeredCommands.has('mycommand')).toBe(true)
const response = await ctx.executeCommand('mycommand', { raw: 'test' })
\`\`\`

Inspection properties: \`registeredServices\`, \`registeredCommands\`, \`registeredMiddleware\`, \`emittedEvents\`, \`sentMessages\`, \`executeCommand()\`.

### createTestInstallContext(opts)

Creates a test \`InstallContext\`. Terminal prompts auto-answered from \`terminalResponses\`.

\`\`\`typescript
const ctx = createTestInstallContext({
  pluginName: '${params.pluginName}',
  terminalResponses: { password: ['sk-test-key'], select: ['en'] },
})
await plugin.install!(ctx)
expect(ctx.settingsData.get('apiKey')).toBe('sk-test-key')
\`\`\`

### mockServices

Factory functions for mock service implementations:

\`\`\`typescript
mockServices.security(overrides?)    // checkAccess, checkSessionLimit, getUserRole
mockServices.fileService(overrides?) // saveFile, resolveFile, readTextFileWithRange
mockServices.notifications(overrides?) // notify, notifyAll
mockServices.usage(overrides?)       // trackUsage, checkBudget, getSummary
mockServices.speech(overrides?)      // textToSpeech, speechToText, register*
mockServices.tunnel(overrides?)      // getPublicUrl, start, stop, getStore, fileUrl, diffUrl
mockServices.context(overrides?)     // buildContext, registerProvider
\`\`\`

## Conventions

- **ESM-only**: \`"type": "module"\` in package.json
- **Import extensions**: All imports must use \`.js\` extension (e.g., \`import x from './util.js'\`)
- **TypeScript strict mode**: \`strict: true\` in tsconfig.json
- **Target**: ES2022, module NodeNext
- **Test framework**: Vitest
- **Test files**: \`src/**/__tests__/*.test.ts\`

## How to Add a Command

\`\`\`typescript
// In setup():
ctx.registerCommand({
  name: 'mycommand',
  description: 'Does something useful',
  usage: '[arg]',
  category: 'plugin',
  async handler(args) {
    const input = args.raw.trim()
    if (!input) return { type: 'error', message: 'Usage: /mycommand [arg]' }
    return { type: 'text', text: \\\`Result: \\\${input}\\\` }
  },
})
\`\`\`

Requires \`commands:register\` permission. Available as \`/mycommand\` (if no conflict) and \`/pluginscope:mycommand\` (always).

## How to Add a Service

\`\`\`typescript
// In setup():
const myService = new MyService()
ctx.registerService('my-service', myService)
\`\`\`

Requires \`services:register\` permission. Other plugins consume with \`ctx.getService<MyService>('my-service')\`.

## How to Add Middleware

\`\`\`typescript
// In setup():
ctx.registerMiddleware('message:outgoing', {
  priority: 50,  // lower = earlier execution
  handler: async (payload, next) => {
    payload.message.text = modifyText(payload.message.text)
    return next()  // continue chain; return null to block
  },
})
\`\`\`

Requires \`middleware:register\` permission.

## How Settings Work

1. Define \`settingsSchema\` (Zod) on the plugin object
2. In \`install()\`: use \`ctx.terminal\` for interactive prompts, save with \`ctx.settings.set()\`
3. In \`configure()\`: re-run prompts with current values pre-filled
4. In \`setup()\`: read settings from \`ctx.pluginConfig\`
5. In \`migrate()\`: transform old settings to new format on version change

## Version Compatibility

The \`engines.viben\` field in package.json declares the minimum CLI version. Viben checks this on install and warns if incompatible.
`
}
