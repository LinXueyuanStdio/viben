import type {
  OutgoingMessage,
  AgentEvent,
  PermissionRequest,
  Attachment,
  StopReason,
  SessionStatus,
  ConfigOption,
  NotificationMessage,
  UsageRecord,
} from '../types.js'
import type { IChannelAdapter } from '../channel.js'
import type { TurnMeta } from '../types.js'

/** Re-export IChannelAdapter for plugin authors */
export type { IChannelAdapter }

// ============================================================
// Section 2: Plugin Interface
// ============================================================

/**
 * Permission tokens that gate access to PluginContext capabilities.
 * Declared in a plugin's `permissions` array; enforced at runtime by PluginContext.
 */
export type PluginPermission =
  /** Subscribe to EventBus events */
  | 'events:read'
  /** Emit custom events on the EventBus */
  | 'events:emit'
  /** Register services in the ServiceRegistry */
  | 'services:register'
  /** Look up and consume services from the ServiceRegistry */
  | 'services:use'
  /** Register middleware handlers on hook points */
  | 'middleware:register'
  /** Register slash commands, menu items, assistant sections, and editable fields */
  | 'commands:register'
  /** Read from plugin-scoped storage */
  | 'storage:read'
  /** Write to plugin-scoped storage */
  | 'storage:write'
  /** Direct access to VibenCore internals (sessions, config, eventBus) */
  | 'kernel:access'
  /** Read-only session metadata without kernel:access */
  | 'sessions:read'
  /** Read identity data (users, identities, search) */
  | 'identity:read'
  /** Write identity data (create, update, link, unlink, roles) */
  | 'identity:write'
  /** Register an identity source (adapters register their platform name) */
  | 'identity:register-source'
  /** Send push notifications to users */
  | 'notifications:send'

/**
 * The runtime plugin instance — the object a plugin module default-exports.
 *
 * This is distinct from `PluginEntry` (the registry's persisted metadata about
 * an installed plugin). `VibenPlugin` defines behavior (setup/teardown hooks),
 * while `PluginEntry` tracks install state (version, source, enabled flag).
 *
 * Lifecycle: LifecycleManager topo-sorts plugins by `pluginDependencies`,
 * then calls `setup()` on each in order, passing a scoped `PluginContext`.
 */
export interface VibenPlugin {
  /** Unique identifier, e.g., '@viben/security' */
  name: string
  /** Semver version */
  version: string
  /** Human-readable description */
  description?: string
  /** Required plugin dependencies — loaded before this plugin's setup() */
  pluginDependencies?: Record<string, string>
  /** Optional dependencies — used if available, gracefully degrade if not */
  optionalPluginDependencies?: Record<string, string>
  /** Override a built-in plugin (replaces it entirely) */
  overrides?: string
  /** Required permissions — PluginContext enforces these at runtime */
  permissions?: PluginPermission[]
  /**
   * Glob patterns for bash commands that should be auto-approved in sessions
   * spawned by this plugin. Patterns use micromatch glob syntax.
   *
   * Example: `['gh pr view *', 'git -C **\/workspaces\/** pull *']`
   */
  autoApprovedCommands?: string[]
  /** Called during startup in dependency order. 30s timeout. */
  setup(ctx: PluginContext): Promise<void>
  /** Called during shutdown in reverse dependency order. 10s timeout. */
  teardown?(): Promise<void>
  /** Called once when the plugin is first installed via CLI */
  install?(ctx: InstallContext): Promise<void>
  /** Called when the plugin is removed via CLI. `purge` deletes data too. */
  uninstall?(ctx: InstallContext, opts: { purge: boolean }): Promise<void>
  /** Interactive configuration via CLI (post-install) */
  configure?(ctx: InstallContext): Promise<void>
  /**
   * Called at boot when the registry's stored version differs from the plugin's
   * current version. Returns new settings to persist, or void to keep existing.
   */
  migrate?(ctx: MigrateContext, oldSettings: unknown, oldVersion: string): Promise<unknown>
  /** Zod schema to validate settings before setup(). Validation failure skips the plugin. */
  settingsSchema?: import('zod').ZodSchema
  /** If true, the plugin is critical to core operation (informational flag) */
  essential?: boolean
  /** Settings keys that can be copied when creating a new instance from this one */
  inheritableKeys?: string[]
}

