# Phase 2b: Plugin System — Design Spec

**Date:** 2026-03-26
**Scope:** Plugin infrastructure (loader, context, services, middleware, lifecycle) + extraction of built-in modules into plugins
**Depends on:** Phase 1 (adapter refactor) + Phase 2a (folder restructure + ACP core)
**Supersedes:** PR #63 Plugin API v2, microkernel-lifecycle-architecture proposal

---

## Goals

1. **Any feature addable without touching core** — community plugins hook into events, middleware, services
2. **Any built-in replaceable** — `overrides` declaration lets community plugins swap built-in implementations
3. **Clear boundaries** — each module is a self-contained plugin with explicit dependencies
4. **Independent update cycles** — community plugins install/update separately
5. **Full ACP coverage** — 18 middleware hook points cover every ACP interaction
6. **Lifecycle managed** — deterministic boot/shutdown order via dependency graph

## Non-Goals

- Community plugin marketplace/registry (separate project)
- Plugin hot-reload at runtime (restart required)
- Plugin sandboxing/process isolation (same process, error isolation via try/catch)

---

## Section 1: Architecture Overview

```
src/core/                         — Core infrastructure
  plugin/                         — Plugin infrastructure (NEW)
    plugin-loader.ts              — Discover, validate, topo-sort, load
    plugin-context.ts             — PluginContext factory (scoped per plugin)
    service-registry.ts           — Register/lookup services
    middleware-chain.ts           — Middleware pipeline engine
    plugin-storage.ts             — KV store + dataDir per plugin
    error-tracker.ts              — Per-plugin error budget
    lifecycle-manager.ts          — Boot/shutdown orchestration
    types.ts                      — All plugin types + middleware payload types
    __tests__/

src/plugins/                      — Built-in plugins (Part 2)
  security/index.ts
  file-service/index.ts
  notifications/index.ts
  usage/index.ts
  speech/index.ts
  context/index.ts
  tunnel/index.ts
  api-server/index.ts
  telegram/index.ts
  discord/index.ts
  slack/index.ts

~/.viben/plugins/               — Community plugins
  package.json
  node_modules/
  data/{plugin-name}/             — Per-plugin storage
  checksums.json                  — SHA-256 checksums for integrity
```

### What stays in core

| Component | Location | Why |
|-----------|----------|-----|
| EventBus | `core/event-bus.ts` | Communication backbone — must exist before any plugin |
| ConfigManager | `core/config/` | Plugins need config to know if enabled |
| SessionManager | `core/sessions/` | Fundamental — every adapter and plugin interacts with sessions |
| AgentManager | `core/agents/` | ACP subprocess management — tightly coupled with sessions |
| MessageTransformer | `core/message-transformer.ts` | Core pipeline — transforms events to messages |
| Plugin infra | `core/plugin/` | LifecycleManager, PluginLoader, ServiceRegistry, etc. |

### What becomes a plugin

| Current module | Plugin name | Service name | Extraction difficulty |
|---------------|-------------|-------------|----------------------|
| SecurityGuard | `@viben/security` | `security` | Medium |
| FileService | `@viben/file-service` | `file-service` | Medium |
| NotificationManager | `@viben/notifications` | `notifications` | Medium |
| UsageStore + UsageBudget | `@viben/usage` | `usage` | Easy |
| SpeechService + GroqSTT + EdgeTTS | `@viben/speech` | `speech` | Easy |
| ContextManager + EntireProvider | `@viben/context` | `context` | Easy |
| TunnelService + providers | `@viben/tunnel` | `tunnel` | Easy |
| ApiServer | `@viben/api-server` | `api-server` | Easy |
| TelegramAdapter | `@viben/telegram` | `adapter:telegram` | Hard |
| DiscordAdapter | `@viben/discord` | `adapter:discord` | Hard |
| SlackAdapter | `@viben/slack` | `adapter:slack` | Hard |

---

## Section 2: Plugin Interface

```typescript
interface VibenPlugin {
  /** Unique identifier, e.g., '@viben/security' */
  name: string

  /** Semver version */
  version: string

  /** Human-readable description */
  description?: string

  /** Required plugin dependencies — loaded before this plugin's setup() */
  pluginDependencies?: Record<string, string>  // name → semver range

  /** Optional dependencies — used if available, gracefully degrade if not */
  optionalPluginDependencies?: Record<string, string>

  /** Override a built-in plugin (replaces it entirely) */
  overrides?: string

  /** Required permissions — PluginContext enforces these */
  permissions?: PluginPermission[]  // defaults to [] (no capabilities)

  /** Called during startup in dependency order */
  setup(ctx: PluginContext): Promise<void>

  /** Called during shutdown in reverse order. 10s timeout. */
  teardown?(): Promise<void>
}

type PluginPermission =
  | 'events:read'          // ctx.on() — subscribe to events
  | 'events:emit'          // ctx.emit() — emit custom events
  | 'services:register'    // ctx.registerService() — provide a service
  | 'services:use'         // ctx.getService() — consume a service
  | 'middleware:register'  // ctx.registerMiddleware() — intercept flows
  | 'commands:register'    // ctx.registerCommand() — add slash commands
  | 'storage:read'         // ctx.storage.get/list — read storage
  | 'storage:write'        // ctx.storage.set/delete — write storage
  | 'kernel:access'        // ctx.sessions, ctx.config, ctx.eventBus
```

### Edge Cases

- **`permissions` omitted:** Defaults to `[]` — plugin can only run code in `setup()`, no access to any capability.
- **Plugin calls ctx method without permission:** Throws `PluginPermissionError` immediately. Error is caught by error isolation, counted against error budget.
- **`setup()` timeout (30s):** Plugin marked as failed, dependents skipped. Log includes stack trace.
- **`teardown()` timeout (10s):** Log warning, force continue. Plugin resources may leak — acceptable tradeoff for shutdown speed.
- **`overrides` names non-existent plugin:** Warning logged, plugin loads normally (override is no-op).
- **Plugin name contains invalid characters:** Reject at discovery. Names must match `/^[@a-z0-9][a-z0-9._\/-]*$/`.

---

## Section 3: PluginContext

```typescript
interface PluginContext {
  // === Identity ===
  pluginName: string
  pluginConfig: Record<string, unknown>

  // === Tier 1 — Events ===
  /** Subscribe to events. Auto-cleaned on teardown. Requires 'events:read'. */
  on(event: string, handler: (...args: unknown[]) => void): void
  off(event: string, handler: (...args: unknown[]) => void): void
  /** Emit custom events. Event names MUST be prefixed with plugin name. Requires 'events:emit'. */
  emit(event: string, payload: unknown): void

  // === Tier 2 — Actions ===

  /** Register middleware. Requires 'middleware:register'. */
  registerMiddleware<H extends MiddlewareHook>(hook: H, opts: MiddlewareOptions<MiddlewarePayloadMap[H]>): void

  /** Provide a service. Requires 'services:register'. */
  registerService<T>(name: string, implementation: T): void

  /** Consume a service. Requires 'services:use'. */
  getService<T>(name: string): T | undefined

  /** Register slash command. Requires 'commands:register'. */
  registerCommand(def: CommandDef): void

  /** Plugin-scoped storage. Requires 'storage:read' and/or 'storage:write'. */
  storage: PluginStorage

  /** Plugin-scoped logger. Always available (no permission needed). */
  log: Logger

  /**
   * Send message to a session. Requires 'services:use'.
   *
   * Routing: sessionId → lookup session → find adapter for session's channelId
   *          → [HOOK: message:outgoing] → adapter.sendMessage()
   *
   * The message goes through the `message:outgoing` middleware chain,
   * so other plugins (e.g., translation) can modify it before delivery.
   */
  sendMessage(sessionId: string, content: OutgoingMessage): Promise<void>

  // === Tier 3 — Kernel access (requires 'kernel:access') ===
  sessions: SessionManager
  config: ConfigManager
  eventBus: EventBus
}
```

### PluginStorage

```typescript
interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  list(): Promise<string[]>
  getDataDir(): string
}
```

- **Location:** `~/.viben/plugins/data/{plugin-name}/`
- **KV backing:** JSON file at `~/.viben/plugins/data/{plugin-name}/kv.json`
- **Concurrency:** KV writes are serialized per plugin (write lock). Multiple plugins don't share KV files.
- **Size limit:** No enforced limit. Plugin authors should be reasonable.
- **getDataDir():** Creates directory if not exists. Returns absolute path. Plugin can store anything here (SQLite, large files, etc.).

