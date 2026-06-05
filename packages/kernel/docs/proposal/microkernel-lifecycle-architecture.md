# Proposal: Microkernel Lifecycle Architecture for Viben

## Status

**Proposal** — this document describes a unified architectural vision that merges the Plugin API v2 (originally PR #63) with a microkernel lifecycle architecture. It is not a spec and not ready for implementation. Feedback and discussion are welcome.

## Context

Viben currently has a monolithic architecture where all subsystems (Security, Speech, Usage, Notifications, FileService, Tunnel, etc.) are hard-wired into `VibenCore`. The plugin system only supports adding new channel adapters via `AdapterFactory`.

PR #63 proposed Plugin API v2 — a unified plugin interface with events, commands, middleware, and storage. That spec is now **superseded by this proposal**, which takes the same concepts further: instead of adding a plugin layer on top of the monolith, we redesign the foundation so that **everything is a plugin**.

This proposal incorporates all of PR #63's design (PluginContext, permissions, error isolation, commands, middleware, storage, security model, backward compatibility) and extends it with a microkernel architecture.

### Ongoing work (not blocked by this proposal)

- **Phase 1** — Adapter layer refactor (`refactor/adapter-layer-phase1`), currently in progress
- **Phase 2** — ACP protocol completion, planned after Phase 1

This proposal does not block or conflict with the above. Implementation begins after Phase 1 and Phase 2 are complete, or can be done in parallel on a separate branch.

### Why merge PR #63 into this proposal?

PR #63 designed the plugin system to sit **on top of the monolithic core**. If implemented as-is, the plugin loading code, startup sequence, and context wiring would need to be **rewritten** when migrating to microkernel. By merging the two designs upfront:

- No throwaway code — implement once for the right architecture
- Coherent design — no awkward transition state
- Less total effort — one implementation cycle instead of two

---

## Vision

Transform Viben from a monolithic application into a **microkernel** where:

- **Kernel** holds only: Lifecycle management, EventBus, Config, ServiceRegistry, Session management, Agent management
- **Everything else is a plugin**: Adapters, Speech, Usage/Budget, Security, Notifications, Tunnel, Context, FileService, API Server
- **Built-in plugins** ship with Viben (no install needed), community plugins are installed separately
- All plugins — built-in and community — follow the same interface, same lifecycle, same rules

### Why microkernel?

The goal is not architectural purity. The goal is:

1. **Any feature can be added without touching core** — community builds what they need
2. **Any built-in can be replaced** — don't like our security model? Swap it
3. **Each piece has clear boundaries** — understand speech by reading one plugin, not tracing through 5 core files
4. **Independent update cycles** — update speech plugin without updating Viben itself

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Viben Process                       │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │                    Kernel                          │  │
│  │                                                   │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────────┐ │  │
│  │  │ Lifecycle│ │ EventBus │ │  ServiceRegistry  │ │  │
│  │  │ Manager  │ │          │ │                   │ │  │
│  │  └──────────┘ └──────────┘ └───────────────────┘ │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────────┐ │  │
│  │  │  Config  │ │ Session  │ │  Agent Manager    │ │  │
│  │  │ Manager  │ │ Manager  │ │                   │ │  │
│  │  └──────────┘ └──────────┘ └───────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────┐ │  │
│  │  │            Plugin Loader                     │ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                              │
│          ┌───────────────┼───────────────┐              │
│          ▼               ▼               ▼              │
│  ┌──────────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │  Built-in    │ │  Built-in  │ │   Community       │  │
│  │  Plugins     │ │  Adapters  │ │   Plugins         │  │
│  │              │ │            │ │                    │  │
│  │ • security   │ │ • telegram │ │ • auto-approve    │  │
│  │ • file-svc   │ │ • discord  │ │ • translate       │  │
│  │ • notify     │ │ • slack    │ │ • custom-adapter  │  │
│  │ • usage      │ │            │ │ • conversation-log│  │
│  │ • speech     │ │            │ │ • ...             │  │
│  │ • context    │ │            │ │                    │  │
│  │ • tunnel     │ │            │ │                    │  │
│  │ • api-server │ │            │ │                    │  │
│  └──────────────┘ └────────────┘ └──────────────────────│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### What stays in the kernel

| Component | Why it's in kernel |
|-----------|-------------------|
| **Lifecycle Manager** | Fundamental — manages boot/shutdown sequence, plugin loading |
| **EventBus** | Fundamental — communication backbone for all plugins |
| **Config Manager** | Must exist before any plugin loads (plugins need config to know if they're enabled) |
| **Service Registry** | Core coordination — plugins register and lookup services |
| **Session Manager** | Too fundamental to externalize — every adapter and most plugins interact with sessions |
| **Agent Manager** | Tightly coupled with sessions — spawning/resuming agent subprocesses is core to Viben's purpose |
| **Plugin Loader** | Obviously kernel responsibility — loads and initializes plugins |

### What becomes a plugin

| Current module | Plugin name | Service it provides |
|---------------|-------------|-------------------|
| `SecurityGuard` | `@viben/plugin-security` | `security` |
| `FileService` | `@viben/plugin-file-service` | `file-service` |
| `NotificationManager` | `@viben/plugin-notifications` | `notifications` |
| `UsageStore` + `UsageBudget` | `@viben/plugin-usage` | `usage` |
| `SpeechService` | `@viben/plugin-speech` | `speech` |
| `ContextManager` | `@viben/plugin-context` | `context` |
| Tunnel service | `@viben/plugin-tunnel` | `tunnel` |
| API server | `@viben/plugin-api-server` | `api-server` |
| `TelegramAdapter` | `@viben/plugin-telegram` | `adapter:telegram` |
| `DiscordAdapter` | `@viben/adapter-discord` | `adapter:discord` |
| `SlackAdapter` | `@viben/plugin-slack` | `adapter:slack` |

### Project structure

```
src/
  kernel/
    index.ts              — Kernel class, public API
    lifecycle.ts          — Boot/shutdown sequence, plugin loading
    event-bus.ts          — Typed event bus
    config.ts             — Config loading, Zod validation
    service-registry.ts   — Service registration and lookup
    session-manager.ts    — Session state machine, prompt queue
    agent-manager.ts      — Agent spawning, ACP subprocess
    plugin-loader.ts      — Load built-in + community plugins
    plugin-context.ts     — PluginContext factory
    types.ts              — All shared types and interfaces
  plugins/
    built-in/
      security/
        index.ts          — VibenPlugin implementation
      file-service/
        index.ts
      notifications/
        index.ts
      usage/
        index.ts
      speech/
        index.ts
      context/
        index.ts
      tunnel/
        index.ts
      api-server/
        index.ts
    adapters/
      telegram/
        index.ts          — VibenPlugin + adapter implementation
      discord/
        index.ts
      slack/
        index.ts
```

---

## Plugin Interface

The unified plugin interface covers all plugin types — event listeners, command providers, middleware, service providers, and adapters:

```typescript
interface VibenPlugin {
  /** Unique plugin identifier, e.g., '@viben/plugin-security' */
  name: string

  /** Semver version */
  version: string

  /** Human-readable description */
  description?: string

  /** Required plugin dependencies — auto-installed on `viben plugin add` */
  pluginDependencies?: Record<string, string>  // name → semver range

  /** Optional plugin dependencies — used if available, skipped if not */
  optionalPluginDependencies?: Record<string, string>

  /** Required permissions — determines what PluginContext exposes */
  permissions: PluginPermission[]

  /**
   * Called during startup. Register services, hooks, commands here.
   * Plugins receive a PluginContext with access to kernel capabilities.
   *
   * Called in dependency order — all plugins in `pluginDependencies`
   * are guaranteed to have completed setup() before this plugin's setup().
   */
  setup(ctx: PluginContext): Promise<void>

  /**
   * Called during shutdown. Cleanup resources, flush data, close connections.
   * Called in reverse order of setup.
   * Has a timeout — plugin must complete within the grace period.
   */
  teardown?(): Promise<void>
}
```

### PluginContext

PluginContext is the single entry point for all plugin capabilities, organized in tiers by stability and risk level:

```typescript
interface PluginContext {
  // === Identity ===
  /** This plugin's name */
  pluginName: string

  /** Plugin-specific config from config.json */
  pluginConfig: Record<string, unknown>

  // === Tier 1 — Events (read-only, stable) ===
  /** Subscribe to system events. All listeners auto-cleaned on teardown. */
  on(event: PluginEvent, handler: Function): void
  off(event: PluginEvent, handler: Function): void

  // === Tier 2 — Actions (side effects, stable) ===
  registerCommand(def: CommandDef): void
  registerMiddleware(hook: MiddlewareHook, handler: MiddlewareFn): void
  sendMessage(sessionId: string, content: OutgoingMessage): Promise<void>
  storage: PluginStorage
  log: Logger

  // === Tier 2.5 — Services (new in microkernel) ===

  /**
   * Register a service that other plugins can use.
   * Service name must be unique. Built-in plugins register first.
   * Community plugin can override built-in with `overrides` declaration.
   */
  registerService<T>(name: string, implementation: T): void

  /**
   * Lookup a service by name. Returns undefined if not registered.
   * For required dependencies (declared in pluginDependencies),
   * the service is guaranteed to exist.
   * For optional dependencies, always check for undefined.
   */
  getService<T>(name: string): T | undefined

  // === Tier 3 — Kernel access (advanced, may change) ===
  kernel: Kernel
  sessions: SessionManager
  config: ConfigManager  // read-only
  eventBus: EventBus
}
```

### Available Events

| Event | Payload | Description |
|-------|---------|-------------|
| `session:created` | `{ sessionId, agentName, userId, workingDir, channelId }` | New session started |
| `session:ended` | `{ sessionId, reason }` | Session finished/cancelled/errored |
| `session:named` | `{ sessionId, name }` | Session auto-named |
| `agent:event` | `{ sessionId, event: AgentEvent }` | Any agent event (text, tool_call, thought, plan, usage, etc.) |
| `agent:prompt` | `{ sessionId, text, attachments? }` | User sent prompt to agent |
| `adapter:outgoing` | `{ sessionId, message: OutgoingMessage }` | Message about to be sent to user |
| `permission:request` | `{ sessionId, request: PermissionRequest }` | Agent requests permission |
| `permission:resolved` | `{ sessionId, requestId, decision }` | User responded to permission |
| `system:ready` | `{}` | All plugins loaded, system accepting messages |
| `system:shutdown` | `{}` | Shutdown initiated, plugins should prepare for teardown |
| `system:commands-ready` | `{ commands: CommandDef[] }` | All plugin commands collected, adapters should register them |
| `plugin:loaded` | `{ name, version }` | A plugin completed setup successfully |
| `plugin:failed` | `{ name, error }` | A plugin failed during setup |
| `plugin:disabled` | `{ name, reason }` | A plugin was auto-disabled (error budget exceeded) |

### Command Definition

```typescript
interface CommandDef {
  /** Command name without slash, e.g., "context" for /context */
  name: string
  /** Short description shown in command list */
  description: string
  /** Command usage pattern, e.g., "<session-number>" */
  usage?: string
  /** Command handler */
  handler(args: CommandArgs): Promise<void>
}

interface CommandArgs {
  /** Raw argument string after command name */
  raw: string
  /** Session ID where command was invoked (null if from notification topic) */
  sessionId: string | null
  /** Channel ID (telegram, discord, slack) */
  channelId: string
  /** User ID who invoked the command */
  userId: string
  /** Reply helper — shortcut for sending message to the invoking topic */
  reply(content: string | OutgoingMessage): Promise<void>
}
```

---

## Plugin Dependencies

### Declaration

Each plugin declares what other plugins it needs:

```typescript
// @viben/plugin-speech
{
  name: '@viben/plugin-speech',
  version: '1.0.0',
  pluginDependencies: {
    '@viben/plugin-file-service': '^1.0.0'   // MUST be installed and active
  },
  optionalPluginDependencies: {
    '@viben/plugin-usage': '^1.0.0'          // use if available
  }
}
```

### Install-time resolution

When user runs `viben plugin add @viben/plugin-speech`:

1. Fetch plugin from npm
2. Read `pluginDependencies`
3. For each dependency not already installed → auto-install recursively
4. `optionalPluginDependencies` → print suggestion, don't auto-install
5. Add all to `~/.viben/config.json` plugins array

```
$ viben plugin add @viben/plugin-speech

📦 @viben/plugin-speech v1.0.0
   Text-to-speech and speech-to-text for voice sessions

   Required dependencies:
   ✅ @viben/plugin-file-service v1.2.0 (already installed)
   📦 @viben/plugin-groq-provider v1.0.0 (will be installed)

   Optional dependencies:
   💡 @viben/plugin-usage v1.0.0 (not installed — usage tracking for speech calls)

   Permissions:
   ✅ events:read          — Listen to session events
   ✅ services:register    — Register speech service
   ✅ services:use         — Use file-service

   Install? [Y/n]
```

### Startup-time resolution

Kernel resolves plugin load order using topological sort on the dependency graph:

```
Given plugins:
  security        → (no deps)
  file-service    → (no deps)
  notifications   → security
  usage           → (no deps)
  speech          → file-service
  telegram        → security, notifications
  auto-approve    → security (community plugin)

Topo-sort result:
  1. security, file-service, usage     (no deps — can start in parallel)
  2. notifications, speech             (deps satisfied)
  3. telegram, auto-approve            (deps satisfied)
```

Plugins at the same depth in the graph CAN be started in parallel (future optimization, sequential for v1).

### Circular dependency detection

```
Plugin A depends on Plugin B
Plugin B depends on Plugin A
→ Detected at startup, before any setup() is called
→ Error: "Circular dependency detected: A → B → A. Cannot start."
→ Both plugins are skipped, rest of system boots normally
```

### Missing dependency handling

```
Plugin telegram depends on security
Security plugin is not installed or disabled
→ Error: "@viben/plugin-telegram requires @viben/plugin-security which is not available"
→ telegram plugin skipped
→ Rest of system boots normally (degraded — no telegram)
```

### Version mismatch

```
Plugin speech requires file-service ^1.0.0
Installed file-service is 2.0.0
→ Warning: "@viben/plugin-speech requires @viben/plugin-file-service ^1.0.0 but 2.0.0 is installed"
→ Attempt to load anyway (warning, not error)
→ If setup() fails → skip plugin with error
```

---

## Plugin Communication

Two patterns, each with a clear use case:

### Pattern 1: EventBus — for broadcast / notifications

When a plugin needs to announce something happened, without knowing or caring who listens:

```typescript
// Kernel emits lifecycle events
kernel.eventBus.emit('session:created', { sessionId, agentName })

// Multiple plugins listen independently
// Usage plugin:
ctx.on('session:created', ({ sessionId }) => {
  this.startTracking(sessionId)
})

// Notifications plugin:
ctx.on('session:created', ({ sessionId, agentName }) => {
  this.notify(`New session started: ${agentName}`)
})

// Conversation-log plugin:
ctx.on('session:created', ({ sessionId }) => {
  this.createLogFile(sessionId)
})
```

**Use for:** Lifecycle events, agent events, status changes, audit logging.

**Not for:** Request/response patterns where caller needs a return value.

### Pattern 2: Service lookup — for direct calls

When a plugin needs to call another plugin's functionality and get a result:

```typescript
// Telegram adapter needs to convert text to speech
async handleVoiceMode(sessionId: string, text: string) {
  const speech = ctx.getService<SpeechService>('speech')
  if (!speech) {
    // Speech plugin not installed — fallback to text only
    await this.sendTextMessage(sessionId, text)
    return
  }

  const audio = await speech.textToSpeech(text, { language: 'en' })
  await this.sendAudioMessage(sessionId, audio)
}
```

```typescript
// Auto-approve plugin needs to check security rules
async handlePermissionRequest(sessionId: string, request: PermissionRequest) {
  const security = ctx.getService<SecurityService>('security')

  // security is a required dependency — guaranteed to exist
  const userRole = await security.getUserRole(request.userId)

  if (userRole === 'admin' && request.kind === 'read') {
    // Auto-approve reads for admins
    ctx.kernel.resolvePermission(sessionId, request.id, 'allow-once')
  }
}
```

**Use for:** Getting data from another plugin, calling another plugin's functionality, request/response patterns.

**Not for:** One-way notifications (use EventBus instead).

### When to use which?

| Scenario | Pattern | Why |
|----------|---------|-----|
| "Session just started" | EventBus | Broadcast — anyone can listen |
| "Convert this text to audio" | Service lookup | Need return value |
| "Agent produced output" | EventBus | Multiple consumers (log, send, track) |
| "Check if user is allowed" | Service lookup | Need yes/no answer |
| "Plugin encountered error" | EventBus | Broadcast — monitoring plugins listen |
| "Store this file to disk" | Service lookup | Need file path back |

---

## Startup Lifecycle

### Boot sequence

```
1. Kernel boot
   ├── Load config from ~/.viben/config.json
   ├── Init logger
   ├── Init EventBus
   ├── Init ServiceRegistry
   ├── Init SessionManager
   ├── Init AgentManager
   └── Emit 'kernel:booted'

2. Plugin discovery
   ├── Scan built-in plugins (from source)
   ├── Scan community plugins (from ~/.viben/plugins/)
   ├── Read each plugin's dependencies
   ├── Validate: check for missing deps, circular deps, version mismatches
   └── Compute load order via topological sort

3. Plugin setup (in topo-sorted order)
   ├── For each plugin:
   │   ├── Create PluginContext (scoped by permissions)
   │   ├── Call plugin.setup(ctx)
   │   ├── If setup() throws → log error, mark plugin as failed, continue
   │   ├── Register services declared by plugin
   │   └── Emit 'plugin:loaded' event
   └── If a plugin's required dependency failed → skip this plugin too

4. Post-setup validation
   ├── Check all registered services are healthy
   ├── Check all adapters are ready
   └── Warn about any optional dependencies not satisfied

5. Ready
   ├── Emit 'system:ready'
   ├── Adapters start accepting messages
   └── Log startup summary (loaded plugins, skipped plugins, warnings)
```

### Shutdown sequence

```
1. Receive SIGINT/SIGTERM
   └── Emit 'system:shutdown' event

2. Grace period begins (default: 30 seconds)
   ├── Adapters stop accepting new messages
   ├── Active sessions are notified ("Viben is shutting down")
   └── Wait for in-flight prompts to complete (up to grace period)

3. Plugin teardown (reverse order of setup)
   ├── For each plugin (reverse topo-sort order):
   │   ├── Call plugin.teardown() with timeout (10 seconds per plugin)
   │   ├── If teardown() times out → log warning, force continue
   │   ├── If teardown() throws → log error, continue
   │   └── Emit 'plugin:unloaded' event
   └── Adapters teardown last (they were set up last)

4. Kernel cleanup
   ├── Destroy all remaining sessions
   ├── Stop AgentManager (kill subprocesses)
   ├── Flush EventBus
   ├── Save config/state
   └── Exit process
```

### Startup example — concrete

Given this config:

```json
{
  "plugins": [
    { "package": "@viben/plugin-security", "enabled": true },
    { "package": "@viben/plugin-file-service", "enabled": true },
    { "package": "@viben/plugin-notifications", "enabled": true },
    { "package": "@viben/plugin-usage", "enabled": true },
    { "package": "@viben/plugin-speech", "enabled": true },
    { "package": "@viben/plugin-tunnel", "enabled": false },
    { "package": "@viben/plugin-api-server", "enabled": true },
    { "package": "@viben/plugin-telegram", "enabled": true },
    { "package": "@community/plugin-auto-approve", "enabled": true }
  ]
}
```

Boot log:

```
[kernel] Viben v3.0.0 starting...
[kernel] Config loaded from ~/.viben/config.json
[kernel] EventBus initialized
[kernel] SessionManager initialized
[kernel] AgentManager initialized
[kernel] Discovered 9 plugins (8 enabled, 1 disabled)
[kernel] Plugin load order (topo-sorted):
         1. security, file-service, usage (no deps)
         2. notifications (→ security)
         3. speech (→ file-service)
         4. api-server (→ security)
         5. telegram (→ security, notifications)
         6. auto-approve (→ security)
[kernel] Skipping tunnel (disabled)
[plugin:security] Setting up... registered service 'security'
[plugin:file-service] Setting up... registered service 'file-service'
[plugin:usage] Setting up... registered service 'usage'
[plugin:notifications] Setting up... registered service 'notifications'
[plugin:speech] Setting up... registered service 'speech'
[plugin:api-server] Setting up... API server listening on :3000
[plugin:telegram] Setting up... connected to Telegram Bot API
[plugin:auto-approve] Setting up... auto-approve rules loaded
[kernel] All plugins loaded. System ready.
[kernel] Accepting messages on: telegram
```

---

## Service Registration & Conflict Resolution

### Registration rules

```typescript
// Plugin registers a service during setup()
ctx.registerService('security', {
  checkAccess(userId: string): Promise<boolean> { ... },
  getUserRole(userId: string): Promise<string> { ... }
})
```

**Rule 1: One service per name.** If two plugins try to register the same service name, the behavior depends on plugin type:

| Scenario | Behavior |
|----------|----------|
| Two built-in plugins register same name | **Startup error** — this is a bug in Viben, fix it |
| Community plugin registers name already taken by built-in | **Error** unless plugin declares `overrides` |
| Community plugin with `overrides` declaration | Built-in is skipped, community plugin takes over |
| Two community plugins register same name | **Startup error** — user must choose one |

**Rule 2: Override declaration.**

```typescript
// Community plugin that replaces built-in security
{
  name: '@company/plugin-custom-security',
  version: '1.0.0',
  overrides: '@viben/plugin-security',  // explicit declaration
  permissions: ['services:register'],

  async setup(ctx) {
    ctx.registerService('security', {
      // custom implementation
    })
  }
}
```

When a plugin declares `overrides`, the kernel:
1. Loads the overriding plugin instead of the overridden one
2. The overridden plugin's `setup()` is never called
3. Log: "Plugin @company/plugin-custom-security overrides @viben/plugin-security"

**Rule 3: Service interface compliance.** The kernel does NOT enforce service interfaces at runtime (TypeScript types are erased). This means a community override could register an incomplete implementation. Mitigation:
- Built-in plugins serve as reference implementation
- Plugin SDK provides interface types for TypeScript users
- Runtime failures are caught by error isolation (try/catch per call)

### Service lookup semantics

```typescript
// Required dependency — guaranteed to exist after setup()
const security = ctx.getService<SecurityService>('security')
// security is never undefined here because pluginDependencies guarantees it

// Optional dependency — may not exist
const speech = ctx.getService<SpeechService>('speech')
if (speech) {
  // speech plugin is installed and active
}

// Unknown service — always returns undefined
const foo = ctx.getService('nonexistent')
// foo === undefined
```

---

## Built-in vs Community Plugins

### Built-in plugins

Ships with Viben source code. Loaded from `src/plugins/`:

```typescript
// Kernel loads built-in plugins directly
import securityPlugin from './plugins/built-in/security/index.js'
import fileServicePlugin from './plugins/built-in/file-service/index.js'
// ...

const builtInPlugins = [
  securityPlugin,
  fileServicePlugin,
  notificationsPlugin,
  usagePlugin,
  speechPlugin,
  contextPlugin,
  tunnelPlugin,
  apiServerPlugin,
  telegramPlugin,
  discordPlugin,
  slackPlugin,
]
```

**Properties:**
- Always available — no install step
- Trusted — no permission consent prompt, no checksum verification
- Same repo — updated together with kernel, never version-mismatched
- Can use optimized fast paths (kernel can skip overhead for trusted plugins)
- Serve as **reference implementations** for community plugin authors

### Community plugins

Installed via `viben plugin add`, stored in `~/.viben/plugins/`:

```
~/.viben/plugins/
  ├── package.json
  ├── node_modules/
  │   └── @community/plugin-auto-approve/
  │       ├── package.json
  │       └── dist/index.js
  ├── data/
  │   └── auto-approve/
  │       └── storage.json
  └── checksums.json
```

**Properties:**
- Must be installed explicitly
- Permission consent required at install time (see Security Model section)
- Checksum verified at startup
- Error-isolated (see Error Isolation section)
- Can override built-in plugins (with explicit declaration)

### How built-in plugins are disabled

User can disable a built-in plugin in config:

```json
{
  "plugins": [
    { "package": "@viben/plugin-speech", "enabled": false }
  ]
}
```

When disabled:
- Plugin's `setup()` is never called
- Service is not registered
- Other plugins that optionally depend on it gracefully degrade
- Other plugins that require it → skip with error

---

## Concrete Plugin Examples

### Example 1: Security plugin (built-in)

```typescript
import type { VibenPlugin, PluginContext } from '@viben/kernel'

const securityPlugin: VibenPlugin = {
  name: '@viben/plugin-security',
  version: '1.0.0',
  description: 'User access control, rate limiting, session concurrency limits',
  pluginDependencies: {},
  permissions: ['events:read', 'services:register'],

  async setup(ctx: PluginContext) {
    const config = ctx.pluginConfig as SecurityConfig
    const allowedUsers = new Set(config.allowedUserIds ?? [])
    const maxSessions = config.maxConcurrentSessions ?? 5

    const activeSessions = new Map<string, number>() // userId → count

    // Track session lifecycle for concurrency limits
    ctx.on('session:created', ({ sessionId, userId }) => {
      const count = activeSessions.get(userId) ?? 0
      activeSessions.set(userId, count + 1)
    })

    ctx.on('session:ended', ({ sessionId, userId }) => {
      const count = activeSessions.get(userId) ?? 1
      activeSessions.set(userId, Math.max(0, count - 1))
    })

    // Register security service
    ctx.registerService('security', {
      async checkAccess(userId: string): Promise<{ allowed: boolean; reason?: string }> {
        // No allowlist = allow everyone
        if (allowedUsers.size === 0) return { allowed: true }
        if (!allowedUsers.has(userId)) {
          return { allowed: false, reason: 'User not in allowed list' }
        }
        return { allowed: true }
      },

      async checkSessionLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
        const count = activeSessions.get(userId) ?? 0
        if (count >= maxSessions) {
          return { allowed: false, reason: `Session limit reached (${maxSessions})` }
        }
        return { allowed: true }
      },

      async getUserRole(userId: string): Promise<'admin' | 'user' | 'blocked'> {
        if (!allowedUsers.has(userId) && allowedUsers.size > 0) return 'blocked'
        if (config.adminUserIds?.includes(userId)) return 'admin'
        return 'user'
      }
    })

    ctx.log.info(`Security initialized: ${allowedUsers.size} allowed users, max ${maxSessions} sessions`)
  },

  async teardown() {
    // Nothing to clean up
  }
}

export default securityPlugin
```

### Example 2: Telegram adapter plugin (built-in)

```typescript
import type { VibenPlugin, PluginContext } from '@viben/kernel'

const telegramPlugin: VibenPlugin = {
  name: '@viben/plugin-telegram',
  version: '1.0.0',
  description: 'Telegram adapter using grammY with forum topics',
  pluginDependencies: {
    '@viben/plugin-security': '^1.0.0',
    '@viben/plugin-notifications': '^1.0.0',
  },
  optionalPluginDependencies: {
    '@viben/plugin-speech': '^1.0.0',
  },
  permissions: ['events:read', 'services:register', 'services:use', 'commands:register'],

  async setup(ctx: PluginContext) {
    const config = ctx.pluginConfig as TelegramConfig
    const security = ctx.getService<SecurityService>('security')!    // required — guaranteed
    const speech = ctx.getService<SpeechService>('speech')            // optional — may be undefined

    const bot = new Bot(config.botToken)

    // Check access on every message
    bot.on('message:text', async (botCtx) => {
      const userId = String(botCtx.from.id)
      const access = await security.checkAccess(userId)
      if (!access.allowed) {
        await botCtx.reply(`Access denied: ${access.reason}`)
        return
      }

      // Route to session...
    })

    // Voice messages — only if speech plugin is available
    if (speech) {
      bot.on('message:voice', async (botCtx) => {
        const audio = await botCtx.getFile()
        const text = await speech.speechToText(audio)
        // Route transcribed text to session...
      })
    }

    // Listen for outgoing messages from kernel
    ctx.on('agent:event', async ({ sessionId, event }) => {
      // Format and send to Telegram topic...
    })

    // Register adapter service
    ctx.registerService('adapter:telegram', {
      sendMessage: async (sessionId, content) => { /* ... */ },
      createTopic: async (sessionId, name) => { /* ... */ },
      // ...
    })

    await bot.start()
    ctx.log.info('Telegram adapter connected')
  },

  async teardown() {
    await this.bot?.stop()
  }
}

export default telegramPlugin
```

### Example 3: Auto-approve plugin (community)

```typescript
import type { VibenPlugin } from '@viben/kernel'

export default {
  name: '@community/plugin-auto-approve',
  version: '1.0.0',
  description: 'Auto-approve read operations, require manual approval for writes',
  pluginDependencies: {
    '@viben/plugin-security': '^1.0.0'
  },
  permissions: ['events:read', 'services:use', 'commands:register', 'storage:write'],

  async setup(ctx) {
    const security = ctx.getService<SecurityService>('security')!
    const rules = await ctx.storage.get<ApproveRules>('rules') ?? {
      approveReads: true,
      approveSearches: true,
      approveWritesForAdmins: false,
    }

    ctx.on('permission:request', async ({ sessionId, request }) => {
      const userRole = await security.getUserRole(request.userId)

      let autoApprove = false

      if (rules.approveReads && request.kind === 'read') {
        autoApprove = true
      }
      if (rules.approveSearches && request.kind === 'search') {
        autoApprove = true
      }
      if (rules.approveWritesForAdmins && userRole === 'admin' && request.kind === 'write') {
        autoApprove = true
      }

      if (autoApprove) {
        ctx.kernel.resolvePermission(sessionId, request.id, 'allow-once')
        ctx.log.debug(`Auto-approved ${request.kind} for ${request.userId}`)
      }
    })

    ctx.registerCommand({
      name: 'autoapprove',
      description: 'Configure auto-approve rules',
      usage: '<on|off|status|config>',
      async handler({ raw, reply }) {
        const arg = raw.trim().toLowerCase()

        if (arg === 'status') {
          const lines = Object.entries(rules)
            .map(([k, v]) => `  ${k}: ${v ? 'on' : 'off'}`)
            .join('\n')
          await reply(`Auto-approve rules:\n${lines}`)
          return
        }

        if (arg === 'off') {
          rules.approveReads = false
          rules.approveSearches = false
          rules.approveWritesForAdmins = false
          await ctx.storage.set('rules', rules)
          await reply('Auto-approve disabled for all operations')
          return
        }

        if (arg === 'on') {
          rules.approveReads = true
          rules.approveSearches = true
          await ctx.storage.set('rules', rules)
          await reply('Auto-approve enabled for reads and searches')
          return
        }

        await reply('Usage: /autoapprove <on|off|status>')
      }
    })
  }
} satisfies VibenPlugin
```

### Example 4: Message translation plugin (community)

Shows middleware usage and optional dependency on speech:

```typescript
import type { VibenPlugin } from '@viben/kernel'

export default {
  name: '@community/plugin-translate',
  version: '1.0.0',
  description: 'Real-time message translation between user and agent',
  pluginDependencies: {},
  optionalPluginDependencies: {
    '@viben/plugin-speech': '^1.0.0'  // translate voice messages too
  },
  permissions: ['events:read', 'commands:register', 'middleware:register', 'storage:write'],

  async setup(ctx) {
    const speech = ctx.getService<SpeechService>('speech')  // optional

    // Per-session translation settings
    // key: sessionId, value: { from: 'vi', to: 'en' }
    const sessionLangs = new Map<string, { from: string; to: string }>()

    // Middleware: translate user prompt before sending to agent
    ctx.registerMiddleware('before:prompt', async (sessionId, text, attachments) => {
      const langs = sessionLangs.get(sessionId)
      if (!langs) return { text, attachments }

      const translated = await translateText(text, langs.from, langs.to)
      return { text: translated, attachments }
    })

    // Middleware: translate agent response before sending to user
    ctx.registerMiddleware('after:response', async (sessionId, message) => {
      const langs = sessionLangs.get(sessionId)
      if (!langs || message.type !== 'text') return message

      const translated = await translateText(message.text, langs.to, langs.from)
      return { ...message, text: translated }
    })

    // Clean up when session ends
    ctx.on('session:ended', ({ sessionId }) => {
      sessionLangs.delete(sessionId)
    })

    ctx.registerCommand({
      name: 'translate',
      description: 'Enable translation for this session',
      usage: '<from-lang> <to-lang> | off',
      async handler({ sessionId, raw, reply }) {
        if (!sessionId) {
          await reply('This command must be used in a session')
          return
        }

        if (raw.trim() === 'off') {
          sessionLangs.delete(sessionId)
          await reply('Translation disabled')
          return
        }

        const [from, to] = raw.trim().split(/\s+/)
        if (!from || !to) {
          await reply('Usage: /translate vi en')
          return
        }

        sessionLangs.set(sessionId, { from, to })
        await reply(`Translating: ${from} ↔ ${to}`)
      }
    })
  }
} satisfies VibenPlugin
```

---

## Edge Cases & Failure Scenarios

### Edge Case 1: Plugin setup() fails

```
Scenario: Speech plugin's setup() throws because Groq API key is invalid.

Kernel behavior:
1. Catch error, log: "Plugin @viben/plugin-speech setup failed: Invalid API key"
2. Mark plugin as 'failed'
3. Service 'speech' is never registered
4. Continue loading other plugins
5. Telegram adapter (optional dep on speech) → boots normally, voice features disabled
6. If any plugin has REQUIRED dep on speech → that plugin also skipped
```

**Cascading failure:**
```
speech fails → speech-dependent plugin A also skipped →
plugin B depends on A → plugin B also skipped → ...

Kernel logs the full cascade:
  "Skipping @viben/plugin-telegram-voice: required dependency @viben/plugin-speech failed"
```

### Edge Case 2: Plugin teardown() hangs

```
Scenario: Telegram adapter teardown() hangs because Telegram API is unreachable.

Kernel behavior:
1. Call teardown() with 10-second timeout
2. After 10 seconds: "Plugin @viben/plugin-telegram teardown timed out (10s), forcing continue"
3. Move to next plugin's teardown
4. After all plugins done, kernel force-kills remaining resources

No plugin can block shutdown indefinitely.
```

### Edge Case 3: Plugin event handler throws repeatedly

```
Scenario: Community plugin has bug, throws on every 'agent:event'.

Kernel behavior (error budget):
1. First few errors: catch, log, continue
2. After 10 errors in 60 seconds:
   "Plugin @community/plugin-buggy auto-disabled due to repeated errors"
3. Plugin's event listeners are removed
4. Plugin's services remain registered (other plugins may depend on them)
   but service calls will also be wrapped in try/catch
5. Plugin can be re-enabled with: viben plugin enable @community/plugin-buggy
```

### Edge Case 4: Two community plugins register same service

```
Scenario:
  @community/plugin-security-v1 registers service 'security'
  @community/plugin-security-v2 registers service 'security'
  Neither declares 'overrides'

Kernel behavior:
1. First plugin (by config order) registers 'security' successfully
2. Second plugin calls registerService('security', ...)
   → Error: "Service 'security' already registered by @community/plugin-security-v1"
3. Second plugin's setup() receives the error
4. If second plugin doesn't handle it → setup fails → plugin skipped

Resolution for user:
- Remove one of the two plugins
- Or: move preferred plugin first in config array and have the other declare 'overrides'
```

### Edge Case 5: Community plugin overrides built-in with incomplete implementation

```
Scenario:
  @company/custom-security overrides @viben/plugin-security
  But custom-security only implements checkAccess(), not getUserRole()

Runtime behavior:
1. Telegram adapter calls security.getUserRole(userId)
2. getUserRole is undefined → TypeError
3. Error caught by service call wrapper:
   "Service 'security' method 'getUserRole' is not a function
    (provided by @company/custom-security, overriding @viben/plugin-security)"
4. Caller handles error gracefully (adapter-specific fallback)

Prevention:
- Plugin SDK exports interface types → TypeScript catches at compile time
- Built-in plugin serves as reference → community authors know what to implement
```

### Edge Case 6: Plugin dependency installed but wrong version

```
Scenario:
  Plugin A requires '@viben/plugin-file-service' ^1.0.0
  Installed file-service is 2.0.0 (breaking changes)

Startup behavior:
1. Version check: "^1.0.0 does not match 2.0.0"
2. Warning logged (not error — don't block, because it might work)
3. Plugin A's setup() is called
4. If A uses removed API from v1 → setup() fails → A is skipped
5. If A only uses APIs that still exist in v2 → works fine

This is the npm peerDependencies approach — warn, don't block.
```

### Edge Case 7: Circular optional dependencies

```
Scenario:
  Plugin A optionally depends on Plugin B
  Plugin B optionally depends on Plugin A

Behavior:
  Optional dependencies are NOT included in topo-sort.
  Only required dependencies affect load order.

  Kernel loads A first (or B, based on config order).
  When A does getService('B') → undefined (B not loaded yet).
  When B loads, B does getService('A') → found (A already loaded).

  This asymmetry is expected with optional deps. Plugin authors
  must handle getService() returning undefined for optional deps.
```

### Edge Case 8: Plugin modifies shared state via Tier 3 access

```
Scenario:
  Community plugin with 'core:access' permission does:
    ctx.kernel.sessionManager.destroyAll()

Behavior:
  This is valid — Tier 3 grants full access. This is by design.
  The permission consent at install time warns the user:

  "⚠️ WARNING: This plugin requests Tier 3 access (core:access).
   It can access all core services including session management."

Prevention:
  - Don't install plugins with core:access unless you trust them
  - Permission consent + trust levels handle this at install time
  - Future: audit logging for Tier 3 calls
```

### Edge Case 9: Hot-reload (future) — plugin update while sessions active

```
Scenario (future feature, not in v1):
  User runs: viben plugin update @viben/plugin-speech
  While 3 sessions are actively using speech service.

Expected behavior:
  1. Old speech plugin teardown() is called
  2. Active speech calls in-flight complete or timeout
  3. New speech plugin is loaded and setup() called
  4. Service 'speech' is re-registered with new implementation
  5. Next speech call uses new plugin

Risk:
  - In-flight calls may fail during transition window
  - State in old plugin is lost (unless migrated via storage)

v1 approach: Don't support hot-reload. Restart to update plugins.
```

### Edge Case 10: Built-in plugin disabled but required by community plugin

```
Scenario:
  User disables @viben/plugin-security in config
  Community plugin @community/auto-approve requires security

Startup behavior:
  1. Kernel sees security is disabled → skip it
  2. Service 'security' is never registered
  3. auto-approve requires security → dependency check fails
  4. "Skipping @community/plugin-auto-approve: required dependency
      @viben/plugin-security is disabled"
  5. System boots without both plugins

User fix:
  - Re-enable security plugin
  - Or remove auto-approve plugin
```

---

## Pros & Cons Summary

### Pros

| Benefit | Detail |
|---------|--------|
| **Community extensibility** | Anyone can build features without core PRs. Auto-approve, translation, custom adapters, conversation logging — all possible as plugins. |
| **Replaceable components** | Don't like built-in security? Write your own. Want S3 file storage instead of local? Plugin. Corporate SSO? Plugin. |
| **Clear boundaries** | Each plugin is self-contained. Understand speech by reading one plugin directory, not tracing through 5 core files. |
| **Independent updates** | Update speech plugin without updating all of Viben. Rollback one plugin without rollback everything. |
| **Testing isolation** | Test each plugin independently. Mock kernel + services for unit tests. No more testing the entire monolith for a speech change. |
| **Onboarding** | New contributor wants to add a feature → write a plugin. Don't need to understand entire core codebase. |
| **Configuration flexibility** | Disable unused features (speech, tunnel, api-server) to reduce attack surface and resource usage. |
| **Forced clean architecture** | Plugin boundaries force clean interfaces. No more "just import this internal class" shortcuts. |

### Cons

| Drawback | Detail | Mitigation |
|----------|--------|------------|
| **Contract stability pressure** | Kernel API changes break community plugins. Must semver carefully. | Built-in plugins as canary — if they work after API change, community plugins likely work too. Deprecation warnings before removal. |
| **Debug complexity** | Stack traces cross plugin boundaries, go through EventBus, ServiceRegistry. Harder to follow than monolith. | Structured logging per plugin, event tracing, correlation IDs per request. |
| **Performance overhead** | EventBus broadcast + try/catch per handler + service lookup. More hops per message. | Negligible for Viben's message-rate workload. Benchmark streaming path. Fast path for built-in plugins. |
| **Startup time** | More plugins to load, dependency graph to resolve. ~2-3x slower than monolith. | Still under 5 seconds. Built-in loaded from source (fast). Parallel setup for independent plugins (future). |
| **Learning curve** | Plugin authors need to understand: PluginContext API, service registration, dependency declaration, permissions. | Good documentation, example plugins, plugin SDK with TypeScript types, `viben plugin create` scaffolding tool. |
| **Initial development cost** | Significant refactor: kernel extraction, plugin interface, built-in plugin migration, testing. | Doesn't block current work (Phase 1, Phase 2). Can be done incrementally. |
| **Over-engineering risk** | For a project with 1-2 maintainers, full microkernel may be premature. All "plugins" are maintained by same team initially. | Built-in plugins reduce this — day-to-day development feels similar to monolith. Architecture pays off when community grows. |
| **Implicit coupling through services** | Plugin A calls `getService('security').checkAccess()` — this is coupling, just not import-level. Change security's API → break A at runtime, not compile time. | TypeScript interfaces in plugin SDK catch at compile time. Runtime errors caught by error isolation. |
| **State management complexity** | Each plugin has isolated storage. Cross-plugin state queries require going through services or events. No shared database. | By design — isolation prevents plugins from depending on each other's internal state. Services expose what's needed. |
| **Versioning matrix** | With independent plugin versions, need to track compatibility: kernel v3 + security v1.2 + speech v2.0 — does this combination work? | Semver ranges in pluginDependencies. CI matrix testing for official plugins. Community plugins declare which kernel version they support. |

---

## Security Model

### Permission System

Every plugin declares the permissions it requires. PluginContext is constructed based on declared permissions — undeclared APIs are not available (not just warned, but absent from the context object).

```typescript
type PluginPermission =
  // Tier 1 — read-only, low risk
  | 'events:read'           // Listen to system events
  | 'sessions:list'         // List active sessions (metadata only)

  // Tier 2 — side effects, medium risk
  | 'commands:register'     // Add slash commands to adapters
  | 'middleware:register'   // Intercept and modify prompts/responses
  | 'storage:write'         // Read/write plugin-scoped storage
  | 'messages:send'         // Send messages to session topics
  | 'services:register'     // Register a service in the registry
  | 'services:use'          // Lookup and call other plugin services

  // Tier 3 — full access, high risk
  | 'core:access'           // Direct access to Kernel, SessionManager, etc.
  | 'config:read'           // Read Viben configuration (may contain tokens)
  | 'adapter:create'        // Act as a channel adapter
```

### Permission enforcement

```typescript
function createPluginContext(plugin: VibenPlugin, services: KernelServices): PluginContext {
  const permissions = new Set(plugin.permissions)
  const ctx: PluginContext = {
    pluginName: plugin.name,
    log: createPluginLogger(plugin.name),
    pluginConfig: getPluginConfig(plugin.name),
  }

  // Tier 1
  if (permissions.has('events:read')) {
    ctx.on = (event, handler) => eventBus.on(event, wrapHandler(plugin.name, handler))
    ctx.off = (event, handler) => eventBus.off(event, handler)
  }
  if (permissions.has('sessions:list')) {
    ctx.sessions = { getActiveSessions: () => sessionManager.getActiveSessions() }
  }

  // Tier 2
  if (permissions.has('commands:register')) {
    ctx.registerCommand = (def) => commandRegistry.register(plugin.name, def)
  }
  if (permissions.has('middleware:register')) {
    ctx.registerMiddleware = (hook, fn) => middlewareRegistry.register(plugin.name, hook, fn)
  }
  if (permissions.has('storage:write')) {
    ctx.storage = createPluginStorage(plugin.name)
  }
  if (permissions.has('messages:send')) {
    ctx.sendMessage = (sessionId, content) => bridge.sendMessage(sessionId, content)
  }
  if (permissions.has('services:register')) {
    ctx.registerService = (name, impl) => serviceRegistry.register(plugin.name, name, impl)
  }
  if (permissions.has('services:use')) {
    ctx.getService = (name) => serviceRegistry.get(name)
  }

  // Tier 3
  if (permissions.has('core:access')) {
    ctx.kernel = services.kernel
    ctx.eventBus = services.eventBus
  }
  if (permissions.has('config:read')) {
    ctx.config = services.config  // read-only proxy
  }

  return ctx
}
```

If a plugin accesses an API it didn't declare (e.g., `ctx.kernel` without `core:access`), the property is `undefined` — standard JavaScript behavior. Plugin authors will see the issue during development.

**Built-in plugins** skip permission enforcement entirely — they are trusted and always receive a full PluginContext.

### Installation consent & audit

When installing a community plugin, `viben plugin add` displays a permission audit:

```
$ viben plugin add @community/plugin-auto-approve

📦 @community/plugin-auto-approve v1.2.0
   Auto-approve read operations for agents

   Required dependencies:
   ✅ @viben/plugin-security (already installed)

   Requested permissions:
   ✅ events:read          — Listen to system events
   ✅ commands:register    — Add /autoapprove command
   ✅ services:use         — Call security service
   ⚠️  core:access          — Full access to kernel services

   ⚠️  WARNING: This plugin requests Tier 3 access (core:access).
   It can read bot tokens, session data, and access all core services.
   Only install plugins you trust.

   Publisher: @community (unverified)

   Install? [y/N]
```

For low-risk plugins:

```
$ viben plugin add @viben/plugin-conversation-log

📦 @viben/plugin-conversation-log v1.0.0
   Record all conversation events per session

   Requested permissions:
   ✅ events:read          — Listen to system events
   ✅ storage:write        — Store conversation logs
   ✅ commands:register    — Add /history command

   Publisher: @viben (official ✓)

   Install? [Y/n]
```

### Trusted publishers

| Scope | Trust Level | Install Behavior |
|-------|-------------|------------------|
| `@viben/*` | Official | Auto-trusted, default Y |
| Verified community | Verified | Show permissions, default Y for Tier 1-2 |
| Everything else | Unverified | Show permissions + warning, default N |

### Checksum verification

Protect against supply chain attacks:

```
~/.viben/plugins/checksums.json
{
  "@community/plugin-auto-approve@1.2.0": {
    "sha256": "a1b2c3d4...",
    "verifiedAt": "2026-03-25T10:00:00Z",
    "source": "npm"
  }
}
```

**On install:** Download package → compute SHA-256 → store in checksums.json.

**On startup:** Recompute hash → compare with stored checksum → mismatch = refuse to load:
```
❌ Plugin @community/plugin-auto-approve checksum mismatch!
   Expected: a1b2c3d4...
   Got:      e5f6g7h8...
   The plugin may have been tampered with. Reinstall with:
   viben plugin add @community/plugin-auto-approve --force
```

### Runtime guardrails

**A) Storage isolation:**
- Plugins can only write to `~/.viben/plugins/data/<plugin-name>/`
- PluginStorage enforces path prefix — no path traversal via `../../`
- Storage size limit per plugin (default 50MB, configurable)

**B) Command namespace isolation:**
- Plugin commands are prefixed internally: `plugin:<name>:<command>`
- If two plugins register the same command name → conflict detected at startup → error logged, first-registered wins
- Built-in commands always take precedence over plugin commands