// ============================================================
// Section 3: PluginContext, PluginStorage, CommandDef
// ============================================================

/**
 * Per-plugin key-value storage backed by a JSON file on disk.
 * Each plugin gets an isolated namespace at `~/.viben/plugins/<name>/kv.json`.
 */
export interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  list(): Promise<string[]>
  /** Returns keys matching the given prefix, or all keys if prefix is omitted. */
  keys(prefix?: string): Promise<string[]>
  /** Deletes all keys in this storage scope. */
  clear(): Promise<void>
  /** Returns the plugin's dedicated data directory, creating it if needed */
  getDataDir(): string
  /** Returns a storage instance scoped to the given session. Auto-isolated from global storage. */
  forSession(sessionId: string): PluginStorage
}

// ─── Settings API (per-plugin settings.json) ───

/**
 * Typed API for reading and writing a plugin's settings.json file.
 * Backed by SettingsManager; available in InstallContext and MigrateContext.
 */
export interface SettingsAPI {
  get<T = unknown>(key: string): Promise<T | undefined>
  set<T = unknown>(key: string, value: T): Promise<void>
  getAll(): Promise<Record<string, unknown>>
  setAll(settings: Record<string, unknown>): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  has(key: string): Promise<boolean>
}

// ─── Plugin Field Declaration ───

/** Describes a settings field that a plugin exposes as editable via API/UI */
export interface FieldDef {
  /** Settings key (matches the key in plugin settings.json) */
  key: string
  /** Human-readable label for UI display */
  displayName: string
  type: "toggle" | "select" | "number" | "string"
  /** safe = readable via API; sensitive = write-only (e.g., tokens) */
  scope: "safe" | "sensitive"
  /** Whether the change takes effect without restart. Default: false */
  hotReload?: boolean
  /** Valid values for "select" type */
  options?: string[]
}

// ─── Terminal I/O (interactive CLI for plugins) ───

/**
 * Interactive CLI primitives for plugin install/configure flows.
 * Wraps @clack/prompts — only available during CLI operations (install, configure),
 * NOT during normal runtime. Plugins use this in their `install()` and `configure()` hooks.
 */
export interface TerminalIO {
  text(opts: {
    message: string
    placeholder?: string
    defaultValue?: string
    validate?: (value: string) => string | undefined
  }): Promise<string>

  select<T>(opts: {
    message: string
    options: { value: T; label: string; hint?: string }[]
  }): Promise<T>

  confirm(opts: {
    message: string
    initialValue?: boolean
  }): Promise<boolean>

  password(opts: {
    message: string
    validate?: (value: string) => string | undefined
  }): Promise<string>

  multiselect<T>(opts: {
    message: string
    options: { value: T; label: string; hint?: string }[]
    required?: boolean
  }): Promise<T[]>

  log: {
    info(message: string): void
    success(message: string): void
    warning(message: string): void
    error(message: string): void
    step(message: string): void
  }

  spinner(): {
    start(message: string): void
    stop(message?: string): void
    fail(message?: string): void
  }

  note(message: string, title?: string): void
  cancel(message?: string): void
}

// ─── Install Context (for install/configure/uninstall) ───

/**
 * Context provided to plugin install/uninstall/configure hooks.
 * Unlike PluginContext (runtime), InstallContext provides terminal I/O
 * for interactive setup but no access to services, middleware, or events.
 */
