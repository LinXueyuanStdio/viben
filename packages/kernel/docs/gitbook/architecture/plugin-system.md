# Plugin System Deep Dive

This document covers everything about Viben's plugin system: the interface, lifecycle, context API, permissions, error isolation, settings, and loading order.

---

## VibenPlugin Interface

Every plugin exports an object conforming to this interface:

```typescript
interface VibenPlugin {
  // === Identity ===
  name: string                    // '@viben/security' or '@community/translator'
  version: string                 // semver, e.g. '1.0.0'
  description?: string            // shown in plugin list

  // === Dependencies ===
  pluginDependencies?: Record<string, string>          // name -> semver range
  optionalPluginDependencies?: Record<string, string>  // used if available

  // === Override ===
  overrides?: string              // replace a built-in plugin entirely

  // === Permissions ===
  permissions?: PluginPermission[]  // defaults to [] (no capabilities)

  // === Settings ===
  settingsSchema?: ZodSchema      // validation for settings.json
  essential?: boolean             // true = needs setup before system can run

  // === Runtime lifecycle ===
  setup(ctx: PluginContext): Promise<void>     // called every boot
  teardown?(): Promise<void>                   // called on shutdown

  // === Install lifecycle ===
  install?(ctx: InstallContext): Promise<void>       // first-time setup
  uninstall?(ctx: InstallContext, opts: { purge: boolean }): Promise<void>
  configure?(ctx: InstallContext): Promise<void>     // reconfigure
  migrate?(ctx: MigrateContext, oldSettings: unknown, oldVersion: string): Promise<unknown>
}
```

### Field Details

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier. Must match `/^[@a-z0-9][a-z0-9._\/-]*$/` |
| `version` | Yes | Semver version string |
| `pluginDependencies` | No | Plugins that must load before this one |
| `optionalPluginDependencies` | No | Used if available, graceful degrade if not |
| `overrides` | No | Name of built-in plugin to replace |
| `permissions` | No | Defaults to `[]` -- no capabilities |
| `settingsSchema` | No | Zod schema for validating settings |
| `essential` | No | If true, plugin needs interactive setup before system can run |
| `setup()` | Yes | Called every boot in dependency order (30s timeout) |
| `teardown()` | No | Called on shutdown in reverse order (10s timeout) |
| `install()` | No | Interactive first-time setup |
| `configure()` | No | Interactive reconfiguration |
| `migrate()` | No | Non-interactive settings migration on version change |
| `uninstall()` | No | Cleanup on removal |

---

## Plugin Lifecycle

```
install ──> [reboot] ──> migrate? ──> setup ──> [running] ──> teardown ──> uninstall
   |                        |
   |  First-time setup      |  Version mismatch detected
   |  Interactive (CLI)     |  Non-interactive (boot)
   v                        v
  settings.json created    settings.json updated
```

### Lifecycle hooks in detail

| Hook | Trigger | Interactive? | Has Services? |
|------|---------|-------------|---------------|
| `install()` | `viben plugins install <name>` or first-run | Yes | No |
| `migrate()` | Boot -- stored version differs from plugin version | No | No |
| `configure()` | `viben plugins configure <name>` | Yes | No |
| `setup()` | Every boot, after migrate | No | Yes |
| `teardown()` | Shutdown | No | Yes |
| `uninstall()` | `viben plugins uninstall <name>` | Yes | No |

### Boot sequence for a single plugin

```
Load plugin code from registry
  -> Check plugins.json: stored version vs plugin.version
  -> Version mismatch? -> call plugin.migrate(ctx, oldSettings, oldVersion)
                        -> Plugin returns new settings -> written to settings.json
                        -> Update plugins.json version
  -> Validate settings against settingsSchema (if provided)
  -> Create PluginContext with settings from settings.json
  -> Call plugin.setup(pluginContext)
```

---

## PluginContext API

Every plugin receives a `PluginContext` in its `setup()` call. The context is scoped -- methods check permissions and auto-cleanup on teardown.