### Edge Cases — PluginContext

- **`emit()` with unprefixed event name:** Throws. Community plugins must prefix events: `@community/my-plugin:custom-event`. Built-in plugins may use short names: `security:blocked`.
- **`registerService()` for already-taken name:** Throws `ServiceConflictError`. Plugin setup fails → dependents skipped.
- **`getService()` for unregistered service:** Returns `undefined`. Plugin must handle gracefully.
- **`registerCommand()` for duplicate name:** Last registration wins. Warning logged.
- **`sendMessage()` for non-existent session:** Silently no-op. Log debug message.
- **Calling any method after teardown:** Throws `PluginTornDownError`. Should not happen in practice (auto-cleanup removes references).

### CommandDef

```typescript
interface CommandDef {
  /** Command name without slash, e.g., 'context' for /context */
  name: string
  /** Short description shown in command list */
  description: string
  /** Usage pattern, e.g., '<session-number>' */
  usage?: string
  /** Handler function */
  handler(args: CommandArgs): Promise<void>
}

interface CommandArgs {
  /** Raw argument string after command name */
  raw: string
  /** Session ID where command was invoked (null if from notification/system topic) */
  sessionId: string | null
  /** Channel ID ('telegram', 'discord', 'slack') */
  channelId: string
  /** User ID who invoked the command */
  userId: string
  /** Reply helper — sends message to the topic where command was invoked */
  reply(content: string | OutgoingMessage): Promise<void>
}
```

---

## Section 4: Middleware System

### 18 Hook Points with Typed Payloads

```typescript
// Payload types for each hook
interface MiddlewarePayloadMap {
  // === Message flow ===
  'message:incoming': {
    channelId: string
    threadId: string
    userId: string
    text: string
    attachments?: Attachment[]
  }
  'message:outgoing': {
    sessionId: string
    message: OutgoingMessage
  }

  // === Agent flow ===
  'agent:beforePrompt': {
    sessionId: string
    text: string
    attachments?: Attachment[]
  }
  'agent:beforeEvent': {
    sessionId: string
    event: AgentEvent
  }
  'agent:afterEvent': {
    sessionId: string
    event: AgentEvent
    outgoingMessage: OutgoingMessage
  }

  // === Turn lifecycle ===
  'turn:start': {
    sessionId: string
    promptText: string
    promptNumber: number
  }
  'turn:end': {
    sessionId: string
    stopReason: StopReason
    durationMs: number
  }

  // === File system ===
  'fs:beforeRead': {
    sessionId: string
    path: string
    line?: number
    limit?: number
  }
  'fs:beforeWrite': {
    sessionId: string
    path: string
    content: string
  }

  // === Terminal ===
  'terminal:beforeCreate': {
    sessionId: string
    command: string
    args?: string[]
    env?: Record<string, string>
    cwd?: string
  }
  'terminal:afterExit': {
    sessionId: string
    terminalId: string
    command: string
    exitCode: number
    durationMs: number
  }

  // === Permission ===
  'permission:beforeRequest': {
    sessionId: string
    request: PermissionRequest
    autoResolve?: string  // set by middleware to auto-resolve with this optionId
  }
  'permission:afterResolve': {
    sessionId: string
    requestId: string
    decision: string     // optionId chosen
    userId: string
    durationMs: number
  }

  // === Session ===
  'session:beforeCreate': {
    agentName: string
    workingDir: string
    userId: string
    channelId: string
    threadId: string
  }
  'session:afterDestroy': {
    sessionId: string
    reason: string
    durationMs: number
    promptCount: number
  }

  // === Control ===
  'mode:beforeChange': {
    sessionId: string
    fromMode: string | undefined
    toMode: string
  }
  'config:beforeChange': {
    sessionId: string
    configId: string
    oldValue: unknown
    newValue: unknown
  }
  'model:beforeChange': {
    sessionId: string
    fromModel: string | undefined
    toModel: string
  }
  'agent:beforeCancel': {
    sessionId: string
    reason?: string
  }
}

type MiddlewareHook = keyof MiddlewarePayloadMap
```

### Modifiable vs Read-Only Hooks

| Hook | Modifiable? | What can be modified | Returning null means |
|------|-------------|---------------------|---------------------|
| `message:incoming` | **Yes** | text, attachments | Block message — don't process |
| `message:outgoing` | **Yes** | message content | Block — don't send to user |
| `agent:beforePrompt` | **Yes** | text, attachments | Block — don't send to agent |
| `agent:beforeEvent` | **Yes** | event content | Block — don't forward to adapter |
| `agent:afterEvent` | **Read-only** | — | — (null ignored) |
| `turn:start` | **Read-only** | — | — |
| `turn:end` | **Read-only** | — | — |
| `fs:beforeRead` | **Yes** | path, line, limit | Block — deny file read |
| `fs:beforeWrite` | **Yes** | path, content | Block — deny file write |
| `terminal:beforeCreate` | **Yes** | command, args, env, cwd | Block — deny process spawn |
| `terminal:afterExit` | **Read-only** | — | — |
| `permission:beforeRequest` | **Yes** | autoResolve field | Set autoResolve to skip UI |
| `permission:afterResolve` | **Read-only** | — | — |
| `session:beforeCreate` | **Yes** | agentName, workingDir | Block — deny session creation |
| `session:afterDestroy` | **Read-only** | — | — |
| `mode:beforeChange` | **Yes** | toMode | Block — deny mode change |
| `model:beforeChange` | **Yes** | toModel | Block — restrict model selection |
| `config:beforeChange` | **Yes** | newValue | Block — deny config change |
| `agent:beforeCancel` | **Yes** | — | Block — deny cancellation |

### Middleware Function Signature

```typescript
type MiddlewareFn<T> = (payload: T, next: () => Promise<T>) => Promise<T | null>

// null = block/skip (don't proceed to next middleware or core handler)
// return next() = pass through unchanged
// return modified payload = transform then continue

interface MiddlewareOptions<T> {
  /** Override execution order within same dependency level. Lower = earlier. */
  priority?: number
  /** The middleware handler */
  handler: MiddlewareFn<T>
}
```

### Execution Order Rules

1. **Base order: topo-sort** — plugins loaded earlier in dependency graph run their middleware first
2. **Priority override** — reorders WITHIN the same dependency level only. **Priority cannot cause a plugin to run before its dependencies.** Example:
   ```
   Plugin A (no deps, priority 10)
   Plugin B (depends on A, priority 0)
   → A's middleware ALWAYS runs before B's, regardless of priority

   Plugin C (no deps, priority 5)
   Plugin D (no deps, priority 20)
   → C runs before D (same level, priority decides)
   ```
3. **Same level + same priority** — registration order (first registered = first executed)

### Middleware Timeout

Each handler has a **5 second timeout**. If handler doesn't return within 5s:
1. Log warning: `"Middleware timeout: {pluginName} on {hook} (5000ms)"`
2. Skip this handler
3. Continue chain with next handler
4. Increment error budget

### `next()` Return Semantics

`next()` invokes the remaining middleware chain (downstream handlers + core handler) and returns the final result:

```typescript
ctx.registerMiddleware('message:outgoing', {
  handler: async (msg, next) => {
    // PRE-processing: modify BEFORE downstream
    msg.message.text = addPrefix(msg.message.text)

    const result = await next()

    // POST-processing: observe AFTER downstream
    logMessage(result)
    return result
  }
})
```

### Error Handling in Middleware

```
Plugin middleware throws
  → 1. Catch error
  → 2. Log: error({ plugin, hook, err }, 'Middleware error')
  → 3. Skip this plugin's handler
  → 4. Pass ORIGINAL (unmodified) payload to next handler
  → 5. Increment error budget for this plugin
  → 6. If budget exceeded → auto-disable plugin (see Section 7)
```

### Edge Cases — Middleware