export interface InstallContext {
  pluginName: string
  terminal: TerminalIO
  settings: SettingsAPI
  dataDir: string
  log: Logger
  /** Root of the Viben instance directory (e.g. ~/.viben) */
  instanceRoot?: string
}

// ─── Migrate Context (for boot-time migration) ───

/**
 * Context provided to the `migrate()` hook at boot time when the plugin's
 * current version differs from the version stored in the registry.
 */
export interface MigrateContext {
  pluginName: string
  settings: SettingsAPI
  log: Logger
}

// ─── Command Response Types ───

/**
 * Possible response shapes from a command handler.
 * Adapters render each type per-platform (e.g., Telegram inline keyboards for menus).
 */
export type CommandResponse =
  | { type: 'text'; text: string }
  | {
      /**
       * Adapter-aware response: each adapter reads its own key from `variants`.
       * Adapters without a matching variant render `fallback` as plain text.
       *
       * Variant shapes by adapter ID:
       *   telegram: { text: string; parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2' }
       *   discord:  { content?: string; embeds?: unknown[] }
       *   slack:    { text: string; blocks?: unknown[] }
       *   sse:      { text: string; format?: 'plain' | 'markdown' | 'html' }
       */
      type: 'adaptive'
      /** Plain text rendered by adapters without a matching variant */
      fallback: string
      /** Per-adapter payloads, keyed by adapter ID */
      variants?: Record<string, unknown>
    }
  | { type: 'menu'; title: string; options: MenuOption[] }
  | { type: 'list'; title: string; items: ListItem[] }
  | { type: 'confirm'; question: string; onYes: string; onNo: string }
  | { type: 'error'; message: string }
  /** Command handled successfully but produces no visible output */
  | { type: 'silent' }
  /** Command delegates further processing to another system (e.g., agent prompt) */
  | { type: 'delegated' }

// ─── Menu Types ───

export interface MenuItem {
  id: string
  label: string
  priority: number
  group?: string
  action:
    | { type: 'command'; command: string }
    | { type: 'delegate'; prompt: string }
    | { type: 'callback'; callbackData: string }
  visible?: () => boolean
}

export interface MenuOption {
  label: string
  command: string
  hint?: string
}

export interface ListItem {
  label: string
  detail?: string
}

export interface CommandArgs {
  /** Raw argument string after command name */
  raw: string
  /** Parsed key/value options (e.g., --flag value) */
  options?: Record<string, string>
  /** Session ID where command was invoked (null if from notification/system topic) */
  sessionId: string | null
  /** Channel ID ('telegram', 'discord', 'slack') */
  channelId: string
  /** User ID who invoked the command */
  userId: string
  /** Reply helper — sends message to the topic where command was invoked */
  reply(content: string | CommandResponse | OutgoingMessage): Promise<void>
  /** Direct access to VibenCore instance. Available when 'kernel:access' permission is granted. */
  coreAccess?: CoreAccess
}

export interface CommandDef {
  /** Command name without slash, e.g., 'context' for /context */
  name: string
  /** Short description shown in command list */
  description: string
  /** Usage pattern, e.g., '<session-number>' */
  usage?: string
  /** Whether this is a built-in system command or registered by a plugin */
  category: 'system' | 'plugin'
  /** Plugin that registered this command (set automatically by plugin manager) */
  pluginName?: string
  /** Handler function */
  handler(args: CommandArgs): Promise<CommandResponse | void>
}

// Forward declarations for kernel types used in PluginContext.
// Structural (index-signature) types to avoid circular imports with core modules.
export interface SessionManager {
  [key: string]: unknown
}

export interface ConfigManager {
  [key: string]: unknown
}

export interface EventBus {
  [key: string]: unknown
}

/**
 * Typed view of the VibenCore instance exposed to plugins via ctx.core.
 * Plugins that need kernel:access should cast ctx.core to this interface
 * instead of using `as any`. Only includes fields plugins actually need.
 */