```typescript
interface PluginContext {
  // Identity
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
  registerMiddleware<H extends MiddlewareHook>(
    hook: H,
    opts: MiddlewareOptions<MiddlewarePayloadMap[H]>
  ): void

  // Commands (requires 'commands:register')
  registerCommand(def: CommandDef): void

  // Storage (requires 'storage:read' / 'storage:write')
  storage: PluginStorage

  // Messaging (requires 'services:use')
  sendMessage(sessionId: string, content: OutgoingMessage): Promise<void>

  // Kernel access (requires 'kernel:access')
  sessions: SessionManager
  config: ConfigManager
  eventBus: EventBus

  // Always available
  log: Logger
}
```

### PluginStorage

Per-plugin key-value store backed by a JSON file at `~/.viben/plugins/data/{plugin-name}/kv.json`.

```typescript
interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  list(): Promise<string[]>
  getDataDir(): string   // returns absolute path, creates dir if needed
}
```

Writes are serialized per plugin. The `getDataDir()` method returns an absolute path where the plugin can store anything (SQLite databases, large files, caches, etc.).

---

## Permissions Model

Plugins declare required permissions in their `permissions` array. Each `PluginContext` method checks permission before executing.

```typescript
type PluginPermission =
  | 'events:read'          // ctx.on() -- subscribe to events
  | 'events:emit'          // ctx.emit() -- emit custom events
  | 'services:register'    // ctx.registerService()
  | 'services:use'         // ctx.getService(), ctx.sendMessage()
  | 'middleware:register'   // ctx.registerMiddleware()
  | 'commands:register'     // ctx.registerCommand()
  | 'storage:read'          // ctx.storage.get/list
  | 'storage:write'         // ctx.storage.set/delete
  | 'kernel:access'         // ctx.sessions, ctx.config, ctx.eventBus
```

If a plugin calls a method without the required permission, a `PluginPermissionError` is thrown immediately. This error counts against the plugin's error budget.

Omitting `permissions` entirely defaults to `[]` -- the plugin can only run code in `setup()` and use `ctx.log`.

---

## Error Isolation

Every interaction with a plugin is wrapped in error handling. A plugin crash never takes down core or other plugins.

### Error budget

Community plugins have an error budget: **10 errors per hour** (configurable). When exceeded:

1. Plugin is auto-disabled for the rest of the runtime
2. All middleware, event handlers, and service calls stop executing
3. Event `plugin:disabled` is emitted
4. Warning logged

Built-in plugins are exempt from error budgets -- bugs should be fixed in code.

### Per-call isolation

```typescript
async function safeCall<T>(
  pluginName: string,
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
    log.error({ plugin: pluginName, err }, 'Plugin error')
    errorTracker.increment(pluginName)
    return fallback
  }
}
```

### Recovery

- Disable is runtime-only -- does NOT persist to config
- Next restart re-enables the plugin and resets the budget
- Manual re-enable during runtime is not supported in v1

### Error behavior by context

| Context | Behavior |
|---------|----------|
| Middleware chain | Skip handler, pass original payload to next |
| Event handler | Swallow error, other listeners still receive event |
| Service call | Throw to caller, caller handles gracefully |
| setup() throws | Plugin marked failed, dependents cascade-skipped |
| teardown() throws | Logged, continue with next plugin |

---

## Settings System

Each plugin has its own `settings.json` file, managed independently.

### Directory structure

```
~/.viben/
  config.json                          <- core settings ONLY
  plugins.json                         <- Plugin Registry
  plugins/
    @viben/
      telegram/
        settings.json                  <- plugin settings
        data/                          <- plugin data dir
      security/
        settings.json
        data/
    @community/
      translator/
        settings.json
        data/
```

### SettingsAPI

Available in `InstallContext` for interactive lifecycle hooks.

```typescript
interface SettingsAPI {
  get<T = unknown>(key: string): Promise<T | undefined>
  set<T = unknown>(key: string, value: T): Promise<void>
  getAll(): Promise<Record<string, unknown>>
  setAll(settings: Record<string, unknown>): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  has(key: string): Promise<boolean>
}
```