- **All middleware in chain return null (block):** First null stops the chain. Core handler never runs.
- **Middleware modifies payload to invalid shape:** TypeScript types prevent this at compile time. Runtime: if core handler receives unexpected shape, it logs error and uses fallback behavior.
- **No middleware registered for a hook:** Core handler runs directly with original payload. Zero overhead.
- **Plugin registers middleware for same hook twice:** Both handlers run (in registration order). This is valid (e.g., separate pre/post processing).
- **Middleware calls `next()` multiple times:** Second call is no-op (returns cached result). Chain only executes once.

---

## Section 5: Lifecycle Management

### Boot Sequence (detailed)

```
1. KERNEL BOOT
   │
   ├── Load config from ~/.viben/config.json
   │   └── If missing → run first-time setup wizard → create config
   │
   ├── Init Logger (pino)
   │
   ├── Init EventBus
   │   └── In-memory typed event emitter
   │
   ├── Init ServiceRegistry
   │   └── Empty registry, ready for plugin registrations
   │
   ├── Init MiddlewareChain
   │   └── 18 empty chains, one per hook point
   │
   ├── Init SessionManager
   │   └── Load session records from ~/.viben/sessions.json
   │   └── No active sessions yet
   │
   ├── Init AgentManager
   │   └── Load agent catalog + installed agents
   │
   └── Emit event: 'kernel:booted'

2. PLUGIN DISCOVERY
   │
   ├── Scan built-in plugins
   │   └── Import from src/plugins/*/index.ts
   │   └── Each exports an VibenPlugin object
   │   └── Mark as trusted (skip checksum, no permission prompt)
   │
   ├── Scan community plugins
   │   └── Read ~/.viben/plugins/package.json dependencies
   │   └── For each: require('{plugin-name}').default as VibenPlugin
   │   └── Verify checksum against ~/.viben/plugins/checksums.json
   │   └── If checksum mismatch → SKIP plugin, log error
   │
   ├── Check config for enabled/disabled
   │   └── config.plugins[].enabled === false → skip
   │   └── No config entry → enabled by default (built-in)
   │   └── No config entry → disabled by default (community, requires explicit add)
   │
   ├── Apply overrides
   │   └── For each plugin with `overrides` field:
   │       └── Find the overridden plugin
   │       └── Remove overridden from load list
   │       └── Log: "Plugin X overrides Y"
   │
   ├── Validate dependencies
   │   │
   │   ├── Build dependency graph
   │   │   └── Nodes: all enabled plugins
   │   │   └── Edges: pluginDependencies (required)
   │   │
   │   ├── Detect circular dependencies
   │   │   └── DFS with visited/stack tracking
   │   │   └── If cycle found: log error with cycle path, skip ALL plugins in cycle
   │   │
   │   ├── Check missing dependencies
   │   │   └── For each plugin, check all pluginDependencies exist in enabled list
   │   │   └── If missing: skip plugin + ALL its dependents (cascade)
   │   │   └── Log: "Plugin X requires Y which is not available"
   │   │
   │   ├── Check version compatibility
   │   │   └── For each dependency, check semver range
   │   │   └── If mismatch: log WARNING (not error), attempt to load anyway
   │   │
   │   └── optionalPluginDependencies
   │       └── If missing: log info, continue (plugin handles undefined from getService)
   │
   └── Compute load order
       └── Topological sort on dependency graph
       └── Plugins with no dependencies → depth 0 (load first)
       └── Plugins depending on depth-0 → depth 1
       └── etc.

3. PLUGIN SETUP (topo-sorted order)
   │
   └── For each enabled plugin (in order):
       │
       ├── Create PluginContext
       │   └── Scope by permissions (each ctx method checks permission)
       │   └── Inject pluginConfig from config.json
       │   └── Create PluginStorage for this plugin
       │   └── Create scoped Logger
       │
       ├── Call plugin.setup(ctx) with 30s timeout
       │   │
       │   ├── SUCCESS:
       │   │   └── Mark plugin as loaded
       │   │   └── Emit 'plugin:loaded' { name, version }
       │   │
       │   ├── TIMEOUT (30s):
       │   │   └── Mark plugin as failed
       │   │   └── Log error with timeout details
       │   │   └── Emit 'plugin:failed' { name, error: 'setup timeout' }
       │   │   └── Cascade: skip all plugins that depend on this one
       │   │
       │   └── THROWS:
       │       └── Mark plugin as failed
       │       └── Log error with stack trace
       │       └── Emit 'plugin:failed' { name, error }
       │       └── Cascade: skip all plugins that depend on this one
       │
       └── Note: optionalPluginDependencies that failed → plugin still loads,
           getService() returns undefined for those services

4. POST-SETUP
   │
   ├── Collect all registered commands from all plugins
   │   └── Emit 'system:commands-ready' { commands: CommandDef[] }
   │   └── Adapters listen to this event to register commands with platform
   │
   ├── Verify at least one adapter loaded
   │   └── If no adapter: log CRITICAL warning "No adapter loaded — system cannot receive messages"
   │
   └── Log startup summary
       └── "Loaded: 8 plugins (5 built-in, 3 community)"
       └── "Skipped: 2 plugins (1 disabled, 1 missing dependency)"
       └── "Services: security, file-service, notifications, usage, speech, tunnel, api-server"
       └── "Adapters: telegram, discord"

5. READY
   │
   ├── Emit 'system:ready' {}
   │   └── Adapter plugins listen to this → start accepting messages
   │   └── API server plugin listens → start HTTP server
   │
   └── System is now operational
```

### Shutdown Sequence (detailed)

```
1. SIGNAL RECEIVED (SIGINT / SIGTERM / programmatic)
   │
   └── Emit 'system:shutdown' {}
       └── Plugins can listen to start graceful cleanup

2. GRACE PERIOD (30 seconds)
   │
   ├── Adapter plugins stop accepting NEW messages
   │   └── Telegram: stop bot polling
   │   └── Discord: set presence to DND
   │   └── Slack: disconnect socket mode
   │
   ├── Notify active sessions
   │   └── Send "Viben is shutting down" to each active session thread
   │
   └── Wait for in-flight prompts to complete
       └── If prompt finishes within grace period → normal completion
       └── If still running at end of grace period → cancel remaining

3. PLUGIN TEARDOWN (REVERSE topo-sort order)
   │
   └── For each plugin (reverse order):
       │
       ├── Call plugin.teardown() with 10s timeout
       │   ├── SUCCESS: log "Plugin X torn down"
       │   ├── TIMEOUT: log warning, force continue
       │   └── THROWS: log error, continue
       │
       ├── Auto-cleanup (even if teardown skipped):
       │   ├── Remove all event listeners registered by this plugin
       │   ├── Unregister all middleware registered by this plugin
       │   ├── Unregister all commands registered by this plugin
       │   └── (Services stay until kernel cleanup — other plugins may need them during their teardown)
       │
       └── Emit 'plugin:unloaded' { name }

4. KERNEL CLEANUP
   │
   ├── Cancel all remaining sessions
   │   └── For each active session: session.cancel('shutdown')
   │
   ├── Destroy all agent subprocesses
   │   └── AgentManager.destroyAll()
   │
   ├── Clear ServiceRegistry
   │
   ├── Flush EventBus (process any remaining queued events)
   │
   ├── Save any pending state
   │   └── Session records → sessions.json
   │   └── Config changes → config.json
   │
   └── Exit process
```

---

## Section 6: Service Registry

```typescript
class ServiceRegistry {
  /** Register a service. Throws ServiceConflictError on duplicate. */
  register<T>(name: string, implementation: T, pluginName: string): void

  /** Lookup service. Returns undefined if not registered. */
  get<T>(name: string): T | undefined

  /** Check if service exists. */
  has(name: string): boolean

  /** List all registered services. */
  list(): Array<{ name: string; pluginName: string }>

  /** Remove a service (used during teardown). */
  unregister(name: string): void
}
```

### Registration Rules

| Scenario | Behavior |
|----------|----------|
| First registration for a name | Accept |
| Same name by another built-in (no override) | **Startup error** — bug in Viben, must fix |
| Same name by community (no override) | **Error** — community plugin skipped |
| Same name by community with `overrides` | Replace — overridden built-in's setup() never called |
| Two community plugins same name | **Error** — second plugin skipped, user must choose |
| `getService()` before registration | Returns `undefined` |
| `getService()` for required dep's service | Guaranteed non-undefined (loaded in order) |
| `getService()` for optional dep's service | May be undefined (check!) |