export interface CoreAccess {
  configManager: ConfigManager
  sessionManager: SessionManager
  adapters: Map<string, IChannelAdapter>
}

/** Pino-compatible logger interface used throughout the plugin system. */
export interface Logger {
  trace(msg: string, ...args: unknown[]): void
  debug(msg: string, ...args: unknown[]): void
  info(msg: string, ...args: unknown[]): void
  warn(msg: string, ...args: unknown[]): void
  error(msg: string, ...args: unknown[]): void
  fatal(msg: string, ...args: unknown[]): void
  /** Create a child logger with additional context bindings (e.g., `{ plugin: name }`) */
  child(bindings: Record<string, unknown>): Logger
}

/**
 * Scoped API surface given to each plugin during setup().
 *
 * Each plugin receives its own PluginContext instance with permission-gated
 * access. This provides isolation: storage is namespaced per-plugin, logs are
 * prefixed with the plugin name, and only declared permissions are allowed.
 *
 * Tier 1 (Events) — subscribe/emit on the shared EventBus.
 * Tier 2 (Actions) — register services, middleware, commands.
 * Tier 3 (Kernel)  — direct access to core internals (requires kernel:access).
 */
export interface PluginContext {
  // === Identity ===
  pluginName: string
  pluginConfig: Record<string, unknown>

  // === Tier 1 — Events ===
  /** Subscribe to events. Auto-cleaned on teardown. Requires 'events:read'. */
  on(event: string, handler: (...args: unknown[]) => void): void
  /**
   * Unsubscribes a previously registered event handler.
   *
   * Called automatically for all listeners registered via `on()` during plugin teardown.
   * Use manually only when conditional unsubscription is needed before teardown.
   * Requires 'events:read' permission.
   */
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
  /** Register a menu item. Requires 'commands:register'. */
  registerMenuItem(item: MenuItem): void
  /** Unregister a menu item by id. Requires 'commands:register'. */
  unregisterMenuItem(id: string): void
  /** Register an assistant section. Requires 'commands:register'. */
  registerAssistantSection(section: import('../assistant/assistant-registry.js').AssistantSection): void
  /** Unregister an assistant section by id. Requires 'commands:register'. */
  unregisterAssistantSection(id: string): void
  /**
   * Declare this plugin's settings fields as editable via API/UI.
   * Call in setup() after registering services.
   * Requires 'commands:register'.
   */
  registerEditableFields(fields: FieldDef[]): void
  /** Plugin-scoped storage. Requires 'storage:read' and/or 'storage:write'. */
  storage: PluginStorage
  /** Plugin-scoped logger. Always available (no permission needed). */
  log: Logger
  /**
   * Send message to a session. Requires 'services:use'.
   *
   * Routing: sessionId → lookup session → find adapter for session's channelId
   *          → [HOOK: message:outgoing] → adapter.sendMessage()
   */
  sendMessage(sessionId: string, content: OutgoingMessage): Promise<void>

  /**
   * Send a user-targeted notification. Fire-and-forget, best-effort.
   * Resolves target via identity system — one call delivers across all linked platforms.
   * Requires 'notifications:send' permission.
   */
  notify(
    target: { identityId: string } | { userId: string } | { channelId: string; platformId: string },
    message: { type: 'text'; text: string },
    options?: {
      via?: 'dm' | 'thread' | 'topic'
      topicId?: string
      sessionId?: string
      onlyPlatforms?: string[]
      excludePlatforms?: string[]
    }
  ): void

  /**
   * Define a custom hook that other plugins can register middleware on.
   * The hook name is automatically prefixed with `plugin:{pluginName}:`.
   */
  defineHook(name: string): void

  /**
   * Fire a custom hook through the middleware chain.
   * Name is auto-prefixed: `emitHook('foo', p)` fires `plugin:{pluginName}:foo`.
   * Returns the final payload (possibly modified by middleware), or null if blocked.
   */
  emitHook<T extends Record<string, unknown>>(name: string, payload: T): Promise<T | null>