**C) Middleware execution timeout:**
```typescript
// Middleware must complete within 5 seconds
const result = await Promise.race([
  middleware.handler(data),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Middleware timeout')), 5000)
  )
])
```

**D) Error budget:**
- If a plugin's event handler throws more than 10 errors in 60 seconds → auto-disable plugin
- Log: "Plugin X disabled due to repeated errors. Re-enable with: viben plugin enable X"
- Prevents a buggy plugin from flooding logs or degrading performance

### Plugin audit command

```bash
$ viben plugin audit

Plugin Security Audit
━━━━━━━━━━━━━━━━━━━━

@viben/plugin-security v1.0.0 (built-in)
  Permissions: events:read, services:register
  Tier: 2 (medium risk)
  Errors (24h): 0

@community/plugin-auto-approve v1.2.0
  Publisher: @community (unverified)
  Permissions: events:read, commands:register, core:access
  Tier: 3 (HIGH RISK) ⚠️
  Checksum: ✅ verified
  Errors (24h): 2

unknown-plugin v0.1.0
  Publisher: unknown (unverified) ⚠️
  Permissions: events:read, core:access, config:read
  Tier: 3 (HIGH RISK) ⚠️
  Checksum: ❌ MISMATCH — plugin may be tampered!
  Errors (24h): 47 — AUTO-DISABLED
```