### Built-in Service Contracts

Each built-in plugin registers a service with a typed interface. Community plugins consuming or overriding must implement the same interface.

```typescript
// === Security Service ===
interface SecurityService {
  checkAccess(userId: string): Promise<{ allowed: boolean; reason?: string }>
  checkSessionLimit(userId: string): Promise<{ allowed: boolean; reason?: string }>
  getUserRole(userId: string): Promise<'admin' | 'user' | 'blocked'>
}

// === File Service ===
interface FileServiceInterface {
  saveFile(sessionId: string, fileName: string, data: Buffer, mimeType: string): Promise<Attachment>
  resolveFile(filePath: string): Promise<Attachment | null>
  readTextFileWithRange(path: string, opts?: { line?: number; limit?: number }): Promise<string>
  convertOggToWav(oggData: Buffer): Promise<Buffer>
}

// === Notification Service ===
interface NotificationService {
  notify(channelId: string, notification: NotificationMessage): Promise<void>
  notifyAll(notification: NotificationMessage): Promise<void>
}

// === Usage Service ===
interface UsageService {
  trackUsage(record: UsageRecord): Promise<void>
  checkBudget(sessionId: string): Promise<{ ok: boolean; percent: number; warning?: string }>
  getSummary(period: string): Promise<UsageSummary>
}

// === Speech Service ===
interface SpeechServiceInterface {
  textToSpeech(text: string, opts?: { language?: string; voice?: string }): Promise<Buffer>
  speechToText(audio: Buffer, opts?: { language?: string }): Promise<string>
  registerTTSProvider(name: string, provider: TTSProvider): void
  registerSTTProvider(name: string, provider: STTProvider): void
}

// === Context Service ===
interface ContextService {
  buildContext(sessionId: string, opts?: { maxTokens?: number }): Promise<string>
  registerProvider(provider: ContextProvider): void
}

// === Tunnel Service ===
interface TunnelServiceInterface {
  getPublicUrl(): string | undefined
  isConnected(): boolean
  start(): Promise<string>  // returns public URL
  stop(): Promise<void>
}
```

### Provider Extension Pattern

Built-in plugins bundle orchestrator + default providers. Community extends via service method calls:

```
Speech plugin registers service 'speech' with:
  - SpeechService orchestrator
  - GroqSTT provider (built-in)
  - EdgeTTS provider (built-in)

Community plugin @community/speech-elevenlabs:
  - Depends on @viben/speech
  - In setup(): ctx.getService('speech').registerTTSProvider('elevenlabs', new ElevenLabsTTS())
  - Now speech service has 3 TTS providers: edge-tts, elevenlabs
  - User configures which to use in config.json
```

Same pattern for Tunnel (providers: cloudflared, ngrok, bore, tailscale) and Context (providers: entire, custom).

---

## Section 7: Error Isolation

### Per-Call Isolation

Every external plugin interaction is wrapped:

```typescript
async function safeCall<T>(
  pluginName: string,
  action: string,
  fn: () => Promise<T>,
  fallback: T,
  errorTracker: ErrorTracker,
): Promise<T> {
  if (errorTracker.isDisabled(pluginName)) return fallback

  try {
    return await Promise.race([
      fn(),
      timeout(5000).then(() => { throw new Error('timeout') }),
    ])
  } catch (err) {
    log.error({ plugin: pluginName, action, err }, 'Plugin error')
    errorTracker.increment(pluginName)
    return fallback
  }
}
```

### Error Budget

```typescript
class ErrorTracker {
  private errors = new Map<string, { count: number; windowStart: number }>()
  private disabled = new Set<string>()

  increment(pluginName: string): void {
    // Get or create window
    // Increment count
    // If count > maxErrors within windowMs → disable
  }

  isDisabled(pluginName: string): boolean {
    return this.disabled.has(pluginName)
  }

  reset(pluginName: string): void {
    this.errors.delete(pluginName)
    this.disabled.delete(pluginName)
  }
}
```

### Config

```json
{
  "plugins": [
    {
      "package": "@community/auto-approve",
      "enabled": true,
      "config": { "rules": [...] },
      "errorBudget": { "maxErrors": 10, "windowMs": 3600000 }
    }
  ]
}
```

- **Default:** 10 errors per hour (3600000ms window)
- **Built-in plugins:** Exempt (no budget tracking). Bugs should be fixed in code.
- **Exceeded → auto-disable:**
  - Emit `plugin:disabled` { name, reason: `"Error budget exceeded: 10 errors in 1 hour"` }
  - All plugin's middleware, event handlers stop receiving calls
  - Service stays registered (other plugins may depend on it) but calls throw
  - Log: WARN `"Plugin @community/auto-approve disabled: error budget exceeded"`

### Recovery

- **Runtime-only** — disable does NOT persist to config
- **Next restart** — plugin re-enabled, budget reset
- **Manual re-enable** — not supported in v1 (restart required)

### Edge Cases — Error Isolation

- **Plugin error during middleware chain:** Skip handler, pass original payload to next. Chain continues.
- **Plugin error in event handler:** Swallow error, log, count. Other listeners still receive event.
- **Plugin error in service call:** Throw to caller. Caller (another plugin) should handle. Both plugins' error budgets are unaffected (only the service provider's budget if it caused the error).
- **Built-in plugin error:** Logged but not counted. No auto-disable.
- **Error during teardown:** Logged, continue with next plugin.

---

## Section 8: Events

### System Events (typed)

```typescript
interface PluginEventMap {
  // System lifecycle
  'kernel:booted': {}
  'system:ready': {}
  'system:shutdown': {}
  'system:commands-ready': { commands: CommandDef[] }

  // Plugin lifecycle
  'plugin:loaded': { name: string; version: string }
  'plugin:failed': { name: string; error: string }
  'plugin:disabled': { name: string; reason: string }
  'plugin:unloaded': { name: string }

  // Session lifecycle
  'session:created': { sessionId: string; agentName: string; userId: string; channelId: string; workingDir: string }
  'session:ended': { sessionId: string; reason: string }
  'session:named': { sessionId: string; name: string }
  'session:updated': { sessionId: string; status: SessionStatus }

  // Agent events
  'agent:event': { sessionId: string; event: AgentEvent }
  'agent:prompt': { sessionId: string; text: string; attachments?: Attachment[] }

  // Permission events
  'permission:request': { sessionId: string; request: PermissionRequest }
  'permission:resolved': { sessionId: string; requestId: string; decision: string }

  // Custom events (plugins emit with their name prefix)
  [key: `${string}:${string}`]: unknown
}
```

### Event vs Middleware — When to use which

| Scenario | Use | Why |
|----------|-----|-----|
| "I want to know when a session starts" | Event `session:created` | Observe only, no modification |
| "I want to block certain users" | Middleware `message:incoming` | Need to modify/block |
| "I want to log all tool calls" | Event `agent:event` | Observe only |
| "I want to redact sensitive tool output" | Middleware `agent:beforeEvent` | Need to modify |
| "I want to track token usage" | Event `agent:event` (filter type=usage) | Observe only |
| "I want to auto-approve reads" | Middleware `permission:beforeRequest` | Need to modify |
| "I want to translate messages" | Middleware `message:outgoing` | Need to modify |
| "I want to inject context into prompts" | Middleware `agent:beforePrompt` | Need to modify |

---

## Section 9: Full Message Flows

### Flow 1: User sends text message → Agent responds