  /**
   * Read-only session metadata. Requires `sessions:read` permission.
   * Returns undefined if the session does not exist.
   */
  getSessionInfo(sessionId: string): Promise<{
    id: string
    status: import('../types.js').SessionStatus
    name?: string
    promptCount: number
    channelId: string
    agentName: string
  } | undefined>

  // === Tier 3 — Kernel access (requires 'kernel:access') ===
  /** Direct access to SessionManager. Requires 'kernel:access'. */
  sessions: SessionManager
  /** Direct access to ConfigManager. Requires 'kernel:access'. */
  config: ConfigManager
  /** Direct access to EventBus. Requires 'kernel:access'. */
  eventBus: EventBus
  /** Direct access to VibenCore instance. Requires 'kernel:access'. */
  core: unknown

  /**
   * Root directory for this Viben instance (default: ~/.viben).
   * Plugins should derive file paths from this instead of hardcoding ~/.viben.
   */
  instanceRoot: string
}

// ============================================================
// Section 4: Middleware System
// ============================================================

/**
 * Maps each middleware hook name to its payload type.
 *
 * Middleware handlers receive the payload, can modify it, and call `next()` to pass
 * it down the chain. Returning `null` short-circuits the chain (blocks the operation).
 * There are 19 hook points covering message flow, agent lifecycle, file system,
 * terminal, permissions, sessions, config changes, and agent switching.
 */