---

## Error Isolation

Plugins run in the same process (no sandboxing) but with error boundaries at every interaction point:

```typescript
// Plugin setup — wrapped in try/catch
try {
  await plugin.setup(ctx)
} catch (err) {
  log.error({ plugin: plugin.name, err }, 'Plugin setup failed, skipping')
  disabledPlugins.add(plugin.name)
}

// Event handlers — wrapped individually
function wrapHandler(pluginName: string, handler: Function) {
  return async (...args: unknown[]) => {
    try {
      await handler(...args)
    } catch (err) {
      log.error({ plugin: pluginName, err }, 'Plugin event handler error')
      errorBudget.record(pluginName)
      if (errorBudget.exceeded(pluginName)) {
        disablePlugin(pluginName)
      }
    }
  }
}

// Service calls — wrapped
function wrapServiceCall(pluginName: string, method: Function) {
  return async (...args: unknown[]) => {
    try {
      return await method(...args)
    } catch (err) {
      log.error({ plugin: pluginName, err }, 'Service call error')
      throw err  // re-throw — caller decides how to handle
    }
  }
}

// Commands — wrapped
async function executeCommand(cmd: CommandDef, args: CommandArgs) {
  try {
    await cmd.handler(args)
  } catch (err) {
    await args.reply(`Plugin error: ${err.message}`)
  }
}

// Middleware — wrapped with timeout
async function runMiddleware(hook: string, data: unknown) {
  for (const mw of middlewareRegistry.get(hook)) {
    try {
      const result = await Promise.race([
        mw.handler(data),
        timeout(5000, `Middleware ${mw.pluginName}:${hook} timed out`)
      ])
      if (result === null) return null  // suppress
      data = result
    } catch (err) {
      log.error({ plugin: mw.pluginName, err }, 'Middleware error, skipping')
      // Continue with unmodified data
    }
  }
  return data
}
```