```
USER TYPES MESSAGE IN TELEGRAM
  │
  ▼
TelegramAdapter receives bot.on('message:text')
  │
  ▼
[HOOK: message:incoming] ────────────────────────────────────
  │  Payload: { channelId, threadId, userId, text, attachments? }
  │  Example plugins:
  │    - Security: check userId in allowlist → block if not allowed
  │    - Rate limiter: check message frequency → block if too fast
  │    - Content filter: scan text for banned words → block or sanitize
  │  If ANY middleware returns null → message dropped, user gets no response
  │
  ▼
core.handleMessage(incomingMessage)
  │
  ├── Lookup session by threadId
  │   └── If no session exists AND text starts with valid command → handle command
  │   └── If no session exists → create new session (see Flow 6)
  │
  ▼
session.enqueuePrompt(text, attachments)
  │
  ▼
[HOOK: turn:start] ─────────────────────────────────────────
  │  Payload: { sessionId, promptText, promptNumber }
  │  Read-only. For metrics/logging plugins.
  │
  ▼
[HOOK: agent:beforePrompt] ─────────────────────────────────
  │  Payload: { sessionId, text, attachments? }
  │  Example plugins:
  │    - Context injector: prepend conversation history to prompt
  │    - System prompt: add role instructions
  │    - Workspace info: add current directory context
  │  If null → prompt cancelled, turn ends immediately
  │
  ▼
AgentInstance.prompt(contentBlocks)
  │  (ACP JSON-RPC: session/prompt)
  │
  ▼
═══ AGENT PROCESSING (streaming responses) ═══
  │
  │  Agent sends session/update events (text, tool_call, plan, etc.)
  │  For EACH event:
  │
  ▼
AgentInstance.sessionUpdate() parses event → AgentEvent
  │
  ▼
[HOOK: agent:beforeEvent] ──────────────────────────────────
  │  Payload: { sessionId, event: AgentEvent }
  │  Example plugins:
  │    - Content filter: redact sensitive data from tool output
  │    - Tool blocker: suppress certain tool_call events
  │  If null → event dropped, adapter never sees it
  │
  ▼
SessionBridge.wireSessionToAdapter()
  │  Routes event type → MessageTransformer → OutgoingMessage
  │
  ▼
[HOOK: message:outgoing] ──────────────────────────────────
  │  Payload: { sessionId, message: OutgoingMessage }
  │  Example plugins:
  │    - Translator: translate message.text to user's language
  │    - Formatter: add custom formatting/branding
  │  If null → message not sent to user (silently dropped)
  │
  ▼
Adapter.sendMessage(sessionId, outgoingMessage)
  │  (Telegram: send/edit HTML message in forum topic)
  │
  ▼
[HOOK: agent:afterEvent] ──────────────────────────────────
  │  Payload: { sessionId, event, outgoingMessage }
  │  Read-only. For logging, analytics, metrics plugins.
  │
  ▼
USER SEES RESPONSE IN TELEGRAM
  │
  ▼
═══ TURN COMPLETE ═══
  │
  ▼
AgentInstance receives PromptResponse { stopReason }
  │
  ▼
[HOOK: turn:end] ──────────────────────────────────────────
  │  Payload: { sessionId, stopReason, durationMs }
  │  Read-only. For metrics/billing plugins.
  │
  ▼
Done. Waiting for next user message.
```

### Flow 2: Agent reads a file

```
AGENT SUBPROCESS REQUESTS fs/readTextFile
  │
  ▼
AgentInstance.readTextFile callback triggered
  │
  ▼
[HOOK: fs:beforeRead] ─────────────────────────────────────
  │  Payload: { sessionId, path, line?, limit? }
  │  Example plugins:
  │    - Security: check path against allowlist
  │      → block reads outside working directory
  │      → block reads of .env, credentials files
  │    - Audit: log all file reads
  │  If null → deny read, return error to agent
  │
  ▼
FileService.readTextFileWithRange(path, { line, limit })
  │
  ▼
Return content to agent subprocess
```

### Flow 2b: Agent writes a file

```
AGENT SUBPROCESS REQUESTS fs/writeTextFile
  │
  ▼
AgentInstance.writeTextFile callback triggered
  │
  ▼
[HOOK: fs:beforeWrite] ────────────────────────────────────
  │  Payload: { sessionId, path, content }
  │  Example plugins:
  │    - Security: block writes outside working directory
  │    - Security: block writes to .env, .ssh/, etc.
  │    - Audit: log all file writes with content hash
  │    - Backup: save copy before overwrite
  │  If null → deny write, return error to agent
  │
  ▼
fs.writeFile(path, content)
  │
  ▼
Return success to agent subprocess
```

### Flow 3: Agent spawns terminal

```
AGENT SUBPROCESS REQUESTS terminal/create
  │
  ▼
AgentInstance.createTerminal callback triggered
  │
  ▼
[HOOK: terminal:beforeCreate] ──────────────────────────────
  │  Payload: { sessionId, command, args?, env?, cwd? }
  │  Example plugins:
  │    - Security: block dangerous commands (rm -rf, sudo, etc.)
  │    - Sandbox: force cwd to working directory
  │    - Env inject: add environment variables
  │  If null → deny terminal creation, return error to agent
  │
  ▼
spawn(command, args, { env, cwd })
  │
  ▼
Return terminalId to agent
  │
  ... agent uses terminal ...
  │
  ▼
Process exits
  │
  ▼
[HOOK: terminal:afterExit] ────────────────────────────────
  │  Payload: { sessionId, terminalId, command, exitCode, durationMs }
  │  Read-only. For audit/logging.
  │
  ▼
Done.
```

### Flow 4: Permission request

```
AGENT REQUESTS PERMISSION (e.g., write to file outside cwd)
  │
  ▼
AgentInstance.requestPermission callback
  │
  ▼
[HOOK: permission:beforeRequest] ──────────────────────────
  │  Payload: { sessionId, request: PermissionRequest, autoResolve?: string }
  │  Example plugins:
  │    - Auto-approve: check rules, set autoResolve = allowOptionId
  │    - Security: force-deny certain permission types
  │
  │  If payload.autoResolve is set:
  │    → Skip UI, return autoResolve optionId to agent immediately
  │    → Still emit permission:afterResolve event
  │  If null → deny permission silently
  │
  ▼
(If not auto-resolved)
PermissionGate.setPending(request)
  │
  ▼
Adapter.sendPermissionRequest(sessionId, request)
  │  (Telegram: inline keyboard with Allow/Deny buttons)
  │
  ▼
USER CLICKS ALLOW OR DENY
  │
  ▼
[HOOK: permission:afterResolve] ───────────────────────────
  │  Payload: { sessionId, requestId, decision, userId, durationMs }
  │  Read-only. For audit logging.
  │
  ▼
Return decision to agent subprocess
```

### Flow 5: Speech (TTS/STT)

```
═══ TEXT TO SPEECH (Agent response → Voice) ═══

Agent sends text response
  → Normal response flow (hooks fire as in Flow 1)
  → Adapter receives OutgoingMessage
  → Adapter checks: session.voiceMode === 'on'?

  YES:
    → const speech = ctx.getService<SpeechService>('speech')
    → if (!speech) → fallback to text only
    → const audio = await speech.textToSpeech(text, { language: 'en' })
    → Adapter sends audio file to user
    → (Also sends text as fallback)

  NO:
    → Adapter sends text to user (normal)


═══ SPEECH TO TEXT (User voice → Text prompt) ═══

User sends voice message in Telegram
  → Adapter receives audio file
  → [HOOK: message:incoming] fires with attachments
  → Adapter checks: has speech service?
    → const speech = ctx.getService<SpeechService>('speech')
    → if (!speech) → send text: "[Voice message — speech plugin not installed]"
    → const text = await speech.speechToText(audioBuffer, { language: 'en' })
    → Proceed with text as normal message
  → core.handleMessage({ text, attachments: [audioFile] })
  → Normal prompt flow...
```

### Flow 6: New session creation

```
USER SENDS FIRST MESSAGE (no existing session)
  │
  ▼
[HOOK: message:incoming] (same as Flow 1)
  │
  ▼
core.handleMessage() → no session for this thread
  │
  ▼
[HOOK: session:beforeCreate] ──────────────────────────────
  │  Payload: { agentName, workingDir, userId, channelId, threadId }
  │  Example plugins:
  │    - Security: check session limit per user
  │    - Workspace: validate working directory exists
  │    - Quota: check user hasn't exceeded daily session limit
  │  If null → deny session creation, reply with error message
  │
  ▼
Adapter.createSessionThread(sessionId, name)
  │  (Telegram: create forum topic)
  │
  ▼
SessionFactory.create(agentName, workingDir, channelId)
  │
  ▼
AgentInstance.spawn(agentDef, workingDir)
  │  (ACP: initialize → newSession)
  │
  ▼
Session.setInitialAcpState({ modes, configOptions, models })
  │
  ▼
SessionBridge.connect()
  │
  ▼
Emit 'session:created' event
  │
  ▼
Continue with prompt flow (Flow 1)
```

### Flow 7: Mode/Config/Model change