### SettingsManager

Core module that creates `SettingsAPI` instances per plugin and handles validation.

```typescript
class SettingsManager {
  createAPI(pluginName: string): SettingsAPI
  loadSettings(pluginName: string): Promise<Record<string, unknown>>
  validateSettings(pluginName: string, settings: unknown, schema?: ZodSchema): ValidationResult
}
```

Validation runs after:
1. `migrate()` returns new settings
2. `install()` completes
3. API/Web UI updates settings

Validation failure prevents boot -- the plugin is marked as failed.

---

## Plugin Registry

Tracks all installed plugins in `~/.viben/plugins.json`:

```json
{
  "installed": {
    "@viben/telegram": {
      "version": "1.0.0",
      "installedAt": "2026-03-26T10:00:00Z",
      "updatedAt": "2026-03-26T10:00:00Z",
      "source": "builtin",
      "enabled": true,
      "settingsPath": "~/.viben/plugins/@viben/telegram/settings.json",
      "description": "Telegram messaging adapter"
    },
    "@community/translator": {
      "version": "2.1.0",
      "source": "npm",
      "enabled": true,
      "description": "Auto-translate messages"
    }
  }
}
```

### PluginRegistry class

```typescript
class PluginRegistry {
  list(): Map<string, PluginEntry>
  get(name: string): PluginEntry | undefined
  register(name: string, entry: PluginEntry): void
  remove(name: string): void
  setEnabled(name: string, enabled: boolean): void
  updateVersion(name: string, version: string): void
  listEnabled(): Map<string, PluginEntry>
  listBySource(source: 'builtin' | 'npm' | 'local'): Map<string, PluginEntry>
}
```

Built-in plugins cannot be uninstalled (source `builtin`). They can only be disabled:

```bash
viben plugins disable @viben/speech
```

---

## Plugin Discovery and Loading Order

### Discovery

1. **Built-in plugins**: imported from `src/plugins/*/index.ts`, marked as trusted
2. **Community plugins**: read from `~/.viben/plugins/package.json` dependencies, checksums verified against `~/.viben/plugins/checksums.json`

### Filtering

- Config `enabled: false` -> skip
- No config entry for built-in -> enabled by default
- No config entry for community -> disabled by default

### Override resolution

If a plugin declares `overrides: '@viben/security'`, the overridden plugin is removed from the load list entirely. The overriding plugin takes its place.

### Dependency validation

1. Build dependency graph (nodes = plugins, edges = `pluginDependencies`)
2. Detect circular dependencies (DFS) -- skip all plugins in cycle
3. Check missing required dependencies -- skip plugin and all its dependents
4. Check semver ranges -- log warning on mismatch, still attempt to load
5. Optional dependencies: log info if missing, plugin handles `undefined` from `getService()`

### Topological sort

```
Plugins with no dependencies          -> depth 0 (load first)
Plugins depending on depth-0 plugins  -> depth 1
Plugins depending on depth-1 plugins  -> depth 2
...
```

Within the same depth level, load order is determined by registration order.

---

## Legacy Migration

When upgrading from pre-plugin config.json (all settings in one file):

1. Core detects: config.json has plugin fields AND plugins.json does not exist
2. Create plugins.json, auto-register all built-in plugins
3. For each built-in: extract legacy config, call `plugin.install()` with `legacyConfig`
4. Plugin reads `legacyConfig` -> saves to settings.json (no interactive prompts)
5. Strip plugin-specific fields from config.json
6. Normal boot continues

If migration fails for one plugin, legacy config is kept for retry on next boot.

---

## Further Reading

- [Architecture Overview](README.md) -- high-level picture
- [Core Design](core-design.md) -- core module details
- [Writing Plugins](writing-plugins.md) -- step-by-step plugin development guide
- [Built-in Plugins](built-in-plugins.md) -- all 11 built-in plugins documented