---

## Command Registration & Adapter Integration

When a plugin registers a command via `ctx.registerCommand()`, it needs to appear in all active adapters:

### How it works

```typescript
// Plugin registers during setup()
ctx.registerCommand({
  name: 'context',
  description: 'Import context from another session',
  usage: '<session-number>',
  handler: async (args) => { /* ... */ }
})

// Kernel collects all registered commands from all plugins
// After all plugins setup() completes, passes commands to each adapter
// Each adapter maps CommandDef to platform-specific registration
```

### Platform-specific behavior

| Platform | Registration | Invocation |
|----------|-------------|------------|
| **Telegram** | `bot.api.setMyCommands()` — appears in bot menu | User types `/context 5` |
| **Discord** | Registered as slash commands via Discord API | User types `/context 5` |
| **Slack** | Registered as slash commands via Slack API | User types `/context 5` |

### Adapter integration

Adapter plugins implement command registration:

```typescript
// In adapter plugin setup()
ctx.on('system:commands-ready', async ({ commands }) => {
  // Register commands with platform
  await bot.api.setMyCommands(
    commands.map(cmd => ({
      command: cmd.name,
      description: cmd.description
    }))
  )

  // Set up handler routing
  for (const cmd of commands) {
    bot.command(cmd.name, async (botCtx) => {
      await cmd.handler({
        raw: botCtx.match,
        sessionId: resolveSessionId(botCtx),
        channelId: 'telegram',
        userId: String(botCtx.from.id),
        reply: (content) => sendToTopic(botCtx, content)
      })
    })
  }
})
```