```
═══ USER CHANGES MODE (via command or UI) ═══

User sends /mode architect
  │
  ▼
[HOOK: mode:beforeChange] ────────────────────────────────
  │  Payload: { sessionId, fromMode: 'code', toMode: 'architect' }
  │  Example plugins:
  │    - Security: only admins can use 'architect' mode
  │  If null → deny mode change, reply with error
  │
  ▼
AgentInstance.setMode(sessionId, 'architect')
  │  (ACP: session/set_mode)
  │
  ▼
Agent confirms → emits current_mode_update
  │
  ▼
Session.updateMode('architect')
  │
  ▼
Normal response flow → adapter shows "Mode: architect"


═══ AGENT CHANGES CONFIG ═══

Agent pushes config_option_update
  │  (e.g., switches model from sonnet to opus)
  │
  ▼
[HOOK: agent:beforeEvent] ────────────────────────────────
  │  Can modify or block config_option_update event
  │
  ▼
Session.updateConfigOptions(newOptions)
  │
  ▼
Adapter shows "Config updated"
```

### Flow 8: Tunnel & API Server

```
═══ TUNNEL PLUGIN STARTUP ═══

Tunnel plugin setup():
  │
  ├── Read config: { provider: 'cloudflared', port: 3000 }
  │
  ├── Start tunnel provider
  │   └── cloudflared tunnel --url http://localhost:3000
  │
  ├── Get public URL
  │   └── https://xxx.trycloudflare.com
  │
  ├── ctx.registerService('tunnel', tunnelService)
  │
  └── ctx.emit('@viben/tunnel:ready', { url })
      └── API server plugin listens → uses URL for webhooks
      └── MessageTransformer uses URL for viewer links


═══ API SERVER PLUGIN STARTUP ═══

API server plugin setup():
  │
  ├── Read config: { port: 3000, host: '127.0.0.1' }
  │
  ├── Create HTTP server with routes:
  │   └── GET /health
  │   └── GET /api/sessions
  │   └── POST /api/sessions/:id/prompt
  │   └── GET /api/events (SSE)
  │   └── Static file serving (viewer)
  │
  ├── ctx.on('agent:event', ...) → push to SSE clients
  │
  ├── ctx.registerService('api-server', { getPort, getUrl })
  │
  └── Start listening
```

---

## Section 10: Config Format

### Full config example

```json
{
  "defaultAgent": "claude",
  "workingDirectory": "/home/user/projects",
  "debug": false,

  "plugins": {
    "builtin": {
      "@viben/security": {
        "enabled": true,
        "config": {
          "allowedUserIds": ["123456789"],
          "maxConcurrentSessions": 5,
          "adminUserIds": ["123456789"]
        }
      },
      "@viben/file-service": {
        "enabled": true,
        "config": {
          "baseDir": "~/.viben/files"
        }
      },
      "@viben/notifications": { "enabled": true },
      "@viben/usage": {
        "enabled": true,
        "config": {
          "retentionDays": 30,
          "budget": { "monthlyLimit": 50.00, "warningThreshold": 0.8 }
        }
      },
      "@viben/speech": {
        "enabled": true,
        "config": {
          "sttProvider": "groq",
          "ttsProvider": "edge-tts",
          "groqApiKey": "gsk_...",
          "ttsVoice": "en-US-AriaNeural"
        }
      },
      "@viben/context": { "enabled": true },
      "@viben/tunnel": {
        "enabled": false,
        "config": { "provider": "cloudflared" }
      },
      "@viben/api-server": {
        "enabled": true,
        "config": { "port": 3000, "host": "127.0.0.1" }
      },
      "@viben/telegram": {
        "enabled": true,
        "config": {
          "botToken": "...",
          "chatId": -1001234567890,
          "displayVerbosity": "medium"
        }
      },
      "@viben/discord": { "enabled": false },
      "@viben/slack": { "enabled": false }
    },
    "community": {
      "@community/auto-approve": {
        "enabled": true,
        "config": {
          "rules": [
            { "pattern": "read", "action": "allow" }
          ]
        },
        "errorBudget": { "maxErrors": 5, "windowMs": 1800000 }
      }
    }
  }
}
```

### Config Migration

Old config (no `plugins` field) → auto-migrate on first boot.

**Step 1:** Backup old config to `~/.viben/config.json.backup`

**Step 2:** Apply field-by-field mapping:

| Old field | New location | Notes |
|-----------|-------------|-------|
| `defaultAgent` | `defaultAgent` (stays at root) | Unchanged |
| `workingDirectory` | `workingDirectory` (stays at root) | Unchanged |
| `debug` | `debug` (stays at root) | Unchanged |
| `logging.*` | `logging.*` (stays at root) | Unchanged |
| `runMode` | `runMode` (stays at root) | Unchanged |
| `autoStart` | `autoStart` (stays at root) | Unchanged |
| `sessionStore` | `sessionStore` (stays at root) | Unchanged |
| `security.allowedUserIds` | `plugins.builtin.@viben/security.config.allowedUserIds` | |
| `security.maxConcurrentSessions` | `plugins.builtin.@viben/security.config.maxConcurrentSessions` | |
| `channels.telegram.botToken` | `plugins.builtin.@viben/telegram.config.botToken` | |
| `channels.telegram.chatId` | `plugins.builtin.@viben/telegram.config.chatId` | |
| `channels.telegram.displayVerbosity` | `plugins.builtin.@viben/telegram.config.displayVerbosity` | |
| `channels.telegram.enabled` | `plugins.builtin.@viben/telegram.enabled` | |
| `channels.discord.*` | `plugins.builtin.@viben/discord.config.*` | Same pattern |
| `channels.slack.*` | `plugins.builtin.@viben/slack.config.*` | Same pattern |
| `speech.sttProvider` | `plugins.builtin.@viben/speech.config.sttProvider` | |
| `speech.ttsProvider` | `plugins.builtin.@viben/speech.config.ttsProvider` | |
| `speech.groqApiKey` | `plugins.builtin.@viben/speech.config.groqApiKey` | |
| `speech.ttsVoice` | `plugins.builtin.@viben/speech.config.ttsVoice` | |
| `tunnel.enabled` | `plugins.builtin.@viben/tunnel.enabled` | |
| `tunnel.provider` | `plugins.builtin.@viben/tunnel.config.provider` | |
| `usage.enabled` | `plugins.builtin.@viben/usage.enabled` | |
| `usage.monthlyBudget` | `plugins.builtin.@viben/usage.config.budget.monthlyLimit` | |
| `usage.retentionDays` | `plugins.builtin.@viben/usage.config.retentionDays` | |
| `api.port` | `plugins.builtin.@viben/api-server.config.port` | |
| `api.host` | `plugins.builtin.@viben/api-server.config.host` | |

**Step 3:** For any built-in plugin not explicitly in old config → set `enabled: true` with empty config (preserve current default behavior).

**Step 4:** Write migrated config. Log: "Config migrated to plugin format"

### Environment Variable Overrides

Existing env vars continue to work and override plugin config:

| Env var | Maps to |
|---------|---------|
| `VIBEN_TELEGRAM_BOT_TOKEN` | `plugins.builtin.@viben/telegram.config.botToken` |
| `VIBEN_TELEGRAM_CHAT_ID` | `plugins.builtin.@viben/telegram.config.chatId` |
| `VIBEN_DEFAULT_AGENT` | `defaultAgent` (root level) |
| `VIBEN_DEBUG` | `debug` (root level) |

Env vars are applied AFTER config load, BEFORE plugin setup. PluginContext receives the merged result.

---

## Section 11: Plugin Discovery & Installation

### Community Plugin Installation Flow

```
$ viben plugin add @community/auto-approve

1. Fetch package metadata from npm
   └── npm view @community/auto-approve

2. Read package.json for plugin metadata
   └── "viben": { "permissions": [...], "pluginDependencies": {...} }

3. Display consent prompt:
   ┌──────────────────────────────────────────────┐
   │ 📦 @community/auto-approve v1.0.0            │
   │    Auto-approve read-only tool permissions    │
   │                                               │
   │ Required dependencies:                        │
   │   ✅ @viben/security (already active)       │
   │                                               │
   │ Permissions requested:                        │
   │   ⚡ middleware:register — Intercept flows     │
   │   🔌 services:use — Use other services        │
   │                                               │
   │ Install? [Y/n]                                │
   └──────────────────────────────────────────────┘

4. Install to ~/.viben/plugins/
   └── cd ~/.viben/plugins && npm install @community/auto-approve

5. Compute SHA-256 checksum of installed package
   └── Store in ~/.viben/plugins/checksums.json

6. Add to config.json
   └── plugins.community["@community/auto-approve"] = { enabled: true, config: {} }

7. Log: "Plugin installed. Restart Viben to activate."
```