export interface MiddlewarePayloadMap {
  // === Message flow ===
  'message:incoming': {
    channelId: string
    threadId: string
    userId: string
    text: string
    attachments?: Attachment[]
    /** Per-turn context bag. Undefined for messages that bypass the normal handleMessage flow. */
    meta?: TurnMeta
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
    sourceAdapterId?: string
    /** Per-turn context bag carried from message:incoming. */
    meta?: TurnMeta
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
    turnId: string
    meta?: TurnMeta
    userPrompt?: string
    sourceAdapterId?: string
    responseAdapterId?: string | null
  }
  'turn:end': {
    sessionId: string
    stopReason: StopReason
    durationMs: number
    turnId: string
    meta?: TurnMeta
  }
  /** Fires after the full turn response is assembled. Read-only, fire-and-forget. */
  'agent:afterTurn': {
    sessionId: string
    turnId: string
    /** Complete response text — all text chunks concatenated. Empty if agent produced no text. */
    fullText: string
    stopReason: StopReason
    meta?: TurnMeta
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
    autoResolve?: string
  }
  'permission:afterResolve': {
    sessionId: string
    requestId: string
    decision: string
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
  'config:beforeChange': {
    sessionId: string
    configId: string
    oldValue: unknown
    newValue: unknown
  }
  'agent:beforeCancel': {
    sessionId: string
    reason?: string
  }

  // === Agent switch ===
  'agent:beforeSwitch': {
    sessionId: string
    fromAgent: string
    toAgent: string
  }
  'agent:afterSwitch': {
    sessionId: string
    fromAgent: string
    toAgent: string
    resumed: boolean
  }
}

/** Union of all valid middleware hook names */
export type MiddlewareHook = keyof MiddlewarePayloadMap

/**
 * Middleware handler signature. Receives the current payload and a `next` function.
 * - Call `next()` to continue the chain (optionally with a modified payload).
 * - Return the (possibly modified) payload to pass it upstream.
 * - Return `null` to short-circuit — the operation is blocked entirely.
 */
export type MiddlewareFn<T> = (payload: T, next: () => Promise<T>) => Promise<T | null>

export interface MiddlewareOptions<T> {
  /** Override execution order within same dependency level. Lower = earlier. */
  priority?: number
  /** The middleware handler */
  handler: MiddlewareFn<T>
}

// ============================================================
// Section 8: Plugin Events
// ============================================================

/**
 * Well-known events emitted on the EventBus.
 * Plugins can subscribe via `ctx.on(event, handler)`.
 * Custom plugin events use the `pluginName:eventName` convention.
 */
export interface PluginEventMap {
  // System lifecycle
  'kernel:booted': Record<string, never>
  'system:ready': Record<string, never>
  'system:shutdown': Record<string, never>
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

// ============================================================
// Section 6: Service Contract Interfaces
// ============================================================

// These interfaces define the typed contracts for services registered in
// the ServiceRegistry. Plugins register implementations; core and other
// plugins retrieve them via `serviceRegistry.get<T>(name)`.

export interface SecurityService {
  checkAccess(userId: string): Promise<{ allowed: boolean; reason?: string }>
  checkSessionLimit(userId: string): Promise<{ allowed: boolean; reason?: string }>
  getUserRole(userId: string): Promise<'admin' | 'user' | 'blocked'>
}

export interface FileServiceInterface {
  saveFile(sessionId: string, fileName: string, data: Buffer, mimeType: string): Promise<Attachment>
  resolveFile(filePath: string): Promise<Attachment | null>
  readTextFileWithRange(path: string, opts?: { line?: number; limit?: number }): Promise<string>
  extensionFromMime(mimeType: string): string
  convertOggToWav(oggData: Buffer): Promise<Buffer>
}

export interface NotificationService {
  notify(channelId: string, notification: NotificationMessage): Promise<void>
  notifyAll(notification: NotificationMessage): Promise<void>
  /** Send a notification to a user across all their linked platforms. Fire-and-forget. */
  notifyUser?(
    target: { identityId: string } | { userId: string } | { channelId: string; platformId: string },
    message: { type: 'text'; text: string },
    options?: {
      via?: 'dm' | 'thread' | 'topic'
      topicId?: string
      sessionId?: string
      onlyPlatforms?: string[]
      excludePlatforms?: string[]
    }
  ): Promise<void>
}

export interface UsageService {
  trackUsage(record: UsageRecord): Promise<void>
  checkBudget(sessionId: string): Promise<{ ok: boolean; percent: number; warning?: string }>
}

export interface TTSProvider {
  synthesize(text: string, opts?: { language?: string; voice?: string }): Promise<Buffer>
}

export interface STTProvider {
  transcribe(audio: Buffer, opts?: { language?: string }): Promise<string>
}

export interface SpeechServiceInterface {
  textToSpeech(text: string, opts?: { language?: string; voice?: string }): Promise<Buffer>
  speechToText(audio: Buffer, opts?: { language?: string }): Promise<string>
  registerTTSProvider(name: string, provider: TTSProvider): void
  registerSTTProvider(name: string, provider: STTProvider): void
}

export interface ContextProvider {
  provide(sessionId: string, opts?: { maxTokens?: number }): Promise<string>
}

export interface ContextService {
  buildContext(sessionId: string, opts?: { maxTokens?: number }): Promise<string>
  registerProvider(provider: ContextProvider): void
}

export interface ViewerStoreInterface {
  storeFile(sessionId: string, filePath: string, content: string, workingDirectory: string): string | null
  storeDiff(sessionId: string, filePath: string, oldContent: string, newContent: string, workingDirectory: string): string | null
  storeOutput(sessionId: string, label: string, output: string): string | null
}

export interface TunnelServiceInterface {
  getPublicUrl(): string
  start(apiPort: number): Promise<string>
  stop(): Promise<void>
  getStore(): ViewerStoreInterface
  fileUrl(entryId: string): string
  diffUrl(entryId: string): string
  outputUrl(entryId: string): string
}

// Re-export types needed by plugin authors from types.ts
export type {
  OutgoingMessage,
  AgentEvent,
  PermissionRequest,
  Attachment,
  StopReason,
  SessionStatus,
  ConfigOption,
  NotificationMessage,
  UsageRecord,
}