---

## Middleware Hooks

Middleware allows plugins to intercept and modify data at specific points in the message flow:

| Hook | Signature | Description |
|------|-----------|-------------|
| `before:prompt` | `(sessionId, text, attachments?) => { text, attachments? } \| null` | Modify prompt before sending to agent. Return null to suppress. |
| `after:response` | `(sessionId, message: OutgoingMessage) => OutgoingMessage \| null` | Modify outgoing message before adapter sends. Return null to suppress. |
| `before:session` | `(params: SessionCreateParams) => SessionCreateParams \| null` | Modify session creation params. Return null to reject session creation. |

Middleware runs in registration order. Multiple plugins can register middleware for the same hook — they form a pipeline:

```
User prompt: "Hello"
  → translate plugin (before:prompt): "Hello" → "Xin chào"
  → logging plugin (before:prompt): logs "Xin chào", passes through
  → agent receives: "Xin chào"

Agent response: "Tôi có thể giúp gì?"
  → translate plugin (after:response): "Tôi có thể giúp gì?" → "How can I help?"
  → logging plugin (after:response): logs, passes through
  → user receives: "How can I help?"
```

---

## Plugin Storage

Each plugin gets isolated persistent storage:

```
~/.viben/plugins/
  ├── package.json              # npm dependencies (community plugins)
  ├── node_modules/             # installed packages
  ├── checksums.json            # checksum verification
  └── data/
      ├── context-bridge/
      │   └── storage.json      # plugin-scoped data
      ├── conversation-log/
      │   └── storage.json
      └── auto-approve/
          └── storage.json
```