### Checksum Verification

At startup, for each community plugin:

```typescript
const expectedHash = checksums[pluginName]
const actualHash = sha256(readFileSync(pluginEntryPath))

if (expectedHash !== actualHash) {
  log.error({ plugin: pluginName }, 'Checksum mismatch — plugin may have been tampered with')
  // Skip this plugin
  // Emit plugin:failed event
}
```

This protects against:
- Manual file modifications
- Corrupted downloads
- Supply chain attacks (partial — npm itself handles most of this)

### CLI Commands

```
viben plugin add <package>       — install community plugin
viben plugin remove <package>    — uninstall community plugin
viben plugin list                — list all plugins (built-in + community) with status
viben plugin enable <name>       — enable a disabled plugin in config
viben plugin disable <name>      — disable a plugin in config
```

---

## Section 12: Transition State (Plan 1 → Plan 2)

During Plan 1 (infrastructure only), core modules are still hard-wired AND plugin system is active. Both coexist:

```
PLAN 1 STATE:

Core startup:
  1. Kernel boot (same as before)
  2. Hard-wire built-in modules (SecurityGuard, FileService, etc.) — EXISTING CODE
  3. LifecycleManager loads plugins (community only — no built-in plugins yet)
  4. Community plugins can:
     - Listen to events ✅
     - Register middleware ✅ (hooks fire around hard-wired code)
     - Register services ✅ (community services coexist with hard-wired)
     - Register commands ✅
  5. system:ready

What works:
  - Community plugins load and function
  - Middleware hooks fire correctly (wired into existing pipeline)
  - Services registered by community plugins are accessible

What doesn't work yet:
  - Built-in modules are NOT plugins (no setup/teardown lifecycle)
  - Built-in services are NOT registered in ServiceRegistry
     → Workaround: LifecycleManager auto-registers hard-wired services
        e.g., serviceRegistry.register('security', securityGuard, '@viben/security')
     → This way, community plugins can getService('security') even though
        it's not a real plugin yet
  - Built-in modules can't be overridden via `overrides`
  - Built-in modules don't have PluginContext
```

```
PLAN 2 STATE (after extraction):

Core startup:
  1. Kernel boot
  2. LifecycleManager loads ALL plugins (built-in + community)
  3. No hard-wired modules — everything through plugin lifecycle
  4. system:ready

Everything works:
  - All modules are plugins with full lifecycle
  - Any built-in can be overridden
  - Services registered in ServiceRegistry by plugins
  - Commands registered by plugins
  - Middleware from all plugins
```

### Migration per module (extraction)

For each built-in module extraction:

```
BEFORE (hard-wired):
  core.ts constructor:
    this.securityGuard = new SecurityGuard(config)
    // ... used directly throughout core

AFTER (plugin):
  src/plugins/security/index.ts:
    export default {
      name: '@viben/security',
      setup(ctx) {
        const guard = new SecurityGuard(ctx.pluginConfig)
        ctx.registerService('security', guard)
        ctx.registerMiddleware('message:incoming', { handler: ... })
      }
    }

  core.ts:
    // SecurityGuard removed from constructor
    // core.handleMessage() uses middleware chain instead of direct call
    // Other code uses getService('security') instead of this.securityGuard
```

---

## Section 13: Concrete Plugin Examples

### Example 1: Security Plugin (built-in)

```typescript
import type { VibenPlugin, PluginContext } from '../core/plugin/types.js'
import type { SecurityService } from '../core/plugin/types.js'

interface SecurityConfig {
  allowedUserIds?: string[]
  maxConcurrentSessions?: number
  adminUserIds?: string[]
}

const securityPlugin: VibenPlugin = {
  name: '@viben/security',
  version: '1.0.0',
  description: 'User access control, rate limiting, session limits',
  permissions: ['events:read', 'services:register', 'middleware:register', 'kernel:access'],

  async setup(ctx: PluginContext) {
    const config = ctx.pluginConfig as SecurityConfig
    const allowed = new Set(config.allowedUserIds ?? [])
    const maxSessions = config.maxConcurrentSessions ?? 5
    const admins = new Set(config.adminUserIds ?? [])
    const activeSessions = new Map<string, number>()  // userId → count

    // Track session lifecycle
    ctx.on('session:created', (payload: any) => {
      const count = activeSessions.get(payload.userId) ?? 0
      activeSessions.set(payload.userId, count + 1)
    })
    ctx.on('session:ended', (payload: any) => {
      const count = activeSessions.get(payload.userId) ?? 1
      activeSessions.set(payload.userId, Math.max(0, count - 1))
    })

    // Block unauthorized users
    ctx.registerMiddleware('message:incoming', {
      handler: async (msg, next) => {
        if (allowed.size > 0 && !allowed.has(msg.userId)) {
          ctx.log.info({ userId: msg.userId }, 'Blocked unauthorized user')
          return null  // block
        }
        return next()
      }
    })

    // Enforce session limits
    ctx.registerMiddleware('session:beforeCreate', {
      handler: async (payload, next) => {
        const count = activeSessions.get(payload.userId) ?? 0
        if (count >= maxSessions) {
          ctx.log.warn({ userId: payload.userId, count, max: maxSessions }, 'Session limit reached')
          return null  // block
        }
        return next()
      }
    })

    // Register service for other plugins
    ctx.registerService<SecurityService>('security', {
      async checkAccess(userId) {
        if (allowed.size === 0) return { allowed: true }
        if (!allowed.has(userId)) return { allowed: false, reason: 'Not in allowed list' }
        return { allowed: true }
      },
      async checkSessionLimit(userId) {
        const count = activeSessions.get(userId) ?? 0
        if (count >= maxSessions) return { allowed: false, reason: `Limit: ${maxSessions}` }
        return { allowed: true }
      },
      async getUserRole(userId) {
        if (allowed.size > 0 && !allowed.has(userId)) return 'blocked'
        if (admins.has(userId)) return 'admin'
        return 'user'
      }
    })

    ctx.log.info(`Security: ${allowed.size} allowed users, max ${maxSessions} sessions`)
  }
}

export default securityPlugin
```

### Example 2: Speech Plugin (built-in, with provider pattern)

```typescript
import type { VibenPlugin, PluginContext } from '../core/plugin/types.js'
import { SpeechService } from '../speech/speech-service.js'
import { GroqSTT } from '../speech/providers/groq.js'
import { EdgeTTS } from '../speech/providers/edge-tts.js'

interface SpeechConfig {
  sttProvider?: string
  ttsProvider?: string
  groqApiKey?: string
  ttsVoice?: string
}

const speechPlugin: VibenPlugin = {
  name: '@viben/speech',
  version: '1.0.0',
  description: 'Text-to-speech and speech-to-text with pluggable providers',
  optionalPluginDependencies: {
    '@viben/file-service': '^1.0.0',
  },
  permissions: ['services:register', 'services:use', 'events:read'],

  async setup(ctx: PluginContext) {
    const config = ctx.pluginConfig as SpeechConfig
    const service = new SpeechService()

    // Register built-in providers (lazy — only init if configured)
    if (config.groqApiKey) {
      service.registerSTTProvider('groq', new GroqSTT(config.groqApiKey))
    }
    if (config.ttsVoice || config.ttsProvider === 'edge-tts') {
      service.registerTTSProvider('edge-tts', new EdgeTTS(config.ttsVoice))
    }

    // Set defaults
    if (config.sttProvider) service.setDefaultSTT(config.sttProvider)
    if (config.ttsProvider) service.setDefaultTTS(config.ttsProvider)

    // Register service — community plugins can add more providers
    ctx.registerService('speech', service)

    ctx.log.info('Speech service ready')
  },

  async teardown() {
    // Cleanup audio resources if needed
  }
}

export default speechPlugin

// Community plugin extending speech:
// @community/speech-elevenlabs
// {
//   pluginDependencies: { '@viben/speech': '^1.0.0' },
//   setup(ctx) {
//     const speech = ctx.getService<SpeechService>('speech')!
//     speech.registerTTSProvider('elevenlabs', new ElevenLabsTTS(ctx.pluginConfig.apiKey))
//   }
// }
```