Built-in plugins also use `~/.viben/plugins/data/<plugin-name>/` for consistency.

### Storage API

```typescript
interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
  entries<T>(): Promise<[string, T][]>
}
```

Implementation: JSON file with debounced writes (same pattern as existing SessionStore). Simple key-value for v1, can evolve to SQLite later if needed.

---

## CLI Commands

### New commands

```bash
viben plugin add <package>       # Install plugin from npm (with dependency resolution)
viben plugin remove <package>    # Uninstall plugin (check for dependents first)
viben plugin list                # Show all plugins with status, type, permissions
viben plugin enable <name>       # Enable a disabled plugin
viben plugin disable <name>      # Disable a plugin without uninstalling
viben plugin audit               # Security overview of all plugins
viben plugin update <name>       # Update plugin to latest version
```

### What `viben plugin add` does

1. Fetch package from npm
2. Read `pluginDependencies` → auto-install missing dependencies recursively
3. Show permission audit + install consent prompt
4. `npm install <package>` in `~/.viben/plugins/`
5. Compute and store SHA-256 checksum
6. Add entry to `~/.viben/config.json` plugins array
7. Log: "Plugin installed. Restart Viben to activate."

### What `viben plugin remove` does

1. Check if other plugins depend on this one
2. If dependents exist → warn: "Plugin X is required by Y, Z. Remove anyway? [y/N]"
3. `npm uninstall <package>` from `~/.viben/plugins/`
4. Remove from config.json plugins array
5. Remove plugin data from `~/.viben/plugins/data/<name>/` (prompt: "Delete plugin data? [y/N]")
6. Remove checksum entry