### Example 3: Telegram Adapter Plugin (built-in)

```typescript
import type { VibenPlugin, PluginContext } from '../core/plugin/types.js'
import { TelegramAdapter } from '../adapters/telegram/adapter.js'

interface TelegramConfig {
  botToken: string
  chatId: number
  displayVerbosity?: string
}

const telegramPlugin: VibenPlugin = {
  name: '@viben/telegram',
  version: '1.0.0',
  description: 'Telegram adapter with forum topics',
  pluginDependencies: {
    '@viben/security': '^1.0.0',
    '@viben/notifications': '^1.0.0',
  },
  optionalPluginDependencies: {
    '@viben/speech': '^1.0.0',
  },
  permissions: ['events:read', 'events:emit', 'services:register', 'services:use',
                'middleware:register', 'commands:register', 'kernel:access'],

  // Closure variable — shared between setup() and teardown()
  _adapter: null as TelegramAdapter | null,

  async setup(ctx: PluginContext) {
    const config = ctx.pluginConfig as TelegramConfig
    if (!config.botToken || !config.chatId) {
      throw new Error('Telegram requires botToken and chatId in config')
    }

    // Create adapter with core access
    const adapter = new TelegramAdapter(
      { configManager: ctx.config, sessionManager: ctx.sessions },
      { ...config, enabled: true, maxMessageLength: 4096 },
    )
    this._adapter = adapter

    // Register as adapter service
    ctx.registerService('adapter:telegram', adapter)

    // Register adapter-specific commands
    ctx.registerCommand({
      name: 'new',
      description: 'Create a new session',
      handler: async (args) => { /* ... */ }
    })

    // Listen for system:ready to start bot
    ctx.on('system:ready', async () => {
      await adapter.start()
      ctx.log.info('Telegram bot started')
    })

    // Listen for system:commands-ready to register with Telegram
    ctx.on('system:commands-ready', async (payload: any) => {
      await adapter.registerBotCommands(payload.commands)
    })
  },

  async teardown() {
    if (this._adapter) {
      await this._adapter.stop()
    }
  }
}

export default telegramPlugin
```

### Example 4: Community Translation Plugin

```typescript
const translatePlugin: VibenPlugin = {
  name: '@community/translate',
  version: '1.0.0',
  description: 'Auto-translate agent responses to your language',
  permissions: ['middleware:register', 'storage:read', 'storage:write'],

  // Closure variables — shared between setup() and teardown()
  _storage: null as PluginStorage | null,
  _cache: {} as Record<string, string>,

  async setup(ctx: PluginContext) {
    const targetLang = (ctx.pluginConfig as any).language ?? 'vi'
    this._storage = ctx.storage
    this._cache = await ctx.storage.get<Record<string, string>>('cache') ?? {}
    const cache = this._cache

    ctx.registerMiddleware('message:outgoing', {
      handler: async (payload, next) => {
        if (payload.message.type === 'text' && payload.message.text) {
          const cached = cache[payload.message.text]
          if (cached) {
            payload.message.text = cached
          } else {
            const translated = await translateApi(payload.message.text, targetLang)
            cache[payload.message.text] = translated
            payload.message.text = translated
          }
        }
        return next()
      }
    })

    ctx.log.info(`Translation plugin: target language = ${targetLang}`)
  },

  async teardown() {
    // Flush translation cache to storage
    if (this._storage) {
      await this._storage.set('cache', this._cache)
    }
  }
}
```

---

## Section 14: Implementation Strategy — 2 Plans

### Plan 1: Plugin Infrastructure (no extraction)

Build the plugin system. Core modules stay hard-wired. Community plugins can load.

| Task | Description |
|------|-------------|
| 1 | Plugin types (`VibenPlugin`, `PluginContext`, `MiddlewarePayloadMap`, service interfaces, etc.) |
| 2 | ServiceRegistry (register, get, has, list, conflict detection) |
| 3 | MiddlewareChain (18 typed hook points, chain execution, timeout, error handling) |
| 4 | PluginStorage (KV JSON + dataDir per plugin) |
| 5 | ErrorTracker (per-plugin error budget, auto-disable, recovery) |
| 6 | PluginLoader (discover built-in + community, validate deps, topo-sort, checksum verify) |
| 7 | PluginContext factory (scoped per plugin, permission enforcement) |
| 8 | LifecycleManager (boot/shutdown orchestration, timeout handling) |
| 9 | Wire LifecycleManager into core.ts startup + auto-register hard-wired services |
| 10a | Wire message hooks (`message:incoming`, `message:outgoing`) |
| 10b | Wire agent hooks (`agent:beforePrompt`, `agent:beforeEvent`, `agent:afterEvent`, `turn:start`, `turn:end`) |
| 10c | Wire fs hooks (`fs:beforeRead`, `fs:beforeWrite`) |
| 10d | Wire terminal hooks (`terminal:beforeCreate`, `terminal:afterExit`) |
| 10e | Wire permission hooks (`permission:beforeRequest`, `permission:afterResolve`) |
| 10f | Wire session hooks (`session:beforeCreate`, `session:afterDestroy`) |
| 10g | Wire control hooks (`mode:beforeChange`, `model:beforeChange`, `config:beforeChange`, `agent:beforeCancel`) |
| 11 | CLI: `viben plugin add/remove/list/enable/disable` |
| 12 | Unit tests for all infrastructure modules |
| 13 | Integration test: full boot → plugin load → middleware → shutdown |

**After Plan 1:** Community plugins fully functional. Built-in modules still hard-wired but services auto-registered in ServiceRegistry.

### Plan 2: Built-in Extraction

Move each module to `src/plugins/` and wrap in `VibenPlugin`.

| Task | Module | Difficulty | Dependencies |
|------|--------|-----------|-------------|
| 1 | ContextManager | Easy | None |
| 2 | Speech | Easy | file-service (optional) |
| 3 | Usage | Easy | None |
| 4 | Tunnel | Easy | None (already in main.ts) |
| 5 | Security | Medium | None |
| 6 | Notifications | Medium | security |
| 7 | FileService | Medium | None |
| 8 | ApiServer | Easy | security (already in main.ts) |
| 9 | Telegram | Hard | security, notifications |
| 10 | Discord | Hard | security, notifications |
| 11 | Slack | Hard | security, notifications |
| 12 | Remove all hard-wired code from core.ts |

**After Plan 2:** Everything is a plugin. Core is minimal (EventBus, Config, Sessions, Agents, Plugin infra).

---

## Section 15: Backward Compatibility

| Concern | Handling |
|---------|---------|
| Old config (no `plugins` field) | Auto-migrate: detect old format, convert to new, backup old file |
| `viben install/uninstall` CLI | Still work for agents (unchanged) |
| `viben plugin add/remove` CLI | New commands for plugins |
| `src/core/index.ts` exports | Unchanged. New plugin types exported additionally. |
| Phase 1 adapter interfaces | `IChannelAdapter`, `MessagingAdapter`, `IRenderer` unchanged. Adapter plugins wrap them. |
| Community plugins from old `AdapterFactory` pattern | Supported via compatibility wrapper in PluginLoader |
| Plugin config validation | No Zod schema in v1 — `pluginConfig` is `Record<string, unknown>`. Plugins validate internally. |

---

## Section 16: Expected Outcomes

| Metric | Before | After Plan 1 | After Plan 2 |
|--------|--------|-------------|-------------|
| core.ts direct deps | 11 | 11 + LifecycleManager | 3 (EventBus, SessionManager, AgentManager) |
| Plugin types supported | adapter only | adapter + any | adapter + any |
| Community capabilities | install adapter only | full: events, middleware, services, commands, storage | full |
| Built-in modules as plugins | 0 | 0 (auto-registered services) | 11 |
| Middleware hook points | 0 | 18 | 18 |
| Error isolation | none | per-plugin try/catch + budget | per-plugin try/catch + budget |
| Service registry entries | 0 | 11 (auto from hard-wired) | 11 (from plugin setup) |