---

## Backward Compatibility

### v1 plugins (AdapterFactory) continue to work

```typescript
// v1 plugin — still works
export const adapterFactory = {
  name: 'my-adapter',
  createAdapter(core, config) {
    return new MyAdapter(core, config)
  }
}
```

When detected:
1. Wrapped into a minimal VibenPlugin shell automatically
2. Deprecation warning logged: "Plugin 'my-adapter' uses legacy AdapterFactory format. Please migrate to VibenPlugin interface."
3. `createAdapter()` called normally within the wrapper's setup()

### v1 CLI commands still work

| v1 Command | Behavior | Note |
|------------|----------|------|
| `viben install <pkg>` | Works, delegates to `viben plugin add` | Logs deprecation |
| `viben uninstall <pkg>` | Works, delegates to `viben plugin remove` | Logs deprecation |
| `viben plugins` | Works, delegates to `viben plugin list` | Logs deprecation |

### Config backward compat

Old config format (channels with `adapter` field):
```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "adapter": "@viben/adapter-whatsapp"
    }
  }
}
```

Still works. Kernel checks `channels.*.adapter` for v1 plugins and auto-migrates them to the `plugins[]` array format internally. No user action required.

---

## Implementation Roadmap

This proposal supersedes PR #63. Implementation is split into focused PRs:

```
Phase 1: Adapter layer refactor (in progress, separate branch)
  │
  ▼
Phase 2: ACP protocol completion (planned, separate branch)
  │
  ▼
Phase 3: Microkernel + Plugin System (this proposal)
  │
  ├── PR 1: Kernel core
  │   - Lifecycle manager, EventBus, Config, ServiceRegistry
  │   - Plugin loader (built-in + community)
  │   - PluginContext factory with permission enforcement
  │   - Plugin types and interfaces
  │   - Dependency graph resolver (topo-sort)
  │
  ├── PR 2: Built-in service plugins
  │   - Migrate SecurityGuard → @viben/plugin-security
  │   - Migrate FileService → @viben/plugin-file-service
  │   - Migrate NotificationManager → @viben/plugin-notifications
  │   - Migrate UsageStore/Budget → @viben/plugin-usage
  │   - Migrate SpeechService → @viben/plugin-speech
  │   - Migrate ContextManager → @viben/plugin-context
  │   - Migrate Tunnel → @viben/plugin-tunnel
  │   - Migrate API server → @viben/plugin-api-server
  │
  ├── PR 3: Adapter plugins
  │   - Migrate TelegramAdapter → @viben/plugin-telegram
  │   - Migrate DiscordAdapter → @viben/adapter-discord
  │   - Migrate SlackAdapter → @viben/plugin-slack
  │   - Command registration + adapter integration
  │   - Middleware pipeline integration
  │
  ├── PR 4: Community plugin support
  │   - CLI commands (plugin add/remove/list/enable/disable/audit/update)
  │   - Permission consent flow
  │   - Checksum verification
  │   - Plugin storage
  │   - v1 backward compatibility wrapper
  │   - Error budget + auto-disable
  │
  └── PR 5: Documentation + SDK
      - Plugin development guide
      - API reference (PluginContext, events, services)
      - Example plugins (starter templates)
      - viben plugin create scaffolding
      - Migration guide from v1 AdapterFactory
```

---

## Open Questions

1. **Should Session and Agent management stay in kernel forever, or eventually become plugins too?** Current decision: keep in kernel. May revisit if use cases emerge that need replacing them.

2. **Plugin config schema validation** — should plugins be able to declare a Zod schema for their config section? This would give users better error messages at startup.

3. **Plugin-to-plugin events** — should plugins be able to emit custom events on the EventBus, or only kernel-defined events? Custom events increase flexibility but reduce discoverability.

4. **Built-in plugin packaging** — should built-in plugins be publishable as separate npm packages too? This would let users pin specific versions of built-in plugins independently from kernel.

5. **Monitoring/observability** — should the kernel provide a standard health check interface that plugins implement? e.g., `healthCheck(): Promise<{ status: 'ok' | 'degraded' | 'error', details: string }>`.

6. **Plugin config hot-reload** — should plugin config changes trigger plugin re-setup without full restart? Or is restart-required acceptable for v1?

---

## Out of Scope (v1)

- Hot-reload (plugins loaded at startup only, restart to add/remove)
- Plugin marketplace / registry (install from npm directly)
- Full process sandboxing (VM isolation, worker threads) — Node.js limitation
- Plugin-to-plugin direct communication channel (use EventBus + Service lookup)
- Plugin signing with cryptographic signatures (use checksum for now)
- Web UI for plugin management (CLI only for v1)

---

## Future Improvements

- **Plugin marketplace**: `viben plugin search <keyword>` — browse community plugins
- **Hot-reload**: Add/remove plugins without restart
- **Plugin config UI**: Web UI or adapter command to configure plugin settings
- **Plugin templates**: `viben plugin create <name>` — scaffold a new plugin project
- **Plugin SDK**: `@viben/plugin-sdk` — utilities, testing helpers, type-safe context
- **Process isolation**: Run untrusted plugins in worker threads or child processes
- **Plugin signing**: Cryptographic signatures from verified publishers
- **Audit logging**: Record all plugin API calls for forensics
- **Plugin dependency graph visualization**: `viben plugin graph` — show dependency tree
